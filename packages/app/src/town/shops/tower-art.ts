/**
 * Inside the Battle Tower: its lobby (house-shop-tower). A box room of 10 x 10 squares, seen as the other rooms are (the camera looks
 * north, things stand upright at their foot, 37 px a square), built as the Walk-up's hall is (shops/recluse-stairs-art.ts): every
 * piece its own Character `shop-tower-<name>`, floor tiles first in the layout, the back wall's pieces on row 0, the side walls one
 * surface each (SHOP_TOWER_SIDE_WALL_GRID), the front row's hem and the way out.
 *
 * In HunChess's own colors: slate, gold, cream, the chessboard's two squares. A bright Art Deco lobby: a chess-tile marble floor framed
 * by a gold inlay line, cream plaster walls over a slate dado and a gold rail, slim gold pilasters, fan sconces; the clerk's low slate
 * counter (the clerk, a penguin, is the game's own sprite: not drawn here) before a key rack; the elevator (the way up to the floors);
 * the blank "Best floors" board (the game writes on it); glass doors open on the bright street (the way out). Nothing else.
 */
import { renderFrame, type Character, type Frame, type Part } from "../../characters/sprite.ts";
import type { ShopPlace } from "./room.ts";
import { grain, groundShadow, signBoard, signFace, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";

const T = 37;
/** The room's size in squares, each way. */
export const SHOP_TOWER_N = 10;
const N = SHOP_TOWER_N;

const PALETTE: Record<string, string> = {
  k: "#0e1014", // outline
  // Slate, darkest to lit.
  "1": "#16181d",
  "2": "#20232a",
  "3": "#2a2e37",
  "4": "#343946",
  "5": "#4a5163",
  "6": "#626a7e",
  // Gold: pale light, gold, brushed mid, deep, dark.
  Y: "#ffd877",
  G: "#f4b740",
  y: "#dda334",
  g: "#c8860d",
  h: "#8a5c08",
  // Cream and the plaster: white, cream, its shade, pale gold, its shade.
  W: "#ffffff",
  C: "#f3f1ec",
  c: "#e4dccb",
  P: "#f2e4c0",
  p: "#e3cf9f",
  // The floor's marble: the board's light square (base, sheen, vein), its dark square (base, sheen, vein).
  A: "#ecd6b2",
  Q: "#f6e7cb",
  a: "#e0c7a0",
  B: "#b58863",
  j: "#c29571",
  b: "#a77b57",
  // Warm light: the glow, its deeper warm, the warm wash on the plaster round a sconce.
  L: "#ffe2a0",
  l: "#ffb85c",
  w: "#f8e8c4",
  // The street through the doors: the sky, its lower haze, the pavement, its joints, the far town.
  s: "#eaf6fc",
  S: "#bfe0f2",
  x: "#d9dcdf",
  X: "#b4b9bf",
  v: "#9fb7c9",
  V: "#86a0b4",
  // Shadows on the floor (see-through): core, rim.
  "-": "#0e101466",
  "+": "#0e101433",
};

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
  return { id: `shop-tower-${p.name}`, name: `The Battle Tower's lobby: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): void {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
}

// ==== The floor: polished marble in the board's two colors, one tile a square; a gold inlay line one square in from the walls.

/** A marble tile's pixel: calm, a vein or two, a soft sheen on its upper left. */
function marble(x: number, y: number, light: boolean): string {
  const v1 = Math.round(27 - 0.55 * x + 1.6 * Math.sin(x / 4.2));
  if (x > 3 && x < 34 && y === v1) return light ? "a" : "b";
  const v2 = Math.round(10 + 0.45 * x + 1.2 * Math.sin(x / 3));
  if (x > 19 && x < 32 && y === v2) return light ? "a" : "b";
  const s = x + y;
  if (x > 2 && y > 2 && x < 17 && y < 17 && s >= 9 && s <= 11) return light ? "Q" : "j";
  if (x > 3 && y > 3 && x < 11 && y < 11 && s === 15) return light ? "Q" : "j";
  return light ? "A" : "B";
}
const tileDef = (name: string, fn: (x: number, y: number) => string) => {
  const c = cv(T, T);
  fill(c, fn);
  def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
};
tileDef("floor-a", (x, y) => marble(x, y, true));
tileDef("floor-b", (x, y) => marble(x, y, false));
/** The inlay along the tile's south side (the floor's inside lies south): turned with `rot` for the other sides. */
const INLAY = 31;
const edgeLine = (x: number, y: number): string | null => (y === INLAY ? "G" : y === INLAY + 1 ? "g" : null);
/** The inlay's corner: along its south and east sides from the corner in (the inside lies south-east). */
const cornerLine = (x: number, y: number): string | null => {
  if (x >= INLAY && y >= INLAY) {
    if (x === INLAY || y === INLAY) return "G";
    if (x === INLAY + 1 || y === INLAY + 1) return "g";
  }
  return null;
};
tileDef("floor-edge-a", (x, y) => edgeLine(x, y) ?? marble(x, y, true));
tileDef("floor-edge-b", (x, y) => edgeLine(x, y) ?? marble(x, y, false));
tileDef("floor-edge-corner-a", (x, y) => cornerLine(x, y) ?? marble(x, y, true));
tileDef("floor-edge-corner-b", (x, y) => cornerLine(x, y) ?? marble(x, y, false));
/** The doormat inside the doors, two squares (the west half on a light tile, the east on a dark): slate, ribbed, a gold edge. */
const matPx = (x: number, y: number, light: boolean, west: boolean): string => {
  const mx = west ? x : T - 1 - x;
  if (mx < 3 || y < 4 || y > 32) return marble(x, y, light);
  if (mx === 3 || y === 4 || y === 32) return "k";
  if (mx === 4 || y === 5 || y === 31) return "g";
  return y % 3 === 0 ? "2" : "3";
};
tileDef("floor-door", (x, y) => matPx(x, y, true, true));
tileDef("floor-door-b", (x, y) => matPx(x, y, false, false));

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

/** Where the side walls' pilasters and sconces stand along them (picture pixels from the back corner). */
const SIDE_PILASTERS = [55, 166, 277, 388];
const SIDE_SCONCES = [111, 333];
/** The side walls' sconces, in the side wall picture's pixels (x along the wall from the back corner; y from its top): for the scene's lights. */
export const SHOP_TOWER_SIDE_LIGHTS: readonly { x: number; y: number; w: number; h: number; keys: string; color: string; strength: number; halo: number }[] = SIDE_SCONCES.map((x) => ({
  x: x - 9,
  y: SCONCE_Y - 8,
  w: 19,
  h: 11,
  keys: "LW",
  color: "#ffe2a0",
  strength: 0.6,
  halo: 30,
}));
/** A side wall's picture, one surface `run` squares long (side-walls.ts): the plaster over the dado, pilasters, two sconces. */
export function SHOP_TOWER_SIDE_WALL_GRID(west: boolean, run: number): { grid: string[]; palette: Record<string, string> } {
  const c = wallCv(run * T);
  for (const x of SIDE_PILASTERS) if (x < run * T - 8) pilaster(c, x);
  for (const x of SIDE_SCONCES) if (x < run * T - 10) sconce(c, x, SCONCE_Y);
  void west;
  return { grid: c.map((r) => r.join("")), palette: PALETTE };
}
/** The height of the walls (room pixels). */
export const SHOP_TOWER_WALL_H = WALL_H;

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

// ==== The elevator (2 squares, in the back wall): the way up. Brushed gold doors with a sunburst etched across them, a slate and gold
// frame, the floor dial over the doors, the lit call button beside them.

const EVW = 2 * T;
/** The doors' seam (between x = 31 and 32) and their box. */
const EV_MID = 32;
const EVD: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number } = { x0: 8, x1: 55, y0: 44, y1: 124 };
const DIAL = { cx: 32, cy: 39, r: 14 } as const;
/** The call button's box (its lit arrow inside). */
const CALL = { x: 64, y: 60, w: 8, h: 15 } as const;
{
  const back = wallCv(EVW);
  const f = cv(EVW, WALL_H);
  // The frame: slate, lit on its left and top, with the stepped crest over it.
  for (let y = 15; y < WALL_H; y++) for (let x = 2; x <= 61; x++) put(f, x, y, x === 2 || y === 15 ? "5" : x === 61 ? "2" : x === 3 ? "4" : "3");
  crest(f, 31.5, 14, [24, 16, 8]);
  // The header: a darker panel, the dial in it.
  for (let y = 18; y <= 41; y++) for (let x = 6; x <= 57; x++) put(f, x, y, x === 6 || y === 18 ? "1" : "2");
  for (let y = DIAL.cy - DIAL.r - 1; y <= DIAL.cy; y++)
    for (let x = DIAL.cx - DIAL.r - 1; x <= DIAL.cx + DIAL.r; x++) {
      const X = x + 0.5 - DIAL.cx;
      const Y = y + 0.5 - DIAL.cy;
      const d = Math.hypot(X, Y);
      if (d > DIAL.r) continue;
      const a = Math.atan2(-Y, X);
      const tick = d > 9.5 && d < 12.6 && Math.abs(a - Math.round(a / (Math.PI / 8)) * (Math.PI / 8)) * d < 0.7;
      put(f, x, y, d > DIAL.r - 1.2 ? "h" : d > DIAL.r - 2.2 ? "g" : tick ? "h" : X + Y < -6 ? "Y" : "G");
    }
  // The needle (to the upper right: going up), its hub; the dial's base.
  line(f, DIAL.cx, DIAL.cy - 1, DIAL.cx + 7, DIAL.cy - 9, "k");
  line(f, DIAL.cx - 1, DIAL.cy - 1, DIAL.cx + 6, DIAL.cy - 9, "1");
  rect(f, DIAL.cx - 2, DIAL.cy - 2, 4, 2, "k");
  rect(f, DIAL.cx - DIAL.r - 1, DIAL.cy, 2 * DIAL.r + 2, 1, "g");
  rect(f, DIAL.cx - DIAL.r - 1, DIAL.cy + 1, 2 * DIAL.r + 2, 1, "h");
  // The doors' gold trim, the doors: brushed gold, a dark seam, a sunburst etched across both.
  for (let y = EVD.y0 - 2; y <= EVD.y1; y++) for (let x = EVD.x0 - 2; x <= EVD.x1 + 2; x++) put(f, x, y, x === EVD.x0 - 2 || y === EVD.y0 - 2 ? "G" : x === EVD.x1 + 2 ? "h" : "g");
  for (let y = EVD.y0; y <= EVD.y1; y++)
    for (let x = EVD.x0; x <= EVD.x1; x++) {
      const X = x + 0.5 - EV_MID;
      const Y = y + 0.5 - (EVD.y1 + 1);
      const d = Math.hypot(X, Y);
      const a = Math.atan2(-Y, X);
      const ray = d > 15 && Math.abs(a - Math.round(a / (Math.PI / 10)) * (Math.PI / 10)) * d < 0.55 && (Math.round(a / (Math.PI / 10)) % 2 === 0 || d < 52);
      let k = hash(x, 1, 7) > 0.8 ? "G" : hash(x, 2, 7) < 0.12 ? "g" : "y";
      if (x === EVD.x0 || (x === EV_MID && false)) k = "Y";
      if (x === EVD.x1 || x === EV_MID - 2) k = "g";
      if (y === EVD.y0) k = "G";
      if (d < 11) k = d > 9.8 ? "g" : X + Y < -5 ? "Y" : "G";
      else if (ray) k = "g";
      else if (Math.abs(d - 30) < 0.5) k = "g";
      if (x === EV_MID - 1) k = "k";
      if (x === EV_MID) k = "h";
      put(f, x, y, k);
    }
  // The sill: a gold threshold.
  for (let x = EVD.x0 - 2; x <= EVD.x1 + 2; x++) {
    put(f, x, 125, "Y");
    put(f, x, 126, "G");
    put(f, x, 127, "g");
  }
  // The call button: a slate plate in a gold rim beside the doors, its up arrow lit.
  const b = cv(EVW, WALL_H);
  rect(b, CALL.x, CALL.y, CALL.w, CALL.h, "g");
  rect(b, CALL.x, CALL.y, CALL.w, 1, "G");
  rect(b, CALL.x + 1, CALL.y + 1, CALL.w - 2, CALL.h - 2, "2");
  const ax = CALL.x + 3;
  const ay = CALL.y + 3;
  put(b, ax, ay, "W");
  put(b, ax + 1, ay, "W");
  rect(b, ax - 1, ay + 1, 4, 1, "L");
  put(b, ax, ay + 1, "W");
  rect(b, ax - 2, ay + 2, 6, 1, "L");
  rect(b, ax, ay + 3, 2, 5, "L");
  put(b, ax, ay + 3, "W");
  rect(b, CALL.x + 2, CALL.y + CALL.h - 3, CALL.w - 4, 1, "5");
  def("elevator", [2, 1], EVW, WALL_H, [37, WALL_H - 1], [[whole(back), cropBit(f)!, cropBit(b)!]]);
}

// ==== The "Best floors" board (2 squares, on the back wall): a slate panel in a gold frame, a blank cream header plate (the game writes
// "BEST FLOORS" on it), empty below but for faint ruled lines.

const BD = { x0: 5, y0: 12, x1: 68, y1: 82 } as const;
const BDH_PLATE = { x: 11, y: 18, w: 52, h: 12 } as const;
/** Where the game writes the board's header (on the cream plate) and its rows (the slate below): x, y, w, h in the piece's pixels. */
export const SHOP_TOWER_BOARD_HEAD = { x: BDH_PLATE.x + 1, y: BDH_PLATE.y + 1, w: BDH_PLATE.w - 2, h: BDH_PLATE.h - 2 } as const;
export const SHOP_TOWER_BOARD_BODY = { x: BD.x0 + 6, y: 35, w: BD.x1 - BD.x0 - 11, h: BD.y1 - 4 - 35 } as const;
{
  const back = wallCv(2 * T);
  const f = cv(2 * T, WALL_H);
  crest(f, 36.5, BD.y0 - 1, [14, 8, 3]);
  const w = BD.x1 - BD.x0 + 1;
  const h = BD.y1 - BD.y0 + 1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const e = Math.min(i, j, w - 1 - i, h - 1 - j);
      let k: string;
      if (e < 3) {
        const lit = (j === e && i < w - 1 - e) || (i === e && j < h - 1 - e);
        k = lit ? ["Y", "G", "g"][e]! : ["h", "g", "g"][e]!;
      } else if (e === 3) k = "k";
      else {
        const y = BD.y0 + j;
        k = i === 4 || j === 4 ? "1" : y > 34 && (y - 35) % 7 === 6 && i > 6 && i < w - 7 ? "3" : "2";
      }
      put(f, BD.x0 + i, BD.y0 + j, k);
    }
  // Little gold studs in the frame's corners.
  for (const [x, y] of [[BD.x0 + 1, BD.y0 + 1], [BD.x1 - 1, BD.y0 + 1], [BD.x0 + 1, BD.y1 - 1], [BD.x1 - 1, BD.y1 - 1]] as const) put(f, x, y, "W");
  // The header plate: cream, blank.
  const plate = cv(2 * T, WALL_H);
  for (let j = 0; j < BDH_PLATE.h; j++)
    for (let i = 0; i < BDH_PLATE.w; i++)
      put(plate, BDH_PLATE.x + i, BDH_PLATE.y + j, j === 0 || i === 0 ? "W" : j === BDH_PLATE.h - 1 || i === BDH_PLATE.w - 1 ? "c" : "C");
  def("board-best", [2, 1], 2 * T, WALL_H, [37, WALL_H - 1], [[whole(back), cropBit(f)!, cropBit(plate)!]]);
}

// ==== The backdrop behind the counter (3 squares): a pigeonhole key rack of slate and gold, little brass keys hanging in rows.

{
  const W = 3 * T;
  const back = wallCv(W);
  pilaster(back, 4);
  pilaster(back, W - 5);
  const f = cv(W, WALL_H);
  const X0 = 10;
  const X1 = 100;
  const Y0 = 20;
  const Y1 = 82;
  crest(f, 55, Y0 - 1, [22, 14, 6]);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) put(f, x, y, x === X0 || y === Y0 ? "5" : x === X1 ? "2" : y >= Y1 - 2 ? (y === Y1 - 2 ? "G" : y === Y1 - 1 ? "g" : "h") : "4");
  // The pigeonholes: 7 by 4, each a dark hole lit on its lower right; a key hangs in most.
  const CX0 = X0 + 3;
  const CY0 = Y0 + 3;
  const CWD = 12;
  const CHT = 14;
  for (let r = 0; r < 4; r++)
    for (let q = 0; q < 7; q++) {
      const x0 = CX0 + q * CWD;
      const y0 = CY0 + r * CHT;
      for (let y = y0; y < y0 + CHT - 2; y++) for (let x = x0; x < x0 + CWD - 2; x++) put(f, x, y, x === x0 || y === y0 ? "1" : "2");
      for (let x = x0; x < x0 + CWD - 2; x++) put(f, x, y0 + CHT - 2, "5");
      if (hash(q, r, 31) < 0.72) {
        // A brass key: its hook, its ring, its shaft and bit.
        const kx = x0 + 4;
        const ky = y0 + 1;
        put(f, kx, ky, "g");
        rect(f, kx - 1, ky + 1, 3, 3, "G");
        put(f, kx - 1, ky + 1, "Y");
        put(f, kx, ky + 2, "2");
        put(f, kx + 1, ky + 3, "g");
        rect(f, kx, ky + 4, 1, 5, "G");
        put(f, kx + 1, ky + 7, "g");
        put(f, kx + 1, ky + 8, "g");
      }
    }
  def("backdrop", [3, 1], W, WALL_H, [Math.floor(W / 2), WALL_H - 1], [[whole(back), cropBit(f)!]]);
}

// ==== The counter (3 squares, facing south): a low slate desk, a gold top edge and a gold Deco band, a blank brass plaque on its front
// (the game writes "CLERK" on it), a small brass service bell on its top. 30 px tall: the penguin shows over it.

const CW = 3 * T;
const CH = 38;
const CFOOT = CH - 3;
const CTOP = 6;
const PLQ = { x: 35, y: 14, w: 41, h: 14 } as const;
/** Where the game writes on the counter's plaque. */
export const SHOP_TOWER_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
{
  const c = cv(CW, CH);
  for (let y = CTOP; y <= CFOOT; y++)
    for (let x = 0; x < CW; x++) {
      let k: string;
      if (y < CTOP + 4) k = y === CTOP ? "6" : "5"; // its top, seen a little from above
      else if (y === CTOP + 4) k = "G"; // the gold top edge
      else if (y === CTOP + 5) k = "g";
      else if (y === CTOP + 8 || y === CTOP + 13) k = "g"; // the Deco band
      else if (y > CTOP + 8 && y < CTOP + 13) {
        const dx = Math.abs(mod(x, 8) - 4);
        k = dx === Math.abs(y - (CTOP + 10.5)) + 0.5 || dx + Math.abs(y - (CTOP + 10.5)) === 2.5 ? "G" : "2";
      } else if (y >= CFOOT - 3) k = y === CFOOT - 3 ? "g" : "2"; // the plinth
      else k = mod(x, 7) === 0 ? "2" : mod(x, 7) === 1 ? "4" : "3"; // fluting
      if (x === 0 && y > CTOP + 3) k = k === "G" || k === "g" ? k : "5";
      if (x === CW - 1 && y > CTOP + 5) k = "2";
      put(c, x, y, k);
    }
  const plaque = signBoard(PLQ.x, PLQ.y, PLQ.w, PLQ.h, "hgGY", "gGY", "h");
  // The service bell, on the right of the top.
  const bell = cv(CW, CH);
  for (let y = 1; y <= CTOP + 2; y++)
    for (let x = 84; x <= 98; x++) {
      const X = x + 0.5 - 91.5;
      const Y = y + 0.5 - (CTOP + 2);
      if (y === CTOP + 2) {
        if (Math.abs(X) < 6) put(bell, x, y, Math.abs(X) > 5 ? "h" : "g");
        continue;
      }
      if (Math.hypot(X / 4.5, Y / 5) <= 1) put(bell, x, y, X + Y < -3.5 ? "Y" : X > 2 ? "g" : "G");
    }
  rect(bell, 91, 0, 1, 2, "g");
  def("counter", [3, 1], CW, CH, [Math.floor(CW / 2), CFOOT], [[groundShadow(CW / 2, CFOOT, CW / 2 - 2, 3), whole(c, true), plaque, cropBit(bell)!]]);
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

// ==== (The game's, Nov 19) A 2-wide piece stands at its exact middle (foot 37), a 1-wide one half a pixel east of its square's (foot 18
// of 37), so a 2-wide piece ends half a pixel short of the square piece east of it: a see-through seam at some widths (the art's note).
// The elevator and the way out get one more column, a copy of their last as drawn (outline and all), so they meet what's east of them.
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
widen("elevator");
widen("entrance");

// ==== The lights: the sconce, the elevator's call button and dial (soft), the day through the doors.

export const SHOP_TOWER_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "wall-sconce", x: 9, y: SCONCE_Y - 8, w: 19, h: 11, keys: "LW", color: "#ffe2a0", strength: 0.6, halo: 30 },
  { piece: "elevator", x: CALL.x, y: CALL.y, w: CALL.w, h: CALL.h, keys: "LW", color: "#ffe2a0", strength: 0.7, halo: 10 },
  { piece: "elevator", x: DIAL.cx - DIAL.r, y: DIAL.cy - DIAL.r, w: 2 * DIAL.r, h: DIAL.r, keys: "YG", color: "#ffb85c", strength: 0.3, halo: 16 },
  { piece: "entrance", x: 8, y: 14, w: 58, h: 60, keys: "sSvV", color: "#e8f4ff", strength: 0.35, halo: 26 },
];
/** ... and warm pools on the floor: under the sconce, before the elevator. */
export const SHOP_TOWER_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "wall-sconce", x: 18, y: WALL_H + 30, rx: 44, ry: 24, color: "#ffe2a0", strength: 0.2 },
  { piece: "elevator", x: 37, y: WALL_H + 22, rx: 46, ry: 22, color: "#ffb85c", strength: 0.18 },
];

// ==== The layout.

const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) return;
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

// -- The floor (every square): the inlay framing columns 1-8, rows 1-8; the mat inside the doors.
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const light = (col + row) % 2 === 0;
    const ab = light ? "a" : "b";
    const inRing = col >= 1 && col <= N - 2 && row >= 1 && row <= N - 2;
    const west = col === 1;
    const east = col === N - 2;
    const north = row === 1;
    const south = row === N - 2;
    if (row === N - 2 && (col === 4 || col === 5)) at(col === 4 ? "floor-door" : "floor-door-b", col, row, false);
    else if (inRing && (west || east) && (north || south)) {
      const rot = north ? (west ? 0 : 1) : east ? 2 : 3;
      at(`floor-edge-corner-${ab}`, col, row, false, rot ? { rot } : {});
    } else if (inRing && (west || east || north || south)) {
      const rot = north ? 0 : east ? 1 : south ? 2 : 3;
      at(`floor-edge-${ab}`, col, row, false, rot ? { rot } : {});
    } else {
      // (Each tile turned by a fixed hash, so the veins don't march in step.)
      const rot = Math.floor(hash(col, row, 9) * 4) as 0 | 1 | 2 | 3;
      at(`floor-${ab}`, col, row, false, rot ? { rot } : {});
    }
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The back wall (row 0): the corners blank; the key rack behind the counter (1-3), the elevator (4-5), a sconce (6), the board (7-8).
at("wall-none", 0, 0, true);
if (PIECES["backdrop"]) at("backdrop", 1, 0, true);
else for (let c = 1; c <= 3; c++) at(c === 2 ? "wall-pilaster" : "wall", c, 0, true);
// (PR 11: solid and decorative; its door to the floors comes with the floor room, PR 11b.)
if (PIECES["elevator"]) at("elevator", 4, 0, true);
else for (let c = 4; c <= 5; c++) at("wall", c, 0, true);
at("wall-sconce", 6, 0, true);
if (PIECES["board-best"]) at("board-best", 7, 0, true);
else for (let c = 7; c <= 8; c++) at("wall", c, 0, true);
at("wall-none", N - 1, 0, true);
// -- The side walls: one surface each, drawn by the scene (SHOP_TOWER_SIDE_WALL_GRID); here, solid blanks.
for (let row = 1; row < N - 1; row++) {
  at("wall-none", 0, row, true);
  at("wall-none", N - 1, row, true);
}
// -- The counter (columns 1-3, row 3, facing south); the clerk stands behind it on row 2.
at("counter", 1, 3, true);
// -- The front: the hem, and the way out at columns 4-5.
at("wall-none", 0, N - 1, true);
at("wall-none", N - 1, N - 1, true);
for (let col = 1; col < N - 1; col++) if (col !== 4 && col !== 5) at("hem", col, N - 1, true, col >= 5 ? { flip: true } : {});
at("entrance", 4, N - 1, false, { exit: true });

/** Where every piece goes: floor tiles first, then the upright pieces north to south. */
export const SHOP_TOWER_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
/** Every piece by its name, each its own Character `shop-tower-<name>`. */
export const SHOP_TOWER_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
/** The clerk's squares (behind the counter, row 2) and where he stands (square coordinates). */
export const SHOP_TOWER_KEEPER: readonly { c: number; r: number }[] = [
  { c: 2, r: 2 },
  { c: 3, r: 2 },
];
export const SHOP_TOWER_CLERK_AT = [2.5, 2.4] as const;
/** The camera's fixed look at the town's zoom (the room seen whole). */
export const SHOP_TOWER_CAM = { x: 4.5, y: 4.0 } as const;

export type { LightPool, LightSpot };
