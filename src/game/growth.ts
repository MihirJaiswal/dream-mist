/**
 * Pokémon growing up with the player, like the games: learning a fifth move (the player picks the one to forget),
 * and evolving on the evolution screen (B stops it) after a battle, a Rare Candy or an evolution stone.
 */

//Imports
import { assets, species } from "./assets";
import { period } from "./atmosphere";
import type { Daytime } from "./atmosphere";
import { type ItemId, items } from "./items";
import { type Cause, type Creature, cure, evolution, evolve, evolvesWith, hp, named, replaceMove, shed, trainer } from "./trainer";
import { ui } from "./ui-bridge";

/** How the game talks to the player: the battle's text box, or the dialogue box on the map */
export type Talk = {
  say(text: string): Promise<void>;
  ask(text: string): Promise<boolean>;
  /** Pick one of a few answers (the last one is the way out): resolves with its index */
  pick(text: string, choices: string[]): Promise<number>;
};

/** Talking on the map */
export const field: Talk = {
  say: (text) => ui.say(text),
  ask: (text) => ui.ask(text),
  pick: (text, choices) => ui.choose(text, choices),
};

/** Does a move deal damage */
const damaging = (key: string) => (assets.moves[key]?.power ?? 0) > 0;

/** Teach a move a Pokémon that knows four wants to learn: the player picks one to forget, or gives up on it (resolves true when learned) */
export async function teach(creature: Creature, key: string, talk: Talk) {
  const name = named(creature);
  const move = assets.moves[key]?.name ?? key;
  for (;;) {
    await talk.say(`${name} wants to learn the move ${move}.\n\nHowever, ${name} already knows four moves.`);
    if (await talk.ask(`Should a move be deleted and replaced with ${move}?`)) {
      const choices = [...creature.moves.map((known) => assets.moves[known.key]?.name ?? known.key), move];
      const index = await talk.pick(`Which move should be forgotten?`, choices);
      const old = creature.moves[index];
      //It always keeps a move that deals damage
      if (old && damaging(old.key) && !damaging(key) && creature.moves.filter((other) => damaging(other.key)).length === 1) {
        await talk.say(`${name} can't forget its last attacking move!`);
        continue;
      }
      if (old) {
        const forgotten = replaceMove(creature, index, key);
        await talk.say(`1, 2, and… … … Poof!\n\n${name} forgot ${forgotten}.\n\nAnd… ${name} learned ${move}!`);
        return true;
      }
    }
    if (await talk.ask(`Stop trying to teach ${move}?`)) {
      await talk.say(`${name} did not learn the move ${move}.`);
      return false;
    }
  }
}

/** Teach every move that waited */
export async function teachAll(creature: Creature, pending: string[], talk: Talk) {
  for (const key of pending) {
    await teach(creature, key, talk);
  }
}

/** Cause of evolving by leveling up now, at the map's time of day */
export function leveling(time?: Daytime): Cause {
  return { level: true, time: period(time), party: trainer.profile?.party ?? [] };
}

/**
 * Evolve a Pokémon that's ready to, on the evolution screen (the player can stop it with B unless it's from an item).
 * Then it learns its new form's moves, and Nincada leaves a Shedinja behind. Resolves true when it evolved
 */
export async function evolveIfReady(creature: Creature, cause: Cause) {
  const way = evolution(creature, cause);
  const profile = trainer.profile;
  if (!way || !profile) {
    return false;
  }
  const from = creature.species;
  if (!(await ui.evolve(creature, way.into, { cancel: "level" in cause }))) {
    return false;
  }
  const shedinja = "level" in cause ? shed(creature, profile.party, (id) => trainer.count(id)) : null;
  const pending = [] as string[];
  const messages = evolve(creature, way, pending);
  trainer.see(way.into);
  if (!profile.caught.includes(way.into)) {
    profile.caught.push(way.into);
  }
  //The screen showed the congratulations already
  for (const message of messages.slice(1)) {
    await ui.say(message);
  }
  await teachAll(creature, pending, field);
  if (shedinja && trainer.take("poke-ball")) {
    profile.party.push(shedinja);
    trainer.see(shedinja.species);
    if (!profile.caught.includes(shedinja.species)) {
      profile.caught.push(shedinja.species);
    }
    await ui.say(`Something appeared in the empty Poké Ball… It's ${species(shedinja.species).name}!`);
  }
  trainer.save();
  return from !== creature.species;
}

/** After a battle: the Pokémon that grew a level evolve if they're ready (fainted ones wait) */
export async function evolveGrown(creatures: Iterable<Creature>, time?: Daytime) {
  for (const creature of creatures) {
    if (creature.hp > 0 && trainer.profile?.party.includes(creature)) {
      await evolveIfReady(creature, leveling(time));
    }
  }
}

/** Does an item do something for a Pokémon now: restore its HP, cure its condition, revive it, raise its level, evolve it */
export function helps(id: ItemId, creature: Creature) {
  const item = items[id] as { kind: string; cures?: string };
  const cured = Boolean(creature.status) && (item.cures === "all" || item.cures === creature.status);
  switch (item.kind) {
    case "heal":
      return creature.hp > 0 && (creature.hp < hp(creature) || cured);
    case "cure":
      return creature.hp > 0 && cured;
    case "revive":
      return creature.hp <= 0;
    case "candy":
      return creature.level < 100;
    case "evolve":
      return evolvesWith(creature, id);
  }
  return false;
}

/** Use a healing item on a Pokémon (potions, cures, revives): returns what the game says */
export function apply(id: ItemId, creature: Creature) {
  const item = items[id] as { kind: string; amount?: number; cures?: string };
  const name = named(creature);
  if (item.kind === "revive") {
    creature.hp = Math.max(1, Math.floor(hp(creature) * (item.amount ?? 0.5)));
    return `${name} was revived!`;
  }
  const before = creature.hp;
  if (item.kind === "heal") {
    creature.hp = Math.min(hp(creature), creature.hp + (item.amount ?? 0));
  }
  if (item.cures && creature.status && (item.cures === "all" || item.cures === creature.status)) {
    cure(creature);
    if (creature.hp === before) {
      return `${name} is healthy again!`;
    }
  }
  return `${name}'s HP was restored by ${creature.hp - before} points.`;
}

/** Offer to nickname a Pokémon the player just got (caught, or received) */
export async function nickname(creature: Creature, talk: Talk = field, how: "caught" | "received" = "caught") {
  const name = species(creature.species)?.name ?? "";
  if (await talk.ask(`Give a nickname to the ${how} ${name}?`)) {
    const chosen = (await ui.name(`${name}'s nickname?`, { creature })).trim().slice(0, 12);
    if (chosen && chosen !== name) {
      creature.nickname = chosen;
    }
  }
}
