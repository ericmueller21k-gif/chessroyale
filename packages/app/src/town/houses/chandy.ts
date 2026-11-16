/**
 * Chandy's Swamp: the special ops alligator's home on the street (Eric, Nov 16: "his house, it's just going to be a swamp, but in order
 * for it to kind of still fall in line with the other houses, we'll just put some brush, like some trees around it that are roughly the
 * same height of the buildings, and then the middle will be a swamp"). Our design: two bald cypresses as tall as the street's
 * buildings frame the lot (flared trunks standing in the water, flat shelves of feathery green, Spanish moss hanging), low brush along
 * the far bank, and in the middle the swamp itself: dark green water with duckweed, lily pads (one in flower), cypress knees and
 * cattails, an old plank boardwalk running in from the sidewalk (the way in), and a blank sign board on two posts on the near bank
 * (the game writes "Chandy's Swamp" on it). The home's box (home-boxes.ts) rings the plot with the same trees on its sides and back and
 * floods its middle. Light from the top left. `idle`: the water's glints drift and the moss sways (four frames); at dusk and night a
 * lantern on the boardwalk's post and a few fireflies glow.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { lazyAnim } from "../../characters/sprite.ts";
import { grain, groundShadow, LANTERN_LIGHT, paint, signBoard, signFace, type LightSpot, type Pt } from "./kit.ts";

const PALETTE: Record<string, string> = {
  k: "#13200f", // outline
  "1": "#3a2a1c", // weathered wood (the boardwalk, the sign's posts): dark to light
  "2": "#5e4630",
  "3": "#83664a",
  "4": "#a88b68",
  t: "#2c241c", // the cypresses' bark: deep, dark, mid, light (a gray brown)
  T: "#463a2d",
  u: "#665645",
  U: "#8d7b65",
  a: "#183418", // their feathery green: deep, dark, mid, light, sunlit
  b: "#244a22",
  c: "#356630",
  d: "#4f8a3c",
  e: "#7aae4c",
  m: "#6f7d66", // Spanish moss: shade, light
  M: "#9eab8f",
  w: "#1d3a2c", // the water: deep, dark, mid, a sheen; its glints
  W: "#284c37",
  v: "#33604a",
  V: "#4b7d5d",
  g: "#9fd0b0",
  G: "#d6f0e0",
  q: "#6f9a30", // duckweed
  l: "#2f6c2a", // lily pads: shade, mid, light; the flower's petals, its blush, its heart
  L: "#4c9a3a",
  h: "#7cc456",
  f: "#fff4f7",
  F: "#f2a9c0",
  y: "#f3d24a",
  r: "#4d6b26", // reeds and cattails: shade, light; the cattails' heads
  R: "#82a443",
  C: "#5a3320",
  n: "#3d3220", // the bank's mud: dark, mid, a grassy lip
  N: "#5b4a2f",
  o: "#5e7d34",
  x: "#c9a56a", // the sign's face: shadow, board, light; its nails
  X: "#e8cc95",
  z: "#f7e4b8",
  Z: "#f2c14e",
  j: "#24222a", // the lantern's iron, its glass lit (bright, warm)
  J: "#ffe9a0",
  K: "#ffb340",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
  "8": "#6f7a2a", // a firefly by day (it glows at dusk and night: HOUSE_CHANDY_LIGHTS)
  "5": "#29473a", // the far trees across the water, in the haze: deep, mid, light
  "6": "#38604a",
  "7": "#527c5e",
};

const W = 144;
/** The picture: 170 tall, so its cypresses stand as tall as the row houses beside it (Eric: "roughly the same height of the buildings"). */
const H = 170;
const CX = 72;
/**
 * The ground things (the water, the banks, the boardwalk, the sign) are drawn on a 120-tall ground, `OY` pixels down the picture; the
 * trees on the whole picture.
 */
const OY = 50;
const FOOT = 114;

// ---- The water: from the far bank's brush (about 80) to the near bank (about 108), seen from the front and a little above. Darker
// toward the front, a sheen under the open sky in the middle, duckweed scattered over it.

/** The near bank's line, a little irregular. */
const nearY = (x: number) => 107 + Math.round(1.6 * Math.sin(x * 0.21) + grain(x >> 2, 0, 3) * 1.6);
/** The far bank's line (behind it the brush and the back trees). */
const farY = (x: number) => 78 + Math.round(2 * Math.sin(x * 0.13 + 1) + grain(x >> 3, 1, 5) * 2);
const water = paint(0, 72, W, 42, (x, y) => {
  if (y < farY(x) || y > nearY(x)) return null;
  const depth = (y - farY(x)) / Math.max(1, nearY(x) - farY(x));
  const sky = 1 - Math.abs(x - CX) / 70;
  if (grain(x, y, 7) > 0.93 && depth > 0.15) return "q";
  // The sheen: long thin streaks along the water, brightest in the open middle.
  if ((y + Math.floor(x / 23)) % 6 === 0 && grain(x >> 2, y, 11) > 0.55 - sky * 0.25) return sky > 0.45 ? "V" : "v";
  const l = 0.75 - depth * 0.55 + sky * 0.2 + (grain(x, y, 13) - 0.5) * 0.15;
  return l > 0.62 ? "v" : l > 0.42 ? "W" : "w";
}, false);
/** The glints: a few bright dashes that drift along the sheen (frame `i` of four). */
const glints = (i: number) =>
  paint(20, 80, 104, 26, (x, y) => {
    if (y < farY(x) + 2 || y > nearY(x) - 2) return null;
    const u = (x + i * 3) % 29;
    const row = (y * 7 + Math.floor((x + i * 3) / 29) * 5) % 9;
    if (row === 0 && u < 3) return u === 1 ? "G" : "g";
    return null;
  }, false);

// ---- The near bank: dark mud with a grassy lip, the water's edge.

const bank = paint(0, 100, W, 16, (x, y) => {
  const top = nearY(x) + 1;
  if (y < top || y > FOOT) return null;
  if (y === top) return "o";
  return grain(x, y, 17) > 0.8 ? "N" : y > FOOT - 2 ? "n" : grain(x >> 1, y, 19) > 0.45 ? "N" : "n";
});

// ---- The far bank's brush: low rounded bushes along the back of the water, between the two trees.

const brush = paint(30, 60, 86, 24, (x, y) => {
  const base = farY(x) + 1;
  const top = base - 8 - 6 * Math.abs(Math.sin(x * 0.17)) - 4 * grain(x >> 3, 2, 23);
  if (y > base || y < top) return null;
  const l = 0.55 - (y - top) / (base - top) * 0.5 + (grain(x, y, 29) - 0.5) * 0.4 - (x - 30) * 0.002;
  return l > 0.5 ? "d" : l > 0.25 ? "c" : l > 0.05 ? "b" : "a";
});

// ---- The bald cypresses: a flared trunk standing in the water, the bark in ropy ridges, and its crown in flat shelves of feathery
// green, lit from the top left; Spanish moss hanging from the shelves' undersides.

interface Shelf {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
/** A trunk from its foot (`foot`, in the water) up to `top`, `base` half-wide at its flare, `half` at its top. */
function trunk(cx: number, top: number, foot: number, half: number, base: number) {
  return paint(cx - base - 2, top, 2 * base + 5, foot - top + 1, (x, y) => {
    const j = (foot - y) / (foot - top); // 0 at the foot, 1 at the top
    const flare = half + (base - half) * Math.pow(Math.max(0, 1 - j * 3.2), 2.2);
    const lean = Math.sin(j * 3) * 1.5;
    const X = x + 0.5 - cx - lean;
    if (Math.abs(X) > flare) return null;
    const u = X / flare; // -1 left edge to 1 right edge
    const ridge = Math.sin((u * flare) * 1.3 + y * 0.08) > 0.55;
    const l = 0.62 - u * 0.45 + (ridge ? 0.18 : 0) + (grain(x, y >> 1, 31) - 0.5) * 0.2;
    return l > 0.8 ? "U" : l > 0.52 ? "u" : l > 0.25 ? "T" : "t";
  });
}
/** The crown: its shelves as ragged ovals, each lit on its top left and shaded under. */
function crown(x0: number, y0: number, w: number, h: number, shelves: readonly Shelf[], seed: number) {
  return paint(x0, y0, w, h, (x, y) => {
    let best: { s: Shelf; d: number } | null = null;
    for (const s of shelves) {
      const dx = (x + 0.5 - s.x) / s.rx;
      const dy = (y + 0.5 - s.y) / s.ry;
      const rag = 0.18 * (grain(x >> 1, y >> 1, seed) - 0.5) + 0.12 * Math.sin(x * 1.7 + y);
      const d = dx * dx + dy * dy - rag;
      if (d <= 1 && (!best || s.y > best.s.y)) best = { s, d };
    }
    if (!best) return null;
    const { s } = best;
    const dx = (x + 0.5 - s.x) / s.rx;
    const dy = (y + 0.5 - s.y) / s.ry;
    // Feathery: little dark gaps in the needles.
    if (grain(x, y, seed + 1) > 0.9 && best.d < 0.75) return "a";
    const l = 0.6 - dy * 0.55 - dx * 0.22 + (grain(x, y, seed + 2) - 0.5) * 0.35;
    return l > 0.95 ? "e" : l > 0.62 ? "d" : l > 0.3 ? "c" : l > 0.05 ? "b" : "a";
  });
}
/** Spanish moss: thin gray-green strands hanging under a shelf (each `len` long), swaying `sway` pixels at their tips. */
function moss(strands: readonly (readonly [number, number, number])[], sway: number) {
  const xs = strands.map((s) => s[0]);
  const x0 = Math.min(...xs) - 3;
  const y0 = Math.min(...strands.map((s) => s[1]));
  const y1 = Math.max(...strands.map((s) => s[1] + s[2]));
  return paint(x0, y0, Math.max(...xs) - x0 + 4, y1 - y0 + 1, (x, y) => {
    for (const [sx, sy, len] of strands) {
      const j = (y - sy) / len;
      if (j < 0 || j > 1) continue;
      const bx = sx + Math.round(sway * j * j + Math.sin(j * 5 + sx) * 0.8);
      if (x === bx || (x === bx + 1 && grain(x, y, sx) > 0.6)) return (y + sx) % 3 === 0 ? "M" : "m";
    }
    return null;
  }, false);
}

const LEFT: readonly Shelf[] = [
  { x: 22, y: 14, rx: 20, ry: 9 },
  { x: 10, y: 30, rx: 14, ry: 8 },
  { x: 36, y: 34, rx: 17, ry: 8 },
  { x: 20, y: 52, rx: 21, ry: 9 },
  { x: 44, y: 64, rx: 13, ry: 6 },
  { x: 8, y: 72, rx: 10, ry: 6 },
  { x: 26, y: 84, rx: 16, ry: 6 },
];
const RIGHT: readonly Shelf[] = [
  { x: 120, y: 12, rx: 21, ry: 9 },
  { x: 134, y: 28, rx: 12, ry: 8 },
  { x: 106, y: 32, rx: 16, ry: 8 },
  { x: 124, y: 50, rx: 21, ry: 9 },
  { x: 100, y: 64, rx: 12, ry: 6 },
  { x: 138, y: 70, rx: 8, ry: 6 },
  { x: 118, y: 82, rx: 16, ry: 6 },
];
const trunkL = trunk(20, 56, 160, 5, 14);
const trunkR = trunk(123, 54, 159, 5, 13);
const crownL = crown(0, 2, 62, 94, LEFT, 41);
const crownR = crown(82, 0, 62, 92, RIGHT, 43);
const MOSS_L = [
  [6, 76, 14],
  [12, 36, 12],
  [28, 58, 16],
  [40, 40, 10],
  [48, 68, 12],
  [18, 22, 8],
  [24, 88, 13],
] as const;
const MOSS_R = [
  [98, 68, 14],
  [110, 38, 10],
  [117, 56, 17],
  [131, 34, 11],
  [138, 74, 11],
  [126, 20, 8],
  [112, 86, 12],
] as const;
/**
 * The far trees across the water (the plot's back, ringed as its sides are): a line of cypress crowns and their trunks, paler in the
 * haze, standing on the far bank behind the brush, a little lower than the near two so the lot reads deep.
 */
const FAR: readonly (Shelf & { t: number })[] = [
  { x: 48, y: 40, rx: 12, ry: 6, t: 48 },
  { x: 44, y: 54, rx: 15, ry: 6, t: 48 },
  { x: 50, y: 68, rx: 11, ry: 5, t: 48 },
  { x: 74, y: 30, rx: 13, ry: 6, t: 74 },
  { x: 70, y: 46, rx: 16, ry: 7, t: 74 },
  { x: 78, y: 60, rx: 13, ry: 5, t: 74 },
  { x: 98, y: 44, rx: 11, ry: 6, t: 97 },
  { x: 94, y: 58, rx: 14, ry: 6, t: 97 },
  { x: 62, y: 80, rx: 12, ry: 5, t: 62 },
  { x: 88, y: 76, rx: 11, ry: 5, t: 88 },
];
const farTrees = paint(26, 20, 92, 110, (x, y) => {
  const bank = farY(x) + OY - 4;
  if (y > bank) return null;
  let top: (typeof FAR)[number] | null = null;
  for (const s of FAR) {
    const dx = (x + 0.5 - s.x) / s.rx;
    const dy = (y + 0.5 - s.y) / s.ry;
    if (dx * dx + dy * dy - 0.2 * (grain(x >> 1, y >> 1, 77) - 0.5) <= 1 && (!top || s.y > top.y)) top = s;
  }
  if (top) {
    const l = 0.62 - ((y + 0.5 - top.y) / top.ry) * 0.5 - ((x + 0.5 - top.x) / top.rx) * 0.2 + (grain(x, y, 75) - 0.5) * 0.3;
    return l > 0.6 ? "7" : l > 0.25 ? "6" : "5";
  }
  // Behind them, the deep haze of the woods further back (nothing of the street shows through the swamp).
  const haze = 44 + 6 * Math.sin(x * 0.2) + 4 * grain(x >> 2, 5, 79);
  if (y >= haze && !FAR.some((s) => Math.abs(x + 0.5 - s.t) < (y > bank - 10 ? 2.4 : 1.6))) return grain(x >> 1, y >> 1, 81) > 0.8 ? "6" : "5";
  // Their trunks, thin and pale, down to the far bank.
  if (FAR.some((s) => Math.abs(x + 0.5 - s.t) < (y > bank - 10 ? 2.4 : 1.6)) && y > 40) return x + 0.5 < FAR.find((s) => Math.abs(x + 0.5 - s.t) < 2.5)!.t ? "6" : "5";
  return null;
});
const mossFrames = [0, 1, 0, -1].map((s) => [moss(MOSS_L, s), moss(MOSS_R, s)] as const);

// ---- In the water: cypress knees (little stumps poking up), lily pads (one in flower), cattails and reeds at the edges.

const knee = (cx: number, foot: number, h: number) =>
  paint(cx - 3, foot - h, 7, h + 1, (x, y) => {
    const j = (foot - y) / h;
    const half = 3 * (1 - j * 0.75);
    const X = x + 0.5 - cx;
    if (Math.abs(X) > half + 0.2) return null;
    return X < -half * 0.3 ? "U" : X < half * 0.4 ? "u" : "T";
  });
const knees = [knee(66, 100, 7), knee(72, 103, 5), knee(54, 90, 5), knee(80, 86, 4)];
const pad = (cx: number, cy: number, rx: number, flower = false) =>
  paint(cx - rx - 1, cy - 4, 2 * rx + 3, 7, (x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / (rx * 0.42);
    if (flower && Math.abs(x + 0.5 - cx) < 2.2 && y < cy - 0.5 && y >= cy - 3) return y === cy - 3 ? (x === cx ? "f" : null) : x === cx && y === cy - 1 ? "y" : Math.abs(x + 0.5 - cx) < 1.5 ? "f" : "F";
    if (dx * dx + dy * dy > 1) return null;
    // Its notch, a wedge cut toward the viewer's right.
    if (dx > 0.15 && Math.abs(dy) < dx * 0.35) return null;
    return dx + dy < -0.5 ? "h" : dx + dy < 0.4 ? "L" : "l";
  });
const pads = [pad(76, 96, 7, true), pad(62, 104, 6), pad(48, 86, 5), pad(70, 88, 4), pad(116, 92, 5), pad(40, 98, 4)];
/** A clump of cattails and reeds: blades fanning from `foot`, a few with a brown head. */
function cattails(cx: number, foot: number, h: number, n: number, seed: number) {
  const blades = Array.from({ length: n }, (_, i) => ({ lean: (i / Math.max(1, n - 1) - 0.5) * 0.7 + (grain(i, seed, 51) - 0.5) * 0.3, len: h * (0.65 + grain(i, seed, 53) * 0.35), head: grain(i, seed, 57) > 0.55 }));
  return paint(cx - Math.ceil(h * 0.45) - 2, foot - h - 1, Math.ceil(h * 0.9) + 5, h + 2, (x, y) => {
    const j = foot - (y + 0.5);
    if (j < 0) return null;
    for (const b of blades) {
      const bx = cx + b.lean * j;
      if (b.head && j > b.len - 5 && j < b.len - 0.5 && Math.abs(x + 0.5 - bx) < 1.2) return "C";
      if (Math.abs(x + 0.5 - bx) < 0.6 && j < b.len) return b.lean < 0 ? "R" : "r";
    }
    return null;
  }, false);
}
const reeds = [cattails(70, 112, 18, 5, 1), cattails(140, 112, 18, 5, 3), cattails(84, 84, 12, 4, 4), cattails(120, 110, 14, 4, 5), cattails(60, 82, 10, 3, 6)];

// ---- The boardwalk: old planks on posts running in from the sidewalk across the water (the way in), a lantern on its near post.

const BW0 = 88;
const BW1 = 112;
/** The boardwalk's far end (on the far bank), its near end on the sidewalk. */
const BW_FAR = 80;
const boardwalk = paint(BW0 - 2, BW_FAR, BW1 - BW0 + 4, FOOT - BW_FAR + 1, (x, y) => {
  const t = (FOOT - 1 - y) / (FOOT - 1 - BW_FAR); // 0 near, 1 far
  if (t < 0 || t > 1) return null;
  // Its sides converge going back.
  const mid = (BW0 + BW1) / 2 - t * 5;
  const half = ((BW1 - BW0) / 2) * (1 - t * 0.6);
  const X = x + 0.5 - mid;
  if (Math.abs(X) > half) return null;
  // Planks across, deeper near (4 px) than far (2 px): a dark gap under each, its lit nose on top.
  const d = 4 - t * 2;
  const k = ((FOOT - 1 - y) % d) / d;
  if (k < 0.26) return "1";
  if (k > 0.74) return "4";
  const plank = Math.floor((FOOT - 1 - y) / d);
  return grain(Math.floor((X + 20) / 6), plank, 63) > 0.82 ? "2" : X < -half * 0.3 ? "4" : "3";
});
/** Its posts, poking up at its near corners and halfway along. */
const bwPosts = [
  [BW0 - 1, 98, 16],
  [BW1 - 1, 98, 16],
  [BW0 + 3, 86, 8],
  [BW1 - 7, 86, 8],
].map(([x, y, h]) => paint(x!, y!, 3, h!, (px) => (px === x ? "4" : px === x! + 2 ? "1" : "2")));
const LANTERN: Pt = [BW0 - 10, 88];
const lanternPost = paint(LANTERN[0] + 2, LANTERN[1] + 4, 3, FOOT - LANTERN[1] - 4, (x) => (x === LANTERN[0] + 2 ? "3" : x === LANTERN[0] + 4 ? "1" : "2"));
const lantern = paint(LANTERN[0], LANTERN[1] - 10, 8, 14, (x, y) => {
  const i = x - LANTERN[0];
  const j = y - (LANTERN[1] - 10);
  if (j === 0) return i >= 3 && i <= 4 ? "j" : null;
  if (j === 1 || j === 12) return i >= 1 && i <= 6 ? "j" : null;
  if (j === 13) return i >= 3 && i <= 4 ? "j" : null;
  if (i === 0 || i === 7) return null;
  if (i === 1 || i === 6) return "j";
  return j < 6 && i < 4 ? "J" : "K";
});

// ---- The sign on the near bank: blank; the game writes "Chandy's Swamp" on it.

const BOARD: Pt = [4, 90];
const BWD = 58;
const BHT = 20;
const board = signBoard(BOARD[0], BOARD[1], BWD, BHT, "1234", "xXz", "Z");
const postL = paint(BOARD[0] + 8, BOARD[1] + BHT, 3, FOOT - BOARD[1] - BHT, (x) => (x === BOARD[0] + 8 ? "3" : x === BOARD[0] + 10 ? "1" : "2"));
const postR = paint(BOARD[0] + BWD - 11, BOARD[1] + BHT, 3, FOOT - BOARD[1] - BHT, (x) => (x === BOARD[0] + BWD - 11 ? "3" : x === BOARD[0] + BWD - 9 ? "1" : "2"));
const shadow = groundShadow(CX, FOOT - 1, 70, 4);

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const back = [add("shadow", shadow), add("farTrees", farTrees), add("brush", brush), add("water", water)];
/** The parts drawn on the whole picture (the rest on the ground, OY down). */
const TALL: ReadonlySet<string> = new Set(["farTrees", "trunkL", "trunkR", "crownL", "crownR", ...[0, 1, 2, 3].flatMap((i) => [`mossL${i}`, `mossR${i}`])]);
const glintNames = [0, 1, 2, 3].map((i) => add(`glint${i}`, glints(i)));
const mid = [
  ...knees.map((p, i) => add(`knee${i}`, p)),
  ...pads.map((p, i) => add(`pad${i}`, p)),
  add("bank", bank),
  ...bwPosts.map((p, i) => add(`bwPost${i}`, p)),
  add("boardwalk", boardwalk),
  add("trunkL", trunkL),
  add("trunkR", trunkR),
  add("crownL", crownL),
  add("crownR", crownR),
];
const mossNames = mossFrames.map(([l, r], i) => [add(`mossL${i}`, l), add(`mossR${i}`, r)] as const);
/** Three fireflies over the water, each two pixels square (ground coordinates). */
const FIREFLIES: readonly Pt[] = [
  [66, 68],
  [82, 62],
  [46, 64],
];
const fireflies = paint(40, 58, 46, 14, (x, y) => (FIREFLIES.some(([fx, fy]) => x >= fx && x < fx + 2 && y >= fy && y < fy + 2) ? "8" : null), false);
const front = [add("fireflies", fireflies), ...reeds.map((p, i) => add(`reeds${i}`, p)), add("postL", postL), add("postR", postR), add("board", board), add("lanternPost", lanternPost), add("lantern", lantern)];
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] + (TALL.has(part) ? 0 : OY) });

/** Four frames: the glints drift along the water, the moss sways a pixel either way; the lantern's glass flickers. */
const LANTERN_PAL: readonly Record<string, string>[] = [{}, { J: "#fff3c4", K: "#ffc25a" }, {}, { J: "#ffe08a", K: "#f5a030" }];
const frames: Frame[] = [0, 1, 2, 3].map((i) => ({
  ms: 380,
  pal: LANTERN_PAL[i],
  layers: [...back.map(L), L(glintNames[i]!), ...mid.map(L), L(mossNames[i]![0]), L(mossNames[i]![1]), ...front.map(L)],
}));
const idle: Anim = lazyAnim(() => ({ loop: true, frames }));

export const HOUSE_CHANDY: Character = {
  id: "house-chandy",
  name: "Chandy's Swamp",
  w: W,
  h: H,
  foot: [CX, FOOT + OY],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write "Chandy's Swamp" on. */
export const HOUSE_CHANDY_SIGN = signFace(BOARD[0], BOARD[1] + OY, BWD, BHT);
/** The boardwalk's middle on the front (px): its door (home-boxes.ts). */
export const HOUSE_CHANDY_DOOR = Math.round((BW0 + BW1) / 2);
/** Its lights at dusk and night: the lantern on the boardwalk's post, flickering, a halo round it; and three fireflies over the water. */
export const HOUSE_CHANDY_LIGHTS: readonly LightSpot[] = [
  { x: LANTERN[0] + 2, y: LANTERN[1] - 8 + OY, w: 4, h: 10, keys: "JK", color: LANTERN_LIGHT, strength: 1, flicker: true, halo: 12 },
  ...FIREFLIES.map(([x, y]) => ({ x, y: y + OY, w: 2, h: 2, keys: "8", color: "#d8ff7a", strength: 0.8, flicker: true, halo: 5 })),
];
