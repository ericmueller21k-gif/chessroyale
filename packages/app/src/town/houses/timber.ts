/**
 * Timber's Lumber Lodge: the beaver builder's home on the town square (Eric, Nov 3: "a lumber-themed home"). A cozy
 * cabin of stacked logs, their cut ends showing at the corners, on a low stone footing; a roof of rough shingles with a
 * log for a ridge, a stout stone chimney on its left and a beaver's mound of woven sticks on its right; a big plank door
 * with iron straps standing a little open on a warm room; one small lit window. Lumber all round: a tall stack of sawn
 * planks tied with yellow rope on the left, a pile of round logs on the right, a chopping stump with a red-handled axe in
 * it, a sawhorse, shavings and chips on the ground; his orange hard hat hung on a peg by the door. A blank rough plank
 * sign on two log posts in front (the game writes "Timber's Lumber Lodge" on it: no letters here). His colors
 * (boss-beaver). `idle`: smoke curls up from the chimney, the light in the door and window flickers, a chip or two
 * drifts down from the plank stack.
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-timber/house-timber.ts, Nov 3); only its imports moved.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { grain, groundShadow, logEnd, paint, signBoard, signFace, signPost, WARM, type LightPool, type LightSpot, type Pt } from "./kit.ts";
import { lazyAnim } from "../../characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#1e130d", // outline (Timber's)
  a: "#3e2415", // his fur browns, dark to light: the logs, the sticks
  b: "#5d361d",
  c: "#7d4a27",
  d: "#9c6334",
  e: "#b97f4a",
  o: "#b4520c", // his hard hat's orange: shadow, mid, light, highlight
  O: "#ea7816",
  L: "#ff9d3a",
  l: "#ffc77e",
  Y: "#f2c230", // his tool belt's yellow (the rope): mid, shadow, light
  y: "#c48f18",
  Z: "#ffe47c",
  R: "#d8302c", // his hammer's red handle (the axe's): mid, shade
  r: "#8c1916",
  H: "#f6d38e", // his planks' wood: light, mid, shade, grain
  h: "#e0aa5c",
  j: "#b47b36",
  J: "#7e5222",
  s: "#e2e7ec", // steel: light, mid, dark
  S: "#9aa4af",
  T: "#5c6570",
  t: "#33261f", // the shingles, weathered wood: dark to light
  u: "#56412f",
  U: "#775b45",
  V: "#977a5f",
  "1": "#4a4446", // stone: dark to light
  "2": "#6e6866",
  "3": "#958e86",
  "4": "#bdb5a8",
  "5": "#3a1c0e", // the warm room inside: deep, glow, bright, hot
  "6": "#a8501a",
  "7": "#f29a3a",
  "8": "#ffd98a",
  "9": "#d6d2cc", // smoke: light, shade
  "0": "#9a958f",
  f: "#c9a56a", // the sign's face: shadow, board, light
  p: "#e8cc95",
  M: "#f7e4b8",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

const W = 144;
const H = 134;
const CX = 70;
const FOOT = 128;
/** The cabin: its walls' sides, the top of the logs, the top and bottom of the stone footing. */
const WL = 36;
const WR = 106;
const WT = 72;
const FT = 114;
const BASE = 121;
const COURSE = 6;
/** The roof: ridge and eave heights, its half-widths there. */
const RIDGE = 38;
const EAVE = 76;
const RT = 26;
const RB = 48;
/** The door's opening. */
const DL = 58;
const DR = 78;
const DT = 86;

const band = (l: number, ramp: string) => ramp[l < 0.2 ? 0 : l < 0.45 ? 1 : l < 0.75 ? 2 : 3]!;

// ---- The log walls: courses of round logs, lit along their tops, chinked dark between, shaded toward the right.

const wall = paint(WL, WT, WR - WL, FT - WT, (x, y) => {
  const j = (y - WT) % COURSE;
  if (j === COURSE - 1) return "a";
  const course = Math.floor((y - WT) / COURSE);
  let l = 0.78 - 0.55 * ((x - WL) / (WR - WL)) + (j === 0 ? 0.3 : j === COURSE - 2 ? -0.35 : 0);
  l += (grain(Math.floor(x / 5), course, 3) - 0.5) * 0.18;
  if (j > 0 && j < COURSE - 2 && grain(x, y, 4) < 0.07) l -= 0.3; // a knot or a crack in the bark
  return band(l, "bcde");
});
/** The logs' round cut ends at the corners, one a course, a little in and out by turns. */
const ends: { part: Part; at: Pt }[] = [];
for (let c = 0; c < (FT - WT) / COURSE; c++) {
  const cy = WT + c * COURSE + 2.5;
  const out = c % 2 ? 0 : 1;
  ends.push(logEnd(WL - 1.5 - out, cy, 2.9, "bjh"));
  ends.push(logEnd(WR + 1.5 + out, cy, 2.9, "bjh"));
}

/** The stone footing: rounded stones in dark mortar, lit from the left. */
const footing = paint(WL - 3, FT, WR - WL + 6, BASE - FT, (x, y) => {
  const j = y - FT;
  const row = j < 4 ? 0 : 1;
  const sx = x + row * 4;
  const cell = Math.floor(sx / 8);
  const i = ((sx % 8) + 8) % 8;
  if (j === 3 || i === 0) return "1";
  const l = 0.7 - 0.55 * ((x - WL) / (WR - WL)) + (grain(cell, row, 5) - 0.5) * 0.4 + (j === 0 || j === 4 ? 0.25 : 0) - (i === 7 ? 0.3 : 0);
  return band(l, "1234");
});

// ---- The roof: rough shingles in staggered rows, a plank edge down each side, a log along its ridge.

const halfAt = (Y: number) => RT + ((RB - RT) * (Y - RIDGE)) / (EAVE - RIDGE);
const roof = paint(CX - RB - 1, RIDGE, 2 * RB + 2, EAVE - RIDGE + 2, (x, y) => {
  const X = x + 0.5 - CX;
  const h = halfAt(y + 0.5);
  if (Math.abs(X) > h) return null;
  const row = Math.floor((y - RIDGE) / 5);
  const j = (y - RIDGE) % 5;
  const sx = x + Math.floor(grain(row, 0, 13) * 6);
  const shingle = Math.floor(sx / 6);
  const g = grain(shingle, row, 7);
  const long = g < 0.45; // this shingle hangs a pixel lower than its neighbours
  // The eave: rough, shingle by shingle.
  if (y >= EAVE - 1 && !(long && y === EAVE - 1)) return null;
  if (h - Math.abs(X) < 2.2) return X < 0 ? (h - Math.abs(X) < 1.1 ? "h" : "j") : h - Math.abs(X) < 1.1 ? "j" : "J"; // the plank edge
  if (j === 4 && !long) return "t"; // the shadow under a row
  if (((sx % 6) + 6) % 6 === 0) return "t"; // the gap between two shingles
  let l = 0.72 - 0.5 * (X / RB) + (j === 0 ? 0.25 : 0) + (g - 0.5) * 0.28 - (j === 4 ? 0.3 : 0);
  if (grain(x, row, 14) < 0.18 && j > 0) l -= 0.25; // grain in the wood
  return band(l, "tuUV");
});
const ridge = paint(CX - RT - 1, RIDGE - 4, 2 * RT + 2, 5, (x, y) => {
  const j = y - (RIDGE - 4);
  const l = 0.8 - 0.5 * ((x - CX) / RT) + (j === 0 ? 0.3 : j >= 3 ? -0.35 : 0);
  return band(l, "bcde");
});
const ridgeEnds = [logEnd(CX - RT - 1.5, RIDGE - 1.5, 3, "bjh"), logEnd(CX + RT + 1.5, RIDGE - 1.5, 3, "bjh")];

/** The stout stone chimney on the roof's left slope, a slab on top. */
const CHX = 38;
const CHW = 13;
const CHT = 24;
const chimney = paint(CHX, CHT, CHW, 60 - CHT, (x, y) => {
  const j = y - CHT;
  const row = Math.floor(j / 4);
  const sx = x + (row % 2) * 3;
  const i = ((sx % 6) + 6) % 6;
  if (j % 4 === 3 || i === 0) return "1";
  const l = 0.75 - 0.6 * ((x - CHX) / CHW) + (grain(Math.floor(sx / 6), row, 6) - 0.5) * 0.4 + (j % 4 === 0 ? 0.2 : 0);
  return band(l, "1234");
});
const chimneyCap = paint(CHX - 2, CHT - 3, CHW + 4, 3, (x, y) => (y === CHT - 3 ? (x < CHX + 9 ? "4" : "3") : x < CHX + 6 ? "3" : "2"));

/** A beaver's mound of woven sticks heaped on the roof's right side, a few sticks poking out. */
const MCX = 103;
const MBY = 76;
const MRX = 20;
const MRY = 20;
/** Sticks heaped every which way (mostly lying flat), each lit along its top, dark in the gaps; some poke out past the rim. */
const STICKS = new Map<string, string>();
const domeD = (x: number, y: number) => ((x + 0.5 - MCX) / MRX) ** 2 + ((y + 0.5 - MBY) / MRY) ** 2;
const domeL = (x: number, y: number) => 0.5 - 0.45 * ((x + 0.5 - MCX) / MRX) - 0.5 * ((y + 0.5 - MBY) / MRY);
for (let i = 0; i < 34; i++) {
  const th = Math.PI * (1.05 + 0.9 * grain(i, 1, 40));
  const rad = Math.sqrt(grain(i, 2, 40)) * 0.92;
  const cx = MCX + Math.cos(th) * rad * MRX;
  const cy = MBY + Math.sin(th) * rad * MRY;
  // Along the heap's slope, more or less (tilted with the dome's curve), but crossing each other.
  const a = Math.cos(th) * 0.6 * rad + (grain(i, 3, 40) - 0.5) * 1.7;
  const len = 11 + grain(i, 4, 40) * 10;
  const lit = (grain(i, 5, 40) - 0.5) * 0.35;
  for (let s = -len / 2; s <= len / 2; s += 0.4) {
    const px = Math.round(cx + Math.cos(a) * s);
    const py = Math.round(cy + Math.sin(a) * s);
    if (py + 1 >= MBY || domeD(px, py) > (s < -len / 2 + 1.5 || s > len / 2 - 1.5 ? 1.3 : 1.02)) continue;
    const l = domeL(px, py) + lit;
    STICKS.set(`${px},${py}`, band(l + 0.3, "bcde"));
    STICKS.set(`${px},${py + 1}`, band(l - 0.1, "bcde"));
    if (py + 2 < MBY) STICKS.set(`${px},${py + 2}`, "a"); // its shadow on what's under it
  }
}
const mound = paint(MCX - MRX - 4, MBY - MRY - 4, 2 * MRX + 8, MRY + 4, (x, y) => STICKS.get(`${x},${y}`) ?? (domeD(x, y) <= 1 ? "a" : null));

// ---- The door: a warm room inside, its plank leaf open a little, log posts and a log lintel round it.

const room = paint(DL, DT, DR - DL, FT - DT, (x, y) => {
  if (y < DT + 3) return "5";
  const d = Math.hypot((x + 0.5 - 73) / 1.2, y + 0.5 - 108);
  return d < 4 ? "8" : d < 9 ? "7" : d < 15 ? "6" : "5";
});
const LEAF = 12;
const leaf = paint(DL, DT, LEAF, FT - DT, (x, y) => {
  const i = x - DL;
  const j = y - DT;
  const strap = (j >= 5 && j <= 6) || (j >= 20 && j <= 21);
  if (strap) return i % 4 === 1 && j % 2 === 1 ? "s" : j % 2 === 1 ? "T" : "S";
  if (i === LEAF - 1) return "J"; // its edge, turned toward us
  if (i % 4 === 3) return "J"; // between the planks
  return i % 4 === 0 ? "h" : "j";
});
const postL = paint(DL - 3, DT - 2, 3, FT - DT + 2, (x) => (x === DL - 3 ? "e" : x === DL - 1 ? "c" : "d"));
const postR = paint(DR, DT - 2, 3, FT - DT + 2, (x) => (x === DR ? "d" : x === DR + 2 ? "b" : "c"));
const lintel = paint(DL - 6, DT - 6, DR - DL + 12, 4, (x, y) => {
  const j = y - (DT - 6);
  const l = 0.8 - 0.5 * ((x - CX) / 20) + (j === 0 ? 0.3 : j === 3 ? -0.35 : 0);
  return band(l, "bcde");
});
/** A broad stone step at the door. */
const step = paint(DL - 5, BASE - 2, DR - DL + 10, 5, (x, y) => {
  const j = y - (BASE - 2);
  if (j === 0) return x < CX + 6 ? "4" : "3";
  return x > DR + 2 ? "2" : j === 4 ? "2" : "3";
});

// ---- The window: warm glass in a wooden frame, a cross of muntins, a sill below.

const WX = 86;
const WY = 84;
const WW = 15;
const WH = 13;
const windowPart = paint(WX, WY, WW, WH + 2, (x, y) => {
  const i = x - WX;
  const j = y - WY;
  if (j >= WH) return j === WH ? "e" : "c"; // the sill
  if (i === 0 || j === 0) return "d";
  if (i === WW - 1 || j === WH - 1) return "b";
  if (i === 7 || j === 6) return "c";
  return (i < 7 && j < 6 && i + j < 6) || (i > 7 && j < 6 && i - 8 + j < 2) ? "8" : "7";
});

// ---- His hard hat hung on a peg by the door.

const hat = paint(39, 86, 14, 10, (x, y) => {
  const X = x + 0.5 - 46;
  const j = y - 86;
  if (j >= 8) return Math.abs(X) < 7 ? (j === 8 ? (X < 2 ? "L" : "O") : "o") : null; // the brim
  const d = (X / 6.2) ** 2 + ((y + 0.5 - 94) / 5.6) ** 2;
  if (d > 1) return null;
  if (Math.abs(X) < 1) return j < 3 ? "l" : "L"; // its ridge
  if (X < -1.5 && X > -4 && j > 2 && j < 6) return "l"; // a shine
  return X > 2.2 ? "o" : X < -1 ? "L" : "O";
});

// ---- The plank stack on the left: sawn planks in layers, ends staggered, tied with yellow rope, on two bearers.

const SX0 = 3;
const SX1 = 35;
const ST = 86;
const SB = 119;
const stack = paint(SX0, ST, SX1 - SX0, BASE - ST, (x, y) => {
  if (y >= SB) return (x >= 7 && x <= 11) || (x >= 26 && x <= 30) ? (y === SB ? "j" : "J") : null; // the bearers
  const layer = Math.floor((y - ST) / 3);
  const j = (y - ST) % 3;
  const left = SX0 + Math.floor(grain(layer, 1, 11) * 3);
  const right = SX1 - 1 - Math.floor(grain(layer, 2, 11) * 3);
  if (x < left || x > right) return null;
  const seam = 12 + Math.floor(grain(layer, 3, 11) * 12);
  // The rope: two ties round the stack, a twist down each.
  if (x === 13 || x === 14 || x === 27 || x === 28) return (x + y) % 3 === 0 ? "y" : (x === 13 || x === 27) ? "Z" : "Y";
  if (j === 2) return "J";
  if (x === seam || x === right) return "j";
  if (x === left) return "H";
  return j === 0 ? "H" : grain(x >> 2, layer, 12) < 0.25 ? "j" : "h";
});

// ---- The log pile on the right: round cut ends stacked three, two, one.

const LOGS: readonly Pt[] = [
  [114, 115],
  [125, 115],
  [136, 115],
  [119.5, 105],
  [130.5, 105],
  [125, 95],
];
const logs = LOGS.map(([cx, cy]) => logEnd(cx, cy, 5.4, "bjh"));

// ---- The chopping stump, a red-handled axe sunk in it.

const STX = 92;
const stump = paint(STX - 8, 112, 17, 14, (x, y) => {
  const X = x + 0.5 - STX;
  const j = y - 112;
  const top = (X / 7) ** 2 + ((y + 0.5 - 114.5) / 2.6) ** 2;
  if (top <= 1) return top > 0.55 ? "e" : Math.round(top * 5) % 2 ? "h" : "H"; // its cut top, rings
  if (j < 2) return null;
  const half = 7 + (j > 10 ? (j - 10) * 0.6 : 0); // its roots flare at the foot
  if (Math.abs(X) > half) return null;
  if (((x % 3) + 3) % 3 === 0) return "a"; // bark furrows
  return X < -3 ? "d" : X < 2 ? "c" : "b";
});
const axeHandle = paint(93, 98, 9, 16, (x, y) => {
  // A stroke from the blade up and to the right.
  const t = (113 - y) / 15;
  const cx = 94 + t * 6.5;
  if (Math.abs(x + 0.5 - cx) > 1) return null;
  return x + 0.5 < cx ? "R" : "r";
});
const axeHead = paint(89, 110, 8, 4, (x, y) => {
  const i = x - 89;
  const j = y - 110;
  if (i < 2 && j > 1) return null;
  return j === 0 ? "s" : i < 4 ? "S" : "T";
});

// ---- The sawhorse at the front right, a plank laid across it.

const SHY = 116;
const sawhorse = paint(115, SHY, 28, FOOT - SHY, (x, y) => {
  const j = y - SHY;
  if (j < 2) return x >= 116 && x <= 141 ? (j === 0 ? "H" : "j") : null; // the beam
  for (const lx of [120, 136]) {
    const s = (j - 2) * 0.3;
    if (Math.abs(x + 0.5 - (lx - s)) < 1 || Math.abs(x + 0.5 - (lx + 1 + s)) < 1) return x + 0.5 < lx + 0.5 ? "h" : "j";
  }
  if (j === 7 && x >= 120 && x <= 137) return "J"; // a brace
  return null;
});

// ---- Shavings and chips on the ground (no outline: they're thin).

const CHIPS: readonly [number, number, string][] = [
  [80, 125, "H"], [81, 124, "h"], [99, 126, "H"], [100, 126, "j"], [102, 124, "h"], [86, 127, "j"],
  [60, 125, "H"], [61, 126, "h"], [104, 127, "H"], [140, 126, "h"], [141, 125, "H"], [3, 126, "h"], [4, 125, "H"],
  [55, 127, "j"], [76, 127, "H"], [77, 127, "h"], [108, 125, "j"], [36, 127, "h"],
];
const shavings = paint(2, 123, 141, 5, (x, y) => CHIPS.find(([cx, cy]) => cx === x && cy === y)?.[2] ?? null, false);

// ---- The sign at the front left: a rough plank board on two log posts; the game writes on its face.

const BOARD: Pt = [6, 102];
const BW = 50;
const BH = 22;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, "JjhH", "fpM", "T");
const signPostL = signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, "bcde");
const signPostR = signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, "bcde");

const shadow = groundShadow(CX + 2, FOOT - 2, 70, 5);

// ---- Smoke from the chimney: puffs that rise, drift right and swell, a frame apart.

const N = 6;
function smoke(f: number) {
  const puffs = [0, 1, 2].map((i) => {
    const t = (f / N + i / 3) % 1;
    return { t, x: CHX + 6 + t * 20 + Math.sin(t * 7) * 1.5, y: CHT - 4 - t * 14, r: 2.1 + t * 2.5 };
  });
  return paint(CHX - 2, 0, 34, CHT - 2, (x, y) => {
    for (const p of puffs) {
      const dx = x + 0.5 - p.x;
      const dy = y + 0.5 - p.y;
      const d = Math.hypot(dx, dy);
      if (d > p.r) continue;
      if (p.t > 0.8 && grain(x, y, 30 + f) < 0.45) return null; // thinning out at the top
      return dx + dy > p.r * 0.35 ? "0" : "9";
    }
    return null;
  }, false);
}

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const back = [
  add("shadow", shadow),
  add("chimney", chimney),
  add("chimneyCap", chimneyCap),
  add("wall", wall),
  ...ends.map((p, i) => add(`end${i}`, p)),
  add("footing", footing),
  add("room", room),
  add("leaf", leaf),
  add("postL", postL),
  add("postR", postR),
  add("lintel", lintel),
  add("roof", roof),
  add("ridge", ridge),
  ...ridgeEnds.map((p, i) => add(`ridgeEnd${i}`, p)),
  add("mound", mound),
  add("window", windowPart),
  add("hat", hat),
  add("step", step),
];
const front = [
  add("stack", stack),
  ...logs.map((p, i) => add(`log${i}`, p)),
  add("axeHandle", axeHandle),
  add("stump", stump),
  add("axeHead", axeHead),
  add("sawhorse", sawhorse),
  add("shavings", shavings),
  add("signPostL", signPostL),
  add("signPostR", signPostR),
  add("board", board),
];
for (let f = 0; f < N; f++) add(`smoke${f}`, smoke(f));
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

/** The firelight's flicker, frame by frame. */
const FLICKER: readonly Record<string, string>[] = [
  {},
  { "7": "#f7a646", "8": "#ffe4a4" },
  { "7": "#ea9032", "8": "#ffd07c", "6": "#9c4816" },
  {},
  { "7": "#f5a040", "8": "#ffdf98" },
  { "7": "#e88c30", "8": "#ffcc74", "6": "#9c4816" },
];
/** Chips drifting down off the plank stack, tumbling (light side, dark side). */
const CHIP_PATH: readonly (readonly [number, number])[] = [
  [36, 88],
  [37, 91],
  [36, 94],
  [37, 97],
  [36, 100],
];
function chips(f: number): Speck[] {
  const out: Speck[] = [];
  for (const [delay, dx] of [
    [0, 0],
    [3, 1],
  ] as const) {
    const i = f - delay;
    if (i < 0 || i >= CHIP_PATH.length - 1) continue;
    const [x, y] = CHIP_PATH[i]!;
    out.push([x + dx, y, i % 2 ? "j" : "H"]);
  }
  return out;
}
const frames: Frame[] = Array.from({ length: N }, (_, f) => ({
  ms: 220,
  layers: [...back.map(L), L(`smoke${f}`), ...front.map(L)],
  pal: FLICKER[f],
  specks: chips(f),
}));

const idle: Anim = lazyAnim(() => ({ loop: true, frames }));

export const HOUSE_TIMBER: Character = {
  id: "house-timber",
  name: "Timber's Lumber Lodge",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Timber's Lumber Lodge" on. */
export const HOUSE_TIMBER_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

/** Its lights at dusk and night: the warm room through the open door (the fire inside, flickering) and the little window. */
export const HOUSE_TIMBER_LIGHTS: readonly LightSpot[] = [
  { x: DL, y: DT, w: DR - DL, h: FT - DT, keys: "5678", color: WARM, strength: 0.8, flicker: true },
  { x: WX + 1, y: WY + 1, w: WW - 2, h: WH - 2, keys: "78", color: WARM, strength: 0.6, flicker: true },
];
export const HOUSE_TIMBER_POOLS: readonly LightPool[] = [{ x: 72, y: FOOT - 3, rx: 16, ry: 4, color: WARM, strength: 0.3 }];
