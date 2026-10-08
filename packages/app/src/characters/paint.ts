/**
 * Helpers for drawing a part's grid from shapes, for organic parts (a cape, a plume) where typing every pixel is
 * slow. Everything lands on whole pixels with a single palette key: no smoothing. Hard-surface parts (a visor, a
 * pauldron) are better typed by hand.
 */
import type { Grid } from "./sprite.ts";

export type Canvas = string[][];

export const canvas = (w: number, h: number): Canvas => Array.from({ length: h }, () => Array<string>(w).fill("."));

/** Starts a canvas from typed rows (so shapes can be painted over a hand-drawn base). */
export const fromGrid = (grid: Grid, w?: number, h?: number): Canvas => {
  const W = w ?? Math.max(...grid.map((r) => r.length));
  return Array.from({ length: h ?? grid.length }, (_, y) => Array.from({ length: W }, (_, x) => grid[y]?.[x] ?? "."));
};

export const toGrid = (cv: Canvas): Grid => cv.map((r) => r.join(""));

const set = (cv: Canvas, x: number, y: number, k: string) => {
  if (y >= 0 && y < cv.length && x >= 0 && x < cv[0]!.length) cv[y]![x] = k;
};

/** Fills a polygon (pixel centres inside it). */
export function poly(cv: Canvas, pts: readonly (readonly [number, number])[], k: string): void {
  for (let y = 0; y < cv.length; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    pts.forEach(([x0, y0], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      if (y0 <= yc !== y1 <= yc) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    });
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++) set(cv, x, y, k);
  }
}

/** A one-pixel line (Bresenham). */
export function line(cv: Canvas, x0: number, y0: number, x1: number, y1: number, k: string): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(cv, x0, y0, k);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** A filled ellipse. */
export function ellipse(cv: Canvas, cx: number, cy: number, rx: number, ry: number, k: string): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) set(cv, x, y, k);
    }
}

/**
 * Recolours the pixels of `from` (any key if "*") that sit on an edge facing (dx, dy): their neighbour that way is
 * empty. Light from the top left: `edge(cv, 0, -1, "*", "p")` puts a highlight along every top edge.
 */
export function edge(cv: Canvas, dx: number, dy: number, from: string, to: string, depth = 1): void {
  const src = cv.map((r) => [...r]);
  const empty = (x: number, y: number) => (src[y]?.[x] ?? ".") === ".";
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      const k = src[y]![x]!;
      if (k === "." || (from !== "*" && k !== from)) continue;
      for (let d = 1; d <= depth; d++) if (empty(x + dx * d, y + dy * d)) cv[y]![x] = to;
    }
}

/** Recolours every `from` pixel inside a polygon to `to` (a fold, a shadow band). */
export function tint(cv: Canvas, pts: readonly (readonly [number, number])[], from: string, to: string): void {
  const mask = canvas(cv[0]!.length, cv.length);
  poly(mask, pts, "#");
  mask.forEach((r, y) => r.forEach((m, x) => m === "#" && (from === "*" ? cv[y]![x] !== "." : cv[y]![x] === from) && (cv[y]![x] = to)));
}

/** Inside tests for `shade`. */
export const inEllipse = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
export function inPoly(pts: readonly (readonly [number, number])[]): (x: number, y: number) => boolean {
  return (x, y) => {
    const xc = x + 0.5;
    const yc = y + 0.5;
    let inside = false;
    pts.forEach(([x0, y0], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      if (y0 <= yc !== y1 <= yc && xc < x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
    });
    return inside;
  };
}

/**
 * Fills a shape with a ramp of keys, dark to light ("abcdef"), by a light value per pixel (0 dark to 1 light):
 * banded, never blended.
 */
export function shade(cv: Canvas, inside: (x: number, y: number) => boolean, ramp: string, light: (x: number, y: number) => number): void {
  for (let y = 0; y < cv.length; y++)
    for (let x = 0; x < cv[0]!.length; x++) {
      if (!inside(x, y)) continue;
      const l = Math.max(0, Math.min(0.999, light(x, y)));
      cv[y]![x] = ramp[Math.floor(l * ramp.length)]!;
    }
}

/** Light from the top left on a round surface centred at (cx, cy) with radii (rx, ry). */
export const roundLight = (cx: number, cy: number, rx: number, ry: number, bias = 0) => (x: number, y: number) => {
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  return 0.5 + bias - 0.42 * nx - 0.5 * ny;
};
