// Maia box (AGPL-3.0, see LICENSE): builds the standalone worker into dist/, ready to serve as it is:
//   maia-worker.js               the worker (its own code, onnxruntime-web and chess.js, in one module)
//   ort-wasm-simd-threaded.wasm  onnxruntime's WebAssembly (run on one thread)
//   <model>.onnx                 the converted model (model/, made by scripts/convert.py)
//   LICENSE.txt                  the GNU AGPL 3.0 (this box and Maia-3)
//   NOTICE.txt                   what this is, where its source is, and the bundled libraries' licenses
// Usage: node scripts/build.mjs [outDir]
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const BOX = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] ?? join(BOX, "dist");
const MODEL = "maia3-23m-int8.onnx";
const MODEL_NAME = "Maia-3 23M (int8)";
const require = createRequire(join(BOX, "package.json"));
// (onnxruntime-web exports no package.json: its CommonJS entry is dist/<file>.)
const ortDir = dirname(dirname(require.resolve("onnxruntime-web")));
const chessDir = dirname(require.resolve("chess.js/package.json"));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
await build({
  entryPoints: [join(BOX, "src/worker.ts")],
  outfile: join(OUT, "maia-worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  legalComments: "none",
  define: { MAIA_MODEL_FILE: JSON.stringify(MODEL), MAIA_MODEL_NAME: JSON.stringify(MODEL_NAME) },
  banner: { js: "// The HunChess Maia box: Maia-3 (CSSLab, University of Toronto) in a Web Worker. GNU AGPL 3.0: see LICENSE.txt and NOTICE.txt." },
  logLevel: "warning",
});
copyFileSync(join(ortDir, "dist/ort-wasm-simd-threaded.wasm"), join(OUT, "ort-wasm-simd-threaded.wasm"));
copyFileSync(join(BOX, "model", MODEL), join(OUT, MODEL));
copyFileSync(join(BOX, "LICENSE"), join(OUT, "LICENSE.txt"));
const ortVersion = JSON.parse(readFileSync(join(ortDir, "package.json"), "utf8")).version;
const chessVersion = JSON.parse(readFileSync(join(chessDir, "package.json"), "utf8")).version;
writeFileSync(
  join(OUT, "NOTICE.txt"),
  [
    "The HunChess Maia box",
    "",
    "These files are a separate program: Maia-3, the human-like chess model by the Computational Social Science Lab",
    "(CSSLab) at the University of Toronto (https://github.com/CSSLab/maia3), converted to ONNX and int8, in a Web",
    "Worker that speaks a UCI-style text protocol. It is licensed under the GNU Affero General Public License 3.0",
    "(LICENSE.txt), as Maia-3 is. The game talks to it only by plain-text messages.",
    "",
    `Model: ${MODEL} (${MODEL_NAME}), converted from the official checkpoint UofTCSSLab/Maia3-23M.`,
    "Its source (the worker, the conversion scripts and how the model was made) is available on request.",
    "",
    `Bundled: onnxruntime-web ${ortVersion} (MIT license, (c) Microsoft Corporation), chess.js ${chessVersion}`,
    "(BSD 2-Clause license, (c) Jeff Hlywa). Their license texts follow.",
    "",
    "---- onnxruntime-web ----",
    // (Its npm package ships no license file: the MIT text from its repository.)
    readFileSync(join(BOX, "licenses/onnxruntime-MIT.txt"), "utf8").trim(),
    "",
    "---- chess.js ----",
    readFileSync(join(chessDir, "LICENSE"), "utf8").trim(),
    "",
  ].join("\n"),
);
console.log(`maia box built into ${OUT}`);
