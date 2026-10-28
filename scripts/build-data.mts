/**
 * Game data build: turns the source assets into the files the game loads from public/game.
 *
 *   npm run data              build everything that is missing
 *   npm run data -- --force   rebuild everything
 *   npm run data -- maps      build only some steps (assets, tilesets, maps, pokedex, tiles)
 *
 * Sources: maps/ (Tiled maps of Hoenn), copyrighted/ (textures and audio) and PokeAPI data,
 * downloaded once into .cache/api-data (a sparse clone of only the folders used here).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { PNG } from "pngjs";

/** Output folder */
const out = process.env.DATA_OUT ?? "public/game";

/** PokeAPI data */
const cache = ".cache/api-data";
const api = `${cache}/data/api/v2`;

/** Every creature of the national dex */
const creatures = 1025;

/** Learnset source: Emerald for the Hoenn era, otherwise the most recent main series game the creature appears in */
const learnsets = ["emerald", "scarlet-violet", "sword-shield", "ultra-sun-ultra-moon", "sun-moon", "omega-ruby-alpha-sapphire", "x-y", "black-2-white-2", "black-white", "heartgold-soulsilver", "platinum"];

/** Spawn marker tile in Tiled maps */
const spawnTile = 6324;

//=================================================================================================
// Helpers

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Tiled files (attributes become "@name", text becomes "#text") */
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", parseAttributeValue: true });

/** Read a JSON or Tiled file */
function read(path: string): Json {
  const text = readFileSync(path, "utf8");
  return /\.(tmx|tsx)$/.test(path) ? xml.parse(text) : JSON.parse(text);
}

/** Save a JSON file in the output folder */
function save(path: string, data: unknown) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

/** Is an output file already built */
function built(path: string) {
  return existsSync(join(out, path));
}

/** Single values and missing ones as arrays */
function list<T>(value: T | T[] | undefined | null): T[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

/** Log a step */
function step(text: string) {
  console.log(`\x1b[36m›\x1b[0m ${text}`);
}

/** Polygon area (shoelace formula) */
function area(X: number[], Y: number[]) {
  let total = 0;
  for (let i = 0, j = X.length - 1; i < X.length; j = i++) {
    total += (X[j] + X[i]) * (Y[j] - Y[i]);
  }
  return Math.abs(total / 2);
}

/** Point in polygon test */
function inside(points: number[], x: number, y: number) {
  let result = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [points[i], points[i + 1], points[j], points[j + 1]];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      result = !result;
    }
  }
  return result;
}

/** Entries of a PokeAPI collection (one folder each) */
function entries(collection: string) {
  return readdirSync(`${api}/${collection}`, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => name);
}

/** Download the PokeAPI folders used here (once) */
function pokeapi() {
  if (existsSync(api)) {
    return;
  }
  step("downloading PokeAPI data (first run only)");
  execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/PokeAPI/api-data.git", cache], { stdio: "inherit" });
  execFileSync("git", ["sparse-checkout", "set", "data/api/v2/pokemon", "data/api/v2/pokemon-species", "data/api/v2/move", "data/api/v2/type", "data/api/v2/location", "data/api/v2/location-area"], { cwd: cache, stdio: "inherit" });
}

//=================================================================================================
// Steps

/** Textures and audio, copied as they are */
function assets() {
  step("copying textures and audio");
  for (const style of readdirSync("copyrighted/textures")) {
    for (const file of readdirSync(`copyrighted/textures/${style}`).filter((file) => /\.(webp|json)$/.test(file))) {
      cpSync(`copyrighted/textures/${style}/${file}`, join(out, "textures", style, file));
    }
  }
  cpSync("copyrighted/audio", join(out, "audio"), { recursive: true });
}

/** Tileset properties: animated tiles and tiles drawn above the player */
function tilesets({ force = false }) {
  step("reading tilesets");
  for (const style of readdirSync("copyrighted/textures")) {
    for (const file of readdirSync(`copyrighted/textures/${style}`).filter((file) => file.endsWith(".tsx"))) {
      const id = `${style}/${file.replace(".tsx", "")}`;
      if ((!force) && (built(`data/textures/${id}.json`))) {
        continue;
      }
      const { tileset } = read(`copyrighted/textures/${id}.tsx`);
      const animated = {} as { [id: string]: { frames: string[]; speed: number } };
      const zindex = {} as { [id: string]: number };
      for (const tile of list<Json>(tileset.tile)) {
        const properties = Object.fromEntries(list<Json>(tile.properties?.property).map((property) => [property["@name"], property["@value"]]));
        if ((properties.frames) && (properties.speed)) {
          animated[`${tile["@id"]}`] = { frames: Array.from({ length: properties.frames }, (_, i) => `${tile["@id"] + i}`), speed: properties.speed };
        }
        if (properties.zindex) {
          zindex[`${tile["@id"]}`] = Number(properties.zindex);
        }
      }
      save(`data/textures/${id}.json`, { id, animated, zindex });
    }
  }
}

/** Wild encounters of every location (normalized chance per species and method) */
function locations() {
  pokeapi();
  const encounters = {} as { [area: string]: { [method: string]: { [name: string]: number } } };
  for (const folder of entries("location-area")) {
    const { name, pokemon_encounters: details } = read(`${api}/location-area/${folder}/index.json`);
    const rates = {} as { [method: string]: { [name: string]: number } };
    for (const { pokemon: { name: creature }, version_details: versions } of details) {
      for (const { encounter_details: details } of versions) {
        for (const { chance, method: { name: method } } of details) {
          rates[method] ??= {};
          rates[method][creature] = Math.max(rates[method][creature] ?? 0, chance);
        }
      }
    }
    for (const chances of Object.values(rates)) {
      const total = Object.values(chances).reduce((a, b) => a + b, 0);
      for (const creature in chances) {
        chances[creature] /= total;
      }
    }
    encounters[name] = rates;
  }
  const result = {} as { [id: string]: { region: string; i18n: { [lang: string]: string }; encounters: unknown } };
  for (const folder of entries("location")) {
    const { name: id, names, region } = read(`${api}/location/${folder}/index.json`);
    result[id] = { region: region?.name ?? "other", i18n: Object.fromEntries(names.map(({ language, name }: Json) => [language.name, name])), encounters: encounters[`${id}-area`] ?? null };
  }
  return result;
}

/** Hoenn sections: Tiled maps cut into 16×16 chunks, with their areas, spawn and encounters */
function maps({ force = false }) {
  step("converting Hoenn maps");
  const { maps: world } = read("maps/hoenn.world") as { maps: { fileName: string; x: number; y: number }[] };
  const sections = world.filter(({ fileName }) => fileName.startsWith("hoenn/")).map(({ fileName, x, y }) => {
    const { map } = read(`maps/${fileName}`);
    const layer = list<Json>(map.layer)[0] ?? {};
    return { id: fileName.replace(".tmx", ""), x: x / 16, y: y / 16, height: layer["@height"] ?? 0, width: layer["@width"] ?? 0, spawn: null as null | { x: number; y: number } };
  });
  const places = sections.some(({ id }) => force || !built(`data/maps/${id}.json`)) ? locations() : {};
  for (const bounds of sections) {
    const file = `data/maps/${bounds.id}.json`;
    if ((!force) && (built(file))) {
      bounds.spawn = read(join(out, file)).spawn;
      continue;
    }
    const { map } = read(`maps/${bounds.id}.tmx`);
    const { x: X, y: Y } = bounds;

    //Chunks (fixed-size layers are padded and cut into 16×16 chunks)
    const chunks = [] as { id: string; layer: string | number; x: number; y: number; tiles: number[] }[];
    for (const layer of list<Json>(map.layer)) {
      const name = layer["@name"] as string | number;
      const data = layer.data ?? {};
      const chunked = [...list<Json>(data.chunk)];
      if (typeof data["#text"] === "string") {
        const rows = (data["#text"] as string).split("\n").map((row) => row.split(",").map((value) => value.trim()).filter(Boolean)).filter((row) => row.length);
        const width = rows[0].length;
        while (rows.length % 16) {
          rows.push(new Array(width).fill("0"));
        }
        for (const row of rows) {
          while (row.length % 16) {
            row.push("0");
          }
        }
        for (let x = 0; x < layer["@width"]; x += 16) {
          for (let y = 0; y < layer["@height"]; y += 16) {
            chunked.push({ "@x": x, "@y": y, "#text": rows.slice(y, y + 16).map((row) => row.slice(x, x + 16).join(",")).join(",\n") });
          }
        }
      }
      for (const chunk of chunked) {
        const tiles = `${chunk["#text"]}`.split(",").map((value) => value.trim()).filter(Boolean).map((value) => Math.max(Number(value) - 1, 0));
        if (tiles.some(Boolean)) {
          chunks.push({ id: `${name}/${X + chunk["@x"] / 16};${Y + chunk["@y"] / 16}`, layer: name, x: chunk["@x"], y: chunk["@y"], tiles });
        }
      }
    }

    //Spawn point
    let spawn = null as null | { x: number; y: number };
    for (const { x, y, tiles } of chunks) {
      tiles.forEach((tile, i) => tile === spawnTile && (spawn = { x: X + x + i % 16, y: Y + y + Math.floor(i / 16) }));
    }
    bounds.spawn = spawn;

    //Areas (wild Pokémon, people, map markers)
    const areas = [] as { id: number; type: string; name: string; points: number[]; properties: { [key: string]: unknown } }[];
    for (const group of list<Json>(map.objectgroup)) {
      const type = group["@name"];
      for (const object of list<Json>(group.object)) {
        const { "@id": id, "@name": name = "", "@type": mode, "@x": x, "@y": y, "@width": width, "@height": height } = object;
        const properties = Object.fromEntries(list<Json>(object.properties?.property).map((property) => [property["@name"], property["@value"]]));
        const points = (`${object.polygon?.["@points"] ?? ""}`.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, width, 0, width, height, 0, height])
          .map((delta, index) => (delta + (index % 2 ? y : x)) / 16);
        const entry = { id, type, name: `${name}`, points, properties };
        if (type === "creatures") {
          entry.properties.size = area(points.filter((_, i) => !(i % 2)), points.filter((_, i) => i % 2));
        } else if (type === "people") {
          entry.properties = { pattern: mode, directions: ["left", "right", "up", "down"].filter((key) => properties[key]) };
        } else if (type === "map") {
          entry.properties = { tile: object["@gid"] };
        }
        areas.push(entry);
      }
    }

    const section = bounds.id.split("/")[1];
    save(file, { id: bounds.id, x: X, y: Y, height: bounds.height, width: bounds.width, chunks, areas, spawn, ...places[section] });
  }
  save("data/maps/hoenn.json", { sections });
}

/** Pokédex, moves and type chart used by battles */
function pokedex({ force = false }) {
  if ((!force) && (built("data/city/pokedex.json"))) {
    return;
  }
  pokeapi();
  step("building the Pokédex");
  const english = (names: { name: string; language: { name: string } }[], fallback: string) => names.find(({ language }) => language.name === "en")?.name ?? fallback;

  //Type chart
  const types = {} as { [attacker: string]: { [defender: string]: number } };
  for (let id = 1; id <= 18; id++) {
    const { name, damage_relations: relations } = read(`${api}/type/${id}/index.json`);
    types[name] = {};
    for (const [key, value] of [["no_damage_to", 0], ["half_damage_to", 0.5], ["double_damage_to", 2]] as const) {
      for (const { name: defender } of relations[key]) {
        types[name][defender] = value;
      }
    }
  }

  //Creatures and their level-up moves (damaging moves only, to keep battles simple)
  const moves = {} as { [name: string]: { name: string; type: string; power: number; accuracy: number; pp: number; class: string; priority: number } };
  const dex = [];
  for (let id = 1; id <= creatures; id++) {
    const pokemon = read(`${api}/pokemon/${id}/index.json`);
    const species = read(`${api}/pokemon-species/${id}/index.json`);
    const levelup = (group: string) => pokemon.moves.some(({ version_group_details: details }: Json) => details.some(({ version_group, move_learn_method }: Json) => (version_group.name === group) && (move_learn_method.name === "level-up")));
    const group = learnsets.find(levelup) ?? "emerald";
    const learnset = [] as [number, string][];
    for (const { move: { name, url }, version_group_details: details } of pokemon.moves) {
      const detail = details.find(({ version_group, move_learn_method }: Json) => (version_group.name === group) && (move_learn_method.name === "level-up"));
      if (!detail) {
        continue;
      }
      if (!(name in moves)) {
        const data = read(`${cache}/data${url.replace(/\/$/, "")}/index.json`);
        moves[name] = { name: english(data.names, name), type: data.type.name, power: data.power ?? 0, accuracy: data.accuracy ?? 100, pp: data.pp ?? 10, class: data.damage_class.name, priority: data.priority ?? 0 };
      }
      if (moves[name].power > 0) {
        learnset.push([detail.level_learned_at, name]);
      }
    }
    learnset.sort(([a], [b]) => a - b);
    dex.push({ id, key: pokemon.name, name: english(species.names, pokemon.name), types: pokemon.types.map(({ type }: Json) => type.name), stats: pokemon.stats.map(({ base_stat }: Json) => base_stat), xp: pokemon.base_experience ?? 64, capture: species.capture_rate, learnset });
    if (!(id % 100)) {
      step(`  ${id}/${creatures} Pokémon`);
    }
  }

  //Keep only moves that are actually learned
  const used = new Set(["tackle", ...dex.flatMap(({ learnset }) => learnset.map(([, name]) => name))]);
  for (const name of Object.keys(moves).filter((name) => !used.has(name))) {
    delete moves[name];
  }
  save("data/city/pokedex.json", { pokedex: dex, moves, types });
}

/**
 * Tiles walkability, learned from the real Hoenn maps (used to guess collisions):
 * - frames mostly used on the lowest map layer are ground
 * - opaque frames repeating with themselves in both directions on upper layers are floors (pavements, paths)
 * - opaque frames next to a ground/floor frame in the tileset are its edges (the tileset groups autotiles in 3×3 blocks)
 * - frames used on upper layers inside wild encounter areas are tall grass
 */
function tiles({ force = false }) {
  if ((!force) && (built("data/city/tiles.json"))) {
    return;
  }
  step("learning which tiles are walkable");
  const columns = 113;
  const image = PNG.sync.read(readFileSync("copyrighted/textures/rse/tileset.png"));
  const opaque = (frame: number, ratio: number) => {
    const px = 2 + (frame % columns) * 18, py = 2 + Math.floor(frame / columns) * 18;
    let count = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (image.data[((py + y) * image.width + px + x) * 4 + 3] > 0) {
          count++;
        }
      }
    }
    return count / 256 >= ratio;
  };

  const stacked = [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
  const lower = new Map<number, number>(), upper = new Map<number, number>(), repeated = new Map<number, number>(), grass = new Map<number, number>();
  const increment = (map: Map<number, number>, frame: number) => map.set(frame, (map.get(frame) ?? 0) + 1);
  const number = (layer: unknown) => Number(`${layer ?? 1}`.match(/\d+/)?.[0] ?? 1);
  for (const { id } of read(join(out, "data/maps/hoenn.json")).sections) {
    const data = read(join(out, `data/maps/${id}.json`)) as { chunks: { layer: string; x: number; y: number; tiles: number[] }[]; areas: { type: string; name: string; points: number[] }[] };
    const lowest = Math.min(...data.chunks.map(({ layer }) => number(layer)));
    const areas = data.areas.filter(({ type, name }) => (type === "creatures") && (name === "walk"));
    const grids = new Map<number, Map<string, number>>();
    for (const { layer, x: X, y: Y, tiles } of data.chunks) {
      const grid = grids.get(number(layer)) ?? grids.set(number(layer), new Map()).get(number(layer))!;
      tiles.forEach((frame, i) => (frame) && (frame < 6215) && grid.set(`${X + i % 16};${Y + Math.floor(i / 16)}`, frame));
    }
    //Where each tile usually sits: its place in the stack of tiles on a spot (ground, then objects, then above)
    const order = [...grids.keys()].sort((a, b) => a - b);
    for (const key of new Set(order.flatMap((n) => [...grids.get(n)!.keys()]))) {
      let depth = 0;
      for (const n of order) {
        const frame = grids.get(n)!.get(key);
        if (frame) {
          increment(stacked[Math.min(depth++, 2)], frame);
        }
      }
    }
    for (const [layer, grid] of grids) {
      for (const [key, frame] of grid) {
        if (layer === lowest) {
          increment(lower, frame);
          continue;
        }
        increment(upper, frame);
        const [x, y] = key.split(";").map(Number);
        if ((grid.get(`${x + 1};${y}`) === frame) && (grid.get(`${x};${y + 1}`) === frame)) {
          increment(repeated, frame);
        }
        if (areas.some(({ points }) => inside(points, x + 0.5, y + 0.5))) {
          increment(grass, frame);
        }
      }
    }
  }

  const ground = [...lower].filter(([frame, n]) => (n >= 12) && (n * 3 >= (upper.get(frame) ?? 0))).map(([frame]) => frame);
  const floors = [...upper].filter(([frame, n]) => (n >= 30) && ((repeated.get(frame) ?? 0) / n >= 0.25) && (opaque(frame, 0.97))).map(([frame]) => frame);
  //Edges have rounded corners, while trees and signs are much more transparent
  const edges = [...ground, ...floors].flatMap((frame) => [-114, -113, -112, -1, 1, 112, 113, 114].map((delta) => frame + delta)).filter((frame) => (upper.has(frame) || lower.has(frame)) && (opaque(frame, 0.84)));
  const tall = [...grass].filter(([, n]) => n >= 8).map(([frame]) => frame);
  const walkable = [...new Set([...ground, ...floors, ...edges, ...tall, 206, 93, 658, 659, 660])].sort((a, b) => a - b);
  //Usual layer of each tile, so picking tiles in the palette can switch to it (objects when not listed)
  const usual = (rank: number) => [...stacked[rank].keys()].filter((frame) => stacked.every((counts, other) => (other === rank) || ((counts.get(frame) ?? 0) < stacked[rank].get(frame)!))).sort((a, b) => a - b);
  save("data/city/tiles.json", { walkable, layers: { ground: usual(0), above: usual(2) } });
}

//=================================================================================================
// Run

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((arg) => !arg.startsWith("--"));
const steps = { assets, tilesets, maps, pokedex, tiles } as { [name: string]: (options: { force: boolean }) => void };
for (const name of only.length ? only : Object.keys(steps)) {
  if (!(name in steps)) {
    throw new Error(`Unknown step "${name}" (expected one of: ${Object.keys(steps).join(", ")})`);
  }
  steps[name]({ force });
}
step("done");
