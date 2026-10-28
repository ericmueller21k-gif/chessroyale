/**
 * Folio's sidekick (id "sidekick-folio"): an origami frog folded from the same handwritten page as Folio. A town bot
 * that wanders the square and plays chess at the park's tables. No powers, never fights: a curious little one who copies
 * the big one, so it carries ONE small thing, a paper pawn folded from the same page, held up proudly in one front foot.
 *
 * Same paper as Folio (cream faces lit from the top left, a mid face, a shaded face, a darker crease where they meet;
 * faint blue-ink handwriting run along the big faces) and its tiny vermilion seal pressed on its back. Not a small
 * crane: a squat faceted frog, a big flat head with a wide happy mouth line and two round paper-bump eyes with dark
 * pupils, a folded Z of a hind leg ready to hop, a throat that puffs when it croaks. Three-quarters, facing our right.
 *
 * Rigging: every limb is painted from its points (hip, knee, ankle, toe), the body from a squash number, the head per
 * mouth and the eyes per look, so a pose is a handful of numbers (see Pose / build()).
 */
import { canvas, ellipse, inEllipse, inPoly, roundLight, shade, toGrid } from "../paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Speck } from "../sprite.ts";

export const SIDEKICK_FOLIO_PALETTE: Record<string, string> = {
  k: "#2b2330", // outline
  A: "#fff7e6", // paper: highlight (never pure white), lit face, mid face, shaded face, crease
  B: "#f3e7cc",
  C: "#d3bd95",
  D: "#a58e69",
  E: "#76624c",
  i: "#8a93b8", // ink (blue-black): on lit paper, on mid paper, on shaded paper
  j: "#717898",
  l: "#575c78",
  s: "#b3b9d2",
  x: "#1c1620", // the eyes and the mouth line
  U: "#7486c0",
  v: "#d8432a", // the seal: vermilion, pressed deeper (also the tongue and the inside of the mouth)
  w: "#a3301e",
  V: "#f4866b", // the seal's light, and the pawn's
  W: "#7e2416",
  G: "#f2c14e", // a glint
  H: "#fff0b4",
  g: "#b8862a",
  q: "#efae98", // blush
  e: "#a9c7ee", // sweat
  r: "#c98f4e", // stool wood, light to dark
  p: "#a06a33",
  P: "#6c4222",
  z: "#0c0d11", // ground shadow
};

type Pt = readonly [number, number];
const W = 68;
const H = 64;
const GROUND = 61;
const MIDX = 28;

const add2 = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
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
  o: Pt;
  d: Pt;
  gap?: number;
  key: string;
  seed: number;
}
interface Face {
  pts: readonly Pt[];
  key: string;
  hi?: string;
  lo?: string;
  ink?: Ink;
  seal?: Pt;
  flat?: boolean;
}
interface Drawing {
  faces: readonly Face[];
  creases?: readonly (readonly [Pt, Pt, string])[];
  dots?: readonly (readonly [number, number, string])[];
}

const SEAL = [".vvvvv", "vvvBvv", "vvvBvv", "vvBBBv", "vvvvvw", "vvvww."];
const SEAL_FLAT = [".vvBv.", "vvBBBv", "vvvvw."];

/** One line of cursive, `len` steps long: per step the lift off the line (0 on it, 1 a hump), or -1 for a blank. */
function script(li: number, seed: number, len: number): number[] {
  const a: number[] = [];
  for (let n = 0; a.length < len; n++) {
    const h = hash(li, n, seed + 3);
    const wl = 6 + (h % 7);
    const w: number[] = [0];
    for (let m = 0; w.length < wl; m++) {
      const r = hash(li, n * 17 + m, seed + 5);
      w.push(0, 0);
      if (r % 3 === 0) w.push(1, 1);
      else if (r % 3 === 1) w.push(0, 1);
    }
    a.push(...w);
    const gap = hash(li, n, seed + 6) % 5 === 0 ? 5 : 3;
    for (let i = 0; i < gap; i++) a.push(-1);
  }
  a.length = len;
  return a;
}

function inkPixels(ink: Ink, deep: (x: number, y: number) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  const [dx, dy] = unit(ink.d);
  const n: Pt = [-dy, dx];
  const g = ink.gap ?? 4;
  const lift: Pt = Math.abs(n[0]) > Math.abs(n[1]) ? [-Math.sign(n[0]), 0] : [0, -Math.sign(n[1])];
  const step = 1 / Math.max(Math.abs(dx), Math.abs(dy));
  for (let li = -10; li <= 10; li++) {
    const v = li * g;
    const sc = script(li + 20, ink.seed, 120);
    for (let k = -60; k < 60; k++) {
      const L = sc[k + 60];
      if (L === undefined || L < 0) continue;
      const u = k * step;
      const px = Math.floor(ink.o[0] + u * dx + v * n[0]) + lift[0] * L;
      const py = Math.floor(ink.o[1] + u * dy + v * n[1]) + lift[1] * L;
      if (deep(px, py)) out.set(`${px},${py}`, ink.key);
    }
  }
  return out;
}

function boxOf(d: Drawing): [number, number, number, number] {
  const xs = [...d.faces.flatMap((f) => f.pts.map((p) => p[0])), ...(d.dots ?? []).map((p) => p[0])];
  const ys = [...d.faces.flatMap((f) => f.pts.map((p) => p[1])), ...(d.dots ?? []).map((p) => p[1])];
  return [Math.floor(Math.min(...xs)) - 1, Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...xs)) + 1, Math.ceil(Math.max(...ys)) + 1];
}

function lineDots(a: Pt, b: Pt): [number, number][] {
  let [x0, y0] = [Math.round(a[0]), Math.round(a[1])];
  const [x1, y1] = [Math.round(b[0]), Math.round(b[1])];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: [number, number][] = [];
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return out;
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

function paintDrawing(d: Drawing) {
  const [x0, y0, x1, y1] = boxOf(d);
  const cv = canvas(x1 - x0 + 1, y1 - y0 + 1);
  const set = (X: number, Y: number, k: string) => {
    const row = cv[Y - y0];
    if (row && row[X - x0] !== undefined) row[X - x0] = k;
  };
  const get = (X: number, Y: number) => cv[Y - y0]?.[X - x0] ?? ".";
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
    const deep = (X: number, Y: number) => inside(X, Y) && inside(X - 1, Y) && inside(X + 1, Y) && inside(X, Y - 1) && inside(X, Y + 1);
    const sg = f.seal ? (f.flat ? SEAL_FLAT : SEAL) : null;
    const sx = f.seal ? Math.round(f.seal[0]) - 3 : 0;
    const sy = f.seal && sg ? Math.round(f.seal[1]) - Math.floor(sg.length / 2) : 0;
    if (f.ink) {
      const st = inkPixels(f.ink, deep);
      for (const [pos, k] of st) {
        const [X, Y] = pos.split(",").map(Number) as [number, number];
        if (sg && X >= sx - 1 && X <= sx + 6 && Y >= sy - 1 && Y <= sy + sg.length) continue;
        if ("ABCD".includes(get(X, Y))) set(X, Y, k);
      }
    }
    if (sg)
      sg.forEach((row, j) =>
        [...row].forEach((c, i) => {
          if (c !== "." && inside(sx + i, sy + j)) set(sx + i, sy + j, c);
        }),
      );
  }
  for (const [a, b, k] of d.creases ?? []) for (const [X, Y] of lineDots(a, b)) if (get(X, Y) !== ".") set(X, Y, k);
  for (const [X, Y, k] of d.dots ?? []) set(X, Y, k);
  return { grid: toGrid(cv), at: [x0, y0] as Pt };
}

const { parts: PARTS, add } = lazyParts();
const AT = new Map<string, Pt>();
/** A part by name, painted the first time it shows; its top-left from its points. */
function use(name: string, draw: () => Drawing): { name: string; at: Pt } {
  let at = AT.get(name);
  if (!at) {
    const d = draw();
    const b = boxOf(d);
    AT.set(name, (at = [b[0], b[1]]));
    add(name, () => ({ grid: paintDrawing(d).grid }));
  }
  return { name, at };
}

// ---- The body: a faceted bean. Lit back, shaded belly, the seal pressed on the back.

function bodyDrawing(s: number): Drawing {
  const RB: Pt = [12 - s * 0.3, 56];
  const RT: Pt = [10 - s * 0.5, 44 + s * 0.4];
  const BK: Pt = [13, 33 + s];
  const TP: Pt = [22, 28 + s];
  const NK: Pt = [33, 28 + s];
  const CH: Pt = [43 + s * 0.5, 40 + s * 0.4];
  const BF: Pt = [42 + s * 0.4, 55];
  const BM: Pt = [28, 59];
  const X: Pt = [26, 43 + s * 0.3];
  return {
    faces: [
      { pts: [RT, BK, TP, NK, CH, X], key: "B", hi: "A", ink: { o: [10, 31], d: [1, 0.15], key: "s", seed: 1, gap: 5 }, seal: [18, 34 + s] },
      { pts: [RT, X, CH, BF, BM, RB], key: "D", lo: "E", ink: { o: [14, 50], d: [1, -0.2], key: "l", seed: 2, gap: 5 } },
    ],
  };
}

// ---- The head: a wide flat wedge. A forehead face (lit), a jaw face (shaded), the mouth between.

type Mouth = "smile" | "grin" | "flat" | "smirk" | "wavy" | "o" | "tongue";
const MOUTH_LINE: Record<Exclude<Mouth, "grin" | "o">, readonly Pt[]> = {
  smile: [[50, 35], [46, 37], [40, 37.5], [35, 36], [33, 33]],
  flat: [[50, 36], [36, 36]],
  smirk: [[50, 34], [46, 36], [38, 37], [34, 37]],
  wavy: [[36, 36], [38, 35], [40, 37], [42, 35], [44, 37], [46, 35], [48, 36]],
  tongue: [[50, 35], [46, 37], [40, 37.5], [35, 36], [33, 33]],
};

function headDrawing(mouth: Mouth, blush: boolean): Drawing {
  const dots: [number, number, string][] = [];
  const put = (x: number, y: number, k: string) => dots.push([x, y, k]);
  if (mouth === "grin") {
    // An open smile: the line's top edge, a deep red inside, a tongue.
    const top = [[50, 34], [43, 35], [37, 35], [34, 33]] as const;
    for (let x = 36; x <= 50; x++) for (let y = 35; y <= 40; y++) if (inPoly([[36, 35], [50, 35], [48, 39], [43, 41], [38, 40]])(x, y)) put(x, y, "w");
    for (let x = 40; x <= 46; x++) for (let y = 38; y <= 40; y++) if (inPoly([[39, 38], [47, 38], [46, 41], [41, 41]])(x, y)) put(x, y, "v");
    for (let i = 0; i + 1 < top.length; i++) for (const [x, y] of lineDots(top[i]!, top[i + 1]!)) put(x, y, "x");
    for (const [a, b] of [[[36, 35], [38, 40]], [[38, 40], [43, 41]], [[43, 41], [48, 39]], [[48, 39], [50, 35]]] as const) for (const [x, y] of lineDots(a, b)) put(x, y, "x");
  } else if (mouth === "o") {
    [".xxxx.", "xwwwwx", "xwvvwx", ".xwwx."].forEach((r, j) => [...r].forEach((c, i) => c !== "." && put(41 + i, 35 + j, c)));
  } else {
    const pts = MOUTH_LINE[mouth];
    for (let i = 0; i + 1 < pts.length; i++) for (const [x, y] of lineDots(pts[i]!, pts[i + 1]!)) put(x, y, "x");
    if (mouth === "tongue") ["vv", "vv", "vw", "ww"].forEach((r, j) => [...r].forEach((c, i) => put(44 + i, 38 + j, c)));
  }
  if (blush) for (const [x, y] of [[31, 31], [32, 31], [31, 32], [32, 32]] as const) put(x, y, "q");
  put(47, 28, "E");
  return {
    faces: [
      { pts: [[26, 27], [29, 21], [34, 19.5], [43, 19.5], [40, 27], [34, 34.5], [28, 33]], key: "B", hi: "A" },
      { pts: [[43, 19.5], [48, 25], [51, 30], [51, 34], [34, 35], [34, 34.5], [40, 27]], key: "C", hi: "B" },
      { pts: [[28, 33], [34, 35], [51, 34], [50, 40], [44, 43], [31, 42], [27, 38]], key: "C", lo: "D", ink: { o: [30, 40], d: [1, 0.05], key: "j", seed: 3, gap: 4 } },
    ],
    creases: [[[28, 33], [31, 38], "D"]],
    dots,
  };
}

// ---- The eyes: round paper bumps (lit top left) with a dark pupil, or lids and marks.

type EyeKind = "open" | "blink" | "arc" | "half" | "worry" | "bold" | "wide" | "pinch" | "x";
interface EyeSpec {
  kind: EyeKind;
  px?: number;
  py?: number;
}
const PUPIL: Record<number, readonly string[]> = {
  8: [".xxx.", "xxxxx", "xxxxx", "xxxxx", ".xxx."],
  7: [".xx.", "xxxx", "xxxx", ".xx."],
};
function eyeGrid(size: number, e: EyeSpec, side: "near" | "far"): string[] {
  const cv = canvas(size, size);
  const c = size / 2;
  shade(cv, inEllipse(c, c, c, c), "DCBBA", roundLight(c, c, c, c));
  const inside = inEllipse(c, c, c, c);
  const mark = (pts: readonly Pt[]) => {
    for (let i = 0; i + 1 < pts.length; i++) for (const [x, y] of lineDots(pts[i]!, pts[i + 1]!)) if (cv[y]?.[x] !== undefined) cv[y]![x] = "x";
  };
  const pupil = (px: number, py: number) => {
    PUPIL[size]!.forEach((r, j) => [...r].forEach((ch, i) => ch === "x" && cv[py + j]?.[px + i] !== undefined && (cv[py + j]![px + i] = "x")));
    if (cv[py + 1]?.[px + 1] !== undefined) cv[py + 1]![px + 1] = "A";
  };
  const px = e.px ?? 2;
  const py = e.py ?? 2;
  const s = size - 1;
  switch (e.kind) {
    case "open":
      pupil(px, py);
      break;
    case "blink":
      mark([[1, size / 2 + 1], [s - 1, size / 2 + 1]]);
      break;
    case "arc":
      for (const [x, y] of size === 8 ? [[3, 3], [4, 3], [2, 4], [5, 4], [1, 5], [2, 5], [5, 5], [6, 5]] : [[3, 3], [2, 4], [4, 4], [1, 5], [2, 5], [4, 5], [5, 5]]) cv[y!]![x!] = "x";
      break;
    case "wide":
      for (const [x, y] of [[c - 1, c - 1], [c, c - 1], [c - 1, c], [c, c]] as const) cv[Math.floor(y)]![Math.floor(x)] = "x";
      break;
    case "pinch": {
      // A fat chevron: '>' on the near eye, '<' on the far one.
      const chev = size === 8 ? [".xx.....", "..xxx...", "....xxx.", "....xxx.", "..xxx...", ".xx....."] : ["...xx..", "..xxx..", ".xxx...", ".xxx...", "..xxx..", "...xx.."];
      chev.forEach((r, j) =>
        [...r].forEach((ch, i) => {
          const x = size === 8 && side === "far" ? s - i : size === 7 && side === "near" ? s - i : i;
          if (ch === "x" && cv[j + 1]?.[x] !== undefined) cv[j + 1]![x] = "x";
        }),
      );
      break;
    }
    case "x":
      mark([[1, 1], [s - 1, s - 1]]);
      mark([[1, s - 1], [s - 1, 1]]);
      break;
    default: {
      pupil(px, py + 1);
      // A lid across the top: paper, with a dark edge. Worried lids slope down to the outside, bold ones to the inside.
      const base = e.kind === "half" ? 3 : 2.4;
      const slope = e.kind === "half" ? 0 : e.kind === "worry" ? 0.4 : -0.4;
      const outer = side === "near" ? (x: number) => s - x : (x: number) => x;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          if (!inside(x, y)) continue;
          const lid = base + slope * (outer(x) - s / 2);
          if (y < Math.round(lid) - 0.01) cv[y]![x] = "C";
          else if (y === Math.round(lid)) cv[y]![x] = "x";
        }
    }
  }
  return toGrid(cv) as string[];
}
const eyePart = (size: number, e: EyeSpec, side: "near" | "far"): string => {
  const name = `eye:${size}:${e.kind}:${e.px ?? 2}:${e.py ?? 2}:${side}`;
  add(name, () => ({ grid: eyeGrid(size, e, side) }));
  return name;
};

export type Mood = "calm" | "blink" | "happy" | "cheer" | "think" | "thinkBlink" | "glance" | "smug" | "rattled" | "hurt" | "out" | "bold" | "worry";
const FACES: Record<Mood, { near: EyeSpec; far: EyeSpec; mouth: Mouth; blush?: boolean }> = {
  calm: { near: { kind: "open", px: 3, py: 2 }, far: { kind: "open", px: 2, py: 2 }, mouth: "smile", blush: true },
  blink: { near: { kind: "blink" }, far: { kind: "blink" }, mouth: "smile", blush: true },
  happy: { near: { kind: "arc" }, far: { kind: "arc" }, mouth: "grin", blush: true },
  cheer: { near: { kind: "open", px: 3, py: 2 }, far: { kind: "open", px: 2, py: 2 }, mouth: "grin", blush: true },
  think: { near: { kind: "open", px: 3, py: 1 }, far: { kind: "open", px: 2, py: 1 }, mouth: "flat" },
  thinkBlink: { near: { kind: "blink" }, far: { kind: "blink" }, mouth: "flat" },
  glance: { near: { kind: "open", px: 3, py: 2 }, far: { kind: "open", px: 3, py: 2 }, mouth: "smile", blush: true },
  smug: { near: { kind: "half", px: 3, py: 2 }, far: { kind: "half", px: 2, py: 2 }, mouth: "smirk", blush: true },
  rattled: { near: { kind: "wide" }, far: { kind: "wide" }, mouth: "wavy" },
  hurt: { near: { kind: "pinch" }, far: { kind: "pinch" }, mouth: "o" },
  out: { near: { kind: "x" }, far: { kind: "x" }, mouth: "tongue" },
  bold: { near: { kind: "bold", px: 3, py: 2 }, far: { kind: "bold", px: 2, py: 2 }, mouth: "grin", blush: true },
  worry: { near: { kind: "worry", px: 2, py: 2 }, far: { kind: "worry", px: 2, py: 2 }, mouth: "wavy" },
};
const NEAR_EYE: Pt = [29, 14];
const FAR_EYE: Pt = [39, 13];

// ---- Limbs: paper strips folded at the joints. Each segment has a lit face and a shaded face, a crease across the joint.

function limbDrawing(pts: readonly Pt[], hw: readonly number[], far: boolean): Drawing {
  const n = pts.length;
  const dirs: Pt[] = [];
  for (let i = 0; i + 1 < n; i++) dirs.push(unit([pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]]));
  const left = (d: Pt): Pt => [d[1], -d[0]];
  const Ls: Pt[] = [];
  const Rs: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? left(dirs[i - 1]!) : left(dirs[0]!);
    const b = i < n - 1 ? left(dirs[i]!) : left(dirs[n - 2]!);
    let m = unit([a[0] + b[0], a[1] + b[1]]);
    if (m[0] === 0 && m[1] === 0) m = b;
    const dot = Math.max(0.5, m[0] * b[0] + m[1] * b[1]);
    const len = Math.min(hw[i]! / dot, hw[i]! * 1.8);
    Ls.push([pts[i]![0] + m[0] * len, pts[i]![1] + m[1] * len]);
    Rs.push([pts[i]![0] - m[0] * len, pts[i]![1] - m[1] * len]);
  }
  const lit = far ? "C" : "B";
  const hi = far ? "B" : "A";
  const sh = far ? "D" : "C";
  const lo = far ? "E" : "D";
  const faces: Face[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const l = left(dirs[i]!);
    const leftIsLit = l[0] + l[1] <= 0;
    const litSide = leftIsLit ? Ls : Rs;
    const shSide = leftIsLit ? Rs : Ls;
    faces.push({ pts: [pts[i]!, pts[i + 1]!, litSide[i + 1]!, litSide[i]!], key: lit, hi });
    faces.push({ pts: [pts[i]!, pts[i + 1]!, shSide[i + 1]!, shSide[i]!], key: sh, lo });
  }
  const creases: [Pt, Pt, string][] = [];
  for (let i = 1; i < n - 1; i++) creases.push([Ls[i]!, Rs[i]!, far ? "E" : "D"]);
  return { faces, creases };
}
const limb = (pts: readonly Pt[], hw: readonly number[], far: boolean, dx = 0, dy = 0) => {
  const P = pts.map((p) => [p[0], p[1]] as Pt);
  return use(`limb:${far ? "f" : "n"}:${P.map((p) => p.join(",")).join(";")}:${hw.join(",")}`, () => limbDrawing(P, hw, far));
};

interface LegSpec {
  pts: readonly Pt[];
  hw: readonly number[];
}
/**
 * The hind leg: a haunch folded as a four-faced pyramid (left, top, knee, bottom corners), and the lower leg and foot
 * as a paper strip in front of it.
 */
interface HindSpec {
  /** The haunch: a folded pyramid (left, top, knee and bottom corners). */
  haunch: readonly [Pt, Pt, Pt, Pt];
  /** The lower leg and foot: a strip in front of it. */
  strip: readonly Pt[];
  hw: readonly number[];
}
const FOOT_HW = [2.8, 1];
const LEGS: Record<string, HindSpec> = {
  rest: { haunch: [[4, 49], [15, 38], [33, 48], [20, 58]], strip: [[12, 58.2], [38, 60.2]], hw: FOOT_HW },
  crouch: { haunch: [[4, 50], [15, 41], [33, 50], [20, 58]], strip: [[12, 58.2], [38, 60.2]], hw: FOOT_HW },
  coil: { haunch: [[4, 51], [14, 43], [33, 51], [19, 58]], strip: [[12, 58.2], [38, 60.2]], hw: FOOT_HW },
  land: { haunch: [[3, 51], [14, 43], [34, 51], [19, 58]], strip: [[11, 58.2], [38, 60.2]], hw: FOOT_HW },
  push: { haunch: [[5, 49], [12, 41], [28, 50], [16, 57]], strip: [[8, 56.5], [26, 60]], hw: FOOT_HW },
  air: { haunch: [[5, 44], [11, 39], [24, 46], [14, 52]], strip: [[11, 50], [3.5, 58]], hw: [3, 1.2] },
  tuck: { haunch: [[5, 47], [13, 40], [30, 48], [20, 55]], strip: [[14, 53], [32, 55.5]], hw: FOOT_HW },
  tap: { haunch: [[4, 49], [15, 38], [33, 48], [20, 58]], strip: [[12, 58.2], [38, 57.2]], hw: FOOT_HW },
  sit: { haunch: [[4, 51], [15, 41], [33, 52], [20, 60]], strip: [[31, 53], [33, 62], [39, 65.5]], hw: [3, 2.4, 1] },
  swing: { haunch: [[4, 51], [15, 41], [33, 52], [20, 60]], strip: [[31, 53], [36, 62], [42, 64.5]], hw: [3, 2.4, 1] },
  splay: { haunch: [[3, 52], [12, 47], [28, 54], [16, 58.5]], strip: [[10, 58.2], [30, 59.4]], hw: [2.6, 1] },
};

/** A pyramid folded flat: four faces round a middle, lit from the top left. */
function haunchDrawing([Lf, T, K, B]: HindSpec["haunch"]): Drawing {
  const O: Pt = [(Lf[0] + T[0] + K[0] + B[0]) / 4, (Lf[1] + T[1] + K[1] + B[1]) / 4];
  return {
    faces: [
      { pts: [T, O, Lf], key: "B", hi: "A", ink: { o: T, d: unit([1, 1]), key: "s", seed: 11, gap: 5 } },
      { pts: [T, K, O], key: "C", hi: "B", ink: { o: O, d: unit([1, -0.5]), key: "i", seed: 12, gap: 5 } },
      { pts: [Lf, O, B], key: "C" },
      { pts: [O, K, B], key: "D", lo: "E" },
    ],
    creases: [[T, B, "D"], [Lf, K, "D"]],
  };
}
const haunch = (h: HindSpec["haunch"]) => use(`haunch:${h.map((p) => p.join(",")).join(";")}`, () => haunchDrawing(h));
const HW_ARM = [3.6, 2.6, 2];
const ARMS: Record<string, LegSpec> = {
  hold: { pts: [[40, 47], [44, 56], [52, 50]], hw: HW_ARM },
  up: { pts: [[40, 47], [48, 53], [55, 43]], hw: HW_ARM },
  high: { pts: [[40, 47], [50, 52], [59, 36]], hw: HW_ARM },
  waveL: { pts: [[40, 47], [49, 52], [56, 38]], hw: HW_ARM },
  waveR: { pts: [[40, 47], [50, 52], [60, 37]], hw: HW_ARM },
  point: { pts: [[40, 47], [48, 53], [58, 49]], hw: HW_ARM },
  reach: { pts: [[40, 47], [47, 50], [54, 47]], hw: HW_ARM },
  down: { pts: [[40, 47], [44, 56], [47, 59]], hw: HW_ARM },
  lap: { pts: [[40, 47], [46, 55], [53, 53]], hw: HW_ARM },
  chin: { pts: [[40, 47], [46, 52], [47, 41]], hw: [3.2, 2.6, 2.8] },
};
const FAR_ARMS: Record<string, LegSpec> = {
  stand: { pts: [[43, 47], [45, 57], [51, 59.8]], hw: [2.5, 2.2, 1.2] },
  reach: { pts: [[43, 47], [50, 50], [55, 50]], hw: [2.5, 2.2, 1.2] },
  sit: { pts: [[43, 47], [46, 54], [52, 55]], hw: [2.5, 2.2, 1.2] },
};

/** The paper pawn the frog carries. */
const PAWN = ["..VVv..", ".VVvvw.", ".vvvww.", "..vvw..", "...vw..", "..Vvww.", ".Vvvwwo", "Vvvwwoo"].map((r) => r.replace(/o/g, "W"));
add("pawn", () => ({ grid: PAWN }));
/** The stool at the chess table. */
const STOOL = [
  "rrrrrrrrrrrrrrrrrrrrrrrrrrrr",
  "pppppppppppppppppppppppppppp",
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "...pP..................pP...",
  "...pP..................pP...",
  "...pPPPPPPPPPPPPPPPPPPPPpP...",
  "...pP..................pP...",
  "...pP..................pP...",
  "...pP..................pP...",
];
add("stool", () => ({ grid: STOOL }));

function shadowPart(rx: number): string {
  const name = `shadow:${rx}`;
  add(name, () => {
    const cv = canvas(2 * rx + 2, 3);
    ellipse(cv, rx + 1, 1.5, rx + 1, 1.5, "z");
    return { grid: toGrid(cv), outline: false };
  });
  return name;
}
/** The tongue: a red strip out of the mouth, `len` long. */
function tonguePart(len: number): string {
  const name = `tongue:${len}`;
  add(name, () => ({ grid: ["w".repeat(len), "v".repeat(len - 1) + "w", "w".repeat(len)] }));
  return name;
}
/** The throat sac puffed under the chin. */
function sacPart(size: number): string {
  const name = `sac:${size}`;
  add(name, () => {
    const rx = size === 1 ? 4.5 : 6.5;
    const ry = size === 1 ? 3 : 4.5;
    const cv = canvas(Math.ceil(rx * 2), Math.ceil(ry * 2));
    shade(cv, inEllipse(rx, ry, rx, ry), "DCqqB", roundLight(rx, ry, rx, ry));
    return { grid: toGrid(cv) };
  });
  return name;
}
for (const sz of [1, 2]) sacPart(sz);

// ---- Poses.

export interface Pose {
  mood?: Mood;
  dx?: number;
  dy?: number;
  /** Body squash: + lower and wider (a crouch), - taller and narrower (a breath in, a stretch). The head follows. */
  sq?: number;
  hx?: number;
  hy?: number;
  leg?: keyof typeof LEGS;
  arm?: keyof typeof ARMS;
  farArm?: keyof typeof FAR_ARMS;
  /** The hand's lift (the pawn goes with it). */
  ay?: number;
  /** The pawn: in the hand (default), or put somewhere (top-left), or none. */
  pawn?: "hand" | "none" | Pt;
  sit?: boolean;
  sac?: 0 | 1 | 2;
  tongue?: number;
  /** Ground shadow half-width (default 19, less in the air). */
  shadow?: number;
  /** Paper pawn dx/dy relative to the hand. */
  po?: Pt;
  /** Extra layers on top of the head (a captured piece). */
  extra?: readonly Layer[];
}

function build(p: Pose): Layer[] {
  const dx = p.dx ?? 0;
  const sit = !!p.sit;
  const dy = (p.dy ?? 0) + (sit ? -7 : 0);
  const sq = p.sq ?? 0;
  const L: Layer[] = [];
  const at = (s: { name: string; at: Pt }, ox = 0, oy = 0) => L.push({ part: s.name, x: s.at[0] + dx + ox, y: s.at[1] + dy + oy });
  const air = Math.max(0, -(p.dy ?? 0));
  const rx = p.shadow ?? Math.max(11, Math.round(19 - air * 0.6));
  L.push({ part: shadowPart(rx), x: MIDX - rx - 1, y: GROUND - 2 });
  if (sit) L.push({ part: "stool", x: 5, y: 52 });
  const legSpec = LEGS[p.leg ?? (sit ? "sit" : "rest")]!;
  if (sit) at(limb(legSpec.strip.map((q) => [q[0] + 3, q[1] + 1] as Pt), legSpec.hw, true));
  const armSpec = ARMS[p.arm ?? (sit ? "lap" : "hold")]!;
  const farSpec = FAR_ARMS[p.farArm ?? (sit ? "sit" : "stand")]!;
  at(limb(farSpec.pts, farSpec.hw, true));
  at(use(`body:${sq}`, () => bodyDrawing(sq)));
  at(haunch(legSpec.haunch));
  at(limb(legSpec.strip, legSpec.hw, false));
  // The pawn, then the hand over it.
  const ay = p.ay ?? 0;
  const hand = armSpec.pts[armSpec.pts.length - 1]!;
  const pawn = p.pawn ?? "hand";
  const aPts = armSpec.pts.map((q, i): Pt => (i === armSpec.pts.length - 1 ? [q[0], q[1] + ay] : i === 1 ? [q[0], q[1] + Math.round(ay / 2)] : q));
  const armLayer = limb(aPts, armSpec.hw, false);
  const armFront = (p.arm ?? "") === "chin";
  if (!armFront) at(armLayer);
  // The pawn sits on the hand (drawn over it, so the whole piece shows), or stands where it was put.
  if (pawn !== "none") {
    const po = p.po ?? [0, 0];
    if (pawn === "hand") L.push({ part: "pawn", x: hand[0] - 3 + dx + po[0], y: hand[1] - 6 + dy + ay + po[1] });
    else L.push({ part: "pawn", x: pawn[0] + dx, y: pawn[1] + dy });
  }
  // The head: the throat behind the chin, the tongue behind the lip, then the head and its eyes.
  const hx = p.hx ?? 0;
  const hy = sq + (p.hy ?? 0);
  if (p.sac) L.push({ part: sacPart(p.sac), x: (p.sac === 1 ? 35 : 32) + dx + hx, y: (p.sac === 1 ? 41 : 40) + dy + hy });
  if (p.tongue) L.push({ part: tonguePart(p.tongue), x: 50 + dx + hx, y: 35 + dy + hy });
  const mood = p.mood ?? "calm";
  const face = FACES[mood];
  const headName = `head:${face.mouth}:${face.blush ? 1 : 0}`;
  const h = use(headName, () => headDrawing(face.mouth, !!face.blush));
  at(h, hx, hy);
  L.push({ part: eyePart(7, face.far, "far"), x: FAR_EYE[0] + dx + hx, y: FAR_EYE[1] + dy + hy });
  L.push({ part: eyePart(8, face.near, "near"), x: NEAR_EYE[0] + dx + hx, y: NEAR_EYE[1] + dy + hy });
  if (armFront) at(armLayer);
  for (const e of p.extra ?? []) L.push({ ...e, x: e.x + dx, y: e.y + dy });
  return L;
}

// ---- Specks and little effects.

function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
}
const sparkle = (x: number, y: number, big = true): Speck[] => (big ? [[x, y, "H"], [x - 1, y, "G"], [x + 1, y, "G"], [x, y - 1, "G"], [x, y + 1, "G"]] : [[x, y, "H"]]);
/** Bits of paper flying off: cream and ink-blue specks round a point. */
function bits(cx: number, cy: number, t: number, n = 6, r = 10): Speck[] {
  const rnd = seeded(t * 13 + 7);
  return Array.from({ length: n }, (_, i): Speck[] => {
    const a = rnd() * Math.PI * 2;
    const d = 8 + rnd() * r;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(cy + Math.sin(a) * d * 0.8);
    return i % 3 === 0 ? [[x, y, "U"], [x + 1, y, "i"]] : [[x, y, "A"], [x + 1, y, "B"], [x, y + 1, "C"]];
  }).flat();
}
/** A flat flutter of paper along the ground at the feet. */
const flutter = (t: number): Speck[] =>
  [-1, 1].flatMap((side) => [0, 1, 2].map((i): Speck => [Math.round(MIDX + side * (14 + i * 3 + t * 2)), GROUND - 2 - (i % 2) - (t > 0 ? 1 : 0), i === 1 ? "A" : "C"]));
/** A tiny crease flashing on the thigh, and a glint. */
const crinkle = (t: number): Speck[] =>
  t === 0
    ? [[8, 46, "E"], [9, 45, "E"], [10, 46, "E"], [11, 45, "E"], [12, 46, "E"], [9, 47, "D"], [11, 47, "D"], [13, 44, "H"]]
    : [[9, 45, "D"], [10, 46, "D"], [11, 45, "D"], [12, 44, "A"], [14, 43, "H"], [13, 44, "G"]];
const QMARK = [".UU.", "U..U", "..U.", ".U..", "....", ".U.."];
const thoughts = (n: number): Speck[] => {
  const dots = ([[54, 24], [57, 19]] as const).slice(0, Math.min(n, 2)).flatMap(([x, y]): Speck[] => [[x, y, "A"], [x + 1, y, "A"], [x, y + 1, "B"], [x + 1, y + 1, "C"]]);
  const q: Speck[] = n >= 3 ? QMARK.flatMap((r, j) => [...r].flatMap((c, i): Speck[] => (c === "U" ? [[59 + i, 7 + j, "U"]] : []))) : [];
  return [...dots, ...q];
};
const sweat = (i: number): Speck[] => {
  const t = i % 4;
  const drop = (x: number, y: number): Speck[] => [[x, y, "A"], [x - 1, y + 1, "e"], [x, y + 1, "e"], [x + 1, y + 1, "e"], [x, y + 2, "e"]];
  return [...drop(25 - t, 15 + t), ...drop(53 + t, 15 + t)];
};

const FLASH: Record<string, string> = { A: "#ffffff", B: "#fffaf0", C: "#f3e7cc", D: "#d3bd95", E: "#a58e69" };

function f(ms: number, p: Pose, extra: Partial<Frame> = {}): Frame {
  const specks = (extra.specks ?? []).filter(([x, y]) => x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2);
  return { ms, layers: build(p), ...extra, specks };
}

// ---- Animations.

/** Idle (3 s): breathes (the body flexes a pixel, the throat flutters), blinks twice, glances ahead, a paper crinkle. */
const idle: Anim = {
  loop: true,
  frames: Array.from({ length: 20 }, (_, i) => {
    const ph = i % 10;
    const inhale = ph >= 2 && ph <= 5;
    const blink = i === 8 || i === 17 || i === 18;
    const glance = i >= 11 && i <= 14;
    return f(150, { sq: inhale ? -1 : 0, ay: inhale ? -1 : 0, mood: blink ? "blink" : glance ? "glance" : "calm", sac: ph === 7 || ph === 8 ? 1 : 0, hx: glance ? 1 : 0 }, { specks: i === 13 ? crinkle(0) : i === 14 ? crinkle(1) : [] });
  }),
};

/** Walk (0.6 s): a hop: a crouch, a push off, a stretch in the air, a drop, a squashed landing with a flutter of paper. */
const walk: Anim = {
  loop: true,
  frames: [
    f(100, { sq: 3, leg: "coil", ay: 1, mood: "calm" }),
    f(90, { sq: -1, dy: -3, leg: "push", arm: "reach", farArm: "reach", hx: 1, mood: "cheer" }, { cue: "hop" }),
    f(100, { sq: -2, dy: -8, leg: "air", arm: "reach", farArm: "reach", hx: 1, mood: "happy" }),
    f(90, { sq: -1, dy: -4, leg: "tuck", arm: "reach", farArm: "reach", mood: "cheer" }),
    f(100, { sq: 3, leg: "land", ay: 1, mood: "blink" }, { cue: "step", specks: flutter(0) }),
    f(90, { sq: 1, leg: "crouch", mood: "calm" }, { specks: flutter(1) }),
  ],
};

/** Sit (loops): on the stool facing the board, legs dangling, the pawn low in its lap; a slow blink, leaning to think a move. */
const sit: Anim = {
  loop: true,
  frames: Array.from({ length: 16 }, (_, i) => {
    const lean = i >= 6 && i <= 11;
    const blink = i === 3 || i === 4 || i === 13;
    const swing = i % 8 < 4;
    return f(200, { sit: true, leg: swing ? "sit" : "swing", sq: i % 8 >= 4 ? -1 : 0, mood: blink ? (lean ? "thinkBlink" : "blink") : lean ? "think" : "calm", hx: lean ? 1 : 0, hy: lean ? 1 : 0 });
  }),
};

/** Wave (once, 1.2 s): a little hop, then the pawn held high and waved hello, then it settles. */
const WAVES = ["waveL", "waveR", "waveL", "waveR"] as const;
const wave: Anim = {
  loop: false,
  frames: [
    f(100, { sq: 3, leg: "coil", mood: "happy" }),
    f(90, { sq: -2, dy: -5, leg: "air", arm: "up", mood: "cheer" }, { cue: "hop" }),
    f(100, { sq: 2, leg: "land", arm: "up", mood: "happy" }, { cue: "step", specks: flutter(0) }),
    ...WAVES.map((arm, i) => f(110, { arm, mood: i % 2 ? "cheer" : "happy", sq: i % 2 ? 0 : -1, hx: i % 2, sac: i === 3 ? 1 : 0 })),
    f(110, { arm: "up", mood: "happy" }),
    f(110, { arm: "hold", mood: "happy", ay: 0 }),
    f(150, { mood: "calm" }),
  ],
};

// ---- The page on its own (the entrance and the defeat): a loose sheet, and the sheet creased into a square corner-up.

function pageDrawing(skew: number, h: number, w: number): Drawing {
  const t = -h / 2;
  const b = h / 2;
  const pts: Pt[] = [[-w / 2 + skew, t], [w / 2 + skew, t], [w / 2 - skew, b], [-w / 2 - skew, b]];
  const thin = h < 9;
  return {
    faces: [{ pts, key: thin ? "C" : "B", hi: "A", lo: thin ? "D" : "C", ink: { o: [0, t + 1], d: [1, 0], gap: thin ? 3 : 4, key: thin ? "i" : "s", seed: 7 }, ...(h >= 5 ? { seal: [w / 4 - skew * 0.3, thin ? 0 : (h / 34) * 8] as Pt, flat: thin } : {}) }],
  };
}
function squareDrawing(r: number): Drawing {
  const T: Pt = [0, -r];
  const R: Pt = [r, 0];
  const B: Pt = [0, r];
  const Lf: Pt = [-r, 0];
  const O: Pt = [0, 0];
  const d: Pt = unit([1, 1]);
  return {
    faces: [
      { pts: [T, O, Lf], key: "B", hi: "A", ink: { o: O, d, key: "s", seed: 8, gap: 4 }, seal: [-r * 0.42, -r * 0.3] },
      { pts: [T, R, O], key: "C", ink: { o: O, d, key: "i", seed: 8, gap: 4 } },
      { pts: [Lf, O, B], key: "C", ink: { o: O, d, key: "i", seed: 8, gap: 4 } },
      { pts: [O, R, B], key: "D", ink: { o: O, d, key: "l", seed: 8, gap: 4 } },
    ],
    creases: [[T, B, "E"], [Lf, R, "E"]],
  };
}
const page = (skew: number, h: number, w: number) => use(`page:${skew}:${h}:${w}`, () => pageDrawing(skew, h, w));
const square = (r: number) => use(`square:${r}`, () => squareDrawing(r));
function pageFrame(ms: number, d: { name: string; at: Pt }, cx: number, cy: number, rx: number, extra: Partial<Frame> = {}, pawn?: Pt): Frame {
  const layers: Layer[] = [{ part: shadowPart(rx), x: MIDX - rx - 1, y: GROUND - 2 }, { part: d.name, x: d.at[0] + cx, y: d.at[1] + cy }];
  if (pawn) layers.push({ part: "pawn", x: pawn[0], y: pawn[1] });
  return { ms, layers, ...extra };
}

/** Entrance: a loose page drifts down, rocking (cue rustle), lands flat, folds into a square (cue fold), and pops open into the frog (cue pop) with a puff of paper: a hop, a hello. */
const HELLO = ["waveL", "waveR", "waveL", "waveR"] as const;
const entrance: Anim = {
  loop: false,
  frames: [
    { ms: 140, layers: [{ part: shadowPart(3), x: MIDX - 4, y: GROUND - 2 }] },
    pageFrame(120, page(4, 12, 18), 30, 10, 6, { cue: "rustle" }),
    pageFrame(120, page(-3, 8, 24), 26, 22, 9),
    pageFrame(120, page(5, 14, 28), 29, 35, 12, { cue: "rustle" }),
    pageFrame(120, page(-3, 8, 32), 28, 47, 15),
    pageFrame(150, page(0, 5, 34), 28, 57, 18, { cue: "rustle" }),
    pageFrame(150, square(10), 28, 50, 15, { cue: "fold", specks: sparkle(28, 36) }),
    f(100, { sq: 4, leg: "coil", mood: "blink", ay: 2 }, { cue: "pop", specks: bits(28, 46, 1, 10, 16) }),
    f(90, { sq: -2, dy: -7, leg: "air", arm: "up", mood: "happy" }, { specks: bits(28, 40, 2, 6, 18) }),
    f(80, { sq: -1, dy: -3, leg: "tuck", arm: "up", mood: "cheer" }),
    f(100, { sq: 3, leg: "land", arm: "up", mood: "happy" }, { cue: "step", specks: flutter(0) }),
    ...HELLO.map((arm, i) => f(110, { arm, mood: i % 2 ? "cheer" : "happy", sq: i % 2 ? 0 : -1, hx: i % 2 }, { specks: i === 1 ? sparkle(60, 24) : [] })),
    f(120, { arm: "hold", mood: "happy" }),
    f(300, { mood: "calm" }),
  ],
};

/** Thinking (loops): head tipped up, eyes rolled up, a foot on its chin, the pawn set down beside it, a toe tapping, thought dots popping up. */
const thinking: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) =>
    f(150, { mood: i === 8 ? "thinkBlink" : "think", arm: "chin", pawn: [51, 53], hx: 1, hy: -1, sq: i % 6 >= 3 ? 0 : -1, leg: i % 4 === 1 ? "tap" : "rest", farArm: "stand" }, { specks: thoughts(i % 6 < 1 ? 0 : i % 6 < 3 ? 1 : i % 6 < 5 ? 2 : 3) }),
  ),
};

/** Its move: a crouch, a hop toward the board, the pawn pressed down onto it (a spark of ink), then picked up again. */
const move: Anim = {
  loop: false,
  frames: [
    f(90, { sq: 3, leg: "coil", mood: "bold" }),
    f(80, { dx: 1, dy: -4, sq: -1, leg: "push", arm: "point", mood: "bold" }, { cue: "hop" }),
    f(80, { dx: 2, dy: -5, sq: -2, leg: "air", arm: "point", mood: "bold" }),
    f(100, { dx: 2, sq: 3, leg: "land", arm: "point", mood: "happy" }, { cue: "step", specks: flutter(0) }),
    f(110, { dx: 2, sq: 1, leg: "crouch", arm: "point", ay: 4, mood: "happy" }, { cue: "tap", specks: sparkle(64, 54) }),
    f(120, { dx: 2, arm: "point", mood: "happy" }),
    f(110, { dx: 1, arm: "hold", mood: "happy" }),
    f(150, { mood: "calm" }),
  ],
};

/** Capture: it flicks its tongue out at a paper piece (cue flick), reels it in, gulps (the throat puffs), and hops for joy. */
const PIECE = ["..ABB..", ".ABBBC.", ".BBBCC.", "..BBC..", "...BC..", "..ABCD.", ".ABBCCD", "ABBCCDD"];
add("piece", () => ({ grid: PIECE }));
const piece = (x: number, y: number): Layer[] => [{ part: "piece", x, y }];
const capture: Anim = {
  loop: false,
  frames: [
    f(90, { sq: 2, leg: "crouch", mood: "bold", hx: -1 }),
    f(70, { sq: 1, mood: "cheer", hx: 1, tongue: 4 }, { cue: "flick" }),
    f(70, { sq: 1, mood: "cheer", hx: 1, tongue: 9, extra: piece(58, 31) }),
    f(80, { sq: 1, mood: "cheer", hx: 1, tongue: 6, extra: piece(55, 32) }),
    f(80, { sq: 0, mood: "blink", tongue: 3, extra: piece(52, 34) }, { cue: "gulp" }),
    f(110, { sq: -1, mood: "blink", sac: 2, hy: 0 }, { cue: "gulp" }),
    f(100, { sq: 0, mood: "happy", sac: 1 }),
    f(80, { sq: 2, leg: "coil", arm: "up", mood: "happy" }),
    f(80, { sq: -2, dy: -6, leg: "air", arm: "high", mood: "cheer" }, { cue: "hop", specks: sparkle(46, 10) }),
    f(80, { sq: -1, dy: -3, leg: "tuck", arm: "high", mood: "happy" }),
    f(100, { sq: 3, leg: "land", arm: "up", mood: "happy" }, { cue: "step", specks: flutter(0) }),
    f(160, { sq: 0, arm: "hold", mood: "smug" }),
  ],
};

/** Hurt: hit, a flash, eyes screwed shut, paper creasing, the pawn flung out of its foot; it catches it and shakes it off. */
const hurt: Anim = {
  loop: false,
  frames: [
    f(70, { sq: 3, leg: "coil", mood: "hurt", arm: "down", pawn: [53, 36] }, { cue: "crumple", pal: FLASH, shake: [1, 0] }),
    f(80, { sq: 3, leg: "coil", mood: "hurt", arm: "down", pawn: [56, 27] }, { shake: [-1, 0], specks: [[20, 40, "E"], [21, 41, "E"], [22, 42, "E"], [22, 39, "D"], [23, 40, "D"], ...sweat(0)] }),
    f(90, { dx: -1, sq: 2, leg: "coil", mood: "hurt", arm: "down", pawn: [57, 21] }, { specks: [[20, 40, "E"], [21, 41, "E"], [22, 42, "E"], ...sweat(1)] }),
    f(100, { dx: -1, sq: 1, mood: "worry", arm: "up", pawn: [56, 29] }),
    f(110, { sq: 0, mood: "worry", arm: "up", pawn: [55, 38] }),
    f(110, { arm: "up", mood: "blink" }, { cue: "smooth" }),
    f(120, { arm: "hold", mood: "bold" }, { specks: sparkle(57, 30, false) }),
    f(160, { mood: "calm" }),
  ],
};

/** Check: two sharp jabs of the pawn at the board, a croak (the throat puffs), an ink exclamation mark. */
const bang = (x: number, y: number): Speck[] => [0, 1, 2, 3, 4].flatMap((j): Speck[] => [[x, y + j, "U"], [x + 1, y + j, "U"]]).concat([[x, y + 6, "U"], [x + 1, y + 6, "U"], [x, y + 7, "U"], [x + 1, y + 7, "U"]]);
const check: Anim = {
  loop: false,
  frames: [
    f(100, { sq: 1, arm: "up", mood: "bold" }),
    f(110, { dx: 1, sq: 2, leg: "crouch", arm: "point", mood: "bold", sac: 1 }, { cue: "croak", specks: bang(62, 36) }),
    f(90, { sq: 1, arm: "up", mood: "bold", sac: 2 }),
    f(110, { dx: 1, sq: 2, leg: "crouch", arm: "point", mood: "bold", sac: 2 }, { cue: "croak", specks: bang(62, 36) }),
    f(90, { dx: 1, sq: 1, arm: "point", mood: "bold", sac: 1 }, { specks: bang(62, 36) }),
    f(150, { dx: 1, arm: "point", mood: "happy" }),
    f(160, { arm: "hold", mood: "smug" }),
  ],
};

/** Smug (loops): chin up, eyes half shut, a little smirk, a slow nod, the pawn held just so. */
const smug: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(150, { mood: "smug", hy: i < 3 || i > 5 ? -1 : 0, hx: i < 4 ? 0 : 1, sq: i % 4 === 2 ? 0 : -1, sac: i === 5 ? 1 : 0 }, { specks: i === 4 ? sparkle(55, 20) : i === 5 ? sparkle(55, 20, false) : [] })),
};

/** Rattled (loops): wide eyes with pinpoint pupils, a wavy mouth, sweat flying, trembling where it sits, the pawn shaking. */
const rattled: Anim = {
  loop: true,
  frames: Array.from({ length: 8 }, (_, i) => f(80, { mood: "rattled", dx: i % 2 ? 1 : -1, sq: i % 4 === 2 ? 2 : 1, leg: "crouch", ay: i % 2, hy: i % 2 }, { specks: sweat(i) })),
};

/** Defeat: hit, dizzy eyes, the pawn flung away; it deflates, unfolds into its flat page and the pawn stands beside it (the last frame holds). */
const SETTLE = { i: "#adafbf", s: "#d6d0c6", j: "#928f97", l: "#8a8590" };
const defeat: Anim = {
  loop: false,
  frames: [
    f(80, { sq: 3, leg: "coil", mood: "hurt", arm: "down", pawn: [55, 33] }, { cue: "crumple", pal: FLASH, shake: [1, 0] }),
    f(90, { dx: -1, sq: 3, leg: "coil", mood: "out", arm: "down", pawn: [58, 25] }, { specks: sweat(1) }),
    f(110, { sq: 4, hy: 1, leg: "splay", mood: "out", arm: "down", pawn: [58, 38] }),
    f(120, { sq: 6, hy: 2, leg: "splay", mood: "out", arm: "down", pawn: [52, 53] }, { cue: "flop", shake: [1, 0] }),
    f(150, { sq: 8, hy: 3, leg: "splay", mood: "out", arm: "down", pawn: [52, 53] }),
    pageFrame(150, square(11), 28, 50, 15, { cue: "unfold", specks: sparkle(28, 34, false) }, [52, 53]),
    pageFrame(140, page(2, 16, 30), 28, 52, 17, {}, [52, 53]),
    pageFrame(140, page(4, 10, 32), 28, 56, 18, {}, [52, 53]),
    pageFrame(260, page(5, 6, 32), 28, 58, 19, { cue: "settle" }, [52, 53]),
    pageFrame(500, page(5, 6, 32), 28, 58, 19, {}, [52, 53]),
    pageFrame(220, page(5, 6, 32), 28, 58, 19, { pal: { i: "#adafbf", s: "#d6d0c6", j: "#928f97" } }, [52, 53]),
    pageFrame(1200, page(5, 6, 32), 28, 58, 19, { pal: SETTLE }, [52, 53]),
  ],
};

/** Victory (loops): jumping for joy with the pawn waved high, a croak, bits of paper tossed in the air. */
const victory: Anim = {
  loop: true,
  frames: Array.from({ length: 12 }, (_, i) => {
    const air = [0, 3, 6, 7, 5, 2, 0, 0, 4, 7, 4, 0][i]!;
    const arms = ["up", "waveL", "high", "waveR", "waveL", "up", "up", "up", "waveR", "high", "waveL", "up"] as const;
    const grounded = air === 0;
    return f(110, { sq: grounded ? 3 : -1, dy: -air, leg: grounded ? "land" : air > 4 ? "air" : "tuck", arm: arms[i]!, mood: i % 3 === 2 ? "cheer" : "happy", sac: i === 3 || i === 9 ? 2 : 0, hx: i % 2 }, { cue: i === 3 ? "croak" : undefined, specks: [...bits(32, 26, i, 7, 22), ...(i % 4 === 2 ? sparkle(48 + (i % 3) * 4, 8) : [])] });
  }),
};

export const sidekickFolio: Character = {
  id: "sidekick-folio",
  name: "Folio's sidekick",
  w: W,
  h: H,
  foot: [MIDX, GROUND],
  palette: SIDEKICK_FOLIO_PALETTE,
  halo: "#3b3530",
  parts: PARTS,
  anims: { idle, walk, sit, wave, entrance, thinking, move, capture, hurt, check, smug, rattled, defeat, victory },
};
