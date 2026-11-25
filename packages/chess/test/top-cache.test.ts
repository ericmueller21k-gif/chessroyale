import { describe, expect, it } from "vitest";
import { TopMovesCache, type EngineLike } from "../src/runner.ts";

function fakeEngine() {
  const calls: string[] = [];
  const engine: EngineLike = {
    topMoves: async (fen) => {
      calls.push(fen);
      return [{ move: "e2e4", expected: 0.5 }];
    },
    scoreMoves: async () => [],
  };
  return { engine, calls };
}

describe("TopMovesCache", () => {
  it("searches each position once, early, and spreads the work across engines", async () => {
    const a = fakeEngine();
    const b = fakeEngine();
    const cache = new TopMovesCache(8);
    cache.prefetch([a.engine, b.engine], ["f1", "f2", "f3"]);
    expect(a.calls).toEqual(["f1", "f3"]);
    expect(b.calls).toEqual(["f2"]);
    await cache.get(a.engine, "f2");
    cache.prefetch([a.engine, b.engine], ["f2", "f4"]); // f2 already searched: kept
    expect(a.calls).toEqual(["f1", "f3"]);
    expect(b.calls).toEqual(["f2", "f4"]);
    await cache.get(a.engine, "f1"); // forgotten: searched again on the engine asked
    expect(a.calls).toEqual(["f1", "f3", "f1"]);
  });
});
