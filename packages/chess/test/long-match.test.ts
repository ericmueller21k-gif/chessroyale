import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type Settings } from "@chessroyale/core";
import { MatchRunner, gameEnd, legalMoves, netBoard, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";
import { START_FEN, fenAfter } from "../src/rules.ts";

/**
 * Lag that grew with the match (.claude/LESSONS.md): the screens read the boss battle's view many times on every
 * redraw, and each read replayed the whole game with chess.js. Late in a long battle, reading it again must cost no
 * chess.js work at all, and a new move only a few moves' worth, however long the game.
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
function fakeEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    // The boss shuffles a knight when it can (the game lasts), else its first move.
    playAtElo: async (fen) => {
      const all = legalMoves(fen).sort();
      return all.find((m) => /^(b8|c6|g8|f6|a6|b4|d5|e7|h6|g4|e5|d7)/.test(m) && new Chess(fen).get(m.slice(0, 2) as never)?.type === "n") ?? all[0]!;
    },
  };
}
const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });

/** chess.js work done while `f` runs: moves played and positions loaded. */
function chessWork(f: () => void): number {
  const move = vi.spyOn(Chess.prototype, "move");
  const load = vi.spyOn(Chess.prototype, "load");
  try {
    f();
    return move.mock.calls.length + load.mock.calls.length;
  } finally {
    move.mockRestore();
    load.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe("a long boss battle", () => {
  it("reading the boss view again costs no chess.js work, and a new move only a few moves' worth", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "gingerbread", lastStandLoss: 999, lastStandLossFloor: 999, bossMaxMoves: 200 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    // The crowd shuffles its own knights too, so the game runs long without ending.
    const crowdMove = (fen: string, allowed: string[]) => allowed.find((m) => new Chess(fen).get(m.slice(0, 2) as never)?.type === "n" && !new Chess(fen).get(m.slice(2, 4) as never)) ?? allowed[0]!;
    let turns = 0;
    for (; turns < 40 && !runner.boss?.result; turns++) {
      runner.deal();
      const fen = runner.boards.get(0)!.fen;
      if (gameEnd(START_FEN, runner.boards.get(0)!.history)) break;
      await runner.score(new Map([["h0", { move: crowdMove(fen, runner.crowdAllowed() ?? legalMoves(fen)), thinkMs: 1000 }]]));
      if (runner.boss?.result || gameEnd(START_FEN, runner.boards.get(0)!.history)) break;
      await runner.playBoss();
    }
    const history = runner.boards.get(0)!.history;
    expect(history.length).toBeGreaterThan(40);
    const view = runner.bossView()!;
    expect(chessWork(() => {
      for (let i = 0; i < 200; i++) expect(runner.bossView()).toBe(view);
    })).toBe(0);
    // A board's view (its last few moves and the position before them), a game's end, a position: asked again, free.
    const board = runner.boards.get(0)!;
    const asks = () => {
      netBoard(board, true);
      gameEnd(START_FEN, board.history);
      fenAfter(board.history.slice(0, -1));
    };
    expect(chessWork(asks)).toBeLessThan(12);
    expect(chessWork(() => {
      for (let i = 0; i < 50; i++) asks();
    })).toBe(0);
    // One more move on: a handful of chess.js steps, not the whole game again.
    const next = [...board.history, legalMoves(board.fen)[0]!];
    expect(chessWork(() => {
      fenAfter(next);
      gameEnd(START_FEN, next);
      netBoard({ ...board, history: next }, true);
    })).toBeLessThan(12);
  });
});
