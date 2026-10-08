import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import {
  applyRecheck,
  blameJudge,
  boardsAgree,
  distanceFrom,
  judgeBotPicks,
  judgedBoard,
  legalMoves,
  recheckTargets,
  runJudgeJob,
  verdictBoard,
  verdictMoves,
  type EngineLike,
  type JudgeJob,
  type UciEngine,
} from "../src/index.ts";
import { createNodeEngine } from "../src/node.ts";

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

/** A stand-in engine: each move's score is a hash of the position and the move (`deep` shifts it a little). */
function fakeEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    scoreMovesAt: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: Math.min(1, score(fen, move) + 0.02 * (hash(move) - 0.5)) })),
  };
}

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const rules = { botCandidateMoves: 8, botRandomMoveChance: DEFAULT_SETTINGS.botRandomMoveChance, botPowerUpLoss: DEFAULT_SETTINGS.botPowerUpLoss };
const job = (over: Partial<JudgeJob> = {}): JudgeJob => ({
  id: "k/0",
  fen: FEN,
  picks: ["a2a3", "a2a3", "f1c4", "g2g4"].sort(),
  bots: [
    { skill: 3, powerUps: 0 },
    { skill: 8, powerUps: 1 },
    { skill: 12, powerUps: 0 },
  ],
  seed: 42,
  rules,
  ...over,
});

describe("judge jobs", () => {
  it("works out the same board from a report as the device did, and the bots' picks from the seed alone", async () => {
    const j = job({ recheck: DEFAULT_SETTINGS });
    const report = await runJudgeJob(fakeEngine(), j);
    const board = judgedBoard(j, report)!;
    expect(board).toBeTruthy();
    // Every pick is scored, the bots' picks follow from the top moves and the seed.
    for (const m of [...j.picks, ...board.botPicks]) expect(board.expectedAfter[m]).toBeTypeOf("number");
    expect(board.botPicks).toEqual(judgeBotPicks(j, report.top).picks);
    expect(judgeBotPicks(j, report.top)).toEqual(judgeBotPicks(j, report.top));
    // Another seed, other picks (usually); the same report from a second device agrees exactly.
    const again = judgedBoard(j, await runJudgeJob(fakeEngine(), j))!;
    expect(boardsAgree(board, again).agree).toBe(true);
  });

  it("catches a report that doesn't hold together", async () => {
    const j = job();
    const report = await runJudgeJob(fakeEngine(), j);
    expect(judgedBoard(j, { ...report, top: [] })).toBeNull();
    expect(judgedBoard(j, { ...report, extra: [] })).toBeNull(); // g2g4 is outside the top moves: unscored
    expect(judgedBoard(j, { ...report, top: [...report.top.slice(1), { move: "a1a8", expected: 0.9 }] })).toBeNull();
    expect(judgedBoard(j, { ...report, top: report.top.map((m, i) => (i ? m : { ...m, expected: 1.4 })) })).toBeNull();
    expect(judgedBoard(j, null as never)).toBeNull();
  });

  it("an inflated score is a disagreement; so are other bot picks", async () => {
    const j = job();
    const report = await runJudgeJob(fakeEngine(), j);
    const honest = judgedBoard(j, report)!;
    const lie = { ...report, extra: report.extra.map((m) => (m.move === "g2g4" ? { ...m, expected: m.expected + 0.1 } : m)) };
    const liar = judgedBoard(j, lie)!;
    const cmp = boardsAgree(honest, liar);
    expect(cmp.agree).toBe(false);
    expect(cmp.diff).toBeCloseTo(0.1, 6);
    expect(boardsAgree(honest, liar, 0.2).agree).toBe(true);
    expect(boardsAgree(honest, { ...honest, botPicks: [...honest.botPicks].reverse() }).agree).toBe(honest.botPicks.join() === [...honest.botPicks].reverse().join());
  });

  it("the engine server's verdict decides, and blame goes to the judge further from it", async () => {
    const engine = fakeEngine();
    const j = job();
    const report = await runJudgeJob(engine, j);
    const honest = judgedBoard(j, report)!;
    const lie = { ...report, extra: report.extra.map((m) => (m.move === "g2g4" ? { ...m, expected: 0.95 } : m)) };
    const liar = judgedBoard(j, lie)!;
    const moves = verdictMoves(j, [report, lie], [honest, liar]);
    for (const m of [...j.picks, ...honest.botPicks]) expect(moves).toContain(m);
    const deep = await engine.scoreMovesAt!(j.fen, moves, 2_000_000);
    const verdict = verdictBoard(j, deep, honest)!;
    expect(verdict.expectedAfter.g2g4).toBeCloseTo(deep.find((m) => m.move === "g2g4")!.expected, 9);
    expect(verdict.bestExpected).toBe(Math.max(...deep.map((m) => m.expected)));
    expect(distanceFrom(verdict, honest)).toBeLessThan(distanceFrom(verdict, liar));
    expect(blameJudge(verdict, [honest, liar], 4).blamed).toEqual([1]);
    expect(blameJudge(verdict, [liar, honest], 4).blamed).toEqual([0]);
    // Two honest judges: nobody blamed. A report that didn't hold together: always blamed.
    expect(blameJudge(verdict, [honest, honest], 4).blamed).toEqual([]);
    expect(blameJudge(verdict, [honest, null], 4).blamed).toEqual([1]);
    // A lone judge (a spot check) only past the solo bar.
    expect(blameJudge(verdict, [liar], 4, 1000).blamed).toEqual([]);
    expect(blameJudge(verdict, [liar], 4, 10).blamed).toEqual([0]);
  });

  it("never offers the barred move (the God King's Last Stand) as the best or as a bot's pick", async () => {
    const top = await fakeEngine().topMoves(FEN, 8);
    const j = job({ barred: top[0]!.move, bots: Array.from({ length: 20 }, () => ({ skill: 1, powerUps: 1 })) });
    const board = judgedBoard(j, await runJudgeJob(fakeEngine(), j))!;
    expect(board.bestMove).not.toBe(j.barred);
    expect(board.botPicks).not.toContain(j.barred);
  });
});

describe("the re-check's targets", () => {
  const ev = { bestMove: "e2e4", bestExpected: 0.6, expectedAfter: { e2e4: 0.6, d2d4: 0.58, g1f3: 0.53, b1c3: 0.5, a2a3: 0.45, h2h4: 0.3 } };
  it("are the same whatever order the picks come in (most picked first, ties by move)", () => {
    const picks = ["b1c3", "g1f3", "a2a3", "h2h4", "a2a3"];
    const s = { recheckLoss: [5, 60] as const, recheckMax: 2, recheckNodes: 1 };
    expect(recheckTargets(ev, picks, s)).toEqual(["a2a3", "b1c3"]);
    expect(recheckTargets(ev, [...picks].reverse(), s)).toEqual(["a2a3", "b1c3"]);
  });
  it("put picks that can decide a cut first, over a wider range of losses", () => {
    const s = { recheckLoss: [5, 60] as const, recheckMax: 2, recheckNodes: 1, recheckCutLoss: [1, 60] as const, recheckCutMax: 3 };
    // d2d4 loses 2 points: below the usual range, but it can decide the cut.
    expect(recheckTargets(ev, ["d2d4", "b1c3", "a2a3", "a2a3"], s, ["d2d4"])).toEqual(["d2d4", "a2a3"]);
    expect(recheckTargets(ev, ["d2d4", "b1c3", "a2a3", "a2a3"], s, ["d2d4", "b1c3", "h2h4"])).toEqual(["b1c3", "d2d4"]);
    expect(recheckTargets(ev, ["d2d4", "b1c3"], s)).toEqual(["b1c3"]);
  });
  it("apply: deep numbers re-anchored to the best; a move that beats it becomes the best", () => {
    const out = applyRecheck(ev, ["b1c3"], [{ move: "e2e4", expected: 0.55 }, { move: "b1c3", expected: 0.6 }]);
    expect(out.expectedAfter.b1c3).toBeCloseTo(0.65, 9);
    expect(out.bestMove).toBe("b1c3");
    expect(applyRecheck(ev, ["b1c3"], [{ move: "b1c3", expected: 0.6 }]).expectedAfter).toEqual(ev.expectedAfter);
  });
});

describe("judge jobs on the real engine", () => {
  let a: UciEngine;
  let b: UciEngine;
  beforeAll(async () => {
    [a, b] = await Promise.all([createNodeEngine({ nodes: 60_000, hashMb: 16 }), createNodeEngine({ nodes: 60_000, hashMb: 16 })]);
  });
  afterAll(() => {
    a.close();
    b.close();
  });
  it("two separate engines give identical reports, one of them after other work", { timeout: 60_000 }, async () => {
    const j = job({ recheck: { ...DEFAULT_SETTINGS, recheckNodes: 120_000 }, picks: ["a2a3", "b1c3", "f1b5", "g2g4", "h2h3"] });
    await b.topMoves("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", 3);
    await b.playAtElo(FEN, 1500, 20_000);
    const [ra, rb] = [await runJudgeJob(a, j), await runJudgeJob(b, j)];
    expect(JSON.stringify(rb)).toBe(JSON.stringify(ra));
    expect(judgedBoard(j, ra)).toBeTruthy();
    expect(await a.speed(30_000)).toBeGreaterThan(1000);
  });
});
