//Imports
import { assets, battleSprite, type Move, species, type Stage } from "./assets";
import { abilityOf, type Creature, cure, evolution, evolve, grow, hp, named, stat, type Status, trainer } from "./trainer";
import { sound } from "./audio";
import { type ItemId, items } from "./items";
import { abilityName, absorbs, contact, guards, pinch, shields, swimmers } from "./abilities";
import type { BattleRules, Difficulty, Scene } from "./data";
import type { Weather } from "./atmosphere";

/** Battle outcome */
export type Outcome = "win" | "lose" | "run" | "caught";

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
  { attack: attackBoost = 1, defense: defenseBoost = 1, power = 1, average = false } = {},
) {
  const physical = move.class === "physical";
  const attack = stat(attacker, physical ? 1 : 3) * attackBoost,
    defense = stat(defender, physical ? 2 : 4) * defenseBoost;
  const critical = !average && Math.random() < 1 / 16;
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

/** Menu shown below the battle log */
export type BattleMenu = { columns: number; choices: { label: string; detail: string; color?: string; disabled?: boolean }[] };

/** Everything the interface needs to draw a battle */
export type BattleView = {
  phase: "intro" | "fight" | "outro";
  foe: BattleSide;
  ally: BattleSide;
  log: string;
  menu: null | BattleMenu;
  /** Move projectile flying from one side to the other */
  orb: null | { from: "ally" | "foe"; color: string; key: number };
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

  /** Pending menu choice */
  #choose = null as null | ((index: number) => void);

  /** Opponent team */
  readonly #foes: Creature[];

  /** Opponent trainer (null for wild battles) */
  readonly #opponent: Opponent | null;

  /** Active creatures */
  #ally: Creature;
  #foe: Creature;

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

  /** Side a creature is on */
  #side(creature: Creature) {
    return creature === this.#ally ? "ally" : "foe";
  }

  /** "Foe Zigzagoon", "Wild Zigzagoon" or your own "Treecko" */
  #who(creature: Creature) {
    return creature === this.#ally ? named(creature) : `${this.#opponent ? "Foe" : "Wild"} ${named(creature)}`;
  }

  /** Constructor */
  constructor({
    wild,
    opponent = null,
    rules = {},
  }: {
    wild?: Creature;
    opponent?: Opponent | null;
    rules?: { difficulty?: Difficulty; cap?: number; weather?: BattleWeather; water?: boolean; scene?: Scene; noItems?: boolean };
  }) {
    this.water = rules.water ?? false;
    this.scene = rules.scene ?? null;
    this.#noItems = rules.noItems ?? false;
    this.#opponent = opponent;
    this.#difficulty = rules.difficulty ?? "normal";
    this.#cap = rules.cap ?? 100;
    this.#weather = rules.weather ?? null;
    this.#foes = opponent ? opponent.team : [wild!];
    this.#foe = this.#foes[0];
    this.#ally = trainer.lead!;
    const side = (creature: Creature): BattleSide => ({ creature, entered: 0, fx: "", fxKey: 0, info: false });
    this.view = { phase: "intro", foe: side(this.#foe), ally: side(this.#ally), log: "", menu: null, orb: null, ball: null, slide: null };
  }

  /** Send a creature out on a side (replays its entrance when animated) */
  #render(side: "ally" | "foe", animate = false) {
    const creature = side === "ally" ? this.#ally : this.#foe;
    const current = this.view[side];
    this.view[side] = { ...current, creature, fx: "", entered: current.entered + (animate ? 1 : 0), info: true };
    this.#emit();
  }

  /** Play an animation on a side */
  #fx(side: "ally" | "foe", fx: BattleSide["fx"]) {
    const current = this.view[side];
    this.view[side] = { ...current, fx, fxKey: current.fxKey + 1 };
    this.#emit();
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

  /** Pick a menu entry (from the interface) */
  choose(index: number) {
    this.#choose?.(index);
  }

  /** Show menu buttons and wait for a choice (number keys pick entries too) */
  #menu<T>(choices: { label: string; value: T; detail?: string; color?: string; disabled?: boolean }[], { columns = 2 } = {}) {
    return new Promise<T>((solve) => {
      const done = (index: number) => {
        if (!choices[index] || choices[index].disabled) {
          return;
        }
        document.removeEventListener("keydown", keys, true);
        this.#choose = null;
        this.view.menu = null;
        this.#emit();
        solve(choices[index].value);
      };
      const keys = (event: KeyboardEvent) => {
        const index = Number(event.key) - 1;
        if (choices[index] && !choices[index].disabled) {
          event.stopPropagation();
          done(index);
        }
      };
      document.addEventListener("keydown", keys, true);
      this.#choose = done;
      this.view.menu = { columns, choices: choices.map(({ label, detail, color, disabled }, i) => ({ label, detail: detail ?? `${i + 1}`, color, disabled })) };
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
    trainer.see(this.#foe.species);
    await wait(900);
    this.view.phase = "fight";
    this.#render("foe", true);
    this.view.ally = { ...this.view.ally, info: false };
    if (this.#opponent) {
      await this.#say(`${this.#opponent.name} wants to battle!`);
      await this.#say(`${this.#opponent.name} sent out ${named(this.#foe)}!`, 500);
    } else {
      await this.#say(`A wild ${named(this.#foe)}${this.#foe.shiny ? " (shiny!)" : ""} appeared!`);
    }
    this.#render("ally", true);
    this.#participants.add(this.#ally);
    await this.#say(`Go! ${named(this.#ally)}!`, 500);
    if (this.#weather) {
      await this.#say({ rain: "Rain continues to fall.", sandstorm: "The sandstorm rages.", snow: "Snow continues to fall." }[this.#weather], 600);
    }
    await this.#enter(this.#foe);
    await this.#enter(this.#ally);

    let outcome = null as Outcome | null;
    while (!outcome) {
      outcome = await this.#turn();
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
    const profile = trainer.profile!;
    await this.#say(`What will ${named(this.#ally)} do?`, 0);
    const action = await this.#menu([
      { label: "FIGHT", value: "fight", color: "#e8505a" },
      { label: "BAG", value: "bag", color: "#e0a030", disabled: this.#noItems },
      { label: "POKéMON", value: "party", color: "#58b048" },
      { label: "RUN", value: "run", color: "#4890d8", disabled: Boolean(this.#opponent) },
    ]);

    let move = null as Move | null;
    switch (action) {
      case "fight": {
        const usable = this.#ally.moves.filter(({ pp }) => pp > 0);
        if (!usable.length) {
          move = struggle;
          break;
        }
        const choice = await this.#menu<number>([
          ...this.#ally.moves.map(({ key, pp }, i) => {
            const data = assets.moves[key];
            return {
              label: data?.name ?? key,
              value: i,
              detail: `${data?.type.toUpperCase()} · PP ${pp}/${data?.pp}`,
              color: colors[data?.type],
              disabled: pp <= 0,
            };
          }),
          { label: "Back", value: -1, detail: "" },
        ]);
        if (choice < 0) {
          return null;
        }
        this.#ally.moves[choice].pp--;
        move = assets.moves[this.#ally.moves[choice].key];
        break;
      }
      case "bag": {
        const bag = trainer.bag;
        const usable = (id: ItemId) => {
          const item = items[id];
          return item.kind === "ball"
            ? !this.#opponent
            : item.kind === "heal"
              ? this.#ally.hp < hp(this.#ally)
              : item.kind === "cure" && Boolean(this.#ally.status);
        };
        const colorOf = { ball: "#f05038", heal: "#a040a0", cure: "#48a8d0", rod: "#909090", hm: "#909090", hold: "#58a858" };
        const choice = await this.#menu<ItemId | "back">([
          ...bag.map(({ id, count }) => ({
            label: items[id].name,
            value: id as ItemId | "back",
            detail: `x${count} · ${items[id].about}`,
            color: colorOf[items[id].kind],
            disabled: !usable(id),
          })),
          { label: "Back", value: "back", detail: bag.length ? "" : "Your bag is empty" },
        ]);
        if (choice === "back") {
          return null;
        }
        trainer.take(choice);
        const item = items[choice];
        if (item.kind === "ball") {
          if (await this.#throw(choice)) {
            return "caught";
          }
        } else if (item.kind === "heal") {
          this.#ally.hp = Math.min(hp(this.#ally), this.#ally.hp + item.amount);
          this.#emit();
          await this.#say(`${named(this.#ally)} recovered some HP.`);
        } else {
          cure(this.#ally);
          this.#emit();
          await this.#say(`${named(this.#ally)} is healthy again!`);
        }
        break;
      }
      case "party": {
        const switched = await this.#switch(true);
        if (!switched) {
          return null;
        }
        break;
      }
      case "run": {
        const chance = abilityOf(this.#ally) === "run-away" ? 1 : (this.#speed(this.#ally) * 128) / Math.max(1, this.#speed(this.#foe)) / 256 + 0.3;
        if (Math.random() < chance) {
          sound.play("hit");
          await this.#say("Got away safely!");
          return "run";
        }
        await this.#say("Can't escape!");
        break;
      }
    }

    //Resolve turn order
    const foeMove = this.#pick(this.#foe, this.#ally);
    const order = [] as ["ally" | "foe", Move][];
    if (move) {
      //A Quick Claw sometimes lets its holder go first among moves of the same priority
      const claw = (creature: Creature) => creature.held === "quick-claw" && Math.random() < 0.2;
      const [allyClaw, foeClaw] = [claw(this.#ally), claw(this.#foe)];
      const faster = allyClaw !== foeClaw ? allyClaw : this.#speed(this.#ally) >= this.#speed(this.#foe);
      const allyFirst = move.priority > foeMove.priority || (move.priority === foeMove.priority && faster);
      order.push(
        ...((allyFirst
          ? [
              ["ally", move],
              ["foe", foeMove],
            ]
          : [
              ["foe", foeMove],
              ["ally", move],
            ]) as ["ally" | "foe", Move][]),
      );
    } else {
      order.push(["foe", foeMove]);
    }
    for (const [side, used] of order) {
      const outcome = await this.#attack(side, used);
      if (outcome !== undefined) {
        return outcome;
      }
    }
    //End of the turn: poison and burns, the weather, Leftovers, then abilities
    for (const side of ["ally", "foe"] as const) {
      const outcome = await this.#endTurn(side);
      if (outcome) {
        return outcome;
      }
    }
    return null;
  }

  /** What happens to one side at the end of the turn (returns an outcome when the battle ends) */
  async #endTurn(side: "ally" | "foe"): Promise<Outcome | null> {
    const creature = side === "ally" ? this.#ally : this.#foe;
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
  async #fainted(side: "ally" | "foe") {
    const creature = side === "ally" ? this.#ally : this.#foe;
    this.#fx(side, "fainted");
    await this.#say(`${this.#who(creature)} fainted!`);
    return side === "foe" ? await this.#foeFainted() : await this.#allyFainted();
  }

  /** Abilities that work when a Pokémon comes out (Intimidate) */
  async #enter(creature: Creature) {
    if (abilityOf(creature) !== "intimidate" || creature.hp <= 0) {
      return;
    }
    const target = creature === this.#ally ? this.#foe : this.#ally;
    const guard = guards[abilityOf(target)];
    if (guard === "all" || guard === "attack") {
      await this.#say(`${this.#who(target)}'s ${abilityName(abilityOf(target))} prevents its Attack from falling!`, 700);
      return;
    }
    const before = this.#stage(target, "attack");
    if (before > -6) {
      this.#stages.set(target, { ...this.#stages.get(target), attack: before - 1 });
      this.#fx(this.#side(target), "hurt");
      await this.#say(`${this.#who(creature)}'s Intimidate cuts ${this.#who(target)}'s Attack!`, 700);
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
  async #attack(side: "ally" | "foe", move: Move): Promise<Outcome | null | undefined> {
    const attacker = side === "ally" ? this.#ally : this.#foe;
    const defender = side === "ally" ? this.#foe : this.#ally;
    const target = side === "ally" ? "foe" : "ally";
    if (attacker.hp <= 0) {
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
    await this.#say(`${this.#who(attacker)} used ${move.name}!`, 300);
    this.#fx(side, "lunge");
    await wait(250);

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
      if (!(await this.#effect(move, attacker, defender))) {
        await this.#say("But it failed!");
      }
      return;
    }
    const physical = move.class === "physical";
    const burned = physical && attacker.status === "burn" && abilityOf(attacker) !== "guts";
    const { value, critical, multiplier } = damage(attacker, defender, move, {
      attack: stageMultiplier(this.#stage(attacker, physical ? "attack" : "spatk")) * (burned ? 0.5 : 1) * attackOf(attacker, physical),
      defense: stageMultiplier(this.#stage(defender, physical ? "defense" : "spdef")),
      power: powerOf(attacker, defender, move, this.#weather),
    });
    this.#projectile(side, move.type);
    await wait(350);
    sound.play(multiplier > 1 ? "hit2" : "hit");
    //Sturdy: a Pokémon at full HP survives a hit that would knock it out
    const sturdy = abilityOf(defender) === "sturdy" && defender.hp === hp(defender) && value >= defender.hp;
    defender.hp = sturdy ? 1 : Math.max(0, defender.hp - value);
    this.#fx(target, "hurt");
    await wait(500);
    if (critical && value) {
      await this.#say("A critical hit!", 600);
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

    if (defender.hp <= 0) {
      return this.#fainted(target);
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
      this.#fx(creature === this.#ally ? "ally" : "foe", change > 0 ? "lunge" : "hurt");
      await this.#say(`${this.#who(creature)}'s ${names[name]} ${change > 0 ? "rose" : "fell"}${Math.abs(change) > 1 ? " sharply" : ""}!`, 700);
      worked = true;
    }
    return worked;
  }

  /** Projectile animation from attacker to defender */
  #projectile(side: "ally" | "foe", type: string) {
    const key = (this.view.orb?.key ?? 0) + 1;
    this.view.orb = { from: side, color: colors[type] ?? "#fff", key };
    this.#emit();
    setTimeout(() => {
      if (this.view.orb?.key === key) {
        this.view.orb = null;
        this.#emit();
      }
    }, 700);
  }

  /** Opponent fainted: grant experience and send next one */
  async #foeFainted(): Promise<Outcome | null> {
    const base = species(this.#foe.species).xp;
    const total = Math.floor(((base * this.#foe.level) / 7) * (this.#opponent ? 1.5 : 1));
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
      if (creature === this.#ally) {
        this.#render("ally");
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
        if (creature === this.#ally) {
          this.#render("ally", true);
        }
        sound.play("victory");
        for (const message of evolved) {
          await this.#say(message);
        }
      }
    }
    const next = this.#foes.find((creature) => creature.hp > 0);
    if (next) {
      this.#foe = next;
      this.#participants.clear();
      this.#participants.add(this.#ally);
      trainer.see(next.species);
      //Sending out their last Pokémon
      if (this.#foes.filter(({ hp }) => hp > 0).length === 1) {
        await this.#line("last");
      }
      await this.#say(`${this.#opponent!.name} sent out ${named(next)}!`, 400);
      this.#render("foe", true);
      await this.#enter(next);
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

  /** Ally fainted: switch or lose */
  async #allyFainted(): Promise<Outcome | null> {
    if (!trainer.lead) {
      await this.#say(`${trainer.profile!.name} is out of usable Pokémon!`);
      await this.#say(`${trainer.profile!.name} blacked out!`);
      return "lose";
    }
    await this.#switch(false);
    return null;
  }

  /** Switch active creature */
  async #switch(cancellable: boolean) {
    const party = trainer.profile!.party;
    const choice = await this.#menu<number>(
      [
        ...party.map((creature, i) => ({
          label: `${named(creature)} Lv${creature.level}`,
          value: i,
          detail: `HP ${creature.hp}/${hp(creature)}`,
          color: colors[species(creature.species).types[0]],
          disabled: creature.hp <= 0 || creature === this.#ally,
        })),
        ...(cancellable ? [{ label: "Back", value: -1, detail: "" }] : []),
      ],
      { columns: 2 },
    );
    if (choice < 0) {
      return false;
    }
    if (cancellable) {
      await this.#say(`Come back, ${named(this.#ally)}!`, 400);
    }
    //Natural Cure heals a condition when its Pokémon leaves the field
    if (abilityOf(this.#ally) === "natural-cure" && this.#ally.hp > 0) {
      cure(this.#ally);
    }
    this.#stages.delete(this.#ally);
    this.#ally = party[choice];
    this.#participants.add(this.#ally);
    this.#render("ally", true);
    await this.#say(`Go! ${named(this.#ally)}!`, 500);
    await this.#enter(this.#ally);
    return true;
  }

  /** Throw a ball (gen 3 catch formula, simplified) */
  async #throw(ball: ItemId) {
    await this.#say(`${trainer.profile!.name} threw ${/^[AEIOU]/i.test(items[ball].name) ? "an" : "a"} ${items[ball].name}!`, 300);
    let key = (this.view.ball?.key ?? 0) + 1;
    this.view.ball = { state: "throw", key };
    this.#emit();
    await wait(600);
    this.#fx("foe", "captured");
    const { a, b } = catchOdds(this.#foe, (items[ball] as { rate?: number }).rate ?? 1);
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
