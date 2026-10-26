/**
 * Wrangler's Stall: the cowboy pig's home on the town square (Eric's suggestion, docs/mockups/town-square/pig-stall.webp).
 * A rail-fence stall of rough posts under a torn cloth awning, a red stripe and a gold star on it; hay bales and a barrel
 * inside, a pitchfork leaning by it, a coiled lasso hung on a post, a lantern on the beam, straw and grass at its foot,
 * its blank sign board on the front rails (the game writes "Wrangler's Stall" on it). His colors (characters/pig.ts).
 * `idle`: the awning flutters and the lantern flickers.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { PIG_PALETTE } from "../../characters/pig.ts";
import { groundShadow, lantern, paint, signBoard, signFace, tuft, type Pt } from "./kit.ts";

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
  if (Math.hypot(X, j - 9) < 7.6 - 4.2 * st) return X + (j - 9) < 0 ? "y" : "Y"; // the star
  if (Math.abs(X) < 15) return j > hem - 2 || X > 9 ? "S" : "s"; // the red stripe
  return j > hem - 2 || X > 36 ? "E" : "e";
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
const barrel = paint(30, 62, 18, 30, (x, y) => {
  const X = x + 0.5 - 39;
  const j = y - 62;
  const half = 8 + 1.2 * Math.sin((j / 30) * Math.PI); // it bulges in the middle
  if (Math.abs(X) > half) return null;
  if (j < 2) return "j"; // its top
  if (Math.abs(j - 7) < 1 || Math.abs(j - 23) < 1) return X < 0 ? "i" : "I"; // hoops
  return X < -4 ? "J" : X < 3 ? "j" : "h";
});
const pitchfork = paint(20, 46, 14, 66, (x, y) => {
  // Leaning against the barrel: the handle from (22, 111) up to (30, 60), three tines above.
  const t = (111 - y) / 51;
  const px = 22 + 8 * t;
  if (t >= 0 && t <= 1) return Math.abs(x + 0.5 - px) < 0.9 ? "J" : null;
  if (t > 1 && t < 1.28) {
    const tx = 30 + 8 * (t - 1);
    for (const o of [-3, 0, 3]) if (Math.abs(x + 0.5 - (tx + o)) < 0.7) return "i";
    if (t < 1.06 && Math.abs(x + 0.5 - tx) < 3.6) return "I";
  }
  return null;
});
const lasso = paint(110, 64, 18, 18, (x, y) => {
  const d = Math.hypot((x + 0.5 - 119) / 1.1, y + 0.5 - 73);
  for (const r of [7.5, 5.5, 3.6]) if (Math.abs(d - r) < 0.8) return r > 6 ? "R" : r > 4 ? "r" : "t";
  return null;
});
const lamp = lantern(124, 27, "I", "wW");
const straw = paint(10, FOOT - 7, 124, 8, (x, y) => {
  const d = ((x + 0.5 - 72) / 60) ** 2 + ((y + 0.5 - (FOOT - 3)) / 3.5) ** 2;
  if (d > 1 || (x * 7 + y * 13) % 5 > 1) return null;
  return (x + y) % 3 ? "Y" : "y";
}, false);
const grass = [tuft(12, FOOT - 2, 7, "gG"), tuft(132, FOOT - 3, 8, "gG"), tuft(54, FOOT, 5, "gG")];
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
  add("barrel", barrel),
  add("beam", beam),
  "awning",
  add("lamp", lamp),
  add("postFL", post(16, 70, FOOT - 1)),
  add("postFM", post(69, 72, FOOT - 1)),
  add("postFR", post(122, 70, FOOT - 1)),
  add("rails", rails),
  add("lasso", lasso),
  add("pitchfork", pitchfork),
  add("board", board),
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
  ...(f === 1 ? { pal: { w: "#ffe58a", W: "#e0a514" } } : f === 3 ? { pal: { w: "#fff8d0", W: "#ffd23a" } } : {}),
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
