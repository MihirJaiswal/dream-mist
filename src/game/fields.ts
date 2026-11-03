/**
 * Field moves, like in Pokémon Unbound: no Pokémon has to know them, their HM in the bag is enough.
 * Obstacles stand on the map (People layer) until the player uses the right one on them.
 */

//Imports
import type { ItemId } from "./items";

/** Every field obstacle: how it looks (a tile value), the HM that clears it, and what the game says */
export const fields = {
  cut: {
    label: "Small tree",
    tile: 95,
    hm: "hm-cut",
    move: "Cut",
    look: "This tree looks like it can be cut down!",
    offer: "Would you like to use Cut?",
  },
  smash: {
    label: "Cracked rock",
    tile: 547,
    hm: "hm-rock-smash",
    move: "Rock Smash",
    look: "It's a rugged rock, but a Pokémon may be able to smash it.",
    offer: "Would you like to use Rock Smash?",
  },
  strength: {
    label: "Boulder",
    tile: 546,
    hm: "hm-strength",
    move: "Strength",
    look: "It's a big boulder, but a Pokémon may be able to push it aside.",
    offer: "Would you like to use Strength?",
  },
} as const satisfies Record<string, { label: string; tile: number; hm: ItemId; move: string; look: string; offer: string }>;

/** Kind of obstacle */
export type Field = keyof typeof fields;

/** Every kind of obstacle */
export const fieldIds = Object.keys(fields) as Field[];
