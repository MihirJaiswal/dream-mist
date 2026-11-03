/**
 * Gen 3 graphics from the pret decompilation of Pokémon Emerald (github.com/pret/pokeemerald), turned into files the game loads:
 *
 *   game/battle/<scene>.png             battle backgrounds (240×112, the battle bases drawn in) and <scene>-edge.png to widen them
 *   game/textures/rse/people.{png,json} every walking overworld person, as a sprite sheet (names start with "em_")
 *   game/tilesets/emerald/<name>.png    every Emerald tileset, its metatiles as 16px tiles, and index.json listing them
 *   game/tilesets/emerald/<name>.json   what each of its tiles does: blocked (learned from the real maps), a behavior, tall grass
 *   game/battle/anims/<name>.png        attack animation sprites (frames stacked from top to bottom), and index.json with their frame sizes
 *
 * The repository is cloned once into .cache/pret (only the folders used here). Its files are only read as data.
 * GBA graphics are 8×8 tiles in 4-bit indexed PNGs, tile maps of 16-bit entries (tile, flips, palette) and JASC palettes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { inflateSync } from "node:zlib";
import { PNG } from "pngjs";

/** Clone of pret/pokeemerald */
const repo = ".cache/pret";

/** Folders and files of the decompilation used here */
const sources = [
  "graphics/battle_environment",
  "graphics/object_events/pics/people",
  "graphics/object_events/palettes",
  "data/tilesets",
  "/data/layouts/layouts.json",
  "/src/data/object_events/object_event_graphics_info.h",
  "/src/data/object_events/object_event_pic_tables.h",
  "/src/data/object_events/object_event_graphics.h",
  "/include/constants/metatile_behaviors.h",
  "data/layouts",
  "graphics/battle_anims/sprites",
];

type Color = [number, number, number];
type Indexed = { width: number; height: number; pixels: Uint8Array };

/** Clone the decompilation (once, only the folders used) */
function clone(log: (text: string) => void) {
  if (existsSync(join(repo, "graphics"))) {
    return;
  }
  log("downloading pret/pokeemerald graphics (first run only)");
  execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/pret/pokeemerald.git", repo], { stdio: "inherit" });
  execFileSync("git", ["sparse-checkout", "set", "--no-cone", ...sources], { cwd: repo, stdio: "inherit" });
}

/** Read an indexed PNG (4 or 8 bits per pixel) as palette indices */
export function indexed(path: string): Indexed {
  const data = readFileSync(path);
  let offset = 8,
    width = 0,
    height = 0,
    depth = 0;
  const chunks = [] as Buffer[];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      if (body[9] !== 3 || body[12]) {
        throw new Error(`${path}: not a plain indexed PNG`);
      }
    } else if (type === "IDAT") {
      chunks.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = Math.ceil((width * depth) / 8);
  const pixels = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x ? line[x - 1] : 0,
        b = previous[x],
        c = x ? previous[x - 1] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      line[x] = (line[x] + [0, a, b, (a + b) >> 1, paeth][filter]) & 255;
    }
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = depth === 4 ? (line[x >> 1] >> (x & 1 ? 0 : 4)) & 15 : line[x];
    }
    previous = line;
  }
  return { width, height, pixels };
}

/** Read a JASC palette */
export function jasc(path: string): Color[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  return lines.slice(3, 3 + Number(lines[2])).map((line) => line.trim().split(/\s+/).map(Number) as Color);
}

/** An RGBA image to draw into */
function canvas(width: number, height: number) {
  const png = new PNG({ width, height });
  png.data.fill(0);
  const set = (x: number, y: number, [r, g, b]: Color) => {
    const i = (y * width + x) * 4;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  };
  return { png, set };
}

/** Save a PNG */
function write(path: string, png: PNG) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

/** Draw one 8×8 tile of a tile sheet (color 0 is see-through unless `solid`) */
function tile(
  sheet: Indexed,
  index: number,
  palette: Color[],
  draw: (x: number, y: number, color: Color) => void,
  { x, y, hflip = false, vflip = false, solid = false }: { x: number; y: number; hflip?: boolean; vflip?: boolean; solid?: boolean },
) {
  const columns = sheet.width / 8;
  const tx = (index % columns) * 8,
    ty = Math.floor(index / columns) * 8;
  if (ty >= sheet.height) {
    return;
  }
  for (let v = 0; v < 8; v++) {
    for (let u = 0; u < 8; u++) {
      const color = sheet.pixels[(ty + (vflip ? 7 - v : v)) * sheet.width + tx + (hflip ? 7 - u : u)];
      if ((color || solid) && palette[color]) {
        draw(x + u, y + v, palette[color]);
      }
    }
  }
}

//=================================================================================================
// Battle backgrounds

/** Battle scenes, with the palette of each (stadium has one per Elite Four member: the Battle Frontier's is used) */
const scenes = {
  tall_grass: "palette",
  long_grass: "palette",
  sand: "palette",
  pond_water: "palette",
  water: "palette",
  rock: "palette",
  cave: "palette",
  building: "palette",
  sky: "palette",
  underwater: "palette",
  stadium: "battle_frontier",
} as const;

/** Battle backgrounds: the top 240×112 of each scene's tile map (palettes start at slot 2), plus an edge strip of each row's main color */
function battles(out: string) {
  for (const [scene, palette] of Object.entries(scenes)) {
    const folder = join(repo, "graphics/battle_environment", scene);
    const sheet = indexed(join(folder, "tiles.png"));
    const colors = jasc(join(folder, `${palette}.pal`));
    const map = readFileSync(join(folder, "map.bin"));
    const { png, set } = canvas(240, 112);
    for (let i = 0; i < 32 * 14; i++) {
      const entry = map.readUInt16LE(i * 2);
      const x = (i % 32) * 8,
        y = Math.floor(i / 32) * 8;
      if (x >= 240) {
        continue;
      }
      const slot = (entry >> 12) - 2;
      tile(sheet, entry & 0x3ff, colors.slice(slot * 16, slot * 16 + 16), (u, v, color) => u < 240 && set(u, v, color), {
        x,
        y,
        hflip: Boolean(entry & 0x400),
        vflip: Boolean(entry & 0x800),
        solid: true,
      });
    }
    write(join(out, "battle", `${scene}.png`), png);
    //Each row's most common color, to fill the stage around the picture on wide screens
    const edge = canvas(1, 112);
    for (let y = 0; y < 112; y++) {
      const counts = new Map<string, number>();
      for (let x = 0; x < 240; x++) {
        const key = [...png.data.subarray((y * 240 + x) * 4, (y * 240 + x) * 4 + 3)].join();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      edge.set(
        0,
        y,
        [...counts]
          .sort((a, b) => b[1] - a[1])[0][0]
          .split(",")
          .map(Number) as Color,
      );
    }
    write(join(out, "battle", `${scene}-edge.png`), edge.png);
  }
}

//=================================================================================================
// Attack animations

/** Animation sprites used by battles: one or two per type, impacts and glows (their PNGs carry their real colors) */
const anims = [
  "impact",
  "hit",
  "punch_impact",
  "small_ember",
  "fire",
  "water_orb",
  "bubble",
  "lightning",
  "spark_0",
  "leaf",
  "razor_leaf",
  "ice_crystals_0",
  "ice_chunk",
  "poison_bubble",
  "flying_dirt",
  "rocks",
  "gust",
  "white_feather",
  "spiral",
  "needle",
  "shadow_ball",
  "blue_flames",
  "purple_scratch",
  "metal_ball",
  "pink_heart_2",
  "sparkle_1",
  "protect",
  "yellow_star",
];

/** Export the animation sprites as they are (color 0 see-through), with their frame size (square frames, stacked) */
function animations(out: string) {
  const index = {} as Record<string, { size: number; frames: number }>;
  for (const name of anims) {
    const file = join(repo, "graphics/battle_anims/sprites", `${name}.png`);
    if (!existsSync(file)) continue;
    const data = readFileSync(file);
    const sheet = indexed(file);
    //The palette of the PNG itself
    const colors = [] as Color[];
    let offset = 8;
    while (offset < data.length) {
      const length = data.readUInt32BE(offset);
      if (data.toString("ascii", offset + 4, offset + 8) === "PLTE") {
        for (let i = 0; i < length; i += 3) colors.push([data[offset + 8 + i], data[offset + 9 + i], data[offset + 10 + i]]);
      }
      offset += 12 + length;
    }
    const { png, set } = canvas(sheet.width, sheet.height);
    for (let y = 0; y < sheet.height; y++) {
      for (let x = 0; x < sheet.width; x++) {
        const color = sheet.pixels[y * sheet.width + x];
        if (color && colors[color]) set(x, y, colors[color]);
      }
    }
    write(join(out, "battle/anims", `${name}.png`), png);
    const size = Math.min(sheet.width, sheet.height);
    index[name] = { size, frames: Math.max(1, Math.floor(sheet.height / size)) };
  }
  writeFileSync(join(out, "battle/anims/index.json"), JSON.stringify(index));
  return Object.keys(index).length;
}

//=================================================================================================
// Overworld people

/** Walking overworld people: 9 frames (down, up, left standing, then two walking frames each), drawn with their real palette */
function people(out: string) {
  const info = readFileSync(join(repo, "src/data/object_events/object_event_graphics_info.h"), "utf8");
  const tables = readFileSync(join(repo, "src/data/object_events/object_event_pic_tables.h"), "utf8");
  const graphics = readFileSync(join(repo, "src/data/object_events/object_event_graphics.h"), "utf8");
  const files = new Map([...graphics.matchAll(/gObjectEventPic_(\w+)\[\] = \w+\("([^"]+\.png)"/g)].map(([, name, file]) => [name, file]));
  const sheets = new Map<string, { file: string; palette: string; width: number; height: number }>();
  for (const [, body] of info.matchAll(/gObjectEventGraphicsInfo_\w+ = \{([\s\S]*?)\};/g)) {
    const tag = body.match(/\.paletteTag = OBJ_EVENT_PAL_TAG_(\w+)/)?.[1];
    const table = body.match(/\.images = (sPicTable_\w+)/)?.[1];
    const anims = body.match(/\.anims = (\w+)/)?.[1];
    const width = Number(body.match(/\.width = (\d+)/)?.[1]),
      height = Number(body.match(/\.height = (\d+)/)?.[1]);
    if (!tag || !table || !["sAnimTable_Standard", "sAnimTable_BrendanMayNormal"].includes(anims ?? "")) {
      continue;
    }
    const frames = tables.match(new RegExp(`${table}\\[\\] = \\{([\\s\\S]*?)\\};`))?.[1].match(/overworld_frame\((\w+)/g) ?? [];
    const pic = frames[0]?.replace("overworld_frame(gObjectEventPic_", "");
    const file = pic ? files.get(pic) : undefined;
    const palette = join(repo, "graphics/object_events/palettes", `${tag.toLowerCase()}.pal`);
    //The player's other sheets (biking, watering…) aren't people of their own
    const player = /\/(brendan|may|ruby_sapphire_brendan|ruby_sapphire_may)\//.test(file ?? "") && basename(file ?? "") !== "walking.png";
    if (!file || player || frames.length < 9 || !file.includes("/people/") || !existsSync(palette) || !existsSync(join(repo, file))) {
      continue;
    }
    //Named after the picture: "hiker", "roxanne", and the folder for the player's "walking" sheets
    const name = basename(file, ".png") === "walking" ? basename(dirname(file)) : basename(file, ".png");
    if (!sheets.has(name)) {
      sheets.set(name, { file: join(repo, file), palette, width, height });
    }
  }
  //Pack every frame on one sheet: four directions × three frames (right is left mirrored), one row per person
  const list = [...sheets].sort(([a], [b]) => a.localeCompare(b));
  const cell = 32;
  const sheet = canvas(12 * cell, list.length * cell);
  const json = {
    frames: {} as Record<string, unknown>,
    meta: { image: "people.png", format: "RGBA8888", size: { w: 12 * cell, h: list.length * cell }, scale: "1" },
  };
  const order = { down: [0, 3, 4], up: [1, 5, 6], left: [2, 7, 8], right: [2, 7, 8] } as const;
  list.forEach(([name, { file, palette, width, height }], row) => {
    const pic = indexed(file);
    const colors = jasc(palette);
    let column = 0;
    for (const [dir, frames] of Object.entries(order)) {
      frames.forEach((frame, n) => {
        const x0 = column * cell,
          y0 = row * cell;
        for (let v = 0; v < height; v++) {
          for (let u = 0; u < width; u++) {
            const color = pic.pixels[v * pic.width + frame * width + (dir === "right" ? width - 1 - u : u)];
            if (color) {
              sheet.set(x0 + u, y0 + v, colors[color]);
            }
          }
        }
        json.frames[`em_${name}_${dir}_${n}`] = {
          frame: { x: x0, y: y0, w: width, h: height },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: width, h: height },
          sourceSize: { w: width, h: height },
        };
        column++;
      });
    }
  });
  write(join(out, "textures/rse/people.png"), sheet.png);
  writeFileSync(join(out, "textures/rse/people.json"), JSON.stringify(json));
  return list.length;
}

//=================================================================================================
// Tilesets

/** "gTileset_PetalburgGym" → "petalburg_gym" */
const folderOf = (symbol: string) =>
  symbol
    .replace(/^gTileset_/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

/** Emerald tile behaviors (MB_*), by number, from the enum of the decompilation */
function behaviorNames() {
  const text = readFileSync(join(repo, "include/constants/metatile_behaviors.h"), "utf8");
  const body = text.slice(text.indexOf("enum {"), text.indexOf("};"));
  let value = -1;
  const names = [] as string[];
  for (const [, name, explicit] of body.matchAll(/\b(MB_\w+)\s*(?:=\s*(0x[0-9a-fA-F]+|\d+))?\s*,/g)) {
    value = explicit ? Number(explicit) : value + 1;
    names[value] = name;
  }
  return names;
}

/** DreamMist tile behavior of an Emerald one (see src/game/behaviors.ts): ledges, surf water, ice, push tiles */
function dreammist(name = "") {
  const dir = name.match(/_(EAST|WEST|NORTH|SOUTH)(?:WARD)?(?:_CURRENT)?$/)?.[1];
  if (/^MB_JUMP_(EAST|WEST|NORTH|SOUTH)$/.test(name)) return { SOUTH: 1, NORTH: 2, WEST: 3, EAST: 4 }[dir!]!;
  if (/^MB_(POND_WATER|INTERIOR_DEEP_WATER|DEEP_WATER|SOOTOPOLIS_DEEP_WATER|OCEAN_WATER|NO_SURFACING|\w+WARD_CURRENT)$/.test(name)) return 5;
  if (/^MB_(ICE|THIN_ICE|CRACKED_ICE)$/.test(name)) return 6;
  if (/^MB_(WALK|SLIDE)_(EAST|WEST|NORTH|SOUTH)$/.test(name)) return { NORTH: 7, SOUTH: 8, WEST: 9, EAST: 10 }[dir!]!;
  return 0;
}

/** Every tileset as a sheet of its 16px metatiles (8 per row), bottom and top layers drawn together (color 0 stays see-through, as in the game) */
function tilesets(out: string) {
  const root = join(repo, "data/tilesets");
  mkdirSync(join(out, "tilesets/emerald"), { recursive: true });
  const names = behaviorNames();
  //Secondary tilesets are drawn with the primary their maps use most
  const pairs = new Map<string, Map<string, number>>();
  //How often each tile is blocked in the real maps: tileset → metatile → [walkable, blocked]
  const usage = new Map<string, Map<number, [number, number]>>();
  const count = (tileset: string, metatile: number, blocked: boolean) => {
    const tiles = usage.get(tileset) ?? new Map<number, [number, number]>();
    const seen = tiles.get(metatile) ?? [0, 0];
    seen[blocked ? 1 : 0]++;
    tiles.set(metatile, seen);
    usage.set(tileset, tiles);
  };
  for (const layout of JSON.parse(readFileSync(join(repo, "data/layouts/layouts.json"), "utf8")).layouts ?? []) {
    if (!layout.secondary_tileset) continue;
    const secondary = folderOf(layout.secondary_tileset),
      primary = folderOf(layout.primary_tileset);
    const counts = pairs.get(secondary) ?? new Map();
    counts.set(primary, (counts.get(primary) ?? 0) + 1);
    pairs.set(secondary, counts);
    //Map blocks: metatile (10 bits), collision (2 bits), elevation (4 bits)
    const file = join(repo, layout.blockdata_filepath ?? "");
    if (!layout.blockdata_filepath || !existsSync(file)) continue;
    const blocks = readFileSync(file);
    for (let i = 0; i + 1 < blocks.length; i += 2) {
      const block = blocks.readUInt16LE(i);
      const metatile = block & 0x3ff;
      count(metatile < 512 ? primary : secondary, metatile < 512 ? metatile : metatile - 512, Boolean(block & 0xc00));
    }
  }
  //What each tile does: blocked (1), walkable (0) or never used in a map (-1), its DreamMist behavior, and tall grass
  const rules = (name: string, folder: string, total: number) => {
    const attributes = readFileSync(join(folder, "metatile_attributes.bin"));
    const seen = usage.get(name) ?? new Map();
    const solid = [] as number[],
      behavior = [] as number[],
      grass = [] as number[];
    for (let m = 0; m < total; m++) {
      const mb = names[m * 2 + 1 < attributes.length ? attributes.readUInt16LE(m * 2) & 0xff : 0];
      const [walk, block] = seen.get(m) ?? [0, 0];
      const value = dreammist(mb);
      behavior.push(value);
      //Deep water is walkable in the game's collision (surfing is its behavior's job): DreamMist blocks it and lets surfers through
      solid.push(value === 5 || mb === "MB_WATERFALL" ? 1 : walk + block ? (block > walk ? 1 : 0) : -1);
      grass.push(mb === "MB_TALL_GRASS" || mb === "MB_LONG_GRASS" ? 1 : 0);
    }
    return { solid, behavior, grass };
  };
  const load = (kind: "primary" | "secondary", name: string) => {
    const folder = join(root, kind, name);
    return {
      sheet: indexed(join(folder, "tiles.png")),
      palettes: Array.from({ length: 16 }, (_, i) => {
        const file = join(folder, "palettes", `${String(i).padStart(2, "0")}.pal`);
        return existsSync(file) ? jasc(file) : [];
      }),
      metatiles: readFileSync(join(folder, "metatiles.bin")),
    };
  };
  const index = [] as { name: string; file: string; kind: string; count: number }[];
  const render = (name: string, kind: "primary" | "secondary", own: ReturnType<typeof load>, primary: ReturnType<typeof load>) => {
    writeFileSync(
      join(out, "tilesets/emerald", `${kind === "primary" ? "primary-" : ""}${name}.json`),
      JSON.stringify(rules(name, join(root, kind, name), own.metatiles.length / 16)),
    );
    const count = own.metatiles.length / 16;
    const rows = Math.ceil(count / 8);
    const { png, set } = canvas(8 * 16, rows * 16);
    //Primary tiles and palettes 0 to 5 come from the primary tileset, the rest from the secondary one
    const palettes = primary.palettes.map((colors, i) => (i < 6 || kind === "primary" ? colors : own.palettes[i]));
    for (let m = 0; m < count; m++) {
      for (let layer = 0; layer < 2; layer++) {
        for (let part = 0; part < 4; part++) {
          const entry = own.metatiles.readUInt16LE(m * 16 + (layer * 4 + part) * 2);
          const number = entry & 0x3ff;
          const sheet = number < 512 ? primary.sheet : own.sheet;
          tile(sheet, number < 512 ? number : number - 512, palettes[entry >> 12] ?? [], set, {
            x: (m % 8) * 16 + (part % 2) * 8,
            y: Math.floor(m / 8) * 16 + Math.floor(part / 2) * 8,
            hflip: Boolean(entry & 0x400),
            vflip: Boolean(entry & 0x800),
          });
        }
      }
    }
    const file = `${kind === "primary" ? "primary-" : ""}${name}.png`;
    write(join(out, "tilesets/emerald", file), png);
    index.push({ name, file, kind, count });
  };
  const primaries = new Map(readdirSync(join(root, "primary")).map((name) => [name, load("primary", name)]));
  for (const [name, own] of primaries) {
    render(name, "primary", own, own);
  }
  for (const name of readdirSync(join(root, "secondary"))) {
    if (!existsSync(join(root, "secondary", name, "metatiles.bin")) || !existsSync(join(root, "secondary", name, "tiles.png"))) continue;
    const used = [...(pairs.get(name) ?? new Map())].sort((a, b) => b[1] - a[1])[0]?.[0];
    const primary = primaries.get(used ?? "") ?? primaries.get("general")!;
    render(name, "secondary", load("secondary", name), primary);
  }
  index.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "primary" ? -1 : 1));
  writeFileSync(join(out, "tilesets/emerald/index.json"), JSON.stringify(index));
  return index.length;
}

/** Build every pret asset */
export function pret(out: string, log: (text: string) => void) {
  clone(log);
  log("drawing battle backgrounds");
  battles(out);
  log(`exported ${animations(out)} attack animation sprites`);
  log(`packed ${people(out)} overworld people`);
  log(`drew ${tilesets(out)} tilesets`);
}
