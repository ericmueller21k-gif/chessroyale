import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";

const require = createRequire(import.meta.url);

/** Copies the Stockfish WebAssembly build (the same file the simulation uses) into public/engine/. */
function stockfish(): Plugin {
  return {
    name: "copy-stockfish",
    buildStart() {
      const bin = join(dirname(require.resolve("stockfish/package.json")), "bin");
      mkdirSync("public/engine", { recursive: true });
      for (const f of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
        copyFileSync(join(bin, f), join("public/engine", f));
      }
      copyFileSync(join(dirname(require.resolve("stockfish/package.json")), "Copying.txt"), "public/engine/COPYING.txt");
    },
  };
}

export default defineConfig({
  plugins: [stockfish(), preact()],
  server: { host: true },
  build: { target: "es2020", chunkSizeWarningLimit: 1000 },
});
