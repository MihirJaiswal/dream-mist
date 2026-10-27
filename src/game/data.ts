/**
 * City data model, persistence and share links.
 *
 * Tiles are stored as `tileset frame + 1` so that `0` means "empty".
 */

//Imports
import type { Tileset } from "./tilesets";
import type { Sprite } from "./sprites";

/** Drawable tile layers (bottom to top, player walks between decor and above) */
export const layers = ["ground", "decor", "above"] as const;
export type Layer = typeof layers[number];

/** Directions */
export type Direction = "up" | "down" | "left" | "right";

/** Wild encounter zone */
export type Zone = {
  name: string;
  /** Encounter chance per step (0-1) */
  rate: number;
  /** Color used in editor overlay */
  color: number;
  creatures: { species: number; min: number; max: number }[];
};

/** Story step (the city timeline, in order) */
export type Step = {
  id: string;
  /** Stable number used by gates (kept when steps are reordered) */
  n: number;
  name: string;
  /** Message shown when bumping into a gate locked by this step */
  blocked: string;
  /** What stands in the way: an invisible wall, an object drawn on the gates, or people who leave */
  blocker?: "wall" | "object" | "person";
  /** Object tile value drawn on this step gates (blocker "object") */
  tile?: number;
};

/** Door: stepping on it moves the player to another map ("" = outside) */
export type Door = { x: number; y: number; to: string; tx: number; ty: number };

/** Person story settings (step ids) */
export type NpcStory = {
  /** Appears only once this step is done */
  after?: string;
  /** Disappears once this step is done (e.g. someone blocking a path) */
  until?: string;
  /** Needs this step before helping, says `locked` otherwise */
  requires?: string;
  locked?: string;
  /** Talking to them (or beating them) completes this step */
  completes?: string;
  /** What they say once their step is done */
  done?: string;
  /** Reward given when completing their step */
  reward?: { species?: number; level?: number; balls?: number; potions?: number };
};

/** Route of someone walking around the map */
export type NpcPath = {
  /** Stops after their starting tile */
  points: { x: number; y: number }[];
  /** At the end, go back to the start (true) or walk back the same way (false) */
  loop: boolean;
  run: boolean;
  /** Seconds waited at each stop */
  pause: number;
};

/** Person, Pokémon or sign placed in the city */
export type Npc = {
  x: number;
  y: number;
  /** NPC texture name (empty string for invisible signs and Pokémon) */
  sprite: string;
  /** Set for a Pokémon standing on the map instead of a person (`look` is a custom sprite id) */
  creature?: { species: number; level: number; look?: string };
  dir: Direction;
  name: string;
  dialogue: string;
  /** "wild" battles the player as a wild Pokémon (it can be caught, and is gone once beaten) */
  role: "talk" | "trainer" | "healer" | "wild";
  /** Wander around spawn point */
  wander: boolean;
  /** Route walked over and over, starting from where they stand (replaces wandering) */
  path?: NpcPath;
  /** Picture shown beside their dialogue instead of the default one: an uploaded image url, or "sprite:<name>" to show a map sprite */
  portrait?: string;
  /** Talk without any picture beside the dialogue box */
  hidePortrait?: boolean;
  trainer?: {
    team: { species: number; level: number }[];
    gym: boolean;
    badge: string;
    defeat: string;
  };
  story?: NpcStory;
};

/** City */
export type City = {
  v: 1;
  id: string;
  name: string;
  author: string;
  width: number;
  height: number;
  layers: Record<Layer, number[]>;
  /** Collision grid (1 = blocked) */
  solid: number[];
  /** Encounter zone grid (0 = none, n = zones[n - 1]) */
  zone: number[];
  zones: Zone[];
  /** Gate grid (0 = open, n = blocked until the step numbered n is done) */
  gate: number[];
  npcs: Npc[];
  spawn: { x: number; y: number };
  doors: Door[];
  /** Story timeline (outside map only, shared by interiors) */
  story: Step[];
  /** Interior maps (houses, Pokémon Center, gyms), same shape as a city */
  interiors: City[];
  /** Custom tilesets (uploaded images) */
  tilesets?: Tileset[];
  /** Custom sprites for people and Pokémon (uploaded images) */
  sprites?: Sprite[];
  /** Custom music (uploaded files urls) */
  music?: { town?: string; battle?: string };
  updated: number;
};

/** Generate a random identifier */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Create a blank city */
export function blank({ width = 40, height = 30, ground = 0, name = "New Town", author = "" } = {}): City {
  const size = width * height;
  return {
    v: 1,
    id: uid(),
    name,
    author,
    width,
    height,
    layers: { ground: new Array(size).fill(ground), decor: new Array(size).fill(0), above: new Array(size).fill(0) },
    solid: new Array(size).fill(0),
    zone: new Array(size).fill(0),
    gate: new Array(size).fill(0),
    doors: [],
    story: [],
    interiors: [],
    zones: [{ name: "Tall grass", rate: 0.12, color: 0x2ecc40, creatures: [{ species: 263, min: 2, max: 4 }, { species: 265, min: 2, max: 4 }, { species: 261, min: 3, max: 4 }, { species: 280, min: 3, max: 5 }] }],
    npcs: [],
    spawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
    updated: Date.now(),
  };
}

/** Resize a city (keeps content anchored top-left) */
export function resize(city: City, width: number, height: number) {
  const grid = (source: number[]) => {
    const target = new Array(width * height).fill(0);
    for (let y = 0; y < Math.min(height, city.height); y++) {
      for (let x = 0; x < Math.min(width, city.width); x++) {
        target[y * width + x] = source[y * city.width + x];
      }
    }
    return target;
  };
  for (const layer of layers) {
    city.layers[layer] = grid(city.layers[layer]);
  }
  city.solid = grid(city.solid);
  city.zone = grid(city.zone);
  city.gate = grid(city.gate);
  city.npcs = city.npcs.filter(({ x, y }) => (x < width) && (y < height));
  city.doors = city.doors.filter(({ x, y }) => (x < width) && (y < height));
  city.width = width;
  city.height = height;
  city.spawn.x = Math.min(city.spawn.x, width - 1);
  city.spawn.y = Math.min(city.spawn.y, height - 1);
}

/** Validate and fill missing fields of an imported city (interiors get the root shared fields) */
export function sanitize(raw: Partial<City>, root?: City): City {
  if ((!raw) || (typeof raw !== "object") || (!raw.width) || (!raw.height) || (!raw.layers)) {
    throw new TypeError("not a valid city");
  }
  const city = blank({ width: raw.width, height: raw.height });
  const size = city.width * city.height;
  const grid = (values: unknown) => Array.isArray(values) && values.length === size ? values.map((n) => Number(n) || 0) : new Array(size).fill(0);
  for (const layer of layers) {
    city.layers[layer] = grid(raw.layers[layer]);
  }
  city.solid = grid(raw.solid);
  city.zone = grid(raw.zone);
  city.gate = grid(raw.gate);
  city.zones = Array.isArray(raw.zones) ? raw.zones : city.zones;
  city.npcs = Array.isArray(raw.npcs) ? raw.npcs : [];
  city.spawn = raw.spawn ?? city.spawn;
  city.doors = Array.isArray(raw.doors) ? raw.doors.filter((door) => door && Number.isFinite(door.x) && Number.isFinite(door.y)) : [];
  city.story = Array.isArray(raw.story) ? raw.story.filter((step) => step && step.id) : [];
  city.interiors = [];
  if (root) {
    city.id = `${raw.id ?? uid()}`;
    city.name = `${raw.name ?? "Interior"}`.slice(0, 40);
    return attach(city, root);
  }
  city.interiors = Array.isArray(raw.interiors) ? raw.interiors.slice(0, 40).map((interior) => sanitize(interior, city)) : [];
  city.tilesets = Array.isArray(raw.tilesets) ? raw.tilesets : [];
  city.sprites = Array.isArray(raw.sprites) ? raw.sprites.filter((sprite) => sprite && sprite.id && sprite.url) : [];
  city.music = (raw.music && typeof raw.music === "object") ? raw.music : {};
  city.id = `${raw.id ?? city.id}`;
  city.name = `${raw.name ?? city.name}`.slice(0, 40);
  city.author = `${raw.author ?? ""}`.slice(0, 40);
  city.updated = Number(raw.updated) || Date.now();
  return city;
}

/** Make an interior share the root zones, story, tilesets and music (not serialized twice) */
function attach(interior: City, root: City) {
  for (const key of ["zones", "story", "tilesets", "sprites", "music", "author"] as const) {
    Object.defineProperty(interior, key, { enumerable: false, configurable: true, get: () => root[key], set: (value) => (root as Record<string, unknown>)[key] = value });
  }
  delete (interior as Partial<City>).interiors;
  Object.defineProperty(interior, "interiors", { enumerable: false, configurable: true, value: [] });
  return interior;
}

/** Create a new interior map */
export function interior(root: City, { name = "House", width = 14, height = 10, floor = 0, wall = 0 } = {}) {
  const map = blank({ width, height, ground: floor, name });
  map.id = uid();
  for (let x = 0; x < width; x++) {
    for (const y of [0, 1, height - 1]) {
      if (wall) {
        map.layers.ground[y * width + x] = wall;
      }
      map.solid[y * width + x] = 1;
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      map.solid[y * width + x] = 1;
    }
  }
  map.spawn = { x: Math.floor(width / 2), y: height - 2 };
  attach(map, root);
  root.interiors.push(map);
  return map;
}

/** Find a map of a city ("" = outside) */
export function area(root: City, id: string) {
  return id ? root.interiors.find((map) => map.id === id) ?? null : root;
}

/** Base64url helpers */
function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromBase64(text: string) {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Pipe bytes through a (de)compression stream */
async function stream(bytes: Uint8Array, transform: CompressionStream | DecompressionStream) {
  const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(transform));
  return new Uint8Array(await response.arrayBuffer());
}

/** Encode a city into a compact share code */
export async function encode(city: City) {
  const bytes = new TextEncoder().encode(JSON.stringify(city));
  return `c1.${toBase64(await stream(bytes, new CompressionStream("deflate-raw")))}`;
}

/** Decode a share code into a city */
export async function decode(code: string) {
  const [version, payload] = code.split(".");
  if ((version !== "c1") || (!payload)) {
    throw new TypeError("unsupported city code");
  }
  const bytes = await stream(fromBase64(payload), new DecompressionStream("deflate-raw"));
  return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Share link */
export async function link(city: City, mode: "visit" | "remix" = "visit") {
  return `${location.origin}${location.pathname}#${mode}=${await encode(city)}`;
}

/** Local storage (wrapped as it may be unavailable) */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(`dreammist.${key}`);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(`dreammist.${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

/** Saved cities */
export const library = {
  list() {
    return Object.values(storage.get<Record<string, City>>("library", {})).sort((a, b) => b.updated - a.updated);
  },
  save(city: City) {
    const cities = storage.get<Record<string, City>>("library", {});
    city.updated = Date.now();
    cities[city.id] = city;
    return storage.set("library", cities);
  },
  remove(id: string) {
    const cities = storage.get<Record<string, City>>("library", {});
    delete cities[id];
    storage.set("library", cities);
  },
};
