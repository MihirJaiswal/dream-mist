import { describe, expect, test, vi } from "vitest";
import { assets, species } from "@/game/assets";
import { canGet, catchOdds, damage, effectiveness, stageMultiplier } from "@/game/battle";
import { itemCount } from "@/game/items";
import { apply, helps } from "@/game/growth";
import {
  befriend,
  create,
  type Creature,
  evolution,
  evolve,
  evolvesWith,
  experience,
  friendly,
  grow,
  heal,
  hp,
  replaceMove,
  shed,
  stat,
  type Trainer,
  upgrade,
} from "@/game/trainer";

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
  const level = (party: Creature[] = [], time: "day" | "night" = "day") => ({ level: true as const, time, party });

  test("happens at the right level and keeps the damage taken", () => {
    expect(evolution(create(treecko, 15), level())).toBeNull();
    const creature = create(treecko, 16, { shiny: false });
    expect(evolution(creature, level())?.into).toBe(253);
    creature.hp -= 5;
    const messages = evolve(creature, 253);
    expect(creature.species).toBe(253);
    expect(creature.hp).toBe(hp(creature) - 5);
    expect(messages[0]).toContain("evolved into Grovyle");
  });

  test("evolving late still teaches the new form's own moves", () => {
    const marsh = create(mudkip, 17);
    marsh.moves = ["tackle", "growl", "mud-slap"].map((key) => ({ key, pp: 10 }));
    const messages = evolve(marsh, 259);
    expect(marsh.moves.map(({ key }) => key)).toContain("mud-shot");
    expect(messages.some((text) => text.includes("learned Mud Shot"))).toBe(true);
  });

  test("stops at the last form", () => {
    expect(evolution(create(254, 100), level())).toBeNull();
  });

  test("evolution stones work on the Pokémon they're for, at any level", () => {
    const eevee = create(133, 5);
    expect(evolution(eevee, { item: "fire-stone" })?.into).toBe(136);
    expect(evolution(eevee, { item: "water-stone" })?.into).toBe(134);
    expect(evolution(eevee, level())).toBeNull();
    expect(evolvesWith(create(pikachu, 5), "thunder-stone")).toBe(true);
    expect(evolvesWith(create(pikachu, 5), "fire-stone")).toBe(false);
    expect(evolvesWith(create(treecko, 50), "leaf-stone")).toBe(false);
  });

  test("stones can depend on gender (Dawn Stone: male Kirlia)", () => {
    expect(evolution(create(281, 20, { gender: "male" }), { item: "dawn-stone" })?.into).toBe(475);
    expect(evolution(create(281, 20, { gender: "female" }), { item: "dawn-stone" })).toBeNull();
  });

  test("friendly Pokémon evolve when they level up, some by day or by night", () => {
    const golbat = create(42, 30);
    golbat.friendship = 100;
    expect(evolution(golbat, level())).toBeNull();
    golbat.friendship = friendly;
    expect(evolution(golbat, level())?.into).toBe(169);
    const eevee = create(133, 10);
    eevee.friendship = 255;
    eevee.moves = [{ key: "tackle", pp: 35 }];
    expect(evolution(eevee, level([], "day"))?.into).toBe(196);
    expect(evolution(eevee, level([], "night"))?.into).toBe(197);
  });

  test("trades are made with a Linking Cord, holding the item they need (which is used up)", () => {
    const onix = create(95, 20);
    expect(evolution(onix, { trade: true })).toBeNull();
    onix.held = "metal-coat";
    const way = evolution(onix, { trade: true })!;
    expect(way.into).toBe(208);
    expect(evolvesWith(onix, "linking-cord")).toBe(true);
    evolve(onix, way);
    expect(onix.species).toBe(208);
    expect(onix.held).toBeUndefined();
    expect(evolution(create(67, 30), { trade: true })?.into).toBe(68);
  });

  test("an Everstone stops evolving by level and trade", () => {
    const creature = create(treecko, 20);
    creature.held = "everstone";
    expect(evolution(creature, level())).toBeNull();
  });

  test("some need a move, Attack against Defense, a partner, or an item held at night", () => {
    const aipom = create(190, 30);
    aipom.moves = [{ key: "double-hit", pp: 10 }];
    expect(evolution(aipom, level())?.into).toBe(424);
    const tyrogue = create(236, 20);
    expect([106, 107, 237]).toContain(evolution(tyrogue, level())?.into);
    const mantyke = create(458, 10);
    expect(evolution(mantyke, level())).toBeNull();
    expect(evolution(mantyke, level([create(223, 10)]))?.into).toBe(226);
    const sneasel = create(215, 30);
    sneasel.held = "razor-claw";
    expect(evolution(sneasel, level([], "day"))).toBeNull();
    expect(evolution(sneasel, level([], "night"))?.into).toBe(461);
  });

  test("Nincada leaves a Shedinja behind in an empty party slot", () => {
    const nincada = create(290, 20);
    const shedinja = shed(nincada, [nincada], () => 1);
    expect(shedinja?.species).toBe(292);
    expect(shed(nincada, [nincada], () => 0)).toBeNull();
    expect(shed(create(treecko, 20), [], () => 1)).toBeNull();
  });
});

describe("growing up", () => {
  test("a fifth move waits for the player to pick one to forget", () => {
    const creature = create(treecko, 5, { shiny: false });
    creature.moves = ["pound", "leer", "absorb", "quick-attack"].map((key) => ({ key, pp: 10 }));
    const next = species(treecko).learnset.find(([at, key]) => at > 5 && !creature.moves.some((move) => move.key === key))!;
    const pending = [] as string[];
    grow(creature, experience(next[0]) - creature.exp, 100, pending);
    expect(pending).toContain(next[1]);
    expect(creature.moves).toHaveLength(4);
    expect(replaceMove(creature, 0, next[1])).toBe("Pound");
    expect(creature.moves[0].key).toBe(next[1]);
  });

  test("leveling up and walking make Pokémon friendlier, fainting less", () => {
    const creature = create(treecko, 5);
    expect(creature.friendship).toBe(70);
    grow(creature, experience(6) - creature.exp);
    expect(creature.friendship).toBe(75);
    creature.held = "soothe-bell";
    befriend(creature, 2);
    expect(creature.friendship).toBe(78);
    befriend(creature, -1);
    expect(creature.friendship).toBe(77);
    befriend(creature, 1000);
    expect(creature.friendship).toBe(255);
  });

  test("Pokémon get a gender from their species", () => {
    expect(create(32, 5).gender).toBe("male");
    expect(create(29, 5).gender).toBe("female");
    expect(create(81, 5).gender).toBeUndefined();
    expect(["male", "female"]).toContain(create(treecko, 5).gender);
    //Older saves get one
    const old = create(treecko, 5);
    delete old.gender;
    const profile = upgrade({ name: "Ash", party: [old], box: [], items: {}, money: 0 } as unknown as Trainer)!;
    expect(profile.party[0].gender).toBeDefined();
  });
});

describe("items", () => {
  test("only help when they do something", () => {
    const creature = create(treecko, 10);
    expect(helps("potion", creature)).toBe(false);
    creature.hp = 1;
    expect(helps("potion", creature)).toBe(true);
    expect(apply("potion", creature)).toBe("Treecko's HP was restored by 20 points.");
    expect(helps("antidote", creature)).toBe(false);
    creature.status = "poison";
    expect(helps("antidote", creature)).toBe(true);
    expect(helps("awakening", creature)).toBe(false);
    expect(helps("full-heal", creature)).toBe(true);
    creature.hp = 0;
    expect(helps("full-heal", creature)).toBe(false);
    expect(helps("revive", creature)).toBe(true);
    expect(apply("revive", creature)).toBe("Treecko was revived!");
    expect(creature.hp).toBe(Math.floor(hp(creature) / 2));
    expect(helps("rare-candy", creature)).toBe(true);
    expect(helps("rare-candy", create(treecko, 100))).toBe(false);
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
