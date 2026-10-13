import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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
  it("defaults to the classic knocks (PyChess's) when nothing is stored", async () => {
    device();
    const ps = await load();
    expect(ps.pieceSound("move")).toMatchObject({ id: "wood", label: "Classic knock", file: "/sounds/move.mp3" });
    expect(ps.pieceSound("capture")).toMatchObject({ id: "wood", label: "Classic double knock", file: "/sounds/capture.mp3" });
    expect(ps.CASTLE_SOUND).toBe("/sounds/castle.mp3");
  });

  it("keeps each pick on the device, separately, and reads it back after a reload", async () => {
    const m = device();
    let ps = await load();
    ps.setPieceSound("move", "classic-deep");
    ps.setPieceSound("capture", "double-knock");
    expect(m.get(PIECE_SOUND_KEYS.move)).toBe("classic-deep");
    expect(m.get(PIECE_SOUND_KEYS.capture)).toBe("double-knock");
    ps = await load();
    expect(ps.pieceSound("move").id).toBe("classic-deep");
    expect(ps.pieceSound("capture").id).toBe("double-knock");
  });

  it("falls back to the default for an unknown or old stored id, and picking one stores the default", async () => {
    const m = device({ [PIECE_SOUND_KEYS.move]: "kazoo", [PIECE_SOUND_KEYS.capture]: "" });
    const ps = await load();
    expect(ps.pieceSound("move").id).toBe(MOVE_SOUNDS[0].id);
    expect(ps.pieceSound("capture").id).toBe(CAPTURE_SOUNDS[0].id);
    expect(ps.setPieceSound("move", "nope").id).toBe("wood");
    expect(m.get(PIECE_SOUND_KEYS.move)).toBe("wood");
    // A capture id isn't a move sound.
    expect(pieceSoundOption("move", "short-wood").id).toBe("wood");
    expect(pieceSoundOption("capture", "classic-light").id).toBe("wood");
  });

  it("a device that picked a sound that's gone (the chips, clicks and thuds) hears the classic default", async () => {
    for (const [move, capture] of [
      ["click", "clack"],
      ["soft", "thud"],
      ["poker-chip", "chips"],
    ]) {
      device({ [PIECE_SOUND_KEYS.move]: move!, [PIECE_SOUND_KEYS.capture]: capture! });
      const ps = await load();
      expect(ps.pieceSound("move").file).toBe("/sounds/move.mp3");
      expect(ps.pieceSound("capture").file).toBe("/sounds/capture.mp3");
    }
  });

  it("a pick of the classics from before Oct 12 (id \"wood\") is the classic again, and every wood pick since is kept", async () => {
    device({ [PIECE_SOUND_KEYS.move]: "wood", [PIECE_SOUND_KEYS.capture]: "wood" });
    let ps = await load();
    expect(ps.pieceSound("move").label).toBe("Classic knock");
    expect(ps.pieceSound("capture").label).toBe("Classic double knock");
    const since = {
      move: ["light-wood", "wood-tap", "bright-wood", "ringing-wood", "deep-wood"],
      capture: ["heavy-wood", "double-knock", "short-wood", "wood-block", "big-wood"],
    };
    for (let i = 0; i < 5; i++) {
      device({ [PIECE_SOUND_KEYS.move]: since.move[i]!, [PIECE_SOUND_KEYS.capture]: since.capture[i]! });
      ps = await load();
      expect(ps.pieceSound("move").id).toBe(since.move[i]);
      expect(ps.pieceSound("capture").id).toBe(since.capture[i]);
    }
  });

  it("works without storage: the default, and a pick lasts until the page reloads", async () => {
    device({}, true);
    const ps = await load();
    expect(ps.pieceSound("move").id).toBe("wood");
    const heard: string[] = [];
    ps.onPieceSoundChange(() => heard.push(ps.pieceSound("move").id));
    expect(ps.setPieceSound("move", "deep-wood").id).toBe("deep-wood");
    expect(ps.pieceSound("move").id).toBe("deep-wood");
    expect(heard).toEqual(["deep-wood"]);
  });
});

describe("piece sounds: the options", () => {
  it("in order: the classic default, its three variations, then the other wooden options", () => {
    expect(MOVE_SOUNDS.map((o) => o.label)).toEqual([
      "Classic knock",
      "Classic light",
      "Classic deep",
      "Classic soft",
      "Light wood",
      "Wooden tap",
      "Bright wood",
      "Ringing wood",
      "Deep wood",
    ]);
    expect(CAPTURE_SOUNDS.map((o) => o.label)).toEqual([
      "Classic double knock",
      "Classic light double",
      "Classic deep double",
      "Classic soft double",
      "Heavy wood",
      "Double knock",
      "Short wood",
      "Wood block",
      "Big wood",
    ]);
  });
});

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
/** SOURCES.md's table: each file (relative to public/sounds/) and its row. */
const sourceRows = () => {
  const sources = read("../public/sounds/SOURCES.md");
  const rows = new Map<string, string>();
  for (const row of sources.split("\n").filter((l) => l.startsWith("| `"))) rows.set(row.match(/^\| `([^`]+)`/)![1]!, row);
  return rows;
};
const PYCHESS = "https://github.com/pychess/pychess/tree/master/sounds";

describe("piece sounds: the files", () => {
  const rows = sourceRows();
  for (const [kind, list] of [
    ["move", MOVE_SOUNDS],
    ["capture", CAPTURE_SOUNDS],
  ] as const) {
    it(`${kind}: all wood, unique ids and labels, each file small and credited in SOURCES.md with its source, author and license`, () => {
      expect(list.length).toBe(9);
      // (Eric, Oct 12: wooden sounds, not chips or clicks; the classics are PyChess's wooden knocks.)
      for (const o of list) expect(`${o.id} ${o.label}`).toMatch(/wood|knock|classic/i);
      expect(new Set(list.map((o) => o.id)).size).toBe(list.length);
      expect(new Set(list.map((o) => o.label)).size).toBe(list.length);
      for (const o of list) {
        const path = new URL(`../public${o.file}`, import.meta.url);
        expect(existsSync(path), o.file).toBe(true);
        expect(statSync(path).size, o.file).toBeLessThan(8 * 1024);
        const row = rows.get(o.file.replace("/sounds/", ""));
        expect(row, `${o.file} in SOURCES.md`).toBeDefined();
        expect(row, o.file).toContain(`**${o.label}**`);
        expect(row).toMatch(/\| (CC0 1\.0|Ours, no third-party rights|GPL-3\.0) \|$/);
      }
    });
  }
  it("move and capture labels don't repeat across the two pickers (each ▶ is named by its label)", () => {
    const labels = [...MOVE_SOUNDS, ...CAPTURE_SOUNDS].map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
  it("SOURCES.md lists no file that isn't there, and every sound file in the folders is in it", () => {
    for (const file of rows.keys()) expect(existsSync(new URL(`../public/sounds/${file}`, import.meta.url)), file).toBe(true);
    const dir = new URL("../public/sounds/", import.meta.url);
    const shipped = [
      ...readdirSync(dir).filter((f) => f.endsWith(".mp3")),
      ...readdirSync(new URL("pieces/", dir)).map((f) => `pieces/${f}`),
    ];
    expect(shipped.sort()).toEqual([...rows.keys()].sort());
  });
});

describe("piece sounds: the classics are PyChess's (GPL-3.0), credited", () => {
  const rows = sourceRows();
  const classics = [MOVE_SOUNDS[0], CAPTURE_SOUNDS[0]];
  const variations = [...MOVE_SOUNDS, ...CAPTURE_SOUNDS].filter((o) => o.id.startsWith("classic-"));

  it("the classic files are the ones the game has had since Oct 2 (byte for byte), and castling's too", () => {
    // (Their sizes, as converted on Oct 2, 2026: restored from before Oct 12 unchanged.)
    expect(statSync(new URL("../public/sounds/move.mp3", import.meta.url)).size).toBe(1298);
    expect(statSync(new URL("../public/sounds/capture.mp3", import.meta.url)).size).toBe(3806);
    expect(statSync(new URL("../public/sounds/castle.mp3", import.meta.url)).size).toBe(5060);
    for (const [file, wav] of [
      ["move.mp3", "mov2.wav"],
      ["capture.mp3", "capture2.wav"],
      ["castle.mp3", "castle.wav"],
    ]) {
      const row = rows.get(file)!;
      expect(row, file).toContain(`PyChess, \`sounds/${wav}\``);
      expect(row).toContain("the PyChess authors");
      expect(row).toMatch(/\| GPL-3\.0 \|$/);
    }
    for (const o of classics) expect(rows.get(o.file.replace("/sounds/", ""))).toContain("(default)");
  });

  it("three variations of each classic, right after it, each a credited, modified PyChess file", () => {
    expect(MOVE_SOUNDS.slice(1, 4).map((o) => o.id)).toEqual(["classic-light", "classic-deep", "classic-soft"]);
    expect(CAPTURE_SOUNDS.slice(1, 4).map((o) => o.id)).toEqual(["classic-light-double", "classic-deep-double", "classic-soft-double"]);
    expect(variations).toHaveLength(6);
    for (const o of variations) {
      const row = rows.get(o.file.replace("/sounds/", ""))!;
      expect(row, o.file).toContain("A variation of PyChess's sounds, made by our script");
      expect(row).toContain(o.file.includes("move") ? "`mov2.wav`" : "`capture2.wav`");
      expect(row).toMatch(/pitched (up|down) [12] semitones?/);
      expect(row).toMatch(/high shelf/);
      expect(row).toMatch(/decay/);
      expect(row).toContain("the PyChess authors; modified by HunChess, Oct 12, 2026");
      expect(row).toMatch(/\| GPL-3\.0 \|$/);
    }
    // Only the classics and their variations are GPL: everything else stays CC0 or ours.
    const gpl = [...rows].filter(([, row]) => row.endsWith("| GPL-3.0 |")).map(([file]) => file);
    expect(gpl.sort()).toEqual(["capture.mp3", "castle.mp3", "move.mp3", ...variations.map((o) => o.file.replace("/sounds/", ""))].sort());
  });

  it("the script that makes the variations has each of them", () => {
    const script = read("../../../scripts/piece-sounds.py");
    for (const o of variations) expect(script, o.file).toContain(`"${o.file.replace("/sounds/pieces/", "").replace(".mp3", "")}": (`);
  });

  it("the GPL-3.0's text ships with them (Stockfish's copy, the same license) and the notice names every file", () => {
    // (vite.config.ts copies Stockfish's Copying.txt to /engine/COPYING.txt at every build.)
    const gpl = readFileSync(join(dirname(createRequire(import.meta.url).resolve("stockfish/package.json")), "Copying.txt"), "utf8");
    expect(gpl).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(gpl).toContain("Version 3, 29 June 2007");
    expect(read("../vite.config.ts")).toContain('"public/engine/COPYING.txt"');
    const notice = read("../public/licenses/third-party.txt");
    expect(notice).toContain(PYCHESS);
    expect(notice).toContain("/engine/COPYING.txt");
    for (const f of ["/sounds/move.mp3", "/sounds/capture.mp3", "/sounds/castle.mp3"]) expect(notice).toContain(f);
    for (const o of variations) expect(notice).toContain(o.file.replace("/sounds/pieces/", ""));
    expect(notice).toContain("variations of\n  PyChess's sounds, made by our script");
  });

  it("credited in Settings and the FAQ, with a link to PyChess's sounds and the license", () => {
    const settings = read("../src/screens/Settings.tsx");
    expect(settings).toContain(`Classic piece sounds and their variations: <a href="${PYCHESS}">PyChess</a> (GPL-3.0)`);
    expect(settings).toContain('<a href="/engine/COPYING.txt">license</a>');
    const faq = read("../src/faq/content.ts");
    expect(faq).toContain(`- **Classic piece sounds** and their variations: [PyChess](${PYCHESS}) (GPL-3.0).`);
    expect(faq).toContain("[license](/engine/COPYING.txt)");
    expect(read("../../../LICENSES.md")).toContain("GPL-3.0 data files");
    expect(read("../../../DECISIONS.md")).toContain("Eric, Oct 12: classic PyChess knocks back as the default, GPL-3.0, credited");
  });
});
