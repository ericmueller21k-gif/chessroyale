/**
 * Bakes Chess Town's pictures (Nov 28, the town's structure, phase 1a: DESIGN.md §2, docs/decisions/2026-11-28-town-bake.md): the build
 * paints every picture the town draws that is the same for every player, once, and writes them as picture files with a manifest, so a
 * device has only to fetch, upload and draw them (phase 1b; until then the town still paints on the device, and nothing reads these).
 *
 * What it runs is the app's own code: the picture list (packages/app/src/town/pictures.ts) painted by the device's painting code
 * (town/bake.ts, paint-jobs.ts), bundled by esbuild for Node once a town: a player's and an admin's (town/admin-town.ts decides the
 * town as its code loads, so each is a bundle of its own with that one module replaced). A picture is named by what it is, so the two
 * towns share most of theirs: a name with two different pictures stops the bake.
 *
 * Output (`out`, by default the app's public folder, so the build serves it at /town-pictures/; not committed: .gitignore):
 * - pages: PNGs named by their group and their pixels' hash. Pictures are packed by group (a home with its frames, boss and glow; a
 *   street's row; the park; the Colosseum; the props), as the WebGL atlas packs (town/paint.ts ATLAS), a file a page. A group's
 *   pictures only one town draws (an admins-first home; the fronts that fill its lot in a player's town) are files of their own
 *   (`.admin`, `.player`), so no device fetches what it never draws. Pictures with the same pixels are stored once.
 * - the sidekicks' frames (phase 1c): each sheet (packages/app/src/town/sidekicks/<name>.png, made by scripts/bake-sidekicks.ts) cut
 *   into its frames, each a picture of its own with the atlas's clear pixels round it (`sidekick:<name>:<animation>#<frame>`), a
 *   file a sidekick. As a sheet a frame has 0 to 2 clear pixels at its edge, so a smoothed draw would read its neighbor.
 * - manifest.<hash>.json (`TownManifest`, town/manifest.ts): each file, each picture's place, the roofs' and glows' pieces, the
 *   animations' frame times, the boxes' tops. Named by its contents too (phase 1b): the build hands the app its name
 *   (`__TOWN_PICTURES__`), so an app the service worker kept reads its own town, never a newer one's.
 * - order.json: each town's loading screen's pictures in its order, by their index in the manifest's `pictures`, and the manifest's
 *   name (a check's and a tool's way in: the app never reads it).
 *
 * `npm run build` runs it, and the dev server as it starts (packages/app/vite.config.ts). By hand: `npx tsx scripts/bake-town.ts [out]`
 * prints each file's pictures, pixels and bytes, and the totals.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import type * as Bake from "../packages/app/src/town/bake.ts";
import { TOWNS, TOWN_PICTURES_DIR, type TownFile, type TownKind, type TownManifest } from "../packages/app/src/town/manifest.ts";
import { SIDEKICK_SHEETS, type SidekickSheet } from "../packages/app/src/town/sidekick-sheets.ts";
import { png, unpng } from "./png.ts";

export { TOWNS, TOWN_PICTURES_DIR, type TownFile, type TownKind, type TownManifest };

const APP = fileURLToPath(new URL("../packages/app/", import.meta.url));

/** Each town's loading screen's pictures, in its order: indexes into the manifest's `pictures` (its keys, in order); and the manifest's name. */
export type TownOrder = Record<TownKind, number[]> & { manifest: string };

export interface BakeResult {
  manifest: TownManifest;
  /** The manifest's file's name under /town-pictures/, by its contents (`manifest.<hash>.json`): the app's `__TOWN_PICTURES__`. */
  manifestName: string;
  /** Every source file the pictures were painted from (the bake's bundles' inputs, absolute paths): the dev server bakes again when one changes. */
  inputs: string[];
  order: TownOrder;
  /** Each file's distinct pictures and their pixels (the printed table). */
  rows: { file: number; pictures: number; pixels: number }[];
  /** Pictures by name; pictures stored (the same pixels once); a town's own counts and bytes. */
  totals: { names: number; stored: number; pixels: number; bytes: number; files: number; towns: Record<TownKind, { names: number; files: number; pixels: number; bytes: number }> };
  ms: { load: number; paint: number; pack: number; write: number; total: number };
}

/** The app's bake code (town/bake.ts) for one town, bundled for Node and loaded; and the source files it was bundled from. */
async function loadTown(admin: boolean, dir: string): Promise<{ mod: typeof Bake; inputs: string[] }> {
  const out = await build({
    absWorkingDir: APP,
    entryPoints: ["src/town/bake.ts"],
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "silent",
    // (Pictures and styles the town's modules import by name: none is read by the painting code.)
    loader: { ".png": "empty", ".webp": "empty", ".jpg": "empty", ".gif": "empty", ".svg": "empty", ".mp3": "empty", ".css": "empty" },
    plugins: [
      {
        name: "town-of",
        setup(b) {
          b.onLoad({ filter: /[\\/]town[\\/]admin-town\.ts$/ }, () => ({ contents: `export const ADMIN_TOWN = ${admin};`, loader: "ts" }));
        },
      },
    ],
  });
  const file = join(dir, `bake-${admin ? "admin" : "player"}.mjs`);
  writeFileSync(file, out.outputFiles[0]!.contents);
  return { mod: (await import(pathToFileURL(file).href)) as typeof Bake, inputs: Object.keys(out.metafile.inputs).map((p) => join(APP, p)) };
}

const slug = (group: string) => group.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const hashOf = (...parts: (string | Uint8Array | Uint8ClampedArray)[]) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
};

/**
 * Bakes the town into `out` (emptied first). `level`: the PNGs' zlib level (9, the smallest; tests may take a quicker one: the pixels
 * are the same).
 */
export async function bakeTown(out: string = join(APP, "public", TOWN_PICTURES_DIR), level = 9): Promise<BakeResult> {
  const t0 = performance.now();
  const tmp = mkdtempSync(join(tmpdir(), "town-bake-"));
  let towns: Bake.TownBake[];
  let pack: typeof Bake.packPictures;
  let frameName: typeof Bake.sidekickFrame;
  let anims: typeof Bake.SHEET_ANIMS;
  let pad = 0;
  let tLoad = 0;
  let inputs: string[];
  try {
    const loaded = await Promise.all(TOWNS.map((t) => loadTown(t === "admin", tmp)));
    const mods = loaded.map((l) => l.mod);
    inputs = [...new Set(loaded.flatMap((l) => l.inputs))].sort();
    tLoad = performance.now() - t0;
    pack = mods[0]!.packPictures;
    pad = mods[0]!.ATLAS.pad;
    frameName = mods[0]!.sidekickFrame;
    anims = mods[0]!.SHEET_ANIMS;
    towns = mods.map((m) => m.bakeList());
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const tPaint = performance.now() - t0 - tLoad;

  // Every picture by name, across the towns: a name means one picture (its pixels' hash), in the group the first town to draw it gives.
  interface Pic {
    group: string;
    px: { w: number; h: number; data: Uint8ClampedArray };
    hash: string;
    towns: Set<TownKind>;
  }
  const byName = new Map<string, Pic>();
  towns.forEach((tb, ti) => {
    for (const [name, p] of tb.pictures) {
      const hash = hashOf(`${p.px.w}x${p.px.h}:`, p.px.data);
      const had = byName.get(name);
      if (!had) byName.set(name, { group: p.group, px: p.px, hash, towns: new Set([TOWNS[ti]!]) });
      else if (had.hash !== hash) throw new Error(`town bake: "${name}" is one picture in a ${[...had.towns][0]}'s town and another in an ${TOWNS[ti]}'s`);
      else had.towns.add(TOWNS[ti]!);
    }
  });
  // The sidekicks' frames (phase 1c): each sheet this town shows, cut into its frames (rows its animations, a frame a column).
  const cutSheets = new Map<string, Map<string, Pic>>();
  const framesOf = (id: string) => {
    let frames = cutSheets.get(id);
    if (frames) return frames;
    cutSheets.set(id, (frames = new Map()));
    const sheet = (SIDEKICK_SHEETS as Record<string, SidekickSheet>)[id];
    if (!sheet) throw new Error(`town bake: no sidekick sheet named "${id}"`);
    const img = unpng(readFileSync(join(APP, "src/town/sidekicks", `${id}.png`)));
    const cols = Math.max(...anims.map((a) => sheet.ms[a].length));
    if (img.w !== cols * sheet.w || img.h !== anims.length * sheet.h) throw new Error(`town bake: sidekicks/${id}.png isn't its sheet's size (npx tsx scripts/bake-sidekicks.ts)`);
    anims.forEach((a, row) =>
      sheet.ms[a].forEach((_, col) => {
        const data = new Uint8ClampedArray(sheet.w * sheet.h * 4);
        for (let y = 0; y < sheet.h; y++) data.set(img.data.subarray(((row * sheet.h + y) * img.w + col * sheet.w) * 4, ((row * sheet.h + y) * img.w + (col + 1) * sheet.w) * 4), y * sheet.w * 4);
        const px = { w: sheet.w, h: sheet.h, data };
        frames!.set(frameName(id, a, col), { group: `sidekick:${id}`, px, hash: hashOf(`${px.w}x${px.h}:`, px.data), towns: new Set() });
      }),
    );
    return frames;
  };
  const sidekicks: Record<TownKind, number> = { player: 0, admin: 0 };
  TOWNS.forEach((t, ti) => {
    for (const id of towns[ti]!.sheets)
      for (const [name, p] of framesOf(id)) {
        p.towns.add(t);
        byName.set(name, p);
        sidekicks[t]++;
      }
  });
  const merge = <K extends "roofs" | "glows" | "anims" | "tops">(k: K): Bake.TownBake[K] => {
    const all: Record<string, unknown> = {};
    for (const tb of towns)
      for (const [key, v] of Object.entries(tb[k])) {
        if (key in all && JSON.stringify(all[key]) !== JSON.stringify(v)) throw new Error(`town bake: ${k} "${key}" differs between the towns`);
        all[key] = v;
      }
    return all as Bake.TownBake[K];
  };

  // Pictures with the same pixels are stored once (a third of the roofs' sheets and a row's sides are another's): in the first one's
  // group, for every town that draws any of them. Then a file a page: each (group, its towns)'s pictures packed as the atlas packs.
  interface Stored {
    px: Pic["px"];
    group: string;
    towns: Set<TownKind>;
    at: [file: number, x: number, y: number];
  }
  const stored = new Map<string, Stored>();
  for (const p of byName.values()) {
    const s = stored.get(p.hash);
    if (!s) stored.set(p.hash, { px: p.px, group: p.group, towns: new Set(p.towns), at: [0, 0, 0] });
    else for (const t of p.towns) s.towns.add(t);
  }
  const sets = new Map<string, Stored[]>();
  for (const s of stored.values()) {
    const key = `${s.group}|${TOWNS.filter((t) => s.towns.has(t)).join(",")}`;
    sets.set(key, [...(sets.get(key) ?? []), s]);
  }
  const files: TownFile[] = [];
  const rows: BakeResult["rows"] = [];
  const pngs: Buffer[] = [];
  let tWrite = 0;
  for (const key of [...sets.keys()].sort()) {
    const list = sets.get(key)!;
    const [group, ts] = key.split("|") as [string, string];
    const fileTowns = ts.split(",") as TownKind[];
    const { at, pages } = pack(list.map((s) => [s.px.w, s.px.h] as const));
    pages.forEach(([pw, ph], pg) => {
      // (As wide as its pictures reach with the atlas's clear pixels round them, not the atlas's whole page: a small group is a small
      // picture. One bigger than the atlas packs is a page of its own, at its top left.)
      let w = 1;
      list.forEach((s, i) => {
        if (at[i]![0] === pg) w = Math.max(w, at[i]![1] + s.px.w + (at[i]![1] > 0 ? pad : 0));
      });
      w = Math.min(pw, w);
      const data = new Uint8Array(w * ph * 4);
      let n = 0;
      let pixels = 0;
      list.forEach((s, i) => {
        const [p, x, y] = at[i]!;
        if (p !== pg) return;
        for (let j = 0; j < s.px.h; j++) data.set(s.px.data.subarray(j * s.px.w * 4, (j + 1) * s.px.w * 4), ((y + j) * w + x) * 4);
        s.at = [files.length, x, y];
        n++;
        pixels += s.px.w * s.px.h;
      });
      const tw = performance.now();
      const body = png(w, ph, data, level);
      tWrite += performance.now() - tw;
      const only = fileTowns.length < TOWNS.length ? `.${fileTowns.join("-")}` : "";
      rows.push({ file: files.length, pictures: n, pixels });
      files.push({ name: `${slug(group)}${only}.${hashOf(`${w}x${ph}:`, data).slice(0, 12)}.png`, group, towns: fileTowns, w, h: ph, bytes: body.length });
      pngs.push(body);
    });
  }
  const pictures: TownManifest["pictures"] = {};
  for (const [name, p] of byName) {
    const s = stored.get(p.hash)!;
    pictures[name] = [s.at[0], s.at[1], s.at[2], p.px.w, p.px.h];
  }
  const manifest: TownManifest = { v: 2, files, pictures, roofs: merge("roofs"), glows: merge("glows"), anims: merge("anims"), tops: merge("tops") };
  const manifestText = JSON.stringify(manifest);
  const manifestName = `manifest.${hashOf(manifestText).slice(0, 12)}.json`;
  const index = new Map(Object.keys(pictures).map((n, i) => [n, i]));
  const order = { manifest: manifestName, ...Object.fromEntries(TOWNS.map((t, ti) => [t, towns[ti]!.order.map((n) => index.get(n)!)])) } as TownOrder;
  const tPack = performance.now() - t0 - tLoad - tPaint - tWrite;

  const tw = performance.now();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  files.forEach((f, i) => writeFileSync(join(out, f.name), pngs[i]!));
  writeFileSync(join(out, manifestName), manifestText);
  writeFileSync(join(out, "order.json"), JSON.stringify(order));
  tWrite += performance.now() - tw;

  const pixelsOf = (keep: (f: TownFile) => boolean) => rows.reduce((s, r) => s + (keep(files[r.file]!) ? r.pixels : 0), 0);
  const bytesOf = (keep: (f: TownFile) => boolean) => files.reduce((s, f) => s + (keep(f) ? f.bytes : 0), 0);
  const totals: BakeResult["totals"] = {
    names: byName.size,
    stored: stored.size,
    pixels: pixelsOf(() => true),
    bytes: bytesOf(() => true),
    files: files.length,
    towns: Object.fromEntries(
      TOWNS.map((t, ti) => [t, { names: towns[ti]!.pictures.size + sidekicks[t], files: files.filter((f) => f.towns.includes(t)).length, pixels: pixelsOf((f) => f.towns.includes(t)), bytes: bytesOf((f) => f.towns.includes(t)) }]),
    ) as BakeResult["totals"]["towns"],
  };
  return { manifest, manifestName, inputs, order, rows, totals, ms: { load: tLoad, paint: tPaint, pack: tPack, write: tWrite, total: performance.now() - t0 } };
}

/** The bake's report: a line a file (its group, who draws it, its pictures, pixels and bytes), then the totals and the time. */
export function report(r: BakeResult): string {
  const mp = (n: number) => (n / 1e6).toFixed(2).padStart(6);
  const kb = (n: number) => (n / 1024).toFixed(0).padStart(6);
  const lines = ["file                                              towns          pictures  pixels (M)  KB"];
  for (const row of r.rows) {
    const f = r.manifest.files[row.file]!;
    lines.push(`${f.name.padEnd(49)} ${f.towns.join("+").padEnd(13)} ${String(row.pictures).padStart(9)}  ${mp(row.pixels)}  ${kb(f.bytes)}`);
  }
  const t = r.totals;
  lines.push(`all: ${t.files} files, ${t.names} pictures by name (${t.stored} stored: the same pixels once), ${mp(t.pixels).trim()} M pixels, ${(t.bytes / 1e6).toFixed(2)} MB`);
  for (const k of TOWNS) lines.push(`${k === "admin" ? "an admin" : "a player"}'s town: ${t.towns[k].files} files, ${t.towns[k].names} pictures, ${mp(t.towns[k].pixels).trim()} M pixels, ${(t.towns[k].bytes / 1e6).toFixed(2)} MB`);
  lines.push(`${r.manifestName} ${(JSON.stringify(r.manifest).length / 1024).toFixed(0)} KB; baked in ${(r.ms.total / 1000).toFixed(1)} s (bundling ${(r.ms.load / 1000).toFixed(1)}, painting ${(r.ms.paint / 1000).toFixed(1)}, packing ${(r.ms.pack / 1000).toFixed(1)}, PNGs and writing ${(r.ms.write / 1000).toFixed(1)})`);
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("bake-town.ts")) console.log(report(await bakeTown(process.argv[2])));
