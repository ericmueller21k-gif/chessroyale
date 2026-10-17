import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, hiddenBosses, menuBosses } from "@chessroyale/core";
import { SELECT_LINES, SELECT_SOUND, selectLine } from "../src/characters/boss-select.ts";
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

  it("uses each boss's own lines (until Eric approves new ones), except the Hidden Boss's two, Eric's", () => {
    for (const b of menuBosses({ admin: false, raid: true })) {
      const own = new Set(Object.values(bossKit(b.name)!.lines).flat());
      for (const l of SELECT_LINES[b.id]!) expect(own.has(l), `${b.id}: "${l}"`).toBe(true);
    }
    expect(SELECT_LINES.recluse).toEqual(["Team up on me. It wouldn't be the first time anyone did that.", "You're not ready to fight me yet."]);
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
});
