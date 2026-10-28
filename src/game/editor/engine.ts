//Imports
import * as PIXI from "pixi.js";
import { assets, columns, creatureSprite, npc as texture, size, sprite } from "../assets";
import { brushes, piece, type Terrain, terrainOf, terrains } from "../brushes";
import { type City, interior, type Layer, layers, type Npc, type NpcStory, type Step, storage, uid } from "../data";
import type { CityMap } from "../map";
import { scaleOf } from "../sprites";
import { custom as sheets, decode, encode } from "../tilesets";
import { ui } from "../ui-bridge";
import { type Clip, convert, type Grid, grids, type Kind, kindOf, obstacles, placing, type Stamp, type Target, type Template, type Tool, targets, tools, zoneColors } from "./constants";

/** Single cell change */
type Change = { grid: Grid; index: number; before: number; after: number };

/** History entry: cell changes, or a snapshot of people, spawn, zones, story and doors */
type Entry = { changes: Change[] } | { snapshot: { before: string; after: string } };

/** Grids that can be hidden in the editor (people, spawn and doors are always shown) */
const hideable = ["ground", "decor", "above", "solid", "zone", "story"] as readonly string[];

/**
 * City editor engine.
 * Owns everything about editing a map (tools, painting, selection, people, story, doors, history)
 * and draws its overlays on the map. The interface reads its state and calls its methods,
 * and subscribes to be told when something changed.
 */
export class EditorEngine {
  readonly #map: CityMap;
  readonly #listeners = new Set<() => void>();
  #version = 0;
  #city: City;
  #world: City;
  #tool: Tool = "brush";
  #target: Target = "ground";
  #stamp: Stamp = { w: 1, h: 1, tiles: [0] };
  #zone = 1;
  #auto = storage.get("auto-solid", true);
  #random = false;
  #selected = -1;
  #step = 0;
  #door = -1;
  #adding = "person" as Kind;
  #pathing = -1;
  #blocking = "";
  #undo = [] as Entry[];
  #redo = [] as Entry[];
  #stroke = null as null | { changes: Map<string, Change>; start: { x: number; y: number }; last: { x: number; y: number } };
  #snapshot = "";
  #dragging = -1;
  #recent = storage.get<Stamp[]>("recent", []);
  #sheet = -1;
  #paletteScale = storage.get("palette-scale", 2);
  #hidden = new Set<string>(storage.get<string[]>("hidden-layers", []));
  #locked = new Set<string>(storage.get<string[]>("locked-layers", []));
  #area = null as null | { x: number; y: number; w: number; h: number };
  #from = null as null | { x: number; y: number };
  #clip = null as null | Clip;
  #pasting = false;
  #pending = 0;
  readonly #ghost = new PIXI.Container();
  readonly #markers = new PIXI.Container();
  readonly #marquee = new PIXI.Graphics();
  readonly #route = new PIXI.Graphics();
  readonly #onchange: () => void;

  /** Switch edited map ("" = outside) */
  onmap = null as null | ((id: string) => void);
  /** Interiors list changed (added, removed, renamed) */
  onmaps = null as null | (() => void);
  /** Restart story progress of the current player in this city */
  onrestart = null as null | (() => void);
  /** Live room hooks */
  onedit = null as null | ((changes: [string, number, number][]) => void);
  onmeta = null as null | ((patch: Partial<City>) => void);
  oncursor = null as null | ((x: number, y: number) => void);

  /** Play from a tile (P key: the hovered tile, or the spawn when the pointer is off the map) */
  onplay = null as null | ((tile: null | { x: number; y: number }) => void);

  /** Tile under the pointer */
  #hovered = null as null | { x: number; y: number };

  constructor({ map, city, onchange }: { map: CityMap; city: City; onchange: () => void }) {
    this.#map = map;
    this.#city = this.#world = city;
    this.#onchange = onchange;
    this.#ghost.alpha = 0.65;
    if (brushes[0]) {
      this.#stamp = { ...brushes[0], tiles: [...brushes[0].tiles] };
    }
  }

  //=================================================================================================
  // State for the interface

  /** Be told when the editor state changes (returns an unsubscribe function) */
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Changes every time the state changes */
  get version() {
    return this.#version;
  }

  /** Tell subscribers the state changed */
  #notify() {
    this.#version++;
    this.#listeners.forEach((listener) => listener());
  }

  get city() {
    return this.#city;
  }
  get world() {
    return this.#world;
  }
  /** Current map id ("" = outside) */
  get mapId() {
    return this.#city === this.#world ? "" : this.#city.id;
  }
  get tool() {
    return this.#tool;
  }
  get target() {
    return this.#target;
  }
  get stamp() {
    return this.#stamp;
  }
  get zone() {
    return this.#zone;
  }
  get auto() {
    return this.#auto;
  }
  get random() {
    return this.#random;
  }
  get selected() {
    return this.#selected;
  }
  get step() {
    return this.#step;
  }
  get door() {
    return this.#door;
  }
  get adding() {
    return this.#adding;
  }
  get pathing() {
    return this.#pathing;
  }
  get blocking() {
    return this.#blocking;
  }
  get area() {
    return this.#area;
  }
  get clip() {
    return this.#clip;
  }
  get pasting() {
    return this.#pasting;
  }
  get recent() {
    return this.#recent;
  }
  get sheet() {
    return (this.#sheet >= 0) && (!sheets.has(this.#sheet)) ? -1 : this.#sheet;
  }
  get paletteScale() {
    return this.#paletteScale;
  }
  get canUndo() {
    return this.#undo.length > 0;
  }
  get canRedo() {
    return this.#redo.length > 0;
  }
  get grid() {
    return this.#map.overlays.grid.visible;
  }
  isHidden(key: string) {
    return this.#hidden.has(key);
  }
  isLocked(key: string) {
    return this.#locked.has(key);
  }
  /** Can a layer be hidden (people, spawn and doors are always shown) */
  canHide(key: string) {
    return hideable.includes(key);
  }

  //=================================================================================================
  // Lifecycle

  /** Activate the editor on a map */
  start(city: City, world = city) {
    this.#city = city;
    this.#world = world;
    this.#map.containers.overlay.addChild(this.#ghost);
    this.#map.containers.overlay.addChild(this.#marquee);
    this.#map.containers.actors.addChild(this.#markers);
    this.#map.onpointer = (type, tile) => this.#pointer(type, tile);
    this.#map.onleave = () => (this.#hovered = null, this.#coordsListeners.forEach((listener) => listener(null)));
    this.#map.overlays.grid.visible = storage.get("grid", true);
    document.addEventListener("keydown", this.#keys);
    this.#markersRefresh();
    this.#overlaysRefresh();
    this.#notify();
  }

  /** Deactivate the editor (play mode) */
  stop() {
    this.#map.onpointer = null;
    this.#map.onleave = null;
    this.#hovered = null;
    this.#ghost.parent?.removeChild(this.#ghost);
    this.#marquee.parent?.removeChild(this.#marquee);
    this.#markers.parent?.removeChild(this.#markers);
    this.#route.parent?.removeChild(this.#route);
    this.#pathing = -1;
    this.#blocking = "";
    this.#map.overlays.cursor.clear();
    this.#map.overlays.solid.visible = false;
    this.#map.overlays.zone.visible = false;
    this.#map.overlays.gate.visible = false;
    this.#map.overlays.grid.visible = false;
    for (const layer of layers) {
      this.#map.containers[layer].alpha = 1;
      this.#map.containers[layer].visible = true;
    }
    document.removeEventListener("keydown", this.#keys);
    this.#notify();
  }

  /** Forget history (after loading or resizing a city) */
  reset(city = this.#city, world = this.#world ?? city) {
    this.#city = city;
    this.#world = world;
    this.#door = -1;
    this.#undo.length = this.#redo.length = 0;
    this.#selected = -1;
    if (this.#map.onpointer) {
      this.#markersRefresh();
    }
    this.#notify();
  }

  /** Refresh people, zones and panels after an external change (live room, settings) */
  refresh() {
    if (this.#selected >= this.#city.npcs.length) {
      this.#selected = -1;
    }
    this.#markersRefresh();
    this.#map.drawZones();
    this.#map.drawSolid();
    this.#map.drawGates();
    this.#notify();
  }

  /** Apply edits made by someone else in a live room */
  remote(changes: [string, number, number][]) {
    for (const [grid, index, value] of changes) {
      if ((index >= 0) && (index < this.#city.width * this.#city.height) && ((grids as readonly string[]).includes(grid))) {
        this.#apply(grid as Grid, index, value, false);
      }
    }
  }

  //=================================================================================================
  // Tools, targets and brushes

  /** Choose a tool */
  setTool(tool: Tool) {
    this.#tool = tool;
    this.#pasting = false;
    this.#ghostRefresh();
    this.#notify();
  }

  /** Choose what to edit */
  select(target: Target) {
    if ((this.#blocking) && (target !== "story")) {
      this.#blocking = "";
    }
    if (this.#pathing >= 0) {
      this.#pathing = -1;
    }
    this.#target = target;
    this.#selected = -1;
    this.#door = -1;
    if ((placing.includes(target)) && (this.#tool !== "brush")) {
      this.#tool = "brush";
    }
    //The brush preview shows again when the pointer moves over the map
    this.#ghost.visible = false;
    this.#map.overlays.cursor.clear();
    this.#ghostRefresh();
    this.#overlaysRefresh();
    this.#markersRefresh();
    this.#notify();
  }

  /** Paint with a stamp */
  use(stamp: Stamp) {
    this.#stamp = { ...stamp, tiles: [...stamp.tiles] };
    if ((stamp.layer) && (stamp.layer !== this.#target)) {
      this.#target = stamp.layer;
      this.#overlaysRefresh();
    }
    if ((this.#tool !== "rect") && (this.#tool !== "fill")) {
      this.#tool = "brush";
    }
    const id = JSON.stringify(stamp);
    this.#recent = [stamp, ...this.#recent.filter((other) => JSON.stringify(other) !== id)].slice(0, 16);
    storage.set("recent", this.#recent);
    this.#ghostRefresh();
    this.#notify();
  }

  /** Random mode: each painted cell gets a random tile of the brush */
  setRandom(random: boolean) {
    this.#random = random;
    this.#ghostRefresh();
    this.#notify();
  }

  /** Objects block movement automatically */
  setAuto(auto: boolean) {
    this.#auto = auto;
    storage.set("auto-solid", auto);
    this.#notify();
  }

  /** Hide or show a layer (editor only, visitors always see everything) */
  toggleHidden(key: string) {
    this.#toggle(this.#hidden, key, "hidden-layers");
  }

  /** Lock or unlock a layer against painting */
  toggleLocked(key: string) {
    this.#toggle(this.#locked, key, "locked-layers");
  }

  #toggle(set: Set<string>, key: string, name: string) {
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    storage.set(name, [...set]);
    this.#overlaysRefresh();
    this.#notify();
  }

  /** Show or hide the tile grid */
  toggleGrid() {
    this.#map.overlays.grid.visible = !this.#map.overlays.grid.visible;
    storage.set("grid", this.#map.overlays.grid.visible);
    this.#notify();
  }

  /** Tileset shown in the palette (-1 = built-in Hoenn tileset) */
  setSheet(sheet: number) {
    this.#sheet = sheet;
    this.#notify();
  }

  /** Palette zoom */
  setPaletteScale(scale: number) {
    this.#paletteScale = scale;
    storage.set("palette-scale", scale);
    this.#notify();
  }

  /** Palette source of a tileset (-1 = built-in): image, columns, unused frames and tile value of a frame */
  source(index: number) {
    if (index < 0) {
      return { canvas: assets.palette, columns, empty: assets.empty, value: (frame: number) => frame + 1 };
    }
    const sheet = sheets.get(index);
    return sheet ? { canvas: sheet.palette, columns: sheet.columns, empty: sheet.empty, value: (frame: number) => encode(index, frame) } : null;
  }

  /** Custom tilesets loaded for the palette tabs */
  sheets() {
    return [...sheets.entries()].map(([index, sheet]) => ({ index, name: sheet.name }));
  }

  /** Draw a stamp into a canvas (thumbnails) */
  stampCanvas(stamp: Stamp, scale = 2) {
    const canvas = document.createElement("canvas");
    canvas.width = stamp.w * size * scale;
    canvas.height = stamp.h * size * scale;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    stamp.tiles.forEach((value, i) => {
      const source = value ? this.source(decode(value).index) : null;
      if (source) {
        const { frame } = decode(value);
        context.drawImage(source.canvas, (frame % source.columns) * size, Math.floor(frame / source.columns) * size, size, size, (i % stamp.w) * size * scale, Math.floor(i / stamp.w) * size * scale, size * scale, size * scale);
      }
    });
    return canvas;
  }

  //=================================================================================================
  // Painting

  /** Grid painted on a gameplay target */
  get #gridOf(): Grid {
    return this.#target === "zone" ? "zone" : this.#target === "story" ? "gate" : "solid";
  }

  /** Tile layer being edited (null on gameplay targets) */
  get layer() {
    return (layers as readonly string[]).includes(this.#target) ? this.#target as Layer : null;
  }

  /** Values of a grid */
  #grid(grid: Grid) {
    return grid === "solid" ? this.#city.solid : grid === "zone" ? this.#city.zone : grid === "gate" ? this.#city.gate : this.#city.layers[grid];
  }

  /** Apply a cell change within the current stroke */
  #set(grid: Grid, x: number, y: number, value: number) {
    if (!this.#map.inside({ x, y })) {
      return;
    }
    const index = y * this.#city.width + x;
    const values = this.#grid(grid);
    if (values[index] === value) {
      return;
    }
    const id = `${grid}:${index}`;
    const change = this.#stroke!.changes.get(id) ?? { grid, index, before: values[index], after: value };
    change.after = value;
    this.#stroke!.changes.set(id, change);
    this.#apply(grid, index, value);
  }

  /** Write a value and refresh the display */
  #apply(grid: Grid, index: number, value: number, emit = true) {
    if (emit) {
      this.onedit?.([[grid, index, value]]);
    }
    if ((grid === "solid") || (grid === "zone") || (grid === "gate")) {
      this.#grid(grid)[index] = value;
      this.#redrawOverlays();
    } else {
      this.#map.set(grid, index, value);
    }
  }

  /** Redraw gameplay overlays on the next frame */
  #redrawOverlays() {
    if (!this.#pending) {
      this.#pending = requestAnimationFrame(() => {
        this.#pending = 0;
        this.#map.drawSolid();
        this.#map.drawZones();
        this.#map.drawGates();
        this.#map.drawBlockers();
      });
    }
  }

  /** Value painted by the current tool on a gameplay target */
  #value() {
    if (this.#tool === "erase") {
      return 0;
    }
    return this.#target === "zone" ? this.#zone : this.#target === "story" ? this.#step : 1;
  }

  /** Paint the stamp at a position (pattern origin used for rectangle and fill tiling) */
  #paint(x: number, y: number, origin = { x, y }) {
    const layer = this.layer;
    if (!layer) {
      return this.#set(this.#gridOf, x, y, this.#value());
    }
    if (!this.#map.inside({ x, y })) {
      return;
    }
    if (this.#tool === "erase") {
      this.#set(layer, x, y, 0);
      this.#collide(layer, x, y);
      this.#retile(layer, x, y);
      return;
    }
    //Terrain brush: paint the terrain, then pick borders for the cell and its neighbours
    const terrain = this.#stamp.terrain ? terrains.find(({ id }) => id === this.#stamp.terrain) : null;
    if (terrain) {
      if (terrainOf(this.#city.layers[layer][y * this.#city.width + x]) !== terrain) {
        this.#set(layer, x, y, terrain.tiles[4]);
        this.#collide(layer, x, y);
      }
      this.#retile(layer, x, y);
      return;
    }
    const { w, h, tiles } = this.#stamp;
    const i = ((x - origin.x) % w + w) % w, j = ((y - origin.y) % h + h) % h;
    const pool = this.#random ? tiles.filter(Boolean) : [];
    const value = pool.length ? pool[Math.floor(Math.random() * pool.length)] : tiles[j * w + i];
    if (value) {
      const index = y * this.#city.width + x;
      const previous = this.#city.layers[layer][index];
      this.#set(layer, x, y, value);
      this.#collide(layer, x, y);
      //Tall grass brings wild encounters along (and removing it removes them)
      if ((this.#auto) && (layer === "ground")) {
        if (this.#stamp.zone) {
          this.#set("zone", x, y, this.#grassZone());
        } else if (brushes.some(({ zone, tiles }) => zone && tiles[0] === previous)) {
          this.#set("zone", x, y, 0);
        }
      }
    }
  }

  /** Recompute collision of a cell after a tile change (when automatic collision is on) */
  #collide(layer: Layer, x: number, y: number) {
    if ((!this.#auto) || (layer === "above")) {
      return;
    }
    const index = y * this.#city.width + x;
    const ground = this.#city.layers.ground[index] - 1, decor = this.#city.layers.decor[index] - 1;
    let solid = (ground >= 0) && (assets.water.has(ground)) ? 1 : 0;
    if (decor >= 0) {
      const forced = (layer === "decor") && (this.#stamp.solid) && (this.#tool !== "erase") ? this.#stamp.solid : null;
      solid = forced === "all" ? 1 : forced === "none" ? solid : assets.walkable.has(decor) ? solid : 1;
    } else if ((layer === "ground") && (this.#stamp.solid === "all") && (this.#tool !== "erase")) {
      solid = 1;
    }
    this.#set("solid", x, y, solid);
  }

  /** Zone used by tall grass (created when missing) */
  #grassZone() {
    let index = this.#city.zones.findIndex(({ name }) => /grass/i.test(name));
    if (index < 0) {
      this.#city.zones.push({ name: "Tall grass", rate: 0.12, color: 0x2ecc40, creatures: [{ species: 263, min: 2, max: 4 }, { species: 265, min: 2, max: 4 }] });
      index = this.#city.zones.length - 1;
      this.#emitMeta();
    }
    return index + 1;
  }

  /** Re-pick terrain borders around a cell */
  #retile(layer: Layer, x: number, y: number) {
    const values = this.#city.layers[layer];
    const of = (x: number, y: number) => this.#map.inside({ x, y }) ? terrainOf(values[y * this.#city.width + x]) : undefined;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const [cx, cy] = [x + i, y + j];
        const terrain = of(cx, cy);
        if (!terrain) {
          continue;
        }
        //Map borders count as the same terrain so patches can touch the edge
        const same = (x: number, y: number) => [terrain, undefined].includes(of(x, y) as Terrain | undefined);
        const value = piece(terrain, { n: same(cx, cy - 1), s: same(cx, cy + 1), w: same(cx - 1, cy), e: same(cx + 1, cy) });
        if (value !== values[cy * this.#city.width + cx]) {
          this.#set(layer, cx, cy, value);
        }
      }
    }
  }

  /** Stamp the whole brush at a position */
  #brush(x: number, y: number) {
    if ((this.#tool === "erase") || (!this.layer) || (this.#random) || (this.#stamp.terrain)) {
      return this.#paint(x, y);
    }
    const { w, h } = this.#stamp;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        this.#paint(x + i, y + j, { x, y });
      }
    }
  }

  /** Flood fill */
  #fill(x: number, y: number) {
    if (!this.#map.inside({ x, y })) {
      return;
    }
    const values = this.#grid(this.layer ?? this.#gridOf);
    const { width, height } = this.#city;
    const from = values[y * width + x];
    const seen = new Uint8Array(width * height);
    const queue = [[x, y]];
    const cells = [] as [number, number][];
    while (queue.length) {
      const [cx, cy] = queue.pop()!;
      const index = cy * width + cx;
      if ((cx < 0) || (cy < 0) || (cx >= width) || (cy >= height) || (seen[index]) || (values[index] !== from)) {
        continue;
      }
      seen[index] = 1;
      cells.push([cx, cy]);
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    for (const [cx, cy] of cells) {
      this.#paint(cx, cy, { x, y });
    }
  }

  /** Group several cell changes into one undo step */
  #batch(fn: () => void) {
    this.#stroke = { changes: new Map(), start: { x: 0, y: 0 }, last: { x: 0, y: 0 } };
    fn();
    const changes = [...this.#stroke.changes.values()];
    this.#stroke = null;
    if (changes.length) {
      this.#push({ changes });
    }
  }

  //=================================================================================================
  // Pointer and keyboard

  /** Pointer events on the map */
  #pointer(type: "down" | "move" | "up", tile: { x: number; y: number }) {
    const { x, y } = tile;
    const inside = this.#map.inside(tile);
    this.#hovered = inside ? { x, y } : null;
    this.oncursor?.(x, y);
    this.#coordsListeners.forEach((listener) => listener(inside ? tile : null));

    if (this.#tool === "select") {
      return this.#selecting(type, tile);
    }
    if ((type === "move") || (type === "down")) {
      const stamped = (this.layer) && (this.#tool === "brush") && (!this.#random) && (!this.#stamp.terrain);
      if ((this.#stroke) && (this.#tool === "rect")) {
        const { start } = this.#stroke;
        this.#map.cursor(Math.min(start.x, x), Math.min(start.y, y), Math.abs(x - start.x) + 1, Math.abs(y - start.y) + 1, 0x7fdbff);
      } else {
        this.#map.cursor(x, y, stamped ? this.#stamp.w : 1, stamped ? this.#stamp.h : 1, this.#tool === "erase" ? 0xff4136 : 0xffdc00);
      }
      this.#ghost.visible = Boolean(stamped) && inside;
      this.#ghost.position.set(x * size, y * size);
    }

    //Path drawing, people, doors and spawn
    if ((this.#target === "npc") && (this.#pathing >= 0)) {
      return this.#placePath(type, tile);
    }
    if (placing.includes(this.#target)) {
      return this.#placing(type, tile);
    }
    if ((this.#target === "story") && (this.#blocking)) {
      return this.#placeBlocker(type, tile);
    }

    if (type === "down") {
      if (this.#tool === "pick") {
        return this.#pick(tile);
      }
      if (this.#locked.has(this.#target)) {
        ui.toast(`${targets.find(({ key }) => key === this.#target)!.label} layer is locked`, "error");
        return;
      }
      if ((this.#target === "story") && (!this.#step) && (this.#tool !== "erase")) {
        ui.toast("Add a story step first, then paint its gates", "error");
        return;
      }
      this.#stroke = { changes: new Map(), start: tile, last: tile };
      if (this.#tool === "fill") {
        this.#fill(x, y);
      } else if (this.#tool !== "rect") {
        this.#brush(x, y);
      }
    } else if ((type === "move") && (this.#stroke) && ((this.#tool === "brush") || (this.#tool === "erase"))) {
      //Interpolate between the last and current position
      const { last } = this.#stroke;
      const steps = Math.max(Math.abs(x - last.x), Math.abs(y - last.y));
      for (let s = 1; s <= steps; s++) {
        const px = Math.round(last.x + (x - last.x) * s / steps), py = Math.round(last.y + (y - last.y) * s / steps);
        //Large stamps only paint on stamp-aligned positions to avoid smearing
        if ((this.layer) && (this.#tool === "brush") && ((this.#stamp.w > 1) || (this.#stamp.h > 1))) {
          const { start } = this.#stroke;
          if (((px - start.x) % this.#stamp.w) || ((py - start.y) % this.#stamp.h)) {
            continue;
          }
        }
        this.#brush(px, py);
      }
      this.#stroke.last = tile;
    } else if ((type === "up") && (this.#stroke)) {
      if (this.#tool === "rect") {
        const { start } = this.#stroke;
        for (let j = Math.min(start.y, y); j <= Math.max(start.y, y); j++) {
          for (let i = Math.min(start.x, x); i <= Math.max(start.x, x); i++) {
            this.#paint(i, j, { x: Math.min(start.x, x), y: Math.min(start.y, y) });
          }
        }
      }
      const changes = [...this.#stroke.changes.values()];
      this.#stroke = null;
      if (changes.length) {
        this.#push({ changes });
      }
    }
  }

  /** Hovered tile listeners (status bar), kept apart from state changes as they fire on every move */
  readonly #coordsListeners = new Set<(tile: null | { x: number; y: number }) => void>();
  oncoords(listener: (tile: null | { x: number; y: number }) => void) {
    this.#coordsListeners.add(listener);
    return () => void this.#coordsListeners.delete(listener);
  }

  /** Keyboard shortcuts */
  #keys = (event: KeyboardEvent) => {
    if (((event.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) || (document.querySelector("[role=dialog], [role=alertdialog]"))) {
      return;
    }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === "z")) {
      event.preventDefault();
      return event.shiftKey ? this.redo() : this.undo();
    }
    if ((event.ctrlKey || event.metaKey) && (key === "y")) {
      event.preventDefault();
      return this.redo();
    }
    if ((event.ctrlKey || event.metaKey) && (["c", "x", "v"].includes(key))) {
      event.preventDefault();
      return key === "c" ? this.copy() : key === "x" ? this.cut() : this.paste();
    }
    if (key === "escape") {
      if (this.#blocking) {
        return this.stopBlocking();
      }
      if (this.#pathing >= 0) {
        return this.stopPath();
      }
      this.#pasting = false;
      this.#area = null;
      this.#drawMarquee();
      this.#ghostRefresh();
      return this.#notify();
    }
    if (((key === "delete") || (key === "backspace")) && (this.#area) && (this.#tool === "select")) {
      return this.clear();
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const tool = tools.find(({ shortcut }) => shortcut.toLowerCase() === key);
    if (tool) {
      return this.setTool(tool.key);
    }
    if ((Number(key) >= 1) && (Number(key) <= targets.length)) {
      return this.select(targets[Number(key) - 1].key);
    }
    if (key === "g") {
      this.toggleGrid();
    }
    if (key === "p") {
      event.preventDefault();
      return this.onplay?.(this.#hovered);
    }
    if (((key === "delete") || (key === "backspace")) && (this.#selected >= 0)) {
      this.deleteNpc();
    }
  };

  /** Use the tile under the cursor as the brush */
  #pick({ x, y }: { x: number; y: number }) {
    if (!this.#map.inside({ x, y })) {
      return;
    }
    const index = y * this.#city.width + x;
    const layer = this.layer ?? ([...layers].reverse().find((layer) => this.#city.layers[layer][index]) || "ground");
    const value = this.#city.layers[layer][index];
    if (value) {
      this.#stamp = { w: 1, h: 1, tiles: [value] };
      this.#tool = "brush";
      if (!this.layer) {
        this.#target = layer;
      }
      this.#overlaysRefresh();
      this.#ghostRefresh();
      this.#notify();
    }
  }

  //=================================================================================================
  // Selection, clipboard

  /** Select tool: drag to select an area, or click to paste in paste mode */
  #selecting(type: "down" | "move" | "up", tile: { x: number; y: number }) {
    const { x, y } = tile;
    if ((this.#pasting) && (this.#clip)) {
      this.#map.cursor(x, y, this.#clip.w, this.#clip.h, 0xf2bf4b);
      this.#ghost.visible = this.#map.inside(tile);
      this.#ghost.position.set(x * size, y * size);
      if (type === "down") {
        this.#place(x, y);
      }
      return;
    }
    this.#ghost.visible = false;
    this.#map.cursor(x, y, 1, 1, 0xf2bf4b);
    const clamp = ({ x, y }: { x: number; y: number }) => ({ x: Math.max(0, Math.min(this.#city.width - 1, x)), y: Math.max(0, Math.min(this.#city.height - 1, y)) });
    if (type === "down") {
      this.#from = clamp(tile);
    }
    if (this.#from) {
      const to = clamp(tile);
      this.#area = { x: Math.min(this.#from.x, to.x), y: Math.min(this.#from.y, to.y), w: Math.abs(to.x - this.#from.x) + 1, h: Math.abs(to.y - this.#from.y) + 1 };
      this.#drawMarquee();
    }
    if ((type === "up") && (this.#from)) {
      this.#from = null;
      this.#notify();
    }
  }

  /** Draw the selected area */
  #drawMarquee() {
    this.#marquee.clear();
    if (this.#area) {
      const { x, y, w, h } = this.#area;
      this.#marquee.beginFill(0xf2bf4b, 0.12).lineStyle({ width: 1, color: 0xf2bf4b, alpha: 1, native: true }).drawRect(x * size, y * size, w * size, h * size).endFill();
    }
  }

  /** Copy every layer of the selected area */
  copy() {
    if (!this.#area) {
      return ui.toast("Select an area first (S)", "error");
    }
    const { x, y, w, h } = this.#area;
    const clip = { w, h, grids: {} } as Clip;
    for (const grid of grids) {
      const values = this.#grid(grid);
      clip.grids[grid] = [];
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          clip.grids[grid].push(values[(y + j) * this.#city.width + x + i]);
        }
      }
    }
    this.#clip = clip;
    ui.toast(`Copied ${w}×${h} tiles`, "success");
    this.#notify();
  }

  /** Erase every layer of the selected area */
  clear() {
    if (!this.#area) {
      return;
    }
    const { x, y, w, h } = this.#area;
    this.#batch(() => {
      for (const grid of grids) {
        if (this.#locked.has(grid)) {
          continue;
        }
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            this.#set(grid, x + i, y + j, 0);
          }
        }
      }
    });
  }

  /** Cut the selected area */
  cut() {
    if (this.#area) {
      this.copy();
      this.clear();
    }
  }

  /** Enter paste mode (click on the map to place the clipboard) */
  paste() {
    if (!this.#clip) {
      return ui.toast("Nothing copied yet: select an area and press Ctrl+C", "error");
    }
    this.#tool = "select";
    this.#pasting = true;
    this.#area = null;
    this.#drawMarquee();
    this.#ghostRefresh();
    this.#notify();
  }

  /** Place the clipboard at a position */
  #place(x: number, y: number) {
    const clip = this.#clip!;
    this.#batch(() => {
      for (const grid of grids) {
        if (this.#locked.has(grid)) {
          continue;
        }
        clip.grids[grid].forEach((value, i) => {
          //Empty tiles are transparent, collision and encounters are copied as is
          if ((value) || (grid === "solid") || (grid === "zone")) {
            this.#set(grid, x + i % clip.w, y + Math.floor(i / clip.w), value);
          }
        });
      }
    });
  }

  /** Turn the selected area of the current layer into a brush */
  capture() {
    if (!this.#area) {
      return;
    }
    const { x, y, w, h } = this.#area;
    const index = (i: number, j: number) => (y + j) * this.#city.width + x + i;
    const layer = this.layer ?? ([...layers].reverse().find((layer) => this.#city.layers[layer].some((_, k) => {
      const i = k % this.#city.width - x, j = Math.floor(k / this.#city.width) - y;
      return (i >= 0) && (j >= 0) && (i < w) && (j < h) && (this.#city.layers[layer][k]);
    })) ?? "ground");
    const tiles = [];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        tiles.push(this.#city.layers[layer][index(i, j)]);
      }
    }
    if (!tiles.some(Boolean)) {
      return ui.toast("This area is empty on that layer", "error");
    }
    this.#area = null;
    this.#drawMarquee();
    this.#target = layer;
    this.#tool = "brush";
    this.use({ w, h, tiles, name: `Captured ${w}×${h}`, layer });
  }

  //=================================================================================================
  // Maps (outside and interiors)

  /** Create an interior from a template (with an exit door leading outside) */
  newInterior(template: Template) {
    const floors = { house: "tiles", center: "stone", gym: "brick", empty: "stone" } as const;
    const floor = terrains.find(({ id }) => id === floors[template])!.tiles[4];
    const names = { house: "House", center: "Pokémon Center", gym: "Gym", empty: "Room" };
    const count = this.#world.interiors.filter(({ name }) => name.startsWith(names[template])).length;
    const map = interior(this.#world, { name: count ? `${names[template]} ${count + 1}` : names[template], width: 14, height: 10, floor });
    const mid = Math.floor(map.width / 2);
    map.doors.push({ x: mid, y: map.height - 1, to: "", tx: -1, ty: -1 });
    map.solid[(map.height - 1) * map.width + mid] = 0;
    map.layers.ground[(map.height - 1) * map.width + mid] = floor;
    const person = (npc: Partial<Npc>) => map.npcs.push({ x: mid, y: 3, sprite: "generic_f1", dir: "down", name: "", dialogue: "", role: "talk", wander: false, ...npc } as Npc);
    if (template === "center") {
      person({ sprite: "shopkeeper_f", name: "Nurse", dialogue: "Welcome to the Pokémon Center!", role: "healer" });
    } else if (template === "gym") {
      person({ sprite: "roxanne", name: "Gym Leader", dialogue: "Welcome, challenger! Show me what you've got!", role: "trainer", trainer: { team: [{ species: 74, level: 12 }, { species: 299, level: 15 }], gym: true, badge: "", defeat: "You've earned this badge!" } });
    } else if (template === "house") {
      person({ sprite: "mom", name: "Mom", dialogue: "Make yourself at home!", wander: true });
    }
    this.onmaps?.();
    this.#notify();
    return map;
  }

  /** Delete an interior and the doors leading to it */
  removeInterior(id: string) {
    const world = this.#world;
    world.interiors = world.interiors.filter((map) => map.id !== id);
    for (const map of [world, ...world.interiors]) {
      map.doors = map.doors.filter((door) => door.to !== id);
    }
    this.onmaps?.();
    if (this.mapId === id) {
      this.onmap?.("");
    } else {
      this.#markersRefresh();
      this.#notify();
    }
  }

  /** Rename the open interior */
  renameInterior(name: string) {
    if (this.mapId) {
      this.#city.name = name.trim().slice(0, 30) || "Interior";
      this.onmaps?.();
      this.#notify();
    }
  }

  /** Display name of a map id */
  mapName(id: string) {
    return id === "?" ? "nowhere yet" : id ? this.#world.interiors.find((map) => map.id === id)?.name ?? "missing map" : "Outside";
  }

  //=================================================================================================
  // Encounter zones

  /** Choose the zone painted on the map (1-based) */
  setZone(zone: number) {
    this.#zone = zone;
    this.#notify();
  }

  /** Add an encounter zone */
  addZone() {
    const zones = this.#city.zones;
    this.mutate(() => zones.push({ name: `Zone ${zones.length + 1}`, rate: 0.1, color: zoneColors[zones.length % zoneColors.length], creatures: [{ species: 129, min: 5, max: 10 }] }));
    this.#zone = zones.length;
    this.#notify();
  }

  /** Delete an encounter zone (painted tiles of later zones shift down) */
  deleteZone(index: number) {
    const zones = this.#city.zones;
    this.mutate(() => zones.splice(index, 1));
    this.#batch(() => this.#city.zone.forEach((value, i) => (value >= index + 1) && this.#set("zone", i % this.#city.width, Math.floor(i / this.#city.width), value === index + 1 ? 0 : value - 1)));
    this.#zone = Math.max(1, Math.min(this.#zone, zones.length));
    this.#map.drawZones();
    this.#notify();
  }

  //=================================================================================================
  // Story

  /** Selected story step number (gates are painted with it), defaulting to the first step */
  get currentStep() {
    const story = this.#city.story;
    if ((this.#step) && (!story.some(({ n }) => n === this.#step))) {
      this.#step = 0;
    }
    if ((!this.#step) && (story.length)) {
      this.#step = story[0].n;
    }
    return this.#step;
  }

  /** Choose the story step painted on the map */
  setStep(n: number) {
    this.#step = n;
    this.#markersRefresh();
    this.#notify();
  }

  /** Add a story step at the end */
  addStep() {
    const story = this.#city.story;
    const n = Math.max(0, ...story.map(({ n }) => n)) + 1;
    this.mutate(() => story.push({ id: uid(), n, name: story.length ? `Step ${story.length + 1}` : "Meet the Professor", blocked: "The path is blocked. Maybe someone in town can help." }));
    this.#step = n;
    this.#notify();
  }

  /** Move a step earlier (-1) or later (+1) */
  moveStep(index: number, delta: number) {
    const story = this.#city.story;
    this.mutate(() => story.splice(index + delta, 0, ...story.splice(index, 1)));
  }

  /** Delete a step: its gates open and people stop using it */
  deleteStep(id: string) {
    const story = this.#city.story;
    const step = story.find((step) => step.id === id);
    if (!step) {
      return;
    }
    this.mutate(() => story.splice(story.indexOf(step), 1));
    for (const map of [this.#world, ...this.#world.interiors]) {
      map.gate.forEach((value, index) => (value === step.n) && (map === this.#city ? this.#apply("gate", index, 0) : map.gate[index] = 0));
      for (const npc of map.npcs) {
        for (const key of ["after", "until", "requires", "completes"] as const) {
          if (npc.story?.[key] === step.id) {
            delete npc.story[key];
          }
        }
      }
    }
    this.#emitMeta();
    this.#map.drawGates();
    this.#notify();
  }

  /** People of the whole city using a step in a story setting */
  people(key: keyof NpcStory, id: string) {
    return [this.#world, ...this.#world.interiors].flatMap((map) => map.npcs.filter((npc) => npc.story?.[key] === id).map((npc) => npc.name || "Someone"));
  }

  /** Gate tiles of a step on every map */
  gates(n: number) {
    return [this.#world, ...this.#world.interiors].reduce((total, map) => total + map.gate.filter((value) => value === n).length, 0);
  }

  /** What blocks the way until a step is done */
  setBlocker(step: Step, blocker: NonNullable<Step["blocker"]>) {
    this.mutate(() => step.blocker = blocker);
    this.#map.drawBlockers();
    this.#notify();
  }

  /** Object drawn on a step's gates (suggests a fitting message while the default one is still there) */
  setObstacle(step: Step, tile: number, message = "") {
    this.mutate(() => {
      step.tile = tile;
      if ((message) && ((!step.blocked) || (step.blocked.startsWith("The path is blocked")) || (obstacles.some((obstacle) => obstacle.message === step.blocked)))) {
        step.blocked = message;
      }
    });
    this.#map.drawBlockers();
    this.#notify();
  }

  /** Start placing a person who blocks the way until a step */
  startBlocking(id: string) {
    this.#blocking = id;
    this.#tool = "brush";
    this.#ghost.removeChildren().forEach((child) => child.destroy());
    const person = this.#ghost.addChild(new PIXI.Sprite(texture("hiker", "down")));
    person.anchor.set(0.5, 1);
    person.position.set(size / 2, size);
    this.#notify();
  }

  /** Leave person placing mode */
  stopBlocking() {
    this.#blocking = "";
    this.#map.overlays.cursor.clear();
    this.#ghostRefresh();
    this.#notify();
  }

  /** Place the blocking person under the cursor */
  #placeBlocker(type: "down" | "move" | "up", tile: { x: number; y: number }) {
    const { x, y } = tile;
    const inside = this.#map.inside(tile);
    this.#ghost.visible = inside;
    this.#ghost.position.set(x * size, y * size);
    this.#map.cursor(x, y, 1, 1, 0xf2bf4b);
    if ((type !== "down") || (!inside)) {
      return;
    }
    if (this.#city.npcs.some((npc) => (npc.x === x) && (npc.y === y))) {
      return ui.toast("Someone is already standing there", "error");
    }
    const until = this.#blocking;
    this.mutate(() => this.#city.npcs.push({ x, y, sprite: "hiker", dir: "down", name: "Hiker", dialogue: "Sorry, I can't let anyone through right now.", role: "talk", wander: false, story: { until } }));
    this.stopBlocking();
    this.#markersRefresh();
    ui.toast("Placed! Use Edit to change how they look and what they say", "success");
  }

  /** Someone already on the map blocks the way until a step */
  blockWith(index: number, id: string) {
    const npc = this.#city.npcs[index];
    if (npc) {
      this.mutate(() => (npc.story ??= {}).until = id);
      this.#markersRefresh();
      this.#notify();
    }
  }

  /** Someone stops blocking the way */
  unblock(index: number) {
    const npc = this.#city.npcs[index];
    if (npc?.story) {
      this.mutate(() => delete npc.story!.until);
      this.#markersRefresh();
      this.#notify();
    }
  }

  /** Forget your own story progress in this city (testing) */
  restart() {
    this.onrestart?.();
  }

  //=================================================================================================
  // Doors

  /** Select a door (-1 = none) */
  selectDoor(index: number) {
    this.#door = index;
    this.#markersRefresh();
    this.#notify();
  }

  /** Where the selected door leads ("" = outside, "new:<template>" creates an interior) */
  setDoorDestination(value: string) {
    const door = this.#city.doors[this.#door];
    if (!door) {
      return;
    }
    if (value.startsWith("new:")) {
      const map = this.newInterior(value.slice(4) as Template);
      this.mutate(() => door.to = map.id);
    } else {
      this.mutate(() => door.to = value);
    }
    this.#markersRefresh();
    this.#notify();
  }

  /** Remove the selected door */
  removeDoor() {
    this.mutate(() => this.#city.doors.splice(this.#door, 1));
    this.#door = -1;
    this.#markersRefresh();
    this.#notify();
  }

  //=================================================================================================
  // People

  /** What clicking an empty tile on the People layer adds */
  setAdding(kind: Kind) {
    this.#adding = kind;
    this.#notify();
  }

  /** Select someone (-1 = none) */
  selectNpc(index: number) {
    if (this.#pathing >= 0) {
      this.#pathing = -1;
      this.#map.overlays.cursor.clear();
    }
    this.#selected = index;
    this.#markersRefresh();
    this.#notify();
  }

  /** Edit someone in the story panel (switches to the People layer) */
  editNpc(index: number) {
    this.select("npc");
    this.selectNpc(index);
  }

  /** Remove the selected person */
  deleteNpc() {
    const index = this.#selected;
    if (index < 0) {
      return;
    }
    this.mutate(() => this.#city.npcs.splice(index, 1));
    this.#selected = -1;
    this.#pathing = -1;
    this.#markersRefresh();
    this.#notify();
  }

  /** Turn the selected person into another kind */
  convertNpc(kind: Kind) {
    const npc = this.#city.npcs[this.#selected];
    if ((npc) && (kindOf(npc) !== kind)) {
      this.mutate(() => convert(npc, kind, this.#city.name));
    }
  }

  /** Place, select and move people, doors and the spawn */
  #placing(type: "down" | "move" | "up", tile: { x: number; y: number }) {
    const { x, y } = tile;
    if (!this.#map.inside(tile)) {
      return;
    }
    if (this.#target === "spawn") {
      if (type === "down") {
        this.mutate(() => this.#city.spawn = { x, y });
      }
      return;
    }
    if (this.#target === "door") {
      if (type !== "down") {
        return;
      }
      const at = this.#city.doors.findIndex((door) => (door.x === x) && (door.y === y));
      if (at >= 0) {
        this.#door = at;
      } else {
        //Doors inside lead outside by default, doors outside need a destination
        this.mutate(() => this.#city.doors.push({ x, y, to: this.mapId ? "" : "?", tx: -1, ty: -1 }));
        this.#door = this.#city.doors.length - 1;
        //Doors must be walkable (house fronts block movement by default)
        this.#batch(() => this.#set("solid", x, y, 0));
      }
      this.#markersRefresh();
      this.#notify();
      return;
    }
    const at = this.#city.npcs.findIndex((npc) => (npc.x === x) && (npc.y === y));
    if (type === "down") {
      if (at >= 0) {
        this.#selected = at;
        this.#dragging = at;
        this.#snapshot = JSON.stringify(this.#city.npcs);
      } else {
        this.mutate(() => {
          const npc = { x, y, sprite: "", dir: "down", name: "", dialogue: "", role: "talk", wander: false } as Npc;
          convert(npc, this.#adding, this.#city.name);
          this.#city.npcs.push(npc);
        });
        //Signs get a sign post when nothing stands there yet
        if ((this.#adding === "sign") && (!this.#city.layers.decor[y * this.#city.width + x])) {
          this.#batch(() => (this.#set("decor", x, y, 206), this.#set("solid", x, y, 1)));
        }
        this.#selected = this.#city.npcs.length - 1;
      }
      this.#markersRefresh();
      this.#notify();
    } else if ((type === "move") && (this.#dragging >= 0) && (at < 0)) {
      const dragged = this.#city.npcs[this.#dragging];
      //Their path moves with them
      dragged.path?.points.forEach((point) => (point.x += x - dragged.x, point.y += y - dragged.y));
      Object.assign(dragged, { x, y });
      this.#markersRefresh();
    } else if ((type === "up") && (this.#dragging >= 0)) {
      this.#dragging = -1;
      const after = JSON.stringify(this.#city.npcs);
      if (after !== this.#snapshot) {
        this.#push({ snapshot: { before: JSON.stringify({ npcs: JSON.parse(this.#snapshot), spawn: this.#city.spawn }), after: JSON.stringify({ npcs: this.#city.npcs, spawn: this.#city.spawn }) } });
      }
      this.#notify();
    }
  }

  //=================================================================================================
  // Paths

  /** Start drawing the path of someone */
  startPath(index = this.#selected) {
    this.#pathing = index;
    this.#selected = index;
    this.#markersRefresh();
    this.#notify();
  }

  /** Stop drawing a path */
  stopPath() {
    this.#pathing = -1;
    this.#map.overlays.cursor.clear();
    this.#markersRefresh();
    this.#notify();
  }

  /** Add a stop to the path being drawn */
  #placePath(type: "down" | "move" | "up", tile: { x: number; y: number }) {
    const npc = this.#city.npcs[this.#pathing];
    if (!npc?.path) {
      return this.stopPath();
    }
    this.#map.cursor(tile.x, tile.y, 1, 1, 0xf2bf4b);
    if ((type !== "down") || (!this.#map.inside(tile))) {
      return;
    }
    const last = npc.path.points.at(-1) ?? npc;
    if ((last.x === tile.x) && (last.y === tile.y)) {
      return;
    }
    this.mutate(() => npc.path!.points.push({ x: tile.x, y: tile.y }));
  }

  /** Draw the paths of people on this map (the selected one stands out) */
  #drawRoutes() {
    const route = this.#route;
    route.clear();
    if (route.parent !== this.#markers.parent) {
      this.#markers.parent?.addChild(route);
    }
    route.zIndex = 9990;
    if (this.#target !== "npc") {
      return;
    }
    const center = ({ x, y }: { x: number; y: number }) => [x * size + size / 2, y * size + size / 2] as const;
    this.#city.npcs.forEach((npc, i) => {
      if (!npc.path?.points.length) {
        return;
      }
      const active = (i === this.#selected) || (i === this.#pathing);
      const stops = [{ x: npc.x, y: npc.y }, ...npc.path.points];
      const color = active ? 0xf2bf4b : 0xfafafa;
      //Across first, then up or down, like they walk in play mode
      const leg = (from: { x: number; y: number }, to: { x: number; y: number }) => (route.lineTo(...center({ x: to.x, y: from.y })), route.lineTo(...center(to)));
      route.lineStyle({ width: active ? 2 : 1, color, alpha: active ? 0.95 : 0.35 });
      route.moveTo(...center(stops[0]));
      stops.slice(1).forEach((stop, n) => leg(stops[n], stop));
      if (npc.path.loop) {
        route.lineStyle({ width: active ? 2 : 1, color, alpha: active ? 0.45 : 0.2 });
        leg(stops.at(-1)!, stops[0]);
      }
      route.lineStyle(0);
      stops.slice(1).forEach((stop, n) => {
        const [cx, cy] = center(stop);
        route.beginFill(active ? 0xf2bf4b : 0xfafafa, active ? 1 : 0.4).drawCircle(cx, cy, active ? 3.5 : 2).endFill();
        if (active) {
          const label = this.#markers.addChild(new PIXI.Text(`${n + 1}`, { fontSize: 8, fontWeight: "bold", fill: 0x171717 }));
          label.anchor.set(0.5);
          label.position.set(cx, cy);
          label.zIndex = 9999;
          label.resolution = 4;
        }
      });
    });
  }

  //=================================================================================================
  // History

  /** Apply a snapshot-tracked change (people, spawn, zones, story and doors) as one undo step */
  mutate(fn: () => void) {
    const snapshot = () => JSON.stringify({ npcs: this.#city.npcs, spawn: this.#city.spawn, zones: this.#city.zones, story: this.#city.story, doors: this.#city.doors });
    const before = snapshot();
    fn();
    const after = snapshot();
    if (before !== after) {
      this.#push({ snapshot: { before, after } });
    }
    this.#markersRefresh();
    this.#map.drawBlockers();
    this.#notify();
  }

  /** Save a change made directly on the city without an undo step (sliders while dragging) */
  touch() {
    this.#emitMeta();
    this.#onchange();
    this.#notify();
  }

  /** Send people, spawn, zones, story and doors to the live room */
  #emitMeta() {
    this.onmeta?.({ npcs: this.#city.npcs, spawn: this.#city.spawn, zones: this.#city.zones, story: this.#city.story, doors: this.#city.doors });
  }

  /** Push a history entry */
  #push(entry: Entry) {
    if ("snapshot" in entry) {
      this.#emitMeta();
    }
    this.#undo.push(entry);
    if (this.#undo.length > 200) {
      this.#undo.shift();
    }
    this.#redo.length = 0;
    this.#onchange();
    this.#notify();
  }

  /** Revert or replay an entry */
  #replay(entry: Entry, direction: "before" | "after") {
    if ("changes" in entry) {
      for (const change of entry.changes) {
        this.#apply(change.grid, change.index, change[direction]);
      }
    } else {
      Object.assign(this.#city, JSON.parse(entry.snapshot[direction]));
      this.#emitMeta();
      this.#selected = -1;
      this.#markersRefresh();
      this.#map.drawZones();
      this.#map.drawBlockers();
    }
    this.#onchange();
    this.#notify();
  }

  /** Undo the last change */
  undo() {
    const entry = this.#undo.pop();
    if (entry) {
      this.#replay(entry, "before");
      this.#redo.push(entry);
    }
  }

  /** Redo the last undone change */
  redo() {
    const entry = this.#redo.pop();
    if (entry) {
      this.#replay(entry, "after");
      this.#undo.push(entry);
    }
  }

  //=================================================================================================
  // Map overlays

  /** Overlay visibility depends on the target */
  #overlaysRefresh() {
    const { solid, zone, gate } = this.#map.overlays;
    solid.visible = ((this.#target === "solid") || (this.#target === "decor")) && (!this.#hidden.has("solid"));
    zone.visible = (this.#target === "zone") && (!this.#hidden.has("zone"));
    gate.visible = ((this.#target === "story") || (this.#target === "door")) && (!this.#hidden.has("story"));
    for (const layer of layers) {
      this.#map.containers[layer].alpha = (this.#target === "ground") && (layer !== "ground") ? 0.7 : 1;
      this.#map.containers[layer].visible = !this.#hidden.has(layer);
    }
  }

  /** Rebuild the cursor ghost (brush or clipboard preview) */
  #ghostRefresh() {
    this.#ghost.removeChildren().forEach((child) => child.destroy());
    const draw = (w: number, tiles: number[]) =>
      tiles.forEach((value, i) => {
        if (value) {
          const tile = this.#ghost.addChild(sprite(value));
          tile.position.set((i % w) * size, Math.floor(i / w) * size);
        }
      });
    if ((this.#pasting) && (this.#clip)) {
      for (const layer of layers) {
        draw(this.#clip.w, this.#clip.grids[layer]);
      }
      return;
    }
    draw(this.#stamp.w, this.#stamp.tiles);
  }

  /** Rebuild people, door and spawn markers */
  #markersRefresh() {
    this.#markers.removeChildren().forEach((child) => child.destroy());
    this.#drawRoutes();
    const step = this.#city.story.find(({ n }) => n === this.#step);
    this.#city.npcs.forEach((npc, i) => {
      const look = npc.creature ? creatureSprite(npc.creature.species, npc.creature.look) : null;
      const marker = this.#markers.addChild(new PIXI.Sprite(look ? look.texture : npc.sprite ? texture(npc.sprite, npc.dir) : PIXI.Texture.WHITE));
      if (look) {
        marker.anchor.set(0.5, 1);
        marker.scale.set(look.scale);
        marker.position.set(npc.x * size + size / 2, (npc.y + 1) * size + 2);
      } else if (npc.sprite) {
        marker.anchor.set(0.5, 1);
        marker.scale.set(scaleOf(npc.sprite));
        marker.position.set(npc.x * size + size / 2, (npc.y + 1) * size);
      } else {
        marker.width = marker.height = size - 6;
        marker.tint = 0xc8a060;
        marker.position.set(npc.x * size + 3, npc.y * size + 3);
      }
      marker.zIndex = npc.y;
      const ring = (color: number) => {
        const graphic = this.#markers.addChild(new PIXI.Graphics().lineStyle({ width: 1, color, native: true }).drawRect(npc.x * size, npc.y * size - 4, size, size + 4));
        graphic.zIndex = 9999;
      };
      if ((this.#target === "story") && (step) && (npc.story?.until === step.id)) {
        ring(0xf2bf4b);
      }
      if ((this.#target === "npc") && (i === this.#selected)) {
        ring(0xffdc00);
      }
      if ((npc.role === "trainer") || (npc.role === "wild")) {
        const badge = this.#markers.addChild(new PIXI.Text(npc.role === "wild" ? "!" : npc.trainer?.gym ? "★" : "!", { fontSize: 10, fontWeight: "bold", fill: npc.trainer?.gym ? 0xffdc00 : 0xff4136, stroke: 0x000000, strokeThickness: 2 }));
        badge.position.set(npc.x * size + 11, npc.y * size - 8);
        badge.zIndex = 9999;
      }
    });
    this.#city.doors.forEach((door, i) => {
      const selected = (this.#target === "door") && (i === this.#door);
      const marker = this.#markers.addChild(new PIXI.Graphics());
      marker.beginFill(door.to === "?" ? 0xf06a6a : 0x9b6b3f, 0.55).lineStyle({ width: 1, color: selected ? 0xf2bf4b : 0xfafafa, alpha: 1, native: true }).drawRect(door.x * size + 2, door.y * size + 2, size - 4, size - 4).endFill();
      marker.lineStyle({ width: 1, color: 0xfafafa, alpha: 0.9, native: true }).moveTo(door.x * size + 8, door.y * size + 5).lineTo(door.x * size + 8, door.y * size + 11);
      marker.zIndex = 9998;
    });
    const { x, y } = this.#city.spawn;
    const spawn = this.#markers.addChild(new PIXI.Sprite(texture("may", "down")));
    spawn.anchor.set(0.5, 1);
    spawn.alpha = 0.7;
    spawn.position.set(x * size + size / 2, (y + 1) * size);
    spawn.zIndex = y;
    const flag = this.#markers.addChild(new PIXI.Graphics().lineStyle({ width: 1, color: 0x7fdbff, native: true }).drawCircle(x * size + 8, y * size + 8, 9));
    flag.zIndex = 9999;
  }
}
