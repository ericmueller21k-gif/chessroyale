import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, POWER_IDS, playableBosses } from "@chessroyale/core";
import { POWER_WORDS, powersLine } from "../src/power-words.ts";

describe("the boss menu's cards: each boss's powers in words", () => {
  it("has words for every power there is", () => {
    for (const id of POWER_IDS) expect(POWER_WORDS[id]?.trim(), id).toBeTruthy();
  });

  it("reads 'passive · ultimate' for every boss with powers, never 'undefined'", () => {
    for (const b of BOSS_ROSTER) {
      if (!b.powers) continue;
      const line = powersLine(b);
      expect(line, b.name).not.toMatch(/undefined|null/);
      const parts = line.split(" · ");
      expect(parts, b.name).toHaveLength(2);
      expect(parts[0], `${b.name}: ${b.powers.passive}`).toBe(POWER_WORDS[b.powers.passive]);
      expect(parts[1], `${b.name}: ${b.powers.ultimate}`).toBe(POWER_WORDS[b.powers.ultimate]);
    }
  });

  it("gives every boss the menu lists a line (Hollow's included)", () => {
    const listed = playableBosses();
    expect(listed.map((b) => b.id)).toContain("hollow");
    for (const b of listed) expect(powersLine(b), b.name).toMatch(/^\S.* · \S.*$/);
    expect(powersLine(listed.find((b) => b.id === "hollow")!)).toBe("darkens a square · lights out");
  });
});
