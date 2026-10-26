/**
 * Folio, the paper crane (a final boss): an origami crane folded from a single page of handwriting. Gentle, graceful,
 * warm: it means its compliments, never gloats, tells the truth. Three-quarter view facing our left (toward the board),
 * hovering just above a soft shadow. Light from the top left: every fold is a flat face in one tone (lit, mid, shaded),
 * a darker crease where faces meet; faint sepia handwriting runs across each face at its own angle (the page's lines,
 * folded), and a few lines on the near wing come and go (palette keys "1", "2", "3", invisible at rest).
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
  C: "#dccba9",
  D: "#bba98b",
  E: "#97866f",
  i: "#b69b78", // ink on light paper (sepia), on shaded paper, ink run (rattled)
  j: "#94806a",
  s: "#d2bc9a",
  x: "#1c1620", // the eye
  U: "#8ea5d6", // an ink stroke off the page (the check's underline)
  u: "#5b74aa",
  G: "#f2c14e", // gold: the game's, a light glint, a deep edge
  H: "#fff0b4",
  g: "#b8862a",
  z: "#0c0d11", // ground shadow
  "1": PAPER_B, // lines of handwriting that fade in and out on the near wing (paper-colored = not there)
  "2": PAPER_B,
  "3": PAPER_B,
};

/** Fade levels for a line of sepia ink, and for ink-blue (thinking): 0 gone .. 3 full. */
const SEPIA = [PAPER_B, "#e4d2b1", "#c9ae86", "#a8885f"];
const BLUE = [PAPER_B, "#d9d7d6", "#a7b2cf", "#5b74aa"];

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
  gap: number;
  key: string;
  seed: number;
  /** Lines (by index) drawn in a key of their own (fading lines). */
  fade?: Readonly<Record<number, string>>;
  /** Lines left blank. */
  skip?: readonly number[];
}
interface Face {
  pts: readonly Pt[];
  key: string;
  /** A highlight along the face's top and left edges; a shade along its bottom and right. */
  hi?: string;
  lo?: string;
  ink?: Ink;
}
interface Drawing {
  faces: readonly Face[];
  creases?: readonly (readonly [Pt, Pt, string])[];
  dots?: readonly (readonly [number, number, string])[];
  smear?: boolean;
}

function inWord(li: number, s: number, seed: number, dense = false): boolean {
  const t = s + (hash(li, 99, seed) % 7) + 700;
  const w = Math.floor(t / 7);
  return t % 7 < (dense ? 5 : 3) + (hash(li, w, seed + 1) % (dense ? 2 : 3));
}
function inkAt(ink: Ink, X: number, Y: number): string | null {
  const px = X + 0.5 - ink.o[0];
  const py = Y + 0.5 - ink.o[1];
  const [dx, dy] = ink.d;
  const u = px * dx + py * dy;
  const v = -px * dy + py * dx;
  const li = Math.floor(v / ink.gap);
  const r = v - li * ink.gap;
  if (ink.skip?.includes(li)) return null;
  const s = Math.floor(u);
  const fk = ink.fade?.[li];
  if (!inWord(li, s, ink.seed, !!fk)) return null;
  const key = fk ?? ink.key;
  if (r >= 1 && r < 2) return key;
  if (r < 1 && hash(li, s, ink.seed) % 4 === 0) return key;
  return null;
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
    if (!f.ink) continue;
    for (let Y = y0; Y <= y1; Y++)
      for (let X = x0; X <= x1; X++) {
        let ok = true;
        for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) if (!inside(X + a, Y + b)) ok = false;
        if (!ok) continue;
        const k = inkAt(f.ink, X, Y);
        if (k) {
          set(X, Y, k);
          inked.push([X, Y]);
        }
      }
  }
  if (d.smear) for (const [X, Y] of inked) for (const [a, b] of [[1, 0], [1, 1]] as const) if ("ABC".includes(get(X + a, Y + b))) set(X + a, Y + b, "s");
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

const BODY = { L: [33, 60] as Pt, T: [46, 55] as Pt, R: [59, 60] as Pt, B: [46, 79] as Pt };
const NECK_BASE: readonly [Pt, Pt] = [[36, 71], [41, 64]];
const TAIL_BASE: readonly [Pt, Pt] = [[52, 65], [56, 70]];
const WING_N: readonly [Pt, Pt] = [[33, 62], [60, 60]];
const WING_F: readonly [Pt, Pt] = [[37, 58], [54, 58]];
const REST = { neck: [14, 26] as Pt, tail: [85, 40] as Pt, wingN: [73, 9] as Pt, wingF: [24, 11] as Pt };

/** The fading lines' indices on the near wing's front face. */
const FADE_LINES: Readonly<Record<number, string>> = { [-6]: "3", [-4]: "2", [-2]: "1" };
const INK_D = unit([1, -0.22]);

function bodyDrawing(smear: boolean): Drawing {
  const { L, T, R, B } = BODY;
  return {
    faces: [
      { pts: [L, T, B], key: "B", hi: "A", ink: { o: L, d: unit([1, 0.5]), gap: 4, key: "i", seed: 1 } },
      { pts: [T, R, B], key: "C", lo: "D", ink: { o: R, d: unit([1, -0.6]), gap: 4, key: "i", seed: 2 } },
    ],
    creases: [[T, B, "D"]],
    smear,
  };
}

/** A long thin point (neck or tail) from its base edge to its tip: the side toward the light lit, the other mid. */
function pointDrawing(base: readonly [Pt, Pt], tip: Pt, litFirst: boolean): Drawing {
  const [a, b] = base;
  const m = lerp(a, b, 0.5);
  const n = unit([tip[0] - m[0], tip[1] - m[1]]);
  const side: Pt = [-n[1] * 0.9, n[0] * 0.9];
  const tA = add2(tip, side);
  const tB: Pt = [tip[0] - side[0], tip[1] - side[1]];
  // Which tip corner belongs to a's side: the one nearer a's side of the axis.
  const cross = (p: Pt) => (p[0] - m[0]) * n[1] - (p[1] - m[1]) * n[0];
  const [ta, tb] = Math.sign(cross(tA)) === Math.sign(cross(a)) ? [tA, tB] : [tB, tA];
  const faceA: Face = { pts: [a, m, tip, ta], key: litFirst ? "B" : "C", ...(litFirst ? { hi: "A" } : {}) };
  const faceB: Face = { pts: [m, b, tb, tip], key: litFirst ? "C" : "B", ...(litFirst ? {} : { hi: "A" }) };
  return { faces: [faceA, faceB], creases: [[m, tip, "D"]] };
}

export type Head = "rest" | "dip" | "up" | "none";
const HEADS: Record<Exclude<Head, "none">, { c: Pt; bk: Pt; ch: Pt; bt: Pt; eye: Pt }> = {
  rest: { c: [-1, -3], bk: [3, 0], ch: [0, 3], bt: [-10, 4], eye: [-2, -1] },
  dip: { c: [-2, -3], bk: [3, 0], ch: [1, 3], bt: [-7, 8], eye: [-2, -1] },
  up: { c: [0, -3], bk: [3, 1], ch: [0, 3], bt: [-10, -3], eye: [-1, -1] },
};
function headDrawing(tip: Pt, mode: Exclude<Head, "none">): Drawing {
  const h = HEADS[mode];
  const P = (q: Pt) => add2(tip, q);
  const e = P(h.eye);
  return {
    faces: [
      { pts: [P(h.c), P(h.bk), P(h.bt)], key: "B", hi: "A" },
      { pts: [P(h.bk), P(h.ch), P(h.bt)], key: "C", lo: "D" },
    ],
    creases: [[P(h.bk), P(h.bt), "D"]],
    dots: [[Math.round(e[0]), Math.round(e[1]), "x"]],
  };
}

function wingNDrawing(tip: Pt, dent: number, smear: boolean): Drawing {
  const [L, R] = WING_N;
  const M = lerp(L, R, 0.6);
  const front: Ink = { o: L, d: INK_D, gap: 4, key: "i", seed: 3, fade: FADE_LINES };
  const back: Ink = { o: L, d: INK_D, gap: 4, key: "j", seed: 3, skip: [-6, -4, -2] };
  const creases: [Pt, Pt, string][] = [[M, tip, "D"]];
  if (dent === 0) return { faces: [{ pts: [L, tip, M], key: "B", hi: "A", ink: front }, { pts: [M, tip, R], key: "C", lo: "D", ink: back }], creases, smear };
  // Hurt: the trailing edge crumpled into a zigzag, creases running in from it; harder, the tip folded over too.
  const n1 = add2(lerp(R, tip, 0.22), [-4, 0]);
  const n2 = lerp(R, tip, 0.36);
  const n3 = add2(lerp(R, tip, 0.5), [-6, 1]);
  const n4 = lerp(R, tip, 0.62);
  const crum: [Pt, string][] = [[n1, "E"], [n3, "E"]];
  for (const [n, k] of crum) creases.push([n, lerp(M, tip, 0.25 + (n === n3 ? 0.2 : 0)), k]);
  if (dent === 1) return { faces: [{ pts: [L, tip, M], key: "B", hi: "A", ink: front }, { pts: [M, tip, n4, n3, n2, n1, R], key: "C", lo: "D", ink: back }], creases, smear };
  const f = 0.66;
  const top = lerp(L, tip, f);
  const topR = lerp(n4, tip, (f - 0.62) / 0.38 + 0.05);
  const topM = lerp(M, tip, f);
  // The flap: the tip reflected across the fold line, lying over the wing's face.
  const [ax, ay] = top;
  const ux = topR[0] - ax;
  const uy = topR[1] - ay;
  const t = ((tip[0] - ax) * ux + (tip[1] - ay) * uy) / (ux * ux + uy * uy);
  const foot: Pt = [ax + ux * t, ay + uy * t];
  const flapTip: Pt = [2 * foot[0] - tip[0], 2 * foot[1] - tip[1]];
  return {
    faces: [
      { pts: [L, top, topM, M], key: "B", hi: "A", ink: front },
      { pts: [M, topM, topR, n4, n3, n2, n1, R], key: "C", lo: "D", ink: back },
      { pts: [top, topR, flapTip], key: "D", lo: "E" },
    ],
    creases: [[M, topM, "D"], [top, topR, "E"], ...creases.slice(1)],
    smear,
  };
}

function wingFDrawing(tip: Pt, smear: boolean): Drawing {
  const [L, R] = WING_F;
  const M = lerp(L, R, 0.45);
  return {
    faces: [
      { pts: [L, tip, M], key: "C", hi: "B", ink: { o: R, d: unit([1, 0.3]), gap: 4, key: "j", seed: 4 } },
      { pts: [M, tip, R], key: "D", ink: { o: R, d: unit([1, 0.3]), gap: 4, key: "j", seed: 4 } },
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
function pageDrawing(skew: number, h: number, w = 38): Drawing {
  const t = -h / 2;
  const b = h / 2;
  const pts: Pt[] = [[-w / 2 + skew, t], [w / 2 + skew, t], [w / 2 - skew, b], [-w / 2 - skew, b]];
  const key = h < 12 ? "C" : "B";
  return { faces: [{ pts, key, hi: "A", lo: h < 12 ? "D" : "C", ink: { o: [0, t + 1], d: [1, 0], gap: h < 8 ? 3 : 4, key: "i", seed: 7 } }] };
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
      { pts: [T, O, L], key: "B", hi: "A", ink: { o: O, d, gap: 4, key: "i", seed: 8 } },
      { pts: [T, R, O], key: "C", ink: { o: O, d, gap: 4, key: "i", seed: 8 } },
      { pts: [L, O, B], key: "C", ink: { o: O, d, gap: 4, key: "i", seed: 8 } },
      { pts: [O, R, B], key: "D", ink: { o: O, d, gap: 4, key: "j", seed: 8 } },
    ],
    creases: [[T, B, "E"], [L, R, "E"], [lerp(T, L, 0.5), O, "D"], [lerp(T, R, 0.5), O, "D"]],
  };
}
/** The bird base: a long diamond, its flaps up top, its two legs below split by a slit. */
function birdBaseDrawing(): Drawing {
  const T: Pt = [0, -28];
  const L: Pt = [-10, 0];
  const R: Pt = [10, 0];
  const B: Pt = [0, 26];
  const O: Pt = [0, 0];
  return {
    faces: [
      { pts: [T, O, L], key: "B", hi: "A", ink: { o: O, d: unit([1, -1.4]), gap: 4, key: "i", seed: 9 } },
      { pts: [T, R, O], key: "C", ink: { o: O, d: unit([1, 1.4]), gap: 4, key: "i", seed: 9 } },
      { pts: [L, O, B], key: "C", ink: { o: O, d: unit([1, 1.2]), gap: 4, key: "i", seed: 10 } },
      { pts: [O, R, B], key: "D", ink: { o: O, d: unit([1, -1.2]), gap: 4, key: "j", seed: 10 } },
    ],
    creases: [[L, R, "D"], [T, O, "D"], [[0, 2], B, "E"], [lerp(T, L, 0.5), [0, -6], "D"], [lerp(T, R, 0.5), [0, -6], "E"]],
  };
}

// ---- Little paper things: the piece it takes (a folded pawn) and the tiny crane it folds for you.

const PIECE = ["..AB..", ".ABBC.", "..BC..", ".ABCC.", "..BC..", ".ABCD.", "ABBCCD"];
const MINI: Record<string, readonly string[]> = {
  square: ["...A...", "..ABC..", ".ABBCC.", "ABBBCCD", ".BBCCD.", "..CCD..", "...D..."],
  kite: ["..A..", ".ABC.", ".ABC.", "ABBCC", "ABBCD", ".BCD.", ".BCD.", "..D..", "..D.."],
  up: [".......AB....", "......ABC....", ".....ABBC....", "A....ABCC...C", ".A..ABBCC..C.", "..ABBBBCCCC..", "...BBBBCCC...", ".....CDD.....", "......D......"],
  down: ["A...........C", ".A.........C.", "..ABBBBBCCC..", "...BBBBCCCC..", "...ABBCCDD...", "..ABB...DDD..", ".AB.......DD."],
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
  const layers: Layer[] = [shadowLayer(p.shadow ?? Math.max(6, 13 + Math.min(0, dy)))];
  layers.push(at(use(`wingF:${key(wf)}:${sm}`, () => wingFDrawing(wf, sm)), wave));
  layers.push(at(use(`tail:${key(tail)}`, () => pointDrawing(TAIL_BASE, tail, true))));
  layers.push(at(use(`body:${sm}`, () => bodyDrawing(sm))));
  layers.push(at(use(`neck:${key(neck)}`, () => pointDrawing(NECK_BASE, neck, true))));
  const head = p.head ?? "rest";
  if (head !== "none") layers.push(at(use(`head:${key(neck)}:${head}`, () => headDrawing(neck, head))));
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
const square = () => use("square", () => squareDrawing(17));
const birdBase = () => use("birdbase", birdBaseDrawing);

/** Ink-line fades: levels 0..3 for keys 1, 2, 3, in sepia or blue. */
const fades = (l1: number, l2 = 0, l3 = 0, ramp = SEPIA): Record<string, string> => ({ "1": ramp[l1]!, "2": ramp[l2]!, "3": ramp[l3]! });

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
function edgeGlint(t: number, tipOff: Pt = [0, 0], dy = 0, len = 4): Speck[] {
  const L = WING_N[0];
  const T = add2(REST.wingN, tipOff);
  const yc = Math.round(L[1] + (T[1] - L[1]) * t);
  const out: Speck[] = [];
  for (let j = -len; j <= len; j++) {
    const y = yc + j;
    if (y < T[1] || y > L[1] - 1) continue;
    const ex = L[0] + ((T[0] - L[0]) * (L[1] - y + 0.5)) / (L[1] - T[1]);
    const x = Math.ceil(ex - 0.5) - 1;
    const a = Math.abs(j);
    out.push([x, y + dy, a === 0 ? "H" : a <= 2 ? "G" : "g"]);
    if (a <= 1) out.push([x + 1, y + dy, a === 0 ? "H" : "G"]);
  }
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
  const l1 = [0, 0, 1, 2, 3, 3, 3, 2, 1, 0][i] ?? 0;
  const l2 = i >= 13 ? ([0, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0][i - 13] ?? 0) : 0;
  return F(200, {
    dy: lift >= 2 ? -1 : 0,
    wingN: [0, -lift],
    wingF: [0, -lift],
    neck: dip ? [-1, i === 9 || i === 12 ? 1 : 2] : [0, 0],
    head: dip && i !== 9 && i !== 12 ? "dip" : "rest",
  }, { pal: fades(l1, l2) });
});

/**
 * Entrance: a loose page drifts down from above, rocking (cue `rustle`), settles upright over its shadow, then folds
 * (cue `fold` at each step) into a creased square, the bird base, the petal fold (wings up, neck and tail hanging),
 * the neck and tail swing up, the head folds down, the wings open; a glint runs up the wing edge, and it breathes.
 */
const ENTRANCE: Frame[] = [
  pageFrame(170, page(5, 14), 38, 11, 3, { cue: "rustle" }),
  pageFrame(170, page(-3, 8), 52, 22, 4),
  pageFrame(170, page(-6, 20), 40, 34, 6, { cue: "rustle" }),
  pageFrame(170, page(4, 12), 50, 44, 8),
  pageFrame(260, page(0, 28), 46, 50, 11),
  pageFrame(200, square(), 46, 50, 11, { cue: "fold", specks: sparkle(46, 33) }),
  pageFrame(200, birdBase(), 46, 50, 11, { cue: "fold", specks: sparkle(46, 22) }),
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
  }, { pal: fades(l1, l2, l3, BLUE) });
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
  F(70, { dent: 1, wingN: [2, 3], wingF: [1, 2], neck: [2, 1], head: "dip" }, { cue: "crumple", shake: [-1, 0] }),
  F(80, { dent: 2, wingN: [2, 3], wingF: [1, 2], neck: [3, 2], head: "dip" }, { shake: [1, 0] }),
  F(90, { dent: 2, wingN: [1, 2], wingF: [1, 1], neck: [3, 2], head: "dip" }, { shake: [-1, 0] }),
  F(240, { dent: 2, wingN: [1, 2], wingF: [1, 1], neck: [2, 2], head: "dip" }),
  F(120, { dent: 1, wingN: [0, 1], neck: [1, 1] }, { cue: "smooth" }),
  F(120, { wingN: [0, -1] }, { specks: sparkle(62, 30, false) }),
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
  F(150, { ...BOW, wingN: [0, 1], wingF: [0, 1] }),
  F(110, { ...BOW, wingN: [0, 1], wingF: [0, 1] }, { cue: "glint", specks: edgeGlint(0.12, [0, 1]) }),
  F(100, { ...BOW, wingN: [0, 1], wingF: [0, 1] }, { specks: edgeGlint(0.36, [0, 1]) }),
  F(100, { ...BOW, wingN: [0, 1], wingF: [0, 1] }, { specks: edgeGlint(0.6, [0, 1]) }),
  F(110, { neck: [1, 2], wingN: [0, -1] }, { specks: edgeGlint(0.84, [0, -1]) }),
  F(120, { wingN: [0, -2], wingF: [0, -1], dy: -1 }, { specks: sparkle(REST.wingN[0] - 1, REST.wingN[1] - 4) }),
  F(260, { wingN: [0, -1] }, { specks: sparkle(REST.wingN[0] - 1, REST.wingN[1] - 3, false) }),
];

/** Rattled: its wing edges curl and flutter (cue `flutter`), the ink runs a little, it shivers, then steadies itself. */
const RATTLED: Frame[] = [
  F(80, { curl: 1, phase: 0, wingN: [1, 1], neck: [1, 1], smear: true }, { cue: "flutter", shake: [1, 0] }),
  F(80, { curl: 2, phase: 1.6, wingN: [0, -1], wingF: [0, 1], neck: [2, 1], head: "up", smear: true }, { shake: [-1, 0] }),
  F(80, { curl: 2, phase: 3.2, wingN: [1, 0], wingF: [0, -1], neck: [1, 0], head: "up", smear: true }, { shake: [1, 0] }),
  F(80, { curl: 2, phase: 4.8, wingN: [0, -1], wingF: [0, 1], neck: [2, 1], head: "up", smear: true }, { shake: [-1, 0] }),
  F(90, { curl: 1, phase: 0, wingN: [1, 0], neck: [1, 1], smear: true }, { shake: [1, 0] }),
  F(100, { curl: 1, phase: 2.4, wingN: [0, 1], neck: [1, 1], smear: true }),
  F(300, { wingN: [0, 2], wingF: [0, 1], neck: [0, 1], head: "dip", smear: true }),
  F(160, { wingN: [0, -1], dy: -1 }),
  F(160, {}),
];

/**
 * Defeat: it unfolds, slowly, step by step: the wings close, the head unfolds and the neck and tail fall (cue
 * `unfold`), the bird base, the creased square, the flat page; the page tips back and drifts down, and settles on the
 * ground (cue `settle`).
 */
const DEFEAT: Frame[] = [
  F(260, { neck: [1, 3], head: "dip", wingN: [0, 2], wingF: [0, 2] }),
  F(240, { wingN: [-10, 3], wingF: [10, 2], neck: [1, 3], head: "dip" }, { cue: "unfold" }),
  F(240, { wingN: [-20, 4], wingF: [19, 2], head: "none" }),
  F(220, { wingN: [-20, 4], wingF: [19, 2], neck: [5, 33], tail: [-5, 23], head: "none", shadow: 12 }),
  F(220, { wingN: [-20, 4], wingF: [19, 2], neck: [30, 58], tail: [-37, 44], head: "none", shadow: 11 }),
  pageFrame(260, birdBase(), 46, 50, 11, { cue: "unfold" }),
  pageFrame(260, square(), 46, 50, 11),
  pageFrame(300, page(0, 28), 46, 50, 11),
  pageFrame(220, page(3, 18), 47, 60, 13),
  pageFrame(220, page(5, 10), 45, 72, 15),
  pageFrame(240, page(6, 6), 46, 82, 17, { cue: "settle" }),
  pageFrame(1400, page(6, 6), 46, 83, 19),
];

/** Victory: from a corner of its page it folds a tiny crane at its beak (cue `fold`), a square, a kite, a crane; sends it up and away (cue `launch`) and watches it go, pleased. */
const mini = (k: string, x: number, y: number): Layer => ({ part: `mini:${k}`, x, y });
const VICTORY: Frame[] = [
  F(100, {}),
  F(160, { neck: [1, 4], head: "dip", wingN: [0, 1] }, { specks: sparkle(REST.wingN[0] - 1, REST.wingN[1] + 2) }),
  F(170, { neck: [1, 4], head: "dip", extra: [mini("square", 0, 38)] }, { cue: "fold", specks: sparkle(3, 36) }),
  F(150, { neck: [1, 4], head: "dip", extra: [mini("kite", 1, 37)] }),
  F(170, { neck: [1, 4], head: "dip", extra: [mini("up", -3, 36)] }, { cue: "fold" }),
  F(110, { neck: [1, 3], head: "dip", wingN: [0, -3], wingF: [0, -3], dy: -1, extra: [mini("down", -3, 26)] }, { cue: "launch" }),
  F(110, { neck: [0, 0], head: "rest", wingN: [0, -2], wingF: [0, -2], dy: -1, extra: [mini("up", -2, 13)] }),
  F(110, { neck: [0, -1], head: "up", wingN: [0, -1], wingF: [0, -1], extra: [mini("down", 1, 7)] }),
  F(110, { neck: [0, -1], head: "up", extra: [mini("up", 7, 3)] }),
  F(110, { neck: [0, -1], head: "up", extra: [mini("down", 16, 3)] }),
  F(120, { neck: [0, -1], head: "up" }, { specks: sparkle(28, 4) }),
  F(140, { neck: [0, -1], head: "up" }, { specks: sparkle(33, 3, false) }),
  F(160, { ...BOW }),
  F(300, {}),
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
