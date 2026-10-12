import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const DIR = new URL("../src/board/pieces/", import.meta.url);
const files = readdirSync(new URL("cburnett/", DIR)).filter((f) => f.endsWith(".svg")).sort();

describe("the pieces (cburnett, BSD: board/pieces/)", () => {
  it("are the twelve, each drawn by pieces.css and listed with its source", () => {
    expect(files).toHaveLength(12);
    const css = readFileSync(new URL("../src/board/pieces.css", import.meta.url), "utf8");
    const sources = readFileSync(new URL("SOURCES.md", DIR), "utf8");
    for (const f of files) {
      expect(css).toContain(`./pieces/cburnett/${f}`);
      expect(sources).toContain(`https://commons.wikimedia.org/wiki/File:${f}`);
    }
    for (const role of ["pawn", "knight", "bishop", "rook", "queen", "king"]) for (const c of ["white", "black"]) expect(css).toContain(`piece.${role}.${c} {`);
  });

  it("are plain drawings: no scripts or outside references", () => {
    for (const f of files) {
      const svg = readFileSync(new URL(`cburnett/${f}`, DIR), "utf8");
      expect(svg).not.toMatch(/<script|\son[a-z]+\s*=|foreignObject|href="http/i);
    }
  });

  it("only the black pieces' details are changed from Commons (white toned to #ececec): the rest as downloaded", () => {
    const sources = readFileSync(new URL("SOURCES.md", DIR), "utf8");
    for (const f of files) {
      const svg = readFileSync(new URL(`cburnett/${f}`, DIR), "utf8");
      const asDownloaded = /dt45/.test(f) ? svg.replaceAll("#ececec", "#ffffff") : svg;
      const sha1 = createHash("sha1").update(asDownloaded).digest("hex");
      expect(sources, f).toContain(sha1);
    }
  });

  it("their licence ships with the app, word for word (the credit in Settings and the FAQ links it)", () => {
    expect(readFileSync(new URL("../public/licenses/pieces.txt", import.meta.url), "utf8")).toBe(readFileSync(new URL("LICENSE.txt", DIR), "utf8"));
    expect(readFileSync(new URL("../src/screens/Settings.tsx", import.meta.url), "utf8")).toContain("/licenses/pieces.txt");
    expect(readFileSync(new URL("../src/faq/content.ts", import.meta.url), "utf8")).toContain("/licenses/pieces.txt");
  });
});
