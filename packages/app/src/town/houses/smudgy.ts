/**
 * Smudgy's Art Gallery: the chameleon painter's home on the town square (Eric's suggestion,
 * docs/mockups/town-square/smudgy-gallery.webp). A little stone gallery under a paint-splattered purple awning hung with
 * bunting; framed paintings in its two windows, a wooden door between them under a lamp; vines and flowers over its top
 * with its blank sign board among them (the game writes "Smudgy's Art Gallery" there); easels with canvases out front,
 * paint pots and brushes, splats of paint on the ground. His colors (characters/smudgy.ts). `idle`: a drip of paint runs
 * from the awning.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { SMUDGY_PALETTE } from "../../characters/smudgy.ts";
import { flower, grain, groundShadow, paint, signBoard, signFace, type Pt } from "./kit.ts";

const S_ = SMUDGY_PALETTE;
const PALETTE: Record<string, string> = {
  k: S_.k!, // outline
  a: S_.a!, // greens (his own, for the vines): dark, mid, light
  b: S_.b!,
  c: S_.c!,
  p: S_.p!, // orange: dark, mid
  q: S_.q!,
  r: S_.r!,
  t: S_.t!, // teal: dark, mid, light
  u: S_.u!,
  v: S_.v!,
  V: "#7d3fa8", // the awning's purple: mid, dark, light
  W: "#4e2470",
  X: "#a76bd0",
  Y: S_.Y!, // gold, its shade
  O: S_.O!,
  e: "#e2343b", // paint: red, blue, yellow (with gold), white
  f: "#2f63cc",
  w: "#ffffff",
  s: "#b8aa94", // stone: dark, mid, light, lightest
  S: "#d2c5ac",
  T: "#e6dcc6",
  U: "#f4ecda",
  L: S_.L!, // wood: dark to light
  M: S_.M!,
  N: S_.N!,
  Q: S_.Q!,
  h: "#ffd890", // the lamp's glow
  m: "#9fd8ff", // a painted sky: light, mid; a painted hill
  n: "#5ea8e8",
  g: "#62b04a",
  i: "#f0a0b8", // flowers: pink, white
  j: "#ffe0ec",
  A: "#c9a56a", // the sign's face: shadow, board, light
  B: "#e8cc95",
  C: "#f7e4b8",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "LMNQ";

const W = 144;
const H = 124;
const CX = 72;
const FOOT = 118;
/** The gallery: its walls' sides, top and base. */
const GL = 28;
const GR = 116;
const TOP = 46;
const BASE = 110;

// ---- The walls: stone blocks in courses, lit from the left, a step at the door.

const walls = paint(GL, TOP, GR - GL, BASE - TOP, (x, y) => {
  const j = y - TOP;
  const course = Math.floor(j / 6);
  const off = course % 2 ? 4 : 0;
  if (j % 6 === 5 || (x - GL + off) % 11 === 0) return "s"; // mortar
  const l = 0.6 - 0.5 * ((x + 0.5 - CX) / 44) + (grain(Math.floor((x - GL + off) / 11), course, 4) - 0.5) * 0.4;
  return l > 0.75 ? "U" : l > 0.45 ? "T" : "S";
});

// ---- The door, the lamp over it, and two windows with paintings in them.

const door = paint(CX - 9, 76, 18, BASE - 76, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - 76;
  const half = j < 9 ? Math.sqrt(Math.max(0, 81 - (9 - j) ** 2)) : 9;
  if (Math.abs(X) > half) return null;
  if (Math.abs(X) > half - 1.5) return "L"; // its frame
  if (j > 9 && j < 13 && Math.abs(X) < 6) return "h"; // a little lit window in it
  if (Math.abs(X - 4) < 1 && Math.abs(j - 20) < 1) return "Y"; // the knob
  return Math.round(X) % 4 === 0 ? "M" : "N";
});
const lamp = paint(CX + 11, 70, 6, 9, (x, y) => (y === 70 ? (x === CX + 13 ? "L" : null) : y === 71 || y === 78 ? "L" : x === CX + 11 || x === CX + 16 ? "L" : "h"));
/** A window: a wooden frame, a painting inside (a sky over a hill, or a big flower). */
function frameWindow(x0: number, y0: number, w: number, h: number, art: "hills" | "flower") {
  return paint(x0, y0, w, h, (x, y) => {
    const i = x - x0;
    const j = y - y0;
    if (i < 2 || j < 2 || i > w - 3 || j > h - 3) return i === 0 || j === 0 ? "Q" : "N"; // the frame
    if (i < 3 || j < 3 || i > w - 4 || j > h - 4) return "Y"; // the painting's gilt edge
    if (art === "hills") {
      const hill = h - 7 - 3 * Math.sin((i / w) * Math.PI * 1.3);
      if (j > hill) return j > h - 6 ? "a" : "g";
      return Math.hypot(i - w * 0.7, j - 6) < 2.5 ? "Y" : j < h * 0.35 ? "n" : "m";
    }
    const cx = w / 2;
    const cy = h / 2 - 1;
    const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
    if (j > cy + 3 && Math.abs(i + 0.5 - cx) < 1) return "b"; // the stem
    if (d < 2) return "Y";
    if (d < 5 && Math.floor(((Math.atan2(j + 0.5 - cy, i + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * 6) % 2 === 0) return "e";
    return d < 5 ? "i" : "U";
  });
}
const winL = frameWindow(36, 74, 22, 20, "hills");
const winR = frameWindow(86, 74, 22, 20, "flower");

// ---- The awning: purple, scalloped, splattered with paint, bunting under it; vines and flowers over the top.

const awning = paint(GL - 6, 56, GR - GL + 12, 18, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - 56;
  const n = 9;
  const t = ((X + 50) / 100) * n;
  const s = t - Math.floor(t);
  if (j > 9 + 3 * Math.sin(Math.PI * s)) return null;
  if (Math.abs(X) > 50) return null;
  const splat = grain(Math.floor(x / 2), Math.floor(y / 2), 13);
  if (splat < 0.07) return "Y";
  if (splat < 0.11) return "e";
  if (splat < 0.14) return "v";
  return j < 2 ? "X" : X > 30 || j > 8 ? "W" : "V";
});
const bunting = paint(GL, 66, GR - GL, 8, (x, y) => {
  const i = x - GL;
  const j = y - 66;
  const f = Math.floor(i / 8);
  const cx = f * 8 + 4;
  if (Math.abs(i + 0.5 - cx) > 3 - j * 0.6 || j > 5) return null;
  return ["e", "Y", "u", "q", "f"][f % 5]!;
});
const vines = paint(GL - 10, 20, GR - GL + 20, 32, (x, y) => {
  // Leafy clumps over the two corners, and a low hedge of leaves along the roofline under the sign.
  const clump = (cx: number, cy: number, r: number) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15) < r + (grain(x >> 1, y >> 1, 9) - 0.5) * 3;
  const inside = clump(GL + 2, 38, 12) || clump(GL - 4, 44, 8) || clump(GR - 2, 38, 12) || clump(GR + 4, 44, 8) || (y >= 44 && y < 48 && x > GL && x < GR);
  if (!inside) return null;
  const g = grain(x, y, 5);
  return g < 0.3 ? "a" : g < 0.75 ? "b" : "c";
});
const FLOWERS: readonly [number, number, string][] = [
  [26, 36, "i"],
  [34, 44, "w"],
  [112, 38, "i"],
  [120, 44, "Y"],
  [30, 48, "Y"],
  [108, 46, "j"],
  [116, 30, "w"],
  [22, 30, "j"],
];
const flowers = FLOWERS.map(([x, y, p]) => flower(x, y, p, p === "Y" ? "q" : "Y"));
/** Vines trailing down the corners. */
const trail = paint(GL - 4, 46, GR - GL + 8, 40, (x, y) => {
  const i = x - (GL - 4);
  const j = y - 46;
  const left = i < 6 && Math.abs(i - 3 - Math.sin(j * 0.4)) < 1.4 && j < 30;
  const right = i > GR - GL + 2 && Math.abs(i - (GR - GL + 5) + Math.sin(j * 0.4)) < 1.4 && j < 36;
  return left || right ? (j % 5 === 0 ? "c" : "b") : null;
});

// ---- Out front: two easels with canvases, paint pots with brushes, splats on the ground; the shadow.

function easel(x0: number, foot: number, art: "sunset" | "tree") {
  return paint(x0, foot - 34, 22, 34, (x, y) => {
    const i = x - x0;
    const j = foot - (y + 0.5); // height above the ground
    // The canvas, resting on the easel's ledge.
    if (j > 14 && j < 32 && i > 2 && i < 19) {
      const ci = i - 3;
      const cj = 31 - j;
      if (ci === 0 || cj === 0 || ci === 15 || cj === 16) return "U";
      if (art === "sunset") return cj > 11 ? "a" : Math.hypot(ci - 8, cj - 11) < 4 ? "Y" : cj < 5 ? "V" : "q";
      return Math.hypot(ci - 8, cj - 6) < 5 ? "b" : Math.abs(ci - 8) < 1 && cj > 9 ? "N" : cj > 13 ? "g" : "m";
    }
    if (Math.abs(j - 14) < 1 && i > 1 && i < 20) return "M"; // the ledge
    // Three legs: two spread at the front, one behind.
    const legL = Math.abs(i - (4 + j * 0.12)) < 0.8;
    const legR = Math.abs(i - (17 - j * 0.12)) < 0.8;
    const legM = Math.abs(i - 11) < 0.7 && j > 30;
    return legL || legR || legM ? "N" : null;
  });
}
const easelL = easel(4, FOOT - 2, "sunset");
const easelR = easel(118, FOOT - 2, "tree");
const pot = (x0: number, foot: number, paintKey: string, brush: boolean) =>
  paint(x0, foot - 14, 9, 14, (x, y) => {
    const i = x - x0;
    const j = foot - y;
    if (brush && j > 7 && Math.abs(i - 5 + (j - 7) * 0.3) < 0.7) return j > 12 ? paintKey : "N"; // a brush standing in it
    if (j > 7 || j < 1) return null;
    if (j === 7) return paintKey; // the paint in it
    return i < 3 ? "T" : i < 6 ? "S" : "s";
  });
const pots = [pot(44, FOOT - 2, "e", true), pot(54, FOOT - 1, "f", false), pot(92, FOOT - 1, "Y", true)];
const splats = paint(20, FOOT - 8, 104, 9, (x, y) => {
  for (const [cx, cy, k] of [
    [36, FOOT - 3, "e"],
    [70, FOOT - 2, "f"],
    [84, FOOT - 4, "Y"],
    [104, FOOT - 3, "v"],
  ] as const) {
    const d = Math.hypot((x + 0.5 - cx) / 1.8, y + 0.5 - cy);
    if (d < 2.2 + grain(x, y, 3) * 1.2) return k;
  }
  return null;
}, false);
const step = paint(CX - 12, BASE, 24, 4, (x, y) => (y === BASE ? "U" : "S"));
const shadow = groundShadow(CX, FOOT - 1.5, 66, 4.5);

// ---- The sign among the vines on its top: blank; the game writes "Smudgy's Art Gallery" on it.

const BOARD: Pt = [CX - 34, 24];
const BW = 68;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "ABC", "Y");

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  add("splats", splats),
  add("walls", walls),
  add("step", step),
  add("door", door),
  add("lamp", lamp),
  add("winL", winL),
  add("winR", winR),
  add("trail", trail),
  add("awning", awning),
  add("bunting", bunting),
  add("vines", vines),
  ...flowers.map((p, i) => add(`flower${i}`, p)),
  add("board", board),
  add("easelL", easelL),
  add("easelR", easelR),
  ...pots.map((p, i) => add(`pot${i}`, p)),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** A drip of red paint runs from the awning's edge down the stone, a pixel or two a frame, then starts again. */
const DRIP_X = 46;
const frames: Frame[] = [0, 1, 2, 3, 4].map((f) => {
  const specks: Speck[] = [];
  for (let d = 0; d <= f * 2; d++) specks.push([DRIP_X, 68 + d, "e"]);
  return { ms: f === 4 ? 500 : 220, layers, specks };
});

const idle: Anim = { loop: true, frames };

export const HOUSE_SMUDGY: Character = {
  id: "house-smudgy",
  name: "Smudgy's Art Gallery",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Smudgy's Art Gallery" on. */
export const HOUSE_SMUDGY_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
