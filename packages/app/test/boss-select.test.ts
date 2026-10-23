import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, hiddenBosses, menuBosses } from "@chessroyale/core";
import { rowSizes, SELECT_LINES, SELECT_SOUND, selectLine, TILES_PER_ROW } from "../src/characters/boss-select.ts";
import { bossKit } from "../src/characters/kits.ts";

/** The Boss raid screen's character select: each boss's sound and lines (docs/decisions/2026-10-16-boss-character-select.md). */
describe("the boss select", () => {
  const all = [...menuBosses({ admin: false, raid: true }), ...hiddenBosses()];

  it("has a sound from its own pack and lines for every boss with a tile, the Hidden Boss's too", () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const b of all) {
      // (One of its own pack: its character's or its powers' effects', all named for it: clownSplat is the pie's.)
      const pack = Object.values(bossKit(b.name)!.sounds)[0]!.match(/^[a-z]+/)![0];
      expect(SELECT_SOUND[b.id], b.id).toMatch(new RegExp(`^${pack}[A-Z]`));
      expect(SELECT_LINES[b.id]?.length ?? 0, b.id).toBeGreaterThanOrEqual(2);
    }
    // Nothing for a boss that isn't in the roster.
    for (const id of [...Object.keys(SELECT_SOUND), ...Object.keys(SELECT_LINES)]) expect(BOSS_ROSTER.some((b) => b.id === id), id).toBe(true);
  });

  it("uses each boss's own lines (until Eric approves new ones), except the Hidden Boss's two, Eric's, and Chub & Chirp's, from their lines' draft", () => {
    for (const b of menuBosses({ admin: false, raid: true })) {
      // (Chub & Chirp's are the draft's `CHC-select` lines, as written: docs/decisions/2026-10-18-hopper-wired.md.)
      if (b.id === "hopper") continue;
      const own = new Set(Object.values(bossKit(b.name)!.lines).flat());
      for (const l of SELECT_LINES[b.id]!) expect(own.has(l), `${b.id}: "${l}"`).toBe(true);
    }
    expect(SELECT_LINES.recluse).toEqual(["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."]);
    expect(SELECT_LINES.hopper).toEqual(["Chub and Chirp! Best friends!", "He's Chirp. I'm Chub. We hop.", "Got any carrots?"]);
  });

  it("never says the same line twice running; the Hidden Boss's two go in turn", () => {
    for (const b of menuBosses({ admin: false, raid: true })) {
      let last: string | null = null;
      for (let i = 0; i < 40; i++) {
        const l = selectLine(b.id, last, (i * 0.37) % 1)!;
        expect(l).not.toBe(last);
        expect(SELECT_LINES[b.id]).toContain(l);
        last = l;
      }
    }
    const first = selectLine("recluse", null)!;
    const second = selectLine("recluse", first)!;
    expect([first, second]).toEqual(SELECT_LINES.recluse);
    expect(selectLine("recluse", second)).toBe(first);
    expect(selectLine("nobody", null)).toBeNull();
  });

  it("never names the Hidden Boss in his lines", () => {
    for (const l of SELECT_LINES.recluse!) expect(l).not.toMatch(/Fischer|Soviet|Russian/i);
  });

  it("shares the tiles out over as few rows as it takes, evenly, the longer rows first (docs/decisions/2026-10-23-boss-select-grid.md)", () => {
    const { phone, wide } = TILES_PER_ROW;
    // Today's fourteen tiles (twelve bosses, the Hidden Boss's and "?"): 5, 5, 4 on a phone, 7, 7 on a wide column.
    expect(all.length + 1).toBe(14);
    expect(rowSizes(all.length + 1, phone)).toEqual([5, 5, 4]);
    expect(rowSizes(all.length + 1, wide)).toEqual([7, 7]);
    // The next bosses: never a tile alone on a row.
    expect(rowSizes(15, phone)).toEqual([5, 5, 5]);
    expect(rowSizes(15, wide)).toEqual([5, 5, 5]);
    expect(rowSizes(16, phone)).toEqual([4, 4, 4, 4]);
    expect(rowSizes(16, wide)).toEqual([6, 5, 5]);
    expect(rowSizes(0, phone)).toEqual([]);
    for (const per of [phone, wide]) {
      for (let n = 1; n <= 60; n++) {
        const rows = rowSizes(n, per);
        expect(rows.reduce((a, b) => a + b, 0), `${n} in ${per}s`).toBe(n);
        expect(Math.max(...rows), `${n} in ${per}s`).toBeLessThanOrEqual(per);
        expect(Math.max(...rows) - Math.min(...rows), `${n} in ${per}s`).toBeLessThanOrEqual(1);
        expect(rows, `${n} in ${per}s: the longer rows first`).toEqual([...rows].sort((a, b) => b - a));
        if (n > 1) expect(Math.min(...rows), `${n} in ${per}s: no tile alone`).toBeGreaterThan(1);
      }
    }
  });
});
