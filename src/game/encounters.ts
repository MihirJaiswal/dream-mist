/**
 * Wild encounters: which Pokémon of a zone can appear, by how they're met (walking, surfing, fishing),
 * the part of the day, and the rod used.
 */

//Imports
import type { Period } from "./atmosphere";
import { type City, type Method, type Rod, rods, type Wild, type Zone } from "./data";

/** How a wild Pokémon is met (walking when not set) */
export function methodOf(wild: Wild): Method {
  return wild.method ?? "walk";
}

/** Can a wild Pokémon appear: met this way, at this part of the day, and hooked by this rod when fishing */
export function appears(wild: Wild, method: Method, period: Period, rod: Rod = "old") {
  if (methodOf(wild) !== method || (wild.time && wild.time !== period)) {
    return false;
  }
  return method !== "fish" || rods.indexOf(wild.rod ?? "old") <= rods.indexOf(rod);
}

/** Pokémon of a zone that can appear right now */
export function pool(zone: Zone | undefined, method: Method, period: Period, rod?: Rod) {
  return zone?.creatures.filter((wild) => appears(wild, method, period, rod)) ?? [];
}

/** Pick one of them at random, with its level */
export function roll(list: Wild[], random = Math.random) {
  if (!list.length) {
    return null;
  }
  const { species, min, max } = list[Math.floor(random() * list.length)];
  const low = Math.min(min, max),
    high = Math.max(min, max);
  return { species, level: Math.max(1, Math.min(100, low + Math.floor(random() * (high - low + 1)))) };
}

/** Every wild Pokémon of a map, by how they're met (each zone painted on it counts) */
export function living(map: City) {
  const painted = new Set(map.zone.filter(Boolean));
  const found = { walk: [] as Wild[], surf: [] as Wild[], fish: [] as Wild[] };
  map.zones.forEach((zone, i) => {
    if (painted.has(i + 1)) {
      for (const wild of zone.creatures) {
        found[methodOf(wild)].push(wild);
      }
    }
  });
  return found;
}

/** A place a wild Pokémon lives: the map, the zone painted there, and how it's met */
export type Habitat = { map: City; zone: number; wild: Wild };

/** Every wild Pokémon of a town and every place it lives (zones count where they're painted) */
export function habitats(world: City): Habitat[] {
  return [world, ...world.interiors].flatMap((map) => {
    const painted = new Set(map.zone.filter(Boolean));
    return world.zones.flatMap((zone, i) => (painted.has(i + 1) ? zone.creatures.map((wild) => ({ map, zone: i, wild })) : []));
  });
}
