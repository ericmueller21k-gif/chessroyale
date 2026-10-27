import { describe, expect, it } from "vitest";
import { applyMove, crowdAllowed, initPowers, legalMoves, START_FEN } from "@chessroyale/chess";
import type { BossState } from "@chessroyale/core";
import { refusedMove } from "../src/board/logic.ts";
import { REFUSED, REFUSED_OTHER, THROUGH, refusedLine, throughLine } from "../src/refused.ts";

/**
 * A move a boss power refuses says why, and the boss's only move through a power says so (Eric, Oct 17: his move
 * across Sawyer's board saw went straight back, "like it glitched", then the boss's queen crossed it: his only way out
 * of check). The board finds the refused move (refusedMove); the dock words it (refused.ts).
 */

const OPEN = "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1";
const AFTER_E4 = applyMove(START_FEN, "e2e4");
const AFTER_E4_E5 = applyMove(AFTER_E4, "e7e5");

describe("the board: a move chess allows but the turn doesn't", () => {
  it("is found for a tap or a drop across the board saw (a capture too), never for an allowed move, a non-move or an unlimited turn", () => {
    // Eric's: your queen takes his across the saw.
    const before = "3qk2r/1q4Q1/1p1p4/3PpP1N/4PP2/8/1p3K2/7R w k - 0 35";
    const boss = { id: "sawyer", crowdSide: "w", crowdMoves: 30, powers: { ...initPowers(1, before, "w"), turn: 31, split: { turn: 2, pawn: null, square: null, halves: [] }, boardSaw: { at: 30, until: 34 } } } as unknown as BossState;
    const allowed = crowdAllowed(boss, before)!;
    expect(refusedMove(before, allowed, "g7", "b7")).toBe("g7b7");
    expect(refusedMove(before, allowed, "h5", "f6")).toBeNull();
    // (Not a move at all: nothing to say.)
    expect(refusedMove(before, allowed, "g7", "a1")).toBeNull();
    // (Nothing limits the moves: nothing is refused.)
    expect(refusedMove(before, undefined, "g7", "b7")).toBeNull();
    // A promotion: one of its moves names it.
    const promo = "8/1P6/8/8/8/8/k7/4K3 w - - 0 1";
    expect(refusedMove(promo, legalMoves(promo).filter((m) => !m.startsWith("b7")), "b7", "b8")).toMatch(/^b7b8[qrbn]$/);
  });
});

describe("the dock's words", () => {
  it("a refused move of yours says which power stops it", () => {
    expect(refusedLine({ id: "sawyer", powers: { boardSaw: { at: 3, until: 7 } } }, OPEN, "d2g5")).toBe("The board saw blocks that move.");
    expect(refusedLine({ id: "sawyer", powers: { cut: { a: "d2", b: "d3", at: 3, until: 5 } } }, OPEN, "d2d3")).toBe("The saw cut blocks that move.");
    expect(refusedLine({ id: "clown", powers: { pies: [{ square: "d3", until: 4 }] } }, AFTER_E4_E5, "d2d3")).toBe("A pie blocks that square.");
    expect(refusedLine({ id: "bigboy", powers: { block: { square: "f3", at: 2, until: 4 } } }, AFTER_E4_E5, "g1f3")).toBe("A toy block is in the way.");
    expect(refusedLine({ id: "gingerbread", powers: { iced: ["g1"] } }, AFTER_E4_E5, "g1f3")).toBe("That piece is frozen.");
    expect(refusedLine({ id: "gingerbread", barred: "g1f3", powers: {} }, AFTER_E4_E5, "g1f3")).toBe("The God King took that move back.");
    // (Wrangler's duels: the dock already says to take one; any other refusal, the plain words.)
    expect(refusedLine({ id: "pig", powers: {} }, AFTER_E4_E5, "g1f3")).toBe(REFUSED_OTHER);
    expect(REFUSED_OTHER).toBe("That move isn't allowed this turn.");
  });

  it("the boss's only move through a power says so on your turn; an ordinary move says nothing", () => {
    expect(throughLine({ lastMove: { through: "boardsaw" } })).toBe("His only move: across the saw.");
    expect(throughLine({ lastMove: { through: "cut" } })).toBe("His only move: across the cut.");
    expect(throughLine({ lastMove: { through: "pie" } })).toBe("His only move: onto the pie.");
    expect(throughLine({ lastMove: { through: "block" } })).toBe("His only move: past the block.");
    expect(throughLine({ lastMove: {} })).toBeNull();
    expect(throughLine({ lastMove: null })).toBeNull();
    expect(throughLine(null)).toBeNull();
  });

  it("each is one short sentence (each is the dock's whole line: e2e/sawyer.spec.ts measures them at 320 px)", () => {
    for (const line of [...Object.values(REFUSED), REFUSED_OTHER, ...Object.values(THROUGH)]) {
      expect(line).toMatch(/^[A-Z].*\.$/);
      expect(line.length).toBeLessThanOrEqual(34);
    }
  });
});

describe("Moo & Moon's moonbeam in the dock's words", () => {
  it("the stunned piece's own move, and castling with a stunned rook: \"Moonlight holds that piece.\"", () => {
    const fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const boss = { id: "moo", powers: { stunned: ["h1"] } };
    expect(refusedLine(boss, fen, "h1g1")).toBe(REFUSED.stunned);
    expect(refusedLine(boss, fen, "e1g1")).toBe(REFUSED.stunned);
    expect(REFUSED.stunned).toBe("Moonlight holds that piece.");
  });

  it("Folio's folded piece's own move, and castling with a folded rook: \"That piece is folded.\"", () => {
    const fen = "k6r/8/8/8/8/8/5N2/4K2R w K - 0 20";
    const boss = { id: "folio", powers: { folded: ["h1"] } };
    expect(refusedLine(boss, fen, "h1h2")).toBe(REFUSED.folded);
    expect(refusedLine(boss, fen, "e1g1")).toBe(REFUSED.folded);
    expect(REFUSED.folded).toBe("That piece is folded.");
  });
});

