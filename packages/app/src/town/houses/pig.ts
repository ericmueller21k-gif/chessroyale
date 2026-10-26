/**
 * Wrangler's Stall: the cowboy pig's home on the town square (Eric's suggestion, docs/mockups/town-square/pig-stall.webp).
 * A rail-fence stall of rough posts under a torn cloth awning, a red stripe and a gold star on it; hay bales inside, a barrel
 * and a pitchfork in front, a big coiled lasso hung on a post, a lantern on the beam, straw and grass at its foot,
 * its blank sign board on the front rails (the game writes "Wrangler's Stall" on it). His colors (characters/pig.ts).
 * `idle`: the awning flutters and the lantern flickers.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { PIG_PALETTE } from "../../characters/pig.ts";
import { grain, groundShadow, lantern, paint, signBoard, signFace, tuft, type Pt } from "./kit.ts";

const P_ = PIG_PALETTE;
const PALETTE: Record<string, string> = {
  k: P_.k!, // outline
  H: P_.H!, // leather and old wood: dark to light
  h: P_.h!,
  j: P_.j!,
  J: P_.J!,
  r: P_.r!, // rope: dark, mid, light
  R: P_.R!,
  t: P_.t!,
  O: P_.O!, // gold: shade, mid, light
  Y: P_.Y!,
  y: P_.y!,
  e: "#f3e6c8", // the cloth: light, shade
  E: "#d4c09a",
  s: "#c8302c", // its red stripe: mid, dark
  S: "#8e1c1c",
  i: "#8c9098", // iron: light, dark
  I: "#4a4d55",
  "~": "#ffcf5a33", // the lantern's glow (see-through): its edge, its heart
  "^": "#ffcf5a66",
  g: "#5c9a3a", // grass: lit, shaded
  G: "#3b6b26",
  w: "#fff3ad", // the lantern's glass: bright, warm
  W: "#f6c21c",
  a: "#c9a56a", // the sign's face: shadow, board, light
  b: "#e8cc95",
  c: "#f7e4b8",
  L: "#f2c14e", // nails
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "HhjJ";
/** Straw (the bales and on the ground): its gold. */
const STRAW = "OYy";

const W = 144;
const H = 120;
const CX = 72;
const FOOT = 114;
const BEAM_Y = 20;
const RAIL_A = 78;
const RAIL_B = 92;

// ---- The frame: two tall back posts and a beam bound with rope; the front fence's posts and rails.

const post = (px: number, top: number, foot: number) =>
  paint(px, top, 6, foot - top, (x, y) => {
    const i = x - px;
    if (y - top < 2 && (i === 0 || i === 5)) return null; // a rough, rounded top
    if ((y * 7 + px) % 13 === 0 && i > 0 && i < 5) return "H"; // a knot
    return i < 2 ? "J" : i < 4 ? "j" : "h";
  });
const beam = paint(16, BEAM_Y, 112, 6, (x, y) => {
  const j = y - BEAM_Y;
  // Rope lashings where it meets the posts.
  if ((Math.abs(x - 29) < 4 || Math.abs(x - 115) < 4) && (x + j) % 2 === 0) return "R";
  return j < 2 ? "J" : j < 4 ? "j" : "h";
});
const rails = paint(14, RAIL_A - 2, 116, RAIL_B - RAIL_A + 6, (x, y) => {
  const Y = y + 0.5;
  for (const ry of [RAIL_A, RAIL_B]) if (Math.abs(Y - ry - 0.5 * Math.sin(x * 0.2)) < 2.2) return Y < ry ? "J" : "j";
  return null;
});

// ---- The awning: a torn cloth hung from the beam, a red stripe down its middle and a gold star on it.

const AW_L = 18;
const AW_R = 126;
const awning = paint(AW_L, BEAM_Y + 4, AW_R - AW_L, 30, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - (BEAM_Y + 4);
  // A sagging, torn lower edge: deeper in the middle, ragged teeth.
  const hem = 18 + 4 * Math.cos((X / 54) * (Math.PI / 2)) + (Math.floor(x / 5) % 2 ? 2 : -1) + (Math.abs(X - 30) < 6 ? -6 : 0);
  if (j > hem) return null;
  const sa = Math.atan2(j - 9, X) + Math.PI / 2;
  const st = Math.abs(((((sa * 5) / (2 * Math.PI)) % 1) + 1) % 1 - 0.5) * 2;
  if (Math.hypot(X + 30, j - 7) < 1.6 || Math.hypot(X - 44, j - 11) < 1.2) return null; // holes worn through it
  const r = Math.hypot(X, j - 9);
  if (r < 7.6 - 4.2 * st) return X + (j - 9) < 0 ? "y" : "Y"; // the star
  if (r < 8.8 - 4.2 * st) return "O"; // its edge
  // Two red stripes either side of the star, and a thin one along the hem; the cloth's folds.
  if (Math.abs(Math.abs(X) - 14) < 2.5) return X > 0 || j > hem - 2 ? "S" : "s";
  if (j > hem - 4 && j <= hem - 2) return "s";
  if (j > hem - 2) return "E";
  return X > 36 || (x % 12 === 0 && j > 4) ? "E" : "e";
});

// ---- Inside and about: hay bales, a barrel, a pitchfork, the lasso, the lantern, straw, grass, the shadow.

function bale(x0: number, y0: number, w: number, h: number) {
  return paint(x0, y0 - 3, w + 3, h + 3, (x, y) => {
    const i = x - x0;
    const j = y - (y0 - 3);
    if (j < 3) return i >= 3 - j && i < w + 3 - j ? STRAW[2]! : null;
    if (i >= w) return i - w < 3 && j - 3 < h - (i - w) ? STRAW[0]! : null;
    if (i === 4 || i === w - 5) return "r"; // the twine
    return (x * 3 + y * 7) % 5 === 0 ? STRAW[0]! : STRAW[1]!;
  });
}
const bales = [bale(64, 66, 24, 13), bale(84, 70, 20, 12), bale(74, 56, 20, 11)];
/** The barrel, in front of the fence on the left: staves bulging in the middle, iron hoops, its lid. */
const BARREL: Pt = [30, 84]; // the middle of its top
const BARREL_H = 28;
const barrel = paint(BARREL[0] - 11, BARREL[1] - 3, 22, BARREL_H + 3, (x, y) => {
  const X = x + 0.5 - BARREL[0];
  const j = y - BARREL[1];
  const half = 8.5 + 1.6 * Math.sin((Math.max(0, j) / BARREL_H) * Math.PI); // it bulges in the middle
  if (j < 0) return Math.hypot(X / 8.5, (j + 0.5) / 3) < 1 ? (Math.hypot(X / 8.5, (j + 0.5) / 3) > 0.75 ? "j" : X < 2 ? "J" : "j") : null; // its lid
  if (Math.abs(X) > half) return null;
  if (j < 2) return "h"; // the lid's rim
  if (Math.abs(j - 5) < 1.2 || Math.abs(j - BARREL_H + 6) < 1.2) return X < -3 ? "i" : X < 4 ? "i" : "I"; // hoops
  if (Math.abs(j - BARREL_H / 2) < 0.8) return X < 0 ? "i" : "I"; // a thin one round its middle
  if (Math.abs(X) % 4 < 0.8 && Math.abs(X) > 1) return "h"; // the staves' joints
  return X < -5 ? "J" : X < 3 ? "j" : "h";
});
const pitchfork = paint(4, 34, 20, 80, (x, y) => {
  // Leaning on the fence beside the barrel: the handle from (8, 112) up to (14, 52); its iron head above, three tines.
  const t = (112 - y) / 60;
  const px = 8 + 6 * t;
  if (t >= 0 && t <= 1) return Math.abs(x + 0.5 - px) < 1 ? (x + 0.5 < px ? "j" : "J") : null;
  const tx = 14 + 6 * (t - 1);
  if (t > 1 && t < 1.06) return Math.abs(x + 0.5 - tx) < 1.4 ? "I" : null; // the socket
  if (t >= 1.06 && t < 1.11) return Math.abs(x + 0.5 - tx) < 5 ? (y % 2 ? "I" : "i") : null; // the crosspiece
  if (t >= 1.11 && t < 1.32) for (const o of [-4, 0, 4]) if (Math.abs(x + 0.5 - (tx + o * (1 + (t - 1.11) * 0.4))) < 0.8) return "i"; // tines
  return null;
});
/** The lasso: a big coil of rope hung on the right back post, a few loops lying over each other, its end hanging. */
const LASSO: Pt = [116, 58];
const lasso = paint(LASSO[0] - 12, LASSO[1] - 14, 25, 36, (x, y) => {
  const X = x + 0.5;
  const Y = y + 0.5;
  for (const [ox, oy, rx, ry] of [
    [0, 0, 9, 12],
    [-1, 1, 8, 11],
    [1, 2, 7.5, 10.5],
  ] as const) {
    const d = Math.hypot((X - LASSO[0] - ox) / rx, (Y - LASSO[1] - oy) / ry);
    if (Math.abs(d - 1) * Math.min(rx, ry) < 1.1) return (X - LASSO[0]) + (Y - LASSO[1]) * 0.6 < -2 ? "t" : (x + y) % 3 === 0 ? "r" : "R"; // twisted rope, lit top left
  }
  // Its end hanging down, a knot at the tip.
  if (Math.abs(X - (LASSO[0] + 5 + Math.sin(Y * 0.4))) < 1 && Y > LASSO[1] + 10 && Y < LASSO[1] + 20) return Y > LASSO[1] + 18 ? "r" : "R";
  // The peg it hangs on.
  if (Y < LASSO[1] - 11 && Math.abs(X - LASSO[0]) < 2) return "H";
  return null;
});
const lamp = lantern(124, 31, "I", "wW");
/** Its iron bracket off the beam's end, and its glow (see-through; it flickers with it). */
const bracket = paint(120, 26, 9, 6, (x, y) => (y === 26 ? (x < 128 ? "I" : null) : x === 127 && y < 31 ? "I" : x === 121 && y < 29 ? "I" : null), false);
const halo = paint(115, 26, 26, 26, (x, y) => {
  const d = Math.hypot(x + 0.5 - 128, y + 0.5 - 38);
  return d < 6.5 ? "^" : d < 11 ? "~" : null;
}, false);
/** Straw on the ground: loose strands lying every which way, thicker in drifts. */
const straw = paint(4, FOOT - 9, 136, 10, (x, y) => {
  const d = ((x + 0.5 - 72) / 66) ** 2 + ((y + 0.5 - (FOOT - 4)) / 4.5) ** 2;
  if (d > 1) return null;
  const drift = Math.sin(x * 0.11) + Math.sin(x * 0.27 + 1) > 0.4; // where it's heaped
  // Strands: short slanting lines, two ways.
  const a = (x + y * 2) % 7 === 0;
  const b = (x - y * 2 + 70) % 9 === 0;
  if (drift ? grain(x, y, 4) < 0.7 : a || b) return grain(x, y, 2) < 0.3 ? "O" : grain(x, y, 3) < 0.5 ? "Y" : "y";
  return null;
});
/** Straw spilled off the bales, inside the fence. */
const spill = paint(58, 76, 52, 6, (x, y) => (grain(x, y, 6) < 0.5 - Math.abs(x + 0.5 - 84) / 60 ? (grain(x, y, 7) < 0.4 ? "O" : "Y") : null), false);
/** Grey stones by its foot. */
const stones = paint(0, FOOT - 6, W, 6, (x, y) => {
  for (const [cx, rx] of [
    [50, 3],
    [108, 3.5],
    [114, 2],
    [140, 2.5],
  ] as const) {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - (FOOT - 2)) / (rx * 0.7);
    if (dx * dx + dy * dy <= 1 && dy < 0.7) return dx + dy < -0.3 ? "i" : "I";
  }
  return null;
});
const grass = [tuft(4, FOOT - 1, 8, "gG"), tuft(42, FOOT, 6, "gG"), tuft(132, FOOT - 3, 9, "gG"), tuft(102, FOOT, 6, "gG"), tuft(138, FOOT, 7, "gG"), tuft(62, FOOT + 1, 5, "gG")];
const shadow = groundShadow(CX, FOOT - 1.5, 66, 4.5);

// ---- The sign on the front rails: blank; the game writes "Wrangler's Stall" on it.

const BOARD: Pt = [CX - 28, 82];
const BW = 56;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "abc", "L");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("straw", straw),
  add("postBL", post(26, BEAM_Y - 2, 100)),
  add("postBR", post(112, BEAM_Y - 2, 100)),
  ...bales.map((p, i) => add(`bale${i}`, p)),
  add("spill", spill),
  add("lasso", lasso),
  add("beam", beam),
  "awning",
  add("halo", halo),
  add("bracket", bracket),
  add("lamp", lamp),
  add("postFL", post(16, 70, FOOT - 1)),
  add("postFM", post(69, 72, FOOT - 1)),
  add("postFR", post(122, 70, FOOT - 1)),
  add("rails", rails),
  add("pitchfork", pitchfork),
  add("barrel", barrel),
  add("board", board),
  add("stones", stones),
  ...grass.map((p, i) => add(`grass${i}`, p)),
];
parts.awning = awning.part;
at.awning = awning.at;

/** The awning's hem flutters (its columns ripple, the top held on the beam); the lantern flickers. */
const frames: Frame[] = [0, 1, 2, 3].map((f) => ({
  ms: 240,
  layers: order.map((part): Layer =>
    part === "awning" ? { part, x: at[part]![0], y: at[part]![1], wave: { along: "cols", amp: 1.4, len: 22, phase: (f * Math.PI) / 2, pin: "top" } } : { part, x: at[part]![0], y: at[part]![1] },
  ),
  ...(f === 1 ? { pal: { w: "#ffe58a", W: "#e0a514", "~": "#ffcf5a22", "^": "#ffcf5a48" } } : f === 3 ? { pal: { w: "#fff8d0", W: "#ffd23a", "~": "#ffcf5a44", "^": "#ffcf5a80" } } : {}),
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_PIG: Character = {
  id: "house-pig",
  name: "Wrangler's Stall",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Wrangler's Stall" on. */
export const HOUSE_PIG_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
