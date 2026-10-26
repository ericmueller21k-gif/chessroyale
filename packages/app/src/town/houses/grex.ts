/**
 * Jefferson's fireworks stand: the giraffe's home on the town square (he once thought he was a dinosaur, and loves
 * lighting things). A striped wooden stand under a tall pointed roof (he's tall) with a scalloped valance; a blank
 * header board under it (the game writes "Jefferson's Fireworks" there); rockets and Roman candles in racks behind the
 * counter; two "boom" stars painted on it; posts painted like his own spotted coat; crates of rockets and candles at its
 * foot. No explosions and no fire on the building. His colors (characters/grex.ts). Light from the top left, as the
 * bosses'. `idle`: one candle's short fuse fizzes with a small spark (four frames).
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { GREX_PALETTE } from "../../characters/grex.ts";
import { grain, groundShadow, paint, signBoard, signFace, tone, type Pt } from "./kit.ts";

const X_ = GREX_PALETTE;
const PALETTE: Record<string, string> = {
  k: X_.k, // outline
  d: X_.d, // giraffe yellow, dark to light
  c: X_.c,
  C: X_.C,
  h: X_.h,
  o: X_.o, // his spots
  O: X_.O,
  u: X_.u, // cream: the candles' paper
  U: X_.U,
  v: X_.v, // the candles' blue bands
  V: X_.V,
  y: X_.y, // the spark: core to rim
  Y: X_.Y,
  f: X_.f,
  F: X_.F, // the stand's red: mid, dark (his flame red)
  R: X_.R,
  x: X_.x, // a spark's white
  w: X_.w, // the fuse
  W: X_.W,
  g: "#3fae4f", // a green rocket
  G: "#22713a",
  e: "#9150d6", // a purple rocket
  E: "#5a2a96",
  "1": "#4d2813", // wood: dark to light (the counter's top, the racks, the crates)
  "2": "#7a4a22",
  "3": "#a8703a",
  "4": "#d09a5a",
  B: "#2a160c", // the stand's dark inside
  b: "#3d2214",
  S: "#c9a56a", // the header board's face: shadow, board, light
  T: "#e8cc95",
  Q: "#f7e4b8",
  L: "#f2c14e", // nails
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "1234";

const W = 144;
const H = 132;
const CX = 70;
const FOOT = 126;

/** The roof: a tall striped point from PEAK down to the eave, R wide on each side. */
const PEAK = 5;
const EAVE = 52;
const R = 52;
/** The stand under it: its half-width, the counter's top, and the posts' inner edges. */
const STAND = 44;
const COUNTER = 96;

// ---- The roof: a tall cone of red and yellow panels, lit from the left, a scalloped valance under its edge.

const roofHalf = (Y: number) => R * Math.max(0, (Y - PEAK) / (EAVE - PEAK)) ** 1.1;
const roof = paint(CX - R - 1, PEAK, 2 * R + 2, EAVE - PEAK + 8, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if (Y <= EAVE) {
    const hw = roofHalf(Y);
    if (Math.abs(X) > hw) return null;
    if (Y > EAVE - 1.5) return tone(0.62 - 0.55 * (X / R), "dCh"); // the trim
    const t = (X / Math.max(1, hw) + 1) / 2;
    const red = Math.floor(t * 9) % 2 === 0;
    const l = 0.62 - 0.6 * (X / Math.max(1, hw));
    return red ? (l < 0.3 ? "R" : "F") : tone(l, "dCh");
  }
  // The valance: scallops, red and yellow by turns.
  if (Math.abs(X) > R) return null;
  const n = 12;
  const t = ((X / R + 1) / 2) * n;
  const seg = Math.min(n - 1, Math.floor(t));
  if (Y > EAVE + 1 + 4 * Math.sin(Math.PI * (t - seg))) return null;
  const l = 0.62 - 0.55 * (X / R) - (Y > EAVE + 3 ? 0.2 : 0);
  return seg % 2 === 0 ? (l < 0.3 ? "R" : "F") : tone(l, "dCh");
});
/** A little blue pennant on the point. */
const pennant = paint(CX - 1, 0, 9, 8, (x, y) => {
  const i = x - (CX - 1);
  if (i < 2) return y >= 1 ? (i === 0 ? "3" : "2") : null;
  const j = y - 1;
  const len = 7 - Math.abs(j - 2) * 1.6;
  if (j < 0 || j > 4 || i - 2 > len) return null;
  return j === 0 ? "v" : j >= 3 ? "V" : "v";
});

// ---- The posts: painted like his coat, yellow with brown spots.

const post = (px: number) =>
  paint(px, EAVE - 2, 5, FOOT - EAVE + 2, (x, y) => {
    if (grain(x >> 1, y >> 1, 4) < 0.22) return "o";
    return x === px ? "h" : x === px + 4 ? "d" : "C";
  });

// ---- Inside: a dark back wall, a rack of rockets and a box of Roman candles on the counter.

const inside = paint(CX - STAND + 4, EAVE + 2, 2 * STAND - 8, COUNTER - EAVE - 2, (x, y) => {
  const j = y - EAVE;
  if (j < 8) return "B";
  return (x - CX) % 9 === 0 ? "B" : "b"; // planks
});
const RACK = COUNTER - 9;
const rack = paint(CX - STAND + 6, RACK, 2 * STAND - 12, 3, (x, y) => (y === RACK ? "4" : y === RACK + 1 ? "3" : "1"));

/** A rocket: a cone, a striped body, and a stick down to the counter. `ramp`: dark, mid, light. */
function rocket(cx: number, top: number, ramp: string, foot: number) {
  return paint(cx - 2, top, 5, foot - top, (x, y) => {
    const i = x - (cx - 2);
    const j = y - top;
    if (j < 3) return Math.abs(i - 2) <= j * 0.7 ? (i < 2 ? "h" : i === 2 ? "C" : "d") : null; // the cone
    if (j < 12) {
      if (i === 0 || i === 4) return null;
      if (j === 7) return "u"; // a paper band
      return i === 1 ? ramp[2]! : i === 2 ? ramp[1]! : ramp[0]!;
    }
    return i === 2 ? "2" : null; // the stick
  });
}
/** A Roman candle: a cream tube with blue bands, its top dark. */
function candle(cx: number, top: number, foot: number) {
  return paint(cx - 1, top, 4, foot - top, (x, y) => {
    const i = x - (cx - 1);
    const j = y - top;
    if (j === 0) return i === 0 ? "W" : "B";
    const band = j % 5 === 2 || j % 5 === 3;
    return band ? (i < 2 ? "v" : "V") : i === 0 ? "u" : i === 3 ? "U" : "u";
  });
}
const ROCKETS: readonly [number, number, string][] = [
  [-35, -18, "RFF"],
  [-26, -20, "Vvv"],
  [-17, -17, "Ggg"],
  [17, -19, "Eee"],
  [26, -20, "RFF"],
  [35, -17, "dCh"],
];
const rockets = ROCKETS.map(([X, top, ramp]) => rocket(CX + X, COUNTER + top, ramp, COUNTER));
const candles = [-8, -3, 2, 7].map((X, i) => candle(CX + X, COUNTER - 16 + (i % 2) * 2, COUNTER));
const candleBox = paint(CX - 11, COUNTER - 8, 22, 8, (x, y) => (y === COUNTER - 8 ? "4" : (x - CX + 11) % 7 === 0 ? "1" : "2"));

// ---- The counter: a top plank over red and yellow stripes, a "boom" star painted in the middle.

const counter = paint(CX - STAND, COUNTER, 2 * STAND, FOOT - 2 - COUNTER, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - COUNTER;
  if (j < 3) return j === 0 ? "4" : j === 1 ? "3" : "1";
  const s = Math.floor((X + STAND) / 6);
  const edge = (X + STAND) % 6;
  const l = 0.6 - 0.45 * (X / STAND) - (j < 5 ? 0.3 : 0);
  if (s % 2 === 0) return edge > 4.5 || l < 0.3 ? "R" : "F";
  return edge < 1 ? "h" : tone(l, "dCh");
});

/** A "boom" star: a burst of `n` points, its rays yellow, its heart light; red at its edge. */
function boom(cx: number, cy: number, ro: number, ri: number, n: number) {
  return paint(Math.floor(cx - ro - 1), Math.floor(cy - ro - 1), Math.ceil(2 * ro) + 3, Math.ceil(2 * ro) + 3, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const a = Math.atan2(dy, dx) + Math.PI / 2;
    const t = Math.abs(((((a * n) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2; // 0 at a point's tip, 1 between
    const rad = ro - (ro - ri) * t;
    const d = Math.hypot(dx, dy);
    if (d > rad) return null;
    if (d > rad - 1.2) return "R";
    return d < ri * 0.6 ? "x" : d < ri ? "y" : "Y";
  });
}
const boomBig = boom(CX, COUNTER + 15, 10, 4.5, 8);
const boomSmall = boom(CX + 28, COUNTER + 16, 5.5, 2.6, 6);

// ---- Crates at its foot: rockets in the left one, candles in the right (one with a short fuse).

const crate = (x0: number, y0: number, w: number, h: number) =>
  paint(x0, y0, w, h, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return j === 0 ? "4" : i === w - 1 || j === h - 1 ? "1" : "3";
    if (Math.abs(i - 1 - ((w - 3) * (h - 2 - j)) / (h - 3)) < 1) return "3";
    return j % 3 === 0 ? "1" : "2";
  });
const crateL = crate(4, FOOT - 17, 20, 16);
const crateR = crate(116, FOOT - 15, 20, 14);
const crateRockets = [rocket(9, FOOT - 34, "Vvv", FOOT - 16), rocket(15, FOOT - 37, "RFF", FOOT - 16), rocket(20, FOOT - 32, "Ggg", FOOT - 16)];
const crateCandles = [candle(121, FOOT - 27, FOOT - 14), candle(126, FOOT - 29, FOOT - 14), candle(131, FOOT - 25, FOOT - 14)];
/** The fuse: a short grey wick curling up from the left candle. */
const FUSE_TIP: Pt = [118, FOOT - 33];
const FUSE: readonly Pt[] = [
  [121, FOOT - 28],
  [121, FOOT - 29],
  [120, FOOT - 30],
  [119, FOOT - 31],
  [119, FOOT - 32],
  [118, FOOT - 33],
];
const fuse = paint(118, FOOT - 33, 4, 6, (x, y) => (FUSE.some(([px, py]) => px === x && py === y) ? (y < FOOT - 30 ? "W" : "w") : null), false);

const shadow = groundShadow(CX, FOOT - 1.5, 68, 4.5);

// ---- The header board under the roof: blank; the game writes "Jefferson's Fireworks" on it.

const BOARD: Pt = [CX - 36, EAVE + 2];
const BW = 72;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "STQ", "L");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const POST_L = CX - STAND - 5;
const POST_R = CX + STAND;
const order = [
  add("shadow", shadow),
  add("inside", inside),
  add("rack", rack),
  ...rockets.map((p, i) => add(`rocket${i}`, p)),
  ...candles.map((p, i) => add(`candle${i}`, p)),
  add("candleBox", candleBox),
  add("counter", counter),
  add("boomBig", boomBig),
  add("boomSmall", boomSmall),
  add("postL", post(POST_L)),
  add("postR", post(POST_R)),
  add("pennant", pennant),
  add("roof", roof),
  add("board", board),
  ...crateRockets.map((p, i) => add(`crateRocket${i}`, p)),
  add("crateL", crateL),
  add("fuse", fuse),
  ...crateCandles.map((p, i) => add(`crateCandle${i}`, p)),
  add("crateR", crateR),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** The fuse's spark, frame by frame: a white-hot core and a few bits of yellow and orange flying off it. */
const SPARKS: readonly (readonly [number, number, string])[][] = [
  [[0, 0, "x"], [-1, -1, "Y"], [1, -2, "y"], [-2, 1, "f"]],
  [[0, 0, "y"], [1, -1, "x"], [-1, -2, "Y"], [2, 0, "f"], [-2, -1, "f"]],
  [[0, 0, "x"], [-1, 0, "Y"], [0, -2, "y"], [2, -1, "Y"], [-1, -3, "f"]],
  [[0, 0, "y"], [1, 0, "x"], [-2, -2, "Y"], [1, -3, "f"]],
];
const frames: Frame[] = SPARKS.map((sp) => ({
  ms: 110,
  layers,
  specks: sp.map(([dx, dy, k]): Speck => [FUSE_TIP[0] + dx, FUSE_TIP[1] + dy, k]),
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_GREX: Character = {
  id: "house-grex",
  name: "Jefferson's Fireworks",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the header board's blank face is (frame pixels), for the game to write "Jefferson's Fireworks" on. */
export const HOUSE_GREX_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
