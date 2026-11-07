/**
 * Map generator: towns and routes laid out like Hoenn's, from a seed (the same seed makes the same map).
 *
 * Towns: a tree border open where roads leave, sand roads joining every exit, a Pokémon Center, a Poké Mart and houses
 * whose doors each get a path to the road, flowers, a town sign, a couple of villagers and a tall-grass patch.
 * Routes: a long winding path between tree walls, tall-grass patches (one across the path), ledges hopped back towards the entrance,
 * trainers watching the path, item balls in the corners, a hidden item, a berry tree and a sign.
 *
 * Everything is placed on a plan first and checked for reachability there, so doors, exits, people and items can always be walked to.
 * Routes are planned upright (entrance at the bottom) and turned to face the side they join.
 */

//Imports
import { ledge } from "./behaviors";
import { frames, stamp, terrains } from "./brushes";
import type { Period } from "./atmosphere";
import type { City, Direction, Npc, Wild, Zone } from "./data";
import type { ItemId } from "./items";
import type { Side } from "./region";

export type MapKind = "town" | "route";

/** A building with a door; `room` is the Emerald interior to make for it (see interiors.ts) */
export type Building = { room: "center" | "mart" | "house" | "house-2" | "house-3"; door: { x: number; y: number } };

/** What was generated, for furnishing and checks */
export type Generated = {
  /** Exits: the side of the map and its open edge tiles */
  exits: { side: Side; tiles: { x: number; y: number }[] }[];
  buildings: Building[];
};

export type Options = {
  kind: MapKind;
  seed: string;
  /** Edge of the map facing the map it joins (bottom when not set) */
  entrance?: Side;
  /** Positions along the entrance edge that are open on the other map (the entrance lines up with them) */
  openings?: number[];
  /** Wild Pokémon level (trainers are a little stronger) */
  level?: number;
};

/** Random numbers from a seed (mulberry32 over a hash of the text) */
export function random(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const even = (min: number, max: number) => 2 * int(Math.ceil(min / 2), Math.floor(max / 2));
  const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)];
  const chance = (p: number) => next() < p;
  const shuffle = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  return { next, int, even, pick, chance, shuffle };
}
type Random = ReturnType<typeof random>;

/** A new random seed, short enough to read out */
export function newSeed() {
  return Math.random().toString(36).slice(2, 8);
}

/** Size of a generated map (even, so trees line up); routes run away from the side they join */
export function sizeOf(kind: MapKind, entrance: Side, seed: string) {
  const rng = random(`${seed}:size`);
  if (kind === "town") {
    return { width: rng.pick([32, 34, 36]), height: rng.pick([26, 28, 30]) };
  }
  const [breadth, length] = [rng.pick([20, 22, 24]), rng.pick([40, 44, 48])];
  return entrance === "up" || entrance === "down" ? { width: breadth, height: length } : { width: length, height: breadth };
}

/** Town names in the style of Hoenn's (two halves, one of them a little nature word) */
const firsts = ["Moss", "Fern", "Cedar", "Amber", "Willow", "Pebble", "Thistle", "Brook", "Ashen", "Mist", "Clover", "Dew", "Sorrel", "Briar", "Hazel", "Lark"];
const lasts = ["dale", "brook", "root", "vale", "ford", "wick", "haven", "shore", "glen", "field", "hollow", "mere"];
export function townName(seed: string) {
  const rng = random(`${seed}:name`);
  return `${rng.pick(firsts)}${rng.pick(lasts)} ${rng.pick(["Town", "Town", "City"])}`;
}

/** Wild Pokémon of early Hoenn grass, and the ones that only show up at some part of the day (like CFRU's day and night tables) */
const wilds = [263, 261, 265, 270, 273, 276, 278, 283, 285, 287, 290, 293, 300, 309, 43, 183];
const rare = [280, 296, 299, 311, 312, 315];
const timed: { species: number; time: Period }[] = [
  { species: 163, time: "night" },
  { species: 41, time: "night" },
  { species: 165, time: "morning" },
  { species: 167, time: "night" },
];

/** An encounter zone for a generated map */
function wildZone(rng: Random, name: string, level: number, rate: number, color: number): Zone {
  const species = rng.shuffle([...wilds]).slice(0, rng.int(3, 4));
  const creatures: Wild[] = species.map((species) => ({ species, min: level, max: level + 2 }));
  creatures.push({ species: rng.pick(rare), min: level + 1, max: level + 2 });
  const late = rng.pick(timed);
  creatures.push({ species: late.species, min: level, max: level + 2, time: late.time });
  return { name, rate, color, creatures };
}

/** Trainer classes seen along Hoenn's early routes */
const classes = [
  { sprite: "youngster", title: "Youngster", names: ["Joey", "Calvin", "Ben", "Tyler", "Josh"], line: "My Pokémon and I train on this route every day!" },
  { sprite: "lass", title: "Lass", names: ["Tiana", "Haley", "Janice", "Crissy"], line: "You looked at me! That means we battle!" },
  { sprite: "bug_catcher", title: "Bug Catcher", names: ["Rick", "Doug", "Greg", "Kent"], line: "I caught these Pokémon right in this grass!" },
  { sprite: "schoolkid_m", title: "School Kid", names: ["Jerry", "Ted", "Paul"], line: "I learned about type matchups at school. Let me show you!" },
  { sprite: "schoolkid_f", title: "School Kid", names: ["Karen", "Sarah", "Georgia"], line: "Let's see what you learned on your journey!" },
  { sprite: "pokefan", title: "Pokéfan", names: ["Isabel", "Miguel", "Vanessa"], line: "Isn't my Pokémon just the cutest? Let's battle!" },
  { sprite: "hiker", title: "Hiker", names: ["Mike", "Clark", "Lenny"], line: "The trees here remind me of the mountains. Hah!" },
  { sprite: "twin", title: "Twins", names: ["Amy & Liv", "Gina & Mia"], line: "We'll show you our teamwork!" },
];

/** Items lying around routes */
const balls: ItemId[] = ["potion", "poke-ball", "antidote", "super-potion", "repel", "paralyze-heal", "escape-rope", "great-ball", "awakening"];
const hiddenItems: ItemId[] = ["potion", "poke-ball", "rare-candy", "super-potion", "full-heal", "escape-rope"];

/** Ledge look: the edge of the light-grass terrain facing the way it's jumped (the RSE sheet has no ledge tiles of its own) */
const meadow = terrains.find(({ id }) => id === "meadow")!.tiles;
const ledgeTile: Record<Direction, number> = { down: meadow[7], up: meadow[1], left: meadow[3], right: meadow[5] };
const ledgeValue: Record<Direction, number> = { down: 1, up: 2, left: 3, right: 4 };

const GRASS = frames.grass + 1,
  SAND = frames.sand + 1,
  TALL = frames.tall + 1,
  FLOWERS = 659;

/** Buildings: brush, size, door (column, row from the top-left) and interior */
const shapes = {
  center: { brush: "Pokémon Center", w: 4, h: 4, door: [1, 3], room: "center" },
  mart: { brush: "Poké Mart", w: 4, h: 4, door: [1, 3], room: "mart" },
  house: { brush: "House", w: 5, h: 5, door: [3, 4], room: "house-2" },
  small: { brush: "Small house", w: 4, h: 4, door: [1, 3], room: "house" },
} as const;

/**
 * A layout on a grid (u across, v along), before it becomes tiles.
 * `wall` marks what blocks (trees, buildings, signs, people), `road` sand, `keep` tiles that must stay free of anything solid,
 * `used` tiles already holding something (grass, flowers, ledges, items) and `shade` tiles that a tree crown may cover
 */
class Plan {
  wall: Uint8Array;
  road: Uint8Array;
  keep: Uint8Array;
  used: Uint8Array;
  shade: Uint8Array;
  tall: Uint8Array;
  flowers: Uint8Array;
  ledges: Uint8Array;
  trees: { u: number; v: number }[] = [];
  buildings: { kind: keyof typeof shapes; u: number; v: number }[] = [];
  signs: { u: number; v: number; text: string }[] = [];
  people: (Omit<Npc, "x" | "y" | "dir"> & { u: number; v: number; face: Direction })[] = [];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    const size = w * h;
    this.wall = new Uint8Array(size);
    this.road = new Uint8Array(size);
    this.keep = new Uint8Array(size);
    this.used = new Uint8Array(size);
    this.shade = new Uint8Array(size);
    this.tall = new Uint8Array(size);
    this.flowers = new Uint8Array(size);
    this.ledges = new Uint8Array(size);
  }
  in(u: number, v: number) {
    return u >= 0 && v >= 0 && u < this.w && v < this.h;
  }
  at(u: number, v: number) {
    return v * this.w + u;
  }
  /** Nothing at all on these tiles */
  empty(u: number, v: number, w = 1, h = 1) {
    for (let j = v; j < v + h; j++) {
      for (let i = u; i < u + w; i++) {
        if (!this.in(i, j)) {
          return false;
        }
        const k = this.at(i, j);
        if (this.wall[k] || this.road[k] || this.keep[k] || this.used[k]) {
          return false;
        }
      }
    }
    return true;
  }
  /** A tree whose crown and trunk fill u..u+1, v..v+1 (its crown top hangs over the row above) */
  tree(u: number, v: number) {
    this.trees.push({ u, v });
    for (let j = v - 1; j <= v + 2; j++) {
      for (let i = u - 1; i <= u + 2; i++) {
        if (this.in(i, j)) {
          const inside = i >= u && i <= u + 1 && j >= v && j <= v + 1;
          this[inside ? "wall" : "shade"][this.at(i, j)] = 1;
        }
      }
    }
  }
  /** A tree in open ground (keeps away from everything but other trees) */
  freeTree(u: number, v: number) {
    for (let j = v - 1; j <= v + 2; j++) {
      for (let i = u - 1; i <= u + 2; i++) {
        if (!this.in(i, j)) {
          return false;
        }
        const k = this.at(i, j);
        const inside = i >= u && i <= u + 1 && j >= v && j <= v + 1;
        if (this.road[k] || this.keep[k] || this.used[k] || (inside && this.wall[k])) {
          return false;
        }
      }
    }
    return true;
  }
  sand(u: number, v: number, w = 1, h = 1) {
    for (let j = v; j < v + h; j++) {
      for (let i = u; i < u + w; i++) {
        if (this.in(i, j)) {
          this.road[this.at(i, j)] = 1;
        }
      }
    }
  }
  /** Tiles reachable from a tile, through anything not blocked (ledges block both ways here, which only makes the check stricter) */
  reach(from: { u: number; v: number }, extra?: Set<number>) {
    const seen = new Uint8Array(this.w * this.h);
    const blocked = (k: number) => this.wall[k] || this.ledges[k] || extra?.has(k);
    const start = this.at(from.u, from.v);
    if (blocked(start)) {
      return seen;
    }
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const k = queue.pop()!;
      const [u, v] = [k % this.w, Math.floor(k / this.w)];
      for (const [du, dv] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const [i, j] = [u + du, v + dv];
        if (this.in(i, j) && !seen[this.at(i, j)] && !blocked(this.at(i, j))) {
          seen[this.at(i, j)] = 1;
          queue.push(this.at(i, j));
        }
      }
    }
    return seen;
  }
}

/** Is a tile next to a reached one */
function beside(plan: Plan, seen: Uint8Array, u: number, v: number) {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([du, dv]) => plan.in(u + du, v + dv) && seen[plan.at(u + du, v + dv)]);
}

/**
 * Put something solid on the plan only if the tiles that must stay reachable still are
 * (`must` are tiles to stand on, `near` are people and things talked to from a tile beside them)
 */
function solid(
  plan: Plan,
  spawn: { u: number; v: number },
  must: { u: number; v: number }[],
  near: { u: number; v: number }[],
  tiles: { u: number; v: number }[],
) {
  const extra = new Set(tiles.map(({ u, v }) => plan.at(u, v)));
  const seen = plan.reach(spawn, extra);
  const ok = must.every(({ u, v }) => seen[plan.at(u, v)]) && near.every(({ u, v }) => beside(plan, seen, u, v));
  if (ok) {
    for (const k of extra) {
      plan.wall[k] = 1;
    }
  }
  return ok;
}

/** Fill a map with a generated town or route; wild Pokémon go into `zones` (shared by the whole city) */
export function generate(map: City, zones: Zone[], options: Options): Generated {
  const { kind, seed, entrance = "down", openings = [], level = kind === "town" ? 3 : 4 } = options;
  const rng = random(`${seed}:${kind}`);
  const color = [0x2ecc40, 0x0074d9, 0xff851b, 0xb10dc9, 0xffdc00, 0x39cccc][zones.length % 6];
  zones.push(wildZone(rng, `${map.name} grass`, level, kind === "town" ? 0.1 : 0.12, color));
  const zone = zones.length;
  //Start over
  const size = map.width * map.height;
  map.layers = { ground: new Array(size).fill(GRASS), decor: new Array(size).fill(0), above: new Array(size).fill(0) };
  for (const grid of ["solid", "behavior", "zone", "gate"] as const) {
    map[grid] = new Array(size).fill(0);
  }
  map.npcs = [];
  map.doors = [];
  map.triggers = [];
  return kind === "town" ? town(map, rng, zone, level, entrance, openings) : route(map, rng, zone, level, entrance, openings);
}

/** Along-the-edge position of an exit: in line with the other map's open tiles when there are some, else `fallback` (always even) */
function line(openings: number[], min: number, max: number, fallback: number) {
  const open = new Set(openings);
  const fits = [] as number[];
  for (let p = min; p <= max; p += 2) {
    if (open.has(p) && open.has(p + 1)) {
      fits.push(p);
    }
  }
  if (!fits.length) {
    for (let p = min; p <= max; p += 2) {
      if (open.has(p) || open.has(p + 1)) {
        fits.push(p);
      }
    }
  }
  return fits.length ? fits[Math.floor(fits.length / 2)] : fallback;
}

const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;
const sides: Side[] = ["up", "right", "down", "left"];

function town(map: City, rng: Random, zone: number, level: number, entrance: Side, openings: number[]): Generated {
  const { width: W, height: H } = map;
  const plan = new Plan(W, H);
  //Exits: the way in, and one or two more for the roads onward
  const others = rng.shuffle(sides.filter((side) => side !== entrance));
  const out = [entrance, ...others.slice(0, rng.int(1, 2))];
  const exits = out.map((side) => {
    const across = side === "up" || side === "down";
    const [min, max] = across ? [6, W - 8] : [4, H - 8];
    const fallback = across ? 2 * Math.floor(W / 4) - 2 * rng.int(-1, 1) : 2 * Math.floor(H / 4) - 2 * rng.int(-1, 0);
    const at = side === entrance ? line(openings, min, max, Math.min(max, Math.max(min, fallback))) : rng.even(min, max);
    return { side, at };
  });
  const gap = (side: Side, a: number) =>
    exits.some((exit) => exit.side === side && (side === "up" || side === "down" ? a === exit.at : a === exit.at || a === exit.at + 2));
  const near = (side: Side, a: number) => exits.some((exit) => exit.side === side && Math.abs(a - exit.at) <= 4);
  //Tree border, with trees stepping in here and there like Hoenn's woods
  for (let x = 0; x < W; x += 2) {
    if (!gap("up", x)) plan.tree(x, 0);
    if (!gap("down", x)) plan.tree(x, H - 2);
  }
  for (let y = 2; y < H - 2; y += 2) {
    if (!gap("left", y)) plan.tree(0, y);
    if (!gap("right", y)) plan.tree(W - 2, y);
  }
  for (let x = 2; x < W - 2; x += 2) {
    if (rng.chance(0.3) && !near("up", x)) plan.tree(x, 2);
    if (rng.chance(0.3) && !near("down", x)) plan.tree(x, H - 4);
  }
  for (let y = 4; y < H - 4; y += 2) {
    if (rng.chance(0.3) && !near("left", y)) plan.tree(2, y);
    if (rng.chance(0.3) && !near("right", y)) plan.tree(W - 4, y);
  }
  //Roads: a main street through the middle, with a road out to each exit
  const jx = rng.even(W / 2 - 4, W / 2 + 2),
    jy = rng.even(H / 2 - 3, H / 2 + 1);
  let [x0, x1] = [jx - rng.even(6, 8), jx + 1 + rng.even(6, 8)];
  for (const { side, at } of exits) {
    if (side === "up") plan.sand(at, 0, 2, jy + 2);
    if (side === "down") plan.sand(at, jy, 2, H - jy);
    if (side === "up" || side === "down") [x0, x1] = [Math.min(x0, at), Math.max(x1, at + 1)];
    if (side === "left" || side === "right") {
      const [a, b] = side === "left" ? [0, jx + 1] : [jx, W - 1];
      plan.sand(a, at, b - a + 1, 2);
      plan.sand(jx, Math.min(at, jy), 2, Math.abs(at - jy) + 2);
    }
  }
  x0 = Math.max(4, x0);
  x1 = Math.min(W - 5, x1);
  plan.sand(x0, jy, x1 - x0 + 1, 2);
  const spawn = { u: jx, v: jy + 1 };
  const ends = exits.map(({ side, at }) =>
    side === "up" ? { u: at, v: 0 } : side === "down" ? { u: at, v: H - 1 } : side === "left" ? { u: 0, v: at } : { u: W - 1, v: at },
  );
  const fronts = [] as { u: number; v: number }[];
  //Buildings: the Pokémon Center and Poké Mart first, then houses, each as close to a road as it fits, with a path from its door
  const list: (keyof typeof shapes)[] = ["center", "mart", ...Array.from({ length: rng.int(2, 4) }, () => rng.pick(["house", "small", "small"] as const))];
  const buildings: Building[] = [];
  for (const kind of list) {
    const shape = shapes[kind];
    //Distance of every tile to a road, walking around what is already there
    const distance = new Int16Array(W * H).fill(-1);
    const parent = new Int32Array(W * H).fill(-1);
    const queue = [] as number[];
    plan.road.forEach((on, k) => {
      if (on) {
        distance[k] = 0;
        queue.push(k);
      }
    });
    for (let head = 0; head < queue.length; head++) {
      const k = queue[head];
      const [u, v] = [k % W, Math.floor(k / W)];
      for (const [du, dv] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = plan.at(u + du, v + dv);
        if (plan.in(u + du, v + dv) && distance[n] < 0 && !plan.wall[n] && !plan.used[n]) {
          distance[n] = distance[k] + 1;
          parent[n] = k;
          queue.push(n);
        }
      }
    }
    const spots = [] as { u: number; v: number; score: number }[];
    for (let v = 2; v + shape.h + 1 < H - 2; v++) {
      for (let u = 2; u + shape.w < W - 2; u++) {
        //The building and a ring around it are clear, the door opens onto free ground
        const front = { u: u + shape.door[0], v: v + shape.door[1] + 1 };
        let clear = true;
        for (let j = v - 1; j <= v + shape.h && clear; j++) {
          for (let i = u - 1; i <= u + shape.w && clear; i++) {
            const k = plan.at(i, j);
            const inside = i >= u && i < u + shape.w && j >= v && j < v + shape.h;
            clear = !plan.wall[k] && !plan.used[k] && !(inside && (plan.road[k] || plan.keep[k] || plan.shade[k]));
          }
        }
        const reach = distance[plan.at(front.u, front.v)];
        if (clear && reach >= 0) {
          spots.push({ u, v, score: reach + rng.next() * 3 });
        }
      }
    }
    spots.sort((a, b) => a.score - b.score);
    for (const { u, v } of spots.slice(0, 30)) {
      const front = { u: u + shape.door[0], v: v + shape.door[1] + 1 };
      const footprint = [] as { u: number; v: number }[];
      for (let j = v; j < v + shape.h; j++) {
        for (let i = u; i < u + shape.w; i++) {
          if (i !== front.u || j !== front.v - 1) {
            footprint.push({ u: i, v: j });
          }
        }
      }
      //The path from the door runs along the shortest way to a road; it must not cross the building itself
      const path = [] as number[];
      for (let k = plan.at(front.u, front.v); k >= 0 && !plan.road[k]; k = parent[k]) {
        path.push(k);
      }
      if (path.some((k) => footprint.some((tile) => plan.at(tile.u, tile.v) === k))) {
        continue;
      }
      if (!solid(plan, spawn, [...ends, ...fronts, front], [], footprint)) {
        continue;
      }
      for (const k of path) {
        plan.road[k] = 1;
      }
      for (let j = v - 1; j <= v + shape.h; j++) {
        for (let i = u - 1; i <= u + shape.w; i++) {
          plan.keep[plan.at(i, j)] = 1;
        }
      }
      plan.buildings.push({ kind, u, v });
      fronts.push(front);
      buildings.push({ room: kind === "small" ? rng.pick(["house", "house-3"] as const) : shape.room, door: { x: front.u, y: front.v - 1 } });
      break;
    }
  }
  //Tall grass: a patch away from the roads (wild Pokémon live in town too)
  for (let tries = 0; tries < 400; tries++) {
    const [w, h] = tries < 300 ? [rng.int(5, 8), rng.int(3, 5)] : [rng.int(3, 4), rng.int(2, 3)];
    const u = rng.int(2, W - 3 - w),
      v = rng.int(2, H - 3 - h);
    if (plan.empty(u, v, w, h)) {
      for (let j = v; j < v + h; j++) {
        for (let i = u; i < u + w; i++) {
          plan.tall[plan.at(i, j)] = plan.used[plan.at(i, j)] = 1;
        }
      }
      break;
    }
  }
  //A few trees in open ground
  for (let tries = 0, placed = 0; tries < 200 && placed < rng.int(2, 5); tries++) {
    const u = rng.even(4, W - 6),
      v = rng.even(4, H - 6);
    const tiles = [0, 1].flatMap((i) => [0, 1].map((j) => ({ u: u + i, v: v + j })));
    if (plan.freeTree(u, v) && solid(plan, spawn, [...ends, ...fronts], [], tiles)) {
      plan.tree(u, v);
      placed++;
    }
  }
  //The town sign, by the road a few steps in from the entrance
  const sign = signSpot(plan, exits[0].side, exits[0].at, spawn, [...ends, ...fronts]);
  if (sign) {
    plan.signs.push({ ...sign, text: `${map.name}\n\nA quiet place where every road begins.` });
  }
  flowers(plan, rng, rng.int(4, 7));
  //Villagers wandering about
  const chats = [
    "The tall grass by town is full of wild Pokémon. Heal up at the Pokémon Center first!",
    "The Poké Mart sells Poké Balls. You'll want plenty of those!",
    "Some trainers on the routes can't resist a battle once they've seen you.",
    "Have you checked the ground near the trees? People drop things all the time.",
  ];
  for (let tries = 0, placed = 0; tries < 200 && placed < 2; tries++) {
    const u = rng.int(3, W - 4),
      v = rng.int(3, H - 4);
    if (plan.empty(u, v) && solid(plan, spawn, [...ends, ...fronts], [{ u, v }], [{ u, v }])) {
      plan.used[plan.at(u, v)] = 1;
      plan.people.push({
        u,
        v,
        face: "down",
        sprite: rng.pick(["generic_m1", "generic_f1", "generic_m2", "generic_f2", "generic_c1"]),
        name: "Villager",
        dialogue: chats[placed * 2 + rng.int(0, 1)],
        role: "talk",
        wander: true,
      });
      placed++;
    }
  }
  draw(map, plan, (u, v) => ({ x: u, y: v }), "down", zone);
  //Doors: walkable, leading nowhere until their interiors are made
  for (const { door } of buildings) {
    map.doors.push({ x: door.x, y: door.y, to: "?", tx: -1, ty: -1 });
    map.solid[door.y * W + door.x] = 0;
  }
  map.spawn = { x: spawn.u, y: spawn.v };
  return {
    exits: exits.map(({ side, at }) => ({ side, tiles: edgeTiles(map, side, at) })),
    buildings,
  };
}

/** The two road tiles of an exit on the map's edge */
function edgeTiles({ width: W, height: H }: City, side: Side, at: number) {
  return [at, at + 1].map((a) =>
    side === "up" ? { x: a, y: 0 } : side === "down" ? { x: a, y: H - 1 } : side === "left" ? { x: 0, y: a } : { x: W - 1, y: a },
  );
}

/** A free tile beside the road leading in from an exit, a few steps from the edge */
function signSpot(plan: Plan, side: Side, at: number, spawn: { u: number; v: number }, must: { u: number; v: number }[]) {
  const { w: W, h: H } = plan;
  const tries = [3, 4, 5, 6, 2].flatMap((step) => {
    const v = side === "up" ? step : side === "down" ? H - 1 - step : 0;
    const u = side === "left" ? step : side === "right" ? W - 1 - step : 0;
    return side === "up" || side === "down"
      ? [
          { u: at - 1, v },
          { u: at + 2, v },
        ]
      : [
          { u, v: at - 1 },
          { u, v: at + 2 },
        ];
  });
  for (const tile of tries) {
    if (plan.empty(tile.u, tile.v) && !plan.shade[plan.at(tile.u, tile.v)] && solid(plan, spawn, must, [tile], [tile])) {
      plan.used[plan.at(tile.u, tile.v)] = 1;
      return tile;
    }
  }
  return null;
}

/** Little groups of flowers on free ground */
function flowers(plan: Plan, rng: Random, groups: number) {
  for (let tries = 0, placed = 0; tries < 300 && placed < groups; tries++) {
    const [w, h] = rng.pick([
      [2, 1],
      [3, 1],
      [2, 2],
      [1, 2],
    ]);
    const u = rng.int(2, plan.w - 3 - w),
      v = rng.int(2, plan.h - 3 - h);
    if (plan.empty(u, v, w, h)) {
      for (let j = v; j < v + h; j++) {
        for (let i = u; i < u + w; i++) {
          plan.flowers[plan.at(i, j)] = plan.used[plan.at(i, j)] = 1;
        }
      }
      placed++;
    }
  }
}

function route(map: City, rng: Random, zone: number, level: number, entrance: Side, openings: number[]): Generated {
  //Planned upright: across (u) is the route's breadth, along (v) its length, the entrance at the bottom
  const upright = entrance === "up" || entrance === "down";
  const [B, L] = upright ? [map.width, map.height] : [map.height, map.width];
  const turn = {
    down: (u: number, v: number) => ({ x: u, y: v }),
    up: (u: number, v: number) => ({ x: u, y: L - 1 - v }),
    right: (u: number, v: number) => ({ x: v, y: u }),
    left: (u: number, v: number) => ({ x: L - 1 - v, y: u }),
  }[entrance];
  const plan = new Plan(B, L);
  //The path: from the entrance, straight runs joined by bends, to the far exit
  const [min, max] = [4, B - 6];
  const start = line(openings, min, max, rng.even(min, max));
  const bends = rng.int(2, 3);
  const columns = [start, ...Array.from({ length: bends }, () => rng.even(min, max))];
  const rows = [L - 1];
  for (let i = 1; i <= bends; i++) {
    rows.push(2 * Math.round(((L - 1) * (1 - i / (bends + 1)) + rng.int(-3, 3)) / 2));
  }
  rows.push(0);
  const straight = new Uint8Array(L);
  for (let i = 0; i < columns.length; i++) {
    const [top, bottom] = [rows[i + 1], rows[i]];
    plan.sand(columns[i], top, 2, bottom - top + 1);
    for (let v = top + 3; v <= bottom - 3; v++) {
      straight[v] = columns[i] + 1;
    }
    if (i + 1 < columns.length) {
      const [a, b] = [Math.min(columns[i], columns[i + 1]), Math.max(columns[i], columns[i + 1])];
      plan.sand(a, top, b - a + 2, 2);
    }
  }
  const far = columns[columns.length - 1];
  //Trees: along both sides, across both ends (open where the path leaves), and stepping in now and then
  for (let v = 0; v < L; v += 2) {
    plan.tree(0, v);
    plan.tree(B - 2, v);
  }
  for (let u = 2; u < B - 2; u += 2) {
    if (u !== far) plan.tree(u, 0);
    if (u !== start) plan.tree(u, L - 2);
  }
  for (let v = 2; v < L - 2; v += 2) {
    for (const u of [2, B - 4]) {
      if (rng.chance(0.35) && plan.freeTree(u, v)) {
        plan.tree(u, v);
      }
    }
  }
  const spawn = { u: start, v: L - 3 };
  const ends = [
    { u: start, v: L - 1 },
    { u: far, v: 0 },
  ];
  const must = [...ends];
  //Tall grass: one patch across the path (no way around it, like Route 101), then patches beside it
  const across = (v: number) => straight[v] - 1;
  const crossings = [] as number[];
  for (let v = 6; v < L - 8; v++) {
    if (straight[v] && straight[v + 4] && across(v) === across(v + 4)) {
      crossings.push(v);
    }
  }
  const patch = (u: number, v: number, w: number, h: number, overRoad = false) => {
    for (let j = v; j < v + h; j++) {
      for (let i = u; i < u + w; i++) {
        const k = plan.at(i, j);
        if (overRoad && plan.road[k]) {
          plan.road[k] = 0;
          plan.keep[k] = 1;
        }
        plan.tall[k] = plan.used[k] = 1;
      }
    }
  };
  if (crossings.length) {
    const v = rng.pick(crossings);
    const c = across(v);
    const [u0, u1] = [Math.max(2, c - rng.int(2, 4)), Math.min(B - 3, c + 1 + rng.int(2, 4))];
    let clear = true;
    for (let j = v; j < v + 4; j++) for (let i = u0; i <= u1; i++) clear &&= !plan.wall[plan.at(i, j)] && !plan.used[plan.at(i, j)];
    if (clear) {
      patch(u0, v, u1 - u0 + 1, 4, true);
    }
  }
  for (let tries = 0, placed = 0, goal = rng.int(3, 5); tries < 600 && placed < goal; tries++) {
    const [w, h] = [rng.int(3, 7), rng.int(3, 7)];
    const u = rng.int(2, B - 3 - w),
      v = rng.int(3, L - 4 - h);
    if (plan.empty(u, v, w, h)) {
      patch(u, v, w, h);
      placed++;
    }
  }
  //Ledges: from the trees to the path, hopped down towards the entrance (the way back round is longer)
  for (let tries = 0, placed = 0, goal = rng.int(1, 2); tries < 80 && placed < goal; tries++) {
    const v = rng.int(5, L - 7);
    const c = straight[v] && straight[v - 2] && straight[v + 2] && across(v) === across(v - 2) && across(v) === across(v + 2) ? across(v) : -1;
    if (c < 0) {
      continue;
    }
    const left = rng.chance(0.5);
    const [u0, u1] = left ? [2, c - 1] : [c + 2, B - 3];
    if (u1 - u0 < 2 || !plan.empty(u0, v - 1, u1 - u0 + 1, 3)) {
      continue;
    }
    let shaded = false;
    for (let i = u0; i <= u1; i++) shaded ||= Boolean(plan.shade[plan.at(i, v)]);
    if (shaded) {
      continue;
    }
    for (let i = u0; i <= u1; i++) {
      plan.ledges[plan.at(i, v)] = plan.used[plan.at(i, v)] = 1;
      plan.keep[plan.at(i, v + 1)] = 1;
    }
    if (plan.reach(spawn)[plan.at(far, 0)]) {
      placed++;
    } else {
      for (let i = u0; i <= u1; i++) plan.ledges[plan.at(i, v)] = 0;
    }
  }
  //A few trees in open ground
  for (let tries = 0, placed = 0, goal = rng.int(2, 4); tries < 200 && placed < goal; tries++) {
    const u = rng.even(2, B - 4),
      v = rng.even(4, L - 6);
    if (plan.freeTree(u, v)) {
      const tiles = [0, 1].flatMap((i) => [0, 1].map((j) => ({ u: u + i, v: v + j })));
      if (solid(plan, spawn, must, [], tiles)) {
        plan.tree(u, v);
        placed++;
      }
    }
  }
  //Trainers: beside the path, looking at it (they see four tiles ahead), spread along the route
  const people = [] as { u: number; v: number }[];
  const count = rng.int(2, 4);
  const team = rng.shuffle([...wilds]);
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const [from, to] = [Math.floor(5 + ((L - 12) * i) / count), Math.floor(5 + ((L - 12) * (i + 1)) / count)];
    for (let tries = 0; tries < 40; tries++) {
      const v = rng.int(from, to);
      if (!straight[v]) {
        continue;
      }
      const c = across(v);
      const left = rng.chance(0.5);
      const u = left ? c - rng.int(1, 2) : c + 1 + rng.int(1, 2);
      const tile = { u, v };
      if (!plan.empty(u, v) || plan.shade[plan.at(u, v)] || plan.tall[plan.at(u, v)] || !solid(plan, spawn, must, [...people, tile], [tile])) {
        continue;
      }
      plan.used[plan.at(u, v)] = 1;
      people.push(tile);
      const kind = rng.pick(classes.filter(({ title }) => !used.has(title)));
      used.add(kind.title);
      const members = Array.from({ length: rng.int(1, 2) }, (_, n) => ({ species: team[(i * 2 + n) % team.length], level: level + 1 + rng.int(0, 2) }));
      plan.people.push({
        u,
        v,
        face: left ? "right" : "left",
        sprite: kind.sprite,
        name: `${kind.title} ${rng.pick(kind.names)}`,
        dialogue: kind.line,
        role: "trainer",
        wander: false,
        trainer: {
          team: members,
          gym: false,
          badge: "",
          defeat: rng.pick(["Aww, I lost!", "You're really strong!", "I need to train more...", "Wow, nice battling!"]),
        },
      });
      break;
    }
  }
  //Items: balls in the corners furthest from the path, one hidden near the trees, and a berry tree
  const seen = plan.reach(spawn);
  const corners = [] as { u: number; v: number; far: number }[];
  for (let v = 3; v < L - 3; v++) {
    for (let u = 2; u < B - 2; u++) {
      const k = plan.at(u, v);
      if (seen[k] && plan.empty(u, v) && !plan.shade[k]) {
        let gap = 99;
        for (let j = v - 4; j <= v + 4; j++)
          for (let i = 0; i < B; i++) if (plan.in(i, j) && plan.road[plan.at(i, j)]) gap = Math.min(gap, Math.abs(i - u) + Math.abs(j - v));
        corners.push({ u, v, far: gap + rng.next() * 2 });
      }
    }
  }
  corners.sort((a, b) => b.far - a.far);
  const things = [] as { u: number; v: number; npc: Omit<Npc, "x" | "y" | "dir"> }[];
  const ball = (item: ItemId, count = 1) => ({ sprite: "", name: "", dialogue: "", role: "item" as const, wander: false, gift: { item, count } });
  const take = (npc: Omit<Npc, "x" | "y" | "dir">, list: { u: number; v: number }[]) => {
    for (const tile of list) {
      const spread = things.every((thing) => Math.abs(thing.v - tile.v) + Math.abs(thing.u - tile.u) > 6);
      if (spread && plan.empty(tile.u, tile.v) && solid(plan, spawn, must, [...people, ...things, tile], [tile])) {
        plan.used[plan.at(tile.u, tile.v)] = 1;
        things.push({ ...tile, npc });
        return;
      }
    }
  };
  take(ball(rng.pick(balls)), corners);
  take(ball(rng.pick(balls)), corners);
  take({ ...ball(rng.pick(hiddenItems)), hidden: true }, rng.shuffle(corners.slice(0, 60)));
  take({ ...ball(rng.pick(["oran-berry", "oran-berry", "sitrus-berry"] as const), rng.int(1, 3)), grow: 24 }, rng.shuffle(corners.slice(20)));
  for (const { u, v, npc } of things) {
    plan.people.push({ u, v, face: "down", ...npc });
  }
  //A sign where the route begins
  const sign = signSpot(plan, "down", start, spawn, must);
  if (sign) {
    plan.signs.push({ ...sign, text: `${map.name}\n\nTall grass ahead: watch for wild Pokémon and trainers!` });
  }
  flowers(plan, rng, rng.int(3, 6));
  //Ledges are jumped towards the entrance, wherever the route faces
  const back = { down: "down", up: "up", right: "right", left: "left" }[entrance] as Direction;
  draw(map, plan, turn, back, zone);
  const at = turn(spawn.u, spawn.v);
  map.spawn = at;
  const exit = opposite[entrance];
  return {
    exits: [
      { side: entrance, tiles: [start, start + 1].map((u) => turn(u, L - 1)) },
      { side: exit, tiles: [far, far + 1].map((u) => turn(u, 0)) },
    ],
    buildings: [],
  };
}

/** Turn a direction of the upright plan into the map's */
function turned(turn: (u: number, v: number) => { x: number; y: number }, dir: Direction) {
  const [du, dv] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const a = turn(4, 4),
    b = turn(4 + du, 4 + dv);
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  return (dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up") as Direction;
}

/** Paint a plan onto a map: ground, trees, buildings, grass, ledges, flowers, signs and people */
function draw(map: City, plan: Plan, turn: (u: number, v: number) => { x: number; y: number }, back: Direction, zone: number) {
  const { width: W } = map;
  const index = (u: number, v: number) => {
    const { x, y } = turn(u, v);
    return y * W + x;
  };
  for (let v = 0; v < plan.h; v++) {
    for (let u = 0; u < plan.w; u++) {
      const k = plan.at(u, v),
        i = index(u, v);
      if (plan.road[k]) {
        map.layers.ground[i] = SAND;
      }
      if (plan.tall[k]) {
        map.layers.decor[i] = TALL;
        map.zone[i] = zone;
      }
      if (plan.flowers[k]) {
        map.layers.decor[i] = FLOWERS;
      }
      if (plan.ledges[k]) {
        map.layers.decor[i] = ledgeTile[back];
        map.behavior[i] = ledgeValue[back];
      }
    }
  }
  //Trees, top to bottom so crowns and trunks join; one whose crown would hang over a road out is left out
  const trees = plan.trees
    .map(({ u, v }) => {
      const corners = [turn(u, v), turn(u + 1, v + 1)];
      return { x: Math.min(corners[0].x, corners[1].x), y: Math.min(corners[0].y, corners[1].y) };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const { x, y } of trees) {
    const over = [x, x + 1].some((i) => y > 0 && map.layers.ground[(y - 1) * W + i] === SAND);
    if (!over) {
      stamp(map, "Tree", x, y - 1);
    }
  }
  for (const { kind, u, v } of plan.buildings) {
    stamp(map, shapes[kind].brush, u, v);
  }
  for (const { u, v, text } of plan.signs) {
    const { x, y } = turn(u, v);
    stamp(map, "Sign", x, y);
    map.npcs.push({ x, y, sprite: "", dir: "down", name: "Sign", dialogue: text, role: "talk", wander: false });
  }
  for (const { u, v, face, ...npc } of plan.people) {
    const { x, y } = turn(u, v);
    map.npcs.push({ ...npc, x, y, dir: turned(turn, face) } as Npc);
  }
}

/** Tiles the player can reach on foot from a tile: blocked tiles and people stop them, ledges are jumped one way only */
export function walk(map: City, from: { x: number; y: number }) {
  const { width: W, height: H } = map;
  const people = new Set(map.npcs.map(({ x, y }) => y * W + x));
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !map.solid[y * W + x] && !people.has(y * W + x);
  const seen = new Set<number>();
  const queue = [from];
  seen.add(from.y * W + from.x);
  const steps: [Direction, number, number][] = [
    ["right", 1, 0],
    ["left", -1, 0],
    ["down", 0, 1],
    ["up", 0, -1],
  ];
  while (queue.length) {
    const { x, y } = queue.pop()!;
    for (const [dir, dx, dy] of steps) {
      let [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
        continue;
      }
      const jump = ledge(map.behavior[ny * W + nx]);
      if (jump) {
        if (jump !== dir) {
          continue;
        }
        [nx, ny] = [nx + dx, ny + dy];
      }
      if (free(nx, ny) && !seen.has(ny * W + nx)) {
        seen.add(ny * W + nx);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}
