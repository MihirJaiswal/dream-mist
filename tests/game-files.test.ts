import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const json = (path: string) => JSON.parse(readFileSync(`public/game/${path}`, "utf8"));

describe("game data files", () => {
  test("the Pokédex has every Pokémon in order, with known moves and types", () => {
    const { pokedex, moves, types } = json("data/city/pokedex.json");
    expect(pokedex).toHaveLength(1025);
    pokedex.forEach((entry: { id: number }, i: number) => expect(entry.id).toBe(i + 1));
    expect(Object.keys(types)).toHaveLength(18);
    for (const { types: kinds, stats, learnset } of pokedex) {
      expect(stats).toHaveLength(6);
      for (const kind of kinds) {
        expect(types).toHaveProperty(kind);
      }
      for (const [, move] of learnset) {
        expect(moves).toHaveProperty(move);
      }
    }
    expect(moves).toHaveProperty("tackle");
  });

  test("tiles know their usual layer, and the common ones are right", () => {
    const { layers } = json("data/city/tiles.json");
    const ground = new Set(layers.ground), above = new Set(layers.above);
    //Grass and sand paths are ground; trees and the house roof are objects
    for (const frame of [113, 4977]) {
      expect(ground.has(frame), `${frame}`).toBe(true);
    }
    for (const frame of [211, 324, 2734]) {
      expect(ground.has(frame) || above.has(frame), `${frame}`).toBe(false);
    }
    expect([...ground].some((frame) => above.has(frame))).toBe(false);
  });

  test("walkable tiles are a sorted list of tile numbers", () => {
    const { walkable } = json("data/city/tiles.json");
    expect(walkable.length).toBeGreaterThan(100);
    expect([...walkable].sort((a: number, b: number) => a - b)).toEqual(walkable);
    expect(new Set(walkable).size).toBe(walkable.length);
  });

  test("every Hoenn section listed has its map file", () => {
    const { sections } = json("data/maps/hoenn.json");
    expect(sections.length).toBeGreaterThan(100);
    for (const { id } of sections) {
      expect(existsSync(`public/game/data/maps/${id}.json`), id).toBe(true);
    }
  });

  test("textures and audio the game loads exist", () => {
    for (const file of ["textures/rse/tileset.json", "textures/rse/npcs.json", "textures/rse/creatures.json", "data/textures/rse/tileset.json", "audio/town.m4a", "audio/battle.m4a", "audio/hit.m4a", "audio/hit2.m4a", "audio/victory.m4a"]) {
      expect(existsSync(`public/game/${file}`), file).toBe(true);
    }
  });
});
