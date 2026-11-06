/**
 * Story lanes: the main story and side quests, each a chain of steps in the city's `story` list.
 * Progress is the set of step ids a player completed, so lanes only change how steps are grouped,
 * what the Journal shows, and when a side quest's steps can happen.
 */

//Imports
import type { City, Quest, Step } from "./data";

/** A lane of the timeline: the main story (quest null) or a side quest, with its steps in order */
export type Lane = { quest: Quest | null; steps: Step[] };

/** Is a step done by the player */
export type Done = (step: string) => boolean;

/** Side quest a step belongs to (null for the main story, and for steps of a deleted quest) */
export function questOf(city: City, step: Step) {
  return step.quest ? (city.quests.find(({ id }) => id === step.quest) ?? null) : null;
}

/** Main story first, then every side quest */
export function lanes(city: City): Lane[] {
  return [
    { quest: null, steps: city.story.filter((step) => !questOf(city, step)) },
    ...city.quests.map((quest) => ({ quest, steps: city.story.filter((step) => step.quest === quest.id) })),
  ];
}

/** Steps of the same lane as a step, in order */
export function laneOf(city: City, step: Step) {
  const quest = questOf(city, step);
  return city.story.filter((other) => questOf(city, other) === quest);
}

/** Short name of a step and where it is: "Meet the Professor" (main story), "Find Skitty" (Lost kitten) */
export function stepLabel(city: City, step: Step) {
  const quest = questOf(city, step);
  return quest ? `"${step.name}" (${quest.name})` : `"${step.name}"`;
}

/** What the Journal says to do for a step */
export function goal(step: Step) {
  return step.goal?.trim() || step.name;
}

/** Can a step happen yet (a side quest's steps wait until it starts) */
export function open(city: City, step: Step, done: Done) {
  const after = questOf(city, step)?.after;
  return !after || done(after);
}

/** Journal entry of a lane */
export type Entry = {
  quest: Quest | null;
  name: string;
  /** Next step to do (none once the lane is complete) */
  next: Step | null;
  done: number;
  total: number;
};

/** What the Journal shows: the main story, side quests in progress, and completed side quests (not started ones stay secret) */
export function journal(city: City, done: Done) {
  const entries = lanes(city)
    .filter(({ steps }) => steps.length)
    .map(({ quest, steps }): Entry => ({
      quest,
      name: quest?.name ?? "Main story",
      next: steps.find(({ id }) => !done(id)) ?? null,
      done: steps.filter(({ id }) => done(id)).length,
      total: steps.length,
    }));
  const side = entries.filter(({ quest, done }) => quest && done);
  return {
    main: entries.find(({ quest }) => !quest) ?? null,
    active: side.filter(({ next }) => next),
    complete: side.filter(({ next }) => !next),
  };
}

/** Banner shown when a step is completed (call after marking it done) */
export function milestone(city: City, step: Step, done: Done): { title: string; text: string; kind: "story" | "quest" } {
  const quest = questOf(city, step);
  const steps = laneOf(city, step);
  const next = steps.find(({ id }) => !done(id));
  const then = next ? `Next: ${goal(next)}` : "";
  if (!quest) {
    //A story of one step (the starter town's) isn't over yet: it has only begun
    return { kind: "story", title: step.name, text: then || (steps.length > 1 ? "The main story is complete!" : "Story step complete!") };
  }
  const count = steps.filter(({ id }) => done(id)).length;
  if (!next) {
    return { kind: "quest", title: `Quest complete: ${quest.name}`, text: step.name };
  }
  return { kind: "quest", title: count === 1 ? `New quest: ${quest.name}` : quest.name, text: then };
}
