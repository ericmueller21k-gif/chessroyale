// Maia box (AGPL-3.0, see LICENSE): the box's complete source as one .tar.gz, written by the build (build.mjs) next to
// the built worker, so the site serves it beside what it runs (/engine/maia/maia-box-source.tar.gz).
//
// What goes in, under maia-box/: every file of the box (the worker's code, the build and conversion scripts, the
// package manifest, the license texts, the README, the tests and their fixtures) except what the build makes (dist/),
// what npm installs (node_modules/), dot files, Python's caches and the converted model (model/*.onnx: about 25 MB,
// served beside the archive as it is; model/README.txt says where it is and how it's made). Three files are written
// for the archive:
//   package-lock.json   the exact versions the build used (from the workspace's lockfile: the box's own packages only)
//   model/README.txt    where the model comes from, its size and sha256
//   SHA256SUMS.txt      the sha256 of every other file the build wrote, to check a rebuild against what the site serves
// The archive is the same bytes for the same files (sorted, fixed times and owners), so a new build of unchanged
// sources doesn't change it.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** The archive's file name, served at /engine/maia/<ARCHIVE>. */
export const ARCHIVE = "maia-box-source.tar.gz";
/** Its one top folder. */
export const TOP = "maia-box";
/** Every entry's time: fixed, so the bytes depend only on the files (Oct 14, 2026, the day the source was published). */
const MTIME = Date.UTC(2026, 9, 14) / 1000;
/** npm's lockfile flags, worked out again for the box alone. */
const FLAGS = ["dev", "optional", "devOptional", "peer", "extraneous"];
/** Written for the archive (a file of the same name in the box is left out). */
const GENERATED = ["package-lock.json", "SHA256SUMS.txt", "model/README.txt"];

/** Left out: what the build or npm make, the converted model, editors' and Python's leftovers. */
function skipped(path) {
  const name = path.split("/").at(-1);
  if (path === "dist" || path === "node_modules" || GENERATED.includes(path)) return true;
  if (path.startsWith("model/") && name.endsWith(".onnx")) return true;
  return name.startsWith(".") || name === "__pycache__" || name.endsWith(".pyc");
}

/** The box's own files, as paths relative to it ("src/uci.ts"), sorted. */
export function boxFiles(box) {
  const walk = (rel) =>
    readdirSync(rel ? join(box, rel) : box)
      .map((name) => (rel ? `${rel}/${name}` : name))
      .filter((path) => !skipped(path))
      .flatMap((path) => (statSync(join(box, path)).isDirectory() ? walk(path) : [path]));
  return walk("").sort();
}

/**
 * The box's own lockfile, cut from the workspace's (npm's lockfile version 3): the box's entry as the root and every
 * package it needs (its dependencies and devDependencies, theirs, and so on), at the places npm resolved them, with
 * npm's dev and optional flags worked out for the box alone. `npm ci` in the box then installs exactly what the build
 * used. Throws if a package is missing or two versions would need the same place.
 */
export function boxLock(workspaceLock, key = "packages/maia-worker") {
  const all = workspaceLock.packages;
  const me = all[key];
  if (!me) throw new Error(`${key} isn't in the lockfile`);
  // Where Node finds `name` from the package at `from`: its own node_modules, then each parent's, then the root's.
  const up = (base) => {
    const i = base.lastIndexOf("/node_modules/");
    return i >= 0 ? base.slice(0, i) : "";
  };
  const find = (from, name) => {
    for (let base = from; ; base = up(base)) {
      const k = `${base ? `${base}/` : ""}node_modules/${name}`;
      if (all[k]) {
        if (all[k].link) throw new Error(`${name} is a workspace link, not a package`);
        return k;
      }
      if (!base) return null;
    }
  };
  // A package's edges: [name, optional]. (Optional peers aren't installed for the edge, so they don't count.)
  const edges = (k, withDev = false) => [
    ...Object.keys(all[k].dependencies ?? {}).map((n) => [n, false]),
    ...Object.keys(all[k].optionalDependencies ?? {}).map((n) => [n, true]),
    ...Object.entries(all[k].peerDependencies ?? {}).filter(([n]) => !all[k].peerDependenciesMeta?.[n]?.optional).map(([n]) => [n, false]),
    ...(withDev ? Object.keys(all[k].devDependencies ?? {}).map((n) => [n, false]) : []),
  ];
  const reach = (start, withOptional) => {
    const seen = new Set();
    const queue = [];
    const visit = (from, [name, optional]) => {
      if (optional && !withOptional) return;
      const k = find(from, name);
      if (!k) {
        if (optional) return;
        throw new Error(`${name} (needed by ${from}) isn't in the lockfile`);
      }
      if (!seen.has(k)) seen.add(k), queue.push(k);
    };
    for (const e of start) visit(key, e);
    while (queue.length) {
      const k = queue.shift();
      for (const e of edges(k)) visit(k, e);
    }
    return seen;
  };
  const prodEdges = edges(key);
  const everyEdge = edges(key, true);
  const everything = reach(everyEdge, true);
  const prodAny = reach(prodEdges, true);
  const required = reach(everyEdge, false);
  const prod = reach(prodEdges, false);
  const packages = {
    "": {
      name: "maia-worker",
      version: me.version,
      license: me.license,
      ...(me.dependencies ? { dependencies: me.dependencies } : {}),
      ...(me.optionalDependencies ? { optionalDependencies: me.optionalDependencies } : {}),
      ...(me.devDependencies ? { devDependencies: me.devDependencies } : {}),
    },
  };
  for (const k of [...everything].sort()) {
    const place = k.startsWith(`${key}/`) ? k.slice(key.length + 1) : k;
    if (packages[place]) throw new Error(`two versions of a package would need ${place}`);
    // npm's flags: dev (only the devDependencies need it), optional (only optional edges lead to it), both, or
    // devOptional (neither alone, but not needed by the production install either).
    const dev = !prodAny.has(k);
    const optional = !required.has(k);
    const flags = prod.has(k) ? {} : dev && optional ? { dev: true, optional: true } : dev ? { dev: true } : optional ? { optional: true } : { devOptional: true };
    // (In npm's own key order, so that npm leaves the file as it is: version, resolved and integrity, the other plain
    // values and lists by name, then the objects.)
    const entry = Object.entries(all[k]).filter(([f]) => !FLAGS.includes(f));
    for (const [f, v] of Object.entries(flags)) {
      const at = entry.findIndex(([g, w], i) => i >= 3 && (g > f || (typeof w === "object" && !Array.isArray(w))));
      entry.splice(at < 0 ? entry.length : at, 0, [f, v]);
    }
    packages[place] = Object.fromEntries(entry);
  }
  return { name: "maia-worker", version: me.version, lockfileVersion: 3, requires: true, packages };
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/** One ustar header block. */
function header(path, size, dir) {
  const h = Buffer.alloc(512);
  let name = path;
  let prefix = "";
  if (Buffer.byteLength(name) > 100) {
    const cut = path.lastIndexOf("/", 155);
    prefix = path.slice(0, cut);
    name = path.slice(cut + 1);
    if (cut < 0 || Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`path too long for the archive: ${path}`);
  }
  const octal = (n, width) => n.toString(8).padStart(width - 1, "0") + "\0";
  h.write(name, 0);
  h.write(octal(dir ? 0o755 : 0o644, 8), 100);
  h.write(octal(0, 8), 108);
  h.write(octal(0, 8), 116);
  h.write(octal(size, 12), 124);
  h.write(octal(MTIME, 12), 136);
  h.fill(" ", 148, 156);
  h.write(dir ? "5" : "0", 156);
  h.write("ustar\0", 257);
  h.write("00", 263);
  h.write(prefix, 345);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(octal(sum, 7) + " ", 148);
  return h;
}

/** A .tar.gz of these files ({path: contents}), under one top folder, in path order, the same bytes every time. */
export function tarGz(top, files) {
  const blocks = [];
  const dirs = new Set();
  for (const path of Object.keys(files).sort()) {
    const parts = `${top}/${path}`.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = `${parts.slice(0, i).join("/")}/`;
      if (!dirs.has(dir)) dirs.add(dir), blocks.push(header(dir, 0, true));
    }
    const data = Buffer.from(files[path]);
    blocks.push(header(`${top}/${path}`, data.length, false), data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const tar = Buffer.concat(blocks);
  const gz = gzipSync(Buffer.concat([tar, Buffer.alloc((10240 - (tar.length % 10240)) % 10240)]), { level: 9 });
  // (gzip's header names the operating system: always Unix, so the bytes don't depend on where it was built.)
  gz[9] = 3;
  return gz;
}

/**
 * The box's source archive.
 * - `box`: the box's folder.
 * - `lock`: its package-lock.json's text (boxLock's, or the box's own when building from this archive).
 * - `built`: the files the build wrote ({name: contents}), for SHA256SUMS.txt.
 * - `model`: the model's file name and contents, for model/README.txt.
 */
export function sourceArchive({ box, lock, built, model }) {
  const files = Object.fromEntries(boxFiles(box).map((path) => [path, readFileSync(join(box, path))]));
  files["package-lock.json"] = lock;
  files["SHA256SUMS.txt"] = Object.keys(built)
    .sort()
    .map((name) => `${sha256(built[name])}  ${name}\n`)
    .join("");
  files["model/README.txt"] = [
    "The model",
    "",
    `The build (scripts/build.mjs) takes the converted model from this folder: ${model.name}, ${model.data.length.toLocaleString("en-US")} bytes,`,
    `sha256 ${sha256(model.data)}.`,
    "",
    "It isn't in this archive (it's about 25 MB). Either:",
    "",
    `- download it from the site that served this archive, where it sits next to the archive: /engine/maia/${model.name}`,
    `  (https://hunchess.com/engine/maia/${model.name}), and put it here; or`,
    "- make it with scripts/convert.py from the official Maia-3 checkpoint, which CSSLab (University of Toronto)",
    "  publishes on Hugging Face (UofTCSSLab/Maia3-23M, at the revision pinned in convert.py, checked by its sha256).",
    "  README.md, \"The conversion, step by step\", says how.",
    "",
    "SHA256SUMS.txt (at the top of this archive) lists the sha256 of every file the build writes but this archive, the",
    "model included: the files the site serves at /engine/maia/.",
    "",
  ].join("\n");
  return tarGz(TOP, files);
}

/** The lockfile's text for the box: its own (building from this archive), else cut from the workspace's. */
export function lockText(box) {
  const own = join(box, "package-lock.json");
  if (existsSync(own)) return readFileSync(own, "utf8");
  const workspace = join(box, "../../package-lock.json");
  return `${JSON.stringify(boxLock(JSON.parse(readFileSync(workspace, "utf8"))), null, 2)}\n`;
}
