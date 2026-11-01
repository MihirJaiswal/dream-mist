//Imports
import type { Side } from "./region";
import type { City, Layer } from "./data";

/** Quick brush (tile values are tileset frame + 1) */
export type Brush = {
  name: string;
  w: number;
  h: number;
  tiles: number[];
  /** Layer the brush paints on */
  layer?: Layer;
  /** Collision behaviour (defaults: objects block, ground is walkable) */
  solid?: "all" | "none";
  /** Paint first encounter zone too (tall grass) */
  zone?: boolean;
  /** Terrain id: paints with automatic borders */
  terrain?: string;
  /** Top rows painted on the Above layer (tree tops), so overlapping trees stack instead of cutting each other */
  top?: number;
};

/** Convert tileset frames rows into a brush */
function brush(name: string, rows: number[][], options: Partial<Brush> = {}): Brush {
  return { name, w: rows[0].length, h: rows.length, tiles: rows.flat().map((frame) => frame ? frame + 1 : 0), ...options };
}

/** Tileset frames used by templates */
export const frames = { grass: 113, tall: 206, sand: 4977, water: 2374 };

/** Quick brushes (frames picked from the RSE tileset and real Hoenn maps) */
export const brushes: Brush[] = [
  brush("Grass", [[frames.grass]], { layer: "ground" }),
  //Tall grass has see-through edges, so it stands on the grass as an object (walkable) like in the real maps
  brush("Tall grass (wild Pokémon)", [[frames.tall]], { layer: "decor", solid: "none", zone: true }),
  brush("Sand path", [[frames.sand]], { layer: "ground" }),
  brush("Gravel path", [[2607]], { layer: "ground" }),
  brush("Pavement", [[4974]], { layer: "ground" }),
  brush("Water", [[frames.water]], { layer: "ground", solid: "all" }),
  brush("Flowers", [[658]], { layer: "decor", solid: "none" }),
  brush("Tree", [[211, 212], [324, 325]], { layer: "decor", top: 1 }),
  brush("Pine tree", [[215, 216], [328, 329]], { layer: "decor", top: 1 }),
  brush("Sign", [[205]], { layer: "decor" }),
  brush("House", [[2734, 2735, 2735, 2735, 2740], [2847, 2848, 2848, 2848, 2853], [2960, 2961, 2961, 2961, 2966], [3073, 3076, 3077, 3074, 3079], [3186, 3189, 3190, 3187, 3192]], { layer: "decor" }),
  brush("Small house", [[3649, 3650, 3650, 3652], [3762, 3763, 3763, 3765], [3875, 3876, 3877, 3878], [3988, 3989, 3990, 3991]], { layer: "decor" }),
  brush("Lab", [[474, 476, 477, 475, 475, 475, 478], [587, 589, 590, 588, 588, 588, 591], [587, 588, 588, 588, 588, 588, 591], [700, 702, 702, 706, 701, 705, 704], [813, 815, 815, 819, 814, 818, 817]], { layer: "decor" }),
  brush("Pokémon Center", [[22, 23, 24, 25], [135, 136, 137, 138], [248, 249, 250, 251], [361, 362, 363, 364]], { layer: "decor" }),
  brush("Poké Mart", [[26, 27, 27, 29], [139, 140, 141, 142], [252, 253, 254, 255], [361, 362, 367, 368]], { layer: "decor" }),
];

/** Tiles of the top rows of brushes painted above (tree tops), so erasing a tree removes its top too */
export const tops = new Set(brushes.flatMap(({ w, tiles, top = 0 }) => tiles.slice(0, top * w).filter(Boolean)));

/** Find a brush by name */
function find(name: string) {
  return brushes.find((brush) => brush.name === name)!;
}

/** Stamp a brush into a city (with collision) */
export function stamp(city: City, name: string, x: number, y: number) {
  const { w, h, tiles, layer = "decor", solid, zone, top = 0 } = find(name);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const value = tiles[j * w + i];
      if ((!value) || (x + i >= city.width) || (y + j >= city.height)) {
        continue;
      }
      const index = (y + j) * city.width + x + i;
      if (j < top) {
        //Tree tops go above, over whatever stands behind, and don't block
        city.layers.above[index] = value;
        continue;
      }
      city.layers[layer][index] = value;
      city.solid[index] = solid === "all" ? 1 : solid === "none" ? 0 : layer === "decor" ? 1 : 0;
      if (zone) {
        city.zone[index] = 1;
      }
    }
  }
}

/** Starter content for a new city: tree border, paths, a Pokémon Center, houses and tall grass */
export function template(city: City) {
  const { width: W, height: H } = city;
  city.layers.ground.fill(frames.grass + 1);
  //Tree border
  for (let x = 0; x < W; x += 2) {
    stamp(city, "Tree", x, 0);
    stamp(city, "Tree", x, H - 2);
  }
  for (let y = 2; y < H - 2; y += 2) {
    stamp(city, "Tree", 0, y);
    stamp(city, "Tree", W - 2, y);
  }
  //Paths
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  for (let x = 2; x < W - 2; x++) {
    city.layers.ground[cy * W + x] = city.layers.ground[(cy + 1) * W + x] = frames.sand + 1;
  }
  for (let y = 2; y < H - 2; y++) {
    city.layers.ground[y * W + cx] = city.layers.ground[y * W + cx + 1] = frames.sand + 1;
  }
  //Buildings
  stamp(city, "Pokémon Center", cx + 4, cy - 5);
  stamp(city, "House", cx - 9, cy - 6);
  stamp(city, "Sign", cx - 2, cy - 1);
  //Tall grass
  for (let y = cy + 4; y < Math.min(H - 3, cy + 9); y++) {
    for (let x = 4; x < Math.min(cx - 2, 14); x++) {
      stamp(city, "Tall grass (wild Pokémon)", x, y);
    }
  }
  //Flowers
  for (const [x, y] of [[cx - 4, cy - 3], [cx - 3, cy - 3], [cx + 3, cy + 3], [cx + 4, cy + 3], [cx + 5, cy + 4]]) {
    stamp(city, "Flowers", x, y);
  }
  //People
  city.npcs.push(
    { x: cx - 2, y: cy - 1, sprite: "", dir: "down", name: "Sign", dialogue: `Welcome to ${city.name}!\n\nBuilt with DreamMist.`, role: "talk", wander: false },
    { x: cx + 5, y: cy - 1, sprite: "shopkeeper_f", dir: "down", name: "Nurse", dialogue: "Welcome to the Pokémon Center!", role: "healer", wander: false },
    { x: cx - 6, y: cy + 3, sprite: "generic_m2", dir: "down", name: "Villager", dialogue: "Tall grass is full of wild Pokémon!\n\nMake sure your team is healthy before going in.", role: "talk", wander: true },
  );
  city.spawn = { x: cx, y: cy + 2 };
  return city;
}

/** Starter content for a new route: trees along its long sides, a path from end to end, tall grass and a sign where it begins */
export function route(city: City, entrance: Side) {
  const { width: W, height: H } = city;
  const vertical = (entrance === "up") || (entrance === "down");
  city.layers.ground.fill(frames.grass + 1);
  const sand = (x: number, y: number) => city.layers.ground[y * W + x] = frames.sand + 1;
  const grass = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        stamp(city, "Tall grass (wild Pokémon)", x, y);
      }
    }
  };
  if (vertical) {
    const cx = Math.floor(W / 2) - 1;
    for (let y = 0; y < H; y += 2) {
      stamp(city, "Tree", 0, y);
      stamp(city, "Tree", W - 2, y);
    }
    for (let y = 0; y < H; y++) {
      sand(cx, y);
      sand(cx + 1, y);
    }
    grass(3, Math.floor(H * 0.2), cx - 1, Math.floor(H * 0.38));
    grass(cx + 3, Math.floor(H * 0.55), W - 3, Math.floor(H * 0.72));
    //The sign stands by the path at the end the player comes from (the side touching the map it was made from)
    sign(city, cx - 1, entrance === "up" ? H - 3 : 2, city.name);
  } else {
    const cy = Math.floor(H / 2) - 1;
    for (let x = 0; x < W; x += 2) {
      stamp(city, "Tree", x, 0);
      stamp(city, "Tree", x, H - 2);
    }
    for (let x = 0; x < W; x++) {
      sand(x, cy);
      sand(x, cy + 1);
    }
    grass(Math.floor(W * 0.2), 3, Math.floor(W * 0.38), cy - 1);
    grass(Math.floor(W * 0.55), cy + 3, Math.floor(W * 0.72), H - 3);
    sign(city, entrance === "left" ? W - 3 : 2, cy - 1, city.name);
  }
  city.spawn = { x: Math.floor(W / 2), y: Math.floor(H / 2) };
  return city;
}

/** Starter content for another town: a tree border with a way in from the side touching the map it was made from, and a path to the middle */
export function town(city: City, entrance: Side) {
  const { width: W, height: H } = city;
  const cx = Math.floor(W / 2) - 1, cy = Math.floor(H / 2) - 1;
  //The way in faces back towards the map it was made from
  const facing = ({ up: "down", down: "up", left: "right", right: "left" } as const)[entrance];
  city.layers.ground.fill(frames.grass + 1);
  for (let x = 0; x < W; x += 2) {
    const gap = Math.abs(x - cx) < 2;
    if (!((gap) && (facing === "up"))) {
      stamp(city, "Tree", x, 0);
    }
    if (!((gap) && (facing === "down"))) {
      stamp(city, "Tree", x, H - 2);
    }
  }
  for (let y = 2; y < H - 2; y += 2) {
    const gap = Math.abs(y - cy) < 2;
    if (!((gap) && (facing === "left"))) {
      stamp(city, "Tree", 0, y);
    }
    if (!((gap) && (facing === "right"))) {
      stamp(city, "Tree", W - 2, y);
    }
  }
  //Path from the way in to the middle of town
  const sand = (x: number, y: number) => city.layers.ground[y * W + x] = frames.sand + 1;
  const [x0, x1] = facing === "left" ? [0, cx + 2] : facing === "right" ? [cx, W] : [cx, cx + 2];
  const [y0, y1] = facing === "up" ? [0, cy + 2] : facing === "down" ? [cy, H] : [cy, cy + 2];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      sand(x, y);
    }
  }
  sign(city, cx - 2, cy - 1, `Welcome to ${city.name}!`);
  city.spawn = { x: cx, y: cy + 2 };
  return city;
}

/** A sign post someone can read */
function sign(city: City, x: number, y: number, text: string) {
  stamp(city, "Sign", x, y);
  city.npcs.push({ x, y, sprite: "", dir: "down", name: "Sign", dialogue: text, role: "talk", wander: false });
}

/** Terrain: a 3×3 tileset block (corners, edges and center) painted with automatic borders */
export type Terrain = { id: string; name: string; tiles: number[] };

/** Terrain from the top-left frame of its 3×3 block in the RSE tileset (113 columns) */
function terrain(id: string, name: string, origin: number): Terrain {
  return { id, name, tiles: [0, 1, 2, 113, 114, 115, 226, 227, 228].map((offset) => origin + offset + 1) };
}

/** Terrains (rounded patches from the tileset, row 22) */
export const terrains: Terrain[] = [
  terrain("meadow", "Light grass", 22 * 113 + 1),
  terrain("sand", "Sand", 22 * 113 + 4),
  terrain("dirt", "Dirt", 22 * 113 + 7),
  terrain("stone", "Stone floor", 22 * 113 + 13),
  terrain("tiles", "Tiled floor", 22 * 113 + 16),
  terrain("brick", "Brick floor", 22 * 113 + 19),
];

/** Terrain owning a tile value */
export function terrainOf(value: number) {
  return terrains.find(({ tiles }) => tiles.includes(value)) ?? null;
}

/** Pick the right piece of a terrain from its 4 neighbours (true = same terrain) */
export function piece(terrain: Terrain, { n, s, w, e }: { n: boolean; s: boolean; w: boolean; e: boolean }) {
  const row = !n ? 0 : !s ? 2 : 1;
  const column = !w ? 0 : !e ? 2 : 1;
  return terrain.tiles[row * 3 + column];
}
