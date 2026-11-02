/**
 * Event scripts: small cutscenes run by people when talked to, and by triggers when stepped in.
 * A script is a list of actions run in order (see `Action` in data.ts); play mode runs them.
 */

//Imports
import type { Action, ActionKind, City, Direction, Who } from "./data";
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
  money: { label: "Give money", hint: "Add money", make: () => ({ do: "money", amount: 500 }) },
  heal: { label: "Heal", hint: "Heal the party", make: () => ({ do: "heal" }) },
  step: { label: "Story step", hint: "Complete a story step", make: () => ({ do: "step", step: "" }) },
  warp: { label: "Warp", hint: "Take the player to another map (ends the script)", make: () => ({ do: "warp", to: "", x: 0, y: 0 }) },
};

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
      case "money":
        return [{ do: "money", amount: int(a.amount, 0, 999999) }];
      case "heal":
        return [{ do: "heal" }];
      case "step":
        return [{ do: "step", step: `${a.step ?? ""}` }];
      case "warp":
        return [{ do: "warp", to: `${a.to ?? ""}`, x: int(a.x, 0, 999), y: int(a.y, 0, 999) }];
      default:
        return [];
    }
  });
}

/** Does an action involve someone of the map */
export function actor(action: Action): number | null {
  return "who" in action && typeof action.who === "number" ? action.who : null;
}

/** Every script of a map: those of its people, and those of its triggers */
export function scripts(city: City) {
  return [...city.npcs.flatMap(({ script }) => (script ? [script.actions] : [])), ...city.triggers.map(({ actions }) => actions)];
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
