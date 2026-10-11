// Maia box (AGPL-3.0): the encoder and decoder against the official Maia-3 tokenizer's own output (fixtures made by
// scripts/convert.py from CSSLab/maia3's tokenize_board and move vocabulary).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blackToMove, encodeBoard, encodeTokens, HISTORY, indexMove, moveIndex, PLANES, VOCAB } from "../src/encode.ts";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/encoding.json", import.meta.url), "utf8")) as {
  positions: { fen: string; hot: [number, number][]; moves: Record<string, number> }[];
};

describe("the encoder (the official tokenizer's planes)", () => {
  it("covers both colours to move, promotions both ways, castling and en passant", () => {
    const fens = fixtures.positions.map((p) => p.fen);
    expect(fens.some((f) => blackToMove(f))).toBe(true);
    expect(fens.some((f) => !blackToMove(f))).toBe(true);
    const moves = fixtures.positions.flatMap((p) => Object.keys(p.moves).map((m) => ({ m, black: blackToMove(p.fen) })));
    expect(moves.some(({ m, black }) => m.length === 5 && !black)).toBe(true);
    expect(moves.some(({ m, black }) => m.length === 5 && black)).toBe(true);
    expect(moves.some(({ m }) => m.endsWith("n"))).toBe(true);
    expect(moves.some(({ m }) => m === "e1g1" || m === "e8c8" || m === "e8g8")).toBe(true);
  });

  for (const p of fixtures.positions) {
    it(`${p.fen}: the same hot planes`, () => {
      const board = encodeBoard(p.fen);
      const hot: [number, number][] = [];
      board.forEach((v, i) => v && hot.push([Math.floor(i / PLANES), i % PLANES]));
      expect(hot).toEqual(p.hot);
    });
    it(`${p.fen}: every legal move at the official index, and back`, () => {
      const black = blackToMove(p.fen);
      for (const [move, index] of Object.entries(p.moves)) {
        expect(moveIndex(move, black), move).toBe(index);
        expect(indexMove(index, black)).toBe(move);
      }
    });
  }

  it("repeats the current board for every board of history", () => {
    const fen = fixtures.positions[2]!.fen;
    const board = encodeBoard(fen);
    const tokens = encodeTokens(fen);
    expect(tokens.length).toBe(64 * PLANES * HISTORY);
    for (let sq = 0; sq < 64; sq++)
      for (let h = 0; h < HISTORY; h++)
        for (let c = 0; c < PLANES; c++) expect(tokens[sq * PLANES * HISTORY + h * PLANES + c]).toBe(board[sq * PLANES + c]);
  });

  it("maps every index to a distinct move and back", () => {
    for (const black of [false, true]) {
      const seen = new Set<string>();
      for (let i = 0; i < VOCAB; i++) {
        const m = indexMove(i, black);
        expect(moveIndex(m, black)).toBe(i);
        seen.add(m);
      }
      expect(seen.size).toBe(VOCAB);
    }
  });

  it("refuses a broken FEN", () => {
    expect(() => encodeBoard("8/8/8 w - - 0 1")).toThrow();
    expect(() => encodeBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1")).toThrow();
  });
});
