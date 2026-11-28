/**
 * MOCKUP ONLY (town-shop-mockup, Nov 28; not for merge). Inside the Pawn Shop: a box room of 12 x 12 squares, built exactly as the Battle
 * Tower's lobby is (shops/tower-art.ts, whose helpers, walls, hem and doors this copies): every piece its own Character, floor tiles first,
 * the back wall's pieces on row 0, the side walls one surface each, the front row's hem and the way out.
 *
 * Deep green, gold and cream over a plank floor. The board keeper's counter stands before a felt wall hung with six boards; in the middle,
 * three pale display tables (one of boards on little stands, two of items on white blocks: the items themselves are the game's ItemArt,
 * drawn by the mockup's scene); in the back corners two stalls with their curtains drawn and a "COMING SOON" card (the God King's stand,
 * the seasonal stall); shelves of boxes along both side walls; two plants by the door.
 */
import { renderFrame, type Character, type Frame, type Part } from "../../characters/sprite.ts";
import type { ShopPlace } from "./room.ts";
import { grain, groundShadow, signBoard, signFace, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";
import { GLYPHS, lineWidth } from "../sign-font.ts";
import { SKINS } from "../../dev/town-shop-skins.ts";

const T = 37;
/** The room's size in squares, each way. */
export const SHOP_MARKET_N = 10;
const N = SHOP_MARKET_N;

const PALETTE: Record<string, string> = {
  k: "#141210", // outline
  // Deep green, darkest to lit (the dado, the counter, the hem, the felt).
  "1": "#0c1d17",
  "2": "#143026",
  "3": "#1e3d33",
  "4": "#28503f",
  "5": "#3a6b55",
  "6": "#52886e",
  // Gold: pale light, gold, brushed mid, deep, dark.
  Y: "#ffd877",
  G: "#f4b740",
  y: "#dda334",
  g: "#c8860d",
  h: "#8a5c08",
  // Cream and the plaster.
  W: "#ffffff",
  C: "#f3f1ec",
  c: "#e4dccb",
  P: "#f2e4c0",
  p: "#e3cf9f",
  // The floor's planks: base, pale streak, seam, a darker board.
  A: "#d7b182",
  Q: "#e3c397",
  a: "#b98f5e",
  B: "#c9a070",
  j: "#c29571",
  b: "#a77b57",
  // Warm light.
  L: "#ffe2a0",
  l: "#ffb85c",
  w: "#f8e8c4",
  // The street through the doors.
  s: "#eaf6fc",
  S: "#bfe0f2",
  x: "#d9dcdf",
  X: "#b4b9bf",
  v: "#9fb7c9",
  V: "#86a0b4",
  // The rug: burgundy, its lattice.
  R: "#7d2231",
  r: "#9c3443",
  // The display tables: pale maple (top light, top, front, shade).
  N: "#fff3d6",
  M: "#f1ddb6",
  m: "#dcc294",
  n: "#b3966a",
  // The God King's stand: royal purple (deep, mid, light).
  E: "#34186a",
  U: "#5a2ea0",
  u: "#7c4fc4",
  // The seasonal stall: red and white stripes, green garland, its wood.
  q: "#d84545",
  e: "#3f9a55",
  o: "#a4744a",
  O: "#6e4a2c",
  // The plants and their pots.
  f: "#4c8a3a",
  F: "#356b2b",
  t: "#6aaa4c",
  D: "#c4654a",
  d: "#9c4a34",
  // Shadows on the floor (see-through): core, rim.
  "-": "#14121066",
  "+": "#14121033",
};
// Each board skin's two squares and its frame (a basic board's: dark wood), a key each.
const POOL = "0789@#$%&*=!?<>^~:;|/_()[]{}IJKHZz";
let pool = 0;
const SK: Record<string, { lt: string; dk: string; fr: string }> = {};
for (const s of SKINS) {
  const lt = POOL[pool++]!;
  const dk = POOL[pool++]!;
  PALETTE[lt] = s.light;
  PALETTE[dk] = s.dark;
  let fr = "O";
  if (s.frame) {
    fr = POOL[pool++]!;
    PALETTE[fr] = s.frame.deep;
  }
  SK[s.id] = { lt, dk, fr };
}

type Cv = string[][];
type Bit = { part: Part; at: Pt };
const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.floor(x);
  y = Math.floor(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length ? c[y]![x]! : ".");
const rect = (c: Cv, x: number, y: number, w: number, h: number, k: string) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(c, x + i, y + j, k);
};
const fill = (c: Cv, fn: (x: number, y: number) => string | null) => c.forEach((row, y) => row.forEach((_, x) => (row[x] = fn(x, y) ?? row[x]!)));
const line = (c: Cv, x0: number, y0: number, x1: number, y1: number, k: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let t = 0; t <= n; t++) put(c, Math.round(x0 + ((x1 - x0) * t) / n), Math.round(y0 + ((y1 - y0) * t) / n), k);
};
/** A fixed hash of (x, y): scatter that stays put. */
const hash = (x: number, y: number, seed = 1) => grain(x, y, seed);
const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });
/** A canvas cropped to what's drawn on it, as a Bit (outlined by default); null if empty. */
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
  return { id: `shop-market-${p.name}`, name: `The Pawn Shop (mockup): ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): void {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
}

// ==== The floor: planks, four tiles of the same boards with their joints moved; a burgundy rug before the counter; the mat inside the doors.

const PLANK_Y = [8, 17, 26, 36];
function plank(x: number, y: number, v: number): string {
  if (PLANK_Y.includes(y)) return "a";
  const r = y < 8 ? 0 : y < 17 ? 1 : y < 26 ? 2 : 3;
  if (x === ([5, 23, 14, 30][r]! + v * 9) % T) return "a";
  const hsh = hash(x >> 2, r + v * 7, 3);
  return hsh > 0.9 ? "Q" : hsh < 0.1 ? "B" : "A";
}
const tileDef = (name: string, fn: (x: number, y: number) => string) => {
  const c = cv(T, T);
  fill(c, fn);
  def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
};
for (let v = 0; v < 4; v++) tileDef(`floor-p${v}`, (x, y) => plank(x, y, v));
/** The rug's square: `w e n s` say which of its sides are the rug's edges (a gold line inside a dark hem). */
const rugPx = (x: number, y: number, w: boolean, e: boolean, n: boolean, s: boolean): string => {
  const dx = Math.min(w ? x : 99, e ? T - 1 - x : 99);
  const dy = Math.min(n ? y : 99, s ? T - 1 - y : 99);
  const dd = Math.min(dx, dy);
  if (dd < 2) return plank(x, y, 0);
  if (dd === 2) return "k";
  if (dd === 5 || dd === 6) return "G";
  if (dd === 7) return "g";
  return (x + y) % 12 === 0 || (x - y + 120) % 12 === 0 ? "r" : "R";
};
const RUG: { c0: number; c1: number; r0: number; r1: number } = { c0: 3, c1: 6, r0: 4, r1: 4 };
const rugName = (col: number, row: number) => `floor-rug-${col === RUG.c0 ? "w" : ""}${col === RUG.c1 ? "e" : ""}${row === RUG.r0 ? "n" : ""}${row === RUG.r1 ? "s" : ""}x`;
for (let row = RUG.r0; row <= RUG.r1; row++)
  for (let col = RUG.c0; col <= RUG.c1; col++)
    if (!PIECES[rugName(col, row)]) tileDef(rugName(col, row), (x, y) => rugPx(x, y, col === RUG.c0, col === RUG.c1, row === RUG.r0, row === RUG.r1));
/** The doormat inside the doors, two squares: green, ribbed, a gold edge. */
const matPx = (x: number, y: number, west: boolean): string => {
  const mx = west ? x : T - 1 - x;
  if (mx < 3 || y < 4 || y > 32) return plank(x, y, 1);
  if (mx === 3 || y === 4 || y === 32) return "k";
  if (mx === 4 || y === 5 || y === 31) return "g";
  return y % 3 === 0 ? "2" : "3";
};
tileDef("floor-door", (x, y) => matPx(x, y, true));
tileDef("floor-door-b", (x, y) => matPx(x, y, false));

// ==== The walls: cream plaster over a slate dado to about a third of their height, a gold rail between, a Deco frieze at the top.

const WALL_H = 130;
const RAIL = 86;
const BASE = 122;
const mod = (a: number, n: number) => ((a % n) + n) % n;
function wallKey(x: number, y: number): string {
  if (y === 0) return "Y";
  if (y === 1) return "G";
  if (y === 2) return "g";
  if (y < 10) {
    // The frieze: slate, little gold diamonds on a line.
    const dx = Math.abs(mod(x, 12) - 6);
    const d = dx + Math.abs(y - 6);
    if (d === 0) return "G";
    if (d === 2) return "g";
    if (y === 6 && dx >= 4) return "4";
    return "3";
  }
  if (y === 10) return "g";
  if (y === 11) return "h";
  if (y < RAIL) return y < 14 ? "c" : y === 18 ? "p" : "C";
  if (y < RAIL + 4) return ["Y", "G", "g", "h"][y - RAIL]!;
  if (y < BASE) {
    // The dado: slate panels, one a square, recessed (shade on their top and left, lit on their bottom and right).
    const lx = mod(x, T);
    if (lx < 4 || lx > 32 || y < RAIL + 8 || y > BASE - 5) return "3";
    if (lx === 4 || y === RAIL + 8) return "2";
    if (lx === 32 || y === BASE - 5) return "5";
    return "4";
  }
  if (y === BASE) return "g";
  return y === WALL_H - 1 ? "1" : "2";
}
function wallCv(w: number): Cv {
  const c = cv(w, WALL_H);
  fill(c, (x, y) => wallKey(x, y));
  return c;
}
/** A slim Deco pilaster centered on `cx`: a pale gold shaft between gold lines, a stepped capital, a slate plinth in the dado. */
function pilaster(c: Cv, cx: number) {
  for (let y = 12; y < RAIL; y++)
    for (let dx = -5; dx <= 5; dx++) {
      let k: string;
      if (y < 18) {
        // The capital: stepped out, gold.
        const half = y < 14 ? 7 : y < 16 ? 6 : 5;
        if (Math.abs(dx) > half) continue;
        k = y % 2 === 0 ? "G" : "g";
        if (y === 12) k = "Y";
      } else if (y >= RAIL - 4) k = y === RAIL - 4 ? "G" : "g";
      else k = dx === -5 ? "G" : dx === 5 ? "g" : dx === -2 || dx === 2 ? "p" : "P";
      put(c, cx + dx, y, k);
    }
  for (let y = 14; y < 18; y++) {
    put(c, cx - 8, y, y < 16 ? "c" : "C");
  }
  for (let y = RAIL + 4; y < BASE; y++) for (let dx = -6; dx <= 6; dx++) put(c, cx + dx, y, dx === -6 ? "5" : dx === 6 ? "2" : dx === -5 ? "4" : "3");
  for (let dx = -6; dx <= 6; dx++) put(c, cx + dx, RAIL + 4, "4");
}
/** A fan sconce centered on (cx, cy): a gold bracket, a frosted fan shade lit warm, its glow washing the plaster round it. */
function sconce(c: Cv, cx: number, cy: number) {
  for (let y = cy - 16; y <= cy + 16; y++)
    for (let x = cx - 16; x <= cx + 16; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 1.1, y + 0.5 - cy + 2);
      if (d < 14 && (get(c, x, y) === "C" || get(c, x, y) === "p")) put(c, x, y, "w");
    }
  // The bracket and its plate.
  rect(c, cx - 1, cy + 2, 2, 7, "g");
  put(c, cx - 1, cy + 2, "G");
  rect(c, cx - 3, cy + 8, 6, 3, "G");
  rect(c, cx - 3, cy + 10, 6, 1, "h");
  rect(c, cx - 4, cy + 7, 8, 1, "h");
  // The shade: a half fan, ribbed, opening up.
  for (let y = cy - 9; y <= cy + 2; y++)
    for (let x = cx - 11; x <= cx + 11; x++) {
      const X = x + 0.5 - cx;
      const Y = y + 0.5 - (cy + 3);
      const d = Math.hypot(X / 1.2, Y);
      if (d > 9.5 || Y > 0) continue;
      const a = Math.atan2(-Y, X);
      const rib = d > 3 && [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].some((r) => Math.abs(a - r) * d < 0.6);
      put(c, x, y, d > 8.6 ? "h" : d > 7.6 || y === cy + 2 ? "g" : rib ? "G" : d < 3 ? "W" : "L");
    }
}

/** A plain square of the wall. */
{
  const c = wallCv(T);
  def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
}
{
  const c = wallCv(T);
  pilaster(c, 18);
  def("wall-pilaster", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
}
/** The square of wall between the elevator and the board: a sconce. */
const SCONCE_Y = 50;
{
  const c = wallCv(T);
  sconce(c, 18, SCONCE_Y);
  def("wall-sconce", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
}
/** A blank piece: solid, drawn as nothing. */
def("wall-none", [1, 1], 1, 1, [0, 0], [[whole(cv(1, 1))]]);


// ==== The side walls: one surface each (side-walls.ts): the plaster over the dado, pilasters, two sconces, and shelves of boxed goods.

const SIDE_PILASTERS = [55, 166, 277, 388];
const SIDE_SCONCES = [111, 333];
const SHELF_SPANS: readonly (readonly [number, number])[] = [[178, 266], [399, 440]];
const BOX_KEYS = ["R", "U", "q", "e", "G", "u", "D", "5", ...Object.values(SK).map((s) => s.dk)];
function shelf(c: Cv, x0: number, x1: number, y: number, seed: number) {
  let x = x0 + 2;
  let i = 0;
  while (x < x1 - 8) {
    const w = 6 + Math.floor(hash(i, seed, 41) * 6);
    const hgt = 6 + Math.floor(hash(i, seed, 43) * 8);
    const key = BOX_KEYS[Math.floor(hash(i, seed, 47) * BOX_KEYS.length)]!;
    if (hash(i, seed, 53) > 0.18) {
      rect(c, x, y - hgt, w, hgt, key);
      rect(c, x, y - hgt, w, 1, "W");
      rect(c, x + w - 1, y - hgt + 1, 1, hgt - 1, "k");
      if (hgt > 9) rect(c, x + 1, y - hgt + 4, w - 2, 1, "Y");
    }
    x += w + 2;
    i++;
  }
  rect(c, x0, y, x1 - x0, 2, "o");
  rect(c, x0, y + 2, x1 - x0, 1, "O");
  rect(c, x0 + 4, y + 3, 2, 4, "O");
  rect(c, x1 - 6, y + 3, 2, 4, "O");
}
export const SHOP_MARKET_SIDE_LIGHTS = SIDE_SCONCES.map((x) => ({ x: x - 9, y: SCONCE_Y - 8, w: 19, h: 11, keys: "LW", color: "#ffe2a0", strength: 0.6, halo: 30 }));
export function SHOP_MARKET_SIDE_WALL_GRID(west: boolean, run: number): { grid: string[]; palette: Record<string, string> } {
  const c = wallCv(run * T);
  for (const x of SIDE_PILASTERS) if (x < run * T - 8) pilaster(c, x);
  for (const x of SIDE_SCONCES) if (x < run * T - 10) sconce(c, x, SCONCE_Y);
  SHELF_SPANS.forEach(([x0, x1], i) => {
    shelf(c, x0, x1, 40, (west ? 1 : 5) + i);
    shelf(c, x0, x1, 66, (west ? 2 : 6) + i);
  });
  return { grid: c.map((r) => r.join("")), palette: PALETTE };
}
export const SHOP_MARKET_WALL_H = WALL_H;

/** A stepped Deco crest (a ziggurat of gold bars) centered on `cx`, its foot on row `y1`: `steps` half-widths, widest first. */
function crest(c: Cv, cx: number, y1: number, steps: readonly number[]) {
  steps.forEach((hw, i) => {
    const y = y1 - 2 * i;
    for (let x = Math.ceil(cx - hw); x <= cx + hw; x++) {
      put(c, x, y, "g");
      put(c, x, y - 1, x < cx - hw + 2 ? "Y" : "G");
    }
  });
}

/** Small pixel capitals (the town's sign font), in `key`, from (x, y). */
function words(c: Cv, text: string, x: number, y: number, key: string) {
  for (const ch of text) {
    if (ch === " ") {
      x += 2;
      continue;
    }
    const g = GLYPHS[ch]!;
    g.forEach((row, j) => [...row].forEach((on, i) => on === "#" && put(c, x + i, y + j, key)));
    x += g[0]!.length + 1;
  }
}
/** A board in a skin: 8 x 8 squares of `cell` px inside a 1 px frame, its top left square at (x0, y0). */
function board(c: Cv, x0: number, y0: number, skin: string, cell: number) {
  const s = SK[skin]!;
  rect(c, x0 - 1, y0 - 1, 8 * cell + 2, 8 * cell + 2, s.fr);
  for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) rect(c, x0 + q * cell, y0 + r * cell, cell, cell, (q + r) % 2 === 0 ? s.lt : s.dk);
}

// ==== The board wall behind the keeper (4 squares): a green felt panel in a gold frame, six boards hung on it.

/** The boards hung on the wall (the rest are on the middle table). */
export const SHOP_MARKET_HUNG = ["gold", "paragon", "illustrious", "sublime", "walnut", "radiant"] as const;
{
  const W = 4 * T;
  const back = wallCv(W);
  pilaster(back, 4);
  pilaster(back, W - 5);
  const f = cv(W, WALL_H);
  const X0 = 10;
  const X1 = W - 11;
  const Y0 = 16;
  const Y1 = 84;
  crest(f, W / 2 - 0.5, Y0 - 1, [26, 16, 6]);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) put(f, x, y, x === X0 || y === Y0 ? "G" : x === X1 || y === Y1 ? "h" : x === X0 + 1 || y === Y0 + 1 || x === X1 - 1 || y === Y1 - 1 ? "g" : hash(x, y, 61) > 0.93 ? "2" : "3");
  const b = cv(W, WALL_H);
  [14, 46, 78, 110].forEach((x, i) => {
    board(b, x, 22, SHOP_MARKET_HUNG[i]!, 3);
    put(b, x + 12, 20, "Y");
  });
  board(b, 14, 55, SHOP_MARKET_HUNG[4]!, 3);
  board(b, 110, 55, SHOP_MARKET_HUNG[5]!, 3);
  // Between the two lower boards, in gold on the felt: BOARD SKINS.
  for (const [text, y] of [["BOARD", 55], ["SKINS", 68]] as const) {
    const one = cv(40, 5);
    words(one, text, 0, 0, "G");
    const x0 = Math.round((W - 2 * lineWidth(text)) / 2);
    one.forEach((row, j) => row.forEach((k, i) => k !== "." && rect(b, x0 + 2 * i, y + 2 * j, 2, 2, j < 2 ? "Y" : "G")));
  }
  def("backdrop-boards", [4, 1], W, WALL_H, [Math.floor(W / 2), WALL_H - 1], [[whole(back), cropBit(f)!, whole(b)]]);
}

// ==== The counter (4 squares, facing south): a low green desk, a gold top edge and band, a blank brass plaque (the game writes "BOARDS"
// on it), a service bell. 30 px tall: the keeper shows over it.

const CW = 4 * T;
const CH = 38;
const CFOOT = CH - 3;
const CTOP = 6;
const PLQ = { x: Math.round((CW - 41) / 2), y: 14, w: 41, h: 14 } as const;
export const SHOP_MARKET_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
{
  const c = cv(CW, CH);
  for (let y = CTOP; y <= CFOOT; y++)
    for (let x = 0; x < CW; x++) {
      let k: string;
      if (y < CTOP + 4) k = y === CTOP ? "6" : "5";
      else if (y === CTOP + 4) k = "G";
      else if (y === CTOP + 5) k = "g";
      else if (y === CTOP + 8 || y === CTOP + 13) k = "g";
      else if (y > CTOP + 8 && y < CTOP + 13) {
        const dx = Math.abs(mod(x, 8) - 4);
        k = dx === Math.abs(y - (CTOP + 10.5)) + 0.5 || dx + Math.abs(y - (CTOP + 10.5)) === 2.5 ? "G" : "2";
      } else if (y >= CFOOT - 3) k = y === CFOOT - 3 ? "g" : "2";
      else k = mod(x, 7) === 0 ? "2" : mod(x, 7) === 1 ? "4" : "3";
      if (x === 0 && y > CTOP + 3) k = k === "G" || k === "g" ? k : "5";
      if (x === CW - 1 && y > CTOP + 5) k = "2";
      put(c, x, y, k);
    }
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "hgGY", "gGY", "h");
  const bell = cv(CW, CH);
  const BX = CW - 20;
  for (let y = 1; y <= CTOP + 2; y++)
    for (let x = BX - 8; x <= BX + 8; x++) {
      const X = x + 0.5 - BX;
      const Y = y + 0.5 - (CTOP + 2);
      if (y === CTOP + 2) {
        if (Math.abs(X) < 6) put(bell, x, y, Math.abs(X) > 5 ? "h" : "g");
        continue;
      }
      if (Math.hypot(X / 4.5, Y / 5) <= 1) put(bell, x, y, X + Y < -3.5 ? "Y" : X > 2 ? "g" : "G");
    }
  rect(bell, BX - 1, 0, 1, 2, "g");
  def("counter", [4, 1], CW, CH, [Math.floor(CW / 2), CFOOT], [[groundShadow(CW / 2, CFOOT, CW / 2 - 2, 3), whole(c, true), plaque, cropBit(bell)!]]);
}

// ==== The display tables: pale maple, long and plain. One of boards on little stands, two of items on white blocks.

const TH = 46;
const TFOOT = TH - 3;
const TTOP = 18;
/** How high (room px) an item on a table's block stands over the floor. */
export const SHOP_MARKET_ITEM_LIFT = TFOOT - (TTOP + 1);
function tableDef(name: string, wSq: number, onTop: (c: Cv) => void) {
  const W = wSq * T;
  const c = cv(W, TH);
  // The far legs (in shade), the near ones.
  rect(c, 11, TTOP + 12, 4, TFOOT - 6 - (TTOP + 12), "n");
  rect(c, W - 15, TTOP + 12, 4, TFOOT - 6 - (TTOP + 12), "n");
  for (const x of [3, W - 8]) {
    rect(c, x, TTOP + 12, 5, TFOOT - (TTOP + 12) + 1, "m");
    rect(c, x + 4, TTOP + 12, 1, TFOOT - (TTOP + 12) + 1, "n");
  }
  // The top (seen a little from above) and its apron.
  rect(c, 0, TTOP, W, 8, "M");
  rect(c, 0, TTOP, W, 1, "N");
  for (let x = 0; x < W; x++) if (hash(x >> 3, wSq, 71) > 0.8) put(c, x, TTOP + 3 + Math.floor(hash(x >> 3, 1, 73) * 3), "m");
  rect(c, 1, TTOP + 8, W - 2, 4, "m");
  rect(c, 1, TTOP + 11, W - 2, 1, "n");
  const top = cv(W, TH);
  onTop(top);
  def(name, [wSq, 1], W, TH, [Math.floor(W / 2), TFOOT], [[groundShadow(W / 2, TFOOT, W / 2 - 2, 3), whole(c, true), cropBit(top)!]]);
}
/** The boards on the middle table, left to right. */
export const SHOP_MARKET_TABLED = ["pearlescent", "transcendent", "slate", "lagoon", "blossom", "graphite"] as const;
tableDef("table-boards", 4, (c) => {
  SHOP_MARKET_TABLED.forEach((id, i) => {
    const x = 6 + i * 24;
    // (Its shadow on the top, its little stand, the board, its price card.)
    rect(c, x + 1, TTOP + 4, 17, 1, "m");
    board(c, x, TTOP + 4 - 17, id, 2);
    rect(c, x + 5, TTOP + 6, 6, 1, "W");
  });
});
/** Where an item stands on an item table: its block's middle (px from the table's left edge). */
const ITEM_X = [13, 37, 61];
const itemTable = (name: string) =>
  tableDef(name, 2, (c) => {
    for (const x of ITEM_X) {
      rect(c, x - 8, TTOP + 1, 16, 3, "W");
      rect(c, x - 8, TTOP + 4, 16, 1, "c");
      rect(c, x - 2, TTOP + 6, 5, 1, "W");
    }
  });
itemTable("table-items");

// ==== A plinth: a white block for one featured item (the item is the game's ItemArt, drawn by the scene).

const PLH = 40;
const PLFOOT = PLH - 3;
/** How high (room px) a plinth's top is over the floor. */
export const SHOP_MARKET_PLINTH_LIFT = 27;
{
  const c = cv(T, PLH);
  const top = PLFOOT - SHOP_MARKET_PLINTH_LIFT;
  for (let y = top; y <= PLFOOT; y++) for (let x = 9; x <= 27; x++) put(c, x, y, y < top + 5 ? (y === top ? "W" : "C") : x > 23 ? "c" : y === top + 5 ? "c" : "C");
  rect(c, 8, PLFOOT - 2, 21, 3, "c");
  rect(c, 12, top + 12, 13, 5, "G");
  rect(c, 12, top + 12, 13, 1, "Y");
  def("plinth", [1, 1], T, PLH, [18, PLFOOT], [[groundShadow(18, PLFOOT, 13, 3), whole(c, true)]]);
}

// ==== The two stalls that are coming: a booth each, its curtain drawn, a card on its counter. The God King's stand (royal purple, a
// gold crown) and the seasonal stall (a striped awning, a garland).

const SW = 2 * T;
const SH = 100;
const SFOOT = SH - 3;
function stallDef(name: string, k: { post: string; postD: string; top: string; top2: string; curtain: string; fold: string; body: string; bodyD: string }, extra: (c: Cv) => void) {
  const c = cv(SW, SH);
  // The curtain, drawn shut.
  for (let y = 22; y < 62; y++) for (let x = 6; x < SW - 6; x++) put(c, x, y, mod(x, 6) === 0 ? k.fold : k.curtain);
  // The posts.
  for (const x of [3, SW - 6]) {
    rect(c, x, 12, 3, SFOOT - 12, k.post);
    rect(c, x + 2, 12, 1, SFOOT - 12, k.postD);
  }
  // The canopy: a striped valance, scalloped along its foot.
  for (let y = 4; y < 26; y++)
    for (let x = 0; x < SW; x++) {
      if (y >= 20 && Math.hypot(((x % 10) - 4.5) / 5, (y - 20 + 0.5) / 6) > 1) continue;
      put(c, x, y, y === 4 ? "Y" : y === 5 ? "g" : Math.floor(x / 10) % 2 ? k.top2 : k.top);
    }
  // The counter.
  for (let y = 62; y <= SFOOT; y++) for (let x = 2; x < SW - 2; x++) put(c, x, y, y < 65 ? (y === 62 ? "Y" : y === 63 ? "G" : "g") : y > SFOOT - 3 ? k.bodyD : mod(x, 9) === 0 ? k.bodyD : k.body);
  // The card on the counter: "COMING SOON".
  const card = cv(SW, SH);
  rect(card, 21, 44, 32, 18, "k");
  rect(card, 22, 45, 30, 16, "C");
  rect(card, 22, 45, 30, 1, "W");
  words(card, "COMING", 22 + Math.floor((30 - lineWidth("COMING")) / 2), 47, "3");
  words(card, "SOON", 22 + Math.floor((30 - lineWidth("SOON")) / 2), 54, "3");
  const more = cv(SW, SH);
  extra(more);
  def(name, [2, 1], SW, SH, [37, SFOOT], [[groundShadow(37, SFOOT, 35, 3), whole(c, true), cropBit(more, false)!, whole(card)]]);
}
stallDef("stall-gk", { post: "G", postD: "h", top: "U", top2: "u", curtain: "E", fold: "U", body: "U", bodyD: "E" }, (c) => {
  // A crown on the counter's front, and a small one on the canopy.
  for (const [cx, cy, s] of [[37, 82, 2], [37, 13, 1]] as const) {
    const pts = ["#.#.#", "#####", "#####"];
    pts.forEach((row, j) => [...row].forEach((on, i) => on === "#" && rect(c, cx - Math.floor((5 * s * 2) / 2) + i * 2 * s, cy + j * 2 * s, 2 * s, 2 * s, j === 2 ? "g" : "Y")));
  }
});
stallDef("stall-season", { post: "o", postD: "O", top: "q", top2: "W", curtain: "p", fold: "c", body: "o", bodyD: "O" }, (c) => {
  // A garland along the counter's top, and a wreath on its front.
  for (let x = 4; x < SW - 4; x++) {
    const y = 66 + Math.round(2 * Math.sin((x / (SW - 8)) * Math.PI * 3));
    put(c, x, y, "f");
    put(c, x, y + 1, x % 7 === 3 ? "q" : "e");
  }
  for (let y = 72; y < 92; y++)
    for (let x = 27; x < 47; x++) {
      const d = Math.hypot(x + 0.5 - 37, y + 0.5 - 82);
      if (d < 9 && d > 4.5) put(c, x, y, (x * 7 + y * 3) % 11 === 0 ? "q" : (x + y) % 3 === 0 ? "f" : "e");
    }
});

// ==== The plants by the door: a terracotta pot, broad leaves.

{
  const W = T;
  const H = 66;
  const FOOT = H - 3;
  const c = cv(W, H);
  const blob = (cx: number, cy: number, rx: number, ry: number, key: string) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) put(c, x, y, key);
  };
  rect(c, 17, 30, 2, 20, "F");
  blob(18, 16, 6, 11, "f");
  blob(9, 26, 7, 9, "F");
  blob(27, 26, 7, 9, "f");
  blob(13, 34, 8, 6, "f");
  blob(24, 35, 8, 6, "F");
  blob(18, 24, 5, 8, "t");
  blob(8, 23, 2, 4, "t");
  blob(27, 22, 2, 4, "t");
  for (let y = 46; y <= FOOT; y++) {
    const inset = Math.round((y - 46) * 0.22);
    for (let x = 10 + inset; x <= 26 - inset; x++) put(c, x, y, y < 49 ? "D" : x > 21 ? "d" : "D");
  }
  rect(c, 9, 45, 19, 3, "D");
  rect(c, 9, 47, 19, 1, "d");
  def("plant", [1, 1], W, H, [18, FOOT], [[groundShadow(18, FOOT, 12, 3), whole(c, true)]]);
}

// ==== The front: the hem (the front wall's low top, seen from inside) and the way out (glass doors in gold frames, open on the street).

const HEM_H = 24;
{
  const c = cv(T, HEM_H);
  fill(c, (x, y) => (y < 4 ? ["Y", "G", "g", "h"][y]! : y >= HEM_H - 5 ? (y === HEM_H - 5 ? "g" : "2") : mod(x, T) === 4 ? "2" : mod(x, T) === 32 ? "5" : y === 7 ? "2" : y === HEM_H - 7 ? "5" : "4"));
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c, true)]]);
}
/** A filled polygon. */
const poly = (c: Cv, pts: readonly Pt[], fn: (x: number, y: number) => string | null) => {
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) {
        const k = fn(x, y);
        if (k) put(c, x, y, k);
      }
    }
};
const ENW = 2 * T;
const ENH = 110;
const ENF = ENH - 1;
{
  const day = cv(ENW, ENH);
  // The bright street: sky, the far town's towers pale in the haze, the pavement's slabs.
  for (let y = 14; y <= ENF; y++)
    for (let x = 8; x <= 65; x++) {
      let k: string;
      const tower = 44 - Math.floor(hash(Math.floor(x / 7), 0, 5) * 16);
      if (y < 58) k = y >= tower && x % 7 !== 0 ? (y === tower ? "S" : (x + y) % 9 === 0 && y % 3 === 0 ? "s" : "v") : y > 48 ? "S" : "s";
      else if (y < 60) k = "V";
      else k = (y - 60) % 9 === 0 || (y > 60 && (x - 37) % Math.max(6, Math.round(14 - (y - 60) * 0.1)) === 0 && false) ? "X" : "x";
      put(day, x, y, k);
    }
  const f = cv(ENW, ENH);
  // The header: slate in gold lines, a small sunburst at its middle; the jambs, gilt on their inner edges.
  for (let y = 3; y <= 13; y++) for (let x = 0; x < ENW; x++) put(f, x, y, y === 3 ? "G" : y === 4 ? "g" : y === 13 ? "g" : x === 0 ? "5" : "3");
  for (let y = 5; y <= 12; y++)
    for (let x = 28; x <= 46; x++) {
      const X = x + 0.5 - 37;
      const Y = y + 0.5 - 13;
      const d = Math.hypot(X, Y);
      if (d > 8.5) continue;
      const a = Math.atan2(-Y, X);
      put(f, x, y, d < 3.5 ? "Y" : Math.abs(a - Math.round(a / (Math.PI / 6)) * (Math.PI / 6)) * d < 0.6 ? "G" : "2");
    }
  for (let y = 14; y <= ENF; y++)
    for (const [x0, x1] of [[0, 7], [66, 73]] as [number, number][]) for (let x = x0; x <= x1; x++) put(f, x, y, x === 7 ? "G" : x === 66 ? "g" : x === 0 ? "5" : x === 73 ? "2" : "4");
  // The threshold: gold.
  for (let x = 8; x <= 65; x++) {
    put(f, x, ENF - 1, "G");
    put(f, x, ENF, "g");
  }
  // The two glass doors folded back open against the jambs, seen edge on at a slant: gold frames, the day's glass, a glint.
  const doors = cv(ENW, ENH);
  const door = (pts: Pt[], glassX: (y: number) => [number, number]) =>
    poly(doors, pts, (x, y) => {
      const [g0, g1] = glassX(y);
      if (y < 22 || y > ENF - 8 || x < g0 || x > g1) return "G";
      return (x + y) % 11 === 0 ? "W" : "s";
    });
  door([[8, 15], [21, 21], [21, ENF - 3], [8, ENF]], () => [10, 18]);
  door([[65, 15], [52, 21], [52, ENF - 3], [65, ENF]], () => [55, 63]);
  // The doors' far edges a shade deeper, their handles.
  for (let y = 21; y < ENF - 3; y++) {
    put(doors, 20, y, "g");
    put(doors, 53, y, "g");
  }
  rect(doors, 19, 54, 1, 10, "h");
  rect(doors, 54, 54, 1, 10, "h");
  def("entrance", [2, 1], ENW, ENH, [37, ENF], [[groundShadow(37, ENF - 1, 36, 3), cropBit(day, false)!, cropBit(f)!, cropBit(doors)!]]);
}

function widen(name: string): void {
  const p = PIECES[name]!;
  const key = new Map(Object.entries(PALETTE).map(([k, hex]) => [(hex.length === 7 ? hex + "ff" : hex).toLowerCase(), k]));
  const ch = toChar(p);
  p.frames = p.frames.map((bits, f) => {
    const { w, data } = renderFrame(ch, ch.anims.idle!.frames[f]!);
    const col = Array.from({ length: p.h }, (_, y) => {
      const o = (y * w + p.w - 1) * 4;
      if (data[o + 3] === 0) return ".";
      const hex = "#" + [0, 1, 2, 3].map((i) => data[o + i]!.toString(16).padStart(2, "0")).join("");
      return key.get(hex) ?? ".";
    });
    return [...bits, { part: { grid: col, outline: false }, at: [p.w, 0] }];
  });
  p.w += 1;
}

widen("entrance");

// ==== The lights: the sconces, the day through the doors.

export const SHOP_MARKET_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "wall-sconce", x: 9, y: SCONCE_Y - 8, w: 19, h: 11, keys: "LW", color: "#ffe2a0", strength: 0.6, halo: 30 },
  { piece: "entrance", x: 8, y: 14, w: 58, h: 60, keys: "sSvV", color: "#e8f4ff", strength: 0.35, halo: 26 },
];
export const SHOP_MARKET_POOLS: readonly (LightPool & { piece: string })[] = [{ piece: "wall-sconce", x: 18, y: WALL_H + 30, rx: 44, ry: 24, color: "#ffe2a0", strength: 0.2 }];

// ==== The layout.

const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) throw new Error(`no piece ${name}`);
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    if (row === N - 2 && (col === 4 || col === 5)) at(col === 4 ? "floor-door" : "floor-door-b", col, row, false);
    else if (col >= RUG.c0 && col <= RUG.c1 && row >= RUG.r0 && row <= RUG.r1) at(rugName(col, row), col, row, false);
    else at(`floor-p${Math.floor(hash(col, row, 9) * 4)}`, col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;
// -- The back wall (row 0): the board wall in its middle (3-6); the stalls stand before its ends.
at("wall-none", 0, 0, true);
at("wall", 1, 0, true);
at("wall", 2, 0, true);
at("backdrop-boards", 3, 0, true);
at("wall", 7, 0, true);
at("wall", 8, 0, true);
at("wall-none", N - 1, 0, true);
for (let row = 1; row < N - 1; row++) {
  at("wall-none", 0, row, true);
  at("wall-none", N - 1, row, true);
}
// -- The two stalls that are coming, in the back corners.
at("stall-gk", 1, 1, true);
at("stall-season", 7, 1, true);
// -- The board keeper's counter (columns 3-6, row 3); he stands behind it on row 2.
at("counter", 3, 3, true);
// -- The display tables: boards in the middle (row 5), items either side of the way in (row 7): nothing stands behind the doors.
export const SHOP_MARKET_TABLES = { west: { col: 2, row: 7 }, east: { col: 6, row: 7 }, boards: { col: 3, row: 5 } } as const;
at("table-items", SHOP_MARKET_TABLES.west.col, SHOP_MARKET_TABLES.west.row, true);
at("table-items", SHOP_MARKET_TABLES.east.col, SHOP_MARKET_TABLES.east.row, true);
at("table-boards", SHOP_MARKET_TABLES.boards.col, SHOP_MARKET_TABLES.boards.row, true);
/** The plinths' squares. */
export const SHOP_MARKET_PLINTHS = [{ c: 1, r: 5 }, { c: 8, r: 5 }] as const;
for (const sq of SHOP_MARKET_PLINTHS) at("plinth", sq.c, sq.r, true);
at("plant", 1, N - 2, true);
at("plant", N - 2, N - 2, true, { flip: true });
// -- The front: the hem, and the way out at columns 4-5.
at("wall-none", 0, N - 1, true);
at("wall-none", N - 1, N - 1, true);
for (let col = 1; col < N - 1; col++) if (col !== 4 && col !== 5) at("hem", col, N - 1, true, col >= 5 ? { flip: true } : {});
at("entrance", 4, N - 1, false, { exit: true });

export const SHOP_MARKET_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
export const SHOP_MARKET_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
/** Where each item on the two item tables stands (squares): the tables' blocks, west table first. */
export const SHOP_MARKET_ITEM_SPOTS: readonly { c: number; r: number }[] = [SHOP_MARKET_TABLES.west, SHOP_MARKET_TABLES.east].flatMap((t) => ITEM_X.map((x) => ({ c: t.col + 0.5 + (x - 37) / T, r: t.row })));
/** The board keeper's squares (behind the counter, row 2) and where he stands. */
export const SHOP_MARKET_KEEPER: readonly { c: number; r: number }[] = [{ c: 4, r: 2 }, { c: 5, r: 2 }];
export const SHOP_MARKET_KEEPER_AT = [4.5, 2.35] as const;
/** The camera's fixed look at the town's zoom (the room seen whole). */
export const SHOP_MARKET_CAM = { x: 4.5, y: 4.3 } as const;

void renderFrame;
export type { Frame, LightPool, LightSpot };
