/**
 * Babur's circus tent: the tiger boss's home on the raid's town square. A red-and-white striped big top seen from the
 * front and a little above: a striped cone of a roof on a gold trim, a scalloped valance, a striped drum of a wall with its
 * door curtains tied back; a gold-topped mast with a blue swallowtail pennant; two side poles with blue flags; a string of
 * bunting sagging across the front from pole to pole; a blank wooden sign board on two posts (the game writes "Babur's Circus"
 * on it: no letters here); gift boxes and a crate at its foot; a soft shadow on the ground. Light from the top left, as the
 * bosses'. `idle`: the pennant and the two flags wave (four frames, 200 ms each); nothing else moves.
 *
 * Painted in frame pixels: each part is a function from a pixel to a palette key over its box.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { clamp, paint, signBoard, signFace, signPost, tone, WARM, type LightPool, type LightSpot, type Pt } from "./kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1f1210", // outline (the tiger's)
  A: "#7d1220", // the tent's red: dark, mid, light (the tiger's hat band)
  B: "#c0242c",
  C: "#ee5a4f",
  D: "#c4b8a6", // the tent's white: shadow, cloth, light
  E: "#efe8da",
  F: "#fffaf0",
  G: "#1a4fa8", // flag blue: dark, mid, light (the knight balloon's)
  H: "#2f7fe0",
  I: "#7cc0ff",
  J: "#7a4f0e", // gold: dark to light (the tiger's vest edging)
  K: "#b87a14",
  L: "#f2c14e",
  M: "#ffe58a",
  N: "#4d2813", // wood: dark to light
  O: "#7a4a22",
  P: "#a8703a",
  Q: "#d09a5a",
  S: "#c9a56a", // the sign's face: shadow, board, light
  T: "#e8cc95",
  U: "#f7e4b8",
  V: "#24120c", // inside the door: deep, dark
  W: "#4a1d16",
  X: "#0f6a3a", // green: dark, mid, light (the rook balloon's)
  Y: "#1fa856",
  Z: "#6fe08e",
  a: "#5a2a96", // purple (the pawn balloon's)
  b: "#9150d6",
  c: "#c79bf5",
  d: "#b88a0a", // yellow (the bishop's)
  e: "#f2c31a",
  f: "#ffe566",
  s: "#6b4a30", // the bunting's string
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

// ---- Where things are (frame pixels). The tent's axis is x = CX; the ground at y FOOT.

const W = 144;
const H = 120;
const CX = 70;
const FOOT = 114;
/** The roof: its peak, the height where it reaches its full half-width R, and its front edge's dip (seen from above). */
const PEAK = 18;
const EAVE = 52;
const R = 50;
const DIP = 5;
/** The wall: its half-width and the height of its base at the sides (it dips DIP toward the middle, too). */
const WALL = 44;
const BASE = 107;

/** Which stripe a point is on, across a round surface of half-width `hw` cut into `n` stripes (narrower toward the sides). */
const stripe = (X: number, hw: number, n: number) => clamp(Math.floor(((Math.asin(clamp(X / hw, -1, 1)) + Math.PI / 2) / Math.PI) * n), 0, n - 1);

// ---- The roof: a striped cone, slightly hollow in its slopes, on a gold trim, with a scalloped valance.

const roofHalf = (Y: number) => (Y >= EAVE ? R : R * ((Y - PEAK) / (EAVE - PEAK)) ** 1.25);
const eaveAt = (X: number) => EAVE + DIP * Math.sqrt(Math.max(0, 1 - (X / R) ** 2));

const roof = paint(CX - R - 1, PEAK, 2 * R + 2, EAVE + DIP + 8 - PEAK, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if (Math.abs(X) > roofHalf(Y)) return null;
  const e = eaveAt(X);
  const u = X / R;
  if (Y <= e) {
    if (Y > e - 1.4) return Math.abs(X) < 6 ? "M" : tone(0.62 - 0.55 * u, "KLM"); // the gold trim
    const hw = roofHalf(Y);
    const red = stripe(X, hw, 11) % 2 === 1;
    // Lit from the left; a seam of shadow down the right edge of each red panel.
    let l = 0.6 - 0.55 * (X / hw);
    const next = stripe(X + 1, hw, 11);
    if (red && next !== stripe(X, hw, 11)) l -= 0.3;
    return tone(l, red ? "ABC" : "DEF");
  }
  // The valance: scallops hanging below the trim, red and white by turns.
  const n = 15;
  const t = ((Math.asin(clamp(u, -1, 1)) + Math.PI / 2) / Math.PI) * n;
  const seg = clamp(Math.floor(t), 0, n - 1);
  const s = t - seg;
  if (Y > e + 2.2 + 3.2 * Math.sin(Math.PI * s)) return null;
  const red = seg % 2 === 0;
  return tone(0.62 - 0.55 * u - (Y > e + 3.5 ? 0.15 : 0), red ? "ABC" : "DEF");
});

// ---- The wall: a striped drum under the valance, in its shade at the top.

const baseAt = (X: number) => BASE + DIP * Math.sqrt(Math.max(0, 1 - (X / WALL) ** 2));

const wall = paint(CX - WALL, EAVE, 2 * WALL, BASE + DIP + 2 - EAVE, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if (Math.abs(X) > WALL || Y > baseAt(X)) return null;
  const u = X / WALL;
  const red = stripe(X, WALL, 13) % 2 === 0;
  let l = 0.62 - 0.55 * u;
  if (Y < eaveAt(X) + 6) l -= 0.3; // under the valance
  if (Y > baseAt(X) - 1.5) l -= 0.3; // where it meets the ground
  return tone(l, red ? "ABC" : "DEF");
});

// ---- The door: a dark opening, its red curtains drawn back and tied with gold.

const DOOR_TOP = 71;
const DOOR = 11;
const door = paint(CX - DOOR - 5, DOOR_TOP - 1, 2 * DOOR + 10, BASE + DIP - DOOR_TOP + 1, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if (Y > baseAt(X) - 0.5) return null;
  const open = DOOR * clamp((Y - DOOR_TOP) / 13, 0, 1);
  const ax = Math.abs(X);
  if (ax <= open) return Y < DOOR_TOP + 7 || ax > open - 2 ? "V" : "W";
  if (ax > open + 4 || Y < DOOR_TOP - 0.5) return null;
  if (Y > 84 && Y < 87) return ax > open + 2.5 ? "K" : Y < 85.5 ? "M" : "L"; // the tie
  const inner = ax - open < 1.5;
  return X < 0 ? (inner ? "C" : "B") : inner ? "B" : "A";
});

// ---- Masts and flags.

/** The central mast above the peak: a gold ball, a wooden pole and a gold collar where it meets the roof. */
const mast = paint(CX - 3, 2, 6, PEAK + 4 - 2, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if ((X / 2.1) ** 2 + ((Y - 4.5) / 2.1) ** 2 <= 1) return X < -0.5 && Y < 4.5 ? "M" : X > 0.5 || Y > 5.5 ? "K" : "L";
  if (Y > PEAK - 1 && Math.abs(X) < 2.6) return X < 0 ? "L" : "K"; // the collar
  if (Y > 6 && Math.abs(X) < 1) return X < 0 ? "P" : "O";
  return null;
});

/** A side pole: a gold ball on a wooden pole, its foot on the ground. */
const pole = (px: number) =>
  paint(px - 1, 29, 4, FOOT - 29, (x, y) => {
    const X = x + 0.5 - (px + 1);
    const Y = y + 0.5;
    if ((X / 2) ** 2 + ((Y - 31) / 2) ** 2 <= 1) return X < 0 && Y < 31 ? "M" : X > 0.5 || Y > 32 ? "K" : "L";
    if (Y > 33 && Math.abs(X) < 1) return X < 0 ? "P" : "O";
    return null;
  });

/** A blue swallowtail flag `w` x `h`, its hoist on the left: light along the top, dark along the bottom and the hoist. */
function flag(w: number, h: number): Part {
  const grid = Array.from({ length: h }, (_, j) =>
    Array.from({ length: w }, (_, i) => {
      const notch = i - (w - 4);
      if (notch > 0 && Math.abs(j - (h - 1) / 2) < notch * 0.75) return ".";
      if (i === 0) return "G";
      return j === 0 ? "I" : j >= h - 2 ? "G" : "H";
    }).join(""),
  );
  return { grid };
}

// ---- The bunting: little flags on a string sagging from pole to pole across the front (its own outlines, on the flags only).

const SAG_L: Pt = [12, 44];
const SAG_R: Pt = [127, 44];
const SAG = 21;
const sagY = (x: number) => {
  const m = (SAG_L[0] + SAG_R[0]) / 2;
  const hw = (SAG_R[0] - SAG_L[0]) / 2;
  return SAG_L[1] + SAG * (1 - ((x + 0.5 - m) / hw) ** 2);
};
// No red: red flags would melt into the red valance behind them.
const BUNT = ["def", "GHI", "XYZ", "abc"];
const bunting = (() => {
  const x0 = SAG_L[0];
  const w = SAG_R[0] - SAG_L[0] + 1;
  const y0 = SAG_L[1] - 1;
  const h = SAG + 9;
  const cv = Array.from({ length: h }, () => Array<string>(w).fill("."));
  const set = (x: number, y: number, k: string) => {
    const i = x - x0;
    const j = y - y0;
    if (j >= 0 && j < h && i >= 0 && i < w) cv[j]![i] = k;
  };
  const get = (x: number, y: number) => cv[y - y0]?.[x - x0] ?? ".";
  // The string: one pixel thick, no gaps.
  let prev = Math.round(sagY(x0));
  for (let x = x0; x < x0 + w; x++) {
    const y = Math.round(sagY(x));
    for (let yy = Math.min(prev, y); yy <= Math.max(prev, y); yy++) set(x, yy, "s");
    prev = y;
  }
  // The flags: a pennant every 9 pixels, 5 wide and 4 tall, pointing down, each outlined.
  let n = 0;
  for (let fx = x0 + 6; fx <= x0 + w - 7; fx += 9) {
    const top = Math.round(sagY(fx)) + 1;
    const ramp = BUNT[n++ % BUNT.length]!;
    const fill: Pt[] = [];
    [2, 1, 1, 0].forEach((half, r) => {
      for (let dx = -half; dx <= half; dx++) fill.push([fx + dx, top + r]);
    });
    for (const [x, y] of fill)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (get(x + dx, y + dy) === ".") set(x + dx, y + dy, "k");
    for (const [x, y] of fill) set(x, y, y === top ? ramp[2]! : x > fx ? ramp[0]! : ramp[1]!);
  }
  return { part: { grid: cv.map((r) => r.join("")), outline: false } as Part, at: [x0, y0] as Pt };
})();

// ---- The sign: a blank board in a wooden frame, on two posts. The game writes on its face.

const BOARD: Pt = [CX - 26, 86];
const BW = 52;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH);
const post = (px: number) => signPost(px, BOARD[1] + BH - 4, FOOT);

// ---- At its foot: gift boxes and a crate.

/** A gift box `w` x `h` with a ribbon across it and a bow on top; `ramp` its color (dark, mid, light), `rib` the ribbon's. */
function gift(x0: number, y0: number, w: number, h: number, ramp: string, rib: string): { part: Part; at: Pt } {
  const rx = Math.floor((w - 2) / 2);
  return paint(x0, y0 - 2, w, h + 2, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (j < 0) {
      // The bow: two loops either side of the ribbon.
      if (j === -2) return i === rx - 2 || i === rx + 3 ? rib[1]! : null;
      return i >= rx - 2 && i <= rx + 3 ? (i === rx || i === rx + 1 ? rib[0]! : rib[2]!) : null;
    }
    const lid = j <= 1;
    if (i === rx || i === rx + 1 || j === (lid ? 99 : Math.floor(h / 2) + 1)) return i === rx || j === Math.floor(h / 2) + 1 ? rib[2]! : rib[1]!;
    if (lid) return j === 0 ? ramp[2]! : ramp[1]!;
    return i >= w - 2 || j === h - 1 ? ramp[0]! : ramp[1]!;
  });
}

/** A wooden crate: a frame of planks, a brace across it. */
const crate = (x0: number, y0: number, w: number, h: number) =>
  paint(x0, y0, w, h, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return j === 0 ? "Q" : i === w - 1 || j === h - 1 ? "N" : "P";
    if (Math.abs(i - 1 - ((w - 3) * (h - 2 - j)) / (h - 3)) < 1) return "P";
    return j % 3 === 0 ? "N" : "O";
  });

const giftL = gift(22, 104, 12, 10, "XYZ", "def");
const giftL2 = gift(34, 108, 8, 6, "ABC", "DEF");
const crateR = crate(99, 103, 12, 11);
const giftR = gift(110, 108, 8, 6, "abc", "def");
const giftTop = gift(101, 97, 8, 6, "def", "ABC");

// ---- The shadow on the ground under all of it.

const shadow = paint(4, FOOT - 6, W - 8, 9, (x, y) => {
  const d = ((x + 0.5 - CX) / 66) ** 2 + ((y + 0.5 - (FOOT - 1.5)) / 5) ** 2;
  return d > 1 ? null : d > 0.55 ? "+" : "-";
}, false);

// ---- Parts and frames.

const FLAG_W = 12;
const FLAG_H = 8;
const POLE_L = 10;
const POLE_R = 2 * CX - 1 - POLE_L - 1;
const parts: Record<string, Part> = {
  shadow: shadow.part,
  poleL: pole(POLE_L).part,
  poleR: pole(POLE_R).part,
  flag: flag(FLAG_W, FLAG_H),
  pennant: flag(16, 9),
  wall: wall.part,
  door: door.part,
  roof: roof.part,
  mast: mast.part,
  bunting: bunting.part,
  postL: post(BOARD[0] + 5).part,
  postR: post(BOARD[0] + BW - 8).part,
  board: board.part,
  giftL: giftL.part,
  giftL2: giftL2.part,
  crateR: crateR.part,
  giftR: giftR.part,
  giftTop: giftTop.part,
};
const at: Record<string, Pt> = {
  shadow: shadow.at,
  poleL: pole(POLE_L).at,
  poleR: pole(POLE_R).at,
  wall: wall.at,
  door: door.at,
  roof: roof.at,
  mast: mast.at,
  bunting: bunting.at,
  postL: post(BOARD[0] + 5).at,
  postR: post(BOARD[0] + BW - 8).at,
  board: board.at,
  giftL: giftL.at,
  giftL2: giftL2.at,
  crateR: crateR.at,
  giftR: giftR.at,
  giftTop: giftTop.at,
};
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

/** A frame of the idle: the flags' ripple at `phase` (each flag a little out of step with the others). */
function frame(phase: number): Frame {
  const wave = (p: number, amp: number, len: number) => ({ along: "cols" as const, amp, len, phase: p, pin: "left" as const });
  return {
    ms: 200,
    layers: [
      L("shadow"),
      L("poleL"),
      L("poleR"),
      { part: "flag", x: POLE_L + 2, y: 33, wave: wave(phase + 1.2, 1.5, 11) },
      { part: "flag", x: POLE_R + 2, y: 33, wave: wave(phase + 2.4, 1.5, 11) },
      L("wall"),
      L("door"),
      L("roof"),
      L("mast"),
      { part: "pennant", x: CX + 1, y: 7, wave: wave(phase, 1.6, 14) },
      L("bunting"),
      L("postL"),
      L("postR"),
      L("board"),
      L("giftL"),
      L("giftL2"),
      L("crateR"),
      L("giftTop"),
      L("giftR"),
    ],
  };
}

const idle: Anim = { loop: true, frames: [0, 1, 2, 3].map((i) => frame((i * Math.PI) / 2)) };

export const HOUSE_TIGER: Character = {
  id: "house-tiger",
  name: "Babur's Circus",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Babur's Circus" on. */
export const HOUSE_TIGER_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

/** Its lights at dusk and night (Oct 27): the door's dark inside glows warm (the show going on in there), and a little of it falls on the ground in front. */
export const HOUSE_TIGER_LIGHTS: readonly LightSpot[] = [{ x: CX - DOOR, y: DOOR_TOP, w: 2 * DOOR + 1, h: 16, keys: "VW", color: WARM, strength: 0.9 }];
export const HOUSE_TIGER_POOLS: readonly LightPool[] = [{ x: CX, y: FOOT - 1, rx: 22, ry: 5, color: WARM, strength: 0.35 }];
