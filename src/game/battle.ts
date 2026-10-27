//Imports
import { assets, type Move, species } from "./assets";
import { type Creature, grow, hp, named, stat, trainer } from "./trainer";
import { sound } from "./audio";

/** Battle outcome */
export type Outcome = "win" | "lose" | "run" | "caught";

/** Opponent trainer */
export type Opponent = { name: string; sprite: string; team: Creature[] };

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

/** Compute damage dealt by a move */
export function damage(attacker: Creature, defender: Creature, move: Move) {
  const physical = move.class === "physical";
  const attack = stat(attacker, physical ? 1 : 3), defense = stat(defender, physical ? 2 : 4);
  const critical = Math.random() < 1 / 16;
  const stab = species(attacker.species).types.includes(move.type) ? 1.5 : 1;
  const multiplier = effectiveness(move.type, defender);
  const base = Math.floor(Math.floor(Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack / defense) / 50) + 2;
  const value = multiplier === 0 ? 0 : Math.max(1, Math.floor(base * stab * multiplier * (critical ? 2 : 1) * (0.85 + Math.random() * 0.15)));
  return { value, critical, multiplier };
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
};

/** Catch formula values (gen 3, simplified): a >= 255 always catches, otherwise each shake passes when random * 65536 < b */
export function catchOdds(foe: Creature) {
  const max = hp(foe);
  const a = ((3 * max - 2 * foe.hp) * species(foe.species).capture) / (3 * max);
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

  /** Constructor */
  constructor({ wild, opponent = null }: { wild?: Creature; opponent?: Opponent | null }) {
    this.#opponent = opponent;
    this.#foes = opponent ? opponent.team : [wild!];
    this.#foe = this.#foes[0];
    this.#ally = trainer.lead!;
    const side = (creature: Creature): BattleSide => ({ creature, entered: 0, fx: "", fxKey: 0, info: false });
    this.view = { phase: "intro", foe: side(this.#foe), ally: side(this.#ally), log: "", menu: null, orb: null, ball: null };
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
        if ((!choices[index]) || (choices[index].disabled)) {
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
        if ((choices[index]) && (!choices[index].disabled)) {
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
  async start(): Promise<Outcome> {
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
      { label: "FIGHT", value: "fight", color: "#f05038" },
      { label: "BAG", value: "bag", color: "#f8b830" },
      { label: "POKéMON", value: "party", color: "#48d058" },
      { label: "RUN", value: "run", color: "#6890f0", disabled: Boolean(this.#opponent) },
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
            return { label: data?.name ?? key, value: i, detail: `${data?.type.toUpperCase()} · PP ${pp}/${data?.pp}`, color: colors[data?.type], disabled: pp <= 0 };
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
        const item = await this.#menu([
          { label: "Poké Ball", value: "ball", detail: `x${profile.bag.balls}`, color: "#f05038", disabled: (Boolean(this.#opponent)) || (profile.bag.balls <= 0) },
          { label: "Potion", value: "potion", detail: `x${profile.bag.potions} · +20 HP`, color: "#a040a0", disabled: (profile.bag.potions <= 0) || (this.#ally.hp >= hp(this.#ally)) },
          { label: "Back", value: "back", detail: "" },
        ]);
        if (item === "back") {
          return null;
        }
        if (item === "ball") {
          profile.bag.balls--;
          if (await this.#throw()) {
            return "caught";
          }
        } else {
          profile.bag.potions--;
          this.#ally.hp = Math.min(hp(this.#ally), this.#ally.hp + 20);
          this.#emit();
          await this.#say(`${named(this.#ally)} recovered some HP.`);
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
        const chance = (stat(this.#ally, 5) * 128) / Math.max(1, stat(this.#foe, 5)) / 256 + 0.3;
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
      const allyFirst = (move.priority > foeMove.priority) || ((move.priority === foeMove.priority) && (stat(this.#ally, 5) >= stat(this.#foe, 5)));
      order.push(...(allyFirst ? [["ally", move], ["foe", foeMove]] : [["foe", foeMove], ["ally", move]]) as ["ally" | "foe", Move][]);
    } else {
      order.push(["foe", foeMove]);
    }
    for (const [side, used] of order) {
      const outcome = await this.#attack(side, used);
      if (outcome !== undefined) {
        return outcome;
      }
    }
    return null;
  }

  /** Opponent move choice (weighted toward effective moves) */
  #pick(attacker: Creature, defender: Creature): Move {
    const usable = attacker.moves.filter(({ pp }) => pp > 0);
    if (!usable.length) {
      return struggle;
    }
    const weights = usable.map(({ key }) => {
      const move = assets.moves[key];
      return (move?.power ?? 40) * (effectiveness(move?.type, defender) || 0.1) * (species(attacker.species).types.includes(move?.type) ? 1.5 : 1);
    });
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    const index = weights.findIndex((weight) => (roll -= weight) <= 0);
    const chosen = usable[Math.max(0, index)];
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
    await this.#say(`${side === "foe" ? (this.#opponent ? "Foe " : "Wild ") : ""}${named(attacker)} used ${move.name}!`, 300);
    this.#fx(side, "lunge");
    await wait(250);

    if (Math.random() * 100 >= move.accuracy) {
      await this.#say(`${named(attacker)}'s attack missed!`);
      return;
    }
    const { value, critical, multiplier } = damage(attacker, defender, move);
    this.#projectile(side, move.type);
    await wait(350);
    sound.play(multiplier > 1 ? "hit2" : "hit");
    defender.hp = Math.max(0, defender.hp - value);
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

    if (defender.hp <= 0) {
      this.#fx(target, "fainted");
      await this.#say(`${side === "ally" ? (this.#opponent ? "Foe " : "Wild ") : ""}${named(defender)} fainted!`);
      return target === "foe" ? await this.#foeFainted() : await this.#allyFainted();
    }
    return;
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
    const total = Math.floor((base * this.#foe.level / 7) * (this.#opponent ? 1.5 : 1));
    const participants = [...this.#participants].filter((creature) => creature.hp > 0);
    for (const creature of participants) {
      const amount = Math.max(1, Math.floor(total / participants.length));
      await this.#say(`${named(creature)} gained ${amount} EXP. Points!`, 500);
      const messages = grow(creature, amount);
      if (creature === this.#ally) {
        this.#render("ally");
      }
      for (const message of messages) {
        if (message.includes("grew")) {
          sound.play("victory");
        }
        await this.#say(message);
      }
    }
    const next = this.#foes.find((creature) => creature.hp > 0);
    if (next) {
      this.#foe = next;
      this.#participants.clear();
      this.#participants.add(this.#ally);
      trainer.see(next.species);
      await this.#say(`${this.#opponent!.name} sent out ${named(next)}!`, 400);
      this.#render("foe", true);
      return null;
    }
    sound.play("victory");
    if (this.#opponent) {
      await this.#say(`You defeated ${this.#opponent.name}!`);
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
    const choice = await this.#menu<number>([
      ...party.map((creature, i) => ({
        label: `${named(creature)} Lv${creature.level}`,
        value: i,
        detail: `HP ${creature.hp}/${hp(creature)}`,
        color: colors[species(creature.species).types[0]],
        disabled: (creature.hp <= 0) || (creature === this.#ally),
      })),
      ...(cancellable ? [{ label: "Back", value: -1, detail: "" }] : []),
    ], { columns: 2 });
    if (choice < 0) {
      return false;
    }
    if (cancellable) {
      await this.#say(`Come back, ${named(this.#ally)}!`, 400);
    }
    this.#ally = party[choice];
    this.#participants.add(this.#ally);
    this.#render("ally", true);
    await this.#say(`Go! ${named(this.#ally)}!`, 500);
    return true;
  }

  /** Throw a Poké Ball (gen 3 catch formula, simplified) */
  async #throw() {
    await this.#say(`${trainer.profile!.name} threw a Poké Ball!`, 300);
    let key = (this.view.ball?.key ?? 0) + 1;
    this.view.ball = { state: "throw", key };
    this.#emit();
    await wait(600);
    this.#fx("foe", "captured");
    const { a, b } = catchOdds(this.#foe);
    let shakes = 0;
    while ((shakes < 4) && ((a >= 255) || (Math.random() * 65536 < b))) {
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
    await this.#say(["Oh no! The Pokémon broke free!", "Aww! It appeared to be caught!", "Aargh! Almost had it!", "Shoot! It was so close, too!"][Math.min(3, shakes)]);
    return false;
  }
}
