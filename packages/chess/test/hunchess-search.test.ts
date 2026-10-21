import { describe, expect, it } from "vitest";
import { mulberry32 } from "@chessroyale/core";
import { CHESS_RULES, evaluate, expectedScore, mateMoves, RULE_WIN, fightRules, gameMoves, gameResult, HunchessEngine, Position, WIN, winMoves, type HunRules } from "../src/hunchess/index.ts";

/** The HunChess engine's search and evaluation: it finds wins by every rule, avoids losses by them, and is deterministic. */

const FIGHT: HunRules = fightRules({ quietCap: 10, moveCap: 60, stallWinMargin: 100 });
const engine = (nodes = 20000) => new HunchessEngine({ nodes, ttBits: 16 });
const best = (fen: string, rules: HunRules, nodes = 20000, moves: string[] = []) => engine(nodes).best({ startFen: fen, moves, rules });

describe("HunChess search", () => {
  it("finds a back-rank mate (ordinary chess)", () => {
    const r = best("6k1/5ppp/8/8/8/8/5PPP/4RRK1 w - - 0 1", CHESS_RULES);
    expect(r.move).toBe("e1e8");
    expect(r.score).toBe(WIN - 1);
  });

  it("is deterministic: the same game gives the same move, score, depth and node count", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
    const a = best(fen, CHESS_RULES, 30000);
    const b = best(fen, CHESS_RULES, 30000);
    expect(a).toEqual(b);
    // And through a game's history, twice in a row on one engine after newGame.
    const e = engine(15000);
    const play = () => {
      e.newGame();
      const moves: string[] = [];
      for (let i = 0; i < 12; i++) moves.push(e.best({ startFen: fen, moves, rules: FIGHT }).move!);
      return moves;
    };
    expect(play()).toEqual(play());
  });

  it("stays near its node budget", () => {
    const r = best("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", CHESS_RULES, 25000);
    expect(r.nodes).toBeGreaterThan(20000);
    expect(r.nodes).toBeLessThan(25000 + 200);
  });

  it("a fight: takes the last enemy piece, which wins at once (a bare king loses)", () => {
    const r = best("4k3/8/8/8/8/8/8/R1n1K2R w - - 0 1", FIGHT, 5000);
    expect(r.move).toBe("a1c1");
    expect(r.score).toBe(RULE_WIN - 1);
  });

  it("a fight: never cashes in its last piece (that would leave a bare king)", () => {
    // White's only piece is a pawn on b7 that could cash in; doing so loses at once.
    const r = best("4k3/1P6/8/8/8/8/7r/4K3 w - - 0 1", FIGHT, 5000);
    expect(r.move).not.toBe("b7b8");
  });

  it("a fight: the search knows a stall goes to the side a pawn ahead by the score (and a mate is told from another rule's win)", () => {
    // Nine quiet moves each: one more each and the fight stalls. White, a knight up, sees the stall as its win.
    const start = "k7/8/p7/P7/8/8/8/1N5K w - - 0 1";
    const moves = ["h1h2", "a8b8", "h2h3", "b8c8", "h3g3", "c8d8", "g3g2", "d8e8", "g2f2", "e8f8", "f2f3", "f8g8", "f3e3", "g8g7", "e3e2", "g7f7", "e2d2", "f7e7"];
    const r = best(start, FIGHT, 20000, moves);
    expect(r.score).toBeGreaterThan(RULE_WIN - 10);
    expect(r.score).toBeLessThan(WIN - 500);
    expect(mateMoves(r.score)).toBeNull();
    expect(winMoves(r.score)).toBeLessThanOrEqual(2);
    // A mate is a mate: in the back-rank mate below it is found as one, in one move.
    expect(mateMoves(best("6k1/5ppp/8/8/8/8/5PPP/4RRK1 w - - 0 1", FIGHT, 5000).score)).toBe(1);
    expect([winMoves(WIN - 1), winMoves(WIN - 9), winMoves(RULE_WIN - 1), winMoves(RULE_WIN - 4), winMoves(900), mateMoves(RULE_WIN - 1)]).toEqual([1, 5, 1, 2, null, null]);
  });

  it("a fight: the side behind by the score steers away from a repetition, which would lose it the stall", () => {
    // White is a knight up and the kings have walked back and forth: Black's g8h8 would stand the position a third time. In chess
    // that is a draw, a gift to the side behind; in a fight it is a stall, and the score gives it to White. Black finds another move.
    const start = "7k/6pp/8/8/8/8/6PP/N5K1 w - - 0 1";
    const moves = ["g1f1", "h8g8", "f1g1", "g8h8", "g1f1", "h8g8", "f1g1"];
    const r = best(start, FIGHT, 20000, moves);
    expect(r.move).not.toBe("g8h8");
    expect(gameResult({ startFen: start, moves: [...moves, "g8h8"], rules: FIGHT })).toMatchObject({ end: "repetition", winner: 0, stall: true });
    // Ordinary chess: the side behind takes the draw.
    const chess = best(start, CHESS_RULES, 20000, moves);
    expect(chess.move).toBe("g8h8");
    expect(Math.abs(chess.score)).toBe(0);
  });

  it("a fight: a pawn one step from the end is no queen, so the defender doesn't chase it (ordinary chess must)", () => {
    // White's pawn on g7 can only cash in; Black, a rook against a knight and that pawn, is better. In chess, only Rg8 stops a queen.
    const fen = "r7/6P1/8/8/k7/8/3N4/4K3 b - - 0 1";
    const fight = best(fen, FIGHT, 20000);
    expect(fight.score).toBeGreaterThan(50);
    expect(best(fen, CHESS_RULES, 20000).move).toBe("a8g8");
  });

  it("a fight: a cash-in scores as the pawn given up plus the setting's small nudge for the gold", () => {
    const fen = "4k3/2P4r/8/8/8/8/8/R4BK1 w - - 0 1";
    const opts = { cashInValue: 20 };
    const pos = new Position(fen, FIGHT);
    pos.play("c7c8");
    // The same board with the pawn simply gone, and no cash-in counted.
    const gone = new Position("4k3/7r/8/8/8/8/8/R4BK1 b - - 0 1", FIGHT);
    expect(evaluate(pos, opts) - evaluate(gone, opts)).toBe(-20);
    expect(evaluate(new Position(fen, FIGHT), opts)).toBeGreaterThan(-evaluate(pos, opts) + 40);
  });

  it("returns a legal move in many random fight positions, and none when the fight is over", () => {
    const rng = mulberry32(3);
    let checked = 0;
    for (let g = 0; g < 6; g++) {
      const start = "2r1k3/PP3p2/8/3b4/4B3/8/pp3P2/2R1K3 w - - 0 1";
      const moves: string[] = [];
      const e = engine(1500);
      for (let i = 0; i < 40; i++) {
        const game = { startFen: start, moves, rules: FIGHT };
        if (gameResult(game)) {
          expect(e.best(game).move).toBeNull();
          break;
        }
        const legal = gameMoves(game);
        const r = e.best(game);
        expect(legal).toContain(r.move);
        checked++;
        // (Now and then a random move instead, so the games differ.)
        moves.push(rng() < 0.3 ? legal[Math.floor(rng() * legal.length)]! : r.move!);
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("weighs an exchange on a square (static exchange evaluation, x-rays included)", () => {
    const see = (fen: string, uci: string) => {
      const pos = new Position(fen);
      return pos.see(pos.parseMove(uci));
    };
    // A queen takes a pawn guarded by a pawn: loses 950 for 100.
    expect(see("4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1", "d1d5")).toBe(100 - 950);
    // A pawn takes a knight guarded by a pawn: wins 320 for 100.
    expect(see("4k3/8/2p5/3n4/4P3/8/8/4K3 w - - 0 1", "e4d5")).toBe(320 - 100);
    // Rook takes a rook backed by a rook, with our second rook behind (x-ray): R takes R, R takes R, R takes R: +500.
    expect(see("3r3k/3r4/8/8/8/8/3R4/3RK3 w - - 0 1", "d2d7")).toBe(500);
    // With their king next to the square it is one more recapture: even.
    expect(see("3rk3/3r4/8/8/8/8/3R4/3RK3 w - - 0 1", "d2d7")).toBe(0);
    // An undefended piece: all of it.
    expect(see("4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", "d1d5")).toBe(330);
  });

  it("turns scores into expected results: a win is 1, a loss 0, level 0.5", () => {
    expect(expectedScore(WIN - 3)).toBe(1);
    expect(expectedScore(-(WIN - 3))).toBe(0);
    expect(expectedScore(0)).toBeCloseTo(0.5);
    expect(expectedScore(200)).toBeGreaterThan(0.7);
  });
});
