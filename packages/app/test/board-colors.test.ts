import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A device's storage (each case loads prefs.ts fresh, as a reload would). */
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
/** The page's <html>, as far as the pick goes: its data-board-colors attribute. */
function page() {
  const attrs = new Map<string, string>();
  vi.stubGlobal("document", { documentElement: { getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: string) => void attrs.set(k, v) } });
  return attrs;
}
const prefs = async () => {
  vi.resetModules();
  return import("../src/prefs.ts");
};

describe("Settings → Board → Board colors (Oct 18): the board's dark squares, on this device only", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("a device that hasn't picked has Classic; the three choices are Classic, Green and Gold", async () => {
    storage();
    const p = await prefs();
    expect(p.boardColors()).toBe("classic");
    expect([...p.BOARD_COLORS]).toEqual(["classic", "green", "gold"]);
  });

  it("a pick is remembered (a reload reads it back), under its own key, and switching back to Classic is remembered too", async () => {
    const s = storage();
    const p = await prefs();
    p.setBoardColors("green");
    expect(p.boardColors()).toBe("green");
    expect((await prefs()).boardColors()).toBe("green");
    p.setBoardColors("gold");
    expect((await prefs()).boardColors()).toBe("gold");
    p.setBoardColors("classic");
    expect((await prefs()).boardColors()).toBe("classic");
    expect(s.keys()).toEqual(["brc.boardColors"]);
  });

  it("a stored value that isn't one of the three is ignored: Classic", async () => {
    for (const junk of ["", "Green", "GOLD", "blue", "null", "undefined", "1", "{}", "green ", "classic,green"]) {
      storage({ "brc.boardColors": junk });
      const p = await prefs();
      expect(p.boardColors(), `stored ${JSON.stringify(junk)}`).toBe("classic");
    }
    const p = await prefs();
    expect(p.parseBoardColors(undefined)).toBe("classic");
    expect(p.parseBoardColors(null)).toBe("classic");
    expect(p.parseBoardColors(7)).toBe("classic");
    expect(p.parseBoardColors("gold")).toBe("gold");
    // A pick that isn't one is never stored either.
    const s = storage();
    (await prefs()).setBoardColors("purple" as never);
    expect(s.getItem("brc.boardColors")).toBe("classic");
  });

  it("the pick goes on the page as <html data-board-colors> (that's what colors every board), at start-up and on each pick", async () => {
    storage({ "brc.boardColors": "gold" });
    const attrs = page();
    const p = await prefs();
    p.applyBoardColors();
    expect(attrs.get("data-board-colors")).toBe("gold");
    p.setBoardColors("green");
    expect(attrs.get("data-board-colors")).toBe("green");
    p.setBoardColors("classic");
    expect(attrs.get("data-board-colors")).toBe("classic");
  });

  it("only this device: a pick sends nothing anywhere, and tells the screens that show prefs", async () => {
    storage();
    page();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const p = await prefs();
    let calls = 0;
    p.onPrefsChange(() => calls++);
    p.setBoardColors("green");
    expect(calls).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no storage (private mode): Classic, a pick lasts as long as the page, and nothing throws", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const p = await prefs();
    expect(p.boardColors()).toBe("classic");
    expect(() => p.setBoardColors("gold")).not.toThrow();
    expect(p.boardColors()).toBe("gold");
    // (And with no page at all, as in a test, applying does nothing.)
    expect(() => p.applyBoardColors()).not.toThrow();
  });
});
