//Imports
import * as PIXI from "pixi.js";
import { size } from "./assets";

/** Custom tileset (uploaded by a user, stored in the city) */
export type Tileset = { id: string; name: string; url: string; tile: number; columns: number; rows: number };

/** Loaded custom tileset */
type Loaded = Tileset & { textures: unknown[]; palette: HTMLCanvasElement; empty: Set<number> };

/** Tile values range reserved per custom tileset (built-in RSE tileset uses values below 10000) */
export const range = 10000;

/** Loaded tilesets by city tileset index */
export const custom = new Map<number, Loaded>();

/** Encode a custom tile value */
export function encode(index: number, frame: number) {
  return (index + 1) * range + frame + 1;
}

/** Decode a tile value (index -1 means built-in tileset) */
export function decode(value: number) {
  return value < range ? { index: -1, frame: value - 1 } : { index: Math.floor(value / range) - 1, frame: (value % range) - 1 };
}

/** Load an image */
function image(url: string) {
  return new Promise<HTMLImageElement>((solve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => solve(img);
    img.onerror = () => reject(new Error(`could not load tileset image ${url}`));
    img.src = url;
  });
}

/** Load (or reload) tilesets of a city */
export async function load(tilesets: Tileset[] = []) {
  custom.clear();
  await Promise.all(tilesets.map(async (tileset, index) => {
    try {
      custom.set(index, await prepare(tileset));
    } catch (error) {
      console.warn(error);
    }
  }));
}

/** Slice a tileset image into textures and a 16px palette */
export async function prepare(tileset: Tileset): Promise<Loaded> {
  const img = await image(tileset.url);
  const { tile } = tileset;
  const columns = Math.floor(img.width / tile), rows = Math.floor(img.height / tile);
  const base = PIXI.BaseTexture.from(img, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  const textures = [];
  const palette = document.createElement("canvas");
  palette.width = columns * size;
  palette.height = rows * size;
  const context = palette.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingEnabled = false;
  context.drawImage(img, 0, 0, columns * tile, rows * tile, 0, 0, palette.width, palette.height);
  const { data } = context.getImageData(0, 0, palette.width, palette.height);
  const empty = new Set<number>();
  for (let frame = 0; frame < Math.min(columns * rows, range - 2); frame++) {
    const x = frame % columns, y = Math.floor(frame / columns);
    textures.push(new PIXI.Texture(base, new PIXI.Rectangle(x * tile, y * tile, tile, tile)));
    let visible = 0;
    for (let v = 0; v < size; v++) {
      for (let u = 0; u < size; u++) {
        if (data[((y * size + v) * palette.width + x * size + u) * 4 + 3] > 16) {
          visible++;
        }
      }
    }
    if (!visible) {
      empty.add(frame);
    }
  }
  return { ...tileset, columns, rows, textures, palette, empty };
}

/** Create a sprite for a custom tile value */
export function sprite(value: number) {
  const { index, frame } = decode(value);
  const tileset = custom.get(index);
  const sprite = new PIXI.Sprite((tileset?.textures[frame] as never) ?? PIXI.Texture.EMPTY);
  if (tileset) {
    sprite.scale.set(size / tileset.tile);
  }
  return sprite;
}

/** Read a local file as a data URL */
export function dataURL(file: Blob) {
  return new Promise<string>((solve, reject) => {
    const reader = new FileReader();
    reader.onload = () => solve(`${reader.result}`);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
