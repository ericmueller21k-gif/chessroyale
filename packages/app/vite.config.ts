import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { APP_CACHE } from "../core/src/settings.ts";
import { townArt } from "./town-art.ts";
import { TOWN_PICTURES_DIR, bakeTown, report, type BakeResult } from "../../scripts/bake-town.ts";
import { BAKED_NAME } from "./src/town/manifest.ts";

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

/**
 * Chess Town's baked pictures (scripts/bake-town.ts; Nov 28, the town's structure, phase 1): the build paints every picture the town
 * draws that is the same for every player and writes them, with their manifest, into public/town-pictures/ (not committed), so they're
 * served at /town-pictures/. It prints what each group cost (pictures, pixels, bytes) and the totals. The app is handed the manifest's
 * name (`__TOWN_PICTURES__`, named by its contents: the config below), fetches it and its files on the town's loading screen
 * (src/town/baked.ts) and uploads them; the service worker keeps them (`serviceWorker` below).
 *
 * The dev server bakes too (phase 1b), the first time anything under /town-pictures/ is asked for (the town opening: about 10 s,
 * once; never for the many scripts that start a dev server and don't open the town), and again after a source file the pictures are
 * painted from changes. There the app is handed `order.json`, which names the manifest of the latest bake. This plugin answers the
 * files itself, fresh each time. docs/decisions/2026-11-28-town-load-baked.md.
 */
function townPictures(): Plugin {
  const dir = join(APP, "public", TOWN_PICTURES_DIR);
  let baked: Promise<BakeResult> | null = null;
  let inputs: string[] = [];
  return {
    name: "bake-town",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.startsWith(`/${TOWN_PICTURES_DIR}/`) ? req.url.slice(TOWN_PICTURES_DIR.length + 2).split("?")[0]! : null;
        if (name === null || !(name === "order.json" || BAKED_NAME.test(name))) return next();
        baked ??= bakeTown(dir).then((r) => {
          inputs = r.inputs;
          server.config.logger.info(report(r));
          return r;
        });
        baked.then(
          () => {
            if (!existsSync(join(dir, name))) return next();
            res.setHeader("Content-Type", name.endsWith(".json") ? "application/json" : "image/png");
            res.setHeader("Cache-Control", "no-store");
            res.end(readFileSync(join(dir, name)));
          },
          (e) => {
            baked = null;
            next(e);
          },
        );
      });
    },
    handleHotUpdate({ file }) {
      // (A source of the pictures changed: baked again the next time the town asks.)
      if (inputs.includes(resolve(file))) baked = null;
    },
  };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** Pictures: not precached, kept by the service worker when first shown (its LAZY, the same test). */
const LAZY_FILES = /\.(png|jpe?g|webp|gif|avif)$/;

/** Writes dist/sw.js with every built file (engine included) precached but pictures, versioned by their contents. */
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
        // Nor pictures and video (Nov 10, phone load): the service worker keeps a picture the first time it's shown (LAZY in
        // sw-template.js), and the landing page's demo video (one format, MP4) streams like the ambience.
        .filter((f) => !LAZY_FILES.test(f) && !f.startsWith("/media/"))
        // Nor the bosses' music (Nov 11, 1 to 2 MB a piece): fetched after the town's first frame or when its battle needs it
        // (music.ts), then kept in a cache of its own, piece by piece (MUSIC_HASHES below, MUSIC in sw-template.js).
        .filter((f) => !f.startsWith("/music/"))
        // Nor the baked town (Nov 28): its files are fetched by the town's loading screen or by home when idle (town/baked-files.ts),
        // then kept by the worker and copied to each later version that still has them (TOWN_FILES below).
        .filter((f) => !f.startsWith(`/${TOWN_PICTURES_DIR}/`))
        // Hosts redirect /index.html to /, and a cached redirect can't answer a page load.
        .map((f) => (f === "/index.html" ? "/" : f))
        .sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f === "/" ? "index.html" : f)));
      // The music: each piece's contents' hash (Nov 14). The worker keeps it in a cache every version shares and answers a piece from
      // it only while its hash is this one: a deploy that changes a song fetches that song again, and only it; any other deploy keeps
      // all of it (one that dropped it, as the version's cache, made the next visit fetch all 44 MB again).
      const musicDir = join(outDir, "music");
      const musicHashes = existsSync(musicDir)
        ? Object.fromEntries(readdirSync(musicDir).sort().map((f) => [`/music/${f}`, createHash("sha256").update(readFileSync(join(musicDir, f))).digest("hex").slice(0, 12)]))
        : {};
      // The baked town's files this version has (Nov 28, phase 1b): each named by its contents, so the worker answers one from any
      // version's cache and, as a new version installs, copies over those an older one keeps: a deploy fetches only the groups it changed.
      const townDir = join(outDir, TOWN_PICTURES_DIR);
      const townFiles = existsSync(townDir) ? readdirSync(townDir).filter((f) => BAKED_NAME.test(f)).sort().map((f) => `/${TOWN_PICTURES_DIR}/${f}`) : [];
      // The Maia box's cache is named by its own files, so an app update keeps it and a new model replaces it. (Not its
      // source archive: the game never fetches it, so a change to the box's README or tests leaves players' copies be.)
      const maiaDir = join(outDir, "engine/maia");
      const maia = createHash("sha256");
      if (existsSync(maiaDir)) for (const f of readdirSync(maiaDir).filter((f) => !f.endsWith(".tar.gz")).sort()) maia.update(f).update(readFileSync(join(maiaDir, f)));
      // Each file's contents' hash, but under /assets/ (Vite puts it in the name there): a later version's worker copies a file it
      // already keeps with the same hash instead of downloading it again (sw-template.js, precache).
      const hashes = Object.fromEntries(
        files.filter((f) => !f.startsWith("/assets/")).map((f) => [f, createHash("sha256").update(readFileSync(join(outDir, f === "/" ? "index.html" : f))).digest("hex").slice(0, 12)]),
      );
      const sw = readFileSync(join(APP, "sw-template.js"), "utf8")
        .replace("__VERSION__", `brc-${hash.digest("hex").slice(0, 12)}`)
        .replace("__HASHES__", JSON.stringify(hashes))
        .replace("__MUSIC_HASHES__", JSON.stringify(musicHashes))
        .replace("__TOWN_FILES__", JSON.stringify(townFiles))
        .replace("__KEEP_VERSIONS__", String(APP_CACHE.keepVersions))
        .replace("__MAIA__", `brc-maia-${maia.digest("hex").slice(0, 12)}`)
        .replace("__FILES__", JSON.stringify(files));
      writeFileSync(join(outDir, "sw.js"), sw);
    },
  };
}

/**
 * This build's commit (Workers Builds gives it as WORKERS_CI_COMMIT_SHA, GitHub Actions as GITHUB_SHA; a local build asks git): the app reports its
 * first 12 characters with every error (src/problems.ts), and dist/version.json tells the Worker and the ops tools
 * which commit is deployed. "dev" when neither knows.
 */
const COMMIT = (() => {
  // (GitHub Actions' GITHUB_SHA too: CI's e2e build runs in a container where git may refuse the checkout ("dubious ownership"), and
  // a build that called itself "dev" never sees a deploy land: town.spec's "a deploy landed" checks, #942.)
  let sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || "";
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

// (`__TOWN_ART__`, Nov 28: the town's art's fingerprint, which keys the town's pictures kept between visits, so a deploy that doesn't
// change the art keeps them: town-art.ts. The dev server keeps no pictures, so it takes none.)
// (`__TOWN_PICTURES__`, Nov 28, phase 1b: the baked town's manifest's name, by its contents. A build bakes here, before the app is
// built, so the app is handed the name. The dev server is handed `order.json`, which names the latest bake's: `townPictures` above.)
export default defineConfig(async ({ command }) => {
  const baked = command === "build" ? await bakeTown(join(APP, "public", TOWN_PICTURES_DIR)) : null;
  if (baked) console.log(report(baked));
  return {
    define: {
      __MAIA_FILE_BYTES__: JSON.stringify(maiaFileBytes()),
      __APP_VERSION__: JSON.stringify(VERSION),
      __TOWN_ART__: JSON.stringify(command === "build" ? await townArt() : "dev"),
      __TOWN_PICTURES__: JSON.stringify(baked?.manifestName ?? "order.json"),
    },
    plugins: [stockfish(), maiaBox(), townPictures(), preact(), serviceWorker(), versionFile()],
    server: { host: true },
    build: { target: "es2020", chunkSizeWarningLimit: 1000 },
  };
});
