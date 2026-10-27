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
import { grain, groundShadow, paint, signBoard, signFace, signPost, TORCH, type LightPool, type LightSpot, type Pt } from "./kit.ts";

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

/**
 * The pyramid is drawn half again as big as the other homes' buildings (slice 3 review: at the tent's size Alfil dwarfed
 * it): a monument standing behind him, as Hollow Peak stands taller. Its foot spills a little past its 3 x 3 plot at the
 * sides, but only its lowest tier, half a square tall.
 */
const W = 208;
const H = 160;
const CX = 104;
const FOOT = 154;
/** The pyramid: its base, and its tiers (each TIER tall, stepping in STEP a side). */
const BASE = 148;
const TIERS = 6;
const TIER = 21;
const STEP = 13;
const HALF = 86;
const TOP = BASE - TIERS * TIER;
/** Each tier's lit ledge, and the courses of blocks under it. */
const LEDGE = 3;
const COURSE = 6;

// ---- The pyramid: tiers of blocks, each with a lit ledge on top; shaded toward the right; a carved band on the top tier.

const pyramid = paint(CX - HALF, TOP, 2 * HALF, BASE - TOP, (x, y) => {
  const X = x + 0.5 - CX;
  const j = BASE - 1 - y; // height above the base
  const tier = Math.floor(j / TIER);
  const half = HALF - tier * STEP;
  if (Math.abs(X) > half) return null;
  const r = TIER - 1 - (j % TIER); // depth into the tier from its top
  if (r < LEDGE) return r === LEDGE - 1 ? (X < half * 0.4 ? "b" : "c") : X < half * 0.4 ? "a" : "b"; // the ledge, catching the light
  // The tier's right end turns away from the light: a darker face, a pixel wide per course.
  const turn = half - Math.abs(X) < 2;
  // Blocks: courses, joints staggered; mortar a shade darker; a worn block here and there.
  const course = Math.floor((r - LEDGE) / COURSE);
  const joint = (x + course * 7 + tier * 3) % 13 === 0 || (r - LEDGE) % COURSE === COURSE - 1;
  const g = grain(Math.floor((x + course * 7) / 13), tier * 5 + course, 6);
  const l = 0.62 - 0.55 * (X / HALF) + (g - 0.5) * 0.3 - (r < LEDGE + 2 ? 0.2 : 0) - (turn ? 0.25 : 0);
  // Glyphs carved in a band along the top tier: little marks of a darker stone.
  if (tier === TIERS - 1 && r >= LEDGE + 4 && r <= LEDGE + 9 && Math.abs(X) < half - 4) {
    const gx = ((x - (CX - half)) % 7 + 7) % 7;
    const mark = grain(Math.floor((x - CX) / 7), 9, 3);
    const gy = r - LEDGE - 4;
    if (gx < 4 && (mark < 0.33 ? (gx === 1 || gy === 0 || gy === 5) : mark < 0.66 ? (gy === 2 || gx === 2) : Math.hypot(gx - 1.5, gy - 2.5) < 2 && Math.hypot(gx - 1.5, gy - 2.5) > 1)) return "e";
  }
  const k = l > 0.75 ? "b" : l > 0.45 ? "c" : l > 0.2 ? "d" : "e";
  if (g > 0.86 && !joint && (x + y) % 5 === 0) return k === "b" ? "c" : "d"; // a pit in a worn block
  return joint ? (k === "b" ? "c" : k === "c" ? "d" : "e") : k;
});
/** The gold capstone on the top tier, lit from the left, a line of shade down its right. */
const CAP_HALF = 14;
const CAP_H = 18;
const capstone = paint(CX - CAP_HALF, TOP - CAP_H, 2 * CAP_HALF, CAP_H + 1, (x, y) => {
  const X = x + 0.5 - CX;
  const j = TOP - y; // height above the top tier
  if (Math.abs(X) > CAP_HALF * (1 - j / CAP_H)) return null;
  if (j < 2) return "O"; // its foot in shadow
  return X < -4 ? "y" : X < 1 ? "Y" : X < 2 ? "O" : "Y";
});

// ---- The doorway, its lintel and steps, and the carved elephant over it.

const DOOR_TOP = BASE - 38;
const DOOR_HALF = 13;
const door = paint(CX - DOOR_HALF - 5, DOOR_TOP - 6, 2 * DOOR_HALF + 10, BASE - DOOR_TOP + 6, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - DOOR_TOP;
  if (j < 0) {
    // The lintel: a long stone, its face lit, gold studs along it.
    if (Math.abs(X) > DOOR_HALF + 5) return null;
    if (j < -4) return "a";
    return j === -1 ? "d" : Math.abs(X) % 6 < 1 && j === -3 ? "Y" : "b";
  }
  const half = DOOR_HALF + j * 0.08; // a little wider at the bottom
  if (Math.abs(X) > half + 3) return null;
  if (Math.abs(X) > half) return X < 0 ? "a" : "d"; // the jambs
  if (j > 30 && Math.abs(X) < half - 2 && ((j - 31) % 3 === 0)) return "d"; // the first of the steps going down inside
  return Math.abs(X) > half - 2 || j < 4 ? "X" : "x";
});
/** Two broad steps up to the doorway. */
const steps = paint(CX - DOOR_HALF - 9, BASE - 4, 2 * DOOR_HALF + 18, 7, (x, y) => {
  const X = x + 0.5 - CX;
  const j = y - (BASE - 4);
  const half = j < 3 ? DOOR_HALF + 5 : DOOR_HALF + 9;
  if (Math.abs(X) > half) return null;
  if (j === 0 || j === 3) return "a";
  return X > half - 3 ? "d" : "c";
});
const CARVE_W = 42;
const CARVE_H = 27;
const CARVE_Y = DOOR_TOP - 7 - CARVE_H - 3;
const carving = paint(CX - CARVE_W / 2, CARVE_Y, CARVE_W, CARVE_H, (x, y) => {
  const i0 = x - (CX - CARVE_W / 2);
  const j0 = y - CARVE_Y;
  if (i0 === 0 || j0 === 0) return "a"; // the panel's edge: lit on top and left, shaded on the others
  if (i0 === CARVE_W - 1 || j0 === CARVE_H - 1) return "e";
  if (i0 === 1 || j0 === 1 || i0 === CARVE_W - 2 || j0 === CARVE_H - 2) return "d";
  // An elephant in profile, facing left (drawn on an 28 x 18 plan, half again as big): body, head, ear, trunk, tusk, legs.
  const i = (i0 + 0.5) / 1.5 - 0.5;
  const j = (j0 + 0.5) / 1.5 - 0.5;
  const body = ((i - 16) / 8) ** 2 + ((j - 8) / 4.5) ** 2 < 1;
  const head = Math.hypot(i - 8, j - 6) < 4;
  const ear = ((i - 10.5) / 2.2) ** 2 + ((j - 7) / 3.2) ** 2 < 1;
  const trunk = (i >= 4 && i <= 6 && j >= 7 && j <= 14) || (i >= 2.6 && i <= 4.5 && j >= 13 && j <= 15);
  const legs = j >= 11 && j <= 15.3 && [12, 15, 19, 22].some((lx) => i >= lx && i <= lx + 1.4);
  const tail = i >= 24.6 && i <= 25.6 && j >= 8 && j <= 10.5;
  const blanket = body && i > 13 && i < 20 && j > 3.6 && j < 8; // his caparison, a gold edge
  if (Math.hypot(i - 9, j - 5) < 0.8) return "e"; // his eye
  if (i >= 5 && i <= 7 && Math.abs(j - 10.2) < 0.7) return "u"; // the tusk, light
  if (ear) return "e";
  if (blanket) return j > 7 ? "Y" : "R";
  if (body || head || trunk || legs || tail) return (i + j) % 7 < 1 ? "e" : "d";
  return j0 < 4 ? "a" : "b";
});

// ---- Banners on poles at its sides: his red, blue and gold.

const BAN_W = 15;
const BAN_H = 42;
/** A banner: `main` with a border of `trim`, gold fringe at its foot, a gold disc on it with his red at its heart. */
function banner(main: string, shade: string, trim: string) {
  const grid: string[] = [];
  for (let j = 0; j < BAN_H; j++) {
    let row = "";
    for (let i = 0; i < BAN_W; i++) {
      // Its foot cut in a point; a fringe of gold below the cloth.
      const pointDepth = Math.abs(i - (BAN_W - 1) / 2) * 0.55;
      const d = Math.hypot(i - (BAN_W - 1) / 2, j - 15);
      if (j > BAN_H - 5 - pointDepth) row += j > BAN_H - 2 - pointDepth ? "." : i % 2 ? "Y" : "O";
      else if (i < 2 || i > BAN_W - 3) row += j % 6 === 3 ? "Y" : trim;
      else if (j > 2 && j < 5) row += "Y"; // a gold band under the bar
      else if (d < 2) row += trim;
      else if (d < 4) row += j < 15 ? "y" : "Y";
      else if (d < 5) row += "O";
      else if (j > 24 && j < 27 && i > 3 && i < BAN_W - 4) row += "y"; // a second, thin band
      else row += i > BAN_W - 6 ? shade : main;
    }
    grid.push(row);
  }
  return { grid };
}
const POLE_TOP = 52;
const pole = (px: number) =>
  paint(px, POLE_TOP, 2, FOOT - 2 - POLE_TOP, (x, y) => (y < POLE_TOP + 4 ? (y === POLE_TOP ? "y" : "Y") : x === px ? "V" : "w"));
const bar = (px: number) => paint(px - 1, POLE_TOP + 5, BAN_W + 4, 2, (_, y) => (y === POLE_TOP + 5 ? "V" : "W"));
const POLE_L = CX - 80;
const POLE_R = CX + 78;

// ---- Fallen blocks and sand at its foot; the shadow.

const block = (x0: number, y0: number, w: number, h: number) =>
  paint(x0, y0 - 3, w + 3, h + 3, (x, y) => {
    const i = x - x0;
    const j = y - (y0 - 3);
    if (j < 3) return i >= 3 - j && i < w + 3 - j ? "a" : null;
    if (i >= w) return i - w < 3 && j - 3 < h - (i - w) ? "d" : null;
    return (x + y) % 9 === 0 ? "c" : "b";
  });
const blocks = [block(150, 146, 20, 11), block(172, 150, 14, 8), block(66, 149, 12, 7), block(188, 154, 8, 4)];
const sand = paint(4, BASE - 5, W - 8, FOOT - BASE + 5, (x, y) => {
  const X = x + 0.5 - CX;
  const top = BASE - 1 - 3 * Math.abs(Math.sin(X * 0.07)) + Math.abs(X) * 0.03;
  if (y + 0.5 < top || Math.abs(X) > 98 - (y - BASE) * 0.8) return null;
  const g = grain(x, y, 2);
  return g < 0.15 ? "c" : g > 0.93 ? "a" : "b";
}, false);
const shadow = groundShadow(CX, FOOT - 1.5, 96, 5);

// ---- The sign on two posts at its front left: blank; the game writes "Alfil's Pyramid" on it.

const BOARD: Pt = [10, 124];
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
const before = [add("shadow", shadow), add("pyramid", pyramid), add("capstone", capstone), add("door", door), add("carving", carving), add("sand", sand), add("steps", steps), add("poleL", pole(POLE_L)), add("poleR", pole(POLE_R)), add("barL", bar(POLE_L)), add("barR", bar(POLE_R - BAN_W - 2))];
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
  const wave = (p: number) => ({ along: "rows" as const, amp: 1.5, len: 34, phase: p, pin: "top" as const });
  return {
    ms: 280,
    layers: [...before.map(L), { part: "bannerL", x: POLE_L + 1, y: POLE_TOP + 7, wave: wave((f * Math.PI) / 2) }, { part: "bannerR", x: POLE_R - BAN_W - 1, y: POLE_TOP + 7, wave: wave((f * Math.PI) / 2 + 1.4) }, ...after.map(L)],
    ...(f === 2 ? { specks: glint(CX - 5, TOP - 9) } : {}),
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

/** Its lights at dusk and night (Oct 27): the doorway's dark glows as of torches inside, flickering, and a little of it falls on the steps. */
export const HOUSE_ALFIL_LIGHTS: readonly LightSpot[] = [{ x: CX - DOOR_HALF - 3, y: DOOR_TOP, w: 2 * DOOR_HALF + 7, h: BASE - DOOR_TOP, keys: "xX", color: TORCH, strength: 0.75, flicker: true }];
export const HOUSE_ALFIL_POOLS: readonly LightPool[] = [{ x: CX, y: FOOT - 3, rx: 22, ry: 5, color: TORCH, strength: 0.3 }];
