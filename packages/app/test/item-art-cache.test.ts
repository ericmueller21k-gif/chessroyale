import { describe, expect, it } from "vitest";
import { LOCKER_ART } from "@chessroyale/core";
import { artKey, artKept, keepArt, keptArt, keptCount } from "../src/components/item-art-cache.ts";

/** The locker's kept drawings (Nov 27, docs/decisions/2026-11-27-locker-speed.md): each copy set on screen gets ids of its own. */
describe("kept item drawings", () => {
  const markup =
    '<defs><linearGradient id="it7-g"></linearGradient><clipPath id="it7-clip-body"><path d="M0 0"></path></clipPath></defs>' +
    '<path fill="url(#it7-g)" clip-path="url(#it7-clip-body)"></path><g style="filter: url(&quot;#it7-g&quot;);"></g>' +
    '<use href="#it7-g"></use><path fill="url(#elsewhere)"></path>';

  it("renames every id the drawing defines and every reference to it, per copy; a reference to anything else stays", () => {
    const key = artKey("beanie", { color: "red", blemish: 12, seed: 3 }, "w");
    expect(artKept(key)).toBe(false);
    expect(keptArt(key)).toBeUndefined();
    keepArt(key, markup);
    const a = keptArt(key)!;
    const b = keptArt(key)!;
    const ids = (m: string) => Array.from(m.matchAll(/\sid="([^"]+)"/g), (x) => x[1]!);
    expect(ids(a)).toHaveLength(2);
    expect(ids(a).some((id) => ids(b).includes(id))).toBe(false);
    // Every reference points at this copy's own ids.
    for (const ref of Array.from(a.matchAll(/(?:url\(#|url\(&quot;#|href="#)([^"&)]+)/g), (x) => x[1]!).filter((r) => r !== "elsewhere")) expect(ids(a)).toContain(ref);
    expect(a).toContain("url(#elsewhere)");
    expect(a).not.toContain("§");
    // Nothing else changes.
    expect(a.replace(/ik\d+_/g, "")).toBe(markup);
  });

  it("keys by item, colors, blemish, seed and side; keeps at most LOCKER_ART.keep, the oldest out first", () => {
    const f = { color: "red", blemish: 12, seed: 3 };
    const keys = new Set([artKey("beanie", f, "w"), artKey("beanie", f, "b"), artKey("scarf", f, "w"), artKey("beanie", { ...f, color2: "gold" }, "w"), artKey("beanie", { ...f, seed: 4 }, "w"), artKey("beanie", { ...f, blemish: 13 }, "w")]);
    expect(keys.size).toBe(6);
    const first = "cap-0";
    for (let i = 0; i <= LOCKER_ART.keep + 5; i++) keepArt(`cap-${i}`, "<path></path>");
    expect(keptCount()).toBe(LOCKER_ART.keep);
    expect(artKept(first)).toBe(false);
    expect(artKept(`cap-${LOCKER_ART.keep + 5}`)).toBe(true);
  });
});
