//Imports
import * as PIXI from "pixi.js";
import { Atmosphere, type Daytime, hour, type Weather } from "./atmosphere";
import { size, sprite } from "./assets";
import { type City, type Layer, layers } from "./data";
import { neighbors } from "./region";
import { arrow, ICE, ledge, WATER } from "./behaviors";

/** Display object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Display = any;

/** Draw an item ball centered on a point (hidden items are faded and dashed) */
export function drawBall(graphic: PIXI.Graphics, cx: number, cy: number, hidden = false) {
  const r = 5;
  const alpha = hidden ? 0.45 : 1;
  graphic
    .lineStyle({ width: 1, color: 0x202020, alpha, native: true })
    .beginFill(0xf4f4f4, alpha)
    .drawCircle(cx, cy, r)
    .endFill()
    .beginFill(0xe03a3a, alpha)
    .arc(cx, cy, r, Math.PI, 0)
    .closePath()
    .endFill()
    .moveTo(cx - r, cy)
    .lineTo(cx + r, cy)
    .beginFill(0xf4f4f4, alpha)
    .drawCircle(cx, cy, 1.5)
    .endFill()
    .lineStyle(0);
  return graphic;
}

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
  readonly containers = {} as Record<Layer | "neighbors" | "blockers" | "actors" | "overlay", Display>;

  /** Tile sprites per layer */
  readonly sprites = {} as Record<Layer, (Display | null)[]>;

  /** Overlays */
  readonly overlays = {
    solid: new PIXI.Graphics(),
    behavior: new PIXI.Graphics(),
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
    for (const name of ["neighbors", ...layers.slice(0, 2), "blockers", "actors", layers[2], "overlay"] as const) {
      this.containers[name] = this.world.addChild(new PIXI.Container());
    }
    this.containers.actors.sortableChildren = true;
    for (const overlay of ["border", "zone", "gate", "solid", "behavior", "grid", "cursor"] as const) {
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

  /** Weather and time of day, drawn over the map */
  #atmosphere = null as null | Atmosphere;

  /** Show weather and time of day over the map (nothing when clear and day) */
  sky(weather: Weather = "clear", time: Daytime = "day") {
    if (weather === "clear" && hour(time) === "day") {
      this.#atmosphere?.destroy();
      this.#atmosphere = null;
      return;
    }
    if (this.#atmosphere) {
      return this.#atmosphere.set(weather, time);
    }
    this.#atmosphere = new Atmosphere(this.app, weather, time);
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

  /** Whole city the loaded map belongs to (outdoor maps show the maps touching them around their edges) */
  root = null as null | City;

  /** Load a city */
  load(city: City) {
    this.city = city;
    this.drawNeighbors();
    for (const layer of layers) {
      this.containers[layer].removeChildren().forEach((child: Display) => child.destroy());
      this.sprites[layer] = new Array(city.width * city.height).fill(null);
      city.layers[layer].forEach((value, index) => this.set(layer, index, value));
    }
    this.redraw();
  }

  /** Draw the outdoor maps touching this one around its edges, so routes and towns join without a gap */
  drawNeighbors() {
    const container = this.containers.neighbors;
    container.removeChildren().forEach((child: Display) => child.destroy({ texture: true, baseTexture: true }));
    for (const { map, dx, dy } of this.root ? neighbors(this.root, this.city) : []) {
      const image = container.addChild(new PIXI.Sprite(this.render(map)));
      image.position.set(dx * size, dy * size);
    }
  }

  /** Show neighboring maps faded (building) or as they are (playing) */
  fadeNeighbors(faded: boolean) {
    this.containers.neighbors.alpha = faded ? 0.4 : 1;
  }

  /** Render the tile layers of any map of the city to a texture (k scales it down) */
  render(city: City, k = 1) {
    const container = new PIXI.Container();
    for (const layer of layers) {
      city.layers[layer].forEach((value, index) => {
        if (value) {
          const tile = container.addChild(sprite(value));
          tile.position.set((index % city.width) * size, Math.floor(index / city.width) * size);
        }
      });
    }
    const texture = PIXI.RenderTexture.create({
      width: Math.max(1, Math.round(city.width * size * k)),
      height: Math.max(1, Math.round(city.height * size * k)),
    });
    this.app.renderer.render(container, { renderTexture: texture, transform: new PIXI.Matrix().scale(k, k) });
    container.destroy({ children: true });
    return texture;
  }

  /** Picture of any map of the city (region thumbnails) */
  picture(city: City, k = 1) {
    const texture = this.render(city, k);
    const canvas = this.app.renderer.plugins.extract.canvas(texture) as HTMLCanvasElement;
    texture.destroy(true);
    return canvas;
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
    this.drawBehaviors();
    this.drawZones();
    this.drawGates();
    this.drawBlockers();
    this.drawGrid();
    const { border } = this.overlays;
    border
      .clear()
      .lineStyle({ width: 1, color: 0xffffff, alpha: 0.6, native: true })
      .drawRect(0, 0, this.city.width * size, this.city.height * size);
  }

  /** Draw collision overlay */
  drawSolid() {
    const { solid } = this.overlays;
    solid.clear().beginFill(0xff4136, 0.45);
    this.city.solid.forEach(
      (value, index) => value && solid.drawRect((index % this.city.width) * size + 2, Math.floor(index / this.city.width) * size + 2, size - 4, size - 4),
    );
    solid.endFill();
  }

  /** Draw tile behaviors overlay: ledge and push arrows, water waves, ice */
  drawBehaviors() {
    const { behavior } = this.overlays;
    behavior.clear();
    const { width } = this.city;
    //Arrow pointing a direction inside a tile
    const point = (x: number, y: number, dir: string, color: number) => {
      const [cx, cy] = [x + size / 2, y + size / 2];
      const tips = {
        down: [cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3],
        up: [cx - 4, cy + 2, cx + 4, cy + 2, cx, cy - 3],
        left: [cx + 2, cy - 4, cx + 2, cy + 4, cx - 3, cy],
        right: [cx - 2, cy - 4, cx - 2, cy + 4, cx + 3, cy],
      }[dir]!;
      behavior.beginFill(color, 0.95).drawPolygon(tips).endFill();
    };
    (this.city.behavior ?? []).forEach((value, index) => {
      if (!value) {
        return;
      }
      const [x, y] = [(index % width) * size, Math.floor(index / width) * size];
      const jump = ledge(value),
        push = arrow(value);
      if (jump) {
        behavior
          .beginFill(0xf2bf4b, 0.35)
          .drawRect(x + 1, y + 1, size - 2, size - 2)
          .endFill();
        point(x, y, jump, 0xffe08a);
      } else if (push) {
        behavior
          .beginFill(0xb76df0, 0.35)
          .drawRect(x + 1, y + 1, size - 2, size - 2)
          .endFill();
        point(x, y, push, 0xe4c4ff);
      } else if (value === WATER) {
        behavior
          .beginFill(0x3a8ee6, 0.4)
          .drawRect(x + 1, y + 1, size - 2, size - 2)
          .endFill();
        behavior.lineStyle({ width: 1, color: 0xd6ecff, alpha: 0.9, native: true });
        for (const dy of [5, 10]) {
          behavior
            .moveTo(x + 3, y + dy)
            .lineTo(x + 6, y + dy - 2)
            .lineTo(x + 9, y + dy)
            .lineTo(x + 12, y + dy - 2);
        }
        behavior.lineStyle(0);
      } else if (value === ICE) {
        behavior
          .beginFill(0xbfefff, 0.45)
          .drawRect(x + 1, y + 1, size - 2, size - 2)
          .endFill();
        behavior
          .lineStyle({ width: 1, color: 0xffffff, alpha: 0.9, native: true })
          .moveTo(x + 4, y + 12)
          .lineTo(x + 12, y + 4)
          .moveTo(x + 4, y + 7)
          .lineTo(x + 7, y + 4)
          .lineStyle(0);
      }
    });
  }

  /** Draw encounter zones overlay */
  drawZones() {
    const { zone } = this.overlays;
    zone.clear();
    this.city.zone.forEach((value, index) => {
      if (value) {
        zone
          .beginFill(this.city.zones[value - 1]?.color ?? 0xffffff, 0.4)
          .drawRect((index % this.city.width) * size, Math.floor(index / this.city.width) * size, size, size)
          .endFill();
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
        gate
          .lineStyle({ width: 1, color, alpha: 0.9, native: true })
          .moveTo(x, y + size)
          .lineTo(x + size, y)
          .moveTo(x, y + size / 2)
          .lineTo(x + size / 2, y)
          .moveTo(x + size / 2, y + size)
          .lineTo(x + size, y + size / 2)
          .lineStyle(0);
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
      if (step?.blocker === "object" && step.tile && !this.done(step.id)) {
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
      leaving.forEach((child: Display) => ((child.alpha = 1 - t), (child.y -= 0.15)));
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
    for (const [step, alpha] of [
      [1, 0.28],
      [10, 0.55],
    ] as const) {
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
    this.overlays.cursor
      .clear()
      .lineStyle({ width: 1, color, alpha: 1, native: true })
      .drawRect(x * size, y * size, width * size, height * size);
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
    return x >= 0 && y >= 0 && x < this.city.width && y < this.city.height;
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
    this.fitArea({ x: 0, y: 0, w: this.city.width, h: this.city.height }, 4);
  }

  /** Fit an area of tiles in view and center it (zoom to selection) */
  fitArea({ x, y, w, h }: { x: number; y: number; w: number; h: number }, max = 8) {
    const { width, height } = this.app.screen;
    const fit = Math.min((width - 48) / (w * size), (height - 48) / (h * size));
    this.world.scale.set(Math.min(max, Math.max(0.5, Math.floor(fit * 4) / 4)));
    this.center(x + w / 2, y + h / 2);
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
    const width = Math.max(1, Math.round(this.city.width * size * k)),
      height = Math.max(1, Math.round(this.city.height * size * k));
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

  /**
   * Touch: one finger paints, two fingers pan and pinch to zoom.
   * A finger waits a moment before painting, so putting down a second one turns it into a gesture without stray tiles.
   */
  #touch(view: HTMLCanvasElement) {
    const fingers = new Map<number, { x: number; y: number }>();
    let pending = null as null | { event: PointerEvent; timer: number };
    let painting = false,
      gesture = null as null | { distance: number; x: number; y: number };
    let dragging = null as null | { x: number; y: number; wx: number; wy: number };
    const spread = () => {
      const [a, b] = [...fingers.values()];
      return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const start = () => {
      if (pending) {
        clearTimeout(pending.timer);
        const { event } = pending;
        pending = null;
        painting = true;
        this.onpointer?.("down", this.tile(event.clientX, event.clientY), event);
      }
    };
    return {
      down: (event: PointerEvent) => {
        fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (fingers.size === 2) {
          //Second finger: a gesture, not painting
          if (pending) {
            clearTimeout(pending.timer);
            pending = null;
          } else if (painting) {
            painting = false;
            this.onpointer?.("up", this.tile(event.clientX, event.clientY), event);
          }
          dragging = null;
          gesture = spread();
        } else if (fingers.size === 1 && this.onpointer) {
          pending = { event, timer: setTimeout(start, 120) as unknown as number };
        } else if (fingers.size === 1 && this.pannable) {
          //Nothing to paint (viewing): one finger drags the map
          dragging = { x: event.clientX, y: event.clientY, wx: this.world.x, wy: this.world.y };
        }
      },
      move: (event: PointerEvent) => {
        const finger = fingers.get(event.pointerId);
        if (!finger) {
          return;
        }
        Object.assign(finger, { x: event.clientX, y: event.clientY });
        if (gesture && fingers.size >= 2) {
          const now = spread();
          const rect = view.getBoundingClientRect();
          if (this.pannable) {
            this.world.x += now.x - gesture.x;
            this.world.y += now.y - gesture.y;
          }
          this.zoom(now.distance / gesture.distance, now.x - rect.left, now.y - rect.top, false);
          gesture = now;
          return;
        }
        if (dragging) {
          this.world.position.set(dragging.wx + event.clientX - dragging.x, dragging.wy + event.clientY - dragging.y);
          return;
        }
        if (pending && Math.hypot(event.clientX - pending.event.clientX, event.clientY - pending.event.clientY) > 6) {
          start();
        }
        if (painting) {
          this.onpointer?.("move", this.tile(event.clientX, event.clientY), event);
        }
      },
      up: (event: PointerEvent) => {
        fingers.delete(event.pointerId);
        if (pending) {
          //A quick tap paints one tile
          start();
        }
        if (painting) {
          painting = false;
          this.onpointer?.("up", this.tile(event.clientX, event.clientY), event);
        }
        if (!fingers.size) {
          gesture = null;
          dragging = null;
        }
      },
    };
  }

  /** Mouse, touch and wheel inputs */
  #inputs(view: HTMLCanvasElement) {
    let panning = null as null | { x: number; y: number; wx: number; wy: number; button: number };
    const touch = this.#touch(view);
    //The browser must not scroll or zoom the page under the map
    view.style.touchAction = "none";
    view.addEventListener("contextmenu", (event) => event.preventDefault());
    view.addEventListener("pointerleave", () => this.onleave?.());
    view.addEventListener("pointerdown", (event) => {
      view.setPointerCapture(event.pointerId);
      if (event.pointerType === "touch") {
        return touch.down(event);
      }
      if (this.pannable && (event.button === 1 || event.button === 2 || this.#space || !this.onpointer)) {
        panning = { x: event.clientX, y: event.clientY, wx: this.world.x, wy: this.world.y, button: event.button };
        view.style.cursor = "grabbing";
        return;
      }
      if (event.button === 0) {
        this.onpointer?.("down", this.tile(event.clientX, event.clientY), event);
      }
    });
    view.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") {
        return touch.move(event);
      }
      if (panning) {
        this.world.position.set(panning.wx + event.clientX - panning.x, panning.wy + event.clientY - panning.y);
        return;
      }
      this.onpointer?.("move", this.tile(event.clientX, event.clientY), event);
    });
    view.addEventListener("pointercancel", (event) => event.pointerType === "touch" && touch.up(event));
    view.addEventListener("pointerup", (event) => {
      if (event.pointerType === "touch") {
        return touch.up(event);
      }
      if (panning) {
        //A right click that barely moved opens the menu instead of panning
        const click = panning.button === 2 && Math.hypot(event.clientX - panning.x, event.clientY - panning.y) < 4;
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
    view.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = view.getBoundingClientRect();
        const px = event.clientX - rect.left,
          py = event.clientY - rect.top;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
        const [dx, dy] = [event.deltaX * unit, event.deltaY * unit];
        if (event.ctrlKey || event.metaKey || !this.pannable) {
          this.zoom(Math.exp(-Math.max(-100, Math.min(100, dy)) * 0.01), px, py, false);
          return;
        }
        if (event.shiftKey && !dx) {
          this.world.x -= dy;
        } else {
          this.world.x -= dx;
          this.world.y -= dy;
        }
      },
      { passive: false },
    );
    //Safari pinch gestures (other browsers send touches, handled above)
    let gesture = 1;
    view.addEventListener("gesturestart", (event) => (event.preventDefault(), (gesture = 1)));
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
      } else if (event.key === "+" || event.key === "=") {
        this.zoom(1.25);
      } else if (event.key === "-" || event.key === "_") {
        this.zoom(0.8);
      } else if (event.key === "0" && !event.ctrlKey && !event.metaKey && this.pannable) {
        this.fit();
      }
    });
    document.addEventListener("keyup", (event) => event.key === " " && (this.#space = false));
  }
}
