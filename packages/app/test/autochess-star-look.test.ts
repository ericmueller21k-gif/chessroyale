import { describe, expect, it } from "vitest";
import { AUTOCHESS } from "@chessroyale/core";
import { PIECE_SHAPES } from "../src/autochess/pieceShapes.ts";
import { starCenters, starWidth } from "../src/components/AcStarArt.tsx";

// The star look (v8, Eric Oct 22; docs/decisions/2026-10-22-autochess-star-look.md): tiny solid stars inside the piece's body, and an outline that follows its shape. The pieces that
// can be starred are the rook, knight, bishop and queen, each of them white and black: the numbers below are the picture's own (a piece is a 45 x 45 drawing).

const PIECES = ["rw", "rb", "nw", "nb", "bw", "bb", "qw", "qb"];

describe("auto chess: the star look", () => {
  it("every piece that can be starred has its shapes (the outline is drawn from them), and each shape has a paint", () => {
    for (const piece of PIECES) {
      const shapes = PIECE_SHAPES[piece]!;
      expect(shapes.length, piece).toBeGreaterThan(0);
      for (const s of shapes) {
        expect(s.d !== undefined || (s.cx !== undefined && s.cy !== undefined && s.r !== undefined), piece).toBe(true);
        expect(s.fill !== "none" || s.stroke !== "none", `${piece}: a shape that paints nothing`).toBe(true);
        expect(s.sw).toBeGreaterThan(0);
      }
      // (The black line round a piece is 1.5 thick: the colored band is drawn that much wider again.)
      expect(Math.max(...shapes.map((s) => s.sw)), piece).toBe(1.5);
    }
  });

  it("the stars are tiny (at most 12% of the square) and sit inside the piece's box, clear of its edge", () => {
    for (const piece of PIECES) {
      expect(starWidth(piece) / 45, piece).toBeLessThanOrEqual(0.12 + 1e-9);
      expect(starWidth(piece) / 45, piece).toBeGreaterThan(0.07);
      for (const n of [2, 3]) {
        const half = starWidth(piece) / 2;
        for (const [x, y] of starCenters(n, piece)) {
          expect(x - half, `${piece} ${n}`).toBeGreaterThan(8);
          expect(x + half, `${piece} ${n}`).toBeLessThan(37);
          expect(y - half, `${piece} ${n}`).toBeGreaterThan(8);
          expect(y + half, `${piece} ${n}`).toBeLessThan(40);
        }
      }
    }
  });

  it("two stars sit side by side on one line; three stand one above and two below, a triangle that takes about 28% of the square's width and no more than 24% of its height", () => {
    for (const piece of PIECES) {
      const two = starCenters(2, piece);
      expect(two).toHaveLength(2);
      expect(two[0]![1]).toBe(two[1]![1]);
      expect(two[0]![0]).toBeLessThan(two[1]![0]);
      const three = starCenters(3, piece);
      expect(three).toHaveLength(3);
      const [top, left, right] = three as [number, number][];
      expect(top[1]).toBeLessThan(left[1]);
      expect(left[1]).toBe(right[1]);
      expect(top[0]).toBeCloseTo((left[0] + right[0]) / 2, 6);
      const w = starWidth(piece);
      const width = right[0] - left[0] + w;
      const height = left[1] - top[1] + w * 0.95;
      expect(width / 45, piece).toBeLessThanOrEqual(0.28);
      expect(width / 45, piece).toBeGreaterThan(0.1);
      expect(height / 45, piece).toBeLessThanOrEqual(0.24);
      // (The stars of a group never overlap one another: a star's width is 1.9 radii and a neighbor's center is further than that.)
      for (let i = 0; i < three.length; i++) for (let j = i + 1; j < three.length; j++) expect(Math.hypot(three[i]![0] - three[j]![0], three[i]![1] - three[j]![1]), piece).toBeGreaterThan(w * 0.95);
    }
  });

  it("the outlines are off in the fight unless the setting says so (the tiny stars always stay)", () => {
    expect(AUTOCHESS.fightGlow).toBe(false);
  });
});
