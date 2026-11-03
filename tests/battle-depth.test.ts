import { afterEach, describe, expect, test, vi } from "vitest";
import { assets } from "@/game/assets";
import { attackOf, Battle, battleWeather, canGet, choose, damage, powerOf } from "@/game/battle";
import { blank, levelCap, sanitize } from "@/game/data";
import { holdable, sold } from "@/game/items";
import { natureLabel, natureMultiplier } from "@/game/natures";
import { abilityOf, create, experience, grow, hp, stat, type Trainer, trainer } from "@/game/trainer";

const [treecko, torchic, mudkip, pikachu, geodude, magikarp] = [252, 255, 258, 25, 74, 129];

afterEach(() => vi.restoreAllMocks());

describe("natures", () => {
  test("raise one stat by 10% and lower another", () => {
    const neutral = create(treecko, 50, { nature: "hardy" });
    const adamant = create(treecko, 50, { nature: "adamant" });
    expect(stat(adamant, 1)).toBe(Math.floor(stat(neutral, 1) * 1.1));
    expect(stat(adamant, 3)).toBe(Math.floor(stat(neutral, 3) * 0.9));
    expect(stat(adamant, 0)).toBe(stat(neutral, 0));
    expect(natureMultiplier("serious", 5)).toBe(1);
    expect(natureLabel("modest")).toBe("Modest (+Sp. Atk, −Attack)");
  });

  test("older Pokémon without one stay neutral", () => {
    const old = create(treecko, 30, { nature: "hardy" });
    delete old.nature;
    expect(stat(old, 1)).toBe(stat(create(treecko, 30, { nature: "hardy" }), 1));
  });
});

describe("abilities", () => {
  test("every species has its abilities, and each Pokémon gets one", () => {
    expect(assets.pokedex[treecko - 1].abilities).toEqual(["overgrow"]);
    expect(abilityOf(create(treecko, 5))).toBe("overgrow");
    const old = create(pikachu, 5);
    delete old.ability;
    expect(abilityOf(old)).toBe("static");
  });

  test("Overgrow powers up Grass moves at low HP, and Thick Fat halves Fire", () => {
    const user = create(treecko, 20, { ability: "overgrow" });
    const target = create(torchic, 20);
    const grass = { ...assets.moves.tackle, type: "grass" };
    expect(powerOf(user, target, grass)).toBe(1);
    user.hp = 1;
    expect(powerOf(user, target, grass)).toBe(1.5);
    const fire = { ...assets.moves.tackle, type: "fire" };
    expect(powerOf(target, create(treecko, 20, { ability: "thick-fat" }), fire)).toBe(0.5);
  });

  test("Huge Power doubles Attack, Guts boosts it with a condition", () => {
    expect(attackOf(create(magikarp, 5, { ability: "huge-power" }), true)).toBe(2);
    const guts = create(magikarp, 5, { ability: "guts" });
    expect(attackOf(guts, true)).toBe(1);
    guts.status = "burn";
    expect(attackOf(guts, true)).toBe(1.5);
    expect(attackOf(guts, false)).toBe(1);
  });

  test("Limber and Insomnia prevent their conditions", () => {
    expect(canGet(create(pikachu, 5, { ability: "limber" }), "sleep")).toBe(true);
    expect(canGet(create(mudkip, 5, { ability: "limber" }), "paralysis")).toBe(false);
    expect(canGet(create(mudkip, 5, { ability: "insomnia" }), "sleep")).toBe(false);
  });
});

describe("held items and weather", () => {
  test("type boosters and rain change move power", () => {
    const water = { ...assets.moves.tackle, type: "water" };
    const fire = { ...assets.moves.tackle, type: "fire" };
    const holder = create(mudkip, 20, { held: "mystic-water" });
    const target = create(geodude, 20);
    expect(powerOf(holder, target, water)).toBeCloseTo(1.2);
    expect(powerOf(create(mudkip, 20), target, water, "rain")).toBe(1.5);
    expect(powerOf(create(torchic, 20), target, fire, "rain")).toBe(0.5);
    expect(battleWeather("fog")).toBeNull();
    expect(battleWeather("sandstorm")).toBe("sandstorm");
  });

  test("held items are sold only when a clerk lists them", () => {
    expect(holdable).toContain("leftovers");
    expect(sold).not.toContain("leftovers");
  });

  test("average damage has no luck in it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = damage(create(torchic, 20, { nature: "hardy" }), create(treecko, 20, { nature: "hardy" }), assets.moves.tackle, { average: true });
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const b = damage(create(torchic, 20, { nature: "hardy" }), create(treecko, 20, { nature: "hardy" }), assets.moves.tackle, { average: true });
    expect(a.value).toBe(b.value);
    expect(a.critical).toBe(false);
  });
});

describe("trainer AI", () => {
  const attacker = () => {
    const creature = create(pikachu, 30, { nature: "hardy", ability: "static" });
    creature.moves = [
      { key: "thunder-shock", pp: 30 },
      { key: "quick-attack", pp: 30 },
    ];
    return creature;
  };

  test("hard trainers never waste a move the target is immune to", () => {
    const target = create(geodude, 30, { nature: "hardy" });
    for (let i = 0; i < 20; i++) {
      expect(choose(attacker(), target, "hard")?.key).toBe("quick-attack");
    }
  });

  test("easy trainers pick at random, and nothing is picked without PP", () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    const target = create(geodude, 30);
    expect(choose(attacker(), target, "easy", null, random)?.key).toBe("thunder-shock");
    expect(choose(attacker(), target, "easy", null, random)?.key).toBe("quick-attack");
    const tired = attacker();
    tired.moves.forEach((move) => (move.pp = 0));
    expect(choose(tired, target, "hard")).toBeNull();
  });
});

describe("level caps", () => {
  test("follow the badges of the town, the last one past the list", () => {
    expect(levelCap(undefined, 3)).toBe(100);
    expect(levelCap({ caps: [12, 18, 25] }, 0)).toBe(12);
    expect(levelCap({ caps: [12, 18, 25] }, 7)).toBe(25);
  });

  test("stop a Pokémon from leveling past the cap", () => {
    const creature = create(treecko, 10);
    grow(creature, 100000, 12);
    expect(creature.level).toBe(12);
    expect(creature.exp).toBeLessThan(experience(13));
  });

  test("and the rules are kept on import", () => {
    const raw = { ...JSON.parse(JSON.stringify(blank({ width: 2, height: 2 }))), rules: { difficulty: "hard", caps: [12, "18", 500] } };
    expect(sanitize(raw).rules).toEqual({ difficulty: "hard", caps: [12, 18, 100] });
  });
});

describe("move effects", () => {
  test("moves know how many times they hit, what they drain, heal and flinch", () => {
    expect(assets.moves["fury-attack"].hits).toEqual([2, 5]);
    expect(assets.moves["double-kick"].hits).toEqual([2, 2]);
    expect(assets.moves.absorb.drain).toBe(50);
    expect(assets.moves["take-down"].drain).toBe(-25);
    expect(assets.moves.recover.heal).toBe(50);
    expect(assets.moves.bite.flinch).toBe(30);
    expect(assets.moves.slash.crit).toBe(1);
    expect(assets.moves.protect.protect).toBe(true);
  });

  test("high critical hit moves crit more often", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const tackle = assets.moves.tackle;
    expect(damage(create(treecko, 20, { nature: "hardy" }), create(pikachu, 20, { nature: "hardy" }), tackle).critical).toBe(false);
    expect(damage(create(treecko, 20, { nature: "hardy" }), create(pikachu, 20, { nature: "hardy" }), tackle, { crit: 1 }).critical).toBe(true);
  });

  test("hurt trainers heal with their healing move", () => {
    const user = create(pikachu, 30, { nature: "hardy" });
    user.moves = [
      { key: "recover", pp: 5 },
      { key: "thunder-shock", pp: 5 },
    ];
    user.hp = 5;
    expect(choose(user, create(treecko, 30), "hard")?.key).toBe("recover");
  });
});

describe("raids", () => {
  test("bosses have 5× HP, and hits from the live room lower it only in their own den", async () => {
    const boss = create(geodude, 20, { nature: "hardy" });
    const normal = hp(boss);
    boss.boss = 5;
    expect(hp(boss)).toBe(normal * 5);
    boss.hp = hp(boss);
    const stand = { name: "Tester", party: [create(treecko, 20)], box: [], items: {}, money: 0 } as unknown as Trainer;
    await trainer.sandbox(stand, async () => {
      const battle = new Battle({ wild: boss, rules: { raid: { den: "city:3" } } });
      expect(battle.raid).toBe("city:3");
      battle.hurt("city:4", 50);
      expect(boss.hp).toBe(normal * 5);
      battle.hurt("city:3", 50);
      expect(boss.hp).toBe(normal * 5 - 50);
      battle.hurt("city:3", 99999);
      expect(boss.hp).toBe(0);
    });
  });
});
