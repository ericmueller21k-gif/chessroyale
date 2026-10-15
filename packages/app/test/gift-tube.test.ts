import { beforeAll, describe, expect, it } from "vitest";

/**
 * The Gift-Wrap Tube (Eric, Oct 15, 2026): three stripes repeating its whole length (white, its color, its second
 * color), with no end caps. The stripes tile the tube exactly, and each painted set is blotched by the item's blemish,
 * measured on the stripes themselves (the lesson "Purity that didn't match the item").
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
function coverage(path: string, stripes: string[]): number {
  const circles = [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+) [\d.]+ 0 1 ([01])/g)].map((m) => {
    const r = Number(m[3]);
    return { x: Number(m[1]) + r, y: Number(m[2]), r, turn: m[4] === "1" ? -1 : 1 };
  });
  let inside = 0;
  let covered = 0;
  for (let y = 0.125; y < 104; y += 0.25)
    for (let x = 76.125; x < 88; x += 0.25) {
      if (!stripes.some((d) => inPolygon(d, x, y))) continue;
      inside++;
      if (circles.reduce((w, c) => w + ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r ? c.turn : 0), 0) !== 0) covered++;
    }
  return covered / inside;
}

describe("the gift-wrap tube", () => {
  it("three stripes in turn tile the tube from end to end, with no gaps or overlaps", async () => {
    const { TUBE, TUBE_STRIPES } = await import("../src/components/Items.tsx");
    expect(TUBE_STRIPES).toHaveLength(3);
    // Thinner and longer than the old 12 × 68 tube.
    expect(TUBE.x1 - TUBE.x0).toBeLessThan(12);
    expect(TUBE.bottom - TUBE.top).toBeGreaterThan(68);
    for (const set of TUBE_STRIPES) expect(set.length).toBeGreaterThanOrEqual(5);
    let samples = 0;
    for (let y = TUBE.top + 0.13; y < TUBE.bottom; y += 0.5)
      for (let x = TUBE.x0 + 0.13; x < TUBE.x1; x += 0.5) {
        samples++;
        const hits = TUBE_STRIPES.flat().filter((d) => inPolygon(d, x, y)).length;
        expect(hits, `${x}, ${y}`).toBe(1);
      }
    expect(samples).toBeGreaterThan(1000);
    // Nothing outside the tube.
    for (const d of TUBE_STRIPES.flat())
      for (const [x, y] of points(d)) {
        expect(x).toBeGreaterThanOrEqual(TUBE.x0);
        expect(x).toBeLessThanOrEqual(TUBE.x1);
        expect(y).toBeGreaterThanOrEqual(TUBE.top);
        expect(y).toBeLessThanOrEqual(TUBE.bottom);
      }
  });

  it("each painted set of stripes is blotched by the blemish, wherever the blobs fall", async () => {
    const { TUBE_STRIPES, blotchPath } = await import("../src/components/Items.tsx");
    const box: [number, number, number, number] = [78, 16, 8, 84];
    for (const set of [TUBE_STRIPES[1]!, TUBE_STRIPES[2]!])
      for (const blemish of [10, 35, 60, 90])
        for (let seed = 1; seed <= 12; seed++) expect(Math.abs(coverage(blotchPath(seed * 7919, blemish, set, box), set) - blemish / 100)).toBeLessThan(0.04);
  });
});
