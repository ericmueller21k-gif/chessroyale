import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";

const require = createRequire(import.meta.url);
/** This config's own folder (packages/app): its files resolve from here, whichever folder Vite was started from. */
const APP = fileURLToPath(new URL(".", import.meta.url));

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
      const source = join(APP, `stockfish-source/stockfish.js-${version}-source.tar.gz`);
      if (!existsSync(source)) throw new Error(`Stockfish ${version} has no source archive (${source}): make it first, see stockfish-source/README.md.`);
      mkdirSync(join(APP, "public/engine"), { recursive: true });
      for (const f of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
        copyFileSync(join(bin, f), join(APP, "public/engine", f));
      }
      copyFileSync(join(pkg, "Copying.txt"), join(APP, "public/engine/COPYING.txt"));
      copyFileSync(source, join(APP, "public/engine/stockfish-source.tar.gz"));
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
      const dist = join(APP, "../maia-worker/dist");
      const maia = join(APP, "public/engine/maia");
      rmSync(maia, { recursive: true, force: true });
      if (!existsSync(join(dist, "maia-worker.js"))) {
        this.warn("The Maia box isn't built (npm run build -w maia-worker): bosses play Stockfish only.");
        return;
      }
      mkdirSync(maia, { recursive: true });
      for (const f of readdirSync(dist)) copyFileSync(join(dist, f), join(maia, f));
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
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((f) => "/" + relative(outDir, f).split("\\").join("/"))
        // (Not the live window's bot replays: only a computer's home fetches them, so phones never download them. Nor
        // the Maia box: about 40 MB, fetched only for a battle that uses it, then kept in its own cache: MAIA below.
        // Nor the engines' source archives: for whoever downloads them, never for the game. Nor the Colosseum's hour of
        // ambience, about 18 MB, streamed by an <audio> element only while it plays: see STREAMED in sw-template.js. (The rides'
        // baked sheets were left out here until Nov 1; the town now draws its riders from the rides' own drawings: town/rides.ts.)
        .filter((f) => f !== "/sw.js" && f !== "/version.json" && !f.endsWith(".webmanifest") && !f.endsWith(".txt") && !f.endsWith(".tar.gz") && !f.startsWith("/replays/") && !f.startsWith("/engine/maia/") && f !== "/sounds/colosseum/ambient.mp3")
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
      const sw = readFileSync(join(APP, "sw-template.js"), "utf8")
        .replace("__VERSION__", `brc-${hash.digest("hex").slice(0, 12)}`)
        .replace("__MAIA__", `brc-maia-${maia.digest("hex").slice(0, 12)}`)
        .replace("__FILES__", JSON.stringify(files));
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}

/**
 * This build's commit (Workers Builds gives it as WORKERS_CI_COMMIT_SHA; a local build asks git): the app reports its
 * first 12 characters with every error (src/problems.ts), and dist/version.json tells the Worker and the ops tools
 * which commit is deployed. "dev" when neither knows.
 */
const COMMIT = (() => {
  let sha = process.env.WORKERS_CI_COMMIT_SHA ?? "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      // No git here.
    }
  }
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
})();
const VERSION = COMMIT?.slice(0, 12) ?? "dev";

/** Writes dist/version.json: the version, the commit and when it was built (not precached: see serviceWorker). */
function versionFile(): Plugin {
  let outDir = "dist";
  return {
    name: "brc-version",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      writeFileSync(join(outDir, "version.json"), JSON.stringify({ version: VERSION, commit: COMMIT, built: new Date().toISOString() }) + "\n");
    },
  };
}

/**
 * The Maia box's files' sizes (unpacked), for its loading bar (src/maia.ts): live, the worker and the WebAssembly come
 * compressed, with no length the bar could use. Empty when the box isn't built.
 */
function maiaFileBytes(): Record<string, number> {
  const dist = join(APP, "../maia-worker/dist");
  if (!existsSync(dist)) return {};
  return Object.fromEntries(readdirSync(dist).filter((f) => /\.(js|wasm|onnx)$/.test(f)).map((f) => [f, statSync(join(dist, f)).size]));
}

export default defineConfig({
  define: { __MAIA_FILE_BYTES__: JSON.stringify(maiaFileBytes()), __APP_VERSION__: JSON.stringify(VERSION) },
  plugins: [stockfish(), maiaBox(), preact(), serviceWorker(), versionFile()],
  server: { host: true },
  build: { target: "es2020", chunkSizeWarningLimit: 1000 },
});
