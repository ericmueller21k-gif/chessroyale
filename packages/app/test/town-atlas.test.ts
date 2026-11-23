import { describe, expect, it } from "vitest";
import { countPages } from "../src/town/paint-gl.ts";

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
