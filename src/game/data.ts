/**
 * City data model, persistence and share links.
 *
 * Tiles are stored as `tileset frame + 1` so that `0` means "empty".
 */

//Imports
import { type Daytime, daytimes, type Period, type Weather, weathers } from "./atmosphere";
import { frames } from "./brushes";
import type { ItemId } from "./items";
import type { Nature } from "./natures";
import type { Tileset } from "./tilesets";
import type { Sprite } from "./sprites";
import { isBehavior } from "./behaviors";
import { actions as cleanActions } from "./scripts";

/** Drawable tile layers (bottom to top, player walks between decor and above) */
export const layers = ["ground", "decor", "above"] as const;
export type Layer = (typeof layers)[number];

/** Directions */
export type Direction = "up" | "down" | "left" | "right";

/** How a wild Pokémon is met: walking (in grass, caves), surfing on water, or fishing with a rod */
export type Method = "walk" | "surf" | "fish";

/** Fishing rods, from the weakest */
export const rods = ["old", "good", "super"] as const;
export type Rod = (typeof rods)[number];

/** Wild Pokémon of a zone */
export type Wild = {
  species: number;
  min: number;
  max: number;
  /** How it's met (walking when not set) */
  method?: Exclude<Method, "walk">;
  /** Only at this part of the day (any time when not set) */
  time?: Period;
  /** Fishing: the weakest rod that can hook it (any rod when not set) */
  rod?: Exclude<Rod, "old">;
};

/** Wild encounter zone */
export type Zone = {
  name: string;
  /** Encounter chance per step (0-1), walking and surfing */
  rate: number;
  /** Color used in editor overlay */
  color: number;
  creatures: Wild[];
};

/** Story step (the city timeline: main story steps in order, and the steps of each side quest) */
export type Step = {
  id: string;
  /** Side quest this step belongs to (main story when not set) */
  quest?: string;
  /** What the Journal tells the player to do while this is their next step (the step name when empty) */
  goal?: string;
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

/** Side quest: its own chain of story steps, next to the main story */
export type Quest = {
  id: string;
  name: string;
  /** Starts once this step is done (main story or another quest): its steps can't happen before */
  after?: string;
};

/** A trainer's Pokémon: species and level, and anything else chosen for it (the rest is automatic) */
export type Member = {
  species: number;
  level: number;
  held?: ItemId;
  /** Up to four moves (the last ones learned by its level when not set) */
  moves?: string[];
  /** One of its species' abilities, and a nature (random when not set) */
  ability?: string;
  nature?: Nature;
  nickname?: string;
  shiny?: boolean;
};

/** Weathers a battle can be fought in */
export const battleWeathers = ["clear", "rain", "sandstorm", "snow"] as const;

/** Rules of one trainer's battle: how they pick moves, the weather and scene (the map's when not set), and whether the bag can be used */
export type BattleRules = {
  difficulty?: Difficulty;
  weather?: (typeof battleWeathers)[number];
  scene?: Scene;
  noItems?: boolean;
};

/** How hard trainers battle */
export const difficulties = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof difficulties)[number];

/** Battle rules of a town: how smart trainers are, and the highest level Pokémon reach for each number of badges earned there */
export type Rules = { difficulty?: Difficulty; caps?: number[] };

/** Highest level a Pokémon can reach with a number of badges of the town (100 without caps, the last cap past the end of the list) */
export function levelCap(rules: Rules | undefined, badges: number) {
  const caps = rules?.caps ?? [];
  return caps.length ? Math.max(1, Math.min(100, caps[Math.min(badges, caps.length - 1)])) : 100;
}

/** Kinds of place */
export const mapTypes = ["outdoor", "indoor", "cave"] as const;
export type MapType = (typeof mapTypes)[number];

/** Kind of place a map is (outdoors, indoors or a cave) */
export function typeOf(map: City, root: City) {
  return map.type ?? (map === root || map.outdoor ? "outdoor" : "indoor");
}

/** Battle scenes from Pokémon Emerald (game/battle/<key>.png, 240×112 with the battle bases drawn in) */
export const scenes = [
  { key: "tall_grass", label: "Grass" },
  { key: "long_grass", label: "Long grass" },
  { key: "sand", label: "Sand" },
  { key: "rock", label: "Mountain" },
  { key: "cave", label: "Cave" },
  { key: "water", label: "Sea" },
  { key: "pond_water", label: "Pond" },
  { key: "underwater", label: "Underwater" },
  { key: "sky", label: "Sky" },
  { key: "building", label: "Building" },
  { key: "stadium", label: "Stadium" },
] as const;
export type Scene = (typeof scenes)[number]["key"];

/** Picture of an Emerald battle scene */
export const scenePicture = (scene: Scene) => `/game/battle/${scene}.png`;

/** Emerald battle scene of a picture (null for uploaded pictures) */
export function sceneOf(image?: string) {
  return scenes.find(({ key }) => image === scenePicture(key))?.key ?? null;
}

/** Emerald scene a battle gets when the map has no background: by the kind of place, the weather, and surfing or fishing */
export function autoScene(map: City, root: City, { water = false } = {}): Scene {
  const type = typeOf(map, root);
  if (type === "cave") return "cave";
  if (type === "indoor") return "building";
  if (water) return "water";
  return map.weather === "sandstorm" ? "sand" : "tall_grass";
}

/** Uploaded battle background: the picture, and whether platforms are drawn on it */
export type BattleBackground = { image: string; platforms: boolean };

/** Door: stepping on it moves the player to another map ("" = outside) */
export type Door = { x: number; y: number; to: string; tx: number; ty: number };

/** Someone acting in a script: a person, Pokémon or sign of the same map (their index in `npcs`), or the player */
export type Who = number | "player";

/** One thing a script does, in order (scripts run as small cutscenes: the player can't move meanwhile) */
export type Action =
  /** Show a message, said by someone of the map (or nobody, for narration) */
  | { do: "say"; text: string; who?: number }
  /** Walk some steps (blocked steps are skipped) */
  | { do: "move"; who: Who; steps: Direction[] }
  /** Turn to face a direction */
  | { do: "face"; who: Who; dir: Direction }
  /** Notice the player ("!") and walk up to them */
  | { do: "come"; who: number }
  /** Walk back to where they stand on the map */
  | { do: "back"; who: number }
  /** Wait a moment */
  | { do: "wait"; seconds: number }
  /** Give the player an item, a Pokémon or money */
  | { do: "give"; item: ItemId; count: number }
  | { do: "pokemon"; species: number; level: number }
  | { do: "money"; amount: number }
  /** Heal the party */
  | { do: "heal" }
  /** Battle a trainer of the map (or a wild Pokémon placed on it). The script stops if the player loses */
  | { do: "battle"; who: number }
  /** Complete a story step (people come and go, gates open) */
  | { do: "step"; step: string }
  /** Take the player to another map ("" = outside) and tile. Ends the script */
  | { do: "warp"; to: string; x: number; y: number };

/** Kind of action */
export type ActionKind = Action["do"];

/** What someone does when talked to, instead of their usual part */
export type Script = { actions: Action[]; once: boolean };

/** Area that runs a script when the player steps in (a cutscene, a rival running up) */
export type Trigger = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  /** Runs only the first time (per player) */
  once: boolean;
  /** Only once this step is done */
  after?: string;
  /** No more once this step is done */
  until?: string;
  actions: Action[];
};

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
  reward?: { species?: number; level?: number; balls?: number; potions?: number; money?: number };
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

/** Person, Pokémon, sign or item placed in the city */
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
  /** "wild" battles the player as a wild Pokémon (it can be caught, and is gone once beaten), "shop" runs a Poké Mart, "item" is an item ball (its `gift`) */
  role: "talk" | "trainer" | "healer" | "wild" | "shop" | "item";
  /** Items a Poké Mart clerk sells (all of them when not set) */
  shop?: ItemId[];
  /** Item handed to the player the first time they talk (or found in an item ball) */
  gift?: { item: ItemId; count: number };
  /** Item hidden on the ground instead of a ball: found by facing its tile and pressing Space */
  hidden?: boolean;
  /** Small cutscene played when talked to, instead of their usual part */
  script?: Script;
  /** Walks up to the player and talks the first time they see them (a small cutscene) */
  approach?: boolean;
  /** Wander around spawn point */
  wander: boolean;
  /** Route walked over and over, starting from where they stand (replaces wandering) */
  path?: NpcPath;
  /** Picture shown beside their dialogue instead of the default one: an uploaded image url, or "sprite:<name>" to show a map sprite */
  portrait?: string;
  /** Talk without any picture beside the dialogue box */
  hidePortrait?: boolean;
  trainer?: {
    team: Member[];
    gym: boolean;
    badge: string;
    defeat: string;
    /** What they say in the middle of the battle */
    lines?: { last?: string; low?: string };
    /** Rules of their battle, over the town's and the map's */
    rules?: BattleRules;
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
  /** Tile behavior grid: ledges, surf water, ice and push tiles (0 = normal, see behaviors.ts) */
  behavior: number[];
  /** Encounter zone grid (0 = none, n = zones[n - 1]) */
  zone: number[];
  zones: Zone[];
  /** Gate grid (0 = open, n = blocked until the step numbered n is done) */
  gate: number[];
  npcs: Npc[];
  spawn: { x: number; y: number };
  doors: Door[];
  /** Areas that run a script when stepped in */
  triggers: Trigger[];
  /** Story timeline (outside map only, shared by interiors) */
  story: Step[];
  /** Side quests, each with steps in `story` (outside map only, shared by interiors) */
  quests: Quest[];
  /** Outdoor map (route, another town) joined to the outside map where their edges touch, instead of an interior reached by doors */
  outdoor?: boolean;
  /** Position of an outdoor map on the region grid, in tiles (the outside map sits at 0, 0) */
  region?: { x: number; y: number };
  /** Interior maps (houses, Pokémon Center, gyms) and outdoor maps (routes), same shape as a city */
  interiors: City[];
  /** Custom tilesets (uploaded images) */
  tilesets?: Tileset[];
  /** Custom sprites for people and Pokémon (uploaded images) */
  sprites?: Sprite[];
  /** Custom music (uploaded files urls) */
  music?: { town?: string; battle?: string };
  /** Weather of this map, shown in play mode */
  weather?: Weather;
  /** Time of day of this map, shown in play mode */
  time?: Daytime;
  /** Battle background of this map (an uploaded picture). Maps without one use the outside map's, then the built-in scene */
  battle?: BattleBackground;
  /** What kind of place it is (its built-in battle scene): outdoors for the outside and outdoor maps, indoors for interiors, unless set */
  type?: MapType;
  /** Dark: only a little light around the player until they use Flash */
  dark?: boolean;
  /** Music of this map (an uploaded track url), the town music when not set */
  song?: string;
  /** Battle rules of the whole town (outside map only, shared by interiors) */
  rules?: Rules;
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
    behavior: new Array(size).fill(0),
    zone: new Array(size).fill(0),
    gate: new Array(size).fill(0),
    doors: [],
    triggers: [],
    story: [],
    quests: [],
    interiors: [],
    zones: [
      {
        name: "Tall grass",
        rate: 0.12,
        color: 0x2ecc40,
        creatures: [
          { species: 263, min: 2, max: 4 },
          { species: 265, min: 2, max: 4 },
          { species: 261, min: 3, max: 4 },
          { species: 280, min: 3, max: 5 },
        ],
      },
    ],
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
  city.behavior = grid(city.behavior);
  city.zone = grid(city.zone);
  city.gate = grid(city.gate);
  city.npcs = city.npcs.filter(({ x, y }) => x < width && y < height);
  city.doors = city.doors.filter(({ x, y }) => x < width && y < height);
  city.triggers = city.triggers
    .filter(({ x, y }) => x < width && y < height)
    .map((trigger) => ({ ...trigger, w: Math.min(trigger.w, width - trigger.x), h: Math.min(trigger.h, height - trigger.y) }));
  city.width = width;
  city.height = height;
  city.spawn.x = Math.min(city.spawn.x, width - 1);
  city.spawn.y = Math.min(city.spawn.y, height - 1);
}

/** Validate and fill missing fields of an imported city (interiors get the root shared fields) */
export function sanitize(raw: Partial<City>, root?: City): City {
  if (!raw || typeof raw !== "object" || !raw.width || !raw.height || !raw.layers) {
    throw new TypeError("not a valid city");
  }
  const city = blank({ width: raw.width, height: raw.height });
  const size = city.width * city.height;
  const grid = (values: unknown) => (Array.isArray(values) && values.length === size ? values.map((n) => Number(n) || 0) : new Array(size).fill(0));
  for (const layer of layers) {
    city.layers[layer] = grid(raw.layers[layer]);
  }
  city.solid = grid(raw.solid);
  city.behavior = grid(raw.behavior).map((value) => (isBehavior(value) ? value : 0));
  city.zone = grid(raw.zone);
  city.gate = grid(raw.gate);
  //Tall grass used to be painted on the ground, where its see-through edges showed black: it now stands on grass as an object
  city.layers.ground.forEach((value, i) => {
    if (value === frames.tall + 1 && !city.layers.decor[i]) {
      city.layers.decor[i] = value;
      city.layers.ground[i] = frames.grass + 1;
    }
  });
  city.zones = Array.isArray(raw.zones) ? raw.zones.filter((zone) => zone && typeof zone === "object").map(cleanZone) : city.zones;
  city.npcs = Array.isArray(raw.npcs) ? raw.npcs : [];
  city.spawn = raw.spawn ?? city.spawn;
  city.doors = Array.isArray(raw.doors) ? raw.doors.filter((door) => door && Number.isFinite(door.x) && Number.isFinite(door.y)) : [];
  city.story = Array.isArray(raw.story) ? raw.story.filter((step) => step && step.id) : [];
  city.triggers = triggers(raw.triggers, city);
  for (const npc of city.npcs) {
    if (npc?.script) {
      npc.script = { actions: cleanActions(npc.script.actions), once: npc.script.once !== false };
    }
  }
  if (weathers.some(({ key }) => key === raw.weather) && raw.weather !== "clear") {
    city.weather = raw.weather;
  }
  if (daytimes.some(({ key }) => key === raw.time) && raw.time !== "day") {
    city.time = raw.time;
  }
  if (mapTypes.includes(raw.type as MapType)) {
    city.type = raw.type;
  }
  if (raw.dark === true) {
    city.dark = true;
  }
  if (typeof raw.song === "string" && raw.song) {
    city.song = raw.song;
  }
  if (raw.battle && typeof raw.battle.image === "string" && raw.battle.image) {
    city.battle = { image: raw.battle.image, platforms: raw.battle.platforms !== false };
  }
  if (root && raw.outdoor) {
    city.outdoor = true;
    city.region = { x: Math.round(Number(raw.region?.x) || 0), y: Math.round(Number(raw.region?.y) || 0) };
  }
  city.interiors = [];
  if (root) {
    city.id = `${raw.id ?? uid()}`;
    city.name = `${raw.name ?? "Interior"}`.slice(0, 40);
    return attach(city, root);
  }
  city.quests = Array.isArray(raw.quests)
    ? raw.quests
        .filter((quest) => quest && quest.id)
        .map(({ id, name, after }) => ({ id: `${id}`, name: `${name ?? "Side quest"}`.slice(0, 40), ...(after ? { after: `${after}` } : {}) }))
    : [];
  city.interiors = Array.isArray(raw.interiors) ? raw.interiors.slice(0, 40).map((interior) => sanitize(interior, city)) : [];
  city.tilesets = Array.isArray(raw.tilesets) ? raw.tilesets : [];
  city.sprites = Array.isArray(raw.sprites) ? raw.sprites.filter((sprite) => sprite && sprite.id && sprite.url) : [];
  city.music = raw.music && typeof raw.music === "object" ? raw.music : {};
  const rules = raw.rules && typeof raw.rules === "object" ? raw.rules : null;
  if (rules) {
    const caps = Array.isArray(rules.caps) ? rules.caps.slice(0, 17).map((cap) => Math.max(1, Math.min(100, Math.round(Number(cap) || 100)))) : [];
    city.rules = {
      ...(rules.difficulty === "easy" || rules.difficulty === "hard" ? { difficulty: rules.difficulty } : {}),
      ...(caps.length ? { caps } : {}),
    };
  }
  city.id = `${raw.id ?? city.id}`;
  city.name = `${raw.name ?? city.name}`.slice(0, 40);
  city.author = `${raw.author ?? ""}`.slice(0, 40);
  city.updated = Number(raw.updated) || Date.now();
  return city;
}

/** An imported encounter zone, with only known methods, times and rods */
function cleanZone(zone: Zone): Zone {
  const creatures = (Array.isArray(zone.creatures) ? zone.creatures : [])
    .filter((wild) => wild && Number(wild.species) > 0)
    .map(({ species, min, max, method, time, rod }) => ({
      species: Number(species),
      min: Math.max(1, Math.min(100, Number(min) || 1)),
      max: Math.max(1, Math.min(100, Number(max) || Number(min) || 1)),
      ...(method === "surf" || method === "fish" ? { method } : {}),
      ...(time === "morning" || time === "day" || time === "night" ? { time } : {}),
      ...(method === "fish" && (rod === "good" || rod === "super") ? { rod } : {}),
    }));
  return {
    name: `${zone.name ?? "Zone"}`.slice(0, 40),
    rate: Math.max(0, Math.min(1, Number(zone.rate) || 0.1)),
    color: Number(zone.color) || 0x2ecc40,
    creatures,
  };
}

/** Valid triggers of an imported map (kept inside it) */
function triggers(raw: unknown, city: City): Trigger[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const int = (value: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
  return raw
    .filter((trigger) => trigger && typeof trigger === "object")
    .map((trigger: Partial<Trigger>) => {
      const x = int(trigger.x, 0, city.width - 1),
        y = int(trigger.y, 0, city.height - 1);
      return {
        id: `${trigger.id ?? uid()}`,
        x,
        y,
        w: int(trigger.w || 1, 1, city.width - x),
        h: int(trigger.h || 1, 1, city.height - y),
        name: `${trigger.name ?? "Event"}`.slice(0, 40),
        once: trigger.once !== false,
        ...(trigger.after ? { after: `${trigger.after}` } : {}),
        ...(trigger.until ? { until: `${trigger.until}` } : {}),
        actions: cleanActions(trigger.actions),
      };
    });
}

/** Make an interior share the root zones, story, tilesets and music (not serialized twice) */
function attach(interior: City, root: City) {
  for (const key of ["zones", "story", "quests", "tilesets", "sprites", "music", "author", "rules"] as const) {
    Object.defineProperty(interior, key, {
      enumerable: false,
      configurable: true,
      get: () => root[key],
      set: (value) => ((root as Record<string, unknown>)[key] = value),
    });
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

/** Create a new outdoor map (a route or another town) at a position of the region */
export function outdoor(root: City, { name = "Route", width = 20, height = 40, x = 0, y = 0 } = {}) {
  const map = blank({ width, height, name });
  map.id = uid();
  map.outdoor = true;
  map.region = { x, y };
  attach(map, root);
  root.interiors.push(map);
  return map;
}

/** Find a map of a city ("" = outside) */
export function area(root: City, id: string) {
  return id ? (root.interiors.find((map) => map.id === id) ?? null) : root;
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
  if (version !== "c1" || !payload) {
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
