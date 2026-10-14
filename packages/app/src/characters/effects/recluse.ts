/**
 * The Hidden Boss's red book (characters/recluse.ts), drawn here so that both his figure and the board can use it: a
 * big red cloth hardcover of his rival's games, a faint gold band at each end of its spine, a thin gold border on its
 * cover and one gold-stamped letter, a Cyrillic "Ш" (for "шахматы", chess): no other marking, no names.
 *
 * `RECLUSE_BOOK` is the book alone as an effect sprite, one board square across (32 x 32, as the other one-square
 * effects). ART ONLY: it is not in EFFECT_SPRITES, and nothing plays it now (the phase change flew it to the board
 * until Oct 14, 2026; since its rework he carries his own book down, so only one is ever on screen). Its animations: `fly` (spinning as it travels), `slam` (dropping flat onto a square: dust and a shockwave
 * ring), `flip` (lying open, its pages flipping fast), `close` (snapping shut), and `idle` (lying closed).
 */
import { canvas, inEllipse, inPoly, roundLight, toGrid, type Canvas } from "../paint.ts";
import { lazyParts, type Anim, type Character, type Part, type Speck } from "../sprite.ts";
import { SQUARE, type Pt } from "./common.ts";

export const BOOK_PALETTE: Record<string, string> = {
  k: "#1a1420", // outline
  "1": "#4a0d12", // red cloth, dark to light
  "2": "#7a161c",
  "3": "#a42228",
  "4": "#c9403c",
  "5": "#f1e6cc", // pages: light, shade, the lines of moves
  "6": "#cdbd97",
  "7": "#8c7f68",
  y: "#ffd451", // the spine's gold bands: light, mid, shade
  Y: "#e6ac2a",
  O: "#a8700f",
  A: "#d9cfb8", // page dust: light, dark
  C: "#8d8370",
  W: "#e8e2d4", // the shockwave ring: bright, faint
  K: "#8f8a80",
  Q: "#0c0d11", // its shadow
};

const ramp = (r: string, l: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(l * r.length)))]!;
function fill(cv: Canvas, inside: (x: number, y: number) => boolean, key: (x: number, y: number) => string): void {
  for (let y = 0; y < cv.length; y++) for (let x = 0; x < cv[0]!.length; x++) if (inside(x, y)) cv[y]![x] = key(x, y);
}

/** The book's states, as parts: closed (front cover to us), flat (closed, lying, the page edge to us), opening, open. */
export type BookPart = "closed" | "flat" | "half" | "read" | "open" | "flutter1" | "flutter2" | "flutter3";
export const BOOK_SIZE: Record<BookPart, Pt> = { closed: [15, 21], flat: [21, 8], half: [21, 18], read: [27, 9], open: [25, 17], flutter1: [25, 17], flutter2: [25, 17], flutter3: [25, 17] };

/**
 * The one marking on the book (Eric, Oct 14): a bold gold-stamped Cyrillic "Ш" (the first letter of "шахматы", chess)
 * centred on its front cover, 5 x 5, lit on its top left. No other lettering, no names.
 */
const LETTER = ["y.Y.Y", "Y.Y.Y", "Y.Y.Y", "Y.Y.Y", "YYYYO"];

/**
 * Closed, its front cover to us (the letter in a thin gold border), turned `deg` degrees (clockwise) about its middle: the spine down its left with its
 * gold bands, a blind-stamped frame on the cover, the page block's edge on its right and foot. Square frame (25 x 25)
 * when turned, 15 x 21 upright.
 */
export function bookTurned(deg: number): Part {
  const a = (deg * Math.PI) / 180;
  const upright = deg % 360 === 0;
  const [w, h] = upright ? [15, 21] : [25, 25];
  const cv = canvas(w, h);
  const cx = w / 2;
  const cy = h / 2;
  // Each pixel back into the book's own space (u across 0..15, v down 0..21).
  const uv = (x: number, y: number): Pt => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return [dx * Math.cos(a) + dy * Math.sin(a) + 7.5, -dx * Math.sin(a) + dy * Math.cos(a) + 10.5];
  };
  const light = roundLight(5, 4, 12, 18, 0.12);
  fill(
    cv,
    (x, y) => {
      const [u, v] = uv(x, y);
      return u >= 0 && u < 15 && v >= 0 && v < 21;
    },
    (x, y) => {
      const [U, V] = uv(x, y);
      const u = Math.floor(U);
      const v = Math.floor(V);
      if (u <= 2) return (v === 3 || v === 17) && u < 2 ? "Y" : (v === 3 || v === 17) ? "O" : u === 2 ? "1" : ramp("12", light(u, v));
      if (u === 14 || v === 20) return "2";
      // The thin gold border, and the gold-stamped letter in the middle of the cover.
      if ((u === 4 || u === 12) && v >= 2 && v <= 18) return "O";
      if ((v === 2 || v === 18) && u >= 4 && u <= 12) return "O";
      const g = LETTER[v - 8]?.[u - 6];
      if (g && g !== ".") return g;
      return ramp("234", light(u, v));
    },
  );
  return { grid: toGrid(cv) };
}
/** Closed and lying flat (or held flat in front of him): its top cover lit, the page block's edge towards us. */
export function bookFlat(): Part {
  const cv = canvas(21, 8);
  fill(cv, inPoly([[2, 0.2], [20.8, 0.2], [19.6, 5], [0.2, 5]]), (x, y) => (x < 3 ? "1" : ramp("234", 0.75 - x / 30 - y / 12)));
  "5555555555555555666".split("").forEach((k, i) => (cv[5]![1 + i] = k));
  "2222222222222222221".split("").forEach((k, i) => (cv[6]![1 + i] = k));
  cv[1]![1] = "Y";
  cv[2]![1] = "O";
  // The cover's letter, foreshortened (seen at a slant): the same "Ш", squat.
  ["Y.Y.Y", "YYYYO"].forEach((r, y) => [...r].forEach((k, x) => k !== "." && (cv[2 + y]![9 + x] = k)));
  return { grid: toGrid(cv) };
}
/** Opening: its right page lies open, the front cover standing straight up from the spine, swinging over. */
export function bookHalf(): Part {
  const cv = canvas(21, 18);
  fill(cv, inPoly([[10, 10.4], [20.8, 10.4], [19.6, 15.4], [10, 15.4]]), (x, y) => (y > 14.4 ? "6" : (y === 12 || y === 14) && x > 11 && x < 18 && (x + y) % 5 ? "7" : "5"));
  for (let x = 10; x <= 20; x++) [cv[15]![x], cv[16]![x]] = ["2", "1"];
  fill(cv, inPoly([[7, 0.2], [10.8, 0.2], [10.8, 15], [7, 15]]), (x) => (x < 8 ? "2" : x > 9.5 ? "1" : "3"));
  for (let x = 3; x <= 6; x++) [cv[14]![x], cv[15]![x], cv[16]![x]] = ["5", "6", "2"];
  return { grid: toGrid(cv) };
}
/** Open flat, seen from above and in front: two pages of moves in lines, the gutter, the red covers under them. */
export function bookRead(): Part {
  const cv = canvas(27, 9);
  fill(cv, inPoly([[1, 0.2], [26, 0.2], [26.8, 7.6], [0.2, 7.6]]), () => "2");
  fill(cv, inPoly([[2, 0.2], [13, 0.6], [13, 6.4], [1.4, 6.4]]), (x, y) => (x > 11 ? "6" : (y === 2 || y === 4) && x > 2 && (x * 7 + y) % 6 ? "7" : "5"));
  fill(cv, inPoly([[14, 0.6], [25, 0.2], [25.6, 6.4], [14, 6.4]]), (x, y) => (x < 15 ? "6" : (y === 2 || y === 4) && x < 24 && (x * 5 + y) % 6 ? "7" : "5"));
  for (let x = 1; x <= 25; x++) cv[8]![x] = "1";
  return { grid: toGrid(cv) };
}
/**
 * Open and facing us (raised like a spell book, or lying open on a square seen from above): two tall pages of moves,
 * the gutter, the covers round them. `flutter` (1 to 3) lifts a page off the right side and over: standing, past the
 * middle, settling to the left. `cover` (1 to 3): closing instead: the front cover (and the pages under it) lifts off
 * the left, the square showing where it lay: its inside up, then edge on, then its outside coming down over the right.
 */
export function bookOpen(flutter: 0 | 1 | 2 | 3, cover: 0 | 1 | 2 | 3 = 0): Part {
  const cv = canvas(25, 17);
  const page = (x0: number, x1: number) =>
    fill(cv, inPoly([[x0, 1.6], [x1, 1.2], [x1, 15.2], [x0, 15.6]]), (x, y) => {
      const edge = x0 < 12 ? x > 10.5 : x < 13.5;
      return edge ? "6" : y % 3 === 1 && y > 2 && y < 14 && (x * 7 + y * 3) % 5 ? "7" : "5";
    });
  // The covers under the pages (only the back one, on the right, while it closes).
  fill(cv, inPoly(cover ? [[12.5, 0.2], [24.8, 1], [24.8, 16.8], [12.5, 16]] : [[0.2, 1], [12.5, 0.2], [24.8, 1], [24.8, 16.8], [12.5, 16], [0.2, 16.8]]), (x) => (x < 1 || x > 23.5 ? "1" : "2"));
  if (!cover) page(1.6, 12);
  page(13, 23.4);
  for (let y = 1; y <= 14; y++) cv[y]![12] = "1";
  const leaf: Record<1 | 2 | 3, Pt[]> = {
    1: [[13, 15.4], [13, 2], [19.6, -0.2], [19.6, 13.6]],
    2: [[12.4, 15.4], [12.4, 1.4], [14.6, -1], [14.6, 14.6]],
    3: [[12, 15.4], [5.6, 13.6], [5.6, -0.2], [12, 1.4]],
  };
  if (flutter) fill(cv, inPoly(leaf[flutter]), (x) => (flutter === 2 ? "5" : x % 3 ? "5" : "6"));
  if (cover) {
    // The front cover, lifting from the left (its pages' cream inside up), standing edge on, falling over the right.
    const c: Record<1 | 2 | 3, Pt[]> = {
      1: [[12, 15.6], [4.6, 13.4], [4.6, -0.4], [12, 1.2]],
      2: [[11.6, 15.8], [11.6, 0.2], [14.2, -1], [14.2, 15]],
      3: [[12.6, 16.4], [12.6, 0.6], [21.6, -0.4], [21.6, 14.8]],
    };
    fill(cv, inPoly(c[cover]), (x, y) => (cover === 1 ? (x < 6 || y < 1 || y > 14 ? "2" : "5") : cover === 2 ? (x < 13 ? "3" : "1") : x > 20.6 || y < 1 ? "2" : "3"));
  }
  return { grid: toGrid(cv) };
}

// ---- The effect sprite: the book alone on a square (32 x 32 frame pixels).

const { parts: PARTS, add } = lazyParts();
const TURNS = [0, 45, 90, 135, 180, 225, 270, 315];
for (const d of TURNS) add(`spin:${d}`, () => bookTurned(d));
add("flat", bookFlat);
add("open", () => bookOpen(0));
for (const f of [1, 2, 3] as const) {
  add(`flutter${f}`, () => bookOpen(f));
  add(`cover${f}`, () => bookOpen(0, f));
}
/** Seen from above, closed: the front cover over the right half of where it lay open. */
add("shut", () => bookTurned(0));
const shadowOf = (rx: number, ry: number): Part => {
  const cv = canvas(Math.ceil(rx * 2), Math.ceil(ry * 2));
  fill(cv, inEllipse(rx, ry, rx, ry), () => "Q");
  return { grid: toGrid(cv), outline: false };
};
for (const r of [6, 8, 10, 12]) add(`shadow:${r}`, () => shadowOf(r, r * 0.4));
/** The shockwave: a thin ring round the square's middle, `r` across. */
const ring = (r: number, k: string): Part => {
  const n = Math.ceil(r * 2) + 2;
  const cv = canvas(n, Math.ceil(r * 0.9) + 2);
  const c = n / 2;
  const cy = cv.length / 2;
  fill(cv, (x, y) => {
    const d = Math.hypot((x + 0.5 - c) / r, (y + 0.5 - cy) / (r * 0.42));
    return d <= 1 && d > 1 - 1.6 / r;
  }, () => k);
  return { grid: toGrid(cv), outline: false };
};
for (const r of [9, 12, 15]) add(`ring:${r}`, () => ring(r, r < 15 ? "W" : "K"));

/** A part placed by its middle on the square's middle (16, 16), nudged by (dx, dy). */
const mid = (part: string, w: number, h: number, dx = 0, dy = 0) => ({ part, x: Math.round(16 - w / 2 + dx), y: Math.round(16 - h / 2 + dy) });
/** Dust puffing out round the book (never over it: `cx` is the book's middle), `t` frames on. */
const dust = (t: number, n = 12, cx = 16): Speck[] =>
  Array.from({ length: n }, (_, i): Speck[] => {
    const ang = (i / n) * Math.PI * 2 + 0.3;
    const d = 9 + t * 2.4;
    if (t > 2 && i % 2) return [];
    const x = Math.round(16 + Math.cos(ang) * d);
    const y = Math.round(18 + Math.sin(ang) * d * 0.45 - t * 0.6);
    const onBook = Math.abs(x - cx) <= 8 && y >= 5 && y <= 27;
    return x >= 1 && y >= 1 && x <= 30 && y <= 30 && !onBook ? [[x, y, i % 3 ? "A" : "C"]] : [];
  }).flat();

const fx: Record<string, Anim> = {
  /** Lying closed on its square. */
  idle: { loop: true, frames: [{ ms: 400, layers: [mid("spin:0", 15, 21)] }] },
  /** In flight: spinning a turn every 8 frames, its shadow under it. Loops (the board moves it along). */
  fly: {
    loop: true,
    frames: TURNS.map((d) => ({ ms: 50, layers: [mid("shadow:6", 12, 5, 0, 12), mid(`spin:${d}`, d ? 25 : 15, d ? 25 : 21, 0, -2)] })),
  },
  /** Slamming down flat: dropping from above, its shadow growing, hitting the square (cue `slam`), dust and a ring. */
  slam: {
    loop: false,
    frames: [
      { ms: 70, layers: [mid("shadow:6", 12, 5, 0, 8), mid("spin:0", 15, 21, 0, -4)] },
      { ms: 50, layers: [mid("shadow:8", 16, 7, 0, 7), mid("spin:0", 15, 21, 0, -2)] },
      { ms: 70, layers: [mid("ring:9", 20, 10, 0, 6), mid("spin:0", 15, 21)], cue: "slam", shake: [0, 1], specks: dust(0) },
      { ms: 70, layers: [mid("ring:12", 26, 12, 0, 6), mid("spin:0", 15, 21)], specks: dust(1) },
      { ms: 80, layers: [mid("ring:15", 32, 15, 0, 6), mid("spin:0", 15, 21)], specks: dust(2) },
      { ms: 300, layers: [mid("spin:0", 15, 21)], specks: dust(3) },
    ],
  },
  /** Lying open, its pages flipping fast (loop). */
  flip: {
    loop: true,
    frames: (["flutter1", "flutter2", "flutter3", "open"] as const).map((p) => ({ ms: 55, layers: [mid(p, 25, 17)] })),
  },
  /** Open, then snapping shut (cue `snap`): the front cover swings over from the left, a puff of page dust. */
  close: {
    loop: false,
    frames: [
      { ms: 120, layers: [mid("open", 25, 17)] },
      { ms: 60, layers: [mid("cover1", 25, 17)] },
      { ms: 50, layers: [mid("cover2", 25, 17)] },
      { ms: 50, layers: [mid("cover3", 25, 17)] },
      { ms: 90, layers: [mid("spin:0", 15, 21, 6)], cue: "snap", specks: dust(0, 8, 22) },
      { ms: 90, layers: [mid("spin:0", 15, 21, 6)], specks: dust(1, 8, 22) },
      { ms: 300, layers: [mid("spin:0", 15, 21, 6)] },
    ],
  },
};

export const RECLUSE_BOOK: Character = {
  id: "recluse-book",
  name: "Hidden Boss: the red book",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: BOOK_PALETTE,
  parts: PARTS,
  anims: fx,
};
