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

/**
 * The most WebAssembly memory onnxruntime may have, in 64 KiB pages: 512 MiB. Its build is the threaded one (run here on
 * one thread), whose memory is shared and asks for a 4 GiB maximum; a shared memory reserves its maximum up front, and
 * iOS Safari can refuse that much ("RangeError: Out of memory", reported as "no available backend found"). This model
 * needs about 70 MB of it (measured: 69 MB after loading and 20 moves, the same before and after), so 512 MiB leaves
 * seven times that.
 */
export const MEMORY_MAX_PAGES = 8192;

/** Runs `create` with every shared WebAssembly memory made in it capped at MEMORY_MAX_PAGES (then puts things back). */
export async function withCappedMemory<T>(create: () => Promise<T>): Promise<T> {
  const Memory = WebAssembly.Memory;
  const Capped = function (d: WebAssembly.MemoryDescriptor & { shared?: boolean }) {
    return new Memory(d.shared && (d.maximum ?? Infinity) > MEMORY_MAX_PAGES ? { ...d, maximum: Math.max(d.initial, MEMORY_MAX_PAGES) } : d);
  } as unknown as typeof WebAssembly.Memory;
  Capped.prototype = Memory.prototype;
  (WebAssembly as { Memory: typeof WebAssembly.Memory }).Memory = Capped;
  try {
    return await create();
  } finally {
    (WebAssembly as { Memory: typeof WebAssembly.Memory }).Memory = Memory;
  }
}

export class MaiaModel {
  private constructor(private session: ort.InferenceSession) {}

  static async load(model: Uint8Array, runtime: Runtime): Promise<MaiaModel> {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    if (typeof runtime.wasm === "string") ort.env.wasm.wasmPaths = { wasm: runtime.wasm };
    else ort.env.wasm.wasmBinary = runtime.wasm;
    const session = await withCappedMemory(() => ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" }));
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
