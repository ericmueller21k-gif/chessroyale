import { describe, expect, it } from "vitest";
import { XP } from "../src/settings.ts";
import { XP_NONE_LINES, gameXp, isXpNone, levelOf, levelProgress, xpAt, xpDayStart, xpFillMs, xpGrant, xpInLevel, xpParts, xpStretches } from "../src/xp.ts";

const min = 60_000;
const counted = { ms: 12 * min + 40_000, moves: XP.minMoves, won: false };

describe("XP and levels (Eric, Nov 9)", () => {
  it("levels: Level 1 at 0, one more every 1,000 XP, linear and with no top", () => {
    expect(XP.perLevel).toBe(1000);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(999)).toBe(1);
    expect(levelOf(1000)).toBe(2);
    expect(levelOf(6_500)).toBe(7);
    expect(levelOf(1_000_000)).toBe(1001);
    expect(levelOf(-5)).toBe(1);
    expect(xpInLevel(6_500)).toBe(500);
    expect(levelProgress(6_750)).toBe(0.75);
  });

  it("a game's XP: 10 a whole minute, minutes capped at 30, plus 50 for a win", () => {
    expect(gameXp(counted)).toEqual({ minutes: 12, time: 120, win: 0 });
    expect(gameXp({ ...counted, won: true })).toEqual({ minutes: 12, time: 120, win: 50 });
    expect(gameXp({ ...counted, ms: 95 * min })).toEqual({ minutes: 30, time: 300, win: 0 });
    expect(gameXp({ ...counted, ms: 59_999 })).toEqual({ minutes: 0, time: 0, win: 0 });
    expect(gameXp({ ...counted, ms: -1 })).toEqual({ minutes: 0, time: 0, win: 0 });
  });

  it("it counts only from 10 of your own moves: else none, ended early or resigned early", () => {
    expect(gameXp({ ...counted, moves: XP.minMoves - 1 })).toEqual({ none: "short" });
    expect(gameXp({ ...counted, moves: 3, won: true })).toEqual({ none: "short" });
    expect(gameXp({ ...counted, moves: 3, resigned: true })).toEqual({ none: "resigned" });
    expect(gameXp({ ...counted, moves: NaN })).toEqual({ none: "short" });
    // (A resign after the minimum is a counted loss.)
    expect(gameXp({ ...counted, resigned: true })).toEqual({ minutes: 12, time: 120, win: 0 });
  });

  it("no XP for leaving, a guest, a test game or a banned account, in that order of what's said", () => {
    expect(gameXp({ ...counted, abandoned: true })).toEqual({ none: "left" });
    expect(gameXp({ ...counted, guest: true, abandoned: true })).toEqual({ none: "guest" });
    expect(gameXp({ ...counted, test: true })).toEqual({ none: "test" });
    expect(gameXp({ ...counted, banned: true, test: true })).toEqual({ none: "banned" });
    expect(gameXp({ ...counted, test: true, abandoned: true, moves: 0 })).toEqual({ none: "test" });
  });

  it("every reason has its plain line", () => {
    expect(XP_NONE_LINES).toEqual({
      short: "No XP: the game ended before move 10.",
      resigned: "No XP: you resigned before move 10.",
      left: "No XP: you left the match.",
      guest: "Sign in to earn XP.",
      test: "No XP: test game.",
      banned: "No XP: this account is banned.",
      limit: "No XP: daily solo limit reached.",
    });
    expect(isXpNone("left")).toBe(true);
    expect(isXpNone("toString")).toBe(false);
    expect(isXpNone(1)).toBe(false);
  });

  it("the parts: the minutes, then the win; a win the cap held back shows at +0; nothing for 0 minutes", () => {
    expect(xpParts({ minutes: 12, time: 120, win: 50 })).toEqual([
      { label: "12 min", xp: 120 },
      { label: "Win", xp: 50 },
    ]);
    expect(xpParts({ minutes: 12, time: 120, win: 50 }, false)).toEqual([
      { label: "12 min", xp: 120 },
      { label: "Win (paid once today)", xp: 0 },
    ]);
    expect(xpParts({ minutes: 0, time: 0, win: 0 })).toEqual([]);
    // (Solo's daily minutes trimmed the time: what was left, or +0, says so. Review M2.)
    expect(xpParts({ minutes: 12, time: 120, win: 0 }, true, 40)).toEqual([{ label: "Daily solo limit", xp: 40 }]);
    // (A held-back win beside it: left out, so the line fits a phone.)
    expect(xpParts({ minutes: 30, time: 300, win: 50 }, false, 300 - 10)).toEqual([{ label: "Daily solo limit", xp: 290 }]);
    expect(xpParts({ minutes: 12, time: 120, win: 50 }, true, 0)).toEqual([
      { label: "Daily solo limit", xp: 0 },
      { label: "Win", xp: 50 },
    ]);
  });

  it("a grant: before, after and both levels; none keeps the XP where it was", () => {
    expect(xpGrant(6_900, [{ label: "12 min", xp: 120 }, { label: "Win", xp: 50 }])).toEqual({
      before: 6_900,
      after: 7_070,
      levelBefore: 7,
      levelAfter: 8,
      parts: [
        { label: "12 min", xp: 120 },
        { label: "Win", xp: 50 },
      ],
    });
    expect(xpGrant(500, [{ label: "x", xp: 5 }], "test")).toEqual({ before: 500, after: 500, levelBefore: 1, levelAfter: 1, parts: [], none: "test" });
  });

  it("the XP day starts at 08:00 UTC (midnight Pacific) for everyone", () => {
    const at = Date.UTC(2026, 10, 9, 12, 0);
    expect(xpDayStart(at)).toBe(Date.UTC(2026, 10, 9, 8, 0));
    expect(xpDayStart(Date.UTC(2026, 10, 9, 7, 59))).toBe(Date.UTC(2026, 10, 8, 8, 0));
    expect(xpDayStart(Date.UTC(2026, 10, 9, 8, 0))).toBe(Date.UTC(2026, 10, 9, 8, 0));
  });
});

describe("the XP box's fill (Eric, Nov 9: it never skips)", () => {
  it("the stretches: within a level one; a level-up fills to the end and goes on from empty", () => {
    expect(xpStretches(6_200, 6_370)).toEqual([{ level: 7, from: 0.2, to: 0.37 }]);
    expect(xpStretches(6_900, 7_070)).toEqual([
      { level: 7, from: 0.9, to: 1 },
      { level: 8, from: 0, to: 0.07 },
    ]);
    expect(xpStretches(900, 1000)).toEqual([
      { level: 1, from: 0.9, to: 1 },
      { level: 2, from: 0, to: 0 },
    ]);
    expect(xpStretches(500, 500)).toEqual([{ level: 1, from: 0.5, to: 0.5 }]);
  });

  it("its length: 1.5 s up to 2.5 s, longer for more XP; nothing to fill, none", () => {
    expect(xpFillMs(0)).toBe(0);
    expect(xpFillMs(1)).toBeGreaterThanOrEqual(XP.fillMs.min);
    expect(xpFillMs(170)).toBeGreaterThan(xpFillMs(50));
    expect(xpFillMs(5_000)).toBe(XP.fillMs.max);
  });

  it("sampled every frame it only rises, by small steps; a level-up reaches the end and starts again from empty", () => {
    const before = 6_900;
    const after = 7_070;
    const ms = xpFillMs(after - before);
    let last = xpAt(before, after, 0, ms);
    expect(last).toEqual({ xp: before, level: 7, share: 0.9 });
    let wraps = 0;
    for (let t = 16; t <= ms + 16; t += 16) {
      const now = xpAt(before, after, t, ms);
      expect(now.xp).toBeGreaterThanOrEqual(last.xp);
      if (now.level === last.level) {
        expect(now.share).toBeGreaterThanOrEqual(last.share);
        // (A 60 fps frame moves the bar no more than 2% of its length.)
        expect(now.share - last.share).toBeLessThan(0.02);
      } else {
        wraps++;
        expect(now.level).toBe(last.level + 1);
        expect(last.share).toBeGreaterThan(0.98);
        expect(now.share).toBeLessThan(0.02);
      }
      last = now;
    }
    expect(wraps).toBe(1);
    expect(last).toEqual({ xp: after, level: 8, share: 0.07 });
  });

  it("the end of a fill is exactly the grant's XP; nothing gained stays put", () => {
    expect(xpAt(100, 280, 99_999)).toEqual({ xp: 280, level: 1, share: 0.28 });
    expect(xpAt(500, 500, 0)).toEqual({ xp: 500, level: 1, share: 0.5 });
  });
});
