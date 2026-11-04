/**
 * Interior templates: Emerald's real rooms (Pokémon Center, Poké Mart, houses, lab, gyms, caves…),
 * built from pret/pokeemerald by `npm run data -- pret` into game/data/rooms.json, with their exits, stairs and who works there.
 */

//Imports
import { WATER } from "./behaviors";
import { type City, interior, type Npc } from "./data";
import { encode, ruleOf } from "./tilesets";

/** An Emerald room: its size, its two Emerald tilesets (sheet files), its blocks (metatile, collision and elevation bits), exits, stairs and people */
export type Interior = {
  key: string;
  label: string;
  /** An upper floor, only made with the room whose stairs lead to it */
  floor: boolean;
  width: number;
  height: number;
  primary: string;
  secondary: string;
  blocks: number[];
  exits: { x: number; y: number }[];
  stairs: { x: number; y: number; to: string }[];
  /** Who stands there in the game, named after their picture */
  people: { x: number; y: number; look: string }[];
  kind: "indoor" | "cave" | "outdoor";
  dark: boolean;
};

let cache: Promise<Interior[]> | null = null;

/** Every room (downloaded once) */
export function loadRooms() {
  cache ??= fetch("/game/data/rooms.json")
    .then((response) => (response.ok ? (response.json() as Promise<Interior[]>) : []))
    .catch(() => ((cache = null), []));
  return cache;
}

/** Tileset name of a sheet file ("primary-building.png" → "building") */
export function sheetName(file: string) {
  return file.replace(/^primary-/, "").replace(/\.png$/, "");
}

/** People who work in a room come along (the Nurse, the clerk, the gym leader…): the others are left for the builder */
function staffOf(room: string, look: string): Partial<Npc> | null {
  const leader = (sprite: string, badge: string, team: { species: number; level: number }[], defeat: string): Partial<Npc> => ({
    sprite,
    name: "Gym Leader",
    role: "trainer",
    dialogue: "Welcome, challenger! Show me what you've got!",
    trainer: { team, gym: true, badge, defeat },
  });
  if (look === "nurse") {
    return {
      sprite: "shopkeeper_f",
      name: "Nurse",
      role: "healer",
      dialogue: "Welcome to the Pokémon Center!\n\nWe restore your tired Pokémon to full health.",
    };
  }
  if (look === "mart_employee") {
    return { sprite: "em_mart_employee", name: "Clerk", role: "shop", dialogue: "Welcome! How may I serve you?" };
  }
  if (look === "prof_birch") {
    return { sprite: "em_prof_birch", name: "Professor", dialogue: "Welcome to my lab! I study how Pokémon live in the wild." };
  }
  if (look === "mom") {
    return { sprite: "em_mom", name: "Mom", dialogue: "Make yourself at home!" };
  }
  if (look === "old_woman" && room === "daycare") {
    return { sprite: "em_old_woman", name: "Day Care Lady", role: "daycare", dialogue: "I'm the Day Care Lady. We can raise Pokémon for you." };
  }
  if (look === "roxanne") {
    return leader(
      "em_roxanne",
      "Stone Badge",
      [
        { species: 74, level: 12 },
        { species: 299, level: 15 },
      ],
      "So… I lost. You've earned the Stone Badge!",
    );
  }
  if (look === "brawly") {
    return leader(
      "em_brawly",
      "Knuckle Badge",
      [
        { species: 66, level: 16 },
        { species: 296, level: 19 },
      ],
      "Whoa, wow! You made a much bigger splash than I expected!",
    );
  }
  return null;
}

/** Build a room as a new interior of a city; `sheets` are the indexes of its two Emerald tilesets among the city's tilesets */
export function buildRoom(world: City, room: Interior, sheets: { primary: number; secondary: number }, name = room.label) {
  const map = interior(world, { name, width: room.width, height: room.height });
  map.type = room.kind;
  if (room.dark) {
    map.dark = true;
  }
  const { width } = map;
  room.blocks.forEach((block, i) => {
    const metatile = block & 0x3ff;
    const value = metatile < 512 ? encode(sheets.primary, metatile) : encode(sheets.secondary, metatile - 512);
    map.layers.ground[i] = value;
    const behavior = ruleOf(value)?.behavior ?? 0;
    map.behavior[i] = behavior;
    //Blocked where the game's collision says so (deep water stays blocked: surfing lets the player through)
    map.solid[i] = block & 0xc00 || behavior === WATER ? 1 : 0;
  });
  for (const { x, y } of room.exits) {
    map.doors.push({ x, y, to: "", tx: -1, ty: -1 });
    map.solid[y * width + x] = 0;
  }
  for (const { x, y, look } of room.people) {
    const staff = staffOf(room.key, look);
    if (staff) {
      map.npcs.push({ x, y, sprite: "generic_f1", dir: "down", name: "", dialogue: "", role: "talk", wander: false, ...staff } as Npc);
    }
  }
  //Arrive by the first exit when testing from here
  const exit = room.exits[0];
  if (exit) {
    map.spawn = { x: exit.x, y: exit.y >= room.height - 1 ? exit.y - 1 : exit.y + 1 };
  }
  return map;
}
