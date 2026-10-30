/**
 * Puddles' Botanical Garden: the hippo gardener's home on the town square (Eric's suggestion,
 * docs/mockups/town-square/gardener-botanical.webp). A wood-and-glass greenhouse under a glass gable, vines and flowers
 * over it, its blank sign board on the gable (the game writes "Puddles' Botanical Garden" there); an arched door open on
 * plants inside, a hanging basket of flowers, a bench of potted flowers on its left, a tiered stone fountain on its right.
 * His colors (characters/gardener.ts). `idle`: the fountain's water runs.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { GARDENER_PALETTE } from "../../characters/gardener.ts";
import { flower, grain, groundShadow, paint, signBoard, signFace, WARM, type LightPool, type LightSpot, type Pt } from "./kit.ts";

const G_ = GARDENER_PALETTE;
const PALETTE: Record<string, string> = {
  k: G_.k!, // outline
  "1": G_["1"]!, // water: deep to pale
  "2": G_["2"]!,
  "3": G_["3"]!,
  "4": G_["4"]!,
  E: G_.E!, // greens (his hose's): dark to light
  F: G_.F!,
  G: G_.G!,
  H: G_.H!,
  f: G_.f!, // pinks: dark to light
  g: G_.g!,
  h: G_.h!,
  w: G_.w!, // white
  L: G_.L!, // gold, its light
  M: G_.M!,
  N: "#5a3418", // wood: dark to light
  O: "#80512a",
  P: "#a8743e",
  Q: "#cfa066",
  q: "#cfe8e8", // glass: light, mid, its glare
  r: "#9cc8cc",
  t: "#f4fbfb",
  s: "#8e8a86", // stone: dark, mid, light
  S: "#b5b0a8",
  T: "#d8d2c8",
  c: "#b5562f", // terra cotta pots: mid, dark
  C: "#7e3518",
  "5": G_["5"]!, // earth
  "6": G_["6"]!,
  A: "#c9a56a", // the sign's face: shadow, board, light
  B: "#e8cc95",
  D: "#f7e4b8",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "NOPQ";

const W = 144;
const H = 124;
const CX = 70;
const FOOT = 118;
/** The greenhouse: its walls' sides, top and base; its gable's peak. */
const GL = 30;
const GR = 110;
const TOP = 46;
const BASE = 110;
const PEAK = 2;

// ---- The glass walls and gable: panes in a wooden frame, glare on the left; plants showing through.

const glass = (x: number, y: number, frame: boolean): string => {
  if (frame) return "O";
  const glare = (x - y * 0.7) % 23;
  if (glare > 0 && glare < 3) return "t";
  // Plants inside, low down, seen through the glass.
  if (y > 86 && grain(x >> 1, y >> 1, 8) < 0.55) return grain(x, y, 2) < 0.5 ? "F" : "G";
  return x + 0.5 < CX ? "q" : "r";
};
const walls = paint(GL, TOP, GR - GL, BASE - TOP, (x, y) => {
  const i = x - GL;
  const j = y - TOP;
  const frame = i < 2 || i > GR - GL - 3 || i % 14 < 2 || j % 16 < 2 || j > BASE - TOP - 4;
  if (j > BASE - TOP - 4) return j === BASE - TOP - 4 ? "P" : "N"; // a low wooden base
  return glass(x, y, frame);
});
const gable = paint(GL - 4, PEAK, GR - GL + 8, TOP - PEAK + 2, (x, y) => {
  const X = x + 0.5 - CX;
  const top = PEAK + Math.abs(X) * 0.75;
  if (y + 0.5 < top) return null;
  if (y + 0.5 < top + 2.5) return y + 0.5 < top + 1 ? "Q" : "P"; // the roof's wooden edge
  if (y >= TOP) return "P"; // the beam under it
  const frame = Math.abs(X) % 12 < 1.5;
  return glass(x, y, frame);
});

// ---- The door: an arch open on a leafy inside; the hanging basket; vines and flowers over it all.

const door = paint(CX - 12, 66, 24, BASE - 66, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - 66;
  const half = j < 12 ? Math.sqrt(Math.max(0, 144 - (12 - j) ** 2)) : 12;
  if (Math.abs(X) > half) return null;
  if (Math.abs(X) > half - 2) return "O"; // its wooden frame
  if (j > 36) return "T"; // the stone threshold
  const leaf = grain(x >> 1, y >> 1, 5);
  return leaf < 0.35 ? "F" : leaf < 0.6 ? "G" : leaf < 0.7 ? "g" : "E";
});
const basket = paint(40, 52, 14, 22, (x, y) => {
  if (x === 47 && y < 62) return "N"; // its chain
  const d = ((x + 0.5 - 47) / 6) ** 2 + ((y + 0.5 - 64) / 4) ** 2;
  if (y >= 64 && d <= 1) return y > 66 ? "N" : "O"; // the basket
  if (y < 64 && y >= 59 && Math.abs(x + 0.5 - 47) < 7 - (64 - y) * 0.4) return (x + y) % 3 === 0 ? "h" : (x * y) % 5 === 0 ? "w" : "G"; // its flowers
  if (y > 66 && y < 72 && (x === 42 || x === 51)) return "F"; // trailing leaves
  return null;
});
const vines = paint(GL - 10, PEAK - 4, GR - GL + 20, BASE - PEAK, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const along = Math.abs(Y - (PEAK + Math.abs(X) * 0.75) + 1) < 2.6 + grain(x >> 1, 1, 4) * 2; // along the roofline
  const corner = (Math.abs(x + 0.5 - GL) < 3.5 || Math.abs(x + 0.5 - GR) < 3.5) && Y > TOP - 4 && Y < TOP + 38 + 10 * grain(x, 0, 7);
  const tumble = Y > TOP - 4 && Y < TOP + 6 && Math.abs(X) > 20 && grain(x >> 1, y >> 1, 3) < 0.5;
  if (!along && !corner && !tumble) return null;
  if (Math.abs(X) > 50) return null;
  const g = grain(x, y, 11);
  if (g < 0.07) return "h";
  if (g < 0.11) return "L";
  if (g < 0.15) return "w";
  if (g < 0.17) return "g";
  return g < 0.45 ? "E" : g < 0.8 ? "F" : "G";
});

// ---- The bench of potted flowers on the left; the fountain on the right; the shadow.

const bench = paint(4, 92, 32, 22, (x, y) => {
  const j = y - 92;
  if (j >= 10 && j < 13) return j === 10 ? "Q" : "P"; // the seat
  if (j >= 13 && (x === 7 || x === 32)) return "O"; // its legs
  // Three pots on it, flowers in each.
  for (const [cx, k] of [
    [10, "g"],
    [20, "L"],
    [29, "h"],
  ] as const) {
    const X = x + 0.5 - cx;
    if (j >= 4 && j < 10 && Math.abs(X) < 3.5 - (j - 4) * 0.15) return j === 4 ? "c" : X > 1 ? "C" : "c";
    if (j < 4 && Math.abs(X) < 4 - j * 0.2 && grain(x, y, cx) < 0.75) return j < 2 && Math.abs(X) < 2 ? k : "G";
  }
  return null;
});
/** Flower boxes along the foot of the glass, either side of the door: wooden planters, flowers bunched in them. */
const boxes = paint(GL, BASE - 12, GR - GL, 13, (x, y) => {
  const X = x + 0.5 - CX;
  if (Math.abs(X) < 15) return null; // the door
  const j = y - (BASE - 12);
  if (j >= 7) return j === 7 ? "Q" : j === 12 ? "N" : (x - GL) % 9 === 0 ? "N" : "O"; // the box: planks, lit on top
  // Leaves and flowers above it.
  const g = grain(x, y, 21);
  const top = 2 + 3 * grain(x >> 1, 0, 22);
  if (j < top) return null;
  if (g < 0.16) return "h";
  if (g < 0.26) return "L";
  if (g < 0.32) return "w";
  if (g < 0.38) return "g";
  return g < 0.7 ? "F" : "G";
});
/** Stepping stones from the door out to the front. */
const path = paint(CX - 9, BASE, 18, FOOT - BASE + 1, (x, y) => {
  for (const [cx, cy] of [
    [CX - 2, BASE + 2],
    [CX + 2, BASE + 6],
  ] as const) {
    const dx = (x + 0.5 - cx) / 5;
    const dy = (y + 0.5 - cy) / 1.8;
    if (dx * dx + dy * dy <= 1) return dy < -0.2 ? "T" : dx > 0.4 ? "s" : "S";
  }
  return null;
});
const FX = 124;
const fountain = paint(FX - 17, 70, 34, FOOT - 70, (x, y) => {
  const X = x + 0.5 - FX;
  const j = y - 70;
  // The basin at the bottom, a pedestal, a bowl, a small top bowl; water in each.
  if (j >= 34) {
    if (Math.abs(X) > 16) return null;
    if (j < 37) return Math.abs(X) < 14 ? "2" : "S"; // water in the basin, its rim
    return X < -6 ? "T" : X < 6 ? "S" : "s";
  }
  if (j >= 18 && j < 21) return Math.abs(X) < 10 ? (Math.abs(X) < 8 ? "3" : "S") : null; // the bowl's water and rim
  if (j >= 21 && j < 24) return Math.abs(X) < 9 - (j - 21) * 1.5 ? (X < 0 ? "T" : "S") : null; // its underside
  if (j >= 6 && j < 9) return Math.abs(X) < 5 ? (Math.abs(X) < 3 ? "4" : "S") : null; // the top bowl
  if (Math.abs(X) < 2) return j < 6 ? (j < 3 ? "4" : "3") : X < 0 ? "T" : "s"; // the spout and the pedestal
  // Water falling from the bowls' edges.
  if ((Math.abs(Math.abs(X) - 10) < 1 && j > 21 && j < 34) || (Math.abs(Math.abs(X) - 5) < 1 && j > 9 && j < 18)) return "w3"[(j >> 1) % 2]!;
  return null;
});
const FLOWERS: readonly [number, number, string][] = [
  [26, 112, "h"],
  [40, 114, "L"],
  [100, 112, "g"],
  [110, 115, "w"],
];
const flowers = FLOWERS.map(([x, y, k]) => flower(x, y, k, k === "L" ? "f" : "L"));
const shadow = groundShadow(72, FOOT - 1.5, 68, 4.5);

// ---- The sign on the gable: blank; the game writes "Puddles' Botanical Garden" on it.

const BOARD: Pt = [CX - 35, 30];
const BW = 70;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "ABD", "L");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("walls", walls),
  add("gable", gable),
  add("door", door),
  add("vines", vines),
  add("basket", basket),
  add("boxes", boxes),
  add("path", path),
  add("board", board),
  add("bench", bench),
  add("fountain", fountain),
  ...flowers.map((p, i) => add(`flower${i}`, p)),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** The water runs: its light and mid blues trade places, frame by frame. */
const RUN: readonly Record<string, string>[] = [{}, { "3": G_["4"]!, "4": G_["3"]! }, { "2": G_["3"]!, "3": G_["2"]! }];
const frames: Frame[] = RUN.map((pal) => ({ ms: 200, layers, pal }));

const idle: Anim = { loop: true, frames };

export const HOUSE_GARDENER: Character = {
  id: "house-gardener",
  name: "Puddles' Botanical Garden",
  w: W,
  h: H,
  foot: [72, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Puddles' Botanical Garden" on. */
export const HOUSE_GARDENER_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

/** Its lights at dusk and night (Oct 27): the greenhouse glows through its glass (walls and gable, the plants behind it), and its open door's leafy inside. */
export const HOUSE_GARDENER_LIGHTS: readonly LightSpot[] = [
  { x: GL, y: TOP, w: GR - GL, h: BASE - TOP, keys: "qrtFG", color: WARM, strength: 0.45 },
  { x: GL - 4, y: PEAK, w: GR - GL + 8, h: TOP - PEAK, keys: "qrt", color: WARM, strength: 0.4 },
  { x: CX - 12, y: 66, w: 24, h: 37, keys: "FGgE", color: WARM, strength: 0.6 },
];
export const HOUSE_GARDENER_POOLS: readonly LightPool[] = [{ x: CX, y: FOOT - 2, rx: 16, ry: 4, color: WARM, strength: 0.25 }];
