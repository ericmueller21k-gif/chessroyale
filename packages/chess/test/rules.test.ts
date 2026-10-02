import { describe, expect, it } from "vitest";
import { mulberry32 } from "@chessroyale/core";
import { applyMove, fenAfter, gameEnd, legalMoves, pickOpenings, sanLineToUci, sideToMove, START_FEN, toSan, type Opening } from "../src/index.ts";

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
