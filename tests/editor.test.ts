import { describe, expect, test } from "vitest";
import type { Npc } from "@/game/data";
import { convert, kindOf } from "@/game/editor/constants";
import { frameOf } from "@/game/sprites";

describe("people layer", () => {
  test("tells people, Pokémon and signs apart", () => {
    expect(kindOf({ sprite: "youngster" } as Npc)).toBe("person");
    expect(kindOf({ sprite: "", creature: { species: 25, level: 5 } } as Npc)).toBe("pokemon");
    expect(kindOf({ sprite: "" } as Npc)).toBe("sign");
  });

  test("converting keeps the position and changes the kind", () => {
    const npc = { x: 3, y: 4, sprite: "youngster", name: "Bob", dialogue: "Hi", role: "trainer", trainer: { team: [] }, portrait: "bob.png", hidePortrait: true } as unknown as Npc;
    convert(npc, "pokemon", "Town");
    expect(npc.portrait).toBeUndefined();
    expect(npc.hidePortrait).toBeUndefined();
    expect(kindOf(npc)).toBe("pokemon");
    expect(npc).toMatchObject({ x: 3, y: 4 });
    expect(npc.trainer).toBeUndefined();
    convert(npc, "sign", "Town");
    expect(kindOf(npc)).toBe("sign");
    expect(npc.dialogue).toContain("Town");
    expect(npc.creature).toBeUndefined();
    convert(npc, "person", "Town");
    expect(kindOf(npc)).toBe("person");
  });
});

describe("custom sprite sheets", () => {
  test("split into frames by layout", () => {
    expect(frameOf({ width: 96, height: 128 }, "dreammist")).toEqual({ w: 32, h: 32 });
    expect(frameOf({ width: 128, height: 192 }, "rpgxp")).toEqual({ w: 32, h: 48 });
    expect(frameOf({ width: 100, height: 128 }, "rpgvx")).toBeNull();
  });
});

describe("tree stamps", () => {
  test("tree tops go on the Above layer so overlapping trees don't cut each other", async () => {
    const { stamp } = await import("@/game/brushes");
    const { blank } = await import("@/game/data");
    const city = blank({ width: 10, height: 10 });
    stamp(city, "Tree", 2, 2);
    stamp(city, "Tree", 3, 3);
    const at = (x: number, y: number) => y * city.width + x;
    //The back tree keeps its trunk where the front tree's top overlaps it
    expect(city.layers.decor[at(3, 3)]).toBe(326);
    expect(city.layers.above[at(3, 3)]).toBe(212);
    //Tops don't block, trunks do
    expect(city.solid[at(2, 2)]).toBe(0);
    expect(city.solid[at(3, 4)]).toBe(1);
  });
});

describe("tiles with see-through parts", () => {
  test("tall grass stands on grass as a walkable object, with wild Pokémon", async () => {
    const { stamp, frames } = await import("@/game/brushes");
    const { blank } = await import("@/game/data");
    const city = blank({ width: 6, height: 6, ground: frames.grass + 1 });
    stamp(city, "Tall grass (wild Pokémon)", 2, 2);
    const i = 2 * 6 + 2;
    expect(city.layers.ground[i]).toBe(frames.grass + 1);
    expect(city.layers.decor[i]).toBe(frames.tall + 1);
    expect(city.solid[i]).toBe(0);
    expect(city.zone[i]).toBe(1);
  });

  test("towns with tall grass on the ground are repaired when opened", async () => {
    const { frames } = await import("@/game/brushes");
    const { blank, sanitize } = await import("@/game/data");
    const city = blank({ width: 4, height: 4 });
    city.layers.ground[5] = frames.tall + 1;
    city.layers.ground[6] = frames.tall + 1;
    city.layers.decor[6] = 999;
    const fixed = sanitize(JSON.parse(JSON.stringify(city)));
    expect([fixed.layers.ground[5], fixed.layers.decor[5]]).toEqual([frames.grass + 1, frames.tall + 1]);
    //Something already stands there: left as it was
    expect([fixed.layers.ground[6], fixed.layers.decor[6]]).toEqual([frames.tall + 1, 999]);
  });

  test("Hoenn maps get sea where they have nothing, and ground under see-through tiles", async () => {
    const { fill } = await import("@/game/hoenn");
    const { frames } = await import("@/game/brushes");
    const { blank } = await import("@/game/data");
    const city = blank({ width: 5, height: 1, ground: 0 });
    city.layers.ground = [0, 0, 50, 0, 50];
    city.layers.decor = [0, 77, 0, 88, 0];
    fill(city);
    //Nothing at all: the sea, which blocks
    expect(city.layers.ground[0]).toBe(frames.water + 1);
    expect(city.solid[0]).toBe(1);
    //Under a see-through object: the most common ground around it
    expect(city.layers.ground[3]).toBe(50);
    expect(city.layers.ground[1]).not.toBe(0);
  });
});
