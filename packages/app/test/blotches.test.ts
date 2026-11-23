import { beforeAll, describe, expect, it } from "vitest";

// A thin item's painted part (the gift-wrap tube, as a plain rectangle), and a stand-in for the canvas the app
// uses to test points against it (Node has none).
const TUBE = "M76 25 H88 V93 H76 Z";
const inTube = (x: number, y: number) => x >= 76 && x <= 88 && y >= 25 && y <= 93;
const BOX: [number, number, number, number] = [74, 22, 16, 76];

beforeAll(() => {
  Object.assign(globalThis, {
    Path2D: class {
      constructor(public d: string) {}
    },
    document: { createElement: () => ({ getContext: () => ({ isPointInPath: (p: { d: string }, x: number, y: number) => p.d === TUBE && inTube(x, y) }) }) },
  });
});

/** The share of the tube a blotch path covers (its round blotches, nonzero: a hollow one cuts a clean hole). */
function coverage(path: string): number {
  const circles = [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+) [\d.]+ 0 1 ([01])/g)].map((m) => {
    const r = Number(m[3]);
    return { x: Number(m[1]) + r, y: Number(m[2]), r, turn: m[4] === "1" ? -1 : 1 };
  });
  let inside = 0;
  let covered = 0;
  for (let y = 25.25; y < 93; y += 0.5)
    for (let x = 76.25; x < 88; x += 0.5) {
      inside++;
      if (circles.reduce((w, c) => w + ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r ? c.turn : 0), 0) !== 0) covered++;
    }
  return covered / inside;
}

describe("blotches", () => {
  it("cover the item itself by its blemish, wherever the blobs fall (a thin tube was all or nothing)", async () => {
    const { blotchPath } = await import("../src/components/Items.tsx");
    for (const blemish of [10, 30, 58.6, 90])
      for (let seed = 1; seed <= 40; seed++) expect(Math.abs(coverage(blotchPath(seed * 7919, blemish, [TUBE], BOX)) - blemish / 100)).toBeLessThan(0.03);
  });

  it("none at 100% purity; at 0% the whole item", async () => {
    const { blotchPath } = await import("../src/components/Items.tsx");
    expect(blotchPath(5, 0, [TUBE], BOX)).toBe("");
    expect(blotchPath(5, 100, [TUBE], BOX)).toBe("M68 16h28v88h-28Z");
  });
});
