/**
 * Inside Blitz's Kicks: Blitz's shop (house-shop-blitz). A room of 20 x 20 squares seen as the town square is seen (the
 * camera looks north, things stand upright at their foot, 37 px a square): the inside of the neon sneaker shop of
 * house-blitz, in Blitz's colors (boss-blitz: his teal and orange, cheetah gold and spots, greys and whites). Eric, Nov 3:
 * "Just a straight up sneaker store, wall to wall with sneakers on display, also some rows/racks with shoes / shoe boxes,
 * a halfpipe, a big pallet of energy drink cases called Cheetah Chug ... no chess clocks needed, it's funnier that way."
 * A pale terrazzo floor; a white back wall of lit sneaker shelves between two big shop windows onto a sunny skate park; a
 * teal feature wall of sneaker cubbies under an orange neon sneaker behind the checkout counter; racks, shoe-box stacks, a
 * try-on bench, a hero pair on a lit pedestal, a Cheetah Chug fridge and pallet; a wooden halfpipe in the north-east
 * corner, its skateboard rolling back and forth by itself (the showpiece). In the middle, the battle circle: a polished
 * maple court in a bold orange line and a teal band, a cheetah paw in its center circle. No chess clocks anywhere.
 * Built as Timber's shop is (scripts/boss-art/out/house-shop-timber).
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-shop-blitz/house-shop-blitz.ts, Nov 3), its imports moved, its
 * room still and review strips (HOUSE_SHOP_BLITZ) left there. Built as Timber's shop is in the app (shops/timber-art.ts). The cheetah
 * is Dash since Nov 3 (the art's file and exports keep `blitz`).
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row;
 * a deep piece stands on its south row). Floor tiles are flat, top-down, 37 x 37, foot at their middle. The circle's
 * tiles are each drawn where they lie (its court boards run east to west, so its quarters don't turn); the east wall is
 * the west one mirrored (`flip`).
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, WARM, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline (Blitz's)
  b: "#b9781f", // his fur (cheetah print): shade, mid, light, the spots
  c: "#e0a53a",
  d: "#f2c665",
  s: "#241610",
  A: "#0b4a4f", // his jacket's teal: dark to light
  B: "#137a7a",
  C: "#22a8a0",
  D: "#6fd8c8",
  E: "#8a3208", // his orange: dark to light
  F: "#d2601a",
  G: "#f28a2a",
  H: "#ffb860",
  I: "#5d6470", // greys: mid, light
  J: "#a5adb8",
  M: "#c9ced8", // whites: shadow, white, bright
  N: "#eef1f5",
  O: "#ffffff",
  R: "#b01a22", // red: shade, mid
  S: "#ee3b3b",
  "1": "#262a33", // black: dark, mid
  "2": "#4f5562",
  f: "#ece7dd", // the terrazzo floor: its ground, the grout between tiles
  i: "#d8d1c3",
  P: "#f3cf93", // the court's maple: light, mid, shade, an end joint
  Q: "#e6bb78",
  T: "#d4a462",
  Y: "#b9874a",
  w: "#f6f3ec", // the walls' white: lit, shade, deep shade
  x: "#dfdad0",
  y: "#bdb6a8",
  X: "#fffdf3", // the shelves' light strips
  "3": "#a9dcf7", // the view: sky high, sky low, the haze
  "4": "#cdeefb",
  "5": "#eefaff",
  "6": "#b4c1d8", // far towers, near towers
  "7": "#93a2bf",
  "8": "#d9dcdf", // the skate park's concrete: lit, shade
  "9": "#b3b8bf",
  "0": "#7fcf63", // greens: lit, shade
  "!": "#3f9a4a",
  u: "#d6f4f7", // a reflection on glass
  e: "#25b85c", // the EXIT sign's green: mid, dark
  t: "#0f6b34",
  h: "#dcb47c", // pallet wood: lit, mid, shade
  j: "#b98a52",
  m: "#8a6234",
  "^": "#f0fffd", // teal neon: core, glow
  "@": "#35e4d2",
  "#": "#fff1dc", // orange neon: core, glow
  $: "#ff8c2e",
  "-": "#0d0e1280", // ground shadow: core, rim
  "+": "#0d0e1244",
};

const T = 37;
type Key = string | null;
type Bit = { part: Part; at: Pt };
interface Piece {
  name: string;
  /** Its footprint in squares (wide, deep) and its picture's size and foot in pixels. */
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
  ms: number;
}
const PIECES: Record<string, Piece> = {};

function toChar(p: Piece): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bits, f) => ({
    ms: p.ms,
    layers: bits.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-blitz-${p.name}`, name: `Blitz's shop: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
  return toChar(PIECES[name]!);
}

// ---- A small canvas to stamp on.

type Cv = string[][];
const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const fill = (c: Cv, fn: (x: number, y: number) => Key) => c.forEach((row, y) => row.forEach((_, x) => (row[x] = fn(x, y) ?? row[x]!)));
const put = (c: Cv, x: number, y: number, k: string) => {
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const asPart = (c: Cv, outline = false): Part => ({ grid: c.map((r) => r.join("")), outline });
const stamp = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
const whole = (c: Cv, outline = false): Bit => ({ part: asPart(c, outline), at: [0, 0] });
/** A canvas cropped to what's drawn on it, as a Bit; null if it's empty. */
const cropBit = (c: Cv, outline = true): Bit | null => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  c.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return null;
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
};
const bits = (...bs: (Bit | null)[]): Bit[] => bs.filter((b): b is Bit => b !== null);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]! + 0.5) / 16;

// ---- Sneakers: the shop's one recurring thing, 12 x 6, toe to the right (a high heel collar, laces, a stripe, a white sole).

/** Colorways: upper, its shade, the stripe, the laces, the sole. A "c" upper is cheetah print (spots in it). */
const KICKS = ["CBGOO", "GFCOO", "SRONO", "NMCOG", "12SOO", "cbsOO", "DCFNN", "HGBOO", "NMSRN", "21GNN", "BAHOO", "OMGOI", "FEDOO", "SROO1", "cbGOO", "MJCON"];
const KICK = ["aa..b.......", "aaa.bl......", "aaaaaalal...", "assssaaaaab.", "aaaaaaaaaaab", "oooooooooooo"];
/** Stamps sneaker colorway `n` with its heel at (x, y) (its top-left), facing right or (`left`) left. */
function kick(c: Cv, x: number, y: number, n: number, left = false) {
  const cw = KICKS[((n % KICKS.length) + KICKS.length) % KICKS.length]!;
  KICK.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      let k = ch === "a" ? cw[0]! : ch === "b" ? cw[1]! : ch === "s" ? cw[2]! : ch === "l" ? cw[3]! : cw[4]!;
      if (cw[0] === "c" && ch === "a" && (i * 2 + j * 3) % 5 === 0) k = "s"; // the cheetah print's spots
      put(c, left ? x + 11 - i : x + i, y + j, k);
    }),
  );
}

// ---- Neon: a 1-pixel bright core with a glow round it (no outline), on whatever it's mounted on.

function seg(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  return Array.from({ length: n + 1 }, (_, i) => [Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)] as Pt);
}
function neon(c: Cv, tubes: readonly { core: string; glow: string; px: readonly Pt[] }[]) {
  const core = new Set(tubes.flatMap((t) => t.px.map(([x, y]) => `${x},${y}`)));
  for (const t of tubes)
    for (const [x, y] of t.px)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!core.has(`${x + dx},${y + dy}`)) put(c, x + dx, y + dy, t.glow);
  for (const t of tubes) for (const [x, y] of t.px) put(c, x, y, t.core);
}
/** The neon sneaker of the shop's sign (as on the roof outside), its heel's top-left at (x, y): 40 x 17. */
const NEON_SHOE: readonly Pt[] = [[1, 3], [8, 1], [11, 4], [16, 4], [17, 0], [21, 0], [22, 4], [30, 8], [36, 10], [39, 13], [39, 17], [1, 17], [0, 13], [0, 5]];
function neonShoe(c: Cv, x0: number, y0: number) {
  const inside = (x: number, y: number) => {
    const xc = x + 0.5 - x0;
    const yc = y + 0.5 - y0;
    let r = false;
    NEON_SHOE.forEach(([ax, ay], i) => {
      const [bx, by] = NEON_SHOE[(i + 1) % NEON_SHOE.length]!;
      if (ay <= yc !== by <= yc && xc < ax + ((yc - ay) / (by - ay)) * (bx - ax)) r = !r;
    });
    return r;
  };
  const edge: Pt[] = [];
  for (let y = y0; y < y0 + 18; y++)
    for (let x = x0; x < x0 + 40; x++) if (inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))) edge.push([x, y]);
  const o = (dx: number, dy: number) => [x0 + dx, y0 + dy] as const;
  neon(c, [
    { core: "#", glow: "$", px: [...edge, ...seg(...o(3, 14), ...o(37, 14)), ...seg(...o(19, 6), ...o(20, 5)), ...seg(...o(22, 7), ...o(23, 6)), ...seg(...o(25, 8), ...o(26, 7))] },
    { core: "^", glow: "@", px: [...seg(...o(6, 11), ...o(14, 8)), ...seg(...o(14, 8), ...o(13, 10)), ...seg(...o(13, 10), ...o(26, 7))] },
    { core: "^", glow: "@", px: [...seg(...o(-9, 5), ...o(-4, 5)), ...seg(...o(-10, 9), ...o(-3, 9)), ...seg(...o(-8, 13), ...o(-3, 13))] },
  ]);
}

// ==== The floor: pale terrazzo in big tiles (a soft grout line on each tile's west and north edges), a few chips.

function terrazzo(x: number, y: number, seed: number): string {
  if (x === 0 || y === 0) return "i";
  const g = grain(x, y, seed);
  if (g < 0.017) {
    const h = grain(x, y, seed + 7);
    return h < 0.55 ? "J" : h < 0.78 ? "D" : "H";
  }
  return "f";
}
const floorA = (x: number, y: number) => terrazzo(x, y, 1);
const floorB = (x: number, y: number) => terrazzo(x, y, 2);
const floorAt = (col: number, row: number) => ((col + row) % 2 ? floorB : floorA);

const flat = (fn: (x: number, y: number) => Key): Bit[][] => [[paint(0, 0, T, T, fn, false)]];
const tileDef = (name: string, fn: (x: number, y: number) => Key) => def(name, [1, 1], T, T, [18, 18], flat(fn));

export const SHOP_BLITZ_FLOOR_A = tileDef("floor-a", floorA);
export const SHOP_BLITZ_FLOOR_B = tileDef("floor-b", floorB);
/** Variety on a: two black rubber skid marks (somebody stopped fast). */
export const SHOP_BLITZ_FLOOR_C = tileDef("floor-c", (x, y) => {
  for (const [x0, y0, len] of [[7, 12, 20], [10, 19, 18]] as const) {
    const i = x - x0;
    if (i < 0 || i > len) continue;
    const cy = y0 + Math.round(2.2 * Math.sin((i / len) * Math.PI * 0.9));
    if (y === cy && grain(x, y, 31) > 0.12) return i < 3 || i > len - 4 ? "J" : "I";
  }
  return floorA(x, y);
});
/** Variety on b: a faint dusty cheetah paw print. */
export const SHOP_BLITZ_FLOOR_D = tileDef("floor-d", (x, y) => {
  const pad = ((x + 0.5 - 19) / 4.2) ** 2 + ((y + 0.5 - 22) / 3.2) ** 2 <= 1;
  const toe = ([[13.5, 16], [17, 13.5], [21.5, 13.5], [25, 16]] as const).some(([tx, ty]) => Math.hypot(x + 0.5 - tx, y + 0.5 - ty) < 1.6);
  if ((pad || toe) && grain(x, y, 33) > 0.25) return "i";
  return floorB(x, y);
});

/** The lane: a teal rubber running lane, two squares wide, from the door to the circle and on to the counter; white lines down its sides. */
const lane = (side: number) => (x: number, y: number) => {
  const i = side ? T - 1 - x : x; // from its outer edge
  if (i < 2) return floorAt(side, 0)(x, y);
  if (i === 4 || i === 5) return "N";
  const g = grain(x, y, 40 + side);
  return g < 0.012 ? "B" : g > 0.992 ? "D" : "C";
};
export const SHOP_BLITZ_LANE_W = tileDef("floor-lane-w", lane(0));
export const SHOP_BLITZ_LANE_E = tileDef("floor-lane-e", lane(1));
/** The lane at the door: a white start line across it. */
export const SHOP_BLITZ_FLOOR_DOOR_W = tileDef("floor-door-w", (x, y) => (y >= 26 && y <= 28 && x >= 2 ? "N" : lane(0)(x, y)));
export const SHOP_BLITZ_FLOOR_DOOR_E = tileDef("floor-door-e", (x, y) => (y >= 26 && y <= 28 && x <= T - 3 ? "N" : lane(1)(x, y)));

// ==== The battle circle: a polished maple court cut to an octagon, a bold orange line and a teal band round it.

const CX = 10 * T; // its middle, in the room's floor pixels (column 10's west edge, row 11's north edge)
const CY = 11 * T;
const HALF = 4 * T; // its straight sides' distance from the middle
const CUT = 6 * T; // |dx| + |dy| on its slanted sides
/** The court at a floor pixel (gx, gy): its line, its band, the maple boards (east to west); null outside it. No marks. */
function court(gx: number, gy: number): Key {
  const ax = Math.abs(gx + 0.5 - CX);
  const ay = Math.abs(gy + 0.5 - CY);
  const e = Math.min(HALF - ax, HALF - ay, (CUT - ax - ay) / Math.SQRT2); // how deep inside its edge
  if (e < 0) return null;
  if (e < 1) return "E";
  if (e < 5) return "G"; // the bold orange line
  if (e < 6.5) return "N";
  if (e < 15) return e < 7.5 ? "B" : "C"; // the teal band
  if (e < 16.5) return "N";
  // The maple: boards 5 px wide running east to west, their end joints staggered, lit and shaded by turns.
  const row = Math.floor(gy / 5);
  const j = ((gy % 5) + 5) % 5;
  const len = 46 + Math.floor(grain(row, 1, 50) * 30);
  const off = Math.floor(grain(row, 2, 50) * len);
  if ((((gx + off) % len) + len) % len === 0) return "Y";
  if (j === 4) return "T";
  const tone = grain(Math.floor((gx + off) / len), row, 51);
  return tone > 0.82 ? "P" : tone < 0.1 ? "T" : "Q";
}

/** The start marks: round try-on mats on the middle line, the boss's orange with a paw, yours teal with a pair of sneaker soles. */
const MARKS = { boss: [8, 10.5] as Pt, you: [11, 10.5] as Pt };
export const SHOP_BLITZ_MARKS = { boss: [8, 10.5], you: [11, 10.5] } as const;
const SOLE = [".OOO.", "OOOOO", "OOOOO", "O...O", "OOOOO", "OOOOO", ".OOO.", ".OOO.", "O...O", ".OOO.", ".OOO.", "..O.."];
function markAt(gx: number, gy: number): Key {
  for (const [who, [mc, mr]] of Object.entries(MARKS)) {
    const mx = (mc + 0.5) * T;
    const my = (mr + 0.5) * T; // row 10.5's middle: the line between rows 10 and 11, y = 11 x 37, the emblem's middle
    const X = gx + 0.5 - mx;
    const Y = gy + 0.5 - my;
    const d = Math.hypot(X, Y);
    if (d > 15.5) continue;
    const boss = who === "boss";
    if (d > 14.3) return boss ? "E" : "A"; // the mat's rim
    if (d > 12.8) return boss ? "F" : "B";
    if (boss) {
      const pad = (X / 5) ** 2 + ((Y - 3) / 3.8) ** 2 <= 1;
      const toe = ([[-6, -3.5], [-2.2, -6.8], [2.2, -6.8], [6, -3.5]] as const).some(([tx, ty]) => Math.hypot(X - tx, Y - ty) < 1.9);
      if (pad || toe) return "O";
      return X + Y > 9 ? "F" : "G";
    }
    // Yours: a pair of sneaker soles, side by side.
    for (const sx of [-6, 1]) {
      const i = Math.floor(X - sx);
      const j = Math.floor(Y + 6);
      if (SOLE[j]?.[i] === "O") return "O";
    }
    return X + Y > 9 ? "B" : "C";
  }
  return null;
}

/** The center circle in the middle (where the table stands), 2 x 2 squares: a white ring round a teal disc, an orange cheetah paw. */
function emblemAt(gx: number, gy: number): Key {
  const X = gx + 0.5 - CX;
  const Y = gy + 0.5 - CY;
  const d = Math.hypot(X, Y);
  if (d > 34) return null;
  if (d > 30.5) return d > 33 ? "E" : "G";
  if (d > 29) return "N";
  const pad = (X / 10.5) ** 2 + ((Y - 6) / 8) ** 2 - (Y > 6 ? (Math.abs(X) / 10.5) * 0.3 : 0);
  const toes: readonly Pt[] = [[-13, -4], [-5.5, -11.5], [5.5, -11.5], [13, -4]];
  const toe = toes.map(([tx, ty]) => Math.hypot(X - tx, (Y - ty) * 0.9)).reduce((a, b) => Math.min(a, b));
  if (pad <= 1) return pad > 0.72 ? "E" : X + Y > 6 ? "F" : "G";
  if (toe < 4.2) return toe > 3.3 ? "E" : X + Y > -6 ? "F" : "G";
  return X + Y > 22 ? "B" : "C";
}

/** The circle's tiles: every square the octagon touches, drawn where it lies (marks and the emblem in it), plain floor round it. */
const circleFn = (col: number, row: number) => (x: number, y: number) => {
  const gx = col * T + x;
  const gy = row * T + y;
  if (court(gx, gy) === null) return floorAt(col, row)(x, y);
  return emblemAt(gx, gy) ?? markAt(gx, gy) ?? court(gx, gy);
};
const CIRCLE = new Set<string>();
for (let row = 7; row <= 14; row++)
  for (let col = 6; col <= 13; col++) {
    let any = false;
    for (let y = 0; y < T && !any; y += 3) for (let x = 0; x < T && !any; x += 3) any = court(col * T + x, row * T + y) !== null;
    if (!any) continue;
    CIRCLE.add(`${col},${row}`);
    tileDef(`circle-${col}-${row}`, circleFn(col, row));
  }

// ==== The back wall: a teal fascia with a neon tube, white walls of lit sneaker shelves, big windows onto a skate park.

const WALL_H = 130;
const PILLAR_UP = 20;
const BEAM = 12;
/** The fascia along the top: dark teal, a teal neon tube along it (it lights at night). */
const fascia = (y: number) => (y === 0 ? "k" : y === 5 ? "^" : y === 4 || y === 6 ? "@" : y === BEAM - 1 ? "y" : y < 3 ? "B" : "A");
/** The white wall's skirting along the floor. */
const skirt = (y: number) => (y >= WALL_H - 4 ? (y === WALL_H - 4 ? "2" : "1") : null);

const NICHE = { x0: 3, x1: 33, y0: 18, y1: 116 } as const;
const SHELF_YS = [34, 50, 66, 82, 98, 114];
/** A wall of lit shelves of sneakers, its top at y0: a white wall, a pale niche, white shelves with light strips under them. */
function shelfCv(c: Cv, y0: number, seed: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < BEAM) return fascia(y);
    const sk = skirt(y);
    if (sk) return sk;
    if (x < NICHE.x0 || x > NICHE.x1 || y < NICHE.y0 || y > NICHE.y1) return x === NICHE.x1 + 1 && y >= NICHE.y0 && y <= NICHE.y1 ? "y" : y === NICHE.y1 + 1 && x >= NICHE.x0 ? "x" : "w";
    if (SHELF_YS.includes(y)) return "O";
    if (SHELF_YS.includes(y - 1)) return "M";
    if (SHELF_YS.includes(y - 2)) return "X"; // the light strip under the shelf
    return x === NICHE.x0 || y === NICHE.y0 ? "J" : "M";
  });
  SHELF_YS.forEach((sy, n) => {
    kick(c, 5, y0 + sy - 6, seed + n * 3, n % 2 === 1);
    kick(c, 20, y0 + sy - 6, seed + n * 3 + 1, n % 2 === 0);
  });
}
const shelfDef = (name: string, seed: number) => {
  const c = cv(T, WALL_H);
  shelfCv(c, 0, seed);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
export const SHOP_BLITZ_WALL_SHELF = shelfDef("wall-shelf", 0);
export const SHOP_BLITZ_WALL_SHELF_B = shelfDef("wall-shelf-b", 7);

/** A white pilaster from `top` to `foot`: lit on its left, a cap on top. */
const pilaster = (cx: number, top: number, foot: number, hw = 6) =>
  paint(cx - hw, top, 2 * hw + 1, foot - top, (x, y) => {
    const X = x - cx;
    const j = y - top;
    if (j < 3) return j === 0 ? "O" : "N";
    if (j === 3) return "y";
    if (y >= foot - 4) return y === foot - 4 ? "2" : "1";
    return X < -hw + 2 ? "O" : X > hw - 3 ? (X === hw ? "y" : "x") : "w";
  });
export const SHOP_BLITZ_WALL_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  shelfCv(c, PILLAR_UP, 3);
  return def("wall-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), pilaster(18, 1, h)]]);
})();

/** The big windows: frames of black metal, a view across three panes (the left, the middle, the right) of a sunny skate park. */
const WIN_T = 16;
const SILL = 102;
const GT = WIN_T + 3;
const GB = SILL - 1;
const GROUND = 84;
function view(vx: number, y: number): string {
  // The skate park's concrete, a quarter pipe on the left, a rail in the middle, a palm on the right.
  const palm = Math.abs(vx - 93 - (GROUND - y) * 0.12) < 1.6 && y > 44 && y < GROUND + 2;
  if (palm) return vx - 93 - (GROUND - y) * 0.12 < 0 ? "d" : "b";
  for (const [fx, fy, a] of [[93, 44, -2.6], [93, 44, -0.4], [94, 44, 0.3], [94, 44, 2.7], [93, 44, 1.6], [93, 44, -1.5]] as const) {
    const t = (vx - fx) / Math.cos(a) / 14;
    const sy = fy + Math.sin(a) * 14 * t + 7 * t * t;
    if (t >= 0 && t <= 1 && Math.abs(y - sy) < 1.6 - t) return y < sy ? "0" : "!";
  }
  if (y >= GROUND) {
    if (vx >= 52 && vx <= 80 && y === GROUND + 6) return "1"; // the rail
    if ((vx === 55 || vx === 77) && y > GROUND + 6 && y < GROUND + 12) return "2";
    if (y === GROUND) return "9";
    return (vx * 7 + y * 3) % 41 === 0 ? "9" : "8";
  }
  // The quarter pipe.
  const qx = vx - 4;
  if (qx >= 0 && qx < 26) {
    const top = GROUND - 22 + (26 - qx > 22 ? 0 : 22 - Math.sqrt(Math.max(0, 22 * 22 - (22 - (26 - qx)) ** 2)));
    const lip = GROUND - 22;
    if (y >= lip && y >= top) return y < top + 1.5 ? (qx < 5 ? "C" : "8") : qx < 4 ? "9" : (qx + y) % 9 === 0 ? "9" : "8";
  }
  // A green park belt, then the city's towers far off, then the sky.
  if (y >= GROUND - 8) return (vx + y) % 5 === 0 ? "!" : y === GROUND - 8 && vx % 4 === 1 ? "!" : "0";
  const bx = Math.floor(vx / 9);
  const top = 38 + Math.floor(grain(bx, 0, 60) * 26);
  if (y >= top) {
    if ((vx % 9) % 3 === 1 && (y - top) % 4 === 2 && grain(vx, y, 61) > 0.5) return "5";
    return grain(bx, 1, 60) > 0.5 ? "6" : "7";
  }
  const t = (y - GT) / (top - GT);
  return t < 0.45 ? (t / 0.45 < bayer(vx, y) ? "3" : "4") : (t - 0.45) / 0.55 < bayer(vx, y) ? "4" : "5";
}
function windowCv(c: Cv, y0: number, pane: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < BEAM) return fascia(y);
    const sk = skirt(y);
    if (sk) return sk;
    if (y >= SILL) return y < SILL + 4 ? (y === SILL ? "O" : y === SILL + 3 ? "x" : "N") : "w";
    if (y < WIN_T) return "w";
    // The frame: thick on the group's outer sides, a thin mullion between panes.
    const outerL = pane === 0 ? 3 : 0;
    const outerR = pane === 2 ? T - 4 : T;
    if (x < outerL || x > outerR) return "w";
    if (y < GT || x < outerL + (pane === 0 ? 3 : 1) || x > outerR - (pane === 2 ? 3 : 1)) return y === WIN_T || x === outerL ? "2" : "1";
    const vx = pane * T + x;
    if ((vx + y) % 46 === 30 || (vx + y) % 46 === 31 || (vx + y) % 46 === 35) return "u"; // reflections
    return view(vx, y);
  });
}
const winDef = (name: string, pane: number) => {
  const c = cv(T, WALL_H);
  windowCv(c, 0, pane);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
export const SHOP_BLITZ_WALL_WIN_L = winDef("wall-win-l", 0);
export const SHOP_BLITZ_WALL_WIN_M = winDef("wall-win-m", 1);
export const SHOP_BLITZ_WALL_WIN_R = winDef("wall-win-r", 2);

// ==== The side walls: white, the teal fascia, two lit shelves of sneakers on the band that shows (the walls run away north).

function sideCv(c: Cv, y0: number, seed: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y < BEAM) return fascia(y);
    if (y >= WALL_H - 1) return "1";
    if (x >= T - 4) return x === T - 4 ? "y" : x === T - 3 ? "O" : "w"; // the corner trim on its inner (east) edge
    if (y === 24 || y === 38) return "O";
    if (y === 25 || y === 39) return "M";
    if (y === 26 || y === 40) return "X";
    return x < 3 ? "x" : "w";
  });
  for (const [sy, n] of [[24, 0], [38, 2]] as const) {
    kick(c, 3, y0 + sy - 6, seed + n, false);
    kick(c, 17, y0 + sy - 6, seed + n + 1, true);
  }
}
const sideDef = (name: string, seed: number) => {
  const c = cv(T, WALL_H);
  sideCv(c, 0, seed);
  return def(name, [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
};
export const SHOP_BLITZ_WALL_SIDE = sideDef("wall-side", 1);
export const SHOP_BLITZ_WALL_SIDE_B = sideDef("wall-side-b", 9);
export const SHOP_BLITZ_WALL_SIDE_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  sideCv(c, PILLAR_UP, 5);
  return def("wall-side-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), pilaster(18, 1, h)]]);
})();

// ==== The front (south) wall: a low white wall with a teal cap, and the way out.

const HEM_H = 24;
function hemCv(c: Cv, y0: number) {
  fill(c, (x, yy) => {
    const y = yy - y0;
    if (y < 0) return null;
    if (y === 0) return "k";
    if (y < 4) return y === 1 ? "D" : y === 2 ? "C" : "B";
    if (y >= HEM_H - 3) return y === HEM_H - 3 ? "2" : "1";
    return y === 4 ? "x" : "w";
  });
}
export const SHOP_BLITZ_HEM = (() => {
  const c = cv(T, HEM_H);
  hemCv(c, 0);
  return def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
})();
export const SHOP_BLITZ_HEM_PILLAR = (() => {
  const h = WALL_H + PILLAR_UP;
  const c = cv(T, h);
  hemCv(c, h - HEM_H);
  return def("hem-pillar", [1, 1], T, h, [18, h - 1], [[whole(c), pilaster(18, 1, h)]]);
})();

/**
 * The entrance, two squares wide: a black metal door frame round the bright street outside (the sidewalk, the road, the
 * houses across it), both glass doors swung open, a green EXIT sign over it. Plainly the way out.
 */
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
const E_TOP = 40; // the opening's top
const EO0 = 9; // the opening's west and east
const EO1 = 64;
const EXIT = ["###.#.#.###.###", "#...#.#..#...#.", "##...#...#...#.", "#...#.#..#...#.", "###.#.#.###..#."];
export const SHOP_BLITZ_ENTRANCE = (() => {
  const out = paint(EO0, E_TOP, EO1 - EO0 + 1, EFOOT - E_TOP + 1, (x, y) => {
    if (y >= EFOOT - 3) return y === EFOOT - 3 ? "O" : y === EFOOT ? "J" : "M"; // the threshold
    if (y >= 86) return (x + y) % 7 === 0 ? "9" : y === 86 ? "9" : "8"; // the sidewalk
    if (y >= 78) return y === 78 || y === 85 ? "2" : x % 10 < 5 && y === 81 ? "N" : "I"; // the road, its dashes
    if (y >= 58) {
      const hx = Math.floor((x - EO0) / 14);
      const top = 58 + Math.floor(grain(hx, 0, 70) * 6);
      if (y < top) return t2(x, y);
      if ((x - EO0) % 14 === 13) return "x";
      return (x - EO0) % 14 > 4 && (x - EO0) % 14 < 9 && y > top + 4 && y < 75 ? "4" : ["H", "D", "w", "d", "C"][hx % 5]!;
    }
    return t2(x, y);
  }, false);
  function t2(x: number, y: number) {
    return (y - E_TOP) / 22 < bayer(x, y) ? "4" : "5";
  }
  // The two glass doors, swung open against the frame: narrow slivers of glass in black frames.
  const doors = [EO0, EO1 - 5].map((dx) =>
    paint(dx, E_TOP + 1, 6, EFOOT - E_TOP - 4, (x, y) => {
      const i = x - dx;
      if (i === 0 || i === 5 || y === E_TOP + 1 || y === EFOOT - 4) return "1";
      return y === E_TOP + 40 ? "J" : (x + y) % 9 === 0 ? "O" : "u";
    }),
  );
  const frame = paint(0, E_TOP - 22, EW, EFOOT - E_TOP + 24, (x, y) => {
    if (x >= EO0 && x <= EO1 && y >= E_TOP) return null;
    if (y < E_TOP - 20) return y === E_TOP - 22 ? "k" : "1";
    return x < 3 || y < E_TOP - 18 ? "2" : "1";
  });
  const sign = cv(EW, EH);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 19; i++) put(sign, EW / 2 - 9 + i, E_TOP - 17 + j, i === 0 || j === 0 || i === 18 || j === 8 ? "t" : "e");
  stamp(sign, EW / 2 - 7, E_TOP - 15, EXIT.map((r) => r.replace(/#/g, "O")));
  return def("entrance", [2, 1], EW, EH, [EW / 2, EFOOT], [bits(groundShadow(EW / 2, EFOOT - 1, 34, 3), out, ...doors, frame, cropBit(sign))]);
})();

// ==== The backdrop behind the counter: a teal feature wall of white sneaker cubbies under the orange neon sneaker.

const BDW = 4 * T;
const BDH = WALL_H + PILLAR_UP;
const NEON_AT: Pt = [58, PILLAR_UP + 17]; // the neon sneaker's heel, top-left
const CUB = { x: 6, y: 60, w: 17, h: 13, cols: 8, rows: 6 } as const;
export const SHOP_BLITZ_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  fill(c, (x, yy) => {
    const y = yy - PILLAR_UP;
    if (y < 0) return null;
    if (y < BEAM) return fascia(y);
    const sk = skirt(y);
    if (sk) return sk;
    const ci = x - CUB.x;
    const cj = yy - CUB.y;
    if (ci >= 0 && ci <= CUB.w * CUB.cols && cj >= 0 && cj <= CUB.h * CUB.rows) {
      const i = ci % CUB.w;
      const j = cj % CUB.h;
      if (i < 2 || j < 2) return j === 0 || i === 0 ? "O" : "N"; // the white cubbies' walls, lit on top and left
      if (ci === CUB.w * CUB.cols) return "M";
      if (cj === CUB.h * CUB.rows) return "M";
      return j === 2 ? "X" : i === 2 ? "B" : "A"; // inside: a light along its top, dark teal behind
    }
    return (x % 37 === 0 && y > BEAM) ? "A" : y === BEAM ? "A" : "B";
  });
  for (let r = 0; r < CUB.rows; r++) for (let q = 0; q < CUB.cols; q++) kick(c, CUB.x + q * CUB.w + 3, CUB.y + r * CUB.h + CUB.h - 6, r * 5 + q * 3 + 2, (r + q) % 2 === 1);
  neonShoe(c, NEON_AT[0], NEON_AT[1]);
  return def("backdrop", [4, 1], BDW, BDH, [BDW / 2, BDH - 1], [[whole(c)]]);
})();

// ==== The counter: a glossy white checkout counter with a teal and an orange stripe, a black top, low (the kid shows over it).

const CW = 4 * T;
const CH = 46;
const CFOOT = CH - 3;
const CTOP = 14; // the counter is 30 px tall
/** The plaque on its front (blank: the game writes on it). */
const PLQ = { x: 43, y: CTOP + 7, w: 62, h: 17 } as const;
export const SHOP_BLITZ_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
/** Where the crate stands on the counter: its foot, in the counter's pixels (on the right, clear of the plaque). */
export const SHOP_BLITZ_CRATE_AT: Pt = [124, CTOP + 2];
export const SHOP_BLITZ_COUNTER = (() => {
  const n = CW - 4;
  const body = paint(2, CTOP, n, CFOOT - CTOP + 1, (x, y) => {
    const j = y - CTOP;
    const i = x - 2;
    if (j < 4) return j === 0 ? "I" : j === 1 && (i < 30 || (i > 60 && i < 70)) ? "2" : "1"; // the black top, a shine on it
    if (j >= CFOOT - CTOP - 2) return j === CFOOT - CTOP - 2 ? "2" : "1"; // the kick plate
    if (j >= 13 && j <= 16) return j === 16 ? "B" : "C"; // the teal stripe
    if (j === 17 || j === 18) return j === 17 ? "G" : "F"; // the orange
    return i < 3 ? "O" : i > n - 5 ? "M" : j === 4 ? "M" : "N";
  });
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "ABCD", "MNO", "I");
  const on = cv(CW, CH);
  // The register: a till under a tilted screen (lit teal).
  stamp(on, 8, CTOP - 13, ["..11111111111..", "..1DDDDDDDCC1..", "..1DDCCCCCCC1..", "..1DCCCCCCCC1..", "..11111111111..", "......121......", "......121......", ".1111111111111.", "12222222222222I", "1222IIII222222I", "1111111111111I."]);
  // A little sneaker on a clear riser.
  stamp(on, 32, CTOP - 4, ["uuuuuuuuuuuuuu", "uOuuuuuuuuuuuu", "uuuuuuuuuuuuuu", "MMMMMMMMMMMMMM"]);
  kick(on, 33, CTOP - 10, 5);
  // Two shoe boxes.
  for (const [bx, by] of [[86, CTOP - 6], [87, CTOP - 12]] as const)
    stamp(on, bx, by, ["HHHHHHHHHHHHHHG", "FFFFFFFFFFFFFFF", "GGGOGGGGGGGGGGF", "GGGGOOGGGGGGGGF", "GGGGGGOOOGGGGGF", "EEEEEEEEEEEEEEE"]);
  return def("counter", [4, 1], CW, CH, [CW / 2, CFOOT], [bits(groundShadow(CW / 2, CFOOT, CW / 2 - 2, 4), body, plaque, cropBit(on))]);
})();

/**
 * Blitz's Boss Crate: a big orange shoe box with a teal lid, a cream paw print and a white stripe on its front, a
 * cheetah-spotted ribbon round it tied in a bow on top. `idle`: a glint runs along the lid and winks on the bow (6 frames).
 */
const XW = 34;
const XH = 30;
export const SHOP_BLITZ_CRATE = (() => {
  const box = paint(1, 12, 32, 16, (x, y) => {
    const j = y - 12;
    if (j === 15) return "E";
    if (x > 28) return "F";
    const paw = (Math.hypot(x + 0.5 - 8, (y + 0.5 - 21) * 1.15) < 3) || ([[4.5, 17], [7, 15.5], [10, 15.5], [12.5, 17]] as const).some(([tx, ty]) => Math.hypot(x + 0.5 - tx, y + 0.5 - ty) < 1.2);
    if (paw) return "O";
    if (y === Math.round(26 - (x - 21) * 0.55) && x > 21 && x < 29) return "O"; // its stripe
    return x < 3 ? "H" : "G";
  });
  const lid = paint(0, 7, 34, 6, (x, y) => {
    const j = y - 7;
    if (j === 0) return x < 26 ? "D" : "C";
    if (j === 5) return "A";
    return j === 4 ? "B" : x > 30 ? "B" : "C";
  });
  const spots = (x: number, y: number, base: string) => ((x * 3 + y * 5) % 7 === 0 ? "s" : base);
  const ribbon = paint(15, 7, 4, 21, (x, y) => spots(x, y, x === 15 ? "d" : x === 18 ? "b" : "c"));
  const bow = paint(7, 0, 20, 8, (x, y) => {
    for (const [lx, sg] of [[11.5, -1], [22.5, 1]] as const) {
      const d = Math.hypot((x + 0.5 - lx) / 4.6, (y + 0.5 - 3.6) / 2.9);
      if (d <= 1 && d > 0.45) return spots(x, y, sg < 0 ? "d" : "c");
    }
    if (Math.abs(x + 0.5 - 17) < 2.2 && y >= 3 && y <= 7) return spots(x, y, "c");
    return null;
  });
  const frames = [0, 1, 2, 3, 4, 5].map((f) => {
    const g = cv(XW, XH);
    const gx = [-9, 3, 9, 16, 24, -9][f]!;
    if (gx > 0) stamp(g, gx, 6, [".O.", "OOO", ".O."]);
    if (f === 5) stamp(g, 9, 0, [".O.", "OOO", ".O."]);
    return bits(groundShadow(XW / 2, XH - 2, 15, 2), box, lid, ribbon, bow, cropBit(g, false));
  });
  return def("crate", [1, 1], XW, XH, [XW / 2, XH - 2], frames, 220);
})();

// ==== Racks and rows: freestanding chrome racks of sneakers, stacks and shelves of shoe boxes.

/** A shoe box seen from the front, `w` wide and 6 tall, its top-left at (x, y): 0 orange, 1 teal lid, 2 black. A white stripe on its side. */
function shoebox(c: Cv, x: number, y: number, w: number, style: number) {
  const [lid, lip, body, dark, mark] = [...["HFGEO", "DBGEO", "21IIS"][style]!] as [string, string, string, string, string];
  for (let i = 0; i < w; i++)
    for (let j = 0; j < 6; j++) {
      let k = j === 0 ? (i < w - 3 ? lid : lip) : j === 1 ? lip : j === 5 ? dark : i === w - 1 ? dark : body;
      if (j >= 2 && j <= 4 && i >= 3 && i <= 9 && j === Math.round(4.4 - (i - 3) * 0.4)) k = mark;
      put(c, x + i, y + j, k);
    }
}
/** The end of a shoe box (10 x 7) as it sits in a shelf: its lid's end, a white label, the stripe. */
function boxEnd(c: Cv, x: number, y: number, style: number) {
  const [lid, lip, body, dark] = [...["HFGE", "DBGE", "21II"][style]!] as [string, string, string, string];
  stamp(c, x, y, [lid.repeat(9) + lip, lip.repeat(10), body + "OO" + body.repeat(6) + dark, body + "OO" + body.repeat(6) + dark, body.repeat(5) + "O" + body.repeat(3) + dark, body.repeat(3) + "OO" + body.repeat(4) + dark, dark.repeat(10)]);
}

const RACK_W = 2 * T;
const RACK_H = 60;
const rackDef = (name: string, seed: number) => {
  const F = RACK_H - 3;
  const c = cv(RACK_W, RACK_H);
  const chrome = (x: number, x0: number) => (x === x0 ? "O" : x === x0 + 2 ? "I" : "J");
  for (let y = 6; y <= F; y++) for (const x0 of [4, 67]) for (let x = x0; x < x0 + 3; x++) put(c, x, y, chrome(x, x0));
  for (let x = 4; x < 70; x++) (put(c, x, 6, "N"), put(c, x, 7, "J"));
  [22, 38, 54].forEach((sy, r) => {
    for (let x = 6; x < 67; x++) (put(c, x, sy, "M"), put(c, x, sy + 1, "I"));
    for (let n = 0; n < 4; n++) kick(c, 9 + n * 15, sy - 6, seed + n * 5 + r * 7, (n + r) % 2 === 1);
  });
  stamp(c, 2, F, ["11111", "....."]);
  stamp(c, 66, F, ["11111", "....."]);
  // A little teal card on top with a white lightning bolt.
  stamp(c, 27, 0, ["DDDDDDDDDDDDDDDDDDDD", "CCCCCCCCCCOOOCCCCCCB", "CCCCCCCCCOOCCCCCCCCB", "CCCCCCCCOOOOOOCCCCCB", "CCCCCCCCCCCOOCCCCCCB", "CCCCCCCCCCOOCCCCCCCB"]);
  return def(name, [2, 1], RACK_W, RACK_H, [RACK_W / 2, F], [bits(groundShadow(RACK_W / 2, F, 35, 3), cropBit(c))]);
};
export const SHOP_BLITZ_RACK = rackDef("rack", 1);
export const SHOP_BLITZ_RACK_B = rackDef("rack-b", 4);

/** A tall stack of shoe boxes, one square: seven boxes, a little uneven, one teal lid and one black box in it. */
export const SHOP_BLITZ_BOX_STACK = (() => {
  const W_ = T;
  const H_ = 58;
  const F = H_ - 4;
  const c = cv(W_, H_);
  const STY = [0, 0, 1, 0, 2, 0, 0];
  for (let n = 0; n < 7; n++) {
    const w = 26 - (n % 3);
    const x = 5 + Math.round((grain(n, 1, 80) - 0.5) * 4);
    shoebox(c, x, F - 6 * (n + 1), w, STY[n]!);
  }
  return def("box-stack", [1, 1], W_, H_, [Math.floor(W_ / 2), F], [bits(groundShadow(18, F, 16, 2), cropBit(c))]);
})();

/** A low white shelf unit of shoe boxes end-on, two squares: two levels, two boxes high each; a sneaker and a box on top. */
export const SHOP_BLITZ_BOX_ROW = (() => {
  const W_ = 2 * T;
  const H_ = 52;
  const F = H_ - 3;
  const unit = paint(2, 10, W_ - 4, F - 9, (x, y) => {
    const i = x - 2;
    if (y <= 11 || y === 28 || y === 29 || y >= F - 1) return y === 10 || y === 28 ? "O" : y === F ? "y" : "x"; // its boards
    if (i < 3) return i === 0 ? "O" : "w";
    if (i > W_ - 8) return i === W_ - 5 ? "y" : "x";
    return y === 12 || y === 30 ? "y" : "x"; // inside, in shade
  });
  const c = cv(W_, H_);
  for (const top of [13, 31]) for (let q = 0; q < 6; q++) for (let r = 0; r < 2; r++) boxEnd(c, 6 + q * 11, top + r * 7, (q * 2 + r + top) % 5 === 0 ? 1 : (q + r * 3 + top) % 7 === 0 ? 2 : 0);
  kick(c, 8, 4, 3);
  shoebox(c, 44, 4, 22, 1);
  return def("box-row", [2, 1], W_, H_, [W_ / 2, F], [bits(groundShadow(W_ / 2, F, 35, 3), unit, cropBit(c))]);
})();

// ==== Trying them on: a bench, a hero pair on a lit pedestal.

/** A try-on bench, two squares: a teal cushion on black legs, an open shoe box on it, a pair of sneakers under it. */
export const SHOP_BLITZ_BENCH = (() => {
  const W_ = 2 * T;
  const H_ = 36;
  const F = H_ - 3;
  const seat = paint(3, 14, W_ - 6, 8, (x, y) => {
    const j = y - 14;
    const i = x - 3;
    if ((i === 0 || i === W_ - 7) && j === 0) return null;
    if (j === 0) return "D";
    if (j < 4) return i < 3 ? "D" : i > W_ - 10 ? "B" : "C";
    if (j === 4) return "B";
    return "1"; // its black frame
  });
  const legs = paint(6, 22, W_ - 12, F - 21, (x) => (x <= 8 || x >= W_ - 9 ? (x === 6 || x === W_ - 9 ? "2" : "1") : null));
  const c = cv(W_, H_);
  // An open box on the seat: its lid leaning on it, white tissue, a sneaker in it.
  stamp(c, 40, 6, ["FGGGGGGGGGGGGGGGGGGF", "GNONOONONOONONONOOOG", "GGGGGGGGGGGGGGGGGGGF", "GGGGGGGGGGGGGGGGGGGF", "GGGOGGGGGGGGGGGGGGGF", "GGGGOOGGGGGGGGGGGGGF", "GGGGGGOOOGGGGGGGGGGF", "EEEEEEEEEEEEEEEEEEEE"]);
  kick(c, 44, 1, 11);
  stamp(c, 60, 0, ["....HH", "...HHF", "..HHGF", ".HHGGF", "HHGGGF", "HGGGGF", "GGGGGF", "FFFFFF"]);
  // A pair under it, waiting.
  kick(c, 16, F - 6, 0);
  kick(c, 29, F - 6, 0);
  return def("bench", [2, 1], W_, H_, [W_ / 2, F], [bits(groundShadow(W_ / 2, F, 34, 3), legs, seat, cropBit(c))]);
})();

/** The hero pair: a cheetah-print sneaker in a glass case on a tall white plinth, lit from above. */
const PDW = T;
const PDH = 72;
const PDF = PDH - 3;
const GLASS = { x: 7, y: 18, w: 23, h: 21 } as const;
export const SHOP_BLITZ_PEDESTAL = (() => {
  const plinth = paint(8, 40, 21, PDF - 39, (x, y) => {
    const i = x - 8;
    if (y === 40) return "O";
    if (y >= PDF - 1) return "y";
    return i < 3 ? "O" : i > 17 ? "x" : "N";
  });
  const slab = paint(6, 38, 25, 3, (x, y) => (y === 38 ? "O" : y === 40 ? "x" : x > 27 ? "M" : "N"));
  const glass = paint(GLASS.x, GLASS.y, GLASS.w, GLASS.h, (x, y) => {
    const i = x - GLASS.x;
    const j = y - GLASS.y;
    if (j === 0 || i === 0) return "O";
    if (i === GLASS.w - 1 || j === GLASS.h - 1) return "M";
    if (i + j === 6 || i + j === 7 || i + j === 11) return "O"; // its shine
    return "u";
  });
  const c = cv(PDW, PDH);
  kick(c, 12, 32, 5);
  return def("pedestal", [1, 1], PDW, PDH, [18, PDF], [bits(groundShadow(18, PDF, 14, 2), plinth, slab, glass, cropBit(c))]);
})();

// ==== Cheetah Chug: a drinks fridge, and the big pallet of cases stacked high in shrink-wrap.

const CHUG = ["###.#.#.#.#.###", "#...#.#.#.#.#..", "#...###.#.#.#.#", "#...#.#.#.#.#.#", "###.#.#.###.###"];
const FRW = T;
const FRH = 82;
const FRF = FRH - 3;
const FR_DOOR = { x: 7, y: 20, w: 23, h: 54 } as const;
export const SHOP_BLITZ_FRIDGE = (() => {
  const body = paint(3, 4, 31, FRF - 3, (x, y) => {
    const i = x - 3;
    const j = y - 4;
    if (j < 14) {
      // Its header: Cheetah Chug's loud orange, spotted, the word CHUG on it in teal.
      const L = CHUG[j - 5]?.[i - 8];
      if (L === "#") return "A";
      if (j === 0) return "H";
      if (j === 13) return "E";
      return (x * 3 + y * 5) % 11 === 0 && (j < 4 || j > 10) ? "s" : "G";
    }
    if (y >= FRF - 2) return "1";
    return i < 2 ? "C" : i > 27 ? "A" : "B";
  });
  const c = cv(FRW, FRH);
  for (let j = 0; j < FR_DOOR.h; j++)
    for (let i = 0; i < FR_DOOR.w; i++) {
      const x = FR_DOOR.x + i;
      const y = FR_DOOR.y + j;
      const shelf = j % 11;
      let k = shelf === 10 ? "J" : shelf === 0 ? "X" : "N";
      if (shelf >= 4 && shelf <= 9 && i >= 1 && i <= FR_DOOR.w - 3 && i % 4 !== 0) {
        const can = Math.floor(i / 4) + Math.floor(j / 11);
        k = shelf === 4 ? "J" : can % 2 ? "C" : "G";
        if (shelf === 7 && i % 4 === 2) k = can % 2 ? "D" : "H";
      }
      if (i === 0 || j === 0) k = "1";
      if (i === FR_DOOR.w - 1 || j === FR_DOOR.h - 1) k = "1";
      if ((i + j) % 23 === 9 && i > 1 && i < 20) k = "O"; // the glass's shine
      put(c, x, y, k);
    }
  for (let y = 36; y < 56; y++) put(c, 27, y, "J"); // its handle
  return def("fridge", [1, 1], FRW, FRH, [18, FRF], [bits(groundShadow(18, FRF, 16, 2), body, cropBit(c))]);
})();

const PLW = 2 * T;
const PLH = 102;
const PLF = PLH - 4;
export const SHOP_BLITZ_CHUG_PALLET = (() => {
  // The pallet: deck boards on three blocks.
  const pallet = paint(2, PLF - 8, PLW - 4, 9, (x, y) => {
    const j = y - (PLF - 8);
    const i = x - 2;
    if (j < 3) return j === 0 ? "h" : i % 12 === 11 ? "m" : "j";
    const block = i < 9 || (i > 30 && i < 39) || i > PLW - 14;
    if (j === 8) return block ? "m" : null;
    return block ? (j === 3 ? "h" : "j") : j === 3 ? "m" : "1";
  });
  // The cases: three across, five high; loud orange, the word CHUG, a teal band, cheetah spots.
  const c = cv(PLW, PLH);
  const CASE_W = 22;
  const CASE_H = 15;
  for (let r = 0; r < 5; r++)
    for (let q = 0; q < 3; q++) {
      const x0 = 4 + q * CASE_W;
      const y0 = PLF - 8 - (r + 1) * CASE_H;
      for (let j = 0; j < CASE_H; j++)
        for (let i = 0; i < CASE_W; i++) {
          const x = x0 + i;
          const y = y0 + j;
          let k = j === 0 ? "H" : j === CASE_H - 1 || i === CASE_W - 1 ? "E" : i === 0 ? "H" : "G";
          if (j >= 2 && j <= 6 && CHUG[j - 2]![i - 3] === "#") k = "O";
          else if (j >= 9 && j <= 11 && i < CASE_W - 1) k = j === 11 ? "B" : "C";
          else if (k === "G" && (x * 3 + y * 5) % 13 === 0 && (j < 2 || j > 7)) k = "s";
          // The shrink-wrap's sheen: pale streaks slanting across the stack.
          const sh = (((x * 2 - y) % 37) + 37) % 37;
          if (sh === 0 || sh === 1 || sh === 5) k = k === "O" ? "O" : k === "E" ? "F" : k === "s" ? "2" : "H";
          put(c, x, y, k);
        }
    }
  for (let y = PLF - 8 - 5 * CASE_H; y < PLF - 8; y++) put(c, 3, y, "N"); // the wrap's lit edge
  return def("chug-pallet", [2, 1], PLW, PLH, [PLW / 2, PLF], [bits(groundShadow(PLW / 2, PLF, 35, 3), pallet, cropBit(c))]);
})();

/** A snake plant in a white pot with a teal band. */
export const SHOP_BLITZ_PLANT = (() => {
  const W_ = T;
  const H_ = 60;
  const F = H_ - 3;
  const pot = paint(10, 40, 17, F - 39, (x, y) => {
    const i = x - 10;
    if (y === 40) return "O";
    if (y >= 44 && y <= 46) return y === 46 ? "B" : "C";
    return i < 3 ? "O" : i > 13 ? "M" : "N";
  });
  const leaves = paint(4, 8, 29, 34, (x, y) => {
    const X = x + 0.5 - 18.5;
    const Y = y + 0.5 - 25;
    const lobe = Math.hypot(X / 13.5, Y / 15) + (grain(Math.floor((Math.atan2(Y, X) + 4) * 3), 0, 90) - 0.5) * 0.18;
    if (lobe > 1) return null;
    const leaf = grain(Math.floor((x + 1) / 3), Math.floor((y + (x % 3)) / 3), 91);
    const lit = X + Y < -4 ? 0.3 : X + Y > 8 ? -0.3 : 0;
    return leaf + lit > 0.75 ? "0" : leaf + lit > 0.3 ? "!" : x % 3 === 0 ? "!" : "A";
  });
  return def("plant", [1, 1], W_, H_, [18, F], [bits(groundShadow(18, F, 12, 2), leaves, pot)]);
})();

// ==== The showpiece: a wooden halfpipe in the corner, its skateboard rolling back and forth by itself.

/**
 * A mini halfpipe four squares wide and two deep (columns 15-18, rows 3-4), its U running east to west: two quarter
 * pipes of light plywood with a flat between, teal coping at both lips, decks with teal rails, a plywood side with its
 * framing toward us. `idle`: a skateboard rides it with nobody on it, up one wall, down through the flat in a streak of
 * speed lines and up the other, and back: 10 frames, a pendulum's ease at the lips.
 */
const SPW = 4 * T;
const SP_RISE = 40;
const SPH = SP_RISE + 2 * T;
const SPF = SP_RISE + T + 18; // its foot: the middle of its south row
const R_ = 40; // the transitions' radius
const HP_D = 30; // its depth, as it shows (the far edge this far up)
const GY = SPF; // the ground along its front
const YB = GY - 6; // the flat's surface at the front
const LIP_L = 20;
const LIP_R = SPW - 20;
const FLAT0 = LIP_L + R_;
const FLAT1 = LIP_R - R_;
/** The surface's front edge at x (the decks' tops past the lips). */
const yFront = (x: number) => {
  if (x <= LIP_L || x >= LIP_R) return YB - R_;
  if (x < FLAT0) return YB - (R_ - Math.sqrt(R_ * R_ - (FLAT0 - x) ** 2));
  if (x > FLAT1) return YB - (R_ - Math.sqrt(R_ * R_ - (x - FLAT1) ** 2));
  return YB;
};
/** A point on the riding line at arc length `s` from the west lip: where, which way along, which way off the surface. */
const ARC = (Math.PI / 2) * R_;
const LEN = 2 * ARC + (FLAT1 - FLAT0);
function onRamp(s: number): { p: Pt; t: Pt; n: Pt } {
  if (s < ARC) {
    const a = s / R_;
    return { p: [FLAT0 - R_ * Math.cos(a), YB - R_ + R_ * Math.sin(a)], t: [Math.sin(a), Math.cos(a)], n: [Math.cos(a), -Math.sin(a)] };
  }
  if (s < ARC + FLAT1 - FLAT0) return { p: [FLAT0 + s - ARC, YB], t: [1, 0], n: [0, -1] };
  const a = (s - ARC - (FLAT1 - FLAT0)) / R_;
  return { p: [FLAT1 + R_ * Math.sin(a), YB - R_ + R_ * Math.cos(a)], t: [Math.cos(a), -Math.sin(a)], n: [-Math.sin(a), -Math.cos(a)] };
}
export const SHOP_BLITZ_SHOWPIECE = (() => {
  const N = 10;
  // The ramp: the riding surface between its front and far edges, the decks, the plywood side below.
  const ramp = paint(4, 0, SPW - 8, GY + 1, (x, y) => {
    const yf = Math.round(yFront(x + 0.5));
    const deck = x < LIP_L || x >= LIP_R;
    if (y > yf) {
      // Its side toward us: plywood, a lit edge under the lip line, studs and a rail of its framing.
      if (y === yf + 1) return "h";
      if (y >= GY - 1) return "m";
      if (y === GY - 4 || (x - 4) % 16 === 0 || x === LIP_L || x === LIP_R) return "m";
      return deck ? "j" : (x + y) % 23 === 0 ? "m" : "j";
    }
    if (y <= yf - HP_D) return y === yf - HP_D ? (deck ? "h" : "Y") : null; // the far edge
    if (deck) return (y - (yf - HP_D)) % 6 === 0 ? "j" : "h"; // the decks' tops
    // The surface: shaded by which way it faces (the west transition away from the light, the east toward it), seams across it.
    if ([28, 44, 74, 104, 120].includes(x)) return "T";
    if (x < FLAT0) return x < FLAT0 - 14 ? "T" : "Q";
    if (x > FLAT1) return x > FLAT1 + 14 ? "P" : "Q";
    return y === yf ? "P" : "Q";
  });
  // Teal coping along both lips, from the front to the far edge.
  const coping = [LIP_L, LIP_R].map((lx) =>
    paint(lx - 1, YB - R_ - HP_D, 3, HP_D + 1, (x) => (x === lx - 1 ? "D" : x === lx ? "C" : "B")),
  );
  // Rails along the decks' far edges.
  const rails = [6, LIP_R + 1].map((x0) =>
    paint(x0, YB - R_ - HP_D - 12, 14, 12, (x, y) => {
      const j = y - (YB - R_ - HP_D - 12);
      if (j < 2) return j === 0 ? "D" : "C";
      return x === x0 || x === x0 + 13 ? "B" : null;
    }),
  );
  const frames = Array.from({ length: N }, (_, f) => {
    const ph = (2 * Math.PI * f) / N;
    const s = LEN / 2 + LEN * 0.42 * Math.sin(ph);
    const v = Math.cos(ph); // its speed and way (east when > 0)
    const { p, t, n } = onRamp(s);
    const c = cv(SPW, SPH);
    const at_ = (u: number, h: number, k: string) => put(c, Math.round(p[0] + t[0] * u + n[0] * h - 0.5), Math.round(p[1] - HP_D / 2 + t[1] * u + n[1] * h - 0.5), k);
    // Speed lines behind it, going fast through the flat.
    if (Math.abs(v) > 0.5)
      for (const [h, l0, l1] of [[3, 11, 19], [6, 12, 23], [9, 11, 17]] as const) for (let u = l0; u <= l1; u++) at_(-Math.sign(v) * u, h, u > l1 - 3 ? "@" : "^");
    // The board: its deck (black grip on top, orange underneath) with kicked-up ends, two trucks, four wheels (two show).
    for (let u = -8; u <= 8; u += 0.5) {
      const kick = Math.max(0, Math.abs(u) - 6) * 0.9;
      at_(u, 4 + kick, "1");
      at_(u, 3 + kick, "G");
    }
    for (const u of [-5, 5]) {
      at_(u, 2, "J");
      for (const [du, dh] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, 1.4], [0.5, 1.4]] as const) at_(u + du, dh, dh > 1 ? "N" : "M");
    }
    return bits(groundShadow(SPW / 2, GY, 70, 4), ramp, ...coping, ...rails, cropBit(c));
  });
  return def("showpiece", [4, 2], SPW, SPH, [Math.floor(SPW / 2), SPF], frames, 110);
})();

// ==== The lights at dusk and night, each on its piece (`piece`; x, y in its own pixels).

const NEON_TEAL = "#4ff0e0";
const NEON_ORANGE = "#ff9a3c";
const COOL = "#eaf6ff";
/** The neon sneaker over the counter, the teal tube along the walls' fascia, the fridges, the pedestals' cases, the shelves' light strips. */
export const SHOP_BLITZ_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "backdrop", x: NEON_AT[0] - 12, y: NEON_AT[1] - 2, w: 54, h: 22, keys: "#$", color: NEON_ORANGE, strength: 1, halo: 36 },
  { piece: "backdrop", x: NEON_AT[0] - 12, y: NEON_AT[1] - 2, w: 54, h: 22, keys: "^@", color: NEON_TEAL, strength: 0.9 },
  { piece: "backdrop", x: 0, y: PILLAR_UP + 3, w: BDW, h: 5, keys: "^@", color: NEON_TEAL, strength: 0.7 },
  { piece: "backdrop", x: CUB.x, y: CUB.y, w: CUB.w * CUB.cols, h: CUB.h * CUB.rows, keys: "X", color: COOL, strength: 0.6 },
  ...["wall-shelf", "wall-shelf-b", "wall-win-l", "wall-win-m", "wall-win-r"].map((piece) => ({ piece, x: 0, y: 3, w: T, h: 5, keys: "^@", color: NEON_TEAL, strength: 0.7 })),
  ...["wall-shelf", "wall-shelf-b"].map((piece) => ({ piece, x: NICHE.x0, y: NICHE.y0, w: NICHE.x1 - NICHE.x0, h: NICHE.y1 - NICHE.y0, keys: "X", color: COOL, strength: 0.5 })),
  { piece: "fridge", x: FR_DOOR.x, y: FR_DOOR.y, w: FR_DOOR.w, h: FR_DOOR.h, keys: "NXJ", color: COOL, strength: 0.85, halo: 22 },
  { piece: "pedestal", x: GLASS.x, y: GLASS.y, w: GLASS.w, h: GLASS.h, keys: "uO", color: WARM, strength: 0.7, halo: 18 },
];
/** ... and pools on the floor: before the counter's wall, before each fridge and pedestal. */
export const SHOP_BLITZ_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "backdrop", x: BDW / 2, y: BDH + 6, rx: 80, ry: 14, color: NEON_ORANGE, strength: 0.18 },
  { piece: "fridge", x: FRW / 2, y: FRF + 4, rx: 22, ry: 8, color: COOL, strength: 0.25 },
  { piece: "pedestal", x: PDW / 2, y: PDF + 3, rx: 20, ry: 7, color: WARM, strength: 0.22 },
];

//@@PIECES@@

// ==== The layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  /** Quarter turns clockwise (floor tiles only), and mirrored left to right (the east wall). */
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  /** Squares wide, for the wide pieces, from `col` east. */
  w?: number;
  /** Squares deep, for the deep pieces, from `row` north: it stands on `row`, and covers the rows north of it too. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the shop. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (p) LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- The floor (every square): the lane from the door (rows 15-18) and before the counter (rows 4-6), the circle, terrazzo.
const SKID = new Set(["3,6", "16,11", "5,16", "14,17", "2,9"]);
const PAWS = new Set(["4,13", "15,6", "17,16", "12,5", "6,3"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const even = (col + row) % 2 === 0;
    if (CIRCLE.has(k)) at(`circle-${col}-${row}`, col, row, false);
    else if ((col === 9 || col === 10) && row === 18) at(col === 9 ? "floor-door-w" : "floor-door-e", col, row, false);
    else if ((col === 9 || col === 10) && ((row >= 15 && row <= 17) || (row >= 4 && row <= 6))) at(col === 9 ? "floor-lane-w" : "floor-lane-e", col, row, false);
    else if (SKID.has(k) && even) at("floor-c", col, row, false);
    else if (PAWS.has(k) && !even) at("floor-d", col, row, false);
    else at(even ? "floor-a" : "floor-b", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The walls: the back (north) wall on row 0, the sides on columns 0 and 19, the low front on row 19.
const BACKDROP = !!PIECES["backdrop"];
const BACK: Record<number, string> = { 0: "wall-pillar", 1: "wall-shelf", 2: "wall-win-l", 3: "wall-win-m", 4: "wall-win-r", 5: "wall-shelf-b", 6: "wall-shelf", 7: "wall-shelf-b" };
for (let col = 0; col < 20; col++) {
  if (BACKDROP && col >= 8 && col <= 11) {
    if (col === 8) at("backdrop", 8, 0, true);
    continue;
  }
  // The east half mirrors the west (the windows' panes swapped so their thick frames stay outside).
  const west = col < 10 ? col : 19 - col;
  let name = BACK[west] ?? "wall-shelf";
  if (col >= 10 && name === "wall-win-l") name = "wall-win-r";
  else if (col >= 10 && name === "wall-win-r") name = "wall-win-l";
  at(name, col, 0, true, col >= 10 && !name.startsWith("wall-win") ? { flip: true } : {});
}
for (let row = 1; row < 19; row++) {
  const side = row === 10 ? "wall-side-pillar" : row % 2 ? "wall-side" : "wall-side-b";
  at(side, 0, row, true);
  at(side, 19, row, true, { flip: true });
}
at("hem-pillar", 0, 19, true);
for (let col = 1; col < 19; col++) if (col < 9 || col > 10) at("hem", col, 19, true);
at("entrance", 9, 19, false, { exit: true });
at("hem-pillar", 19, 19, true, { flip: true });

// -- The shop and the props.
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_BLITZ_CRATE_AT): its place is the counter's
at("chug-pallet", 2, 3, true);
at("fridge", 4, 2, true);
at("plant", 6, 1, true);
at("fridge", 1, 5, true);
at("rack", 2, 8, true);
at("rack-b", 2, 11, true);
at("bench", 2, 14, true);
at("box-stack", 1, 17, true);
at("box-row", 3, 17, true);
at("plant", 13, 1, true);
at("rack-b", 16, 8, true);
at("pedestal", 17, 11, true);
at("pedestal", 15, 11, true);
at("rack", 16, 14, true);
at("box-row", 15, 17, true);
at("box-stack", 18, 17, true);
at("box-stack", 18, 6, true);
at("showpiece", 15, 4, true); // columns 15-18, rows 3-4
at("rack", 4, 5, true);
at("box-stack", 6, 17, true);
at("box-stack", 13, 17, true);
at("bench", 15, 9, true);
//@@PROPS@@

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_BLITZ_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

/** Every piece by its name (as SHOP_BLITZ_LAYOUT names them), each its own Character `shop-blitz-<name>`. */
export const SHOP_BLITZ_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));


void signBoard;
void signFace;
void WARM;
export type { LightPool, LightSpot };
