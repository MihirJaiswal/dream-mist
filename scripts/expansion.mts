/**
 * Graphics from pokeemerald-expansion (github.com/rh-hideout/pokeemerald-expansion), the Emerald decompilation extended to every Pokémon:
 *
 *   game/followers/<id>.png   every Pokémon walking on the map, in Gen 3 style: one row of frames (down, up, left, right) in its
 *                             colors, and the same row below in its shiny colors. Frames are as wide as they are tall (32 or 64 px)
 *   game/items/<name>.png     icons of the items newer than Emerald (evolution stones, Linking Cord…), when pret has none
 *   game/battle/anims/moves.json  every move's animation from its battle animation script (the sprites it creates, in order, and the
 *                             color the screen flashes), with the sprites they use in game/battle/anims/<name>.png (index.json: frame sizes)
 *
 * The repository is cloned once into .cache/expansion (only the folders used here). Its files are only read as data.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { indexed, jasc, write } from "./pret.mts";

/** Clone of pokeemerald-expansion */
const repo = ".cache/expansion";

/** Folders of the decompilation used here */
const sources = [
  "/graphics/pokemon/*/overworld*",
  "/graphics/items/icons/*",
  "/graphics/items/icon_palettes/*",
  "/graphics/battle_anims/sprites/*",
  "/data/battle_anim_scripts.s",
  "/src/data/battle_anim.h",
  "/src/graphics.c",
  "/src/battle_anim*.c",
  "/asm/macros/battle_anim_script.inc",
];

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

//=================================================================================================
// Attack animations

/** One sprite of a move's animation: its picture, where it starts (the user or the target), whether it flies at the target, and when (ms) */
type Piece = { s: string; at: "user" | "target"; fly?: 1; t: number };

/** Sprite pictures of the animation tags (ANIM_TAG_SMALL_EMBER → its PNG and palette), from the decompilation's tables */
function tagPictures() {
  const graphics = readFileSync(join(repo, "src/graphics.c"), "utf8");
  const files = new Map([...graphics.matchAll(/(gBattleAnimSprite(?:Gfx|Pal)_\w+)\[\] = INCGFX_U(?:32|16)\("([^"]+)"/g)].map(([, name, path]) => [name, path]));
  const table = readFileSync(join(repo, "src/data/battle_anim.h"), "utf8");
  const pictures = new Map<string, { picture: string; palette: string }>();
  for (const [, tag, gfx, pal] of table.matchAll(/BATTLE_ANIMATION\((ANIM_TAG_\w+),([^,]+(?:\?[^:]+:[^,]+)?),\s*0x\w+,\s*([^)]+(?:\?[^:]+:[^)]+)?)\)/g)) {
    //Of the choices a setting makes between two pictures, the classic one (the last)
    const picture = files.get([...gfx.matchAll(/gBattleAnimSpriteGfx_\w+/g)].at(-1)?.[0] ?? "");
    const palette = files.get([...pal.matchAll(/gBattleAnimSpritePal_\w+/g)].at(-1)?.[0] ?? "");
    //Only sprites of the animation folder (a few borrow a Pokémon's picture)
    if (picture?.endsWith(".png") && palette && existsSync(join(repo, picture)) && existsSync(join(repo, palette))) {
      pictures.set(tag, { picture, palette });
    }
  }
  return pictures;
}

/** Sprite templates: the animation tag they draw, their frame size, and whether they travel to the target (by what their code does) */
function templates() {
  const result = new Map<string, { tag: string; w: number; h: number; fly: boolean }>();
  const code = readdirSync(join(repo, "src"))
    .filter((file) => file.startsWith("battle_anim") && file.endsWith(".c"))
    .map((file) => readFileSync(join(repo, "src", file), "utf8"))
    .join("\n");
  for (const [, name, body] of code.matchAll(/const struct SpriteTemplate (g\w+) =\s*\{([^}]*)\}/g)) {
    const tag = body.match(/\.tileTag = (ANIM_TAG_\w+)/)?.[1];
    const [, w = "32", h = "32"] = body.match(/_(\d+)x(\d+)/) ?? [];
    const callback = body.match(/\.callback = (\w+)/)?.[1] ?? "";
    if (tag) {
      result.set(name, {
        tag,
        w: Number(w),
        h: Number(h),
        fly: /Translate|ToTarget|Travel|Throw|Projectile|Shoot|Launch|Arc|Fly|Linear|Missile|Gun|Beam/i.test(callback),
      });
    }
  }
  //Visual tasks that draw a template themselves (Thunderbolt's bolts)
  const tasks = new Map<string, string>();
  for (const [, task, body] of code.matchAll(/void (AnimTask_\w+)\(u8 taskId\)\s*\{([\s\S]*?)\n\}/g)) {
    const template = body.match(/&(g\w+SpriteTemplate)/)?.[1];
    if (template && result.has(template)) tasks.set(task, template);
  }
  return { result, tasks, code };
}

/** "ThunderPunch" → "thunder-punch", "XScissor" → "x-scissor" (PokeAPI move names) */
function moveKey(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** GBA colors of screen flashes: RGB(r, g, b) has 5 bits per channel */
const colorNames: Record<string, string> = {
  BLACK: "#000000",
  WHITE: "#ffffff",
  RED: "#ff0000",
  GREEN: "#00ff00",
  BLUE: "#0000ff",
  YELLOW: "#ffff00",
  MAGENTA: "#ff00ff",
  CYAN: "#00ffff",
};
function colorOf(line: string) {
  const rgb = line.match(/RGB\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((value) =>
        Math.round((Number(value) * 255) / 31)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }
  return colorNames[line.match(/RGB_(\w+)/)?.[1] ?? ""] ?? null;
}

/**
 * Every move's animation, read from pokeemerald-expansion's battle animation scripts (data/battle_anim_scripts.s, the scripts behind CFRU's too):
 * the sprites it creates in order (following the scripts it calls), and the color the screen flashes. Writes game/battle/anims/moves.json
 * and the sprites they use (palette PNGs) with their frame size in index.json
 */
function attacks(out: string, known: Set<string>) {
  const pictures = tagPictures();
  const { result: sprites, tasks } = templates();
  //Macros that create a sprite (create_fist_sprite, create_basic_hitsplat_sprite…)
  const macros = new Map(
    [...readFileSync(join(repo, "asm/macros/battle_anim_script.inc"), "utf8").matchAll(/\.macro (\w+)[^\n]*\n\s*createsprite (g\w+)/g)].map(
      ([, macro, template]) => [macro, template],
    ),
  );
  //Script labels and their lines
  const labels = new Map<string, string[]>();
  let current = "";
  for (const line of readFileSync(join(repo, "data/battle_anim_scripts.s"), "utf8").split("\n")) {
    const label = line.match(/^(\w+)::?\s*$/)?.[1];
    if (label) {
      current = label;
      labels.set(label, []);
    } else if (current) {
      labels.get(current)!.push(line.trim());
    }
  }
  const used = new Map<string, { picture: string; palette: string; w: number; h: number }>();
  const moves = {} as Record<string, { p: Piece[]; flash?: string }>;
  for (const [label] of labels) {
    const key = label.startsWith("gBattleAnimMove_") ? moveKey(label.slice("gBattleAnimMove_".length)) : "";
    if (!known.has(key)) {
      continue;
    }
    const pieces = [] as Piece[];
    let time = 0;
    let flash: string | null = null;
    const seen = new Set<string>();
    const walk = (name: string, depth: number) => {
      if (depth > 4 || seen.has(name)) return;
      seen.add(name);
      for (const line of labels.get(name) ?? []) {
        if (line === "end" || line === "return") return;
        const [word, ...rest] = line.split(/[\s,]+/);
        if (word === "delay") time += Number(rest[0]) || 0;
        else if (word === "call" || word === "goto") walk(rest[0], depth + 1);
        else if (!flash && /F_PAL_BG/.test(line)) flash = colorOf(line);
        let template = word === "createsprite" ? rest[0] : macros.get(word);
        let battler = word === "createsprite" ? rest[1] : rest[0];
        if (word === "createvisualtask" && tasks.has(rest[0])) {
          template = tasks.get(rest[0]);
          battler = "ANIM_TARGET";
        }
        const sprite = template ? sprites.get(template) : undefined;
        const picture = sprite && pictures.get(sprite.tag);
        if (sprite && picture && pieces.length < 12) {
          const name = basename(picture.picture, ".png");
          used.set(name, { ...picture, w: sprite.w, h: sprite.h });
          pieces.push({
            s: name,
            at: battler === "ANIM_ATTACKER" || battler === "ANIM_ATK_PARTNER" ? "user" : "target",
            ...(sprite.fly ? { fly: 1 as const } : {}),
            t: Math.round((time * 1000) / 60),
          });
        }
      }
    };
    walk(label, 0);
    if (pieces.length || flash) {
      moves[key] = { p: pieces, ...(flash ? { flash } : {}) };
    }
  }
  //The sprites, in their palettes
  const indexPath = join(out, "battle/anims/index.json");
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};
  for (const [name, { picture, palette, w, h }] of used) {
    const sheet = indexed(join(repo, picture));
    const colors = palette.endsWith(".pal") ? jasc(join(repo, palette)) : ownColors(join(repo, palette));
    mkdirSync(join(out, "battle/anims"), { recursive: true });
    writeFileSync(join(out, "battle/anims", `${name}.png`), palettePng(sheet.width, sheet.height, sheet.pixels, colors.slice(0, 16)));
    //Frames are stacked from top to bottom (sheets wider than a frame show their first column; smaller ones are one frame)
    const fw = Math.min(w, sheet.width),
      fh = Math.min(h, sheet.height);
    index[name] = { size: fw, h: fh, frames: Math.max(1, Math.floor(sheet.height / fh)), sw: sheet.width };
  }
  writeFileSync(indexPath, JSON.stringify(index));
  writeFileSync(join(out, "battle/anims/moves.json"), JSON.stringify(moves));
  return { moves: Object.keys(moves).length, sprites: used.size };
}

/** The palette inside an indexed PNG */
function ownColors(path: string) {
  const data = readFileSync(path);
  const colors = [] as [number, number, number][];
  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    if (data.toString("ascii", offset + 4, offset + 8) === "PLTE") {
      for (let i = 0; i < length; i += 3) colors.push([data[offset + 8 + i], data[offset + 9 + i], data[offset + 10 + i]]);
    }
    offset += 12 + length;
  }
  return colors;
}

/** Build every expansion asset */
export function expansion(out: string, log: (text: string) => void) {
  clone(log);
  const { pokedex } = JSON.parse(readFileSync(join(out, "data/city/pokedex.json"), "utf8"));
  const { count, missing } = followers(out, pokedex);
  log(`drew ${count} walking Pokémon${missing.length ? ` (none for ${missing.join(", ")})` : ""}`);
  log(`exported ${icons(out)} newer item icons`);
  const { moves } = JSON.parse(readFileSync(join(out, "data/city/pokedex.json"), "utf8"));
  const made = attacks(out, new Set(Object.keys(moves)));
  log(`read the animations of ${made.moves} of ${Object.keys(moves).length} moves (${made.sprites} sprites)`);
  return readdirSync(join(out, "followers")).length;
}
