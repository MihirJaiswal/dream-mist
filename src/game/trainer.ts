//Imports
import { assets, species } from "./assets";
import { storage } from "./data";
import { type ItemId, itemIds, items } from "./items";
import { type Nature, natureMultiplier, natures, randomNature } from "./natures";
import type { Member } from "./data";

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
  /** Nature (raises one stat, lowers another) and ability; older Pokémon without them are neutral and use their species' first ability */
  nature?: Nature;
  ability?: string;
  /** Item held in battle */
  held?: ItemId;
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
  /** Badges earned (`world` is the id of the town they belong to) */
  badges: { city: string; name: string; badge: string; date: number; world?: string }[];
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
  return Math.floor((Math.floor(((2 * base + iv) * creature.level) / 100) + 5) * natureMultiplier(creature.nature, index));
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
export function learned(id: number, level: number) {
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
export function create(
  id: number,
  level: number,
  { shiny = Math.random() < 1 / 128, nature = randomNature(), ability = "", held }: { shiny?: boolean; nature?: Nature; ability?: string; held?: ItemId } = {},
): Creature {
  const abilities = species(id).abilities ?? [];
  const creature: Creature = {
    species: id,
    level,
    exp: experience(level),
    hp: 0,
    moves: learned(id, level).map((key) => ({ key, pp: assets.moves[key]?.pp ?? 10 })),
    shiny,
    nature,
    ...(ability || abilities.length ? { ability: ability || abilities[Math.floor(Math.random() * abilities.length)] } : {}),
    ...(held ? { held } : {}),
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

/** A trainer's team, ready to battle: chosen moves (known moves only), ability (one of the species'), nature, item, nickname and shine */
export function teamOf(members: Member[]) {
  return members
    .filter(({ species: id }) => species(id))
    .map(({ species: id, level, held, moves, ability, nature, nickname, shiny }) => {
      const creature = create(id, level, {
        shiny: Boolean(shiny),
        ...(nature && nature in natures ? { nature } : {}),
        ...(ability && species(id).abilities?.includes(ability) ? { ability } : {}),
        ...(held && held in items ? { held } : {}),
      });
      const chosen = (moves ?? []).filter((key) => key in assets.moves).slice(0, 4);
      if (chosen.length) {
        creature.moves = chosen.map((key) => ({ key, pp: assets.moves[key].pp }));
      }
      if (nickname?.trim()) {
        creature.nickname = nickname.trim().slice(0, 12);
      }
      return creature;
    });
}

/** Ability of a creature (older ones without one use their species' first) */
export function abilityOf(creature: Creature) {
  return creature.ability ?? species(creature.species).abilities?.[0] ?? "";
}

/** Grant experience, returns messages to display (level ups, new moves). A level cap stops leveling (experience stays below the next level) */
export function grow(creature: Creature, amount: number, cap = 100) {
  const messages = [] as string[];
  creature.exp += amount;
  const top = Math.max(creature.level, Math.min(100, cap));
  if (creature.level >= top) {
    creature.exp = Math.min(creature.exp, experience(top + 1) - 1);
  }
  while (creature.level < top && creature.exp >= experience(creature.level + 1)) {
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
  if (creature.level >= top && top < 100) {
    creature.exp = Math.min(creature.exp, experience(top + 1) - 1);
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

  /** A test battle is running with a stand-in profile: nothing is saved */
  testing: false,

  /** Persist profile */
  save() {
    if (this.testing) {
      return;
    }
    storage.set("trainer", this.profile);
    this.onsave?.(this.profile);
  },

  /** Run something (a test battle) with a stand-in profile, then put the real one back untouched */
  async sandbox<T>(stand: Trainer, fn: () => Promise<T>) {
    const real = this.profile;
    this.profile = stand;
    this.testing = true;
    try {
      return await fn();
    } finally {
      this.profile = real;
      this.testing = false;
    }
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
