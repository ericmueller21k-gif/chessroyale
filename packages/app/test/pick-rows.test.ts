import { describe, expect, it } from "vitest";
import { pickRows } from "../src/pick-rows.ts";

const upTo = (max: number) => (keep: Set<number>) => keep.size <= max;
const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe("pickRows (the phone's small scoreboard)", () => {
  it("shows you, the leader and both sides of the cut line first", () => {
    expect(sorted(pickRows(64, 20, 56, upTo(4)))).toEqual([0, 20, 55, 56]);
  });
  it("then your neighbours and the rest of the top five", () => {
    expect(sorted(pickRows(64, 20, 56, upTo(10)))).toEqual([0, 1, 2, 3, 4, 19, 20, 21, 55, 56]);
  });
  it("never repeats a row when you're at the top or on the cut line", () => {
    expect(sorted(pickRows(64, 0, 56, upTo(3)))).toEqual([0, 55, 56]);
    expect(sorted(pickRows(8, 7, 4, upTo(8)))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("skips the cut line when nobody goes out", () => {
    expect(sorted(pickRows(4, 2, 4, upTo(2)))).toEqual([0, 2]);
  });
});
