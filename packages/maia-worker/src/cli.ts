// Maia box (AGPL-3.0, see LICENSE): the same engine as a command-line program for Node (simulations, tests): UCI
// text on stdin and stdout, like the official maia3-uci. Run: npx tsx packages/maia-worker/src/cli.ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { MaiaModel } from "./model.ts";
import { MaiaUci } from "./uci.ts";

const box = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(box, "package.json"));
const modelFile = process.env.MAIA_MODEL ?? join(box, "model/maia3-23m-int8.onnx");
let model: MaiaModel | null = null;

const uci = new MaiaUci(
  {
    send: (line) => process.stdout.write(line + "\n"),
    load: async () => {
      const wasm = readFileSync(join(dirname(require.resolve("onnxruntime-web")), "ort-wasm-simd-threaded.wasm"));
      model = await MaiaModel.load(readFileSync(modelFile), { wasm: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
      return model.predict;
    },
    release: async () => {
      await model?.release();
      model = null;
    },
    close: () => process.exit(0),
  },
  "Maia-3 23M (int8)",
);

createInterface({ input: process.stdin }).on("line", (line) => void uci.handle(line));
