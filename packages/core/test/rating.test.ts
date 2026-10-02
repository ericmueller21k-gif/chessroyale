import { describe, expect, it } from "vitest";
import { PRIOR_RATING, RATING_CURVE, estimateRating, lossForRating, ratingForLoss } from "../src/index.ts";

describe("engine rating", () => {
  it("matches the calibration points and falls as loss rises", () => {
    for (const c of RATING_CURVE) expect(Math.abs(ratingForLoss(c.meanLoss) - c.elo)).toBeLessThanOrEqual(1);
    const losses = [0.2, 0.5, 1, 2, 4, 8, 16, 32];
    const ratings = losses.map((l) => ratingForLoss(l));
    for (let i = 1; i < ratings.length; i++) expect(ratings[i]!).toBeLessThanOrEqual(ratings[i - 1]!);
  });

  it("inverts: the loss for a rating maps back to that rating", () => {
    for (const r of [900, 1500, 2000, 2600]) expect(Math.abs(ratingForLoss(lossForRating(r)) - r)).toBeLessThanOrEqual(2);
  });

  it("needs a few moves, starts near the prior, and firms up with more moves", () => {
    expect(estimateRating([0, 0])).toBeNull();
    const perfect3 = estimateRating([0, 0, 0])!;
    const perfect30 = estimateRating(Array(30).fill(0))!;
    expect(perfect3).toBeGreaterThan(PRIOR_RATING);
    expect(perfect30).toBeGreaterThan(perfect3);
    const blunders = estimateRating(Array(30).fill(25))!;
    expect(blunders).toBeLessThan(PRIOR_RATING);
  });
});
