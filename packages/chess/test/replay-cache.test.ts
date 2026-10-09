import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { START_FEN, fenAfter, gameEnd, pieceAt } from "../src/rules.ts";

/** A replay with nothing remembered: the answer the cached ones must match. */
function fresh(moves: readonly string[], start = START_FEN) {
  const c = new Chess(start);
  for (const m of moves) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return c;
}

/** A pseudo-random legal game of `plies` moves. */
function randomGame(seed: number, plies: number): string[] {
  const c = new Chess();
  const out: string[] = [];
  let s = seed;
  for (let i = 0; i < plies && !c.isGameOver(); i++) {
    const moves = c.moves({ verbose: true });
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    const m = moves[s % moves.length]!;
    c.move(m);
    out.push(m.from + m.to + (m.promotion ?? ""));
  }
  return out;
}

const ending = (c: Chess) =>
  c.isCheckmate() ? "checkmate" : c.isStalemate() ? "stalemate" : c.isThreefoldRepetition() ? "repetition" : c.isInsufficientMaterial() ? "insufficient_material" : c.isDraw() ? "fifty_moves" : null;

describe("remembered replays (fenAfter, gameEnd)", () => {
  it("give the same positions and endings as a fresh replay, asked in any order", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const game = randomGame(seed, 120);
      // Growing a move at a time (as a match does), with looks back a few moves and at the start on the way.
      for (let n = 0; n <= game.length; n++) {
        const line = game.slice(0, n);
        expect(fenAfter(line)).toBe(fresh(line).fen());
        expect(gameEnd(START_FEN, line)).toBe(ending(fresh(line)));
        const back = game.slice(0, Math.max(0, n - 5));
        expect(fenAfter(back)).toBe(fresh(back).fen());
        if (n % 17 === 0) expect(gameEnd(START_FEN, back)).toBe(ending(fresh(back)));
      }
      // Out of order: jumps back and forward.
      for (const n of [game.length, 3, game.length - 1, 40, 41, 0, game.length]) {
        const line = game.slice(0, n);
        expect(fenAfter(line)).toBe(fresh(line).fen());
        expect(gameEnd(START_FEN, line)).toBe(ending(fresh(line)));
      }
    }
  });

  it("from another starting position too", () => {
    const game = randomGame(9, 50);
    const start = fenAfter(game.slice(0, 10));
    for (let n = 0; n <= 40; n++) {
      const line = game.slice(10, 10 + n);
      expect(fenAfter(line, start)).toBe(fresh(line, start).fen());
      expect(gameEnd(start, line)).toBe(ending(fresh(line, start)));
    }
  });

  it("sees a repetition reached a move at a time", () => {
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    for (let n = 0; n <= shuffle.length; n++) expect(gameEnd(START_FEN, shuffle.slice(0, n))).toBe(n === 8 ? "repetition" : null);
  });

  it("still throws on an illegal move, and answers right afterwards", () => {
    const game = randomGame(3, 30);
    expect(gameEnd(START_FEN, game)).toBe(ending(fresh(game)));
    expect(() => gameEnd(START_FEN, [...game, "a1a1"])).toThrow();
    expect(() => fenAfter([...game, "a1a1"])).toThrow();
    const more = randomGame(3, 34);
    expect(gameEnd(START_FEN, more)).toBe(ending(fresh(more)));
    expect(fenAfter(more)).toBe(fresh(more).fen());
  });
});

describe("pieceAt (a position read once)", () => {
  it("matches chess.js on every square of many positions, asked in any order", () => {
    const game = randomGame(5, 80);
    const fens = game.map((_, n) => fresh(game.slice(0, n)).fen());
    for (const fen of [...fens, ...fens.slice().reverse()]) {
      const c = new Chess(fen);
      for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
        const p = c.get(`${f}${r}` as never);
        expect(pieceAt(fen, `${f}${r}`)).toEqual(p ? { color: p.color, type: p.type } : null);
      }
    }
    expect(pieceAt(START_FEN, "z9")).toBeNull();
    expect(() => pieceAt("not a fen", "e1")).toThrow();
  });
});
