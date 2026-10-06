import { describe, expect, it } from "vitest";
import { RATING_RANKS, bestMoveOf, matchFeats, ratingTier, topPercent, type BossState } from "../src/index.ts";

/** The error function (Abramowitz and Stegun 7.1.26, good to 1.5e-7). */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

describe("profile helpers", () => {
  it("ranks: the Puzzle Pirates ladder, no divisions, none without a rating", () => {
    expect(RATING_RANKS.map((r) => r.name)).toEqual([
      "Novice", "Neophyte", "Apprentice", "Narrow", "Broad", "Solid", "Weighty",
      "Expert", "Paragon", "Illustrious", "Sublime", "Revered", "Exalted", "Transcendent",
    ]);
    expect(ratingTier(null)).toBeNull();
    expect(ratingTier(undefined)).toBeNull();
    expect(ratingTier(Number.NaN)).toBeNull();
    expect(ratingTier(1612)).toEqual({ name: "Weighty", label: "Weighty", level: 6, color: "#3fc28e", effect: null });
    expect(ratingTier(400)?.label).toBe("Novice");
    expect(ratingTier(949)?.label).toBe("Novice");
    expect(ratingTier(950)?.label).toBe("Neophyte");
    expect(ratingTier(1549)?.label).toBe("Solid");
    expect(ratingTier(1550)?.label).toBe("Weighty");
    expect(ratingTier(2449)?.label).toBe("Exalted");
    expect(ratingTier(2450)?.label).toBe("Transcendent");
    expect(ratingTier(3400)?.label).toBe("Transcendent");
    // The top three stand out, and only they do.
    expect(RATING_RANKS.map((r) => r.effect ?? null)).toEqual([...Array(11).fill(null), "gilt", "glow", "prism"]);
  });

  it("ranks: fixed cutoffs in 50s that spread a chess-like field (1500 ± 350) about as Eric asked", () => {
    const share = [5, 7, 9, 10, 11, 12, 11, 10, 9, 7, 5, 2.5, 1.2, 0.3];
    expect(RATING_RANKS[0]!.from).toBe(0);
    const cdf = (x: number) => 0.5 * (1 + erf((x - 1500) / (350 * Math.SQRT2)));
    RATING_RANKS.forEach((r, i) => {
      if (i > 0) expect(r.from).toBeGreaterThan(RATING_RANKS[i - 1]!.from);
      expect(r.from % 50).toBe(0);
      const next = RATING_RANKS[i + 1];
      const got = 100 * ((next ? cdf(next.from) : 1) - (i > 0 ? cdf(r.from) : 0));
      // Bands of 50 are ~5.7% wide at the middle, so the middle ranks land within a couple of points; the rare top ranks within a fifth.
      if (share[i]! >= 5) expect(Math.abs(got - share[i]!)).toBeLessThanOrEqual(2.2);
      else expect(Math.abs(got - share[i]!) / share[i]!).toBeLessThanOrEqual(0.2);
    });
  });

  it("ranks: every pill reads at 4.5:1 or better on both themes (the pill's colour mixes in styles.css)", () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * t + b[i]! * (1 - t));
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const contrast = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const r of RATING_RANKS.filter((r) => r.effect !== "prism")) {
      const c = rgb(r.color);
      // Dark: the colour on a 20% tint of the panel (#1b1e25). Light: the colour darkened (55% with black) on a 20% tint of white.
      expect(contrast(c, mix(c, rgb("#1b1e25"), 0.2)), `${r.name} dark`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(mix(c, [0, 0, 0], 0.55), mix(c, [255, 255, 255], 0.2)), `${r.name} light`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("top percent: rank among rated players, rounded up, at least 1%", () => {
    expect(topPercent(1, 1000)).toBe(1);
    expect(topPercent(180, 1000)).toBe(18);
    expect(topPercent(181, 1000)).toBe(19);
    expect(topPercent(10, 10)).toBe(100);
  });

  it("match feats: cuts faced and survived, strikes, the Last Stand, the raid's boss", () => {
    const stages = 11;
    // Cut in the 4th cut (stage index 3): faced 4, survived 3. No boss battle.
    expect(matchFeats({ id: "a", outInStage: 3 }, stages, null, false)).toEqual({
      cuts: 4,
      cutsSurvived: 3,
      strikes: null,
      strikesSurvived: null,
      survived: null,
      lastStand: null,
      bossElo: null,
    });
    const boss: BossState = {
      elo: 2000,
      crowdSide: "w",
      crowdMoves: 12,
      sinceKill: 0,
      kills: [
        { id: "x", atMove: 3 },
        { id: "b", atMove: 6 },
        { id: "y", atMove: 9 },
      ],
      result: "crowd",
      lastStand: { atMove: 5, move: "e2e4", loss: 20, bar: 12, charges: 1 },
    };
    // Reached the boss, struck down by the second strike.
    expect(matchFeats({ id: "b", outInStage: 11 }, stages, boss, false)).toMatchObject({ cuts: 11, cutsSurvived: 11, strikes: 2, strikesSurvived: 1, survived: false, lastStand: true, bossElo: null });
    // Still standing at the end of a raid (no cut stages).
    expect(matchFeats({ id: "c", outInStage: null }, 0, boss, true)).toEqual({
      cuts: null,
      cutsSurvived: null,
      strikes: 3,
      strikesSurvived: 3,
      survived: true,
      lastStand: true,
      bossElo: 2000,
    });
    // Cut before the boss battle: no boss stats.
    expect(matchFeats({ id: "d", outInStage: 10 }, stages, boss, false)).toMatchObject({ cuts: 11, cutsSurvived: 10, strikes: null, survived: null, lastStand: null });
  });

  it("best move: a brilliant one first, else the highest round score, the later of equals; null without picks", () => {
    expect(bestMoveOf([])).toBeNull();
    expect(bestMoveOf([{ san: "—", move: null, roundScore: 9 }])).toBeNull();
    expect(
      bestMoveOf([
        { san: "e4", move: "e2e4", roundScore: 3 },
        { san: "Nf3", move: "g1f3", roundScore: 8 },
        { san: "Bb5", move: "f1b5", roundScore: 8 },
        { san: "d4", move: "d2d4", roundScore: -2 },
      ]),
    ).toBe("Bb5");
    expect(
      bestMoveOf([
        { san: "Nxe5", move: "f3e5", roundScore: 1, brilliant: true },
        { san: "Qh5", move: "d1h5", roundScore: 30 },
      ]),
    ).toBe("Nxe5");
  });
});
