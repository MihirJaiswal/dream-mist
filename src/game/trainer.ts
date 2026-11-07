//Imports
import { assets, type Evolution, species } from "./assets";
import type { Period } from "./atmosphere";
import { type Direction, storage } from "./data";
import { holdable, type ItemId, itemIds, items } from "./items";
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
  /** Raid boss: its HP is multiplied (only while the raid lasts) */
  boss?: number;
  /** Gender (none for genderless Pokémon) */
  gender?: Gender;
  /** How much it likes its trainer (0 to 255): it grows walking and leveling up together, and some Pokémon evolve when it's high */
  friendship?: number;
};

/** Gender of a Pokémon */
export type Gender = "male" | "female";

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
  /** Steps walked in all (the VS Seeker recharges with steps, and Day Care Pokémon grow with them) */
  steps?: number;
  /** VS Seeker: the step it was last used at, trainers ready for a rematch, and how many rematches each has had ("city id:npc index") */
  seeker?: number;
  ready?: string[];
  rematches?: Record<string, number>;
  /** Berry trees: when each was last picked (timestamps, "city id:npc index") */
  picked?: Record<string, number>;
  /** Raid dens: when each was last beaten (timestamps, "city id:npc index") */
  raids?: Record<string, number>;
  /** Pokémon left at the Day Care, and the step count when it was left */
  daycare?: { creature: Creature; steps: number };
  /** Games started (city ids): their opening has played */
  started?: string[];
  /** Where the game was last saved, per game (city id): the map ("" outside), tile and facing. Playing again starts there */
  places?: Record<string, { area: string; x: number; y: number; dir: Direction }>;
  /** Exp. Share turned on: Pokémon that didn't battle get half the experience too */
  share?: boolean;
  /** Steps left before a repel wears off, and the repel used (to offer another) */
  repel?: { steps: number; item: ItemId };
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
  profile.party ??= [];
  profile.box ??= [];
  //Pokémon caught before genders existed get one now
  for (const creature of [...profile.party, ...profile.box]) {
    if (!("gender" in creature) && species(creature.species)) {
      const gender = genderOf(creature.species);
      if (gender) creature.gender = gender;
    }
  }
  return profile;
}

/** A random gender for a new Pokémon of a species (none for genderless ones) */
export function genderOf(id: number): Gender | undefined {
  const rate = species(id)?.gender ?? 4;
  return rate < 0 ? undefined : Math.random() * 8 < rate ? "female" : "male";
}

/** Friendship of a creature (older ones without one have the usual 70) */
export function friendshipOf(creature: Creature) {
  return creature.friendship ?? 70;
}

/** Friendship needed by the Pokémon that evolve when friendly */
export const friendly = 220;

/** Make a creature more (or less) friendly; a held Soothe Bell makes it grow faster */
export function befriend(creature: Creature, amount: number) {
  const gain = amount > 0 && creature.held === "soothe-bell" ? Math.ceil(amount * 1.5) : amount;
  creature.friendship = Math.max(0, Math.min(255, friendshipOf(creature) + gain));
}

/** What the game says about how friendly a Pokémon is (like the Friendship Checker) */
export function friendshipText(creature: Creature) {
  const value = friendshipOf(creature);
  return value >= 255
    ? "It adores you! It can't possibly love you any more."
    : value >= friendly
      ? "It's extremely friendly toward you."
      : value >= 150
        ? "It's quite friendly toward you."
        : value >= 70
          ? "It's warming up to you."
          : value >= 1
            ? "It's not very used to you yet."
            : "It doesn't seem to like you at all.";
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
  return stat(creature, 0) * (creature.boss ?? 1);
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

/**
 * Learn a move. With four moves known it waits in `pending` when there is one (the player picks the move to forget),
 * otherwise the oldest is forgotten (but never the last move that deals damage), like at the Day Care
 */
function learn(creature: Creature, key: string, messages: string[], pending?: string[]) {
  if (creature.moves.some((move) => move.key === key) || pending?.includes(key)) {
    return;
  }
  if (creature.moves.length >= 4 && pending) {
    pending.push(key);
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

/** Learn a move that waited (`pending`), forgetting the move at an index (returns the forgotten move's name) */
export function replaceMove(creature: Creature, index: number, key: string) {
  const forgotten = assets.moves[creature.moves[index]?.key]?.name ?? "";
  creature.moves.splice(index, 1, { key, pp: assets.moves[key]?.pp ?? 10 });
  return forgotten;
}

/** Create a new creature */
export function create(
  id: number,
  level: number,
  {
    shiny = Math.random() < 1 / 128,
    nature = randomNature(),
    ability = "",
    held,
    gender = genderOf(id),
  }: { shiny?: boolean; nature?: Nature; ability?: string; held?: ItemId; gender?: Gender } = {},
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
    ...(gender ? { gender } : {}),
    friendship: species(id).friendship ?? 70,
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

/** What makes a Pokémon evolve: leveling up (at a time of day, with its party), an item used on it, or a trade (the Linking Cord) */
export type Cause = { level: true; time: Period; party: Creature[] } | { item: ItemId } | { trade: true };

/** Does a Pokémon meet the needs of one way to evolve when leveling up */
function ready(creature: Creature, way: Evolution, { time, party }: { time: Period; party: Creature[] }) {
  if (way.item || way.trade || way.shed) {
    return false;
  }
  const moves = creature.moves.map(({ key }) => key);
  const attack = stat(creature, 1),
    defense = stat(creature, 2);
  return (
    (!way.level || creature.level >= way.level) &&
    (!way.friendship || friendshipOf(creature) >= friendly) &&
    (!way.time || (way.time === "night") === (time === "night")) &&
    (!way.held || creature.held === way.held) &&
    (!way.move || moves.includes(way.move)) &&
    (!way.moveType || moves.some((key) => assets.moves[key]?.type === way.moveType)) &&
    (!way.gender || creature.gender === way.gender) &&
    (way.stat === undefined || Math.sign(attack - defense) === way.stat) &&
    (!way.partner || party.some((other) => other !== creature && other.species === way.partner))
  );
}

/** The way a Pokémon evolves now (null when it doesn't): an Everstone stops it evolving by level or trade, and of two ways (Wurmple) one is picked at random */
export function evolution(creature: Creature, cause: Cause): Evolution | null {
  const ways = (species(creature.species)?.evolutions ?? []).filter(({ into }) => species(into));
  const held = creature.held === "everstone";
  const matching =
    "item" in cause
      ? ways.filter(({ item, gender }) => item === cause.item && (!gender || creature.gender === gender))
      : "trade" in cause
        ? held
          ? []
          : ways.filter(({ trade, held }) => trade && (!held || creature.held === held))
        : held
          ? []
          : ways.filter((way) => ready(creature, way, cause));
  return matching[Math.floor(Math.random() * matching.length)] ?? null;
}

/** Can an item make a Pokémon evolve (stones, the Linking Cord) */
export function evolvesWith(creature: Creature, id: ItemId) {
  return Boolean(items[id].kind === "evolve" && evolution(creature, (items[id] as { trade?: true }).trade ? { trade: true } : { item: id }));
}

/**
 * Evolve a creature, returns messages to display (it keeps its damage taken and learns the new form's moves for this level, and those
 * its old form never learns up to it; moves that don't fit wait in `pending` when given). An item it needed to hold (Metal Coat, Razor Claw) is used up
 */
export function evolve(creature: Creature, into: number | Evolution, pending?: string[]) {
  const way = typeof into === "number" ? { into } : into;
  const before = { name: named(creature), hp: hp(creature) };
  //Moves its old form learns by now: the new form's other moves up to this level come with evolving (Marshtomp's Mud Shot, even evolving late)
  const known = new Set(
    species(creature.species)
      .learnset.filter(([at]) => at <= creature.level)
      .map(([, key]) => key),
  );
  creature.species = way.into;
  creature.hp = Math.max(1, creature.hp + hp(creature) - before.hp);
  if (way.held && creature.held === way.held) {
    delete creature.held;
  }
  const messages = [`Congratulations! Your ${before.name} evolved into ${species(way.into).name}!`];
  for (const [at, key] of species(way.into).learnset) {
    if (at === creature.level || (!known.has(key) && (at === 0 || (at > 1 && at <= creature.level)))) {
      learn(creature, key, messages, pending);
    }
  }
  return messages;
}

/** Shedinja, left in an empty party slot when Nincada evolves (call before it evolves: Shedinja is a copy of it, and takes a Poké Ball from the bag) */
export function shed(creature: Creature, party: Creature[], count: (id: ItemId) => number): Creature | null {
  const into = species(creature.species)?.evolutions?.find(({ shed }) => shed)?.into;
  if (!into || !species(into) || party.length >= 6 || count("poke-ball") <= 0) {
    return null;
  }
  const copy = create(into, creature.level, { shiny: creature.shiny, nature: creature.nature });
  copy.moves = creature.moves.map((move) => ({ ...move }));
  return copy;
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
        ...(held && holdable.includes(held) ? { held } : {}),
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

/**
 * Grant experience, returns messages to display (level ups, new moves). A level cap stops leveling (experience stays below the next level).
 * Each level makes it friendlier. Moves that don't fit wait in `pending` when given (the oldest is forgotten otherwise)
 */
export function grow(creature: Creature, amount: number, cap = 100, pending?: string[]) {
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
    befriend(creature, friendshipOf(creature) < 100 ? 5 : friendshipOf(creature) < 200 ? 3 : 2);
    messages.push(`${named(creature)} grew to Lv. ${creature.level}!`);
    for (const [at, key] of species(creature.species).learnset) {
      if (at === creature.level) {
        learn(creature, key, messages, pending);
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

  /** Has a profile (a new trainer may have no Pokémon yet, until a Professor hands them one) */
  get exists() {
    return Boolean(this.profile?.name);
  },

  /** Create a new profile, with a first partner unless the game hands one out */
  start(name: string, sprite: string, starter?: number) {
    this.profile = {
      name,
      sprite,
      party: starter ? [create(starter, 5, { shiny: false })] : [],
      box: [],
      items: { "poke-ball": 10, potion: 5 },
      money: 3000,
      badges: [],
      defeated: [],
      seen: starter ? [starter] : [],
      caught: starter ? [starter] : [],
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
    profile.started = profile.started?.filter((id) => id !== city);
    delete profile.places?.[city];
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

  /** Use a Repel: weaker wild Pokémon stay away for its steps (false while one still works) */
  repel(id: ItemId) {
    const profile = this.profile;
    if (!profile || (profile.repel?.steps ?? 0) > 0 || !this.take(id)) {
      return false;
    }
    profile.repel = { steps: (items[id] as { amount?: number }).amount ?? 100, item: id };
    this.save();
    return true;
  },

  /** Items in the bag, in shop order */
  get bag() {
    return itemIds.filter((id) => this.count(id) > 0).map((id) => ({ id, count: this.count(id) }));
  },
};
