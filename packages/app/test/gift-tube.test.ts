import { beforeAll, describe, expect, it } from "vitest";

/**
 * The Gift-Wrap Tube (Eric, Oct 15, 2026): three stripes repeating its whole length (white, its color, its second
 * color), with no end caps; since Nov 27 drawn as one turn of them (`TUBE_CELL`) repeated a turn apart, so they can scroll up it
 * (its twist). The stripes tile each turn exactly, and each painted set is blotched by the item's blemish, measured on the stripes
 * themselves (the lesson "Purity that didn't match the item").
 */

/** The points of a stripe ("M x y L x y … Z"). */
const parsed = new Map<string, (readonly [number, number])[]>();
function points(d: string) {
  let p = parsed.get(d);
  if (!p) parsed.set(d, (p = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)));
  return p;
}
function inPolygon(d: string, x: number, y: number): boolean {
  const p = points(d);
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!;
    const [xj, yj] = p[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

beforeAll(() => {
  // (Node has no canvas: a stand-in that tests points against the stripes' polygons.)
  Object.assign(globalThis, {
    Path2D: class {
      constructor(public d: string) {}
    },
    document: { createElement: () => ({ getContext: () => ({ isPointInPath: (p: { d: string }, x: number, y: number) => inPolygon(p.d, x, y) }) }) },
  });
});

/** The share of a set of stripes a blotch path covers (its round blotches, nonzero: a hollow one cuts a hole). */
function coverage(path: string, stripes: string[], step = 0.25): number {
  const circles = [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+) [\d.]+ 0 1 ([01])/g)].map((m) => {
    const r = Number(m[3]);
    return { x: Number(m[1]) + r, y: Number(m[2]), r, turn: m[4] === "1" ? -1 : 1 };
  });
  let inside = 0;
  let covered = 0;
  for (let y = step / 2; y < 104; y += step)
    for (let x = 76 + step / 2; x < 88; x += step) {
      if (!stripes.some((d) => inPolygon(d, x, y))) continue;
      inside++;
      if (circles.reduce((w, c) => w + ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r ? c.turn : 0), 0) !== 0) covered++;
    }
  return covered / inside;
}

describe("the gift-wrap tube", () => {
  it("two turns of three stripes tile its cell with no gaps or overlaps; the cells, one after another, cover the tube and a cell past it (its twist's loop, Nov 27)", async () => {
    const { TUBE, TUBE_CELL, TUBE_TILES, TUBE_TWIST } = await import("../src/components/Items.tsx");
    expect(TUBE_CELL).toHaveLength(3);
    // Thinner and longer than the old 12 × 68 tube.
    expect(TUBE.x1 - TUBE.x0).toBeLessThan(12);
    expect(TUBE.bottom - TUBE.top).toBeGreaterThan(68);
    for (const set of TUBE_CELL) expect(set.length).toBeGreaterThanOrEqual(1);
    let samples = 0;
    for (let y = 0.13; y < TUBE_TWIST; y += 0.25)
      for (let x = TUBE.x0 + 0.13; x < TUBE.x1; x += 0.5) {
        samples++;
        const hits = TUBE_CELL.flat().filter((d) => inPolygon(d, x, y)).length;
        expect(hits, `${x}, ${y}`).toBe(1);
      }
    expect(samples).toBeGreaterThan(500);
    // Nothing outside the cell.
    for (const d of TUBE_CELL.flat())
      for (const [x, y] of points(d)) {
        expect(x).toBeGreaterThanOrEqual(TUBE.x0);
        expect(x).toBeLessThanOrEqual(TUBE.x1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(TUBE_TWIST);
      }
    // The cells, a turn apart, from above the tube's top to a turn past its bottom: scrolled up a whole turn, the tube is still covered.
    TUBE_TILES.forEach((y, i) => i && expect(y - TUBE_TILES[i - 1]!).toBeCloseTo(TUBE_TWIST, 5));
    expect(TUBE_TILES[0]!).toBeLessThanOrEqual(TUBE.top);
    expect(TUBE_TILES.at(-1)! + TUBE_TWIST).toBeGreaterThanOrEqual(TUBE.bottom + TUBE_TWIST);
  });

  it("its twist moves exactly one cell (TUBE_TWIST) a loop, so the loop has no seam, and stays still in the crate strip (review of #1012)", async () => {
    const { readFileSync } = await import("node:fs");
    const { TUBE_TWIST } = await import("../src/components/Items.tsx");
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const end = /@keyframes ia-twist\s*\{\s*to\s*\{\s*transform:\s*translateY\((-?[\d.]+)px\)/.exec(css)?.[1];
    expect(Number(end)).toBeCloseTo(-TUBE_TWIST, 5);
    expect(css).toMatch(/\.cox-track \.ia-twist\s*\{\s*animation:\s*none;/);
  });

  it("each painted set of stripes is blotched by the blemish, wherever the blobs fall (on the cell, as it's drawn)", async () => {
    const { TUBE, TUBE_CELL, TUBE_TWIST, blotchPath } = await import("../src/components/Items.tsx");
    const box: [number, number, number, number] = [TUBE.x0, 0, TUBE.x1 - TUBE.x0, TUBE_TWIST];
    for (const set of [TUBE_CELL[1]!, TUBE_CELL[2]!])
      for (const blemish of [10, 35, 60, 90])
        for (let seed = 1; seed <= 12; seed++) expect(Math.abs(coverage(blotchPath(seed * 7919, blemish, set, box), set, 0.1) - blemish / 100)).toBeLessThan(0.04);
  });
});
