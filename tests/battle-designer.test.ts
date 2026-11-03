import { describe, expect, test, vi } from "vitest";
import { trainerRules } from "@/game/battle";
import { storage } from "@/game/data";
import { learned, teamOf, type Trainer, trainer } from "@/game/trainer";

const [treecko, pikachu] = [252, 25];

describe("trainer teams", () => {
  test("chosen moves, ability, nature, item, nickname and shine are kept", () => {
    const [creature] = teamOf([
      {
        species: pikachu,
        level: 20,
        moves: ["thunder-shock", "quick-attack", "not-a-move"],
        ability: "static",
        nature: "timid",
        held: "magnet",
        nickname: "Sparky",
        shiny: true,
      },
    ]);
    expect(creature.moves.map(({ key }) => key)).toEqual(["thunder-shock", "quick-attack"]);
    expect(creature).toMatchObject({ ability: "static", nature: "timid", held: "magnet", nickname: "Sparky", shiny: true });
  });

  test("anything not chosen is automatic, and wrong choices are ignored", () => {
    const [creature] = teamOf([{ species: treecko, level: 12, ability: "levitate", held: "rare-candy" as never }]);
    expect(creature.moves.map(({ key }) => key)).toEqual(learned(treecko, 12));
    expect(creature.ability).toBe("overgrow");
    expect(creature.held).toBeUndefined();
    expect(creature.shiny).toBe(false);
    expect(teamOf([{ species: 99999, level: 5 }])).toEqual([]);
  });
});

describe("trainer battle rules", () => {
  test("override the town and the map, and clear weather means none", () => {
    const base = { difficulty: "easy" as const, weather: "rain" as const, cap: 30 };
    expect(trainerRules(base)).toEqual(base);
    expect(trainerRules(base, { difficulty: "hard", weather: "clear", scene: "cave", noItems: true })).toEqual({
      difficulty: "hard",
      weather: null,
      cap: 30,
      scene: "cave",
      noItems: true,
    });
    expect(trainerRules(base, { weather: "snow" }).weather).toBe("snow");
  });
});

describe("test battles", () => {
  test("run with a stand-in trainer that is never saved, then the real one is back", async () => {
    const save = vi.spyOn(storage, "set");
    const real = trainer.profile;
    const stand = { name: "Tester", party: [], box: [] } as unknown as Trainer;
    const seen = await trainer.sandbox(stand, async () => {
      trainer.save();
      return trainer.profile?.name;
    });
    expect(seen).toBe("Tester");
    expect(save).not.toHaveBeenCalled();
    expect(trainer.profile).toBe(real);
    expect(trainer.testing).toBe(false);
    save.mockRestore();
  });
});
