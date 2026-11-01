//Imports
import { assets } from "./assets";
import { frames } from "./brushes";
import { blank, type City, type Zone } from "./data";

/**
 * Fill the ground where a Hoenn map has none: empty cells are the sea (the original map drew the ocean behind everything),
 * and cells under see-through tiles get the most common ground around them.
 */
export function fill(city: City) {
  const { width, height, layers } = city;
  const empty = (i: number) => !layers.ground[i] && !layers.decor[i] && !layers.above[i];
  for (let i = 0; i < width * height; i++) {
    if (empty(i)) {
      layers.ground[i] = frames.water + 1;
      city.solid[i] = 1;
    }
  }
  const missing = [] as number[];
  layers.ground.forEach((value, i) => !value && missing.push(i));
  for (const i of missing) {
    const [x, y] = [i % width, Math.floor(i / width)];
    let found = 0;
    //Look a little further out each time, and take the most common ground there
    for (let radius = 1; radius <= 4 && !found; radius++) {
      const counts = new Map<number, number>();
      for (let j = -radius; j <= radius; j++) {
        for (let k = -radius; k <= radius; k++) {
          const [cx, cy] = [x + k, y + j];
          const value = cx >= 0 && cy >= 0 && cx < width && cy < height ? layers.ground[cy * width + cx] : 0;
          if (value) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
          }
        }
      }
      found = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    }
    layers.ground[i] = found || frames.grass + 1;
  }
}

/** Section summary */
export type Section = { id: string; x: number; y: number; width: number; height: number };

/** Available Hoenn sections (towns and routes) */
export async function sections() {
  const { sections } = (await fetch("/game/data/maps/hoenn.json").then((response) => response.json())) as { sections: Section[] };
  return sections
    .filter(({ id, width, height }) => !/\/fill-|\/anime-/.test(id) && width <= 128 && height <= 128)
    .sort((a, b) => label(a.id).localeCompare(label(b.id)));
}

/** Human readable section name */
export function label(id: string) {
  return id
    .replace(/^hoenn\//, "")
    .replace(/^hoenn-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Point in polygon test (tile units, cell centers) */
function inside(points: number[], x: number, y: number) {
  let result = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [points[i], points[i + 1], points[j], points[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      result = !result;
    }
  }
  return result;
}

/** Encounter methods names */
const methods = {
  walk: "Tall grass",
  surf: "Water",
  "old-rod": "Fishing",
  "good-rod": "Fishing",
  "super-rod": "Fishing",
  "rock-smash": "Rocks",
  "dark-grass": "Dark grass",
} as { [key: string]: string };

/** Zone colors per method */
const colors = { walk: 0x2ecc40, surf: 0x0074d9, "dark-grass": 0x3d9970 } as { [key: string]: number };

/** Convert a real Hoenn section into a city */
export async function load(section: Section): Promise<City> {
  const data = await fetch(`/game/data/maps/${section.id}.json`).then((response) => response.json());
  const { width, height } = data;
  const city = blank({ width, height, name: label(section.id) });
  city.zones = [];

  //Tile layers (lowest map layer is ground, upper ones stack into objects then above)
  const number = (layer: unknown) => Number(`${layer ?? 1}`.match(/\d+/)?.[0] ?? 1);
  const lowest = Math.min(...data.chunks.map(({ layer }: { layer: unknown }) => number(layer)));
  for (const chunk of [...data.chunks].sort((a, b) => number(a.layer) - number(b.layer))) {
    chunk.tiles.forEach((frame: number, i: number) => {
      const x = chunk.x + (i % 16),
        y = chunk.y + Math.floor(i / 16);
      if (!frame || frame >= 6215 || x < 0 || y < 0 || x >= width || y >= height) {
        return;
      }
      const index = y * width + x;
      if (number(chunk.layer) === lowest) {
        //See-through tiles (shore rocks, flowers) can't be ground: nothing would show under them. They become objects, with ground filled in below
        if (assets.clear.has(frame)) {
          city.layers.decor[index] = frame + 1;
          if (!assets.walkable.has(frame)) {
            city.solid[index] = 1;
          }
          return;
        }
        city.layers.ground[index] = frame + 1;
        if (assets.water.has(frame)) {
          city.solid[index] = 1;
        }
        return;
      }
      city.layers[city.layers.decor[index] ? "above" : "decor"][index] = frame + 1;
      if (!assets.walkable.has(frame)) {
        city.solid[index] = 1;
      } else if (assets.water.has(frame)) {
        city.solid[index] = 1;
      }
    });
  }
  fill(city);

  //Encounter zones
  const zones = {} as { [method: string]: number };
  const creatures = (method: string) => {
    const table = data.encounters?.[method] ?? {};
    return Object.keys(table)
      .map((name) => assets.pokedex.find(({ key }) => key === name || key.split("-")[0] === name))
      .filter((species) => species)
      .slice(0, 8)
      .map((species) => ({ species: species!.id, min: 3, max: 7 }));
  };
  //People
  for (const area of data.areas ?? []) {
    const { points, type, name } = area;
    const xs = points.filter((_: number, i: number) => i % 2 === 0),
      ys = points.filter((_: number, i: number) => i % 2 === 1);
    const cells = [] as [number, number][];
    for (let y = Math.max(0, Math.min(...ys)); y < Math.min(height, Math.max(...ys)); y++) {
      for (let x = Math.max(0, Math.min(...xs)); x < Math.min(width, Math.max(...xs)); x++) {
        if (inside(points, x + 0.5, y + 0.5)) {
          cells.push([x, y]);
        }
      }
    }
    if (type === "creatures") {
      if (!(name in zones)) {
        const list = creatures(name);
        if (!list.length) {
          continue;
        }
        city.zones.push({ name: methods[name] ?? name, rate: name === "walk" ? 0.12 : 0.06, color: colors[name] ?? 0xff851b, creatures: list } as Zone);
        zones[name] = city.zones.length;
      }
      for (const [x, y] of cells) {
        city.zone[y * width + x] = zones[name];
        if (name === "walk") {
          city.solid[y * width + x] = 0;
        }
      }
    } else if (type === "people" && assets.npcs.includes(name)) {
      const free = cells.find(([x, y]) => !city.solid[y * width + x]);
      if (free) {
        city.npcs.push({
          x: free[0],
          y: free[1],
          sprite: name,
          dir: "down",
          name: name
            .replace(/_/g, " ")
            .replace(/\d+$/, "")
            .replace(/generic \w$/, "villager")
            .trim(),
          dialogue: `Welcome to ${city.name}!`,
          role: "talk",
          wander: area.properties?.pattern === "wander",
        });
      }
    }
  }
  if (!city.zones.length) {
    city.zones = blank().zones;
  }

  //Spawn (first walkable tile close to the center)
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  let best = null as null | { x: number; y: number; d: number };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!city.solid[index] && !city.zone[index] && !city.npcs.some((npc) => npc.x === x && npc.y === y)) {
        const d = Math.abs(x - center.x) + Math.abs(y - center.y);
        if (!best || d < best.d) {
          best = { x, y, d };
        }
      }
    }
  }
  city.spawn = best ? { x: best.x, y: best.y } : center;
  return city;
}
