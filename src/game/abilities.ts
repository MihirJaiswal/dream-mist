/**
 * Abilities in battle. Every Pokémon has one of its species' abilities (shown in its summary);
 * the ones listed here also change how battles go. The others are only names for now.
 */

//Imports
import { assets, type Stage } from "./assets";
import type { Status } from "./trainer";

/** Abilities that power up moves of a type when the user is low on HP (1/3 or less) */
export const pinch: Record<string, string> = { overgrow: "grass", blaze: "fire", torrent: "water", swarm: "bug" };

/** Move types an ability makes its owner immune to, and whether it heals them instead (1/4 of their HP) */
export const absorbs: Record<string, { type: string; heals: boolean }> = {
  levitate: { type: "ground", heals: false },
  "flash-fire": { type: "fire", heals: false },
  "water-absorb": { type: "water", heals: true },
  "volt-absorb": { type: "electric", heals: true },
};

/** Conditions an ability prevents */
export const shields: Record<string, Status> = { insomnia: "sleep", "vital-spirit": "sleep", limber: "paralysis", immunity: "poison", "water-veil": "burn" };

/** Conditions given to an attacker that hits with a physical move, 30% of the time */
export const contact: Record<string, Status> = { static: "paralysis", "flame-body": "burn", "poison-point": "poison", "effect-spore": "sleep" };

/** Stats an ability stops foes from lowering ("all" for every stat) */
export const guards: Record<string, Stage | "all"> = { "clear-body": "all", "white-smoke": "all", "hyper-cutter": "attack", "keen-eye": "accuracy" };

/** Weather an ability doubles its owner's speed in */
export const swimmers: Record<string, string> = { "swift-swim": "rain", "sand-rush": "sandstorm", "slush-rush": "snow" };

/** Abilities that change how battles go (the rest are only shown) */
export const active = new Set([
  ...Object.keys(pinch),
  ...Object.keys(absorbs),
  ...Object.keys(shields),
  ...Object.keys(contact),
  ...Object.keys(guards),
  ...Object.keys(swimmers),
  "intimidate",
  "huge-power",
  "pure-power",
  "guts",
  "thick-fat",
  "rough-skin",
  "speed-boost",
  "shed-skin",
  "compound-eyes",
  "sturdy",
  "run-away",
  "natural-cure",
  "sand-veil",
  "snow-cloak",
]);

/** Name of an ability */
export function abilityName(key?: string) {
  return key ? (assets.abilities[key]?.name ?? key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) : "";
}

/** What an ability does */
export function abilityAbout(key?: string) {
  return key ? (assets.abilities[key]?.about ?? "") : "";
}
