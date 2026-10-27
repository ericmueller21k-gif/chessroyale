/**
 * Sawyer's Woodshed: the raccoon builder's home on the town square (Eric's suggestion,
 * docs/mockups/town-square/sawyer-woodshed.webp). A log-and-plank shed (the logs' round ends at its corners) under a roof of wooden
 * shakes patched with bolted tin, a stovepipe, a big circular saw blade hung on its gable; its open front lit warm on a
 * workbench and tools, logs stacked against its right side, an axe bitten into a stump, a glowing lantern on a hook,
 * small pines, stones and sawdust; a blank sign board on two posts (the game writes "Sawyer's
 * Woodshed" on it). His colors (characters/sawyer.ts). `idle`: the lantern flickers and the blade glints.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { SAWYER_PALETTE } from "../../characters/sawyer.ts";
import { grain, groundShadow, lantern, LANTERN_LIGHT, logEnd, paint, pine, signBoard, signFace, signPost, tuft, WARM, type LightPool, type LightSpot, type Pt } from "./kit.ts";

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
  E: "#2a1a10", // the shed's dark inside, and lit warm by its lantern: dim, mid, bright
  h: "#5a3116",
  i: "#94561f",
  j: "#d99a3e",
  "~": "#ffcf5a33", // the lantern's glow (see-through): its edge, its heart
  "^": "#ffcf5a66",
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
    if (Math.abs(X) > 14) return j < 9 ? "N" : "O"; // the doorposts
    if (j < 9) return "N"; // the lintel
    if (j > 34 && j < 37) return j === 35 ? "T" : "A"; // the bench top
    if (j >= 37 && (Math.abs(X + 12) < 1.5 || Math.abs(X - 12) < 1.5)) return "O"; // its legs
    // On the bench: a hand saw, its red handle; a mallet.
    if (j > 30 && j <= 34 && X > 0 && X < 10 && j - 30 > (X - 0) * 0.35) return X < 3 ? "R" : "s";
    if (j > 30 && j <= 34 && X > -10 && X < -5) return j < 33 ? "A" : X === -8.5 ? "O" : null;
    // A shelf on the back wall: tins on it.
    if (j === 18 && X > -13 && X < 2) return "A";
    if (j > 14 && j < 18 && [-11, -7, -2].some((t) => Math.abs(X - t) < 1.5)) return X < -9 ? "R" : X < -4 ? "D" : "C";
    // Tools hung on the right wall: a hammer, a wrench.
    if (X > 6 && X < 12 && j > 12 && j < 26) {
      if (Math.abs(X - 8) < 0.6 && j > 14) return "T";
      if (j >= 13 && j <= 15 && X < 10.5) return "C";
      if (Math.abs(X - 11) < 0.6 && j > 15) return "C";
    }
    // The dark inside, lit warm round a lantern hung at its top left.
    const glow = Math.hypot(X + 8, (j - 12) * 1.2);
    if (glow < 2) return "w";
    if (glow < 3) return "W";
    return glow < 7 ? "j" : glow < 12 ? "i" : glow < 19 ? "h" : "E";
  }
  const log = Math.floor(j / 6);
  const r = j % 6;
  if (r === 5 && grain(x >> 2, log, 3) < 0.25) return "N"; // a gap between logs
  if (r === 2 && grain(x >> 3, log, 8) < 0.15) return "O"; // a knot
  const l = 0.6 - 0.5 * (X / 40) - (r >= 4 ? 0.35 : 0) + (r === 0 ? 0.3 : 0) + (log % 2 ? -0.05 : 0.05);
  return l > 0.8 ? "T" : l > 0.4 ? "A" : l > 0.15 ? "O" : "N";
});
/** The logs' round cut ends, sticking out at both corners: one a log. */
const cornerEnds = paint(SL - 4, WALL_TOP, SR - SL + 8, BASE - WALL_TOP, (x, y) => {
  const j = y - WALL_TOP;
  const cy = Math.floor(j / 6) * 6 + 3;
  for (const cx of [SL - 0.5, SR + 0.5]) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - (WALL_TOP + cy));
    if (d < 3.4) return d > 2.4 ? "O" : d > 1.2 ? "l" : "m";
  }
  return null;
});
/** The gable: vertical planks under the roof, the blade hung on it. */
const gable = paint(SL, PEAK + 6, SR - SL, WALL_TOP - PEAK - 4, (x, y) => {
  const X = x + 0.5 - CX;
  const top = PEAK + 8 + Math.abs(X) * 0.75;
  if (y + 0.5 < top) return null;
  return (x - SL) % 7 === 0 ? "N" : X < 0 ? "A" : "O";
});

// ---- The roof: two slopes of wooden shakes, patched with sheets of tin (bolted at their corners) and one of red; a
// ridge log, its ends showing; a stovepipe through it.

/** The tin patches on the roof: across from its middle (X0 to X1), down from its top edge (D0 to D1). */
const PATCHES: readonly [number, number, number, number, string][] = [
  [-34, -18, 1, 6, "tin"],
  [-14, -6, 2, 5, "red"],
  [12, 30, 1, 6, "tin"],
];
const roof = paint(EAVE_L, PEAK - 2, EAVE_R - EAVE_L, 46, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const top = PEAK + Math.abs(X) * 0.75;
  const under = top + 7;
  if (Y < top || Y > under || Math.abs(X) > (EAVE_R - EAVE_L) / 2) return null;
  if (Y > under - 1.5) return "N"; // the fascia board
  const d = Y - top; // depth from the roof's top edge
  for (const [x0, x1, d0, d1, kind] of PATCHES) {
    if (X < x0 || X > x1 || d < d0 || d > d1) continue;
    const corner = (X - x0 < 1.5 || x1 - X < 1.5) && (d - d0 < 1 || d1 - d < 1);
    if (corner) return "B"; // a bolt
    if (kind === "red") return (x + y) % 3 === 0 ? "r" : "R";
    return d - d0 < 1 ? "t" : X > x1 - 2 ? "s" : x % 3 === 0 ? "s" : "S"; // tin, ridged, lit along its top
  }
  // Shakes: rows, joints staggered, lit on the left slope.
  const row = Math.floor(d / 2.5);
  const joint = (x + row * 3) % 6 === 0;
  if (d - row * 2.5 < 1) return X < 0 ? "A" : "O"; // each row's shadowed edge
  const l = (X < 0 ? 0.65 : 0.35) + (grain(Math.floor((x + row * 3) / 6), row, 5) - 0.5) * 0.4;
  return joint ? "N" : l > 0.6 ? "T" : l > 0.35 ? "A" : "O";
});
/** The ridge log along the roof's top, its cut end at the front. */
const ridge = paint(CX - 5, PEAK - 6, 10, 9, (x, y) => {
  const d = Math.hypot(x + 0.5 - CX, y + 0.5 - (PEAK - 1.5));
  if (d > 4.2) return null;
  return d > 3.2 ? "O" : Math.floor(d) % 2 ? "m" : "l";
});
const stovepipe = paint(84, 6, 11, 32, (x, y) => {
  if (y < 9) return y === 6 ? (x > 84 && x < 94 ? "D" : null) : x === 84 || x === 94 ? null : y === 7 ? "C" : "B"; // its hat
  if (y < 11) return x > 86 && x < 92 ? "E" : null; // the gap under the hat
  if (x < 86 || x > 92) return y === 22 && x > 84 && x < 94 ? "B" : null; // a band round it
  return x < 88 ? "D" : x < 90 ? "C" : "B";
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

/** The woodpile against the right wall: big logs below, smaller ones stacked on them. */
const LOGS: readonly [number, number, number][] = [
  [112, 106, 6],
  [124, 106, 6],
  [136, 107, 5],
  [118, 95, 5.5],
  [129, 95, 5.5],
  [139, 97, 4],
  [114, 85, 4.5],
  [123, 85, 4.5],
  [132, 86, 4.5],
  [119, 77, 4],
  [127, 77, 4],
];
const logs = LOGS.map(([x, y, r]) => logEnd(x, y, r, "Nlm"));
const STUMP: Pt = [34, 106]; // the middle of its cut top
const stump = paint(STUMP[0] - 11, STUMP[1] - 20, 23, FOOT - STUMP[1] + 21, (x, y) => {
  const X = x + 0.5 - STUMP[0];
  const j = y - STUMP[1]; // below its cut top's middle
  // The axe: its head bitten into the top, its handle leaning back up to the right.
  const hx = X - 2 + j * 0.55; // across the handle
  if (j < -1 && j > -19 && Math.abs(hx - 0.5) < 1.2) return hx < 0.3 ? "T" : "A";
  if (j >= -5 && j <= -1 && X > -6 && X < 3) {
    if (X < -4) return "t"; // the bit's bright edge
    return j < -3 ? "r" : "R";
  }
  if (j < -2) return null;
  if (Math.abs(X) > 10) return null;
  // The cut top: rings, a crack running in from its edge.
  const top = Math.hypot(X / 10, j / 2.6);
  if (j < 2.6 && top < 1) {
    if (X > 2 && X < 9 && Math.abs(j - (X - 2) * 0.12) < 0.5) return "O";
    return Math.floor(Math.hypot(X, j * 3.8)) % 3 === 0 ? "m" : "l";
  }
  if (j < 2) return null;
  // The bark: dark furrows; roots splaying at its foot.
  if (j > FOOT - STUMP[1] - 4 && Math.abs(X) > 8) return Math.abs(X) < 10 + (j - (FOOT - STUMP[1] - 4)) ? "N" : null;
  if (Math.abs(X) > 9) return null;
  if ((x * 3) % 7 === 0) return "N";
  return X < -3 ? "A" : X < 4 ? "O" : "N";
});
/** Split wood by the stump: two halves of a log, their pale faces up. */
const split = paint(46, FOOT - 8, 16, 8, (x, y) => {
  for (const [cx, cy] of [
    [50, FOOT - 3],
    [57, FOOT - 4],
  ] as const) {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    if (Math.hypot(dx / 4, dy / 3) > 1 || dy > 1.5) continue;
    return dy < -1.5 ? "l" : dy < 0 ? "m" : "O";
  }
  return null;
});
const hook = paint(SL - 6, 62, 7, 4, (x, y) => (y === 62 ? (x > SL - 6 ? "B" : null) : x === SL - 5 && y < 65 ? "B" : null), false);
const lamp = lantern(SL - 9, 65, "B", "wW");
/** The lantern's glow on the wall beside it and the air round it (see-through; it flickers with the lantern). */
const halo = paint(SL - 17, 57, 24, 28, (x, y) => {
  const d = Math.hypot(x + 0.5 - (SL - 5), (y + 0.5 - 71) * 1.1);
  return d < 7.5 ? "^" : d < 11.5 ? "~" : null;
}, false);
/** Grey stones and tufts of grass about its foot. */
const stones = paint(0, FOOT - 7, W, 7, (x, y) => {
  for (const [cx, rx] of [
    [64, 3],
    [69, 2],
    [104, 2.5],
    [8, 2.5],
  ] as const) {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - (FOOT - 2)) / (rx * 0.75);
    if (dx * dx + dy * dy <= 1 && dy < 0.7) return dx + dy < -0.3 ? "S" : "s";
  }
  return null;
});
const tufts = [tuft(22, FOOT, 6, "gG"), tuft(48, FOOT - 1, 5, "gG"), tuft(128, FOOT, 7, "gG"), tuft(60, FOOT, 4, "gG"), tuft(98, FOOT - 1, 5, "gG")];
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
  add("cornerEnds", cornerEnds),
  add("roof", roof),
  add("ridge", ridge),
  add("blade", blade),
  ...pines.map((p, i) => add(`pine${i}`, p)),
  add("halo", halo),
  add("hook", hook),
  add("lamp", lamp),
  ...logs.map((p, i) => add(`log${i}`, p)),
  add("stones", stones),
  add("stump", stump),
  add("split", split),
  ...tufts.map((p, i) => add(`tuft${i}`, p)),
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
  { ms: 260, layers, pal: { w: "#ffe58a", W: "#e0a514", j: "#c4883a", "~": "#ffcf5a22", "^": "#ffcf5a48" } },
  { ms: 300, layers, specks: glint(BLADE[0] - 4, BLADE[1] - 5) },
  { ms: 240, layers, pal: { w: "#fff8d0", W: "#ffd23a", j: "#e8aa4c", "~": "#ffcf5a44", "^": "#ffcf5a80" } },
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

/** Its lights at dusk and night (Oct 27): the open front's inside, lit by its lantern, glows warm; the lantern on its hook shines, a halo round it; both flicker. */
export const HOUSE_SAWYER_LIGHTS: readonly LightSpot[] = [
  { x: CX - 14, y: WALL_TOP + 7, w: 28, h: BASE - WALL_TOP - 7, keys: "Ehij", color: WARM, strength: 0.8, flicker: true },
  { x: SL - 7, y: 67, w: 4, h: 9, keys: "wW", color: LANTERN_LIGHT, strength: 1, flicker: true, halo: 12 },
];
export const HOUSE_SAWYER_POOLS: readonly LightPool[] = [{ x: CX - 4, y: FOOT - 3, rx: 16, ry: 4, color: WARM, strength: 0.3 }];
