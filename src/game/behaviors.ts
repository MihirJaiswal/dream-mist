/**
 * Tile behaviors: what a tile does when walked on, painted on the Collision layer.
 * Stored in the `behavior` grid of each map (0 = a normal tile).
 */

//Imports
import type { Direction } from "./data";

/** Every tile behavior, by its value in the grid */
export const behaviors = [
  { value: 1, key: "ledge-down", label: "Ledge ↓", dir: "down", hint: "Jump down off it. Can't be climbed back up" },
  { value: 2, key: "ledge-up", label: "Ledge ↑", dir: "up", hint: "Jump up off it. Can't be climbed back down" },
  { value: 3, key: "ledge-left", label: "Ledge ←", dir: "left", hint: "Jump left off it. Can't be climbed back" },
  { value: 4, key: "ledge-right", label: "Ledge →", dir: "right", hint: "Jump right off it. Can't be climbed back" },
  { value: 5, key: "water", label: "Surf", dir: null, hint: "Deep water: crossed by surfing once a party Pokémon is Water type" },
  { value: 6, key: "ice", label: "Ice", dir: null, hint: "Slippery: the player slides until something stops them" },
  { value: 7, key: "arrow-up", label: "Push ↑", dir: "up", hint: "Pushes the player up until they reach a normal tile" },
  { value: 8, key: "arrow-down", label: "Push ↓", dir: "down", hint: "Pushes the player down until they reach a normal tile" },
  { value: 9, key: "arrow-left", label: "Push ←", dir: "left", hint: "Pushes the player left until they reach a normal tile" },
  { value: 10, key: "arrow-right", label: "Push →", dir: "right", hint: "Pushes the player right until they reach a normal tile" },
] as const satisfies readonly { value: number; key: string; label: string; dir: Direction | null; hint: string }[];

/** Behavior values with a name */
export const WATER = 5;
export const ICE = 6;

/** Direction a ledge is jumped off (null when not a ledge) */
export function ledge(value: number): Direction | null {
  return value >= 1 && value <= 4 ? behaviors[value - 1].dir : null;
}

/** Direction a push tile moves the player (null when not one) */
export function arrow(value: number): Direction | null {
  return value >= 7 && value <= 10 ? behaviors[value - 1].dir : null;
}

/** Does walking on this tile keep the player moving on their own (ice, push tiles) */
export function slippery(value: number) {
  return value === ICE || arrow(value) !== null;
}

/** Is a value a known behavior */
export function isBehavior(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= behaviors.length;
}
