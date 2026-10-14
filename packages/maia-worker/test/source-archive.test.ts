// Maia box (AGPL-3.0, see LICENSE): the source archive the build writes next to the worker
// (/engine/maia/maia-box-source.tar.gz): what's in it, what isn't, and that it rebuilds what's served.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARCHIVE, TOP, boxFiles, boxLock, lockText, sourceArchive, tarGz, type Lockfile } from "../scripts/source-archive.mjs";

const BOX = join(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/** A .tar.gz's files (directories left out), by path. */
function untar(gz: Uint8Array): Map<string, Buffer> {
  const tar = gunzipSync(gz);
  const files = new Map<string, Buffer>();
  for (let at = 0; at + 512 <= tar.length; ) {
    const h = tar.subarray(at, at + 512);
    if (h.every((b) => b === 0)) break;
    const text = (from: number, n: number) => h.subarray(from, from + n).toString("utf8").replace(/\0[\s\S]*$/, "");
    const size = parseInt(text(124, 12), 8);
    const prefix = text(345, 155);
    const path = prefix ? `${prefix}/${text(0, 100)}` : text(0, 100);
    if (text(156, 1) === "0") files.set(path, tar.subarray(at + 512, at + 512 + size));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

describe("the Maia box's source archive", () => {
  let out = "";
  let files = new Map<string, Buffer>();
  const file = (path: string) => files.get(`${TOP}/${path}`)!.toString("utf8");

  beforeAll(() => {
    // The box's own build, as the site's build runs it.
    out = mkdtempSync(join(tmpdir(), "maia-box-"));
    execFileSync(process.execPath, [join(BOX, "scripts/build.mjs"), out]);
    files = untar(readFileSync(join(out, ARCHIVE)));
  }, 60_000);
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it("the build writes it next to the worker it builds", () => {
    expect(readdirSync(out).sort()).toEqual(["LICENSE.txt", "NOTICE.txt", ARCHIVE, "maia-worker.js", "maia3-23m-int8.onnx", "ort-wasm-simd-threaded.wasm"].sort());
    // Small: the model isn't in it twice.
    expect(readFileSync(join(out, ARCHIVE)).length).toBeLessThan(200_000);
  });

  it("holds the worker's code, its build and package manifest, the AGPL, the README and the conversion", () => {
    for (const path of [
      "src/worker.ts",
      "src/uci.ts",
      "src/model.ts",
      "src/encode.ts",
      "src/policy.ts",
      "src/cli.ts",
      "scripts/build.mjs",
      "scripts/source-archive.mjs",
      "scripts/convert.py",
      "scripts/requirements.txt",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "licenses/onnxruntime-MIT.txt",
      "LICENSE",
      "README.md",
      "model/README.txt",
      "SHA256SUMS.txt",
      "test/fixtures/encoding.json",
    ])
      expect(files.has(`${TOP}/${path}`), path).toBe(true);
    // Each of the box's own files as it is.
    for (const path of boxFiles(BOX)) expect(files.get(`${TOP}/${path}`)!.equals(readFileSync(join(BOX, path))), path).toBe(true);
    expect(file("LICENSE")).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
    expect(file("LICENSE")).toContain("Version 3, 19 November 2007");
  });

  it("its README says what it is, how to build it, which Maia-3 and model, and where the weights come from", () => {
    const readme = file("README.md");
    expect(readme).toContain("GNU AGPL 3.0");
    expect(readme).toContain("https://github.com/CSSLab/maia3");
    expect(readme).toContain("1e13597c42d4858b7cfd7cfdae01e297263364b2");
    expect(readme).toContain("UofTCSSLab/Maia3-23M");
    expect(readme).toContain("51a0145a8178046f7de23119160b136672deeb2b");
    expect(readme).toContain("bce6cd1af5f0399ac7eed33fabb7a6a2ef6193662c2740f262bf93af7bfb3569");
    expect(readme).toMatch(/npm ci/);
    expect(readme).toContain("node scripts/build.mjs");
    expect(readme).toContain(`/engine/maia/${ARCHIVE}`);
    // (The convert script pins the same sources.)
    expect(file("scripts/convert.py")).toContain("1e13597c42d4858b7cfd7cfdae01e297263364b2");
    expect(file("scripts/convert.py")).toContain("51a0145a8178046f7de23119160b136672deeb2b");
  });

  it("links the model rather than holding it: where it's served, its size and sha256", () => {
    expect([...files.keys()].filter((p) => p.endsWith(".onnx"))).toEqual([]);
    const model = readFileSync(join(out, "maia3-23m-int8.onnx"));
    const where = file("model/README.txt");
    expect(where).toContain("/engine/maia/maia3-23m-int8.onnx");
    expect(where).toContain(sha256(model));
    expect(where).toContain(model.length.toLocaleString("en-US"));
    expect(where).toContain("UofTCSSLab/Maia3-23M");
  });

  it("SHA256SUMS.txt matches every file the build wrote but the archive, so a rebuild can be checked", () => {
    const sums = file("SHA256SUMS.txt").trim().split("\n");
    const names = readdirSync(out).filter((f) => f !== ARCHIVE).sort();
    expect(sums.map((l) => l.split("  ")[1])).toEqual(names);
    for (const l of sums) {
      const [sum, name] = l.split("  ");
      expect(sha256(readFileSync(join(out, name!))), name).toBe(sum);
    }
  });

  it("nothing from the game: only the box's files (and the three written for it), none naming the game's code", () => {
    const expected = [...boxFiles(BOX), "package-lock.json", "SHA256SUMS.txt", "model/README.txt"].map((p) => `${TOP}/${p}`).sort();
    expect([...files.keys()].sort()).toEqual(expected);
    // (The game's package names, spelled so that this file doesn't name them itself.)
    const game = new RegExp(`@${"chess"}royale|packages/(app|core|chess|server|sim)\\b`);
    for (const [path, data] of files) {
      const text = data.toString("utf8");
      expect(text, path).not.toMatch(game);
      // (No import reaches outside the box.)
      expect(text, path).not.toMatch(/from ["']\.\.\/\.\.\//);
    }
    const lock = JSON.parse(file("package-lock.json")) as Lockfile;
    for (const [place, entry] of Object.entries(lock.packages)) {
      expect(place === "" || place.startsWith("node_modules/"), place).toBe(true);
      expect(entry.link, place).toBeUndefined();
    }
    for (const name of ["preact", "vite", "wrangler", "stockfish", "vitest", "typescript"]) expect(lock.packages[`node_modules/${name}`], name).toBeUndefined();
  });

  // (In the game's repository: the archive's lockfile against the workspace's.)
  it.skipIf(!existsSync(join(BOX, "../../package-lock.json")))("its lockfile pins exactly what the build used, from the workspace's lockfile", () => {
    const lock = JSON.parse(file("package-lock.json")) as Lockfile;
    const pkg = JSON.parse(file("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(lock.packages[""]!.dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""]!.devDependencies).toEqual(pkg.devDependencies);
    const workspace = JSON.parse(readFileSync(join(BOX, "../../package-lock.json"), "utf8")) as Lockfile;
    for (const [place, entry] of Object.entries(lock.packages)) {
      if (!place) continue;
      const theirs = workspace.packages[place] ?? workspace.packages[`packages/maia-worker/${place}`];
      expect(theirs, place).toBeDefined();
      expect(entry.version, place).toBe(theirs!.version);
      expect(entry.integrity, place).toBe(theirs!.integrity);
    }
    for (const name of [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]) expect(lock.packages[`node_modules/${name}`], name).toBeDefined();
    // The packages the build bundles are production ones; esbuild and its builds for each platform are for building.
    expect(lock.packages["node_modules/onnxruntime-web"]!.dev).toBeUndefined();
    expect(lock.packages["node_modules/chess.js"]!.dev).toBeUndefined();
    expect(lock.packages["node_modules/esbuild"]!.dev).toBe(true);
    expect(lock.packages["node_modules/@esbuild/linux-x64"]).toMatchObject({ dev: true, optional: true });
  });

  it("the same files make the same bytes", () => {
    const built = Object.fromEntries(readdirSync(out).filter((f) => f !== ARCHIVE).map((f) => [f, readFileSync(join(out, f))]));
    const model = { name: "maia3-23m-int8.onnx", data: built["maia3-23m-int8.onnx"]! };
    const a = sourceArchive({ box: BOX, lock: lockText(BOX), built, model });
    const b = sourceArchive({ box: BOX, lock: lockText(BOX), built, model });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(readFileSync(join(out, ARCHIVE)))).toBe(true);
  });

  it("the notice beside the worker points to it (no more \"on request\")", () => {
    const notice = readFileSync(join(out, "NOTICE.txt"), "utf8");
    expect(notice).toContain(`/engine/maia/${ARCHIVE}`);
    expect(notice).not.toContain("on request");
  });
});

describe("the box's lockfile, cut from a workspace's (boxLock)", () => {
  const pkg = (version: string, more: object = {}) => ({ version, resolved: `https://r/${version}.tgz`, integrity: `sha512-${version}`, license: "MIT", ...more });
  const workspace: Lockfile = {
    lockfileVersion: 3,
    packages: {
      "": { name: "game" },
      "packages/maia-worker": { version: "0.1.0", license: "AGPL-3.0-only", dependencies: { a: "^1.0.0", b: "^2.0.0" }, devDependencies: { tool: "1.0.0" } },
      "packages/other": { version: "0.1.0", dependencies: { ui: "1.0.0", b: "^3.0.0" } },
      "node_modules/maia-worker": { link: true, resolved: "packages/maia-worker" },
      "node_modules/a": pkg("1.0.0", { optionalDependencies: { native: "1.0.0" } }),
      // (The box's own copy of b, beside the root's, which another workspace uses.)
      "packages/maia-worker/node_modules/b": pkg("2.1.0"),
      "node_modules/b": pkg("3.0.0"),
      "node_modules/native": pkg("1.0.0", { optional: true, os: ["linux"] }),
      "node_modules/tool": pkg("1.0.0", { dev: true, optionalDependencies: { "tool-linux": "1.0.0" } }),
      // (As npm writes an entry: its flags among the other values, by name.)
      "node_modules/tool-linux": { version: "1.0.0", resolved: "https://r/t.tgz", integrity: "sha512-t", cpu: ["x64"], dev: true, license: "MIT", optional: true, os: ["linux"], engines: { node: ">=18" } },
      "node_modules/ui": pkg("1.0.0"),
    },
  };

  it("takes the box's packages only, at the places they'd have from the box, with npm's flags for the box", () => {
    const lock = boxLock(workspace);
    expect(Object.keys(lock.packages).sort()).toEqual(["", "node_modules/a", "node_modules/b", "node_modules/native", "node_modules/tool", "node_modules/tool-linux"]);
    expect(lock.packages[""]).toEqual({ name: "maia-worker", version: "0.1.0", license: "AGPL-3.0-only", dependencies: { a: "^1.0.0", b: "^2.0.0" }, devDependencies: { tool: "1.0.0" } });
    expect(lock.packages["node_modules/b"]!.version).toBe("2.1.0");
    expect(lock.packages["node_modules/b"]!.dev).toBeUndefined();
    expect(lock.packages["node_modules/a"]!.dev).toBeUndefined();
    expect(lock.packages["node_modules/native"]).toMatchObject({ optional: true });
    expect(lock.packages["node_modules/native"]!.dev).toBeUndefined();
    expect(lock.packages["node_modules/tool"]).toMatchObject({ dev: true });
    expect(lock.packages["node_modules/tool-linux"]).toMatchObject({ dev: true, optional: true });
    // npm's key order: version, resolved, integrity, then the rest by name, objects last.
    expect(Object.keys(lock.packages["node_modules/tool-linux"]!)).toEqual(["version", "resolved", "integrity", "cpu", "dev", "license", "optional", "os", "engines"]);
    expect(Object.keys(lock.packages["node_modules/tool"]!)).toEqual(["version", "resolved", "integrity", "dev", "license", "optionalDependencies"]);
  });

  it("refuses a lockfile it can't cut cleanly", () => {
    const missing = structuredClone(workspace);
    delete missing.packages["node_modules/a"];
    expect(() => boxLock(missing)).toThrow(/a \(needed by packages\/maia-worker\)/);
    // (A package of the root's that needs the root's b, while the box has its own: they'd share one place.)
    const clash = structuredClone(workspace);
    clash.packages["node_modules/a"]!.dependencies = { b: "^3.0.0" };
    expect(() => boxLock(clash)).toThrow(/two versions of a package would need node_modules\/b/);
    expect(() => boxLock(workspace, "packages/nothing")).toThrow(/isn't in the lockfile/);
  });

  it("a tiny archive: files in order under one folder, readable by tar", () => {
    const gz = tarGz("x", { "b.txt": "B", "a/deep/c.txt": "C".repeat(600) });
    const got = untar(gz);
    expect([...got.keys()]).toEqual(["x/a/deep/c.txt", "x/b.txt"]);
    expect(got.get("x/a/deep/c.txt")!.toString()).toBe("C".repeat(600));
    expect(tarGz("x", { "b.txt": "B" }).equals(tarGz("x", { "b.txt": "B" }))).toBe(true);
  });
});
