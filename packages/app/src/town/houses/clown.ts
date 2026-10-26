/**
 * Boingo's Funhouse: the clown's home on the town square (Eric's suggestion, docs/mockups/town-square/clown-funhouse.webp).
 * A funhouse front in diagonal red and pink stripes under a marquee arch ringed with bulbs (its blank board is where the
 * game writes "Boingo's Funhouse"); three arched doorways, a gate on the left, a purple swirl tunnel in the middle on a
 * red carpet down two steps, a wavy mirror on the right; blue columns with gold stars and pennants on top; balloons; a
 * pogo stick leaning by it; grass at its foot. His colors (characters/clown.ts). `idle`: the marquee bulbs chase.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { CLOWN_PALETTE } from "../../characters/clown.ts";
import { groundShadow, paint, signBoard, signFace, tuft, type Pt } from "./kit.ts";

const C = CLOWN_PALETTE;
const PALETTE: Record<string, string> = {
  k: C.k, // outline
  r: C.r, // red: mid, dark
  R: C.R,
  i: "#f27ab0", // pink: mid, dark
  I: "#c74a86",
  p: C.p, // purple: mid, dark, light
  P: C.P,
  l: "#b07ad0",
  u: C.u, // blue: mid, dark
  U: "#2a6ec0",
  y: C.y, // gold: mid, dark
  Y: C.Y,
  w: C.w, // white: mid, shade
  W: C.W,
  s: C.s, // steel: light, mid, dark
  S: C.S,
  t: C.t,
  g: C.g, // green: mid, dark
  G: "#2f8f3f",
  m: "#2a1420", // the doorways' dark
  c: "#3a2030",
  j: "#a8d8ff", // the mirror: light, mid
  J: "#5ea8e8",
  "1": "#ffe58a", // the marquee's bulbs, in three groups that light in turn
  "2": "#ffe58a",
  "3": "#ffe58a",
  N: "#4d2813", // the sign's wood: dark to light
  O: "#7a4a22",
  Q: "#a8703a",
  T: "#d09a5a",
  a: "#c9a56a", // the sign's face: shadow, board, light
  b: "#e8cc95",
  e: "#f7e4b8",
  L: "#f2c14e", // nails
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

const W = 144;
const H = 124;
const CX = 72;
const FOOT = 118;
/** The front: its sides, its top (under the marquee arch) and its base. */
const L = 24;
const R = 120;
const TOP = 40;
const BASE = 110;
/** The marquee arch over it: its middle, half-width and height. */
const ARCH_Y = 40;
const ARCH_HW = 46;
const ARCH_H = 32;
const archTop = (X: number) => ARCH_Y - ARCH_H * Math.sqrt(Math.max(0, 1 - (X / ARCH_HW) ** 2));

// ---- The front: diagonal stripes of red and pink, darker toward the right; the arch's gold trim.

const front = paint(L, ARCH_Y - ARCH_H, R - L, BASE - (ARCH_Y - ARCH_H), (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const inArch = Math.abs(X) < ARCH_HW && Y >= archTop(X);
  if (Y < TOP && !inArch) return null;
  if (inArch && Y < TOP && Y < archTop(X) + 2.2) return Y < archTop(X) + 1 ? "y" : "Y"; // the arch's gold edge
  const red = Math.floor((x + y) / 6) % 2 === 0;
  const shade = X > 30 || Y > BASE - 3;
  return red ? (shade ? "R" : "r") : shade ? "I" : "i";
});

// The marquee bulbs round the arch, and along the top of the doors: each in one of three groups.
const bulbs: [number, number, string][] = [];
for (let i = 0; i <= 16; i++) {
  const a = Math.PI * (i / 16);
  bulbs.push([CX - Math.cos(a) * (ARCH_HW - 3), ARCH_Y - Math.sin(a) * (ARCH_H - 3), String((i % 3) + 1)]);
}
const bulbParts = bulbs.map(([x, y, k]) => paint(Math.round(x) - 1, Math.round(y) - 1, 3, 3, (px, py) => (px === Math.round(x) || py === Math.round(y) ? k : null)));

// ---- Three arched doorways: a gate, a swirl tunnel on a red carpet, a wavy mirror.

function arch(cx: number, top: number, hw: number, fill: (X: number, Y: number) => string | null) {
  return paint(cx - hw - 2, top - 2, 2 * hw + 4, BASE - top + 2, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5;
    const half = Y < top + hw ? Math.sqrt(Math.max(0, hw * hw - (top + hw - Y) ** 2)) : hw;
    const e = half + 2 - Math.abs(X);
    if (e < 0 || Y > BASE) return null;
    if (e < 2) return e < 1 ? "U" : "u"; // a blue frame
    return fill(X, Y);
  });
}
const gate = arch(40, 66, 10, (X, Y) => (Math.abs(X % 4) < 1 && Y > 70 ? "w" : Y < 74 ? "m" : "c"));
const tunnel = arch(CX, 58, 14, (X, Y) => {
  const dy = Y - 84;
  const d = Math.hypot(X, dy * 1.2);
  const a = Math.atan2(dy, X) + d * 0.35;
  if (d < 2) return "m";
  return Math.floor(((a + Math.PI * 8) / (Math.PI / 3)) % 2) === 0 ? "p" : "P";
});
const mirror = arch(104, 66, 10, (X, Y) => {
  const wave = Math.sin(Y * 0.5) * 2;
  return X + wave < -3 ? "j" : X + wave < 3 ? "J" : "u";
});
/** The red carpet from the tunnel down two steps. */
const carpet = paint(CX - 16, BASE - 4, 32, FOOT - BASE + 3, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - (BASE - 4);
  if (j >= 4 && Math.abs(X) > 15 - (j - 4) * 0.2) return null;
  if (j === 6 || j === 10) return "W"; // the steps' edges
  if (Math.abs(X) < 8 - Math.max(0, j - 4) * -0.3) return j < 4 ? "r" : "R";
  return j < 4 ? null : "w";
});

// ---- Columns with gold stars, pennants on top; balloons; the pogo stick; grass; the shadow.

const column = (cx: number) =>
  paint(cx - 5, 28, 11, BASE - 28 + 2, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5;
    if (Math.abs(X) > 5) return null;
    if (Y < 32) return Math.abs(X) < 5 ? "y" : null; // its gold cap
    if (Y > BASE - 2) return "Y";
    // A gold star every 14 pixels.
    const sy = Y - 40 - Math.round((Y - 40) / 14) * 14;
    const a = Math.atan2(sy, X) + Math.PI / 2;
    const t = Math.abs(((((a * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
    if (Math.hypot(X, sy) < 3.6 - 1.8 * t) return "y";
    return X < 1 ? "u" : "U";
  });
const pennant = (px: number, ramp: string, toward: 1 | -1) =>
  paint(Math.min(px, px + toward * 11), 12, 13, 17, (x, y) => {
    if (x === px) return "S"; // the pole
    const i = (x - px) * toward;
    const j = y - 13;
    if (i < 1 || j < 0 || j > 7) return null;
    return Math.abs(j - 3.5) < 4 - i * 0.36 ? (j < 3 ? ramp[0]! : ramp[1]!) : null;
  });
const BALLOONS: readonly [number, number, string][] = [
  [10, 66, "rR"],
  [17, 58, "uU"],
  [9, 78, "gG"],
  [134, 62, "pP"],
  [128, 72, "lp"],
];
const balloons = BALLOONS.map(([cx, cy, ramp]) =>
  paint(cx - 4, cy - 5, 9, 11, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    if ((dx / 4) ** 2 + (dy / 5) ** 2 <= 1) return dx < -1 && dy < -1 ? "w" : dx + dy > 2 ? ramp[1]! : ramp[0]!;
    return null;
  }),
);
/** Their strings, thin (no outline), down to a weight at the ground. */
const strings = paint(4, 60, 136, 50, (x, y) => {
  for (const [cx, cy] of BALLOONS) if (y > cy + 5 && x === Math.round(cx + Math.sin(y * 0.5) * 0.7 + (cx < CX ? 1 : -1) * (y - cy) * 0.08)) return "t";
  return null;
}, false);
const pogo = paint(124, 72, 12, 44, (x, y) => {
  // A pole leaning against the front: from its foot (126, 115) up to its handlebar (133, 76).
  const t = (115 - y) / 39;
  const px = 126 + 7 * t;
  if (t < 0 || t > 1) return null;
  if (Math.abs(x + 0.5 - px) < 1 && t > 0.92) return "r"; // the handle
  if (Math.abs(y - 78) < 1 && Math.abs(x + 0.5 - px) < 4) return "R";
  if (t > 0.08 && t < 0.3 && Math.abs(x + 0.5 - px) < 2 && y % 2 === 0) return "S"; // the spring
  if (Math.abs(y - 113) < 1 && Math.abs(x + 0.5 - px) < 3) return "t"; // the foot pegs
  return Math.abs(x + 0.5 - px) < 0.8 ? "s" : null;
});
const grass = [tuft(26, FOOT - 3, 7, "gG"), tuft(48, FOOT - 1, 6, "gG"), tuft(96, FOOT - 1, 6, "gG"), tuft(118, FOOT - 3, 7, "gG")];
const shadow = groundShadow(CX, FOOT - 1.5, 66, 4.5);

// ---- The sign in the marquee arch: blank; the game writes "Boingo's Funhouse" on it.

const BOARD: Pt = [CX - 31, 14];
const BW = 62;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, "NOQT", "abe", "L");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("pennantL", pennant(16, "yY", 1)),
  add("pennantR", pennant(128, "pP", -1)),
  add("front", front),
  add("gate", gate),
  add("tunnel", tunnel),
  add("mirror", mirror),
  add("carpet", carpet),
  add("columnL", column(18)),
  add("columnR", column(126)),
  ...bulbParts.map((p, i) => add(`bulb${i}`, p)),
  add("board", board),
  add("strings", strings),
  ...balloons.map((p, i) => add(`balloon${i}`, p)),
  add("pogo", pogo),
  ...grass.map((p, i) => add(`grass${i}`, p)),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** The bulbs chase: each frame, one group of three dims. */
const DIM = "#b58430";
const frames: Frame[] = [0, 1, 2].map((f) => ({ ms: 160, layers, pal: { [String(f + 1)]: DIM } }));

const idle: Anim = { loop: true, frames };

export const HOUSE_CLOWN: Character = {
  id: "house-clown",
  name: "Boingo's Funhouse",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Boingo's Funhouse" on. */
export const HOUSE_CLOWN_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

