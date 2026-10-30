//Imports
import * as PIXI from "pixi.js";
import type { Layer } from "./data";
import { creatureLook } from "./sprites";
import { range, sprite as custom } from "./tilesets";

/** Tileset columns (copyrighted/textures/rse/tileset.tsx) */
export const columns = 113;

/** Tileset frames count */
export const count = 6328;

/** Pixel size of a tile */
export const size = 16;

/** Pokedex entry */
export type Species = {
  id: number;
  key: string;
  name: string;
  types: string[];
  /** hp, attack, defense, special-attack, special-defense, speed */
  stats: number[];
  xp: number;
  capture: number;
  learnset: [number, string][];
};

/** Move */
export type Move = {
  name: string;
  type: string;
  power: number;
  accuracy: number;
  pp: number;
  class: "physical" | "special";
  priority: number;
};

/** Loaded assets */
export const assets = {
  /** Animated tiles */
  animated: {} as { [frame: string]: { frames: string[]; speed: number } },
  /** Frames that are unused (magenta placeholders in tileset) */
  empty: new Set<number>(),
  /** Frames that can be walked on even when placed on upper layers (learned from real maps) */
  walkable: new Set<number>(),
  /** Frames that look like water (blocked when used as ground) */
  water: new Set<number>(),
  /** Frames with see-through pixels (never put on the ground, where nothing is drawn under them) */
  clear: new Set<number>(),
  /** Frames usually on the ground or above layers in real maps (the rest are objects) */
  ground: new Set<number>(),
  above: new Set<number>(),
  /** Palette canvas (whole tileset laid out on its original grid) */
  palette: null as unknown as HTMLCanvasElement,
  /** NPC textures names */
  npcs: [] as string[],
  /** Pokedex */
  pokedex: [] as Species[],
  moves: {} as { [key: string]: Move },
  types: {} as { [attacker: string]: { [defender: string]: number } },
};

/** Load all assets */
export async function load(progress: (text: string) => void) {
  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
  PIXI.settings.ROUND_PIXELS = true;
  //Parse whole spritesheets at once (default batches of 1000 frames are deferred between frames)
  (PIXI.Spritesheet as unknown as { BATCH_SIZE: number }).BATCH_SIZE = 10000;

  const loader = PIXI.Loader.shared;
  for (const texture of ["tileset", "npcs", "creatures"]) {
    loader.add(texture, `/game/textures/rse/${texture}.json`);
  }
  loader.onProgress.add((_: unknown, { name = "" }) => progress(`loaded ${name} textures`));
  const resources = await new Promise<{ [key: string]: { spritesheet: { baseTexture: { resource: { source: HTMLImageElement } }; textures: object } } }>((solve) => loader.load((_, resources) => solve(resources as never)));

  const [tileset, pokedex, tiles] = await Promise.all([
    fetch("/game/data/textures/rse/tileset.json").then((response) => response.json()),
    fetch("/game/data/city/pokedex.json").then((response) => response.json()),
    fetch("/game/data/city/tiles.json").then((response) => response.json()),
  ]);
  progress("loaded pokedex");
  assets.animated = tileset.animated;
  assets.walkable = new Set(tiles.walkable);
  assets.ground = new Set(tiles.layers?.ground ?? []);
  assets.above = new Set(tiles.layers?.above ?? []);
  Object.assign(assets, pokedex);
  assets.npcs = [...new Set(Object.keys(resources.npcs.spritesheet.textures).filter((name) => name.endsWith("_down_0")).map((name) => name.replace(/_down_0$/, "")))]
    .filter((name) => !["boat", "oups/scientist"].includes(name)).sort();

  //Build palette and detect unused frames
  const image = resources.tileset.spritesheet.baseTexture.resource.source;
  const palette = document.createElement("canvas");
  palette.width = columns * size;
  palette.height = Math.ceil(count / columns) * size;
  const context = palette.getContext("2d", { willReadFrequently: true })!;
  const frames = (resources.tileset.spritesheet as unknown as { _frames: { [key: string]: { frame: { x: number; y: number } } } })._frames;
  for (let i = 0; i < count; i++) {
    const { x, y } = frames[i].frame;
    context.drawImage(image, x, y, size, size, (i % columns) * size, Math.floor(i / columns) * size, size, size);
  }
  const { data } = context.getImageData(0, 0, palette.width, palette.height);
  for (let i = 0; i < count; i++) {
    const px = (i % columns) * size, py = Math.floor(i / columns) * size;
    let magenta = 0, blue = 0, clear = 0;
    for (let v = 0; v < size; v++) {
      for (let u = 0; u < size; u++) {
        const j = ((py + v) * palette.width + px + u) * 4;
        const [r, g, b, a] = [data[j], data[j + 1], data[j + 2], data[j + 3]];
        if (!a) {
          clear++;
        } else if ((r > 180) && (g < 90) && (b > 180)) {
          magenta++;
        } else if ((a > 200) && (b > r + 60) && (b > g + 15)) {
          blue++;
        }
      }
    }
    if (magenta > size * size * 0.5) {
      assets.empty.add(i);
      context.clearRect(px, py, size, size);
    } else if (blue > size * size * 0.6) {
      assets.water.add(i);
    }
    if ((clear) && (!assets.empty.has(i))) {
      assets.clear.add(i);
    }
  }
  assets.palette = palette;
  progress("built tile palette");
}

/** Usual layer of built-in tiles (values are frame + 1): ground when all are ground tiles, above when most are, otherwise objects. Null for custom tilesets */
export function layerOf(values: number[]): Layer | null {
  const frames = values.filter(Boolean).map((value) => value - 1);
  if ((!frames.length) || (frames.some((frame) => frame + 1 >= range))) {
    return null;
  }
  if (frames.every((frame) => (assets.ground.has(frame)) && (!assets.clear.has(frame)))) {
    return "ground";
  }
  return frames.filter((frame) => assets.above.has(frame)).length * 2 > frames.length ? "above" : "decor";
}

/** Texture of a tile value (frame + 1) */
export function tile(value: number) {
  return PIXI.Texture.from(`${value - 1}`);
}

/** Create a display object for a tile value (frame + 1, custom tilesets use higher values) */
export function sprite(value: number) {
  if (value >= range) {
    return custom(value);
  }
  const frame = `${value - 1}`;
  let sprite;
  if (frame in assets.animated) {
    const { frames, speed } = assets.animated[frame];
    sprite = PIXI.AnimatedSprite.fromFrames(frames);
    sprite.animationSpeed = speed;
    sprite.play();
  } else {
    sprite = new PIXI.Sprite(PIXI.Texture.from(frame));
  }
  return sprite;
}

/** Texture of an NPC */
export function npc(name: string, dir = "down", frame = 0) {
  const key = `${name}_${dir}_${frame}`;
  return key in PIXI.utils.TextureCache ? PIXI.Texture.from(key) : PIXI.Texture.EMPTY;
}

/** Look up a species */
export function species(id: number) {
  return assets.pokedex[id - 1];
}

/** Creature box icon texture */
export function icon(id: number) {
  const { key } = species(id);
  for (const name of [`regular/${key}`, `regular/${key.split("-")[0]}`]) {
    if (name in PIXI.utils.TextureCache) {
      return PIXI.Texture.from(name);
    }
  }
  return PIXI.Texture.EMPTY;
}

/** PokeAPI sprites */
const sprites = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/** Battle sprite (Ruby/Sapphire for the Hoenn era, Black/White up to Unova, the latest sprites after) */
export function artwork(id: number, { back = false, shiny = false } = {}) {
  const era = id <= 386 ? "versions/generation-iii/ruby-sapphire/" : id <= 649 ? "versions/generation-v/black-white/" : "";
  return `${sprites}/${era}${back ? "back/" : ""}${shiny ? "shiny/" : ""}${id}.png`;
}

/** Overworld look of a creature placed on the map (custom sprite, packed box icon, or its PokeAPI sprite scaled to the same size) */
export function creatureSprite(id: number, look?: string) {
  const custom = creatureLook(look);
  if (custom) {
    return custom;
  }
  const texture = icon(id);
  return texture !== PIXI.Texture.EMPTY ? { texture, scale: 0.6 } : { texture: PIXI.Texture.from(`${sprites}/${id}.png`), scale: 0.4 };
}

/** Box icon of a creature for DOM previews (creatures without a packed icon use their PokeAPI sprite) */
export function portrait(id: number, scale = 1, art = "") {
  const texture = icon(id);
  if ((!art) && (texture !== PIXI.Texture.EMPTY)) {
    return preview(texture, scale);
  }
  const image = Object.assign(document.createElement("img"), { src: art || `${sprites}/${id}.png`, alt: "", loading: "lazy", draggable: false });
  Object.assign(image.style, { width: `${68 * scale}px`, height: `${56 * scale}px`, objectFit: "contain", imageRendering: "pixelated" });
  return image;
}

/** Draw a texture into a small canvas (for DOM previews) */
export function preview(texture: PIXI.Texture, scale = 2) {
  const canvas = document.createElement("canvas");
  const { x, y, width, height } = texture.frame;
  const rotated = Boolean(texture.rotate);
  canvas.width = (rotated ? height : width) * scale;
  canvas.height = (rotated ? width : height) * scale;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const source = (texture.baseTexture?.resource as { source?: CanvasImageSource } | undefined)?.source;
  if (source) {
    if (rotated) {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
      context.drawImage(source, x, y, width, height, 0, 0, width * scale, height * scale);
    } else {
      context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
    }
  }
  return canvas;
}
