/** The icon builder's drawing, without the UI: pixel values, the paint bucket and the undo history. */

/** Player icons are 48 × 48 pixel drawings, saved as a small PNG. */
export const ICON_SIZE = 48;
/** How many steps Undo can go back. Older steps are dropped, so the history never grows past this. */
export const UNDO_STEPS = 40;

/** One 0xAABBGGRR per pixel (little endian, as ImageData lays it out), ICON_SIZE × ICON_SIZE. */
export type Pixels = Uint32Array;

/**
 * A "#rrggbb" colour as a pixel value. Unsigned (`>>> 0`), like the values a Uint32Array hands back: a signed value
 * never compares equal to what's stored, which is what made a fill over its own colour run until out of memory.
 */
export const toRgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
};
export const toHex = (v: number) => "#" + [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff].map((c) => c.toString(16).padStart(2, "0")).join("");

/**
 * The paint bucket: gives the area of (x, y)'s colour (joined edge to edge) the colour `value`. Iterative, and each
 * pixel is queued at most once, so it ends within 48 × 48 steps whatever the drawing. Returns how many pixels
 * changed: 0 when (x, y) is off the canvas or already that colour.
 */
export function floodFill(p: Pixels, x: number, y: number, value: number): number {
  const v = value >>> 0;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= ICON_SIZE || y >= ICON_SIZE) return 0;
  const start = y * ICON_SIZE + x;
  const target = p[start]!;
  if (target === v) return 0;
  const seen = new Uint8Array(ICON_SIZE * ICON_SIZE);
  const queue = new Uint16Array(ICON_SIZE * ICON_SIZE);
  let top = 0;
  const visit = (i: number) => {
    if (seen[i] || p[i] !== target) return;
    seen[i] = 1;
    queue[top++] = i;
  };
  visit(start);
  let changed = 0;
  while (top) {
    const i = queue[--top]!;
    p[i] = v;
    changed++;
    const cx = i % ICON_SIZE;
    if (cx > 0) visit(i - 1);
    if (cx < ICON_SIZE - 1) visit(i + 1);
    if (i >= ICON_SIZE) visit(i - ICON_SIZE);
    if (i < ICON_SIZE * (ICON_SIZE - 1)) visit(i + ICON_SIZE);
  }
  return changed;
}

/** Keeps an undo step, dropping the oldest beyond UNDO_STEPS. */
export function remember(history: Pixels[], step: Pixels) {
  history.push(step);
  if (history.length > UNDO_STEPS) history.splice(0, history.length - UNDO_STEPS);
}
