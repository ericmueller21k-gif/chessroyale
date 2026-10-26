/**
 * Sawyer's Woodshed: the raccoon builder's home on the town square (Eric's suggestion,
 * docs/mockups/town-square/sawyer-woodshed.webp). A log-and-plank shed under a patched metal roof with a stovepipe, a big
 * circular saw blade hung on its gable, its open front showing a workbench, logs stacked against its right side, an axe
 * in a stump, a lantern on a hook, small pines, sawdust; a blank sign board on two posts (the game writes "Sawyer's
 * Woodshed" on it). His colors (characters/sawyer.ts). `idle`: the lantern flickers and the blade glints.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { SAWYER_PALETTE } from "../../characters/sawyer.ts";
import { groundShadow, lantern, logEnd, paint, pine, signBoard, signFace, signPost, type Pt } from "./kit.ts";

const S_ = SAWYER_PALETTE;
const PALETTE: Record<string, string> = {
  k: S_.k!, // outline
  N: "#4a2810", // wood: dark to light
  O: "#6e4020",
  A: "#94602f",
  T: "#bf8a4f",
  l: "#e2b77a", // cut wood's face: light, its rings
  m: "#c9975a",
  B: S_.B!, // iron: black, its light, its highlight
  C: S_.C!,
  D: S_.D!,
  S: S_.S!, // the blade: steel light, mid, dark
  s: S_.s!,
  t: S_.T!,
  R: S_.R!, // red (the axe's head, the roof's patch)
  r: S_.r!,
  Y: S_.Y!, // the hard-hat yellow (the stump's ring of warning paint, the patch's tape)
  U: S_.U!, // sawdust: light, dark
  V: S_.V!,
  g: "#2f6b3a", // pines: lit, shaded
  G: "#1d4a28",
  w: "#fff3ad", // the lantern's glass: bright, warm
  W: "#f6c21c",
  E: "#2a1a10", // the shed's dark inside
  a: "#c9a56a", // the sign's face: shadow, board, light
  b: "#e8cc95",
  c: "#f7e4b8",
  L: "#f2c14e", // nails
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "NOAT";

const W = 144;
const H = 124;
const CX = 66;
const FOOT = 118;
/** The shed: its walls' sides and top, its roof's peak and eaves. */
const SL = 26;
const SR = 106;
const WALL_TOP = 56;
const BASE = 110;
const PEAK = 20;
const EAVE_L = 16;
const EAVE_R = 116;

// ---- The walls: horizontal logs, lit on top, their ends showing at the corners; an open front with a bench inside.

const walls = paint(SL, WALL_TOP - 2, SR - SL, BASE - WALL_TOP + 2, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - WALL_TOP;
  if (j < 0) return null;
  // The open front: a dark doorway with a workbench and a saw on the wall.
  if (Math.abs(X) < 16 && j > 6) {
    if (j > 34 && j < 37) return j === 35 ? "T" : "A"; // the bench top
    if (j >= 37 && (Math.abs(X + 12) < 1.5 || Math.abs(X - 12) < 1.5)) return "O"; // its legs
    if (Math.abs(X - 6) < 4 && Math.abs(j - 20) < 2 - Math.abs(X - 6) * 0.3) return "s"; // a hand saw on the wall
    if (Math.abs(X + 7) < 1 && j > 14 && j < 30) return "N"; // a shelf's post
    return Math.abs(X) > 14 ? "O" : "E";
  }
  const log = Math.floor(j / 6);
  const r = j % 6;
  const end = x - SL < 3 || SR - x <= 3;
  if (end) return r < 2 ? "l" : r < 4 ? "m" : "A"; // the logs' cut ends at the corners
  const l = 0.6 - 0.5 * (X / 40) - (r >= 4 ? 0.35 : 0) + (r === 0 ? 0.3 : 0) + (log % 2 ? -0.05 : 0.05);
  return l > 0.8 ? "T" : l > 0.4 ? "A" : l > 0.15 ? "O" : "N";
});
/** The gable: vertical planks under the roof, the blade hung on it. */
const gable = paint(SL, PEAK + 6, SR - SL, WALL_TOP - PEAK - 4, (x, y) => {
  const X = x + 0.5 - CX;
  const top = PEAK + 8 + Math.abs(X) * 0.75;
  if (y + 0.5 < top) return null;
  return (x - SL) % 7 === 0 ? "N" : X < 0 ? "A" : "O";
});

// ---- The roof: two slopes of corrugated metal, a red patch and a tin patch, a stovepipe through it.

const roof = paint(EAVE_L, PEAK - 2, EAVE_R - EAVE_L, 46, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const top = PEAK + Math.abs(X) * 0.75;
  const under = top + 7;
  if (Y < top || Y > under || Math.abs(X) > (EAVE_R - EAVE_L) / 2) return null;
  if (Y > under - 1.5) return "N"; // the fascia board
  // Patches: a red one on the left slope, a pale tin one on the right.
  if (X < -18 && X > -32 && Y > top + 1 && Y < top + 5) return (x + y) % 3 === 0 ? "r" : "R";
  if (X > 14 && X < 26 && Y > top + 1 && Y < top + 5) return x % 2 === 0 ? "S" : "s";
  const ridge = Math.floor((x - EAVE_L) / 3) % 2 === 0; // the corrugation
  return X < 0 ? (ridge ? "D" : "C") : ridge ? "C" : "B";
});
const stovepipe = paint(86, 8, 7, 30, (x, y) => {
  if (y < 11) return x === 86 || x === 92 ? null : y === 8 ? "D" : "C"; // the cap
  if (x === 86 || x === 92) return null;
  return x < 89 ? "C" : "B";
});
const BLADE: Pt = [CX, 42];
const blade = paint(BLADE[0] - 10, BLADE[1] - 10, 21, 21, (x, y) => {
  const dx = x + 0.5 - BLADE[0];
  const dy = y + 0.5 - BLADE[1];
  const d = Math.hypot(dx, dy);
  const teeth = 9 + (Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 24) % 2);
  if (d > teeth) return null;
  if (d < 2.2) return "B"; // the arbor hole
  if (d < 4) return "t";
  if (d > 8.4) return "t"; // the teeth
  return dx + dy < -3 ? "S" : "s";
});

// ---- Logs stacked on the right, a stump with an axe, the lantern, pines, sawdust, the shadow.

const LOGS: readonly Pt[] = [
  [112, 106],
  [124, 106],
  [136, 106],
  [118, 96],
  [130, 96],
  [124, 86],
];
const logs = LOGS.map(([x, y]) => logEnd(x, y, 6, "Nlm"));
const stump = paint(24, 92, 22, 24, (x, y) => {
  const X = x + 0.5 - 34;
  const j = y - 92;
  // The axe: its handle leaning from the top of the stump, its red head buried in it.
  if (j < 13 && Math.abs(X - 4 + j * 0.3) < 1) return j < 2 ? null : "T";
  if (j >= 9 && j < 14 && X > -2 && X < 3 && Math.abs(j - 11) < 2.5 - (X + 2) * 0.2) return j < 11 ? "S" : "R";
  if (j < 13) return null;
  if (Math.abs(X) > 9) return null;
  if (j < 16) return Math.hypot(X / 9, (j - 14.5) / 2) < 1 ? (Math.floor(Math.hypot(X, (j - 14.5) * 3)) % 3 === 0 ? "m" : "l") : null; // its cut top
  return X < -3 ? "A" : X < 4 ? "O" : "N";
});
const hook = paint(SL - 6, 62, 7, 4, (x, y) => (y === 62 ? (x > SL - 6 ? "B" : null) : x === SL - 5 && y < 65 ? "B" : null), false);
const lamp = lantern(SL - 9, 65, "B", "wW");
const pines = [pine(10, FOOT - 3, 22, "gG", "N"), pine(20, FOOT, 14, "gG", "N"), pine(140, FOOT - 14, 18, "gG", "N")];
const dust = paint(30, FOOT - 6, 96, 6, (x, y) => {
  const d = ((x + 0.5 - 70) / 46) ** 2 + ((y + 0.5 - (FOOT - 3)) / 3) ** 2;
  if (d > 1) return null;
  return (x * 5 + y * 3) % 4 === 0 ? "V" : "U";
}, false);
const shadow = groundShadow(70, FOOT - 1.5, 66, 4.5);

// ---- The sign on two posts at the front right: blank; the game writes "Sawyer's Woodshed" on it.

const BOARD: Pt = [72, 90];
const BW = 52;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "abc", "L");
const posts = [signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, WOOD), signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, WOOD)];

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("dust", dust),
  add("stovepipe", stovepipe),
  add("gable", gable),
  add("walls", walls),
  add("roof", roof),
  add("blade", blade),
  ...pines.map((p, i) => add(`pine${i}`, p)),
  add("hook", hook),
  add("lamp", lamp),
  ...logs.map((p, i) => add(`log${i}`, p)),
  add("stump", stump),
  add("postL", posts[0]!),
  add("postR", posts[1]!),
  add("board", board),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** The lantern breathes, warm and bright by turns; once round, the blade catches the light. */
const glint = (x: number, y: number): Speck[] => [
  [x, y, "S"],
  [x - 1, y, "S"],
  [x + 1, y, "S"],
  [x, y - 1, "S"],
  [x, y + 1, "S"],
];
const frames: Frame[] = [
  { ms: 300, layers },
  { ms: 260, layers, pal: { w: "#ffe58a", W: "#e0a514" } },
  { ms: 300, layers, specks: glint(BLADE[0] - 4, BLADE[1] - 5) },
  { ms: 240, layers, pal: { w: "#fff8d0", W: "#ffd23a" } },
];

const idle: Anim = { loop: true, frames };

export const HOUSE_SAWYER: Character = {
  id: "house-sawyer",
  name: "Sawyer's Woodshed",
  w: W,
  h: H,
  foot: [70, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Sawyer's Woodshed" on. */
export const HOUSE_SAWYER_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
