// @vitest-environment node
import { describe, expect, test } from "vitest";
import { clock, hour, period } from "@/game/atmosphere";
import { blank, sanitize, type Zone } from "@/game/data";
import { appears, living, pool, roll } from "@/game/encounters";
import { bestRod, sold } from "@/game/items";

const pond: Zone = {
  name: "Pond",
  rate: 0.1,
  color: 0,
  creatures: [
    { species: 263, min: 2, max: 4 },
    { species: 163, min: 3, max: 5, time: "night" },
    { species: 72, min: 10, max: 20, method: "surf" },
    { species: 129, min: 5, max: 10, method: "fish" },
    { species: 118, min: 10, max: 15, method: "fish", rod: "good" },
    { species: 130, min: 30, max: 30, method: "fish", rod: "super", time: "morning" },
  ],
};
const ids = (list: { species: number }[]) => list.map(({ species }) => species);

describe("wild encounters", () => {
  test("walking, surfing and fishing each have their own Pokémon", () => {
    expect(ids(pool(pond, "walk", "day"))).toEqual([263]);
    expect(ids(pool(pond, "surf", "day"))).toEqual([72]);
    expect(ids(pool(pond, "fish", "day"))).toEqual([129]);
  });

  test("Pokémon of one part of the day only appear then", () => {
    expect(ids(pool(pond, "walk", "night"))).toEqual([263, 163]);
    expect(appears(pond.creatures[1], "walk", "morning")).toBe(false);
  });

  test("better rods hook more Pokémon", () => {
    expect(ids(pool(pond, "fish", "day", "good"))).toEqual([129, 118]);
    expect(ids(pool(pond, "fish", "morning", "super"))).toEqual([129, 118, 130]);
  });

  test("a rolled Pokémon gets a level in its range", () => {
    expect(roll([{ species: 1, min: 7, max: 3 }], () => 0.999)).toEqual({ species: 1, level: 7 });
    expect(roll([{ species: 1, min: 3, max: 7 }], () => 0)).toEqual({ species: 1, level: 3 });
    expect(roll([])).toBeNull();
  });

  test("the Pokémon living on a map are those of zones painted on it", () => {
    const city = blank({ width: 4, height: 4 });
    city.zones = [pond, { ...pond, name: "Unused", creatures: [{ species: 25, min: 5, max: 5 }] }];
    city.zone[5] = 1;
    expect(ids(living(city).surf)).toEqual([72]);
    expect(ids(living(city).walk)).toEqual([263, 163]);
  });

  test("imported zones keep only known methods, times and rods", () => {
    const city = blank({ width: 2, height: 2 });
    const raw = JSON.parse(JSON.stringify(city));
    raw.zones = [
      { name: "Lake", rate: 0.2, color: 1, creatures: [{ species: 129, min: 5, max: 9, method: "fish", rod: "mega", time: "noon" }, { species: 0 }] },
    ];
    expect(sanitize(raw).zones[0].creatures).toEqual([{ species: 129, min: 5, max: 9, method: "fish" }]);
  });
});

describe("time of day", () => {
  const at = (h: number) => new Date(2026, 0, 1, h);
  test("the clock gives morning, day, evening and night", () => {
    expect([5, 12, 18, 23, 2].map((h) => clock(at(h)))).toEqual(["morning", "day", "evening", "night", "night"]);
  });

  test("maps that follow the clock read it, others keep their time; evenings count as day for wild Pokémon", () => {
    expect(hour("clock", at(5))).toBe("morning");
    expect(hour("night", at(12))).toBe("night");
    expect(period("evening")).toBe("day");
    expect(period("clock", at(23))).toBe("night");
  });
});

describe("rods", () => {
  test("are handed out, not sold, and the best one is used", () => {
    expect(sold).not.toContain("old-rod");
    expect(bestRod((id) => (id === "old-rod" || id === "good-rod" ? 1 : 0))).toBe("good-rod");
    expect(bestRod(() => 0)).toBeNull();
  });
});
