import { describe, expect, it } from "vitest";
import {
  CROWD_BOTS,
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  botChoose,
  botLean,
  botRatingOf,
  botSkillForRating,
  crowdTopOdds,
  drawMove,
  mulberry32,
  type Candidate,
  type Settings,
} from "../src/index.ts";

// Eric, Nov 2: 50 v 50's bots spread over the good lines with a shared lean each turn, and the team's move is drawn
// from its three most-picked moves. docs/decisions/2026-11-02-crowd-bot-spread.md.
const CROWD: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS };
const lines = (losses: Record<string, number>): Candidate[] => Object.entries(losses).map(([move, loss]) => ({ move, loss }));
/** A quiet opening position (an early 50 v 50 turn's lines, points given away). */
const QUIET = lines({ c1b2: 0, e2e3: 0.2, d2d4: 0.3, a2a3: 1.4, g2g3: 1.4, a2a4: 1.8, c1a3: 2, d2d3: 2.1 });
/** Eric's castle (a Random opening's move 7, measured): castling, then every other line 19 points or more worse. */
const CASTLE = lines({ e8g8: 0, a7a6: 19.5, h7h6: 23.7, d7d5: 27.6, d7d6: 27.6, b7b6: 29.1, e4c5: 29.4, e7b4: 31.1 });
const LEGAL = [...new Set([...QUIET, ...CASTLE].map((c) => c.move))];
/** A team of 50 bots at the lobby's ratings (each name's rating, its temperature), 3 power-ups each. */
const TEAM = Array.from({ length: 50 }, (_, i) => ({ skill: botSkillForRating(botRatingOf(`Bot ${i}`)), powerUps: 3 }));

function teamPicks(candidates: readonly Candidate[], seed: number, settings: Settings = CROWD): Map<string, number> {
  const rng = mulberry32(seed);
  const lean = settings.crowdBots ? botLean(rng, candidates, settings.crowdBots) : undefined;
  const counts = new Map<string, number>();
  for (const b of TEAM) {
    const { move } = botChoose(rng, candidates, b, LEGAL.filter((m) => candidates.some((c) => c.move === m)), settings, lean);
    counts.set(move, (counts.get(move) ?? 0) + 1);
  }
  return counts;
}
const plurality = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1])[0]!;

describe("Crowd 50 v 50's bots (CROWD_BOTS)", () => {
  it("a team of bots at lobby ratings never all picks one move, in a quiet opening or at Eric's castle", () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(teamPicks(QUIET, seed).size).toBeGreaterThan(2);
      expect(plurality(teamPicks(QUIET, seed))[1]).toBeLessThan(50);
      // (Before Nov 2 every bot holding a power-up played the best line here: all 50 castled, every time.)
      expect(plurality(teamPicks(CASTLE, seed))[1]).toBeLessThan(50);
    }
    const before = { ...CROWD, crowdBots: undefined };
    expect(teamPicks(CASTLE, 1, before).get("e8g8")).toBeGreaterThanOrEqual(48);
  });

  it("the plurality lands on different good lines turn to turn, the best only some of the time; blunders stay rare", () => {
    const turns = 200;
    const tops = new Map<string, number>();
    let blunders = 0;
    for (let seed = 1; seed <= turns; seed++) {
      const [move] = plurality(teamPicks(QUIET, seed));
      tops.set(move, (tops.get(move) ?? 0) + 1);
      const castle = teamPicks(CASTLE, 1000 + seed);
      expect(plurality(castle)[0]).toBe("e8g8");
      for (const [m, n] of castle) if (m !== "e8g8") blunders += n;
    }
    // Every one of the five good lines leads some turns; the engine's best leads at most about half of them.
    for (const m of ["c1b2", "e2e3", "d2d4", "a2a3", "g2g3"]) expect(tops.get(m) ?? 0).toBeGreaterThan(0);
    expect(tops.get("c1b2")! / turns).toBeLessThan(0.5);
    // At the castle every other line is a blunder: the team castles, a few of its bots stray (about one in five, spread
    // over seven lines; the bots out of power-ups strayed about three in four before Nov 2).
    expect(blunders / (turns * TEAM.length)).toBeLessThan(0.25);
  });

  it("the lean is drawn once per turn from the turn's seed, the same on every device", () => {
    expect(botLean(mulberry32(7), QUIET, CROWD_BOTS)).toEqual(botLean(mulberry32(7), QUIET, CROWD_BOTS));
    expect([...teamPicks(QUIET, 7)]).toEqual([...teamPicks(QUIET, 7)]);
  });
});

describe("the team's played move (crowdPlayedFromTop)", () => {
  const picks = (counts: Record<string, number>) => Object.entries(counts).flatMap(([m, n]) => Array<string>(n).fill(m));

  it("Eric's example: 45 / 3 / 2 picks play 90% / 6% / 4%; a fourth move gets nothing", () => {
    const odds = crowdTopOdds(picks({ O_O: 45, h3: 3, a3: 2, b3: 1 }), 3);
    expect(odds).toEqual({ O_O: 0.9, h3: 0.06, a3: 0.04 });
  });

  it("a tie across third place leaves those moves out; everyone tied shares it evenly", () => {
    expect(crowdTopOdds(picks({ a: 45, b: 3, c: 2, d: 2 }), 3)).toEqual({ a: 45 / 48, b: 3 / 48 });
    expect(crowdTopOdds(picks({ a: 46, b: 1, c: 1, d: 1, e: 1 }), 3)).toEqual({ a: 1 });
    expect(crowdTopOdds(picks({ a: 1, b: 1, c: 1, d: 1 }), 3)).toEqual({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 });
    expect(crowdTopOdds(picks({ a: 20, b: 20, c: 5 }), 3)).toEqual({ a: 20 / 45, b: 20 / 45, c: 5 / 45 });
  });

  it("50 v 50 draws by those odds from the turn's random source; elsewhere the most popular is played", () => {
    const moves = picks({ a: 30, b: 15, c: 5, d: 4 });
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 4000; seed++) {
      const m = drawMove(moves, {}, "popular", mulberry32(seed), CROWD);
      seen.set(m, (seen.get(m) ?? 0) + 1);
    }
    expect(seen.has("d")).toBe(false);
    expect(seen.get("a")! / 4000).toBeCloseTo(0.6, 1);
    expect(seen.get("b")! / 4000).toBeCloseTo(0.3, 1);
    expect(seen.get("c")! / 4000).toBeCloseTo(0.1, 1);
    expect(drawMove(moves, {}, "popular", mulberry32(1), CROWD)).toBe(drawMove(moves, {}, "popular", mulberry32(1), CROWD));
    for (let seed = 1; seed <= 50; seed++) expect(drawMove(moves, {}, "popular", mulberry32(seed), DEFAULT_SETTINGS)).toBe("a");
  });
});
