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
    // (The pv's second move is the opponent's best reply: kept for the God King's Last Stand.)
    expect(parseInfo(l)).toEqual({ multipv: 2, move: "d2d4", expected: expectedFromWdl(49, 944, 7), reply: "g8f6" });
    expect(parseInfo(l.replace(" g8f6 c2c4", ""))).toEqual({ multipv: 2, move: "d2d4", expected: expectedFromWdl(49, 944, 7) });
    expect(parseInfo(l.replace("cp 23", "cp 23 lowerbound"))).toBeNull();
    expect(parseInfo("info string NNUE evaluation")).toBeNull();
  });

  it("reads a forced mate from the side to move's view (negative: it gets mated)", () => {
    const mated = "info depth 20 multipv 1 score mate -2 wdl 0 0 1000 nodes 5000 pv e1e2 d8h4 e2e3 h4e4";
    expect(parseInfo(mated)).toMatchObject({ move: "e1e2", reply: "d8h4", mate: -2, expected: 0 });
    expect(parseInfo(mated.replace("mate -2", "mate 3"))).toMatchObject({ mate: 3 });
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

  it("keeps each move's best reply and a mate in its line, from the same search (no extra engine time)", async () => {
    // Black's last move hung the queen on h4 to the knight: every line carries Black's best answer.
    const fen = "rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const top = await engine.topMoves(fen, 3);
    expect(top[0]!.move).toBe("f3h4");
    for (const m of top) expect(m.reply, m.move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    // Fool's mate: after 1.f3 e5, White's g4 allows Qh4 mate, which the search restricted to it reports.
    const fool = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2";
    const [g4] = await engine.scoreMoves(fool, ["g2g4"]);
    expect(g4).toMatchObject({ move: "g2g4", reply: "d8h4", mate: -1 });
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
