//Imports
import type { Action, City } from "./data";
import type { Target } from "./editor/constants";
import { edge, outdoors, type Placed, reachable as joined } from "./region";
import { questOf, stepLabel } from "./story";
import { flatten } from "./scripts";

/** Do two placed maps overlap */
function overlapping(a: Placed, b: Placed) {
  return a.x < b.x + b.map.width && b.x < a.x + a.map.width && a.y < b.y + b.map.height && b.y < a.y + a.map.height;
}

/** Something in a town that won't work as intended, and where to fix it */
export type Problem = {
  /** Errors break the game, warnings are probably mistakes */
  kind: "error" | "warning";
  text: string;
  /** Map it is on ("" = outside) */
  map: string;
  /** Layer to open to fix it */
  layer: Target;
  /** Tile to look at */
  at?: { x: number; y: number };
  /** Person, door, event or story step to select */
  npc?: number;
  door?: number;
  trigger?: number;
  step?: number;
};

/** Nothing written */
const silent = (text: string) => !text.trim();

/** Find what's broken in a city: doors, people, the spawn, encounter zones and the story */
export function problems(city: City, valid: (species: number) => boolean = () => true): Problem[] {
  const found = [] as Problem[];
  const maps = [city, ...city.interiors];
  const id = (map: City) => (map === city ? "" : map.id);
  const name = (map: City) => (map === city ? "outside" : `in ${map.name}`);
  const exists = (to: string) => to === "" || city.interiors.some((map) => map.id === to);

  //Doors
  for (const map of maps) {
    map.doors.forEach((door, index) => {
      if (door.to === "?") {
        found.push({
          kind: "error",
          text: `Door at ${door.x}, ${door.y} ${name(map)} doesn't lead anywhere yet`,
          map: id(map),
          layer: "door",
          at: door,
          door: index,
        });
      } else if (!exists(door.to)) {
        found.push({
          kind: "error",
          text: `Door at ${door.x}, ${door.y} ${name(map)} leads to a deleted map`,
          map: id(map),
          layer: "door",
          at: door,
          door: index,
        });
      }
    });
  }
  //Outdoor maps: reached by walking across an edge open on both sides (or through a door)
  const walk = joined(city);
  const placed = outdoors(city);
  for (const room of city.interiors.filter(({ outdoor }) => outdoor)) {
    const self = placed.find(({ map }) => map === room)!;
    const other = placed.find((item) => item.map !== room && overlapping(self, item));
    if (other) {
      found.push({
        kind: "error",
        text: `${room.name} overlaps ${other.map === city ? "the outside map" : other.map.name} in the region map`,
        map: room.id,
        layer: "door",
      });
      continue;
    }
    if (walk.has(room) || maps.some((map) => map.doors.some(({ to }) => to === room.id))) {
      continue;
    }
    const touching = placed.map((item) => ({ item, shared: edge(self, item) })).find(({ item, shared }) => item.map !== room && shared);
    if (touching) {
      const middle = touching.shared!.tiles[Math.floor(touching.shared!.tiles.length / 2)];
      found.push({
        kind: "warning",
        text: `Nobody can walk into ${room.name}: the edge it shares with ${touching.item.map === city ? "the outside map" : touching.item.map.name} is blocked all along. Open a gap in the trees or walls on both sides`,
        map: room.id,
        layer: "solid",
        at: middle,
      });
    } else {
      found.push({ kind: "warning", text: `${room.name} isn't joined to any other map. Move it next to one in the region map`, map: room.id, layer: "door" });
    }
  }
  for (const room of city.interiors.filter(({ outdoor }) => !outdoor)) {
    if (!maps.some((map) => map.doors.some(({ to }) => to === room.id))) {
      found.push({ kind: "warning", text: `Nobody can get into ${room.name}: no door leads to it`, map: "", layer: "door" });
    } else if (!room.doors.some(({ to }) => to !== "?" && to !== room.id && exists(to))) {
      found.push({ kind: "error", text: `${room.name} has no door back out`, map: room.id, layer: "door", at: room.spawn });
    }
  }

  //People, Pokémon and signs
  for (const map of maps) {
    map.npcs.forEach((npc, index) => {
      const at = { x: npc.x, y: npc.y };
      const who = npc.name || (npc.creature ? "A Pokémon" : npc.sprite ? "Someone" : "A sign");
      if (npc.role === "trainer" && !npc.trainer?.team.length) {
        found.push({ kind: "error", text: `${who} is a trainer with no Pokémon`, map: id(map), layer: "npc", at, npc: index });
      } else if (npc.creature && !valid(npc.creature.species)) {
        found.push({ kind: "error", text: `${who} at ${at.x}, ${at.y} isn't a real Pokémon`, map: id(map), layer: "npc", at, npc: index });
      } else if (npc.role === "item" && !npc.gift?.count) {
        found.push({ kind: "error", text: `Item at ${at.x}, ${at.y} holds nothing`, map: id(map), layer: "npc", at, npc: index });
      } else if (["talk", "healer"].includes(npc.role) && silent(npc.dialogue) && !npc.script?.actions.length) {
        found.push({
          kind: "warning",
          text: npc.sprite || npc.creature ? `${who} at ${at.x}, ${at.y} has nothing to say` : `Sign at ${at.x}, ${at.y} is blank`,
          map: id(map),
          layer: "npc",
          at,
          npc: index,
        });
      }
    });
  }

  //Scripts: of people, and of event areas
  const known = new Set(city.story.map(({ id }) => id));
  const check = (map: City, actions: Action[], where: string, focus: Pick<Problem, "layer" | "at" | "npc" | "trigger">) => {
    const issue = flatten(actions)
      .map((action): string | null => {
        const someone = "who" in action && typeof action.who === "number" ? map.npcs[action.who] : undefined;
        if ("who" in action && typeof action.who === "number" && (!someone || someone.role === "item")) {
          return "is about someone who isn't on the map anymore";
        }
        if (action.do === "battle" && !(someone?.role === "trainer" && someone.trainer?.team.length) && someone?.role !== "wild") {
          return "battles someone who isn't a trainer";
        }
        if (action.do === "step" && !known.has(action.step)) {
          return action.step ? "completes a story step that was deleted" : "completes a story step that isn't chosen";
        }
        if (action.do === "warp" && !exists(action.to)) {
          return "warps to a deleted map";
        }
        if (action.do === "if" && action.check.has === "step" && !known.has(action.check.step)) {
          return "checks a story step that was deleted";
        }
        return null;
      })
      .find(Boolean);
    if (issue) {
      found.push({ kind: "warning", text: `${where} ${issue}`, map: id(map), ...focus });
    }
  };
  for (const map of maps) {
    map.npcs.forEach((npc, index) => {
      if (npc.script) {
        const at = { x: npc.x, y: npc.y };
        check(map, npc.script.actions, `The script of ${npc.name || "someone"} at ${at.x}, ${at.y}`, { layer: "npc", at, npc: index });
      }
    });
    map.triggers.forEach((trigger, index) => {
      const at = { x: trigger.x, y: trigger.y };
      const focus = { layer: "event" as const, at, trigger: index };
      if (!trigger.actions.length) {
        found.push({ kind: "warning", text: `Event "${trigger.name || "Event"}" ${name(map)} does nothing yet`, map: id(map), ...focus });
      } else if ((trigger.after && !known.has(trigger.after)) || (trigger.until && !known.has(trigger.until))) {
        found.push({ kind: "warning", text: `Event "${trigger.name || "Event"}" ${name(map)} uses a story step that was deleted`, map: id(map), ...focus });
      } else {
        check(map, trigger.actions, `Event "${trigger.name || "Event"}" ${name(map)}`, focus);
      }
    });
  }

  //Where visitors arrive
  const { spawn } = city;
  if (spawn.x < 0 || spawn.y < 0 || spawn.x >= city.width || spawn.y >= city.height) {
    found.push({ kind: "error", text: "Visitors arrive outside the map", map: "", layer: "spawn" });
  } else if (city.solid[spawn.y * city.width + spawn.x]) {
    found.push({ kind: "error", text: `Visitors arrive on a blocked tile (${spawn.x}, ${spawn.y})`, map: "", layer: "spawn", at: spawn });
  }

  //Encounter zones painted without Pokémon
  city.zones.forEach((zone, z) => {
    if (zone.creatures.length) {
      return;
    }
    for (const map of maps) {
      const index = map.zone.indexOf(z + 1);
      if (index >= 0) {
        found.push({
          kind: "warning",
          text: `Encounter zone "${zone.name}" is painted but has no Pokémon`,
          map: id(map),
          layer: "zone",
          at: { x: index % map.width, y: Math.floor(index / map.width) },
        });
        break;
      }
    }
  });

  //Story: a step can happen once someone who completes it can be met (they appear and help only after steps that can happen)
  const steps = new Set(city.story.map(({ id }) => id));
  const people = maps.flatMap((map) => map.npcs.map((npc, index) => ({ npc, index, map })));
  //Who completes each step, and what they wait for: people (by talking, or in their script) and event areas
  const steps_ = (actions: Action[]) => flatten(actions).flatMap((action) => (action.do === "step" && action.step ? [action.step] : []));
  const completers = [
    ...people.flatMap(({ npc }) =>
      [npc.story?.completes, ...steps_(npc.script?.actions ?? [])]
        .filter((step): step is string => Boolean(step))
        .map((step) => ({ step, needs: [npc.story?.after, npc.story?.requires] })),
    ),
    ...maps.flatMap((map) => map.triggers.flatMap((trigger) => steps_(trigger.actions).map((step) => ({ step, needs: [trigger.after] })))),
  ];
  const reachable = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const { step: completes, needs } of completers) {
      if (reachable.has(completes)) {
        continue;
      }
      //A side quest's steps also wait until the quest starts
      const step = city.story.find(({ id }) => id === completes);
      const start = step ? questOf(city, step)?.after : undefined;
      if (needs.every((need) => !need || reachable.has(need)) && (!start || reachable.has(start))) {
        reachable.add(completes);
        changed = true;
      }
    }
  }
  city.story.forEach((step) => {
    if (reachable.has(step.id)) {
      return;
    }
    const completer = completers.some(({ step: completes }) => completes === step.id);
    const start = questOf(city, step)?.after;
    const why = !completer
      ? "nobody completes it"
      : start && !reachable.has(start)
        ? "its side quest starts after a step that never happens"
        : "whoever completes it waits for a step that never happens";
    found.push({ kind: "error", text: `Story step ${stepLabel(city, step)} can never happen: ${why}`, map: "", layer: "story", step: step.n });
  });
  for (const quest of city.quests) {
    if (!city.story.some((step) => step.quest === quest.id)) {
      found.push({ kind: "warning", text: `Side quest "${quest.name}" has no steps yet`, map: "", layer: "story" });
    }
  }
  for (const { npc, index, map } of people) {
    const missing = (["after", "until", "requires", "completes"] as const).filter((key) => npc.story?.[key] && !steps.has(npc.story[key]!));
    if (missing.length) {
      found.push({
        kind: "warning",
        text: `${npc.name || "Someone"} at ${npc.x}, ${npc.y} uses a story step that was deleted`,
        map: id(map),
        layer: "npc",
        at: { x: npc.x, y: npc.y },
        npc: index,
      });
    }
  }
  const numbers = new Set(city.story.map(({ n }) => n));
  for (const map of maps) {
    const index = map.gate.findIndex((n) => n && !numbers.has(n));
    if (index >= 0) {
      found.push({
        kind: "warning",
        text: `Gate tiles ${name(map)} belong to a deleted story step and block the way forever`,
        map: id(map),
        layer: "story",
        at: { x: index % map.width, y: Math.floor(index / map.width) },
      });
    }
  }

  return found.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "error" ? -1 : 1));
}
