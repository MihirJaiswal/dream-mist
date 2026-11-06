//Imports
import * as PIXI from "pixi.js";
import { load as loadAssets, size } from "./assets";
import { sound } from "./audio";
import { frames, starterDoors, template } from "./brushes";
import { type Card, cloud, isCloudId } from "./cloud";
import { crossing, walkable } from "./region";
import {
  area,
  blank,
  type City,
  decode,
  type Direction,
  type Door,
  levelCap,
  library,
  type MapType,
  type Npc,
  type Rules,
  type Scene,
  scenePicture,
  resize,
  sanitize,
  storage,
  typeOf,
  uid,
} from "./data";
import { EditorEngine } from "./editor/engine";
import { load as hoenn, type Section } from "./hoenn";
import { CityMap } from "./map";
import { Play, portraitOf } from "./play";
import type { Problem } from "./problems";
import { type Edit, type Peer, Room } from "./room";
import { frameOf, layouts, load as loadSprites, type Sprite } from "./sprites";
import { dataURL, load as loadTilesets, prepare, range } from "./tilesets";
import { create, type Creature, experience, grow, named, teamOf, type Trainer, trainer, upgrade } from "./trainer";
import { apply, evolveIfReady, field, helps, leveling, teachAll } from "./growth";
import { handsOutStarter } from "./scripts";
import { Battle, battleWeather, trainerRules } from "./battle";
import { type ItemId, items } from "./items";
import { type Interior, loadRooms, sheetName } from "./interiors";
import type { Daytime, Weather } from "./atmosphere";
import { type SignInReason, ui } from "./ui-bridge";

/** City saved online */
export type Online = { id: string; mine: boolean; invite?: string | null; published?: boolean; forkOf?: Card["forkOf"] };

/** Chat message in a live room */
export type ChatMessage = { name: string; color: string; text: string; from: string; at: number };

/** Error message of an exception */
export const message = (error: unknown) => (error as Error)?.message ?? `${error}`;

/** Checklist shown before publishing (a guide, publishing is always possible) */
export function checklist(city: City) {
  const maps = [city, ...city.interiors];
  return [
    { ok: maps.some((map) => map.npcs.length > 0), text: "Has people to talk to" },
    { ok: maps.some((map) => map.zone.some(Boolean)), text: "Has wild Pokémon zones" },
    { ok: maps.some((map) => map.npcs.some(({ role }) => role === "trainer")), text: "Has trainers to battle" },
    { ok: city.story.length > 0, text: `Has a story${city.story.length ? ` (${city.story.length} step${city.story.length > 1 ? "s" : ""})` : ""}` },
    { ok: city.interiors.length > 0, text: `Has interiors${city.interiors.length ? ` (${city.interiors.length})` : ""}` },
  ];
}

/** Starting points for a new city */
export type Start = { kind: "starter" } | { kind: "empty" } | { kind: "hoenn"; section: Section };

/**
 * Editor session: the open city, edit and play modes, saving, the account, live rooms and links.
 * React components read its state (subscribe + version) and call its methods. It never renders DOM itself.
 */
export class Session {
  city = null as unknown as City;
  /** Map being edited or played (the city itself or one of its interiors) */
  area = null as unknown as City;
  mode = "edit" as "edit" | "play";
  /** Visiting someone else's city (play only) */
  visiting = false;
  /** Current city is saved online */
  online = null as null | Online;
  /** Saved id of the city being visited (forks and play counter) */
  visit = "";
  room = null as null | Room;
  roomStatus = "offline" as "connecting" | "online" | "offline";
  chat = [] as ChatMessage[];
  /** Save status shown in the status bar */
  saved = "";
  /** Edits made while logged out (a reminder to log in shows after a while) */
  edits = 0;
  /** Black fade while walking through a door */
  fading = false;
  ready = false;
  map = null as unknown as CityMap;
  editor = null as unknown as EditorEngine;
  play = null as null | Play;
  /** Right-click menu on the map (Build only): the tile, and where on screen to open it */
  menu = null as null | { tile: { x: number; y: number }; left: number; top: number };
  /** Where you were building before pressing Play (map and camera), to come back to it */
  #building = null as null | { area: string; x: number; y: number; scale: number };
  readonly #cursors = new Map<string, PIXI.Container>();
  readonly #listeners = new Set<() => void>();
  #version = 0;
  #timeout = 0;
  #trainerTimeout = 0;
  #booting = null as null | Promise<void>;

  //=================================================================================================
  // Subscription

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  get version() {
    return this.#version;
  }
  notify() {
    this.#version++;
    this.#listeners.forEach((listener) => listener());
  }

  //=================================================================================================
  // Saving

  #status(text: string) {
    this.saved = text;
    this.notify();
  }

  /** Something changed: save shortly (and count edits while logged out) */
  changed = () => {
    if (this.visiting) {
      return;
    }
    this.#status(this.room ? "Live" : "Saving…");
    clearTimeout(this.#timeout);
    this.#timeout = setTimeout(() => this.persist(), 700) as unknown as number;
    if (!cloud.user && cloud.available && !this.room) {
      this.edits++;
    }
  };

  /** Save the city now (in this browser, and online when it belongs to the account or this builder hosts the room) */
  async persist() {
    clearTimeout(this.#timeout);
    if (this.visiting || !this.city) {
      return;
    }
    const local = library.save(this.city);
    storage.set("last", this.city.id);
    if (this.online && (!this.room || this.room.host)) {
      try {
        await cloud.cities.save(this.online.id, this.city, this.online.invite ?? "");
        this.#status(this.room ? "Live · saved" : "Saved online");
      } catch (error) {
        this.#status(`Not saved online: ${message(error)}`);
      }
      return;
    }
    this.#status(this.room ? "Live" : local ? "Saved on this device" : "Not saved (storage full)");
  }

  //=================================================================================================
  // Opening cities and modes

  /** Open a city */
  async open(city: City, { visiting = false, mode = (visiting ? "play" : "edit") as "edit" | "play", online = null as null | Online, keepRoom = false } = {}) {
    if (!keepRoom) {
      this.leaveRoom();
    }
    if (!visiting) {
      this.visit = "";
    }
    this.play?.stop();
    this.play = null;
    this.editor.stop();
    this.city = city;
    this.area = city;
    this.visiting = visiting;
    this.online = online;
    await loadTilesets(city.tilesets);
    await loadSprites(city.sprites);
    sound.custom = city.music ?? {};
    this.map.root = city;
    this.map.load(city);
    this.map.world.scale.set(3);
    this.map.center(city.spawn.x + 0.5, city.spawn.y + 0.5);
    this.editor.reset(city, city);
    if (!visiting) {
      storage.set("last", city.id);
      library.save(city);
      if (!keepRoom) {
        history.replaceState(null, "", location.pathname);
      }
    }
    await this.setMode(mode);
  }

  /** Switch between edit and play (play can start from a tile of the current map instead of the spawn) */
  async setMode(mode: "edit" | "play", from: null | { x: number; y: number } = null): Promise<void> {
    //A new game: the Professor's opening (a new trainer picks their look and name there), when there's no trainer yet or the game has a speech
    //A trainer without Pokémon gets a partner there too, unless this game has a starter to choose
    const fresh = mode === "play" && this.mode !== "play" && !trainer.profile?.started?.includes(this.city.id);
    const partner = !trainer.profile?.party.length && !trainer.profile?.box.length && !handsOutStarter(this.city);
    if (mode === "play" && (!trainer.exists || partner || (fresh && this.city.intro?.speech.trim()))) {
      await ui.opening({
        game: this.city.name,
        speech: this.city.intro?.speech,
        professor: this.city.intro?.professor,
        partner,
        newTrainer: !trainer.exists,
      });
      if (!trainer.exists) {
        if (this.visiting) {
          return this.setMode("play");
        }
        mode = "edit";
      }
    }
    //Remember where you were building, to come back to it after playing
    if (mode === "play" && this.mode === "edit") {
      this.#building = { area: this.#areaId(), x: this.map.world.x, y: this.map.world.y, scale: this.map.world.scale.x };
    }
    //It starts in the game's first map (and visitors always start there)
    if (mode === "play" && !from && (fresh || this.visiting) && trainer.profile) {
      trainer.profile.started = [...new Set([...(trainer.profile.started ?? []), this.city.id])];
      trainer.save();
      const start = area(this.city, this.city.start ?? "");
      if (start && start !== this.area) {
        this.area = start;
        this.map.load(start);
      }
    }
    this.menu = null;
    this.mode = mode;
    this.play?.stop();
    this.play = null;
    this.editor.stop();
    if (mode === "edit") {
      const view = this.#building;
      this.#building = null;
      if (view && view.area !== this.#areaId() && area(this.city, view.area)) {
        //Playing walked through a door: go back to the map you were building
        this.area = area(this.city, view.area)!;
        this.map.load(this.area);
      }
      this.editor.start(this.area, this.city);
      if (view) {
        this.map.world.scale.set(view.scale);
        this.map.world.position.set(view.x, view.y);
        this.map.onzoom?.(view.scale);
      }
    } else {
      this.map.scale(3);
      this.#play(from ? { ...from, dir: "down" } : null);
    }
    this.#scene();
    this.notify();
    setTimeout(() => this.map.app.resize(), 0);
  }

  /** Weather and time of day of the open map over it while playing, and neighboring maps faded while building */
  #scene() {
    this.map.sky(this.mode === "play" ? this.area.weather : "clear", this.mode === "play" ? this.area.time : "day");
    this.map.fadeNeighbors(this.mode === "edit");
  }

  /** The whole town as text (interiors included), to undo town-wide changes */
  #town() {
    return JSON.stringify(this.city);
  }

  /** Run a town-wide change (rename, resize, uploads) as one undo step */
  #undoable<T>(fn: () => T): T {
    const before = this.#town();
    const result = fn();
    const remember = () => this.editor.remember(before, this.#town());
    if (result instanceof Promise) {
      return result.then((value) => (remember(), value)) as T;
    }
    remember();
    return result;
  }

  /** Put the whole town back as it was in an undo snapshot */
  async #restore(town: string) {
    const id = this.#areaId();
    const parsed = JSON.parse(town);
    const { interiors: _, ...fields } = sanitize(parsed);
    //Clear weather, day time and the built-in battle scene are stored as no field at all, which assigning wouldn't remove
    for (const key of ["weather", "time", "battle", "type", "dark", "song", "rules"] as const) {
      delete this.city[key];
    }
    Object.assign(this.city, fields);
    this.city.interiors = (Array.isArray(parsed.interiors) ? parsed.interiors : []).map((map: City) => sanitize(map, this.city));
    this.area = area(this.city, id) ?? this.city;
    this.editor.stop();
    this.editor.start(this.area, this.city);
    sound.custom = this.city.music ?? {};
    await this.rerender();
    this.#scene();
    this.broadcastCity();
    this.notify();
  }

  /** Id of the open map ("" = outside) */
  #areaId() {
    return this.area === this.city ? "" : this.area.id;
  }

  /** Play from a tile of the open map (the spawn when none is given) */
  playFrom(tile: null | { x: number; y: number }) {
    if (tile && !this.map.inside(tile)) {
      tile = null;
    }
    return this.setMode("play", tile);
  }

  /** Close the map's right-click menu */
  closeMenu() {
    if (this.menu) {
      this.menu = null;
      this.notify();
    }
  }

  /** Open what a problem is about: its map and layer, the person, door or story step, and center on it */
  async fix(problem: Problem) {
    if (this.mode !== "edit") {
      await this.setMode("edit");
    }
    if (problem.map !== this.#areaId()) {
      this.openArea(problem.map);
    }
    this.editor.select(problem.layer);
    if (problem.npc !== undefined) {
      this.editor.selectNpc(problem.npc);
    }
    if (problem.door !== undefined) {
      this.editor.selectDoor(problem.door);
    }
    if (problem.trigger !== undefined) {
      this.editor.selectTrigger(problem.trigger);
    }
    if (problem.step !== undefined) {
      this.editor.setStep(problem.step);
    }
    if (problem.at) {
      this.map.center(problem.at.x + 0.5, problem.at.y + 0.5);
    }
    this.notify();
  }

  /** Show what someone says in the real dialogue box, without leaving Build */
  preview(npc: Npc, text: string) {
    return ui.say(text.trim() || "…", { speaker: npc.name, portrait: portraitOf(npc) });
  }

  /** Start play mode on the current map */
  #play(arrive = null as null | { x: number; y: number; dir: Direction }) {
    this.play?.stop();
    this.play = new Play(this.map, this.area, {
      world: this.city,
      arrive,
      onwarp: (door) => this.#warp(door),
      onedge: (x, y, dir) => this.#cross(x, y, dir),
      onraid: (den, damage) => this.room?.raid(den, damage),
      live: () => Boolean(this.room),
    });
    this.play.start();
  }

  /** Walk off the edge of an outdoor map onto the map touching it there (false when there's none, or the way is blocked) */
  #cross(x: number, y: number, dir: Direction) {
    const target = crossing(this.city, this.area, x, y);
    if (!target) {
      return false;
    }
    const index = target.y * target.map.width + target.x;
    const gate = target.map.gate[index] ? this.city.story.find(({ n }) => n === target.map.gate[index]) : null;
    const [fx, fy] = [Math.max(0, Math.min(this.area.width - 1, x)), Math.max(0, Math.min(this.area.height - 1, y))];
    if (!walkable(this.area, fx, fy) || !walkable(target.map, target.x, target.y) || (gate && !trainer.done(this.city.id, gate.id))) {
      return false;
    }
    setTimeout(() => this.openArea(target.map === this.city ? "" : target.map.id, { x: target.x, y: target.y, dir }), 0);
    return true;
  }

  /** Open a map of the current city ("" = outside) */
  openArea = (id: string, arrive = null as null | { x: number; y: number; dir: Direction }) => {
    const map = area(this.city, id);
    if (!map) {
      return ui.toast("That interior doesn't exist anymore", "error");
    }
    //Moving between maps while playing keeps the music going
    this.play?.stop(this.mode === "play");
    this.play = null;
    this.editor.stop();
    const moved = map !== this.area;
    this.area = map;
    this.map.load(map);
    if (this.mode === "play") {
      this.#play(arrive);
      if (moved) {
        ui.banner({ kind: "place", title: map === this.city ? this.city.name : map.name, text: "" });
      }
    } else {
      this.editor.start(map, this.city);
      this.editor.reset(map, this.city);
      this.map.center(map.width / 2, map.height / 2);
    }
    this.#scene();
    this.notify();
  };

  /** Walk through a door */
  #warp(door: Door) {
    const from = this.area;
    const target = area(this.city, door.to);
    if (!target) {
      ui.toast("This door leads nowhere yet", "error");
      return this.openArea(from === this.city ? "" : from.id);
    }
    //Arrive at the door leading back, one tile away from it
    const back = target.doors.find(({ to }) => to === (from === this.city ? "" : from.id));
    const arrive =
      door.tx >= 0
        ? { x: door.tx, y: door.ty, dir: "down" as Direction }
        : back
          ? {
              x: back.x,
              y: Math.max(0, Math.min(target.height - 1, back.y + (back.y >= target.height - 1 ? -1 : 1))),
              dir: (back.y >= target.height - 1 ? "up" : "down") as Direction,
            }
          : { ...target.spawn, dir: "down" as Direction };
    this.fading = true;
    this.notify();
    setTimeout(() => this.openArea(door.to, arrive), 180);
    setTimeout(() => ((this.fading = false), this.notify()), 600);
  }

  /** Re-render the whole map (after tilesets, sprites or size change) */
  async rerender() {
    await loadTilesets(this.city.tilesets);
    await loadSprites(this.city.sprites);
    this.map.load(this.area);
    this.editor.refresh();
  }

  //=================================================================================================
  // Account

  /** Put the current city online (asks to sign in first), resolves false when the player declined */
  async upload(reason: SignInReason = "share") {
    if (!cloud.user) {
      await ui.signIn(reason);
      if (!cloud.user) {
        return false;
      }
    }
    if (this.online?.mine) {
      return true;
    }
    const created = await cloud.cities.create(this.city);
    const previous = this.city.id;
    this.city.id = created.id;
    library.remove(previous);
    library.save(this.city);
    this.online = { id: created.id, mine: true, invite: created.invite };
    storage.set("last", created.id);
    ui.toast("City saved to your account", "success");
    this.notify();
    return true;
  }

  /** Bring trainer progress in line with the account after signing in */
  async synchronize() {
    const remote = (await cloud.trainer.get().catch(() => null)) as Trainer | null;
    if (remote?.name) {
      trainer.profile = upgrade(remote);
      trainer.save();
    } else if (trainer.exists) {
      await cloud.trainer.put(trainer.profile).catch(() => null);
    }
  }

  /** Signed in: sync the trainer, then offer to save this browser's towns to the account */
  async signedIn() {
    await this.synchronize();
    this.edits = 0;
    this.notify();
    ui.toast(`Signed in as ${cloud.user!.username}`, "success");
    const local = this.localCities();
    if (local.length) {
      await ui.bring(
        local.map((city) => ({ id: city.id, name: city.name, width: city.width, height: city.height, people: city.npcs.length, updated: city.updated })),
      );
    }
  }

  /** Save some of this browser's towns to the account */
  async bring(ids: string[]) {
    let saved = 0;
    for (const city of this.localCities().filter(({ id }) => ids.includes(id))) {
      if (city.id === this.city.id && !this.visiting) {
        await this.upload();
      } else {
        const created = await cloud.cities.create(sanitize(city));
        library.remove(city.id);
        library.save({ ...city, id: created.id } as City);
      }
      saved++;
    }
    this.notify();
    return saved;
  }

  /** Log out (towns stay in the account and in this browser) */
  async logout() {
    await this.persist();
    await cloud.logout();
    this.leaveRoom();
    this.online = null;
    this.notify();
  }

  //=================================================================================================
  // Cities

  /** Towns saved in this browser and not in an account */
  localCities() {
    return library.list().filter(({ id }) => !isCloudId(id));
  }

  /** Open a town saved in this browser */
  async openLocal(id: string) {
    const city = library.list().find((city) => city.id === id);
    if (city) {
      await this.persist();
      await this.open(sanitize(city));
    }
  }

  /** Open a town from the account */
  async openOnline(id: string) {
    await this.persist();
    await this.#loadOnline(id);
  }

  /** Open a town as it is saved online (without saving the open one first) */
  async #loadOnline(id: string) {
    const { city, meta, invite } = await cloud.cities.get(id);
    await this.open(sanitize(city), { online: { id, mine: meta.mine, invite, published: meta.published, forkOf: meta.forkOf } });
  }

  /** Earlier versions of the open online town */
  versions() {
    if (!this.online) {
      return Promise.resolve([]);
    }
    return cloud.cities.versions(this.online.id);
  }

  /** Bring the open online town back to an earlier version, after saving what's there now */
  async restoreVersion(version: number) {
    if (!this.online) {
      return;
    }
    if (this.room) {
      throw new Error("Leave the live room before restoring a version");
    }
    await this.persist();
    await cloud.cities.restore(version);
    //Load what was restored (saving the open copy now would undo the restore)
    await this.#loadOnline(this.online.id);
  }

  /** Delete a town from this browser */
  deleteLocal(id: string) {
    library.remove(id);
    this.notify();
  }

  /** Delete a town from the account (its share links stop working) */
  async deleteOnline(id: string) {
    await cloud.cities.remove(id);
    library.remove(id);
    this.notify();
  }

  /** Start a new town (the current one is saved first) */
  async create(start: Start, name: string) {
    const author = cloud.user?.username ?? trainer.profile?.name ?? "";
    const previous = this.visiting ? null : this.city?.name;
    let city: City;
    if (start.kind === "starter") {
      city = template(blank({ name, author }));
    } else if (start.kind === "empty") {
      city = blank({ name, author, ground: frames.grass + 1 });
    } else {
      city = await hoenn(start.section);
      city.author = author;
      if (name) {
        city.name = name;
      }
    }
    await this.persist();
    await this.open(city);
    if (start.kind === "starter") {
      await this.#furnish();
    }
    if (cloud.user) {
      await this.upload().catch((error) => ui.toast(message(error), "error"));
    }
    ui.toast(previous ? `${previous} is saved in Your cities. Have fun with ${city.name}!` : `Started ${city.name}`, "success");
  }

  /**
   * Give the starter town's Pokémon Center, house and lab their interiors (Emerald's rooms), and lead their doors there.
   * New players wake up in their room upstairs, and the Professor's starter completes the town's first story step
   */
  async #furnish() {
    for (const [key, at] of Object.entries(starterDoors(this.city))) {
      const door = this.city.doors.find(({ x, y, to }) => x === at.x && y === at.y && to === "?");
      if (!door) {
        continue;
      }
      const room = await this.newInterior(key);
      door.to = room.id;
      if (key === "home") {
        //Their room is upstairs: they start by its stairs
        const upstairs = room.doors.map(({ to }) => area(this.city, to)).find((map) => map && map !== this.city);
        const stairs = upstairs?.doors.find(({ to }) => to === room.id);
        if (upstairs && stairs) {
          const free = [stairs.y + 1, stairs.y - 1]
            .map((y) => ({ x: stairs.x, y }))
            .find(({ x, y }) => y >= 0 && y < upstairs.height && !upstairs.solid[y * upstairs.width + x]);
          upstairs.spawn = free ?? { x: stairs.x - 1, y: stairs.y };
          this.city.start = upstairs.id;
        }
      }
      const step = this.city.story[0];
      const professor = key === "lab" ? room.npcs.find(({ script }) => script?.actions.some(({ do: kind }) => kind === "starter")) : null;
      if (professor?.script && step) {
        professor.script.actions.push({ do: "step", step: step.id });
      }
    }
    this.openArea("");
    this.changed();
  }

  /** Import a city file or share link */
  async importText(text: string) {
    const code = text.match(/#(?:visit|remix)=(c1\.[\w-]+)/)?.[1] ?? (text.startsWith("c1.") ? text : null);
    const city = code ? await decode(code) : sanitize(JSON.parse(text));
    city.id = uid();
    await this.persist();
    await this.open(city);
    ui.toast(`Imported ${city.name}`, "success");
  }

  /** Make your own copy of the city you're visiting */
  async remix() {
    //Online cities are forked into the account (credits the original), others are copied locally
    if (cloud.user && this.visit) {
      return this.fork(this.visit);
    }
    const copy = sanitize(JSON.parse(JSON.stringify(this.city)));
    copy.id = uid();
    copy.name = `${this.city.name} (remix)`;
    await this.open(copy);
    if (cloud.user) {
      await this.upload().catch((error) => ui.toast(message(error), "error"));
    }
    ui.toast("City copied: build away!", "success");
  }

  /** Fork a saved city into the account */
  async fork(id: string) {
    try {
      const created = await cloud.cities.fork(id);
      const { city, invite } = await cloud.cities.get(created.id);
      this.visit = "";
      await this.open(sanitize(city), { online: { id: created.id, mine: true, invite: invite ?? created.invite, forkOf: created.forkOf } });
      ui.toast(`Forked ${created.forkOf?.name ?? "city"} into your cities: build on top of it!`, "success");
    } catch (error) {
      ui.toast(message(error), "error");
    }
  }

  /** Current Explore details of the city (after making sure it is saved online) */
  async publishing() {
    if (!(await this.upload("publish"))) {
      return null;
    }
    if (this.area !== this.city) {
      this.openArea("");
    }
    return (await cloud.cities.get(this.online!.id)).meta;
  }

  /** Publish the city (or update it) with a preview of the outside map */
  async publish(description: string, preview: HTMLCanvasElement) {
    const id = this.online!.id;
    await cloud.cities.save(id, this.city, this.online!.invite ?? "");
    const blob = await new Promise<Blob | null>((solve) => preview.toBlob(solve, "image/png"));
    const thumb = blob ? (await cloud.upload(blob, "thumb", `${this.city.name} preview`)).url : "";
    await cloud.cities.publish(id, description.trim(), thumb);
    this.online!.published = true;
    this.notify();
  }

  /** Remove the city from Explore */
  async unpublish() {
    await cloud.cities.unpublish(this.online!.id);
    this.online!.published = false;
    this.notify();
  }

  /** Visit and remix links of the city */
  async links() {
    const base = `${location.origin}/editor`;
    if (this.online) {
      return { visit: `${base}#visit=${this.online.id}`, remix: `${base}#remix=${this.online.id}`, packed: false };
    }
    const { link } = await import("./data");
    return { visit: await link(this.city, "visit"), remix: await link(this.city, "remix"), packed: true };
  }

  /** Download the map as a PNG image */
  exportImage() {
    const { width, height, name } = this.area;
    const k = Math.max(width, height) * size * 2 <= 4096 ? 2 : 1;
    const canvas = this.map.snapshot(k);
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        return ui.toast("Could not export the image", "error");
      }
      download(`${name.replace(/[^\w-]+/g, "_")}.png`, blob);
      ui.toast(`Exported ${canvas.width}×${canvas.height} image`, "success");
    }, "image/png");
  }

  /** Download the whole city as a .json file */
  exportJson() {
    download(`${this.city.name.replace(/[^\w-]+/g, "_")}.city.json`, new Blob([JSON.stringify(this.city)], { type: "application/json" }));
  }

  /** Rename the city */
  rename(name: string) {
    return this.#undoable(() => {
      this.city.name = name.trim().slice(0, 40) || "Unnamed town";
      this.room?.meta({ name: this.city.name });
      this.changed();
      this.notify();
    });
  }

  /** Set the author name shown on share links */
  setAuthor(author: string) {
    return this.#undoable(() => {
      this.city.author = author.slice(0, 40);
      this.room?.meta({ author: this.city.author });
      this.changed();
    });
  }

  //=================================================================================================
  // Live rooms

  /** Apply room tile edits to whichever map they belong to */
  #remoteEdits(changes: Edit[]) {
    const current = this.area === this.city ? "" : this.area.id;
    const here = changes.filter(([, , , map = ""]) => map === current);
    if (here.length) {
      this.editor.remote(here.map(([grid, index, value]) => [grid, index, value]));
    }
    for (const [grid, index, value, map = ""] of changes) {
      if (map === current) {
        continue;
      }
      const target = area(this.city, map);
      const values = target
        ? grid === "solid"
          ? target.solid
          : grid === "behavior"
            ? target.behavior
            : grid === "zone"
              ? target.zone
              : grid === "gate"
                ? target.gate
                : target.layers[grid as "ground"]
        : null;
      if (values && index >= 0 && index < values.length) {
        values[index] = value;
      }
    }
  }

  /** Draw or move a remote builder's cursor */
  #cursor(peer: Peer) {
    let element = this.#cursors.get(peer.id);
    if (!element) {
      element = new PIXI.Container();
      const color = parseInt(peer.color.slice(1), 16);
      element.addChild(new PIXI.Graphics().lineStyle({ width: 1.5, color, alpha: 1, native: true }).drawRect(0, 0, size, size));
      const name = element.addChild(
        new PIXI.Text(peer.name, {
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: 24,
          fontWeight: "600",
          fill: 0xffffff,
          stroke: color,
          strokeThickness: 6,
        }),
      );
      name.scale.set(0.25);
      name.position.set(0, -8);
      this.map.containers.overlay.addChild(element);
      this.#cursors.set(peer.id, element);
    }
    element.visible = peer.x >= 0;
    element.position.set(peer.x * size, peer.y * size);
  }

  /** Join a live room (the city is loaded from the account, then kept in sync) */
  async joinRoom(id: string, invite: string, name: string) {
    this.leaveRoom();
    if (cloud.user) {
      await cloud.cities.join(id, invite).catch(() => false);
    }
    const { city, meta } = await cloud.cities.get(id);
    await this.open(sanitize(city), {
      online: { id, mine: meta.mine, invite, published: meta.published, forkOf: meta.forkOf },
      keepRoom: true,
      mode: this.mode,
    });
    history.replaceState(null, "", `#room=${id}.${invite}`);
    this.chat = [];
    this.room = new Room({
      id,
      invite,
      name,
      handlers: {
        edit: (changes) => this.#remoteEdits(changes),
        meta: async (patch) => {
          const { map = "", interiors, npcs, spawn, doors, triggers, ...shared } = patch as typeof patch & { interiors?: City[] };
          Object.assign(this.city, shared);
          //People, spawn, doors and triggers belong to one map
          const target = area(this.city, map);
          if (target) {
            Object.assign(target, Object.fromEntries(Object.entries({ npcs, spawn, doors, triggers }).filter(([, value]) => value !== undefined)));
          }
          if (interiors) {
            const current = this.area === this.city ? "" : this.area.id;
            this.city.interiors = interiors.map((raw) => sanitize(raw, this.city));
            if (current) {
              this.openArea(area(this.city, current) ? current : "");
            }
          }
          if ("tilesets" in patch || "sprites" in patch) {
            await this.rerender();
          }
          if ("music" in patch) {
            sound.custom = this.city.music ?? {};
          }
          this.editor.refresh();
          library.save(this.city);
          this.changed();
          this.notify();
        },
        city: async (city) => {
          const current = this.area === this.city ? "" : this.area.id;
          await this.open(sanitize(city), { online: this.online, keepRoom: true, mode: this.mode });
          if (current && area(this.city, current)) {
            this.openArea(current);
          }
        },
        peers: (peers) => {
          for (const [id, element] of this.#cursors) {
            if (!peers.has(id)) {
              element.destroy({ children: true });
              this.#cursors.delete(id);
            }
          }
          this.notify();
        },
        cursor: (peer) => this.#cursor(peer),
        raid: ({ den, damage, name }) => {
          if (Battle.active?.raid === den) {
            Battle.active.hurt(den, damage);
            ui.toast(`${name} hit the raid boss for ${damage} HP!`, "info");
          }
        },
        chat: (message) => {
          this.chat = [...this.chat.slice(-49), { ...message, at: Date.now() }];
          if (message.from !== this.room?.you.id) {
            ui.toast(`${message.name}: ${message.text}`, "info");
          }
          this.notify();
        },
        status: (value) => {
          this.roomStatus = value;
          this.#status(value === "online" ? "Live" : value === "connecting" ? "Connecting to room…" : "Room offline, reconnecting…");
        },
        host: () => this.notify(),
        hello: () => this.city,
      },
    });
    this.editor.onedit = (changes) => this.room?.edit(changes.map(([grid, index, value]) => [grid, index, value, this.#mapId()]));
    this.editor.onmeta = (patch) => this.room?.meta({ ...patch, map: this.#mapId() });
    this.editor.oncursor = (x, y) => this.room?.cursor(x, y);
    ui.toast(`Joined ${this.city.name}: build together!`, "success");
    this.notify();
  }

  #mapId() {
    return this.area === this.city ? "" : this.area.id;
  }

  /** Invite friends: save the city online and open its room */
  async startRoom() {
    if (!(await this.upload("room"))) {
      return false;
    }
    if (!this.room) {
      const code = this.online!.invite ?? (await cloud.cities.invite(this.online!.id));
      this.online!.invite = code;
      await this.joinRoom(this.online!.id, code, cloud.user!.username);
    }
    return true;
  }

  /** New invite link (old links stop working for new builders) */
  async resetInvite() {
    const code = await cloud.cities.invite(this.online!.id, true);
    this.online!.invite = code;
    await this.joinRoom(this.online!.id, code, cloud.user?.username ?? "Builder");
    ui.toast("New invite link created", "success");
  }

  /** Leave the live room */
  leaveRoom() {
    this.room?.close();
    this.room = null;
    this.roomStatus = "offline";
    this.#cursors.forEach((element) => element.destroy({ children: true }));
    this.#cursors.clear();
    if (this.editor) {
      this.editor.onedit = this.editor.onmeta = this.editor.oncursor = null;
    }
    this.notify();
  }

  /** Send the whole city to the room (after resizing or removing a tileset) */
  broadcastCity() {
    void this.room?.city(this.city);
    this.changed();
  }

  //=================================================================================================
  // City settings: size, music, tilesets and sprites

  /** Resize the open map (content stays anchored to the top-left corner) */
  resizeArea(width: number, height: number) {
    const [w, h] = [Math.max(6, Math.min(128, width)), Math.max(6, Math.min(128, height))];
    if (w === this.area.width && h === this.area.height) {
      return;
    }
    this.#undoable(() => {
      resize(this.area, w, h);
      this.map.load(this.area);
      this.editor.refresh();
      this.broadcastCity();
    });
    ui.toast(`Resized to ${w}×${h}`, "success");
  }

  /** Upload a battle background for the open map (on the outside map, it's the default of every map without its own) */
  async uploadBattle(file: File) {
    return this.#undoable(async () => {
      const image = await this.#store(file, "battle", "battle", 512 * 1024);
      this.area.battle = { image, platforms: this.area.battle?.platforms ?? true };
      this.broadcastCity();
      this.changed();
      this.notify();
    });
  }

  /** Draw platforms on the open map's battle background, or remove the background (null) */
  setBattle(battle: null | { platforms: boolean } | { scene: Scene }) {
    this.#undoable(() => {
      if (!battle) {
        delete this.area.battle;
      } else if ("scene" in battle) {
        //An Emerald scene has its battle bases drawn in
        this.area.battle = { image: scenePicture(battle.scene), platforms: false };
      } else if (this.area.battle) {
        this.area.battle = { ...this.area.battle, ...battle };
      }
      this.broadcastCity();
      this.changed();
    });
    this.notify();
  }

  /** Set the weather and time of day of the open map */
  setSky({ weather = this.area.weather, time = this.area.time }: { weather?: Weather; time?: Daytime }) {
    this.#undoable(() => {
      this.area.weather = weather === "clear" ? undefined : weather;
      this.area.time = time === "day" ? undefined : time;
      this.#scene();
      this.broadcastCity();
      this.changed();
    });
    this.notify();
  }

  /** Change the open map's details: what kind of place it is, whether it's dark, its music ("" = the town music) */
  setMapDetails({ type, dark, song }: { type?: MapType | "auto"; dark?: boolean; song?: string }) {
    this.#undoable(() => {
      const map = this.area;
      if (type !== undefined) {
        //Outdoors for the outside and outdoor maps, indoors for interiors, is the default and stays unset
        const auto = map === this.city || map.outdoor ? "outdoor" : "indoor";
        if (type === "auto" || type === auto) delete map.type;
        else map.type = type;
      }
      if (dark !== undefined) {
        if (dark) map.dark = true;
        else delete map.dark;
      }
      if (song !== undefined) {
        if (song) map.song = song;
        else delete map.song;
      }
      this.broadcastCity();
      this.changed();
    });
    this.notify();
  }

  /** Upload the open map's own music (needs an account) */
  async uploadSong(file: File) {
    if (!cloud.user) {
      throw new Error(cloud.available ? "Log in to upload music" : "Music uploads need online features to be set up");
    }
    const { url } = await cloud.upload(file, "music", file.name);
    this.setMapDetails({ song: url });
  }

  /** Upload town or battle music (needs an account) */
  async uploadMusic(track: "town" | "battle", file: File) {
    return this.#undoable(async () => {
      if (!cloud.user) {
        throw new Error(cloud.available ? "Log in to upload music" : "Music uploads need online features to be set up");
      }
      const { url } = await cloud.upload(file, "music", file.name);
      this.city.music = { ...this.city.music, [track]: url };
      this.#musicChanged();
    });
  }

  /** Go back to the default music */
  resetMusic(track: "town" | "battle") {
    return this.#undoable(() => {
      const music = { ...this.city.music };
      delete music[track];
      this.city.music = music;
      this.#musicChanged();
    });
  }

  #musicChanged() {
    sound.custom = this.city.music ?? {};
    if (this.mode === "play") {
      sound.stop();
      sound.music("town");
    }
    this.room?.meta({ music: this.city.music });
    this.changed();
    this.notify();
  }

  /** Stored url of an uploaded image: online with an account, inside the city otherwise (size-limited) */
  async #store(file: File, kind: "tileset" | "sprite" | "battle", name: string, limit: number) {
    if (cloud.user) {
      return (await cloud.upload(file, kind, name)).url;
    }
    if (file.size > limit) {
      throw new Error(`Log in to upload images bigger than ${limit / 1024} KB`);
    }
    return await dataURL(file);
  }

  /** Add a custom tileset */
  async addTileset(file: File, name: string, tile: number) {
    return this.#undoable(async () => {
      const url = await this.#store(file, "tileset", name, 512 * 1024);
      const sheet = { id: uid(), name: name.trim() || "Tileset", url, tile, columns: 0, rows: 0 };
      const loaded = await prepare(sheet);
      Object.assign(sheet, { columns: loaded.columns, rows: loaded.rows });
      this.city.tilesets = [...(this.city.tilesets ?? []), sheet];
      await this.rerender();
      this.room?.meta({ tilesets: this.city.tilesets });
      this.changed();
      this.notify();
      return sheet;
    });
  }

  /**
   * Add an interior from a template: one of Emerald's real rooms (with its tilesets, the people who work there,
   * and the floors its stairs lead to), or an empty room
   */
  async newInterior(key: string) {
    const rooms = await loadRooms();
    const room = rooms.find((room) => room.key === key);
    if (!room) {
      return this.editor.newInterior();
    }
    const built = new Map<string, City>();
    const make = async (room: Interior): Promise<City> => {
      const sheets = {
        primary: await this.addEmeraldTileset({ name: sheetName(room.primary), file: room.primary }),
        secondary: await this.addEmeraldTileset({ name: sheetName(room.secondary), file: room.secondary }),
      };
      const map = this.editor.addRoom(room, sheets);
      built.set(room.key, map);
      //Stairs: the other floor is made too, and each floor's stairs lead to the other
      for (const { x, y, to } of room.stairs) {
        const floor = rooms.find((other) => other.key === to);
        if (floor) {
          const other = built.get(floor.key) ?? (await make(floor));
          map.doors.push({ x, y, to: other.id, tx: -1, ty: -1 });
          map.solid[y * map.width + x] = 0;
        }
      }
      return map;
    };
    const map = await make(room);
    this.editor.onmaps?.();
    return map;
  }

  /** Add a tileset of Pokémon Emerald (built from pret/pokeemerald, served with the game); returns its index among the city's tilesets */
  async addEmeraldTileset({ name, file }: { name: string; file: string }) {
    const url = `/game/tilesets/emerald/${file}`;
    const existing = (this.city.tilesets ?? []).findIndex((sheet) => sheet.url === url);
    if (existing >= 0) {
      return existing;
    }
    await this.#undoable(async () => {
      const words = name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      const sheet = { id: uid(), name: `Emerald ${words}`.slice(0, 30), url, tile: 16, columns: 0, rows: 0 };
      const loaded = await prepare(sheet);
      Object.assign(sheet, { columns: loaded.columns, rows: loaded.rows });
      this.city.tilesets = [...(this.city.tilesets ?? []), sheet];
      await this.rerender();
      this.room?.meta({ tilesets: this.city.tilesets });
      this.changed();
      this.notify();
    });
    return this.city.tilesets!.length - 1;
  }

  /** How many tiles are painted with a custom tileset, across every map of the city */
  tilesetUses(index: number) {
    const min = (index + 1) * range,
      max = min + range;
    let count = 0;
    for (const map of [this.city, ...this.city.interiors]) {
      for (const layer of ["ground", "decor", "above"] as const) {
        count += map.layers[layer].filter((value) => value >= min && value < max).length;
      }
    }
    return count;
  }

  /** How many people and Pokémon look like a custom sprite, or show it as their portrait */
  spriteUses(id: string) {
    return [this.city, ...this.city.interiors]
      .flatMap((map) => map.npcs)
      .filter((npc) => npc.sprite === `custom:${id}` || npc.creature?.look === id || npc.portrait === `sprite:custom:${id}`).length;
  }

  /** Remove a custom tileset (tiles painted with it are erased, other tilesets keep their position) */
  async removeTileset(index: number) {
    return this.#undoable(async () => {
      const sheets = this.city.tilesets ?? [];
      sheets[index] = { ...sheets[index], url: "", name: "(removed)" };
      const min = (index + 1) * range,
        max = min + range;
      for (const map of [this.city, ...this.city.interiors]) {
        for (const layer of ["ground", "decor", "above"] as const) {
          map.layers[layer] = map.layers[layer].map((value) => (value >= min && value < max ? 0 : value));
        }
      }
      await this.rerender();
      this.broadcastCity();
      this.notify();
    });
  }

  /** Add a custom sprite for people or Pokémon */
  async addSprite(file: File, image: HTMLImageElement, kind: Sprite["kind"], name: string, layout: keyof typeof layouts) {
    return this.#undoable(async () => {
      const url = await this.#store(file, "sprite", name, 256 * 1024);
      const frame = kind === "person" ? frameOf(image, layout)! : { w: image.width, h: image.height };
      const sprite: Sprite = {
        id: uid(),
        name: name.trim() || (kind === "person" ? "Custom person" : "Custom Pokémon"),
        url,
        kind,
        ...(kind === "person" ? { layout } : {}),
        w: frame.w,
        h: frame.h,
      };
      this.city.sprites = [...(this.city.sprites ?? []), sprite];
      await loadSprites(this.city.sprites);
      this.room?.meta({ sprites: this.city.sprites });
      this.editor.refresh();
      this.changed();
      this.notify();
      return sprite;
    });
  }

  /** Upload a portrait shown beside someone's dialogue (resolves with its url) */
  async uploadPortrait(file: File) {
    if (!imageTypes.includes(file.type)) {
      throw new Error("Pick a PNG, WebP, AVIF or GIF image");
    }
    return await this.#store(file, "sprite", "portrait", 256 * 1024);
  }

  /** Remove a custom sprite (everyone using it gets a default look and portrait) */
  async removeSprite(id: string) {
    return this.#undoable(async () => {
      this.city.sprites = (this.city.sprites ?? []).filter((sprite) => sprite.id !== id);
      for (const map of [this.city, ...this.city.interiors]) {
        for (const npc of map.npcs) {
          if (npc.sprite === `custom:${id}`) {
            npc.sprite = "youngster";
          }
          if (npc.creature?.look === id) {
            delete npc.creature.look;
          }
          if (npc.portrait === `sprite:custom:${id}`) {
            delete npc.portrait;
          }
        }
      }
      await this.rerender();
      this.broadcastCity();
      this.notify();
    });
  }

  //=================================================================================================
  // Trainer

  /**
   * Use an item from the bag on a Pokémon outside battles: potions, cures and revives work at once,
   * a Rare Candy grows a level (it may learn moves and evolve), a stone or the Linking Cord evolves it.
   * Resolves with what the bag says (empty when the screens said it all), or null when it does nothing
   */
  async useOn(id: ItemId, creature: Creature): Promise<string | null> {
    const item = items[id];
    if (!helps(id, creature) || !trainer.count(id)) {
      return null;
    }
    if (item.kind === "candy") {
      const badges = trainer.profile!.badges.filter(({ world }) => world === this.city.id).length;
      if (creature.level >= levelCap(this.city.rules, badges)) {
        return `${named(creature)} can't grow past Lv. ${creature.level} until the next badge.`;
      }
      trainer.take(id);
      const pending = [] as string[];
      const messages = grow(creature, experience(creature.level + 1) - creature.exp, 100, pending);
      this.notify();
      for (const message of messages) {
        await ui.say(message);
      }
      await teachAll(creature, pending, field);
      await evolveIfReady(creature, leveling(this.area.time));
    } else if (item.kind === "evolve") {
      trainer.take(id);
      await evolveIfReady(creature, (item as { trade?: true }).trade ? { trade: true } : { item: id });
    } else {
      trainer.take(id);
      const said = apply(id, creature);
      trainer.save();
      this.notify();
      return said;
    }
    trainer.save();
    this.notify();
    return "";
  }

  /** Use an item from the bag that isn't used on a Pokémon (a Repel, the Exp. Share): resolves with what the bag says */
  useItem(id: ItemId) {
    const profile = trainer.profile!;
    const item = items[id];
    if (id === "exp-share") {
      profile.share = !profile.share;
      trainer.save();
      this.notify();
      return profile.share ? "The Exp. Share was turned on. Pokémon that don't battle get a share of the EXP. Points." : "The Exp. Share was turned off.";
    }
    if (item.kind === "repel") {
      if (!trainer.repel(id)) {
        return "The effect of the previous Repel is still active.";
      }
      this.notify();
      return `${profile.name} used the ${item.name}. Weaker wild Pokémon will stay away.`;
    }
    return item.about;
  }

  /** Escape Rope: out of a cave or building, back to the door of the outdoor map that leads in (false when already outdoors) */
  escape() {
    if (this.mode !== "play" || typeOf(this.area, this.city) === "outdoor" || !trainer.take("escape-rope")) {
      return false;
    }
    //Follow the doors back out, through every room on the way
    const maps = [this.city, ...this.city.interiors];
    let here = this.area;
    for (let hops = 0; hops < maps.length; hops++) {
      const from = maps.find((map) => map.doors.some(({ to }) => to === here.id));
      const door = from?.doors.find(({ to }) => to === here.id);
      if (!from || !door) {
        break;
      }
      if (typeOf(from, this.city) === "outdoor") {
        const y = Math.min(from.height - 1, door.y + 1);
        this.openArea(from === this.city ? "" : from.id, { x: door.x, y, dir: "down" });
        trainer.save();
        return true;
      }
      here = from;
    }
    this.openArea("", { ...this.city.spawn, dir: "down" });
    trainer.save();
    return true;
  }

  /** Give a Pokémon an item from the bag to hold (null takes it back); the item it held goes back in the bag */
  hold(creature: Creature, id: ItemId | null) {
    if (id && !trainer.take(id)) {
      return false;
    }
    if (creature.held) {
      trainer.give(creature.held, 1);
    }
    if (id) {
      creature.held = id;
    } else {
      delete creature.held;
    }
    trainer.save();
    this.notify();
    return true;
  }

  /** Battle a trainer from the editor with a test party: nothing is saved, the real trainer stays as it was */
  async testBattle(npc: Npc, party: Creature[]) {
    const data = npc.trainer;
    if (!data?.team.length || !party.length) {
      return null;
    }
    const real = trainer.profile;
    const stand: Trainer = {
      name: real?.name ?? "You",
      sprite: real?.sprite ?? "may",
      party,
      box: [],
      items: { "poke-ball": 5, potion: 5, "super-potion": 3, "full-heal": 3 },
      money: 0,
      badges: [],
      defeated: [],
      seen: [],
      caught: [],
    };
    const base = { difficulty: this.city.rules?.difficulty, weather: battleWeather(this.area.weather) };
    const outcome = await trainer.sandbox(stand, () =>
      new Battle({
        opponent: { name: npc.name || "Trainer", sprite: npc.sprite, team: teamOf(data.team), lines: data.lines },
        rules: trainerRules(base, data.rules),
      }).start(),
    );
    //Battles end with the town music, which only belongs in Play
    if (this.mode === "edit") {
      sound.stop();
    }
    return outcome;
  }

  /** Change the town's battle rules: how smart trainers are, and the level caps by badges */
  setRules(rules: Rules) {
    this.#undoable(() => {
      const next = { ...this.city.rules, ...rules };
      if (!next.difficulty || next.difficulty === "normal") delete next.difficulty;
      if (!next.caps?.length) delete next.caps;
      if (next.followers !== false) delete next.followers;
      if (Object.keys(next).length) this.city.rules = next;
      else delete this.city.rules;
      this.broadcastCity();
      this.changed();
    });
    this.notify();
  }

  /** How a new game starts: the map new players start in ("" = outside), and what the Professor says first (empty for the usual welcome) */
  setNewGame({ start, speech }: { start?: string; speech?: string }) {
    this.#undoable(() => {
      if (start !== undefined) {
        if (start) this.city.start = start;
        else delete this.city.start;
      }
      if (speech !== undefined) {
        if (speech.trim()) this.city.intro = { ...this.city.intro, speech: speech.slice(0, 2000) };
        else delete this.city.intro;
      }
      this.broadcastCity();
      this.changed();
    });
    this.notify();
  }

  /** Buy items at a Poké Mart (false when there isn't enough money) */
  buy(id: ItemId, count: number) {
    const profile = trainer.profile;
    const cost = items[id].price * count;
    if (!profile || count <= 0 || profile.money < cost) {
      return false;
    }
    profile.money -= cost;
    trainer.give(id, count);
    trainer.save();
    this.notify();
    return true;
  }

  /** Create a trainer (with a first partner, unless the game hands one out) */
  startTrainer(name: string, sprite: string, starter?: number) {
    trainer.start(name.trim() || "Trainer", sprite, starter);
    this.notify();
  }

  /** Give a trainer without Pokémon their first partner */
  givePartner(id: number) {
    trainer.catch(create(id, 5, { shiny: false }));
    trainer.save();
    this.notify();
  }

  /** Reorder or move a Pokémon between the party and the PC box */
  moveCreature(action: "lead" | "box" | "party", index: number) {
    const profile = trainer.profile!;
    const take = (list: Creature[]) => list.splice(index, 1);
    if (action === "lead") {
      profile.party.unshift(...take(profile.party));
    } else if (action === "box") {
      profile.box.push(...take(profile.party));
    } else {
      profile.party.push(...take(profile.box));
    }
    trainer.save();
    this.notify();
  }

  /** Swap two Pokémon of the party (the first one leads) */
  swapCreatures(a: number, b: number) {
    const party = trainer.profile!.party;
    if (party[a] && party[b]) {
      [party[a], party[b]] = [party[b], party[a]];
      trainer.save();
      this.notify();
    }
  }

  /** Erase the trainer, party, badges and story progress */
  async startOver() {
    trainer.profile = null;
    trainer.save();
    await this.setMode(this.visiting ? "play" : "edit");
  }

  /** Forget your own story progress in this city (testing) */
  restartStory() {
    trainer.restart(this.city.id);
    ui.toast("Your story progress in this city was reset", "success");
  }

  //=================================================================================================
  // Links and boot

  /** Open the city a link points to (#visit, #remix, #fork, #open, #room), resolves false when there is none */
  async #route() {
    const [mode, value = ""] = location.hash.slice(1).split("=");
    if (mode === "room") {
      const [id, invite] = value.split(".");
      if (cloud.available && isCloudId(id) && invite) {
        let name = cloud.user?.username ?? storage.get("guest", "");
        if (!name) {
          name = await ui.guestName();
          storage.set("guest", name);
        }
        await this.joinRoom(id, invite, cloud.user?.username ?? (name || "Guest"));
        return true;
      }
      ui.toast("This invite link needs online features to be set up", "error");
    }
    if (mode === "open" && isCloudId(value) && cloud.user) {
      try {
        await this.openOnline(value);
        return true;
      } catch (error) {
        ui.toast(message(error), "error");
      }
    }
    if ((mode === "remix" || mode === "fork") && isCloudId(value) && cloud.user) {
      history.replaceState(null, "", location.pathname);
      await this.open(blank());
      await this.fork(value);
      return true;
    }
    if (mode === "visit" || mode === "remix" || mode === "fork") {
      try {
        const city = isCloudId(value) ? sanitize((await cloud.cities.get(value)).city) : await decode(value);
        if (mode === "visit") {
          await this.open(city, { visiting: true });
          ui.toast(`Welcome to ${city.name}!`, "success");
          if (isCloudId(value)) {
            this.visit = value;
            //Count one play per city per browser session
            if (!sessionStorage.getItem(`played:${value}`)) {
              sessionStorage.setItem(`played:${value}`, "1");
              void cloud.cities.play(value);
            }
          }
        } else {
          city.id = uid();
          city.name = `${city.name} (remix)`;
          await this.open(city);
          ui.toast(`Remixing ${city.name}`, "success");
        }
        return true;
      } catch (error) {
        ui.toast(`This city link looks broken (${message(error)})`, "error");
      }
    }
    return false;
  }

  /** Load assets, sign in, and open the city of the link or the last one (only once per page) */
  boot(viewport: HTMLElement, progress: (text: string) => void) {
    if (this.map) {
      //Mounted again (navigating back to the editor): move the map into the new viewport
      this.map.attach(viewport);
    }
    this.#booting ??= this.#boot(viewport, progress);
    return this.#booting;
  }

  async #boot(viewport: HTMLElement, progress: (text: string) => void) {
    await Promise.all([loadAssets(progress), cloud.init()]);
    const returning = Boolean(cloud.user) && storage.get("signin-pending", false);
    storage.set("signin-pending", false);
    if (cloud.user && !returning) {
      await this.synchronize();
    }
    trainer.onsave = (profile) => {
      if (cloud.user) {
        clearTimeout(this.#trainerTimeout);
        this.#trainerTimeout = setTimeout(() => cloud.trainer.put(profile).catch(() => null), 1000) as unknown as number;
      }
    };
    cloud.listeners.add(() => this.notify());
    this.map = new CityMap(viewport);
    this.editor = new EditorEngine({ map: this.map, city: blank(), onchange: this.changed });
    this.editor.onmap = (id) => this.openArea(id);
    this.editor.onmaps = () => (this.room?.meta({ interiors: this.city.interiors }), this.changed(), this.editor.refresh(), this.notify());
    this.editor.onrestart = () => this.restartStory();
    this.editor.onplay = (tile) => void this.playFrom(tile);
    this.editor.onrestore = (town) => void this.#restore(town);
    this.map.oncontext = (tile, screen) => {
      if (this.mode !== "edit" || !this.map.inside(tile)) {
        return;
      }
      this.menu = { tile, left: screen.x, top: screen.y };
      this.notify();
    };
    if (!(await this.#route())) {
      const last = library.list().find(({ id }) => id === storage.get("last", "")) ?? library.list()[0];
      if (last && isCloudId(last.id) && cloud.user) {
        try {
          await this.openOnline(last.id);
        } catch {
          await this.open(sanitize(last), { online: { id: last.id, mine: true } });
        }
      } else {
        await this.open(last ? sanitize(last) : template(blank({ name: "My Town" })));
        if (!last) {
          await this.#furnish();
        }
      }
    }
    this.ready = true;
    this.notify();
    if (returning) {
      await this.signedIn();
    }
  }
}

/** Download a file */
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Image formats accepted for tilesets, sprites and portraits (all keep transparency) */
export const imageTypes = ["image/png", "image/webp", "image/avif", "image/gif"];

/** The editor session of this page */
export const session = new Session();

//Debug handle while developing locally
if (typeof location !== "undefined" && location.hostname === "localhost") {
  Object.assign(globalThis, { dreammist: session });
}
