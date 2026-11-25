import { describe, expect, it } from "vitest";
import { PLAY_COINS, XP } from "../src/settings.ts";
import { bonusEarnedAt, bonusFor, bonusMax, bonusPaidAt, bonusStep, coinParts, gameCoins, playCoinsFor, readPlayCoins, type CoinDay } from "../src/play-coins.ts";
import { gameXp, type XpFacts } from "../src/xp.ts";

const min = 60_000;
const fresh: CoinDay = { play: 0, bonus: 0 };
/** A counted game of `m` minutes (the server's facts), and its XP. */
const facts = (m: number, f: Partial<XpFacts> = {}): XpFacts => ({ ms: m * min, moves: XP.minMoves, won: false, ...f });
const xp = (m: number, f: Partial<XpFacts> = {}) => gameXp(facts(m, f));

describe("play coins (PLAY_COINS, Nov 25; the payments design's section 6)", () => {
  it("the settings are the design's block", () => {
    expect(PLAY_COINS.perMinute).toBe(1.8);
    expect(PLAY_COINS.perDay).toBe(300);
    expect(PLAY_COINS.bonus).toEqual({ win: 15, draw: 5, crowdTop3: 10, squads: { 1: 40, 2: 25, 3: 15, 5: 5 } });
    expect(PLAY_COINS.bonusSteps).toEqual([
      { upTo: 150, rate: 1 },
      { upTo: 350, rate: 0.5 },
      { upTo: 550, rate: 0.25 },
    ]);
    // (600 a day at most: 300 play coins and 300 bonus.)
    expect(PLAY_COINS.perDay + bonusMax()).toBe(600);
  });

  it("play coins: 1.8 of XP's minutes, rounded, at least 1 online; XP's 30-minute cap applies", () => {
    expect(gameCoins({ xp: xp(15) }, fresh)).toMatchObject({ play: 27, bonus: 0, parts: [], step: null, today: { play: 27, bonus: 0 } });
    expect(gameCoins({ xp: xp(30) }, fresh).play).toBe(54);
    expect(gameCoins({ xp: xp(95) }, fresh).play).toBe(54);
    expect(gameCoins({ xp: xp(1) }, fresh).play).toBe(2);
    // (A counted game under a minute: XP's minutes are 0, the online minimum pays 1.)
    expect(gameCoins({ xp: xp(0.5) }, fresh).play).toBe(1);
    expect(playCoinsFor(7)).toBe(13);
  });

  it("the same eligibility as XP's minutes: under 10 moves, a leaver, a test game, a guest or a banned account pay nothing; nor a player fair play holds", () => {
    expect(gameCoins({ xp: xp(15, { moves: XP.minMoves - 1 }) }, fresh)).toMatchObject({ play: 0, bonus: 0, none: "short" });
    expect(gameCoins({ xp: xp(15, { moves: 3, resigned: true }) }, fresh).none).toBe("resigned");
    expect(gameCoins({ xp: xp(15, { abandoned: true, won: true }), result: { won: true } }, fresh)).toMatchObject({ play: 0, bonus: 0, none: "left" });
    expect(gameCoins({ xp: xp(15, { test: true }) }, fresh).none).toBe("test");
    expect(gameCoins({ xp: xp(15, { guest: true }) }, fresh).none).toBe("guest");
    expect(gameCoins({ xp: xp(15, { banned: true }) }, fresh).none).toBe("banned");
    const held = gameCoins({ xp: xp(15, { won: true }), held: true, result: { won: true } }, { play: 40, bonus: 20 });
    expect(held).toEqual({ play: 0, bonus: 0, parts: [], step: null, today: { play: 40, bonus: 20 }, none: "held" });
  });

  it("the day's 300 play coins: a game past it pays what's left, then none; the bonus still pays past it", () => {
    expect(gameCoins({ xp: xp(30) }, { play: 280, bonus: 0 }).play).toBe(20);
    expect(gameCoins({ xp: xp(30), result: { won: true } }, { play: 300, bonus: 0 })).toMatchObject({ play: 0, bonus: 15, today: { play: 300, bonus: 15 } });
    expect(gameCoins({ xp: xp(30) }, { play: 320, bonus: 0 }).play).toBe(0);
  });

  it("the bonus: a win 15, a ranked draw 5, 50 v 50 top 3 +10, Squads 40/25/15/5 (Squads' 1st is its placement, never a win too)", () => {
    expect(gameCoins({ xp: xp(15, { won: true }), result: { won: true } }, fresh)).toMatchObject({ play: 27, bonus: 15, parts: [{ label: "Win", coins: 15 }], step: 0 });
    expect(gameCoins({ xp: xp(15), result: { draw: true } }, fresh)).toMatchObject({ bonus: 5, parts: [{ label: "Draw", coins: 5 }] });
    expect(gameCoins({ xp: xp(15, { won: true }), result: { won: true, crowdTop: true } }, fresh)).toMatchObject({
      bonus: 25,
      parts: [
        { label: "Win", coins: 15 },
        { label: "Top 3", coins: 10 },
      ],
    });
    expect(gameCoins({ xp: xp(15), result: { crowdTop: true } }, fresh).bonus).toBe(10);
    expect(gameCoins({ xp: xp(30, { won: true }), result: { won: true, squads: 1 } }, fresh)).toMatchObject({ play: 54, bonus: 40, parts: [{ label: "1st place", coins: 40 }] });
    expect(gameCoins({ xp: xp(30), result: { squads: 2 } }, fresh).bonus).toBe(25);
    expect(gameCoins({ xp: xp(30), result: { squads: 3 } }, fresh).bonus).toBe(15);
    expect(gameCoins({ xp: xp(30), result: { squads: 5 } }, fresh).bonus).toBe(5);
    // (A loss: play coins only.)
    expect(gameCoins({ xp: xp(15), result: {} }, fresh)).toMatchObject({ play: 27, bonus: 0, step: null });
  });

  it("the design's examples: a 15-minute ranked win 42, a loss 27; a 30-minute Squads lobby 1st 94, last 59", () => {
    const total = (c: { play: number; bonus: number }) => c.play + c.bonus;
    expect(total(gameCoins({ xp: xp(15, { won: true }), result: { won: true } }, fresh))).toBe(42);
    expect(total(gameCoins({ xp: xp(15), result: {} }, fresh))).toBe(27);
    expect(total(gameCoins({ xp: xp(30, { won: true }), result: { won: true, squads: 1 } }, fresh))).toBe(94);
    expect(total(gameCoins({ xp: xp(30), result: { squads: 5 } }, fresh))).toBe(59);
  });

  it("solo: only the minutes XP paid under its daily solo cap, no minimum, no bonus (the device's word)", () => {
    expect(gameCoins({ xp: xp(15, { won: true }), solo: true, result: { won: true } }, fresh)).toMatchObject({ play: 27, bonus: 0, parts: [], step: null });
    // (XP's solo cap left 4 of the game's 15 minutes.)
    expect(gameCoins({ xp: xp(15), solo: true, paidMinutes: 4 }, fresh).play).toBe(7);
    expect(gameCoins({ xp: xp(15), solo: true, paidMinutes: 0 }, fresh).play).toBe(0);
    expect(gameCoins({ xp: xp(0.5), solo: true }, fresh).play).toBe(0);
    // (So solo never pays more than XP's 120 minutes a day: 216.)
    expect(playCoinsFor(XP.soloMinutesPerDay, true)).toBe(216);
    expect(coinParts({ won: true, crowdTop: true }, true)).toEqual([]);
  });

  it("diminishing steps: the first 150 in full, the next 200 at half, the next 200 at a quarter, none past: a win pays 15, then 8, then 4, then 0", () => {
    const win = (bonus: number) => gameCoins({ xp: xp(15, { won: true }), result: { won: true } }, { play: 300, bonus });
    expect(win(0)).toMatchObject({ bonus: 15, step: 0 });
    expect(win(150)).toMatchObject({ bonus: 8, step: 1 });
    expect(win(250)).toMatchObject({ bonus: 4, step: 2 });
    expect(win(300)).toMatchObject({ bonus: 0, step: 3, today: { play: 300, bonus: 300 } });
    // (A game across a step's line: its part in each step at that step's rate.)
    expect(win(140)).toMatchObject({ bonus: 13, step: 0 });
    expect(bonusPaidAt(150)).toBe(150);
    expect(bonusPaidAt(350)).toBe(250);
    expect(bonusPaidAt(550)).toBe(300);
    expect(bonusPaidAt(9_999)).toBe(300);
    expect(bonusEarnedAt(250)).toBe(350);
    expect(bonusEarnedAt(300)).toBe(Infinity);
    expect(bonusStep(149)).toBe(0);
    expect(bonusStep(150)).toBe(1);
    expect(bonusStep(299)).toBe(2);
  });

  it("the day's ceiling: 40+ wins in a day pay 300 bonus and 300 play coins, never more (600 a day)", () => {
    let day: CoinDay = fresh;
    let paid = 0;
    for (let i = 0; i < 80; i++) {
      const c = gameCoins({ xp: xp(30, { won: true }), result: { won: true, crowdTop: true } }, day);
      paid += c.play + c.bonus;
      day = c.today;
    }
    expect(day).toEqual({ play: 300, bonus: 300 });
    expect(paid).toBe(600);
  });

  it("a game's share is its bonus at the steps' rates from where the day stands, within half a coin; the rounding isn't carried, so a day can run a few coins off the exact curve, never past 300", () => {
    const wins = Array<number>(45).fill(15);
    const draws = Array<number>(120).fill(5);
    const mixed = [5, 5, 5, 5, 5, 40, 25, 5, 10, 15, 5, 5, 5, 5, 25, ...Array<number[]>(30).fill([15, 10, 5]).flat()];
    const runs = [wins, draws, mixed, Array<number>(40).fill(40), Array<number>(45).fill(25)].map((seq) => {
      let p = 0;
      let e = 0;
      let ahead = 0;
      let full = 0;
      for (const [i, b] of seq.entries()) {
        const got = bonusFor(p, b);
        // (Its share: the steps' value from the paid total's place on the curve, rounded: within half a coin, never past the bonus.)
        if (p < 300) expect(Math.abs(got - (bonusPaidAt(bonusEarnedAt(p) + b) - p))).toBeLessThanOrEqual(0.5);
        expect(got).toBeGreaterThanOrEqual(0);
        expect(got).toBeLessThanOrEqual(b);
        p += got;
        e += b;
        ahead = Math.max(ahead, p - bonusPaidAt(e));
        expect(p).toBeLessThanOrEqual(300);
        if (p === 300 && !full) full = i + 1;
      }
      expect(p).toBe(300);
      return { full, ahead };
    });
    // (Only wins: 15, 8 for each 7.5, 4 for each 3.75: the 300 at the 35th win, where the exact curve (550 earned) takes 37; 6.25 ahead
    // at most. Only draws: 3 for each 2.5, 1 for each 1.25: up to 16.5 ahead midway, and the 300 at the 113th, the curve's 110th.)
    expect(runs[0]).toEqual({ full: 35, ahead: 6.25 });
    expect(runs[1]).toEqual({ full: 113, ahead: 16.5 });
    expect(bonusFor(0, 0)).toBe(0);
    expect(bonusFor(-5, 15)).toBe(15);
  });

  it("stored and read back (the result row's JSON); anything unreadable reads as none", () => {
    const c = gameCoins({ xp: xp(15, { won: true }), result: { won: true, crowdTop: true } }, { play: 290, bonus: 150 });
    expect(readPlayCoins(JSON.stringify(c))).toEqual(c);
    const none = gameCoins({ xp: xp(15), held: true }, fresh);
    expect(readPlayCoins(JSON.stringify(none))).toEqual(none);
    expect(readPlayCoins("{bad")).toBeUndefined();
    expect(readPlayCoins(null)).toBeUndefined();
    expect(readPlayCoins({ play: -3, bonus: 1.5, none: "nope" })).toEqual({ play: 0, bonus: 0, parts: [], step: null, today: { play: 0, bonus: 0 } });
  });
});
