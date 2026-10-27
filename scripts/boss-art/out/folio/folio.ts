/**
 * Folio, the paper crane (a final boss): an origami crane folded from a single page of handwriting. Gentle, graceful,
 * warm: it means its compliments, never gloats, tells the truth. Three-quarter view facing our left (toward the board),
 * hovering just above a soft shadow. Light from the top left: every fold is a flat face in one tone (lit, mid, shaded),
 * a darker crease where faces meet; a short paragraph of blue-black cursive runs along each large face (the page's
 * lines, folded), and three lines on the near wing come and go (palette keys "1", "2", "3", ink at rest). Its marks of
 * its own: gilt leading edges on both wings and the tail's tip (like an old book's page edges), and its vermilion seal,
 * the paper pawn knocked out of it, pressed on the near wing's lit face (and on the page in the entrance and defeat).
 *
 * Rigging: every part is painted from its points (polygons), so a pose is numbers: the wing tips, the neck's tip and the
 * head's fold, the tail's tip, a dent in the near wing (hurt), smeared ink (rattled). The entrance and the defeat use
 * the page's own drawings (a loose sheet, a creased square, the bird base) on the way in and out of the crane.
 */
import { canvas, inPoly, line, toGrid } from "../../../../packages/app/src/characters/paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../../../../packages/app/src/characters/sprite.ts";

const PAPER_B = "#f3e7cc";

export const FOLIO_PALETTE: Record<string, string> = {
  k: "#2b2330", // outline
  A: "#fff7e6", // paper: highlight (never pure white), lit face, mid face, shaded face, crease
  B: PAPER_B,
  C: "#d3bd95",
  D: "#a58e69",
  E: "#76624c",
  i: "#8a93b8", // ink (blue-black): on lit paper, on mid paper, on shaded paper, ink run
  j: "#717898",
  l: "#575c78",
  s: "#b3b9d2",
  x: "#1c1620", // the eye and its brow
  U: "#7486c0", // an ink stroke off the page (the check's underline)
  u: "#8a93b8",
  G: "#f2c14e", // gold: the gilt edge, a light glint, a deep edge, the gilt in shade
  H: "#fff0b4",
  g: "#b8862a",
  o: "#c9973c",
  q: "#e5ad45",
  v: "#d8432a", // the seal: vermilion, pressed deeper
  w: "#a3301e",
  z: "#0c0d11", // ground shadow
  "1": "#8a93b8", // lines of handwriting that fade out and back in on the near wing (ink = there)
  "2": "#8a93b8",
  "3": "#8a93b8",
};

/** Fade levels for a line of ink on lit paper: 0 gone .. 3 full. */
const INK = [PAPER_B, "#d0cbc5", "#adafbf", "#8a93b8"];

type Pt = readonly [number, number];
const add2 = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const unit = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
function hash(a: number, b: number, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---- Painting: faces (polygons) in a tone each, handwriting across them, creases between.

interface Ink {
  /** Origin and direction of the lines of writing. */
  o: Pt;
  d: Pt;
  /** Line spacing (default 4: a stroke, its humps above it, a blank row or two). */
  gap?: number;
  /** How many lines at most (default 4): a short paragraph centered on the face. */
  lines?: number;
  key: string;
  seed: number;
  /** Lines (by index, 0 first) drawn in a key of their own (fading lines). */
  fade?: Readonly<Record<number, string>>;
}
type Seg = readonly [Pt, Pt, string];
interface Face {
  pts: readonly Pt[];
  key: string;
  /** A highlight along the face's top and left edges; a shade along its bottom and right. */
  hi?: string;
  lo?: string;
  ink?: Ink;
  /** Gilt: a 1-px line of gold on the face's edge pixels along these segments. */
  gild?: readonly Seg[];
  /** Folio's seal pressed on the face, centered here (flat: seen tipped, squashed). */
  seal?: { c: Pt; flat?: boolean };
}

/** The seal: a vermilion stamp turned a little, as pressed by hand, the paper pawn knocked out in it. */
const SEAL = [".vvvvv", "vvvBvv", "vvvBvv", "vvBBBv", "vvvvvw", "vvvww."];
const SEAL_FLAT = [".vvBv.", "vvBBBv", "vvvvw."];

/** The pixels of a face's edge along a segment (gilt): on the face, on its outer edge, within a pixel of the segment. */
function gildPixels(pts: readonly Pt[], seg: Seg): [number, number][] {
  const inside = inPoly(pts);
  const [a, b] = seg;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const out: [number, number][] = [];
  const x0 = Math.floor(Math.min(a[0], b[0])) - 2;
  const x1 = Math.ceil(Math.max(a[0], b[0])) + 2;
  const y0 = Math.floor(Math.min(a[1], b[1])) - 2;
  const y1 = Math.ceil(Math.max(a[1], b[1])) + 2;
  for (let Y = y0; Y <= y1; Y++)
    for (let X = x0; X <= x1; X++) {
      if (!inside(X, Y)) continue;
      if (inside(X - 1, Y) && inside(X, Y - 1) && inside(X + 1, Y) && inside(X, Y + 1)) continue;
      const px = X + 0.5 - a[0];
      const py = Y + 0.5 - a[1];
      const t = px * d[0] + py * d[1];
      const dist = Math.abs(px * d[1] - py * d[0]);
      if (t >= -0.5 && t <= len + 0.5 && dist <= 1.25) out.push([X, Y]);
    }
  return out;
}
interface Drawing {
  faces: readonly Face[];
  creases?: readonly (readonly [Pt, Pt, string])[];
  dots?: readonly (readonly [number, number, string])[];
  smear?: boolean;
}

/**
 * One line of cursive, `len` steps long: per step the stroke's lift off its line (0 on it, 1 a hump, 2 a loop's top),
 * or -1 for a blank. Words of 5..14 px: an entry stroke, then rounded humps (up two, down one or two: n, m, u) every
 * 3-4 px, now and then a tall loop (l, h); 2-3 px between words and now and then a longer blank (a sentence's end).
 */
function script(li: number, seed: number, len: number): number[] {
  const a: number[] = [];
  for (let n = 0; a.length < len; n++) {
    const h = hash(li, n, seed + 3);
    const wl = 7 + (h % 11);
    const w: number[] = [0];
    for (let m = 0; w.length < wl; m++) {
      const r = hash(li, n * 17 + m, seed + 5);
      if (r % 7 === 0 && w.length > 1) w.push(1, 2, 2, 1, 0);
      else w.push(1, 1, 0, ...(r % 3 === 0 ? [0] : []));
    }
    a.push(...w);
    const gap = hash(li, n, seed + 6) % 8 === 0 ? 5 : 2;
    for (let i = 0; i < gap; i++) a.push(-1);
  }
  a.length = len;
  // Don't end on a lone pixel of a cut-off word.
  while (a.length && a[a.length - 1] !== 0) a.pop();
  return a;
}
/**
 * The strokes of an Ink on a face: a short paragraph of lines (3-4 px apart) centered across the face, each walked a
 * pixel at a time along its direction, the stroke on the line or lifted at a hump, joined up within a word (cursive).
 * Each line starts a little in from the face's edge and stops short of the far one by its own amount. "X,Y" -> key.
 */
function strokes(ink: Ink, pts: readonly Pt[], deep: (x: number, y: number) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  const [dx, dy] = ink.d;
  const n: Pt = [-dy, dx];
  const g = ink.gap ?? 4;
  const vs = pts.map(([X, Y]) => (X - ink.o[0]) * n[0] + (Y - ink.o[1]) * n[1]);
  const us = pts.map(([X, Y]) => (X - ink.o[0]) * dx + (Y - ink.o[1]) * dy);
  const vmin = Math.min(...vs);
  const vmax = Math.max(...vs);
  // The stroke lifts along the axis across the line; it steps a pixel at a time along the other.
  const lift: Pt = Math.abs(n[0]) > Math.abs(n[1]) ? [-Math.sign(n[0]), 0] : [0, -Math.sign(n[1])];
  const step = 1 / Math.max(Math.abs(dx), Math.abs(dy));
  const umin = Math.min(...us) - 1;
  const umax = Math.max(...us) + 1;
  const set = (X: number, Y: number, k: string) => out.set(`${X},${Y}`, k);
  const baseAt = (v: number, k: number): Pt => {
    const u = umin + k * step;
    return [Math.floor(ink.o[0] + u * dx + v * n[0]), Math.floor(ink.o[1] + u * dy + v * n[1])];
  };
  /** Where a line at v runs on the face (first and last step), with room for its humps. */
  const run = (v: number): [number, number] | null => {
    let k0 = -1;
    let k1 = -1;
    for (let k = 0; umin + k * step <= umax; k++) {
      const p = baseAt(v, k);
      if (deep(p[0], p[1]) && deep(p[0] + lift[0], p[1] + lift[1])) {
        if (k0 < 0) k0 = k;
        k1 = k;
      }
    }
    return k0 < 0 ? null : [k0, k1];
  };
  // The paragraph goes where its lines run longest (a triangle's broad end), up to `lines` of them.
  let best: { v0: number; count: number; sum: number } = { v0: 0, count: 0, sum: 0 };
  for (let count = Math.min(ink.lines ?? 4, 6); count >= 1 && !best.count; count--)
    for (let v0 = vmin + 1; v0 + (count - 1) * g <= vmax - 1; v0 += 0.5) {
      let sum = 0;
      let ok = true;
      for (let li = 0; li < count; li++) {
        const r = run(v0 + li * g);
        if (!r || r[1] - r[0] < 8) ok = false;
        else sum += r[1] - r[0];
      }
      if (ok && sum > best.sum) best = { v0, count, sum };
    }
  for (let li = 0; li < best.count; li++) {
    const v = best.v0 + li * g;
    const key = ink.fade?.[li] ?? ink.key;
    const base = (k: number) => baseAt(v, k);
    const r = run(v)!;
    const [k0, k1] = r;
    const start = k0 + 1 + (hash(li, ink.seed, 11) % 3);
    const end = k1 - (hash(li, ink.seed, 12) % Math.max(1, Math.floor((k1 - k0) / 4)));
    if (end - start < 4) continue;
    const lifts = script(li, ink.seed, end - start + 1);
    let prev: Pt | null = null;
    lifts.forEach((L, j) => {
      if (L < 0) {
        prev = null;
        return;
      }
      const b = base(start + j);
      const p: Pt = [b[0] + lift[0] * L, b[1] + lift[1] * L];
      if (prev) {
        // A 1-px join from the last pixel (only when they don't touch).
        let [cx, cy] = prev;
        while (Math.abs(p[0] - cx) > 1 || Math.abs(p[1] - cy) > 1) {
          cx += Math.sign(p[0] - cx);
          cy += Math.sign(p[1] - cy);
          set(cx, cy, key);
        }
      }
      set(p[0], p[1], key);
      prev = p;
    });
  }
  return out;
}

/** Clips a polygon to the side of the line a-b that `keep` is on. */
function clipHalf(pts: readonly Pt[], a: Pt, b: Pt, keep: Pt): Pt[] {
  const side = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const s0 = Math.sign(side(keep));
  const out: Pt[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    const sp = side(p) * s0;
    const sq = side(q) * s0;
    if (sp >= 0) out.push(p);
    if (sp * sq < 0) out.push(lerp(p, q, sp / (sp - sq)));
  });
  return out;
}
/** A point bulging out from the edge a-b at t, `w` px, on the side away from `away`. */
function bulge(a: Pt, b: Pt, away: Pt, t: number, w: number): Pt {
  const c = lerp(a, b, t);
  const d = unit([b[0] - a[0], b[1] - a[1]]);
  let n: Pt = [-d[1], d[0]];
  if ((away[0] - c[0]) * n[0] + (away[1] - c[1]) * n[1] > 0) n = [-n[0], -n[1]];
  return add2(c, [n[0] * w, n[1] * w]);
}

function boxOf(d: Drawing): [number, number, number, number] {
  const pts = d.faces.flatMap((f) => f.pts);
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))) - 1;
  const y0 = Math.floor(Math.min(...pts.map((p) => p[1]))) - 1;
  const x1 = Math.ceil(Math.max(...pts.map((p) => p[0]))) + 1;
  const y1 = Math.ceil(Math.max(...pts.map((p) => p[1]))) + 1;
  return [x0, y0, x1, y1];
}

function paint(d: Drawing, outline = true): Part {
  const [x0, y0, x1, y1] = boxOf(d);
  const cv = canvas(x1 - x0 + 1, y1 - y0 + 1);
  const set = (X: number, Y: number, k: string) => {
    const row = cv[Y - y0];
    if (row && row[X - x0] !== undefined) row[X - x0] = k;
  };
  const get = (X: number, Y: number) => cv[Y - y0]?.[X - x0] ?? ".";
  const inked: [number, number][] = [];
  for (const f of d.faces) {
    const inside = inPoly(f.pts);
    for (let Y = y0; Y <= y1; Y++)
      for (let X = x0; X <= x1; X++) {
        if (!inside(X, Y)) continue;
        let k = f.key;
        if (f.hi && (!inside(X - 1, Y) || !inside(X, Y - 1))) k = f.hi;
        else if (f.lo && (!inside(X + 1, Y) || !inside(X, Y + 1))) k = f.lo;
        set(X, Y, k);
      }
    for (const s of f.gild ?? []) for (const [X, Y] of gildPixels(f.pts, s)) set(X, Y, s[2]);
    const deep = (X: number, Y: number) => {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!inside(X + a, Y + b)) return false;
      return true;
    };
    // The seal's box (with a pixel's margin kept clear of writing).
    const sg = f.seal ? (f.seal.flat ? SEAL_FLAT : SEAL) : null;
    const sx = f.seal ? Math.round(f.seal.c[0]) - 3 : 0;
    const sy = f.seal && sg ? Math.round(f.seal.c[1]) - Math.floor(sg.length / 2) : 0;
    const inSeal = (X: number, Y: number) => !!sg && X >= sx - 1 && X <= sx + 6 && Y >= sy - 1 && Y <= sy + sg.length;
    if (f.ink) {
      const st = strokes(f.ink, f.pts, deep);
      for (let Y = y0; Y <= y1; Y++)
        for (let X = x0; X <= x1; X++) {
          if (!deep(X, Y) || inSeal(X, Y)) continue;
          const k = st.get(`${X},${Y}`);
          if (k) {
            set(X, Y, k);
            inked.push([X, Y]);
          }
        }
    }
    if (sg)
      sg.forEach((row, j) =>
        [...row].forEach((c, i) => {
          if (c !== "." && inside(sx + i, sy + j)) set(sx + i, sy + j, c);
        }),
      );
  }
  if (d.smear) for (const [X, Y] of inked) for (const [a, b] of [[0, 1], [1, 1]] as const) if ("ABCD".includes(get(X + a, Y + b))) set(X + a, Y + b, "s");
  for (const [a, b, k] of d.creases ?? []) {
    const tmp = canvas(x1 - x0 + 1, y1 - y0 + 1);
    line(tmp, Math.round(a[0]) - x0, Math.round(a[1]) - y0, Math.round(b[0]) - x0, Math.round(b[1]) - y0, "#");
    tmp.forEach((row, y) => row.forEach((c, x) => c === "#" && cv[y]![x] !== "." && (cv[y]![x] = k)));
  }
  for (const [X, Y, k] of d.dots ?? []) set(X, Y, k);
  return { grid: toGrid(cv), outline };
}

const { parts: PARTS, add } = lazyParts();
const AT = new Map<string, Pt>();
/** A part by name, painted the first time it shows; its top-left from its points. */
function use(name: string, draw: () => Drawing, outline = true): { name: string; at: Pt } {
  let at = AT.get(name);
  if (!at) {
    const d = draw();
    const b = boxOf(d);
    AT.set(name, (at = [b[0], b[1]]));
    add(name, () => paint(d, outline));
  }
  return { name, at };
}

// ---- The crane (frame space: the ground at y GROUND, the crane's middle on x 46).

const W = 90;
const H = 92;
const GROUND = 86;
const MID = 46;

const BODY = { L: [28, 59] as Pt, T: [46, 50] as Pt, R: [64, 58] as Pt, B: [47, 81] as Pt };
const NECK_BASE: readonly [Pt, Pt] = [[33, 72], [41, 62]];
const TAIL_BASE: readonly [Pt, Pt] = [[51, 62], [59, 72]];
const WING_N: readonly [Pt, Pt] = [[29, 61], [64, 59]];
const WING_F: readonly [Pt, Pt] = [[34, 57], [58, 56]];
const REST = { neck: [14, 27] as Pt, tail: [84, 38] as Pt, wingN: [72, 11] as Pt, wingF: [23, 11] as Pt };

/** The fading lines' indices on the near wing's front face. */
const FADE_LINES: Readonly<Record<number, string>> = { 0: "1", 1: "2", 2: "3" };
/** The near wing's lines run along it, toward its tip. */
const INK_D = unit([1, -0.85]);

function bodyDrawing(smear: boolean): Drawing {
  const { L, T, R, B } = BODY;
  return {
    faces: [
      { pts: [L, T, B], key: "B", hi: "A", ink: { o: L, d: unit([1, 0.42]), key: "i", seed: 1, lines: 3 } },
      { pts: [T, R, B], key: "C", lo: "D", ink: { o: R, d: unit([1, -0.5]), key: "j", seed: 2, lines: 3 } },
    ],
    creases: [[T, B, "D"]],
    smear,
  };
}

/** A long thin point (neck or tail) from its base edge to its tip: the side toward the light lit, the other mid. */
function pointDrawing(base: readonly [Pt, Pt], tip: Pt, litFirst: boolean, gilt = false): Drawing {
  const [a, b] = base;
  const m = lerp(a, b, 0.5);
  const n = unit([tip[0] - m[0], tip[1] - m[1]]);
  const side: Pt = [-n[1] * 1.5, n[0] * 1.5];
  const tA = add2(tip, side);
  const tB: Pt = [tip[0] - side[0], tip[1] - side[1]];
  // Which tip corner belongs to a's side: the one nearer a's side of the axis.
  const cross = (p: Pt) => (p[0] - m[0]) * n[1] - (p[1] - m[1]) * n[0];
  const [ta, tb] = Math.sign(cross(tA)) === Math.sign(cross(a)) ? [tA, tB] : [tB, tA];
  const faceA: Face = { pts: [a, m, tip, ta], key: litFirst ? "B" : "C", ...(litFirst ? { hi: "A" } : {}), ...(gilt ? { gild: [[lerp(a, ta, 0.5), tip, "G"]] } : {}) };
  const faceB: Face = { pts: [m, b, tb, tip], key: litFirst ? "C" : "B", ...(litFirst ? {} : { hi: "A" }) };
  return { faces: [faceA, faceB], creases: [[m, tip, "D"]] };
}

export type Head = "rest" | "dip" | "up" | "none";
/** The eye: open (dark, a glint top left), wide (startled: taller), happy (pleased: a closed arc), narrow (a slit, a blink). */
export type Eye = "open" | "wide" | "happy" | "narrow";
const EYES: Record<Eye, readonly (readonly [number, number, string])[]> = {
  open: [[0, 0, "A"], [1, 0, "x"], [0, 1, "x"], [1, 1, "x"]],
  wide: [[0, -1, "x"], [1, -1, "x"], [0, 0, "A"], [1, 0, "x"], [0, 1, "x"], [1, 1, "x"]],
  happy: [[0, 0, "x"], [1, 0, "x"], [-1, 1, "x"], [2, 1, "x"]],
  narrow: [[0, 1, "x"], [1, 1, "x"], [-1, 1, "D"]],
};
/** A creased brow over the eye: level (open), lifted (wide), lowered and slanting to the beak (narrow), an arc (happy). */
const BROWS: Record<Eye, readonly (readonly [number, number])[]> = {
  open: [[-1, -2], [0, -2], [1, -2]],
  wide: [[-1, -3], [0, -3], [1, -3]],
  happy: [[-1, -1], [0, -2], [1, -2], [2, -1]],
  narrow: [[-1, 0], [0, -1], [1, -1], [2, -2]],
};
const HEADS: Record<Exclude<Head, "none">, { c: Pt; bk: Pt; ch: Pt; bt: Pt; eye: Pt }> = {
  rest: { c: [-1, -6], bk: [4, 0], ch: [0, 4], bt: [-12, 4], eye: [-3, -1] },
  dip: { c: [-2, -6], bk: [4, -1], ch: [1, 4], bt: [-8, 10], eye: [-2, -1] },
  up: { c: [0, -7], bk: [4, 1], ch: [-1, 4], bt: [-12, -3], eye: [-2, -3] },
};
function headDrawing(tip: Pt, mode: Exclude<Head, "none">, eye: Eye): Drawing {
  const h = HEADS[mode];
  const P = (q: Pt) => add2(tip, q);
  const e = r2(P(h.eye));
  return {
    faces: [
      { pts: [P(h.c), P(h.bk), P(h.bt)], key: "B", hi: "A" },
      { pts: [P(h.bk), P(h.ch), P(h.bt)], key: "C", lo: "D" },
    ],
    creases: [[P(h.bk), P(h.bt), "D"]],
    dots: [...BROWS[eye].map(([a, b]) => [e[0] + a, e[1] + b, "x"] as const), ...EYES[eye].map(([a, b, k]) => [e[0] + a, e[1] + b, k] as const)],
  };
}

/**
 * The near wing: its leading edge from the root L to the tip, its trailing edge bowed out (Q) and back to R. A lit front
 * face (L, tip, M), and behind the crease two shaded faces (M, tip, Q) and (M, Q, R): a broad flap of paper.
 */
function wingNDrawing(tip: Pt, dent: number, smear: boolean): Drawing {
  const [L, R] = WING_N;
  const M = lerp(L, R, 0.56);
  const len = Math.hypot(tip[0] - R[0], tip[1] - R[1]);
  const Q = bulge(R, tip, L, 0.45, Math.min(11, len * 0.2));
  const front: Ink = { o: L, d: INK_D, key: "i", seed: 3, fade: FADE_LINES };
  const back: Ink = { o: L, d: INK_D, key: "j", seed: 5 };
  const low: Ink = { o: L, d: INK_D, key: "l", seed: 5 };
  const seal: Pt = [L[0] * 0.45 + tip[0] * 0.15 + M[0] * 0.4, L[1] * 0.45 + tip[1] * 0.15 + M[1] * 0.4];
  const sealOk = Math.abs((tip[0] - L[0]) * (M[1] - L[1]) - (tip[1] - L[1]) * (M[0] - L[0])) > 380;
  let faces: Face[] = [
    { pts: [L, tip, M], key: "B", hi: "A", ink: front, gild: [[L, tip, "q"]], ...(sealOk ? { seal: { c: seal } } : {}) },
    { pts: [M, tip, Q], key: "C", ink: back },
    { pts: [M, Q, R], key: "D", lo: "E", ink: low },
  ];
  const creases: [Pt, Pt, string][] = [[M, tip, "D"], [M, Q, "E"]];
  if (dent === 0) return { faces, creases, smear };
  // Hurt: the trailing edge crumpled into a zigzag, creases running in from it; harder, the tip folded over too.
  const n1 = bulge(R, Q, Q, 0.3, 0);
  const n2 = add2(lerp(R, Q, 0.45), [(M[0] - R[0]) * 0.25, (M[1] - R[1]) * 0.25]);
  const n3 = lerp(R, Q, 0.62);
  const n4 = add2(lerp(R, Q, 0.8), [(M[0] - Q[0]) * 0.3, (M[1] - Q[1]) * 0.3]);
  faces[2] = { pts: [M, Q, n4, n3, n2, n1, R], key: "D", lo: "E", ink: low };
  creases.push([n2, lerp(M, Q, 0.4), "E"], [n4, lerp(M, tip, 0.3), "E"]);
  if (dent === 1) return { faces, creases, smear };
  // The flap: the tip folded across the line A-B, lying over the wing's faces.
  const A = lerp(L, tip, 0.64);
  const B = lerp(Q, tip, 0.45);
  const ux = B[0] - A[0];
  const uy = B[1] - A[1];
  const t = ((tip[0] - A[0]) * ux + (tip[1] - A[1]) * uy) / (ux * ux + uy * uy);
  const foot: Pt = [A[0] + ux * t, A[1] + uy * t];
  const flapTip: Pt = [2 * foot[0] - tip[0], 2 * foot[1] - tip[1]];
  faces = faces.map((f) => ({ ...f, pts: clipHalf(f.pts, A, B, L) }));
  faces.push({ pts: [A, B, flapTip], key: "D", lo: "E" });
  const mt = clipHalf([M, tip, tip], A, B, L);
  return { faces, creases: [[M, mt[1] ?? M, "D"], [A, B, "E"], ...creases.slice(1)], smear };
}

/** The far wing, behind: in shade, its outer edge bowed out to the left. */
function wingFDrawing(tip: Pt, smear: boolean): Drawing {
  const [L, R] = WING_F;
  const M = lerp(L, R, 0.42);
  const len = Math.hypot(tip[0] - L[0], tip[1] - L[1]);
  const Q = bulge(L, tip, R, 0.48, Math.min(10, len * 0.18));
  const d = unit([-1, -1.3]);
  return {
    faces: [
      { pts: [L, Q, tip, M], key: "C", hi: "B", ink: { o: R, d, key: "j", seed: 4, lines: 3 }, gild: [[L, Q, "o"], [Q, tip, "o"]] },
      { pts: [M, tip, R], key: "D", ink: { o: R, d, key: "l", seed: 6, lines: 3 } },
    ],
    creases: [[M, tip, "E"]],
    smear,
  };
}

function shadowDrawing(rx: number): Drawing {
  return { faces: [{ pts: [[-rx, 0], [-rx + 4, -1.5], [rx - 4, -1.5], [rx, 0], [rx - 4, 1.5], [-rx + 4, 1.5]], key: "z" }] };
}

// ---- The page on its own (the entrance and the defeat), drawn round (0, 0).

/** A loose sheet, upright or tipping: `skew` slants it, `h` its height (a sheet seen tipped is short). */
function pageDrawing(skew: number, h: number, w = 46): Drawing {
  const t = -h / 2;
  const b = h / 2;
  const pts: Pt[] = [[-w / 2 + skew, t], [w / 2 + skew, t], [w / 2 - skew, b], [-w / 2 - skew, b]];
  const key = h < 12 ? "C" : "B";
  const flat = h < 14;
  const seal = { c: [w / 4 - skew * 0.3, flat ? 0 : (h / 34) * 8] as Pt, flat };
  return { faces: [{ pts, key, hi: "A", lo: h < 12 ? "D" : "C", ink: { o: [0, t + 1], d: [1, 0], gap: h < 10 ? 3 : 4, lines: h < 12 ? 2 : 6, key: h < 12 ? "j" : "i", seed: 7 }, seal }] };
}
/** The page creased into a square seen corner-up: four faces round the middle (a shallow pyramid). */
function squareDrawing(r: number): Drawing {
  const T: Pt = [0, -r];
  const R: Pt = [r, 0];
  const B: Pt = [0, r];
  const L: Pt = [-r, 0];
  const O: Pt = [0, 0];
  const d = unit([1, 1]);
  return {
    faces: [
      { pts: [T, O, L], key: "B", hi: "A", ink: { o: O, d, key: "i", seed: 8 }, seal: { c: [-r * 0.4, -r * 0.27] } },
      { pts: [T, R, O], key: "C", ink: { o: O, d, key: "j", seed: 8 } },
      { pts: [L, O, B], key: "C", ink: { o: O, d, key: "j", seed: 8 } },
      { pts: [O, R, B], key: "D", ink: { o: O, d, key: "l", seed: 8 } },
    ],
    creases: [[T, B, "E"], [L, R, "E"], [lerp(T, L, 0.5), O, "D"], [lerp(T, R, 0.5), O, "D"]],
  };
}
/** The bird base: a long diamond, its flaps up top, its two legs below split by a slit. */
function birdBaseDrawing(): Drawing {
  const T: Pt = [0, -33];
  const L: Pt = [-13, 0];
  const R: Pt = [13, 0];
  const B: Pt = [0, 31];
  const O: Pt = [0, 0];
  return {
    faces: [
      { pts: [T, O, L], key: "B", hi: "A", ink: { o: O, d: unit([1, -1.4]), key: "i", seed: 9 }, seal: { c: [-4.5, -9] } },
      { pts: [T, R, O], key: "C", ink: { o: O, d: unit([1, 1.4]), key: "j", seed: 9 } },
      { pts: [L, O, B], key: "C", ink: { o: O, d: unit([1, 1.2]), key: "j", seed: 10 } },
      { pts: [O, R, B], key: "D", ink: { o: O, d: unit([1, -1.2]), key: "l", seed: 10 } },
    ],
    creases: [[L, R, "D"], [T, O, "D"], [[0, 2], B, "E"], [lerp(T, L, 0.5), [0, -6], "D"], [lerp(T, R, 0.5), [0, -6], "E"]],
  };
}

// ---- Little paper things: the piece it takes (a folded pawn) and the tiny crane it folds for you.

/** A paper pawn: a round head, a neck, a collar, a wide base; a crease down its shaded side. */
const PIECE = ["..AB..", ".ABBC.", ".BBCD.", "..BC..", "..BD..", ".ABCD.", "ABBCDD"];
const MINI: Record<string, readonly string[]> = {
  square: ["...A...", "..ABC..", ".ABBCC.", "ABBBCCD", ".BBCCD.", "..CCD..", "...D..."],
  kite: ["..A..", ".ABC.", ".ABC.", "ABBCC", "ABBCD", ".BCD.", ".BCD.", "..D..", "..D.."],
  // The tiny crane in flight: a V of two wings (gold at the near tip), a neck to the left, a tail to the right.
  up: [".B.....G.", ".BC...AB.", "..BC.ABC.", "A..CABC.D", ".ABBBBCD.", "...BBCD..", "....CD..."],
  down: ["B.......G", ".BC...AB.", "A.CBABC.D", ".ABBBCCD.", "...BCD..."],
};
for (const [k, g] of Object.entries(MINI)) add(`mini:${k}`, () => ({ grid: g }));
add("piece", () => ({ grid: PIECE }));

// ---- Poses.

export interface FolioPose {
  /** The whole crane (a hover, a shudder). */
  dx?: number;
  dy?: number;
  /** Tip offsets from rest. */
  wingN?: Pt;
  wingF?: Pt;
  neck?: Pt;
  tail?: Pt;
  head?: Head;
  eye?: Eye;
  dent?: 0 | 1 | 2;
  smear?: boolean;
  /** Wing edges curling (a ripple up the wings, rattled). */
  curl?: number;
  phase?: number;
  /** The shadow's half-width (default by height). */
  shadow?: number;
  /** The captured piece, in frame space (drawn just under the near wing). */
  piece?: Pt;
  /** Extra layers on top (the tiny crane). */
  extra?: readonly Layer[];
}

const r2 = (q: Pt): Pt => [Math.round(q[0]), Math.round(q[1])];
const key = (q: Pt) => `${q[0]},${q[1]}`;

function shadowLayer(rx: number): Layer {
  const s = use(`shadow:${rx}`, () => shadowDrawing(rx), false);
  return { part: s.name, x: s.at[0] + MID, y: s.at[1] + GROUND };
}

export function folioLayers(p: FolioPose): Layer[] {
  const dx = p.dx ?? 0;
  const dy = p.dy ?? 0;
  const at = (s: { name: string; at: Pt }, extra: Partial<Layer> = {}): Layer => ({ part: s.name, x: s.at[0] + dx, y: s.at[1] + dy, ...extra });
  const neck = r2(add2(REST.neck, p.neck ?? [0, 0]));
  const tail = r2(add2(REST.tail, p.tail ?? [0, 0]));
  const wn = r2(add2(REST.wingN, p.wingN ?? [0, 0]));
  const wf = r2(add2(REST.wingF, p.wingF ?? [0, 0]));
  const sm = !!p.smear;
  const wave = p.curl ? { wave: { along: "rows" as const, amp: p.curl, len: 18, phase: p.phase ?? 0, pin: "bottom" as const } } : {};
  const layers: Layer[] = [shadowLayer(p.shadow ?? Math.max(6, 15 + Math.min(0, dy)))];
  layers.push(at(use(`wingF:${key(wf)}:${sm}`, () => wingFDrawing(wf, sm)), wave));
  layers.push(at(use(`tail:${key(tail)}`, () => pointDrawing(TAIL_BASE, tail, true, true))));
  layers.push(at(use(`body:${sm}`, () => bodyDrawing(sm))));
  layers.push(at(use(`neck:${key(neck)}`, () => pointDrawing(NECK_BASE, neck, true))));
  const head = p.head ?? "rest";
  const eye = p.eye ?? "open";
  if (head !== "none") layers.push(at(use(`head:${key(neck)}:${head}:${eye}`, () => headDrawing(neck, head, eye))));
  if (p.piece) layers.push({ part: "piece", x: p.piece[0], y: p.piece[1] });
  layers.push(at(use(`wingN:${key(wn)}:${p.dent ?? 0}:${sm}`, () => wingNDrawing(wn, p.dent ?? 0, sm)), wave));
  layers.push(...(p.extra ?? []));
  return layers;
}

const F = (ms: number, p: FolioPose, extra: Partial<Frame> = {}): Frame => ({
  ms,
  layers: folioLayers(p),
  ...extra,
  ...(extra.specks ? { specks: extra.specks.filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2) } : {}),
});

/** The page alone at (cx, cy), with its shadow. */
function pageFrame(ms: number, d: { name: string; at: Pt }, cx: number, cy: number, rx: number, extra: Partial<Frame> = {}): Frame {
  return { ms, layers: [shadowLayer(rx), { part: d.name, x: d.at[0] + cx, y: d.at[1] + cy }], ...extra };
}
const page = (skew: number, h: number) => use(`page:${skew}:${h}`, () => pageDrawing(skew, h));
const square = () => use("square", () => squareDrawing(21));
const birdBase = () => use("birdbase", birdBaseDrawing);

/** Ink-line fades: levels 0..3 for keys 1, 2, 3, in sepia or blue. */
const fades = (l1: number, l2 = 3, l3 = 3, ramp = INK): Record<string, string> => ({ "1": ramp[l1]!, "2": ramp[l2]!, "3": ramp[l3]! });

/** A glint (gold) at t (0..1) along a segment: a light pixel with gold either side along the edge. */
function glint(a: Pt, b: Pt, t: number, dx = 0, dy = 0): Speck[] {
  const n = unit([b[0] - a[0], b[1] - a[1]]);
  const c = lerp(a, b, t);
  const P = (s: number, k: string): Speck => [Math.round(c[0] + n[0] * s) + dx, Math.round(c[1] + n[1] * s) + dy, k];
  return [P(-2, "g"), P(-1, "G"), P(0, "H"), P(1, "G"), P(2, "g")];
}
/**
 * A gold glint running up the near wing's leading edge: a short streak laid on the outline itself (the dark line just
 * outside the paper), light at its middle; `t` 0 at the wing's root to 1 at its tip.
 */
function edgeGlint(t: number, tipOff: Pt = [0, 0], dy = 0): Speck[] {
  const [L, R] = WING_N;
  const T = r2(add2(REST.wingN, tipOff));
  const M = lerp(L, R, 0.56);
  const d = unit([T[0] - L[0], T[1] - L[1]]);
  const px = gildPixels([L, T, M], [L, T, "G"]).sort((p, q) => (p[0] - q[0]) * d[0] + (p[1] - q[1]) * d[1]);
  if (!px.length) return [];
  const c = Math.round(t * (px.length - 1));
  const out: Speck[] = [];
  for (let j = -6; j <= 6; j++) {
    const p = px[c + j];
    if (p) out.push([p[0], p[1] + dy, Math.abs(j) <= 2 ? "H" : "G"]);
    // The light spills over the outline beside it.
    if (p && Math.abs(j) <= 3) out.push([p[0] - 1, p[1] + dy, Math.abs(j) <= 1 ? "H" : "G"]);
  }
  // A small star flaring off the edge, up and out from the glint.
  const p = px[c]!;
  out.push(...sparkle(p[0] - 3, p[1] - 2 + dy));
  return out;
}
/** A four-point sparkle. */
const sparkle = (x: number, y: number, big = true): Speck[] =>
  big ? [[x, y, "H"], [x - 1, y, "G"], [x + 1, y, "G"], [x, y - 1, "G"], [x, y + 1, "G"]] : [[x, y, "H"]];

// ---- Animations.

/**
 * Idle (loop, 4.8 s): two slow breaths, the wings rising and settling, the crane lifting a pixel with them; the head
 * dips once; a line of writing fades in on the near wing and out again, then another.
 */
const IDLE: Frame[] = Array.from({ length: 24 }, (_, i) => {
  const ph = (i / 24) * Math.PI * 4;
  const lift = Math.round(1.5 - 1.5 * Math.cos(ph));
  const dip = i >= 9 && i <= 12;
  const l1 = [3, 3, 2, 1, 0, 0, 0, 1, 2, 3][i] ?? 3;
  const l2 = i >= 13 ? ([3, 2, 1, 0, 0, 0, 1, 2, 3, 3, 3][i - 13] ?? 3) : 3;
  return F(200, {
    dy: lift >= 2 ? -1 : 0,
    wingN: [0, -lift],
    wingF: [0, -lift],
    neck: dip ? [-1, i === 9 || i === 12 ? 1 : 2] : [0, 0],
    head: dip && i !== 9 && i !== 12 ? "dip" : "rest",
    eye: i === 19 ? "narrow" : "open",
  }, { pal: fades(l1, l2) });
});

/**
 * Entrance: a loose page drifts down from above, rocking (cue `rustle`), settles upright over its shadow, then folds
 * (cue `fold` at each step) into a creased square, the bird base, the petal fold (wings up, neck and tail hanging),
 * the neck and tail swing up, the head folds down, the wings open; a glint runs up the wing edge, and it breathes.
 */
const ENTRANCE: Frame[] = [
  pageFrame(170, page(5, 16), 38, 11, 3, { cue: "rustle" }),
  pageFrame(170, page(-3, 9), 52, 22, 4),
  pageFrame(170, page(-6, 24), 40, 34, 6, { cue: "rustle" }),
  pageFrame(170, page(4, 14), 50, 44, 9),
  pageFrame(260, page(0, 34), 46, 50, 13),
  pageFrame(200, square(), 46, 50, 13, { cue: "fold", specks: sparkle(46, 28) }),
  pageFrame(200, birdBase(), 46, 50, 12, { cue: "fold", specks: sparkle(46, 16) }),
  F(160, { wingN: [-20, 4], wingF: [19, 2], neck: [30, 58], tail: [-37, 44], head: "none", shadow: 11 }, { cue: "fold" }),
  F(130, { wingN: [-20, 4], wingF: [19, 2], neck: [5, 33], tail: [-5, 23], head: "none", shadow: 12 }),
  F(130, { wingN: [-20, 4], wingF: [19, 2], neck: [0, 0], tail: [0, 0], head: "none" }),
  F(160, { wingN: [-10, 2], wingF: [10, 1], head: "rest" }, { cue: "fold", specks: sparkle(REST.neck[0] - 10, REST.neck[1] + 4, false) }),
  F(110, { wingN: [-3, 0], wingF: [3, -1], dy: -1 }),
  F(120, { wingN: [0, -2], wingF: [0, -2], dy: -1 }, { specks: edgeGlint(0.25, [0, -2], -1) }),
  F(120, { wingN: [0, -2], wingF: [0, -2], dy: -1 }, { specks: edgeGlint(0.55, [0, -2], -1) }),
  F(140, { wingN: [0, -1], wingF: [0, -1] }, { specks: edgeGlint(0.85, [0, -1]) }),
  F(300, {}),
];

/**
 * Thinking (loop, 3.2 s): it cocks its head up and back; a line of ink-blue writing appears on the near wing, then the
 * next, then the next, and they fade together as the head comes down.
 */
const THINKING: Frame[] = Array.from({ length: 16 }, (_, i) => {
  const l1 = [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1, 0, 0][i]!;
  const l2 = [0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 2, 1, 0, 0][i]!;
  const l3 = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0][i]!;
  const tilt = i >= 1 && i <= 12;
  const sway = i >= 4 && i <= 9 ? 1 : 0;
  return F(200, {
    neck: tilt ? [1 + sway, -1] : [0, 0],
    head: tilt ? "up" : "rest",
    wingN: [0, i % 8 < 4 ? 0 : -1],
    wingF: [0, i % 8 < 4 ? 0 : -1],
  }, { pal: fades(l1, l2, l3) });
});

/** Move: the near wing sweeps forward toward the board (cue `sweep`), points, and sweeps back with a rustle. */
const MOVE: Frame[] = [
  F(90, { wingN: [0, -2] }),
  F(70, { wingN: [-6, -5], wingF: [0, -1] }, { cue: "sweep" }),
  F(70, { wingN: [-26, -3], wingF: [0, -2], neck: [0, -1] }),
  F(80, { wingN: [-44, 22], wingF: [2, -2], neck: [0, -2], head: "up" }),
  F(260, { wingN: [-63, 35], wingF: [3, -2], neck: [0, -2], head: "up", dx: -1 }, { specks: sparkle(7, 44, false) }),
  F(80, { wingN: [-30, 0], wingF: [0, -1], neck: [0, -1] }),
  F(80, { wingN: [-6, -3] }),
  F(90, { wingN: [1, 1], wingF: [0, 1] }, { cue: "rustle", shake: [1, 0] }),
  F(90, { wingN: [0, -1] }, { shake: [-1, 0] }),
  F(140, {}),
];

/**
 * Capture: it dips its beak to the board side and comes up with the piece it took, folded now into a tiny paper pawn
 * (cue `pick`); lifts the near wing, slips the pawn under it (cue `tuck`) and settles the wing over it.
 */
const CAPTURE: Frame[] = [
  F(100, {}),
  F(110, { neck: [-2, 7], head: "dip" }),
  F(130, { neck: [-3, 13], head: "dip", wingN: [0, -1] }),
  F(170, { neck: [-3, 13], head: "dip", piece: [1, 46] }, { cue: "pick", specks: sparkle(2, 44) }),
  F(120, { neck: [-2, 6], head: "rest", piece: [0, 36] }),
  F(120, { neck: [6, 10], head: "dip", piece: [10, 44], wingN: [4, -4], wingF: [0, -1] }),
  F(120, { neck: [12, 18], head: "dip", piece: [17, 52], wingN: [6, -5], wingF: [0, -2] }),
  F(120, { neck: [12, 18], head: "dip", piece: [26, 56], wingN: [6, -5], wingF: [0, -2] }, { cue: "tuck" }),
  F(120, { neck: [6, 8], piece: [34, 57], wingN: [2, -2], wingF: [0, -1] }),
  F(160, { neck: [1, 2], piece: [36, 57], wingN: [0, 1] }, { shake: [0, 1] }),
  F(260, {}, { specks: sparkle(60, 62, false) }),
];

/** Hurt: a crease bends into the near wing (cue `crumple`), its tip folds over, the crane shudders; then it smooths out. */
const HURT: Frame[] = [
  F(70, { dent: 1, wingN: [2, 3], wingF: [1, 2], neck: [2, 1], head: "dip", eye: "wide" }, { cue: "crumple", shake: [-1, 0] }),
  F(80, { dent: 2, wingN: [2, 3], wingF: [1, 2], neck: [3, 2], head: "dip", eye: "wide" }, { shake: [1, 0] }),
  F(90, { dent: 2, wingN: [1, 2], wingF: [1, 1], neck: [3, 2], head: "dip", eye: "wide" }, { shake: [-1, 0] }),
  F(240, { dent: 2, wingN: [1, 2], wingF: [1, 1], neck: [2, 2], head: "dip", eye: "narrow" }),
  F(120, { dent: 1, wingN: [0, 1], neck: [1, 1] }, { cue: "smooth" }),
  F(120, { wingN: [0, -1] }, { specks: sparkle(64, 28, false) }),
  F(160, {}),
];

/** Check: it stretches its neck tall, the near wing points at the board, and a short ink underline draws itself under it. */
const lineUnder = (n: number): Speck[] =>
  Array.from({ length: n }, (_, i): Speck => [8 + i, 90 - (i % 11 === 5 || i % 11 === 6 ? 1 : 0), i > n - 3 ? "u" : "U"]);
const POINT: Pt = [-63, 35];
const CHECK: Frame[] = [
  F(90, { neck: [-1, -4], head: "up", wingN: [-6, -5] }, { cue: "stretch" }),
  F(90, { neck: [-2, -8], head: "up", wingN: [-26, -3], dy: -1 }),
  F(100, { neck: [-2, -10], head: "rest", wingN: [-44, 22], wingF: [2, -2], dy: -1 }),
  F(90, { neck: [-2, -10], head: "rest", wingN: POINT, wingF: [3, -2], dy: -1 }, { cue: "ink", specks: lineUnder(8) }),
  F(90, { neck: [-2, -10], head: "rest", wingN: POINT, wingF: [3, -2], dy: -1 }, { specks: lineUnder(18) }),
  F(90, { neck: [-2, -10], head: "rest", wingN: POINT, wingF: [3, -2], dy: -1 }, { specks: lineUnder(28) }),
  F(500, { neck: [-2, -10], head: "rest", wingN: POINT, wingF: [3, -2], dy: -1 }, { specks: lineUnder(34) }),
  F(110, { neck: [-1, -5], wingN: [-26, -2] }, { specks: lineUnder(34) }),
  F(160, {}),
];

/** Pleased (`smug`): a small polite bow of the head, and a soft gold glint runs up the near wing's edge (cue `glint`). */
const BOW = { neck: [3, 6] as Pt, head: "dip" as Head };
const SMUG: Frame[] = [
  F(110, { neck: [1, 2] }),
  F(150, { ...BOW, wingN: [0, 1], wingF: [0, 1], eye: "happy" }),
  F(110, { ...BOW, wingN: [0, 1], wingF: [0, 1], eye: "happy" }, { cue: "glint", specks: edgeGlint(0.12, [0, 1]) }),
  F(100, { ...BOW, wingN: [0, 1], wingF: [0, 1], eye: "happy" }, { specks: edgeGlint(0.36, [0, 1]) }),
  F(100, { ...BOW, wingN: [0, 1], wingF: [0, 1], eye: "happy" }, { specks: edgeGlint(0.6, [0, 1]) }),
  F(110, { neck: [1, 2], wingN: [0, -1], eye: "happy" }, { specks: edgeGlint(0.84, [0, -1]) }),
  F(120, { wingN: [0, -2], wingF: [0, -1], dy: -1, eye: "happy" }, { specks: sparkle(REST.wingN[0] - 1, REST.wingN[1] - 4) }),
  F(260, { wingN: [0, -1] }, { specks: sparkle(REST.wingN[0] - 1, REST.wingN[1] - 3, false) }),
];

/** Rattled: its wing edges curl and flutter (cue `flutter`), the ink runs a little, it shivers, then steadies itself. */
const RATTLED: Frame[] = [
  F(80, { curl: 1, phase: 0, wingN: [1, 1], neck: [1, 1], smear: true, eye: "wide" }, { cue: "flutter", shake: [1, 0] }),
  F(80, { curl: 2, phase: 1.6, wingN: [0, -1], wingF: [0, 1], neck: [2, 1], head: "up", smear: true, eye: "wide" }, { shake: [-1, 0] }),
  F(80, { curl: 2, phase: 3.2, wingN: [1, 0], wingF: [0, -1], neck: [1, 0], head: "up", smear: true, eye: "wide" }, { shake: [1, 0] }),
  F(80, { curl: 2, phase: 4.8, wingN: [0, -1], wingF: [0, 1], neck: [2, 1], head: "up", smear: true, eye: "wide" }, { shake: [-1, 0] }),
  F(90, { curl: 1, phase: 0, wingN: [1, 0], neck: [1, 1], smear: true, eye: "wide" }, { shake: [1, 0] }),
  F(100, { curl: 1, phase: 2.4, wingN: [0, 1], neck: [1, 1], smear: true, eye: "wide" }),
  F(300, { wingN: [0, 2], wingF: [0, 1], neck: [0, 1], head: "dip", smear: true, eye: "narrow" }),
  F(160, { wingN: [0, -1], dy: -1 }),
  F(160, {}),
];

/**
 * Defeat: it unfolds, slowly, step by step: the wings close, the head unfolds and the neck and tail fall (cue
 * `unfold`), the bird base, the creased square, the flat page; the page tips back and drifts down, and settles on the
 * ground (cue `settle`).
 */
const DEFEAT: Frame[] = [
  F(260, { neck: [1, 3], head: "dip", wingN: [0, 2], wingF: [0, 2], eye: "narrow" }),
  F(240, { wingN: [-10, 3], wingF: [10, 2], neck: [1, 3], head: "dip", eye: "narrow" }, { cue: "unfold" }),
  F(240, { wingN: [-20, 4], wingF: [19, 2], head: "none" }),
  F(220, { wingN: [-20, 4], wingF: [19, 2], neck: [5, 33], tail: [-5, 23], head: "none", shadow: 12 }),
  F(220, { wingN: [-20, 4], wingF: [19, 2], neck: [30, 58], tail: [-37, 44], head: "none", shadow: 11 }),
  pageFrame(260, birdBase(), 46, 50, 12, { cue: "unfold" }),
  pageFrame(260, square(), 46, 50, 13),
  pageFrame(300, page(0, 34), 46, 50, 13),
  pageFrame(220, page(3, 22), 47, 61, 15),
  pageFrame(220, page(5, 12), 45, 73, 18),
  pageFrame(240, page(6, 7), 46, 82, 21, { cue: "settle" }),
  pageFrame(500, page(6, 7), 46, 83, 23),
  // The writing fades from the page; the seal stays, the last thing there.
  pageFrame(220, page(6, 7), 46, 83, 23, { pal: { i: "#adafbf", j: "#928f97" } }),
  pageFrame(220, page(6, 7), 46, 83, 23, { pal: { i: "#d0cbc5", j: "#b2a696" } }),
  pageFrame(1200, page(6, 7), 46, 83, 23, { pal: { i: PAPER_B, j: "#d3bd95" } }),
];

/** Victory: from a corner of its page it folds a tiny crane at its beak (cue `fold`), a square, a kite, a crane; sends it up and away (cue `launch`) and watches it go, pleased. */
const mini = (k: string, x: number, y: number): Layer => ({ part: `mini:${k}`, x, y });
const VICTORY: Frame[] = [
  F(100, {}),
  F(160, { neck: [1, 4], head: "dip", wingN: [0, 1] }, { specks: sparkle(REST.wingN[0] - 1, REST.wingN[1] + 2) }),
  F(170, { neck: [1, 4], head: "dip", extra: [mini("square", 0, 38)] }, { cue: "fold", specks: sparkle(3, 36) }),
  F(150, { neck: [1, 4], head: "dip", extra: [mini("kite", 1, 37)] }),
  F(170, { neck: [1, 4], head: "dip", extra: [mini("up", -3, 37)] }, { cue: "fold" }),
  F(110, { neck: [1, 3], head: "dip", wingN: [0, -3], wingF: [0, -3], dy: -1, extra: [mini("down", -3, 27)] }, { cue: "launch" }),
  F(110, { neck: [0, 0], head: "rest", wingN: [0, -2], wingF: [0, -2], dy: -1, extra: [mini("up", -3, 15)] }),
  F(110, { neck: [0, -1], head: "up", wingN: [0, -1], wingF: [0, -1], extra: [mini("down", 2, 8)] }),
  F(110, { neck: [0, -1], head: "up", extra: [mini("up", 9, 3)] }),
  F(110, { neck: [0, -1], head: "up", extra: [mini("down", 18, 3)] }),
  F(120, { neck: [0, -1], head: "up", eye: "happy" }, { specks: sparkle(28, 4) }),
  F(140, { neck: [0, -1], head: "up", eye: "happy" }, { specks: sparkle(33, 3, false) }),
  F(160, { ...BOW, eye: "happy" }),
  F(300, { eye: "happy" }),
];

/** Everything is drawn round x MID; the frame keeps OX pixels more on the left (the beak, the pointing wing). */
const OX = 6;
const FW = W + OX + 1;
const shifted = (frames: readonly Frame[]): Frame[] =>
  frames.map((f) => ({
    ...f,
    layers: f.layers.map((l) => ({ ...l, x: l.x + OX })),
    ...(f.specks ? { specks: f.specks.map(([x, y, k]): Speck => [x + OX, y, k]).filter(([x, y]) => x >= 1 && y >= 1 && x <= FW - 2 && y <= H - 2) } : {}),
  }));

const anims: Record<string, Anim> = {
  idle: { loop: true, frames: shifted(IDLE) },
  entrance: { loop: false, frames: shifted(ENTRANCE) },
  thinking: { loop: true, frames: shifted(THINKING) },
  move: { loop: false, frames: shifted(MOVE) },
  capture: { loop: false, frames: shifted(CAPTURE) },
  hurt: { loop: false, frames: shifted(HURT) },
  check: { loop: false, frames: shifted(CHECK) },
  smug: { loop: false, frames: shifted(SMUG) },
  rattled: { loop: false, frames: shifted(RATTLED) },
  defeat: { loop: false, frames: shifted(DEFEAT) },
  victory: { loop: false, frames: shifted(VICTORY) },
};

export const FOLIO: Character = {
  id: "folio",
  name: "Folio",
  w: FW,
  h: H,
  foot: [MID + OX, GROUND],
  palette: FOLIO_PALETTE,
  halo: "#3b3530",
  parts: PARTS,
  anims,
};
