//Imports
import * as PIXI from "pixi.js";

/** Custom sprite uploaded to a city (a walking sheet for people, a single image for Pokémon) */
export type Sprite = {
  id: string;
  name: string;
  url: string;
  kind: "person" | "pokemon";
  /** Layout of a person sheet */
  layout?: keyof typeof layouts;
  /** Size of one frame in pixels */
  w: number;
  h: number;
};

/** Directions of a walking sheet */
type Direction = "down" | "up" | "left" | "right";

/**
 * Person sheet layouts: direction of each row and, for each direction, the columns used
 * as the standing frame and the two walking frames (the order the game expects).
 */
export const layouts = {
  dreammist: { label: "DreamMist (3 × 4)", columns: 3, rows: ["down", "up", "left", "right"] as Direction[], frames: [0, 1, 2] },
  rpgvx: { label: "RPG Maker VX / MV (3 × 4)", columns: 3, rows: ["down", "left", "right", "up"] as Direction[], frames: [1, 0, 2] },
  rpgxp: { label: "RPG Maker XP (4 × 4)", columns: 4, rows: ["down", "left", "right", "up"] as Direction[], frames: [0, 1, 3] },
};

/** Texture name of a custom sprite (people use it as their `sprite`) */
export function key(id: string) {
  return `custom:${id}`;
}

/** Map scale of loaded custom sprites, by texture name */
const scales = new Map<string, number>();

/** Image urls of loaded custom Pokémon, by sprite id */
const images = new Map<string, string>();

/** Texture names registered by the last load */
const registered = new Set<string>();

/** Load an image */
export function image(url: string) {
  return new Promise<HTMLImageElement>((solve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => solve(img);
    img.onerror = () => reject(new Error("could not load the sprite image"));
    img.src = url;
  });
}

/** Frame size of a sheet in a layout (null when the image doesn't split evenly) */
export function frameOf(img: { width: number; height: number }, layout: keyof typeof layouts) {
  const { columns, rows } = layouts[layout];
  const w = img.width / columns, h = img.height / rows.length;
  return Number.isInteger(w) && Number.isInteger(h) ? { w, h } : null;
}

/** Register the textures of one sprite */
export async function prepare(sprite: Sprite) {
  const img = await image(sprite.url);
  const base = PIXI.BaseTexture.from(img, { scaleMode: PIXI.SCALE_MODES.NEAREST });
  const name = key(sprite.id);
  const add = (texture: PIXI.Texture, id: string) => {
    PIXI.Texture.removeFromCache(id);
    PIXI.Texture.addToCache(texture, id);
    registered.add(id);
  };
  if (sprite.kind === "pokemon") {
    add(new PIXI.Texture(base), name);
    //Fits within about two tiles on the map
    scales.set(name, Math.min(1, 32 / Math.max(img.width, img.height)));
    images.set(sprite.id, sprite.url);
    return { w: img.width, h: img.height };
  }
  const layout = layouts[sprite.layout ?? "dreammist"];
  const frame = frameOf(img, sprite.layout ?? "dreammist") ?? { w: Math.floor(img.width / layout.columns), h: Math.floor(img.height / layout.rows.length) };
  layout.rows.forEach((dir, row) => {
    layout.frames.forEach((column, index) => {
      add(new PIXI.Texture(base, new PIXI.Rectangle(column * frame.w, row * frame.h, frame.w, frame.h)), `${name}_${dir}_${index}`);
    });
  });
  //Frames are drawn one tile wide on the map
  scales.set(name, 16 / frame.w);
  return frame;
}

/** Load (or reload) the custom sprites of a city */
export async function load(sprites: Sprite[] = []) {
  for (const id of registered) {
    PIXI.Texture.removeFromCache(id);
  }
  registered.clear();
  scales.clear();
  images.clear();
  await Promise.all(sprites.filter(({ url }) => url).map((sprite) => prepare(sprite).catch(() => null)));
}

/** Map scale of a person or Pokémon texture (1 for built-in sprites) */
export function scaleOf(name: string) {
  return scales.get(name) ?? 1;
}

/** Overworld look of a custom Pokémon (null when not loaded) */
export function creatureLook(id?: string) {
  const name = id ? key(id) : "";
  return (name) && (name in PIXI.utils.TextureCache) ? { texture: PIXI.Texture.from(name), scale: scaleOf(name) } : null;
}

/** Image url of a custom Pokémon (battles and previews) */
export function creatureImage(id?: string) {
  return id ? images.get(id) ?? "" : "";
}
