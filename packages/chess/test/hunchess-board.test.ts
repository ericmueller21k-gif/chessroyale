import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { mulberry32 } from "@chessroyale/core";
import { CHESS_RULES, fightRules, moveUci, perft, Position, type HunRules } from "../src/hunchess/board.ts";
import { judgedResult, stallScore } from "../src/hunchess/index.ts";

/** The HunChess engine's board: its move generator against chess.js and known counts, and every rule of a fight. */

const FIGHT: HunRules = fightRules({ quietCap: 10, moveCap: 60, stallWinMargin: 100 });

const KNOWN: [string, number[]][] = [
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902, 197281]],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
  ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]],
];

/** Positions from seeded random games, normal starts and sparse ones with pawns near the end. */
function randomPositions(count: number, seed: number, starts: string[]): string[] {
  const rng = mulberry32(seed);
  const out: string[] = [];
  while (out.length < count) {
    const chess = new Chess(starts[out.length % starts.length]!);
    const plies = Math.floor(rng() * 40);
    for (let i = 0; i < plies && !chess.isGameOver(); i++) {
      const moves = chess.moves({ verbose: true });
      chess.move(moves[Math.floor(rng() * moves.length)]!);
    }
    if (!chess.isGameOver()) out.push(chess.fen());
  }
  return out;
}

const STARTS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
  "4k3/1P4P1/8/2n5/5N2/8/1p4p1/4K3 w - - 0 1",
  "2r1k3/PP3p2/8/3b4/4B3/8/pp3P2/2R1K3 b - - 0 1",
  "8/3p4/2k5/4P3/8/5K2/3R4/8 w - - 0 1",
];

const chessMoves = (fen: string) =>
  new Chess(fen)
    .moves({ verbose: true })
    .map((m) => m.from + m.to + (m.promotion ?? ""))
    .sort();

describe("HunChess board: the move generator", () => {
  it("counts the well-known perft numbers", () => {
    for (const [fen, want] of KNOWN) {
      const pos = new Position(fen);
      expect(want.map((_, d) => perft(pos, d + 1)), fen).toEqual(want);
      expect(pos.fen(), "make/unmake leaves the position as it was").toBe(new Position(fen).fen());
    }
  });

  it("matches chess.js move for move, and in perft, on many positions (ordinary chess)", () => {
    const fens = randomPositions(100, 7, STARTS);
    for (const fen of fens) {
      const pos = new Position(fen);
      expect(pos.legalMoves().map(moveUci).sort(), fen).toEqual(chessMoves(fen));
    }
    for (const fen of fens.slice(0, 16)) expect(perft(new Position(fen), 3), fen).toBe(new Chess(fen).perft(3));
  });

  it("in a fight, a promotion is one cash-in instead (the plain from-to): otherwise the same moves as chess.js", () => {
    const fens = randomPositions(80, 11, STARTS.slice(2));
    let cashIns = 0;
    for (const fen of fens) {
      const fight = new Position(fen, FIGHT).legalMoves().map(moveUci).sort();
      const collapsed = [...new Set(chessMoves(fen).map((m) => m.slice(0, 4)))].sort();
      expect(fight, fen).toEqual(collapsed);
      cashIns += chessMoves(fen).filter((m) => m.length === 5).length / 4;
    }
    expect(cashIns).toBeGreaterThan(20);
  });

  it("writes the same FEN as chess.js after every move (en passant kept only when a pawn can take there)", () => {
    for (const fen of randomPositions(12, 3, STARTS.slice(0, 2))) {
      const chess = new Chess(fen);
      const pos = new Position(fen);
      const rng = mulberry32(5);
      for (let i = 0; i < 30 && !chess.isGameOver(); i++) {
        const moves = chess.moves({ verbose: true });
        const m = moves[Math.floor(rng() * moves.length)]!;
        chess.move(m);
        pos.play(m.from + m.to + (m.promotion ?? ""));
        expect(pos.fen()).toBe(chess.fen());
      }
    }
  });

  it("make and unmake restore the position, its key and the fight's counters", () => {
    const pos = new Position("4k3/1P4P1/8/2n5/5N2/8/1p4p1/4K3 w - - 0 1", FIGHT);
    const before = { fen: pos.fen(), lo: pos.keyLo, hi: pos.keyHi, mg: pos.mg, eg: pos.eg, quiet: pos.quiet, plies: pos.plies };
    for (const m of pos.legalMoves()) {
      pos.make(m);
      pos.unmake();
      expect({ fen: pos.fen(), lo: pos.keyLo, hi: pos.keyHi, mg: pos.mg, eg: pos.eg, quiet: pos.quiet, plies: pos.plies }).toEqual(before);
    }
  });
});

describe("HunChess board: the fight's rules", () => {
  it("a pawn moving onto its last rank cashes in: it leaves the board, counted for its side", () => {
    const pos = new Position("4k3/1P6/8/8/8/8/8/R3K3 w - - 0 1", FIGHT);
    pos.play("b7b8");
    expect(pos.fen().split(" ")[0]).toBe("4k3/8/8/8/8/8/8/R3K3");
    expect([...pos.cashed]).toEqual([1, 0]);
    // A capture onto the last rank cashes in too (the taken piece is gone as well).
    const cap = new Position("2r1k3/1P6/8/8/8/8/8/R3K3 w - - 0 1", FIGHT);
    cap.play("b7c8");
    expect(cap.fen().split(" ")[0]).toBe("4k3/8/8/8/8/8/8/R3K3");
    // Black's pawns cash in on the first rank.
    const black = new Position("4k3/8/8/8/8/8/6p1/R3K3 b - - 0 1", FIGHT);
    black.play("g2g1");
    expect(black.fen().split(" ")[0]).toBe("4k3/8/8/8/8/8/8/R3K3");
    expect([...black.cashed]).toEqual([0, 1]);
  });

  it("cashing in the last piece leaves a bare king: that side loses at once", () => {
    const pos = new Position("4k3/1P6/8/8/8/8/7r/4K3 w - - 0 1", FIGHT);
    pos.play("b7b8");
    expect(pos.result()).toEqual({ end: "king_alone", winner: 1 });
  });

  it("a side left with only its king loses at once; both: a draw; before mate and stalemate", () => {
    expect(new Position("4k3/8/8/8/8/8/8/R3K3 b - - 0 1", FIGHT).result()).toEqual({ end: "king_alone", winner: 0 });
    expect(new Position("4k3/8/8/8/8/8/8/4K3 w - - 0 1", FIGHT).result()).toEqual({ end: "king_alone", winner: -1 });
    // (Black, bare, is stalemated here: the bare king loses all the same.)
    expect(new Position("k7/2Q5/1K6/8/8/8/8/8 b - - 0 1", FIGHT).result()).toEqual({ end: "king_alone", winner: 0 });
    // Ordinary chess: no such rule (stalemate).
    expect(new Position("k7/2Q5/1K6/8/8/8/8/8 b - - 0 1").result()).toEqual({ end: "stalemate", winner: -1 });
    // A capture of the last piece ends it.
    const pos = new Position("4k3/8/8/8/8/8/n7/R3K3 w - - 0 1", FIGHT);
    pos.play("a1a2");
    expect(pos.result()).toEqual({ end: "king_alone", winner: 0 });
  });

  it("checks in a row win nothing (Eric, Oct 21), and a check doesn't restart the quiet count", () => {
    // White's queen checks five times in a row while Black's king walks: the fight goes on.
    const pos = new Position("7r/8/8/8/3k4/8/8/Q3K3 w - - 0 1", FIGHT);
    for (const m of ["a1a4", "d4e5", "a4e8", "e5d6", "e8d8", "d6e6", "d8d5", "e6f6", "d5f5"]) {
      pos.play(m);
      expect(pos.result()).toBeNull();
    }
    expect(pos.quiet).toBe(9);
  });

  it("10 moves a side with no capture or cash-in: a stall, which the engine's score decides (a pawn's lead wins)", () => {
    // The kings walk (never repeating a position), the pawns are blocked; White has a knight more.
    const pos = new Position("k7/8/p7/P7/8/8/8/1N5K w - - 0 1", FIGHT);
    const white = ["h1h2", "h2h3", "h3g3", "g3g2", "g2f2", "f2f3", "f3e3", "e3e2", "e2d2", "d2d3"];
    const black = ["a8b8", "b8c8", "c8d8", "d8e8", "e8f8", "f8g8", "g8g7", "g7f7", "f7e7", "e7d7"];
    for (let i = 0; i < 9; i++) {
      pos.play(white[i]!);
      pos.play(black[i]!);
      expect(pos.result()).toBeNull();
    }
    pos.play(white[9]!);
    pos.play(black[9]!);
    expect(pos.quiet).toBe(20);
    expect(pos.result()).toEqual({ end: "quiet", winner: -1, stall: true });
    const judged = judgedResult(pos)!;
    expect(judged).toMatchObject({ end: "quiet", winner: 0, stall: true });
    expect(judged.score).toBeGreaterThan(200);
    // The same position, the same score, every time (no randomness, no clock, nothing kept from judging another position).
    expect(stallScore(pos)).toBe(judged.score);
    stallScore(new Position("4k3/7r/8/8/8/8/8/R3K3 w - - 0 1", FIGHT));
    expect(stallScore(pos)).toBe(judged.score);
    // A capture starts the count again; a check doesn't.
    const capture = new Position("k7/8/8/8/8/8/1R4n1/7K w - - 7 1", FIGHT);
    capture.quiet = 15;
    capture.play("b2g2");
    expect(capture.quiet).toBe(0);
    const check = new Position("k7/8/8/8/8/8/1R4n1/7K w - - 7 1", FIGHT);
    check.quiet = 15;
    check.play("b2a2");
    expect(check.quiet).toBe(16);
  });

  it("60 moves a side: a stall the score decides (even: a draw); mate on the last move still counts as mate", () => {
    const pos = new Position("4k3/7r/8/8/8/8/8/R3K3 w - - 0 1", FIGHT);
    pos.plies = 119;
    pos.quiet = 0;
    pos.play("a1a2");
    expect(pos.result()).toEqual({ end: "cap", winner: -1, stall: true });
    expect(judgedResult(pos)).toMatchObject({ end: "cap", winner: -1 });
    expect(Math.abs(judgedResult(pos)!.score!)).toBeLessThan(100);
    const mate = new Position("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", FIGHT);
    mate.plies = 119;
    mate.play("a1a8");
    expect(mate.result()).toEqual({ end: "checkmate", winner: 0 });
  });

  it("threefold repetition is a stall (the score decides); the fifty-move rule and too little material are draws, as chess.js counts them", () => {
    const pos = new Position("4k3/4p3/7r/8/8/R7/4P3/4K3 w - - 0 1", FIGHT);
    for (const m of ["a3a4", "h6h5", "a4a3", "h5h6", "a3a4", "h6h5", "a4a3"]) {
      pos.play(m);
      expect(pos.result()).toBeNull();
    }
    pos.play("h5h6");
    expect(pos.result()).toEqual({ end: "repetition", winner: -1, stall: true });
    expect(judgedResult(pos)).toMatchObject({ end: "repetition", winner: -1 });
    // Ordinary chess: a plain draw.
    const chess = new Position("4k3/4p3/7r/8/8/R7/4P3/4K3 w - - 0 1");
    for (const m of ["a3a4", "h6h5", "a4a3", "h5h6", "a3a4", "h6h5", "a4a3", "h5h6"]) chess.play(m);
    expect(chess.result()).toEqual({ end: "repetition", winner: -1 });
    // Bishops all on one color: insufficient (and both still have a piece, so no bare king).
    expect(new Position("4k3/8/3b4/8/8/2B5/8/4K3 w - - 0 1", FIGHT).result()).toEqual({ end: "insufficient_material", winner: -1 });
    expect(new Position("4k3/8/2b5/8/8/2B5/8/4K3 w - - 0 1", FIGHT).result()).toBeNull();
    expect(new Position("4k3/4p3/7r/8/8/R7/4P3/4K3 w - - 100 80", FIGHT).result()).toEqual({ end: "fifty_moves", winner: -1 });
  });

  it("no castling in a fight's start (no rights), en passant afterwards as in chess", () => {
    const pos = new Position("4k3/3p4/8/4P3/8/8/8/R3K2R b - - 0 1", FIGHT);
    expect(pos.legalMoves().map(moveUci)).not.toContain("e1g1");
    pos.play("d7d5");
    expect(pos.fen().split(" ")[3]).toBe("d6");
    pos.play("e5d6");
    expect(pos.fen().split(" ")[0]).toBe("4k3/8/3P4/8/8/8/8/R3K2R");
  });

  it("ordinary chess keeps castling and promotion", () => {
    const pos = new Position("4k3/1P6/8/8/8/8/8/R3K2R w KQ - 0 1", CHESS_RULES);
    const moves = pos.legalMoves().map(moveUci);
    expect(moves).toEqual(expect.arrayContaining(["e1g1", "e1c1", "b7b8q", "b7b8n"]));
    expect(moves).not.toContain("b7b8");
  });
});
