import { describe, expect, it } from "vitest";
import { bestMoveOf, matchFeats, ratingTier, topPercent, type BossState } from "../src/index.ts";

describe("profile helpers", () => {
  it("rating tiers: bands, divisions counting down to the next tier, none without a rating", () => {
    expect(ratingTier(null)).toBeNull();
    expect(ratingTier(1612)?.label).toBe("Gold II");
    expect(ratingTier(1500)?.label).toBe("Gold III");
    expect(ratingTier(1599)?.label).toBe("Gold III");
    expect(ratingTier(1600)?.label).toBe("Gold II");
    expect(ratingTier(1700)?.label).toBe("Gold I");
    expect(ratingTier(1799)?.label).toBe("Gold I");
    expect(ratingTier(1800)?.label).toBe("Platinum III");
    expect(ratingTier(640)?.label).toBe("Bronze III");
    expect(ratingTier(1150)?.label).toBe("Bronze I");
    expect(ratingTier(2550)?.label).toBe("Master");
    expect(ratingTier(3300)?.label).toBe("Grandmaster");
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
