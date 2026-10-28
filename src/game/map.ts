//Imports
import * as PIXI from "pixi.js";
import { size, sprite } from "./assets";
import { type City, type Layer, layers } from "./data";

/** Display object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Display = any;

/** Pointer callback */
export type PointerHandler = (type: "down" | "move" | "up", tile: { x: number; y: number }, event: PointerEvent) => void;

/**
 * City map renderer.
 * Draws tile layers, editor overlays and actors, and handles camera pan/zoom.
 */
export class CityMap {
  /** PIXI application */
  readonly app: Display;

  /** World container (camera) */
  readonly world: Display;

  /** Layer containers */
  readonly containers = {} as Record<Layer | "blockers" | "actors" | "overlay", Display>;

  /** Tile sprites per layer */
  readonly sprites = {} as Record<Layer, (Display | null)[]>;

  /** Overlays */
  readonly overlays = {
    solid: new PIXI.Graphics(),
    zone: new PIXI.Graphics(),
    gate: new PIXI.Graphics(),
    grid: new PIXI.Graphics(),
    cursor: new PIXI.Graphics(),
    border: new PIXI.Graphics(),
  };

  /** Current city */
  city = null as unknown as City;

  /** Pointer listener (left button only, panning is handled internally) */
  onpointer = null as null | PointerHandler;

  /** Right click without dragging (dragging pans): the tile, and where to open a menu on screen */
  oncontext = null as null | ((tile: { x: number; y: number }, screen: { x: number; y: number }) => void);

  /** The pointer left the map */
  onleave = null as null | (() => void);

  /** Allow user panning */
  pannable = true;

  /** Constructor */
  constructor(host: HTMLElement) {
    this.app = new PIXI.Application({ resizeTo: host, backgroundColor: 0x0a0a0a, antialias: false });
    host.appendChild(this.app.view);
    this.world = this.app.stage.addChild(new PIXI.Container());
    for (const name of [...layers.slice(0, 2), "blockers", "actors", layers[2], "overlay"] as const) {
      this.containers[name] = this.world.addChild(new PIXI.Container());
    }
    this.containers.actors.sortableChildren = true;
    for (const overlay of ["border", "zone", "gate", "solid", "grid", "cursor"] as const) {
      this.containers.overlay.addChild(this.overlays[overlay]);
    }
    this.world.scale.set(3);
    this.#inputs(this.app.view);
    //Resizing clears the canvas: redraw right away so the map doesn't blink while the panel is dragged
    this.#observer = new ResizeObserver(() => {
      this.app.resize();
      this.app.render();
    });
    this.#observer.observe(host);
  }

  /** Watches the size of the element holding the map */
  readonly #observer: ResizeObserver;

  /** Move the map into another element (the editor page was mounted again) */
  attach(host: HTMLElement) {
    if (this.app.view.parentElement !== host) {
      host.appendChild(this.app.view);
      this.app.resizeTo = host;
      this.#observer.disconnect();
      this.#observer.observe(host);
    }
    this.app.resize();
  }

  /** Load a city */
  load(city: City) {
    this.city = city;
    for (const layer of layers) {
      this.containers[layer].removeChildren().forEach((child: Display) => child.destroy());
      this.sprites[layer] = new Array(city.width * city.height).fill(null);
      city.layers[layer].forEach((value, index) => this.set(layer, index, value));
    }
    this.redraw();
  }

  /** Update a tile */
  set(layer: Layer, index: number, value: number) {
    this.city.layers[layer][index] = value;
    const current = this.sprites[layer][index];
    if (current) {
      current.destroy();
      this.sprites[layer][index] = null;
    }
    if (value) {
      const tile = sprite(value);
      tile.position.set((index % this.city.width) * size, Math.floor(index / this.city.width) * size);
      this.sprites[layer][index] = this.containers[layer].addChild(tile);
    }
    this.ontiles?.();
  }

  /** Redraw all overlays */
  redraw() {
    this.drawSolid();
    this.drawZones();
    this.drawGates();
    this.drawBlockers();
    this.drawGrid();
    const { border } = this.overlays;
    border.clear().lineStyle({ width: 1, color: 0xffffff, alpha: 0.6, native: true }).drawRect(0, 0, this.city.width * size, this.city.height * size);
  }

  /** Draw collision overlay */
  drawSolid() {
    const { solid } = this.overlays;
    solid.clear().beginFill(0xff4136, 0.45);
    this.city.solid.forEach((value, index) => value && solid.drawRect((index % this.city.width) * size + 2, Math.floor(index / this.city.width) * size + 2, size - 4, size - 4));
    solid.endFill();
  }

  /** Draw encounter zones overlay */
  drawZones() {
    const { zone } = this.overlays;
    zone.clear();
    this.city.zone.forEach((value, index) => {
      if (value) {
        zone.beginFill(this.city.zones[value - 1]?.color ?? 0xffffff, 0.4).drawRect((index % this.city.width) * size, Math.floor(index / this.city.width) * size, size, size).endFill();
      }
    });
  }

  /** Draw story gates overlay (hatched, one color per step) */
  drawGates() {
    const { gate } = this.overlays;
    gate.clear();
    const colors = [0xff8a3d, 0xe85dbe, 0x5db8e8, 0xb5e85d, 0xe8d35d, 0x9d7bf0];
    (this.city.gate ?? []).forEach((value, index) => {
      if (value) {
        const [x, y] = [(index % this.city.width) * size, Math.floor(index / this.city.width) * size];
        const color = colors[(value - 1) % colors.length];
        gate.beginFill(color, 0.3).drawRect(x, y, size, size).endFill();
        gate.lineStyle({ width: 1, color, alpha: 0.9, native: true }).moveTo(x, y + size).lineTo(x + size, y).moveTo(x, y + size / 2).lineTo(x + size / 2, y).moveTo(x + size / 2, y + size).lineTo(x + size, y + size / 2).lineStyle(0);
      }
    });
  }

  /** Is a story step done (play mode sets this, the editor shows every blocker) */
  done = (_step: string) => false;

  /** Draw story objects standing on gates (rocks, trees, fences…) until their step is done */
  drawBlockers(fade = false) {
    const container = this.containers.blockers;
    const previous = container.removeChildren();
    const story = this.city.story ?? [];
    (this.city.gate ?? []).forEach((value, index) => {
      const step = value ? story.find(({ n }) => n === value) : null;
      if ((step?.blocker === "object") && (step.tile) && (!this.done(step.id))) {
        const tile = sprite(step.tile);
        tile.position.set((index % this.city.width) * size, Math.floor(index / this.city.width) * size);
        container.addChild(tile);
      }
    });
    if (!fade) {
      previous.forEach((child: Display) => child.destroy());
      return;
    }
    //Objects removed by story progress fade out instead of popping away
    const kept = new Set(container.children.map(({ x, y }: Display) => `${x};${y}`));
    const leaving = previous.filter(({ x, y }: Display) => !kept.has(`${x};${y}`));
    previous.filter((child: Display) => !leaving.includes(child)).forEach((child: Display) => child.destroy());
    leaving.forEach((child: Display) => container.addChild(child));
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 500);
      leaving.forEach((child: Display) => (child.alpha = 1 - t, child.y -= 0.15));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        leaving.forEach((child: Display) => child.destroy());
      }
    };
    requestAnimationFrame(step);
  }

  /** Draw grid overlay (dark lines read on light grass and dark floors alike, stronger every 10 tiles) */
  drawGrid() {
    const { grid } = this.overlays;
    const { width, height } = this.city;
    grid.clear();
    for (const [step, alpha] of [[1, 0.28], [10, 0.55]] as const) {
      grid.lineStyle({ width: 1, color: 0x000000, alpha, native: true });
      for (let x = step; x < width; x += step) {
        grid.moveTo(x * size, 0).lineTo(x * size, height * size);
      }
      for (let y = step; y < height; y += step) {
        grid.moveTo(0, y * size).lineTo(width * size, y * size);
      }
    }
  }

  /** Draw cursor (tile rectangle) */
  cursor(x: number, y: number, width = 1, height = 1, color = 0xffdc00) {
    this.overlays.cursor.clear().lineStyle({ width: 1, color, alpha: 1, native: true }).drawRect(x * size, y * size, width * size, height * size);
  }

  /** Convert client coordinates to tile coordinates */
  tile(clientX: number, clientY: number) {
    const rect = this.app.view.getBoundingClientRect();
    const scale = this.world.scale.x;
    return {
      x: Math.floor((clientX - rect.left - this.world.x) / (size * scale)),
      y: Math.floor((clientY - rect.top - this.world.y) / (size * scale)),
    };
  }

  /** Is tile inside city */
  inside({ x, y }: { x: number; y: number }) {
    return (x >= 0) && (y >= 0) && (x < this.city.width) && (y < this.city.height);
  }

  /** Center camera on tile coordinates */
  center(x: number, y: number) {
    const scale = this.world.scale.x;
    this.world.position.set(Math.round(this.app.screen.width / 2 - x * size * scale), Math.round(this.app.screen.height / 2 - y * size * scale));
  }

  /** Set zoom level (keeps screen center) */
  scale(value: number) {
    this.zoom(value / this.world.scale.x);
  }

  /** Fit the whole city in view and center it */
  fit() {
    const { width, height } = this.app.screen;
    const fit = Math.min((width - 48) / (this.city.width * size), (height - 48) / (this.city.height * size));
    this.world.scale.set(Math.min(4, Math.max(0.5, Math.floor(fit * 4) / 4)));
    this.center(this.city.width / 2, this.city.height / 2);
    this.onzoom?.(this.world.scale.x);
  }

  /** Zoom around a screen point (snapped to 25% steps unless zooming continuously with a pinch) */
  zoom(factor: number, px = this.app.screen.width / 2, py = this.app.screen.height / 2, snap = true) {
    const previous = this.world.scale.x;
    const scale = Math.min(8, Math.max(0.5, snap ? Math.round(previous * factor * 4) / 4 : previous * factor));
    if (scale === previous) {
      return;
    }
    this.world.x = px - (px - this.world.x) * (scale / previous);
    this.world.y = py - (py - this.world.y) * (scale / previous);
    this.world.scale.set(scale);
    this.onzoom?.(scale);
  }

  /** Tiles changed listener (minimap) */
  ontiles = null as null | (() => void);

  /** Render the tile layers into a canvas (k = pixels per map pixel) */
  snapshot(k = 1) {
    const width = Math.max(1, Math.round(this.city.width * size * k)), height = Math.max(1, Math.round(this.city.height * size * k));
    const texture = PIXI.RenderTexture.create({ width, height });
    const transform = new PIXI.Matrix().scale(k, k);
    layers.forEach((layer, i) => {
      const container = this.containers[layer];
      const [alpha, visible] = [container.alpha, container.visible];
      container.alpha = 1;
      container.visible = true;
      this.app.renderer.render(container, { renderTexture: texture, clear: i === 0, transform });
      container.alpha = alpha;
      container.visible = visible;
    });
    const canvas = this.app.renderer.plugins.extract.canvas(texture) as HTMLCanvasElement;
    texture.destroy(true);
    return canvas;
  }

  /** Visible area in tiles */
  get view() {
    const unit = size * this.world.scale.x;
    return { x: -this.world.x / unit, y: -this.world.y / unit, w: this.app.screen.width / unit, h: this.app.screen.height / unit };
  }

  /** Zoom listener */
  onzoom = null as null | ((scale: number) => void);

  /** Space key held (pan with left button) */
  #space = false;

  /** Mouse, touch and wheel inputs */
  #inputs(view: HTMLCanvasElement) {
    let panning = null as null | { x: number; y: number; wx: number; wy: number; button: number };
    view.addEventListener("contextmenu", (event) => event.preventDefault());
    view.addEventListener("pointerleave", () => this.onleave?.());
    view.addEventListener("pointerdown", (event) => {
      view.setPointerCapture(event.pointerId);
      if ((this.pannable) && ((event.button === 1) || (event.button === 2) || (this.#space) || (!this.onpointer))) {
        panning = { x: event.clientX, y: event.clientY, wx: this.world.x, wy: this.world.y, button: event.button };
        view.style.cursor = "grabbing";
        return;
      }
      if (event.button === 0) {
        this.onpointer?.("down", this.tile(event.clientX, event.clientY), event);
      }
    });
    view.addEventListener("pointermove", (event) => {
      if (panning) {
        this.world.position.set(panning.wx + event.clientX - panning.x, panning.wy + event.clientY - panning.y);
        return;
      }
      this.onpointer?.("move", this.tile(event.clientX, event.clientY), event);
    });
    view.addEventListener("pointerup", (event) => {
      if (panning) {
        //A right click that barely moved opens the menu instead of panning
        const click = (panning.button === 2) && (Math.hypot(event.clientX - panning.x, event.clientY - panning.y) < 4);
        panning = null;
        view.style.cursor = "";
        if (click) {
          this.oncontext?.(this.tile(event.clientX, event.clientY), { x: event.clientX, y: event.clientY });
        }
        return;
      }
      this.onpointer?.("up", this.tile(event.clientX, event.clientY), event);
    });
    //Trackpad: two-finger swipe pans, pinch (sent as ctrl+wheel) zooms. Mouse: wheel pans, ctrl/cmd+wheel zooms
    view.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = view.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const [dx, dy] = [event.deltaX * unit, event.deltaY * unit];
      if ((event.ctrlKey) || (event.metaKey) || (!this.pannable)) {
        this.zoom(Math.exp(-Math.max(-100, Math.min(100, dy)) * 0.01), px, py, false);
        return;
      }
      if ((event.shiftKey) && (!dx)) {
        this.world.x -= dy;
      } else {
        this.world.x -= dx;
        this.world.y -= dy;
      }
    }, { passive: false });
    //Safari pinch gestures
    let gesture = 1;
    view.addEventListener("gesturestart", (event) => (event.preventDefault(), gesture = 1));
    view.addEventListener("gesturechange", (event) => {
      event.preventDefault();
      const { scale, clientX, clientY } = event as unknown as { scale: number; clientX: number; clientY: number };
      const rect = view.getBoundingClientRect();
      this.zoom(scale / gesture, clientX - rect.left, clientY - rect.top, false);
      gesture = scale;
    });
    document.addEventListener("keydown", (event) => {
      if ((event.target as HTMLElement)?.closest?.("input, textarea, select")) {
        return;
      }
      if (event.key === " ") {
        this.#space = true;
      } else if ((event.key === "+") || (event.key === "=")) {
        this.zoom(1.25);
      } else if ((event.key === "-") || (event.key === "_")) {
        this.zoom(0.8);
      } else if ((event.key === "0") && (!event.ctrlKey) && (!event.metaKey) && (this.pannable)) {
        this.fit();
      }
    });
    document.addEventListener("keyup", (event) => event.key === " " && (this.#space = false));
  }
}
