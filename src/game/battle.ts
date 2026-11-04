//Imports
import { assets, battleSprite, type Move, species, type Stage } from "./assets";
import { abilityOf, type Creature, cure, evolution, evolve, grow, hp, named, stat, type Status, trainer } from "./trainer";
import { sound } from "./audio";
import { type ItemId, items } from "./items";
import { abilityName, absorbs, contact, guards, pinch, shields, swimmers } from "./abilities";
import type { BattleRules, Difficulty, Scene } from "./data";
import type { Weather } from "./atmosphere";
import { ui } from "./ui-bridge";

/** Battle outcome */
export type Outcome = "win" | "lose" | "run" | "caught";

/** Places on the battlefield: one per side in single battles, two in double battles */
export type Slot = "ally" | "ally2" | "foe" | "foe2";
const slots = ["ally", "ally2", "foe", "foe2"] as const;

/** Slots of each side */
const sides = { ally: ["ally", "ally2"], foe: ["foe", "foe2"] } as const;

/** Side of a slot */
export const team = (slot: Slot) => (slot.startsWith("ally") ? "ally" : "foe");

/** Opponent trainer */
export type Opponent = {
  name: string;
  sprite: string;
  team: Creature[];
  /** What they say mid-battle: sending out their last Pokémon, and when it's low on HP */
  lines?: { last?: string; low?: string };
};

/** Type colors */
export const colors = {
  normal: "#a8a878",
  fire: "#f08030",
  water: "#6890f0",
  electric: "#f8d030",
  grass: "#78c850",
  ice: "#98d8d8",
  fighting: "#c03028",
  poison: "#a040a0",
  ground: "#e0c068",
  flying: "#a890f0",
  psychic: "#f85888",
  bug: "#a8b820",
  rock: "#b8a038",
  ghost: "#705898",
  dragon: "#7038f8",
  dark: "#705848",
  steel: "#b8b8d0",
  fairy: "#ee99ac",
} as { [type: string]: string };

/** Struggle (used when no PP is left) */
const struggle: Move = { name: "Struggle", type: "normal", power: 50, accuracy: 100, pp: 1, class: "physical", priority: 0 };

/** Wait */
const wait = (ms: number) => new Promise((solve) => setTimeout(solve, ms));

/** Type effectiveness multiplier */
export function effectiveness(type: string, target: Creature) {
  return species(target.species).types.reduce((multiplier, defender) => multiplier * (assets.types[type]?.[defender] ?? 1), 1);
}

/** Multiplier of a stat stage (-6 to +6): ×2 at +2, ×0.5 at -2 */
export function stageMultiplier(stage: number, accuracy = false) {
  const base = accuracy ? 3 : 2;
  return stage >= 0 ? (base + stage) / base : base / (base - stage);
}

/** Types that can't get a condition */
const immune: Record<Status, string[]> = { poison: ["poison", "steel"], burn: ["fire"], paralysis: ["electric"], sleep: [] };

/** Can a creature get a condition (its types and ability can prevent it) */
export function canGet(creature: Creature, status: Status) {
  return !creature.status && !species(creature.species).types.some((type) => immune[status].includes(type)) && shields[abilityOf(creature)] !== status;
}

/** A trainer's own battle rules over those of the town and the map ("clear" weather means none, whatever the map's) */
export function trainerRules<T extends { difficulty?: Difficulty; weather?: BattleWeather }>(base: T, own: BattleRules = {}) {
  return {
    ...base,
    ...(own.difficulty ? { difficulty: own.difficulty } : {}),
    ...(own.weather ? { weather: own.weather === "clear" ? null : own.weather } : {}),
    ...(own.scene ? { scene: own.scene } : {}),
    ...(own.noItems ? { noItems: true } : {}),
    ...(own.double ? { double: true } : {}),
  };
}

/** Battle weather: the map's rain, sandstorm or snow */
export type BattleWeather = "rain" | "sandstorm" | "snow" | null;

/** Weather a map brings into its battles */
export function battleWeather(weather?: Weather): BattleWeather {
  return weather === "rain" || weather === "sandstorm" || weather === "snow" ? weather : null;
}

/** Everything that makes a move stronger or weaker besides stats: abilities, held items, weather */
export function powerOf(attacker: Creature, defender: Creature, move: Move, weather: BattleWeather = null) {
  let power = 1;
  const ability = abilityOf(attacker);
  if (pinch[ability] === move.type && attacker.hp * 3 <= hp(attacker)) {
    power *= 1.5;
  }
  const held = attacker.held ? items[attacker.held] : null;
  if (held && "boosts" in held && held.boosts === move.type) {
    power *= 1.2;
  }
  if (weather === "rain" && (move.type === "water" || move.type === "fire")) {
    power *= move.type === "water" ? 1.5 : 0.5;
  }
  if (abilityOf(defender) === "thick-fat" && (move.type === "fire" || move.type === "ice")) {
    power *= 0.5;
  }
  return power;
}

/** Attack multiplier from abilities (Huge Power, Guts) */
export function attackOf(attacker: Creature, physical: boolean) {
  const ability = abilityOf(attacker);
  if (physical && (ability === "huge-power" || ability === "pure-power")) {
    return 2;
  }
  return physical && ability === "guts" && attacker.status ? 1.5 : 1;
}

/** Short labels of conditions (battle info box) */
export const statusLabels: Record<Status, { label: string; color: string }> = {
  sleep: { label: "SLP", color: "#8890a0" },
  poison: { label: "PSN", color: "#a040a0" },
  paralysis: { label: "PAR", color: "#c8a018" },
  burn: { label: "BRN", color: "#e05030" },
};

/** Compute damage dealt by a move (multipliers come from stat stages, burns, abilities, held items and weather). `average` skips luck, for trainers weighing their moves */
export function damage(
  attacker: Creature,
  defender: Creature,
  move: Move,
  { attack: attackBoost = 1, defense: defenseBoost = 1, power = 1, average = false, crit = 0 } = {},
) {
  const physical = move.class === "physical";
  const attack = stat(attacker, physical ? 1 : 3) * attackBoost,
    defense = stat(defender, physical ? 2 : 4) * defenseBoost;
  //Critical hits: 1 in 16, more often for moves like Slash (1 in 8, 1 in 4…)
  const critical = !average && Math.random() < [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2][Math.min(4, crit)];
  const stab = species(attacker.species).types.includes(move.type) ? 1.5 : 1;
  const multiplier = effectiveness(move.type, defender);
  const base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * power * attack) / defense) / 50) + 2;
  const roll = average ? 0.925 : 0.85 + Math.random() * 0.15;
  const value = multiplier === 0 ? 0 : Math.max(1, Math.floor(base * stab * multiplier * (critical ? 2 : 1) * roll));
  return { value, critical, multiplier };
}

/** How a trainer picks moves: at random (easy), weighted toward strong ones (normal), or the best one (hard) */
export function choose(attacker: Creature, defender: Creature, difficulty: Difficulty = "normal", weather: BattleWeather = null, random = Math.random) {
  const usable = attacker.moves.filter(({ pp }) => pp > 0);
  if (!usable.length) {
    return null;
  }
  if (difficulty === "easy") {
    return usable[Math.floor(random() * usable.length)];
  }
  const absorbed = (move: Move) => absorbs[abilityOf(defender)]?.type === move.type && !move.effect?.self;
  const scores = usable.map(({ key }) => {
    const move = assets.moves[key];
    if (!move || absorbed(move)) {
      return 0;
    }
    //Healing when hurt, Protect now and then
    if (move.heal) {
      const hurt = attacker.hp * 2 < hp(attacker);
      return difficulty === "hard" ? (attacker.hp * 5 < hp(attacker) * 2 ? 0.9 : 0) : hurt ? 70 : 0;
    }
    if (move.protect) {
      return difficulty === "hard" ? 0.05 : 15;
    }
    //Status moves now and then: a condition when the target has none, stat changes otherwise
    if (!move.power) {
      const useful = move.effect?.ailment ? canGet(defender, move.effect.ailment) : true;
      return difficulty === "hard"
        ? useful
          ? move.effect?.ailment
            ? 0.3
            : attacker.hp === hp(attacker)
              ? 0.15
              : 0
          : 0
        : useful
          ? move.effect?.ailment
            ? 60
            : 25
          : 0;
    }
    if (difficulty === "normal") {
      return move.power * (effectiveness(move.type, defender) || 0.1) * (species(attacker.species).types.includes(move.type) ? 1.5 : 1);
    }
    //Hard: the share of the target's HP it takes (a knockout counts most), times the chance to hit
    const { value } = damage(attacker, defender, move, {
      power: powerOf(attacker, defender, move, weather),
      attack: attackOf(attacker, move.class === "physical"),
      average: true,
    });
    const share = Math.min(1, value / Math.max(1, defender.hp));
    return (share >= 1 ? 2 + move.priority * 0.1 : share) * (move.accuracy / 100);
  });
  if (difficulty === "hard") {
    const best = Math.max(...scores);
    return usable[scores.indexOf(best)];
  }
  let roll = random() * scores.reduce((a, b) => a + b, 0);
  const index = scores.findIndex((score) => (roll -= score) <= 0);
  return usable[Math.max(0, index)];
}

/** One side of the battle as drawn on screen */
export type BattleSide = {
  creature: Creature;
  /** Increments when the creature is sent out (replays the entrance animation) */
  entered: number;
  /** Current animation and a counter to replay it */
  fx: "" | "lunge" | "hurt" | "fainted" | "captured";
  fxKey: number;
  /** Info box shown */
  info: boolean;
};

/**
 * Menu shown below the battle log: its entries, the one the cursor is on, whether X goes back,
 * and the moves box (moves in a 2×2 grid, the PP and type of the one under the cursor beside them)
 */
export type BattleMenu = {
  columns: number;
  cursor: number;
  back: boolean;
  kind?: "moves";
  choices: { label: string; detail: string; color?: string; disabled?: boolean; pp?: string; type?: string }[];
};

/** Everything the interface needs to draw a battle */
export type BattleView = {
  phase: "intro" | "fight" | "outro";
  foe: BattleSide;
  ally: BattleSide;
  /** Second Pokémon of each side in double battles */
  foe2: BattleSide | null;
  ally2: BattleSide | null;
  log: string;
  menu: null | BattleMenu;
  /** Attack animation: a projectile flying to the target, an impact on it, or a glow around the user */
  anim: null | { from: Slot; to: Slot; type: string; mode: "contact" | "projectile" | "self"; key: number; protect?: boolean };
  /** Poké Ball thrown at the foe */
  ball: null | { state: "throw" | "shake" | "caught"; key: number };
  /** Opponent trainer sliding in to say something mid-battle */
  slide: null | { sprite: string; key: number };
};

/** Catch formula values (gen 3, simplified): a >= 255 always catches, otherwise each shake passes when random * 65536 < b. Better balls and conditions help */
export function catchOdds(foe: Creature, rate = 1) {
  const max = hp(foe);
  const bonus = foe.status === "sleep" ? 2 : foe.status ? 1.5 : 1;
  const a = ((3 * max - 2 * foe.hp) * species(foe.species).capture * rate * bonus) / (3 * max);
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)));
  return { a, b };
}

/**
 * Battle scene.
 * Runs the turns and keeps a `view` the interface draws: flash transition, attack animations and the dialogue log.
 */
export class Battle {
  /** Battle being shown (one at a time) and its listeners */
  static active = null as null | Battle;
  static readonly #watchers = new Set<() => void>();
  static watch(listener: () => void) {
    Battle.#watchers.add(listener);
    return () => Battle.#watchers.delete(listener);
  }
  static #announce() {
    Battle.#watchers.forEach((listener) => listener());
  }

  /** What the interface draws, and its listeners */
  view: BattleView;
  readonly #listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  #emit() {
    this.view = { ...this.view };
    this.#listeners.forEach((listener) => listener());
  }

  /** Fought on water (surfing or fishing), for the battle scene */
  readonly water: boolean;

  /** Emerald scene chosen for this battle (the map's background otherwise) */
  readonly scene: Scene | null;

  /** The bag can't be used */
  readonly #noItems: boolean;

  /** Mid-battle lines already said */
  readonly #said = new Set<string>();

  /** This turn: who already moved, who flinched, who is protected; and how many Protects in a row each used */
  readonly #moved = new Set<Creature>();
  readonly #flinched = new Set<Creature>();
  readonly #protected = new Set<Creature>();
  readonly #protects = new Map<Creature, number>();

  /** Pending menu choice */
  #choose = null as null | ((index: number) => void);

  /** Opponent team */
  readonly #foes: Creature[];

  /** Opponent trainer (null for wild battles) */
  readonly #opponent: Opponent | null;

  /** Pokémon on the field, by slot (second slots stay empty in single battles) */
  readonly #field: Record<Slot, Creature | null> = { ally: null, ally2: null, foe: null, foe2: null };

  /** Double battle: two Pokémon on each side */
  readonly double: boolean;

  /** Raid den being fought (its boss has more HP, and other players in the room hurt it too), and who to tell about the damage dealt */
  readonly raid: string | null;
  readonly #onhit: ((damage: number) => void) | null;

  /** First Pokémon of each side (single battles have only them) */
  get #ally() {
    return (this.#field.ally ?? this.#field.ally2)!;
  }
  get #foe() {
    return (this.#field.foe ?? this.#field.foe2)!;
  }

  /** Participants that will share experience */
  readonly #participants = new Set<Creature>();

  /** Stat stages of creatures in battle (cleared when they leave the field) */
  readonly #stages = new Map<Creature, Partial<Record<Stage, number>>>();

  /** How smart trainers are, the level cap, and the weather of the map */
  readonly #difficulty: Difficulty;
  readonly #cap: number;
  readonly #weather: BattleWeather;

  /** Pokémon already told they reached the level cap */
  readonly #capped = new Set<Creature>();

  /** Stat stage of a creature */
  #stage(creature: Creature, name: Stage) {
    return this.#stages.get(creature)?.[name] ?? 0;
  }

  /** Effective speed (stages, paralysis halves it, Swift Swim doubles it in the rain) */
  #speed(creature: Creature) {
    const weather = this.#weather && swimmers[abilityOf(creature)] === this.#weather ? 2 : 1;
    return stat(creature, 5) * stageMultiplier(this.#stage(creature, "speed")) * (creature.status === "paralysis" ? 0.5 : 1) * weather;
  }

  /** Slot a creature stands in (its side's first slot when it isn't on the field) */
  #side(creature: Creature): Slot {
    return slots.find((slot) => this.#field[slot] === creature) ?? (this.#foes.includes(creature) ? "foe" : "ally");
  }

  /** Is a creature the player's */
  #mine(creature: Creature) {
    return team(this.#side(creature)) === "ally";
  }

  /** Creatures standing (not fainted) in the slots of a side */
  #standing(side: "ally" | "foe") {
    return sides[side].filter((slot) => (this.#field[slot]?.hp ?? 0) > 0) as Slot[];
  }

  /** "Foe Zigzagoon", "Wild Zigzagoon" or your own "Treecko" */
  #who(creature: Creature) {
    return this.#mine(creature) ? named(creature) : `${this.#opponent ? "Foe" : this.raid ? "Raid boss" : "Wild"} ${named(creature)}`;
  }

  /** Constructor */
  constructor({
    wild,
    opponent = null,
    rules = {},
  }: {
    wild?: Creature;
    opponent?: Opponent | null;
    rules?: {
      difficulty?: Difficulty;
      cap?: number;
      weather?: BattleWeather;
      water?: boolean;
      scene?: Scene;
      noItems?: boolean;
      double?: boolean;
      raid?: { den: string; onhit?: (damage: number) => void };
    };
  }) {
    this.water = rules.water ?? false;
    this.scene = rules.scene ?? null;
    this.#noItems = rules.noItems ?? false;
    this.raid = rules.raid?.den ?? null;
    this.#onhit = rules.raid?.onhit ?? null;
    this.#opponent = opponent;
    this.#difficulty = rules.difficulty ?? "normal";
    this.#cap = rules.cap ?? 100;
    this.#weather = rules.weather ?? null;
    this.#foes = opponent ? opponent.team : [wild!];
    //Double battles need two Pokémon able to fight on each side (a trainer battle), single ones otherwise
    const ready = (trainer.profile?.party ?? []).filter(({ hp }) => hp > 0);
    this.double = Boolean(rules.double && opponent && this.#foes.filter(({ hp }) => hp > 0).length >= 2 && ready.length >= 2);
    this.#field.foe = this.#foes.find(({ hp }) => hp > 0) ?? this.#foes[0];
    this.#field.ally = trainer.lead!;
    if (this.double) {
      this.#field.foe2 = this.#foes.find((creature) => creature.hp > 0 && creature !== this.#field.foe)!;
      this.#field.ally2 = ready.find((creature) => creature !== this.#field.ally)!;
    }
    const side = (creature: Creature | null): BattleSide | null => (creature ? { creature, entered: 0, fx: "", fxKey: 0, info: false } : null);
    this.view = {
      phase: "intro",
      foe: side(this.#field.foe)!,
      ally: side(this.#field.ally)!,
      foe2: side(this.#field.foe2),
      ally2: side(this.#field.ally2),
      log: "",
      menu: null,
      anim: null,
      ball: null,
      slide: null,
    };
  }

  /** Send a creature out in a slot (replays its entrance when animated) */
  #render(slot: Slot, animate = false) {
    const creature = this.#field[slot];
    const current = this.view[slot];
    if (!creature) {
      return;
    }
    this.view[slot] = current
      ? { ...current, creature, fx: "", entered: current.entered + (animate ? 1 : 0), info: true }
      : { creature, fx: "", entered: 1, fxKey: 0, info: true };
    this.#emit();
  }

  /** Play an animation in a slot */
  #fx(slot: Slot, fx: BattleSide["fx"]) {
    const current = this.view[slot];
    if (current) {
      this.view[slot] = { ...current, fx, fxKey: current.fxKey + 1 };
      this.#emit();
    }
  }

  /** Write a message in the battle log, one letter at a time */
  async #say(text: string, delay = 900) {
    this.view.log = "";
    for (const char of text) {
      this.view.log += char;
      this.#emit();
      await wait(14);
    }
    await wait(delay);
  }

  /** Pick a menu entry (from the interface), or go back with -1 */
  choose(index: number) {
    this.#choose?.(index);
  }

  /** Move the menu cursor onto an entry (pointing at it) */
  point(index: number) {
    const menu = this.view.menu;
    if (menu && menu.choices[index] && index !== menu.cursor) {
      this.view.menu = { ...menu, cursor: index };
      this.#emit();
    }
  }

  /**
   * Show a menu and wait for a choice, like the Game Boy Advance games: the arrow keys (or WASD) move the cursor,
   * Space, Enter, Z or E pick, number keys pick directly, and X or Escape go back when `back` is given (its value is returned)
   */
  #menu<T>(
    choices: { label: string; value: T; detail?: string; color?: string; disabled?: boolean; pp?: string; type?: string }[],
    { columns = 2, back, kind }: { columns?: number; back?: T; kind?: "moves" } = {},
  ) {
    return new Promise<T>((solve) => {
      const finish = (value: T) => {
        document.removeEventListener("keydown", keys, true);
        this.#choose = null;
        this.view.menu = null;
        this.#emit();
        solve(value);
      };
      const done = (index: number) => {
        if (index < 0 && back !== undefined) {
          return finish(back);
        }
        if (choices[index] && !choices[index].disabled) {
          finish(choices[index].value);
        }
      };
      const steps: Record<string, number> = { arrowleft: -1, a: -1, arrowright: 1, d: 1, arrowup: -columns, w: -columns, arrowdown: columns, s: columns };
      const keys = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        const number = Number(event.key) - 1;
        const handled = (key in steps || [" ", "enter", "z", "e", "x", "escape"].includes(key) || choices[number]) && this.view.menu;
        if (!handled) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (choices[number]) {
          return done(number);
        }
        if (key === "x" || key === "escape") {
          return done(-1);
        }
        if (key in steps) {
          return this.point(this.view.menu!.cursor + steps[key]);
        }
        if (!event.repeat) {
          done(this.view.menu!.cursor);
        }
      };
      document.addEventListener("keydown", keys, true);
      this.#choose = done;
      this.view.menu = {
        columns,
        cursor: Math.max(
          0,
          choices.findIndex(({ disabled }) => !disabled),
        ),
        back: back !== undefined,
        kind,
        choices: choices.map(({ label, detail, color, disabled, pp, type }, i) => ({ label, detail: detail ?? `${i + 1}`, color, disabled, pp, type })),
      };
      this.#emit();
    });
  }

  /** Run the battle */
  /** Start downloading the battle sprites of the opening Pokémon on both sides */
  #preload() {
    if (typeof Image === "undefined") {
      return;
    }
    const lead = trainer.lead;
    for (const [creature, back] of [
      [this.#foe, false],
      [lead, true],
    ] as const) {
      if (creature && !creature.art) {
        new Image().src = battleSprite(creature.species, { back, shiny: creature.shiny }).src;
      }
    }
  }

  async start(): Promise<Outcome> {
    //Fetch both battle sprites during the intro flash, so they're ready when the Pokémon appear
    this.#preload();
    Battle.active = this;
    Battle.#announce();
    sound.music("battle");
    for (const slot of ["foe", "foe2"] as const) {
      if (this.#field[slot]) trainer.see(this.#field[slot]!.species);
    }
    await wait(900);
    this.view.phase = "fight";
    this.#render("foe", true);
    this.#render("foe2", true);
    this.view.ally = { ...this.view.ally, info: false };
    if (this.view.ally2) this.view.ally2 = { ...this.view.ally2, info: false };
    const pair = (a: Creature | null, b: Creature | null) => (b ? `${named(a!)} and ${named(b)}` : named(a!));
    if (this.#opponent) {
      await this.#say(`${this.#opponent.name} wants to battle!`);
      await this.#say(`${this.#opponent.name} sent out ${pair(this.#field.foe, this.#field.foe2)}!`, 500);
    } else if (this.raid) {
      await this.#say(`The raid boss ${named(this.#foe)}${this.#foe.shiny ? " (shiny!)" : ""} appeared!`);
    } else {
      await this.#say(`A wild ${named(this.#foe)}${this.#foe.shiny ? " (shiny!)" : ""} appeared!`);
    }
    this.#render("ally", true);
    this.#render("ally2", true);
    this.#participants.add(this.#ally);
    if (this.#field.ally2) this.#participants.add(this.#field.ally2);
    await this.#say(`Go! ${pair(this.#field.ally, this.#field.ally2)}!`, 500);
    if (this.#weather) {
      await this.#say({ rain: "Rain continues to fall.", sandstorm: "The sandstorm rages.", snow: "Snow continues to fall." }[this.#weather], 600);
    }
    for (const slot of ["foe", "foe2", "ally", "ally2"] as const) {
      if (this.#field[slot]) await this.#enter(this.#field[slot]!);
    }

    let outcome = null as Outcome | null;
    while (!outcome) {
      outcome = await this.#turn();
    }
    if (outcome === "win" && this.raid) {
      outcome = await this.#raidCatch();
    }
    trainer.save();
    await wait(300);
    this.view.phase = "outro";
    this.#emit();
    await wait(500);
    Battle.active = null;
    Battle.#announce();
    sound.music("town");
    return outcome;
  }

  /** Play a turn */
  async #turn(): Promise<Outcome | null> {
    //Other players brought the raid boss down
    if (this.#raidDown()) {
      return this.#fainted("foe");
    }
    this.#moved.clear();
    this.#flinched.clear();
    this.#protected.clear();
    //The player's Pokémon choose what to do (items, switching and running happen right away), then the opponents
    const actions = [] as { slot: Slot; who: Creature; move: Move; aim: Slot | null }[];
    for (const slot of this.#standing("ally")) {
      const plan = await this.#plan(slot);
      if (plan === "back") {
        return null;
      }
      if (typeof plan === "string") {
        return plan;
      }
      if (plan) {
        actions.push(plan);
      }
    }
    if (this.#raidDown()) {
      return this.#fainted("foe");
    }
    for (const slot of this.#standing("foe")) {
      const who = this.#field[slot]!;
      const targets = this.#standing("ally");
      if (!targets.length) {
        break;
      }
      //Hard trainers go for the weakest of the two, the others pick at random
      const aim =
        this.#opponent && this.#difficulty === "hard"
          ? targets.reduce((a, b) => (this.#field[a]!.hp / hp(this.#field[a]!) <= this.#field[b]!.hp / hp(this.#field[b]!) ? a : b))
          : targets[Math.floor(Math.random() * targets.length)];
      actions.push({ slot, who, move: this.#pick(who, this.#field[aim]!), aim });
    }
    //Higher priority first, then a Quick Claw now and then, then the faster Pokémon (ties go to the player)
    const claws = new Map(actions.map(({ who }) => [who, who.held === "quick-claw" && Math.random() < 0.2]));
    actions.sort((a, b) => b.move.priority - a.move.priority || Number(claws.get(b.who)) - Number(claws.get(a.who)) || this.#speed(b.who) - this.#speed(a.who));
    for (const { slot, who, move, aim } of actions) {
      //Fainted, or replaced since the turn began: it doesn't act
      if (this.#field[slot] !== who || who.hp <= 0) {
        continue;
      }
      const outcome = await this.#attack(slot, move, aim);
      if (outcome) {
        return outcome;
      }
      if (this.#raidDown()) {
        return this.#fainted("foe");
      }
    }
    //End of the turn: poison and burns, the weather, Leftovers, then abilities
    for (const slot of slots) {
      const outcome = await this.#endTurn(slot);
      if (outcome) {
        return outcome;
      }
    }
    return null;
  }

  /** What one of the player's Pokémon does this turn: a move (and its target), nothing more (an item or a switch was used), going back, or the end of the battle */
  async #plan(slot: Slot): Promise<{ slot: Slot; who: Creature; move: Move; aim: Slot | null } | null | "back" | Outcome> {
    const me = this.#field[slot]!;
    await this.#say(`What will ${named(me)} do?`, 0);
    const action = await this.#menu([
      { label: "FIGHT", value: "fight", color: "#e8505a" },
      { label: "BAG", value: "bag", color: "#e0a030", disabled: this.#noItems },
      { label: "POKéMON", value: "party", color: "#58b048" },
      { label: "RUN", value: "run", color: "#4890d8", disabled: Boolean(this.#opponent) },
    ]);
    switch (action) {
      case "fight": {
        if (!me.moves.some(({ pp }) => pp > 0)) {
          return { slot, who: me, move: struggle, aim: this.#standing("foe")[0] ?? null };
        }
        const choice = await this.#menu<number>(
          me.moves.map(({ key, pp }, i) => {
            const data = assets.moves[key];
            return {
              label: data?.name ?? key,
              value: i,
              detail: `${data?.type.toUpperCase()} · PP ${pp}/${data?.pp}`,
              color: colors[data?.type],
              disabled: pp <= 0,
              pp: `${pp}/${data?.pp}`,
              type: data?.type ?? "",
            };
          }),
          { back: -1, kind: "moves" },
        );
        if (choice < 0) {
          return "back";
        }
        const move = assets.moves[me.moves[choice].key];
        //Double battles: moves aimed at one Pokémon need a target
        let aim = this.#standing("foe")[0] ?? null;
        const aimed = move.power > 0 || (!move.effect?.self && !move.heal && !move.protect);
        if (this.double && aimed && !move.spread && this.#standing("foe").length > 1) {
          const target = await this.#menu<Slot | "back">(
            this.#standing("foe").map((foe) => ({
              label: this.#who(this.#field[foe]!),
              value: foe as Slot | "back",
              detail: `Lv ${this.#field[foe]!.level}`,
              color: colors[species(this.#field[foe]!.species).types[0]],
            })),
            { back: "back" },
          );
          if (target === "back") {
            return "back";
          }
          aim = target;
        }
        me.moves[choice].pp--;
        return { slot, who: me, move, aim };
      }
      case "bag": {
        const bag = trainer.bag;
        const usable = (id: ItemId) => {
          const item = items[id];
          return item.kind === "ball" ? !this.#opponent && !this.raid : item.kind === "heal" ? me.hp < hp(me) : item.kind === "cure" && Boolean(me.status);
        };
        //The bag screen, like the games (only items that help right now can be used)
        const choice = await ui.bag({ battle: { usable: (id) => bag.some((entry) => entry.id === id) && usable(id) } });
        if (!choice) {
          return "back";
        }
        trainer.take(choice);
        const item = items[choice];
        if (item.kind === "ball") {
          if (await this.#throw(choice)) {
            return "caught";
          }
        } else if (item.kind === "heal") {
          me.hp = Math.min(hp(me), me.hp + item.amount);
          this.#emit();
          await this.#say(`${named(me)} recovered some HP.`);
        } else {
          cure(me);
          this.#emit();
          await this.#say(`${named(me)} is healthy again!`);
        }
        return null;
      }
      case "party":
        return (await this.#switch(true, slot)) ? null : "back";
      case "run": {
        const chance = abilityOf(me) === "run-away" ? 1 : (this.#speed(me) * 128) / Math.max(1, this.#speed(this.#foe)) / 256 + 0.3;
        if (Math.random() < chance) {
          sound.play("hit");
          await this.#say("Got away safely!");
          return "run";
        }
        await this.#say("Can't escape!");
        return null;
      }
    }
    return null;
  }

  /** What happens to a Pokémon on the field at the end of the turn (returns an outcome when the battle ends) */
  async #endTurn(side: Slot): Promise<Outcome | null> {
    const creature = this.#field[side];
    if (!creature || creature.hp <= 0) {
      return null;
    }
    const ability = abilityOf(creature);
    const types = species(creature.species).types;
    const hurts = [] as [number, string][];
    if (creature.status === "poison" || creature.status === "burn") {
      hurts.push([creature.status === "poison" ? 8 : 16, `${this.#who(creature)} is hurt by ${creature.status === "poison" ? "poison" : "its burn"}!`]);
    }
    if (this.#weather === "sandstorm" && !types.some((type) => ["rock", "ground", "steel"].includes(type)) && !["sand-veil", "sand-rush"].includes(ability)) {
      hurts.push([16, `${this.#who(creature)} is buffeted by the sandstorm!`]);
    }
    if (this.#weather === "snow" && !types.includes("ice") && !["snow-cloak", "slush-rush", "ice-body"].includes(ability)) {
      hurts.push([16, `${this.#who(creature)} is pelted by the snow!`]);
    }
    for (const [part, message] of hurts) {
      if (creature.hp <= 0) {
        break;
      }
      creature.hp = Math.max(0, creature.hp - Math.max(1, Math.floor(hp(creature) / part)));
      this.#fx(side, "hurt");
      await this.#say(message, 600);
      if (creature.hp <= 0) {
        return this.#fainted(side);
      }
    }
    if (creature.hp <= 0) {
      return null;
    }
    if (creature.held === "leftovers" && creature.hp < hp(creature)) {
      creature.hp = Math.min(hp(creature), creature.hp + Math.max(1, Math.floor(hp(creature) / 16)));
      this.#emit();
      await this.#say(`${this.#who(creature)} restored a little HP using its Leftovers!`, 600);
    }
    if (ability === "speed-boost" && this.#stage(creature, "speed") < 6) {
      this.#stages.set(creature, { ...this.#stages.get(creature), speed: this.#stage(creature, "speed") + 1 });
      await this.#say(`${this.#who(creature)}'s Speed Boost raised its Speed!`, 600);
    }
    if (ability === "shed-skin" && creature.status && Math.random() < 1 / 3) {
      cure(creature);
      this.#emit();
      await this.#say(`${this.#who(creature)}'s Shed Skin cured its condition!`, 600);
    }
    return null;
  }

  /** A creature fainted: say so and go on (returns an outcome when the battle ends) */
  async #fainted(slot: Slot) {
    const creature = this.#field[slot]!;
    this.#fx(slot, "fainted");
    await this.#say(`${this.#who(creature)} fainted!`);
    return team(slot) === "foe" ? await this.#foeFainted(slot, creature) : await this.#allyFainted(slot);
  }

  /** Abilities that work when a Pokémon comes out (Intimidate) */
  async #enter(creature: Creature) {
    if (abilityOf(creature) !== "intimidate" || creature.hp <= 0) {
      return;
    }
    //Every opponent on the field
    for (const slot of this.#standing(this.#mine(creature) ? "foe" : "ally")) {
      const target = this.#field[slot]!;
      const guard = guards[abilityOf(target)];
      if (guard === "all" || guard === "attack") {
        await this.#say(`${this.#who(target)}'s ${abilityName(abilityOf(target))} prevents its Attack from falling!`, 700);
        continue;
      }
      const before = this.#stage(target, "attack");
      if (before > -6) {
        this.#stages.set(target, { ...this.#stages.get(target), attack: before - 1 });
        this.#fx(slot, "hurt");
        await this.#say(`${this.#who(creature)}'s Intimidate cuts ${this.#who(target)}'s Attack!`, 700);
      }
    }
  }

  /** Berries a hurt or ailing Pokémon eats (each once) */
  async #berry(creature: Creature) {
    const held = creature.held;
    if (!held || creature.hp <= 0) {
      return;
    }
    if ((held === "oran-berry" || held === "sitrus-berry") && creature.hp * 2 <= hp(creature)) {
      const heal = held === "oran-berry" ? 10 : Math.floor(hp(creature) / 4);
      creature.hp = Math.min(hp(creature), creature.hp + heal);
      delete creature.held;
      this.#emit();
      await this.#say(`${this.#who(creature)} restored HP using its ${items[held].name}!`, 700);
    } else if (held === "lum-berry" && creature.status) {
      cure(creature);
      delete creature.held;
      this.#emit();
      await this.#say(`${this.#who(creature)}'s Lum Berry cured its condition!`, 700);
    }
  }

  /** The opponent trainer slides in to say one of their lines (each once) */
  async #line(key: "last" | "low") {
    const text = this.#opponent?.lines?.[key]?.trim();
    if (!text || this.#said.has(key)) {
      return;
    }
    this.#said.add(key);
    this.view.slide = { sprite: this.#opponent!.sprite, key: (this.view.slide?.key ?? 0) + 1 };
    this.#emit();
    await wait(350);
    for (const page of text.split(/\n\s*\n/)) {
      await this.#say(`${this.#opponent!.name}: ${page}`, 1400);
    }
    this.view.slide = null;
    this.#emit();
    await wait(250);
  }

  /** Opponent move choice: wild Pokémon pick at random, trainers by the town's difficulty */
  #pick(attacker: Creature, defender: Creature): Move {
    const chosen = choose(attacker, defender, this.#opponent ? this.#difficulty : "easy", this.#weather);
    if (!chosen) {
      return struggle;
    }
    chosen.pp--;
    return assets.moves[chosen.key] ?? struggle;
  }

  /** Perform an attack (returns an outcome when battle ends) */
  async #attack(side: Slot, move: Move, aim: Slot | null = null): Promise<Outcome | null | undefined> {
    const attacker = this.#field[side]!;
    if (!attacker || attacker.hp <= 0) {
      return;
    }
    //Sleep and paralysis can stop a move
    if (attacker.status === "sleep") {
      attacker.sleep = (attacker.sleep ?? 1) - 1;
      if (attacker.sleep > 0) {
        await this.#say(`${this.#who(attacker)} is fast asleep.`);
        return;
      }
      cure(attacker);
      this.#emit();
      await this.#say(`${this.#who(attacker)} woke up!`, 600);
    }
    if (attacker.status === "paralysis" && Math.random() < 0.25) {
      await this.#say(`${this.#who(attacker)} is paralyzed! It can't move!`);
      return;
    }
    this.#moved.add(attacker);
    if (this.#flinched.has(attacker)) {
      await this.#say(`${this.#who(attacker)} flinched and couldn't move!`);
      return;
    }
    await this.#say(`${this.#who(attacker)} used ${move.name}!`, 300);
    this.#fx(side, "lunge");
    await wait(250);

    //Who it hits: the user (Protect, Recover, Swords Dance), every opponent (Surf in a double battle), or one opponent
    const other = team(side) === "ally" ? "foe" : "ally";
    const self = Boolean(move.protect || move.heal || (!move.power && move.effect?.self));
    let targets: Slot[];
    if (self) {
      targets = [side];
    } else if (this.double && move.spread) {
      const partner = sides[team(side)].find((slot) => slot !== side && (this.#field[slot]?.hp ?? 0) > 0);
      targets = [...this.#standing(other), ...(move.spread === "all" && partner ? [partner] : [])];
    } else {
      const chosen = aim && team(aim) === other && (this.#field[aim]?.hp ?? 0) > 0 ? aim : this.#standing(other)[0];
      targets = chosen ? [chosen] : [];
    }

    //Protect: works every time the first time, then half as often for each one in a row
    const streak = move.protect ? (this.#protects.get(attacker) ?? 0) : 0;
    this.#protects.set(attacker, move.protect ? streak + 1 : 0);
    if (move.protect) {
      if (Math.random() < 1 / 2 ** streak) {
        this.#protected.add(attacker);
        this.#animate(side, move, "self");
        await this.#say(`${this.#who(attacker)} protected itself!`);
      } else {
        this.#protects.set(attacker, 0);
        await this.#say("But it failed!");
      }
      return;
    }
    //Healing moves (Recover)
    if (move.heal) {
      if (attacker.hp >= hp(attacker)) {
        await this.#say(`${this.#who(attacker)}'s HP is full!`);
        return;
      }
      this.#animate(side, move, "self");
      attacker.hp = Math.min(hp(attacker), attacker.hp + Math.max(1, Math.floor((hp(attacker) * move.heal) / 100)));
      this.#emit();
      await this.#say(`${this.#who(attacker)} regained health!`);
      return;
    }
    if (!targets.length) {
      await this.#say("But there was no target…");
      return;
    }
    for (const target of targets) {
      if (attacker.hp <= 0) {
        break;
      }
      const outcome = await this.#strike(side, target, move, targets.length > 1);
      if (outcome) {
        return outcome;
      }
    }
    return;
  }

  /** One hit of a move on one target (moves hitting every opponent strike each of them, at 3/4 power) */
  async #strike(side: Slot, target: Slot, move: Move, spread: boolean): Promise<Outcome | null | undefined> {
    const attacker = this.#field[side]!;
    const defender = this.#field[target]!;
    //Moves aimed at a protected Pokémon do nothing
    if (this.#protected.has(defender) && (move.power || !move.effect?.self)) {
      await this.#say(`${this.#who(defender)} protected itself!`);
      return;
    }

    const evasion =
      (this.#weather === "sandstorm" && abilityOf(defender) === "sand-veil") || (this.#weather === "snow" && abilityOf(defender) === "snow-cloak") ? 0.8 : 1;
    const accuracy =
      move.accuracy *
      stageMultiplier(Math.max(-6, Math.min(6, this.#stage(attacker, "accuracy") - this.#stage(defender, "evasion"))), true) *
      (abilityOf(attacker) === "compound-eyes" ? 1.3 : 1) *
      evasion;
    if (Math.random() * 100 >= accuracy) {
      await this.#say(`${named(attacker)}'s attack missed!`);
      return;
    }
    //Abilities that take moves of a type (Levitate, Water Absorb…)
    const absorb = absorbs[abilityOf(defender)];
    if (absorb?.type === move.type && (move.power || !move.effect?.self)) {
      if (absorb.heals && defender.hp < hp(defender)) {
        defender.hp = Math.min(hp(defender), defender.hp + Math.floor(hp(defender) / 4));
        this.#emit();
        await this.#say(`${this.#who(defender)}'s ${abilityName(abilityOf(defender))} restored its HP!`);
      } else {
        await this.#say(`It doesn't affect ${this.#who(defender)}… (${abilityName(abilityOf(defender))})`);
      }
      return;
    }
    //Status moves: only their effect
    if (!move.power) {
      this.#animate(side, move, move.effect?.self ? "self" : "projectile", target);
      if (!(await this.#effect(move, attacker, defender))) {
        await this.#say("But it failed!");
      }
      return;
    }
    const physical = move.class === "physical";
    const burned = physical && attacker.status === "burn" && abilityOf(attacker) !== "guts";
    //Multi-hit moves: 2 to 5 hits (2 and 3 are the most common), or a set number
    const [low, high] = move.hits ?? [1, 1];
    const roll = Math.random();
    const times = low === high ? low : Math.min(high, low + (roll < 0.375 ? 0 : roll < 0.75 ? 1 : roll < 0.875 ? 2 : 3));
    let dealt = 0,
      hits = 0,
      multiplier = 1,
      sturdy = false;
    for (let i = 0; i < times && defender.hp > 0; i++) {
      const hit = damage(attacker, defender, move, {
        attack: stageMultiplier(this.#stage(attacker, physical ? "attack" : "spatk")) * (burned ? 0.5 : 1) * attackOf(attacker, physical),
        defense: stageMultiplier(this.#stage(defender, physical ? "defense" : "spdef")),
        power: powerOf(attacker, defender, move, this.#weather) * (spread ? 0.75 : 1),
        crit: move.crit ?? 0,
      });
      multiplier = hit.multiplier;
      this.#animate(side, move, physical ? "contact" : "projectile", target);
      await wait(physical ? 250 : 380);
      sound.play(multiplier > 1 ? "hit2" : "hit");
      //Sturdy: a Pokémon at full HP survives a hit that would knock it out
      sturdy = abilityOf(defender) === "sturdy" && defender.hp === hp(defender) && hit.value >= defender.hp;
      const before = defender.hp;
      defender.hp = sturdy ? 1 : Math.max(0, defender.hp - hit.value);
      dealt += before - defender.hp;
      hits++;
      this.#fx(target, "hurt");
      await wait(times > 1 ? 350 : 500);
      if (hit.critical && hit.value) {
        await this.#say("A critical hit!", 600);
      }
      if (multiplier === 0) {
        break;
      }
    }
    if (times > 1 && multiplier > 0) {
      await this.#say(`Hit ${hits} time${hits > 1 ? "s" : ""}!`, 600);
    }
    //Raids: the others in the room see the boss lose the HP you took
    if (this.raid && dealt > 0 && team(target) === "foe") {
      this.#onhit?.(dealt);
    }
    if (multiplier === 0) {
      await this.#say(`It doesn't affect ${named(defender)}…`);
    } else if (multiplier > 1) {
      await this.#say("It's super effective!", 700);
    } else if (multiplier < 1) {
      await this.#say("It's not very effective…", 700);
    }
    if (sturdy) {
      await this.#say(`${this.#who(defender)} endured the hit with Sturdy!`, 700);
    }
    //Draining moves give the user part of the damage back, reckless ones hurt it
    if (move.drain && dealt > 0) {
      const amount = Math.max(1, Math.floor((dealt * Math.abs(move.drain)) / 100));
      if (move.drain > 0 && attacker.hp < hp(attacker)) {
        attacker.hp = Math.min(hp(attacker), attacker.hp + amount);
        this.#emit();
        await this.#say(`${this.#who(defender)} had its energy drained!`, 600);
      } else if (move.drain < 0) {
        attacker.hp = Math.max(0, attacker.hp - amount);
        this.#fx(side, "hurt");
        await this.#say(`${this.#who(attacker)} is damaged by recoil!`, 600);
      }
    }

    if (defender.hp <= 0) {
      const outcome = await this.#fainted(target);
      //The user may have fainted from recoil too
      return outcome ?? (attacker.hp <= 0 ? this.#fainted(side) : null);
    }
    if (attacker.hp <= 0) {
      return this.#fainted(side);
    }
    //Flinching: only when the target hasn't moved yet this turn
    if (move.flinch && !this.#moved.has(defender) && Math.random() * 100 < move.flinch) {
      this.#flinched.add(defender);
    }
    await this.#berry(defender);
    //Their last Pokémon is low on HP
    if (target === "foe" && defender.hp * 4 <= hp(defender) && this.#foes.filter(({ hp }) => hp > 0).length === 1) {
      await this.#line("low");
    }
    //Abilities that hurt or afflict whoever hits them with a physical move
    if (physical && multiplier > 0) {
      const ability = abilityOf(defender);
      if (ability === "rough-skin") {
        attacker.hp = Math.max(0, attacker.hp - Math.max(1, Math.floor(hp(attacker) / 16)));
        this.#fx(side, "hurt");
        await this.#say(`${this.#who(attacker)} was hurt by ${this.#who(defender)}'s Rough Skin!`, 700);
        if (attacker.hp <= 0) {
          return this.#fainted(side);
        }
      }
      const status = contact[ability];
      if (status && Math.random() < 0.3 && canGet(attacker, status)) {
        attacker.status = status;
        if (status === "sleep") {
          attacker.sleep = 1 + Math.ceil(Math.random() * 3);
        }
        this.#emit();
        await this.#say(
          `${this.#who(defender)}'s ${abilityName(ability)} ${{ sleep: "put", poison: "poisoned", paralysis: "paralyzed", burn: "burned" }[status]} ${this.#who(attacker)}${status === "sleep" ? " to sleep" : ""}!`,
          700,
        );
        await this.#berry(attacker);
      }
    }
    //Side effects of damaging moves, by chance (Ember may burn)
    if (move.effect && multiplier > 0 && Math.random() * 100 < move.effect.chance) {
      await this.#effect(move, attacker, defender);
    }
    return;
  }

  /** Apply what a move does besides damage (returns false when nothing happened) */
  async #effect(move: Move, attacker: Creature, defender: Creature) {
    const effect = move.effect;
    if (!effect) {
      return false;
    }
    let worked = false;
    if (effect.ailment) {
      if (canGet(defender, effect.ailment)) {
        defender.status = effect.ailment;
        if (effect.ailment === "sleep") {
          defender.sleep = 1 + Math.ceil(Math.random() * 3);
        }
        this.#emit();
        const what = { sleep: "fell asleep!", poison: "was poisoned!", paralysis: "is paralyzed! It may be unable to move!", burn: "was burned!" }[
          effect.ailment
        ];
        await this.#say(`${this.#who(defender)} ${what}`);
        await this.#berry(defender);
        worked = true;
      } else if (!move.power) {
        await this.#say(
          defender.status
            ? `${this.#who(defender)} is already ${{ sleep: "asleep", poison: "poisoned", paralysis: "paralyzed", burn: "burned" }[defender.status]}!`
            : `It doesn't affect ${this.#who(defender)}…`,
        );
        return true;
      }
    }
    const names = { attack: "Attack", defense: "Defense", spatk: "Sp. Atk", spdef: "Sp. Def", speed: "Speed", accuracy: "accuracy", evasion: "evasiveness" };
    for (const [name, change] of effect.stats ?? []) {
      const creature = effect.self ? attacker : defender;
      const guard = guards[abilityOf(creature)];
      if (!effect.self && change < 0 && (guard === "all" || guard === name)) {
        await this.#say(`${this.#who(creature)}'s ${abilityName(abilityOf(creature))} prevents its ${names[name]} from falling!`, 600);
        continue;
      }
      const stages = this.#stages.get(creature) ?? {};
      const before = stages[name] ?? 0;
      const after = Math.max(-6, Math.min(6, before + change));
      if (after === before) {
        await this.#say(`${this.#who(creature)}'s ${names[name]} won't go any ${change > 0 ? "higher" : "lower"}!`, 600);
        continue;
      }
      stages[name] = after;
      this.#stages.set(creature, stages);
      this.#fx(this.#side(creature), change > 0 ? "lunge" : "hurt");
      await this.#say(`${this.#who(creature)}'s ${names[name]} ${change > 0 ? "rose" : "fell"}${Math.abs(change) > 1 ? " sharply" : ""}!`, 700);
      worked = true;
    }
    return worked;
  }

  /** Attack animation (the battle screen draws it with Gen 3 sprites) */
  #animate(side: Slot, move: Move, mode: "contact" | "projectile" | "self", to: Slot = side) {
    const key = (this.view.anim?.key ?? 0) + 1;
    this.view.anim = { from: side, to, type: move.type, mode, key, ...(move.protect ? { protect: true } : {}) };
    this.#emit();
    setTimeout(() => {
      if (this.view.anim?.key === key) {
        this.view.anim = null;
        this.#emit();
      }
    }, 900);
  }

  /** Opponent fainted: grant experience and send next one */
  async #foeFainted(slot: Slot, fallen: Creature): Promise<Outcome | null> {
    const base = species(fallen.species).xp;
    const total = Math.floor(((base * fallen.level) / 7) * (this.#opponent ? 1.5 : 1));
    const participants = [...this.#participants].filter((creature) => creature.hp > 0);
    for (const creature of participants) {
      const amount = Math.max(1, Math.floor(total / participants.length));
      if (creature.level >= this.#cap) {
        //Level cap: no more experience until the next badge
        if (!this.#capped.has(creature)) {
          this.#capped.add(creature);
          await this.#say(`${named(creature)} can't grow past Lv. ${this.#cap} until the next badge.`, 700);
        }
        continue;
      }
      await this.#say(`${named(creature)} gained ${amount} EXP. Points!`, 500);
      const messages = grow(creature, amount, this.#cap);
      const at = slots.find((other) => this.#field[other] === creature);
      if (at) {
        this.#render(at);
      }
      for (const message of messages) {
        if (message.includes("grew")) {
          sound.play("victory");
        }
        await this.#say(message);
      }
      //Evolution right after the level up
      const into = evolution(creature);
      if (into) {
        await this.#say(`What? ${named(creature)} is evolving!`, 1200);
        const evolved = evolve(creature, into);
        trainer.see(into);
        if (!trainer.profile!.caught.includes(into)) {
          trainer.profile!.caught.push(into);
        }
        if (at) {
          this.#render(at, true);
        }
        sound.play("victory");
        for (const message of evolved) {
          await this.#say(message);
        }
      }
    }
    //The next one in reserve takes the slot (the battle goes on while the other slot still stands)
    const onField = (creature: Creature) => slots.some((other) => this.#field[other] === creature);
    const reserve = this.#foes.filter((creature) => creature.hp > 0 && !onField(creature));
    const next = reserve[0];
    if (next) {
      this.#field[slot] = next;
      this.#participants.clear();
      this.#standing("ally").forEach((ally) => this.#participants.add(this.#field[ally]!));
      trainer.see(next.species);
      //Sending out their last Pokémon
      if (reserve.length === 1) {
        await this.#line("last");
      }
      await this.#say(`${this.#opponent!.name} sent out ${named(next)}!`, 400);
      this.#render(slot, true);
      await this.#enter(next);
      return null;
    }
    if (this.#standing("foe").length) {
      return null;
    }
    sound.play("victory");
    if (this.#opponent) {
      await this.#say(`You defeated ${this.#opponent.name}!`);
      //Prize money, from the strongest Pokémon they had
      const prize = Math.max(...this.#foes.map(({ level }) => level)) * 40;
      trainer.profile!.money += prize;
      await this.#say(`${trainer.profile!.name} got ₽${prize} for winning!`);
    }
    return "win";
  }

  /** Ally fainted: send another one in its slot, carry on with the other slot, or lose */
  async #allyFainted(slot: Slot): Promise<Outcome | null> {
    const onField = (creature: Creature) => slots.some((other) => this.#field[other] === creature);
    if (trainer.profile!.party.some((creature) => creature.hp > 0 && !onField(creature))) {
      await this.#switch(false, slot);
      return null;
    }
    if (this.#standing("ally").length) {
      return null;
    }
    await this.#say(`${trainer.profile!.name} is out of usable Pokémon!`);
    await this.#say(`${trainer.profile!.name} blacked out!`);
    return "lose";
  }

  /** Switch the Pokémon of a slot */
  async #switch(cancellable: boolean, slot: Slot = "ally") {
    const party = trainer.profile!.party;
    const current = this.#field[slot]!;
    const onField = (creature: Creature) => slots.some((other) => this.#field[other] === creature);
    //The party screen, like the games (a fainted Pokémon has to be replaced: there's no way back then)
    const picked = await ui.party({
      message: "Choose a Pokémon.",
      action: "SHIFT",
      cancel: cancellable,
      can: (creature) =>
        creature.hp <= 0 ? `${named(creature)} has no energy left to battle!` : onField(creature) ? `${named(creature)} is already in battle!` : true,
    });
    //Without an interface (or when it gives none back), the next Pokémon able to fight goes in
    const choice = picked ?? (cancellable ? -1 : party.findIndex((creature) => creature.hp > 0 && !onField(creature)));
    if (choice < 0) {
      return false;
    }
    if (cancellable) {
      await this.#say(`Come back, ${named(current)}!`, 400);
    }
    //Natural Cure heals a condition when its Pokémon leaves the field
    if (abilityOf(current) === "natural-cure" && current.hp > 0) {
      cure(current);
    }
    this.#stages.delete(current);
    const next = party[choice];
    this.#field[slot] = next;
    this.#participants.add(next);
    this.#render(slot, true);
    await this.#say(`Go! ${named(next)}!`, 500);
    await this.#enter(next);
    return true;
  }

  /** Is the raid boss down (other players in the room can knock it out between your moves) */
  #raidDown() {
    return Boolean(this.raid && this.#field.foe && this.#field.foe.hp <= 0 && this.view.foe.fx !== "fainted");
  }

  /** Another player in the room hit the raid boss */
  hurt(den: string, damage: number) {
    const boss = this.#field.foe;
    if (den !== this.raid || !boss || boss.hp <= 0 || this.view.phase === "outro") {
      return;
    }
    boss.hp = Math.max(0, boss.hp - Math.max(0, Math.floor(damage)));
    this.#fx("foe", "hurt");
  }

  /** The raid boss is beaten: one throw to catch it, with better odds (the best ball in the bag, or one from the den) */
  async #raidCatch(): Promise<Outcome> {
    const boss = this.#foe;
    delete boss.boss;
    boss.hp = 1;
    this.#stages.delete(boss);
    this.#render("foe", true);
    await this.#say(`${named(boss)} is worn out! You get one throw!`);
    const rate = (id: ItemId) => (items[id] as { rate?: number }).rate ?? 1;
    const ball = trainer.bag
      .map(({ id }) => id)
      .filter((id) => items[id].kind === "ball")
      .sort((a, b) => rate(b) - rate(a))[0];
    if (ball) {
      trainer.take(ball);
    }
    return (await this.#throw(ball ?? "poke-ball", 2)) ? "caught" : "win";
  }

  /** Throw a ball (gen 3 catch formula, simplified) */
  async #throw(ball: ItemId, bonus = 1) {
    await this.#say(`${trainer.profile!.name} threw ${/^[AEIOU]/i.test(items[ball].name) ? "an" : "a"} ${items[ball].name}!`, 300);
    let key = (this.view.ball?.key ?? 0) + 1;
    this.view.ball = { state: "throw", key };
    this.#emit();
    await wait(600);
    this.#fx("foe", "captured");
    const { a, b } = catchOdds(this.#foe, ((items[ball] as { rate?: number }).rate ?? 1) * bonus);
    let shakes = 0;
    while (shakes < 4 && (a >= 255 || Math.random() * 65536 < b)) {
      shakes++;
      if (shakes < 4) {
        this.view.ball = { state: "shake", key: ++key };
        this.#emit();
        await wait(700);
      }
    }
    if (shakes >= 4) {
      this.view.ball = { state: "caught", key: ++key };
      this.#emit();
      sound.play("victory");
      await this.#say(`Gotcha! ${named(this.#foe)} was caught!`);
      const where = trainer.catch(this.#foe);
      if (where === "box") {
        await this.#say(`${named(this.#foe)} was sent to the PC box.`);
      }
      this.view.ball = null;
      this.#emit();
      return true;
    }
    this.view.ball = null;
    this.#fx("foe", "");
    await this.#say(
      ["Oh no! The Pokémon broke free!", "Aww! It appeared to be caught!", "Aargh! Almost had it!", "Shoot! It was so close, too!"][Math.min(3, shakes)],
    );
    return false;
  }
}
