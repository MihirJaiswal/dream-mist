// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { blank } from "@/game/data";
import { templates } from "@/game/editor/constants";
import { buildRoom, type Interior, sheetName } from "@/game/interiors";
import { iconOf, itemIds } from "@/game/items";
import { decode } from "@/game/tilesets";

const rooms = JSON.parse(readFileSync("public/game/data/rooms.json", "utf8")) as Interior[];

describe("interior templates", () => {
  test("every template but the empty room is one of Emerald's rooms, with its tilesets and a way out", () => {
    for (const { key } of templates.filter(({ key }) => key !== "empty")) {
      const room = rooms.find((room) => room.key === key);
      expect(room, key).toBeDefined();
      expect(room!.blocks).toHaveLength(room!.width * room!.height);
      expect(room!.exits.length, key).toBeGreaterThan(0);
      for (const file of [room!.primary, room!.secondary]) {
        expect(existsSync(`public/game/tilesets/emerald/${file}`), file).toBe(true);
      }
    }
    expect(sheetName("primary-building.png")).toBe("building");
  });

  test("a Pokémon Center comes with its tiles, collision, exit doors and Nurse", () => {
    const world = blank({ width: 4, height: 4 });
    const room = rooms.find(({ key }) => key === "center")!;
    const map = buildRoom(world, room, { primary: 0, secondary: 1 });
    expect(world.interiors).toContain(map);
    expect([map.width, map.height]).toEqual([room.width, room.height]);
    expect(map.layers.ground.every((value) => decode(value).index === 0 || decode(value).index === 1)).toBe(true);
    expect(map.doors.map(({ x, y, to }) => ({ x, y, to }))).toEqual(room.exits.map(({ x, y }) => ({ x, y, to: "" })));
    expect(map.doors.every(({ x, y }) => map.solid[y * map.width + x] === 0)).toBe(true);
    expect(map.solid.some(Boolean)).toBe(true);
    expect(map.npcs.find(({ role }) => role === "healer")?.name).toBe("Nurse");
  });

  test("the player's house has its room upstairs, with nobody on the stairs", () => {
    const home = rooms.find(({ key }) => key === "home")!;
    const upstairs = rooms.find(({ key }) => key === home.stairs[0]?.to)!;
    expect(upstairs.floor).toBe(true);
    expect(upstairs.stairs.map(({ to }) => to)).toEqual(["home"]);
    const map = buildRoom(blank({ width: 4, height: 4 }), upstairs, { primary: 0, secondary: 1 });
    expect(map.npcs.some(({ x, y }) => upstairs.stairs.some((tile) => tile.x === x && tile.y === y))).toBe(false);
  });
});

describe("item icons", () => {
  test("every item has its Emerald icon", () => {
    for (const id of itemIds) {
      expect(existsSync(`public${iconOf(id)}`), id).toBe(true);
    }
  });
});

describe("starter town", () => {
  test("its paths lead out on every side, and its Pokémon Center, house and lab have doors", async () => {
    const { frames, starterDoors, template } = await import("@/game/brushes");
    const city = template(blank({ width: 40, height: 30 }));
    const { width: W, height: H } = city;
    const [cx, cy] = [W / 2, H / 2];
    const sand = frames.sand + 1;
    for (const index of [cx, W * (H - 1) + cx, cy * W, cy * W + W - 1]) {
      expect(city.layers.ground[index]).toBe(sand);
      expect(city.solid[index]).toBe(0);
      expect(city.layers.decor[index]).toBe(0);
    }
    const doors = starterDoors(city);
    expect(city.doors.map(({ x, y }) => ({ x, y }))).toEqual([doors.center, doors.home, doors.lab]);
    expect(city.doors.every(({ x, y, to }) => to === "?" && city.solid[y * W + x] === 0)).toBe(true);
    expect(city.npcs.some(({ role }) => role === "healer")).toBe(false);
  });

  test("its ways out stay closed until the player gets a first Pokémon", async () => {
    const { starterExits, template } = await import("@/game/brushes");
    const city = template(blank({ width: 40, height: 30 }));
    const [step] = city.story;
    expect(step.name).toBe("Get your first Pokémon");
    for (const { x, y } of starterExits(city)) {
      expect(city.gate[y * city.width + x]).toBe(step.n);
    }
    expect(city.gate.filter(Boolean)).toHaveLength(8);
  });

  test("the lab's Professor lets the player choose a starter, once", () => {
    const world = blank({ width: 4, height: 4 });
    const lab = buildRoom(
      world,
      rooms.find(({ key }) => key === "lab")!,
      { primary: 0, secondary: 1 },
    );
    const professor = lab.npcs.find(({ name }) => name === "Professor")!;
    expect(professor.script?.once).toBe(true);
    expect(professor.script?.actions.find(({ do: kind }) => kind === "starter")).toEqual({ do: "starter", species: [252, 255, 258], level: 5 });
    //He says his own lines
    const index = lab.npcs.indexOf(professor);
    expect(professor.script?.actions.filter(({ do: kind }) => kind === "say").every((action) => "who" in action && action.who === index)).toBe(true);
  });
});
