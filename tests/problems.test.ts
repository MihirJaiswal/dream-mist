// @vitest-environment node
import { describe, expect, test } from "vitest";
import { blank, type Npc } from "@/game/data";
import { problems } from "@/game/problems";

const person = (npc: Partial<Npc>) => ({ x: 1, y: 1, sprite: "youngster", dir: "down", name: "Bob", dialogue: "Hi", role: "talk", wander: false, ...npc }) as Npc;
const texts = (city: ReturnType<typeof blank>) => problems(city).map(({ text }) => text);

describe("problems", () => {
  test("a fresh town has none", () => {
    const city = blank();
    city.zones = [];
    expect(problems(city)).toEqual([]);
  });

  test("doors that lead nowhere or to deleted maps", () => {
    const city = blank();
    city.doors = [{ x: 12, y: 8, to: "?", tx: -1, ty: -1 }, { x: 3, y: 3, to: "gone", tx: -1, ty: -1 }];
    expect(texts(city)).toEqual(expect.arrayContaining(["Door at 12, 8 outside doesn't lead anywhere yet", "Door at 3, 3 outside leads to a deleted map"]));
    expect(problems(city)[0]).toMatchObject({ kind: "error", layer: "door", door: 0, at: { x: 12, y: 8 } });
  });

  test("interiors with no way in or no way out", () => {
    const city = blank();
    const house = { ...blank({ width: 8, height: 6, name: "House" }), id: "house" };
    city.interiors = [house];
    expect(texts(city)).toContain("Nobody can get into House: no door leads to it");
    city.doors = [{ x: 5, y: 5, to: "house", tx: -1, ty: -1 }];
    expect(texts(city)).toContain("House has no door back out");
    house.doors = [{ x: 4, y: 5, to: "", tx: -1, ty: -1 }];
    expect(texts(city).filter((text) => text.includes("House"))).toEqual([]);
  });

  test("silent people, blank signs and trainers without Pokémon", () => {
    const city = blank();
    city.npcs = [
      person({ name: "Nurse", role: "healer", dialogue: " " }),
      person({ sprite: "", name: "Sign", dialogue: "", x: 4, y: 2 }),
      person({ name: "Joey", role: "trainer", trainer: { team: [], gym: false, badge: "", defeat: "" } }),
    ];
    expect(texts(city)).toEqual(expect.arrayContaining(["Nurse at 1, 1 has nothing to say", "Sign at 4, 2 is blank", "Joey is a trainer with no Pokémon"]));
  });

  test("spawn on a blocked tile", () => {
    const city = blank({ width: 10, height: 10 });
    city.spawn = { x: 2, y: 3 };
    city.solid[3 * 10 + 2] = 1;
    expect(texts(city)).toContain("Visitors arrive on a blocked tile (2, 3)");
  });

  test("encounter zones painted without Pokémon", () => {
    const city = blank({ width: 10, height: 10 });
    city.zones[0].creatures = [];
    city.zone[25] = 1;
    expect(problems(city)).toEqual([expect.objectContaining({ layer: "zone", at: { x: 5, y: 2 } })]);
  });

  test("story steps that can never happen", () => {
    const city = blank();
    city.zones = [];
    city.story = [{ id: "a", n: 1, name: "Get the parcel", blocked: "" }, { id: "b", n: 2, name: "Deliver it", blocked: "" }, { id: "c", n: 3, name: "Lost step", blocked: "" }];
    city.npcs = [
      person({ name: "Clerk", story: { completes: "a" } }),
      person({ name: "Prof", story: { requires: "a", completes: "b" } }),
      person({ name: "Ghost", story: { after: "c", completes: "c" } }),
    ];
    expect(texts(city)).toEqual(['Story step "Lost step" can never happen: whoever completes it waits for a step that never happens']);
    city.npcs.pop();
    expect(texts(city)).toEqual(['Story step "Lost step" can never happen: nobody completes it']);
  });

  test("side quests that start after a step that never happens, or have no steps", () => {
    const city = blank();
    city.zones = [];
    city.story = [{ id: "a", n: 1, name: "Lost step", blocked: "" }, { id: "k", n: 2, name: "Find Skitty", blocked: "", quest: "q" }];
    city.quests = [{ id: "q", name: "Lost kitten", after: "a" }, { id: "e", name: "Empty" }];
    city.npcs = [person({ name: "Girl", story: { completes: "k" } })];
    expect(texts(city)).toEqual([
      'Story step "Lost step" can never happen: nobody completes it',
      'Story step "Find Skitty" (Lost kitten) can never happen: its side quest starts after a step that never happens',
      'Side quest "Empty" has no steps yet',
    ]);
  });

  test("gates and people left from deleted steps", () => {
    const city = blank({ width: 10, height: 10 });
    city.zones = [];
    city.gate[11] = 7;
    city.npcs = [person({ story: { until: "deleted" } })];
    expect(texts(city)).toEqual(expect.arrayContaining(["Gate tiles outside belong to a deleted story step and block the way forever", "Bob at 1, 1 uses a story step that was deleted"]));
  });

  test("errors come before warnings", () => {
    const city = blank();
    city.npcs = [person({ dialogue: "" }), person({ role: "trainer", trainer: { team: [], gym: false, badge: "", defeat: "" } })];
    expect(problems(city).map(({ kind }) => kind)).toEqual(["error", "warning"]);
  });
});
