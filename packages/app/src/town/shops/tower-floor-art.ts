/**
 * The Battle Tower's floor room (house-shop-tower-floor): the room on every floor, 1 to 99, redrawn only by the big floor number on its
 * side walls. A snug box room of 10 x 10 squares seen as the other rooms are (the camera looks north, things stand upright at their
 * foot, 37 px a square), built as the Walk-up's hall is (shops/recluse-stairs-art.ts) and matching the tower's lobby
 * (house-shop-tower): every piece its own Character `shop-tower-floor-<name>`, floor tiles first in the layout, the back wall's pieces
 * on row 0, the side walls one surface each (towerFloorWallGrid), the front row's hem and the way in.
 *
 * In HunChess's own colors: the lobby's chess-tile marble in a gold inlay, cream plaster over a slate dado and a gold rail, slim gold
 * pilasters; the battle circle (a slate disc in a gold ring, a quiet inner ring, a gold sunburst and crown in its middle where the
 * table stands); the elevator the floor's bosses come out of (top); the big gold floor number on both side walls; the way in (bottom).
 * Nothing else: the table and chairs are the game's (recolored by SHOP_TOWER_FLOOR_TABLE_PALETTE / _STOOL_PALETTE).
 */
import { renderFrame, type Character, type Frame, type Part } from "../../characters/sprite.ts";
import type { ShopPlace } from "./room.ts";
import { grain, groundShadow, type LightPool, type LightSpot, type Pt } from "../houses/kit.ts";

const T = 37;
/** The room's size in squares, each way. */
export const SHOP_TOWER_FLOOR_N = 10;
const N = SHOP_TOWER_FLOOR_N;

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
  // Warm light: the glow, its deeper warm, the warm wash on the plaster.
  L: "#ffe2a0",
  l: "#ffb85c",
  w: "#f8e8c4",
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
const mod = (a: number, n: number) => ((a % n) + n) % n;
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
  return { id: `shop-tower-floor-${p.name}`, name: `The Battle Tower's floor: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): void {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
}

// ==== The floor: the lobby's polished marble in the board's two colors, one tile a square; a gold inlay one square in from the walls.

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

// ==== The walls: the lobby's (cream plaster over a slate dado, a gold rail between, a slate Deco frieze at the top).

const WALL_H = 130;
const RAIL = 86;
const BASE = 122;
function wallKey(x: number, y: number): string {
  if (y === 0) return "Y";
  if (y === 1) return "G";
  if (y === 2) return "g";
  if (y < 10) {
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
        const half = y < 14 ? 7 : y < 16 ? 6 : 5;
        if (Math.abs(dx) > half) continue;
        k = y % 2 === 0 ? "G" : "g";
        if (y === 12) k = "Y";
      } else if (y >= RAIL - 4) k = y === RAIL - 4 ? "G" : "g";
      else k = dx === -5 ? "G" : dx === 5 ? "g" : dx === -2 || dx === 2 ? "p" : "P";
      put(c, cx + dx, y, k);
    }
  for (let y = 14; y < 18; y++) put(c, cx - 8, y, y < 16 ? "c" : "C");
  for (let y = RAIL + 4; y < BASE; y++) for (let dx = -6; dx <= 6; dx++) put(c, cx + dx, y, dx === -6 ? "5" : dx === 6 ? "2" : dx === -5 ? "4" : "3");
  for (let dx = -6; dx <= 6; dx++) put(c, cx + dx, RAIL + 4, "4");
}
{
  def("wall", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(wallCv(T))]]);
  const c = wallCv(T);
  pilaster(c, 18);
  def("wall-pilaster", [1, 1], T, WALL_H, [18, WALL_H - 1], [[whole(c)]]);
}
/** A blank piece: solid, drawn as nothing. */
def("wall-none", [1, 1], 1, 1, [0, 0], [[whole(cv(1, 1))]]);
/** The height of the walls (room pixels). */
export const SHOP_TOWER_FLOOR_WALL_H = WALL_H;

// ==== The battle circle (columns 2-7, rows 2-7; its middle the corner at x 5, y 5): a slate disc in a bold gold ring studded at the
// eight points, a sunburst of quiet slate wedges, a fine gold inner ring, the middle line west to east, and in the middle (2 x 2 squares,
// where the table stands) a gold sunburst medallion with a crown. Floor tiles `circle-<n>`, a tile reused (as is or half-turned, never
// mirrored: the game ignores `flip` on floor tiles) where a copy matches.

const CC = 5 * T;
const R_OUT = 111;
/** The crown on the medallion (X, Y from the middle): true inside its silhouette. */
function crown(X: number, Y: number): boolean {
  const ax = Math.abs(X);
  if (ax <= 9.5 && Y >= 2 && Y <= 7) return true;
  for (const [bx, by] of [[-9, -9.5], [0, -11.5], [9, -9.5]] as const) if (Math.hypot(X - bx, Y - by) < 2) return true;
  if (ax > 9.5 || Y > 2) return false;
  const u = ax <= 4.5 ? ax / 4.5 : (9 - ax) / 4.5;
  const top = ax <= 4.5 ? -10 + u * 9 : -8 + (1 - u) * 7;
  return Y >= top;
}
/** The circle's pixel at floor pixel (gx, gy), or null: outside the disc (the marble shows). */
function circleKey(gx: number, gy: number): string | null {
  const X = gx + 0.5 - CC;
  const Y = gy + 0.5 - CC;
  const d = Math.hypot(X, Y);
  if (d > R_OUT) return null;
  const a = Math.atan2(-Y, X);
  if (d > R_OUT - 1) return "k";
  if (d > 101) {
    // The gold ring: lit on its outer edge toward the top left, a dark lip inside; a stud at each of the eight points.
    const t = R_OUT - 1 - d;
    const near = Math.abs(a - Math.round(a / (Math.PI / 4)) * (Math.PI / 4)) * d;
    if (near < 3.2 && t > 2 && t < 7.5) return near < 1.4 && t > 3.5 && t < 6 ? "Y" : "h";
    if (t < 1) return "g";
    if (t < 2.4) return X + Y < 0 ? "Y" : "G";
    if (t > 7.8) return "h";
    if (t > 6.6) return "g";
    return "G";
  }
  if (d > 100) return "k";
  if (d > 96) return "2"; // the groove inside the ring
  // The middle line, west to east, between the medallion and the inner ring.
  if (Y > -1 && Y < 1 && d > 38 && d < 67) return "h";
  if (d > 67.5 && d < 69) return "g"; // the quiet inner ring
  if (d >= 69 && d < 70.5) return "2";
  if (d >= 70.5) return Math.floor(mod(a + Math.PI / 32, 2 * Math.PI) / (Math.PI / 16)) % 2 === 0 ? "4" : "3"; // the wedges
  if (d > 36) return d > 64 ? "2" : "3";
  // The medallion: a sunburst of gold rays round a gold disc with the crown.
  if (d > 35) return "k";
  if (d > 23) {
    const ray = Math.abs(a - Math.round(a / (Math.PI / 8)) * (Math.PI / 8)) * d;
    const long = Math.round(a / (Math.PI / 8)) % 2 === 0;
    const reach = long ? 34.5 : 30;
    if (d < reach && ray < 2.6 - (d - 23) * 0.08) return X + Y < 0 ? "G" : "g";
    return "2";
  }
  if (d > 22) return "k";
  if (d > 20.5) return "h";
  if (crown(X, Y)) {
    if (Math.abs(Y - 4.5) < 0.6 && [-5, 0, 5].some((j) => Math.abs(X - j) < 1)) return "G";
    return Y > 2 ? "2" : "1";
  }
  if (crown(X + 1, Y + 1)) return "h"; // its shadow, toward the bottom right
  return X + Y < -10 ? "Y" : X + Y > 14 ? "g" : "G";
}
/** The tile of the circle at a square, as drawn (rot 0): the marble of its own square round the disc. */
const circleTile = (col: number, row: number): string[] =>
  Array.from({ length: T }, (_, y) => Array.from({ length: T }, (_, x) => circleKey(col * T + x, row * T + y) ?? marble(x, y, (col + row) % 2 === 0)).join(""));
/** A tile turned and mirrored as laid (the room's way: mirrored first, then `rot` quarter turns). */
const laid = (g: readonly string[], flip: boolean, rot: number): string[] =>
  Array.from({ length: T }, (_, y) =>
    Array.from({ length: T }, (_, x) => {
      let [u, v] = [flip ? T - 1 - x : x, y];
      for (let q = 0; q < rot; q++) [u, v] = [v, T - 1 - u];
      return g[v]![u]!;
    }).join(""),
  );
const CIRCLE_SQ = new Map<string, { name: string; rot?: 0 | 1 | 2 | 3; flip?: boolean }>();
{
  const kept: { name: string; grid: string[] }[] = [];
  for (let row = 2; row <= 7; row++)
    for (let col = 2; col <= 7; col++) {
      const g = circleTile(col, row);
      const key = g.join("\n");
      let hit: { name: string; rot?: 0 | 1 | 2 | 3; flip?: boolean } | null = null;
      // (The middle's north-west tile is kept its own: the circle's light pool hangs on it.)
      if (!(col === 4 && row === 4))
        for (const k of kept) {
          // (Only unturned or half-turned, never mirrored: the game lays floor tiles with `rot` alone and ignores `flip` on them; a
          // quarter turn's sense differs between drawers, a half turn's doesn't.)
          for (let rot = 0; rot < 4 && !hit; rot += 2) if (laid(k.grid, false, rot).join("\n") === key) hit = { name: k.name, ...(rot ? { rot: rot as 1 | 2 | 3 } : {}) };
          if (hit) break;
        }
      if (!hit) {
        const name = `circle-${kept.length}`;
        kept.push({ name, grid: g });
        def(name, [1, 1], T, T, [18, 18], [[{ part: { grid: g, outline: false }, at: [0, 0] }]]);
        hit = { name };
      }
      CIRCLE_SQ.set(`${col},${row}`, hit);
    }
}
/** The tile the circle's light pool hangs on (the middle's north-west square: its south-east corner is the middle). */
const CIRCLE_MID = CIRCLE_SQ.get("4,4")!.name;

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

// ==== The elevator (2 squares, in the back wall): the door the floor's bosses come out of. The lobby's, seen from this floor: brushed
// gold doors (closed, a dark seam, a sunburst etched across both) in a slate and gold frame, the gold floor dial over them, and a soft
// lamp of frosted glass at the top of its crest, its warm light washing the plaster round it.

const EVW = 2 * T;
const EV_MID = 37;
const EVD: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number } = { x0: 13, x1: 60, y0: 44, y1: 124 };
const DIAL = { cx: 37, cy: 39, r: 14 } as const;
const LAMP = { x: 30, y: 2, w: 14, h: 6 } as const;
{
  const back = wallCv(EVW);
  // (The lamp's warm wash on the plaster and frieze over the frame.)
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < EVW; x++) {
      const d = Math.hypot((x + 0.5 - 37) / 1.6, y + 0.5 - 6);
      if (d < 16 && (back[y]![x] === "C" || back[y]![x] === "c" || back[y]![x] === "p")) back[y]![x] = "w";
    }
  const f = cv(EVW, WALL_H);
  for (let y = 15; y < WALL_H; y++) for (let x = 7; x <= 66; x++) put(f, x, y, x === 7 || y === 15 ? "5" : x === 66 ? "2" : x === 8 ? "4" : "3");
  crest(f, 36.5, 14, [24, 16, 9]);
  // The lamp: frosted glass in a gold cap, lit.
  for (let j = 0; j < LAMP.h; j++)
    for (let i = 0; i < LAMP.w; i++) {
      const e = i === 0 || i === LAMP.w - 1 || j === 0;
      put(f, LAMP.x + i, LAMP.y + j, e ? (j === 0 ? "G" : "g") : j === 1 || (i > 4 && i < 9) ? "W" : "L");
    }
  // The header: a darker panel, the dial in it.
  for (let y = 18; y <= 41; y++) for (let x = 11; x <= 62; x++) put(f, x, y, x === 11 || y === 18 ? "1" : "2");
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
  // The needle (up and right: the floor's car is here), its hub; the dial's base.
  line(f, DIAL.cx, DIAL.cy - 1, DIAL.cx + 7, DIAL.cy - 9, "k");
  line(f, DIAL.cx - 1, DIAL.cy - 1, DIAL.cx + 6, DIAL.cy - 9, "1");
  rect(f, DIAL.cx - 2, DIAL.cy - 2, 4, 2, "k");
  rect(f, DIAL.cx - DIAL.r - 1, DIAL.cy, 2 * DIAL.r + 2, 1, "g");
  rect(f, DIAL.cx - DIAL.r - 1, DIAL.cy + 1, 2 * DIAL.r + 2, 1, "h");
  // (The game's, Nov 19: the same elevator with its doors open, drawn from here: `elevator-open`.)
  const fo = f.map((r) => r.slice());
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
      if (x === EVD.x0) k = "Y";
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
  def("elevator", [2, 1], EVW, WALL_H, [37, WALL_H - 1], [[whole(back), cropBit(f)!]]);
  // (The game's, Nov 19: open, after a floor won. The gold trim, the car inside lit warm (its back wall cream, a gold rail, its slate
  // floor), the doors slid back to narrow gold strips at each side, the sill.)
  for (let y = EVD.y0 - 2; y <= EVD.y1; y++) for (let x = EVD.x0 - 2; x <= EVD.x1 + 2; x++) put(fo, x, y, x === EVD.x0 - 2 || y === EVD.y0 - 2 ? "G" : x === EVD.x1 + 2 ? "h" : "g");
  for (let y = EVD.y0; y <= EVD.y1; y++)
    for (let x = EVD.x0; x <= EVD.x1; x++) {
      const i = x - EVD.x0;
      const j = y - EVD.y0;
      const door = i < 5 || x > EVD.x1 - 5;
      let k: string;
      if (door) k = i === 0 || x === EVD.x1 ? "Y" : i === 4 || x === EVD.x1 - 4 ? "h" : "y";
      else if (y > EVD.y1 - 14) k = y === EVD.y1 - 13 ? "4" : (x + y) % 9 === 0 ? "3" : "2";
      else if (j < 6) k = j === 5 ? "g" : "L";
      else if (Math.abs(y - (EVD.y1 - 40)) < 1.5) k = y === EVD.y1 - 41 ? "Y" : "G";
      else k = i < 8 || x > EVD.x1 - 8 ? "p" : "w";
      put(fo, x, y, k);
    }
  for (let x = EVD.x0 - 2; x <= EVD.x1 + 2; x++) {
    put(fo, x, 125, "Y");
    put(fo, x, 126, "G");
    put(fo, x, 127, "g");
  }
  def("elevator-open", [2, 1], EVW, WALL_H, [37, WALL_H - 1], [[whole(back), cropBit(fo)!]]);
}

//@@SIDEWALLS
// ==== The side walls: one surface each (side-walls.ts), the lobby's wall with a pilaster every 3 squares, and the floor's number big in
// a gold-framed slate panel that breaks through the rail, centered 4 squares from the back corner. Bold Art Deco numerals 78 px tall,
// gold, lit on their top-left edges, a dark gold shadow down and right, a fine dark outline.

const DG_W = 46;
const DG_H = 78;
const DS = 13;
type Shape = (x: number, y: number) => boolean;
/** A box. */
const box = (x0: number, y0: number, x1: number, y1: number): Shape => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
/** A squarish ring (a superellipse's band `t` thick), only where its angle (degrees, 0 east, 90 up) lies in [a0, a1]. */
const ring = (cx: number, cy: number, rx: number, ry: number, t: number, a0 = -180, a1 = 180): Shape => (x, y) => {
  const X = x - cx;
  const Y = y - cy;
  const p = 2.6;
  const o = (Math.abs(X) / rx) ** p + (Math.abs(Y) / ry) ** p;
  const i = (Math.abs(X) / (rx - t)) ** p + (Math.abs(Y) / (ry - t)) ** p;
  if (o > 1 || i < 1) return false;
  const a = (Math.atan2(-Y, X) * 180) / Math.PI;
  return (a >= a0 && a <= a1) || (a + 360 >= a0 && a + 360 <= a1);
};
/** A thick straight stroke from (x0, y0) to (x1, y1), `t` wide, its ends cut square. */
const bar = (x0: number, y0: number, x1: number, y1: number, t: number): Shape => (x, y) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const u = ((x - x0) * dx + (y - y0) * dy) / (L * L);
  if (u < 0 || u > 1) return false;
  return Math.abs((x - x0) * dy - (y - y0) * dx) / L <= t / 2;
};
const DIGIT_SHAPES: Shape[][] = [
  [ring(23, 39, 23, 39, DS)],
  [box(19, 0, 32, 78), bar(6, 17, 24, 3, 11), box(9, 66, 42, 78)],
  [ring(23, 22, 23, 22, DS, -48, 172), bar(36, 34, 6, 70, DS + 1), box(0, 65, 46, 78)],
  [ring(22, 20, 22, 20, 12, -90, 165), ring(23, 57, 23, 21, DS, -165, 90), box(12, 34, 24, 44)],
  [box(29, 0, 42, 78), bar(35, 4, 3, 54, DS), box(0, 49, 46, 61)],
  [box(4, 0, 44, 12), box(4, 0, 17, 38), ring(23, 52, 23, 26, DS, -150, 128)],
  [ring(23, 52, 23, 26, DS), box(0, 22, 13, 52), ring(23, 22, 23, 22, DS, 25, 180)],
  [box(0, 0, 46, 13), bar(40, 6, 14, 78, DS + 1)],
  [ring(23, 19, 20, 19, 12), ring(23, 56, 23, 22, DS)],
  [ring(23, 26, 23, 26, DS), box(33, 26, 46, 56), ring(23, 56, 23, 22, DS, -155, 0)],
];
/** The digits 0-9 as pixel grids, DG_W x DG_H: "#" the numeral, "." clear. */
export const TOWER_DIGITS: readonly (readonly string[])[] = DIGIT_SHAPES.map((sh) =>
  Array.from({ length: DG_H }, (_, y) => Array.from({ length: DG_W }, (_, x) => (sh.some((s) => s(x + 0.5, y + 0.5)) ? "#" : ".")).join("")),
);
/** The number's panel, in the wall picture's pixels: centered at x NUM_X, over the rail and the dado. */
const NUM_X = 150;
const PANEL = { x0: NUM_X - 64, x1: NUM_X + 63, y0: 14, y1: 117 } as const;
const DIGIT_Y = 26;
/** The panel with the floor's number on it, as drawn (reading left to right), into the wall's canvas. */
function numberPanel(c: Cv, floor: number) {
  const { x0, x1, y0, y1 } = PANEL;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, y - y0, x1 - x, y1 - y);
      let k: string;
      if (e === 0) k = "k";
      else if (e < 4) {
        const lit = (y - y0 === e && x1 - x > e) || (x - x0 === e && y1 - y > e);
        k = lit ? ["", "Y", "G", "g"][e]! : ["", "h", "g", "g"][e]!;
      } else if (e === 4) k = "k";
      else k = x - x0 === 5 || y - y0 === 5 ? "1" : "2";
      put(c, x, y, k);
    }
  // Gold studs in the frame's corners, a stepped Deco crest over its top.
  for (const [x, y] of [[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x0 + 2, y1 - 2], [x1 - 2, y1 - 2]] as const) put(c, x, y, "W");
  crest(c, NUM_X - 0.5, y0 - 1, [14, 7]);
  // The digits, centered, one or two, 6 px apart.
  const ds = String(Math.max(1, Math.min(99, Math.round(floor)))).split("").map(Number);
  const gap = 6;
  const total = ds.length * DG_W + (ds.length - 1) * gap;
  const left = Math.round(NUM_X - total / 2) - 1;
  const ink = new Set<string>();
  ds.forEach((d, i) => TOWER_DIGITS[d]!.forEach((r, y) => [...r].forEach((ch, x) => ch === "#" && ink.add(`${left + i * (DG_W + gap) + x},${DIGIT_Y + y}`))));
  const has = (x: number, y: number) => ink.has(`${x},${y}`);
  const SH = 3;
  const shade = (x: number, y: number) => !has(x, y) && [1, 2, 3].some((s) => s <= SH && has(x - s, y - s));
  // Outline round the numeral and its shadow; then the shadow; then the gold, lit on its top-left edges, shaded on its bottom-right.
  for (let y = DIGIT_Y - 2; y < DIGIT_Y + DG_H + SH + 2; y++)
    for (let x = left - 2; x < left + total + SH + 2; x++) {
      if (has(x, y)) {
        const tl = !has(x - 1, y) || !has(x, y - 1) || !has(x - 1, y - 1);
        const br = !has(x + 1, y) || !has(x, y + 1);
        put(c, x, y, tl ? "Y" : br ? "g" : "G");
      } else if (shade(x, y)) put(c, x, y, "h");
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => has(x + dx!, y + dy!) || shade(x + dx!, y + dy!))) put(c, x, y, "k");
    }
}
/** Where the side walls' pilasters stand along them (picture pixels from the back corner): one every 3 squares, the panel's bay wider. */
const SIDE_PILASTERS = [70, 230, 341, 452];
/**
 * A side wall's picture, one surface `run` squares long, WALL_H tall (x 0 the back corner): the plaster over the dado, pilasters, and
 * the floor's number (1 to 99) in its panel. The west wall's picture shows mirrored on screen, so its number is drawn mirrored here (the
 * panel flipped about its middle: each glyph flipped, their order reversed) and reads right in the room.
 */
export function towerFloorWallGrid(west: boolean, run: number, floor: number): { grid: string[]; palette: Record<string, string> } {
  const c = wallCv(run * T);
  for (const x of SIDE_PILASTERS) if (x < run * T - 8) pilaster(c, x);
  const p = cv(run * T, WALL_H);
  numberPanel(p, floor);
  for (let y = 0; y < WALL_H; y++)
    for (let x = PANEL.x0 - 16; x <= PANEL.x1 + 16; x++) {
      const k = get(p, west ? 2 * NUM_X - 1 - x : x, y);
      if (k !== ".") put(c, x, y, k);
    }
  return { grid: c.map((r) => r.join("")), palette: PALETTE };
}

// ==== The back wall's number panels (2 squares each, columns 1-2 and 7-8 either side of the elevator): the floor's number again, smaller,
// where a phone reads it (the side walls are seen edge on there). The back wall's frieze, plaster, rail and dado, and in the plaster a
// slate panel in a gold frame (64 x 64) with the floor's number in the side walls' numerals, 46 px tall.

const NPW = 2 * T;
const NP = { x0: 5, x1: 68, y0: 16, y1: 79 } as const;
const NP_CX = 36.5;
const NP_DW = 23;
const NP_DH = 46;
const NP_GAP = 3;
/** The digits 0-9 small (the side walls' numerals scaled to NP_DW x NP_DH): "#" the numeral, "." clear. */
const NP_DIGITS: readonly (readonly string[])[] = DIGIT_SHAPES.map((sh) =>
  Array.from({ length: NP_DH }, (_, y) => Array.from({ length: NP_DW }, (_, x) => (sh.some((s) => s(((x + 0.5) * DG_W) / NP_DW, ((y + 0.5) * DG_H) / NP_DH)) ? "#" : ".")).join("")),
);
/** The number panel's picture for a floor: the back wall with the gold-framed slate panel and the number. */
function numberPanelCv(floor: number): Cv {
  const c = cv(NPW, WALL_H);
  fill(c, (x, y) => wallKey(mod(x, T), y));
  const { x0, x1, y0, y1 } = NP;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, y - y0, x1 - x, y1 - y);
      let k: string;
      if (e === 0) k = "k";
      else if (e < 4) {
        const lit = (y - y0 === e && x1 - x > e) || (x - x0 === e && y1 - y > e);
        k = lit ? ["", "Y", "G", "g"][e]! : ["", "h", "g", "g"][e]!;
      } else if (e === 4) k = "k";
      else k = x - x0 === 5 || y - y0 === 5 ? "1" : "2";
      put(c, x, y, k);
    }
  for (const [x, y] of [[x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x0 + 2, y1 - 2], [x1 - 2, y1 - 2]] as const) put(c, x, y, "W");
  crest(c, NP_CX, y0 - 1, [10, 5]);
  // A soft shadow under the frame on the plaster.
  for (let x = x0 + 2; x <= x1 + 1; x++) put(c, x, y1 + 1, "p");
  for (let y = y0 + 2; y <= y1 + 1; y++) put(c, x1 + 1, y, "p");
  const ds = String(Math.max(1, Math.min(99, Math.round(floor)))).split("").map(Number);
  const SH = 2;
  const total = ds.length * NP_DW + (ds.length - 1) * NP_GAP;
  const left = Math.round(NP_CX - (total + SH) / 2 + 0.5);
  const top = Math.round((y0 + 5 + y1 - 5) / 2 - (NP_DH + SH) / 2 + 0.5);
  const ink = new Set<string>();
  ds.forEach((d, i) => NP_DIGITS[d]!.forEach((r, y) => [...r].forEach((ch, x) => ch === "#" && ink.add(`${left + i * (NP_DW + NP_GAP) + x},${top + y}`))));
  const has = (x: number, y: number) => ink.has(`${x},${y}`);
  const shade = (x: number, y: number) => !has(x, y) && [1, 2].some((s) => s <= SH && has(x - s, y - s));
  for (let y = top - 2; y < top + NP_DH + SH + 2; y++)
    for (let x = left - 2; x < left + total + SH + 2; x++) {
      if (has(x, y)) {
        const tl = !has(x - 1, y) || !has(x, y - 1) || !has(x - 1, y - 1);
        const br = !has(x + 1, y) || !has(x, y + 1);
        put(c, x, y, tl ? "Y" : br ? "g" : "G");
      } else if (shade(x, y)) put(c, x, y, "h");
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => has(x + dx!, y + dy!) || shade(x + dx!, y + dy!))) put(c, x, y, "k");
    }
  return c;
}
def("number-panel", [2, 1], NPW, WALL_H, [37, WALL_H - 1], [[whole(numberPanelCv(4))]]);

// ==== The front: the hem (the front wall's low top, seen from inside) and the way in: an open doorway in a gold frame onto the lit
// landing (the elevator hall: warm cream plaster, a gold rail, a slate floor with a cream runner leading in).

const HEM_H = 24;
{
  const c = cv(T, HEM_H);
  fill(c, (x, y) => (y < 4 ? ["Y", "G", "g", "h"][y]! : y >= HEM_H - 5 ? (y === HEM_H - 5 ? "g" : "2") : mod(x, T) === 4 ? "2" : mod(x, T) === 32 ? "5" : y === 7 ? "2" : y === HEM_H - 7 ? "5" : "4"));
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c, true)]]);
}
const ENW = 2 * T;
const ENH = 110;
const ENF = ENH - 1;
/** The landing seen through the doorway (its box). */
const LAND: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number } = { x0: 8, x1: 65, y0: 14, y1: ENF - 2 };
{
  const hall = cv(ENW, ENH);
  for (let y = LAND.y0; y <= LAND.y1; y++)
    for (let x = LAND.x0; x <= LAND.x1; x++) {
      let k: string;
      const glow = Math.hypot((x + 0.5 - 37) / 1.5, y + 0.5 - 30);
      if (y < 56) k = y === 20 ? "p" : glow < 3 ? "W" : glow < 6 ? "L" : glow < 20 ? "w" : "P";
      else if (y < 59) k = ["Y", "G", "g"][y - 56]!;
      else if (y < 74) k = y === 73 ? "g" : "3";
      else {
        // The landing's floor: slate, the cream runner coming toward you, widening.
        const half = 9 + (y - 74) * 0.45;
        const rx = Math.abs(x + 0.5 - 37);
        k = rx < half - 2 ? (rx < half - 4 ? "C" : "g") : rx < half ? "h" : (y - 74) % 8 === 0 ? "2" : "4";
      }
      put(hall, x, y, k);
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
  for (let x = 8; x <= 65; x++) {
    put(f, x, ENF - 1, "G");
    put(f, x, ENF, "g");
  }
  // The landing's lamp: a small gold fan sconce, lit.
  for (let y = 25; y <= 33; y++)
    for (let x = 29; x <= 45; x++) {
      const X = x + 0.5 - 37;
      const Y = y + 0.5 - 34;
      const d = Math.hypot(X / 1.2, Y);
      if (d > 7.5 || Y > 0) continue;
      put(hall, x, y, d > 6.6 ? "g" : d < 3 ? "W" : Math.abs(X) < 0.8 || Math.abs(Math.abs(X) - Math.abs(Y) * 1.2) < 0.7 ? "G" : "L");
    }
  rect(hall, 35, 34, 4, 2, "g");
  rect(hall, 36, 36, 2, 3, "h");
  def("entrance", [2, 1], ENW, ENH, [37, ENF], [[groundShadow(37, ENF - 1, 36, 3), cropBit(hall, false)!, cropBit(f)!]]);
}

// ==== The table and chairs: the game's park table (park.ts PARK_TABLE, keys "1"-"5" light to dark) and its board (intro.ts paintTable),
// recolored in HunChess's colors.

/** The table's slab and board: k, "1" its gold top edge, "2" its slate top, "3" mid, "4" front, "5" deep; L and D the board's squares; P and Q the pieces. */
export const SHOP_TOWER_FLOOR_TABLE_PALETTE: Readonly<Record<string, string>> = {
  k: "#0e1014",
  "1": "#f4b740",
  "2": "#4a5163",
  "3": "#343946",
  "4": "#2a2e37",
  "5": "#16181d",
  L: "#f0d9b5",
  D: "#b58863",
  P: "#fbfbf6",
  Q: "#262321",
};
/** The park table's leg and stools ("1"-"5", light to dark): a gold seat over slate. */
export const SHOP_TOWER_FLOOR_STOOL_PALETTE: Readonly<Record<string, string>> = {
  k: "#0e1014",
  "1": "#ffd877",
  "2": "#f4b740",
  "3": "#4a5163",
  "4": "#2a2e37",
  "5": "#16181d",
};

// ==== (The game's, Nov 19) A 2-wide piece stands at its exact middle (foot 37), a 1-wide one half a pixel east of its square's (foot 18
// of 37), so a 2-wide piece ends half a pixel short of the square piece east of it: a see-through seam at some widths (the lobby's note,
// tower-art.ts). The elevator (shut and open) and the way in get one more column, a copy of their last as drawn, so they meet what's east of them.
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
    return [...bits, { part: { grid: col, outline: false }, at: [p.w, 0] as Pt }];
  });
  p.w += 1;
}
widen("elevator");
widen("elevator-open");
widen("entrance");

// ==== The lights: the elevator's lamp and its dial (soft), the lit landing through the way in; warm pools over the circle's middle
// and before the elevator.

export const SHOP_TOWER_FLOOR_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "elevator", x: LAMP.x, y: LAMP.y, w: LAMP.w, h: LAMP.h, keys: "LW", color: "#ffe2a0", strength: 0.6, halo: 22 },
  { piece: "elevator", x: DIAL.cx - DIAL.r, y: DIAL.cy - DIAL.r, w: 2 * DIAL.r, h: DIAL.r, keys: "YG", color: "#ffb85c", strength: 0.3, halo: 16 },
  { piece: "entrance", x: LAND.x0, y: LAND.y0, w: LAND.x1 - LAND.x0 + 1, h: 42, keys: "WLw", color: "#ffe2a0", strength: 0.45, halo: 24 },
];
export const SHOP_TOWER_FLOOR_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: CIRCLE_MID, x: 37, y: 37, rx: 80, ry: 56, color: "#ffe2a0", strength: 0.22 },
  { piece: "elevator", x: 37, y: WALL_H + 22, rx: 46, ry: 22, color: "#ffb85c", strength: 0.18 },
];

// ==== The layout.

const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) return;
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};
/** The circle's tile for a square (columns 2-7, rows 2-7), or null: set by the circle's section. */
let circleAt: (col: number, row: number) => { name: string; rot?: 0 | 1 | 2 | 3; flip?: boolean } | null = () => null;
circleAt = (col, row) => CIRCLE_SQ.get(`${col},${row}`) ?? null;

// -- The floor (every square): the circle in the middle, the inlay framing columns 1-8, rows 1-8.
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const light = (col + row) % 2 === 0;
    const ab = light ? "a" : "b";
    const inRing = col >= 1 && col <= N - 2 && row >= 1 && row <= N - 2;
    const west = col === 1;
    const east = col === N - 2;
    const north = row === 1;
    const south = row === N - 2;
    const circ = circleAt(col, row);
    if (circ) at(circ.name, col, row, false, { ...(circ.rot ? { rot: circ.rot } : {}), ...(circ.flip ? { flip: true } : {}) });
    else if (inRing && (west || east) && (north || south)) {
      const rot = north ? (west ? 0 : 1) : east ? 2 : 3;
      at(`floor-edge-corner-${ab}`, col, row, false, rot ? { rot } : {});
    } else if (inRing && (west || east || north || south)) {
      const rot = north ? 0 : east ? 1 : south ? 2 : 3;
      at(`floor-edge-${ab}`, col, row, false, rot ? { rot } : {});
    } else {
      const rot = Math.floor(hash(col, row, 9) * 4) as 0 | 1 | 2 | 3;
      at(`floor-${ab}`, col, row, false, rot ? { rot } : {});
    }
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The back wall (row 0): the corners blank; the number panels (1-2, 7-8, upright, the same number) and plain wall either side of the
// elevator (4-5).
at("wall-none", 0, 0, true);
at("number-panel", 1, 0, true);
at("number-panel", 7, 0, true);
for (const c of [3, 6]) at("wall", c, 0, true);
if (PIECES["elevator"]) at("elevator", 4, 0, false, { door: "top" });
else for (const c of [4, 5]) at("wall", c, 0, true);
at("wall-none", N - 1, 0, true);
// -- The side walls: one surface each, drawn by the scene (towerFloorWallGrid); here, solid blanks.
for (let row = 1; row < N - 1; row++) {
  at("wall-none", 0, row, true);
  at("wall-none", N - 1, row, true);
}
// -- The front: the hem, and the way in at columns 4-5.
at("wall-none", 0, N - 1, true);
at("wall-none", N - 1, N - 1, true);
for (let col = 1; col < N - 1; col++) if (col !== 4 && col !== 5) at("hem", col, N - 1, true, col >= 5 ? { flip: true } : {});
// (The game's, Nov 19: the way in is the way down to the lobby, a door to the lobby's room, not out to the town.)
at("entrance", 4, N - 1, false, { door: "front" });

/** Where every piece goes: floor tiles first, then the upright pieces north to south. */
export const SHOP_TOWER_FLOOR_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
/** Every piece by its name, each its own Character `shop-tower-floor-<name>`. */
export const SHOP_TOWER_FLOOR_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
const PIECES_BY_FLOOR = new Map<number, Readonly<Record<string, Character>>>([[4, SHOP_TOWER_FLOOR_PIECES]]);
/**
 * The pieces for a floor (1 to 99): SHOP_TOWER_FLOOR_PIECES with its `number-panel` showing that floor's number (made once per floor
 * and kept). Floor 4's are SHOP_TOWER_FLOOR_PIECES itself; another floor's panel has the id `shop-tower-floor-number-panel-<floor>`.
 */
export function towerFloorPieces(floor: number): Readonly<Record<string, Character>> {
  const f = Math.max(1, Math.min(99, Math.round(floor)));
  let got = PIECES_BY_FLOOR.get(f);
  if (!got) {
    const ch = toChar({ ...PIECES["number-panel"]!, frames: [[whole(numberPanelCv(f))]] });
    got = { ...SHOP_TOWER_FLOOR_PIECES, "number-panel": { ...ch, id: `${ch.id}-${f}` } };
    PIECES_BY_FLOOR.set(f, got);
  }
  return got;
}
/**
 * The squares the table stands on (its middle on the circle's, 4.5, 4.5: columns and rows 4-5), solid (Eric, Nov 21: "make it so you can't
 * run through the chessboard"), a held arrow key walking you round it (room.ts `stepRound`).
 */
export const SHOP_TOWER_FLOOR_TABLE_SQUARES: readonly { c: number; r: number }[] = [
  { c: 4, r: 4 },
  { c: 5, r: 4 },
  { c: 4, r: 5 },
  { c: 5, r: 5 },
];
/** The floor arrow to the next door (Nov 21, tower-floor-scene.ts): its top in gold, its rim pale, its sides the deep gold, its edge the outline. */
export const SHOP_TOWER_FLOOR_ARROW_PALETTE = { top: PALETTE.G!, rim: PALETTE.Y!, side: PALETTE.h!, edge: PALETTE.k! } as const;
/** The camera's fixed look (square coordinates, a square's middle on its whole number): the room seen whole. */
export const SHOP_TOWER_FLOOR_CAM = { x: 4.5, y: 4.2 } as const;

export type { LightPool, LightSpot };
