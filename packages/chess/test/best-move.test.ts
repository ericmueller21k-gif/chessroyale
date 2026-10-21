import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, openingAllowance, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  boardsAgree,
  deepTargets,
  judgedBoard,
  legalMoves,
  recheckCloseCalls,
  runJudgeJob,
  runQuickJob,
  moveNumber,
  sanLineToUci,
  recheckTargets,
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
 * the budget) scores the last legal move 0.58 (or `over`), above the first line, as Oct 16's Qe2 was charged against,
 * and any other move 0.30. The re-check's deep numbers are the quick ones unless `deep` says otherwise.
 */
function engine(deep: Record<string, number> = {}, over = 0.58): EngineLike {
  const top = (fen: string) => legalMoves(fen).slice(0, 8).map((move, i) => ({ move, expected: 0.5 - 0.01 * i }));
  const quick = (fen: string, m: string) => top(fen).find((x) => x.move === m)?.expected ?? (m === legalMoves(fen).at(-1) ? over : 0.3);
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

  it("online: two judges agree; their re-check weighs it against the first line (its anchor), like for like (judgedBoard)", async () => {
    const job: JudgeJob = {
      id: "k/0",
      fen: FEN,
      picks: [FIRST, OVER].sort(),
      bots: [{ skill: 0.01, powerUps: 0 }, { skill: 0.01, powerUps: 0 }],
      seed: 5,
      rules: { botCandidateMoves: 8, botRandomMoveChance: DEFAULT_SETTINGS.botRandomMoveChance, botPowerUpLoss: DEFAULT_SETTINGS.botPowerUpLoss },
    };
    // A judge's board keeps the engine's numbers and its first line (the re-check's anchor); resolveBoard names the best.
    const one = judgedBoard(job, await runQuickJob(engine(), job))!;
    const two = judgedBoard(job, await runQuickJob(engine(), job))!;
    expect(one.bestMove).toBe(FIRST);
    expect(one.expectedAfter[OVER]).toBe(0.58);
    expect(boardsAgree(one, two).agree).toBe(true);
    // With the device's re-check: the first line loses 8 points to the pick above it (a close call), so that pick is
    // searched with it.
    const checked = { ...job, recheck: DEFAULT_SETTINGS };
    expect(deepTargets(checked, await runQuickJob(engine(), checked))).toEqual({ best: FIRST, flagged: [OVER] });
    // Deeper, the first line is a point better: it stays the best, and the pick above it now loses a point.
    const deeper = engine({ [FIRST]: 0.55, [OVER]: 0.54 });
    const a = judgedBoard(checked, await runJudgeJob(deeper, checked))!;
    const b = judgedBoard(checked, await runJudgeJob(deeper, checked))!;
    expect(a.bestMove).toBe(FIRST);
    expect(a.bestExpected).toBe(0.5);
    expect(a.expectedAfter[OVER]).toBeCloseTo(0.49, 9);
    expect(a.rechecked).toEqual([OVER]);
    expect(boardsAgree(a, b).agree).toBe(true);
    // Deeper, it holds: it's the best.
    const held = judgedBoard(checked, await runJudgeJob(engine(), checked))!;
    expect(held.bestMove).toBe(OVER);
    expect(held.bestExpected).toBeCloseTo(0.58, 9);
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

  it("the God King plays the best move with no re-check at all: a pick 3 points above the first line, nothing else close (resolveBoard names it)", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossMaxMoves: 12, lastStandFrom: 999, bossId: "clown" } as Settings;
    const quick = engine({}, 0.53);
    let deepSearches = 0;
    const counted: EngineLike = { ...quick, scoreMovesAt: async (fen, moves, nodes) => (deepSearches++, quick.scoreMovesAt!(fen, moves, nodes)) };
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(11),
      engines: [counted],
      library: [{ ...library[0]!, moves: line, namedPlies: line.length }],
      entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
    });
    runner.deal();
    const fen = runner.boards.get(0)!.fen;
    expect(runner.crowdAllowed()).toBeNull();
    for (const id of ["h0", "h1", "h2", "h3"]) runner.kingCallers.add(id);
    const last = legalMoves(fen).at(-1)!;
    const k = await runner.score(new Map([["h4", { move: last, thinkMs: 1000 }], ["h5", { move: legalMoves(fen)[0]!, thinkMs: 1000 }]]));
    const b = k.boards[0]!;
    // (The first line's pickers lose 3 points: under the re-check's range, and there's no other close call.)
    expect(deepSearches).toBe(0);
    expect(b.king).toBe(true);
    expect(b.bestMove).toBe(last);
    expect(b.result.playedMove).toBe(last);
    consistent(b);
  });

  it("the God King plays the best move: the pick above the first line", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossMaxMoves: 12, lastStandFrom: 999, bossId: "clown" } as Settings;
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

describe("the re-check, with a pick scored above the first line (its anchor)", () => {
  const s = { recheckLoss: [5, 60] as const, recheckMax: 3, recheckNodes: 1, recheckCutLoss: [1, 60] as const, recheckCutMax: 5 };
  // The first line F at 0.50, a pick P above it at 0.52 (and Q at 0.51), X losing 12 points to P, Y losing 2.5.
  const ev = { bestMove: "F", bestExpected: 0.5, expectedAfter: { F: 0.5, P: 0.52, Q: 0.51, X: 0.4, Y: 0.495 } };

  it("searches it with any re-check, first and on top of the usual picks; starts one only for a close call on the first line", () => {
    // X is a close call: P goes in, ahead of it (outside recheckMax).
    expect(recheckTargets(ev, ["F", "P", "X", "X"], s)).toEqual(["P", "X"]);
    expect(recheckTargets(ev, ["F", "P", "X"], { ...s, recheckMax: 1 })).toEqual(["P", "X"]);
    // Several above it: the highest first, each once (Q loses a point to P: not a target of its own).
    expect(recheckTargets(ev, ["F", "Q", "P", "X"], s)).toEqual(["P", "Q", "X"]);
    // Nothing else to re-check, and F's pickers lose 2 points to P: no search for it alone (below the range)...
    expect(recheckTargets(ev, ["F", "P", "Y"], s)).toEqual([]);
    // ...but near the cut line (from 1 point), a close call: P is searched with F.
    expect(recheckTargets(ev, ["F", "P", "Y"], s, ["F"])).toEqual(["P"]);
    // F losing 5+ to it is a close call for anyone; nobody on F and no other close call: nothing to weigh.
    const far = { ...ev, expectedAfter: { ...ev.expectedAfter, P: 0.56 } };
    expect(recheckTargets(far, ["F", "P"], s)).toEqual(["P"]);
    expect(recheckTargets(far, ["P"], s)).toEqual([]);
    expect(recheckTargets(far, ["P", "Y"], s)).toEqual(["P", "Y"]);
  });

  it("every other re-checked pick is measured against the deep search's best (the reviewer's case: X loses 10, not 12 or 9)", async () => {
    // Quick: F 0.50, P 0.52, X 0.40. Deep: F 0.55, P 0.54, X 0.45: F is the best, X 10 points below it.
    const quick = { bestMove: "e2e4", bestExpected: 0.5, expectedAfter: { e2e4: 0.5, d2d4: 0.52, a2a3: 0.4 } };
    const deep: Record<string, number> = { e2e4: 0.55, d2d4: 0.54, a2a3: 0.45 };
    const e: EngineLike = {
      topMoves: async () => [],
      scoreMoves: async () => [],
      scoreMovesAt: async (_fen, moves) => moves.map((move) => ({ move, expected: deep[move]! })),
    };
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const checked = await recheckCloseCalls(e, fen, quick, ["e2e4", "d2d4", "a2a3"], DEFAULT_SETTINGS);
    expect(checked.bestMove).toBe("e2e4");
    expect(checked.rechecked).toEqual(["d2d4", "a2a3"]);
    const loss = (m: string) => (checked.bestExpected - checked.expectedAfter[m]!) * 100;
    expect(loss("a2a3")).toBeCloseTo(10, 9);
    expect(loss("d2d4")).toBeCloseTo(1, 9);
  });

  it("the exchange check measures against the best move: a quiet first line missed the capture scored above it (an older host's numbers too)", () => {
    // After 5...Nxe4?? White wins the knight (dxe4); the first line here castles. Move 6: the opening allowance applies.
    const hung = sanLineToUci(["e4", "Nf6", "Nc3", "e5", "d3", "Bc5", "Nf3", "d6", "Be2", "Nxe4"]);
    const make = () =>
      new MatchRunner({
        settings: { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossMaxMoves: 12, lastStandFrom: 999, bossId: "clown" } as Settings,
        rng: mulberry32(11),
        engines: [engine()],
        library: [{ ...library[0]!, moves: hung, namedPlies: hung.length }],
        entrants: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
      });
    const [castle, take] = ["e1g1", "d3e4"];
    for (const named of [castle, take]) {
      const runner = make();
      const [[boardId, ids]] = [...runner.deal()] as [[number, string[]]];
      const fen = runner.boards.get(boardId)!.fen;
      expect(fen).toBe("rnbqk2r/ppp2ppp/3p4/2b1p3/4n3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6");
      expect(openingAllowance(moveNumber(fen))).toBeGreaterThan(0);
      expect(runner.crowdAllowed()).toBeNull();
      const picks = Object.fromEntries(ids.map((id, i) => [id, i < 3 ? castle : take]));
      const expectedAfter = { [castle]: 0.5, [take]: 0.53 };
      // An older host names the first line; the judges' numbers with a re-check that held the capture name it.
      const b = runner.resolveBoard(boardId, ids, picks, { bestMove: named, bestExpected: expectedAfter[named]!, expectedAfter });
      expect(b.bestMove).toBe(take);
      for (const p of b.result.players) {
        if (p.move === take) expect(p).toMatchObject({ loss: 0 });
        else {
          // It passed up a capture that wins material: no allowance, its whole loss counts.
          expect(p.material).toBe("missed");
          expect(p.loss).toBeCloseTo(3, 9);
          expect(p.counted).toBeUndefined();
        }
      }
    }
  });
});
