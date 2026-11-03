// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { sanitize } from "@/game/data";
import { problems } from "@/game/problems";
import { reachable } from "@/game/region";
import { teamOf } from "@/game/trainer";

/** The builder script inside the agent guide (public/agents.md), run the way an agent would */
function build() {
  const guide = readFileSync(join(__dirname, "../public/agents.md"), "utf8");
  const script = guide.match(/```js\n([\s\S]*?)\n```/)?.[1];
  if (!script) {
    throw new Error("No builder script in the agent guide");
  }
  const dir = mkdtempSync(join(tmpdir(), "dreammist-guide-"));
  writeFileSync(join(dir, "build-town.mjs"), script);
  return JSON.parse(execFileSync(process.execPath, [join(dir, "build-town.mjs")], { encoding: "utf8" }));
}

describe("agent guide", () => {
  test("its example game imports with no problems", () => {
    const city = sanitize(build());
    expect(problems(city)).toEqual([]);
    expect(city.interiors.map(({ name }) => name)).toEqual(["Your House", "Birch Lab", "Pokémon Center", "Poké Mart", "Mistwood Gym", "Route 101"]);
    expect(city.story).toHaveLength(6);
    expect(city.quests).toHaveLength(1);
  });

  test("its example uses ledges, items and a cutscene", () => {
    const city = sanitize(build());
    const route = city.interiors.find(({ name }) => name === "Route 101")!;
    expect(route.behavior.filter((value) => value === 1)).toHaveLength(7);
    expect(route.npcs.filter(({ role }) => role === "item").map(({ hidden }) => Boolean(hidden))).toEqual([false, true]);
    const lab = city.interiors.find(({ name }) => name === "Birch Lab")!;
    expect(lab.triggers[0].actions.map((action) => action.do)).toEqual(["come", "say"]);
  });

  test("its gym leader has a designed battle", () => {
    const city = sanitize(build());
    const gym = city.interiors.find(({ name }) => name === "Mistwood Gym")!;
    const leader = gym.npcs.find(({ trainer }) => trainer?.gym)!;
    const team = teamOf(leader.trainer!.team);
    expect(team[1]).toMatchObject({ nickname: "Bubbles", ability: "huge-power", nature: "adamant", held: "oran-berry" });
    expect(team[1].moves.map(({ key }) => key)).toEqual(["water-gun", "tackle", "defense-curl"]);
    expect(leader.trainer!.rules).toEqual({ scene: "pond_water", weather: "rain" });
  });

  test("its route can be walked to from the town", () => {
    const city = sanitize(build());
    expect([...reachable(city)].map(({ name }) => name)).toContain("Route 101");
  });
});
