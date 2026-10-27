//Imports
import type { Brush } from "../brushes";
import type { Layer, Npc } from "../data";

/** Editing targets (layers and gameplay grids), in the order of their number shortcuts */
export const targets = [
  { key: "ground", label: "Ground", hint: "Grass, paths, water, floors" },
  { key: "decor", label: "Objects", hint: "Buildings, trees, fences (drawn below player)" },
  { key: "above", label: "Above", hint: "Roofs and tree tops (drawn over the player)" },
  { key: "solid", label: "Collision", hint: "Red tiles block movement" },
  { key: "zone", label: "Encounters", hint: "Where wild Pokémon appear" },
  { key: "story", label: "Story", hint: "Timeline of events, paint gates that open later" },
  { key: "door", label: "Doors", hint: "Click to place doors into houses and buildings" },
  { key: "npc", label: "People", hint: "Click to add or select people, Pokémon and signs" },
  { key: "spawn", label: "Spawn", hint: "Click to set where visitors arrive" },
] as const;
export type Target = typeof targets[number]["key"];

/** Targets that place things instead of painting (only the brush and select tools apply) */
export const placing = ["npc", "spawn", "door"] as readonly Target[];

/** Painting tools */
export const tools = [
  { key: "brush", label: "Brush", shortcut: "B", tip: "Paint with the current brush or stamp" },
  { key: "erase", label: "Eraser", shortcut: "E", tip: "Remove tiles from the current layer" },
  { key: "rect", label: "Rectangle", shortcut: "R", tip: "Drag to fill a rectangle with the brush" },
  { key: "fill", label: "Fill", shortcut: "F", tip: "Fill a connected area of the same tile" },
  { key: "pick", label: "Picker", shortcut: "I", tip: "Click a tile on the map to use it as the brush" },
  { key: "select", label: "Select", shortcut: "S", tip: "Select an area to copy, cut, paste or delete" },
] as const;
export type Tool = typeof tools[number]["key"];

/** Stamp (tile values, 0 = transparent), quick brushes carry extra behaviours */
export type Stamp = { w: number; h: number; tiles: number[] } & Partial<Brush>;

/** Grids copied by the select tool */
export const grids = ["ground", "decor", "above", "solid", "zone", "gate"] as const;
export type Grid = Layer | "solid" | "zone" | "gate";

/** Clipboard (every layer of a rectangular area) */
export type Clip = { w: number; h: number; grids: Record<typeof grids[number], number[]> };

/** Objects that can stand in the way until a story step is done (tile values) */
export const obstacles = [
  { name: "Small tree", tile: 95, message: "A small tree is in the way. Maybe it could be cut down…" },
  { name: "Dry bush", tile: 208, message: "A thorny bush blocks the path." },
  { name: "Boulder", tile: 546, message: "A big boulder blocks the way. It won't budge." },
  { name: "Rocks", tile: 547, message: "Rocks have fallen on the path." },
  { name: "Sign", tile: 206, message: "“Road closed. Come back later.”" },
  { name: "Fence", tile: 1901, message: "A fence blocks the way." },
  { name: "Posts", tile: 1907, message: "Wooden posts block the way." },
];

/** Interior templates */
export const templates = [
  { key: "house", label: "House" },
  { key: "center", label: "Pokémon Center" },
  { key: "gym", label: "Gym" },
  { key: "empty", label: "Empty room" },
] as const;
export type Template = typeof templates[number]["key"];

/** What can be placed on the People layer */
export type Kind = "person" | "pokemon" | "sign";
export const kinds = {
  person: { label: "Person", title: "Villagers, trainers and nurses", hint: "Click an empty tile to add a person." },
  pokemon: { label: "Pokémon", title: "A Pokémon to talk to or battle", hint: "Click an empty tile to place a Pokémon. Pick which one after." },
  sign: { label: "Sign", title: "A sign visitors can read", hint: "Click a tile to put up a sign. A sign post is drawn there if the tile is empty." },
} as const;

/** Kind of someone on the map */
export function kindOf(npc: Npc): Kind {
  return npc.creature ? "pokemon" : npc.sprite ? "person" : "sign";
}

/** Turn someone into another kind, keeping where they stand and their story */
export function convert(npc: Npc, kind: Kind, city: string) {
  delete npc.creature;
  delete npc.trainer;
  if (kind === "pokemon") {
    Object.assign(npc, { sprite: "", creature: { species: 25, level: 5 }, name: "Pikachu", dialogue: "Pika pika!", role: "talk", wander: true });
  } else if (kind === "sign") {
    Object.assign(npc, { sprite: "", name: "Sign", dialogue: `Welcome to ${city}!`, role: "talk", wander: false });
  } else {
    Object.assign(npc, { sprite: "youngster", name: "Villager", dialogue: "Welcome to our town!", role: "talk", wander: true });
  }
}

/** Encounter zone colors */
export const zoneColors = [0x2ecc40, 0x0074d9, 0xff851b, 0xb10dc9, 0xffdc00, 0x39cccc, 0xf012be, 0x01ff70];
