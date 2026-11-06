/**
 * Event scripts: small cutscenes run by people when talked to, and by triggers when stepped in.
 * A script is a list of actions run in order (see `Action` in data.ts); play mode runs them.
 */

//Imports
import type { Action, ActionKind, Check, City, Direction, Who } from "./data";
import { isItem } from "./items";

/** Directions */
const directions = ["up", "down", "left", "right"] as const;

/** Every kind of action: its name in the editor, what it does, and a new one */
export const kinds: Record<ActionKind, { label: string; hint: string; make: () => Action }> = {
  say: { label: "Say", hint: "Show a message", make: () => ({ do: "say", text: "" }) },
  come: { label: "Walk up", hint: "Notice the player and walk up to them", make: () => ({ do: "come", who: 0 }) },
  move: { label: "Walk", hint: "Walk some steps", make: () => ({ do: "move", who: "player", steps: ["up"] }) },
  face: { label: "Face", hint: "Turn to face a direction", make: () => ({ do: "face", who: "player", dir: "down" }) },
  back: { label: "Walk back", hint: "Walk back to where they stand on the map", make: () => ({ do: "back", who: 0 }) },
  wait: { label: "Wait", hint: "Pause for a moment", make: () => ({ do: "wait", seconds: 1 }) },
  battle: { label: "Battle", hint: "Battle a trainer (stops if the player loses)", make: () => ({ do: "battle", who: 0 }) },
  give: { label: "Give item", hint: "Put an item in the bag", make: () => ({ do: "give", item: "potion", count: 1 }) },
  pokemon: { label: "Give Pokémon", hint: "Add a Pokémon to the party", make: () => ({ do: "pokemon", species: 25, level: 5 }) },
  starter: {
    label: "Choose a starter",
    hint: "The player picks one of a few Pokémon, like the Professor's bag",
    make: () => ({ do: "starter", species: [252, 255, 258], level: 5 }),
  },
  money: { label: "Give money", hint: "Add money", make: () => ({ do: "money", amount: 500 }) },
  heal: { label: "Heal", hint: "Heal the party", make: () => ({ do: "heal" }) },
  step: { label: "Story step", hint: "Complete a story step", make: () => ({ do: "step", step: "" }) },
  warp: { label: "Warp", hint: "Take the player to another map (ends the script)", make: () => ({ do: "warp", to: "", x: 0, y: 0 }) },
  ask: { label: "Ask Yes/No", hint: "Ask a question, then do something for each answer", make: () => ({ do: "ask", text: "", yes: [], no: [] }) },
  if: {
    label: "If…",
    hint: "Check an item, a step, money, a Pokémon or badges, then do one thing or another",
    make: () => ({ do: "if", check: { has: "item", item: "potion", count: 1 }, then: [], else: [] }),
  },
  take: { label: "Take item", hint: "Take items from the bag (a trade, a toll)", make: () => ({ do: "take", item: "potion", count: 1 }) },
};

/** Every kind of check, with its name in the editor and a new one */
export const checks: Record<Check["has"], { label: string; make: () => Check }> = {
  item: { label: "Has an item", make: () => ({ has: "item", item: "potion", count: 1 }) },
  step: { label: "Did a story step", make: () => ({ has: "step", step: "" }) },
  money: { label: "Has money", make: () => ({ has: "money", amount: 500 }) },
  pokemon: { label: "Has a Pokémon in the party", make: () => ({ has: "pokemon", species: 25 }) },
  badges: { label: "Has badges", make: () => ({ has: "badges", count: 1 }) },
};

/** A valid check (null when it can't be read) */
function check(raw: unknown): Check | null {
  const c = raw as Record<string, unknown>;
  switch (c?.has) {
    case "item":
      return isItem(`${c.item}`) ? { has: "item", item: c.item as Extract<Check, { has: "item" }>["item"], count: int(c.count, 1, 999) } : null;
    case "step":
      return { has: "step", step: `${c.step ?? ""}` };
    case "money":
      return { has: "money", amount: int(c.amount, 0, 999999) };
    case "pokemon":
      return { has: "pokemon", species: int(c.species, 1, 100000) };
    case "badges":
      return { has: "badges", count: int(c.count, 0, 99) };
    default:
      return null;
  }
}

/** Clamp a number */
function int(value: unknown, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

/** Someone of the map, or the player */
function who(value: unknown, player = true): Who | null {
  if (player && value === "player") {
    return "player";
  }
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

/** Direction (down when not one) */
function direction(value: unknown): Direction {
  return directions.includes(value as Direction) ? (value as Direction) : "down";
}

/** Valid actions of an imported script (unknown ones are dropped) */
export function actions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.slice(0, 100).flatMap((action): Action[] => {
    const a = action as Record<string, unknown>;
    switch (a?.do) {
      case "say": {
        const by = who(a.who, false);
        return [{ do: "say", text: `${a.text ?? ""}`.slice(0, 1000), ...(by !== null ? { who: by as number } : {}) }];
      }
      case "move": {
        const by = who(a.who);
        const steps = Array.isArray(a.steps) ? a.steps.filter((step) => directions.includes(step)).slice(0, 50) : [];
        return by === null ? [] : [{ do: "move", who: by, steps }];
      }
      case "face": {
        const by = who(a.who);
        return by === null ? [] : [{ do: "face", who: by, dir: direction(a.dir) }];
      }
      case "come":
      case "back":
      case "battle": {
        const by = who(a.who, false);
        return by === null ? [] : [{ do: a.do, who: by as number }];
      }
      case "wait":
        return [{ do: "wait", seconds: Math.max(0, Math.min(10, Number(a.seconds) || 0)) }];
      case "give":
        return isItem(`${a.item}`) ? [{ do: "give", item: a.item as Extract<Action, { do: "give" }>["item"], count: int(a.count, 1, 99) }] : [];
      case "pokemon":
        return [{ do: "pokemon", species: int(a.species, 1, 100000), level: int(a.level, 1, 100) }];
      case "starter": {
        const choices = (Array.isArray(a.species) ? a.species : []).slice(0, 6).map((id: unknown) => int(id, 1, 100000));
        return choices.length ? [{ do: "starter", species: choices, level: int(a.level, 1, 100) }] : [];
      }
      case "money":
        return [{ do: "money", amount: int(a.amount, -999999, 999999) }];
      case "heal":
        return [{ do: "heal" }];
      case "step":
        return [{ do: "step", step: `${a.step ?? ""}` }];
      case "warp":
        return [{ do: "warp", to: `${a.to ?? ""}`, x: int(a.x, 0, 999), y: int(a.y, 0, 999) }];
      case "ask": {
        const by = who(a.who, false);
        return [{ do: "ask", text: `${a.text ?? ""}`.slice(0, 1000), ...(by !== null ? { who: by as number } : {}), yes: actions(a.yes), no: actions(a.no) }];
      }
      case "if": {
        const valid = check(a.check);
        return valid ? [{ do: "if", check: valid, then: actions(a.then), else: actions(a.else) }] : [];
      }
      case "take":
        return isItem(`${a.item}`) ? [{ do: "take", item: a.item as Extract<Action, { do: "take" }>["item"], count: int(a.count, 1, 99) }] : [];
      default:
        return [];
    }
  });
}

/** Does an action involve someone of the map */
export function actor(action: Action): number | null {
  return "who" in action && typeof action.who === "number" ? action.who : null;
}

/** The lists of actions inside an action (the answers of a question, the two sides of a check) */
export function branches(action: Action): Action[][] {
  return action.do === "ask" ? [action.yes, action.no] : action.do === "if" ? [action.then, action.else] : [];
}

/** Every action of a list, those inside questions and checks included */
export function flatten(list: Action[]): Action[] {
  return list.flatMap((action) => [action, ...branches(action).flatMap(flatten)]);
}

/** Every list of actions of a map: the scripts of its people and of its triggers, and every list inside them */
export function scripts(city: City) {
  const lists = (list: Action[]): Action[][] => [list, ...list.flatMap((action) => branches(action).flatMap(lists))];
  return [...city.npcs.flatMap(({ script }) => (script ? lists(script.actions) : [])), ...city.triggers.flatMap(({ actions }) => lists(actions))];
}

/** Someone was removed from a map: actions about them are dropped, and those about people after them follow their new index */
export function reindex(city: City, removed: number) {
  for (const list of scripts(city)) {
    for (let i = list.length - 1; i >= 0; i--) {
      const action = list[i];
      const index = actor(action);
      if (index === null || index < removed) {
        continue;
      }
      if (index === removed) {
        //A message keeps its text as narration
        if (action.do === "say") {
          delete action.who;
        } else {
          list.splice(i, 1);
        }
      } else {
        (action as { who: number }).who = index - 1;
      }
    }
  }
}

/** Direction arrows */
export const arrows = { up: "↑", down: "↓", left: "←", right: "→" } as const;

/** Does a game let the player choose a starter itself: then new trainers start without a partner, and get one from it */
export function handsOutStarter(city: City) {
  return [city, ...city.interiors].some((map) => scripts(map).some((list) => list.some(({ do: kind }) => kind === "starter")));
}
