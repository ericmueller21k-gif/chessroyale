import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectedFromWdl, parseInfo, START_FEN, type UciEngine } from "../src/index.ts";
import { createNodeEngine } from "../src/node.ts";

describe("parsing", () => {
  it("turns win/draw/loss per mille into an expected score", () => {
    expect(expectedFromWdl(620, 0, 380)).toBeCloseTo(0.62);
    expect(expectedFromWdl(100, 800, 100)).toBeCloseTo(0.5);
    expect(expectedFromWdl(1000, 0, 0)).toBe(1);
  });

  it("reads multipv, the first pv move and wdl, skipping bound lines", () => {
    const l = "info depth 12 seldepth 18 multipv 2 score cp 23 wdl 49 944 7 nodes 99000 nps 1 pv d2d4 g8f6 c2c4";
    expect(parseInfo(l)).toEqual({ multipv: 2, move: "d2d4", expected: expectedFromWdl(49, 944, 7) });
    expect(parseInfo(l.replace("cp 23", "cp 23 lowerbound"))).toBeNull();
    expect(parseInfo("info string NNUE evaluation")).toBeNull();
  });
});

describe("engine (WebAssembly Stockfish, fixed budget)", () => {
  let engine: UciEngine;
  beforeAll(async () => {
    engine = await createNodeEngine({ nodes: 20_000, hashMb: 16 });
  }, 30_000);
  afterAll(() => engine.close());

  it("gives the same numbers for the same position every time", async () => {
    const a = await engine.topMoves(START_FEN, 4);
    const b = await engine.topMoves(START_FEN, 4);
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    for (const m of a) expect(m.expected).toBeGreaterThan(0.3);
  }, 30_000);

  it("scores listed moves outside the top N with an extra search", async () => {
    const r = await engine.analyse(START_FEN, ["g2g4", "e2e4"], 2);
    const moves = Object.fromEntries(r.moves.map((m) => [m.move, m.expected]));
    expect(moves.g2g4).toBeDefined();
    expect(moves.e2e4).toBeDefined();
    expect(moves.g2g4!).toBeLessThan(r.best.expected);
  }, 30_000);

  it("sees a blunder as a big loss", async () => {
    // White to move can take a hanging queen with the knight on e5? Use a simple hanging-queen position.
    const fen = "rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const r = await engine.analyse(fen, ["f3h4", "a2a3"], 1);
    const m = Object.fromEntries(r.moves.map((x) => [x.move, x.expected]));
    expect(r.best.move).toBe("f3h4");
    expect((m.f3h4! - m.a2a3!) * 100).toBeGreaterThan(30);
  }, 30_000);
});
