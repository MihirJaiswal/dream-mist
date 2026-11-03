import { describe, expect, test, vi } from "vitest";
import { assets } from "@/game/assets";
import { canGet, catchOdds, damage, effectiveness, stageMultiplier } from "@/game/battle";
import { itemCount } from "@/game/items";
import { create, evolution, evolve, experience, grow, heal, hp, stat, type Trainer, upgrade } from "@/game/trainer";

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

  test("is easier with a better ball or a status condition", () => {
    const foe = create(pikachu, 10);
    const plain = catchOdds(foe).a;
    expect(catchOdds(foe, 1.5).a).toBeGreaterThan(plain);
    foe.status = "sleep";
    expect(catchOdds(foe).a).toBeGreaterThan(plain);
  });
});

describe("stat stages and conditions", () => {
  test("stages scale like the games", () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(stageMultiplier(6)).toBe(4);
    expect(stageMultiplier(1, true)).toBeCloseTo(4 / 3);
  });

  test("types are immune to their own conditions and nobody gets two", () => {
    expect(canGet(create(gastly, 10), "poison")).toBe(false);
    expect(canGet(create(torchic, 10), "burn")).toBe(false);
    expect(canGet(create(pikachu, 10), "paralysis")).toBe(false);
    const target = create(treecko, 10);
    expect(canGet(target, "sleep")).toBe(true);
    target.status = "poison";
    expect(canGet(target, "sleep")).toBe(false);
  });

  test("status moves carry their effect", () => {
    expect(assets.moves.growl.effect).toMatchObject({ stats: [["attack", -1]] });
    expect(assets.moves["swords-dance"].effect).toMatchObject({ stats: [["attack", 2]], self: true });
    expect(assets.moves.hypnosis.effect).toMatchObject({ ailment: "sleep" });
    expect(assets.moves["poison-powder"].effect).toMatchObject({ ailment: "poison" });
  });
});

describe("evolution", () => {
  test("happens at the right level and keeps the damage taken", () => {
    expect(evolution(create(treecko, 15))).toBe(0);
    const creature = create(treecko, 16, { shiny: false });
    expect(evolution(creature)).toBe(253);
    creature.hp -= 5;
    const messages = evolve(creature, 253);
    expect(creature.species).toBe(253);
    expect(creature.hp).toBe(hp(creature) - 5);
    expect(messages[0]).toContain("evolved into Grovyle");
  });

  test("stops at the last form", () => {
    expect(evolution(create(254, 100))).toBe(0);
  });
});

describe("bag", () => {
  test("old saves keep their balls and potions", () => {
    const profile = upgrade({ bag: { balls: 4, potions: 2 } } as unknown as Trainer)!;
    expect(profile.items).toEqual({ "poke-ball": 4, potion: 2 });
    expect(profile.money).toBe(3000);
    expect("bag" in profile).toBe(false);
  });

  test("names amounts of items", () => {
    expect(itemCount("potion", 1)).toBe("a Potion");
    expect(itemCount("poke-ball", 3)).toBe("3 Poké Balls");
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

  test("know one to four moves, at least one of them dealing damage", () => {
    for (const id of [1, 129, 132, 252, 280, 1025]) {
      for (const level of [5, 30, 70]) {
        const creature = create(id, level);
        expect(creature.moves.length).toBeGreaterThanOrEqual(1);
        expect(creature.moves.length).toBeLessThanOrEqual(4);
        expect(creature.moves.some(({ key }) => assets.moves[key]?.power > 0)).toBe(true);
        for (const { key } of creature.moves) {
          //Every move either deals damage or does something battles know how to play (an effect, healing, Protect)
          const move = assets.moves[key];
          expect(move?.power > 0 || Boolean(move?.effect || move?.heal || move?.protect)).toBe(true);
        }
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
