// @vitest-environment node
import { describe, expect, test } from "vitest";
import { arrow, ICE, ledge, slippery, WATER } from "@/game/behaviors";
import { blank, type Npc, resize, sanitize } from "@/game/data";
import { problems } from "@/game/problems";
import { actions, reindex } from "@/game/scripts";

const person = (npc: Partial<Npc>) =>
  ({ x: 1, y: 1, sprite: "youngster", dir: "down", name: "Bob", dialogue: "Hi", role: "talk", wander: false, ...npc }) as Npc;
const texts = (city: ReturnType<typeof blank>) => problems(city).map(({ text }) => text);

describe("tile behaviors", () => {
  test("ledges and push tiles have a direction, ice and push tiles keep the player moving", () => {
    expect([1, 2, 3, 4].map(ledge)).toEqual(["down", "up", "left", "right"]);
    expect([7, 8, 9, 10].map(arrow)).toEqual(["up", "down", "left", "right"]);
    expect(ledge(WATER)).toBeNull();
    expect(slippery(ICE)).toBe(true);
    expect(slippery(8)).toBe(true);
    expect(slippery(1)).toBe(false);
  });

  test("the behavior grid is kept, unknown values are dropped and missing grids are filled", () => {
    const city = blank({ width: 3, height: 2 });
    city.behavior = [1, 5, 99, 6, -1, 10];
    expect(sanitize(JSON.parse(JSON.stringify(city))).behavior).toEqual([1, 5, 0, 6, 0, 10]);
    const old = JSON.parse(JSON.stringify(city));
    delete old.behavior;
    expect(sanitize(old).behavior).toEqual([0, 0, 0, 0, 0, 0]);
  });

  test("resizing keeps behaviors and triggers inside the map", () => {
    const city = blank({ width: 6, height: 6 });
    city.behavior[7] = ICE;
    city.triggers = [
      { id: "a", x: 2, y: 2, w: 4, h: 1, name: "Rival", once: true, actions: [] },
      { id: "b", x: 5, y: 5, w: 1, h: 1, name: "Gone", once: true, actions: [] },
    ];
    resize(city, 4, 4);
    expect(city.behavior[5]).toBe(ICE);
    expect(city.triggers).toEqual([{ id: "a", x: 2, y: 2, w: 2, h: 1, name: "Rival", once: true, actions: [] }]);
  });
});

describe("scripts", () => {
  test("imported actions are checked and unknown ones dropped", () => {
    expect(
      actions([
        { do: "say", text: "Hi!", who: 0 },
        { do: "move", who: "player", steps: ["up", "sideways", "left"] },
        { do: "give", item: "master-ball", count: 1 },
        { do: "give", item: "potion", count: 500 },
        { do: "dance" },
        { do: "come", who: "player" },
        { do: "wait", seconds: 99 },
      ]),
    ).toEqual([
      { do: "say", text: "Hi!", who: 0 },
      { do: "move", who: "player", steps: ["up", "left"] },
      { do: "give", item: "potion", count: 99 },
      { do: "wait", seconds: 10 },
    ]);
  });

  test("triggers are kept inside their map when imported", () => {
    const city = blank({ width: 10, height: 10 });
    const raw = { ...JSON.parse(JSON.stringify(city)), triggers: [{ id: "t", x: 8, y: 3, w: 9, h: 0, actions: [{ do: "heal" }] }, null] };
    expect(sanitize(raw).triggers).toEqual([{ id: "t", x: 8, y: 3, w: 2, h: 1, name: "Event", once: true, actions: [{ do: "heal" }] }]);
  });

  test("removing someone forgets them in scripts and shifts the people after them", () => {
    const city = blank();
    city.npcs = [person({}), person({ name: "Rival" }), person({ name: "Mom", script: { once: true, actions: [{ do: "say", text: "Bye", who: 1 }] } })];
    city.triggers = [
      {
        id: "t",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        name: "Rival",
        once: true,
        actions: [
          { do: "come", who: 1 },
          { do: "say", text: "Hey!", who: 1 },
          { do: "face", who: 2, dir: "up" },
          { do: "move", who: "player", steps: ["up"] },
        ],
      },
    ];
    reindex(city, 1);
    expect(city.triggers[0].actions).toEqual([
      { do: "say", text: "Hey!" },
      { do: "face", who: 1, dir: "up" },
      { do: "move", who: "player", steps: ["up"] },
    ]);
    expect(city.npcs[2].script!.actions).toEqual([{ do: "say", text: "Bye" }]);
  });
});

describe("event problems", () => {
  test("empty events, items holding nothing, and scripts about people who are gone", () => {
    const city = blank();
    city.zones = [];
    city.npcs = [person({ role: "item", sprite: "", name: "", dialogue: "" }), person({ script: { once: false, actions: [{ do: "battle", who: 0 }] } })];
    city.triggers = [
      { id: "a", x: 3, y: 3, w: 1, h: 1, name: "Nothing", once: true, actions: [] },
      { id: "b", x: 4, y: 4, w: 1, h: 1, name: "Lost", once: true, actions: [{ do: "come", who: 7 }] },
      { id: "c", x: 5, y: 5, w: 1, h: 1, name: "Away", once: true, actions: [{ do: "warp", to: "gone", x: 0, y: 0 }] },
    ];
    expect(texts(city)).toEqual(
      expect.arrayContaining([
        "Item at 1, 1 holds nothing",
        "The script of Bob at 1, 1 is about someone who isn't on the map anymore",
        'Event "Nothing" outside does nothing yet',
        'Event "Lost" outside is about someone who isn\'t on the map anymore',
        'Event "Away" outside warps to a deleted map',
      ]),
    );
    expect(problems(city).find(({ text }) => text.startsWith('Event "Nothing"'))).toMatchObject({ layer: "event", trigger: 0, at: { x: 3, y: 3 } });
  });

  test("a story step completed by an event can happen", () => {
    const city = blank();
    city.zones = [];
    city.story = [{ id: "rival", n: 1, name: "Meet the rival", blocked: "" }];
    expect(texts(city)).toContain('Story step "Meet the rival" can never happen: nobody completes it');
    city.triggers = [{ id: "t", x: 2, y: 2, w: 3, h: 1, name: "Rival", once: true, actions: [{ do: "step", step: "rival" }] }];
    expect(problems(city)).toEqual([]);
  });
});
