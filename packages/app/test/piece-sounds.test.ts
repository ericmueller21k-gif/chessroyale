import { existsSync, readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_SOUNDS, MOVE_SOUNDS, PIECE_SOUND_KEYS, pieceSoundOption } from "../src/piece-sounds.ts";

/** A device's storage holding `stored` (or none at all: every call throws, as in some private modes). */
function device(stored: Record<string, string> = {}, noStorage = false) {
  const m = new Map(Object.entries(stored));
  const fail = () => {
    throw new Error("no storage");
  };
  vi.stubGlobal(
    "localStorage",
    noStorage ? { getItem: fail, setItem: fail, removeItem: fail } : { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)) },
  );
  return m;
}
/** The module fresh, as a page load reads it. */
const load = async () => {
  vi.resetModules();
  return import("../src/piece-sounds.ts");
};

afterEach(() => vi.unstubAllGlobals());

describe("piece sounds: the picks and where they're kept", () => {
  it("defaults to Light wood and Heavy wood when nothing is stored", async () => {
    device();
    const ps = await load();
    expect(ps.pieceSound("move").file).toBe("/sounds/pieces/move-light-wood.mp3");
    expect(ps.pieceSound("capture").file).toBe("/sounds/pieces/capture-heavy-wood.mp3");
  });

  it("keeps each pick on the device, separately, and reads it back after a reload", async () => {
    const m = device();
    let ps = await load();
    ps.setPieceSound("move", "wood-tap");
    ps.setPieceSound("capture", "double-knock");
    expect(m.get(PIECE_SOUND_KEYS.move)).toBe("wood-tap");
    expect(m.get(PIECE_SOUND_KEYS.capture)).toBe("double-knock");
    ps = await load();
    expect(ps.pieceSound("move").id).toBe("wood-tap");
    expect(ps.pieceSound("capture").id).toBe("double-knock");
  });

  it("falls back to the default for an unknown or old stored id, and picking one stores the default", async () => {
    const m = device({ [PIECE_SOUND_KEYS.move]: "kazoo", [PIECE_SOUND_KEYS.capture]: "" });
    const ps = await load();
    expect(ps.pieceSound("move").id).toBe(MOVE_SOUNDS[0].id);
    expect(ps.pieceSound("capture").id).toBe(CAPTURE_SOUNDS[0].id);
    expect(ps.setPieceSound("move", "nope").id).toBe("light-wood");
    expect(m.get(PIECE_SOUND_KEYS.move)).toBe("light-wood");
    // A capture id isn't a move sound.
    expect(pieceSoundOption("move", "short-wood").id).toBe("light-wood");
  });

  it("a device that picked a sound that's gone (the old knocks, the chips, clicks and thuds) hears the default", async () => {
    for (const [move, capture] of [
      ["wood", "wood"],
      ["click", "clack"],
      ["soft", "thud"],
      ["poker-chip", "chips"],
    ]) {
      device({ [PIECE_SOUND_KEYS.move]: move!, [PIECE_SOUND_KEYS.capture]: capture! });
      const ps = await load();
      expect(ps.pieceSound("move").id).toBe("light-wood");
      expect(ps.pieceSound("capture").id).toBe("heavy-wood");
    }
  });

  it("works without storage: the default, and a pick lasts until the page reloads", async () => {
    device({}, true);
    const ps = await load();
    expect(ps.pieceSound("move").id).toBe("light-wood");
    const heard: string[] = [];
    ps.onPieceSoundChange(() => heard.push(ps.pieceSound("move").id));
    expect(ps.setPieceSound("move", "deep-wood").id).toBe("deep-wood");
    expect(ps.pieceSound("move").id).toBe("deep-wood");
    expect(heard).toEqual(["deep-wood"]);
  });
});

describe("piece sounds: the files", () => {
  const sources = readFileSync(new URL("../public/sounds/SOURCES.md", import.meta.url), "utf8");
  for (const [kind, list] of [
    ["move", MOVE_SOUNDS],
    ["capture", CAPTURE_SOUNDS],
  ] as const) {
    it(`${kind}: 4–6 options, all wood, the default first, unique ids and labels, each file small and credited in SOURCES.md`, () => {
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.length).toBeLessThanOrEqual(6);
      expect(list[0].id).toBe(kind === "move" ? "light-wood" : "heavy-wood");
      // (Eric, Oct 12: wooden sounds, not chips or clicks.)
      for (const o of list) expect(`${o.id} ${o.label}`).toMatch(/wood|knock/i);
      expect(new Set(list.map((o) => o.id)).size).toBe(list.length);
      expect(new Set(list.map((o) => o.label)).size).toBe(list.length);
      for (const o of list) {
        const path = new URL(`../public${o.file}`, import.meta.url);
        expect(existsSync(path), o.file).toBe(true);
        expect(statSync(path).size, o.file).toBeLessThan(8 * 1024);
        expect(sources, `${o.file} in SOURCES.md`).toContain(o.file.replace("/sounds/", ""));
      }
    });
  }
  it("move and capture labels don't repeat across the two pickers (each ▶ is named by its label)", () => {
    const labels = [...MOVE_SOUNDS, ...CAPTURE_SOUNDS].map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("piece sounds: nothing GPL", () => {
  it("the old PyChess knocks are gone, and SOURCES.md lists only CC0 or ours for every piece sound", () => {
    for (const f of ["move.mp3", "capture.mp3", "castle.mp3"]) expect(existsSync(new URL(`../public/sounds/${f}`, import.meta.url)), f).toBe(false);
    const sources = readFileSync(new URL("../public/sounds/SOURCES.md", import.meta.url), "utf8");
    const table = sources.slice(0, sources.indexOf("\n\n- "));
    for (const row of table.split("\n").filter((l) => l.startsWith("| `"))) expect(row, row).toMatch(/CC0 1\.0 \|$|Ours, no third-party rights \|$/);
    expect(existsSync(new URL("../public/sounds/pieces/castle-wood.mp3", import.meta.url))).toBe(true);
  });
});
