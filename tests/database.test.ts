import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const sql = readdirSync("supabase/migrations")
  .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
  .join("\n");

describe("database migration", () => {
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map(([, name]) => name);

  test("creates the tables the app uses", () => {
    expect(tables).toEqual(expect.arrayContaining(["profiles", "cities", "likes", "trainers"]));
  });

  test("every table has row level security turned on", () => {
    for (const table of tables) {
      expect(sql, table).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
  });

  test("uploads accept every image format the editor offers", async () => {
    const { imageTypes } = await import("@/game/session");
    const allowed = new Set([...sql.matchAll(/'(image\/\w+)'/g)].map(([, type]) => type));
    for (const type of imageTypes) {
      expect(allowed, type).toContain(type);
    }
  });

  test("security definer functions pin their search path", () => {
    const functions = sql
      .split(/create or replace function /)
      .slice(1)
      .filter((body) => /security definer/.test(body.split(/\$\$/)[0]));
    expect(functions.length).toBeGreaterThan(0);
    for (const body of functions) {
      expect(body.split(/\$\$/)[0], body.split("(")[0]).toMatch(/set search_path/);
    }
  });
});
