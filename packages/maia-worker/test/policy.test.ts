// Maia box (AGPL-3.0): from raw scores to moves with probabilities, and the official way of drawing one.
import { describe, expect, it } from "vitest";
import { moveIndex, VOCAB } from "../src/encode.ts";
import { policy, sample, seeded } from "../src/policy.ts";

const logitsFor = (scores: Record<string, number>, black = false) => {
  const l = new Float32Array(VOCAB).fill(-50);
  for (const [m, s] of Object.entries(scores)) l[moveIndex(m, black)] = s;
  return l;
};

describe("policy", () => {
  it("is a softmax over just the moves given, most likely first", () => {
    const l = logitsFor({ e2e4: 2, d2d4: 1, g1f3: 0, a2a3: 9 });
    const p = policy(l, ["g1f3", "e2e4", "d2d4"], false);
    expect(p.map((m) => m.move)).toEqual(["e2e4", "d2d4", "g1f3"]);
    expect(p.reduce((a, m) => a + m.p, 0)).toBeCloseTo(1, 10);
    expect(p[0]!.p / p[1]!.p).toBeCloseTo(Math.E, 5);
  });

  it("reads Black's moves from the mirrored board, promotions included", () => {
    const l = logitsFor({ e7e5: 3, a2a1q: 5, a2a1n: 1 }, true);
    const p = policy(l, ["e7e5", "a2a1q", "a2a1n"], true);
    expect(p.map((m) => m.move)).toEqual(["a2a1q", "e7e5", "a2a1n"]);
  });
});

describe("sample", () => {
  const moves = policy(logitsFor({ e2e4: 2, d2d4: 1.5, g1f3: 0, b1c3: -3 }), ["e2e4", "d2d4", "g1f3", "b1c3"], false);

  it("temperature 0 is always the most likely move", () => {
    for (let i = 0; i < 20; i++) expect(sample(moves, 0, 1, Math.random)).toBe("e2e4");
  });

  it("draws in proportion at temperature 1, and top-p keeps only the likeliest", () => {
    const rand = seeded(7);
    const count = (t: number, p: number) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 4000; i++) {
        const m = sample(moves, t, p, rand)!;
        c[m] = (c[m] ?? 0) + 1;
      }
      return c;
    };
    const all = count(1, 1);
    expect(all.e2e4! / 4000).toBeCloseTo(moves[0]!.p, 1);
    expect(all.b1c3 ?? 0).toBeGreaterThan(0);
    // (e2e4 0.572 + d2d4 0.347 = 0.919 ≤ 0.95: g1f3 and b1c3 are cut; at 0.9 only e2e4 is left, as officially.)
    expect(Object.keys(count(1, 0.95)).sort()).toEqual(["d2d4", "e2e4"]);
    expect(Object.keys(count(1, 0.9))).toEqual(["e2e4"]);
    // A low temperature sharpens: the favourite more often than its probability.
    expect((count(0.5, 1).e2e4 ?? 0) / 4000).toBeGreaterThan(moves[0]!.p + 0.05);
  });

  it("is repeatable with a seed", () => {
    const a = seeded(42);
    const b = seeded(42);
    const xs = Array.from({ length: 30 }, () => sample(moves, 1, 1, a));
    const ys = Array.from({ length: 30 }, () => sample(moves, 1, 1, b));
    expect(xs).toEqual(ys);
  });

  it("nothing to draw from: null", () => {
    expect(sample([], 1, 1, Math.random)).toBeNull();
  });
});
