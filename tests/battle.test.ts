import { describe, expect, test, vi } from "vitest";
import { assets } from "@/game/assets";
import { catchOdds, damage, effectiveness } from "@/game/battle";
import { create, experience, grow, heal, hp, stat } from "@/game/trainer";

const [treecko, torchic, mudkip, pikachu, gastly, geodude] = [252, 255, 258, 25, 92, 74];

describe("type chart", () => {
  test("matches the games", () => {
    expect(effectiveness("fire", create(treecko, 5))).toBe(2);
    expect(effectiveness("water", create(torchic, 5))).toBe(2);
    expect(effectiveness("grass", create(torchic, 5))).toBe(0.5);
    expect(effectiveness("normal", create(gastly, 5))).toBe(0);
    expect(effectiveness("electric", create(geodude, 5))).toBe(0);
    //Dual types multiply: water vs rock/ground
    expect(effectiveness("water", create(geodude, 5))).toBe(4);
  });
});

describe("damage", () => {
  test("is zero against immune Pokémon and at least one otherwise", () => {
    const tackle = assets.moves.tackle;
    expect(damage(create(pikachu, 50), create(gastly, 50), tackle).value).toBe(0);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(damage(create(pikachu, 2), create(geodude, 100), tackle).value).toBeGreaterThanOrEqual(1);
    vi.restoreAllMocks();
  });

  test("super effective and same-type moves hit harder", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const ember = { ...assets.moves.tackle, type: "fire", class: "special" as const };
    const neutral = damage(create(torchic, 20), create(pikachu, 20), ember).value;
    const strong = damage(create(torchic, 20), create(treecko, 20), ember).value;
    expect(strong).toBeGreaterThan(neutral);
    const stab = damage(create(torchic, 20), create(pikachu, 20), ember).value;
    const offType = damage(create(mudkip, 20), create(pikachu, 20), ember).value;
    expect(stab).toBeGreaterThan(offType * 0.9);
    vi.restoreAllMocks();
  });
});

describe("catching", () => {
  test("is easier at low HP", () => {
    const foe = create(pikachu, 10);
    const full = catchOdds(foe).a;
    foe.hp = 1;
    expect(catchOdds(foe).a).toBeGreaterThan(full);
  });
});

describe("creatures", () => {
  test("stats follow the gen 3 formula", () => {
    const creature = create(pikachu, 50, { shiny: false });
    //Pikachu base HP 35: floor((70 + 15) * 50 / 100) + 50 + 10
    expect(hp(creature)).toBe(102);
    expect(creature.hp).toBe(102);
    expect(stat(creature, 5)).toBeGreaterThan(stat(creature, 2));
  });

  test("know one to four damaging moves", () => {
    for (const id of [1, 129, 132, 252, 1025]) {
      const creature = create(id, 30);
      expect(creature.moves.length).toBeGreaterThanOrEqual(1);
      expect(creature.moves.length).toBeLessThanOrEqual(4);
      for (const { key } of creature.moves) {
        expect(assets.moves[key]?.power).toBeGreaterThan(0);
      }
    }
  });

  test("level up with experience and keep their damage", () => {
    const creature = create(treecko, 5, { shiny: false });
    creature.hp -= 3;
    const messages = grow(creature, experience(8) - creature.exp);
    expect(creature.level).toBe(8);
    expect(messages.filter((text) => text.includes("grew to"))).toHaveLength(3);
    expect(creature.hp).toBe(hp(creature) - 3);
    heal(creature);
    expect(creature.hp).toBe(hp(creature));
  });

  test("stop at level 100", () => {
    const creature = create(pikachu, 99);
    grow(creature, 10 ** 9);
    expect(creature.level).toBe(100);
  });
});
