/**
 * The two statues on the Coliseum's front, one each side of its gate, each on a pedestal of its own (town square;
 * docs/decisions/2026-10-26-town-square-statues.md, -statues-2.md): the marble statue (`marble`, the Hidden Boss in
 * stone, on the gate's left) and the bronze statue (`bronze`, on its right). Each is drawn twice: at the world's scale
 * (1 picture pixel a Coliseum pixel) and as a close-up (`CLOSE` times finer, the same box), which the camera shows when
 * it zooms in on it. The pedestals are about a piece's plinth's size; at the world's scale their panels carry only a few
 * squiggly lines, like writing too small to read. No name is written on either statue or pedestal: up close the game
 * writes only its quote on the pedestal's panel, at the screen's own resolution.
 *
 * The bronze statue is a stack of pieces (front to back), each a shape in statue units: X across from its middle (right
 * +), j up from its foot (the pedestal's top). `sculpt` paints it in one stuff (bronze, or the marble slab), lit from the
 * top left like the Coliseum's chess pieces: a piece is lit where it faces up and left, in shade where it faces down and
 * right, and a piece in front casts a thin shadow down-right onto the pieces behind it. Drawn finer (s > 1), the pieces'
 * `mark`s add the detail the world's scale can't hold. At the world's scale its head is typed by hand, pixel by pixel.
 * The marble statue is the Hidden Boss's own picture (characters/recluse.ts) turned to marble (`bossFigure`).
 */
import { RECLUSE, recluseLayers } from "../../characters/recluse.ts";
import { renderFrame, type Character, type Part } from "../../characters/sprite.ts";
import type { StatueId } from "../world.ts";
import { grain, type Key, type Pt } from "./kit.ts";

export type { StatueId };

/** How much finer the close-up is drawn than the world's figure (the same box, CLOSE x CLOSE pixels a pixel). */
export const CLOSE = 4;

/** A shape: is (X, j) inside it? Its box (x0, x1, j0, j1) lets the sculptor skip it quickly where it can't be. */
type Shape = ((X: number, j: number) => boolean) & { b?: readonly [number, number, number, number] };
const bound = (f: (X: number, j: number) => boolean, x0: number, x1: number, j0: number, j1: number): Shape => Object.assign(f, { b: [x0, x1, j0, j1] as const });
/** A mark's tone: the stuff's light, mid, dark or deep key, or its glint. */
type Tone = "l" | "m" | "d" | "x" | "g";
interface Piece {
  in: Shape;
  /** A carved detail at (X, j) drawn at scale s: a tone, or undefined for the stuff's light and shade. */
  mark?: (X: number, j: number, s: number) => Tone | undefined;
  /** Where its lit edge catches a glint. */
  glint?: Shape;
  /** Carved a step darker (hair, a tie, trousers): its lit rim in the mid tone, its shade in the deep one. */
  deep?: boolean;
  /** Drawn finer only: at the world's scale the typed head (`Figure.head`) stands in for it. */
  big?: boolean;
}
interface Figure {
  /** Half its box's width and its height, in statue units. */
  half: number;
  h: number;
  pieces: Piece[];
  /** The head at the world's scale, typed by hand: rows from `top` (the top row's j) down, columns from X = -4.5. */
  head: readonly string[];
  top: number;
}

// ---- Shapes.

const segT = (X: number, j: number, ax: number, aj: number, bx: number, bj: number) => {
  const dx = bx - ax;
  const dj = bj - aj;
  return Math.max(0, Math.min(1, ((X - ax) * dx + (j - aj) * dj) / (dx * dx + dj * dj || 1)));
};
/** A limb: round-ended, `r` thick (half) at a to `r2` at b. */
const capsule = (ax: number, aj: number, bx: number, bj: number, r: number, r2 = r): Shape => {
  const m = Math.max(r, r2);
  return bound(
    (X, j) => {
      const t = segT(X, j, ax, aj, bx, bj);
      return Math.hypot(X - ax - t * (bx - ax), j - aj - t * (bj - aj)) < r + (r2 - r) * t;
    },
    Math.min(ax, bx) - m,
    Math.max(ax, bx) + m,
    Math.min(aj, bj) - m,
    Math.max(aj, bj) + m,
  );
};
const ell = (cx: number, cj: number, rx: number, rj: number): Shape => bound((X, j) => ((X - cx) / rx) ** 2 + ((j - cj) / rj) ** 2 < 1, cx - rx, cx + rx, cj - rj, cj + rj);
const box = (x0: number, x1: number, j0: number, j1: number): Shape => bound((X, j) => X >= x0 && X < x1 && j >= j0 && j < j1, x0, x1, j0, j1);
function poly(pts: readonly (readonly [number, number])[]): Shape {
  const xs = pts.map((q) => q[0]);
  const js = pts.map((q) => q[1]);
  return bound((px, py) => {
    let inside = false;
    for (let i = 0, k = pts.length - 1; i < pts.length; k = i++) {
      const [xi, yi] = pts[i]!;
      const [xk, yk] = pts[k]!;
      if (yi > py !== yk > py && px < ((xk - xi) * (py - yi)) / (yk - yi) + xi) inside = !inside;
    }
    return inside;
  }, Math.min(...xs), Math.max(...xs), Math.min(...js), Math.max(...js));
}
const any = (...ss: Shape[]): Shape =>
  bound((X, j) => ss.some((s) => s(X, j)), Math.min(...ss.map((s) => s.b![0])), Math.max(...ss.map((s) => s.b![1])), Math.min(...ss.map((s) => s.b![2])), Math.max(...ss.map((s) => s.b![3])));
const mirrorPts = (pts: readonly (readonly [number, number])[]) => [...pts, ...[...pts].reverse().map(([x, j]) => [-x, j] as const)];

// ---- Painting, a few rows at a time: the close-up is big (about 180 x 400 pixels), so it's made ahead, a slice a frame,
// never all at once (.claude/LESSONS.md, "A stall the first time an effect shows").

type Painted = { part: Part; at: Pt };
/** kit.ts's `paint`, yielding after every `rows` rows. */
function* paintSteps(x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => Key, rows = 12): Generator<void, Painted> {
  const grid: string[] = [];
  for (let j = 0; j < h; j++) {
    let row = "";
    for (let i = 0; i < w; i++) row += fn(x0 + i, y0 + j) ?? ".";
    grid.push(row);
    if (j % rows === rows - 1) yield;
  }
  return { part: { grid }, at: [x0, y0] };
}
/** Runs steps to the end. */
function run<T>(g: Generator<void, T>): T {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

// ---- The sculptor.

/**
 * Paints `fig` standing on (cx, fy) (frame pixels at its own scale `s`) in `stuff`: its light, mid, dark and deep keys
 * and its glint.
 */
function sculpt(fig: Figure, cx: number, fy: number, stuff: string, s: number): Generator<void, Painted> {
  const key = { l: stuff[0]!, m: stuff[1]!, d: stuff[2]!, x: stuff[3]!, g: stuff[4]! };
  const fine = s > 1;
  const dl = fine ? 0.55 : 1.1; // how deep the top's lit rim and the underside's shade run (statue units)
  const dd = fine ? 0.7 : 1.3;
  const e = fine ? 0.45 : 1; // how far a piece's shadow falls
  const P = fig.pieces.filter((p) => fine || !p.big);
  const has = (p: Piece, X: number, j: number) => {
    const b = p.in.b;
    return (!b || (X >= b[0] && X <= b[1] && j >= b[2] && j <= b[3])) && p.in(X, j);
  };
  // How far across its own piece a pixel is, -1 its left edge to 1 its right (it is rounded like a limb): from the run
  // of the piece's pixels along its row (at most 16 units each way), worked out once a row.
  const x0 = Math.round(cx - fig.half * s);
  const w = 2 * fig.half * s;
  const lim = 16 * s;
  const left = P.map(() => new Int16Array(w));
  const right = P.map(() => new Int16Array(w));
  const rowOf = P.map(() => NaN);
  const across = (pi: number, x: number, y: number) => {
    const p = P[pi]!;
    const L = left[pi]!;
    const R = right[pi]!;
    if (rowOf[pi] !== y) {
      rowOf[pi] = y;
      const j = (fy - (y + 0.5)) / s;
      let run = 0;
      for (let i = 0; i < w; i++) {
        const on = has(p, (x0 + i + 0.5 - cx) / s, j);
        L[i] = Math.min(lim, run);
        run = on ? run + 1 : 0;
      }
      run = 0;
      for (let i = w - 1; i >= 0; i--) {
        const on = has(p, (x0 + i + 0.5 - cx) / s, j);
        R[i] = Math.min(lim, run);
        run = on ? run + 1 : 0;
      }
    }
    const i = x - x0;
    return (L[i]! - R[i]!) / (L[i]! + R[i]! + 1);
  };
  return paintSteps(cx - fig.half * s, fy - fig.h * s, 2 * fig.half * s, fig.h * s, (x, y) => {
    const X = (x + 0.5 - cx) / s;
    const j = (fy - (y + 0.5)) / s;
    if (!fine) {
      const t = fig.head[Math.round(fig.top - j)]?.[Math.round(X + 4.5)];
      if (t && t !== ".") return key[t as Tone];
    }
    const i = P.findIndex((p) => has(p, X, j));
    if (i < 0) return null;
    const p = P[i]!;
    const k = p.mark?.(X, j, s);
    if (k !== undefined) return key[k];
    for (let f = 0; f < i; f++) if (has(P[f]!, X - e, j + e)) return p.deep ? key.x : key.d;
    const t = across(i, x, y);
    if (t < -0.42 || !has(p, X - dl * 0.5, j + dl)) return p.glint?.(X, j) ? key.g : p.deep ? key.m : key.l;
    if (t > 0.4 || !has(p, X + dd * 0.5, j - dd)) return p.deep ? key.x : key.d;
    return p.deep ? key.d : key.m;
  });
}

// ---- The marble statue: the Hidden Boss's own picture (characters/recluse.ts, his standing idle) in stone, so it reads
// as the same man at a glance. His idle frame is drawn without the book (the book arm hanging as his other arm does, its
// hand the free hand's mirror), and each of his colors becomes the marble shade of its lightness (his own light from the
// top left and his outline kept); he stands on a marble slab. His picture is twice the world's scale and half the
// close-up's: the world's figure takes his pixels two by two (its head touched up by hand), the close-up doubles each
// (smoothed along its diagonals).

/** The marble's shades, lightest to darkest (palette keys), and the lightness (0 to 1) of each. */
const MARBLE_KEYS = "wP6p7q8Q9";
const MARBLE_L = [0.98, 0.945, 0.88, 0.81, 0.71, 0.61, 0.52, 0.43, 0.35] as const;
/** How light his darkest color turns (marble is never dark: his navy trousers are a mid grey), and his outline's share in a two-by-two block. */
const MARBLE_LO = 0.36;
const MARBLE_LINE = 0.3;
const nearestMarble = (m: number): string => {
  let best = 0;
  for (let i = 1; i < MARBLE_L.length; i++) if (Math.abs(MARBLE_L[i]! - m) < Math.abs(MARBLE_L[best]! - m)) best = i;
  return MARBLE_KEYS[best]!;
};

/**
 * His idle frame without the book, as his own pixels in marble keys ('k' his outline, '.' none), from the first even row
 * that shows him down to his feet (`RECLUSE.foot`), and where his feet are across it. Made once, the first time asked.
 */
let bossPix: { rows: string[]; footX: number } | null = null;
function bossPixels(): { rows: string[]; footX: number } {
  if (bossPix) return bossPix;
  const layers = recluseLayers({ face: { eyes: "ahead", brows: "stern" }, hold: { loose: true, at: [0, 0], elbowR: [32, 60], wristR: [32, 81] } })
    .filter((l) => !l.part.startsWith("book:") && l.part !== "shadow")
    .map((l) => (l.part === "fist:a" ? { part: "hand:rest", x: l.x - 1, y: l.y, flipX: true } : l)); // (his free hand, mirrored)
  const { halo: _halo, ...plain } = RECLUSE;
  const img = renderFrame(plain, { ms: 0, layers });
  const k = RECLUSE.palette.k!;
  const [kr, kg, kb] = [1, 3, 5].map((i) => parseInt(k.slice(i, i + 2), 16));
  const rows: string[] = [];
  for (let y = 0; y < RECLUSE.foot[1]; y++) {
    let row = "";
    for (let x = 0; x < img.w; x++) {
      const o = (y * img.w + x) * 4;
      const r = img.data[o]!;
      const g = img.data[o + 1]!;
      const b = img.data[o + 2]!;
      row += img.data[o + 3]! < 128 ? "." : r === kr && g === kg && b === kb ? "k" : nearestMarble(MARBLE_LO + ((1 - MARBLE_LO) * (0.299 * r + 0.587 * g + 0.114 * b)) / 255);
    }
    rows.push(row);
  }
  let top = rows.findIndex((row) => /[^.]/.test(row));
  top -= (RECLUSE.foot[1] - top) % 2; // (whole pairs of rows down to his feet)
  return (bossPix = { rows: rows.slice(top), footX: RECLUSE.foot[0] });
}

/** Scale2x: each pixel doubled, its corners taking a neighbor's key where two neighbors agree (smooth diagonals). */
function scale2x(rows: readonly string[]): string[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y]![x]!);
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let r0 = "";
    let r1 = "";
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      r0 += (C === A && C !== D && A !== B ? A : p) + (A === B && A !== C && B !== D ? B : p);
      r1 += (D === C && D !== B && C !== A ? C : p) + (B === D && B !== A && D !== C ? D : p);
    }
    out.push(r0, r1);
  }
  return out;
}

/**
 * His figure at scale `s` (the world's 1 or the close-up's), its feet on (cx, fy): at the world's scale each two-by-two
 * block of his pixels is filled where most of it is him, in the marble shade of its mean lightness (his outline lines
 * darkening it), and outlined anew; up close his pixels are doubled, his own outline kept.
 */
function bossFigure(cx: number, fy: number, s: number): Painted {
  const { rows, footX } = bossPixels();
  if (s > 1) {
    let grid = rows;
    for (let f = 2; f < s; f *= 2) grid = scale2x(grid);
    return { part: { grid, outline: false }, at: [cx - (footX * s) / 2, fy - grid.length] };
  }
  const w = rows[0]!.length / 2;
  const h = rows.length / 2;
  const L = (c: string) => (c === "k" ? MARBLE_LINE : MARBLE_L[MARBLE_KEYS.indexOf(c)]!);
  const grid: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const px = [rows[2 * y]![2 * x]!, rows[2 * y]![2 * x + 1]!, rows[2 * y + 1]![2 * x]!, rows[2 * y + 1]![2 * x + 1]!];
      const body = px.filter((c) => c !== "." && c !== "k").length;
      if (body < 2) {
        row += ".";
        continue;
      }
      const on = px.filter((c) => c !== ".");
      row += nearestMarble(on.reduce((t, c) => t + L(c), 0) / on.length);
    }
    grid.push(row);
  }
  return { part: { grid: BOSS_TOUCH ? touchUp(grid, BOSS_TOUCH) : grid }, at: [cx - footX / 2, fy - h] };
}

/** The world's figure's head, touched up by hand over the two-by-two picture: rows from its top, '.' left as made. */
const BOSS_TOUCH: { x: number; y: number; rows: readonly string[] } | null = {
  x: 8,
  y: 0,
  // prettier-ignore
  rows: [
    "......_____......", // (his hair's crown, rounded off)
    "...._q888888Q....", // his hair, lit on our left
    "....qQqqq8888Q...", // the part, on our left
    "...q8Q88888888Q..",
    "..q8QQ7pp7p7q8Q..", // the lock, fallen to his brow
    "..8q7QQQ7QQQq8Q..", // heavy brows
    "...qpP9p7P9qq8...", // his eyes, up at us from under them
    "...qpp7p7qqqq8...",
    "...qppppq7qqq8...", // the long nose
    "....pppp7qqq8....",
    "....7ppqq7q8.....",
    "....7pppp8q8.....", // the half-smirk, up on our right
    ".....7888qq......",
    ".....8p77q.......", // the narrow chin
    "......8pq8.......",
  ],
};
function touchUp(grid: readonly string[], t: { x: number; y: number; rows: readonly string[] }): string[] {
  return grid.map((row, y) => {
    const tr = t.rows[y - t.y];
    if (!tr) return row;
    let out = "";
    for (let x = 0; x < row.length; x++) {
      const c = tr[x - t.x];
      out += c && c !== "." ? (c === "_" ? "." : c) : row[x]!;
    }
    return out;
  });
}

/** The slab he stands on (his own base on the pedestal), and his figure's height over it in the world's pixels. */
const MARBLE_SLAB: Figure = { half: 13, h: 2, top: 0, head: [], pieces: [{ in: box(-8.5, 8.5, 0, 2) }] };
const marbleH = () => MARBLE_SLAB.h + bossPixels().rows.length / 2;

// ---- The bronze statue: tall and lanky, narrow sloping shoulders; a long narrow face, a strong straight brow, deep-set
// eyes, a long straight nose, a warm closed smile; short curly hair, full and bushy on top, close at the sides; a
// button-down shirt, its collar open, tucked into a belt. Both arms relaxed at his sides (nothing at shoulder height or
// above): his right hand (our left) holds a small knight at his hip, his left hangs easy.

const B_TORSO = poly(mirrorPts([[-2.1, 52.6], [-4.3, 51.8], [-5.4, 50], [-5.6, 44], [-5, 37], [-4.7, 30.8]]));
const B_LEG_L = poly([[-4.8, 31.6], [0, 31.6], [0, 26.6], [-0.6, 4.2], [-4.1, 4.2], [-4.7, 18]]);
const B_LEG_R = bound((X, j) => B_LEG_L(-X, j), 0, 4.8, 4.2, 31.6);
/** His face: long and narrow, full cheeks (not gaunt) down a long jaw to a narrow chin. */
const bFaceHalf = (j: number) => {
  if (j > 58) return 3.05 * Math.sqrt(Math.max(0, 1 - ((j - 58) / 5) ** 2));
  if (j > 53.6) return 1.65 + 1.4 * Math.pow((j - 53.6) / 4.4, 0.65);
  return 1.65 * Math.sqrt(Math.max(0, 1 - ((53.6 - j) / 0.9) ** 2)); // a rounded chin
};
const B_FACE = bound((X, j) => Math.abs(X) < bFaceHalf(j), -3.1, 3.1, 52.6, 63);
/**
 * His hair: short curls, full but close to his head (Eric, Oct 26: about half as bushy as it was, the top cut well down),
 * a cap over his skull's curve, thicker on top than at the sides, coming down his sides to the tops of his ears (so his
 * temples aren't bare) with short sideburns in front of them; a low, straight hairline over the forehead; a curly edge.
 */
const B_HAIR = bound((X: number, j: number) => {
  const a = Math.atan2(j - 59.3, X);
  const bump = 1 + 0.035 * Math.sin(a * 13 + 0.6);
  if (Math.abs(X / (3.75 * bump)) ** 2.6 + Math.abs((j - 59.3) / (5.3 * bump)) ** 2.6 >= 1) return false;
  const ax = Math.abs(X);
  // Its lower edge: over the forehead, then down the temples to the ears' tops; sideburns just in front of the ears.
  if (ax < 2.1) return j > 61.6 + 0.15 * Math.cos(X * 3.3 + 0.4);
  if (ax > 2.45 && ax < 2.95) return j > 58.4;
  return j > Math.max(59.2, 61.6 - (ax - 2.1) * 4);
}, -4, 4, 58, 64.9);
/** Curls at the close-up: small rings on a jittered grid, their lower-right rims in shade, their upper-left lit. */
function curls(X: number, j: number): Tone | undefined {
  const g = 0.95;
  let best = 9;
  let bx = 0;
  let bj = 0;
  const gx = Math.floor(X / g);
  const gj = Math.floor(j / g);
  for (let u = gx - 1; u <= gx + 1; u++)
    for (let v = gj - 1; v <= gj + 1; v++) {
      const cx = (u + 0.25 + grain(u + 50, v + 50, 7) * 0.5) * g;
      const cj = (v + 0.25 + grain(u + 50, v + 50, 8) * 0.5) * g;
      const d = Math.hypot(X - cx, j - cj);
      if (d < best) [best, bx, bj] = [d, cx, cj];
    }
  const lit = X - bx + (bj - j); // < 0 toward the top left
  if (best > 0.36 && best < 0.56) return lit > 0.05 ? "x" : undefined;
  // Each curl's lit crest: bright only on the side of the head the light falls on (top left), a step down elsewhere.
  if (best < 0.26 && lit < -0.08) return X - 0.4 * (j - 61.5) < -0.8 ? "l" : "m";
  return undefined;
}

const BRONZE: Figure = {
  half: 13,
  h: 66,
  top: 64.5,
  // prettier-ignore
  head: [
    "...lmmm...", // curls: a low crown, close to his head
    "..lmmmmdd.",
    ".lmdmdmdd.", // the curls' edge, low over the forehead
    ".mmllllmd.", // the forehead; the hair down his sides
    "mmxxlxxdmd", // the brows, straight and strong; the hair at his temples, the ears
    "mllmllmdmd", // the eyes, deep in the brows' shade
    ".lllddmdd.", // the long straight nose
    ".llldmmdd.",
    "..llmmdd..",
    "..lxxxdd..", // a closed smile
    "...lmmd...",
    "...lmd....", // the narrow chin
    "....md....", // the neck
  ],
  pieces: [
    // His fist round it, knuckles toward us, the thumb over the top.
    {
      in: ell(-6.95, 30.6, 1.35, 1.5),
      mark: (X, j, s) => {
        if (s === 1) return undefined;
        if (j > 31.6 && j < 31.9 && X > -7.9 && X < -6.2) return "d"; // the thumb's edge
        if (j < 31 && (Math.abs(X + 7.5) < 0.09 || Math.abs(X + 6.9) < 0.09 || Math.abs(X + 6.3) < 0.09)) return "d"; // the fingers
        return undefined;
      },
    },
    // That arm: the upper arm close at his side, the forearm a little forward to the fist; a cuff at the wrist.
    { in: capsule(-7.1, 39.4, -6.9, 32.2, 1.3, 1.15), mark: (_X, j, s) => (s > 1 && j > 33.1 && j < 33.4 ? "d" : undefined) },
    { in: capsule(-5.1, 49.4, -7.1, 39.4, 1.55, 1.4) },
    // His other arm, easy at his side, a little bent; the hand loose, its fingers curled in.
    {
      in: ell(6.35, 28.6, 1.15, 1.9),
      mark: (X, j, s) => (s > 1 && j < 28.4 && Math.abs(X - 6.3) < 0.08 ? "d" : undefined),
    },
    { in: capsule(6.6, 39.6, 6.4, 30.2, 1.3, 1.15), mark: (_X, j, s) => (s > 1 && j > 31 && j < 31.3 ? "d" : undefined) },
    { in: capsule(5.1, 49.4, 6.6, 39.6, 1.55, 1.4) },
    {
      // The collar: two points spread over the shirt's top, open at the throat.
      in: poly([[-2.1, 52.9], [-3.6, 51.8], [-2.4, 49.2], [-0.1, 51], [0.1, 51], [2.4, 49.2], [3.6, 51.8], [2.1, 52.9], [0.9, 51.9], [-0.9, 51.9]]),
      mark: (X, j) => (Math.abs(X) < 0.35 && j > 50.5 ? "d" : undefined),
    },
    { in: B_HAIR, big: true, deep: true, mark: (X, j) => curls(X, j) },
    {
      in: B_FACE,
      big: true,
      // A strong straight brow over deep-set eyes, the long straight nose, full cheeks, a warm closed smile.
      mark: (X, j) => {
        const ax = Math.abs(X);
        if (j > 59.6 && j < 60.25 - Math.max(0, ax - 2) * 0.3 && ax > 0.4 && ax < 2.55) return "x"; // the brows, straight and strong
        if (j > 60.25 && j < 60.5 && X < -0.45 && X > -2.3) return "l"; // the lit ridge over the left one
        if (j > 59.2 && j < 59.6 && ax > 0.65 && ax < 2.05) return "d"; // the upper lids, in the brows' shade
        if (j > 58.5 && j < 59.2 && ax > 1.05 && ax < 1.45) return "x"; // the pupils, cut in the bronze
        if (j > 58.5 && j < 59.2 && ax > 0.7 && ax < 1.9) return "m"; // the eyes
        if (j > 58.2 && j < 58.5 && ax > 0.8 && ax < 1.8) return "d"; // the lower lids
        if (X > -0.3 && X < 0.02 && j > 56.4 && j < 59.4) return "l"; // the nose's lit ridge
        if (X > 0.3 && X < 0.62 && j > 56.2 && j < 59.4) return "d"; // its shade, straight down
        if (j > 55.9 && j < 56.25 && X > -0.6 && X < 0.8) return "d"; // under its tip
        if (j > 56.25 && j < 56.6 && Math.abs(X - 0.1) > 0.45 && Math.abs(X - 0.1) < 0.75) return "d"; // the nostrils
        // The mouth: a closed smile, its corners up; the lower lip catching the light.
        if (ax < 1.25 && Math.abs(j - (54.85 + 0.6 * Math.max(0, ax - 0.35) ** 1.6)) < 0.14) return "x";
        if (ax > 1.1 && ax < 1.4 && j > 55.1 && j < 55.6) return "d"; // the smile's corners, lifting the cheeks
        if (j > 54.3 && j < 54.55 && X > -0.55 && X < 0.1) return "l"; // the lower lip catching the light
        if (j > 53.1 && j < 53.4 && X > -0.2 && X < 0.9) return "d"; // under the chin
        if (X > 1.85 && j > 54.4 && j < 57.6) return "d"; // the cheek's shade, on our right
        return undefined;
      },
    },
    { in: any(ell(-3, 57.9, 0.62, 1.15), ell(3, 57.9, 0.62, 1.15)), big: true }, // ears
    { in: box(-1.3, 1.4, 51, 55), big: true }, // neck
    {
      // The shirt: a button-down, a placket of small buttons, a pocket on his left (our right).
      in: B_TORSO,
      mark: (X, j, s) => {
        if (s === 1) return Math.abs(X) < 0.5 && j > 41 && j < 48 && Math.floor(j) % 3 === 0 ? "d" : undefined;
        if (Math.abs(X - 0.4) < 0.1 && j < 49.5) return "d"; // the placket's edge
        if (Math.hypot(X, j - 1 - Math.round((j - 1) / 3.2) * 3.2) < 0.26 && j < 49) return "d"; // the buttons
        if ((Math.abs(X - 3.4) < 0.1 || Math.abs(X - 1.6) < 0.1) && j > 42 && j < 45.5) return "d"; // the pocket
        if (j > 42 && j < 42.25 && X > 1.6 && X < 3.4) return "d";
        return undefined;
      },
      glint: (X, j) => j > 49.6 && X < -3.9,
    },
    { in: box(-4.8, 4.8, 30, 31.8), mark: (X, _j, s) => (s > 1 && Math.abs(X - 0.3) < 0.8 ? "l" : undefined) }, // the belt, its buckle
    { in: B_LEG_L, deep: true, mark: (X, j, s) => (s > 1 && j > 5 && j < 25 && Math.abs(X + 2.5) < 0.1 ? "x" : undefined) }, // the trouser creases
    { in: B_LEG_R, deep: true, mark: (X, j, s) => (s > 1 && j > 5 && j < 25 && Math.abs(X - 2.5) < 0.1 ? "x" : undefined) },
    { in: any(ell(-2.7, 3.3, 2.3, 1.6), ell(2.7, 3.3, 2.3, 1.6)) }, // shoes
    { in: box(-8.5, 8.5, 0, 2.2) }, // his base
  ],
};

/**
 * The small knight in his right hand (our left), held up at his hip, facing our left: polished bright where hands have
 * touched it (a statue's lucky charm). Its own part, outlined, so it reads against his arm; at the world's scale it is
 * a few pixels of his fist and left out.
 */
const KNIGHT: Figure = {
  half: 13,
  h: 68,
  top: 0,
  head: [],
  pieces: [
    {
      in: poly([[-6.7, 31.4], [-6.6, 33.2], [-7, 35.3], [-7.6, 34.8], [-8.4, 34.9], [-9.4, 34.1], [-10.1, 33.2], [-9.9, 32.6], [-8.9, 32.8], [-8.3, 31.4]]),
      mark: (X, j) => (Math.hypot(X + 8, j - 34) < 0.22 ? "x" : Math.hypot(X + 9.7, j - 33.1) < 0.15 ? "d" : undefined), // its eye, its nostril
    },
    { in: box(-8.9, -6.2, 30.9, 31.5), mark: () => "d" }, // its collar, over his fingers
  ],
};

// ---- The pedestals: a base course, a die with a panel on its face, a cornice, about a chess piece's plinth's size
// (coliseum.ts, 38 x 20). The marble statue's is marble, its panel sunk; the bronze statue's is the Coliseum's stone with a
// bronze plaque. At the world's scale the panel holds no words, only a few short squiggly lines, like writing too small to
// read; up close the game writes the quote over them (render.ts), engraved in the marble or cast in the bronze.

/** The pedestal's size (Coliseum pixels): about a piece's plinth (Eric, Oct 26: "a normal size block"). */
export const PED_W = 40;
export const PED_H = 24;
/** Its panel's face, where the quote goes: across from its middle and up from its foot (Coliseum pixels), framed by a rim a pixel wide. */
const FACE = { x0: -17, x1: 17, j0: 4, j1: 19 } as const;
/** The die (between the base course and the cornice): its half width, and where it runs. */
const DIE = { half: 19, j0: 2, j1: 21 } as const;
/**
 * The squiggles on the panel: a few short lines of "writing" (each a run of word lengths, in Coliseum pixels, two apart),
 * from the top line down, centered. They're as long as the panel's lines of text would be, give or take.
 */
const SQUIGGLES: readonly (readonly number[])[] = [
  [7, 9, 5, 6],
  [5, 10, 8, 4],
  [8, 4, 9],
  [6, 5],
];
/** The squiggles' lines' rows (j of their middles) and how far they wave (Coliseum pixels). */
const SQUIGGLE_J = [16, 13, 10, 7] as const;
const SQUIGGLE_AMP = 0.45;

/** Is (X, j) on a squiggle, at scale s (1: a pixel wide, waving a row up and down; finer: a thin wavy stroke)? */
function onSquiggle(X: number, j: number, s: number): boolean {
  for (let l = 0; l < SQUIGGLES.length; l++) {
    const jm = SQUIGGLE_J[l]!;
    if (Math.abs(j - jm) > 1.2) continue;
    const words = SQUIGGLES[l]!;
    const total = words.reduce((t, w) => t + w, 0) + 2 * (words.length - 1);
    let x = -total / 2;
    for (const w of words) {
      if (X >= x && X < x + w) {
        const wave = Math.sin((X - x) * 1.9 + l * 2.1) + 0.35 * Math.sin((X - x) * 4.3 + l);
        if (s === 1) return Math.floor(j) === Math.floor(jm) + (wave > 0.35 ? 1 : 0);
        return Math.abs(j - jm - SQUIGGLE_AMP * 0.75 * wave) < 0.2;
      }
      x += w + 2;
    }
  }
  return false;
}

function pedestal(cx: number, fy: number, s: number, kind: StatueId): Generator<void, Painted> {
  const marble = kind === "marble";
  const stone = marble ? "PPpqQ" : "12345"; // lightest to darkest
  const half = PED_W / 2;
  return paintSteps(cx - half * s, fy - PED_H * s, PED_W * s, PED_H * s, (x, y) => {
    const X = (x + 0.5 - cx) / s;
    const j = (fy - (y + 0.5)) / s;
    const u = 1 / s; // one picture pixel at this scale, in units
    const lit = (X: number, h: number) => (X < -h + 2.5 ? 0 : X > h - 4 ? 3 : X > h * 0.3 ? 2 : 1);
    // The base course: its top lit.
    if (j < DIE.j0) return j >= DIE.j0 - u ? stone[0]! : stone[Math.min(4, lit(X, half) + 1)]!;
    // The cornice: a shadowed band, a lit face, a lit top.
    if (j >= DIE.j1) {
      if (j >= PED_H - u) return stone[0]!;
      if (j < DIE.j1 + 1) return stone[3]!;
      return stone[lit(X, half)]!;
    }
    // The die.
    if (Math.abs(X) >= DIE.half) return null;
    if (j >= DIE.j1 - u) return stone[3]!; // the cornice's shadow on it
    const inPanel = X >= FACE.x0 - 1 && X < FACE.x1 + 1 && j >= FACE.j0 - 1 && j < FACE.j1 + 1;
    if (!inPanel) {
      const g = grain(Math.floor(X * 2), Math.floor(j * 2), marble ? 11 : 12); // speckled a little (the stone's grain)
      const k = lit(X, DIE.half);
      return stone[k === 1 && g > 0.93 ? 2 : k]!;
    }
    const field = X >= FACE.x0 && X < FACE.x1 && j >= FACE.j0 && j < FACE.j1;
    if (marble) {
      // A sunk panel: its top and left edges in shadow, its bottom and right lit; the field flat (the quote's place).
      if (!field) return j >= FACE.j1 || X < FACE.x0 ? stone[3]! : stone[0]!;
      return onSquiggle(X, j, s) ? stone[3]! : stone[1]!;
    }
    // A bronze plaque, raised: its rim lit on the top and left, dark on the bottom and right; the field flat.
    if (!field) return j >= FACE.j1 || X < FACE.x0 ? "c" : "B";
    return onSquiggle(X, j, s) ? "c" : "b";
  });
}

// ---- The two statues as pictures: the pedestal and the figure, at the world's scale or finer.

const PALETTE: Record<string, string> = {
  k: "#2a1c14", // outline
  "1": "#fbf0d8", // the Coliseum's stone (travertine), lightest to darkest
  "2": "#ecd9b2",
  "3": "#d8bf93",
  "4": "#bb9e70",
  "5": "#93784f",
  c: "#cf9a52", // bronze: light, mid, dark, deep
  b: "#946231",
  B: "#5e3b1c",
  D: "#3e2511",
  v: "#fff2cc", // a glint
  // The marble, lightest to darkest (MARBLE_KEYS): a cool grey-white, a step darker than the pieces' so it stands out
  // against the cream wall. Its pedestal takes P, p, q and Q.
  w: "#fbfaf7",
  P: "#f2f1ee",
  "6": "#e3e0da",
  p: "#d2cec6",
  "7": "#bbb6ad",
  q: "#a29b90",
  "8": "#8b8479",
  Q: "#746d63",
  "9": "#5f584f",
};

/** A statue's figure's height over the pedestal (the world's pixels). */
const figureH = (id: StatueId) => (id === "bronze" ? BRONZE.h : marbleH());
/** A statue's picture: its box in the Coliseum's pixels (w x h, its pedestal's foot in the middle of its bottom). */
export const STATUE_W = PED_W + 2;
export const statueH = (id: StatueId) => figureH(id) + PED_H + 2;

/**
 * A statue's layers (its pedestal, its figure, and the bronze statue's knight at the close-up), drawn `s` times finer than
 * the world, in their frame of STATUE_W x statueH(id) picture pixels times `s`; made a few rows at a time.
 */
export function* statueSteps(id: StatueId, s: number): Generator<void, Painted[]> {
  const cx = (STATUE_W * s) / 2;
  const fy = statueH(id) * s - s; // the pedestal's foot (one picture pixel left under it for its outline)
  const top = fy - PED_H * s; // the figure's feet (on the pedestal's top)
  const ped = yield* pedestal(cx, fy, s, id);
  if (id === "marble") return [ped, yield* sculpt(MARBLE_SLAB, cx, top, "PpqQw", s), bossFigure(cx, top - MARBLE_SLAB.h * s, s)];
  const out = [ped, yield* sculpt(BRONZE, cx, top, "cbBDv", s)];
  if (s > 1) out.push(yield* sculpt(KNIGHT, cx, top, "vcbDv", s));
  return out;
}

/** A frame of a statue's layers (all of them, or one: the close-up is drawn a layer at a time). */
export function statueFrame(id: StatueId, s: number, layers: readonly Painted[]): Character {
  const parts: Record<string, Part> = {};
  layers.forEach((l, i) => (parts[`p${i}`] = l.part));
  const w = STATUE_W * s;
  const h = statueH(id) * s;
  return {
    id: `statue-${id}-${s}`,
    name: id === "bronze" ? "The bronze statue" : "The marble statue",
    w,
    h,
    foot: [w / 2, h - s],
    palette: PALETTE,
    parts,
    anims: { idle: { loop: true, frames: [{ ms: 1000, layers: layers.map((l, i) => ({ part: `p${i}`, x: l.at[0], y: l.at[1] })) }] } },
  };
}

/** A statue (pedestal and figure) drawn `s` times finer than the world, all at once (the world's figure is small). */
export const statueArt = (id: StatueId, s: number): Character => statueFrame(id, s, run(statueSteps(id, s)));

/** Where the quote goes on a statue's pedestal, in its picture's pixels at the world's scale (x, y from its top left). */
export function quoteFace(id: StatueId): { x: number; y: number; w: number; h: number } {
  const fy = statueH(id) - 1;
  return { x: STATUE_W / 2 + FACE.x0, y: fy - FACE.j1, w: FACE.x1 - FACE.x0, h: FACE.j1 - FACE.j0 };
}

/**
 * The quote's lettering colors: engraved in the marble (dark, its lower edge lit) or cast in the bronze (light,
 * shadowed); and the panel's flat field, laid over the squiggles as the quote renders in.
 */
export const QUOTE_INK: Record<StatueId, { ink: string; edge: string; field: string }> = {
  marble: { ink: "#5f5850", edge: "#fbfaf7", field: PALETTE.P! },
  bronze: { ink: "#f3c681", edge: "#3e2511", field: PALETTE.b! },
};
