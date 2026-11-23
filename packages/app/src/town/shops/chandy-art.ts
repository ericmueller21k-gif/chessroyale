/**
 * Inside Chandy's Swamp (Nov 16; Eric: "when you actually enter … it won't actually be like a house then. So there will be the ceiling
 * or whatever would actually be the sky, whatever time of day is calculated, just like for the outside world. And pretty much just what
 * you'd think. It's just a swamp."). A room of 20 x 20 squares seen as every room is (the camera looks north, things stand upright at
 * their foot, 37 px a square), with no building: overhead the town's own sky at its time of day (ShopRoom's `sky` roof), all round a
 * ring of bald cypresses standing in the water (Spanish moss, brush at their feet), and the floor shallow swamp water everywhere, a few
 * lily pads and duckweed on it. At the back, the Shopkeeper's stand: a plank counter on stilts, its legs in the water, a tin roof on two
 * poles, a bait sign and jars, Chandy's Boss Crate on it. In the middle the battle spot, hidden under the water (Eric: "you can't
 * actually see where it is"): nothing marks it. A rowboat half sunk, a fallen log, cypress knees and cattails here and there. The way
 * out is the boardwalk at the front (row 19).
 *
 * Footing as every room's: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on its row); floor
 * tiles are flat, top-down, 37 x 37, foot at their middle, named `floor-` (room.ts isFloor).
 *
 * The time of day (sky.ts roomLight, picked as the room loads): by day as drawn; at dusk a warm dim; at night a deep blue dim, the
 * stand's lantern and the fireflies lit (`chandyLit`).
 */
import type { Character, Frame, Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";
import type { RoomLight } from "../sky.ts";

const PALETTE: Record<string, string> = {
  k: "#13200f", // outline
  "1": "#3a2a1c", // weathered wood: dark to light
  "2": "#5e4630",
  "3": "#83664a",
  "4": "#a88b68",
  t: "#2c241c", // cypress bark: deep, dark, mid, light
  T: "#463a2d",
  u: "#665645",
  U: "#8d7b65",
  a: "#183418", // feathery green: deep, dark, mid, light, sunlit
  b: "#244a22",
  c: "#356630",
  d: "#4f8a3c",
  e: "#7aae4c",
  "5": "#29473a", // the woods further back, in the haze: deep, mid, light
  "6": "#38604a",
  "7": "#527c5e",
  m: "#6f7d66", // Spanish moss: shade, light
  M: "#9eab8f",
  w: "#1d3a2c", // water: deep, dark, mid, sheen; glints
  W: "#284c37",
  v: "#33604a",
  V: "#4b7d5d",
  g: "#9fd0b0",
  q: "#6f9a30", // duckweed: mid, light
  Q: "#8fbb44",
  l: "#2f6c2a", // lily pads: shade, mid, light; a flower's petals, blush, heart
  L: "#4c9a3a",
  h: "#7cc456",
  f: "#fff4f7",
  F: "#f2a9c0",
  y: "#f3d24a",
  r: "#4d6b26", // reeds: shade, light; cattail heads
  R: "#82a443",
  C: "#5a3320",
  s: "#8b949c", // tin (the stand's roof): dark, mid, light; its rust
  S: "#b7c0c6",
  I: "#dfe5e8",
  z: "#9a5a2c",
  x: "#c9a56a", // the bait sign's face: shadow, board, light; its paint
  X: "#e8cc95",
  Z: "#f7e4b8",
  o: "#b8452e",
  j: "#24222a", // the lantern's iron, its glass lit (bright, warm)
  J: "#ffe9a0",
  K: "#ffb340",
  G: "#c4e6ef", // glass jars: light, shade; what's in them (worms, minnows)
  H: "#7fa9b4",
  n: "#8a5a3a",
  N: "#5d7f8c",
  p: "#7a3a22", // the crate: its painted gator-green straps, the stencil
  P: "#4f8a3c",
  "-": "#0d0e1280", // a shadow on the water: core, rim (see-through)
  "+": "#0d0e1244",
};

const T = 37;
/** The room's size in squares. */
export const SHOP_CHANDY_N = 20;

type Bit = { part: Part; at: Pt };
interface Piece {
  name: string;
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
  ms: number;
}
const PIECES: Record<string, Piece> = {};
function toChar(p: Piece, pal: Record<string, string>): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bits, f) => ({
    ms: p.ms,
    layers: bits.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-chandy-${p.name}`, name: `Chandy's Swamp: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: pal, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000) {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
}

// ==== The floor: shallow swamp water, top-down, no outline. Dark green, a soft sheen in short streaks along it, a little duckweed.

/** Water at a tile's pixel (its own seed `s`: the tiles differ, their edges all the plain mid tone so they meet without a seam). */
const waterAt = (x: number, y: number, s: number): string => {
  const edge = Math.min(x, y, T - 1 - x, T - 1 - y);
  if (edge > 2) {
    if (y % 6 === s % 6 && grain(x >> 2, y, s) > 0.72) return grain(x, y, s + 3) > 0.7 ? "V" : "v";
    if (grain(x >> 2, y >> 2, s + 5) > 0.82) return "w";
  }
  return "W";
};
const tile = (name: string, fn: (x: number, y: number) => string | null) => def(name, [1, 1], T, T, [18, 18], [[paint(0, 0, T, T, fn, false)]]);
tile("floor-a", (x, y) => waterAt(x, y, 1));
tile("floor-b", (x, y) => waterAt(x, y, 2));
// (The battle spot: the same water, named as a battle circle's tiles so the challenge finds it (challenge.ts marksOf). Nothing shows it.)
tile("ring-a", (x, y) => waterAt(x, y, 1));
tile("ring-b", (x, y) => waterAt(x, y, 2));
tile("floor-weed", (x, y) => {
  const d = Math.hypot((x - 18) / 13, (y - 18) / 9);
  if (d < 1 && grain(x, y, 9) > 0.35 + d * 0.4) return grain(x, y, 10) > 0.6 ? "Q" : "q";
  return waterAt(x, y, 3);
});
/** A lily pad (or two) seen from above: its notch, its veins; one in flower. */
const lily = (cx: number, cy: number, r: number, flower: boolean) => (x: number, y: number): string | null => {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const d = Math.hypot(dx, dy);
  if (flower && d < 3.2) return d < 1.2 ? "y" : (Math.atan2(dy, dx) * 4) % 2 > 1 ? "F" : "f";
  if (d > r) return null;
  const a = Math.atan2(dy, dx);
  if (a > 0.2 && a < 0.75) return null; // its notch
  if (d > r - 1) return "l";
  return Math.round(a * 4) % 3 === 0 && d > 2 ? "L" : dx + dy < -2 ? "h" : "L";
};
tile("floor-lily", (x, y) => lily(17, 19, 9, false)(x, y) ?? lily(30, 8, 5, false)(x, y) ?? waterAt(x, y, 4));
tile("floor-bloom", (x, y) => lily(19, 17, 10, true)(x, y) ?? waterAt(x, y, 5));

// ==== The trees all round: bald cypresses standing in the water, shelves of feathery green over the woods further back in the haze,
// Spanish moss hanging, brush and reeds at their feet. Each piece one square wide, WALL_H tall: the back row (row 0) and both sides
// (columns 0 and 19). Four kinds, so neighbors differ.

const WALL_H = 136;
/** The crowns' shelves in a tree piece (x, y, half-width, half-height): wider than the piece, so neighbors' run together. */
const SHELVES: readonly (readonly [number, number, number, number])[] = [
  [24, 10, 11, 5],
  [6, 22, 14, 6],
  [32, 28, 15, 6],
  [16, 42, 20, 7],
  [36, 54, 14, 6],
  [4, 58, 14, 6],
  [22, 70, 18, 6],
];
const WF = WALL_H - 1;
function treesPiece(name: string, kind: number) {
  const s = 101 + kind * 7;
  // Where its trunk stands (or none), its width at the foot.
  const tx = [18, 9, 27, -99][kind]!;
  const tw = [10, 7, 8, 0][kind]!;
  const crownBot = 74 + (kind % 2) * 6;
  const back = paint(0, 0, T, WALL_H, (x, y) => {
    // The crowns: shelves of feathery green, each a ragged oval lit on its top left, the sky showing over the top one and between.
    let best = -1;
    let bu = 0;
    let bv = 0;
    for (let j = 0; j < SHELVES.length; j++) {
      const [sx, sy, rx, ry] = SHELVES[j]!;
      const u = (x + 0.5 - sx - ((kind * 7) % 11)) / rx;
      const v = (y + 0.5 - sy - kind * 4) / ry;
      if (u * u + v * v - 0.22 * (grain(x >> 1, y >> 1, s + j) - 0.5) <= 1) [best, bu, bv] = [j, u, v];
    }
    if (best >= 0) {
      if (grain(x, y, s + 1) > 0.92) return "a";
      const l = 0.62 - bv * 0.55 - bu * 0.2 + (grain(x, y, s + 2) - 0.5) * 0.35;
      return l > 0.95 ? "e" : l > 0.62 ? "d" : l > 0.3 ? "c" : l > 0.05 ? "b" : "a";
    }
    if (y < 32) return null;
    if (y < crownBot - 10) return grain(x >> 1, y >> 1, s + 6) > 0.75 ? "6" : "5";
    // Below: the woods further back, in the haze, down to the brush.
    if (y < WF - 22) return grain(x >> 1, y >> 1, s + 2) > 0.8 ? "6" : (y + x) % 11 === 0 ? "7" : "5";
    // The brush at the water's edge.
    const l = 0.6 - (y - (WF - 22)) / 30 + (grain(x, y, s + 3) - 0.5) * 0.5;
    return y >= WF - 1 ? "w" : l > 0.45 ? "d" : l > 0.2 ? "c" : "b";
  }, false);
  const trunk = tw
    ? paint(tx - tw - 4, crownBot - 18, 2 * tw + 9, WF - crownBot + 19, (x, y) => {
        const j = (WF - y) / (WF - crownBot + 18);
        const half = tw * (0.55 + 0.45 * Math.pow(Math.max(0, 1 - j * 2.4), 2)) + (j < 0.12 ? 3 * (1 - j / 0.12) : 0);
        const X = x + 0.5 - tx;
        if (Math.abs(X) > half) return null;
        const u = X / half;
        const l = 0.62 - u * 0.45 + (Math.sin(u * 5 + y * 0.1) > 0.5 ? 0.15 : 0) + (grain(x, y >> 1, s + 4) - 0.5) * 0.2;
        return l > 0.8 ? "U" : l > 0.5 ? "u" : l > 0.25 ? "T" : "t";
      })
    : null;
  const mossBit = paint(0, crownBot - 10, T, 34, (x, y) => {
    for (const [mx, len] of [[6 + kind * 3, 22], [20 - kind, 14], [31, 18 + kind * 2]] as const) {
      const j = (y - (crownBot - 10)) / len;
      if (j < 0 || j > 1) continue;
      if (x === mx + Math.round(Math.sin(j * 5 + mx) * 0.8)) return (y + mx) % 3 ? "m" : "M";
    }
    return null;
  }, false);
  const reeds = paint(0, WF - 26, T, 27, (x, y) => {
    for (let i = 0; i < 4; i++) {
      const bx = 4 + i * 9 + kind * 2;
      const len = 14 + ((i * 5 + kind) % 3) * 5;
      const j = WF - y;
      const lean = (i % 2 ? 0.25 : -0.2) * j;
      if (Math.abs(x + 0.5 - bx - lean) < 0.7 && j < len) return i % 2 ? "r" : "R";
      if (i === 1 && j > len - 5 && j < len && Math.abs(x + 0.5 - bx - lean) < 1.3) return "C";
    }
    return null;
  }, false);
  def(name, [1, 1], T, WALL_H, [18, WF], [[back, ...(trunk ? [trunk] : []), mossBit, reeds]]);
}
treesPiece("trees-a", 0);
treesPiece("trees-b", 1);
treesPiece("trees-c", 2);
treesPiece("trees-d", 3);

// ==== The front: a low line of reeds and cattails at the water's edge, and the way out, the boardwalk, two squares wide.

const HEM_H = 30;
def("reeds", [1, 1], T, HEM_H, [18, HEM_H - 1], [[
  paint(0, 0, T, HEM_H, (x, y) => {
    const j = HEM_H - 1 - y;
    for (let i = 0; i < 6; i++) {
      const bx = 3 + i * 6.2;
      const len = 16 + (i * 7) % 12;
      const lean = (i % 3 - 1) * 0.2 * j;
      if (i % 2 === 0 && j > len - 6 && j < len && Math.abs(x + 0.5 - bx - lean) < 1.4) return "C";
      if (Math.abs(x + 0.5 - bx - lean) < 0.8 && j < len) return i % 2 ? "r" : "R";
    }
    return j < 2 ? "r" : null;
  }),
]]);
const EW = 2 * T;
const EH = 40;
const EF = EH - 1;
def("entrance", [2, 1], EW, EH, [EW / 2, EF], [[
  // The boardwalk's planks running out toward us (to the street), its posts at the sides, a lantern on the west one.
  paint(10, 14, EW - 20, EF - 13, (x, y) => {
    const j = y - 14;
    if ((y - 14) % 5 === 4) return "1";
    return grain(x >> 3, j / 5 | 0, 7) > 0.8 ? "2" : x < EW / 2 ? "4" : "3";
  }),
  ...[8, EW - 11].map((px) => paint(px, 6, 4, EF - 5, (x) => (x === px ? "4" : x === px + 3 ? "1" : "2"))),
  paint(5, 0, 9, 9, (x, y) => (y === 0 || y === 8 ? (x > 5 && x < 13 ? "j" : null) : x === 5 || x === 13 ? null : x === 6 || x === 12 ? "j" : y < 4 && x < 9 ? "J" : "K")),
]]);

// ==== The Shopkeeper's stand at the back: a plank counter on stilts in the water, a tin roof on two poles, a bait sign hung under it,
// jars of bait on its top; Chandy's Boss Crate on its east end (crateAt). The keeper stands behind it on its squares.

const CW = 4 * T;
const CH = 104;
const CF = CH - 3;
const CTOP = CF - 34; // the counter's top
export const SHOP_CHANDY_CRATE_AT: Pt = [118, CTOP + 2];
const BAIT = { x: 46, y: 8, w: 52, h: 14 } as const;
{
  const legs = [6, 30, CW - 34, CW - 10].map((lx) =>
    paint(lx, CTOP + 6, 4, CF - CTOP - 5, (x, y) => (y > CF - 3 ? "W" : x === lx ? "4" : x === lx + 3 ? "1" : "2")),
  );
  const counter = paint(2, CTOP, CW - 4, 20, (x, y) => {
    const j = y - CTOP;
    if (j < 4) return j === 0 ? "4" : j < 3 ? "3" : "1"; // its top, seen a little from above
    if (j === 19) return "1";
    const bx = (x - 2) % 11;
    return bx === 0 ? "1" : bx === 1 ? "4" : grain((x - 2) / 11 | 0, j >> 2, 31) > 0.85 ? "2" : "3";
  });
  const poles = [10, CW - 14].map((px) => paint(px, 18, 4, CTOP - 17, (x) => (x === px ? "4" : x === px + 3 ? "1" : "2")));
  // The tin roof: corrugated, a little rust, sloping toward us.
  const roof = paint(0, 4, CW, 16, (x, y) => {
    const j = y - 4;
    const left = 4 - j * 0.25;
    if (x < left || x > CW - 1 - left) return null;
    if (j > 12) return j === 15 ? "s" : "S";
    if (grain(x >> 2, j >> 1, 33) > 0.88) return "z";
    return x % 6 === 0 ? "s" : x % 6 === 1 ? "I" : "S";
  });
  const sign = signBoard(BAIT.x, BAIT.y + 16, BAIT.w, BAIT.h, "1234", "xXZ", "j");
  // The bait sign's picture (no words): a red fish and a worm.
  const fish = paint(BAIT.x + 10, BAIT.y + 20, 32, 7, (x, y) => {
    const i = x - (BAIT.x + 10);
    const j = y - (BAIT.y + 20);
    if (i < 14) return Math.abs(j - 3) < 3 - Math.abs(i - 7) / 3 ? "o" : i === 13 && Math.abs(j - 3) < 3 ? "o" : null;
    if (i >= 20) return Math.abs(j - 3 - Math.round(Math.sin(i * 0.9))) < 1 ? "n" : null;
    return null;
  }, false);
  const jars = [24, 40, 56].map((jx, i) =>
    paint(jx, CTOP - 12, 10, 13, (x, y) => {
      const ii = x - jx;
      const jj = y - (CTOP - 12);
      if (jj < 2) return ii > 1 && ii < 8 ? "1" : null; // the lid
      if (ii === 0 || ii === 9) return "H";
      if (jj > 5 && ((ii + jj + i) % 4 === 0)) return i === 1 ? "N" : "n";
      return ii < 3 ? "G" : "H";
    }),
  );
  const lantern = paint(CW - 22, 22, 9, 13, (x, y) => {
    const i = x - (CW - 22);
    const j = y - 22;
    if (j === 0 || j === 12) return i > 1 && i < 7 ? "j" : null;
    if (i === 0 || i === 8) return null;
    if (i === 1 || i === 7) return "j";
    return j < 6 && i < 5 ? "J" : "K";
  });
  // Chandy's Boss Crate: a plank crate, a gator-green band round it, a little rifle scope stenciled on its front.
  const crate = paint(SHOP_CHANDY_CRATE_AT[0] - 13, SHOP_CHANDY_CRATE_AT[1] - 20, 26, 20, (x, y) => {
    const i = x - (SHOP_CHANDY_CRATE_AT[0] - 13);
    const j = y - (SHOP_CHANDY_CRATE_AT[1] - 20);
    if (j < 4) return j === 0 ? "4" : "3"; // its lid, from above
    if (j >= 9 && j <= 11) return j === 9 ? "e" : "P";
    const d = Math.hypot(i + 0.5 - 13, j + 0.5 - 15);
    if (j > 12 && d < 3.5 && d > 2) return "p";
    if (j > 12 && (i === 13 || j === 15) && d < 5) return "p";
    return i % 6 === 0 ? "1" : i < 3 ? "4" : "3";
  });
  def("stand", [4, 1], CW, CH, [CW / 2, CF], [[groundShadow(CW / 2, CF - 1, CW / 2 - 4, 3), ...legs, ...poles, counter, roof, sign, fish, ...jars, lantern, crate]]);
}
/** Where the stand's lantern hangs (its light at night), in the stand's pixels. */
const STAND_LANTERN = { x: CW - 20, y: 24, w: 5, h: 9 } as const;

// ==== The props: a rowboat half sunk, a fallen log, cypress knees, a cypress stump, clumps of cattails.

def("rowboat", [2, 1], 2 * T, 30, [T, 26], [[
  paint(4, 8, 2 * T - 8, 20, (x, y) => {
    const X = (x + 0.5 - T) / (T - 6);
    const top = 12 + 6 * X * X + (X > 0.3 ? -4 * (X - 0.3) : 0); // its gunwale, the bow raised
    if (y < top || y > 24 || Math.abs(X) > 1) return null;
    if (y < top + 1.5) return "4";
    if (y > 20) return "W"; // the water inside it, and the waterline
    return (x % 8 === 0 ? "1" : X < 0 ? "3" : "2");
  }),
  paint(2, 22, 2 * T - 4, 6, (x, y) => (y === 22 ? (grain(x, 1, 3) > 0.5 ? "V" : null) : y < 24 && (x * 3) % 7 === 0 ? "g" : null), false),
]]);
def("log", [2, 1], 2 * T, 22, [T, 18], [[
  paint(2, 6, 2 * T - 4, 14, (x, y) => {
    const j = y - 6;
    if (j > 10) return j === 11 ? "V" : null; // where it meets the water
    if (x < 9) {
      const d = Math.hypot(x + 0.5 - 8, j + 0.5 - 5);
      return d > 5.5 ? null : d > 4.3 ? "T" : Math.floor(d) % 2 ? "U" : "u";
    }
    if (grain(x >> 2, j, 41) > 0.85) return "q"; // moss on it
    return j < 3 ? "U" : j < 7 ? "u" : "T";
  }),
]]);
const kneeBit = (cx: number, foot: number, h: number) =>
  paint(cx - 4, foot - h, 9, h + 1, (x, y) => {
    const j = (foot - y) / h;
    const half = 4 * (1 - j * 0.7);
    const X = x + 0.5 - cx;
    if (Math.abs(X) > half + 0.2) return null;
    if (y === foot) return "V";
    return X < -half * 0.3 ? "U" : X < half * 0.4 ? "u" : "T";
  });
def("knees", [1, 1], T, 24, [18, 20], [[kneeBit(10, 20, 10), kneeBit(22, 21, 14), kneeBit(30, 20, 7)]]);
def("stump", [1, 1], T, 34, [18, 30], [[
  paint(6, 6, 25, 26, (x, y) => {
    const j = y - 6;
    const half = 9 + (j > 16 ? (j - 16) * 0.5 : 0);
    const X = x + 0.5 - 18.5;
    if (Math.abs(X) > half) return null;
    if (j < 4) return Math.abs(X) < half - 2 ? (Math.floor(Math.hypot(X, (j - 2) * 3) / 2) % 2 ? "4" : "3") : "U";
    if (j > 22) return "V";
    return X < -3 ? "U" : X < 4 ? "u" : "T";
  }),
]]);
def("cattails", [1, 1], T, 40, [18, 36], [[
  paint(0, 0, T, 38, (x, y) => {
    const j = 36 - y;
    for (let i = 0; i < 7; i++) {
      const bx = 18 + (i - 3) * 2.2;
      const len = 22 + ((i * 5) % 4) * 4;
      const lean = (i - 3) * 0.12 * j;
      if (i % 2 === 0 && j > len - 7 && j < len && Math.abs(x + 0.5 - bx - lean) < 1.6) return "C";
      if (Math.abs(x + 0.5 - bx - lean) < 0.7 && j < len) return i % 2 ? "r" : "R";
    }
    return j < 1 && Math.abs(x - 18) < 8 ? "V" : null;
  }),
]]);

// ==== The layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  w?: number;
  d?: number;
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name]!;
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};
const N = SHOP_CHANDY_N;
// -- The floor (every square): water, lily pads and duckweed here and there (never on the battle spot's squares, 7-12 of rows 9-12).
const LILY = new Set(["3,5", "15,4", "5,15", "16,14", "13,16", "2,10"]);
const BLOOM = new Set(["4,6", "14,15"]);
const WEED = new Set(["6,3", "12,5", "3,13", "17,9", "8,16", "11,17", "15,7"]);
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const k = `${col},${row}`;
    if (col >= 7 && col <= 12 && row >= 9 && row <= 12) {
      at((col + row) % 2 ? "ring-b" : "ring-a", col, row, false);
      continue;
    }
    at(BLOOM.has(k) ? "floor-bloom" : LILY.has(k) ? "floor-lily" : WEED.has(k) ? "floor-weed" : (col + row) % 2 ? "floor-b" : "floor-a", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;
// -- The trees: the back row and both sides; the reeds along the front, the boardwalk out in its middle.
const KINDS = ["trees-a", "trees-b", "trees-c", "trees-d"];
for (let col = 0; col < N; col++) at(KINDS[(col * 3 + 1) % 4]!, col, 0, true);
for (let row = 1; row < N - 1; row++) {
  at(KINDS[(row * 3) % 4]!, 0, row, true);
  at(KINDS[(row * 3 + 2) % 4]!, N - 1, row, true, { flip: true });
}
at("trees-a", 0, N - 1, true);
for (let col = 1; col < N - 1; col++) if (col < 9 || col > 10) at("reeds", col, N - 1, true);
at("entrance", 9, N - 1, false, { exit: true });
at("trees-c", N - 1, N - 1, true, { flip: true });
// -- The stand and the props.
at("stand", 8, 3, true);
at("rowboat", 2, 7, true);
at("log", 15, 11, true);
at("knees", 4, 11, true);
at("knees", 14, 6, true);
at("stump", 3, 16, true);
at("cattails", 16, 16, true);
at("cattails", 2, 3, true);
at("cattails", 17, 3, true);

/** Where every piece goes: floor tiles first, then the upright pieces north to south. */
export const SHOP_CHANDY_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
/** The water's depth over who wades in it (the room's px: about a pawn's base), its ripple's and its spray's colors (ShopRoom `wade`). */
export const SHOP_CHANDY_WADE = { depth: 7, line: "rgba(190,232,205,0.85)", spray: "#cfeedd" } as const;
/** The battle spot's start marks (hidden under the water: not drawn), the boss west, you east, as every room's. */
export const SHOP_CHANDY_MARKS = { boss: [8, 10.5], you: [11, 10.5] } as const;

/** The room at a time of day (sky.ts roomLight): its pieces, its lights and the dim over it. Made once a light. */
const lit = new Map<RoomLight, { pieces: Record<string, Character>; lights: (LightSpot & { piece: string })[]; pools: (LightPool & { piece: string })[]; dim?: number; dimRGB?: string }>();
export function chandyLit(light: RoomLight) {
  let hit = lit.get(light);
  if (hit) return hit;
  const pieces = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p, PALETTE)]));
  const lantern = { ...STAND_LANTERN, keys: "JK", color: "#ffb648", strength: 1, flicker: true, halo: 14, piece: "stand" };
  hit =
    light === "day"
      ? { pieces, lights: [], pools: [] }
      : light === "dusk"
        ? { pieces, lights: [lantern], pools: [], dim: 0.25, dimRGB: "60,30,20" }
        : { pieces, lights: [lantern], pools: [{ x: CW / 2, y: CF + 6, rx: 70, ry: 14, color: "#ffb648", strength: 0.35, piece: "stand" }], dim: 0.5, dimRGB: "8,16,40" };
  lit.set(light, hit);
  return hit;
}
