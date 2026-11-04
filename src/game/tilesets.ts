//Imports
import * as PIXI from "pixi.js";
import { size } from "./assets";

/** Custom tileset (uploaded by a user, stored in the city) */
export type Tileset = { id: string; name: string; url: string; tile: number; columns: number; rows: number };

/**
 * What each tile of a tileset does (Emerald tilesets ship with it): blocked (1), walkable (0) or unknown (-1), a behavior, tall grass,
 * and the tiles whose top layer the game draws over people (tree tops, roofs), kept in a "-top" sheet next to the tileset
 */
export type Rules = { solid: number[]; behavior: number[]; grass: number[]; over?: number[] };

/** Loaded custom tileset (`tops` are the textures drawn over people, by frame) */
type Loaded = Tileset & {
  textures: unknown[];
  palette: HTMLCanvasElement;
  empty: Set<number>;
  clear: Set<number>;
  rules?: Rules;
  tops?: Map<number, PIXI.Texture>;
};

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
  await Promise.all(
    tilesets.map(async (tileset, index) => {
      try {
        custom.set(index, await prepare(tileset));
      } catch (error) {
        console.warn(error);
      }
    }),
  );
}

/** Slice a tileset image into textures and a 16px palette */
export async function prepare(tileset: Tileset): Promise<Loaded> {
  const img = await image(tileset.url);
  const { tile } = tileset;
  const columns = Math.floor(img.width / tile),
    rows = Math.floor(img.height / tile);
  const base = PIXI.BaseTexture.from(img, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  const textures = [];
  const palette = document.createElement("canvas");
  palette.width = columns * size;
  palette.height = rows * size;
  const context = palette.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingEnabled = false;
  context.drawImage(img, 0, 0, columns * tile, rows * tile, 0, 0, palette.width, palette.height);
  const { data } = context.getImageData(0, 0, palette.width, palette.height);
  const empty = new Set<number>(),
    clear = new Set<number>();
  for (let frame = 0; frame < Math.min(columns * rows, range - 2); frame++) {
    const x = frame % columns,
      y = Math.floor(frame / columns);
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
    } else if (visible < size * size) {
      clear.add(frame);
    }
  }
  //Emerald tilesets come with what their tiles do, learned from the real maps
  let rules: Rules | undefined;
  if (/^\/game\/tilesets\/emerald\/[\w-]+\.png$/.test(tileset.url)) {
    rules = await fetch(tileset.url.replace(/\.png$/, ".json"))
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined);
  }
  let tops: Map<number, PIXI.Texture> | undefined;
  if (rules?.over?.length) {
    try {
      const top = PIXI.BaseTexture.from(await image(tileset.url.replace(/\.png$/, "-top.png")), { scaleMode: PIXI.SCALE_MODES.NEAREST });
      tops = new Map(
        rules.over.map((frame) => [frame, new PIXI.Texture(top, new PIXI.Rectangle((frame % columns) * tile, Math.floor(frame / columns) * tile, tile, tile))]),
      );
    } catch (error) {
      console.warn(error);
    }
  }
  return { ...tileset, columns, rows, textures, palette, empty, clear, rules, tops };
}

/** The part of a tile drawn over people, like the game does for tree tops and roofs (null when it has none) */
export function topOf(value: number) {
  if (value < range) {
    return null;
  }
  const { index, frame } = decode(value);
  const tileset = custom.get(index);
  const texture = tileset?.tops?.get(frame);
  if (!tileset || !texture) {
    return null;
  }
  const sprite = new PIXI.Sprite(texture);
  sprite.scale.set(size / tileset.tile);
  return sprite;
}

/** What a tile of a custom tileset does, when its tileset knows (Emerald ones): null otherwise */
export function ruleOf(value: number) {
  if (value < range) {
    return null;
  }
  const { index, frame } = decode(value);
  const rules = custom.get(index)?.rules;
  return rules ? { solid: rules.solid[frame] ?? -1, behavior: rules.behavior[frame] ?? 0, grass: Boolean(rules.grass[frame]) } : null;
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
