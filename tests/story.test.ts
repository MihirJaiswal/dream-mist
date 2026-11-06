// @vitest-environment node
import { describe, expect, test } from "vitest";
import { blank, sanitize } from "@/game/data";
import { journal, lanes, milestone, open } from "@/game/story";

/** A town with a 2-step main story and a 2-step side quest starting after the first main step */
function town() {
  const city = blank();
  city.story = [
    { id: "m1", n: 1, name: "Meet the Professor", blocked: "" },
    { id: "k1", n: 3, name: "Accept the quest", blocked: "", quest: "q" },
    { id: "m2", n: 2, name: "Beat the gym", blocked: "", goal: "Beat Roxanne in the gym" },
    { id: "k2", n: 4, name: "Find Skitty", blocked: "", quest: "q" },
  ];
  city.quests = [{ id: "q", name: "Lost kitten", after: "m1" }];
  return city;
}

describe("story lanes", () => {
  test("group steps into the main story and side quests, keeping their order", () => {
    const [main, side] = lanes(town());
    expect(main.steps.map(({ id }) => id)).toEqual(["m1", "m2"]);
    expect(side.quest?.name).toBe("Lost kitten");
    expect(side.steps.map(({ id }) => id)).toEqual(["k1", "k2"]);
  });

  test("steps of a deleted side quest fall back to the main story", () => {
    const city = town();
    city.quests = [];
    expect(lanes(city)[0].steps).toHaveLength(4);
  });

  test("a side quest's steps wait until it starts", () => {
    const city = town();
    const done = new Set<string>();
    expect(open(city, city.story[1], (id) => done.has(id))).toBe(false);
    done.add("m1");
    expect(open(city, city.story[1], (id) => done.has(id))).toBe(true);
    expect(open(city, city.story[0], () => false)).toBe(true);
  });
});

describe("journal", () => {
  test("shows the next main step, and side quests only once started", () => {
    const city = town();
    const done = new Set(["m1"]);
    let page = journal(city, (id) => done.has(id));
    expect(page.main?.next?.id).toBe("m2");
    expect(page.active).toEqual([]);
    done.add("k1");
    page = journal(city, (id) => done.has(id));
    expect(page.active.map(({ name, next }) => [name, next?.name])).toEqual([["Lost kitten", "Find Skitty"]]);
    done.add("k2");
    page = journal(city, (id) => done.has(id));
    expect(page.active).toEqual([]);
    expect(page.complete.map(({ name }) => name)).toEqual(["Lost kitten"]);
  });

  test("banners say what happened and what's next", () => {
    const city = town();
    const done = new Set(["m1"]);
    expect(milestone(city, city.story[0], (id) => done.has(id))).toEqual({ kind: "story", title: "Meet the Professor", text: "Next: Beat Roxanne in the gym" });
    done.add("k1");
    expect(milestone(city, city.story[1], (id) => done.has(id)).title).toBe("New quest: Lost kitten");
    done.add("k2");
    expect(milestone(city, city.story[3], (id) => done.has(id)).title).toBe("Quest complete: Lost kitten");
    done.add("m2");
    expect(milestone(city, city.story[2], (id) => done.has(id)).text).toBe("The main story is complete!");
  });

  test("a story of one step (the starter town's) isn't called complete", () => {
    const city = town();
    city.story = city.story.filter(({ id }) => id === "m1");
    expect(milestone(city, city.story[0], () => true).text).toBe("Story step complete!");
  });
});

describe("saving", () => {
  test("side quests survive a round trip and old towns get none", () => {
    const city = town();
    expect(sanitize(JSON.parse(JSON.stringify(city))).quests).toEqual(city.quests);
    const old = JSON.parse(JSON.stringify(blank()));
    delete old.quests;
    expect(sanitize(old).quests).toEqual([]);
  });
});
