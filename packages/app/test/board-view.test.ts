import { describe, expect, it } from "vitest";
import { coordLabel, realSquare, viewSquare, type QuarterTurn } from "../src/board-view.ts";
import { squareXY } from "../src/components/GodKing.tsx";

const SQUARES = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));
/** Where the board draws a square seen unturned (its column and row from the top-left), either way up. */
const cell = (key: string, orientation: "white" | "black") => {
  const f = key.charCodeAt(0) - 97;
  const r = Number(key[1]) - 1;
  return orientation === "white" ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
};

describe("a board turned a quarter of the way round (Boingo's funhouse)", () => {
  it("every real square has its own view square, and turns back to itself", () => {
    for (const turn of [0, 90, 270] as QuarterTurn[]) {
      const views = SQUARES.map((s) => viewSquare(s, turn));
      expect(new Set(views).size).toBe(64);
      for (const s of SQUARES) expect(realSquare(viewSquare(s, turn), turn)).toBe(s);
    }
    // A quarter turn one way and the other undo each other; two the same way are a half turn (a1 to h8).
    for (const s of SQUARES) {
      expect(viewSquare(viewSquare(s, 90), 270)).toBe(s);
      const half = viewSquare(viewSquare(s, 90), 90);
      expect(half).toBe(`${"hgfedcba"[s.charCodeAt(0) - 97]}${9 - Number(s[1])}`);
    }
  });

  it("is the picture turned clockwise (90) or anticlockwise (270), from either side, as the screen shows it", () => {
    for (const orientation of ["white", "black"] as const) {
      for (const s of SQUARES) {
        const before = cell(s, orientation);
        const cw = cell(viewSquare(s, 90), orientation);
        const ccw = cell(viewSquare(s, 270), orientation);
        // Clockwise: the column becomes 7 - row, the row the column.
        expect(cw).toEqual({ col: 7 - before.row, row: before.col });
        expect(ccw).toEqual({ col: before.row, row: 7 - before.col });
        // What's drawn over the board lands there too.
        const xy = squareXY(s, orientation, 90);
        expect({ col: (xy.x - 50) / 100, row: (xy.y - 50) / 100 }).toEqual(cw);
      }
    }
  });

  it("the coordinates name the real squares along each edge, from either side", () => {
    for (const orientation of ["white", "black"] as const) {
      for (const turn of [90, 270] as QuarterTurn[]) {
        // The bottom labels ("files") sit along the bottom row; the side labels ("ranks") by the first column.
        for (const f of "abcdefgh") {
          const key = `${f}${orientation === "white" ? 1 : 8}`;
          const real = realSquare(key, turn);
          // Along the bottom the real rank changes (the file is the same all along): each label names its square's rank.
          expect(coordLabel(f, "files", turn)).toBe(real[1]);
        }
        for (const r of "12345678") {
          const key = `${orientation === "white" ? "a" : "h"}${r}`;
          expect(coordLabel(r, "ranks", turn)).toBe(realSquare(key, turn)[0]);
        }
      }
    }
    expect(coordLabel("c", "files", 0)).toBe("c");
  });
});
