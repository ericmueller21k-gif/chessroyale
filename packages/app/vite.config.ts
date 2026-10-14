import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";

const require = createRequire(import.meta.url);

/**
 * Copies the Stockfish WebAssembly build (the same file the simulation uses) into public/engine/, with its license and
 * its complete source (GPL-3.0: stockfish-source/, served as /engine/stockfish-source.tar.gz). A package version with
 * no source archive there stops the build: make one first (stockfish-source/README.md).
 */
function stockfish(): Plugin {
  return {
    name: "copy-stockfish",
    buildStart() {
      const pkg = dirname(require.resolve("stockfish/package.json"));
      const bin = join(pkg, "bin");
      const { version } = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")) as { version: string };
      const source = `stockfish-source/stockfish.js-${version}-source.tar.gz`;
      if (!existsSync(source)) throw new Error(`Stockfish ${version} has no source archive (${source}): make it first, see stockfish-source/README.md.`);
      mkdirSync("public/engine", { recursive: true });
      for (const f of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
        copyFileSync(join(bin, f), join("public/engine", f));
      }
      copyFileSync(join(pkg, "Copying.txt"), "public/engine/COPYING.txt");
      copyFileSync(source, "public/engine/stockfish-source.tar.gz");
    },
  };
}

/**
 * Copies the Maia box (packages/maia-worker, built by its own `npm run build`: a separate program under the AGPL, see
 * its README) into public/engine/maia/, as it is: the worker, onnxruntime's WebAssembly, the model and the license.
 * The game never imports any of it; it starts the worker and exchanges text with it (src/maia.ts).
 */
function maiaBox(): Plugin {
  return {
    name: "copy-maia-box",
    buildStart() {
      const dist = join(dirname(fileURLToPath(import.meta.url)), "../maia-worker/dist");
      rmSync("public/engine/maia", { recursive: true, force: true });
      if (!existsSync(join(dist, "maia-worker.js"))) {
        this.warn("The Maia box isn't built (npm run build -w maia-worker): bosses play Stockfish only.");
        return;
      }
      mkdirSync("public/engine/maia", { recursive: true });
      for (const f of readdirSync(dist)) copyFileSync(join(dist, f), join("public/engine/maia", f));
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
        // (Not the live window's bot replays: only a computer's home fetches them, so phones never download them. Nor
        // the Maia box: about 40 MB, fetched only for a battle that uses it, then kept in its own cache: MAIA below.
        // Nor the engines' source archives: for whoever downloads them, never for the game.)
        .filter((f) => f !== "/sw.js" && !f.endsWith(".webmanifest") && !f.endsWith(".txt") && !f.endsWith(".tar.gz") && !f.startsWith("/replays/") && !f.startsWith("/engine/maia/"))
        // Hosts redirect /index.html to /, and a cached redirect can't answer a page load.
        .map((f) => (f === "/index.html" ? "/" : f))
        .sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f === "/" ? "index.html" : f)));
      // The Maia box's cache is named by its own files, so an app update keeps it and a new model replaces it. (Not its
      // source archive: the game never fetches it, so a change to the box's README or tests leaves players' copies be.)
      const maiaDir = join(outDir, "engine/maia");
      const maia = createHash("sha256");
      if (existsSync(maiaDir)) for (const f of readdirSync(maiaDir).filter((f) => !f.endsWith(".tar.gz")).sort()) maia.update(f).update(readFileSync(join(maiaDir, f)));
      const sw = readFileSync("sw-template.js", "utf8")
        .replace("__VERSION__", `brc-${hash.digest("hex").slice(0, 12)}`)
        .replace("__MAIA__", `brc-maia-${maia.digest("hex").slice(0, 12)}`)
        .replace("__FILES__", JSON.stringify(files));
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}

/**
 * The Maia box's files' sizes (unpacked), for its loading bar (src/maia.ts): live, the worker and the WebAssembly come
 * compressed, with no length the bar could use. Empty when the box isn't built.
 */
function maiaFileBytes(): Record<string, number> {
  const dist = join(dirname(fileURLToPath(import.meta.url)), "../maia-worker/dist");
  if (!existsSync(dist)) return {};
  return Object.fromEntries(readdirSync(dist).filter((f) => /\.(js|wasm|onnx)$/.test(f)).map((f) => [f, statSync(join(dist, f)).size]));
}

export default defineConfig({
  define: { __MAIA_FILE_BYTES__: JSON.stringify(maiaFileBytes()) },
  plugins: [stockfish(), maiaBox(), preact(), serviceWorker()],
  server: { host: true },
  build: { target: "es2020", chunkSizeWarningLimit: 1000 },
});
