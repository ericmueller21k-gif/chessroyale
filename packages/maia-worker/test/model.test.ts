// Maia box (AGPL-3.0): the committed int8 model in onnxruntime-web's WebAssembly (as in the browser, one thread),
// against the same file's answers in native onnxruntime (fixtures from scripts/convert.py).
import { readFileSync } from "node:fs";
import { Chess } from "chess.js";
import { beforeAll, describe, expect, it } from "vitest";
import { blackToMove } from "../src/encode.ts";
import { MaiaModel } from "../src/model.ts";
import { policy } from "../src/policy.ts";
import { MaiaUci } from "../src/uci.ts";

const file = (p: string) => readFileSync(new URL(p, import.meta.url));
const fixtures = JSON.parse(file("./fixtures/maia3-23m-int8-top.json").toString()) as {
  positions: { fen: string; elo: number; int8: [string, number][]; pytorch: [string, number][] }[];
};
let model: MaiaModel;

beforeAll(async () => {
  const wasm = readFileSync(new URL("../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", import.meta.url));
  model = await MaiaModel.load(file("../model/maia3-23m-int8.onnx"), { wasm: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
}, 60_000);

describe("the int8 model in the browser's runtime", () => {
  it("gives the same top moves as native onnxruntime on every fixture (both colors, promotions)", async () => {
    let worst = 0;
    for (const p of fixtures.positions) {
      const out = await model.predict(p.fen, p.elo, p.elo);
      const legal = new Chess(p.fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
      const ranked = policy(out.logits, legal, blackToMove(p.fen));
      expect(ranked[0]!.move, `${p.fen} at ${p.elo}`).toBe(p.int8[0]![0]);
      for (const [move, prob] of p.int8) worst = Math.max(worst, Math.abs((ranked.find((r) => r.move === move)?.p ?? 0) - prob));
    }
    expect(worst).toBeLessThan(0.05);
  }, 60_000);

  it("plays like a human of the rating it's given: the rating changes its choices", async () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to);
    const at = async (elo: number) => policy((await model.predict(fen, elo, elo)).logits, legal, false);
    // Scholar's mate is there: a strong player sees it more surely than a beginner.
    const strong = (await at(2600)).find((m) => m.move === "h5f7")!.p;
    const weak = (await at(800)).find((m) => m.move === "h5f7")!.p;
    expect(strong).toBeGreaterThan(0.9);
    expect(weak).toBeLessThan(strong);
  }, 60_000);

  it("speaks the protocol end to end with the real model", async () => {
    const out: string[] = [];
    const uci = new MaiaUci({ send: (l) => out.push(l), load: async () => model.predict });
    for (const l of ["uci", "setoption name UCI_Elo value 1900", "isready", "position startpos moves e2e4", "go"]) await uci.handle(l);
    expect(out).toContain("readyok");
    const info = out.filter((l) => l.startsWith("info depth"));
    expect(info).toHaveLength(5);
    expect(out.at(-1)).toMatch(/^bestmove (e7e5|c7c5|e7e6|c7c6|d7d5|d7d6|g8f6|b8c6)$/);
  }, 60_000);
});
