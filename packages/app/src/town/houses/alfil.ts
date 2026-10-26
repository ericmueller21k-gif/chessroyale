/**
 * Alfil's Pyramid: the old elephant's home on the town square (Eric's idea, "I'll let you design Alfil's pyramid"; no
 * picture). An ancient stepped pyramid of sandstone blocks, lit from the left, a gold capstone at its top; a dark doorway
 * at its foot under a stone lintel, a carved elephant in a panel over it; cloth banners in his colors (the red, blue and
 * gold of his Nettipattam and caparison) hung on poles at its sides; a few fallen blocks and sand drifted at its foot;
 * a blank sign board on two posts in front (the game writes "Alfil's Pyramid" on it). Stately and old, not spooky. His
 * colors (characters/alfil.ts). `idle`: the banners stir and the capstone glints.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { ALFIL_PALETTE } from "../../characters/alfil.ts";
import { grain, groundShadow, paint, signBoard, signFace, signPost, type Pt } from "./kit.ts";

const A_ = ALFIL_PALETTE;
const PALETTE: Record<string, string> = {
  k: A_.k!, // outline
  R: A_.R!, // his red, its shade
  r: A_.r!,
  B: A_.B!, // his blue, its shade
  N: A_.N!,
  Y: A_.Y!, // gold: mid, light, shade
  y: A_.y!,
  O: A_.O!,
  v: "#ffffff", // a glint
  a: "#f0d6a0", // sandstone: lightest to darkest
  b: "#e0bd80",
  c: "#c99e62",
  d: "#a87e48",
  e: "#7d5c33",
  x: "#1e140c", // the doorway's dark, and less dark
  X: "#3a2818",
  W: "#5a3a1e", // wood: dark to light (the poles, the posts)
  w: "#86592c",
  V: "#b07a40",
  U: "#d4a466",
  s: "#c9a56a", // the sign's face: shadow, board, light
  t: "#e8cc95",
  u: "#f7e4b8",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "WwVU";

const W = 144;
const H = 124;
const CX = 72;
const FOOT = 118;
/** The pyramid: its base, and its tiers (each TIER tall, stepping in STEP a side). */
const BASE = 112;
const TIERS = 6;
const TIER = 14;
const STEP = 9;
const HALF = 58;
const TOP = BASE - TIERS * TIER;

// ---- The pyramid: tiers of blocks, each with a lit ledge on top; shaded toward the right.

const pyramid = paint(CX - HALF, TOP, 2 * HALF, BASE - TOP, (x, y) => {
  const X = x + 0.5 - CX;
  const j = BASE - 1 - y; // height above the base
  const tier = Math.floor(j / TIER);
  const half = HALF - tier * STEP;
  if (Math.abs(X) > half) return null;
  const r = TIER - 1 - (j % TIER); // depth into the tier from its top
  if (r < 2) return X < half * 0.4 ? "a" : "b"; // the ledge, catching the light
  // Blocks: courses of 6, joints staggered; mortar a shade darker.
  const course = Math.floor((r - 2) / 6);
  const joint = (x + course * 7 + tier * 3) % 13 === 0 || (r - 2) % 6 === 5;
  const l = 0.62 - 0.55 * (X / HALF) + (grain(Math.floor((x + course * 7) / 13), tier * 3 + course, 6) - 0.5) * 0.3 - (r < 4 ? 0.2 : 0);
  const k = l > 0.75 ? "b" : l > 0.45 ? "c" : l > 0.2 ? "d" : "e";
  return joint ? (k === "b" ? "c" : k === "c" ? "d" : "e") : k;
});
/** The gold capstone on the top tier. */
const capstone = paint(CX - 9, TOP - 12, 18, 13, (x, y) => {
  const X = x + 0.5 - CX;
  const j = TOP - y; // height above the top tier
  if (Math.abs(X) > 9 * (1 - j / 12)) return null;
  return X < -2 ? "y" : X < 3 ? "Y" : "O";
});

// ---- The doorway, its lintel, and the carved elephant over it.

const DOOR_TOP = 86;
const door = paint(CX - 12, DOOR_TOP - 4, 24, BASE - DOOR_TOP + 4, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - DOOR_TOP;
  if (j < 0) return Math.abs(X) < 12 ? (j < -2 ? "b" : "d") : null; // the lintel
  const half = 9 + j * 0.08; // a little wider at the bottom
  if (Math.abs(X) > half) return null;
  return Math.abs(X) > half - 2 || j < 3 ? "X" : "x";
});
const carving = paint(CX - 14, 64, 28, 18, (x, y) => {
  const i = x - (CX - 14);
  const j = y - 64;
  if (i === 0 || j === 0 || i === 27 || j === 17) return "d"; // the panel's edge
  // An elephant in profile, facing left: body, head, ear, trunk, tusk, legs.
  const body = ((i - 16) / 8) ** 2 + ((j - 8) / 4.5) ** 2 < 1;
  const head = Math.hypot(i - 8, j - 6) < 4;
  const ear = ((i - 10.5) / 2.2) ** 2 + ((j - 7) / 3.2) ** 2 < 1;
  const trunk = (i >= 4 && i <= 6 && j >= 7 && j <= 14) || (i >= 3 && i <= 4 && j >= 13 && j <= 15);
  const legs = j >= 11 && j <= 15 && [12, 15, 19, 22].some((lx) => i >= lx && i <= lx + 1);
  const tail = i === 25 && j >= 8 && j <= 10;
  if (Math.abs(i - 6) < 1.2 && j === 10) return "a"; // the tusk, light
  if (ear) return "e";
  if (body || head || trunk || legs || tail) return "d";
  return "b";
});

// ---- Banners on poles at its sides: his red, blue and gold.

/** A banner: `main` with a border of `trim`, gold fringe at its foot, a gold disc on it. */
function banner(main: string, shade: string, trim: string) {
  const w = 12;
  const h = 32;
  const grid: string[] = [];
  for (let j = 0; j < h; j++) {
    let row = "";
    for (let i = 0; i < w; i++) {
      // Its foot cut in a point; a fringe of gold below the cloth.
      const pointDepth = Math.abs(i - (w - 1) / 2) * 0.5;
      if (j > h - 4 - pointDepth) row += j > h - 2 - pointDepth ? "." : "Y";
      else if (i < 2 || i > w - 3) row += trim;
      else if (Math.hypot(i - (w - 1) / 2, j - 11) < 3) row += j < 11 ? "y" : "Y";
      else row += i > w - 5 ? shade : main;
    }
    grid.push(row);
  }
  return { grid };
}
const pole = (px: number) => paint(px, 40, 2, FOOT - 2 - 40, (x, y) => (y < 43 ? "Y" : x === px ? "V" : "w"));
const bar = (px: number) => paint(px - 1, 44, 16, 2, (_, y) => (y === 44 ? "V" : "W"));

// ---- Fallen blocks and sand at its foot; the shadow.

const block = (x0: number, y0: number, w: number, h: number) =>
  paint(x0, y0 - 3, w + 3, h + 3, (x, y) => {
    const i = x - x0;
    const j = y - (y0 - 3);
    if (j < 3) return i >= 3 - j && i < w + 3 - j ? "a" : null;
    if (i >= w) return i - w < 3 && j - 3 < h - (i - w) ? "d" : null;
    return (x + y) % 9 === 0 ? "c" : "b";
  });
const blocks = [block(104, 110, 14, 8), block(118, 113, 10, 6), block(12, 113, 9, 6)];
const sand = paint(4, BASE - 4, W - 8, FOOT - BASE + 4, (x, y) => {
  const X = x + 0.5 - CX;
  const top = BASE - 1 - 2.5 * Math.abs(Math.sin(X * 0.09)) + Math.abs(X) * 0.03;
  if (y + 0.5 < top || Math.abs(X) > 66 - (y - BASE) * 0.6) return null;
  return grain(x, y, 2) < 0.2 ? "c" : "b";
}, false);
const shadow = groundShadow(CX, FOOT - 1.5, 68, 4.5);

// ---- The sign on two posts at its front left: blank; the game writes "Alfil's Pyramid" on it.

const BOARD: Pt = [8, 90];
const BW = 50;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "stu", "Y");
const posts = [signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, WOOD), signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, WOOD)];

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
parts.bannerL = banner("R", "r", "B");
parts.bannerR = banner("B", "N", "R");
const before = [add("shadow", shadow), add("pyramid", pyramid), add("capstone", capstone), add("door", door), add("carving", carving), add("sand", sand), add("poleL", pole(18)), add("poleR", pole(124)), add("barL", bar(18)), add("barR", bar(112))];
const after = [...blocks.map((p, i) => add(`block${i}`, p)), add("postL", posts[0]!), add("postR", posts[1]!), add("board", board)];
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

/** The banners stir (their feet ripple, their tops held on the bar); once round, the capstone catches the light. */
const glint = (x: number, y: number): Speck[] => [
  [x, y, "v"],
  [x - 1, y, "y"],
  [x + 1, y, "y"],
  [x, y - 1, "y"],
  [x, y + 1, "y"],
];
const frames: Frame[] = [0, 1, 2, 3].map((f) => {
  const wave = (p: number) => ({ along: "rows" as const, amp: 1.2, len: 26, phase: p, pin: "top" as const });
  return {
    ms: 280,
    layers: [...before.map(L), { part: "bannerL", x: 18, y: 46, wave: wave((f * Math.PI) / 2) }, { part: "bannerR", x: 112, y: 46, wave: wave((f * Math.PI) / 2 + 1.4) }, ...after.map(L)],
    ...(f === 2 ? { specks: glint(CX - 3, TOP - 6) } : {}),
  };
});

const idle: Anim = { loop: true, frames };

export const HOUSE_ALFIL: Character = {
  id: "house-alfil",
  name: "Alfil's Pyramid",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Alfil's Pyramid" on. */
export const HOUSE_ALFIL_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
