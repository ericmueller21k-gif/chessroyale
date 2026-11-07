import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { DASH_FX } from "@chessroyale/chess";
import { DASH_FIT_LINES, DASH_LINE_MAX, DASH_LOVE_LINES, DASH_POPOFF_LINES } from "../src/characters/dash-lines.ts";
import { DASH_UI, popOffMoments } from "../src/components/Dash.tsx";

/** Dash's clock lines (Eric, Nov 7; docs/decisions/2026-11-07-dash-clock.md): the multi-hit's, the pop-off's two beats. */
describe("Dash's clock lines (Eric, Nov 7)", () => {
  it("the multi-hit's lines: the five he had, and ten more about the clock (8 to 12 new)", () => {
    const added = DASH_FIT_LINES.length - 5;
    expect(added).toBeGreaterThanOrEqual(8);
    expect(added).toBeLessThanOrEqual(12);
  });

  it("two or three pop-off lines and two or three love-the-clock lines", () => {
    expect(DASH_POPOFF_LINES.length).toBeGreaterThanOrEqual(2);
    expect(DASH_POPOFF_LINES.length).toBeLessThanOrEqual(3);
    expect(DASH_LOVE_LINES.length).toBeGreaterThanOrEqual(2);
    expect(DASH_LOVE_LINES.length).toBeLessThanOrEqual(3);
    expect(DASH_POPOFF_LINES.join(" ")).toMatch(/pop off/);
  });

  it("every line fits the two-row bubble (at most DASH_LINE_MAX characters), none empty, none repeated", () => {
    const all = [...DASH_FIT_LINES, ...DASH_POPOFF_LINES, ...DASH_LOVE_LINES];
    for (const line of all) {
      expect(line.length, line).toBeGreaterThan(0);
      expect(line.length, line).toBeLessThanOrEqual(DASH_LINE_MAX);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it("a clock line each time his multi-hit comes, the same on every screen by the moment's key", () => {
    const line = DASH_UI.moments.clockFit!.line!;
    for (let i = 0; i < 50; i++) {
      const m = { kind: "clockFit" as const, key: `dash:clockFit:${i * 4}`, at: 0, ms: DASH_FX.clockFit };
      const text = line(null, m as never);
      expect(DASH_FIT_LINES).toContain(text);
      expect(line(null, m as never)).toBe(text);
    }
  });

  it("the pop-off's beats: the pop-off line, then the love line, each its own moment, the whole 4 to 6 s", () => {
    const boss = { id: "dash", crowdMoves: 8, startMove: 1, powers: { turn: 9, dash: { popOff: { at: 9 } } } };
    const [a, b] = popOffMoments(boss as never, 1000);
    expect(popOffMoments({ ...boss, powers: { ...boss.powers, turn: 10 } } as never, 1000)).toEqual([]);
    expect(a).toMatchObject({ kind: "popOff", at: 1000, ms: BOSS_POWERS.dashPopOff.popMs });
    expect(b).toMatchObject({ kind: "popOffFast", at: 1000 + BOSS_POWERS.dashPopOff.popMs, ms: BOSS_POWERS.dashPopOff.loveMs });
    // (A screen drawn again carries on: the same start.)
    expect(popOffMoments(boss as never, 5000)[0]!.at).toBe(1000);
    expect(DASH_UI.moments.popOff!.line!(null, a as never)).toBeTruthy();
    expect(DASH_POPOFF_LINES).toContain(DASH_UI.moments.popOff!.line!(null, a as never));
    expect(DASH_LOVE_LINES).toContain(DASH_UI.moments.popOffFast!.line!(null, b as never));
  });
});
