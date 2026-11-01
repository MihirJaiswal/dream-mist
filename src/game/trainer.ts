//Imports
import { assets, species } from "./assets";
import { storage } from "./data";
import { type ItemId, itemIds } from "./items";

/** Conditions that last after a battle until cured (sleep wears off on its own) */
export type Status = "sleep" | "poison" | "paralysis" | "burn";

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
  /** Condition, and the turns of sleep left */
  status?: Status;
  sleep?: number;
};

/** Trainer profile (shared across all visited cities) */
export type Trainer = {
  name: string;
  sprite: string;
  party: Creature[];
  box: Creature[];
  /** Items in the bag, and money to buy more */
  items: Partial<Record<ItemId, number>>;
  money: number;
  badges: { city: string; name: string; badge: string; date: number }[];
  /** Defeated trainers ("city id:npc index") */
  defeated: string[];
  seen: number[];
  caught: number[];
  /** Completed story steps per city ("city id" -> step ids) */
  story?: Record<string, string[]>;
  /** People who already gave their gift, or already walked up to talk ("city id:npc index") */
  received?: string[];
  met?: string[];
};

/** Bring an older saved trainer up to date (the bag used to count only Poké Balls and Potions) */
export function upgrade(profile: Trainer | null) {
  if (!profile) {
    return profile;
  }
  const old = (profile as unknown as { bag?: { balls?: number; potions?: number } }).bag;
  if (old) {
    profile.items = {
      ...profile.items,
      "poke-ball": (profile.items?.["poke-ball"] ?? 0) + (old.balls ?? 0),
      potion: (profile.items?.potion ?? 0) + (old.potions ?? 0),
    };
    delete (profile as unknown as { bag?: unknown }).bag;
  }
  profile.items ??= {};
  profile.money = Number.isFinite(profile.money) ? profile.money : 3000;
  return profile;
}

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

/** Does a move deal damage */
const damaging = (key: string) => (assets.moves[key]?.power ?? 0) > 0;

/** Moves known at a given level: the last four learned, with at least one that deals damage */
function learned(id: number, level: number) {
  const moves = [
    ...new Set(
      species(id)
        .learnset.filter(([at]) => at <= level)
        .map(([_, key]) => key),
    ),
  ];
  const known = moves.slice(-4);
  if (!known.some(damaging)) {
    known.splice(0, known.length === 4 ? 1 : 0, moves.filter(damaging).at(-1) ?? "tackle");
  }
  return known.length ? known : ["tackle"];
}

/** Learn a move, forgetting the oldest one if four are known (but never the last move that deals damage) */
function learn(creature: Creature, key: string, messages: string[]) {
  if (creature.moves.some((move) => move.key === key)) {
    return;
  }
  if (creature.moves.length >= 4) {
    const index = creature.moves.findIndex((move) => !damaging(move.key) || damaging(key) || creature.moves.filter(({ key }) => damaging(key)).length > 1);
    const [forgotten] = creature.moves.splice(Math.max(0, index), 1);
    messages.push(`${named(creature)} forgot ${assets.moves[forgotten.key]?.name}…`);
  }
  creature.moves.push({ key, pp: assets.moves[key]?.pp ?? 10 });
  messages.push(`${named(creature)} learned ${assets.moves[key]?.name}!`);
}

/** Create a new creature */
export function create(id: number, level: number, { shiny = Math.random() < 1 / 128 } = {}): Creature {
  const creature = {
    species: id,
    level,
    exp: experience(level),
    hp: 0,
    moves: learned(id, level).map((key) => ({ key, pp: assets.moves[key]?.pp ?? 10 })),
    shiny,
  };
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
  creature.moves.forEach((move) => (move.pp = assets.moves[move.key]?.pp ?? 10));
  cure(creature);
}

/** Cure a condition */
export function cure(creature: Creature) {
  delete creature.status;
  delete creature.sleep;
}

/** Species a creature is ready to evolve into, if any */
export function evolution(creature: Creature) {
  const [level, into] = species(creature.species).evolves ?? [];
  return level && creature.level >= level && species(into!) ? into! : 0;
}

/** Evolve a creature, returns messages to display (it keeps its damage taken and learns the new form's moves for this level) */
export function evolve(creature: Creature, into: number) {
  const before = { name: named(creature), hp: hp(creature) };
  creature.species = into;
  creature.hp = Math.max(1, creature.hp + hp(creature) - before.hp);
  const messages = [`Congratulations! ${before.name} evolved into ${species(into).name}!`];
  for (const [at, key] of species(into).learnset) {
    if (at === creature.level) {
      learn(creature, key, messages);
    }
  }
  return messages;
}

/** Grant experience, returns messages to display (level ups, new moves) */
export function grow(creature: Creature, amount: number) {
  const messages = [] as string[];
  creature.exp += amount;
  while (creature.level < 100 && creature.exp >= experience(creature.level + 1)) {
    const before = hp(creature);
    creature.level++;
    creature.hp += hp(creature) - before;
    messages.push(`${named(creature)} grew to Lv. ${creature.level}!`);
    for (const [at, key] of species(creature.species).learnset) {
      if (at === creature.level) {
        learn(creature, key, messages);
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
  profile: upgrade(storage.get<Trainer | null>("trainer", null)),

  /** Has a profile */
  get exists() {
    return Boolean(this.profile?.party?.length);
  },

  /** Create a new profile */
  start(name: string, sprite: string, starter: number) {
    this.profile = {
      name,
      sprite,
      party: [create(starter, 5, { shiny: false })],
      box: [],
      items: { "poke-ball": 10, potion: 5 },
      money: 3000,
      badges: [],
      defeated: [],
      seen: [starter],
      caught: [starter],
    };
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
    if (!profile || this.done(city, step)) {
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

  /** How many of an item are in the bag */
  count(id: ItemId) {
    return this.profile?.items[id] ?? 0;
  },

  /** Put items in the bag */
  give(id: ItemId, count = 1) {
    if (this.profile) {
      this.profile.items[id] = this.count(id) + count;
    }
  },

  /** Take an item out of the bag (false when there is none) */
  take(id: ItemId) {
    if (!this.profile || this.count(id) <= 0) {
      return false;
    }
    this.profile.items[id] = this.count(id) - 1;
    return true;
  },

  /** Items in the bag, in shop order */
  get bag() {
    return itemIds.filter((id) => this.count(id) > 0).map((id) => ({ id, count: this.count(id) }));
  },
};
