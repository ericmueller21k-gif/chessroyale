import { describe, expect, it } from "vitest";
import { pickRows } from "../src/pick-rows.ts";

const upTo = (max: number) => (keep: Set<number>) => keep.size <= max;
const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe("pickRows (the phone's small scoreboard)", () => {
  it("shows you, the leader and both sides of the cut line first", () => {
    expect(sorted(pickRows(64, 20, 56, upTo(4)))).toEqual([0, 20, 55, 56]);
  });
  it("then your neighbors and the rest of the top five", () => {
    expect(sorted(pickRows(64, 20, 56, upTo(10)))).toEqual([0, 1, 2, 3, 4, 19, 20, 21, 55, 56]);
  });
  it("never repeats a row when you're at the top or on the cut line", () => {
    expect(sorted(pickRows(64, 0, 56, upTo(3)))).toEqual([0, 55, 56]);
    expect(sorted(pickRows(8, 7, 4, upTo(8)))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("skips the cut line when nobody goes out", () => {
    expect(sorted(pickRows(4, 2, 4, upTo(2)))).toEqual([0, 2]);
  });
  it("skips a row that doesn't fit and shows the next that does (Nov 26: a phone's 50 v 50, you last on your team)", () => {
    // MiniTower's heights: an 18 px header, 22 px rows, a "⋯" gap 13.2 px, the cut line 10 px; a 137 px body (390 × 750).
    const fits = (cutoff: number) => (keep: Set<number>) => {
      const idx = sorted(keep);
      let h = 18 + idx.length * 22;
      idx.forEach((i, k) => {
        if (k > 0 && i - idx[k - 1]! > 1) h += 13.2;
        if (i === cutoff) h += 10;
      });
      return h <= 137;
    };
    // You, the leader and the last safe row; the first row past the cut (a gap and the line: 142.4 px) doesn't fit, your
    // neighbor does: four rows, not three.
    expect(sorted(pickRows(50, 49, 47, fits(47)))).toEqual([0, 46, 48, 49]);
  });
});
