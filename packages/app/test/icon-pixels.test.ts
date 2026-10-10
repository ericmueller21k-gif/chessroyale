import { describe, expect, it } from "vitest";
import { ICON_SIZE, UNDO_STEPS, floodFill, remember, toHex, toRgba, type Pixels } from "../src/icon-pixels.ts";

/**
 * The icon builder's paint bucket (Eric, Oct 10): filling an area with the colour it already had never ended, and the
 * tab ran out of memory. The colour was a signed number, the pixels unsigned, so "already that colour" was never true.
 */

const N = ICON_SIZE * ICON_SIZE;
const blank = (): Pixels => new Uint32Array(N);
const at = (p: Pixels, x: number, y: number) => p[y * ICON_SIZE + x]!;
const RED = toRgba("#ed1c24");
const BLUE = toRgba("#00a2e8");

describe("icon pixels", () => {
  it("colours are unsigned, like the pixels that hold them, and round-trip", () => {
    for (const hex of ["#000000", "#ffffff", "#ed1c24", "#c3c3c3", "#0b0b14"]) {
      const v = toRgba(hex);
      expect(v).toBeGreaterThanOrEqual(0);
      const p = blank();
      p[0] = v;
      expect(p[0]).toBe(v);
      expect(toHex(v)).toBe(hex);
    }
  });

  it("fills the whole blank canvas, corner to corner", () => {
    const p = blank();
    expect(floodFill(p, 0, 0, RED)).toBe(N);
    expect(p.every((v) => v === RED)).toBe(true);
  });

  it("filling with the colour already there changes nothing, at once, however often", () => {
    const p = blank();
    floodFill(p, 10, 10, RED);
    for (let i = 0; i < 50; i++) expect(floodFill(p, i % ICON_SIZE, (i * 7) % ICON_SIZE, RED)).toBe(0);
    expect(p.every((v) => v === RED)).toBe(true);
    // (And the colour given as the signed number the old code used.)
    expect(floodFill(p, 3, 3, RED | 0)).toBe(0);
  });

  it("a full canvas refilled in another colour, back and forth", () => {
    const p = blank();
    for (let i = 0; i < 20; i++) {
      const c = i % 2 ? BLUE : RED;
      expect(floodFill(p, 47, 47, c)).toBe(N);
      expect(p.every((v) => v === c)).toBe(true);
    }
  });

  it("stays inside its area: a line splits the canvas, and corners don't connect", () => {
    const p = blank();
    for (let y = 0; y < ICON_SIZE; y++) p[y * ICON_SIZE + 20] = BLUE; // a wall down column 20
    expect(floodFill(p, 0, 0, RED)).toBe(20 * ICON_SIZE);
    expect(at(p, 19, 47)).toBe(RED);
    expect(at(p, 20, 0)).toBe(BLUE);
    expect(at(p, 21, 0)).toBe(0);
    // Diagonal neighbours aren't joined.
    const q = blank();
    q[0] = RED;
    q[ICON_SIZE + 1] = RED;
    expect(floodFill(q, 0, 0, BLUE)).toBe(1);
    expect(at(q, 1, 1)).toBe(RED);
  });

  it("the edges and corners: rows and columns don't wrap round", () => {
    const p = blank();
    p[ICON_SIZE - 1] = RED; // top-right corner
    p[ICON_SIZE] = RED; // the next row's first pixel, its neighbour in memory but not on screen
    expect(floodFill(p, ICON_SIZE - 1, 0, BLUE)).toBe(1);
    expect(at(p, 0, 1)).toBe(RED);
    expect(floodFill(p, ICON_SIZE - 1, ICON_SIZE - 1, BLUE)).toBe(N - 2);
    expect(at(p, 0, 1)).toBe(RED);
  });

  it("a tap off the canvas fills nothing", () => {
    const p = blank();
    for (const [x, y] of [[-1, 0], [0, -1], [ICON_SIZE, 0], [0, ICON_SIZE], [1.5, 2], [NaN, 0]] as const) {
      expect(floodFill(p, x, y, RED)).toBe(0);
    }
    expect(p.every((v) => v === 0)).toBe(true);
  });

  it("a winding area of single pixels, every pixel reached once", () => {
    // A one-pixel-wide snake through the whole canvas: the longest fill there is.
    const p = blank();
    for (let y = 0; y < ICON_SIZE; y += 2) {
      for (let x = 0; x < ICON_SIZE; x++) p[y * ICON_SIZE + x] = BLUE;
      if (y + 1 < ICON_SIZE) p[(y + 1) * ICON_SIZE + ((y / 2) % 2 ? 0 : ICON_SIZE - 1)] = BLUE;
    }
    const snake = p.filter((v) => v === BLUE).length;
    expect(floodFill(p, 0, 0, RED)).toBe(snake);
    expect(p.filter((v) => v === RED).length).toBe(snake);
  });

  it("the undo history keeps the last UNDO_STEPS steps only", () => {
    const history: Pixels[] = [];
    for (let i = 0; i < 500; i++) {
      const step = blank();
      step[0] = i;
      remember(history, step);
    }
    expect(history).toHaveLength(UNDO_STEPS);
    expect(history[0]![0]).toBe(500 - UNDO_STEPS);
    expect(history.at(-1)![0]).toBe(499);
  });
});
