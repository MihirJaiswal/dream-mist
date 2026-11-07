// @vitest-environment node
import { describe, expect, test } from "vitest";
import { template } from "@/game/brushes";
import { blank, type City, interior, outdoor } from "@/game/data";
import { generate, type Generated, type MapKind, sizeOf, walk } from "@/game/generator";
import { problems } from "@/game/problems";
import { edge, outdoors, reachable, type Side, walkable } from "@/game/region";

const sides: Side[] = ["up", "right", "down", "left"];
const seeds = Array.from({ length: 12 }, (_, i) => `seed-${i}`);

/** A generated map on its own, joined to nothing */
function make(kind: MapKind, seed: string, entrance: Side = "down") {
  const world = blank({ width: 20, height: 20 });
  const { width, height } = sizeOf(kind, entrance, seed);
  const map = outdoor(world, { name: kind === "town" ? "Test Town" : "Route 101", width, height, x: 0, y: -1000 });
  const made = generate(map, world.zones, { kind, seed, entrance });
  return { world, map, made };
}

/** Give every door a plain room leading back, like the editor does with Emerald's rooms */
function furnish(world: City, map: City, made: Generated) {
  for (const { door } of made.buildings) {
    const room = interior(world, { name: "Room" });
    room.doors.push({ x: 7, y: room.height - 1, to: map.id, tx: -1, ty: -1 });
    room.solid[(room.height - 1) * room.width + 7] = 0;
    map.doors.find(({ x, y }) => x === door.x && y === door.y)!.to = room.id;
  }
}

describe("map generator", () => {
  test("the same seed makes the same map, another seed another one", () => {
    for (const kind of ["town", "route"] as const) {
      const a = make(kind, "abc").map,
        b = make(kind, "abc").map,
        c = make(kind, "xyz").map;
      const same = (m: City) => JSON.stringify([m.width, m.height, m.layers, m.solid, m.behavior, m.zone, m.npcs, m.doors, m.spawn]);
      expect(same(a)).toBe(same(b));
      expect(JSON.stringify(a.layers)).not.toBe(JSON.stringify(c.layers));
    }
  });

  test("grids have the map's size, and routes run away from the side they join", () => {
    for (const kind of ["town", "route"] as const) {
      for (const entrance of sides) {
        for (const seed of seeds.slice(0, 4)) {
          const { map } = make(kind, seed, entrance);
          const size = map.width * map.height;
          for (const grid of [map.layers.ground, map.layers.decor, map.layers.above, map.solid, map.behavior, map.zone, map.gate]) {
            expect(grid).toHaveLength(size);
          }
          expect((map.width % 2) + (map.height % 2)).toBe(0);
          if (kind === "route") {
            expect(entrance === "up" || entrance === "down" ? map.height > map.width : map.width > map.height).toBe(true);
          }
        }
      }
    }
  });

  test("towns have a Pokémon Center, a Poké Mart and houses, every door reachable from the spawn", () => {
    for (const entrance of sides) {
      for (const seed of seeds) {
        const { map, made } = make("town", seed, entrance);
        const rooms = made.buildings.map(({ room }) => room);
        expect(rooms).toContain("center");
        expect(rooms).toContain("mart");
        expect(rooms.length).toBeGreaterThanOrEqual(3);
        const seen = walk(map, map.spawn);
        expect(map.solid[map.spawn.y * map.width + map.spawn.x]).toBe(0);
        for (const { door } of made.buildings) {
          expect(map.solid[door.y * map.width + door.x]).toBe(0);
          expect(seen.has(door.y * map.width + door.x)).toBe(true);
        }
        //Wild Pokémon in a tall grass patch, painted with the new zone
        expect(map.zone.some((z) => z === map.zone.find(Boolean))).toBe(true);
      }
    }
  });

  test("exits are open on the edges they claim and reachable from the spawn", () => {
    for (const kind of ["town", "route"] as const) {
      for (const entrance of sides) {
        for (const seed of seeds) {
          const { map, made } = make(kind, seed, entrance);
          expect(made.exits.length).toBeGreaterThanOrEqual(2);
          expect(made.exits[0].side).toBe(entrance);
          const seen = walk(map, map.spawn);
          for (const { side, tiles } of made.exits) {
            for (const { x, y } of tiles) {
              const onEdge = { up: y === 0, down: y === map.height - 1, left: x === 0, right: x === map.width - 1 }[side];
              expect(onEdge).toBe(true);
              expect(walkable(map, x, y)).toBe(true);
              expect(seen.has(y * map.width + x)).toBe(true);
            }
          }
        }
      }
    }
  });

  test("routes: trainers, items and signs can be walked up to, ledges have room to land", () => {
    for (const entrance of sides) {
      for (const seed of seeds) {
        const { map } = make("route", seed, entrance);
        const seen = walk(map, map.spawn);
        const W = map.width;
        const trainers = map.npcs.filter(({ role }) => role === "trainer");
        expect(trainers.length).toBeGreaterThanOrEqual(1);
        expect(map.npcs.some(({ role, hidden, grow }) => role === "item" && !hidden && !grow)).toBe(true);
        for (const npc of map.npcs) {
          const next = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => seen.has((npc.y + dy) * W + npc.x + dx));
          expect(next, `${npc.name || npc.role} at ${npc.x}, ${npc.y}`).toBe(true);
        }
        for (const trainer of trainers) {
          expect(trainer.trainer?.team.length).toBeGreaterThan(0);
        }
        map.behavior.forEach((value, i) => {
          if (value >= 1 && value <= 4) {
            const [dx, dy] = [
              [0, 1],
              [0, -1],
              [-1, 0],
              [1, 0],
            ][value - 1];
            const [x, y] = [(i % W) + dx, Math.floor(i / W) + dy];
            expect(map.solid[y * W + x]).toBe(0);
          }
        });
      }
    }
  });

  test("buildings and tree trunks are solid, tall grass and flowers aren't", () => {
    for (const kind of ["town", "route"] as const) {
      for (const seed of seeds.slice(0, 6)) {
        const { map, made } = make(kind, seed);
        const doors = new Set(made.buildings.map(({ door }) => door.y * map.width + door.x));
        map.layers.decor.forEach((value, i) => {
          if (!value || doors.has(i)) {
            return;
          }
          const walkOn = value === 95 || value === 659 || map.behavior[i] > 0;
          expect(map.solid[i], `tile ${value} at ${i % map.width}, ${Math.floor(i / map.width)}`).toBe(walkOn ? 0 : 1);
        });
      }
    }
  });

  test("a furnished town passes the Problems checks, joined to the outside map through its exit", () => {
    for (const seed of seeds) {
      const world = template(blank({ width: 40, height: 30 }));
      //The starter story is finished by the Professor's room, which isn't made here
      world.story = [];
      world.gate.fill(0);
      for (const door of world.doors) {
        const room = interior(world, { name: "Room" });
        room.doors.push({ x: 7, y: room.height - 1, to: "", tx: -1, ty: -1 });
        door.to = room.id;
      }
      //Above the starter town, whose road north leaves at columns 20 and 21
      const { width, height } = sizeOf("town", "down", seed);
      const map = outdoor(world, { name: "Test Town", width, height, x: Math.floor((40 - width) / 2), y: -height });
      const self = outdoors(world).find((placed) => placed.map === map)!;
      const shared = edge(self, outdoors(world)[0])!;
      const openings = shared.tiles.filter(({ x }) => walkable(world, x + self.x, 0)).map(({ x }) => x);
      const made = generate(map, world.zones, { kind: "town", seed, entrance: "down", openings });
      furnish(world, map, made);
      expect(reachable(world).has(map)).toBe(true);
      expect(problems(world).filter(({ kind }) => kind === "error")).toEqual([]);
      expect(problems(world).filter(({ map: on }) => on === map.id)).toEqual([]);
    }
  });

  test("a route lines its entrance up with the map it joins", () => {
    for (const seed of seeds) {
      const world = template(blank({ width: 40, height: 30 }));
      const { width, height } = sizeOf("route", "left", seed);
      //East of the starter town, whose road east leaves at rows 15 and 16
      const map = outdoor(world, { name: "Route 101", width, height, x: 40, y: 15 - Math.floor(height / 2) });
      const self = outdoors(world).find((placed) => placed.map === map)!;
      const shared = edge(self, outdoors(world)[0])!;
      const openings = shared.tiles.filter(({ y }) => walkable(world, 39, y + self.y)).map(({ y }) => y);
      generate(map, world.zones, { kind: "route", seed, entrance: "left", openings });
      expect(reachable(world).has(map)).toBe(true);
    }
  });
});
