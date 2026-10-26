/**
 * Big Boy's Crib: the giant baby's home on the town square (Eric's suggestion, docs/mockups/town-square/bigboy-crib.webp).
 * A giant wooden crib, its posts topped with round knobs, a mobile over it (a star, a cloud and a moon on strings), a
 * starry blanket hanging over its rail, its blank sign board hung on the bars (the game writes "Big Boy's Crib" there);
 * a teddy bear with a red bow, a beach ball, building blocks with a rubber duck on top, and a toy train on a loop of
 * track on a round rug. His colors (characters/bigboy.ts). `idle`: the mobile turns.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { BIGBOY_PALETTE } from "../../characters/bigboy.ts";
import { ball, groundShadow, paint, signBoard, signFace, type Pt } from "./kit.ts";

const B = BIGBOY_PALETTE;
const PALETTE: Record<string, string> = {
  k: B.k!, // outline
  "1": B["1"]!, // the toys' rainbow: red, orange, yellow, green, blue, purple
  "2": B["2"]!,
  "3": B["3"]!,
  "4": B["4"]!,
  "5": B["5"]!,
  "6": B["6"]!,
  r: "#c41f30", // their shades
  o: "#c4600d",
  y: "#c9a312",
  g: "#1f8a30",
  b: "#1d5ec0",
  v: "#6e2aab",
  F: B.F!, // white, and its shade
  W: "#d8d4cc",
  P: B.P!, // the blanket and the rug: blue, dark to light
  p: B.p!,
  q: B.q!,
  Q: B.Q!,
  N: "#5a3015", // wood: dark to light
  O: "#8a5228",
  A: "#b87a3e",
  T: "#dca562",
  h: "#7a4a22", // the teddy: dark, mid, light; its muzzle
  H: "#a86c38",
  j: "#c99256",
  J: "#ead0a8",
  s: "#5a5f6c", // the rails: dark, light; the sleepers
  S: "#8c919c",
  m: "#6b4a30",
  a: "#c9a56a", // the sign's face: shadow, board, light
  c: "#e8cc95",
  e: "#f7e4b8",
  L: "#f2c14e", // nails, the star, the moon, the duck
  l: "#ffe58a",
  d: "#e8732a", // the duck's beak
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "NOAT";

const W = 144;
const H = 124;
const CX = 72;
const FOOT = 118;

// ---- The rug, and the track's loop on it.

const RUG_Y = 106;
const rug = paint(6, RUG_Y - 12, 132, 25, (x, y) => {
  const d = ((x + 0.5 - CX) / 65) ** 2 + ((y + 0.5 - RUG_Y) / 12) ** 2;
  if (d > 1) return null;
  if (d > 0.82) return (x % 4 === 0 && d < 0.92) ? "Q" : "P"; // its border, stitched
  if (d < 0.6 && (x * 5 + y * 11) % 23 === 0) return "F"; // little stars sewn on it
  return d > 0.7 ? "Q" : y < RUG_Y - 4 ? "q" : "p";
}, false);
const track = paint(16, RUG_Y - 9, 112, 19, (x, y) => {
  const d = Math.hypot((x + 0.5 - CX) / 55, (y + 0.5 - RUG_Y) / 8.5);
  if (Math.abs(d - 1) < 0.06) return "s"; // the outer rail
  if (Math.abs(d - 0.86) < 0.07) return "S"; // the inner rail
  if (d > 0.86 && d < 1 && Math.round(Math.atan2(y + 0.5 - RUG_Y, x + 0.5 - CX) * 14) % 2 === 0) return "m"; // sleepers
  return null;
}, false);

// ---- The crib: posts with knobs, rails, bars, the mattress behind them, the blanket over the right rail.

const POST_L = 18;
const POST_R = 120;
const RAIL_TOP = 34;
const RAIL_LOW = 94;
const post = (px: number) =>
  paint(px, 26, 7, RAIL_LOW + 10 - 26, (x, y) => {
    const i = x - px;
    if (y < 33) return Math.hypot(i - 3, y - 29) < 3.6 ? (i < 3 && y < 29 ? "T" : "A") : null; // the knob
    if (y === 34 || y === 46 || y === RAIL_LOW + 6) return i < 3 ? "T" : "A"; // turned rings
    if (y === 35 || y === 47 || y === RAIL_LOW + 7) return "N";
    return i < 2 ? "A" : i > 4 ? "N" : "O";
  });
const crib = paint(POST_L + 6, RAIL_TOP - 4, POST_R - POST_L - 5, RAIL_LOW - RAIL_TOP + 8, (x, y) => {
  const Y = y + 0.5;
  const X = x + 0.5 - CX;
  // The top rail curves up a little in the middle (a headboard); the low rail is straight.
  const top = RAIL_TOP - 3 * Math.cos((X / 50) * (Math.PI / 2));
  if (Y < top) return null;
  if (Y < top + 4) return Y < top + 1.5 ? "T" : "A";
  if (Y > RAIL_LOW && Y < RAIL_LOW + 5) return Y < RAIL_LOW + 1.5 ? "A" : "O";
  if (Y >= RAIL_LOW + 5) return null;
  if ((x - POST_L) % 8 < 3) return (x - POST_L) % 8 === 0 ? "A" : "O"; // the bars
  return Y > RAIL_LOW - 12 ? "Q" : "N"; // the mattress low down; the dark inside above it
});
const blanket = paint(92, RAIL_TOP - 3, 26, 40, (x, y) => {
  // A blanket hung over the rail: its top along the rail, its hem uneven, falling on the front.
  const i = x - 92;
  const hem = 28 + 6 * Math.sin(i * 0.4) + (i > 18 ? 4 : 0);
  if (y - (RAIL_TOP - 3) > hem) return null;
  const star = (x * 7 + y * 3) % 11 === 0 && y > RAIL_TOP + 2;
  return star ? "F" : i < 4 || y < RAIL_TOP + 1 ? "q" : "p";
});

// ---- The mobile: an arm from the left post over the crib, a star, a cloud and a moon hanging from it.

const arm = paint(POST_L + 2, 6, 60, 22, (x, y) => {
  // Up from the post's knob, then across.
  if (x - POST_L - 2 < 3 && y >= 9) return x - POST_L - 2 === 0 ? "T" : "A";
  if (y >= 6 && y < 9 && x < POST_L + 60) return y === 6 ? "T" : "A";
  return null;
});
const ARM_Y = 9;
const star = paint(0, 0, 9, 9, (x, y) => {
  const dx = x + 0.5 - 4.5;
  const dy = y + 0.5 - 4.5;
  const a = Math.atan2(dy, dx) + Math.PI / 2;
  const t = Math.abs(((((a * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
  return Math.hypot(dx, dy) < 4.4 - 2.4 * t ? (dx + dy < 0 ? "l" : "L") : null;
});
const cloud = paint(0, 0, 11, 7, (x, y) => {
  const puff = Math.hypot(x + 0.5 - 3.5, y + 0.5 - 4) < 3.2 || Math.hypot(x + 0.5 - 7.5, y + 0.5 - 4) < 3.2 || Math.hypot(x + 0.5 - 5.5, y + 0.5 - 2.6) < 2.8;
  return puff ? (y < 3 ? "F" : "W") : null;
});
const moon = paint(0, 0, 9, 9, (x, y) => {
  const d = Math.hypot(x + 0.5 - 4.5, y + 0.5 - 4.5);
  return d < 4.4 && Math.hypot(x + 0.5 - 7, y + 0.5 - 3) > 3.6 ? (x < 4 ? "l" : "L") : null;
});
const string = paint(0, 0, 1, 12, () => "s", false);

// ---- The toys: a teddy bear, a beach ball, blocks and a duck, the train.

const teddy = paint(4, 68, 34, 42, (x, y) => {
  const head = Math.hypot(x + 0.5 - 20, y + 0.5 - 80) < 9;
  const earL = Math.hypot(x + 0.5 - 13, y + 0.5 - 72) < 3.5;
  const earR = Math.hypot(x + 0.5 - 27, y + 0.5 - 72) < 3.5;
  const body = ((x + 0.5 - 20) / 12) ** 2 + ((y + 0.5 - 98) / 11) ** 2 < 1;
  const armL = Math.hypot(x + 0.5 - 9, y + 0.5 - 94) < 4;
  const footL = Math.hypot(x + 0.5 - 12, y + 0.5 - 106) < 4;
  const footR = Math.hypot(x + 0.5 - 29, y + 0.5 - 106) < 4;
  if (!(head || earL || earR || body || armL || footL || footR)) return null;
  if (head && Math.hypot(x + 0.5 - 20, y + 0.5 - 83) < 3.4) return Math.abs(x + 0.5 - 20) < 1.2 && y < 82 ? "N" : "J"; // the muzzle, its nose
  if (head && (Math.abs(x + 0.5 - 16.5) < 1 || Math.abs(x + 0.5 - 23.5) < 1) && Math.abs(y + 0.5 - 78) < 1) return "N"; // eyes
  if (Math.abs(y + 0.5 - 89) < 1.6 && Math.abs(x + 0.5 - 20) < 6) return Math.abs(x + 0.5 - 20) < 1.5 ? "r" : "1"; // the bow
  if ((earL || earR) && Math.hypot(x + 0.5 - (earL ? 13 : 27), y + 0.5 - 72) < 1.8) return "J";
  return x + y < 92 ? "j" : x + 0.5 > 24 ? "h" : "H";
});
const beachBall = paint(36, 92, 15, 15, (x, y) => {
  const dx = x + 0.5 - 43.5;
  const dy = y + 0.5 - 99.5;
  const d = Math.hypot(dx, dy);
  if (d > 7) return null;
  if (dx < -2 && dy < -2 && d < 5 && d > 2.5) return "F";
  const seg = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 6) % 3;
  const k = ["1", "F", "5"][seg]!;
  return dx + dy > 4 ? (k === "1" ? "r" : k === "5" ? "b" : "W") : k;
});
/** A toy block (a cube seen from the front and a little above): `ramp` its face, top and side. */
/** Letters on the blocks' faces, 3 x 5 (a pixel each), white. */
const GLYPH: Record<string, string> = { A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110" };
const block = (x0: number, y0: number, s: number, ramp: string, letter = "") =>
  paint(x0, y0 - 3, s + 3, s + 3, (x, y) => {
    const i = x - x0;
    const j = y - (y0 - 3);
    if (j < 3) return i >= 3 - j && i < s + 3 - j ? ramp[1]! : null; // the top
    if (i >= s) return i - s < 3 && j - 3 < s - (i - s) ? ramp[2]! : null; // the side
    // Its letter, in the face's middle.
    const gi = i - Math.floor((s - 3) / 2);
    const gj = j - 3 - Math.floor((s - 5) / 2);
    if (letter && gi >= 0 && gi < 3 && gj >= 0 && gj < 5 && GLYPH[letter]![gj * 3 + gi] === "1") return "F";
    return ramp[0]!;
  });
const blocks = [block(104, 100, 9, "1r1", "A"), block(115, 102, 8, "5b5", "B"), block(108, 91, 8, "3y3", "C"), block(124, 104, 8, "4g4", "D")];
/** A roof block on the top of the pile (a red triangle), as in the picture. */
const roofBlock = paint(122, 84, 12, 9, (x, y) => {
  const X = x + 0.5 - 129;
  const j = y - 84;
  if (Math.abs(X) > j * 0.75 + 0.5 || j > 7) return null;
  return X < 0 ? "1" : "r";
});
const block5 = block(125, 94, 7, "5b5");
const duck = paint(109, 79, 12, 10, (x, y) => {
  const body = ((x + 0.5 - 115) / 5) ** 2 + ((y + 0.5 - 86) / 3) ** 2 < 1;
  const head = Math.hypot(x + 0.5 - 117, y + 0.5 - 81.5) < 2.8;
  if (Math.abs(x + 0.5 - 120.5) < 1.3 && Math.abs(y + 0.5 - 82) < 0.8) return "d"; // the beak
  if (head && Math.abs(x + 0.5 - 117.8) < 0.6 && Math.abs(y + 0.5 - 81) < 0.6) return "k";
  return body || head ? (y < 84 ? "l" : "L") : null;
});
/** The train at the front of its loop: an engine and three cars. */
const TRAIN_Y = RUG_Y + 8;
const car = (x0: number, w: number, ramp: string, engine = false) =>
  paint(x0, TRAIN_Y - 9, w, 10, (x, y) => {
    const i = x - x0;
    const j = y - (TRAIN_Y - 9);
    if (j >= 7) return (i === 2 || i === w - 3) && j < 9 ? "s" : j === 7 && i > 0 && i < w - 1 ? "s" : null; // wheels
    if (engine) {
      if (j < 3) return i >= 2 && i <= 4 ? "s" : i >= w - 6 && i < w - 1 ? ramp[0]! : null; // the funnel, the cab's roof
      return j < 5 && i > w - 7 && i < w - 2 ? "q" : ramp[j > 5 ? 1 : 0]!;
    }
    if (j < 3) return null;
    if (j === 4 && (i === 2 || i === w - 3)) return "q"; // its windows
    return ramp[j > 5 ? 1 : 0]!;
  });
const train = [car(42, 14, "1r", true), car(57, 10, "4g"), car(68, 10, "5b"), car(79, 10, "3y")];
const shadow = groundShadow(CX, FOOT - 3, 68, 5);

// ---- The sign hung on the crib's bars: blank; the game writes "Big Boy's Crib" on it.

const BOARD: Pt = [CX - 30, 64];
const BW = 60;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "ace", "L");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const still = [
  add("shadow", shadow),
  add("rug", rug),
  add("track", track),
  add("crib", crib),
  add("postL", post(POST_L)),
  add("postR", post(POST_R)),
  add("arm", arm),
  add("blanket", blanket),
  add("board", board),
  add("teddy", teddy),
  add("beachBall", beachBall),
  ...blocks.map((p, i) => add(`block${i}`, p)),
  add("block5", block5),
  add("roofBlock", roofBlock),
  add("duck", duck),
  ...train.map((p, i) => add(`car${i}`, p)),
];
parts.star = star.part;
parts.cloud = cloud.part;
parts.moon = moon.part;
parts.string = string.part;
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

/** The mobile turns: its three things circle round the hook, the nearest one lower, a step a frame. */
const HUB = 54;
const frames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  const hung: Layer[] = [];
  (["star", "cloud", "moon"] as const).forEach((name, i) => {
    const a = ((f / 6 + i / 3) * 2 * Math.PI) % (2 * Math.PI);
    const x = Math.round(HUB + Math.cos(a) * 14);
    const drop = 10 + Math.round(Math.sin(a) * 2);
    hung.push({ part: "string", x: x + 4, y: ARM_Y });
    hung.push({ part: name, x, y: ARM_Y + drop });
  });
  return { ms: 220, layers: [...still.slice(0, 7).map(L), ...hung, ...still.slice(7).map(L)] };
});

const idle: Anim = { loop: true, frames };

export const HOUSE_BIGBOY: Character = {
  id: "house-bigboy",
  name: "Big Boy's Crib",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Big Boy's Crib" on. */
export const HOUSE_BIGBOY_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

void ball;
