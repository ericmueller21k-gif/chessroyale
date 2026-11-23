// Maia box (AGPL-3.0, see LICENSE): the Web Worker. Text in (one UCI command per message), text out (one line per
// message). Its files sit beside it: the onnxruntime WebAssembly file and the model, fetched on the first isready.
import { MaiaModel } from "./model.ts";
import { MaiaUci } from "./uci.ts";

declare const self: DedicatedWorkerGlobalScope;

/** Built in by scripts/build.mjs: the model's file name and its display name. */
declare const MAIA_MODEL_FILE: string;
declare const MAIA_MODEL_NAME: string;

const here = (file: string) => new URL(file, self.location.href).href;
let model: MaiaModel | null = null;

const uci = new MaiaUci(
  {
    send: (line) => self.postMessage(line),
    load: async () => {
      const t0 = performance.now();
      const res = await fetch(here(MAIA_MODEL_FILE));
      if (!res.ok) throw new Error(`model: HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      model = await MaiaModel.load(bytes, { wasm: here("ort-wasm-simd-threaded.wasm") });
      self.postMessage(`info string loaded ${MAIA_MODEL_NAME} (${(bytes.length / 2 ** 20).toFixed(1)} MiB) in ${Math.round(performance.now() - t0)} ms`);
      return model.predict;
    },
    release: async () => {
      await model?.release();
      model = null;
    },
    close: () => self.close(),
  },
  MAIA_MODEL_NAME,
);

self.onmessage = (e: MessageEvent) => {
  if (typeof e.data !== "string") return;
  for (const line of e.data.split("\n")) void uci.handle(line);
};
