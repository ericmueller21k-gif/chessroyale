import { describe, expect, it } from "vitest";
import { mulberry32 } from "@chessroyale/core";
import { BOT_NAMES, botRoster } from "../src/bots.ts";

describe("bot names", () => {
  it("enough names that a 100-player Crowd lobby (99 bots) never repeats one", () => {
    expect(new Set(BOT_NAMES).size).toBe(BOT_NAMES.length);
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(99);
    for (let seed = 1; seed <= 25; seed++) {
      const names = botRoster(mulberry32(seed), 99).map((b) => b.name);
      expect(new Set(names).size).toBe(99);
      // No numbered fallback ("Queenie 2").
      expect(names.filter((n) => / \d+$/.test(n))).toEqual([]);
    }
  });

  it("short enough for the scoreboard on a 360 px phone (no longer than the longest there already)", () => {
    for (const n of BOT_NAMES) expect(n.length).toBeLessThanOrEqual(20);
  });

  it("past the list, names repeat with a number, still all different", () => {
    const names = botRoster(mulberry32(2), BOT_NAMES.length + 30).map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => / 2$/.test(n))).toHaveLength(30);
  });
});
