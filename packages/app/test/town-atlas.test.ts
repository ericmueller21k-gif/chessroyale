import { describe, expect, it } from "vitest";
import { countPages, giveFree, takeFree, type FreePlace } from "../src/town/paint-gl.ts";

/**
 * The town's loading screen (Nov 11, docs/decisions/2026-11-11-town-loading.md): paint-gl.ts `kept` makes the atlas once, as deep as
 * the kept pictures need (`countPages`, the same shelves `place` fills), so nothing is copied as it grows and no page is started again.
 */
describe("the atlas's pages for the kept pictures (countPages)", () => {
  it("counts the 2048 px pages shelves of pictures take, padding included", () => {
    expect(countPages([])).toBe(0);
    expect(countPages([[100, 100]])).toBe(1);
    // Two half-page-tall pictures fill a page; a third starts the next.
    expect(countPages([[2048, 1024], [2048, 1024]])).toBe(1);
    expect(countPages([[2048, 1024], [2048, 1024], [2048, 1024]])).toBe(2);
    // A row of 16 pictures 128 wide fills a shelf exactly; 16 shelves of 128 fill a page.
    expect(countPages(Array.from({ length: 256 }, () => [128, 128] as const))).toBe(1);
    expect(countPages(Array.from({ length: 257 }, () => [128, 128] as const))).toBe(2);
  });
  it("tallest first (as `kept` sorts them) packs at least as tight as any other order", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const sizes = Array.from({ length: 3000 }, () => [8 + Math.floor(rnd() * 300), 8 + Math.floor(rnd() * 300)] as const);
    const sorted = [...sizes].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const area = sizes.reduce((n, [w, h]) => n + w * h, 0);
    const pages = countPages(sorted);
    expect(pages).toBeLessThanOrEqual(countPages(sizes));
    // (Shelves sorted tallest first fill at least 80% of their pages.)
    expect(area / (pages * 2048 * 2048)).toBeGreaterThan(0.8);
  });
});

/**
 * (Nov 28, the town's structure, phase 2) A picture let go leaves its place free for the next that fits (paint-gl.ts `free`, `shelf`):
 * the pages of what the device makes (the text's, the looks') are never started again, so room comes back only this way.
 */
describe("the atlas's freed places (giveFree, takeFree)", () => {
  it("a place given back is taken by the next picture that fits its shelf: as tall, or up to half as tall again, and no wider", () => {
    const free: FreePlace[] = [];
    giveFree(free, 100, 40, 170, 236);
    expect(takeFree(free, 171, 236), "a wider picture doesn't fit").toBeNull();
    expect(takeFree(free, 170, 240), "nor a taller one").toBeNull();
    expect(takeFree(free, 60, 100), "nor one so short the shelf would waste more than half its height").toBeNull();
    expect(takeFree(free, 170, 236)).toEqual({ x: 100, y: 40, h: 236 });
    expect(free, "taken whole").toEqual([]);
    // A narrower one takes its left end; the rest stays free for the next.
    giveFree(free, 100, 40, 170, 236);
    expect(takeFree(free, 120, 200)).toEqual({ x: 100, y: 40, h: 236 });
    expect(free).toEqual([{ x: 220, y: 40, w: 50, h: 236 }]);
    expect(takeFree(free, 50, 236)).toEqual({ x: 220, y: 40, h: 236 });
    expect(free).toEqual([]);
    // (What's left narrower than a picture's padding is dropped.)
    giveFree(free, 0, 0, 104, 50);
    expect(takeFree(free, 100, 50)).toEqual({ x: 0, y: 0, h: 50 });
    expect(free).toEqual([]);
  });

  it("places given back side by side on a shelf join into one (a row of tags let go is room for a bubble); another shelf's stay apart", () => {
    const free: FreePlace[] = [];
    giveFree(free, 0, 0, 100, 60);
    giveFree(free, 200, 0, 100, 60);
    giveFree(free, 100, 62, 100, 60);
    expect(free.length, "none of the three touch on one shelf").toBe(3);
    expect(takeFree(free, 250, 60), "no room for a wide one yet").toBeNull();
    // The one between the first two: all three of that shelf are one place.
    giveFree(free, 100, 0, 100, 60);
    expect(free).toHaveLength(2);
    expect(free).toContainEqual({ x: 0, y: 0, w: 300, h: 60 });
    expect(free).toContainEqual({ x: 100, y: 62, w: 100, h: 60 });
    expect(takeFree(free, 250, 60)).toEqual({ x: 0, y: 0, h: 60 });
  });

  it("however pictures come and go, no two ever hold the same texels", () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const free: FreePlace[] = [];
    // A shelf of 20 places 100 wide and 60 tall, all taken; then 400 rounds of letting some go and placing others.
    const held: { x: number; w: number }[] = Array.from({ length: 20 }, (_, i) => ({ x: i * 100, w: 100 }));
    for (let round = 0; round < 400; round++) {
      if (held.length && rnd() < 0.55) {
        const [gone] = held.splice(Math.floor(rnd() * held.length), 1);
        giveFree(free, gone!.x, 0, gone!.w, 60);
      } else {
        const w = 30 + Math.floor(rnd() * 170);
        const at = takeFree(free, w, 44 + Math.floor(rnd() * 16));
        if (at) held.push({ x: at.x, w });
      }
      const all = [...held, ...free].sort((a, b) => a.x - b.x);
      for (let i = 1; i < all.length; i++) expect(all[i]!.x, `round ${round}: a place starts before the one on its left ends`).toBeGreaterThanOrEqual(all[i - 1]!.x + all[i - 1]!.w);
      expect(all.every((p) => p.x >= 0 && p.x + p.w <= 2000)).toBe(true);
      // (Free places side by side are always joined.)
      const fs = [...free].sort((a, b) => a.x - b.x);
      for (let i = 1; i < fs.length; i++) expect(fs[i]!.x).toBeGreaterThan(fs[i - 1]!.x + fs[i - 1]!.w);
    }
  });
});
