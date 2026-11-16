import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { REEL, averageWorth, ladderWords, oddsWords, prizeKey, prizeWords, reelAt, reelStop, reelStrip } from "../src/carrot-race.ts";

/**
 * Chub & Chirp's Carrot Patch in words and on the reel (carrot-race.ts): the ladder and the FAQ's odds from the
 * settings, and the reel honest (Eric's sheet): each prize as often as its odds, no rigged near-misses, the stop on what
 * was rolled.
 */
const odds = BOSS_POWERS.carrotOdds;

describe("the ladder and the odds in words", () => {
  it("says the sheet's ladder, from the settings", () => {
    expect([0, 1, 2, 3, 4, 5].map((t) => ladderWords(t))).toEqual(["nothing", "a pawn or two", "up to a knight or bishop", "up to a queen and a rook", "two queens", "they win"]);
  });

  it("names each prize, and each count's odds", () => {
    expect(prizeWords([])).toBe("nothing");
    expect(prizeWords(["r", "q"])).toBe("a queen and a rook");
    expect(prizeWords(["q", "q"])).toBe("two queens");
    expect(oddsWords(0)).toBe("nothing: every card on the reel is blank");
    expect(oddsWords(2)).toBe("two pawns 40%, a knight 30%, a bishop 30%");
    expect(oddsWords(4)).toBe("two queens, every time");
    expect([0, 1, 2, 3, 4].map((t) => Math.round(averageWorth(t) * 100) / 100)).toEqual([0, 1.4, 2.6, 5.05, 18]);
  });
});

describe("the reel", () => {
  it("shows each prize as often as its real odds for his count", () => {
    for (let tier = 0; tier < odds.length; tier++) {
      const strip = reelStrip(tier);
      expect(strip).toHaveLength(REEL.cards);
      for (const x of odds[tier]!) expect(strip.filter((p) => prizeKey(p) === prizeKey(x.prize)).length / REEL.cards, `${tier}: ${prizeKey(x.prize)}`).toBeCloseTo(x.p, 10);
      // Nothing that isn't a prize of his count.
      for (const p of strip) expect(odds[tier]!.some((x) => prizeKey(x.prize) === prizeKey(p))).toBe(true);
    }
  });

  it("no carrots: every card blank; four: every card two queens", () => {
    expect(reelStrip(0).every((p) => p.length === 0)).toBe(true);
    expect(reelStrip(4).every((p) => prizeKey(p) === "qq")).toBe(true);
  });

  it("spreads each prize out along the strip (never bunched), the same strip whatever was rolled", () => {
    for (let tier = 1; tier < 4; tier++) {
      const strip = reelStrip(tier);
      expect(reelStrip(tier)).toEqual(strip);
      for (const x of odds[tier]!) {
        const at = strip.flatMap((p, i) => (prizeKey(p) === prizeKey(x.prize) ? [i] : []));
        const gaps = at.map((i, k) => (at[(k + 1) % at.length]! - i + REEL.cards) % REEL.cards || REEL.cards);
        expect(Math.max(...gaps), `${tier}: ${prizeKey(x.prize)}`).toBeLessThanOrEqual(Math.ceil(REEL.cards / at.length) + 1);
      }
    }
  });

  it("odds that don't divide the strip evenly still fill it, by the largest remainders", () => {
    const s = { ...BOSS_POWERS, carrotOdds: [[{ prize: [], p: 1 }], [{ prize: ["p"], p: 0.33 }, { prize: ["n"], p: 0.67 }]] };
    const strip = reelStrip(1, s);
    expect(strip).toHaveLength(REEL.cards);
    expect(strip.filter((p) => p[0] === "p").length).toBe(7);
  });

  it("stops on what was rolled, after a full turn of the strip, slowing to a stop", () => {
    for (let tier = 0; tier < odds.length; tier++) {
      const strip = reelStrip(tier);
      for (const x of odds[tier]!)
        for (const key of ["hopper:carrotSpin:9", "hopper:carrotSpin:12", "x"]) {
          const stop = reelStop(strip, x.prize, key);
          expect(prizeKey(strip[stop.card]!)).toBe(prizeKey(x.prize));
          expect(stop.travel).toBe(REEL.turns * REEL.cards + stop.card);
          expect(prizeKey(strip[stop.travel % strip.length]!)).toBe(prizeKey(x.prize));
          expect(reelAt(stop.travel, 1)).toBe(stop.travel);
          expect(reelAt(stop.travel, 0)).toBe(0);
          // Always forward, slowing down.
          let last = 0;
          let step = Infinity;
          for (let u = 0.05; u <= 1.0001; u += 0.05) {
            const p = reelAt(stop.travel, u);
            expect(p).toBeGreaterThanOrEqual(last);
            expect(p - last).toBeLessThanOrEqual(step + 1e-9);
            step = p - last;
            last = p;
          }
        }
    }
  });

  it("no rigged near-misses: which of the rolled prize's cards it stops on depends only on the spin, evenly, never on its neighbors", () => {
    const strip = reelStrip(3);
    for (const x of odds[3]!) {
      const at = strip.flatMap((p, i) => (prizeKey(p) === prizeKey(x.prize) ? [i] : []));
      const hits = new Map<number, number>();
      const spins = 2000;
      for (let k = 0; k < spins; k++) {
        const { card } = reelStop(strip, x.prize, `hopper:carrotSpin:${k}`);
        hits.set(card, (hits.get(card) ?? 0) + 1);
      }
      expect([...hits.keys()].sort((a, b) => a - b)).toEqual(at);
      for (const n of hits.values()) {
        expect(n).toBeGreaterThan((spins / at.length) * 0.75);
        expect(n).toBeLessThan((spins / at.length) * 1.25);
      }
    }
  });
});
