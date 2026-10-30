import { afterEach, describe, expect, it, vi } from "vitest";
import { TOWN_FEEL } from "../src/town/feel.ts";
import { NAMES_CHOICE, NAMES_KEY, NAMES_LABEL, NAMES_MODES, TAG_STYLE, TagCache, loadNamesMode, nameAlpha, namesMode, namesNote, onNamesMode, saveNamesMode, setNamesMode, tagAlpha, type TagKind } from "../src/town/tags.ts";

/**
 * The people's name tags (Eric, Oct 28, after trying 50 bots; docs/areas/town-square.md, "Name tags"): tags show only near you by default
 * and fade in and out at the edge of a radius of 5 squares; your own tag, a figure whose card is open and one at a table with you always
 * show; "Everyone" is every tag as before; the choice is remembered on this device; a boss's sidekick wears a blue tag with white
 * text (WCAG AA: 4.5:1), pawns white and you gold; and the drawings are cached by name, size and kind.
 */

describe("the near rule: a tag's alpha by its figure's distance from you (squares, the larger of the two directions)", () => {
  it("is the numbers in feel.ts: a radius of 5 squares (about a 10 × 10 area), fading over the last square", () => {
    expect(TOWN_FEEL.nameRadius).toBe(5);
    expect(TOWN_FEEL.nameFadeSquares).toBe(1);
  });

  it("is 1 at 4 and 4.5 squares, falls in a straight line to 0 at 5.5, and is 0 at 6 (alpha 1 at 4.5, 0 at 5.5)", () => {
    expect(nameAlpha(0)).toBe(1);
    expect(nameAlpha(4)).toBe(1);
    expect(nameAlpha(4.5)).toBe(1);
    expect(nameAlpha(5)).toBeCloseTo(0.5, 10);
    expect(nameAlpha(5.5)).toBe(0);
    expect(nameAlpha(6)).toBe(0);
    expect(nameAlpha(40)).toBe(0);
    // Straight line between: a quarter of the way is three quarters, three quarters is a quarter.
    expect(nameAlpha(4.75)).toBeCloseTo(0.75, 10);
    expect(nameAlpha(5.25)).toBeCloseTo(0.25, 10);
  });

  it("only ever falls as the distance grows, within 0 and 1 (no pop: it fades)", () => {
    let last = 1;
    for (let d = 0; d <= 8; d += 0.05) {
      const a = nameAlpha(d);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(last + 1e-12);
      last = a;
    }
  });

  it("takes its numbers from its arguments too (the radius and the fade are settings, never in the drawing code)", () => {
    expect(nameAlpha(7, 8, 2)).toBe(1); // (full to radius − fade / 2)
    expect(nameAlpha(8, 8, 2)).toBeCloseTo(0.5, 10);
    expect(nameAlpha(9, 8, 2)).toBe(0); // (gone at radius + fade / 2)
  });
});

describe("a tag's alpha: the near rule and today's far-distance fade, the smaller of them; some always show", () => {
  it("near you, all of it; at the edge, the near rule's fade; past it, none", () => {
    expect(tagAlpha("near", 3, false, 1)).toBe(1);
    expect(tagAlpha("near", 5, false, 1)).toBeCloseTo(0.5, 10);
    expect(tagAlpha("near", 5.5, false, 1)).toBe(0);
    expect(tagAlpha("near", 20, false, 1)).toBe(0);
  });

  it("takes the smaller alpha of the near rule and the far-distance fade (toward the rim)", () => {
    expect(tagAlpha("near", 3, false, 0.4)).toBeCloseTo(0.4, 10);
    expect(tagAlpha("near", 5, false, 0.9)).toBeCloseTo(0.5, 10);
    expect(tagAlpha("near", 5, false, 0.3)).toBeCloseTo(0.3, 10);
    expect(tagAlpha("near", 3, false, 0)).toBe(0);
  });

  it("is always shown, whatever the distance, for your own tag, an open card's figure and a table partner (the far fade still applies)", () => {
    for (const d of [0, 5, 6, 30, 200]) expect(tagAlpha("near", d, true, 1), `always, ${d} squares`).toBe(1);
    expect(tagAlpha("near", 30, true, 0.5), "the far fade still applies").toBe(0.5);
  });

  it("is every tag as before in Everyone: no near rule at any distance; only the far fade", () => {
    for (const d of [0, 5, 6, 30, 200]) expect(tagAlpha("everyone", d, false, 1), `everyone, ${d} squares`).toBe(1);
    expect(tagAlpha("everyone", 30, false, 0.25)).toBe(0.25);
    expect(tagAlpha("everyone", 30, false, 0)).toBe(0);
  });
});

describe("the Names setting (Town settings, under Chat): Near you (the default) and Everyone", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (store: Map<string, string>) => vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });

  it("is named in Eric's words, in this order, with the line under it", () => {
    expect(NAMES_MODES).toEqual(["near", "everyone"]);
    expect(NAMES_LABEL).toBe("Names");
    expect(NAMES_CHOICE).toEqual({ near: "Near you", everyone: "Everyone" });
    expect(namesNote()).toBe("Near you: names show within 5 squares of you.");
    expect(namesNote(7)).toBe("Near you: names show within 7 squares of you.");
  });

  it("is near to begin with and remembered on this device once set: a reload asks again and gets the one stored; a stranger or a storage that won't answer is near", async () => {
    const store = new Map<string, string>();
    stub(store);
    vi.resetModules();
    const first = await import("../src/town/tags.ts");
    expect(first.namesMode()).toBe("near");
    const seen = vi.fn();
    const off = first.onNamesMode(seen);
    first.setNamesMode("everyone");
    first.setNamesMode("everyone"); // (nothing changed: nobody is told twice)
    expect(first.namesMode()).toBe("everyone");
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.get(NAMES_KEY)).toBe("everyone");
    off();
    first.setNamesMode("near");
    expect(seen).toHaveBeenCalledTimes(1); // (let go: not told)
    first.setNamesMode("everyone");
    // A reload: the page asks again and gets the one stored.
    vi.resetModules();
    const again = await import("../src/town/tags.ts");
    expect(again.namesMode()).toBe("everyone");
    store.set(NAMES_KEY, "nobody");
    expect(loadNamesMode()).toBe("near");
    store.delete(NAMES_KEY);
    expect(loadNamesMode()).toBe("near");
    for (const m of NAMES_MODES) {
      saveNamesMode(m);
      expect(loadNamesMode()).toBe(m);
    }
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadNamesMode()).toBe("near");
    expect(() => saveNamesMode("everyone")).not.toThrow();
    // ... and it still works, for as long as the page lives.
    vi.resetModules();
    const blocked = await import("../src/town/tags.ts");
    blocked.setNamesMode("everyone");
    expect(blocked.namesMode()).toBe("everyone");
  });

  it("the module's setting tells whoever shows it when it changes", () => {
    setNamesMode("near");
    const seen = vi.fn();
    const off = onNamesMode(seen);
    setNamesMode("everyone");
    expect(namesMode()).toBe("everyone");
    expect(seen).toHaveBeenCalledTimes(1);
    setNamesMode("near");
    off();
  });
});

describe("the kinds of tag: yours gold, a pawn's white, a boss's sidekick's blue with white text", () => {
  /** WCAG's relative luminance and contrast ratio of two sRGB colors (0 to 255). */
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (c: readonly number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
  const ratio = (a: readonly number[], b: readonly number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const parse = (css: string): { rgb: number[]; a: number } => {
    const m = css.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/) ?? css.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) throw new Error(css);
    const hex = css.startsWith("#");
    return { rgb: [1, 2, 3].map((i) => (hex ? parseInt(m[i]!, 16) : Number(m[i]))), a: hex || m[4] === undefined ? 1 : Number(m[4]) };
  };
  const over = (c: { rgb: number[]; a: number }, bg: readonly number[]) => c.rgb.map((v, i) => v * c.a + bg[i]! * (1 - c.a));

  it("keeps white and gold exactly as they were (the drawing is pixel for pixel the same: the cache's #399 check)", () => {
    expect(TAG_STYLE.bot).toEqual({ pill: "rgba(255,255,255,.92)", ink: "#1f2530" });
    expect(TAG_STYLE.you).toEqual({ pill: "rgba(255,215,106,.96)", ink: "#1f2530" });
  });

  it("makes a sidekick's a blue pill with white text", () => {
    const pill = parse(TAG_STYLE.sidekick.pill);
    expect(TAG_STYLE.sidekick.ink.toLowerCase()).toBe("#ffffff");
    const [r, g, b] = pill.rgb as [number, number, number];
    expect(b, "blue").toBeGreaterThan(r + 80);
    expect(b).toBeGreaterThan(g + 80);
  });

  it("reads: white text on the blue pill is at least 4.5:1, over the lightest thing it could lie on (a white sky) and the darkest", () => {
    const pill = parse(TAG_STYLE.sidekick.pill);
    for (const bg of [[255, 255, 255], [0, 0, 0], [232, 200, 150], [106, 168, 79], [9, 18, 40]]) {
      expect(ratio([255, 255, 255], over(pill, bg)), `white on the pill over ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // And the dark ink the pawns' pills carry would not have: the blue is for white text.
    expect(ratio(parse(TAG_STYLE.bot.ink).rgb, over(parse(TAG_STYLE.sidekick.pill), [255, 255, 255]))).toBeLessThan(4.5);
  });

  it("tells the three kinds apart", () => {
    const kinds: TagKind[] = ["you", "bot", "sidekick"];
    expect(new Set(kinds.map((k) => TAG_STYLE[k].pill)).size).toBe(3);
  });
});

describe("the tag cache is keyed by name, size and kind (not a gold-or-not flag)", () => {
  type Art = { id: string; s: number; kind: TagKind; used: number };
  const art = (id: string, s: number, kind: TagKind, used = 0): Art => ({ id, s, kind, used });

  it("holds one drawing per name, size and kind: a sidekick's blue, a pawn's white and yours gold are three of the same name at the same size", () => {
    const c = new TagCache<Art>(64);
    const bot = art("bot", 11, "bot");
    const side = art("sidekick", 11, "sidekick");
    const you = art("you", 11, "you");
    for (const a of [bot, side, you]) c.add("Squirt", a);
    expect(c.n).toBe(3);
    expect(c.find("Squirt", 11, "bot")).toBe(bot);
    expect(c.find("Squirt", 11, "sidekick")).toBe(side);
    expect(c.find("Squirt", 11, "you")).toBe(you);
    expect(c.find("Squirt", 10, "bot"), "another size is another drawing").toBeUndefined();
    expect(c.find("Tex", 11, "bot"), "another name too").toBeUndefined();
    // Asking for one kind never hands back another's (a white tag for a sidekick, or a blue one for a pawn).
    c.clear();
    c.add("Squirt", bot);
    expect(c.find("Squirt", 11, "sidekick")).toBeUndefined();
    expect(c.find("Squirt", 11, "you")).toBeUndefined();
  });

  it("lets go of the least lately used drawing when full, never one drawn this frame or the last, and hands it back to reuse", () => {
    const c = new TagCache<Art>(3);
    c.add("A", art("A", 11, "bot", 5));
    c.add("B", art("B", 11, "sidekick", 2));
    c.add("C", art("C", 11, "you", 7));
    expect(c.n).toBe(3);
    expect(c.evict(10)!.id, "the least lately used: B").toBe("B");
    expect(c.n).toBe(2);
    expect(c.find("B", 11, "sidekick")).toBeUndefined();
    // Not full: nothing is let go.
    expect(c.evict(10)).toBeNull();
    c.add("D", art("D", 11, "bot", 9));
    // Full again, but its least lately used (A, frame 5) is the frame before the next (6): it may still be drawn, so nothing goes.
    expect(c.evict(6)).toBeNull();
    expect(c.n, "the cache grows past its max rather than losing one in use").toBe(3);
    expect(c.evict(7)!.id).toBe("A");
    expect(c.n).toBe(2);
    c.clear();
    expect(c.n).toBe(0);
    expect(c.find("A", 11, "bot")).toBeUndefined();
  });

  it("keeps a name's other drawings when one of its kinds is let go", () => {
    const c = new TagCache<Art>(2);
    c.add("Squirt", art("old-white", 11, "bot", 1));
    c.add("Squirt", art("new-blue", 11, "sidekick", 50));
    expect(c.evict(60)!.id).toBe("old-white");
    expect(c.find("Squirt", 11, "sidekick")!.id).toBe("new-blue");
    expect(c.find("Squirt", 11, "bot")).toBeUndefined();
  });
});
