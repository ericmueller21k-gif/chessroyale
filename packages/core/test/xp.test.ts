import { describe, expect, it } from "vitest";
import { END_SCREEN, XP } from "../src/settings.ts";
import { XP_NONE_LINES, crateCount, everyLevel, gameXp, isXpNone, levelOf, levelProgress, levelReward, readRewards, rewardLines, xpAt, xpDayStart, xpFillMs, xpGrant, xpPingHz, xpInLevel, xpParts, xpShownParts, xpStretches } from "../src/xp.ts";
import { pausedLine, pauseVariable } from "../src/pauses.ts";

const min = 60_000;
const counted = { ms: 12 * min + 40_000, moves: XP.minMoves, won: false };

describe("XP and levels (Eric, Nov 9)", () => {
  it("levels: Level 1 at 0, one more every 500 XP (Nov 20; 1,000 before), linear and with no top", () => {
    expect(XP.perLevel).toBe(500);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(499)).toBe(1);
    expect(levelOf(500)).toBe(2);
    expect(levelOf(6_500)).toBe(14);
    expect(levelOf(1_000_000)).toBe(2001);
    expect(levelOf(-5)).toBe(1);
    expect(xpInLevel(6_750)).toBe(250);
    expect(levelProgress(6_875)).toBe(0.75);
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
      paused: "Rewards are paused for a moment.",
    });
    expect(isXpNone("left")).toBe(true);
    expect(isXpNone("toString")).toBe(false);
    expect(isXpNone(1)).toBe(false);
  });

  it("the parts as a screen shows them: never the minutes (Eric, Nov 9); the daily limit as words alone; the win as it is", () => {
    expect(xpShownParts(xpParts({ minutes: 12, time: 120, win: 50 }))).toEqual([{ label: "Win", xp: 50, of: 1 }]);
    expect(xpShownParts(xpParts({ minutes: 12, time: 120, win: 0 }))).toEqual([]);
    expect(xpShownParts(xpParts({ minutes: 12, time: 120, win: 50 }, true, 0))).toEqual([
      { label: "Daily solo limit", xp: null, of: 0 },
      { label: "Win", xp: 50, of: 1 },
    ]);
    expect(xpShownParts(xpParts({ minutes: 30, time: 300, win: 50 }, false))).toEqual([{ label: "Win (paid once today)", xp: 0, of: 1 }]);
    for (const m of [1, 9, 30]) expect(xpShownParts([{ label: `${m} min`, xp: m * 10 }])).toEqual([]);
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
      levelBefore: 14,
      levelAfter: 15,
      parts: [
        { label: "12 min", xp: 120 },
        { label: "Win", xp: 50 },
      ],
    });
    expect(xpGrant(500, [{ label: "x", xp: 5 }], "test")).toEqual({ before: 500, after: 500, levelBefore: 2, levelAfter: 2, parts: [], none: "test" });
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
    expect(xpStretches(6_200, 6_370)).toEqual([{ level: 13, from: 0.4, to: 0.74 }]);
    expect(xpStretches(6_900, 7_070)).toEqual([
      { level: 14, from: 0.8, to: 1 },
      { level: 15, from: 0, to: 0.14 },
    ]);
    expect(xpStretches(900, 1000)).toEqual([
      { level: 2, from: 0.8, to: 1 },
      { level: 3, from: 0, to: 0 },
    ]);
    expect(xpStretches(250, 250)).toEqual([{ level: 1, from: 0.5, to: 0.5 }]);
  });

  it("its length: 1.5 s up to 2.5 s, longer for more XP; nothing to fill, none", () => {
    expect(xpFillMs(0)).toBe(0);
    expect(xpFillMs(1)).toBeGreaterThanOrEqual(XP.fillMs.min);
    expect(xpFillMs(170)).toBeGreaterThan(xpFillMs(50));
    expect(xpFillMs(5_000)).toBe(XP.fillMs.max);
  });

  it("the end screen's pings (Eric, Nov 20: \"it sounds like it jumps\"): the pitch follows the XP counted so far, a smooth rise from C6 up a major sixth that a top game holds for about a second; a 100 XP game only climbs a little; the count-up's an octave down", () => {
    const { hz, semitones, topXp, holdMs } = END_SCREEN.ping;
    const top = hz * 2 ** (semitones / 12);
    const semis = (f: number) => 12 * Math.log2(f / hz);
    expect(xpPingHz(0)).toBeCloseTo(1046.5, 1);
    expect(semitones).toBe(9);
    // (Smooth: never down, and no step of a semitone or more between one XP and the next.)
    for (let xp = 1; xp <= 600; xp++) {
      expect(xpPingHz(xp)).toBeGreaterThanOrEqual(xpPingHz(xp - 1));
      expect(semis(xpPingHz(xp)) - semis(xpPingHz(xp - 1))).toBeLessThan(0.1);
    }
    // A 100 XP game: a little over half the way; a top game: the top, and held past it.
    expect(semis(xpPingHz(100))).toBeGreaterThan(3);
    expect(semis(xpPingHz(100))).toBeLessThan(5.5);
    expect(xpPingHz(topXp)).toBeCloseTo(top, 3);
    expect(xpPingHz(5_000)).toBeCloseTo(top, 3);
    // The top is reached with about `holdMs` of a top game's fill left (the bar's ease in and out, as the end screen fills it).
    const ms = END_SCREEN.fillMs.max;
    let reached = ms;
    for (let t = ms; t >= 0; t -= 10) {
      const k = t / ms;
      if (xpPingHz(topXp * k * k * (3 - 2 * k)) < top - 0.01) break;
      reached = t;
    }
    expect(ms - reached).toBeGreaterThan(holdMs * 0.8);
    expect(ms - reached).toBeLessThan(holdMs * 1.3);
    expect(xpPingHz(120, true)).toBeCloseTo(xpPingHz(120) / 2, 6);
  });

  it("sampled every frame it only rises, by small steps; a level-up reaches the end and starts again from empty", () => {
    const before = 6_900;
    const after = 7_070;
    const ms = xpFillMs(after - before);
    let last = xpAt(before, after, 0, ms);
    expect(last).toEqual({ xp: before, level: 14, share: 0.8 });
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
    expect(last).toEqual({ xp: after, level: 15, share: 0.14 });
  });

  it("the end of a fill is exactly the grant's XP; nothing gained stays put", () => {
    expect(xpAt(100, 280, 99_999)).toEqual({ xp: 280, level: 1, share: 0.56 });
    expect(xpAt(250, 250, 0)).toEqual({ xp: 250, level: 1, share: 0.5 });
  });
});

describe("phase 2's rewards (Nov 9): the words and the numbers", () => {
  it("every 2nd level (Nov 20): XP.levelCrates crates and XP.levelKeys keys; every 20th also a boss crate to pick; nothing between", () => {
    expect([XP.levelRewardEvery, XP.bossCrateEvery]).toEqual([2, 20]);
    expect(levelReward(2)).toEqual({ crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0 });
    expect(levelReward(3)).toEqual({ crates: 0, keys: 0, bossPicks: 0 });
    expect(levelReward(10)).toEqual({ crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 0 });
    expect(levelReward(11)).toEqual({ crates: 0, keys: 0, bossPicks: 0 });
    expect(levelReward(20)).toEqual({ crates: XP.levelCrates, keys: XP.levelKeys, bossPicks: 1 });
    expect(levelReward(30).bossPicks).toBe(0);
    expect(levelReward(40).bossPicks).toBe(1);
  });

  it("the same rewards per XP as levels of 1,000 had (the director's call on Eric's \"adjust the prizes less\", Nov 20)", () => {
    const upTo = (xp: number) => Array.from({ length: levelOf(xp) - 1 }, (_, i) => levelReward(i + 2)).reduce((a, r) => ({ crates: a.crates + r.crates, picks: a.picks + r.bossPicks }), { crates: 0, picks: 0 });
    // (Levels of 1,000: a crate and key at 1,000, 2,000, …; a boss pick at 9,000, 19,000. Now at 500, 1,500, …; 9,500, 19,500.)
    expect(upTo(499)).toEqual({ crates: 0, picks: 0 });
    expect(upTo(500)).toEqual({ crates: 1, picks: 0 });
    expect(upTo(10_000)).toEqual({ crates: 10, picks: 1 });
    expect(upTo(20_000)).toEqual({ crates: 20, picks: 2 });
  });

  it("the lines: \"+1 Winter Crate\", \"+2 Winter Crates · +1 crate key\", \"Choose your boss crate\"", () => {
    const r = { crate: "winter-1", daily: 1, crates: 2, keys: 1, bossPicks: 1, levels: [10] };
    expect(rewardLines(r, "Winter Crate · Series 1")).toEqual({ daily: "+1 Winter Crate", level: "+2 Winter Crates · +1 crate key", pick: "Choose your boss crate", quests: [] });
    expect(rewardLines({ ...r, daily: 0, crates: 4, keys: 2, bossPicks: 2 }, "Winter Crate · Series 1")).toEqual({ daily: null, level: "+4 Winter Crates · +2 crate keys", pick: "Choose your 2 boss crates", quests: [] });
    expect(crateCount(1, "Beta Crate · Series 001")).toBe("1 Beta Crate");
    expect([1, 2, 3, 11, 20, 22].map(everyLevel)).toEqual(["every level", "every other level", "every 3rd level", "every 11th level", "every 20th level", "every 22nd level"]);
  });

  it("a stored grant's rewards read back, and anything unreadable as none", () => {
    const r = { crate: "winter-1", daily: 1, crates: 0, keys: 0, bossPicks: 0, levels: [] };
    expect(readRewards(JSON.stringify(r))).toEqual(r);
    expect(readRewards("{nope")).toBeUndefined();
    expect(readRewards(null)).toBeUndefined();
    expect(readRewards(JSON.stringify({ ...r, daily: 0 }))).toBeUndefined();
    expect(readRewards({ daily: -3, crates: 2.5, keys: 1, levels: ["x", 3] })).toEqual({ crate: XP.rewardCrate, daily: 0, crates: 0, keys: 1, bossPicks: 0, levels: [3] });
    // A grant with none carries no rewards; one with nothing paid none either.
    expect(xpGrant(100, [], "paused", r)).not.toHaveProperty("rewards");
    expect(xpGrant(100, [{ label: "12 min", xp: 120 }], undefined, r).rewards).toEqual(r);
  });

  it("PAUSE_REWARDS says so in plain words", () => {
    expect(XP_NONE_LINES.paused).toBe("Rewards are paused for a moment.");
    expect(pausedLine("rewards")).toBe("Rewards are paused for a moment.");
    expect(pauseVariable("rewards")).toBe("PAUSE_REWARDS");
  });
});
