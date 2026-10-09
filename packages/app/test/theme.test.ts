import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseThemePref, resolveTheme, type ThemePref } from "../src/theme.ts";

/** A device: its storage (or none), its own light/dark setting (which can change), and the page's <html>. */
function device({ stored, light = false, noStorage = false }: { stored?: string | null; light?: boolean; noStorage?: boolean } = {}) {
  const m = new Map<string, string>();
  if (stored != null) m.set("brc.theme", stored);
  const fail = () => {
    throw new Error("no storage");
  };
  vi.stubGlobal(
    "localStorage",
    noStorage
      ? { getItem: fail, setItem: fail, removeItem: fail }
      : { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) },
  );
  const attrs = new Map<string, string>();
  vi.stubGlobal("document", { documentElement: { getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: string) => void attrs.set(k, v) } });
  const media = { light, listeners: new Set<() => void>() };
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() {
      return q === "(prefers-color-scheme: light)" ? media.light : false;
    },
    addEventListener: (_: string, fn: () => void) => media.listeners.add(fn),
  }));
  return {
    storage: m,
    shown: () => attrs.get("data-theme") ?? null,
    /** The device switches between light and dark. */
    flip(toLight: boolean) {
      media.light = toLight;
      media.listeners.forEach((fn) => fn());
    },
  };
}
const theme = async () => {
  vi.resetModules();
  return import("../src/theme.ts");
};

describe("light or dark", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("a stored pick is light or dark; anything else follows the device", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    for (const v of [null, undefined, "", "system", "Dark", "blue"]) expect(parseThemePref(v)).toBe("system");
  });

  it("the theme shown: the pick, else the device's (no preference reads as dark, the app's base)", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("a new device follows its own setting, live, until someone picks", async () => {
    const d = device({ light: true });
    const t = await theme();
    t.watchTheme();
    expect(t.themePref()).toBe("system");
    expect(d.shown()).toBe("light");
    d.flip(false);
    expect(d.shown()).toBe("dark");
    d.flip(true);
    expect(d.shown()).toBe("light");
  });

  it("a pick is remembered and shown, beats the device, and Match device follows it again", async () => {
    const d = device({ light: true });
    const t = await theme();
    t.watchTheme();
    // Settings' Dark, in light mode: dark, remembered.
    t.setThemePref("dark");
    expect(d.shown()).toBe("dark");
    expect(d.storage.get("brc.theme")).toBe("dark");
    expect(t.themePref()).toBe("dark");
    // The device changing doesn't undo a pick.
    d.flip(false);
    d.flip(true);
    expect(d.shown()).toBe("dark");
    t.setThemePref("light");
    expect(d.shown()).toBe("light");
    expect(d.storage.get("brc.theme")).toBe("light");
    // Match device: the key goes, and the device decides again.
    t.setThemePref("system");
    expect(d.storage.has("brc.theme")).toBe(false);
    d.flip(false);
    expect(d.shown()).toBe("dark");
  });

  it("opening the app again keeps the pick (the stored value)", async () => {
    const d = device({ stored: "light", light: false });
    const t = await theme();
    t.watchTheme();
    expect(t.themePref()).toBe("light");
    expect(d.shown()).toBe("light");
  });

  it("without storage a pick still works while the page is open", async () => {
    const d = device({ noStorage: true, light: true });
    const t = await theme();
    t.watchTheme();
    expect(d.shown()).toBe("light");
    t.setThemePref("dark");
    expect(t.themePref()).toBe("dark");
    expect(d.shown()).toBe("dark");
  });

  it("index.html's script, before the first paint, picks the same theme as theme.ts in every case", async () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
    expect(script, "the inline theme script in <head>").toBeTruthy();
    expect(html.indexOf(script!)).toBeLessThan(html.indexOf("</head>"));
    const cases: { stored: string | null; light: boolean; noStorage?: boolean }[] = [];
    for (const stored of [null, "light", "dark", "junk", "system"]) for (const light of [true, false]) cases.push({ stored, light });
    cases.push({ stored: null, light: true, noStorage: true }, { stored: null, light: false, noStorage: true });
    for (const c of cases) {
      const d = device(c);
      new Function(script!)();
      const expected = resolveTheme(c.noStorage ? "system" : (parseThemePref(c.stored) as ThemePref), c.light);
      expect(d.shown(), JSON.stringify(c)).toBe(expected);
      // And theme.ts agrees once it's running.
      const t = await theme();
      expect(t.currentTheme(), JSON.stringify(c)).toBe(expected);
    }
    // No media queries at all: dark, the base.
    device();
    vi.stubGlobal("matchMedia", () => {
      throw new Error("no matchMedia");
    });
    const attrs: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } });
    new Function(script!)();
    expect(attrs["data-theme"]).toBe("dark");
  });
});
