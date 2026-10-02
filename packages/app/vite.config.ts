import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
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

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Writes dist/sw.js with every built file (engine included) precached, versioned by their contents. */
function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "brc-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((f) => "/" + relative(outDir, f).split("\\").join("/"))
        .filter((f) => f !== "/sw.js" && !f.endsWith(".webmanifest") && !f.endsWith(".txt"))
        // Hosts redirect /index.html to /, and a cached redirect can't answer a page load.
        .map((f) => (f === "/index.html" ? "/" : f))
        .sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f === "/" ? "index.html" : f)));
      const sw = readFileSync("sw-template.js", "utf8")
        .replace("__VERSION__", `brc-${hash.digest("hex").slice(0, 12)}`)
        .replace("__FILES__", JSON.stringify(files));
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}

export default defineConfig({
  plugins: [stockfish(), preact(), serviceWorker()],
  server: { host: true },
  build: { target: "es2020", chunkSizeWarningLimit: 1000 },
});
