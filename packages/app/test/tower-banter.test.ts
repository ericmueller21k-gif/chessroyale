import { describe, expect, it } from "vitest";
import { BATTLE_TOWER, BOSS_ROSTER, towerPool } from "@chessroyale/core";
import { CLERK_LINES, TOWER_BANTER } from "../src/characters/tower-banter.ts";

/**
 * The tower's bosses who share floors: the playable ones (towerPool), but a boss of his own floors (the Stranger: alone on 10, 30 and 50,
 * never beside another, so never in banter). The Hidden Boss is never among them.
 */
const pool = towerPool().filter((id) => !Object.values(BATTLE_TOWER.bossFloors).includes(id));
/** The Hidden Boss's name, read from the roster (never written here). */
const hidden = BOSS_ROSTER.find((b) => b.id === "recluse")!.name.toLowerCase();

describe("tower banter", () => {
  it("covers only the tower's playable bosses, never the Hidden Boss", () => {
    expect(pool.length).toBeGreaterThan(1);
    expect(pool).not.toContain("recluse");
  });

  it("every tower boss speaks to every other: at least 2 lines each", () => {
    for (const a of pool) {
      for (const b of pool) {
        if (a === b) continue;
        const lines = TOWER_BANTER[a]?.[b];
        expect(lines, `${a} to ${b}`).toBeDefined();
        expect(lines!.length, `${a} to ${b}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("every line is non-empty, at most 80 characters, and never names the Hidden Boss", () => {
    for (const [a, targets] of Object.entries(TOWER_BANTER)) {
      for (const [b, lines] of Object.entries(targets)) {
        for (const line of lines) {
          expect(line.trim().length, `${a} to ${b}: "${line}"`).toBeGreaterThan(0);
          expect(line.length, `${a} to ${b}: "${line}"`).toBeLessThanOrEqual(80);
          expect(line.toLowerCase(), `${a} to ${b}`).not.toContain(hidden);
        }
      }
    }
  });

  it("the clerk has at least 6 lines for each moment", () => {
    for (const key of ["goingUp", "backWon", "backLost", "runOver", "firstVisit"] as const) {
      expect(CLERK_LINES[key].length, key).toBeGreaterThanOrEqual(6);
      for (const line of CLERK_LINES[key]) {
        expect(line.trim().length, key).toBeGreaterThan(0);
        expect(line.length, key).toBeLessThanOrEqual(80);
      }
    }
  });
});
