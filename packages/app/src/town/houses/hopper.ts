/**
 * Chub & Chirp's Grassland: the rabbit and the grasshopper's home on the town square (Eric's suggestion,
 * docs/mockups/town-square/hopper-grassland.webp). A mossy knoll with a burrow's arch in it, a dirt path running down from
 * the burrow, grey boulders, big shamrocks, daisies and clover blossoms, tall grass and cattails standing behind, a carrot's top showing in
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
  p: P_.p!, // flowers: pink, its shade, white, gold
  q: P_.q!,
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

// ---- Tall grass and cattails behind: broad blades, lit on their left, fanning up from behind the knoll.

/** Blades: foot x, height, lean, width at the foot. */
const BLADES: readonly [number, number, number, number][] = [
  [16, 40, -0.5, 4],
  [24, 52, -0.2, 4],
  [30, 44, 0.25, 3],
  [38, 34, -0.35, 3],
  [56, 30, -0.3, 3],
  [62, 22, 0.35, 3],
  [98, 26, -0.25, 3],
  [104, 34, 0.3, 3],
  [114, 48, -0.25, 4],
  [120, 56, 0.1, 4],
  [128, 46, 0.4, 4],
  [134, 36, 0.6, 3],
];
const CATTAILS: readonly [number, number, number][] = [
  [44, 58, -0.08],
  [110, 62, 0.05],
  [125, 50, 0.12],
];
const BACK = 70; // where the blades and stems stand, behind the knoll
const tall = paint(4, 4, 138, BACK - 2, (x, y) => {
  const j = BACK - y; // height above their foot
  const X = x + 0.5;
  for (const [bx, h, lean] of CATTAILS) {
    if (j < 0 || j > h) continue;
    const cxj = bx + lean * j;
    if (j > h - 12 && j < h - 2 && Math.abs(X - cxj) < 2.1) return X < cxj - 0.5 ? "U" : "u"; // its head
    if (j >= h - 2 && Math.abs(X - cxj) < 0.6) return "m"; // its spike
    if (Math.abs(X - cxj) < 0.7) return j > h * 0.5 ? "m" : "l";
  }
  for (const [bx, h, lean, w] of BLADES) {
    if (j < 0 || j > h) continue;
    const c = bx + lean * j * (j / h) * 1.4; // curving out as it rises
    const half = (w / 2) * (1 - (j / h) ** 1.6) + 0.5;
    const d = X - c;
    if (Math.abs(d) < half) return d < -half * 0.1 ? (j > h * 0.6 ? "e" : "d") : j < h * 0.3 ? "b" : "c";
  }
  return null;
});

// ---- The knoll: mossy grass in little scallops, a fringe of blades along its top; the burrow's arch in its face.

/** The burrow: a round arch in the knoll's face, its sill on the ground of the path. */
const ARCH: Pt = [92, 79];
const ARCH_HW = 12;
const ARCH_H = 16;
const inArch = (X: number, Y: number, grow: number) => {
  const hw = ARCH_HW + grow;
  const top = ARCH[1] - ARCH_H - grow;
  if (Y > ARCH[1] + grow * 0.3 || Y < top) return false;
  const springs = top + hw; // where the round top meets the straight sides
  return Y >= springs ? Math.abs(X - ARCH[0]) < hw : Math.hypot(X - ARCH[0], Y - springs) < hw;
};
/** The dirt path: from the burrow's sill, down to the front, curving left. */
const pathMid = (Y: number) => ARCH[0] - (Y - ARCH[1]) * 1.6 - 2 * Math.sin((Y - ARCH[1]) * 0.35);
const onPath = (X: number, Y: number) => Y > ARCH[1] - 1 && Math.abs(X - pathMid(Y)) < 7 + (Y - ARCH[1]) * 0.45;

const knoll = paint(KX - KRX, KY - KRY - 4, 2 * KRX, KRY + 10, (x, y) => {
  const Y = y + 0.5;
  const X = x + 0.5;
  // Its top edge: blades of grass poking up out of it.
  const blade = (x % 3 === 0 ? 2 + Math.floor(grain(x, 0, 9) * 3) : 0) * (grain(x, 1, 5) < 0.7 ? 1 : 0);
  const top = knollTop(x);
  if (Y < top - blade || Y > KY + 6) return null;
  if (Y < top) return grain(x, 2, 4) < 0.5 ? "d" : "c";
  // The burrow: dark in its depth, a lit sill, a rim of earth round it.
  if (inArch(X, Y, 0)) {
    if (Y > ARCH[1] - 3) return Y > ARCH[1] - 1 ? "H" : "G"; // the sill: packed earth
    const deep = Math.abs(X - ARCH[0]) < ARCH_HW - 4 && Y > ARCH[1] - ARCH_H + 4;
    return deep ? "x" : grain(x, y, 3) < 0.3 ? "F" : "x";
  }
  if (inArch(X, Y, 3)) {
    // The earthen rim, and moss hanging over its top.
    if (Y < ARCH[1] - ARCH_H + 2 && grain(x, 0, 12) < 0.55) return Y < ARCH[1] - ARCH_H - 1 ? "e" : "d";
    return X < ARCH[0] - 4 ? "H" : X > ARCH[0] + 4 ? "F" : "G";
  }
  if (onPath(X, Y)) {
    // Packed earth, lighter in the middle; pebbles.
    const g = grain(x, y, 6);
    if (g > 0.94) return "S";
    return Math.abs(X - pathMid(Y)) < 3 + (Y - ARCH[1]) * 0.25 ? (g < 0.2 ? "H" : "I") : g < 0.3 ? "G" : "H";
  }
  // Grass in scallops (rows of little mounds, staggered), lit from the top left.
  const row = Math.floor(Y / 4);
  const sx = (X + (row % 2) * 3) / 6;
  const inS = sx - Math.floor(sx); // where in its scallop, 0 to 1 across
  const sy = Y / 4 - row; // and down
  const rim = sy > 0.72 - 0.5 * (inS - 0.5) ** 2 * 4 * 0.3;
  const l = 0.62 - 0.45 * ((X - KX) / KRX) - 0.45 * ((Y - (KY - KRY)) / KRY) + (grain(Math.floor(sx), row, 4) - 0.5) * 0.3 - (rim ? 0.22 : 0) + (sy < 0.3 && inS < 0.5 ? 0.12 : 0);
  return l > 0.66 ? "e" : l > 0.42 ? "d" : l > 0.18 ? "c" : l > -0.05 ? "b" : "a";
});

// ---- Grey boulders on its left, flat stones along the path.

const STONES: readonly [number, number, number, number][] = [
  [36, 78, 9, 6],
  [52, 72, 7, 5],
  [47, 84, 6, 4],
];
const stones = STONES.map(([cx, cy, rx, ry]) =>
  paint(cx - rx - 1, cy - ry - 1, 2 * rx + 3, 2 * ry + 2, (x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy > 1 || (dy > 0.55 && dx * dx + dy * dy > 0.8)) return null; // flat-bottomed
    if (Math.abs(dx - 0.15 + dy * 0.3) < 0.07 && dy > -0.4 && dy < 0.3) return "s"; // a crack
    return dx + dy < -0.55 ? "T" : dx + dy < 0.45 ? "S" : "s";
  }),
);
const FLAT: readonly [number, number][] = [[80, 85]];
const flats = FLAT.map(([cx, cy]) =>
  paint(cx - 5, cy - 2, 11, 5, (x, y) => {
    const dx = (x + 0.5 - cx) / 5;
    const dy = (y + 0.5 - cy) / 2.2;
    if (dx * dx + dy * dy > 1) return null;
    return dy < -0.2 ? "T" : dx > 0.4 ? "s" : "S";
  }),
);

// ---- Shamrocks, daisies and pink clover blossoms all about it, as in the picture.

/** A big shamrock: three round leaves round a dark heart, lit from the top left, veins down their middles. */
const shamrock = (cx: number, cy: number, r: number) =>
  paint(Math.floor(cx - 2.2 * r), Math.floor(cy - 2.2 * r), Math.ceil(4.4 * r) + 1, Math.ceil(4 * r) + 2, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5 - cy;
    for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
      // Each leaf: two lobes side by side, a heart's point at the middle.
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const along = X * ux + Y * uy;
      const across = -X * uy + Y * ux;
      if (along < 0.3) continue;
      const lobe = Math.min(Math.hypot(along - r * 1.15, across - r * 0.5), Math.hypot(along - r * 1.15, across + r * 0.5));
      const wedge = along < r * 1.2 && Math.abs(across) < along * 0.85;
      if (lobe > r * 0.62 && !wedge) continue;
      if (Math.abs(across) < 0.5 && along > r * 0.4 && along < r * 1.6) return "b"; // the vein
      return X + Y < -r * 0.6 ? "d" : X + Y < r * 0.9 ? "c" : "b";
    }
    if (Math.hypot(X, Y) < 0.9) return "a";
    if (Y > 0 && Y < r * 1.8 && Math.abs(X - Y * 0.15) < 0.6) return "b"; // its stem
    return null;
  });
const SHAMROCKS: readonly [number, number, number][] = [
  [12, 94, 4],
  [24, 102, 3.5],
  [8, 106, 3],
  [134, 94, 4],
  [124, 104, 3.5],
  [138, 106, 3],
  [30, 66, 3],
  [68, 60, 3],
  [114, 70, 3.5],
  [104, 96, 3],
];
const shamrocks = SHAMROCKS.map(([x, y, r]) => shamrock(x, y, r));
/** A daisy: white petals round a gold heart, five pixels across. */
const daisy = (cx: number, cy: number) =>
  paint(cx - 2, cy - 2, 5, 5, (x, y) => {
    const X = x - cx;
    const Y = y - cy;
    if (X === 0 && Y === 0) return "Y";
    if ((X === 0 || Y === 0) && Math.abs(X + Y) <= 2) return Math.abs(X + Y) === 2 && Y >= 0 && X >= 0 ? "T" : "w";
    if (Math.abs(X) === 1 && Math.abs(Y) === 1) return X > 0 && Y > 0 ? "T" : "w";
    return null;
  });
/** A pink clover blossom: a round head of tiny florets on a short stem. */
const blossom = (cx: number, cy: number) =>
  paint(cx - 3, cy - 3, 7, 9, (x, y) => {
    const X = x + 0.5 - cx;
    const Y = y + 0.5 - cy;
    if (Math.hypot(X, Y) < 2.8) return (x + y * 2) % 3 === 0 ? "q" : X + Y < -1 ? "w" : "p";
    if (Y > 2 && Math.abs(X) < 0.6) return "b";
    return null;
  });
const DAISIES: readonly Pt[] = [
  [24, 72],
  [62, 82],
  [112, 60],
  [16, 86],
  [128, 80],
  [70, 70],
];
const BLOSSOMS: readonly Pt[] = [
  [40, 92],
  [118, 92],
  [106, 64],
  [20, 78],
];
const daisies = DAISIES.map(([x, y]) => daisy(x, y));
const blossoms = BLOSSOMS.map(([x, y]) => blossom(x, y));
const FLOWERS: readonly [number, number, string][] = [
  [58, 66, "p"],
  [110, 80, "Y"],
  [30, 88, "w"],
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
/** Clumps of broad blades in front at its corners, over the logs' ends. */
const CLUMPS: readonly [number, number, number][] = [
  [6, 112, 16],
  [140, 112, 15],
  [32, 114, 10],
  [114, 114, 10],
];
const clumps = CLUMPS.map(([cx, foot, h]) =>
  paint(cx - 7, foot - h, 15, h, (x, y) => {
    const j = foot - (y + 0.5);
    const X = x + 0.5 - cx;
    for (const [lean, hh] of [
      [-0.55, 0.75],
      [-0.15, 1],
      [0.3, 0.9],
      [0.7, 0.6],
    ] as const) {
      const c = lean * j * 1.1;
      const half = 1.4 * (1 - j / (h * hh)) + 0.3;
      if (j < h * hh && Math.abs(X - c) < half) return X - c < 0 ? "d" : "c";
    }
    return null;
  }),
);

// ---- The low edge of log posts at its front, and the sign on it; the shadow.

const logs = paint(14, 96, 116, 18, (x, y) => {
  const i = x - 14;
  const post = Math.floor(i / 9);
  const h = 12 + ((post * 5) % 4); // posts of slightly different heights
  const j = FOOT - 1 - y;
  if (j < 0 || j > h) return null;
  if (i % 9 === 8) return null; // a gap between posts
  if (j > h - 1.5) return "Q"; // its cut top
  if (i % 9 === 4 && grain(post, j >> 2, 3) < 0.4) return "L"; // a crack in the bark
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
  ...flats.map((p, i) => add(`flat${i}`, p)),
  ...shamrocks.slice(6).map((p, i) => add(`shamrockBack${i}`, p)),
  ...daisies.map((p, i) => add(`daisy${i}`, p)),
  ...blossoms.map((p, i) => add(`blossom${i}`, p)),
  ...flowers.map((p, i) => add(`flower${i}`, p)),
  "carrot",
  add("logs", logs),
  ...logTops.map((p, i) => add(`logTop${i}`, p)),
  add("board", board),
  ...shamrocks.slice(0, 6).map((p, i) => add(`shamrock${i}`, p)),
  ...clumps.map((p, i) => add(`clump${i}`, p)),
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
