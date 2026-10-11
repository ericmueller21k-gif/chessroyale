// Maia box (AGPL-3.0): the worker's text protocol, with a stand-in for the model.
import { describe, expect, it } from "vitest";
import { moveIndex, VOCAB } from "../src/encode.ts";
import type { Prediction, Predictor } from "../src/model.ts";
import { MaiaUci, START_FEN } from "../src/uci.ts";

/** A pretend model: a fixed score per move (anything else very unlikely); it records what it was asked. */
function fakeModel(scores: Record<string, number>) {
  const asked: { fen: string; self: number; oppo: number }[] = [];
  const predict: Predictor = async (fen, self, oppo) => {
    asked.push({ fen, self, oppo });
    const black = fen.split(" ")[1] === "b";
    const logits = new Float32Array(VOCAB).fill(-30);
    for (const [m, s] of Object.entries(scores)) logits[moveIndex(m, black)] = s;
    return { logits, wdl: [0.4, 0.3, 0.3] } satisfies Prediction;
  };
  return { predict, asked };
}

function engine(load: () => Promise<Predictor>) {
  const out: string[] = [];
  const events: string[] = [];
  const uci = new MaiaUci({ send: (l) => out.push(l), load, release: () => void events.push("release"), close: () => void events.push("close"), now: () => 0 }, "Maia-3 test");
  const say = async (...lines: string[]) => {
    out.length = 0;
    for (const l of lines) await uci.handle(l);
    return [...out];
  };
  return { uci, say, events };
}

describe("the Maia box's UCI-style protocol", () => {
  it("uci: its name and options, then uciok", async () => {
    const { say } = engine(async () => fakeModel({}).predict);
    const lines = await say("uci");
    expect(lines[0]).toBe("id name Maia-3 test");
    expect(lines).toContain("option name UCI_Elo type spin default 1500 min 0 max 5000");
    expect(lines.some((l) => l.startsWith("option name Temperature"))).toBe(true);
    expect(lines.some((l) => l.startsWith("option name TopP"))).toBe(true);
    expect(lines.at(-1)).toBe("uciok");
  });

  it("isready loads the model once, then readyok", async () => {
    let loads = 0;
    const { say } = engine(async () => {
      loads++;
      return fakeModel({}).predict;
    });
    expect(await say("isready")).toEqual(["readyok"]);
    expect(await say("isready")).toEqual(["readyok"]);
    expect(loads).toBe(1);
  });

  it("a failed load says so, still answers readyok, and go then has no move", async () => {
    const { say } = engine(async () => {
      throw new Error("no file");
    });
    expect(await say("isready")).toEqual(["info string error load failed: no file", "readyok"]);
    const go = await say("position startpos", "go");
    expect(go.at(-1)).toBe("bestmove (none)");
    expect(go.some((l) => l.startsWith("info string error"))).toBe(true);
  });

  it("go: the top K moves with their probabilities (pv last), then the most likely as bestmove at temperature 0", async () => {
    const model = fakeModel({ e2e4: 3, d2d4: 2, g1f3: 1, c2c4: 0.5 });
    const { say } = engine(async () => model.predict);
    const lines = await say("setoption name UCI_Elo value 1450", "setoption name MultiPV value 3", "position startpos", "go");
    expect(lines).toHaveLength(4);
    const re = /^info depth 1 multipv (\d+) time (\d+) p (0\.\d{4}|1\.0000) pv (\S+)$/;
    const infos = lines.slice(0, 3).map((l) => l.match(re));
    expect(infos.every(Boolean)).toBe(true);
    expect(infos.map((m) => m![1])).toEqual(["1", "2", "3"]);
    expect(infos.map((m) => m![4])).toEqual(["e2e4", "d2d4", "g1f3"]);
    const ps = infos.map((m) => Number(m![3]));
    expect(ps[0]).toBeGreaterThan(ps[1]!);
    expect(ps[1]).toBeGreaterThan(ps[2]!);
    expect(lines[3]).toBe("bestmove e2e4");
    expect(model.asked).toEqual([{ fen: START_FEN, self: 1450, oppo: 1450 }]);
  });

  it("go searchmoves: only those moves (a boss power's limits), probabilities among them", async () => {
    const { say } = engine(async () => fakeModel({ e2e4: 3, d2d4: 2, g1f3: 1, b1c3: 0 }).predict);
    const lines = await say("position startpos", "go searchmoves g1f3 b1c3 e7e5");
    expect(lines.filter((l) => l.startsWith("info")).map((l) => l.split(" pv ")[1])).toEqual(["g1f3", "b1c3"]);
    const p1 = Number(lines[0]!.match(/ p (\S+)/)![1]);
    expect(p1).toBeCloseTo(Math.E / (Math.E + 1), 3);
    expect(lines.at(-1)).toBe("bestmove g1f3");
  });

  it("position fen … moves …, Black to move: the board after the moves, read from Black's side", async () => {
    const model = fakeModel({ e7e5: 2, c7c5: 1 });
    const { say } = engine(async () => model.predict);
    const lines = await say(`position fen ${START_FEN} moves e2e4`, "go");
    expect(model.asked[0]!.fen.split(" ").slice(0, 2)).toEqual(["rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR", "b"]);
    expect(lines.at(-1)).toBe("bestmove e7e5");
  });

  it("promotions come back with their piece", async () => {
    const { say } = engine(async () => fakeModel({ a2a1q: 1, a2a1n: 3 }).predict);
    const lines = await say("position fen 8/8/8/8/8/2k5/p7/4K3 b - - 0 1", "go");
    expect(lines.at(-1)).toBe("bestmove a2a1n");
  });

  it("OppoElo is the opponent's rating; UCI_Elo alone sets both", async () => {
    const model = fakeModel({ e2e4: 1 });
    const { say } = engine(async () => model.predict);
    await say("setoption name UCI_Elo value 2000", "position startpos", "go", "setoption name OppoElo value 1200", "go");
    expect(model.asked.map((a) => [a.self, a.oppo])).toEqual([[2000, 2000], [2000, 1200]]);
  });

  it("temperature and top-p: a seeded draw among the likely moves only", async () => {
    const { say } = engine(async () => fakeModel({ e2e4: 2, d2d4: 1.9, g1f3: -1 }).predict);
    // (p ≈ 0.51, 0.46, 0.03: a top-p of 0.98 keeps the first two only.)
    await say("setoption name Temperature value 1", "setoption name TopP value 0.98", "setoption name Seed value 5", "position startpos");
    const best = new Set<string>();
    for (let i = 0; i < 40; i++) best.add((await say("go")).at(-1)!);
    expect([...best].sort()).toEqual(["bestmove d2d4", "bestmove e2e4"]);
  });

  it("no legal move (mate, or nothing among searchmoves): bestmove (none)", async () => {
    const { say } = engine(async () => fakeModel({}).predict);
    expect(await say("position fen rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", "go")).toEqual(["bestmove (none)"]);
    expect(await say("position startpos", "go searchmoves e7e5")).toEqual(["bestmove (none)"]);
  });

  it("a bad position is refused and the last good one kept; commands run strictly in order", async () => {
    const model = fakeModel({ e2e4: 1 });
    const { uci, say } = engine(async () => model.predict);
    const lines = await say("position fen not a fen at all x y", "go");
    expect(lines[0]).toMatch(/^info string error bad position/);
    expect(model.asked[0]!.fen).toBe(START_FEN);
    const out: Promise<void>[] = [uci.handle("position fen 8/8/8/8/8/2k5/p7/4K3 b - - 0 1"), uci.handle("go"), uci.handle("position startpos"), uci.handle("go")];
    await Promise.all(out);
    expect(model.asked.slice(1).map((a) => a.fen.split(" ")[1])).toEqual(["b", "w"]);
  });

  it("quit frees the model and ends the worker", async () => {
    const { say, events } = engine(async () => fakeModel({}).predict);
    await say("isready", "quit");
    expect(events).toEqual(["release", "close"]);
  });
});
