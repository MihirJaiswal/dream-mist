// @vitest-environment node
import { describe, expect, test } from "vitest";
import { area, blank, decode, encode, interior, resize, sanitize } from "@/game/data";

describe("blank", () => {
  test("fills every grid to the map size", () => {
    const city = blank({ width: 12, height: 7, ground: 5 });
    expect(city.layers.ground).toHaveLength(84);
    expect(city.layers.ground.every((tile) => tile === 5)).toBe(true);
    for (const grid of [city.layers.decor, city.layers.above, city.solid, city.zone, city.gate]) {
      expect(grid).toHaveLength(84);
    }
    expect(city.spawn).toEqual({ x: 6, y: 3 });
  });
});

describe("resize", () => {
  test("keeps content anchored to the top-left corner", () => {
    const city = blank({ width: 4, height: 3 });
    city.layers.ground = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    resize(city, 2, 2);
    expect(city.layers.ground).toEqual([1, 2, 5, 6]);
    resize(city, 3, 3);
    expect(city.layers.ground).toEqual([1, 2, 0, 5, 6, 0, 0, 0, 0]);
  });

  test("drops people and doors left outside, and keeps the spawn inside", () => {
    const city = blank({ width: 10, height: 10 });
    city.npcs = [{ x: 1, y: 1 }, { x: 8, y: 8 }] as typeof city.npcs;
    city.doors = [{ x: 9, y: 0, to: "", tx: 0, ty: 0 }];
    city.spawn = { x: 9, y: 9 };
    resize(city, 5, 5);
    expect(city.npcs).toHaveLength(1);
    expect(city.doors).toHaveLength(0);
    expect(city.spawn).toEqual({ x: 4, y: 4 });
  });
});

describe("sanitize", () => {
  test("rejects things that are not a city", () => {
    expect(() => sanitize(null as never)).toThrow();
    expect(() => sanitize({ width: 5 } as never)).toThrow();
  });

  test("keeps battle backgrounds and drops broken ones", () => {
    const raw = { ...blank({ width: 6, height: 6 }), battle: { image: "https://example.com/beach.png", platforms: false } };
    expect(sanitize(raw).battle).toEqual({ image: "https://example.com/beach.png", platforms: false });
    expect(sanitize({ ...raw, battle: { image: "" } } as never).battle).toBeUndefined();
    expect(sanitize({ ...raw, battle: { image: "x.png" } } as never).battle).toEqual({ image: "x.png", platforms: true });
  });

  test("repairs grids of the wrong size and bad values", () => {
    const city = sanitize({ width: 2, height: 2, layers: { ground: [1, "2", null, 4], decor: [1], above: "nope" } } as never);
    expect(city.layers.ground).toEqual([1, 2, 0, 4]);
    expect(city.layers.decor).toEqual([0, 0, 0, 0]);
    expect(city.layers.above).toEqual([0, 0, 0, 0]);
    expect(city.solid).toEqual([0, 0, 0, 0]);
  });

  test("trims long names and drops broken doors, steps and sprites", () => {
    const city = sanitize({
      ...blank({ width: 3, height: 3 }),
      name: "x".repeat(80),
      doors: [{ x: 1, y: 1, to: "", tx: 0, ty: 0 }, { x: Number.NaN, y: 0 }],
      story: [{ id: "a" }, {}],
      sprites: [{ id: "s", url: "u" }, { id: "missing url" }],
    } as never);
    expect(city.name).toHaveLength(40);
    expect(city.doors).toHaveLength(1);
    expect(city.story).toHaveLength(1);
    expect(city.sprites).toHaveLength(1);
  });

  test("interiors share the zones and story of the outside map", () => {
    const raw = blank({ width: 5, height: 5 });
    raw.interiors = [blank({ width: 3, height: 3 })];
    const city = sanitize(raw);
    const inside = city.interiors[0];
    expect(inside.zones).toBe(city.zones);
    city.story = [{ id: "new" } as never];
    expect(inside.story).toBe(city.story);
    //Shared fields are not saved twice
    expect(Object.keys(inside)).not.toContain("zones");
    expect(JSON.parse(JSON.stringify(city)).interiors[0].story).toBeUndefined();
  });
});

describe("interiors", () => {
  test("new interiors have walls and are found by id", () => {
    const city = blank();
    const house = interior(city, { width: 6, height: 5 });
    expect(city.interiors).toContain(house);
    expect(area(city, house.id)).toBe(house);
    expect(area(city, "")).toBe(city);
    expect(area(city, "unknown")).toBeNull();
    //Edges are solid, the middle is walkable
    expect(house.solid[0]).toBe(1);
    expect(house.solid[2 * 6 + 2]).toBe(0);
    expect(house.spawn).toEqual({ x: 3, y: 3 });
  });
});

describe("share codes", () => {
  test("encode and decode round-trip a city", async () => {
    const city = blank({ width: 8, height: 6, name: "Code Town" });
    city.layers.decor[5] = 42;
    interior(city, { name: "Lab" });
    const code = await encode(city);
    expect(code.startsWith("c1.")).toBe(true);
    expect(code).not.toMatch(/[+/=]/);
    const copy = await decode(code);
    expect(copy.name).toBe("Code Town");
    expect(copy.layers.decor[5]).toBe(42);
    expect(copy.interiors.map(({ name }) => name)).toEqual(["Lab"]);
  });

  test("rejects unknown codes", async () => {
    await expect(decode("c9.abc")).rejects.toThrow();
    await expect(decode("nonsense")).rejects.toThrow();
  });
});
