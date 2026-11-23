import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { untar } from "./tar.ts";

/**
 * Stockfish's source, served next to the engine (/engine/stockfish-source.tar.gz, GPL-3.0; DECISIONS.md, "The Maia
 * box's source on the site"): the archive vite.config.ts copies is the one for the installed package's version, and
 * holds that build's whole source, the network it embeds included.
 */
const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(APP, "package.json"));
const pkgDir = dirname(require.resolve("stockfish/package.json"));
const version = (JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { version: string }).version;
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

describe("Stockfish's source archive", () => {
  const name = `stockfish.js-${version}-source.tar.gz`;
  const archive = readFileSync(join(APP, "stockfish-source", name));
  const files = untar(archive);
  const top = `stockfish.js-${version}`;
  const file = (path: string) => files.get(`${top}/${path}`);

  it("there is one for the installed package's version, as its README records it", () => {
    const readme = readFileSync(join(APP, "stockfish-source/README.md"), "utf8");
    expect(readme).toContain(`## \`${name}\``);
    expect(readme).toContain(sha256(archive));
    expect(readme).toContain(archive.length.toLocaleString("en-US"));
  });

  it("is that version's source tree, under Stockfish's license", () => {
    expect([...files.keys()].every((p) => p.startsWith(`${top}/`))).toBe(true);
    expect((JSON.parse(file("package.json")!.toString()) as { version: string }).version).toBe(version);
    expect(file("Copying.txt")!.toString()).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(file("Copying.txt")!.toString()).toContain("Version 3, 29 June 2007");
    for (const path of ["build.js", "README.md", "src/Makefile", "src/evaluate.h", "src/uci.cpp", "scripts/net.sh"]) expect(file(path), path).toBeDefined();
    // (The same license the app serves beside the engine.)
    expect(file("Copying.txt")!.equals(readFileSync(join(pkgDir, "Copying.txt")))).toBe(true);
  });

  it("holds the network the build embeds, whose name is its own hash", () => {
    const lite = /#define EvalFileLiteName "(nn-([0-9a-f]{12})\.nnue)"/.exec(file("src/evaluate.h")!.toString());
    expect(lite).not.toBeNull();
    const net = file(`src/${lite![1]}`);
    expect(net, lite![1]).toBeDefined();
    expect(sha256(net!).slice(0, 12)).toBe(lite![2]);
    // (The served engine carries it: a slice from its middle is in the .wasm.)
    const wasm = readFileSync(join(pkgDir, "bin/stockfish-19-lite-single.wasm"));
    expect(wasm.includes(net!.subarray(500_000, 500_256))).toBe(true);
  });

  it("says what it is and how to build the two files the app serves", () => {
    const note = file("SOURCE-FOR-HUNCHESS.txt")!.toString();
    expect(note).toContain("/engine/stockfish-19-lite-single.js");
    expect(note).toContain(`"stockfish" ${version}`);
    expect(note).toContain("node build.js --lite --single-threaded --no-split");
    expect(note).toContain("GNU General Public License, version 3");
  });

  it("the build copies it next to the engine, and the service worker doesn't precache the source archives", () => {
    const config = readFileSync(join(APP, "vite.config.ts"), "utf8");
    expect(config).toContain("stockfish-source/stockfish.js-${version}-source.tar.gz");
    expect(config).toContain('"public/engine/stockfish-source.tar.gz"');
    expect(config).toContain('!f.endsWith(".tar.gz")');
  });
});
