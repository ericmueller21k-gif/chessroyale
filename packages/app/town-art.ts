/**
 * Chess Town's art, as a fingerprint the build takes (Nov 28; vite.config.ts hands it to the app as `__TOWN_ART__`).
 *
 * The town's pictures kept between visits (src/town/keep-pictures.ts) are keyed by it, not by the build's commit: that key threw the
 * saved town away on every deploy, so the next visit painted everything again (10.1 s instead of 4.4 on the slowed phone), whatever
 * the deploy changed. This is what the pictures come from, and only that: the code that lists and paints them (`ROOTS`), bundled by
 * esbuild with everything it imports and uses, and hashed. Bundled, so:
 * - nobody keeps a list: a new house, character or helper the painting code imports is in it;
 * - what the painting code doesn't use is shaken out (the other settings of settings.ts, the rest of the rules), comments and types
 *   too, so a deploy that changes those keeps the saved town;
 * - the commit id can't be in it (nothing here is given it), nor the machine's folders (paths are from this folder).
 * When in doubt esbuild keeps code, never drops it: the fingerprint may change when no picture did (one more repaint), never the
 * other way round. docs/decisions/2026-11-28-town-art-key.md.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

/** This folder (packages/app). */
const APP = fileURLToPath(new URL(".", import.meta.url));

/**
 * Where the kept pictures come from: the renderer (the list of them, their order and every picture it paints itself), the paint
 * worker (the same painting, on other cores), and the code that packs, keeps and reads them back, with its worker.
 */
export const ROOTS = ["src/town/render.ts", "src/town/paint.worker.ts", "src/town/keep-pictures.ts", "src/town/keep-pictures.worker.ts"] as const;

/**
 * The fingerprint of the town's art (12 hex characters). `edit` (tests): each source file's text as the bundler reads it (`path` from
 * the repo's packages folder on, forward slashes), changed or not.
 */
export async function townArt(edit?: (path: string, text: string) => string): Promise<string> {
  const app = APP;
  const edits: Plugin = {
    name: "town-art-edit",
    setup(b) {
      b.onLoad({ filter: /\.tsx?$/ }, async (a) => {
        const at = a.path.split("\\").join("/");
        return { contents: edit!(at.slice(at.lastIndexOf("/packages/") + 1), await readFile(a.path, "utf8")), loader: a.path.endsWith("x") ? "tsx" : "ts" };
      });
    },
  };
  const out = await build({
    absWorkingDir: app,
    entryPoints: [...ROOTS],
    bundle: true,
    write: false,
    outdir: "town-art",
    format: "esm",
    target: "es2020",
    treeShaking: true,
    legalComments: "none",
    logLevel: "silent",
    plugins: edit ? [edits] : [],
    // (A picture or a sound the code imports: by its contents, which name its file.)
    loader: { ".png": "file", ".webp": "file", ".jpg": "file", ".gif": "file", ".svg": "file", ".mp3": "file", ".css": "empty" },
  });
  const hash = createHash("sha256");
  for (const f of [...out.outputFiles].sort((a, b) => (a.path < b.path ? -1 : 1))) hash.update(f.path.slice(app.length)).update(f.contents);
  return hash.digest("hex").slice(0, 12);
}
