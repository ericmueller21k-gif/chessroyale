import { describe, expect, it } from "vitest";
import { inCheck, queenInDanger } from "../src/index.ts";

describe("queenInDanger (the God King's warning)", () => {
  it("spots a queen attacked by a cheaper piece, even when defended", () => {
    // 1. e4 e5 2. Qg4 Nf6: the knight hits the queen.
    expect(queenInDanger("rnbqkb1r/pppp1ppp/5n2/4p3/4P1Q1/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3", "w")).toBe(true);
  });
  it("stays quiet when nothing attacks the queen", () => {
    expect(queenInDanger("rnb1kbnr/pppp1ppp/8/4p3/3P2Pq/8/PPP1PP1P/RNBQKBNR w KQkq - 0 3", "b")).toBe(false);
    expect(queenInDanger("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "w")).toBe(false);
  });
  it("stays quiet about a defended queen facing only the other queen (a trade offer)", () => {
    // Queens face off on the d-file, each defended by its king.
    expect(queenInDanger("3qk3/8/8/8/8/8/8/3QK3 w - - 0 1", "w")).toBe(false);
  });
  it("warns about an undefended queen facing the other queen", () => {
    expect(queenInDanger("3qk3/8/8/8/8/8/8/3Q2K1 w - - 0 1", "w")).toBe(true);
  });
});

describe("inCheck", () => {
  it("knows when the side to move is in check", () => {
    expect(inCheck("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")).toBe(true);
    expect(inCheck("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(false);
  });
});
