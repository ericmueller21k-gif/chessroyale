/**
 * Hollow Peak: the shaggy creature's home on the town square (Eric's reference, docs/mockups/town-square/hollow-peak.webp;
 * he's held together by darkness). A dark rocky peak, taller than the other homes, leaning a little and curling over at
 * its tip, streaked with snow; jagged spires down its right side; a narrow window lit a faint green high up; a doorway
 * of violet-black void at its foot; small dark pines with snow on them around it; and a blank sign board on two posts in
 * front (the game writes "Hollow Peak" on it). Calm and quiet: spooky, never gory. His colors (characters/hollow.ts).
 * Light from the top left, as the bosses'. `idle`: the window's faint green light breathes (four frames).
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { HOLLOW_PALETTE } from "../../characters/hollow.ts";
import { grain, groundShadow, paint, signBoard, signFace, signPost, type Pt } from "./kit.ts";

const P_ = HOLLOW_PALETTE;
const PALETTE: Record<string, string> = {
  k: P_.k!, // outline
  n: P_.n!, // the rock: deepest shadow, then charcoal dark to light
  d: P_.d!,
  c: P_.c!,
  C: P_.C!,
  h: P_.h!,
  v: P_.v!, // the darkness: violet-black to bright violet
  V: P_.V!,
  u: P_.u!,
  U: P_.U!,
  o: P_.o!, // the void's heart
  O: P_.O!,
  w: "#eef0f8", // snow: lit, shade, deep shade
  W: "#b4b8cc",
  X: "#7d8098",
  g: "#a8e07a", // the window's faint green: light, glow
  G: "#4f8f3a",
  e: "#22392f", // the pines: green-black, darker
  E: "#132219",
  N: "#2b2530", // the sign's weathered wood: dark to light
  R: "#4a414f",
  P: "#6b6070",
  Q: "#8d8292",
  S: "#9d93a6", // the sign's face: shadow, board, light
  T: "#c3b9c9",
  Z: "#ddd5e2",
  L: "#ffcf3a", // nails (his eyes' gold)
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const WOOD = "NRPQ";

const W = 144;
const H = 150;
const CX = 72;
const FOOT = 144;
/** The peak's body: from its base up to where the curl begins. */
const BASE = 139;
const TOP = 52;

/** The body's middle and half-width at height Y: wide at its foot, leaning a little right as it rises; rough edges. */
const bodyAt = (Y: number) => {
  const t = (BASE - Y) / (BASE - TOP);
  return { c: CX + 9 * Math.sin(Math.PI * t * 0.9), hw: 54 * Math.pow(1 - t, 1.1) + 5 + (grain(0, Math.floor(Y / 3), 8) - 0.5) * 4 };
};

/** Rock in facets, lit from the left; snow in streaks running down to the left, more of it on the lit side. */
function rock(x: number, y: number, rel: number): string {
  const f = grain(Math.floor((x + y * 0.5) / 6), Math.floor(y / 7), 5);
  const l = 0.55 - 0.55 * rel + (f - 0.5) * 0.5;
  // Snow lies in broken streaks on the ledges, more of it on the lit side.
  const s = Math.sin(x * 0.3 + y * 0.55 + 2.2 * Math.sin(y * 0.09) + 3 * grain(Math.floor(x / 9), Math.floor(y / 8), 3));
  if (s > (l > 0.4 ? 0.8 : 0.93) && grain(Math.floor(x / 5), Math.floor(y / 3), 6) > 0.35) return l > 0.45 ? "w" : l > 0.2 ? "W" : "X";
  if (f > 0.9) return "V";
  return l < 0.12 ? "n" : l < 0.32 ? "d" : l < 0.58 ? "c" : l < 0.85 ? "C" : "h";
}

const body = paint(CX - 60, TOP - 2, 120, BASE - TOP + 4, (x, y) => {
  const Y = y + 0.5;
  if (Y < TOP || Y > BASE + 1 - Math.abs(Math.sin(x * 0.4))) return null;
  const { c, hw } = bodyAt(Y);
  const rel = (x + 0.5 - c) / hw;
  if (Math.abs(rel) > 1) return null;
  return rock(x, y, rel);
});

// ---- The upper peak: one tapering stroke along a spine that rises out of the body and hooks over to the left, snow
// on its top side.

/** The spine, from the body's top to the tip, and the stroke's width at each point. */
const SPINE: readonly (readonly [number, number, number])[] = [
  [79, 60, 30],
  [79, 46, 22],
  [75, 33, 16],
  [68, 23, 12],
  [59, 15, 9],
  [49, 12, 7],
  [41, 15, 4.5],
  [37, 21, 2],
];
const curl = paint(26, 2, 72, 62, (x, y) => {
  const px = x + 0.5;
  const py = y + 0.5;
  let best = Infinity;
  let w = 0;
  let nx = 0;
  let ny = 0;
  for (let i = 0; i < SPINE.length - 1; i++) {
    const [ax, ay, aw] = SPINE[i]!;
    const [bx, by, bw] = SPINE[i + 1]!;
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
    const qx = ax + vx * t;
    const qy = ay + vy * t;
    const d = Math.hypot(px - qx, py - qy);
    if (d < best) {
      best = d;
      w = aw + (bw - aw) * t;
      nx = px - qx; // which side of the spine: its outer (top, left) side takes the light and the snow
      ny = py - qy;
    }
  }
  if (best > w / 2) return null;
  if (ny < -0.5 && best > w / 2 - 2.5 && y < 40) return nx < 3 ? "w" : "W";
  return rock(x, y, Math.max(-1, Math.min(1, (nx - ny * 0.6) / (w / 2 + 1))));
});

// ---- Spires jutting up its right side, snow on their tips.

const spire = (bx: number, by: number, w: number, h: number) =>
  paint(bx, by - h, w + 3, h + 1, (x, y) => {
    const j = by - (y + 0.5); // height above its foot
    const half = (w / 2) * (1 - j / h);
    const mid = bx + w / 2 + (j / h) * 2.5; // leaning right as it rises
    const X = x + 0.5 - mid;
    if (Math.abs(X) > half || j < 0) return null;
    if (j > h - 3) return "w";
    return X < -half * 0.2 ? "c" : X < half * 0.5 ? "d" : "n";
  });
const spires = [spire(92, 64, 9, 20), spire(101, 86, 8, 17), spire(108, 108, 9, 15)];

// ---- The window: a narrow arch high up, its slits lit a faint green.

const WIN: Pt = [84, 66];
const window = paint(WIN[0] - 6, WIN[1] - 8, 13, 17, (x, y) => {
  const X = x + 0.5 - WIN[0] - 0.5;
  const Y = y + 0.5 - WIN[1];
  const half = Y < -2 ? Math.sqrt(Math.max(0, 36 - (Y + 2) ** 2)) : 6;
  if (Math.abs(X) > half || Y > 8.5) return null;
  if (Math.abs(X) > half - 1.2 || Y > 7.5) return "n"; // the frame of rock
  const slit = Math.abs(((X + 4.5) % 3) - 1.5) < 0.8 && Y > -5;
  return slit ? (Y < 0 ? "g" : "G") : "o";
});

// ---- The doorway: an arch of violet-black void at its foot, glowing at its edge.

const DOOR_CX = 82;
const DOOR_TOP = 112;
const DOOR = 10;
const door = paint(DOOR_CX - DOOR - 1, DOOR_TOP - 1, 2 * DOOR + 2, BASE - DOOR_TOP + 2, (x, y) => {
  const X = x + 0.5 - DOOR_CX;
  const Y = y + 0.5;
  const half = Y < DOOR_TOP + DOOR ? Math.sqrt(Math.max(0, DOOR * DOOR - (DOOR_TOP + DOOR - Y) ** 2)) : DOOR;
  const e = half - Math.abs(X);
  if (e < 0 || Y > BASE + 0.5) return null;
  if (e < 1.2) return "U";
  if (e < 2.4) return "u";
  if (e < 3.8) return "V";
  return e < 6 ? "O" : "o";
});

// ---- Small dark pines round its foot, snow on each tier; snow banked at the base; the shadow.

function pine(cx: number, foot: number, h: number) {
  const w = Math.round(h * 0.7);
  return paint(cx - Math.ceil(w / 2), foot - h, w + 1, h, (x, y) => {
    const X = x + 0.5 - cx;
    const j = foot - (y + 0.5); // height above the ground
    if (j < 2) return Math.abs(X) < 1 ? "E" : null; // the trunk
    const tier = Math.min(2, Math.floor(((j - 2) / (h - 2)) * 3));
    const tTop = 2 + ((tier + 1) * (h - 2)) / 3 + (tier < 2 ? 2 : 0); // each tier overlaps the one above
    const tBot = 2 + (tier * (h - 2)) / 3;
    const half = (w / 2) * (1 - tier * 0.25) * ((tTop - j) / (tTop - tBot));
    if (Math.abs(X) > half) return null;
    if (tTop - j < 1.5 || (j > tBot && j < tBot + 1 && Math.abs(X) < half - 1)) return "w";
    return X < 0 ? "e" : "E";
  });
}
const pines = [pine(16, FOOT - 3, 20), pine(29, FOOT - 1, 14), pine(118, FOOT - 3, 19), pine(131, FOOT - 1, 13), pine(104, FOOT, 11)];
const snow = paint(CX - 62, BASE - 6, 124, FOOT - BASE + 6, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  const top = BASE - 2 - 3 * Math.abs(Math.sin(X * 0.17)) + Math.abs(X) * 0.04;
  if (Y < top || Y > FOOT - 1 + Math.sin(X * 0.3) || Math.abs(X) > 60 - (Y - BASE) * 0.5) return null;
  if (Math.abs(X - (DOOR_CX - CX)) < DOOR - 2 && Y < BASE + 2) return null; // the doorway's threshold
  return X < -10 ? "w" : "W";
});
const shadow = groundShadow(CX, FOOT - 1.5, 66, 4.5);

// ---- The sign: a blank weathered board on two posts at its front left. The game writes "Hollow Peak" on it.

const BOARD: Pt = [30, 118];
const BW = 46;
const BH = 24;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, WOOD, "STZ", "L");
const posts = [signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, WOOD), signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, WOOD)];

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const order = [
  add("shadow", shadow),
  ...spires.map((p, i) => add(`spire${i}`, p)),
  add("body", body),
  add("curl", curl),
  add("window", window),
  add("door", door),
  add("snow", snow),
  ...pines.map((p, i) => add(`pine${i}`, p)),
  add("postL", posts[0]!),
  add("postR", posts[1]!),
  add("board", board),
];
const layers: Layer[] = order.map((part) => ({ part, x: at[part]![0], y: at[part]![1] }));

/** The window's light, breathing: dim, mid, bright, mid. */
const GLOW: readonly Record<string, string>[] = [
  { g: "#86c460", G: "#3f7a30" },
  {},
  { g: "#c8f59a", G: "#62a84a" },
  {},
];
const frames: Frame[] = GLOW.map((pal) => ({ ms: 520, layers, pal }));

const idle: Anim = { loop: true, frames };

export const HOUSE_HOLLOW: Character = {
  id: "house-hollow",
  name: "Hollow Peak",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Hollow Peak" on. */
export const HOUSE_HOLLOW_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);
