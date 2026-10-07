import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A device's storage (prefs.ts reads it once, so each case loads the module fresh). */
function storage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const s = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
  vi.stubGlobal("localStorage", s);
  return s;
}
const prefs = async () => {
  vi.resetModules();
  return import("../src/prefs.ts");
};

describe("the space under the board: one remembered view", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("a new device: side by side, open", async () => {
    storage();
    expect((await prefs()).underBoardView()).toEqual({ layout: "split", open: true });
  });

  it("making a panel bigger, or splitting again, always opens it; folding keeps the layout", async () => {
    const s = storage();
    const p = await prefs();
    let calls = 0;
    p.onPrefsChange(() => calls++);
    p.foldUnderBoard(false);
    expect(p.underBoardView()).toEqual({ layout: "split", open: false });
    // Eric's empty box came from this: folded, then the scoreboard full width.
    p.showUnderBoard("board");
    expect(p.underBoardView()).toEqual({ layout: "board", open: true });
    p.foldUnderBoard(false);
    expect(p.underBoardView()).toEqual({ layout: "board", open: false });
    p.showUnderBoard("split");
    expect(p.underBoardView()).toEqual({ layout: "split", open: true });
    p.foldUnderBoard(false);
    p.showUnderBoard("chat");
    expect(p.underBoardView()).toEqual({ layout: "chat", open: true });
    expect(calls).toBe(6);
    // Remembered, as one setting.
    expect(JSON.parse(s.getItem("brc.underBoardView")!)).toEqual({ layout: "chat", open: true });
    expect((await prefs()).underBoardView()).toEqual({ layout: "chat", open: true });
  });

  it("an older build's two settings: kept, except a folded full-width panel opens; then they're gone", async () => {
    const cases: [string | null, string | null, { layout: string; open: boolean }][] = [
      ["split", "1", { layout: "split", open: true }],
      ["split", "0", { layout: "split", open: false }],
      ["board", "1", { layout: "board", open: true }],
      ["board", "0", { layout: "board", open: true }], // Eric's phone
      ["chat", "0", { layout: "chat", open: true }],
      [null, "0", { layout: "split", open: false }],
      ["junk", null, { layout: "split", open: true }],
    ];
    for (const [layout, fold, want] of cases) {
      const s = storage({ ...(layout ? { "brc.underBoard": layout } : {}), ...(fold ? { "brc.miniTower": fold } : {}) });
      expect((await prefs()).underBoardView(), `${layout} ${fold}`).toEqual(want);
      expect(s.keys()).toEqual(["brc.underBoardView"]);
    }
  });

  it("junk saved, or no storage at all: the default, and it still works in memory", async () => {
    storage({ "brc.underBoardView": "{not json" });
    expect((await prefs()).underBoardView()).toEqual({ layout: "split", open: true });
    storage({ "brc.underBoardView": JSON.stringify({ layout: "huge", open: "no" }) });
    expect((await prefs()).underBoardView()).toEqual({ layout: "split", open: true });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    const p = await prefs();
    expect(p.underBoardView()).toEqual({ layout: "split", open: true });
    p.showUnderBoard("board");
    p.foldUnderBoard(false);
    expect(p.underBoardView()).toEqual({ layout: "board", open: false });
  });
});
