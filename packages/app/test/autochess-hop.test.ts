import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { firstHopMs, hopWaitMs } from "../src/autochess/hop.ts";

describe("auto chess: the pawns' hops (v7.1)", () => {
  it("the setting is 7 to 10 seconds, and one hop lasts 1.8 s", () => {
    expect(AUTOCHESS.hopEvery).toEqual([7, 10]);
    expect(AUTOCHESS.hopSeconds).toBe(1.8);
  });

  it("the wait to the next hop is random, always from 7 to 10 seconds (7000 to 10000 ms), and covers the whole range", () => {
    const rng = mulberry32(99);
    const waits = Array.from({ length: 5000 }, () => hopWaitMs(rng));
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(7000);
    expect(Math.max(...waits)).toBeLessThanOrEqual(10000);
    expect(Math.min(...waits)).toBeLessThan(7100);
    expect(Math.max(...waits)).toBeGreaterThan(9900);
    const mean = waits.reduce((a, b) => a + b, 0) / waits.length;
    expect(Math.abs(mean - 8500)).toBeLessThan(80);
    // The ends are the setting's: a draw of 0 is the shortest wait and (just under) 1 the longest.
    expect(hopWaitMs(() => 0)).toBe(7000);
    expect(hopWaitMs(() => 0.999999)).toBeCloseTo(10000, -1);
    // (A setting: another range gives another wait.)
    expect(hopWaitMs(() => 0.5, { ...AUTOCHESS, hopEvery: [2, 4] })).toBe(3000);
  });

  it("the first hop of a pawn comes at a random time up to the shorter wait, so the two pawns don't start together", () => {
    const rng = mulberry32(5);
    const firsts = Array.from({ length: 2000 }, () => firstHopMs(rng));
    expect(Math.min(...firsts)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...firsts)).toBeLessThanOrEqual(7000);
  });

  it("two pawns drawing from their own draws never fall into step: their hop times differ and drift apart", () => {
    // (Each pawn keeps its own random source: here two seeds.)
    const times = (seed: number) => {
      const rng = mulberry32(seed);
      let t = firstHopMs(rng);
      const out = [t];
      for (let i = 0; i < 12; i++) out.push((t += hopWaitMs(rng)));
      return out;
    };
    const a = times(1);
    const b = times(2);
    // Every hop of one is at least 7 s after its last, and the two lists never agree on a hop to the millisecond.
    for (const list of [a, b]) for (let i = 1; i < list.length; i++) expect(list[i]! - list[i - 1]!).toBeGreaterThanOrEqual(7000);
    expect(a.filter((t) => b.includes(t))).toEqual([]);
    // They drift apart: the gap between the two pawns' n-th hops is never the same twice.
    const gaps = a.map((t, i) => b[i]! - t);
    expect(new Set(gaps).size).toBe(gaps.length);
  });
});
