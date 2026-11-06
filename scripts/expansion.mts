/**
 * Graphics from pokeemerald-expansion (github.com/rh-hideout/pokeemerald-expansion), the Emerald decompilation extended to every Pokémon:
 *
 *   game/followers/<id>.png   every Pokémon walking on the map, in Gen 3 style: one row of frames (down, up, left, right) in its
 *                             colors, and the same row below in its shiny colors. Frames are as wide as they are tall (32 or 64 px)
 *   game/items/<name>.png     icons of the items newer than Emerald (evolution stones, Linking Cord…), when pret has none
 *
 * The repository is cloned once into .cache/expansion (only the folders used here). Its files are only read as data.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { indexed, jasc, write } from "./pret.mts";

/** Clone of pokeemerald-expansion */
const repo = ".cache/expansion";

/** Folders of the decompilation used here */
const sources = ["/graphics/pokemon/*/overworld*", "/graphics/items/icons/*", "/graphics/items/icon_palettes/*"];

/** Clone the decompilation (once, only the folders used) */
function clone(log: (text: string) => void) {
  if (!existsSync(join(repo, "graphics"))) {
    log("downloading pokeemerald-expansion graphics (first run only)");
    execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/rh-hideout/pokeemerald-expansion.git", repo], {
      stdio: "inherit",
    });
  }
  execFileSync("git", ["sparse-checkout", "set", "--no-cone", ...sources], { cwd: repo, stdio: "inherit" });
}

/** Folder of a Pokémon in the decompilation: its PokeAPI name with underscores, dropping form names it doesn't use ("deoxys-normal" is deoxys) */
function folderOf(key: string) {
  const parts = key.split("-");
  for (let length = parts.length; length > 0; length--) {
    const folder = join(repo, "graphics/pokemon", parts.slice(0, length).join("_"));
    if (existsSync(join(folder, "overworld.png"))) {
      return folder;
    }
  }
  return null;
}

/** A PNG of palette colors (much smaller than full colors): color 0 is see-through */
function palettePng(width: number, height: number, pixels: Uint8Array, colors: [number, number, number][]) {
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])));
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header.set([8, 3, 0, 0, 0], 8);
  //Each row starts with filter 0 (none)
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    rows.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", Buffer.from(colors.flat())),
    chunk("tRNS", Buffer.from([0])),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Overworld sprites of every Pokémon of the Pokédex */
function followers(out: string, pokedex: { id: number; key: string }[]) {
  const missing = [] as string[];
  for (const { id, key } of pokedex) {
    const folder = folderOf(key);
    if (!folder) {
      missing.push(key);
      continue;
    }
    const sheet = indexed(join(folder, "overworld.png"));
    const size = sheet.height;
    //Six frames (down, up, left, two of each: right is the left ones flipped) or eight (with their own right frames)
    const count = sheet.width / size;
    const width = size * 8;
    const pixels = new Uint8Array(width * size * 2);
    //Colors 0-15 are its own, 16-31 its shiny ones (color 0 is see-through)
    const colors = ["overworld_normal.pal", "overworld_shiny.pal"].flatMap((palette) =>
      jasc(join(folder, existsSync(join(folder, palette)) ? palette : "overworld_normal.pal")).slice(0, 16),
    );
    for (let row = 0; row < 2; row++) {
      for (let frame = 0; frame < 8; frame++) {
        //Right frames: their own, or the left ones mirrored
        const flip = frame >= 6 && count < 8;
        const from = flip ? frame - 2 : frame;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const color = sheet.pixels[y * sheet.width + from * size + (flip ? size - 1 - x : x)];
            pixels[(row * size + y) * width + frame * size + x] = color ? color + row * 16 : 0;
          }
        }
      }
    }
    mkdirSync(join(out, "followers"), { recursive: true });
    writeFileSync(join(out, "followers", `${id}.png`), palettePng(width, size * 2, pixels, colors));
  }
  return { count: pokedex.length - missing.length, missing };
}

/** Icons of the game's items that pret's Emerald doesn't have (named after the item, with underscores) */
function icons(out: string) {
  const folder = join(repo, "graphics/items");
  const ids = [...readFileSync("src/game/items.ts", "utf8").matchAll(/^ {2}"?([a-z0-9-]+)"?: \{ name:/gm)].map(([, id]) => id.replace(/-/g, "_"));
  //Items named differently there
  const named = { up_grade: "upgrade" } as Record<string, string>;
  let count = 0;
  for (const name of ids.filter((name) => !existsSync(join(out, "items", `${name}.png`)))) {
    const icon = named[name] ?? name;
    const path = join(folder, "icons", `${icon}.png`);
    if (!existsSync(path)) {
      continue;
    }
    //Its own palette file, or the colors in the PNG itself (color 0 is see-through)
    const palette = join(folder, "icon_palettes", `${icon}.pal`);
    const sheet = indexed(path);
    const png = existsSync(palette) ? new PNG({ width: sheet.width, height: sheet.height }) : PNG.sync.read(readFileSync(path));
    if (existsSync(palette)) {
      const colors = jasc(palette);
      png.data.fill(0);
      sheet.pixels.forEach((color, i) => color && png.data.set([...colors[color], 255], i * 4));
    } else {
      sheet.pixels.forEach((color, i) => color || (png.data[i * 4 + 3] = 0));
    }
    write(join(out, "items", `${name}.png`), png);
    count++;
  }
  return count;
}

/** Build every expansion asset */
export function expansion(out: string, log: (text: string) => void) {
  clone(log);
  const { pokedex } = JSON.parse(readFileSync(join(out, "data/city/pokedex.json"), "utf8"));
  const { count, missing } = followers(out, pokedex);
  log(`drew ${count} walking Pokémon${missing.length ? ` (none for ${missing.join(", ")})` : ""}`);
  log(`exported ${icons(out)} newer item icons`);
  return readdirSync(join(out, "followers")).length;
}
