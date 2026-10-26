/**
 * Chub & Chirp's Grassland: the rabbit and the grasshopper's home on the town square (Eric's suggestion,
 * docs/mockups/town-square/hopper-grassland.webp). A grassy knoll with a burrow in it, a dirt path running down from the
 * burrow past flat stones, clover and little flowers, tall grass and cattails standing behind, a carrot's top showing in
 * the ground, and a low edge of log posts at its front holding its blank sign board (the game writes "Chub & Chirp's
 * Grassland" on it). Their colors (characters/hopper.ts). `idle`: the carrot top wiggles and a tall blade of grass sways.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { HOPPER_PALETTE } from "../../characters/hopper.ts";
import { flower, grain, groundShadow, logEnd, paint, signBoard, signFace, type Pt } from "./kit.ts";

const P_ = HOPPER_PALETTE;
const PALETTE: Record<string, string> = {
  k: P_.k!, // outline
  a: P_.a!, // greens: darkest to lightest
  b: P_.b!,
  c: P_.c!,
  d: P_.d!,
  e: P_.e!,
  l: P_.l!, // yellow-greens (dry grass, cattail stems)
  m: P_.m!,
  n: P_.n!,
  F: P_.F!, // earth: dark to light (the burrow's rim, the path)
  G: P_.G!,
  H: P_.H!,
  I: P_.I!,
  x: "#120c08", // the burrow's dark
  L: P_.L!, // wood: dark to light (the logs)
  M: P_.M!,
  N: P_.N!,
  Q: P_.Q!,
  R: P_.R!, // carrot: mid, dark
  K: P_.K!,
  s: "#8c8c94", // stones: dark, mid, light
  S: "#b4b4bc",
  T: "#d4d4dc",
  p: P_.p!, // flowers: pink, white, gold
  w: "#ffffff",
  Y: P_.Y!,
  u: "#6a3a1a", // cattails' heads: dark, light
  U: "#9a5a2a",
  A: "#c9a56a", // the sign's face: shadow, board, light; nails
  B: "#e8cc95",
  C: "#f7e4b8",
  O: P_.O!,
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

const W = 144;
const H = 120;
const CX = 72;
const FOOT = 114;
/** The knoll: its middle on the ground, half-width and height. */
const KX = 76;
const KY = 98;
const KRX = 58;
const KRY = 48;
const knollTop = (x: number) => KY - KRY * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - KX) / KRX) ** 2));
const HOLE: Pt = [90, 70];

// ---- Tall grass and cattails behind, the knoll, the burrow, the path, stones, clover.

const tall = paint(10, 6, 124, 64, (x, y) => {
  // Long blades fanning up from behind the knoll, and cattails' stems with brown heads.
  for (const [bx, h, lean, k] of [
    [22, 46, -0.25, "c"],
    [28, 54, 0.1, "d"],
    [34, 40, 0.3, "b"],
    [116, 50, 0.2, "c"],
    [122, 58, -0.15, "d"],
    [128, 44, 0.35, "b"],
    [60, 34, -0.2, "c"],
    [100, 36, 0.25, "d"],
  ] as const) {
    const j = 66 - y; // height above the knoll's back
    if (j < 0 || j > h) continue;
    const X = bx + lean * j * (j / h);
    if (Math.abs(x + 0.5 - X) < (j < h * 0.7 ? 1 : 0.6)) return k;
  }
  for (const [bx, h] of [
    [40, 58],
    [108, 62],
    [124, 52],
  ] as const) {
    const j = 66 - y;
    if (j < 0 || j > h) continue;
    if (j > h - 9 && Math.abs(x + 0.5 - bx) < 2) return j > h - 2 ? null : x + 0.5 < bx ? "U" : "u"; // the head
    if (Math.abs(x + 0.5 - bx) < 0.6) return j > h - 2 ? "l" : "m";
  }
  return null;
}, false);
const knoll = paint(KX - KRX, KY - KRY - 2, 2 * KRX, KRY + 8, (x, y) => {
  const Y = y + 0.5;
  const top = knollTop(x) + (grain(x >> 1, 0, 3) < 0.3 ? 1 : 0);
  if (Y < top || Y > KY + 6) return null;
  const X = x + 0.5 - KX;
  // The burrow: a dark hole with an earthen rim.
  const hd = Math.hypot((x + 0.5 - HOLE[0]) / 11, (Y - HOLE[1]) / 9);
  if (hd < 0.78) return Y < HOLE[1] - 4 ? "x" : hd < 0.6 ? "x" : "F";
  if (hd < 1) return Y < HOLE[1] ? "G" : "F";
  // The path: from the burrow down to the front, curving left.
  const pathX = HOLE[0] - (Y - HOLE[1] - 8) * 0.9 - 4 * Math.sin((Y - HOLE[1]) * 0.12);
  if (Y > HOLE[1] + 6 && Math.abs(x + 0.5 - pathX) < 4 + (Y - HOLE[1]) * 0.12) return grain(x, y, 6) < 0.25 ? "H" : "I";
  // Grass: lit from the top left, a little grain; clover leaves here and there.
  const l = 0.6 - 0.45 * (X / KRX) - 0.4 * ((Y - (KY - KRY)) / KRY) + (grain(x, y, 4) - 0.5) * 0.35;
  return l > 0.65 ? "e" : l > 0.4 ? "d" : l > 0.15 ? "c" : "b";
});
const STONES: readonly [number, number, number][] = [
  [52, 74, 6],
  [44, 82, 5],
  [60, 86, 4],
];
const stones = STONES.map(([cx, cy, r]) =>
  paint(cx - r - 1, cy - r, 2 * r + 3, r + 2, (x, y) => {
    const dx = (x + 0.5 - cx) / (r + 1);
    const dy = (y + 0.5 - cy) / (r * 0.6);
    if (dx * dx + dy * dy > 1) return null;
    return dx + dy < -0.5 ? "T" : dx + dy < 0.5 ? "S" : "s";
  }),
);
/** A clover: three round leaves. */
const clover = (cx: number, cy: number) =>
  paint(cx - 3, cy - 3, 7, 6, (x, y) => {
    const leaf = Math.hypot(x + 0.5 - (cx - 1), y + 0.5 - cy) < 1.7 || Math.hypot(x + 0.5 - (cx + 2), y + 0.5 - cy) < 1.7 || Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - (cy - 2.2)) < 1.7;
    return leaf ? (y < cy - 1 ? "c" : "b") : null;
  });
const clovers = [clover(34, 90), clover(110, 86), clover(70, 66), clover(122, 94), clover(102, 60)];
const FLOWERS: readonly [number, number, string][] = [
  [40, 70, "p"],
  [66, 76, "w"],
  [110, 74, "Y"],
  [118, 82, "p"],
  [28, 84, "w"],
  [76, 92, "Y"],
];
const flowers = FLOWERS.map(([x, y, k]) => flower(x, y, k, k === "Y" ? "R" : "Y"));
/** A carrot's top: feathery leaves on a stub of orange. */
const CARROT: Pt = [120, 86];
const carrot = paint(CARROT[0] - 4, CARROT[1] - 9, 9, 11, (x, y) => {
  const j = CARROT[1] - y;
  const X = x + 0.5 - CARROT[0];
  if (j < 2) return Math.abs(X) < 2.2 ? (X < 0 ? "R" : "K") : null; // the shoulder of the carrot
  for (const lean of [-0.4, 0, 0.45]) if (Math.abs(X - lean * j) < 0.8 && j < (lean === 0 ? 9 : 7)) return lean < 0 ? "d" : "c";
  return null;
});

// ---- The low edge of log posts at its front, and the sign on it; the shadow.

const logs = paint(14, 96, 116, 18, (x, y) => {
  const i = x - 14;
  const post = Math.floor(i / 9);
  const h = 12 + ((post * 5) % 4); // posts of slightly different heights
  const j = FOOT - 1 - y;
  if (j < 0 || j > h) return null;
  if (i % 9 === 8) return null; // a gap between posts
  if (j > h - 1.5) return "Q"; // its cut top
  return i % 9 < 2 ? "N" : i % 9 > 6 ? "L" : "M";
});
const logTops = [logEnd(17, 99, 3, "LQN"), logEnd(125, 99, 3, "LQN")];
const shadow = groundShadow(KX, FOOT - 1.5, 64, 4.5);

const BOARD: Pt = [CX - 34, 88];
const BW = 70;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, "LMNQ", "ABC", "O");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("tall", tall),
  add("knoll", knoll),
  ...stones.map((p, i) => add(`stone${i}`, p)),
  ...clovers.map((p, i) => add(`clover${i}`, p)),
  ...flowers.map((p, i) => add(`flower${i}`, p)),
  "carrot",
  add("logs", logs),
  ...logTops.map((p, i) => add(`logTop${i}`, p)),
  add("board", board),
];
parts.carrot = carrot.part;
at.carrot = carrot.at;

/** The carrot's top wiggles (its leaves ripple); the tall grass behind sways a pixel. */
const frames: Frame[] = [0, 1, 2, 3].map((f) => ({
  ms: 260,
  layers: order.map((part): Layer => {
    const [x, y] = at[part]!;
    if (part === "carrot") return { part, x, y, wave: { along: "rows", amp: 1, len: 10, phase: (f * Math.PI) / 2, pin: "bottom" } };
    if (part === "tall") return { part, x: x + (f === 1 ? 1 : f === 3 ? -1 : 0), y };
    return { part, x, y };
  }),
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_HOPPER: Character = {
  id: "house-hopper",
  name: "Chub & Chirp's Grassland",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Chub & Chirp's Grassland" on. */
export const HOUSE_HOPPER_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
