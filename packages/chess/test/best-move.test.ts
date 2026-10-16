import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  boardsAgree,
  deepTargets,
  judgedBoard,
  legalMoves,
  recheckCloseCalls,
  runJudgeJob,
  runQuickJob,
  sanLineToUci,
  type BoardRound,
  type EngineLike,
  type JudgeJob,
  type Opening,
} from "../src/index.ts";

/**
 * A pick scored above the engine's first line is the best move (docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md).
 *
 * The stand-in engine keeps the judge's two searches apart. Its top-8 search lists a position's first 8 legal moves,
 * the first line at 0.50, then 0.49, 0.48 and so on. Its second search (the picks outside those 8, each with more of
 * the budget) scores the last legal move 0.58, above the first line, as Oct 16's Qe2 was charged against, and any other
 * move 0.30. The re-check's deep numbers are the quick ones unless `deep` says otherwise.
 */
function engine(deep: Record<string, number> = {}): EngineLike {
  const top = (fen: string) => legalMoves(fen).slice(0, 8).map((move, i) => ({ move, expected: 0.5 - 0.01 * i }));
  const quick = (fen: string, m: string) => top(fen).find((x) => x.move === m)?.expected ?? (m === legalMoves(fen).at(-1) ? 0.58 : 0.3);
  return {
    topMoves: async (fen, n) => top(fen).slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: quick(fen, move) })),
    scoreMovesAt: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: deep[move] ?? quick(fen, move) })),
  };
}

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
const FIRST = legalMoves(FEN)[0]!;
const OVER = legalMoves(FEN).at(-1)!;
const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
  id: `o${i}`,
  eco: "C84",
  name: `Opening ${i}`,
  family: `Family ${i}`,
  unusual: false,
  moves: line,
  namedPlies: line.length,
  expected: Object.fromEntries(Array.from({ length: line.length + 1 }, (_, n) => [n, 0.5])),
}));

/** A position's first line in the stand-in's top-8 search, and the move its second search scores above it. */
const movesOf = (fen: string) => ({ first: legalMoves(fen)[0]!, over: legalMoves(fen).at(-1)! });

/** A pick of the best move is never charged; no pick scores above the best; every loss is measured from it. */
function consistent(b: BoardRound) {
  const exp = (m: string) => b.scored.find((s) => s.move === m)!.expected;
  for (const p of b.result.players) {
    if (!p.move) continue;
    if (p.move === b.bestMove) expect(p.loss, `${p.playerId} picked the best move`).toBe(0);
    expect(exp(p.move)).toBeLessThanOrEqual(exp(b.bestMove));
    expect(p.loss).toBeCloseTo((exp(b.bestMove) - exp(p.move)) * 100, 9);
  }
}

/** Classic: you and seven bots that always play the engine's first line (skill near 0; a bot's 2% random move aside). */
function classic(e: EngineLike, seed = 3) {
  const runner = new MatchRunner({
    settings: DEFAULT_SETTINGS,
    rng: mulberry32(seed),
    engines: [e],
    library,
    entrants: [{ id: "me", name: "Me", isBot: false }, ...Array.from({ length: 63 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 0.01 }))],
  });
  runner.deal();
  return runner;
}

describe("a pick scored above the engine's first line", () => {
  it("solo: is the best move, and charges the first line's pickers what the judge measured (scoreBoard, resolveBoard)", async () => {
    const runner = classic(engine());
    const { first: FIRST, over: OVER } = movesOf(runner.boardOf("me")!.fen);
    const report = await runner.score(new Map([["me", { move: OVER, thinkMs: 1000 }]]));
    const b = report.boards.find((x) => x.playerIds.includes("me"))!;
    const first = b.result.players.filter((p) => p.move === FIRST);
    expect(first.length).toBeGreaterThan(0);
    expect(b.bestMove).toBe(OVER);
    expect(b.result.players.find((p) => p.playerId === "me")!.loss).toBe(0);
    for (const p of first) expect(p.loss).toBeCloseTo(8, 9);
    consistent(b);
  });

  it("solo: the re-check then weighs the engine's first line against it, like for like, and the better one is the best", async () => {
    // (The first line loses 8 points to it, within the re-check's range: searched again with it. Deeper, the first line
    // is a point better.)
    const { first: FIRST, over: OVER } = movesOf(classic(engine()).boardOf("me")!.fen);
    const runner = classic(engine({ [FIRST]: 0.55, [OVER]: 0.54 }));
    const report = await runner.score(new Map([["me", { move: OVER, thinkMs: 1000 }]]));
    const b = report.boards.find((x) => x.playerIds.includes("me"))!;
    expect(b.bestMove).toBe(FIRST);
    expect(b.result.players.find((p) => p.playerId === "me")!.loss).toBeCloseTo(1, 9);
    for (const p of b.result.players.filter((x) => x.move === FIRST)) expect(p.loss).toBe(0);
    consistent(b);
  });

  it("the lobby's numbers from a host that named the engine's first line (an older app) still make it the best (resolveBoard)", () => {
    const runner = classic(engine());
    const { first: FIRST, over: OVER } = movesOf(runner.boardOf("me")!.fen);
    const [boardId, ids] = [...runner.groups].find(([, xs]) => xs.includes("me"))!;
    const picks = Object.fromEntries(ids.map((id, i) => [id, i % 2 ? OVER : FIRST]));
    const expectedAfter = { [FIRST]: 0.5, [OVER]: 0.58 };
    const b = runner.resolveBoard(boardId, ids, picks, { bestMove: FIRST, bestExpected: 0.5, expectedAfter });
    expect(b.bestMove).toBe(OVER);
    consistent(b);
    // A tie keeps the engine's choice.
    const tie = runner.resolveBoard(boardId, ids, picks, { bestMove: FIRST, bestExpected: 0.5, expectedAfter: { [FIRST]: 0.5, [OVER]: 0.5 } });
    expect(tie.bestMove).toBe(FIRST);
  });

  it("online: a judge's board names it the best; two judges agree; the re-check is anchored on it and weighs the first line (judgedBoard)", async () => {
    const job: JudgeJob = {
      id: "k/0",
      fen: FEN,
      picks: [FIRST, OVER].sort(),
      bots: [{ skill: 0.01, powerUps: 0 }, { skill: 0.01, powerUps: 0 }],
      seed: 5,
      rules: { botCandidateMoves: 8, botRandomMoveChance: DEFAULT_SETTINGS.botRandomMoveChance, botPowerUpLoss: DEFAULT_SETTINGS.botPowerUpLoss },
    };
    const one = judgedBoard(job, await runQuickJob(engine(), job))!;
    const two = judgedBoard(job, await runQuickJob(engine(), job))!;
    expect(one.bestMove).toBe(OVER);
    expect(one.bestExpected).toBe(0.58);
    expect(boardsAgree(one, two).agree).toBe(true);
    // With the device's re-check: it searches the first line against the pick above it.
    const checked = { ...job, recheck: DEFAULT_SETTINGS };
    expect(deepTargets(checked, await runQuickJob(engine(), checked))).toEqual({ best: OVER, flagged: [FIRST] });
    const deeper = engine({ [FIRST]: 0.55, [OVER]: 0.54 });
    const a = judgedBoard(checked, await runJudgeJob(deeper, checked))!;
    const b = judgedBoard(checked, await runJudgeJob(deeper, checked))!;
    expect(a.bestMove).toBe(FIRST);
    expect(a.bestExpected).toBeCloseTo(0.59, 9);
    expect(a.rechecked).toEqual([FIRST]);
    expect(boardsAgree(a, b).agree).toBe(true);
  });

  it("every judge works out the same board from the same searches: the device's (judgedBoard), the host's and solo's re-check (recheckCloseCalls)", async () => {
    for (const deep of [{}, { [FIRST]: 0.55, [OVER]: 0.54 }, { [FIRST]: 0.52, [OVER]: 0.57 }]) {
      const e = engine(deep);
      const job: JudgeJob = { id: "k/0", fen: FEN, picks: [FIRST, OVER, legalMoves(FEN)[3]!].sort(), bots: [{ skill: 4, powerUps: 0 }, { skill: 0.01, powerUps: 0 }], seed: 9, rules: { botCandidateMoves: 8, botRandomMoveChance: 0.02, botPowerUpLoss: 15 }, recheck: DEFAULT_SETTINGS };
      const device = judgedBoard(job, await runJudgeJob(e, job))!;
      // The host and solo: the top moves' first line as the best, then the re-check over every pick.
      const top = await e.topMoves(FEN, 8);
      const picks = [...job.picks, ...device.botPicks];
      const outside = picks.filter((m) => !top.some((t) => t.move === m));
      const expectedAfter = Object.fromEntries([...top, ...(await e.scoreMoves(FEN, outside))].map((m) => [m.move, m.expected]));
      const host = await recheckCloseCalls(e, FEN, { bestMove: top[0]!.move, bestExpected: top[0]!.expected, expectedAfter }, picks, DEFAULT_SETTINGS);
      expect(host.bestMove).toBe(device.bestMove);
      expect(host.bestExpected).toBe(device.bestExpected);
      for (const m of picks) expect(host.expectedAfter[m]).toBe(device.expectedAfter[m]);
    }
  });

  it("the God King plays the best move: the pick above the first line", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossMaxMoves: 12, lastStandFrom: 999, bossId: "ginger" } as Settings;
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [engine()],
      library: [{ ...library[0]!, moves: line, namedPlies: line.length }],
      entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
    });
    expect(runner.bossToMove()).toBe(false);
    runner.deal();
    const fen = runner.boards.get(0)!.fen;
    expect(runner.crowdAllowed()).toBeNull();
    // Four of six call him; one picks the move the second search scores above the first line, one the first line.
    for (const id of ["h0", "h1", "h2", "h3"]) runner.kingCallers.add(id);
    const last = legalMoves(fen).at(-1)!;
    const k = await runner.score(new Map([["h4", { move: last, thinkMs: 1000 }], ["h5", { move: legalMoves(fen)[0]!, thinkMs: 1000 }]]));
    const b = k.boards[0]!;
    expect(b.king).toBe(true);
    expect(b.bestMove).toBe(last);
    expect(b.result.playedMove).toBe(last);
    consistent(b);
  });
});
