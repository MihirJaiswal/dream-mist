//Imports
import * as PIXI from "pixi.js";
import { artwork, creatureSprite, npc as texture, preview, size, species } from "./assets";
import { frames } from "./brushes";
import type { City, Direction, Door, Npc } from "./data";
import type { CityMap } from "./map";
import { Battle } from "./battle";
import { creatureImage, scaleOf } from "./sprites";
import { create, trainer } from "./trainer";
import { itemCount, itemIds, items } from "./items";
import { milestone, open } from "./story";
import { sound } from "./audio";
import { type Portrait, ui } from "./ui-bridge";

/** Direction deltas */
const deltas = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as const;

/** Opposite directions */
const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;

/** Keyboard mapping */
const keys = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" } as { [key: string]: Direction };

/** Sight range of trainers */
const sight = 4;

/** Character walking on the map */
class Actor {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: Direction;
  readonly sprite: PIXI.Sprite;
  readonly name: string;
  /** Single texture of a Pokémon on the map (people use their walking frames) */
  readonly #still: null | PIXI.Texture;

  constructor({ x, y, dir, name, parent, creature, look }: { x: number; y: number; dir: Direction; name: string; parent: PIXI.Container; creature?: number; look?: string }) {
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
  }

  /** Is moving */
  get moving() {
    return (this.x !== this.tx) || (this.y !== this.ty);
  }

  /** Face a direction */
  face(dir: Direction) {
    this.dir = dir;
    if (!this.#still) {
      this.sprite.texture = texture(this.name, dir, 0);
    } else if ((dir === "left") || (dir === "right")) {
      //Box icons face left, flip them to look right
      this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (dir === "right" ? -1 : 1);
    }
  }

  /** Advance toward target (returns true when step completed this frame) */
  advance(delta: number) {
    if (!this.moving) {
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
    if (!this.#still) {
      this.sprite.texture = texture(this.name, this.dir, left > 0 ? (Math.floor(left * 4) % 2 ? 1 : 2) : 0);
    }
    this.place();
    return !this.moving;
  }

  /** Apply position to sprite */
  place() {
    //Pokémon hop a little while moving
    const hop = this.#still && this.moving ? -Math.abs(Math.sin((this.x + this.y) * Math.PI)) * 3 : 0;
    this.sprite.position.set(this.x * size + size / 2, (this.y + 1) * size + (this.#still ? 2 : 0) + hop);
    this.sprite.zIndex = this.y;
  }

  /** Remove */
  destroy() {
    this.sprite.destroy();
  }
}

/** Person walking around the city */
type Person = { actor: Actor; data: Npc; index: number; home: { x: number; y: number }; next: number; bubble: null | PIXI.Text; hidden: boolean; leg: number; way: 1 | -1 };

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
  /** Tall grass drawn over the player's feet */
  #grass = null as unknown as PIXI.Sprite;
  readonly #ticker: (dt: number) => void;
  readonly #listeners = [] as [string, EventListener][];
  /** Whole city (story and progress live there), arrival position and door handler */
  readonly #world: City;
  readonly #arrive: null | { x: number; y: number; dir: Direction };
  readonly #onwarp: null | ((door: Door) => void);
  /** Walking off the edge of the map: true when another map is there and the player moves onto it */
  readonly #onedge: null | ((x: number, y: number, dir: Direction) => boolean);
  /** Next time a gate message may show again */
  #bump = 0;

  constructor(map: CityMap, city: City, { world = city, arrive = null as null | { x: number; y: number; dir: Direction }, onwarp = null as null | ((door: Door) => void), onedge = null as null | ((x: number, y: number, dir: Direction) => boolean) } = {}) {
    this.#map = map;
    this.#city = city;
    this.#world = world;
    this.#arrive = arrive;
    this.#onwarp = onwarp;
    this.#onedge = onedge;
    this.#ticker = (dt: number) => this.#update(dt);
  }

  /** Progress key of a person (outside map keeps the original format) */
  #key(index: number) {
    return this.#city === this.#world ? `${this.#world.id}:${index}` : `${this.#world.id}:${this.#city.id}/${index}`;
  }

  /** Is a story step done by the player */
  #done(step?: string) {
    return trainer.done(this.#world.id, step);
  }

  /** Is a person present at this point of the story (wild Pokémon are gone once beaten or caught) */
  #present(data: Npc) {
    const story = data.story;
    const gone = (data.role === "wild") && (this.#defeated(this.#city.npcs.indexOf(data)));
    return (!gone) && (!story?.after || this.#done(story.after)) && (!story?.until || !this.#done(story.until));
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
    this.#map.drawBlockers(animate);
  }

  /** Start play mode */
  start() {
    const { actors } = this.#map.containers;
    const spawn = this.#arrive ?? { ...this.#city.spawn, dir: "down" as Direction };
    this.#player = new Actor({ x: spawn.x, y: spawn.y, dir: spawn.dir, name: trainer.profile?.sprite ?? "may", parent: actors });
    const grass = PIXI.Texture.from(`${frames.tall}`);
    this.#grass = actors.addChild(new PIXI.Sprite(new PIXI.Texture(grass.baseTexture, new PIXI.Rectangle(grass.frame.x, grass.frame.y + 9, size, size - 9))));
    this.#grass.visible = false;
    this.#city.npcs.forEach((data, index) => {
      if ((!data.sprite) && (!data.creature)) {
        return;
      }
      const actor = new Actor({ x: data.x, y: data.y, dir: data.dir, name: data.sprite, parent: actors, creature: data.creature?.species, look: data.creature?.look });
      this.#npcs.push({ actor, data, index, home: { x: data.x, y: data.y }, next: performance.now() + 600 + Math.random() * 1200, bubble: null, hidden: false, leg: 1, way: 1 });
    });
    this.#refresh();
    this.#map.done = (step) => this.#done(step);
    this.#map.drawBlockers();
    this.#map.pannable = false;
    this.#map.center(this.#player.x + 0.5, this.#player.y + 0.5);
    this.#listen("keydown", (event) => this.#keydown(event as KeyboardEvent));
    this.#listen("keyup", (event) => this.#keyup(event as KeyboardEvent));
    this.#map.app.ticker.add(this.#ticker);
    sound.music("town");
  }

  /** Stop play mode (the music keeps going when moving to another map) */
  stop(keepMusic = false) {
    ui.hush();
    this.#map.app.ticker.remove(this.#ticker);
    this.#listeners.forEach(([type, listener]) => document.removeEventListener(type, listener));
    this.#player.destroy();
    this.#grass.destroy();
    this.#npcs.forEach(({ actor, bubble }) => (actor.destroy(), bubble?.destroy()));
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
      if ((!this.#player.moving) && (!this.#busy)) {
        if (this.#player.dir === dir) {
          this.#tap = dir;
        }
        this.#player.face(dir);
      }
    }
  }

  /** Key pressed */
  #keydown(event: KeyboardEvent) {
    if (((event.target as HTMLElement)?.closest?.("input, textarea, select")) || (document.querySelector("[role=dialog], [role=alertdialog]"))) {
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
    } else if ([" ", "enter", "z", "e"].includes(key) && (!event.repeat)) {
      event.preventDefault();
      this.#interact();
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

  /** Is a tile blocked */
  #blocked(x: number, y: number, self?: Actor) {
    if (!this.#map.inside({ x, y })) {
      return true;
    }
    if (this.#city.solid[y * this.#city.width + x]) {
      return true;
    }
    if (this.#gate(x, y)) {
      return true;
    }
    for (const actor of [this.#player, ...this.#npcs.filter(({ hidden }) => !hidden).map(({ actor }) => actor)]) {
      if ((actor !== self) && (((Math.round(actor.x) === x) && (Math.round(actor.y) === y)) || ((actor.tx === x) && (actor.ty === y)))) {
        return true;
      }
    }
    return false;
  }

  /** Frame update */
  #update(dt: number) {
    const now = performance.now();
    const player = this.#player;

    //Player movement
    if ((!this.#busy) && (!player.moving) && ((this.#held.length) || (this.#tap))) {
      const dir = this.#held[this.#held.length - 1] ?? this.#tap!;
      this.#tap = null;
      player.face(dir);
      const { x: dx, y: dy } = deltas[dir];
      //Off the edge of an outdoor map: onto the map touching it there
      if ((!this.#map.inside({ x: player.x + dx, y: player.y + dy })) && (this.#onedge?.(player.x + dx, player.y + dy, dir))) {
        this.#busy = true;
        return;
      }
      if (!this.#blocked(player.x + dx, player.y + dy, player)) {
        player.tx = player.x + dx;
        player.ty = player.y + dy;
      } else if ((now > this.#bump) && (this.#gate(player.x + dx, player.y + dy))) {
        //Bumping into a story gate explains why the way is closed
        const step = this.#gate(player.x + dx, player.y + dy)!;
        this.#bump = now + 1200;
        this.#busy = true;
        this.#held.length = 0;
        this.#tap = null;
        ui.say(step.blocked || "The way is blocked for now.").then(() => (this.#busy = false, this.#bump = performance.now() + 600));
      }
    }
    if (player.advance((dt / 60) * (this.#running ? 8 : 4))) {
      this.#stepped();
    }

    //Tall grass covers the player's feet
    const tile = Math.round(player.y) * this.#city.width + Math.round(player.x);
    const tall = frames.tall + 1;
    this.#grass.visible = (this.#city.layers.ground[tile] === tall) || (this.#city.layers.decor[tile] === tall);
    this.#grass.position.set(player.x * size, player.y * size + 9);
    this.#grass.zIndex = player.y + 0.5;

    //NPC wandering and paths
    for (const npc of this.#npcs) {
      const { actor, data, home } = npc;
      if ((actor.advance((dt / 60) * (data.path?.run ? 6 : 3))) && (!this.#busy)) {
        this.#watch(npc);
      }
      if ((this.#busy) || (actor.moving) || (now < npc.next) || (npc.hidden)) {
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
      if ((Math.random() < 0.6) && (Math.abs(x - home.x) <= 2) && (Math.abs(y - home.y) <= 2) && (!this.#blocked(x, y, actor))) {
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
    if ((actor.x === target.x) && (actor.y === target.y)) {
      //Next stop: loop to the start, or turn around at either end
      if (path.loop) {
        npc.leg = (npc.leg + 1) % stops.length;
      } else {
        if ((npc.leg + npc.way < 0) || (npc.leg + npc.way >= stops.length)) {
          npc.way = npc.way === 1 ? -1 : 1;
        }
        npc.leg += npc.way;
      }
      npc.next = now + path.pause * 1000;
      return;
    }
    //Across first, then up or down (the editor draws paths the same way)
    const dx = Math.sign(target.x - actor.x), dy = Math.sign(target.y - actor.y);
    const options = [[dx, 0], [0, dy]].filter(([x, y]) => x || y);
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
    return data.role === "trainer" ? !this.#defeated(index) : (Boolean(data.approach)) && (!trainer.profile?.met?.includes(this.#key(index)));
  }

  /** A trainer (or someone who walks up to talk) who just moved checks whether they see the player */
  #watch(npc: Person) {
    const ready = (!npc.hidden) && ((!npc.data.story?.requires) || (this.#done(npc.data.story.requires)));
    if ((ready) && (!this.#player.moving) && (this.#eager(npc)) && (this.#spots(npc))) {
      this.#challenge(npc);
    }
  }

  /** Player completed a step */
  async #stepped() {
    //Doors
    const door = this.#city.doors?.find(({ x, y, to }) => (x === this.#player.x) && (y === this.#player.y) && (to !== "?"));
    if ((door) && (this.#onwarp)) {
      this.#busy = true;
      this.#held.length = 0;
      this.#tap = null;
      this.#onwarp(door);
      return;
    }

    //Trainers (and people who walk up to talk) line of sight, only those present and ready for the player
    for (const npc of this.#npcs) {
      const ready = (!npc.hidden) && ((!npc.data.story?.requires) || (this.#done(npc.data.story.requires)));
      if ((ready) && (this.#eager(npc)) && (this.#spots(npc))) {
        await this.#challenge(npc);
        return;
      }
    }

    //Wild encounters
    const { x, y } = this.#player;
    const zone = this.#city.zones[this.#city.zone[y * this.#city.width + x] - 1];
    if ((zone?.creatures.length) && (Math.random() < zone.rate) && (trainer.lead)) {
      const total = zone.creatures.length;
      const { species: id, min, max } = zone.creatures[Math.floor(Math.random() * total)];
      if (!species(id)) {
        return;
      }
      this.#busy = true;
      this.#held.length = 0;
      this.#tap = null;
      const level = Math.max(1, Math.min(100, min + Math.floor(Math.random() * (Math.max(min, max) - min + 1))));
      const outcome = await new Battle({ wild: create(id, level) }).start();
      await this.#after(outcome);
      this.#busy = false;
    }
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
      if ((x === this.#player.x) && (y === this.#player.y)) {
        return true;
      }
      if ((!this.#map.inside({ x, y })) || (this.#city.solid[y * this.#city.width + x])) {
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
    const bubble = this.#map.containers.actors.addChild(new PIXI.Text("!", { fontFamily: "monospace", fontSize: 14, fontWeight: "bold", fill: 0xffffff, stroke: 0xe0303a, strokeThickness: 4 }));
    npc.bubble = bubble;
    bubble.anchor.set(0.5, 1);
    bubble.position.set(actor.sprite.x, actor.sprite.y - 20);
    bubble.zIndex = 9999;
    await new Promise((solve) => setTimeout(solve, 700));
    bubble.destroy();
    npc.bubble = null;
    const { x: dx, y: dy } = deltas[actor.dir];
    while ((Math.abs(actor.x - this.#player.x) + Math.abs(actor.y - this.#player.y)) > 1) {
      actor.tx = actor.x + dx;
      actor.ty = actor.y + dy;
      await new Promise((solve) => {
        const wait = () => actor.moving ? requestAnimationFrame(wait) : solve(null);
        wait();
      });
    }
    this.#player.face(opposite[actor.dir]);
    await this.#talk(npc);
    this.#busy = false;
  }

  /** Interact with facing tile */
  async #interact() {
    if ((this.#busy) || (this.#player.moving)) {
      return;
    }
    const { x: dx, y: dy } = deltas[this.#player.dir];
    const [x, y] = [this.#player.x + dx, this.#player.y + dy];
    //Signs (invisible NPCs) and people
    const index = this.#city.npcs.findIndex((data, i) => {
      if (!this.#present(data)) {
        return false;
      }
      const actor = this.#npcs.find((npc) => npc.index === i)?.actor;
      return actor ? (Math.round(actor.x) === x) && (Math.round(actor.y) === y) : (data.x === x) && (data.y === y);
    });
    if (index < 0) {
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
    if ((!story?.completes) || ((step) && (!open(this.#world, step, (id) => this.#done(id)))) || (!trainer.complete(this.#world.id, story.completes))) {
      return;
    }
    const { species: id, level = 5, balls = 0, potions = 0, money = 0 } = story.reward ?? {};
    const profile = trainer.profile!;
    if ((id) && (species(id))) {
      const creature = create(id, level, { shiny: false });
      const where = trainer.catch(creature);
      sound.play("victory");
      await ui.say(`${profile.name} received ${species(id).name}!${where === "box" ? "\n\nIt was sent to the PC box." : ""}`);
    }
    if ((balls) || (potions)) {
      trainer.give("poke-ball", balls);
      trainer.give("potion", potions);
      await ui.say(`${profile.name} got ${[balls ? itemCount("poke-ball", balls) : "", potions ? itemCount("potion", potions) : ""].filter(Boolean).join(" and ")}.`);
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

  /** Talk to a NPC */
  async #talk({ data, index }: { data: Npc; index: number }) {
    const voice = { speaker: data.name, portrait: portraitOf(data) };
    const story = data.story;
    //Not ready yet in the story
    if ((story?.requires) && (!this.#done(story.requires))) {
      await ui.say(story.locked || "I'm busy right now. Come back later!", voice);
      return;
    }
    //Their part of the story is already done
    if ((story?.completes) && (this.#done(story.completes)) && (story.done) && (data.role !== "healer")) {
      await ui.say(story.done, voice);
      return;
    }
    if ((data.role === "wild") && (data.creature) && (species(data.creature.species))) {
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
      if ((data.name) && (data.name !== species(id).name)) {
        wild.nickname = data.name;
      }
      const outcome = await new Battle({ wild }).start();
      if ((outcome === "win") || (outcome === "caught")) {
        trainer.profile!.defeated.push(this.#key(index));
        trainer.save();
        await this.#progress(data);
        this.#refresh(true);
      }
      await this.#after(outcome);
      return;
    }
    if ((data.role === "trainer") && (data.trainer?.team.length)) {
      if (this.#defeated(index)) {
        await ui.say(data.trainer.defeat || "You're too strong!", voice);
        return;
      }
      if (!trainer.lead) {
        await ui.say("Your Pokémon are too tired to battle. Find someone to heal them!", voice);
        return;
      }
      await ui.say(data.dialogue || "Let's battle!", voice);
      const team = data.trainer.team.filter(({ species: id }) => species(id)).map(({ species: id, level }) => create(id, level, { shiny: false }));
      const outcome = await new Battle({ opponent: { name: data.name || "Trainer", sprite: data.sprite, team } }).start();
      if (outcome === "win") {
        trainer.profile!.defeated.push(this.#key(index));
        if (data.trainer.gym) {
          const badge = data.trainer.badge || `${this.#city.name} Badge`;
          trainer.profile!.badges.push({ city: this.#city.name, name: data.name, badge, date: Date.now() });
          trainer.give("poke-ball", 5);
          trainer.save();
          await ui.say(`${data.trainer.defeat || "You beat me fair and square!"}\n\n${trainer.profile!.name} received the ${badge}!`, voice);
          ui.toast(`🏅 ${badge} earned!`, "success");
        } else {
          trainer.save();
          await ui.say(data.trainer.defeat || "You're strong!", voice);
        }
        await this.#progress(data);
      }
      await this.#after(outcome);
      return;
    }
    await ui.say(data.dialogue || "Hello!", voice);
    if (data.role === "healer") {
      trainer.heal();
      //Towns without a Poké Mart: the nurse keeps you stocked so you can still catch Pokémon
      if (![this.#world, ...this.#world.interiors].some((map) => map.npcs.some(({ role }) => role === "shop"))) {
        trainer.give("poke-ball", Math.max(0, 5 - trainer.count("poke-ball")));
        trainer.give("potion", Math.max(0, 5 - trainer.count("potion")));
      }
      trainer.save();
      sound.play("victory");
      await ui.say("Your Pokémon are fully healed! We hope to see you again!", voice);
    }
    if (data.role === "shop") {
      await ui.shop((data.shop?.length ? data.shop : itemIds).filter((id) => id in items), voice);
    }
    //A gift, the first time
    if ((data.gift?.count) && (data.gift.item in items) && (!trainer.profile!.received?.includes(this.#key(index)))) {
      const profile = trainer.profile!;
      trainer.give(data.gift.item, data.gift.count);
      profile.received = [...(profile.received ?? []), this.#key(index)];
      trainer.save();
      sound.play("victory");
      await ui.say(`${profile.name} received ${itemCount(data.gift.item, data.gift.count)}!`);
    }
    await this.#progress(data);
  }

  /** Handle battle outcome */
  async #after(outcome: string) {
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
      this.#player.place();
      await ui.say("You hurried back to the start, protecting your exhausted Pokémon…");
    }
    trainer.save();
  }
}
