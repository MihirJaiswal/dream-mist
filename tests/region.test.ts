// @vitest-environment node
import { describe, expect, test } from "vitest";
import { route, town } from "@/game/brushes";
import { blank, outdoor, sanitize } from "@/game/data";
import { problems } from "@/game/problems";
import { collides, crossing, neighbors, reachable, spot } from "@/game/region";

/** A 20×10 outside map with a 10×20 route right above it */
function region() {
  const city = blank({ width: 20, height: 10 });
  const road = outdoor(city, { name: "Route 101", width: 10, height: 20, x: 5, y: -20 });
  return { city, road };
}

describe("region", () => {
  test("maps touching along an edge are neighbors", () => {
    const { city, road } = region();
    expect(neighbors(city, city)).toEqual([{ map: road, dx: 5, dy: -20 }]);
    expect(neighbors(city, road)).toEqual([{ map: city, dx: -5, dy: 20 }]);
  });

  test("walking off an edge lands on the map touching it there", () => {
    const { city, road } = region();
    expect(crossing(city, city, 7, -1)).toEqual({ map: road, x: 2, y: 19 });
    expect(crossing(city, road, 2, 20)).toEqual({ map: city, x: 7, y: 0 });
    //Off the top of the outside map where the route doesn't reach
    expect(crossing(city, city, 1, -1)).toBeNull();
    //Still on the map
    expect(crossing(city, city, 3, 3)).toBeNull();
  });

  test("maps can't overlap, and new ones find a free spot beside a map", () => {
    const { city, road } = region();
    expect(collides(city, road, 5, -15)).toBe(true);
    expect(collides(city, road, 20, 0)).toBe(false);
    expect(spot(city, { width: 10, height: 20 }, city, ["up", "down"])).toEqual({ x: 5, y: 10, side: "down" });
  });

  test("an edge needs open tiles on both sides, not under tree tops", () => {
    const { city, road } = region();
    expect(reachable(city).has(road)).toBe(true);
    for (let x = 0; x < city.width; x++) {
      city.solid[x] = 1;
    }
    expect(reachable(city).has(road)).toBe(false);
    city.solid[7] = 0;
    expect(reachable(city).has(road)).toBe(true);
    city.layers.above[7] = 212;
    expect(reachable(city).has(road)).toBe(false);
  });

  test("outdoor maps survive a round trip", () => {
    const { city } = region();
    const copy = sanitize(JSON.parse(JSON.stringify(city)));
    expect(copy.interiors[0]).toMatchObject({ outdoor: true, region: { x: 5, y: -20 }, name: "Route 101" });
  });
});

describe("route and town presets", () => {
  test("a route opens at both ends and a town faces back the way it came", () => {
    const city = blank({ width: 30, height: 24 });
    const road = route(outdoor(city, { width: 20, height: 40, x: 5, y: -40 }), "up");
    //Both short ends have open tiles where the path is
    expect([...Array(20).keys()].some((x) => !road.solid[x])).toBe(true);
    expect([...Array(20).keys()].some((x) => !road.solid[39 * 20 + x])).toBe(true);
    expect(road.npcs.some(({ name }) => name === "Sign")).toBe(true);
    const next = town(outdoor(city, { width: 30, height: 24, x: 30, y: 0 }), "right");
    //Made to the right of the outside map: the way in is on its left edge
    expect([...Array(24).keys()].some((y) => !next.solid[y * 30] && !next.layers.above[y * 30])).toBe(true);
  });
});

describe("problems", () => {
  test("outdoor maps nobody can walk into", () => {
    const { city, road } = region();
    city.zones = [];
    for (let x = 0; x < city.width; x++) {
      city.solid[x] = 1;
    }
    expect(problems(city).map(({ text }) => text)).toContain(
      "Nobody can walk into Route 101: the edge it shares with the outside map is blocked all along. Open a gap in the trees or walls on both sides",
    );
    road.region = { x: 40, y: 40 };
    expect(problems(city).map(({ text }) => text)).toContain("Route 101 isn't joined to any other map. Move it next to one in the region map");
    road.region = { x: 2, y: 2 };
    expect(problems(city).map(({ text }) => text)).toContain("Route 101 overlaps the outside map in the region map");
  });
});
