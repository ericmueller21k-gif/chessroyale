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
  if (inArch && Y < TOP + 2 && Y < archTop(X) + 4.6) return "p"; // a purple band under it
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

/** The bulbs on an arch's frame are this far apart along it. */
const BULB_GAP = 5;
/**
 * An arched doorway: a blue frame three pixels wide with marquee bulbs along its middle (in the same three groups as the
 * big arch's, so they chase together), filled by `fill`.
 */
function arch(cx: number, top: number, hw: number, fill: (X: number, Y: number) => string | null) {
  return paint(cx - hw - 3, top - 3, 2 * hw + 6, BASE - top + 3, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5;
    const r = hw + 1.5; // the frame's middle line
    const round = Y < top + hw;
    const d = round ? Math.hypot(X, Y - (top + hw)) : Math.abs(X);
    const e = d - hw; // how far out from the opening
    if (e > 3 || Y > BASE || (round && Y < top - 3)) return null;
    if (e >= 0) {
      // Along the frame from its top: round over the arch, then down its sides.
      const along = round ? Math.abs(Math.atan2(X, top + hw - Y)) * r : (Math.PI / 2) * r + (Y - (top + hw));
      if (e > 1 && e < 2.2 && along % BULB_GAP < 1.2) return String((Math.floor(along / BULB_GAP) % 3) + 1);
      return e < 1 ? "u" : e > 2.2 ? "U" : "u"; // a blue frame
    }
    return fill(X, Y);
  });
}
/** Bunting across an arch's top: little flags in turn, gold, red, blue. */
const bunting = (X: number, Y: number, top: number): string | null => {
  const sag = top + 8 + (1 - (X / 10) ** 2) * 2;
  const i = Math.floor((X + 12) / 4);
  const fx = X + 12 - i * 4 - 2;
  if (Y >= sag && Y < sag + 3.5 - Math.abs(fx) * 1.2) return "yru"[i % 3]!;
  return Math.abs(Y - sag + 0.5) < 0.5 ? "t" : null;
};
const gate = arch(40, 66, 10, (X, Y) => bunting(X, Y, 66) ?? (Math.abs(X % 4) < 1 && Y > 70 ? "w" : Y < 74 ? "m" : Y > BASE - 6 ? "Q" : "c"));
const tunnel = arch(CX, 58, 14, (X, Y) => {
  // Red curtains drawn back to its sides, gold tie-backs.
  const drape = 4.5 - 2.5 * Math.sin(Math.min(1, Math.max(0, (Y - 62) / 30)) * Math.PI);
  if (14 - Math.abs(X) < drape + (Y < 64 ? 4 : 0)) return Math.abs(Y - 86) < 1.2 ? "y" : (Math.floor(Math.abs(X) * 1.4) % 2 ? "r" : "R");
  if (Y < 64) return Math.floor(X / 3) % 2 ? "r" : "R"; // its valance
  const dy = Y - 84;
  const d = Math.hypot(X, dy * 1.2);
  const a = Math.atan2(dy, X) + d * 0.35;
  if (d < 2) return "m";
  return Math.floor(((a + Math.PI * 8) / (Math.PI / 3)) % 2) === 0 ? "p" : "P";
});
const mirror = arch(104, 66, 10, (X, Y) => {
  const b = bunting(X, Y, 66);
  if (b) return b;
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

/**
 * A column: blue, rounded by its light and shade, gold stars up it between red bands, a gold capital with a ball on top,
 * a gold plinth at its foot. `half`: its half-width; `top`: its capital's top.
 */
const column = (cx: number, half: number, top: number) =>
  paint(cx - half - 1, top - 2 * half, 2 * half + 3, BASE - top + 2 * half + 2, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5;
    // The ball on top.
    const ballR = half * 0.75;
    if (Y < top) return Math.hypot(X, Y - (top - ballR)) < ballR ? (X + (Y - (top - ballR)) < -1 ? "w" : X > 1 ? "Y" : "y") : null;
    if (Y < top + 4) return Math.abs(X) < half + 1 - (Y < top + 1 ? 1 : 0) ? (Y < top + 1.5 ? "y" : "Y") : null; // its capital
    if (Y > BASE - 3) return Math.abs(X) < half + 1 ? (Y < BASE - 2 ? "y" : "Y") : null; // its plinth
    if (Math.abs(X) > half) return null;
    // Red bands every 14 pixels, a gold star between each two.
    const sy = Y - (top + 13) - Math.round((Y - (top + 13)) / 14) * 14;
    if (Math.abs(Math.abs(sy) - 7) < 1.2) return X < -half * 0.3 ? "r" : "R";
    const a = Math.atan2(sy, X) + Math.PI / 2;
    const t = Math.abs(((((a * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
    const sr = Math.hypot(X, sy);
    const star = half * 0.78 - half * 0.38 * t;
    if (sr < star) return X + sy < -1 ? "y" : "Y";
    if (sr < star + 0.9 && half > 3) return "U"; // its dark edge
    return X < -half * 0.4 ? "l" : X < half * 0.3 ? "u" : "U";
  });
/** A big gold star with a light face, at (cx, cy). */
const bigStar = (cx: number, cy: number, r: number) =>
  paint(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(2 * r) + 1, Math.ceil(2 * r) + 1, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5 - cy;
    const a = Math.atan2(Y, X) + Math.PI / 2;
    const t = Math.abs(((((a * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
    if (Math.hypot(X, Y) > r - r * 0.52 * t) return null;
    return X + Y < -1 ? "y" : X > 1 ? "Y" : "y";
  });
const pennant = (px: number, ramp: string, toward: 1 | -1) =>
  paint(Math.min(px, px + toward * 11), 8, 13, 17, (x, y) => {
    if (x === px) return "S"; // the pole
    const i = (x - px) * toward;
    const j = y - 9;
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
  add("pennantL", pennant(18, "yY", 1)),
  add("pennantR", pennant(126, "pP", -1)),
  add("front", front),
  add("gate", gate),
  add("tunnel", tunnel),
  add("mirror", mirror),
  add("carpet", carpet),
  add("pilasterL", column(55, 2.5, 62)),
  add("pilasterR", column(89, 2.5, 62)),
  add("columnL", column(18, 5, 32)),
  add("columnR", column(126, 5, 32)),
  ...bulbParts.map((p, i) => add(`bulb${i}`, p)),
  add("starL", bigStar(CX - 42, 32, 6)),
  add("starR", bigStar(CX + 42, 32, 6)),
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

