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

  test("the player's house has its room upstairs", () => {
    const home = rooms.find(({ key }) => key === "home")!;
    const upstairs = rooms.find(({ key }) => key === home.stairs[0]?.to);
    expect(upstairs?.floor).toBe(true);
    expect(upstairs?.stairs.map(({ to }) => to)).toEqual(["home"]);
  });
});

describe("item icons", () => {
  test("every item has its Emerald icon", () => {
    for (const id of itemIds) {
      expect(existsSync(`public${iconOf(id)}`), id).toBe(true);
    }
  });
});
