/**
 * Inside Birdie's station: the lobby (Nov 23). A cozy station hall: terrazzo floor with a yellow platform line, cream walls
 * over a charcoal dado and a red rail, two open arches at the back onto the tracks (Birdie's yellow diesel pulls out now and
 * then), a split-flap board of little pictures (no letters, no numbers), airport seats, a low café counter with stools, a
 * railroad crossing painted on the floor as the match spot, plants, shrubs, lamps, and the open glass doors out.
 *
 * Built like the Battle Tower's lobby: every piece its own Character (`shop-birdie-<name>`), 37 px a square, a piece's foot
 * the middle of its square (a wide piece's: the middle of its width, on its row). Floor tiles are flat 37 x 37.
 */
import type { Character, Frame, Layer, Part } from "../../../../packages/app/src/characters/sprite.ts";
import { signBoard, signFace, type LightPool, type LightSpot } from "../../../../packages/app/src/town/houses/kit.ts";

const SQ = 37;
type Key = string | null;

const PAL: Record<string, string> = {
  k: "#1a1714",
  Y: "#f4c430", y: "#d9a21b", P: "#ffe27a",
  C: "#2b2d31", c: "#3a3d44", g: "#54575f",
  R: "#c8372d", r: "#8e1f1a",
  W: "#a86a3c", w: "#7a4a26", L: "#c99866",
  E: "#f3f1ec", e: "#e0d9cb", "1": "#ffffff",
  G: "#4f7a3a", H: "#6f9a4f", h: "#2f4f25",
  T: "#b5643a", t: "#8a4628", o: "#d48a5c",
  A: "#ffe2a0", O: "#ffb85c", a: "#fff1cc",
  F: "#efe8da", f: "#e6dccb", u: "#d9ceb9", s: "#c9b598", S: "#a8937a", m: "#fbf8f1",
  B: "#a9d8ee", b: "#d9eef6", j: "#a9c88a", J: "#8fb26f",
  v: "#9a9184", V: "#b9b1a3", I: "#d7dbe0", i: "#8b9199",
  Q: "#dff1f7", q: "#b2d7e5", Z: "#e8c25a", z: "#a07a2c",
  D: "#fff8e6", d: "#e9dfc8",
  "-": "#1a171440", "+": "#1a171422",
};

function hash(x: number, y: number, s = 1): number {
  let h = Math.imul(x + 374761, 668265263) ^ Math.imul(y + 9127, 2246822519) ^ Math.imul(s + 77, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const SOFT = new Set(["-", "+", "a"]);
/** A canvas of palette keys. */
class Pix {
  readonly c: Key[][];
  constructor(readonly w: number, readonly h: number) {
    this.c = Array.from({ length: h }, () => Array<Key>(w).fill(null));
  }
  set(x: number, y: number, k: Key): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y]![x] = k;
  }
  get(x: number, y: number): Key {
    return this.c[y]?.[x] ?? null;
  }
  rect(x: number, y: number, w: number, h: number, k: Key): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, k);
  }
  each(fn: (x: number, y: number) => Key): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const k = fn(x, y);
        if (k) this.c[y]![x] = k;
      }
  }
  /** Pixels inside an ellipse; `fn` gets the offsets and the normalized distance squared. */
  ell(cx: number, cy: number, rx: number, ry: number, fn: (dx: number, dy: number, d: number) => Key): void {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = (dx / rx) ** 2 + (dy / ry) ** 2;
        if (d <= 1) {
          const k = fn(dx, dy, d);
          if (k) this.set(x, y, k);
        }
      }
  }
  stamp(rows: readonly string[], x0: number, y0: number, flip = false): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[flip ? row.length - 1 - i : i]!;
        if (ch !== "." && ch !== " ") this.set(x0 + i, y0 + j, ch);
      }
    });
  }
  shadow(cx: number, cy: number, rx: number, ry: number): void {
    this.ell(cx, cy, rx, ry, (_, __, d) => (d > 0.55 ? "+" : "-"));
  }
  /** Rings the solid pixels with `k` (shadows and glows are not rung). */
  outline(): void {
    const solid = (x: number, y: number) => {
      const k = this.get(x, y);
      return !!k && !SOFT.has(k) && k !== "k";
    };
    const out: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const k = this.get(x, y);
        if (k && !SOFT.has(k)) continue;
        if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) out.push([x, y]);
      }
    for (const [x, y] of out) this.c[y]![x] = "k";
  }
  grid(): string[] {
    return this.c.map((r) => r.map((k) => k ?? ".").join(""));
  }
}

// ---------------------------------------------------------------- the floor

/** Terrazzo: cream (v 0) or warm stone (v 1), a few flecks, a 1 px grout round every tile (so turned tiles still meet). */
function terrazzo(x: number, y: number, v: number): string {
  const i = ((x % SQ) + SQ) % SQ;
  const j = ((y % SQ) + SQ) % SQ;
  if (i === 0 || j === 0 || i === SQ - 1 || j === SQ - 1) return "u";
  const r = hash(i, j, 7 + v);
  if (r < 0.028) return "s";
  if (r < 0.038) return "S";
  if (v === 0 && i > 3 && j > 3 && i < 12 && (i + j === 14 || i + j === 15)) return "m";
  return v ? "f" : "F";
}
/** The yellow platform line along the tile's west side (turn it with rot), with tactile dots. */
function edgeWest(i: number, j: number): Key {
  if (i < 4 || i > 8) return null;
  if (i === 4) return "P";
  if (i === 8) return "y";
  return i === 6 && j % 5 === 2 ? "y" : "Y";
}
function edgeSouth(i: number, j: number): Key {
  if (j < 28 || j > 32 || i < 4) return null;
  if (j === 28) return "P";
  if (j === 32) return "y";
  return j === 30 && i % 5 === 2 ? "y" : "Y";
}

// ---------------------------------------------------------------- the walls

export const SHOP_BIRDIE_WALL_H = 130;
const WH = SHOP_BIRDIE_WALL_H;
/** The wall: a wood cornice, cream plaster, a red rail, a charcoal panelled dado (a third of the height), a wood skirting. */
function wallKey(x: number, y: number): string {
  const i = ((x % SQ) + SQ) % SQ;
  if (y === 0) return "k";
  if (y <= 4) return y === 1 ? "L" : y === 4 ? "w" : "W";
  if (y <= 6) return "e";
  if (y < 80) return hash(x, y, 3) < 0.012 ? "e" : "E";
  if (y === 80 || y === 84) return "k";
  if (y <= 82) return "R";
  if (y === 83) return "r";
  if (y === 85) return "g";
  if (y <= 121) {
    if (i >= 4 && i <= 32 && y >= 90 && y <= 116) {
      if (y === 90 || i === 4) return "C";
      if (y === 116 || i === 32) return "g";
    }
    return "c";
  }
  if (y === 122) return "k";
  if (y === 123) return "L";
  if (y <= 126) return "W";
  if (y === 127) return "w";
  return "k";
}
/** A slim wood pilaster in the middle of a square (i: 0-36 across it). */
function pilasterKey(i: number, y: number): Key {
  if (i >= 11 && i <= 25 && y >= 7 && y <= 10) return i === 11 || i === 25 || y === 10 ? "k" : y === 7 ? "L" : "W";
  if (i >= 11 && i <= 25 && y >= 110 && y <= 121) return i === 11 || i === 25 || y === 110 ? "k" : y === 111 ? "L" : "W";
  if (i >= 13 && i <= 23 && y >= 7 && y <= 121) return i === 13 || i === 23 ? "k" : i === 14 ? "L" : i === 22 ? "w" : "W";
  return null;
}
/** The brass fan sconce in train yellow, 11 x 9, its glow dots above. */
const SCONCE = [
  ".a.a.a.a.a.",
  "..a.a.a.a..",
  "kPYPYPYPYyk",
  ".kPYPYPYyk.",
  "..kYAYAyk..",
  "...kYAyk...",
  "....kZk....",
  "...kZZzk...",
  "...kzzzk...",
];
const SCONCE_Y = 38;

/**
 * A side wall as one surface, `run` squares long and WALL_H tall, as seen from inside the room: the west wall's left end is
 * the front (south), the east wall's left end is the back (north). Pilasters every 3 squares, a sconce between each pair.
 */
export const SHOP_BIRDIE_SIDE_WALL_GRID = (west: boolean, run: number): string[] => {
  const p = new Pix(run * SQ, WH);
  p.each((x, y) => wallKey(x, y));
  for (let s = 1; s < run; s += 3) p.each((x, y) => (x >= s * SQ && x < (s + 1) * SQ ? pilasterKey(x - s * SQ, y) : null));
  for (let s = 1; s + 3 < run; s += 3) p.stamp(SCONCE, Math.round(s * SQ + 73.5) - 5, SCONCE_Y);
  const g = p.grid();
  return west ? g : g.map((r) => [...r].reverse().join(""));
};
/** Where the side wall's sconces are, in its picture (for the lights). */
const sideSconces = (run: number): number[] => {
  const xs: number[] = [];
  for (let s = 1; s + 3 < run; s += 3) xs.push(Math.round(s * SQ + 73.5) - 5);
  return xs;
};

// ---------------------------------------------------------------- the arches and the tracks

const HZ = 62; // the horizon in the arch
const PLAT = 115; // the platform's edge
/** The train seen from behind, pulling away: its depth s (1 near, toward 0 at the horizon). */
function train(p: Pix, cx: number, s: number): void {
  const base = Math.round(HZ + (PLAT - HZ) * s) - 1;
  const bw = Math.max(2, Math.round(22 * s));
  const bh = Math.max(2, Math.round(20 * s));
  const x0 = Math.round(cx - bw / 2);
  const y0 = base - bh + 1;
  if (bw >= 6) p.rect(x0 - 1, y0 - 1, bw + 2, bh + 2, "k");
  for (let j = 0; j < bh; j++)
    for (let i = 0; i < bw; i++) {
      const f = j / bh;
      let k = "Y";
      if (f < 0.17) k = bw >= 6 && j === 0 ? "g" : "C";
      else if (f >= 0.26 && f < 0.48 && bw >= 8 && ((i >= 2 && i < bw / 2 - 1) || (i > bw / 2 + 1 && i < bw - 2))) k = "k";
      else if (f >= 0.6 && f < 0.74) k = "R";
      else if (f >= 0.88) k = "C";
      else if (i === 0 && bw >= 6) k = "P";
      else if (i === bw - 1 && bw >= 6) k = "y";
      p.set(x0 + i, y0 + j, k);
    }
  if (bw >= 10) {
    p.set(x0 + 2, y0 + Math.round(bh * 0.8), "A"); // tail lamps
    p.set(x0 + bw - 3, y0 + Math.round(bh * 0.8), "A");
  }
}
const TRAIN_AT = [0, 0, 0, 0, 0, 0, 1, 0.62, 0.4, 0.26, 0.15, 0]; // the idle's 12 frames: the train pulls out from frame 6
function archPaint(p: Pix, t: number, withTrain: boolean): void {
  const cx = 37;
  const R = 28;
  const cy = 40;
  const FL = 127;
  const shape = (x: number, y: number, r: number) => {
    const X = x + 0.5 - cx;
    if (Math.abs(X) >= r || y >= FL) return false;
    return y + 0.5 >= cy || X * X + (y + 0.5 - cy) ** 2 < r * r;
  };
  p.each((x, y) => wallKey(x, y));
  // the scene through the opening
  const tracks = [-27, 0, 27];
  p.each((x, y) => {
    if (!shape(x, y, R)) return null;
    if (y < HZ) {
      if (y >= HZ - 3 && Math.sin(x * 0.45) + Math.sin(x * 0.17 + 1) > 0.6 - (y - HZ + 3) * 0.6) return "J";
      if ((x - 22) ** 2 / 30 + (y - 27) ** 2 / 4 < 1 || (x - 50) ** 2 / 20 + (y - 38) ** 2 / 3 < 1) return "E";
      return y < 44 ? "B" : "b";
    }
    if (y === PLAT) return "k";
    if (y > PLAT) return y === PLAT + 1 ? "P" : y <= PLAT + 3 ? "Y" : y === PLAT + 4 ? "y" : terrazzo(x, y, 0);
    const tt = (y + 0.5 - HZ) / (PLAT - HZ);
    const z0 = 1 / tt;
    const z1 = 1 / ((y + 1.5 - HZ) / (PLAT - HZ));
    const tie = Math.floor(4 * z0) !== Math.floor(4 * z1) || (tt > 0.55 && Math.floor(4 * z0) !== Math.floor(4 * (1 / ((y - 0.5 - HZ) / (PLAT - HZ)))));
    for (const tb of tracks) {
      const tcx = cx + tb * tt;
      const X = x + 0.5 - tcx;
      if (Math.abs(X) > 12 * tt + 0.4) continue;
      const off = 6.5 * tt;
      if (Math.abs(Math.abs(X) - off) < 0.5 + 0.3 * tt) return X < 0 ? "I" : "i";
      if (tie && tt > 0.12 && Math.abs(X) < 9.5 * tt) return "w";
      return hash(x, y, 5) < 0.25 ? "V" : "v";
    }
    return Math.floor(z0 * 2.5) % 2 ? "j" : "J";
  });
  if (withTrain && TRAIN_AT[t]) train(p, cx, TRAIN_AT[t]!);
  // the wood surround, lit from the top left
  p.each((x, y) => {
    if (shape(x, y, R) || !shape(x, y, R + 7)) return null;
    if (shape(x, y, R + 1) || !shape(x, y, R + 6)) return "k";
    const X = x + 0.5 - cx;
    const Yy = y + 0.5 - cy;
    const n = Yy < 0 ? [X / Math.hypot(X, Yy), Yy / Math.hypot(X, Yy)] : [Math.sign(X), 0];
    const lit = -(n[0]! + n[1]!) / Math.SQRT2;
    return lit > 0.3 ? "L" : lit < -0.3 ? "w" : "W";
  });
  p.each((x, y) => (shape(x, y, R + 6) && !shape(x, y, R + 7) ? "k" : null));
  // the yellow keystone
  p.each((x, y) => {
    if (y < 3 || y > 15) return null;
    const half = 6 - (y - 3) * 0.17;
    const X = x + 0.5 - cx;
    if (Math.abs(X) > half + 1) return null;
    if (Math.abs(X) > half || y === 3 || y === 15) return "k";
    return y === 4 || X < -half + 1 ? "P" : X > half - 1 ? "y" : "Y";
  });
}

// ---------------------------------------------------------------- the split-flap board

const PIC_TRAIN = [
  "............",
  "..gggggggg..",
  ".YYYYYYYYYY.",
  ".YQQYYYYQQY.",
  ".YQQYYYYQQY.",
  ".YYYYYYYYYY.",
  ".YYYYYYYYYY.",
  ".RRRRRRRRRR.",
  ".yyyyyyyyyy.",
  "..EE....EE..",
  "..EE....EE..",
  "............",
];
const PIC_CLOCK = [
  "....YYYY....",
  "..YYEECEYY..",
  ".YEEEEEEEEY.",
  ".YEEEECEEEY.",
  "YEEEEECEEEEY",
  "YCEEEECCCECY",
  "YEEEEEEEEEEY",
  "YEEEEEEEEEEY",
  ".YEEEEEEEEY.",
  ".YEEEEEEEEY.",
  "..YYEECEYY..",
  "....YYYY....",
];
const PIC_NEST = [
  "............",
  "............",
  "....BB.EE...",
  "...BBBBEEE..",
  "...BBBBEEE..",
  ".LWLWLWLWLW.",
  "LWwWLWwWLWwL",
  "LwWLWwWLWwWw",
  ".wWwWwWwWww.",
  "..wwwwwwww..",
  "...wwwwww...",
  "............",
];
const PIC_ARROW = [
  "............",
  "............",
  ".......Y....",
  ".......YY...",
  "PPPPPPPYYY..",
  "YYYYYYYYYYY.",
  "YYYYYYYYYYYY",
  "yyyyyyyyyyy.",
  ".......yyy..",
  ".......yy...",
  ".......y....",
  "............",
];
const PIC_BIRD = [
  "............",
  "............",
  "......EEE...",
  ".....EEkEY..",
  ".....EEEEYY.",
  "R...EEEEE...",
  "RR.EEEEEE...",
  ".EEERRREE...",
  "..EEERRE....",
  "....EEE.....",
  ".....Y.Y....",
  "............",
];
const PICS = [PIC_TRAIN, PIC_CLOCK, PIC_NEST, PIC_ARROW, PIC_BIRD];
const FLAP_W = 16;
const FLAP_H = 18;
/** The flap grid's box in the board's pixels: 7 flaps of 16 x 18 across (2 px apart), 3 rows (3 px apart). */
export const SHOP_BIRDIE_BOARD_BOX = { x: 12, y: 20, w: 124, h: 60 } as const;
const picOf = (r: number, c: number, s: number) => {
  const a = (r * 3 + c * 2) % 5;
  return { pic: PICS[s ? (a + 1 + ((r + c) % 3)) % 5 : a]!, flip: (c + s) % 2 === 1 };
};
/** One row's state in the idle's 12 frames: A still (0-2), flipping to B in turn (3-5), B still (6-8), flipping back (9-11). */
function rowState(r: number, t: number): { s: number; from?: number } {
  if (t <= 2) return { s: 0 };
  if (t <= 5) return r < t - 3 ? { s: 1 } : r === t - 3 ? { s: 1, from: 0 } : { s: 0 };
  if (t <= 8) return { s: 1 };
  return r < t - 9 ? { s: 0 } : r === t - 9 ? { s: 0, from: 1 } : { s: 1 };
}
function flap(p: Pix, fx: number, fy: number, r: number, c: number, t: number): void {
  const st = rowState(r, t);
  const now = picOf(r, c, st.s);
  p.rect(fx, fy, FLAP_W, 9, "c");
  p.rect(fx, fy + 9, FLAP_W, FLAP_H - 9, "C");
  p.rect(fx, fy, FLAP_W, 1, "g");
  const put = (pic: { pic: string[]; flip: boolean }, row: number, at: number, bg?: string) => {
    const line = pic.pic[row]!;
    for (let i = 0; i < 12; i++) {
      const ch = line[pic.flip ? 11 - i : i]!;
      if (ch !== ".") p.set(fx + 2 + i, at, ch);
      else if (bg) p.set(fx + 2 + i, at, bg);
    }
  };
  if (st.from === undefined) {
    for (let j = 0; j < 12; j++) put(now, j, fy + 3 + j);
  } else {
    const old = picOf(r, c, st.from);
    for (let j = 0; j < 2; j++) put(now, j, fy + 3 + j); // the new top, revealed above the falling leaf
    for (let j = 7; j < 12; j++) put(old, j, fy + 3 + j); // the old bottom, still down
    // the old top leaf falling: squashed, lit, its edge dark
    p.rect(fx, fy + 5, FLAP_W, 1, "k");
    p.rect(fx, fy + 6, FLAP_W, 3, "g");
    [0, 2, 4].forEach((row, j) => put(old, row, fy + 6 + j, "g"));
  }
  p.rect(fx, fy + 9, FLAP_W, 1, "k"); // the hinge
  p.set(fx, fy + 9, "g");
  p.set(fx + FLAP_W - 1, fy + 9, "g");
}
function boardPaint(p: Pix, t: number): void {
  p.each((x, y) => wallKey(x, y));
  p.rect(5, 13, 138, 74, "k");
  p.rect(6, 14, 136, 72, "Y");
  p.rect(6, 14, 136, 1, "P");
  p.rect(6, 14, 1, 72, "P");
  p.rect(6, 85, 136, 1, "y");
  p.rect(141, 14, 1, 72, "y");
  p.rect(8, 16, 132, 68, "k");
  p.rect(9, 17, 130, 66, "C");
  p.rect(9, 17, 130, 1, "c");
  for (const [bx, by] of [[10, 18], [137, 18], [10, 81], [137, 81]] as const) p.set(bx, by, "g");
  const B = SHOP_BIRDIE_BOARD_BOX;
  p.rect(B.x - 1, B.y - 1, B.w + 2, B.h + 2, "k");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) flap(p, B.x + c * (FLAP_W + 2), B.y + r * (FLAP_H + 3), r, c, t);
  // two hangers up to the cornice
  for (const hx of [30, 117]) {
    p.rect(hx, 5, 2, 8, "C");
    p.set(hx, 5, "g");
  }
}

// ---------------------------------------------------------------- the pieces

interface Def {
  name: string;
  w: number;
  h: number;
  /** Size in squares (w, d). */
  sq: readonly [number, number];
  foot: readonly [number, number];
  floor?: boolean;
  outline: boolean;
  frames: number;
  ms: number;
  paint: (p: Pix, t: number) => void;
}
const DEFS: Def[] = [];
const def = (d: Omit<Def, "frames" | "ms" | "outline" | "sq"> & Partial<Def>) =>
  DEFS.push({ frames: 1, ms: 1000, outline: true, sq: [1, 1], ...d });
const tile = (name: string, fn: (i: number, j: number) => Key) =>
  def({ name, w: SQ, h: SQ, foot: [18, 18], floor: true, outline: false, paint: (p) => p.each(fn) });

tile("floor-a", (i, j) => terrazzo(i, j, 0));
tile("floor-b", (i, j) => terrazzo(i, j, 1));
tile("floor-edge", (i, j) => edgeWest(i, j) ?? terrazzo(i, j, 0));
tile("floor-edge-corner", (i, j) => (j <= 32 ? edgeWest(i, j) : null) ?? edgeSouth(i, j) ?? terrazzo(i, j, 0));
tile("floor-door", (i, j) => {
  // a charcoal mat, its yellow edge open on the east (the next tile, turned, closes it)
  if (i < 3 || j < 3 || j > 33) return terrazzo(i, j, 0);
  if (i === 3 || j === 3 || j === 33) return "k";
  if (i <= 5 || j <= 5 || j >= 31) return i === 4 || j === 4 ? "P" : "Y";
  return j % 2 ? "c" : "C";
});

def({ name: "wall", w: SQ, h: WH, foot: [18, WH - 1], outline: false, paint: (p) => p.each(wallKey) });
def({ name: "wall-pilaster", w: SQ, h: WH, foot: [18, WH - 1], outline: false, paint: (p) => p.each((x, y) => pilasterKey(x, y) ?? wallKey(x, y)) });
def({ name: "wall-none", w: SQ, h: 1, foot: [18, 0], outline: false, paint: () => {} });
def({ name: "blank", w: SQ, h: 1, foot: [18, 0], outline: false, paint: () => {} });
def({ name: "arch", w: 2 * SQ, h: WH, sq: [2, 1], foot: [37, WH - 1], outline: false, frames: 12, ms: 500, paint: (p, t) => archPaint(p, t, true) });
def({ name: "arch-east", w: 2 * SQ, h: WH, sq: [2, 1], foot: [37, WH - 1], outline: false, paint: (p, t) => archPaint(p, t, false) });
def({ name: "board", w: 4 * SQ, h: WH, sq: [4, 1], foot: [74, WH - 1], outline: false, frames: 12, ms: 500, paint: boardPaint });

// ---------------------------------------------------------------- the room

export interface ShopPlace {
  /** A key of SHOP_BIRDIE_PIECES. */
  piece: string;
  col: number;
  row: number;
  /** Squares wide and deep (default 1). */
  w?: number;
  d?: number;
  /** Floor tiles: quarter turns clockwise. */
  rot?: 0 | 1 | 2 | 3;
  /** The way out. */
  exit?: boolean;
  /** A blank that only keeps the square solid. */
  solid?: boolean;
}

export const SHOP_BIRDIE_N = 10;
const L: ShopPlace[] = [];
for (let row = 0; row < 10; row++)
  for (let col = 1; col <= 8; col++) {
    const east = col === 8;
    if (row === 8 && (col === 4 || col === 5)) L.push({ piece: "floor-door", col, row, rot: col === 5 ? 2 : 0 });
    else if (row >= 1 && row <= 8 && (col === 1 || east)) {
      if (row === 8) L.push({ piece: "floor-edge-corner", col, row, rot: east ? 3 : 0 });
      else L.push({ piece: "floor-edge", col, row, rot: east ? 2 : 0 });
    } else if (row === 8) L.push({ piece: "floor-edge", col, row, rot: 3 });
    else L.push({ piece: (col + row) % 2 ? "floor-b" : "floor-a", col, row });
  }
L.push({ piece: "ring-crossing", col: 3, row: 4, w: 4, d: 4 });
for (let row = 1; row <= 9; row++) for (const col of [0, 9]) L.push({ piece: "blank", col, row, solid: true });
L.push({ piece: "wall-none", col: 0, row: 0, solid: true }, { piece: "wall-none", col: 9, row: 0, solid: true });
L.push({ piece: "arch", col: 1, row: 0, w: 2 }, { piece: "board", col: 3, row: 0, w: 4 }, { piece: "arch-east", col: 7, row: 0, w: 2 });
L.push({ piece: "plant", col: 1, row: 1 }, { piece: "plant", col: 8, row: 1 });
L.push({ piece: "seats", col: 1, row: 2, w: 3 }, { piece: "lamp", col: 4, row: 2 });
L.push({ piece: "seats", col: 1, row: 3, w: 3 }, { piece: "counter", col: 6, row: 3, w: 3 });
L.push({ piece: "cafe-chair", col: 4, row: 4 });
for (const col of [6, 7, 8]) L.push({ piece: "stool", col, row: 4 });
L.push({ piece: "match-table", col: 4, row: 5, w: 2 });
L.push({ piece: "cafe-chair-n", col: 4, row: 6 });
L.push({ piece: "lamp", col: 8, row: 6 });
L.push({ piece: "crossing-post", col: 3, row: 7 }, { piece: "crossing-post", col: 6, row: 7 });
L.push({ piece: "shrub", col: 1, row: 8 }, { piece: "shrub-b", col: 8, row: 8 });
for (const col of [1, 2, 3, 6, 7, 8]) L.push({ piece: "hem", col, row: 9 });
L.push({ piece: "entrance", col: 4, row: 9, w: 2, exit: true });
export const SHOP_BIRDIE_LAYOUT: readonly ShopPlace[] = L;

// ---------------------------------------------------------------- the furniture

def({ name: "seats", w: 3 * SQ, h: 46, sq: [3, 1], foot: [55, 42], paint: (p) => {
  p.shadow(55.5, 42, 54, 3.5);
  for (const lx of [9, 55, 101]) {
    p.rect(lx - 1, 32, 3, 9, "C");
    p.rect(lx - 3, 40, 7, 2, "g");
  }
  p.rect(2, 30, 107, 3, "C");
  p.rect(2, 30, 107, 1, "g");
  for (let s = 0; s < 3; s++) {
    const x0 = 4 + s * 36;
    p.each((x, y) => {
      const i = x - x0;
      if (i < 0 || i > 31 || y < 5 || y > 30) return null;
      const cr = Math.min(i, 31 - i);
      if (y - 5 < 3 - cr) return null; // rounded top corners
      if (y <= 9) return y === 5 || (y === 6 && cr < 2) ? "P" : y === 9 ? "y" : "Y";
      if (y === 10 || y === 21 || y === 25) return "k";
      if (y >= 22 && y <= 24) return i < 2 || i > 29 ? "k" : y === 22 ? "Y" : "y"; // the seat's cushion, seen under the back
      if (y > 25) return i === 0 ? "g" : "C";
      return i === 0 ? "g" : i === 31 ? "C" : "c";
    });
    p.rect(x0 + 13, 15, 6, 3, "y"); // a little yellow plate on the back
    p.rect(x0 + 13, 15, 6, 1, "P");
  }
  for (const ax of [1, 37, 73, 108]) {
    p.rect(ax, 14, 2, 17, "C");
    p.rect(ax, 14, 2, 1, "g");
  }
  p.outline();
  for (const kx of [36, 39, 72, 75]) for (let y = 11; y < 30; y++) p.set(kx, y, "k");
} });

def({ name: "counter", w: 3 * SQ, h: 34, sq: [3, 1], foot: [55, 31], paint: (p) => {
  p.shadow(55.5, 31, 55, 3);
  p.rect(2, 12, 107, 4, "W");
  p.rect(2, 12, 107, 1, "L");
  p.each((x, y) => (y >= 13 && y <= 15 && x >= 2 && x <= 108 && hash(x, y, 9) < 0.18 ? "w" : null));
  p.rect(2, 16, 107, 1, "E");
  p.rect(2, 17, 107, 1, "e");
  p.rect(3, 18, 105, 12, "c");
  p.rect(3, 18, 105, 1, "C");
  p.rect(3, 21, 105, 2, "R");
  p.rect(3, 23, 105, 1, "r");
  p.rect(3, 29, 105, 1, "C");
  for (const gx of [28, 82]) p.rect(gx, 19, 1, 10, "C");
  const sb = signBoard(42, 19, 27, 11, "wwWL", "eEm", "Z");
  p.stamp(sb.part.grid as string[], sb.at[0], sb.at[1]);
  p.stamp(["...z...", "..ZZz..", ".PZZZz.", "zzzzzzz"], 14, 8); // the service bell
  p.stamp(["....zz....", "..ZZZZzz..", ".PZZZZZzz.", ".PZZZZZzz.", ".RRRRRRrr.", ".PZZZZZzzzz", ".PZZZZZzz.z", ".PZZZZZzz..", "..zzzzzz...", "..z....z..."], 80, 2); // the urn
  p.stamp(["EEEe", "EEEe", ".ee."], 68, 9); // a cup
  p.outline();
} });

def({ name: "stool", w: SQ, h: 42, foot: [18, 39], paint: (p) => {
  p.shadow(18.5, 39, 9, 2.5);
  p.ell(18.5, 36.5, 6.5, 2, (dx, dy) => (dy < -0.8 ? "g" : "C"));
  p.ell(18.5, 28, 6.5, 2, (_, dy, d) => (d > 0.4 && dy < 0 ? "C" : null));
  p.rect(17, 14, 3, 22, "c");
  p.rect(17, 14, 1, 22, "g");
  p.rect(19, 14, 1, 22, "C");
  p.ell(18.5, 28, 6.5, 2, (_, dy, d) => (d > 0.4 && dy >= 0 ? "g" : null));
  p.ell(18.5, 13.5, 9, 3, (dx) => (dx > 4 ? "w" : "W"));
  p.ell(18.5, 10, 8.5, 2.6, (dx, dy) => (dx + dy * 2 < -5 ? "P" : dy > 1.6 ? "y" : "Y"));
  p.outline();
} });

def({ name: "cafe-chair", w: SQ, h: 42, foot: [18, 39], paint: (p) => {
  p.shadow(18.5, 39, 11, 2.5);
  p.rect(10, 6, 2, 22, "W");
  p.rect(25, 6, 2, 22, "W");
  p.rect(10, 6, 1, 22, "L");
  p.rect(10, 6, 17, 4, "W");
  p.rect(10, 6, 17, 1, "L");
  p.rect(10, 9, 17, 1, "w");
  p.rect(12, 14, 13, 3, "W");
  p.rect(12, 14, 13, 1, "L");
  p.rect(8, 24, 21, 3, "Y");
  p.rect(8, 24, 21, 1, "P");
  p.rect(8, 27, 21, 3, "W");
  p.rect(8, 29, 21, 1, "w");
  for (const lx of [9, 26]) p.rect(lx, 30, 2, 8, lx === 9 ? "W" : "w");
  p.outline();
  p.rect(10, 23, 17, 1, "k");
} });
def({ name: "cafe-chair-n", w: SQ, h: 42, foot: [18, 39], paint: (p) => {
  p.shadow(18.5, 39, 11, 2.5);
  p.rect(9, 19, 19, 4, "Y");
  p.rect(9, 19, 19, 1, "P");
  p.rect(9, 23, 19, 2, "W");
  for (const lx of [12, 24]) p.rect(lx, 25, 2, 9, "w");
  p.outline();
  p.rect(9, 8, 2, 30, "W");
  p.rect(9, 8, 1, 30, "L");
  p.rect(26, 8, 2, 30, "w");
  p.rect(9, 8, 19, 4, "W");
  p.rect(9, 8, 19, 1, "L");
  p.rect(9, 11, 19, 1, "w");
  p.rect(11, 16, 15, 3, "W");
  p.rect(11, 16, 15, 1, "L");
  p.outline();
  for (const kx of [8, 11, 25, 28]) for (let y = 12; y < 38; y++) if (p.get(kx, y) !== "W" && p.get(kx, y) !== "w" && p.get(kx, y) !== "L" && (y < 16 || y > 18 || kx === 8 || kx === 28)) p.set(kx, y, p.get(kx, y) === null ? null : "k");
} });

def({ name: "match-table", w: 2 * SQ, h: 44, sq: [2, 1], foot: [37, 40], paint: (p) => {
  p.shadow(37, 40, 26, 3);
  p.rect(25, 36, 24, 2, "W");
  p.rect(25, 37, 24, 1, "w");
  p.rect(34, 27, 6, 10, "W");
  p.rect(34, 27, 1, 10, "L");
  p.rect(39, 27, 1, 10, "w");
  p.rect(7, 24, 60, 3, "W");
  p.rect(7, 26, 60, 1, "w");
  p.rect(7, 10, 60, 14, "E");
  p.rect(7, 10, 60, 1, "L");
  p.rect(7, 10, 1, 14, "L");
  p.rect(66, 10, 1, 14, "W");
  p.rect(8, 23, 58, 1, "e");
  p.each((x, y) => (y > 11 && y < 18 && x > 9 && x - 9 + (y - 11) * 2 >= 4 && x - 9 + (y - 11) * 2 <= 6 ? "m" : null));
  p.outline();
} });

def({ name: "crossing-post", w: SQ, h: 84, foot: [18, 81], paint: (p) => {
  p.shadow(18.5, 81, 10, 2.5);
  p.rect(13, 72, 11, 9, "C");
  p.rect(13, 72, 11, 1, "g");
  p.rect(13, 72, 1, 9, "c");
  p.rect(17, 16, 3, 56, "c");
  p.rect(17, 16, 1, 56, "g");
  p.rect(19, 16, 1, 56, "C");
  p.ell(18.5, 11.5, 6.5, 6, () => "C");
  p.ell(18.5, 12, 4, 4, (dx, dy) => (dx + dy < -3 ? "P" : dx + dy > 2 ? "r" : "R"));
  p.rect(12, 5, 13, 2, "C");
  p.rect(20, 50, 10, 7, "C");
  p.rect(20, 50, 10, 1, "g");
  for (let y = 2; y < 50; y++) {
    const red = Math.floor((y - 2) / 6) % 2 === 0;
    p.set(26, y, red ? "R" : "E");
    p.set(27, y, red ? "R" : "E");
    p.set(28, y, red ? "r" : "e");
  }
  p.outline();
} });

/** A round hedge: leaf clusters lit from the top left, a few flowers. */
const shrub = (v: number) => (p: Pix) => {
  p.shadow(18.5, 35, 15, 3);
  p.each((x, y) => {
    const dx = x + 0.5 - 18.5;
    const dy = y + 0.5 - 22;
    const ang = Math.atan2(dy, dx);
    const d = Math.hypot(dx / 15.5, dy / 12.5) * (1 + 0.07 * Math.sin(ang * 7 + v * 2));
    if (d > 1 || y > 34) return null;
    const lit = -(dx / 15.5 + dy / 12.5) * 0.55 + hash(Math.floor(x / 3), Math.floor((y + (Math.floor(x / 3) % 2)) / 3), 11 + v) * 0.7;
    if (d < 0.85 && hash(x, y, 21 + v) < 0.03) return hash(x, y, 5) < 0.5 ? (v ? "E" : "R") : "Y";
    return lit > 0.62 ? "H" : lit < 0.12 ? "h" : "G";
  });
  p.outline();
};
def({ name: "shrub", w: SQ, h: 38, foot: [18, 35], paint: shrub(0) });
def({ name: "shrub-b", w: SQ, h: 38, foot: [18, 35], paint: shrub(1) });

def({ name: "plant", w: SQ, h: 58, foot: [18, 55], paint: (p) => {
  p.shadow(18.5, 55, 11, 3);
  const leaves: [number, number, number][] = [[-80, 15, 4], [80, 15, 4], [-58, 22, 5], [58, 21, 5], [-34, 28, 5.5], [32, 27, 5.5], [-12, 32, 5.5], [12, 30, 5.5]];
  for (const [deg, len, wid] of leaves) {
    const a = (deg * Math.PI) / 180;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    p.each((x, y) => {
      const X = x + 0.5 - 18.5;
      const Yy = y + 0.5 - 37;
      const u = X * ux + Yy * uy;
      const v = -X * uy + Yy * ux;
      const d = ((u - len / 2) / (len / 2)) ** 2 + (v / wid) ** 2;
      if (d > 1) return null;
      if (d > 0.62) return "h";
      if (Math.abs(v) < 0.6 && u > 3) return "G";
      return v < 0 ? "H" : "G";
    });
  }
  p.each((x, y) => {
    if (y < 35 || y > 53) return null;
    const hw = y <= 38 ? 10.5 : 9 - (y - 39) * 0.22;
    const X = x + 0.5 - 18.5;
    if (Math.abs(X) > hw) return null;
    if (y === 35) return "o";
    if (y === 38) return "t";
    if (y < 38) return "T";
    return X < -hw + 2 ? "o" : X > hw - 2.5 ? "t" : "T";
  });
  p.outline();
} });

def({ name: "lamp", w: SQ, h: 76, foot: [18, 73], paint: (p) => {
  p.shadow(18.5, 73, 9, 2.5);
  p.ell(18.5, 71, 6, 2, (_, dy) => (dy < -0.5 ? "W" : "w"));
  p.rect(17, 22, 3, 49, "W");
  p.rect(17, 22, 1, 49, "L");
  p.rect(19, 22, 1, 49, "w");
  p.each((x, y) => {
    if (y < 6 || y > 21) return null;
    const hw = 6 + (y - 6) * 0.35;
    const X = x + 0.5 - 18.5;
    if (Math.abs(X) > hw) return null;
    if (y >= 20) return "A";
    if (y === 6) return "e";
    return X > hw - 3 ? "e" : X < -hw + 2 ? "1" : "E";
  });
  p.rect(18, 3, 1, 3, "Z");
  p.outline();
} });

def({ name: "wall-sconce", w: 15, h: 13, foot: [7, 12], outline: false, paint: (p) => p.stamp(SCONCE, 2, 2) });

def({ name: "hem", w: SQ, h: 24, foot: [18, 23], outline: false, paint: (p) => p.each((x, y) => {
  if (y === 0 || y === 5 || y === 23) return "k";
  if (y <= 4) return y === 1 ? "P" : y === 4 ? "y" : "Y";
  if (y === 6) return "g";
  if (x === 0) return "C";
  return y >= 20 ? "C" : "c";
}) });

def({ name: "entrance", w: 2 * SQ, h: 112, sq: [2, 1], foot: [37, 110], paint: (p) => {
  // the bright day through the doorway: sky, a tree, the street
  p.each((x, y) => {
    if (x < 7 || x > 66 || y < 10 || y > 103) return null;
    if ((x - 55) ** 2 / 50 + (y - 52) ** 2 / 90 < 1) return y > 56 && x > 56 ? "J" : "j";
    if (x >= 54 && x <= 55 && y > 58 && y < 76) return "L";
    if (y < 34) return "b";
    if (y < 74) return "D";
    return y === 74 ? "e" : "d";
  });
  const jamb = (x0: number) => {
    p.rect(x0, 1, 6, 103, "W");
    p.rect(x0, 1, 1, 103, "L");
    p.rect(x0 + 5, 1, 1, 103, "w");
  };
  jamb(1);
  jamb(67);
  p.rect(1, 1, 72, 9, "W");
  p.rect(1, 1, 72, 1, "L");
  p.rect(1, 9, 72, 1, "w");
  p.rect(1, 4, 72, 3, "Y");
  p.rect(1, 4, 72, 1, "P");
  // the glass leaves, swung open into the room
  const leaf = (xa: number, dir: number) => {
    for (let i = 0; i <= 11; i++) {
      const x = xa + dir * i;
      const top = Math.round(10 + i * 0.45);
      const bot = Math.min(103, Math.round(100 + i * 0.3));
      for (let y = top; y <= bot; y++) {
        const fr = i === 0 || i === 11 || y < top + 2 || y > bot - 3;
        const gl = (i * 3 - (y - top - 14) + 40) % 40;
        p.set(x, y, fr ? (i === 11 ? "L" : "W") : gl < 2 ? "1" : y > bot - 30 ? "q" : "Q");
      }
    }
  };
  leaf(7, 1);
  leaf(66, -1);
  p.rect(1, 104, 72, 1, "k");
  p.rect(1, 105, 72, 2, "Y");
  p.rect(1, 105, 72, 1, "P");
  p.rect(1, 107, 72, 2, "C");
  p.outline();
  for (const kx of [6, 18, 55, 67]) for (let y = 10; y < 104; y++) if (p.get(kx, y) !== "k" && (kx === 6 || kx === 67)) p.set(kx, y, "k");
} });

// ---------------------------------------------------------------- the battle crossing (a floor piece)

def({ name: "ring-crossing", w: 4 * SQ, h: 4 * SQ, sq: [4, 4], foot: [74, 74], floor: true, outline: false, paint: (p) => p.each((x, y) => {
  const e = Math.min(x, y, 147 - x, 147 - y);
  if (e <= 4) return e === 0 || e === 4 ? "k" : ((x + y) >> 2) % 2 ? "Y" : "C";
  for (const [bx, by] of [[17, 17], [130, 17], [17, 130], [130, 130]] as const) {
    const dx = x + 0.5 - bx;
    const dy = y + 0.5 - by;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8.5) continue;
    const m = Math.min(Math.abs(dx - dy), Math.abs(dx + dy));
    if (m < 1.2) return "E";
    if (m < 2.3) return "R";
    if (m < 3.1) return "k";
  }
  const road = y >= 50 && y <= 97;
  const rail = x === 62 || x === 85 ? "I" : x === 63 || x === 86 ? "i" : null;
  if (road) {
    if (y === 50 || y === 97) return "k";
    if (y === 52 || y === 95) return x % 8 < 5 ? "E" : "c";
    if (rail) return rail;
    if (x === 61 || x === 64 || x === 84 || x === 87) return "C";
    const r = hash(x, y, 13);
    return r < 0.06 ? "g" : r < 0.12 ? "C" : "c";
  }
  if (x >= 55 && x <= 93) {
    if (rail) return rail;
    if (x >= 57 && x <= 91 && y % 9 < 3) return y % 9 === 0 ? "L" : y % 9 === 2 ? "w" : "W";
    if (x === 55 || x === 93) return "S";
    return hash(x, y, 17) < 0.3 ? "v" : "V";
  }
  return terrazzo(x, y, (Math.floor(x / SQ) + Math.floor(y / SQ) + 7) % 2);
}) });

// ---------------------------------------------------------------- the pieces as Characters

const made = new Map<string, Part[]>();
const partsOf = (d: Def): Part[] => {
  let ps = made.get(d.name);
  if (!ps) {
    ps = Array.from({ length: d.frames }, (_, t) => {
      const p = new Pix(d.w, d.h);
      d.paint(p, t);
      if (d.outline) p.outline();
      return { grid: p.grid(), outline: false };
    });
    made.set(d.name, ps);
  }
  return ps;
};
const byName = new Map(DEFS.map((d) => [d.name, d]));
const toCharacter = (d: Def): Character => {
  const ps = partsOf(d);
  const parts: Record<string, Part> = {};
  ps.forEach((pt, t) => (parts[`f${t}`] = pt));
  return {
    id: `shop-birdie-${d.name}`,
    name: `Birdie's station: ${d.name}`,
    w: d.w,
    h: d.h,
    foot: d.foot,
    palette: PAL,
    parts,
    anims: { idle: { loop: true, frames: ps.map((_, t) => ({ ms: d.ms, layers: [{ part: `f${t}`, x: 0, y: 0 }] })) } },
  };
};
export const SHOP_BIRDIE_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(DEFS.map((d) => [d.name, toCharacter(d)]));

/** The counter's blank plaque, where the game may write. */
export const SHOP_BIRDIE_COUNTER_SIGN = signFace(42, 19, 27, 11);

type PieceLight = LightSpot & { piece: string };
type PiecePool = LightPool & { piece: string };
const WARM_LAMP = "#ffe2a0";
export const SHOP_BIRDIE_LIGHTS: readonly PieceLight[] = [
  { piece: "lamp", x: 7, y: 6, w: 24, h: 16, keys: "EeA1", color: WARM_LAMP, strength: 0.9, halo: 24 },
  { piece: "wall-sconce", x: 2, y: 2, w: 11, h: 6, keys: "YPA", color: "#ffb85c", strength: 0.8, halo: 14 },
  ...sideSconces(10).map((x, i) => ({ piece: i % 2 ? "side-wall-east" : "side-wall-west", x, y: SCONCE_Y + 2, w: 11, h: 4, keys: "YPA", color: "#ffb85c", strength: 0.8, halo: 14 })),
  ...sideSconces(10).map((x, i) => ({ piece: i % 2 ? "side-wall-west" : "side-wall-east", x: 10 * SQ - 11 - x, y: SCONCE_Y + 2, w: 11, h: 4, keys: "YPA", color: "#ffb85c", strength: 0.8, halo: 14 })),
  { piece: "counter", x: 14, y: 8, w: 7, h: 4, color: WARM_LAMP, strength: 0.25 },
  { piece: "counter", x: 80, y: 2, w: 11, h: 10, keys: "ZPR", color: WARM_LAMP, strength: 0.3, halo: 8 },
  { piece: "entrance", x: 7, y: 10, w: 60, h: 94, keys: "bDdjJeL", color: "#fff7e2", strength: 0.9 },
  { piece: "arch", x: 9, y: 12, w: 56, h: 50, keys: "BbE", color: "#d9eef6", strength: 0.35 },
  { piece: "arch-east", x: 9, y: 12, w: 56, h: 50, keys: "BbE", color: "#d9eef6", strength: 0.35 },
  { piece: "crossing-post", x: 14, y: 7, w: 9, h: 9, keys: "RrP", color: "#ff5a4a", strength: 0.45, halo: 6, flicker: true },
];
export const SHOP_BIRDIE_POOLS: readonly PiecePool[] = [
  { piece: "lamp", x: 18, y: 73, rx: 30, ry: 13, color: WARM_LAMP, strength: 0.45 },
  { piece: "counter", x: 55, y: 44, rx: 60, ry: 14, color: "#ffb85c", strength: 0.35 },
  { piece: "entrance", x: 37, y: 120, rx: 44, ry: 16, color: "#fff7e2", strength: 0.5 },
];
/** The fixed camera: the whole room in view, centered a little behind the crossing (in squares), no pan or zoom. */
export const SHOP_BIRDIE_CAM = { cx: 5, cy: 4.6, zoom: 1, fixed: true } as const;

// ---------------------------------------------------------------- the whole room, for the render tool

const TOP = 112;
const RW = 10 * SQ;
const RH = TOP + 10 * SQ + 2;
const roomParts: Record<string, Part> = {};
for (const d of DEFS) partsOf(d).forEach((pt, t) => (roomParts[`${d.name}/${t}`] = pt));
/** The side walls folded down beside the floor (their top outward), for the preview only. */
const fold = (west: boolean): Part => {
  const g = SHOP_BIRDIE_SIDE_WALL_GRID(west, 10);
  const rows: string[] = [];
  for (let y = 0; y < 10 * SQ; y++) {
    let row = "";
    for (let x = 0; x < SQ; x++) {
      const v = Math.floor(((west ? x : SQ - 1 - x) * WH) / SQ);
      const u = west ? 10 * SQ - 1 - y : y;
      row += g[v]![u]!;
    }
    rows.push(row);
  }
  return { grid: rows, outline: false };
};
roomParts["side-west"] = fold(true);
roomParts["side-east"] = fold(false);
const placeLayer = (pl: ShopPlace, t: number): Layer | null => {
  const d = byName.get(pl.piece)!;
  if (d.name === "blank" || d.name === "wall-none") return null;
  const part = `${d.name}/${t % d.frames}`;
  if (d.floor) return { part, x: pl.col * SQ, y: TOP + pl.row * SQ, rot: pl.rot };
  return { part, x: pl.col * SQ + Math.floor((d.sq[0] * SQ) / 2) - d.foot[0], y: TOP + pl.row * SQ + 18 - d.foot[1] };
};
const floors = L.filter((pl) => byName.get(pl.piece)!.floor);
const ups = L.filter((pl) => !byName.get(pl.piece)!.floor).sort((a, b) => a.row - b.row || a.col - b.col);
const roomFrame = (t: number): Frame => ({
  ms: 500,
  layers: [
    { part: "side-west", x: 0, y: TOP },
    { part: "side-east", x: 9 * SQ, y: TOP },
    ...[...floors, ...ups].map((pl) => placeLayer(pl, t)).filter((l): l is Layer => !!l),
  ],
});
/** A sheet of one piece's frames (or tiles side by side), as many as fit, for looking at. */
const sheet = (items: { part: string; w: number; h: number; rot?: 0 | 1 | 2 | 3 }[], gap = 4): Frame[] => {
  const frames: Frame[] = [];
  let layers: Layer[] = [];
  let x = 2;
  let y = 2;
  let rowH = 0;
  for (const it of items) {
    if (x + it.w > RW) {
      x = 2;
      y += rowH + gap;
      rowH = 0;
    }
    if (y + it.h > RH) {
      frames.push({ ms: 800, layers });
      layers = [];
      x = 2;
      y = 2;
      rowH = 0;
    }
    layers.push({ part: it.part, x, y, rot: it.rot });
    x += it.w + gap;
    rowH = Math.max(rowH, it.h);
  }
  frames.push({ ms: 800, layers });
  return frames;
};
/** A part blown up z times (whole pixels), so a piece can be looked at closely inside the room-sized frame. */
const zoomPart = (name: string, z: number): string => {
  const key = `${name}@${z}`;
  if (!roomParts[key]) {
    const g = roomParts[name]!.grid;
    roomParts[key] = { outline: false, grid: g.flatMap((r) => Array<string>(z).fill([...r].map((c) => c.repeat(z)).join(""))) };
  }
  return key;
};
const reviews: Record<string, { frames: Frame[]; loop: boolean }> = {};
for (const d of DEFS) {
  if (d.name === "blank" || d.name === "wall-none") continue;
  const z = Math.max(1, Math.min(4, Math.floor((RW - 4) / d.w), Math.floor((RH - 4) / d.h)));
  reviews[`review-${d.name}`] = { loop: true, frames: partsOf(d).map((_, t) => ({ ms: d.ms, layers: [{ part: zoomPart(`${d.name}/${t}`, z), x: 2, y: 2 }] })) };
}
const T3 = 3 * SQ;
const tiles: { part: string; w: number; h: number; rot?: 0 | 1 | 2 | 3 }[] = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) tiles.push({ part: zoomPart((r + c) % 2 ? "floor-b/0" : "floor-a/0", 3), w: T3, h: T3 });
for (const rot of [0, 3, 2] as const) tiles.push({ part: zoomPart("floor-edge/0", 3), w: T3, h: T3, rot });
for (const rot of [0, 3] as const) tiles.push({ part: zoomPart("floor-edge-corner/0", 3), w: T3, h: T3, rot });
tiles.push({ part: zoomPart("floor-door/0", 3), w: T3, h: T3 }, { part: zoomPart("floor-door/0", 3), w: T3, h: T3, rot: 2 });
reviews["review-floors"] = { loop: true, frames: sheet(tiles.slice(0, 12), 0).concat(sheet(tiles.slice(12), 3)) };

export const SHOP_BIRDIE_INTERIOR: Character = {
  id: "shop-birdie-interior",
  name: "Birdie's station: the lobby",
  w: RW,
  h: RH,
  foot: [RW / 2, TOP + 10 * SQ],
  palette: { ...PAL, "-": "#d3c7b1", "+": "#ddd2bf" },
  parts: roomParts,
  anims: { idle: { loop: true, frames: Array.from({ length: 12 }, (_, t) => roomFrame(t)) }, ...reviews },
};
