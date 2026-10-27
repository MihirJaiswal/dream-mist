//Imports
import { assets, species } from "./assets";
import { storage } from "./data";

/** Creature instance */
export type Creature = {
  species: number;
  level: number;
  exp: number;
  hp: number;
  moves: { key: string; pp: number }[];
  shiny: boolean;
  nickname?: string;
  /** Custom image (Pokémon with a custom look placed on a map) */
  art?: string;
};

/** Trainer profile (shared across all visited cities) */
export type Trainer = {
  name: string;
  sprite: string;
  party: Creature[];
  box: Creature[];
  bag: { balls: number; potions: number };
  badges: { city: string; name: string; badge: string; date: number }[];
  /** Defeated trainers ("city id:npc index") */
  defeated: string[];
  seen: number[];
  caught: number[];
  /** Completed story steps per city ("city id" -> step ids) */
  story?: Record<string, string[]>;
};

/** Compute a stat (gen 3 formula, fixed IVs and no EVs) */
export function stat(creature: Creature, index: number) {
  const base = species(creature.species).stats[index];
  const iv = 15;
  if (index === 0) {
    return Math.floor(((2 * base + iv) * creature.level) / 100) + creature.level + 10;
  }
  return Math.floor(((2 * base + iv) * creature.level) / 100) + 5;
}

/** Max HP */
export function hp(creature: Creature) {
  return stat(creature, 0);
}

/** Experience needed to reach a level (medium fast growth) */
export function experience(level: number) {
  return level ** 3;
}

/** Moves known at a given level (last four damaging moves learned) */
function learned(id: number, level: number) {
  const moves = species(id).learnset.filter(([at]) => at <= level).map(([_, key]) => key);
  const unique = [...new Set(moves)].slice(-4);
  return unique.length ? unique : ["tackle"];
}

/** Create a new creature */
export function create(id: number, level: number, { shiny = Math.random() < 1 / 128 } = {}): Creature {
  const creature = { species: id, level, exp: experience(level), hp: 0, moves: learned(id, level).map((key) => ({ key, pp: assets.moves[key]?.pp ?? 10 })), shiny };
  creature.hp = hp(creature);
  return creature;
}

/** Display name */
export function named(creature: Creature) {
  return creature.nickname || species(creature.species).name;
}

/** Heal a creature completely */
export function heal(creature: Creature) {
  creature.hp = hp(creature);
  creature.moves.forEach((move) => move.pp = assets.moves[move.key]?.pp ?? 10);
}

/** Grant experience, returns messages to display (level ups, new moves) */
export function grow(creature: Creature, amount: number) {
  const messages = [] as string[];
  creature.exp += amount;
  while ((creature.level < 100) && (creature.exp >= experience(creature.level + 1))) {
    const before = hp(creature);
    creature.level++;
    creature.hp += hp(creature) - before;
    messages.push(`${named(creature)} grew to Lv. ${creature.level}!`);
    for (const [at, key] of species(creature.species).learnset) {
      if ((at === creature.level) && (!creature.moves.some((move) => move.key === key))) {
        if (creature.moves.length >= 4) {
          const forgotten = creature.moves.shift()!;
          messages.push(`${named(creature)} forgot ${assets.moves[forgotten.key]?.name}…`);
        }
        creature.moves.push({ key, pp: assets.moves[key]?.pp ?? 10 });
        messages.push(`${named(creature)} learned ${assets.moves[key]?.name}!`);
      }
    }
  }
  return messages;
}

/** Starters available to new trainers */
export const starters = [252, 255, 258];

/** Trainer profile store */
export const trainer = {
  /** Current profile */
  profile: storage.get<Trainer | null>("trainer", null),

  /** Has a profile */
  get exists() {
    return Boolean(this.profile?.party?.length);
  },

  /** Create a new profile */
  start(name: string, sprite: string, starter: number) {
    this.profile = { name, sprite, party: [create(starter, 5, { shiny: false })], box: [], bag: { balls: 10, potions: 5 }, badges: [], defeated: [], seen: [starter], caught: [starter] };
    this.save();
  },

  /** Save listener (cloud sync) */
  onsave: null as null | ((profile: Trainer | null) => void),

  /** Persist profile */
  save() {
    storage.set("trainer", this.profile);
    this.onsave?.(this.profile);
  },

  /** Register a creature as seen */
  see(id: number) {
    if (this.profile && !this.profile.seen.includes(id)) {
      this.profile.seen.push(id);
    }
  },

  /** Add a caught creature to the party (or box when full) */
  catch(creature: Creature) {
    const profile = this.profile!;
    if (!profile.caught.includes(creature.species)) {
      profile.caught.push(creature.species);
    }
    this.see(creature.species);
    if (profile.party.length < 6) {
      profile.party.push(creature);
      return "party";
    }
    profile.box.push(creature);
    return "box";
  },

  /** First creature able to battle */
  get lead() {
    return this.profile?.party.find((creature) => creature.hp > 0) ?? null;
  },

  /** Is a story step done in a city */
  done(city: string, step?: string) {
    return Boolean(step) && (this.profile?.story?.[city]?.includes(step!) ?? false);
  },

  /** Complete a story step (returns false when it was already done) */
  complete(city: string, step: string) {
    const profile = this.profile;
    if ((!profile) || (this.done(city, step))) {
      return false;
    }
    profile.story ??= {};
    (profile.story[city] ??= []).push(step);
    this.save();
    return true;
  },

  /** Forget story progress and defeated trainers of a city (for testing) */
  restart(city: string) {
    const profile = this.profile;
    if (!profile) {
      return;
    }
    delete profile.story?.[city];
    profile.defeated = profile.defeated.filter((key) => !key.startsWith(`${city}:`));
    this.save();
  },

  /** Heal the whole party */
  heal() {
    this.profile?.party.forEach(heal);
    this.save();
  },
};
