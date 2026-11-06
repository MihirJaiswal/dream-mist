//Imports
import * as PIXI from "pixi.js";
import { artwork, assets, creatureSprite, npc as texture, preview, size, species, sprite, walk, type Walk } from "./assets";
import { fields } from "./fields";
import { frames } from "./brushes";
import { type Action, type Check, type City, type Direction, type Door, levelCap, type Npc, type Trigger } from "./data";
import { arrow, COUNTER, ICE, ledge, WATER } from "./behaviors";
import { period } from "./atmosphere";
import { pool, roll } from "./encounters";
import { berryTree, type CityMap, drawDen, exclamation, glowingBall, itemBall } from "./map";
import { Battle, battleWeather, trainerRules } from "./battle";
import { creatureImage, creatureLook, scaleOf } from "./sprites";
import { befriend, create, grow, heal, hp, named, teamOf, trainer } from "./trainer";
import { bestRod, itemCount, items, plural, sold } from "./items";
import { milestone, open } from "./story";
import { evolveGrown, field, nickname } from "./growth";
import { sound } from "./audio";
import { type Portrait, ui } from "./ui-bridge";

/** Direction deltas */
const deltas = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as const;

/** Opposite directions */
const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;

/** Keyboard mapping */
const keys = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" } as {
  [key: string]: Direction;
};

/** Sight range of trainers */
const sight = 4;

/** Character walking on the map */
class Actor {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: Direction;
  /** Where a ledge jump started (the actor hops up while jumping) */
  jump = null as null | { x: number; y: number };
  /** Sliding on ice: no walking frames */
  sliding = false;
  readonly sprite: PIXI.Sprite;
  readonly name: string;
  /** Single texture of a Pokémon on the map, until its walking frames are loaded (custom Pokémon keep theirs) */
  #still: null | PIXI.Texture;
  /** Walking frames of a Pokémon (people use their own walking frames) */
  #walk = null as null | Walk;

  constructor({
    x,
    y,
    dir,
    name,
    parent,
    creature,
    look,
    shiny = false,
  }: {
    x: number;
    y: number;
    dir: Direction;
    name: string;
    parent: PIXI.Container;
    creature?: number;
    look?: string;
    shiny?: boolean;
  }) {
    this.x = this.tx = x;
    this.y = this.ty = y;
    this.dir = dir;
    this.name = name;
    const still = creature ? creatureSprite(creature, look) : null;
    this.#still = still?.texture ?? null;
    this.sprite = parent.addChild(new PIXI.Sprite(still?.texture ?? texture(name, dir)));
    this.sprite.anchor.set(0.5, 1);
    //Pokémon and custom sprites are scaled to the map
    this.sprite.scale.set(still ? still.scale : scaleOf(name));
    this.place();
    //Pokémon walk on the map like in the Gen 3 games, once their frames are loaded
    if (creature && !creatureLook(look)) {
      void walk(creature, shiny).then((frames) => {
        if (frames && !this.sprite.destroyed) {
          this.#walk = frames;
          this.#still = null;
          this.sprite.scale.set(1);
          this.sprite.texture = frames[this.dir][0];
          this.place();
        }
      });
    }
  }

  /** Is moving */
  get moving() {
    return this.x !== this.tx || this.y !== this.ty;
  }

  /** Face a direction */
  face(dir: Direction) {
    this.dir = dir;
    if (this.#walk) {
      this.sprite.texture = this.#walk[dir][0];
    } else if (!this.#still) {
      this.sprite.texture = texture(this.name, dir, 0);
    } else if (dir === "left" || dir === "right") {
      //Box icons face left, flip them to look right
      this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (dir === "right" ? -1 : 1);
    }
  }

  /** Advance toward target (returns true when step completed this frame) */
  advance(delta: number) {
    if (!this.moving) {
      //Pokémon step in place while they stand, slowly
      if (this.#walk) {
        this.sprite.texture = this.#walk[this.dir][Math.floor(performance.now() / 500) % 2];
      }
      return false;
    }
    const remaining = Math.abs(this.tx - this.x) + Math.abs(this.ty - this.y);
    const step = Math.min(delta, remaining);
    this.x += Math.sign(this.tx - this.x) * step;
    this.y += Math.sign(this.ty - this.y) * step;
    const left = remaining - step;
    if (left < 1e-6) {
      this.x = this.tx;
      this.y = this.ty;
    }
    if (this.#walk) {
      //Two frames a tile, like the games
      this.sprite.texture = this.#walk[this.dir][left > 0 && !this.sliding ? Math.floor(left * 2) % 2 : 0];
    } else if (!this.#still) {
      this.sprite.texture = texture(this.name, this.dir, left > 0 && !this.sliding ? (Math.floor(left * 4) % 2 ? 1 : 2) : 0);
    }
    this.place();
    return !this.moving;
  }

  /** Apply position to sprite */
  place() {
    //Pokémon hop a little while moving
    let hop = this.#still && this.moving ? -Math.abs(Math.sin((this.x + this.y) * Math.PI)) * 3 : 0;
    //A ledge jump arcs over two tiles
    if (this.jump) {
      const travelled = Math.abs(this.x - this.jump.x) + Math.abs(this.y - this.jump.y);
      hop = -Math.sin((Math.min(2, travelled) / 2) * Math.PI) * 7;
    }
    this.sprite.position.set(this.x * size + size / 2, (this.y + 1) * size + (this.#still ? 2 : 0) + hop + this.lift);
    this.sprite.zIndex = this.y + this.depth;
  }

  /** Extra height (riding a Pokémon while surfing) */
  lift = 0;

  /** Drawing order nudge on the same row (the follower stays behind the player when they cross) */
  depth = 0;

  /** Remove */
  destroy() {
    if (!this.sprite.destroyed) {
      this.sprite.destroy();
    }
  }
}

/** Person walking around the city */
type Person = {
  actor: Actor;
  data: Npc;
  index: number;
  home: { x: number; y: number };
  next: number;
  bubble: null | PIXI.Container;
  hidden: boolean;
  leg: number;
  way: 1 | -1;
};

/** Picture shown beside someone's dialogue: the one picked for them, a Pokémon's artwork, or their map sprite drawn bigger (signs have none) */
export function portraitOf(data: Npc): Portrait | undefined {
  if (data.hidePortrait) {
    return undefined;
  }
  const sprite = (name: string): Portrait | undefined => {
    try {
      return { src: preview(texture(name, "down"), 1).toDataURL(), kind: "sprite" };
    } catch {
      //Images from another site without CORS can't be copied
      return undefined;
    }
  };
  if (data.portrait?.startsWith("sprite:")) {
    return sprite(data.portrait.slice("sprite:".length));
  }
  if (data.portrait) {
    return { src: data.portrait, kind: "art" };
  }
  if (data.creature) {
    return { src: creatureImage(data.creature.look) || artwork(data.creature.species), kind: "art" };
  }
  return data.sprite ? sprite(data.sprite) : undefined;
}

/**
 * Play mode.
 * Walk around a city, talk to people, battle trainers and catch wild creatures.
 */
export class Play {
  readonly #map: CityMap;
  readonly #city: City;
  #player = null as unknown as Actor;
  readonly #npcs = [] as Person[];
  readonly #held = [] as Direction[];

  /** A quick tap towards the direction already faced steps once */
  #tap = null as Direction | null;
  #busy = false;
  #running = false;
  /** Wild grass drawn over the player's feet, and the part of each kind of grass tile it shows */
  #grass = null as unknown as PIXI.Sprite;
  /** The same over the following Pokémon's feet */
  #followerGrass = null as unknown as PIXI.Sprite;
  readonly #grasses = new Map<number, PIXI.Texture>();
  readonly #ticker: (dt: number) => void;
  readonly #listeners = [] as [string, EventListener][];
  /** Whole city (story and progress live there), arrival position and door handler */
  readonly #world: City;
  readonly #arrive: null | { x: number; y: number; dir: Direction };
  readonly #onwarp: null | ((door: Door) => void);
  /** Walking off the edge of the map: true when another map is there and the player moves onto it */
  readonly #onedge: null | ((x: number, y: number, dir: Direction) => boolean);
  /** Hitting a raid boss: the live room shares the damage (when there is one) */
  readonly #onraid: null | ((den: string, damage: number) => void);
  readonly #live: () => boolean;
  /** Next time a gate message may show again */
  #bump = 0;
  /** Direction the player keeps moving in on their own (ice, push tiles) */
  #force = null as Direction | null;
  /** Surfing on a Pokémon, drawn under the player */
  #surfing = false;
  #mount = null as null | PIXI.Sprite;
  /** A script is running: the player's scripted steps don't open doors or meet Pokémon */
  #scene = false;
  /** Item balls lying on the map */
  readonly #balls = [] as { index: number; graphic: PIXI.Sprite }[];
  /** Obstacles of field moves where they stand now (boulders move), those cleared this visit, and Strength in use */
  readonly #obstacles = [] as { index: number; sprite: PIXI.Sprite; x: number; y: number }[];
  readonly #cleared = new Set<number>();
  /** Berry trees (their berries grow back in real time) */
  readonly #trees = [] as { index: number; graphic: PIXI.Sprite }[];
  /** Raid dens (their boss is back the next day) */
  readonly #dens = [] as { index: number; graphic: PIXI.Graphics }[];
  #strong = false;
  /** The lead Pokémon walking behind the player, and the tile the player is heading to */
  #follower = null as null | Actor;
  #followed = 0;
  #heading = { x: 0, y: 0 };
  /** Darkness of a dark map, with a little light around the player (gone once Flash is used) */
  #dark = null as null | PIXI.Sprite;

  constructor(
    map: CityMap,
    city: City,
    {
      world = city,
      arrive = null as null | { x: number; y: number; dir: Direction },
      onwarp = null as null | ((door: Door) => void),
      onedge = null as null | ((x: number, y: number, dir: Direction) => boolean),
      onraid = null as null | ((den: string, damage: number) => void),
      live = null as null | (() => boolean),
    } = {},
  ) {
    this.#map = map;
    this.#city = city;
    this.#world = world;
    this.#arrive = arrive;
    this.#onwarp = onwarp;
    this.#onedge = onedge;
    this.#onraid = onraid;
    this.#live = live ?? (() => false);
    this.#ticker = (dt: number) => this.#update(dt);
  }

  /** Tile the player stands on (the Town Map shows it) */
  get position() {
    return { x: Math.round(this.#player.x), y: Math.round(this.#player.y) };
  }

  /** Progress key of a person (outside map keeps the original format) */
  #key(index: number) {
    return this.#city === this.#world ? `${this.#world.id}:${index}` : `${this.#world.id}:${this.#city.id}/${index}`;
  }

  /** Is a story step done by the player */
  #done(step?: string) {
    return trainer.done(this.#world.id, step);
  }

  /** Is a person present at this point of the story (wild Pokémon are gone once beaten or caught, items once picked up) */
  #present(data: Npc) {
    const index = this.#city.npcs.indexOf(data);
    const gone =
      (data.role === "wild" && this.#defeated(index)) || (data.role === "item" && this.#received(index)) || (data.role === "raid" && this.#raided(index));
    return !gone && this.#staged(data);
  }

  /** Does the story allow someone on the map right now */
  #staged({ story }: Npc) {
    return (!story?.after || this.#done(story.after)) && (!story?.until || !this.#done(story.until));
  }

  /** Was a raid den beaten today */
  #raided(index: number) {
    const beaten = trainer.profile?.raids?.[this.#key(index)];
    return Boolean(beaten && new Date(beaten).toDateString() === new Date().toDateString());
  }

  /** Story step locking a gate tile (null when open) */
  #gate(x: number, y: number) {
    const n = this.#city.gate?.[y * this.#city.width + x];
    const step = n ? this.#world.story.find((step) => step.n === n) : null;
    return step && !this.#done(step.id) ? step : null;
  }

  /** Show or hide people after story progress (people leaving the scene fade out) */
  #refresh(animate = false) {
    for (const npc of this.#npcs) {
      const hidden = !this.#present(npc.data);
      const leaving = animate && hidden && !npc.hidden;
      npc.hidden = hidden;
      if (!leaving) {
        npc.actor.sprite.visible = !hidden;
        npc.actor.sprite.alpha = 1;
        continue;
      }
      const start = performance.now();
      const fade = () => {
        const t = Math.min(1, (performance.now() - start) / 600);
        npc.actor.sprite.alpha = 1 - t;
        if (t < 1) {
          requestAnimationFrame(fade);
        } else {
          npc.actor.sprite.visible = false;
          npc.actor.sprite.alpha = 1;
        }
      };
      requestAnimationFrame(fade);
    }
    for (const { index, graphic } of this.#balls) {
      graphic.visible = this.#present(this.#city.npcs[index]);
    }
    for (const { index, graphic } of this.#trees) {
      const data = this.#city.npcs[index];
      graphic.visible = this.#present(data);
      berryTree(data.x, data.y, this.#ripe(index), data.gift?.item, graphic);
    }
    for (const { index, graphic } of this.#dens) {
      graphic.visible = this.#staged(this.#city.npcs[index]);
    }
    for (const { index, sprite } of this.#obstacles) {
      sprite.visible = this.#present(this.#city.npcs[index]) && !this.#cleared.has(index);
    }
    this.#map.drawBlockers(animate);
  }

  /** Start play mode */
  start() {
    const { actors } = this.#map.containers;
    const spawn = this.#arrive ?? { ...this.#city.spawn, dir: "down" as Direction };
    this.#player = new Actor({ x: spawn.x, y: spawn.y, dir: spawn.dir, name: trainer.profile?.sprite ?? "may", parent: actors });
    //The lower part of each wild grass tile, drawn over the player's feet
    for (const frame of [frames.tall, frames.long[1]]) {
      const grass = PIXI.Texture.from(`${frame}`);
      this.#grasses.set(frame + 1, new PIXI.Texture(grass.baseTexture, new PIXI.Rectangle(grass.frame.x, grass.frame.y + 9, size, size - 9)));
    }
    this.#grass = actors.addChild(new PIXI.Sprite(this.#grasses.get(frames.tall + 1)));
    this.#grass.visible = false;
    this.#followerGrass = actors.addChild(new PIXI.Sprite(this.#grasses.get(frames.tall + 1)));
    this.#followerGrass.visible = false;
    this.#city.npcs.forEach((data, index) => {
      if (data.role === "obstacle") {
        const tile = actors.addChild(sprite(fields[data.field ?? "cut"].tile));
        tile.position.set(data.x * size, data.y * size);
        tile.zIndex = data.y - 0.5;
        this.#obstacles.push({ index, sprite: tile, x: data.x, y: data.y });
        return;
      }
      if (data.role === "item" && data.grow) {
        const graphic = actors.addChild(new PIXI.Sprite());
        graphic.zIndex = data.y;
        this.#trees.push({ index, graphic });
        return;
      }
      if (data.role === "item") {
        if (!data.hidden) {
          const graphic = actors.addChild(itemBall(data.x, data.y));
          graphic.zIndex = data.y;
          this.#balls.push({ index, graphic });
        }
        return;
      }
      if (!data.sprite && !data.creature) {
        return;
      }
      if (data.role === "raid") {
        const graphic = actors.addChild(drawDen(new PIXI.Graphics(), data.x * size, data.y * size));
        graphic.zIndex = data.y - 0.6;
        this.#dens.push({ index, graphic });
      }
      const actor = new Actor({
        x: data.x,
        y: data.y,
        dir: data.dir,
        name: data.sprite,
        parent: actors,
        creature: data.creature?.species,
        look: data.creature?.look,
      });
      this.#npcs.push({
        actor,
        data,
        index,
        home: { x: data.x, y: data.y },
        next: performance.now() + 600 + Math.random() * 1200,
        bubble: null,
        hidden: false,
        leg: 1,
        way: 1,
      });
    });
    this.#refresh();
    //Arriving on water (from a map surfed into): still surfing
    if (this.#behavior(spawn.x, spawn.y) === WATER && this.#swimmer()) {
      this.#mounted(true);
    }
    this.#follow();
    if (this.#city.dark) {
      this.#darken();
    }
    this.#map.done = (step) => this.#done(step);
    this.#map.drawBlockers();
    this.#map.pannable = false;
    this.#map.center(this.#player.x + 0.5, this.#player.y + 0.5);
    this.#listen("keydown", (event) => this.#keydown(event as KeyboardEvent));
    this.#listen("keyup", (event) => this.#keyup(event as KeyboardEvent));
    this.#map.app.ticker.add(this.#ticker);
    //Each map can have its own music (the town music otherwise)
    sound.song = this.#city.song ?? "";
    sound.music("town");
  }

  /** Stop play mode (the music keeps going when moving to another map) */
  stop(keepMusic = false) {
    ui.hush();
    //Steps walked here count for the VS Seeker and the Day Care
    if (trainer.profile) {
      trainer.save();
    }
    this.#map.app.ticker.remove(this.#ticker);
    this.#listeners.forEach(([type, listener]) => document.removeEventListener(type, listener));
    this.#player.destroy();
    this.#grass.destroy();
    this.#followerGrass.destroy();
    this.#grasses.forEach((texture) => texture.destroy());
    this.#npcs.forEach(({ actor, bubble }) => (actor.destroy(), bubble?.destroy()));
    this.#balls.forEach(({ graphic }) => graphic.destroy());
    this.#obstacles.forEach(({ sprite }) => sprite.destroy());
    this.#trees.forEach(({ graphic }) => graphic.destroy());
    this.#dens.forEach(({ graphic }) => graphic.destroy());
    this.#mount?.destroy();
    this.#dark?.destroy();
    this.#dark = null;
    this.#follower?.destroy();
    this.#follower = null;
    this.#map.pannable = true;
    this.#map.done = () => false;
    this.#map.drawBlockers();
    if (!keepMusic) {
      sound.stop();
    }
  }

  /** Register a document listener */
  #listen(type: string, listener: EventListener) {
    document.addEventListener(type, listener);
    this.#listeners.push([type, listener]);
  }

  /** Virtual pad input (touch devices) */
  /** Open the start menu (the touch START button) */
  openMenu() {
    void this.#menu();
  }

  press(dir: Direction | "action", down: boolean) {
    if (dir === "action") {
      if (down) {
        this.#interact();
      }
      return;
    }
    this.#hold(dir, down);
  }

  /** Track held direction */
  #hold(dir: Direction, down: boolean) {
    const index = this.#held.indexOf(dir);
    if (index >= 0) {
      this.#held.splice(index, 1);
    }
    if (down) {
      this.#held.push(dir);
      if (!this.#player.moving && !this.#busy) {
        if (this.#player.dir === dir) {
          this.#tap = dir;
        }
        this.#player.face(dir);
      }
    }
  }

  /** Key pressed */
  #keydown(event: KeyboardEvent) {
    if ((event.target as HTMLElement)?.closest?.("input, textarea, select") || document.querySelector("[role=dialog], [role=alertdialog]")) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key in keys) {
      event.preventDefault();
      if (!event.repeat) {
        this.#hold(keys[key], true);
      }
    } else if (key === "shift") {
      this.#running = true;
    } else if (key === "enter" && !event.repeat) {
      event.preventDefault();
      void this.#menu();
    } else if ([" ", "z", "e"].includes(key) && !event.repeat) {
      event.preventDefault();
      this.#interact();
    } else if (key === "v" && !event.repeat) {
      void this.#seek();
    }
  }

  /** Open the start menu (the player stops while it's open) */
  async #menu() {
    if (this.#busy || this.#player.moving) {
      return;
    }
    this.#busy = true;
    this.#held.length = 0;
    this.#tap = null;
    await ui.menu();
    this.#busy = false;
    //A new lead picked in the party takes over following
    if (this.#follower && trainer.lead && trainer.lead.species !== this.#followed) {
      this.#follow();
    }
  }

  /** Key released */
  #keyup(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key in keys) {
      this.#hold(keys[key], false);
    } else if (key === "shift") {
      this.#running = false;
    }
  }

  /** Cover a dark map, leaving a little light around the player, then use Flash if the player has it */
  #darken() {
    const canvas = Object.assign(document.createElement("canvas"), { width: 512, height: 512 });
    const context = canvas.getContext("2d")!;
    const light = context.createRadialGradient(256, 256, 6, 256, 256, 15);
    light.addColorStop(0, "rgba(0, 0, 0, 0)");
    light.addColorStop(1, "rgba(4, 4, 12, 0.94)");
    context.fillStyle = light;
    context.fillRect(0, 0, 512, 512);
    //Each pixel covers 4 of the map, so the darkness reaches far past the screen
    const dark = this.#map.containers.overlay.addChild(new PIXI.Sprite(PIXI.Texture.from(canvas)));
    dark.anchor.set(0.5);
    dark.scale.set(4);
    this.#dark = dark;
    const lead = trainer.lead;
    if (lead && trainer.count("hm-flash") > 0) {
      this.#busy = true;
      void ui.say(`${lead.nickname || species(lead.species).name} used Flash!`).then(() => {
        const start = performance.now();
        const fade = () => {
          const t = Math.min(1, (performance.now() - start) / 500);
          if (this.#dark === dark) {
            dark.alpha = 1 - t;
          }
          if (t < 1) {
            requestAnimationFrame(fade);
          } else if (this.#dark === dark) {
            dark.destroy();
            this.#dark = null;
          }
        };
        requestAnimationFrame(fade);
        this.#busy = false;
      });
    }
  }

  /** Draw wild grass over someone's feet while they stand in it (hidden when they jump, or there's no one) */
  #cover(grass: PIXI.Sprite, actor: Actor | null) {
    const tile = actor ? Math.round(actor.y) * this.#city.width + Math.round(actor.x) : -1;
    const tall = actor && [this.#city.layers.decor[tile], this.#city.layers.ground[tile]].find((value) => this.#grasses.has(value));
    grass.visible = Boolean(actor && !actor.jump && tall);
    if (actor && tall) {
      grass.texture = this.#grasses.get(tall)!;
      grass.position.set(actor.x * size, actor.y * size + 9);
      grass.zIndex = actor.y + 0.5;
    }
  }

  /** Put the lead Pokémon behind the player (the town can turn followers off) */
  #follow() {
    this.#follower?.destroy();
    this.#follower = null;
    const player = this.#player;
    this.#heading = { x: player.tx, y: player.ty };
    const lead = trainer.lead;
    if (!lead || this.#world.rules?.followers === false || !species(lead.species)) {
      return;
    }
    //One tile behind, where there's room (on the player's tile, out of sight, otherwise)
    const { x: dx, y: dy } = deltas[opposite[player.dir]];
    const [x, y] = [player.x + dx, player.y + dy];
    const room = this.#map.inside({ x, y }) && !this.#city.solid[y * this.#city.width + x] && !this.#occupied(x, y, player);
    const follower = new Actor({
      x: room ? x : player.x,
      y: room ? y : player.y,
      dir: player.dir,
      name: "",
      parent: this.#map.containers.actors,
      creature: lead.species,
      look: undefined,
      shiny: lead.shiny,
    });
    follower.depth = -0.05;
    follower.place();
    follower.sprite.visible = room && !this.#surfing;
    this.#follower = follower;
    this.#followed = lead.species;
  }

  /** The player left a tile: the follower walks onto it (hopping when it's two tiles away, after a ledge) */
  #trail(from: { x: number; y: number }) {
    const follower = this.#follower;
    if (!follower) {
      return;
    }
    const dx = from.x - follower.x,
      dy = from.y - follower.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      //Too far (a warp, a blackout): just appear there
      Object.assign(follower, { x: from.x, y: from.y, tx: from.x, ty: from.y, jump: null });
      follower.place();
    } else if (dx || dy) {
      follower.face((Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up") as Direction);
      follower.jump = Math.abs(dx) + Math.abs(dy) > 1 ? { x: follower.x, y: follower.y } : null;
      follower.tx = from.x;
      follower.ty = from.y;
    }
    follower.sprite.visible = !this.#surfing;
  }

  /** Behavior of a tile (0 = normal) */
  #behavior(x: number, y: number) {
    return this.#city.behavior?.[y * this.#city.width + x] ?? 0;
  }

  /** Is a tile blocked */
  #blocked(x: number, y: number, self?: Actor) {
    if (!this.#map.inside({ x, y })) {
      return true;
    }
    if (this.#city.solid[y * this.#city.width + x]) {
      return true;
    }
    //People and Pokémon of the map stay off ledges and deep water
    const behavior = this.#behavior(x, y);
    if (self !== this.#player && (behavior === WATER || ledge(behavior))) {
      return true;
    }
    return Boolean(this.#gate(x, y)) || this.#occupied(x, y, self);
  }

  /** Is someone (or an item ball) on a tile */
  #occupied(x: number, y: number, self?: Actor) {
    for (const actor of [this.#player, ...this.#npcs.filter(({ hidden }) => !hidden).map(({ actor }) => actor)]) {
      if (actor !== self && ((Math.round(actor.x) === x && Math.round(actor.y) === y) || (actor.tx === x && actor.ty === y))) {
        return true;
      }
    }
    return (
      this.#balls.some(({ index, graphic }) => graphic.visible && this.#city.npcs[index].x === x && this.#city.npcs[index].y === y) ||
      Boolean(this.#obstacle(x, y)) ||
      [...this.#trees, ...this.#dens].some(({ index, graphic }) => graphic.visible && this.#city.npcs[index].x === x && this.#city.npcs[index].y === y)
    );
  }

  /** Are a berry tree's berries ripe (never picked, or long enough ago) */
  #ripe(index: number) {
    const picked = trainer.profile?.picked?.[this.#key(index)];
    return !picked || Date.now() - picked >= (this.#city.npcs[index].grow ?? 24) * 3600_000;
  }

  /** Obstacle standing on a tile */
  #obstacle(x: number, y: number) {
    return this.#obstacles.find((obstacle) => obstacle.sprite.visible && obstacle.x === x && obstacle.y === y) ?? null;
  }

  /** Use a field move on an obstacle in front of the player (the HM in the bag is enough) */
  async #field(obstacle: { index: number; sprite: PIXI.Sprite; x: number; y: number }) {
    const kind = this.#city.npcs[obstacle.index].field ?? "cut";
    const field = fields[kind];
    const helper = trainer.lead ?? trainer.profile?.party[0];
    if (kind === "strength" && this.#strong) {
      await ui.say("The boulder can be pushed: walk into it.");
      return;
    }
    if (!trainer.count(field.hm) || !helper) {
      await ui.say(field.look);
      return;
    }
    if (!(await ui.ask(`${field.look}\n\n${field.offer}`))) {
      return;
    }
    const name = helper.nickname || species(helper.species).name;
    sound.play("hit");
    await ui.say(`${name} used ${field.move}!`);
    if (kind === "strength") {
      this.#strong = true;
      await ui.say(`${name}'s Strength made it possible to move boulders around.`);
      return;
    }
    //Cut and Rock Smash clear the way until the player leaves the map
    this.#cleared.add(obstacle.index);
    const start = performance.now();
    await new Promise<void>((solve) => {
      const fade = () => {
        const t = Math.min(1, (performance.now() - start) / 350);
        obstacle.sprite.alpha = 1 - t;
        obstacle.sprite.scale.set(1 + t * 0.15);
        if (t < 1) {
          requestAnimationFrame(fade);
        } else {
          obstacle.sprite.visible = false;
          obstacle.sprite.alpha = 1;
          obstacle.sprite.scale.set(1);
          solve();
        }
      };
      requestAnimationFrame(fade);
    });
    //A Pokémon may have been hiding under a smashed rock, like in Emerald
    if (kind === "smash") {
      const wild = roll(pool(this.#zoneAt(obstacle.x, obstacle.y), "walk", period(this.#city.time)));
      if (wild && species(wild.species) && trainer.lead && Math.random() < 0.25) {
        await this.#wild(wild);
      }
    }
  }

  /** Push a boulder one tile (with Strength in use): true when it moved */
  async #push(obstacle: { sprite: PIXI.Sprite; x: number; y: number }, dir: Direction) {
    const { x: dx, y: dy } = deltas[dir];
    const [x, y] = [obstacle.x + dx, obstacle.y + dy];
    const behavior = this.#behavior(x, y);
    if (
      !this.#map.inside({ x, y }) ||
      this.#city.solid[y * this.#city.width + x] ||
      this.#gate(x, y) ||
      behavior === WATER ||
      ledge(behavior) ||
      this.#occupied(x, y, this.#player)
    ) {
      return false;
    }
    this.#busy = true;
    sound.play("hit");
    const [from, to] = [
      { x: obstacle.x * size, y: obstacle.y * size },
      { x: x * size, y: y * size },
    ];
    obstacle.x = x;
    obstacle.y = y;
    const start = performance.now();
    await new Promise<void>((solve) => {
      const slide = () => {
        const t = Math.min(1, (performance.now() - start) / 220);
        obstacle.sprite.position.set(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        if (t < 1) {
          requestAnimationFrame(slide);
        } else {
          obstacle.sprite.zIndex = y - 0.5;
          solve();
        }
      };
      requestAnimationFrame(slide);
    });
    this.#busy = false;
    return true;
  }

  /** First party Pokémon that can surf (a Water type) */
  #swimmer() {
    return trainer.profile?.party.find((creature) => species(creature.species)?.types.includes("water")) ?? null;
  }

  /** Get on or off the Pokémon carrying the player across water */
  #mounted(on: boolean) {
    this.#surfing = on;
    this.#mount?.destroy();
    this.#mount = null;
    this.#player.lift = 0;
    //The follower goes back in its ball while surfing
    if (this.#follower) {
      this.#follower.sprite.visible = !on;
    }
    const swimmer = on ? this.#swimmer() : null;
    if (swimmer) {
      const look = creatureSprite(swimmer.species);
      const mount = this.#map.containers.actors.addChild(new PIXI.Sprite(look.texture));
      mount.anchor.set(0.5, 1);
      mount.scale.set(look.scale);
      this.#mount = mount;
      this.#player.lift = -5;
    }
    this.#player.place();
  }

  /** Try to move the player one tile (jumping off ledges, surfing, getting off the water): true when they move */
  #try(dir: Direction) {
    const player = this.#player;
    const { x: dx, y: dy } = deltas[dir];
    const [x, y] = [player.x + dx, player.y + dy];
    const there = this.#behavior(x, y);
    //Ledges are only jumped off in their direction, landing on the tile beyond
    const jump = ledge(there);
    if (jump && this.#map.inside({ x, y })) {
      const [lx, ly] = [x + dx, y + dy];
      const landing = this.#behavior(lx, ly);
      if (jump !== dir || this.#surfing || this.#blocked(lx, ly, player) || landing === WATER || ledge(landing) || this.#occupied(x, y, player)) {
        return false;
      }
      player.jump = { x: player.x, y: player.y };
      player.tx = lx;
      player.ty = ly;
      return true;
    }
    //Deep water: surf on a Water type (collision on water is ignored), the first time with a word
    if (there === WATER && this.#map.inside({ x, y })) {
      const swimmer = this.#swimmer();
      if (!swimmer || this.#gate(x, y) || this.#occupied(x, y, player)) {
        return false;
      }
      if (!this.#surfing) {
        this.#busy = true;
        this.#held.length = 0;
        this.#tap = null;
        void ui.say(`${swimmer.nickname || species(swimmer.species).name} used Surf!`).then(() => {
          this.#mounted(true);
          player.tx = x;
          player.ty = y;
          this.#busy = false;
        });
        return true;
      }
      player.tx = x;
      player.ty = y;
      return true;
    }
    //With Strength in use, walking into a boulder pushes it (the player stays put)
    const boulder = this.#strong ? this.#obstacle(x, y) : null;
    if (boulder && this.#city.npcs[boulder.index].field === "strength") {
      void this.#push(boulder, dir);
      return false;
    }
    if (this.#blocked(x, y, player)) {
      return false;
    }
    if (this.#surfing) {
      this.#mounted(false);
    }
    player.tx = x;
    player.ty = y;
    return true;
  }

  /** Frame update */
  #update(dt: number) {
    const now = performance.now();
    const player = this.#player;

    //Sliding on ice or pushed along: the player keeps moving on their own until something stops them
    if (!this.#busy && !player.moving && this.#force) {
      const dir = this.#force;
      if (arrow(this.#behavior(player.x, player.y))) {
        player.face(dir);
      }
      player.sliding = this.#behavior(player.x, player.y) === ICE;
      if (!this.#try(dir)) {
        this.#force = null;
        player.sliding = false;
      }
    } else if (!this.#busy && !player.moving && (this.#held.length || this.#tap)) {
      //Player movement
      const dir = this.#held[this.#held.length - 1] ?? this.#tap!;
      this.#tap = null;
      player.face(dir);
      const { x: dx, y: dy } = deltas[dir];
      //Off the edge of an outdoor map: onto the map touching it there
      if (!this.#map.inside({ x: player.x + dx, y: player.y + dy }) && this.#onedge?.(player.x + dx, player.y + dy, dir)) {
        this.#busy = true;
        return;
      }
      if (this.#try(dir)) {
        //Moving (or getting ready to surf)
      } else if (now > this.#bump && this.#gate(player.x + dx, player.y + dy)) {
        //Bumping into a story gate explains why the way is closed
        const step = this.#gate(player.x + dx, player.y + dy)!;
        this.#bump = now + 1200;
        this.#busy = true;
        this.#held.length = 0;
        this.#tap = null;
        ui.say(step.blocked || "The way is blocked for now.").then(() => ((this.#busy = false), (this.#bump = performance.now() + 600)));
      }
    }
    const speed = this.#force || this.#running ? 8 : 4;
    //The player set off for another tile: the follower takes the one they leave
    if (player.tx !== this.#heading.x || player.ty !== this.#heading.y) {
      this.#trail(this.#heading);
      this.#heading = { x: player.tx, y: player.ty };
    }
    if (this.#follower?.advance((dt / 60) * speed)) {
      this.#follower.jump = null;
    }
    if (player.advance((dt / 60) * speed)) {
      player.jump = null;
      if (!this.#scene) {
        this.#stepped();
      }
    }
    this.#dark?.position.set(player.x * size + size / 2, player.y * size + size / 2);
    if (this.#mount) {
      //The Pokémon carrying the player bobs on the water
      this.#mount.position.set(player.x * size + size / 2, (player.y + 1) * size + 3 + Math.sin(now / 250));
      this.#mount.zIndex = player.y - 0.01;
      if (["left", "right"].includes(player.dir)) {
        this.#mount.scale.x = Math.abs(this.#mount.scale.x) * (player.dir === "right" ? -1 : 1);
      }
    }

    //Tall grass covers the feet of the player and of the Pokémon following them
    this.#cover(this.#grass, player);
    this.#cover(this.#followerGrass, this.#follower?.sprite.visible ? this.#follower : null);

    //NPC wandering and paths
    for (const npc of this.#npcs) {
      const { actor, data, home } = npc;
      if (actor.advance((dt / 60) * (data.path?.run ? 6 : 3)) && !this.#busy) {
        this.#watch(npc);
      }
      if (this.#busy || actor.moving || now < npc.next || npc.hidden) {
        continue;
      }
      if (data.path?.points.length) {
        this.#walk(npc, now);
        continue;
      }
      npc.next = now + 1500 + Math.random() * 3500;
      if (!data.wander) {
        continue;
      }
      const dir = (["up", "down", "left", "right"] as Direction[])[Math.floor(Math.random() * 4)];
      actor.face(dir);
      const { x: dx, y: dy } = deltas[dir];
      const [x, y] = [actor.x + dx, actor.y + dy];
      if (Math.random() < 0.6 && Math.abs(x - home.x) <= 2 && Math.abs(y - home.y) <= 2 && !this.#blocked(x, y, actor)) {
        actor.tx = x;
        actor.ty = y;
      }
    }

    //Camera follows player smoothly
    const { world, app } = this.#map;
    const scale = world.scale.x;
    const targetX = app.screen.width / 2 - (player.x + 0.5) * size * scale;
    const targetY = app.screen.height / 2 - (player.y + 0.5) * size * scale;
    world.x += (targetX - world.x) * Math.min(1, 0.2 * dt);
    world.y += (targetY - world.y) * Math.min(1, 0.2 * dt);
  }

  /** Take the next step along a path (waits when the way is blocked) */
  #walk(npc: Person, now: number) {
    const { actor, data } = npc;
    const path = data.path!;
    const stops = [npc.home, ...path.points];
    const target = stops[npc.leg];
    if (actor.x === target.x && actor.y === target.y) {
      //Next stop: loop to the start, or turn around at either end
      if (path.loop) {
        npc.leg = (npc.leg + 1) % stops.length;
      } else {
        if (npc.leg + npc.way < 0 || npc.leg + npc.way >= stops.length) {
          npc.way = npc.way === 1 ? -1 : 1;
        }
        npc.leg += npc.way;
      }
      npc.next = now + path.pause * 1000;
      return;
    }
    //Across first, then up or down (the editor draws paths the same way)
    const dx = Math.sign(target.x - actor.x),
      dy = Math.sign(target.y - actor.y);
    const options = [
      [dx, 0],
      [0, dy],
    ].filter(([x, y]) => x || y);
    for (const [x, y] of options) {
      const dir = (x > 0 ? "right" : x < 0 ? "left" : y > 0 ? "down" : "up") as Direction;
      if (!this.#blocked(actor.x + x, actor.y + y, actor)) {
        actor.face(dir);
        actor.tx = actor.x + x;
        actor.ty = actor.y + y;
        npc.next = now;
        return;
      }
    }
    //Someone is in the way: look ahead and try again soon
    const [x, y] = options[0];
    actor.face((x > 0 ? "right" : x < 0 ? "left" : y > 0 ? "down" : "up") as Direction);
    npc.next = now + 500;
  }

  /** Wants to come to the player: a trainer not beaten yet, or someone who walks up to talk and hasn't yet */
  #eager({ data, index }: Person) {
    return data.role === "trainer"
      ? Boolean(trainer.lead) && !this.#defeated(index)
      : Boolean(data.approach) && !trainer.profile?.met?.includes(this.#key(index));
  }

  /** A trainer (or someone who walks up to talk) who just moved checks whether they see the player */
  #watch(npc: Person) {
    const ready = !npc.hidden && (!npc.data.story?.requires || this.#done(npc.data.story.requires));
    if (ready && !this.#player.moving && this.#eager(npc) && this.#spots(npc)) {
      this.#challenge(npc);
    }
  }

  /** Player completed a step */
  async #stepped() {
    //Counted for the VS Seeker and the Day Care (saved with everything else). Walking together makes the party friendlier
    const profile = trainer.profile;
    if (profile) {
      profile.steps = (profile.steps ?? 0) + 1;
      if (!(profile.steps % 64)) {
        profile.party.forEach((creature) => creature.hp > 0 && befriend(creature, 1));
      }
    }
    //A Repel wears off
    if (profile?.repel && --profile.repel.steps <= 0) {
      const { item } = profile.repel;
      delete profile.repel;
      this.#busy = true;
      this.#held.length = 0;
      await ui.say("The Repel's effect wore off…");
      if (trainer.count(item) > 0 && (await ui.ask(`Use another ${items[item].name}?`))) {
        trainer.repel(item);
        await ui.say(`${profile.name} used the ${items[item].name}.`);
      }
      trainer.save();
      this.#busy = false;
      return;
    }
    //Ice keeps them sliding the same way, push tiles move them along
    const here = this.#behavior(this.#player.x, this.#player.y);
    this.#force = arrow(here) ?? (here === ICE ? this.#player.dir : null);
    if (!this.#force) {
      this.#player.sliding = false;
    }

    //Doors
    const door = this.#city.doors?.find(({ x, y, to }) => x === this.#player.x && y === this.#player.y && to !== "?");
    if (door && this.#onwarp) {
      this.#busy = true;
      this.#force = null;
      this.#held.length = 0;
      this.#tap = null;
      this.#onwarp(door);
      return;
    }

    //Event areas
    const trigger = this.#trigger(this.#player.x, this.#player.y);
    if (trigger) {
      this.#busy = true;
      this.#force = null;
      this.#player.sliding = false;
      if (trigger.once) {
        this.#mark(this.#event(trigger));
      }
      await this.#run(trigger.actions);
      this.#busy = false;
      return;
    }

    //Trainers (and people who walk up to talk) line of sight, only those present and ready for the player
    for (const npc of this.#npcs) {
      const ready = !npc.hidden && (!npc.data.story?.requires || this.#done(npc.data.story.requires));
      if (ready && this.#eager(npc) && this.#spots(npc)) {
        await this.#challenge(npc);
        return;
      }
    }

    //Wild encounters: walking, or surfing on water
    const { x, y } = this.#player;
    const zone = this.#zoneAt(x, y);
    const wild = roll(pool(zone, this.#surfing ? "surf" : "walk", period(this.#city.time)));
    //A Repel keeps away wild Pokémon weaker than the lead
    const repelled = Boolean(profile?.repel) && wild !== null && (trainer.lead?.level ?? 0) > wild.level;
    if (wild && !repelled && Math.random() < zone!.rate && trainer.lead && species(wild.species)) {
      this.#busy = true;
      this.#held.length = 0;
      this.#tap = null;
      await this.#wild(wild);
      this.#busy = false;
    }
  }

  /** Battle rules here: the town's difficulty, the level cap for the badges earned in this town, and the map's weather */
  #rules({ water = this.#surfing } = {}) {
    const badges = trainer.profile?.badges.filter(({ world }) => world === this.#world.id).length ?? 0;
    return { difficulty: this.#world.rules?.difficulty, cap: levelCap(this.#world.rules, badges), weather: battleWeather(this.#city.weather), water };
  }

  /** Encounter zone of a tile */
  #zoneAt(x: number, y: number) {
    return this.#city.zones[this.#city.zone[y * this.#city.width + x] - 1];
  }

  /** Challenge a raid den: its boss has 5× HP, and everyone fighting it in the live room shares the damage. Beaten, it gives one throw, and comes back tomorrow */
  async #raid(data: Npc, index: number, voice: { speaker?: string; portrait?: Portrait }) {
    const { species: id, level, look } = data.creature!;
    if (data.dialogue) {
      await ui.say(data.dialogue, voice);
    }
    if (!trainer.lead) {
      await ui.say("Your Pokémon are too tired to battle. Find someone to heal them!");
      return;
    }
    const together = this.#live() ? "\nEveryone in this live room fights it together!" : "";
    if (!(await ui.ask(`A raid boss ${species(id).name} (Lv ${level}) is in the den!${together}\n\nChallenge it?`))) {
      return;
    }
    const boss = create(id, level, { shiny: Math.random() < 1 / 64 });
    boss.boss = 5;
    boss.hp = hp(boss);
    if (creatureImage(look)) {
      boss.art = creatureImage(look);
    }
    if (data.name && data.name !== species(id).name) {
      boss.nickname = data.name;
    }
    const den = this.#key(index);
    const outcome = await this.#battle({ wild: boss, rules: { ...this.#rules(), raid: { den, onhit: (damage) => this.#onraid?.(den, damage) } } });
    if (outcome === "win" || outcome === "caught") {
      const profile = trainer.profile!;
      profile.raids = { ...profile.raids, [den]: Date.now() };
      trainer.save();
      await this.#progress(data);
      this.#refresh(true);
    }
    await this.#after(outcome);
  }

  /** Battle a wild Pokémon met on the map (hooked ones fight on the water) */
  async #wild({ species: id, level }: { species: number; level: number }, { water = this.#surfing, shiny = Math.random() < 1 / 128 } = {}) {
    const outcome = await this.#battle({ wild: create(id, level, { shiny }), rules: this.#rules({ water }) });
    await this.#after(outcome);
    return outcome;
  }

  /** Chain fishing: the same Pokémon hooked again and again (a miss, another Pokémon, or leaving the map breaks it) */
  #chain = { species: 0, count: 0 };

  /** Is a tile water a rod can be cast into */
  #water(x: number, y: number) {
    if (!this.#map.inside({ x, y })) {
      return false;
    }
    const ground = this.#city.layers.ground[y * this.#city.width + x] - 1;
    return this.#behavior(x, y) === WATER || (ground >= 0 && assets.water.has(ground));
  }

  /** Fish into the water in front of the player with their best rod */
  async #fish(x: number, y: number) {
    const rod = bestRod((id) => trainer.count(id))!;
    const profile = trainer.profile!;
    const wild = roll(
      pool(this.#zoneAt(x, y), "fish", period(this.#city.time), ({ "old-rod": "old", "good-rod": "good", "super-rod": "super" } as const)[rod]),
    );
    await ui.say(`${profile.name} used the ${items[rod].name}!`);
    //A bite comes most of the time, and never where nothing lives
    await new Promise((solve) => setTimeout(solve, 600 + Math.random() * 1200));
    if (!wild || !species(wild.species) || Math.random() < 0.25) {
      this.#chain = { species: 0, count: 0 };
      await ui.say("Not even a nibble…");
      return;
    }
    const chain = this.#chain.species === wild.species ? this.#chain.count + 1 : 1;
    this.#chain = { species: wild.species, count: chain };
    await ui.say(chain > 1 ? `Oh! A bite!\n\nFishing chain: ${chain}!` : "Oh! A bite!");
    if (!trainer.lead) {
      this.#chain = { species: 0, count: 0 };
      await ui.say("Your Pokémon are too tired to battle. It got away…");
      return;
    }
    //Each link of the chain makes a shiny more likely (up to 1 in 8 at 20)
    const outcome = await this.#wild(wild, { water: true, shiny: Math.random() < Math.min(20, chain) / 160 + 1 / 128 });
    if (outcome === "run" || outcome === "lose") {
      this.#chain = { species: 0, count: 0 };
    }
  }

  /** VS Seeker: beaten trainers nearby want a rematch (it recharges over 100 steps) */
  async #seek() {
    const profile = trainer.profile;
    if (!profile || !trainer.count("vs-seeker") || this.#busy || this.#player.moving) {
      return;
    }
    this.#busy = true;
    this.#held.length = 0;
    this.#tap = null;
    const steps = profile.steps ?? 0;
    const left = (profile.seeker ?? -Infinity) + 100 - steps;
    if (left > 0) {
      await ui.say(`The VS Seeker's battery needs to charge: ${left} more step${left > 1 ? "s" : ""}.`);
      this.#busy = false;
      return;
    }
    sound.play("hit");
    await ui.say(`${profile.name} used the VS Seeker!`);
    const near = this.#npcs.filter(
      ({ actor, data, index, hidden }) =>
        !hidden &&
        data.role === "trainer" &&
        !data.trainer?.gym &&
        this.#defeated(index) &&
        Math.max(Math.abs(actor.x - this.#player.x), Math.abs(actor.y - this.#player.y)) <= 8,
    );
    if (!near.length) {
      await ui.say("There are no trainers nearby who want a rematch.");
      this.#busy = false;
      return;
    }
    profile.seeker = steps;
    profile.ready = [...new Set([...(profile.ready ?? []), ...near.map(({ index }) => this.#key(index))])];
    trainer.save();
    await Promise.all(near.map((npc) => this.#exclaim(npc, "!!")));
    this.#busy = false;
  }

  /** Is trainer already defeated by current player */
  #defeated(index: number) {
    return trainer.profile?.defeated.includes(this.#key(index)) ?? false;
  }

  /** Does a trainer see the player */
  #spots({ actor }: { actor: Actor }) {
    const { x: dx, y: dy } = deltas[actor.dir];
    for (let i = 1; i <= sight; i++) {
      const [x, y] = [actor.x + dx * i, actor.y + dy * i];
      if (x === this.#player.x && y === this.#player.y) {
        return true;
      }
      if (!this.#map.inside({ x, y }) || this.#city.solid[y * this.#city.width + x]) {
        return false;
      }
    }
    return false;
  }

  /** Trainer (or someone with something to say) walks up to the player, then battles or talks */
  async #challenge(npc: Person) {
    this.#busy = true;
    //Someone who walks up to talk only does it once
    if (npc.data.role !== "trainer") {
      const profile = trainer.profile!;
      profile.met = [...(profile.met ?? []), this.#key(npc.index)];
      trainer.save();
    }
    this.#held.length = 0;
    this.#tap = null;
    const { actor } = npc;
    await this.#exclaim(npc);
    const { x: dx, y: dy } = deltas[actor.dir];
    while (Math.abs(actor.x - this.#player.x) + Math.abs(actor.y - this.#player.y) > 1) {
      actor.tx = actor.x + dx;
      actor.ty = actor.y + dy;
      await this.#arrived(actor);
    }
    this.#player.face(opposite[actor.dir]);
    await this.#talk(npc);
    this.#busy = false;
  }

  /** "!" over someone who noticed the player ("!!" when they want a rematch) */
  async #exclaim(npc: Person, text = "!") {
    const { actor } = npc;
    //Emerald's "!" emote, side by side for "!!"
    const bubble = this.#map.containers.actors.addChild(new PIXI.Container());
    [...text].forEach((_, i, marks) => (bubble.addChild(exclamation()).x = (i - (marks.length - 1) / 2) * 12));
    npc.bubble = bubble;
    bubble.position.set(actor.sprite.x, actor.sprite.y - 17);
    bubble.zIndex = 9999;
    await new Promise((solve) => setTimeout(solve, 700));
    bubble.destroy();
    npc.bubble = null;
  }

  /** Wait until someone stops moving */
  #arrived(actor: Actor) {
    return new Promise((solve) => {
      const wait = () => (actor.moving ? requestAnimationFrame(wait) : solve(null));
      wait();
    });
  }

  //=================================================================================================
  // Scripts

  /** Play a script as a cutscene (the player can't move meanwhile) */
  async #run(actions: Action[]) {
    this.#scene = true;
    this.#held.length = 0;
    this.#tap = null;
    try {
      await this.#sequence(actions);
    } finally {
      this.#scene = false;
    }
  }

  /** Play actions in order (false when one ended the script: a lost battle, a warp) */
  async #sequence(actions: Action[]) {
    for (const action of actions) {
      if (!(await this.#act(action))) {
        return false;
      }
    }
    return true;
  }

  /** Is a script's check true for the player */
  #holds(check: Check) {
    const profile = trainer.profile!;
    switch (check.has) {
      case "item":
        return trainer.count(check.item) >= check.count;
      case "step":
        return this.#done(check.step);
      case "money":
        return profile.money >= check.amount;
      case "pokemon":
        return profile.party.some(({ species: id }) => id === check.species);
      case "badges":
        return profile.badges.filter(({ world }) => world === this.#world.id).length >= check.count;
    }
  }

  /** Someone of the map who can move in a script (people hidden by the story can't) */
  #person(index: number) {
    return this.#npcs.find((npc) => npc.index === index && !npc.hidden) ?? null;
  }

  /** Actor of someone in a script */
  #who(who: number | "player") {
    return who === "player" ? this.#player : (this.#person(who)?.actor ?? null);
  }

  /** Take one step in a script (waits a moment if the way is blocked, then gives up) */
  async #stride(actor: Actor, dir: Direction) {
    actor.face(dir);
    const { x: dx, y: dy } = deltas[dir];
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!this.#blocked(actor.x + dx, actor.y + dy, actor)) {
        actor.tx = actor.x + dx;
        actor.ty = actor.y + dy;
        await this.#arrived(actor);
        return true;
      }
      await new Promise((solve) => setTimeout(solve, 250));
    }
    return false;
  }

  /** Walk to a tile, across first then up or down, going around what is in the way when it can */
  async #reach(actor: Actor, target: { x: number; y: number }) {
    for (let steps = 0; steps < 60 && (actor.x !== target.x || actor.y !== target.y); steps++) {
      const dx = Math.sign(target.x - actor.x),
        dy = Math.sign(target.y - actor.y);
      const options = [dx ? ((dx > 0 ? "right" : "left") as Direction) : null, dy ? ((dy > 0 ? "down" : "up") as Direction) : null].filter(
        (dir): dir is Direction => dir !== null && !this.#blocked(actor.x + deltas[dir].x, actor.y + deltas[dir].y, actor),
      );
      if (!options.length || !(await this.#stride(actor, options[0]))) {
        return;
      }
    }
  }

  /** Run one action of a script (false stops the script) */
  async #act(action: Action): Promise<boolean> {
    const profile = trainer.profile!;
    switch (action.do) {
      case "say": {
        const data = action.who !== undefined ? this.#city.npcs[action.who] : null;
        await ui.say(action.text || "…", data ? { speaker: data.name, portrait: portraitOf(data) } : undefined);
        return true;
      }
      case "move": {
        const actor = this.#who(action.who);
        for (const dir of actor ? action.steps : []) {
          await this.#stride(actor!, dir);
        }
        return true;
      }
      case "face": {
        this.#who(action.who)?.face(action.dir);
        return true;
      }
      case "come": {
        const npc = this.#person(action.who);
        if (!npc) {
          return true;
        }
        const { actor } = npc;
        await this.#exclaim(npc);
        //The free tile next to the player closest to them
        const player = this.#player;
        const spots = (Object.keys(deltas) as Direction[])
          .map((dir) => ({ x: player.x + deltas[dir].x, y: player.y + deltas[dir].y }))
          .filter(({ x, y }) => (x === actor.x && y === actor.y) || !this.#blocked(x, y, actor))
          .sort((a, b) => Math.abs(a.x - actor.x) + Math.abs(a.y - actor.y) - (Math.abs(b.x - actor.x) + Math.abs(b.y - actor.y)));
        if (spots[0]) {
          await this.#reach(actor, spots[0]);
        }
        if (Math.abs(actor.x - player.x) + Math.abs(actor.y - player.y) === 1) {
          const dir = (actor.x < player.x ? "right" : actor.x > player.x ? "left" : actor.y < player.y ? "down" : "up") as Direction;
          actor.face(dir);
          player.face(opposite[dir]);
        }
        return true;
      }
      case "back": {
        const npc = this.#person(action.who);
        if (npc) {
          await this.#reach(npc.actor, npc.home);
          npc.actor.face(npc.data.dir);
        }
        return true;
      }
      case "wait":
        await new Promise((solve) => setTimeout(solve, action.seconds * 1000));
        return true;
      case "give": {
        if (action.item in items && action.count > 0) {
          trainer.give(action.item, action.count);
          trainer.save();
          sound.play("victory");
          await ui.say(`${profile.name} received ${itemCount(action.item, action.count)}!`);
        }
        return true;
      }
      case "pokemon":
      case "starter": {
        //The player picks one of a few Pokémon (the Professor's bag), or gets the one given
        const choices = (action.do === "starter" ? action.species : [action.species]).filter((id) => species(id));
        if (choices.length) {
          const id = choices.length > 1 ? (choices[await ui.starter(choices)] ?? choices[0]) : choices[0];
          const creature = create(id, action.level, { shiny: false });
          const where = trainer.catch(creature);
          trainer.save();
          sound.play("victory");
          await ui.say(`${profile.name} received ${species(id).name}!`);
          await nickname(creature, field, "received");
          if (where === "box") {
            await ui.say(`${named(creature)} was sent to the PC box.`);
          }
          trainer.save();
          //A first Pokémon starts following
          this.#follow();
        }
        return true;
      }
      case "money": {
        if (action.amount > 0) {
          profile.money += action.amount;
          trainer.save();
          await ui.say(`${profile.name} got ₽${action.amount}.`);
        } else if (action.amount < 0) {
          //Paying: as much as they have
          const paid = Math.min(profile.money, -action.amount);
          profile.money -= paid;
          trainer.save();
          await ui.say(`${profile.name} paid ₽${paid}.`);
        }
        return true;
      }
      case "take": {
        const count = Math.min(action.count, trainer.count(action.item));
        if (count > 0) {
          profile.items[action.item] = trainer.count(action.item) - count;
          trainer.save();
          await ui.say(`${profile.name} handed over ${itemCount(action.item, count)}.`);
        }
        return true;
      }
      case "ask": {
        const data = action.who !== undefined ? this.#city.npcs[action.who] : null;
        const yes = await ui.ask(action.text || "…", data ? { speaker: data.name, portrait: portraitOf(data) } : undefined);
        return this.#sequence(yes ? action.yes : action.no);
      }
      case "if":
        return this.#sequence(this.#holds(action.check) ? action.then : action.else);
      case "heal": {
        trainer.heal();
        trainer.save();
        sound.play("victory");
        await ui.say("Your Pokémon are fully healed!");
        return true;
      }
      case "battle": {
        const data = this.#city.npcs[action.who];
        if (!data || !trainer.lead) {
          return true;
        }
        if (data.role === "trainer" && data.trainer?.team.length && !this.#defeated(action.who)) {
          return (await this.#fight(data, action.who)) !== "lose";
        }
        if (data.role === "wild" && data.creature && species(data.creature.species) && !this.#defeated(action.who)) {
          const outcome = await this.#battle({ wild: create(data.creature.species, data.creature.level, { shiny: false }), rules: this.#rules() });
          if (outcome === "win" || outcome === "caught") {
            profile.defeated.push(this.#key(action.who));
            trainer.save();
            await this.#progress(data);
          }
          await this.#after(outcome);
          return outcome !== "lose";
        }
        return true;
      }
      case "step": {
        const step = this.#world.story.find(({ id }) => id === action.step);
        if (step && open(this.#world, step, (id) => this.#done(id)) && trainer.complete(this.#world.id, step.id)) {
          trainer.save();
          ui.banner(milestone(this.#world, step, (id) => this.#done(id)));
          this.#refresh(true);
        }
        return true;
      }
      case "warp": {
        if (this.#onwarp) {
          this.#onwarp({ x: -1, y: -1, to: action.to, tx: action.x, ty: action.y });
          return false;
        }
        return true;
      }
    }
  }

  /** Interact with facing tile */
  async #interact() {
    if (this.#busy || this.#player.moving) {
      return;
    }
    const { x: dx, y: dy } = deltas[this.#player.dir];
    const [x, y] = [this.#player.x + dx, this.#player.y + dy];
    //Across a counter (a Poké Mart, a Pokémon Center), whoever stands behind it answers
    const [px, py] = this.#behavior(x, y) === COUNTER ? [x + dx, y + dy] : [x, y];
    //Obstacles of field moves (trees, rocks, boulders)
    const obstacle = this.#obstacle(x, y);
    if (obstacle) {
      this.#busy = true;
      this.#held.length = 0;
      this.#tap = null;
      await this.#field(obstacle);
      this.#busy = false;
      return;
    }
    //The Pokémon following the player
    const follower = this.#follower;
    const lead = trainer.lead;
    if (follower?.sprite.visible && lead && !follower.moving && follower.x === x && follower.y === y) {
      this.#busy = true;
      follower.face(opposite[this.#player.dir]);
      const name = lead.nickname || species(lead.species).name;
      const ratio = lead.hp / hp(lead);
      await ui.say(
        ratio < 0.25
          ? `${name} is tired… It could use a rest.`
          : lead.status
            ? `${name} doesn't look well…`
            : [`${name} is happy to be walking with you!`, `${name} is looking around curiously.`, `${name} nuzzles you.`][Math.floor(Math.random() * 3)],
      );
      this.#busy = false;
      return;
    }
    //Signs (invisible NPCs) and people
    const index = this.#city.npcs.findIndex((data, i) => {
      //Obstacles answer where they stand now (above), not where they were placed
      if (!this.#present(data) || data.role === "obstacle") {
        return false;
      }
      const actor = this.#npcs.find((npc) => npc.index === i)?.actor;
      return actor ? Math.round(actor.x) === px && Math.round(actor.y) === py : data.x === px && data.y === py;
    });
    //An empty raid den
    if (index < 0 && this.#dens.some(({ index, graphic }) => graphic.visible && this.#city.npcs[index].x === x && this.#city.npcs[index].y === y)) {
      this.#busy = true;
      await ui.say("The den is quiet… Its Pokémon will be back tomorrow.");
      this.#busy = false;
      return;
    }
    if (index < 0) {
      //Facing water with a rod in the bag: fish
      if (this.#water(x, y) && bestRod((id) => trainer.count(id))) {
        this.#busy = true;
        this.#held.length = 0;
        this.#tap = null;
        await this.#fish(x, y);
        this.#busy = false;
      }
      return;
    }
    this.#busy = true;
    this.#held.length = 0;
    this.#tap = null;
    const npc = this.#npcs.find((npc) => npc.index === index);
    if (npc) {
      npc.actor.face(opposite[this.#player.dir]);
      await this.#talk(npc);
    } else {
      await this.#talk({ data: this.#city.npcs[index], index });
    }
    this.#busy = false;
  }

  /** Complete a person's story step and hand out their reward */
  async #progress(data: Npc) {
    const story = data.story;
    const step = this.#world.story.find(({ id }) => id === story?.completes);
    //A side quest's steps only happen once it has started
    if (!story?.completes || (step && !open(this.#world, step, (id) => this.#done(id))) || !trainer.complete(this.#world.id, story.completes)) {
      return;
    }
    const { species: id, level = 5, balls = 0, potions = 0, money = 0 } = story.reward ?? {};
    const profile = trainer.profile!;
    if (id && species(id)) {
      const creature = create(id, level, { shiny: false });
      const where = trainer.catch(creature);
      sound.play("victory");
      await ui.say(`${profile.name} received ${species(id).name}!${where === "box" ? "\n\nIt was sent to the PC box." : ""}`);
    }
    if (balls || potions) {
      trainer.give("poke-ball", balls);
      trainer.give("potion", potions);
      await ui.say(
        `${profile.name} got ${[balls ? itemCount("poke-ball", balls) : "", potions ? itemCount("potion", potions) : ""].filter(Boolean).join(" and ")}.`,
      );
    }
    if (money) {
      profile.money += money;
      await ui.say(`${profile.name} got ₽${money}.`);
    }
    trainer.save();
    if (step) {
      ui.banner(milestone(this.#world, step, (id) => this.#done(id)));
    }
    this.#refresh(true);
  }

  /** Has the player already received someone's gift (or picked up an item) */
  #received(index: number) {
    return trainer.profile?.received?.includes(this.#key(index)) ?? false;
  }

  /** Pick up an item ball or a hidden item */
  async #pick(data: Npc, index: number) {
    const profile = trainer.profile!;
    //Berry trees: pick the berries when ripe, they grow back after a while
    if (data.grow && data.gift?.count && data.gift.item in items) {
      const { item, count } = data.gift;
      if (!this.#ripe(index)) {
        const hours = Math.ceil((profile.picked![this.#key(index)] + data.grow * 3600_000 - Date.now()) / 3600_000);
        await ui.say(`The ${items[item].name.toLowerCase()} tree is growing. The berries should be ripe in about ${hours} hour${hours > 1 ? "s" : ""}.`);
        return;
      }
      if (!(await ui.ask(`It's a tree full of ${plural(items[item].name)}!\n\nWant to pick them?`))) {
        return;
      }
      trainer.give(item, count);
      profile.picked = { ...profile.picked, [this.#key(index)]: Date.now() };
      trainer.save();
      this.#refresh();
      sound.play("victory");
      await ui.say(`${profile.name} picked ${itemCount(item, count)}!`);
      await this.#progress(data);
      return;
    }
    if (!data.gift?.count || !(data.gift.item in items) || this.#received(index)) {
      return;
    }
    trainer.give(data.gift.item, data.gift.count);
    profile.received = [...(profile.received ?? []), this.#key(index)];
    trainer.save();
    this.#refresh();
    sound.play("victory");
    await ui.say(`${profile.name} found ${itemCount(data.gift.item, data.gift.count)}!`);
    await this.#progress(data);
  }

  /** Key of a trigger played once by the player */
  #event(trigger: Trigger) {
    return this.#city === this.#world ? `${this.#world.id}:event:${trigger.id}` : `${this.#world.id}:${this.#city.id}/event:${trigger.id}`;
  }

  /** Has the player already seen a script or trigger played only once */
  #ran(key: string) {
    return trainer.profile?.met?.includes(key) ?? false;
  }

  /** Remember a script or trigger played only once */
  #mark(key: string) {
    const profile = trainer.profile;
    if (profile && !this.#ran(key)) {
      profile.met = [...(profile.met ?? []), key];
      trainer.save();
    }
  }

  /** Trigger the player stands in, if it can play now */
  #trigger(x: number, y: number) {
    return (
      this.#city.triggers?.find(
        (trigger) =>
          trigger.actions.length &&
          x >= trigger.x &&
          x < trigger.x + trigger.w &&
          y >= trigger.y &&
          y < trigger.y + trigger.h &&
          (!trigger.after || this.#done(trigger.after)) &&
          (!trigger.until || !this.#done(trigger.until)) &&
          !(trigger.once && this.#ran(this.#event(trigger))),
      ) ?? null
    );
  }

  /** Talk to a NPC */
  async #talk({ data, index }: { data: Npc; index: number }) {
    if (data.role === "item") {
      return this.#pick(data, index);
    }
    const voice = { speaker: data.name, portrait: portraitOf(data) };
    const story = data.story;
    //Not ready yet in the story
    if (story?.requires && !this.#done(story.requires)) {
      await ui.say(story.locked || "I'm busy right now. Come back later!", voice);
      return;
    }
    //Their part of the story is already done
    if (story?.completes && this.#done(story.completes) && story.done && data.role !== "healer") {
      await ui.say(story.done, voice);
      return;
    }
    //Their script plays instead of their usual part (once, or every time)
    const script = `${this.#key(index)}:script`;
    if (data.script?.actions.length && !(data.script.once && this.#ran(script))) {
      if (data.script.once) {
        this.#mark(script);
      }
      await this.#run(data.script.actions);
      await this.#progress(data);
      return;
    }
    if (data.role === "wild" && data.creature && species(data.creature.species)) {
      if (data.dialogue) {
        await ui.say(data.dialogue, voice);
      }
      if (!trainer.lead) {
        await ui.say("Your Pokémon are too tired to battle. Find someone to heal them!");
        return;
      }
      const { species: id, level, look } = data.creature;
      const wild = create(id, level, { shiny: false });
      //A custom look shows in battle, and stays with the Pokémon once caught
      if (creatureImage(look)) {
        wild.art = creatureImage(look);
      }
      //A name of its own (like a custom Pokémon) is kept as its nickname
      if (data.name && data.name !== species(id).name) {
        wild.nickname = data.name;
      }
      const outcome = await this.#battle({ wild, rules: this.#rules() });
      if (outcome === "win" || outcome === "caught") {
        trainer.profile!.defeated.push(this.#key(index));
        trainer.save();
        await this.#progress(data);
        this.#refresh(true);
      }
      await this.#after(outcome);
      return;
    }
    if (data.role === "raid" && data.creature && species(data.creature.species)) {
      await this.#raid(data, index, voice);
      return;
    }
    if (data.role === "trainer" && data.trainer?.team.length) {
      //A rematch, once the VS Seeker woke them up: their team gets stronger each time
      const key = this.#key(index);
      const profile = trainer.profile!;
      if (this.#defeated(index) && profile.ready?.includes(key)) {
        if (!trainer.lead) {
          await ui.say("Your Pokémon are too tired to battle. Find someone to heal them!", voice);
          return;
        }
        const round = Math.min(5, (profile.rematches?.[key] ?? 0) + 1);
        await ui.say(data.dialogue || "Let's battle again!", voice);
        if ((await this.#fight(data, index, round * 4)) === "win") {
          profile.ready = profile.ready.filter((other) => other !== key);
          profile.rematches = { ...profile.rematches, [key]: round };
          trainer.save();
        }
        return;
      }
      if (this.#defeated(index)) {
        await ui.say(data.trainer.defeat || "You're too strong!", voice);
        return;
      }
      if (!trainer.lead) {
        await ui.say("Your Pokémon are too tired to battle. Find someone to heal them!", voice);
        return;
      }
      await ui.say(data.dialogue || "Let's battle!", voice);
      await this.#fight(data, index);
      return;
    }
    await ui.say(data.dialogue || "Hello!", voice);
    if (data.role === "healer") {
      await this.#healing(index, voice);
      trainer.heal();
      //Towns without a Poké Mart: the nurse keeps you stocked so you can still catch Pokémon
      if (![this.#world, ...this.#world.interiors].some((map) => map.npcs.some(({ role }) => role === "shop"))) {
        trainer.give("poke-ball", Math.max(0, 5 - trainer.count("poke-ball")));
        trainer.give("potion", Math.max(0, 5 - trainer.count("potion")));
      }
      trainer.save();
      await ui.say("Thank you for waiting. We've restored your Pokémon to full health.\n\nWe hope to see you again!", voice);
    }
    if (data.role === "shop") {
      await ui.shop(
        (data.shop?.length ? data.shop : sold).filter((id) => id in items),
        voice,
      );
    }
    if (data.role === "daycare") {
      await this.#daycare(voice);
    }
    //A gift, the first time
    if (data.gift?.count && data.gift.item in items && !trainer.profile!.received?.includes(this.#key(index))) {
      const profile = trainer.profile!;
      trainer.give(data.gift.item, data.gift.count);
      profile.received = [...(profile.received ?? []), this.#key(index)];
      trainer.save();
      sound.play("victory");
      await ui.say(`${profile.name} received ${itemCount(data.gift.item, data.gift.count)}!`);
    }
    await this.#progress(data);
  }

  /** Battle a trainer of the map (returns the outcome) */
  async #fight(data: Npc, index: number, boost = 0) {
    const voice = { speaker: data.name, portrait: portraitOf(data) };
    const { team, lines, rules } = data.trainer!;
    const outcome = await this.#battle({
      opponent: {
        name: data.name || "Trainer",
        sprite: data.sprite,
        team: teamOf(team.map((member) => ({ ...member, level: Math.min(100, member.level + boost) }))),
        lines,
      },
      rules: trainerRules(this.#rules(), rules),
    });
    if (outcome === "win") {
      if (!this.#defeated(index)) trainer.profile!.defeated.push(this.#key(index));
      if (data.trainer!.gym) {
        const badge = data.trainer!.badge || `${this.#city.name} Badge`;
        trainer.profile!.badges.push({ city: this.#city.name, name: data.name, badge, date: Date.now(), world: this.#world.id });
        trainer.give("poke-ball", 5);
        trainer.save();
        await ui.say(`${data.trainer!.defeat || "You beat me fair and square!"}\n\n${trainer.profile!.name} received the ${badge}!`, voice);
        ui.toast(`🏅 ${badge} earned!`, "success");
      } else {
        trainer.save();
        await ui.say(data.trainer!.defeat || "You're strong!", voice);
      }
      await this.#progress(data);
    }
    await this.#after(outcome);
    return outcome;
  }

  /** Day Care: leave a Pokémon to raise (it gains 1 experience point per step the player walks), or take it back for a fee */
  async #daycare(voice: { speaker?: string; portrait?: Portrait }) {
    const profile = trainer.profile!;
    const kept = profile.daycare;
    if (kept) {
      //Raise it by the steps walked since it was left (on a copy, to tell the levels gained)
      const raised = structuredClone(kept.creature);
      const messages = grow(raised, Math.max(0, (profile.steps ?? 0) - kept.steps), this.#rules().cap);
      const levels = raised.level - kept.creature.level;
      const fee = 100 + 100 * levels;
      const name = named(raised);
      const text = levels
        ? `Your ${name} has grown a lot! It went up by ${levels} level${levels > 1 ? "s" : ""}.\n\nWould you like it back? That'll be ₽${fee}.`
        : `Your ${name} is doing just fine.\n\nWould you like it back? That'll be ₽${fee}.`;
      if (!(await ui.ask(text, voice))) {
        await ui.say("All right, we'll keep raising it.", voice);
        return;
      }
      if (profile.money < fee) {
        await ui.say("Oh, you don't have enough money…", voice);
        return;
      }
      profile.money -= fee;
      delete profile.daycare;
      const where = trainer.catch(raised);
      trainer.save();
      sound.play("victory");
      await ui.say(`${profile.name} got ${name} back from the Day Care.${where === "box" ? "\n\nIt was sent to the PC box." : ""}`, voice);
      for (const message of messages.filter((line) => line.includes("learned"))) {
        await ui.say(message);
      }
      return;
    }
    if (profile.party.length < 2) {
      await ui.say("You'd have no Pokémon left to travel with! Come back when you have two.", voice);
      return;
    }
    const names = profile.party.map((creature) => `${named(creature)} Lv${creature.level}`);
    const choice = await ui.choose("Would you like us to raise one of your Pokémon? Which one?", [...names, "CANCEL"], voice);
    if (choice >= profile.party.length) {
      await ui.say("Come again!", voice);
      return;
    }
    const [creature] = profile.party.splice(choice, 1);
    heal(creature);
    profile.daycare = { creature, steps: profile.steps ?? 0 };
    trainer.save();
    this.#follow();
    await ui.say(`We'll raise your ${named(creature)} for a while. Come back for it later.`, voice);
  }

  /** Battle, then the Pokémon that grew a level evolve if they're ready (not after blacking out) */
  async #battle(options: ConstructorParameters<typeof Battle>[0]) {
    const battle = new Battle(options);
    const outcome = await battle.start();
    if (outcome !== "lose") {
      await evolveGrown(battle.grown, this.#city.time);
    }
    return outcome;
  }

  /**
   * The Nurse heals the party like in Emerald: she turns to the machine behind her, puts the Poké Balls on it one by one,
   * and they flash while the healing jingle plays (Pokémon Centers built from Emerald's room have the machine at the same spot)
   */
  async #healing(index: number, voice: { speaker?: string; portrait?: Portrait }) {
    await ui.say("Okay, I'll take your Pokémon for a few seconds.", voice);
    const nurse = this.#npcs.find((npc) => npc.index === index)?.actor;
    const count = trainer.profile?.party.length ?? 0;
    if (!nurse || !count) {
      return;
    }
    const wait = (ms: number) => new Promise((solve) => setTimeout(solve, ms));
    const facing = nurse.dir;
    nurse.face("left");
    await wait(300);
    //Up to six balls in two columns, inside the machine's dark window to the Nurse's left (from her feet)
    const balls = [] as PIXI.Sprite[];
    for (let i = 0; i < Math.min(6, count); i++) {
      const ball = this.#map.containers.actors.addChild(glowingBall());
      ball.position.set(nurse.sprite.x - 31 + (i % 2) * 6, nurse.sprite.y - 24 + Math.floor(i / 2) * 4);
      ball.zIndex = nurse.y + 0.1;
      balls.push(ball);
      sound.play("hit2");
      await wait(350);
    }
    //They flash bright while the jingle plays
    const glow = new PIXI.filters.ColorMatrixFilter();
    glow.brightness(1.9, false);
    sound.play("victory");
    for (let flash = 0; flash < 6; flash++) {
      balls.forEach((ball) => (ball.filters = flash % 2 ? null : [glow]));
      await wait(260);
    }
    await wait(300);
    balls.forEach((ball) => ball.destroy());
    nurse.face(facing);
    await wait(200);
  }

  /** Handle battle outcome */
  async #after(outcome: string) {
    //A new lead (the old one fainted, or was moved) takes over following
    if (this.#follower && trainer.lead && trainer.lead.species !== this.#followed) {
      queueMicrotask(() => this.#follow());
    }
    if (outcome === "lose") {
      //Blacking out costs half the money
      const profile = trainer.profile!;
      const lost = Math.floor(profile.money / 2);
      profile.money -= lost;
      trainer.heal();
      if (lost) {
        await ui.say(`${profile.name} dropped ₽${lost} in panic…`);
      }
      const { spawn } = this.#city;
      Object.assign(this.#player, { x: spawn.x, y: spawn.y, tx: spawn.x, ty: spawn.y });
      this.#follow();
      this.#player.place();
      await ui.say("You hurried back to the start, protecting your exhausted Pokémon…");
    }
    trainer.save();
  }
}
