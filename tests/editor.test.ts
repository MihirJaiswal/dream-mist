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
    const npc = { x: 3, y: 4, sprite: "youngster", name: "Bob", dialogue: "Hi", role: "trainer", trainer: { team: [] } } as unknown as Npc;
    convert(npc, "pokemon", "Town");
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
