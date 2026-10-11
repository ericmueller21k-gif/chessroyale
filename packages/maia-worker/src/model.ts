// Maia box (AGPL-3.0, see LICENSE): the converted Maia-3 model (model/*.onnx, made by scripts/convert.py) in
// onnxruntime-web's WebAssembly backend, on one thread.
import * as ort from "onnxruntime-web/wasm";
import { encodeTokens, HISTORY, PLANES } from "./encode.ts";

export interface Prediction {
  /** The raw move scores: 4096 from-to moves, then 256 promotions, from the mover's side (see encode.ts). */
  logits: Float32Array;
  /** The value head's outlook for the side to move, as win, draw and loss probabilities. */
  wdl: [number, number, number];
}

export type Predictor = (fen: string, eloSelf: number, eloOppo: number) => Promise<Prediction>;

export interface Runtime {
  /** The onnxruntime WebAssembly file: its URL (the browser streams it), or its bytes (tests in Node). */
  wasm: string | ArrayBuffer;
}

export class MaiaModel {
  private constructor(private session: ort.InferenceSession) {}

  static async load(model: Uint8Array, runtime: Runtime): Promise<MaiaModel> {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    if (typeof runtime.wasm === "string") ort.env.wasm.wasmPaths = { wasm: runtime.wasm };
    else ort.env.wasm.wasmBinary = runtime.wasm;
    const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    return new MaiaModel(session);
  }

  readonly predict: Predictor = async (fen, eloSelf, eloOppo) => {
    const feeds = {
      tokens: new ort.Tensor("float32", encodeTokens(fen), [1, 64, PLANES * HISTORY]),
      elo_self: new ort.Tensor("float32", Float32Array.of(Math.round(eloSelf)), [1]),
      elo_oppo: new ort.Tensor("float32", Float32Array.of(Math.round(eloOppo)), [1]),
    };
    const out = await this.session.run(feeds);
    const logits = new Float32Array(out.logits_move!.data as Float32Array);
    const v = new Float32Array(out.logits_value!.data as Float32Array);
    // (The value head's order is loss, draw, win.)
    const m = Math.max(v[0]!, v[1]!, v[2]!);
    const e = [v[0]!, v[1]!, v[2]!].map((x) => Math.exp(x - m));
    const s = e[0]! + e[1]! + e[2]!;
    for (const t of Object.values(out)) t.dispose();
    return { logits, wdl: [e[2]! / s, e[1]! / s, e[0]! / s] };
  };

  async release(): Promise<void> {
    await this.session.release();
  }
}
