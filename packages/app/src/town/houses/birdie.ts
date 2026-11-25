/**
 * Birdie's station, from the street: the mourning dove Birdie's home in Chess Town. A little one-story train station of warm
 * wooden boards and cream trim under a low charcoal roof (a train-red stripe along its eave, a yellow fascia), a big nest of
 * woven twigs sitting on its ridge, its rim drooping over the eaves; a sloped charcoal platform canopy on two posts with a
 * yellow edge and a valance of pointed boards, a blank sign board under it (the game writes "Birdie's Station" there: no
 * letters here), a round station clock over it (no numbers), a pair of wooden doors with warm glass, a ticket window with a
 * brass grille and a counter ledge, a lit window, two benches, a pennant on the left roof corner, a chimney on the right.
 * Birdie's toy train's colors: yellow, charcoal, red. `idle`: the pennant flutters, smoke drifts from the chimney, a twig
 * shifts, a window flickers.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, WARM, type LightPool, type LightSpot, type Pt } from "./kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1a1714", // outline: a near-black warm brown
  h: "#a8770f", // train yellow: deepest, deep, mid, pale
  y: "#d9a21b",
  Y: "#f4c430",
  Z: "#ffe27a",
  c: "#2b2d31", // charcoal: dark to light
  C: "#3a3d44",
  D: "#54575f",
  E: "#70747d",
  r: "#8e1f1a", // train red: deep, mid, light
  R: "#c8372d",
  S: "#e2584b",
  v: "#5a3418", // warm wood: darkest to light
  w: "#7a4a26",
  W: "#a86a3c",
  V: "#c99866",
  "0": "#2a1b0f", // the nest: deepest to straw
  "1": "#3f2a18",
  "2": "#6b4a2b",
  "3": "#8a6038",
  "4": "#b58a55",
  "5": "#e6cf94",
  m: "#d6cfc0", // cream: shadow, cream, white
  M: "#f3f1ec",
  X: "#ffffff",
  L: "#ffb85c", // lit glass (the door, the ticket window): warm, pale, deep
  l: "#ffe2a0",
  i: "#e8954a",
  J: "#ffb85c", // the right window's lit glass (it flickers on its own)
  j: "#ffe2a0",
  s: "#8f8a80", // pale stone: shadow, mid, light
  T: "#c2bcb0",
  U: "#e4dfd4",
  b: "#7e2e22", // brick: dark, mid, light
  B: "#b04a35",
  A: "#cf6a50",
  n: "#8a6a22", // brass: dark, mid, light
  N: "#c9a24a",
  O: "#f0d080",
  q: "#f4f2eecc", // smoke: light, shade (see-through)
  Q: "#d8d5d0a0",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

// ---- Where things are (frame pixels). The station's axis is x = CX; the ground at y FOOT.

const W = 144;
const H = 250;
const CX = 72;
const FOOT = 244;
/** The walls: left, right, top, bottom. */
const WL = 10;
const WR = 133;
const WT = 141;
const BASE = 240;
/** The roof: its ridge and eave rows, its half-width at the ridge and at the eave. */
const RIDGE = 114;
const EAVE = 134;
const RH0 = 46;
const RH1 = 66;

// ---- The roof: charcoal shingles in courses, a red stripe along the eave, a yellow fascia board.

const roof = paint(4, RIDGE, 136, EAVE + 7 - RIDGE, (x, y) => {
  const X = x + 0.5 - CX;
  if (y >= EAVE) {
    // The red stripe (3 rows) and the fascia (4 rows), a little wider than the walls.
    if (y < EAVE + 3) {
      if (Math.abs(X) > 67.5) return null;
      return y === EAVE ? "S" : y === EAVE + 1 ? "R" : "r";
    }
    if (Math.abs(X) > 65.5) return null;
    const j = y - EAVE - 3;
    return j === 0 ? "Z" : j === 3 ? "h" : X > 40 ? "y" : "Y";
  }
  const hw = RH0 + ((y - RIDGE) / (EAVE - RIDGE)) * (RH1 - RH0);
  if (Math.abs(X) > hw) return null;
  if (y === RIDGE) return X < 0 ? "E" : "D";
  const course = Math.floor((y - RIDGE - 1) / 3);
  const r = (y - RIDGE - 1) % 3;
  // The hips: a line from the ridge's ends to the eave's corners, lit on the left facet.
  if (Math.abs(Math.abs(X) - hw) < 1) return X < 0 ? "E" : "c";
  if (r === 2) return "c";
  if ((x + course * 4) % 9 === 0) return "c";
  const lit = X < -20 ? 1 : X > 30 ? -1 : 0;
  if (r === 0) return lit >= 0 ? "D" : "C";
  return lit > 0 ? "D" : "C";
});

// ---- The walls: vertical wooden planks, cream corner boards, a stone plinth; in shade under the eave and the canopy.

const CAN_L = 14; // the canopy's span at its front edge
const CAN_R = 130;
const CAN_TOP = 168;
const CAN_EDGE = 178;

const walls = paint(WL, WT, WR - WL + 1, BASE - WT, (x, y) => {
  const i = x - WL;
  if (i < 3) return i === 2 ? "m" : "M"; // the corner boards
  if (x > WR - 3) return x === WR - 2 ? "M" : "m";
  if (y >= BASE - 6) {
    // The plinth: pale stone blocks.
    const j = y - (BASE - 6);
    if (j === 0) return "U";
    if (j === 3 || (x + (j > 3 ? 6 : 0)) % 12 === 0) return "s";
    return "T";
  }
  const p = (x - WL - 3) % 6;
  let k = p === 0 ? "w" : p === 1 ? "V" : "W";
  if (k === "W" && grain(x, Math.floor(y / 6), 3) < 0.12) k = "w"; // the grain
  if (k === "W" && grain(x, y, 4) < 0.03) k = "V";
  const shade = y < WT + 3 || (y >= CAN_EDGE && y < CAN_EDGE + 9 && x > CAN_L && x < CAN_R);
  if (shade) k = k === "V" ? "W" : k === "W" ? "w" : "v";
  return k;
});

// ---- The clock, high over the door: a cream face, a yellow ring, a charcoal frame, tick marks and two hands.

const CLK: Pt = [72, 155];
const CR = 12;
const clock = paint(CLK[0] - CR, CLK[1] - CR, 2 * CR + 1, 2 * CR + 1, (x, y) => {
  const dx = x + 0.5 - (CLK[0] + 0.5);
  const dy = y + 0.5 - (CLK[1] + 0.5);
  const d = Math.hypot(dx, dy);
  if (d > CR + 0.3) return null;
  if (d > CR - 1.6) return dx + dy < -4 ? "D" : "C";
  if (d > CR - 3.1) return dx + dy < -3 ? "Z" : dx + dy > 5 ? "y" : "Y";
  // The hands: the hour toward ten, the minute toward two; a brass pin in the middle.
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return "n";
  const along = (ax: number, ay: number, len: number) => {
    const t = dx * ax + dy * ay;
    const off = Math.abs(dx * ay - dy * ax);
    return t > 0 && t < len && off < 0.6;
  };
  if (along(-0.866, -0.5, 5.2)) return "c";
  if (along(0.5, -0.866, 7.6)) return "c";
  // Twelve ticks, the four quarter ones longer.
  const a = Math.atan2(dy, dx);
  const q = Math.round(a / (Math.PI / 6));
  const near = Math.abs(a - q * (Math.PI / 6)) * d < 0.6;
  if (near && d > 6.6 && d < 8.6) return "c";
  if (near && q % 3 === 0 && d > 5.6 && d < 8.6) return "c";
  return dx + dy > 6 ? "m" : "M";
});

// ---- The platform canopy: a sloped charcoal roof of ribbed sheet, a yellow edge board and a valance of pointed boards.

const canopy = paint(CAN_L, CAN_TOP, CAN_R - CAN_L + 1, CAN_EDGE + 7 - CAN_TOP, (x, y) => {
  const X = x + 0.5 - CX;
  if (y < CAN_EDGE) {
    const t = (y - CAN_TOP) / (CAN_EDGE - 1 - CAN_TOP);
    const hw = 52 + t * 6;
    if (Math.abs(X) > hw) return null;
    if (y === CAN_TOP) return "c";
    const rib = (x - CAN_L) % 5;
    if (rib === 0) return "c";
    if (rib === 1) return X < -10 ? "E" : "D";
    return X < -30 ? "D" : "C";
  }
  const j = y - CAN_EDGE;
  if (j < 3) return j === 0 ? "Z" : j === 2 ? "y" : "Y";
  // The valance: pointed boards, three rows deep.
  const t = (x - CAN_L) % 4;
  const tooth = j === 3 ? t < 4 : j === 4 ? t < 3 : t === 1;
  if (!tooth) return null;
  return t === 0 ? "Y" : t === 2 ? "y" : "Y";
});
/** The canopy's posts: slim charcoal posts, lit on the left, with a yellow collar at the top. */
const post = (px: number) =>
  paint(px, CAN_EDGE + 5, 3, BASE - CAN_EDGE - 5, (x, y) => {
    if (y < CAN_EDGE + 8) return x === px ? "Z" : "Y";
    return x === px ? "D" : x === px + 2 ? "c" : "C";
  });

// ---- The sign under the canopy: a cream face framed in train yellow (blank: the game writes on it).

const BOARD: Pt = [38, 186];
const BW = 68;
const BH = 19;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, "hyYZ", "mMX", "c");

// ---- The doors: a pair of wooden doors in a cream surround, a warm glass pane in each, on a pale stone step.

const DX = 72; // the door's middle
const DT = 206; // its top
const door = paint(DX - 16, DT, 32, BASE - DT, (x, y) => {
  const i = x - (DX - 16);
  const j = y - DT;
  if (i < 2 || i > 29 || j < 2) return i === 0 || j === 0 ? "M" : i === 31 ? "m" : "m"; // the surround
  // Each leaf: 14 wide (x DX-14 .. DX-1 and DX .. DX+13).
  const left = x < DX;
  const li = left ? x - (DX - 14) : x - DX;
  const lj = j - 2;
  if (li === 0 || li === 13) return li === 0 ? "V" : "v";
  if (lj === 0) return "V";
  // The glass.
  if (li >= 3 && li <= 10 && lj >= 3 && lj <= 15) {
    if (li === 3 || lj === 3) return "w";
    if (lj === 9) return "W"; // a glazing bar
    return li + lj < 12 ? "l" : lj > 12 ? "i" : "L";
  }
  // The knobs.
  if (lj === 19 && (left ? li === 11 : li === 2)) return "O";
  if (lj === 20 && (left ? li === 11 : li === 2)) return "n";
  // A raised panel below.
  if (li >= 3 && li <= 10 && lj >= 22 && lj <= 29) {
    if (lj === 22 || li === 3) return "V";
    if (lj === 29 || li === 10) return "w";
    return "W";
  }
  return li === 1 ? "V" : "W";
});
const step = paint(DX - 20, BASE, 40, 4, (x, y) => {
  const j = y - BASE;
  if (j === 0) return x < DX + 12 ? "U" : "T";
  return j === 3 || x === DX + 19 ? "s" : "T";
});

// ---- The ticket window (left): an arched window lit warm, a little brass grille, a cream counter ledge.

const TW: Pt = [20, 203];
const TWW = 29;
const TWH = 19;
const ticket = paint(TW[0] - 2, TW[1], TWW + 4, TWH + 3, (x, y) => {
  const i = x - TW[0];
  const j = y - TW[1];
  const X = x + 0.5 - (TW[0] + TWW / 2);
  if (j >= TWH) {
    // The counter ledge, sticking out either side.
    return j === TWH ? "M" : j === TWH + 1 ? "m" : "w";
  }
  if (i < 0 || i >= TWW) return null;
  // The arch: the top rounds off.
  const archR = TWW / 2;
  if (j < 6 && (X / archR) ** 2 + ((6 - j - 0.5) / 7) ** 2 > 1) return null;
  const inner = (X / (archR - 3)) ** 2 + ((6 - j - 0.5) / 4.5) ** 2 <= 1 || j >= 6;
  if (!inner || Math.abs(X) > archR - 3) return X < 0 ? "M" : "m";
  // The grille: brass bars over the lower glass, a gap in the middle for the tickets.
  if (j >= 9 && Math.abs(X) < 9) {
    if (j === 9) return "N";
    if (Math.round(X + 0.5) % 3 === 0 && !(j >= 14 && Math.abs(X) < 3.5)) return X < 0 ? "O" : "N";
  }
  return X + j < -4 ? "l" : j > TWH - 4 ? "i" : "L";
});

// ---- The window (right): lit warm, four panes in a cream frame, a sill.

const RW: Pt = [96, 202];
const RWW = 28;
const RWH = 19;
const window_ = paint(RW[0] - 2, RW[1], RWW + 4, RWH + 3, (x, y) => {
  const i = x - RW[0];
  const j = y - RW[1];
  if (j >= RWH) return i >= -2 && i < RWW + 2 ? (j === RWH ? "M" : j === RWH + 1 ? "m" : "w") : null;
  if (i < 0 || i >= RWW) return null;
  if (i < 2 || i >= RWW - 2 || j < 2 || j >= RWH - 1) return i >= RWW - 2 || j >= RWH - 1 ? "m" : "M";
  if (i === 13 || i === 14 || j === 9) return i === 14 ? "m" : "M";
  return i + j < 12 || (i > 14 && i + j < 26 && j < 9) ? "j" : j > RWH - 5 ? "i" : "J";
});

// ---- The benches: wooden slats on a charcoal frame.

const bench = (x0: number) =>
  paint(x0, 223, 28, BASE - 223, (x, y) => {
    const i = x - x0;
    const j = y - 223;
    const leg = i === 2 || i === 3 || i === 24 || i === 25;
    if (j === 3 || j === 7 || j === 10) return i >= 1 && i <= 26 ? "V" : null; // the slats: lit top rows
    if (j === 4 || j === 8 || j === 11) return i >= 1 && i <= 26 ? (i > 22 ? "w" : "W") : null;
    if (leg) return i === 2 || i === 24 ? "D" : "c";
    if (j === 12 && i >= 3 && i <= 24) return "C";
    return null;
  });

// ---- The nest: a big bowl of woven twigs sitting on the ridge, its rim thick and round and drooping over the eaves.

const NR = 68; // half its width
const NC = 84; // the rim's middle row
const tilt = (X: number, Y: number) => Y - 0.04 * X; // a little lopsided: lower on the right
const outerTop = (u: number) => NC - 12 * Math.sqrt(Math.max(0, 1 - u * u)) + 11 * smooth(0.72, 1.02, Math.abs(u)) ** 1.5;
const smooth = (a: number, b: number, t: number) => {
  const s = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
};
const rimBot = (u: number) => {
  const au = Math.abs(u);
  let b = NC + 12 * Math.sqrt(Math.max(0, 1 - u * u)) + 13 + 33 * smooth(0.6, 0.94, au);
  if (au > 0.8) b -= 16 * (1 - Math.sqrt(Math.max(0, 1 - ((au - 0.8) / 0.2) ** 2)));
  return b;
};
/** Woven twigs: strands following the curve `ref`, broken into short tilted lengths. A light offset for the pixel. */
function weave(x: number, X: number, lat: number, seed: number): { d: number; top: boolean } {
  const s = Math.floor((lat + 60) / 3);
  const len = 6 + Math.floor(grain(s, 0, seed) * 9);
  const off = grain(s, 1, seed) * len;
  const seg = Math.floor((X + 100 + off) / len);
  const mid = (seg + 0.5) * len - 100 - off;
  const t = (grain(s, seg, seed + 1) - 0.5) * 1.1;
  const lat2 = lat + t * (X - mid);
  // Crossing twigs, here and there: diagonals laid over the strands.
  for (const dir of [0.7, -0.8]) {
    const c = X * dir + lat;
    const ci = Math.floor((c + 200) / 9);
    if (((c + 200) % 9) < 1.1 && grain(ci, Math.floor((X + 100) / 7), seed + (dir > 0 ? 3 : 4)) < 0.3) return { d: 0.3, top: true };
  }
  const r = ((Math.floor(lat2 + 60) % 3) + 3) % 3;
  const pos = X + 100 + off - seg * len;
  if (pos < 1) return { d: -0.3, top: false };
  void x;
  return r === 0 ? { d: 0.22, top: true } : r === 1 ? { d: 0, top: false } : { d: -0.32, top: false };
}
const nt = (l: number) => (l < 0.16 ? "1" : l < 0.42 ? "2" : l < 0.7 ? "3" : "4");

const nest = paint(CX - NR - 1, NC - 16, 2 * NR + 3, 76, (x, y) => {
  const X = x + 0.5 - CX;
  const u = X / NR;
  if (Math.abs(u) > 1) return null;
  const Y = tilt(X, y + 0.5);
  // A ragged edge: lumps, and single twig ends poking out all round.
  const spike = grain(x, 0, 77) < 0.2 ? 1 + Math.floor(grain(x, 1, 78) * 3) : 0;
  const top = outerTop(u) - 1.5 * grain(Math.floor((X + 100) / 4), 0, 31) - spike;
  if (Y < top) return null;
  if (Y < top + spike) return grain(x, 2, 79) < 0.5 ? "3" : "4";
  if (Math.abs(u) > 0.97 && grain(Math.floor(Y), 3, 80) < 0.4) return null;
  if (Y > rimBot(u) && Y < rimBot(u) + 3 && Math.abs(u) > 0.55 && grain(x, 4, 81) < 0.22) return "2"; // straggling ends under the droop
  const lit = -0.16 * u - (u > 0.78 ? 0.25 : 0) + (u < -0.85 ? -0.12 : 0); // the left brighter; the right droop in shade
  // The hollow: the inside of the bowl, seen over the front rim.
  const hx = X / 52;
  const hy = (Y - (NC + 0.5)) / 6;
  if (hx * hx + hy * hy < 1) {
    if (Y < NC - 1) {
      const w = weave(x, X, Y - (NC - 12 * Math.sqrt(Math.max(0, 1 - hx * hx))), 41);
      return w.d > 0 ? "2" : w.d < -0.2 ? "0" : "1";
    }
    return grain(x, y, 12) < 0.12 ? "1" : "0";
  }
  const bot = rimBot(u);
  if (Y < NC) {
    // The back rim, lit on top.
    const w = weave(x, X, Y - outerTop(u), 51);
    const l = 0.72 + lit + w.d;
    if (w.top && l > 0.6 && grain(x, y, 9) < 0.06) return "5";
    return nt(l);
  }
  if (Y <= bot) {
    // The front rim: thick, round, lit on its upper half.
    const ref = NC + 6 * Math.sqrt(Math.max(0, 1 - hx * hx));
    const depth = (Y - ref) / Math.max(4, bot - ref);
    const w = weave(x, X, Y - ref, 61);
    const l = 0.9 - 0.65 * depth + lit + w.d;
    if (w.top && l > 0.55 && grain(x, y, 9) < 0.05) return "5";
    return nt(l);
  }
  // The bowl below the rim, in the rim's shadow.
  const bx = X / 58;
  const by = (Y - 104) / 20;
  if (bx * bx + by * by > 1 || Y < NC) return null;
  if (Y < bot + 2) return "1";
  const w = weave(x, X, Y - bot, 71);
  return nt(0.36 + lit + w.d - 0.25 * Math.max(0, by));
});

// ---- Twigs sticking out of the nest (thin: no outline; a lit top and a dark underside).

type Seg = readonly [number, number, number, number];
const TWIGS: readonly Seg[] = [
  [22, 82, 11, 73],
  [46, 75, 42, 63],
  [56, 74, 51, 66],
  [116, 80, 126, 72],
  [131, 96, 141, 92],
  [9, 128, 5, 141],
  [135, 131, 138, 145],
];
const STRAW: readonly Seg[] = [
  [64, 74, 58, 67],
  [100, 77, 106, 71],
  [30, 99, 44, 103],
  [79, 104, 90, 103],
  [16, 118, 21, 126],
];
/** Long twigs laid across the front rim, over the weave. */
const LAID: readonly Seg[] = [
  [18, 96, 36, 104],
  [44, 106, 68, 109],
  [62, 104, 74, 99],
  [92, 106, 118, 100],
  [12, 108, 22, 124],
  [124, 104, 131, 118],
  [104, 96, 99, 104],
  [36, 92, 28, 99],
  [5, 104, 2, 110],
  [137, 108, 141, 112],
];
function sticks(segs: readonly Seg[], lit: string, dark: string) {
  const pts = new Map<string, string>();
  for (const [x0, y0, x1, y1] of segs) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let t = 0; t <= n; t++) {
      const px = Math.round(x0 + ((x1 - x0) * t) / n);
      const py = Math.round(y0 + ((y1 - y0) * t) / n);
      pts.set(`${px},${py}`, lit);
      if (!pts.has(`${px},${py + 1}`)) pts.set(`${px},${py + 1}`, dark);
    }
  }
  return paint(0, 0, W, 160, (x, y) => pts.get(`${x},${y}`) ?? null, false);
}
const twigs = sticks(TWIGS, "3", "1");
const straw = sticks(STRAW, "5", "4");
const laid = sticks(LAID, "4", "1");
/** The twig that shifts: two positions. */
const twigA = sticks([[86, 75, 93, 62]], "4", "2");
const twigB = sticks([[86, 75, 94, 63]], "4", "2");

// ---- The chimney (right corner): a short brick stack, a charcoal cap.

const CHX = 112;
const CHT = 95;
const chimney = paint(CHX - 2, CHT - 4, 16, 126 - CHT + 4, (x, y) => {
  const i = x - CHX;
  const j = y - CHT;
  if (j < 0) {
    // The cap: a charcoal slab, lit on top.
    if (j === -4) return i >= 0 && i <= 11 ? "E" : null;
    return j === -1 ? "c" : i === -2 ? "D" : "C";
  }
  if (i < 0 || i > 11) return null;
  const row = Math.floor(j / 3);
  if (j % 3 === 2) return "b";
  if ((i + (row % 2) * 3) % 6 === 5) return "b";
  return i < 3 ? "A" : i > 8 ? "b" : "B";
});

// ---- The pennant (left corner): a charcoal pole with a yellow ball, a red flag with a yellow stripe flying left.

const PX = 22;
const PTOP = 78;
const pole = paint(PX - 1, PTOP - 3, 4, 128 - PTOP + 3, (x, y) => {
  const i = x - PX;
  if (y < PTOP) return (i >= 0 && i <= 1) || y === PTOP - 2 ? (i <= 0 ? "Z" : "y") : null;
  if (i < 0 || i > 1) return null;
  return i === 0 ? "D" : "c";
});
const FLW = 19;
const FLH = 11;
const flag: Part = {
  grid: Array.from({ length: FLH }, (_, j) =>
    Array.from({ length: FLW }, (_, i) => {
      const hh = 4.5 * ((i + 2) / (FLW + 1));
      const d = j - (FLH - 1) / 2;
      if (Math.abs(d) > hh) return ".";
      if (Math.abs(d) < 1.2 && i < FLW - 1) return d < 0 ? "Z" : "Y";
      if (i === FLW - 1) return "r";
      return d < -hh + 1 ? "S" : d > hh - 1.2 ? "r" : "R";
    }).join(""),
  ),
};

// ---- Smoke: soft puffs, no outline.

const puff = (r: number): Part => {
  const n = 2 * r + 1;
  return {
    outline: false,
    grid: Array.from({ length: n }, (_, j) =>
      Array.from({ length: n }, (_, i) => {
        const dx = i - r;
        const dy = j - r;
        const d = Math.hypot(dx, dy);
        if (d > r + 0.3) return ".";
        return dx + dy > r * 0.5 ? "Q" : "q";
      }).join(""),
    ),
  };
};

// ---- The ground shadow.

const shadow = groundShadow(CX, FOOT - 2, 70, 5);

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const back = [
  add("shadow", shadow),
  add("walls", walls),
  add("roof", roof),
  add("nest", nest),
  add("twigs", twigs),
  add("laid", laid),
  add("straw", straw),
];
add("twigA", twigA);
add("twigB", twigB);
const front = [
  add("chimney", chimney),
  add("pole", pole),
  add("clock", clock),
  add("door", door),
  add("step", step),
  add("ticket", ticket),
  add("window", window_),
  add("postL", post(CAN_L + 1)),
  add("postR", post(CAN_R - 3)),
  add("canopy", canopy),
  add("board", board),
  add("benchL", bench(18)),
  add("benchR", bench(98)),
];
parts.flag = flag;
for (const r of [1, 2, 3, 4]) parts[`puff${r}`] = puff(r);
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

/** The smoke's puffs at time f (0 to 5): each rises from the cap and drifts left, growing. */
function smoke(f: number): Layer[] {
  const out: Layer[] = [];
  for (let k = 0; k < 3; k++) {
    const t = (f + 2 * k) % 6;
    const r = Math.min(4, 2 + Math.floor(t * 0.45));
    const cx = CHX + 6 - Math.round(t * 2.6) + (t % 2 === 1 ? 1 : 0);
    const cy = CHT - 7 - Math.round(t * 6);
    out.push({ part: `puff${r}`, x: cx - r, y: cy - r });
  }
  return out;
}

const FLAG_PHASE = [0, 2.1, 4.2];
const FLICKER: Record<string, string> = { J: "#ffa848", j: "#ffd890" };
function frame(f: number): Frame {
  const layers: Layer[] = [
    ...back.map(L),
    L(f === 3 ? "twigB" : "twigA"),
    ...front.slice(0, 2).map(L),
    { part: "flag", x: PX - FLW, y: PTOP + 1, wave: { along: "cols", amp: 1.5, len: 12, phase: FLAG_PHASE[f % 3]!, pin: "right" } },
    ...smoke(f),
    ...front.slice(2).map(L),
  ];
  return { ms: 600, layers, pal: f === 1 || f === 4 ? FLICKER : undefined };
}

const idle: Anim = { loop: true, frames: [0, 1, 2, 3, 4, 5].map(frame) };

export const HOUSE_BIRDIE: Character = {
  id: "house-birdie",
  name: "Birdie's Station",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Birdie's Station" on. */
export const HOUSE_BIRDIE_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
/** The front door's middle x. */
export const HOUSE_BIRDIE_DOOR = DX;

/** Its lights at dusk and night: the doors' glass, the ticket window, the right window, the clock's face a little. */
export const HOUSE_BIRDIE_LIGHTS: readonly LightSpot[] = [
  { x: DX - 14, y: DT + 2, w: 28, h: 20, keys: "Lli", color: WARM, strength: 0.85 },
  { x: TW[0], y: TW[1], w: TWW, h: TWH, keys: "Lli", color: WARM, strength: 0.8, flicker: true },
  { x: RW[0], y: RW[1], w: RWW, h: RWH, keys: "Jji", color: WARM, strength: 0.75 },
  { x: CLK[0] - CR, y: CLK[1] - CR, w: 2 * CR + 1, h: 2 * CR + 1, keys: "Mm", color: "#ffe2a0", strength: 0.35, halo: 14 },
];
export const HOUSE_BIRDIE_POOLS: readonly LightPool[] = [
  { x: DX, y: FOOT - 1, rx: 22, ry: 5, color: WARM, strength: 0.35 },
  { x: TW[0] + TWW / 2, y: FOOT - 2, rx: 14, ry: 3, color: WARM, strength: 0.2 },
  { x: RW[0] + RWW / 2, y: FOOT - 2, rx: 14, ry: 3, color: WARM, strength: 0.2 },
];
