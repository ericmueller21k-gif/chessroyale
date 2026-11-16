import { describe, expect, it } from "vitest";
import { mulberry32 } from "@chessroyale/core";
import { applyMove, blunderCost, fenAfter, gameEnd, legalMoves, pickOpenings, sanLineToUci, sideToMove, START_FEN, toSan, type Opening } from "../src/index.ts";

describe("rules", () => {
  it("lists legal moves in UCI and applies them", () => {
    expect(legalMoves(START_FEN)).toHaveLength(20);
    const fen = applyMove(START_FEN, "e2e4");
    expect(sideToMove(fen)).toBe("b");
    expect(toSan(START_FEN, "g1f3")).toBe("Nf3");
  });

  it("detects mate and repetition", () => {
    expect(gameEnd(START_FEN, sanLineToUci(["f3", "e5", "g4", "Qh4#"]))).toBe("checkmate");
    expect(gameEnd(START_FEN, sanLineToUci(["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]))).toBe("repetition");
    expect(gameEnd(START_FEN, ["e2e4"])).toBeNull();
  });

  it("handles promotion moves", () => {
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    expect(legalMoves(fen)).toContain("a7a8q");
    expect(legalMoves(fen)).toContain("a7a8n");
    expect(fenAfter(["a7a8n"], fen).startsWith("N7")).toBe(true);
  });
});

describe("pickOpenings", () => {
  const make = (i: number, family: string, unusual: boolean, e = 0.5): Opening => ({
    id: `o${i}`,
    eco: "C00",
    name: family,
    family,
    unusual,
    moves: Array(21).fill("e2e4"),
    namedPlies: 21,
    expected: { 20: e, 21: e },
  });
  const lib = [
    ...Array.from({ length: 20 }, (_, i) => make(i, `F${i % 10}`, false)),
    ...Array.from({ length: 4 }, (_, i) => make(100 + i, `U${i}`, true)),
    make(200, "Lopsided", false, 0.8),
  ];

  it("picks classic and unusual lines from different families, inside the balance window", () => {
    const picks = pickOpenings(mulberry32(1), lib, { classic: 7, unusual: 1 }, 20, [0.4, 0.6]);
    expect(picks).toHaveLength(8);
    expect(picks.filter((p) => p.unusual)).toHaveLength(1);
    expect(new Set(picks.map((p) => p.family)).size).toBe(8);
    expect(picks.some((p) => p.family === "Lopsided")).toBe(false);
  });
});

describe("what a blunder costs (the God King's Last Stand names it)", () => {
  const after = (sans: string[]) => fenAfter(sanLineToUci(sans));
  it("a piece the boss's reply wins outright: loses your knight, your queen", () => {
    // QGD Exchange: Ne4?? and dxe4 takes the knight; nothing takes back.
    const qgd = after(["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5", "Bg5", "c6"]);
    expect(blunderCost(qgd, "c3e4", "d5e4")).toEqual({ kind: "piece", piece: "n" });
    // Open Sicilian: Qg4?? and Bxg4 takes the queen.
    const sic = after(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "Nc6"]);
    expect(blunderCost(sic, "d1g4", "c8g4")).toEqual({ kind: "piece", piece: "q" });
    // Taken by a bishop that can be taken back: still a queen for a bishop.
    expect(blunderCost("4k3/8/8/2b5/8/8/3Q1P2/3RK3 w - - 0 1", "d2e3", "c5e3")).toEqual({ kind: "piece", piece: "q" });
  });

  it("an even trade isn't a lost piece; a pawn isn't named either: the chances say it", () => {
    // Qd4 is guarded by the knight: Qxd4 Nxd4 is a queen trade.
    expect(blunderCost("4k3/8/8/3q4/3Q4/8/2N5/4K3 w - - 0 1", "e1f1", "d5d4")).toEqual({ kind: "chances" });
    // The reply takes a pawn.
    expect(blunderCost(after(["e4", "d5"]), "a2a3", "d5e4")).toEqual({ kind: "chances" });
    expect(blunderCost(after(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nd4"]), "f3e5", "d8g5")).toEqual({ kind: "chances" });
  });

  it("a forced mate: a quick one first, a long one after a lost piece", () => {
    const fool = after(["f3", "e5"]);
    expect(blunderCost(fool, "g2g4", "d8h4", 1)).toEqual({ kind: "mate", in: 1 });
    const qgd = after(["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5", "Bg5", "c6"]);
    expect(blunderCost(qgd, "c3e4", "d5e4", 3)).toEqual({ kind: "mate", in: 3 });
    expect(blunderCost(qgd, "c3e4", "d5e4", 9)).toEqual({ kind: "piece", piece: "n" });
    expect(blunderCost(qgd, "a2a3", "h7h6", 9)).toEqual({ kind: "mate", in: 9 });
  });

  it("no reply, or one that isn't legal there: the chances", () => {
    const qgd = after(["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5", "Bg5", "c6"]);
    expect(blunderCost(qgd, "c3e4")).toEqual({ kind: "chances" });
    expect(blunderCost(qgd, "c3e4", "e2e4")).toEqual({ kind: "chances" });
  });
});
