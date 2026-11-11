/**
 * The zebras' bakery (Eric's design, Nov 10, notes/zebra-eric.md): a bakery run like a mob, where the crew are really chess nerds.
 * Drawn by hand in code (Nov 10), built as Jefferson's warehouse is (out/house-shop-grex), with two rooms:
 *
 * - **HOUSE_ZEBRA**, the front in the town: a bakery under a zebra-striped awning, bread in the window, a blank sign board (the game
 *   writes the name), a chalk A-board on the pavement ("JUST BREAD. MOVE ALONG."), and in its idle two eyes peeking through the door's
 *   blinds while the chimney puffs.
 * - **The front room** (the shop; SHOP_ZEBRA_*): 20 x 20 squares like every home, but smaller inside (a 16 x 12 floor, columns 2-17,
 *   rows 7-18) because the back room is behind it. A black and white checker floor; cream plaster over subway tile; behind the counter
 *   the bread shelves under a big "JUST A BAKERY" sign; the chalkboard menu ("BREAD. MORE BREAD. THAT'S IT."); the employee of the month
 *   (a baguette); "NO LOITERING"; the doormat says MOVE ALONG. The giant mixer (`mixer`, 12 frames) kneads dough in its steel bowl. The
 *   counter (a glass case of pastries, a marble top, the register, the bell) with the Boss Crate on it (a zebra-striped pastry box tied
 *   with string, steam curling out). At the back left, **the door to the back room** (`door-back`: STAFF ONLY, a speakeasy slot, a note
 *   taped on: "NO CHESS IN HERE").
 * - **The back room** (SHOP_ZEBRA_BACK_*): its own room (a 10 x 6 floor in a 14 x 14 grid, a quarter of the home's floor), dim, planked,
 *   a red rug; the big table covered in scattered pieces round a roll-up board; the kingpin's wingback chair at its head (west), three
 *   chairs along its north side for the crew, the green card-table lamp over it; the TV on the back wall showing a chess stream (a board
 *   with moving pieces, an eval bar and a chat column; generic, no streamer, site or logo); every wall scribbled with game theory in
 *   marker (board sketches, arrows, "e4!!", "Nf3?!", circled squares, lines), a cork board with red string, a bookshelf of chess books, a
 *   filing cabinet of openings, a coat rack of fedoras. The challenge plays at the table.
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row). Floor tiles
 * are flat, top-down, 37 x 37, foot at their middle. North is up the picture; the camera looks north.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import type { LightPool, LightSpot } from "../../../../packages/app/src/town/houses/kit.ts";
import {
  arrow,
  BAKERY_PALETTE,
  baguette,
  bits,
  blob,
  boardSketch,
  boule,
  braid,
  croissant,
  cropBit,
  cv,
  get,
  handText,
  handTextC,
  hash,
  line,
  put,
  rect,
  ring,
  roll,
  slice,
  stamp,
  text,
  textC,
  textWidth,
  tin,
  tinyPiece,
  whole,
  type Bit,
  type Cv,
  type Key,
  type Pt,
} from "./bakery-kit.ts";

const PALETTE: Record<string, string> = { ...BAKERY_PALETTE };
const T = 37;

interface Piece {
  name: string;
  /** Its footprint in squares (wide, deep) and its picture's size and foot in pixels. */
  sq: readonly [number, number];
  w: number;
  h: number;
  foot: Pt;
  frames: Bit[][];
  ms: number;
  cues?: Record<number, string>;
}
const PIECES: Record<string, Piece> = {};
function toChar(p: Piece, prefix = "shop-zebra"): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bs, f) => ({
    ms: p.ms,
    ...(p.cues?.[f] ? { cue: p.cues[f] } : {}),
    layers: bs.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `${prefix}-${p.name}`, name: `The zebras' bakery: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000, cues?: Record<number, string>): void {
  if (PIECES[name]) throw new Error(`piece ${name} twice`);
  PIECES[name] = { name, sq, w, h, foot, frames, ms, ...(cues ? { cues } : {}) };
}
/** A still piece from one canvas (outlined or not). */
const still = (name: string, sq: readonly [number, number], c: Cv, foot: Pt, outline = false) => def(name, sq, c[0]!.length, c.length, foot, [[whole(c, outline)]]);

// =====================================================================================================================================
// The front room (the shop).
// =====================================================================================================================================

/**
 * The front room's floor: 20 rows of 20, `.` floor and `#` wall or nothing. The walkable floor is columns 2-17, rows 7-18 (16 x 12).
 * The way out is row 19, columns 9-10 (the entrance); **the door to the back room** is row 6, columns 3-4. Both doors' own squares are
 * `.` here (as the way out always was) and are what you walk into to go through; block every `#` and every solid piece's squares.
 */
export const SHOP_ZEBRA_FLOOR: readonly string[] = Array.from({ length: 20 }, (_, r) =>
  Array.from({ length: 20 }, (_, c) =>
    (r >= 7 && r <= 18 && c >= 2 && c <= 17) || (r === 19 && (c === 9 || c === 10)) || (r === 6 && (c === 3 || c === 4)) ? "." : "#",
  ).join(""),
);
const isOpen = (c: number, r: number) => SHOP_ZEBRA_FLOOR[r]?.[c] === "." && r < 19 && r > 6;

// ---- The floor: a black and white checker (four checks a square), worn and dusted with flour here and there.

function checker(x: number, y: number, seed: number, flour = 0): string {
  const lx = ((x % T) + T) % T;
  const ly = ((y % T) + T) % T;
  if (lx === 0 || ly === 0 || lx === 18 || ly === 18) return "g";
  const white = (lx < 18) === (ly < 18);
  const s = hash(x, y, seed);
  if (flour && hash(x >> 1, y >> 1, seed + 9) < flour) return white ? (s < 0.5 ? "f" : "W") : s < 0.3 ? "x" : "a";
  if (white) return s < 0.06 ? "w" : "W";
  return s < 0.05 ? "a" : "A";
}
function tile(name: string, fn: (x: number, y: number) => Key): void {
  const c = cv(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = fn(x, y) ?? ".";
  still(name, [1, 1], c, [18, 18]);
}
tile("floor-a", (x, y) => checker(x, y, 1));
tile("floor-b", (x, y) => checker(x, y, 2));
/** Flour dusted on the checks (round the mixer and in front of the counter). */
tile("floor-flour", (x, y) => checker(x, y, 3, 0.22));
/** Off the floor (under the walls): plain dark. */
tile("floor-stock", (x, y) => (hash(x, y, 4) < 0.1 ? "z" : "Z"));
/** The doormat, across the two squares inside the door: coir brown, a dark border, MOVE ALONG in it. */
{
  const c = cv(2 * T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < 2 * T; x++) {
      const inMat = x > 3 && x < 2 * T - 4 && y > 6 && y < 31;
      if (!inMat) {
        c[y]![x] = checker(x, y, 5);
        continue;
      }
      const edge = x < 7 || x > 2 * T - 8 || y < 10 || y > 27;
      c[y]![x] = edge ? "7" : hash(x, y, 6) < 0.3 ? "8" : "9";
    }
  textC(c, T, 13, "MOVE", "6");
  textC(c, T, 20, "ALONG", "6");
  still("mat-w", [1, 1], slice(c, 0, 0, T, T), [18, 18]);
  still("mat-e", [1, 1], slice(c, T, 0, T, T), [18, 18]);
}

// ---- The back wall (row 6): one painting 18 squares wide (columns 1-18), cut into cards. Cream plaster over white subway tile, a
// wooden chair rail, a crown molding; the door to the back room; the menu; the employee of the month; the bread shelves under the big
// sign; the clock; NO LOITERING.

const WH = 150; // the back wall's height
const BW = 18 * T;
const wall = cv(BW, WH);
const RAIL = 104; // the chair rail's top
function plaster(x: number, y: number): string {
  if (y < 7) return y < 2 ? "8" : y < 4 ? "9" : y < 6 ? "0" : "7"; // the crown molding
  if (y >= WH - 7) return y === WH - 7 ? "8" : "7"; // the skirting
  if (y >= RAIL && y < RAIL + 4) return y === RAIL ? "0" : y === RAIL + 3 ? "7" : "9"; // the chair rail
  if (y > RAIL + 3) {
    // Subway tile: 12 x 6 bricks, offset every other row.
    const ty = y - RAIL - 4;
    const off = Math.floor(ty / 6) % 2 ? 6 : 0;
    return ty % 6 === 5 || (x + off) % 12 === 0 ? "5" : hash(x, y, 8) < 0.04 ? "x" : "4";
  }
  const s = hash(x >> 1, y >> 1, 3);
  return y < 12 ? "1" : s < 0.06 ? "1" : s > 0.94 ? "3" : "2";
}
for (let y = 0; y < WH; y++) for (let x = 0; x < BW; x++) wall[y]![x] = plaster(x, y);
const wx = (col: number) => (col - 1) * T; // a column's west edge in the wall's pixels

// -- The door to the back room (columns 3-4): a dark wooden frame, a burgundy panelled door, a brass knob, a speakeasy slot, STAFF
// ONLY, the taped note, warm light under it.
const DOOR = { x: wx(3) + 13, y: 40, w: 48, h: WH - 7 - 40 };
{
  const { x, y, w, h } = DOOR;
  rect(wall, x - 4, y - 4, w + 8, h + 4, (i, j) => (i < 2 || i >= w + 6 || j < 2 ? (i === 0 || j === 0 ? "9" : "7") : i < 4 || i >= w + 4 || j < 4 ? "6" : null));
  rect(wall, x, y, w, h, (i, j) => {
    const panel = (i > 5 && i < w - 6 && ((j > 30 && j < 62) || (j > 68 && j < h - 6))) as boolean;
    const bevel = panel && (i === 6 || j === 31 || j === 69);
    if (j === h - 1) return "l"; // the light under the door
    if (bevel) return "r";
    if (panel) return hash(i, j, 12) < 0.08 ? "r" : "R";
    return i === 0 ? "r" : i === 1 ? "R" : hash(i, j, 13) < 0.05 ? "r" : "R";
  });
  // The slot (a little sliding shutter at a zebra's eye height) and its grille.
  rect(wall, x + 14, y + 12, 20, 9, (i, j) => (i === 0 || j === 0 || i === 19 || j === 8 ? "y" : j % 2 ? "]" : "S"));
  // STAFF ONLY on a white plate.
  rect(wall, x + 8, y + 24, 32, 9, (i, j) => (i === 0 || j === 0 || i === 31 || j === 8 ? "x" : "X"));
  textC(wall, x + 24, y + 26, "STAFF", "Z");
  // (ONLY under it, small: on the panel below.)
  rect(wall, x + 12, y + 34, 24, 8, (i, j) => (i === 0 || j === 0 || i === 23 || j === 7 ? "x" : "X"));
  textC(wall, x + 24, y + 35, "ONLY", "Z");
  // The taped note, a bit askew: NO CHESS IN HERE.
  for (let j = 0; j < 17; j++)
    for (let i = 0; i < 30; i++) {
      const sk = Math.round(j * 0.12);
      put(wall, x + 9 + i + sk, y + 50 + j, j === 16 || i === 29 ? "x" : "X");
    }
  text(wall, x + 12, y + 52, "NO CHESS", "-");
  text(wall, x + 14, y + 59, "IN HERE", "-");
  stamp(wall, x + 7, y + 48, ["CCC.", ".CCC"]);
  stamp(wall, x + 35, y + 48, [".CCC", "CCC."]);
  // The knob and its plate.
  rect(wall, x + w - 9, y + 66, 4, 10, "y");
  blob(wall, x + w - 7, y + 70, 2.6, 2.6, (dx, dy) => (dx + dy < -0.4 ? "Y" : "y"));
}
// -- The menu (columns 5-6): a chalkboard in a wooden frame.
{
  const x = wx(5) + 6;
  const y = 30;
  const w = 62;
  const h = 52;
  rect(wall, x, y, w, h, (i, j) => (i < 3 || j < 3 || i >= w - 3 || j >= h - 3 ? (i === 0 || j === 0 ? "9" : "8") : hash(i, j, 21) < 0.05 ? "j" : "K"));
  textC(wall, x + w / 2, y + 6, "MENU", "J");
  line(wall, x + 18, y + 13, x + w - 19, y + 13, "J");
  text(wall, x + 6, y + 17, "BREAD", "J");
  text(wall, x + w - 8, y + 17, "2", "J");
  text(wall, x + 6, y + 25, "MORE BREAD", "J");
  text(wall, x + w - 8, y + 25, "3", "J");
  text(wall, x + 6, y + 33, "THAT'S IT", "J");
  // A loaf doodled in chalk in the corner.
  for (let i = 0; i < 12; i++) put(wall, x + 40 + i, y + 43 - Math.round(Math.sin((i / 11) * Math.PI) * 3), "J");
  line(wall, x + 40, y + 43, x + 51, y + 43, "J");
  for (const i of [43, 46, 49]) line(wall, x + i, y + 42, x + i + 1, y + 40, "J");
}
// -- The employee of the month (columns 7-8): a gilt frame round a baguette in a tiny bow tie; a plaque under it.
{
  const x = wx(7) + 16;
  const y = 30;
  const w = 42;
  const h = 34;
  rect(wall, x, y, w, h, (i, j) => (i < 3 || j < 3 || i >= w - 3 || j >= h - 3 ? ((i + j) % 4 === 0 ? "y" : "Y") : j < 20 ? "h" : "G"));
  baguette(wall, x + 7, y + 22, x + w - 8, y + 12, 4, 3);
  // Its bow tie.
  stamp(wall, x + 19, y + 13, ["R.R", "RRR", "R.R"]);
  // Its plaque: EMPLOYEE OF THE MONTH.
  rect(wall, x - 2, y + h + 3, w + 4, 15, (i, j) => (i === 0 || j === 0 || i === w + 3 || j === 14 ? "y" : "Y"));
  textC(wall, x + w / 2, y + h + 5, "EMPLOYEE", "6");
  // ("OF THE MONTH" in the 3 px line under it would be mush: the plaque says EMPLOYEE, and a tiny "#1" ribbon is pinned on the frame.)
  rect(wall, x + w - 6, y + h - 8, 7, 7, (i, j) => (Math.hypot(i - 3, j - 3) < 3.6 ? "Y" : null));
  stamp(wall, x + w - 5, y + h - 2, ["R.R", "R.R"]);
  text(wall, x + w - 5, y + h - 7, "1", "R");
}
// -- The bread shelves (columns 9-16), behind the counter: a wooden case of three shelves, under the big sign.
const SHELF = { x: wx(9) + 4, x1: wx(17) - 4, top: 40, bottom: RAIL + 30 };
{
  const { x, x1, top, bottom } = SHELF;
  // The case's back (dark wood) and sides.
  rect(wall, x, top, x1 - x, bottom - top, (i, j) => (i < 4 || i >= x1 - x - 4 ? (i === 0 ? "9" : i === x1 - x - 1 ? "6" : "8") : j < 3 ? "6" : hash(i, j, 31) < 0.08 ? "6" : "7"));
  // Uprights between bays every 2 squares.
  for (let b = 1; b < 4; b++) rect(wall, x + b * 74 - 2, top, 4, bottom - top, (i) => (i === 0 ? "9" : i === 3 ? "6" : "8"));
  const shelfY = [top + 22, top + 47, top + 72];
  for (const sy of shelfY) rect(wall, x, sy, x1 - x, 4, (i, j) => (j === 0 ? "0" : j === 3 ? "6" : "9"));
  // The loaves, bay by bay, shelf by shelf (each bay 74 px).
  for (let b = 0; b < 4; b++) {
    const bx = x + b * 74 + 4;
    // Top shelf: boules and rolls.
    const s0 = shelfY[0]!;
    if (b % 2 === 0) {
      boule(wall, bx + 14, s0 - 7, 10);
      boule(wall, bx + 36, s0 - 7, 10);
      boule(wall, bx + 57, s0 - 6, 9);
    } else {
      for (let i = 0; i < 6; i++) roll(wall, bx + 8 + i * 10, s0 - 4, 4, 3);
      for (let i = 0; i < 5; i++) roll(wall, bx + 13 + i * 10, s0 - 9, 4, 3);
    }
    // Middle shelf: baguettes standing in a basket, leaning.
    const s1 = shelfY[1]!;
    if (b === 1 || b === 2) {
      for (let i = 0; i < 7; i++) baguette(wall, bx + 8 + i * 8, s1 - 1, bx + 12 + i * 8 + (i % 2 ? 3 : -2), s1 - 24, 3, 3);
      rect(wall, bx + 4, s1 - 9, 62, 9, (i, j) => (j === 0 ? "0" : (i + j) % 3 === 0 ? "8" : "9"));
    } else {
      tin(wall, bx + 4, s1 - 14, 18, 14);
      tin(wall, bx + 24, s1 - 14, 18, 14);
      tin(wall, bx + 44, s1 - 14, 18, 14);
    }
    // Bottom shelf: braids and croissants.
    const s2 = shelfY[2]!;
    if (b % 2) {
      braid(wall, bx + 4, s2 - 6, 30);
      braid(wall, bx + 34, s2 - 6, 30);
    } else for (let i = 0; i < 5; i++) croissant(wall, bx + 8 + i * 12, s2 - 5, 5);
  }
}
// -- The big sign over the shelves: JUST A BAKERY, gold on burgundy, the letters 3x.
const BIGSIGN = { cx: (wx(9) + wx(17)) / 2, y: 10, h: 25 };
{
  const s = "JUST A BAKERY";
  const tw = textWidth(s) * 3;
  const x0 = Math.round(BIGSIGN.cx - tw / 2) - 9;
  const w = tw + 18;
  rect(wall, x0, BIGSIGN.y, w, BIGSIGN.h, (i, j) => (i < 2 || j < 2 || i >= w - 2 || j >= BIGSIGN.h - 2 ? (i === 0 || j === 0 ? "Y" : "y") : "R"));
  const tmp = cv(textWidth(s), 5);
  text(tmp, 0, 0, s, "Y");
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < tmp[0]!.length; i++) if (tmp[j]![i] === "Y") rect(wall, x0 + 9 + i * 3, BIGSIGN.y + 5 + j * 3, 3, 3, (a, b) => (a === 0 && b === 0 ? "Y" : b === 2 ? "y" : "Y"));
  // Two little wheat sprigs at its ends.
  for (const ex of [x0 + 4, x0 + w - 5]) for (let j = 0; j < 4; j++) put(wall, ex, BIGSIGN.y + 8 + j * 3, "Y");
}
// -- The clock (column 17) and NO LOITERING (column 18).
{
  const cx = wx(17) + 18;
  blob(wall, cx, 44, 12, 12, (dx, dy, d) => (d > 0.82 ? "S" : d > 0.74 ? "i" : "X"));
  for (let h = 0; h < 12; h++) put(wall, cx + Math.cos((h / 12) * Math.PI * 2) * 8.5, 44 + Math.sin((h / 12) * Math.PI * 2) * 8.5, "s");
  line(wall, cx, 44, cx, 37, "Z");
  line(wall, cx, 44, cx + 5, 46, "Z");
  const x = wx(18) + 3;
  rect(wall, x, 28, 30, 26, (i, j) => (i === 0 || j === 0 || i === 29 || j === 25 ? "-" : "X"));
  textC(wall, x + 15, 31, "NO", "-");
  textC(wall, x + 15, 38, "LOITER", "Z");
  textC(wall, x + 15, 45, "ING", "Z");
}
// -- Columns 1-2: canisters on a little shelf (FLOUR, SUGAR) and a potted basil.
{
  const x = wx(2) + 3;
  rect(wall, x - 2, 70, 34, 3, (i, j) => (j === 0 ? "0" : "8"));
  for (const [cx, label] of [[x + 6, "F"], [x + 17, "S"]] as const) {
    rect(wall, cx - 5, 56, 10, 14, (i, j) => (j < 2 ? "i" : i === 0 ? "I" : i === 9 ? "s" : "X"));
    text(wall, cx - 1, 60, label, "R");
  }
  blob(wall, x + 27, 61, 5, 6, (dx, dy) => (hash(Math.round(dx * 9), Math.round(dy * 9), 3) < 0.4 ? "V" : "v"));
  rect(wall, x + 24, 64, 7, 6, (i) => (i === 0 ? "c" : "b"));
}
/** The back wall's cards, by column: `bw-<col>`, the door's two columns one piece. */
const BACK_CARD = (col: number) => (col === 3 ? "door-back" : `bw-${col}`);
for (let col = 1; col <= 18; col++) {
  if (col === 4) continue;
  const w = col === 3 ? 2 * T : T;
  still(BACK_CARD(col), [col === 3 ? 2 : 1, 1], slice(wall, wx(col), 0, w, WH), [Math.floor(w / 2), WH - 1]);
}

// ---- The side walls (columns 1 and 18, rows 7-18): cards seen face on, the same plaster and tile, 130 tall.

const SH = 130;
function sideCard(name: string, deco?: (c: Cv) => void): void {
  const c = cv(T, SH);
  const rail = RAIL - (WH - SH);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < T; x++) {
      const yy = y + (WH - SH); // the same heights over the floor as the back wall
      c[y]![x] = yy < WH - SH + 4 ? "7" : plaster(x + 3, yy);
    }
  void rail;
  deco?.(c);
  still(name, [1, 1], c, [18, SH - 1]);
}
sideCard("side");
sideCard("side-b", (c) => {
  // A framed print of a wheat sheaf.
  rect(c, 7, 28, 23, 28, (i, j) => (i < 2 || j < 2 || i > 20 || j > 25 ? "8" : "3"));
  for (let k = -2; k <= 2; k++) line(c, 18, 50, 18 + k * 3, 34, "y");
  for (let k = -2; k <= 2; k++) for (let j = 0; j < 4; j++) put(c, 18 + k * 3 + (k < 0 ? -1 : 1), 35 + j * 2, "Y");
});
sideCard("side-c", (c) => {
  // A small shelf with a jar of breadsticks.
  rect(c, 4, 52, 29, 3, (i, j) => (j === 0 ? "0" : "8"));
  rect(c, 12, 40, 12, 12, (i, j) => (i === 0 || i === 11 ? "h" : j === 0 ? "i" : "G"));
  for (let i = 0; i < 4; i++) line(c, 14 + i * 3, 50, 13 + i * 3 + (i % 2), 30, i % 2 ? "C" : "c");
});
sideCard("side-d", (c) => {
  // Two aprons on hooks.
  for (const [ax, k] of [[10, "X"], [24, "x"]] as const) {
    put(c, ax, 30, "S");
    rect(c, ax - 5, 32, 10, 3, k);
    rect(c, ax - 6, 35, 12, 22, (i, j) => (i === 0 || i === 11 ? "x" : j === 8 ? "x" : k));
  }
});

// ---- The front wall (row 19): a low sill with the backs of the window's bread baskets; the entrance, its door propped open on the day,
// its OPEN sign seen from inside (NEPO).

const HEM_H = 26;
{
  const c = cv(T, HEM_H);
  rect(c, 0, 0, T, HEM_H, (x, y) => (y < 3 ? (y === 0 ? "0" : "9") : y < 6 ? "8" : hash(x, y, 41) < 0.06 ? "1" : "2"));
  still("hem", [1, 1], c, [18, HEM_H - 1]);
  const d = cv(T, HEM_H);
  for (let y = 0; y < HEM_H; y++) for (let x = 0; x < T; x++) d[y]![x] = c[y]![x]!;
  // Two loaves in a basket on the sill (their backs).
  rect(d, 6, 0, 25, 4, (i, j) => (j === 0 ? "0" : (i + j) % 3 ? "9" : "8"));
  boule(d, 13, -1, 6, false);
  boule(d, 24, -2, 7, false);
  still("hem-bread", [1, 1], d, [18, HEM_H - 1]);
  const p = cv(T, 70);
  rect(p, 0, 0, T, 70, (x, y) => (y >= 70 - HEM_H ? c[y - (70 - HEM_H)]![x]! : x < 4 ? "9" : x > 32 ? "6" : y < 4 ? "0" : "8"));
  still("hem-post", [1, 1], p, [18, 69]);
}
const ENT = { w: 2 * T, h: 112 };
{
  const { w, h } = ENT;
  const c = cv(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const frame = x < 5 || x >= w - 5 || y < 6;
      if (frame) c[y]![x] = x === 0 || y === 0 ? "9" : x === w - 1 ? "6" : "8";
      else c[y]![x] = y > h - 18 ? (hash(x, y, 51) < 0.2 ? "x" : "w") : y > h - 40 ? (hash(x, y, 52) < 0.3 ? "V" : "v") : "H"; // the street, a hedge, the sky
    }
  // The door, swung open against the east jamb: its edge, its glass, the OPEN sign backwards.
  rect(c, w - 17, 8, 12, h - 8, (i, j) => (i < 2 ? "6" : j < 3 || j > h - 12 ? "R" : i > 9 ? "R" : j < 50 ? "G" : "R"));
  const sign = cv(16, 7);
  rect(sign, 0, 0, 16, 7, (i, j) => (i === 0 || j === 0 || i === 15 || j === 6 ? "R" : "X"));
  text(sign, 2, 1, "OPEN", "R");
  // (Seen from inside, the OPEN sign reads backwards.)
  for (let j = 0; j < 7; j++) for (let i = 0; i < 16; i++) put(c, 8 + (15 - i), 22 + j, sign[j]![i]!);
  line(c, 9, 22, 16, 14, "S");
  line(c, 22, 22, 16, 14, "S");
  still("entrance", [2, 1], c, [T, h - 1]);
}

// ---- The counter (columns 9-15, row 8): a glass case of pastries under a marble top; the register; the bell; a stack of paper bags.

const CT = { w: 7 * T, h: 66, top: 16 }; // its top is `h - 1 - top` px over its foot... see CT_TOP
/** The counter's top, in px over its foot (what stands on it stands this high). */
export const SHOP_ZEBRA_COUNTER_TOP = CT.h - 1 - CT.top;
{
  const { w, h, top } = CT;
  const c = cv(w, h);
  // The marble top (a little depth, then its front lip).
  rect(c, 0, top - 6, w, 6, (x, y) => (y === 0 ? "x" : hash(x, y, 61) < 0.07 ? "5" : "4"));
  rect(c, 0, top, w, 3, (x, y) => (y === 2 ? "5" : "x"));
  // The glass case's front: steel frame, glass, two trays of pastries inside.
  rect(c, 0, top + 3, w, 38, (x, y) => (x < 3 || x >= w - 3 || y < 2 || y > 35 || x % 74 < 2 ? "i" : null));
  for (let x = 3; x < w - 3; x++)
    for (let y = top + 5; y < top + 39; y++) if (get(c, x, y) === ".") put(c, x, y, y < top + 7 ? "~" : "G");
  for (const ty of [top + 20, top + 36]) rect(c, 3, ty, w - 6, 2, (x, y) => (y === 0 ? "I" : "s"));
  for (let i = 0; i < 18; i++) {
    const px = 12 + i * 13.5;
    if (i % 3 === 0) croissant(c, px, top + 17, 5);
    else if (i % 3 === 1) roll(c, px, top + 16, 5, 3);
    else boule(c, px, top + 15, 5, true);
    if (i % 2) braid(c, px - 6, top + 32, 12);
    else roll(c, px, top + 32, 4, 3);
  }
  // Glass glints.
  for (let i = 0; i < 6; i++) line(c, 20 + i * 44, top + 30, 26 + i * 44, top + 8, "~");
  // The wooden base and the toe kick.
  rect(c, 0, top + 41, w, h - top - 41, (x, y) => (y === 0 ? "0" : y > h - top - 45 ? "6" : x % 37 === 0 ? "7" : hash(x, y, 62) < 0.06 ? "7" : "8"));
  // A burgundy band with gold rule across the base.
  rect(c, 0, top + 44, w, 3, (x, y) => (y === 1 ? "Y" : "R"));
  // On the top: the register (east end), the service bell, the paper bags, a tray of breadsticks.
  const rx = w - 44;
  rect(c, rx, top - 22, 30, 16, (x, y) => (y < 2 ? "I" : x === 0 ? "I" : x === 29 ? "S" : y > 12 ? "s" : "i"));
  rect(c, rx + 4, top - 30, 14, 8, (x, y) => (x === 0 || y === 0 ? "I" : y === 7 ? "S" : "}"));
  text(c, rx + 6, top - 28, "88", ":");
  for (let i = 0; i < 4; i++) rect(c, rx + 4 + i * 6, top - 18, 4, 3, i === 3 ? "R" : "X");
  // The bell.
  blob(c, 40, top - 8, 5, 4, (dx, dy) => (dy > 0.6 ? "y" : dx + dy < -0.6 ? "X" : "Y"));
  rect(c, 34, top - 6, 13, 2, "S");
  put(c, 40, top - 13, "Y");
  // Paper bags.
  rect(c, 64, top - 14, 14, 9, (x, y) => (y === 0 ? "C" : x === 13 ? "b" : "c"));
  rect(c, 66, top - 18, 10, 4, (x) => (x % 3 ? "C" : "c"));
  // A tray of breadsticks.
  rect(c, 172, top - 7, 26, 2, "s");
  for (let i = 0; i < 6; i++) line(c, 174 + i * 4, top - 8, 178 + i * 4, top - 13, "c");
  still("counter", [7, 1], c, [Math.floor(w / 2), h - 1]);
}
/** Where the Boss Crate stands on the counter, in the counter's pixels (its foot): left of middle. */
export const SHOP_ZEBRA_CRATE_AT: Pt = [108, CT.top - 2];

// ---- The Boss Crate: a zebra-striped pastry box tied with burgundy string, a gold seal; steam curls out from under its lid.

const CR = { w: 36, h: 44 };
{
  const frames: Bit[][] = [];
  for (let f = 0; f < 6; f++) {
    const c = cv(CR.w, CR.h);
    const x0 = 3;
    const y0 = 16;
    const bw = 30;
    const bh = 24;
    // The box: zebra stripes on its front (wavy), its top a lighter lid.
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const stripe = Math.sin((x + Math.sin(y / 3) * 2.5) / 2.2) > 0.35;
        put(c, x0 + x, y0 + y, y < 5 ? (y === 0 ? "X" : stripe ? "z" : "x") : stripe ? "Z" : x === bw - 1 ? "x" : "X");
      }
    // The string: down the middle both ways, a bow on top.
    line(c, x0 + 15, y0, x0 + 15, y0 + bh - 1, "R");
    line(c, x0, y0 + 3, x0 + bw - 1, y0 + 3, "R");
    stamp(c, x0 + 9, y0 - 5, ["RR.....RR", "RRR...RRR", ".RRRrRRR.", "...rRr...", "..R...R..", ".R.....R."]);
    // The gold seal.
    blob(c, x0 + 23, y0 + 13, 4, 4, (dx, dy) => (dx + dy < -0.5 ? "Y" : "y"));
    put(c, x0 + 23, y0 + 13, "Y");
    // Steam: two curls rising from under the lid's front edge, drifting up as the frames go.
    const sp: Speck[] = [];
    for (const [sx, ph] of [[x0 + 6, 0], [x0 + 25, 3]] as const) {
      const t = (f + ph) % 6;
      for (let k = 0; k < 4; k++) {
        const yy = y0 - 2 - t * 2 - k * 3;
        if (yy < 1) continue;
        put(c, sx + Math.round(Math.sin((t + k) * 1.3) * 1.5), yy, k > 2 || t > 4 ? "x" : "f");
      }
    }
    frames.push([whole(c, false)]);
  }
  def("crate", [1, 1], CR.w, CR.h, [18, CR.h - 4], frames, 170);
}

// ---- The giant mixer (the showpiece): a floor mixer twice a zebra's height, kneading a mound of dough in its steel bowl. 12 frames.

const MX = { w: 3 * T, h: 176 };
/** The mixer's loop: 12 frames x 110 ms (1.32 s a turn of the hook). Cues: `thump` f0 and f6 (the dough slapping the bowl). */
export const SHOP_ZEBRA_MIXER_MS = 110;
{
  const { w, h } = MX;
  const frames: Bit[][] = [];
  const BOWL = { cx: 50, top: 92, rx: 40, depth: 50 };
  const COL = { x: 82, w: 20 }; // the pedestal's column, behind the bowl's east side
  for (let f = 0; f < 12; f++) {
    const ph = (f / 12) * Math.PI * 2;
    const back = cv(w, h);
    // The pedestal: a heavy base on the floor, the column rising behind the bowl, the head overhanging it. Steel, lit from the left.
    const steel = (i: number, n: number) => (i < 2 ? "I" : i < n * 0.35 ? "i" : i < n - 3 ? "s" : "S");
    rect(back, COL.x, 34, COL.w, h - 34 - 8, (i) => steel(i, COL.w));
    rect(back, 8, h - 14, w - 12, 10, (i, j) => (j === 0 ? "I" : j === 9 ? "S" : steel(Math.min(i, 30), 30)));
    // The head: a rounded box from the column out over the bowl.
    for (let y = 16; y < 48; y++)
      for (let x = 22; x < COL.x + COL.w; x++) {
        const rr = 8;
        const cxr = x < 22 + rr ? 22 + rr : x > COL.x + COL.w - rr ? COL.x + COL.w - rr : x;
        const cyr = y < 16 + rr ? 16 + rr : y > 48 - rr ? 48 - rr : y;
        if (Math.hypot(x - cxr, y - cyr) > rr) continue;
        put(back, x, y, y < 19 ? "~" : y < 28 ? "I" : y < 42 ? "i" : "s");
      }
    // A burgundy stripe and the name plate (BIG MIX), a dial, the red stop button.
    rect(back, 24, 30, COL.x + COL.w - 26, 3, (i) => (i % 2 ? "R" : "r"));
    rect(back, 40, 35, 30, 9, (i, j) => (i === 0 || j === 0 || i === 29 || j === 8 ? "y" : "Y"));
    textC(back, 55, 37, "BIG MIX", "6");
    blob(back, 92, 40, 3.5, 3.5, (dx, dy) => (dx + dy < -0.5 ? "-" : "R"));
    blob(back, 92, 26, 4, 4, (dx, dy, d) => (d > 0.7 ? "S" : "X"));
    line(back, 92, 26, 92 + Math.round(Math.cos(ph) * 2), 26 + Math.round(Math.sin(ph) * 2), "Z");
    // The bowl's lift arms, from the column round the bowl.
    rect(back, BOWL.cx + BOWL.rx - 6, BOWL.top + 16, COL.x - (BOWL.cx + BOWL.rx) + 8, 6, (i, j) => (j === 0 ? "I" : "s"));
    // The bowl's far rim (inside, seen over the dough) and the dough.
    const front = cv(w, h);
    for (let y = BOWL.top - 8; y < BOWL.top + BOWL.depth; y++)
      for (let x = BOWL.cx - BOWL.rx; x <= BOWL.cx + BOWL.rx; x++) {
        const dx = (x - BOWL.cx) / BOWL.rx;
        // The rim ellipse (the bowl's mouth), 8 px deep.
        const rimY = Math.sqrt(Math.max(0, 1 - dx * dx)) * 8;
        if (y < BOWL.top - rimY) continue;
        // The bowl's body: below the rim's near edge, narrowing toward the foot.
        const bodyDepth = BOWL.depth - 8;
        if (y >= BOWL.top + rimY) {
          const t = (y - BOWL.top - rimY) / bodyDepth;
          const half = BOWL.rx * (1 - 0.35 * t * t);
          if (Math.abs(x - BOWL.cx) > half) continue;
          const u = (x - BOWL.cx) / half;
          const k = u < -0.7 ? "I" : u < -0.35 ? "~" : u < 0.1 ? "I" : u < 0.6 ? "i" : "s";
          put(front, x, y, y === Math.round(BOWL.top + rimY) ? "~" : k);
          continue;
        }
        // Inside the mouth: the far wall of the bowl, then the dough mound.
        put(back, x, y, y < BOWL.top - rimY + 2 ? "I" : "s");
      }
    // The dough: a lumpy mound inside the mouth, its fold travelling round with the hook.
    for (let x = BOWL.cx - BOWL.rx + 4; x <= BOWL.cx + BOWL.rx - 4; x++) {
      const dx = (x - BOWL.cx) / BOWL.rx;
      const near = Math.sqrt(Math.max(0, 1 - dx * dx)) * 8;
      const bump = 4 + 3 * Math.cos(dx * 3 + ph) + 3 * Math.max(0, Math.cos(dx * 2.2 - ph * 1)) + Math.sin(dx * 7 - ph * 2);
      const topY = BOWL.top - bump;
      for (let y = Math.round(topY); y < BOWL.top + near; y++) {
        const lit = (y - topY) / (BOWL.top + near - topY);
        put(back, x, y, lit < 0.18 ? "e" : lit < 0.6 ? "D" : "d");
      }
    }
    // The dough hook: a spiral from the head down into the dough, its turns showing above the mound, turning with the frames.
    const hookX = BOWL.cx + 4;
    rect(back, hookX - 2, 48, 5, 10, (i) => (i === 0 ? "I" : i === 4 ? "S" : "i"));
    for (let s = 0; s <= 60; s++) {
      const t = s / 60;
      const yy = 58 + t * 30;
      const a = t * Math.PI * 3 + ph;
      const xx = hookX + Math.cos(a) * (3 + t * 9);
      const inFront = Math.sin(a) > 0;
      if (yy > BOWL.top - 4 && !inFront) continue; // (sunk in the dough behind)
      if (get(back, xx, yy) === "e" || get(back, xx, yy) === "D") if (yy > BOWL.top - 2) continue;
      put(back, xx, yy, inFront ? "I" : "s");
      put(back, xx + 1, yy, inFront ? "i" : "S");
    }
    // A strand of dough lifted by the hook on the near side, slapping down at f0 and f6.
    const lift = Math.max(0, Math.sin(ph * 2));
    const sx = hookX + Math.round(Math.cos(ph) * 10);
    for (let k = 0; k < Math.round(lift * 9); k++) put(back, sx + (k % 2), BOWL.top - 6 - k, k > 6 ? "e" : "D");
    // Flour puffs over the rim now and then (f0, f6: the thump).
    const sp: Speck[] = [];
    if (f % 6 < 2)
      for (let k = 0; k < 8; k++) {
        const a = hash(k, f, 71) * Math.PI;
        const r = 6 + (f % 6) * 7 + hash(k, f, 72) * 6;
        sp.push([Math.round(BOWL.cx - Math.cos(a) * (BOWL.rx - 6 + r * 0.3)), Math.round(BOWL.top - 10 - Math.sin(a) * r * 0.6), "f"]);
      }
    for (const [x, y, k] of sp) put(front, x, y, k);
    // The ground shadow.
    const shadow = cv(w, h);
    blob(shadow, w / 2, h - 5, w / 2 - 2, 5, () => "`");
    frames.push(bits(cropBit(shadow, false), cropBit(back, true), cropBit(front, true)));
  }
  def("mixer", [3, 2], w, h, [Math.floor(w / 2), h - 5], frames, SHOP_ZEBRA_MIXER_MS, { 0: "thump", 6: "thump" });
}

// ---- Smaller pieces: the flour sacks, the speed rack of loaves, the café table, the basket of baguettes, the pendant lamps.

{
  // Flour sacks: two burlap sacks slumped against each other, FLOUR stamped on the front one.
  const c = cv(T, 44);
  const sack = (cx: number, top: number, wd: number, k1: string, k2: string) =>
    blob(c, cx, top + 16, wd, 17, (dx, dy) => (dy < -0.82 ? null : dx < -0.5 ? k1 : hash(Math.round(dx * 20), Math.round(dy * 20), 3) < 0.15 ? k2 : dx > 0.6 ? k2 : k1 === "C" ? "c" : "C"));
  sack(12, 6, 11, "c", "b");
  sack(23, 10, 12, "C", "c");
  rect(c, 18, 7, 9, 3, (i) => (i % 2 ? "b" : "B"));
  textC(c, 23, 22, "FLOUR", "R");
  blob(c, 18, 41, 16, 3, () => "`");
  still("sacks", [1, 1], c, [18, 40], true);
}
{
  // The speed rack: a steel trolley of eight trays, loaves on each, casters.
  const c = cv(T, 112);
  rect(c, 3, 4, 2, 100, "i");
  rect(c, 32, 4, 2, 100, "s");
  for (let t = 0; t < 8; t++) {
    const ty = 14 + t * 11;
    rect(c, 3, ty, 31, 2, (i, j) => (j === 0 ? "I" : "S"));
    if (t % 3 === 0) for (let i = 0; i < 4; i++) roll(c, 8 + i * 7, ty - 3, 3, 2);
    else if (t % 3 === 1) baguette(c, 5, ty - 2, 31, ty - 3, 2.5, 4);
    else for (let i = 0; i < 3; i++) boule(c, 9 + i * 10, ty - 3, 4, true);
  }
  rect(c, 3, 3, 31, 2, "I");
  for (const x of [4, 32]) blob(c, x, 107, 2.5, 2.5, () => "S");
  blob(c, 18, 109, 16, 2.5, () => "`");
  still("rack", [1, 1], c, [18, 108], true);
}
{
  // The café table: a little round marble table with a red check cloth corner and a bread basket, two bentwood chairs. Nobody sits.
  const c = cv(2 * T, 58);
  const chair = (x: number, flip: boolean) => {
    const s = flip ? -1 : 1;
    line(c, x, 22, x, 52, "6", 2);
    line(c, x + s * 12, 36, x + s * 12, 52, "6", 2);
    rect(c, Math.min(x, x + s * 12), 34, 13, 3, "7");
    for (let j = 0; j < 12; j++) put(c, x + Math.round(Math.sin((j / 11) * Math.PI) * s * 3), 22 + j, "8");
  };
  chair(8, false);
  chair(66, true);
  blob(c, 37, 30, 20, 6, (dx, dy) => (dy < -0.2 ? "4" : "5"));
  // The cloth: a red check draped over the near edge.
  for (let x = 24; x < 50; x++) for (let y = 31; y < 40 - Math.abs(x - 37) / 4; y++) put(c, x, y, ((x >> 2) + (y >> 2)) % 2 ? "-" : "X");
  line(c, 37, 38, 37, 53, "S", 2);
  rect(c, 29, 53, 17, 2, "S");
  // The basket of rolls on it.
  rect(c, 30, 22, 14, 5, (i, j) => ((i + j) % 2 ? "9" : "8"));
  roll(c, 34, 22, 3, 2);
  roll(c, 40, 21, 3, 2);
  blob(c, 37, 55, 26, 2.5, () => "`");
  still("cafe", [2, 1], c, [T, 54], true);
}
{
  // A wicker basket of baguettes standing up like umbrellas in a stand.
  const c = cv(T, 70);
  for (let i = 0; i < 6; i++) baguette(c, 9 + i * 4, 52, 6 + i * 5 + (i % 2) * 2, 6 + (i % 3) * 5, 3, 4, true);
  rect(c, 6, 44, 25, 20, (i, j) => (j === 0 ? "0" : (i + (j >> 1)) % 4 === 0 ? "8" : (i + j) % 2 ? "9" : "0"));
  blob(c, 18, 66, 14, 2.5, () => "`");
  still("basket", [1, 1], c, [18, 65], true);
}
{
  // A pendant lamp: a cord from the ceiling, a white enamel shade, its bulb. Not solid. 104 px over the floor.
  const c = cv(T, 150);
  line(c, 18, 0, 18, 36, "Z");
  for (let y = 36; y < 46; y++) {
    const half = 4 + (y - 36) * 1.1;
    for (let x = Math.round(18 - half); x <= Math.round(18 + half); x++) put(c, x, y, y === 45 ? "x" : x < 18 - half * 0.4 ? "~" : x > 18 + half * 0.5 ? "x" : "X");
  }
  blob(c, 18, 47, 3.5, 2.5, () => "L");
  still("lamp", [1, 1], c, [18, 149], false);
}
const LAMP_Y = 47; // the bulb's middle in the lamp's picture
const LAMP_LIGHT = "#ffd08a";

// ---- The front room's layout.

export interface ShopPlace {
  name: string;
  col: number;
  row: number;
  solid: boolean;
  /** Quarter turns clockwise (floor tiles only), and mirrored left to right. */
  rot?: 0 | 1 | 2 | 3;
  flip?: boolean;
  /** Squares wide, for the wide pieces, from `col` east. */
  w?: number;
  /** Squares deep, from `row` north: it stands on `row` and covers the rows north of it too (solid on all of them). */
  d?: number;
  /** The way out (the entrance): walking into it leaves the shop. */
  exit?: boolean;
  /** The door between the rooms: walking into it loads the other room (new: see the notes). */
  door?: "back" | "front";
  /** A frame offset (ms) into its idle, so copies don't move together. */
  t0?: number;
}
function layoutOf(): { at: (name: string, col: number, row: number, solid: boolean, more?: Partial<ShopPlace>) => void; list: ShopPlace[] } {
  const list: ShopPlace[] = [];
  const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
    const p = PIECES[name];
    if (!p) throw new Error(`no piece ${name}`);
    list.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
  };
  return { at, list };
}
const FRONT = layoutOf();
{
  const { at } = FRONT;
  const FLOUR = new Set(["3,11", "4,11", "6,12", "2,12", "6,13", "10,9", "11,9", "13,9", "5,14", "3,14"]);
  for (let row = 0; row < 20; row++)
    for (let col = 0; col < 20; col++) {
      if (!isOpen(col, row)) at("floor-stock", col, row, false);
      else if (row === 18 && (col === 9 || col === 10)) at(col === 9 ? "mat-w" : "mat-e", col, row, false);
      else if (FLOUR.has(`${col},${row}`)) at("floor-flour", col, row, false);
      else at((col * 7 + row * 3) % 5 === 0 ? "floor-b" : "floor-a", col, row, false);
    }
}
const FRONT_FLOOR_COUNT = FRONT.list.length;
{
  const { at } = FRONT;
  // The back wall, row 6, columns 1-18 (the door at 3-4 is not solid: it's the way through).
  for (let col = 1; col <= 18; col++) if (col !== 4) at(BACK_CARD(col), col, 6, col !== 3, col === 3 ? { door: "back" } : {});
  // The side walls.
  const W_SIDE = ["side", "side-b", "side", "side-c", "side", "side", "side-d", "side", "side-b", "side", "side", "side-c"];
  const E_SIDE = ["side", "side-d", "side", "side", "side-b", "side", "side-c", "side", "side", "side-b", "side", "side"];
  for (let row = 7; row <= 18; row++) {
    at(W_SIDE[row - 7]!, 1, row, true);
    at(E_SIDE[row - 7]!, 18, row, true);
  }
  // The front: the sill, the entrance, the corner posts.
  at("hem-post", 1, 19, true);
  for (let col = 2; col <= 17; col++) if (col < 9 || col > 10) at(col === 4 || col === 6 || col === 13 || col === 15 ? "hem-bread" : "hem", col, 19, true);
  at("entrance", 9, 19, false, { exit: true });
  at("hem-post", 18, 19, true, { flip: true });
  // The counter (its squares solid), the mixer (its 3 x 2 squares solid), the rest.
  at("counter", 9, 8, true);
  at("mixer", 3, 13, true);
  at("sacks", 2, 16, true);
  at("sacks", 2, 17, true, { flip: true });
  at("rack", 17, 10, true);
  at("cafe", 14, 15, true);
  at("basket", 17, 17, true);
  for (const [c, r] of [[7, 10], [13, 12], [6, 16], [12, 16]] as const) at("lamp", c, r, false);
}
/** Where every piece of the front room goes: floor tiles first, then the upright pieces north to south. */
export const SHOP_ZEBRA_LAYOUT: readonly ShopPlace[] = [
  ...FRONT.list.slice(0, FRONT_FLOOR_COUNT),
  ...FRONT.list.slice(FRONT_FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col),
];

/** The counter zebra (the Shopkeeper): behind the counter, left of the register; his squares. Faces the camera (south). */
export const SHOP_ZEBRA_KEEPER = { at: [12.5, 7.3], keeper: [{ c: 12, r: 7 }, { c: 13, r: 7 }], face: 1 } as const;
/**
 * The two guards by the door, just inside it, flanking the walkway (each on its square, solid). `face` is their resting facing (1:
 * east, -1: west, mirrored); `watch` turns them to you (see the notes: they face toward your column and, once you're past them, look
 * back over their shoulder).
 */
export const SHOP_ZEBRA_GUARDS = [
  { id: "guard-a", at: [8, 17.2], square: { c: 8, r: 17 }, face: 1 },
  { id: "guard-b", at: [11, 17.2], square: { c: 11, r: 17 }, face: -1 },
] as const;
/** The doors: the way out (row 19) and the way to the back room (row 6), each door's squares, the squares just inside it (stand there
 * for its card), and where you appear coming in through it. */
export const SHOP_ZEBRA_DOORS = {
  out: { squares: [{ c: 9, r: 19 }, { c: 10, r: 19 }], inside: [{ c: 9, r: 18 }, { c: 10, r: 18 }], arrive: [9.5, 18] },
  back: { squares: [{ c: 3, r: 6 }, { c: 4, r: 6 }], inside: [{ c: 3, r: 7 }, { c: 4, r: 7 }], arrive: [3.5, 7], to: "back" },
} as const;

/** The front room's lights: the four pendants (a halo each), the light under the back door, the day in the entrance. */
export const SHOP_ZEBRA_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "lamp", x: 14, y: LAMP_Y - 2, w: 9, h: 5, keys: "L", color: LAMP_LIGHT, strength: 0.9, halo: 26 },
  { piece: "door-back", x: DOOR.x - wx(3), y: DOOR.y + DOOR.h - 2, w: DOOR.w, h: 2, keys: "l", color: "#ffb85c", strength: 0.5 },
  { piece: "entrance", x: 6, y: 8, w: ENT.w - 12, h: ENT.h - 10, keys: "Hvw", color: "#fff4d8", strength: 0.35 },
];
/** ... and pools on the floor: under each pendant, before the entrance, and a thin warm strip before the back door. */
export const SHOP_ZEBRA_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "lamp", x: 18, y: 149, rx: 46, ry: 15, color: LAMP_LIGHT, strength: 0.22 },
  { piece: "entrance", x: ENT.w / 2, y: ENT.h - 4, rx: 40, ry: 12, color: "#fff4d8", strength: 0.2 },
  { piece: "door-back", x: T, y: WH + 4, rx: 26, ry: 6, color: "#ffb85c", strength: 0.25 },
];

// =====================================================================================================================================
// The back room.
// =====================================================================================================================================

/**
 * The back room's floor: 14 rows of 14 (`RoomArt.n` 14). The walkable floor is columns 2-11, rows 4-9 (10 x 6, a quarter of the home's
 * floor with the front room's 16 x 12). The door back to the front room is row 10, columns 3-4 (its squares `.`); the back wall is row
 * 3, the side walls columns 1 and 12.
 */
export const SHOP_ZEBRA_BACK_N = 14;
export const SHOP_ZEBRA_BACK_FLOOR: readonly string[] = Array.from({ length: 14 }, (_, r) =>
  Array.from({ length: 14 }, (_, c) => ((r >= 4 && r <= 9 && c >= 2 && c <= 11) || (r === 10 && (c === 3 || c === 4)) ? "." : "#")).join(""),
);
const isBackOpen = (c: number, r: number) => SHOP_ZEBRA_BACK_FLOOR[r]?.[c] === "." && r < 10;

// ---- Its floor: dark planks running east-west, a red rug with a gold border under the table and the seats (columns 3-9, rows 4-8).

function planks(x: number, y: number, seed: number): string {
  const ly = ((y % T) + T) % T;
  const row = Math.floor(y / 9);
  const off = (row * 17) % 37;
  if (ly % 9 === 0 || (x + off) % 37 === 0) return "$";
  const s = hash(x >> 2, y, seed + row);
  return s < 0.15 ? "$" : s > 0.85 ? "^" : "%";
}
tile("bfloor-a", (x, y) => planks(x, y, 1));
tile("bfloor-b", (x, y) => planks(x, y, 2));
tile("bfloor-stock", (x, y) => (hash(x, y, 4) < 0.1 ? "%" : "$"));
const RUG = { c0: 3, c1: 9, r0: 4, r1: 8 };
for (let r = RUG.r0; r <= RUG.r1; r++)
  for (let c = RUG.c0; c <= RUG.c1; c++)
    tile(`rug-${c}-${r}`, (x, y) => {
      const gx = (c - RUG.c0) * T + x;
      const gy = (r - RUG.r0) * T + y;
      const W = (RUG.c1 - RUG.c0 + 1) * T;
      const H = (RUG.r1 - RUG.r0 + 1) * T;
      const e = Math.min(gx - 3, gy - 3, W - 4 - gx, H - 4 - gy);
      if (e < 0) return planks(gx + c * 3, gy, 5);
      if (e < 2) return "(";
      if (e < 5) return (gx + gy) % 6 < 3 ? "*" : "&";
      if (e < 7) return "(";
      // The field: a worn diamond lattice.
      const d = (Math.abs(((gx - W / 2) % 22) - 0) + Math.abs(((gy - H / 2) % 22) - 0)) % 22;
      if (d === 0 || d === 11) return hash(gx, gy, 9) < 0.3 ? "&" : "*";
      return hash(gx >> 1, gy >> 1, 8) < 0.07 ? "*" : "&";
    });

// ---- Its back wall (row 3, columns 1-12): one painting cut into cards. Dim old plaster over a dark wood wainscot, covered in the crew's
// marker: board sketches, arrows, "e4!!", "Nf3?!", circled squares, lines; the cork board with red string; the TV (its own piece).

const BBW = 12 * T;
const bwall = cv(BBW, WH);
const bx = (col: number) => (col - 1) * T;
const BRAIL = 108;
for (let y = 0; y < WH; y++)
  for (let x = 0; x < BBW; x++) {
    let k: string;
    if (y < 6) k = y < 2 ? "6" : y < 5 ? "7" : "8";
    else if (y >= BRAIL) k = y < BRAIL + 3 ? (y === BRAIL ? "8" : "7") : (x % 37 === 0 || x % 37 === 18) && y > BRAIL + 6 ? "6" : y > WH - 6 ? "6" : hash(x, y, 7) < 0.05 ? "6" : "7";
    else {
      const s = hash(x >> 1, y >> 1, 11);
      const blot = Math.sin(x / 23 + Math.sin(y / 17) * 2) + Math.sin(y / 29 + x / 41) * 1.2;
      k = s < 0.05 || (blot > 1.7 && s < 0.6) ? "!" : s > 0.95 ? "#" : "@";
    }
    bwall[y]![x] = k;
  }
// -- The cork board (columns 2-3): pinned diagrams, a giraffe sketch crossed out (the rivals), red string between them.
{
  const x = bx(2) + 6;
  const y = 18;
  const w = 62;
  const h = 58;
  rect(bwall, x, y, w, h, (i, j) => (i < 2 || j < 2 || i >= w - 2 || j >= h - 2 ? "8" : hash(i, j, 21) < 0.25 ? "+" : "="));
  const card = (cx: number, cy: number, draw: (c: Cv, x0: number, y0: number) => void) => {
    rect(bwall, cx, cy, 17, 17, (i, j) => (i === 16 || j === 16 ? "x" : "X"));
    draw(bwall, cx, cy);
    put(bwall, cx + 8, cy + 1, "-");
  };
  card(x + 4, y + 5, (c, x0, y0) => boardSketch(c, x0 + 2, y0 + 3, 4, 3, ")"));
  card(x + 40, y + 4, (c, x0, y0) => {
    // A giraffe's head and neck sketched, crossed out in red: the rivals.
    line(c, x0 + 5, y0 + 15, x0 + 8, y0 + 5, ")");
    line(c, x0 + 7, y0 + 5, x0 + 12, y0 + 4, ")");
    put(c, x0 + 7, y0 + 3, ")");
    put(c, x0 + 9, y0 + 3, ")");
    line(c, x0 + 2, y0 + 2, x0 + 14, y0 + 14, "-");
    line(c, x0 + 14, y0 + 2, x0 + 2, y0 + 14, "-");
  });
  card(x + 22, y + 34, (c, x0, y0) => {
    handText(c, x0 + 2, y0 + 3, "Rb1", ")");
    handText(c, x0 + 2, y0 + 10, "Qa5+", "-");
  });
  line(bwall, x + 12, y + 7, x + 30, y + 35, "-");
  line(bwall, x + 48, y + 6, x + 31, y + 35, "-");
  line(bwall, x + 12, y + 7, x + 48, y + 6, "-");
}
// -- The big sketch (columns 4-6): a board with arrows and circled squares, "e4!!" huge, a line of moves.
{
  const x = bx(4) + 8;
  const y = 16;
  boardSketch(bwall, x, y, 8, 5, ")");
  arrow(bwall, x + 22, y + 37, x + 22, y + 22, "-", 1); // e2-e4, the long arrow
  arrow(bwall, x + 32, y + 37, x + 27, y + 27, "_", 1); // a knight to f3
  ring(bwall, x + 32, y + 12, 4, "-"); // a circled square
  ring(bwall, x + 7, y + 7, 4, "_");
  // "e4!!" in big hand (2x).
  const tmp = cv(30, 7);
  handText(tmp, 0, 0, "e4!!", ")");
  for (let j = 0; j < 7; j++) for (let i = 0; i < 30; i++) if (tmp[j]![i] === ")") rect(bwall, x + 46 + i * 2, y + 4 + j * 2, 2, 2, ")");
  handText(bwall, x + 46, y + 22, "Nf3?!", "-");
  handText(bwall, x + 46, y + 31, "1.d4 Nf6", ")");
  handText(bwall, x + 46, y + 39, "2.c4 g6", ")");
  handText(bwall, x + 2, y + 48, "Rb1 cxd4", "_");
  handText(bwall, x + 2, y + 56, "cxd4 Qa5+", "_");
  ring(bwall, x + 62, y + 59, 3, "-");
  // A question to the room.
  handText(bwall, x + 46, y + 48, "WHY h6??", "-");
}
// -- Columns 7-9: the TV is its own piece (columns 8-9); around it, more marker.
{
  const x = bx(7) + 4;
  handText(bwall, x, 22, "+0.3", ")");
  handText(bwall, x, 30, "=", ")");
  handText(bwall, x + 6, 30, "??", "-");
  arrow(bwall, x + 6, 44, x + 26, 34, "-");
  handText(bwall, x, 56, "O-O-O!", "_");
  for (let i = 0; i < 4; i++) line(bwall, x + 2 + i * 3, 70, x + 2 + i * 3, 78, ")");
  line(bwall, x, 76, x + 13, 71, ")");
}
// -- Columns 10-11: an endgame scrawl: a king and pawn diagram, LUCENA with a bridge, tally marks of who's right.
{
  const x = bx(10) + 4;
  boardSketch(bwall, x, 20, 4, 6, ")");
  stamp(bwall, x + 8, 28, [".)..", ")))", ".)."]);
  stamp(bwall, x + 8, 34, [".)."]);
  handText(bwall, x + 30, 20, "LUCENA", ")");
  // The bridge: a rook on the fourth, sketched as an arc.
  for (let i = 0; i < 26; i++) put(bwall, x + 30 + i, 34 - Math.round(Math.sin((i / 25) * Math.PI) * 5), "_");
  handText(bwall, x + 30, 38, "R4!", "_");
  handText(bwall, x, 54, "BOSS", ")");
  for (let i = 0; i < 9; i++) line(bwall, x + 22 + i * 3 + (i >= 5 ? 3 : 0), 54, x + 22 + i * 3 + (i >= 5 ? 3 : 0), 59, ")");
  line(bwall, x + 21, 58, x + 35, 54, ")");
  handText(bwall, x, 64, "US", "-");
  handText(bwall, x + 22, 64, "0", "-");
  // A crumpled printout taped up, a bit of an opening tree.
  rect(bwall, x + 44, 50, 18, 24, (i, j) => (i === 17 || j === 23 ? "x" : hash(i, j, 3) < 0.05 ? "x" : "X"));
  for (let j = 0; j < 5; j++) line(bwall, x + 47, 54 + j * 4, x + 47 + 6 + ((j * 5) % 7), 54 + j * 4, "s");
  line(bwall, x + 51, 54, x + 51, 70, "s");
}
// -- Column 12: plain, a stain.
/** The back room's back-wall cards: `bb-<col>` (the TV at columns 8-9 is its own animated piece, `tv`). */
for (let col = 1; col <= 12; col++) if (col !== 8 && col !== 9) still(`bb-${col}`, [1, 1], slice(bwall, bx(col), 0, T, WH), [18, WH - 1]);

// ---- The TV: a flat screen on the wall (columns 8-9), showing a chess stream: a board with pieces moving, an eval bar, the chat
// scrolling, a red LIVE dot. No streamer, no logo, no site. 16 frames x 400 ms (6.4 s): a short sequence of moves, then it resets.

const TV = { x: 6, y: 26, w: 62, h: 40 };
/** The stream's moves, in the TV's little board (files a-h left to right, ranks 8-1 top to bottom), from the start position: 1.e4 c5
 * 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 (the Najdorf, a nod to the chatter). Two frames a move, then a held frame. */
export const SHOP_ZEBRA_TV_MOVES = ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"] as const;
{
  const frames: Bit[][] = [];
  const start = ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"];
  const sq = (s: string): [number, number] => [s.charCodeAt(0) - 97, 8 - Number(s[1])];
  const boards: string[][] = [start.map((r) => r)];
  for (const m of SHOP_ZEBRA_TV_MOVES) {
    const b = boards.at(-1)!.map((r) => r.split(""));
    const [fx, fy] = sq(m.slice(0, 2));
    const [tx, ty] = sq(m.slice(2, 4));
    b[ty]![tx] = b[fy]![fx]!;
    b[fy]![fx] = ".";
    boards.push(b.map((r) => r.join("")));
  }
  const CHAT = [
    [":", 7, 10],
    ["'", 5, 12],
    ['"', 8, 6],
    [",", 4, 11],
    [":", 6, 9],
    ["'", 9, 12],
    ['"', 5, 8],
    [":", 7, 11],
    [",", 6, 7],
    ["'", 4, 12],
  ] as const;
  for (let f = 0; f < 16; f++) {
    const c = cv(2 * T, WH);
    for (let y = 0; y < WH; y++) for (let x = 0; x < 2 * T; x++) c[y]![x] = bwall[y]![bx(8) + x]!;
    // The bezel, the screen, a cable down the wall.
    rect(c, TV.x - 2, TV.y - 2, TV.w + 4, TV.h + 4, (i, j) => (i === 0 || j === 0 ? "{" : "]"));
    rect(c, TV.x, TV.y, TV.w, TV.h, "}");
    line(c, TV.x + TV.w / 2, TV.y + TV.h + 2, TV.x + TV.w / 2 + 1, BRAIL, "]");
    // The board (8 x 8 of 4 px), its pieces as 2 x 2 dots with a 1 px top, from the move list.
    const ply = Math.min(SHOP_ZEBRA_TV_MOVES.length, Math.floor(f / 1.5));
    const b = boards[ply]!;
    const ox = TV.x + 3;
    const oy = TV.y + 4;
    for (let r = 0; r < 8; r++)
      for (let fl = 0; fl < 8; fl++) {
        rect(c, ox + fl * 4, oy + r * 4, 4, 4, (r + fl) % 2 ? ";" : "|");
        const p = b[r]![fl]!;
        if (p === ".") continue;
        const k = p === p.toUpperCase() ? "," : "]";
        rect(c, ox + fl * 4 + 1, oy + r * 4 + 1, 2, 2, k);
        if ("KQ".includes(p.toUpperCase())) put(c, ox + fl * 4 + 1, oy + r * 4, k);
      }
    // The last move's squares highlighted (a yellow tint).
    if (ply > 0) {
      const m = SHOP_ZEBRA_TV_MOVES[ply - 1]!;
      for (const s of [m.slice(0, 2), m.slice(2, 4)]) {
        const [fx, fy] = sq(s);
        put(c, ox + fx * 4, oy + fy * 4, "[");
        put(c, ox + fx * 4 + 3, oy + fy * 4 + 3, "[");
      }
    }
    // The eval bar beside it (white's share), wobbling a little.
    const ev = 16 + Math.round(Math.sin(f * 0.8) * 2);
    rect(c, ox + 34, oy, 2, 32, (i, j) => (j < 32 - ev ? "]" : ","));
    // The chat column: name in color, then message, scrolling up a line every two frames.
    const cx0 = TV.x + 41;
    const sc = Math.floor(f / 2);
    for (let l = 0; l < 9; l++) {
      const [ink, nameW, msgW] = CHAT[(l + sc) % CHAT.length]!;
      const ly = TV.y + 4 + l * 4;
      rect(c, cx0, ly, nameW, 1, ink);
      rect(c, cx0 + nameW + 1, ly, Math.min(msgW, TV.w - 43 - nameW), 1, ",");
      if (l === 8) rect(c, cx0, ly + 2, 4, 1, "{");
    }
    // LIVE: a red dot, blinking.
    rect(c, TV.x + 2, TV.y + 1, 2, 2, f % 4 < 2 ? "<" : "}");
    rect(c, TV.x + 5, TV.y + 1, 7, 1, ",");
    frames.push([whole(c, false)]);
  }
  def("tv", [2, 1], 2 * T, WH, [T, WH - 1], frames, 400);
}

// ---- The back room's side walls (columns 1 and 12, rows 4-9): the same dim plaster and wainscot; a bookshelf of chess books, a pinned
// diagram, tally marks, a crumpled score sheet.

function bside(name: string, deco?: (c: Cv) => void): void {
  const c = cv(T, SH);
  for (let y = 0; y < SH; y++) for (let x = 0; x < T; x++) c[y]![x] = bwall[y + (WH - SH)]![x + 3 * T + 5]!;
  // (Clear the borrowed marker: the side walls are plaster under their own.)
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < T; x++) if (")-_".includes(c[y]![x]!)) c[y]![x] = "@";
  deco?.(c);
  still(name, [1, 1], c, [18, SH - 1]);
}
bside("bside");
bside("bside-books", (c) => {
  // A bookshelf: three shelves of chess books, spines in burgundy, blue, green, cream, a few lying flat.
  rect(c, 3, 22, 31, 72, (i, j) => (i < 2 || i > 28 ? "7" : "6"));
  for (let s = 0; s < 3; s++) {
    const sy = 22 + 23 * (s + 1);
    rect(c, 3, sy, 31, 3, (i, j) => (j === 0 ? "9" : "7"));
    let x = 6;
    let n = 0;
    while (x < 31) {
      const bw = 3 + (n % 3 === 0 ? 1 : 0);
      const bh = 15 + ((n * 7) % 5);
      const ink = ["R", "_", "v", "3", "r", "S"][(n + s) % 6]!;
      if ((n + s) % 7 === 3) rect(c, x, sy - 4, 9, 4, (i, j) => (j === 0 ? "3" : ink));
      else rect(c, x, sy - bh, bw, bh, (i, j) => (j === 2 ? "Y" : i === 0 ? "3" : ink));
      x += (n + s) % 7 === 3 ? 10 : bw + 1;
      n++;
    }
  }
});
bside("bside-sketch", (c) => {
  boardSketch(c, 6, 26, 5, 5, ")");
  arrow(c, 9, 48, 26, 31, "-");
  handText(c, 5, 58, "Bxh7+", ")");
  handText(c, 5, 66, "Ng5+", ")");
  handText(c, 5, 74, "Qh5", "-");
});
bside("bside-tally", (c) => {
  handText(c, 5, 28, "e4", ")");
  handText(c, 5, 38, "d4", ")");
  for (let i = 0; i < 6; i++) line(c, 16 + i * 3, 28, 16 + i * 3, 33, ")");
  line(c, 15, 32, 29, 28, ")");
  for (let i = 0; i < 6; i++) line(c, 16 + i * 3, 38, 16 + i * 3, 43, ")");
  line(c, 15, 42, 29, 38, ")");
  handText(c, 5, 52, "c4?", "-");
  // A crumpled score sheet taped up.
  rect(c, 7, 62, 20, 26, (i, j) => (i === 19 || j === 25 ? "x" : hash(i, j, 33) < 0.06 ? "x" : "X"));
  for (let j = 0; j < 6; j++) line(c, 9, 65 + j * 4, 24, 65 + j * 4, "s");
  line(c, 16, 64, 16, 86, "s");
});

// ---- The back room's front (row 10): a low wall, and the doorway back to the front room (columns 3-4), its light warm and bright.

{
  const c = cv(T, HEM_H);
  rect(c, 0, 0, T, HEM_H, (x, y) => (y < 3 ? (y === 0 ? "8" : "7") : y < 6 ? "6" : hash(x, y, 41) < 0.06 ? "!" : "@"));
  still("bhem", [1, 1], c, [18, HEM_H - 1]);
  const p = cv(T, 70);
  rect(p, 0, 0, T, 70, (x, y) => (y >= 70 - HEM_H ? c[y - (70 - HEM_H)]![x]! : x < 4 ? "8" : x > 32 ? "6" : y < 4 ? "8" : "7"));
  still("bhem-post", [1, 1], p, [18, 69]);
  const d = cv(2 * T, 112);
  for (let y = 0; y < 112; y++)
    for (let x = 0; x < 2 * T; x++) {
      const frame = x < 5 || x >= 2 * T - 5 || y < 6;
      d[y]![x] = frame ? (x === 0 || y === 0 ? "8" : x === 2 * T - 1 ? "6" : "7") : y > 80 ? (((x >> 3) + (y >> 3)) % 2 ? "W" : "A") : y > 62 ? "4" : "3"; // the front room beyond: its plaster, tile, checks
    }
  // The back of the burgundy door, swung open into the front room.
  rect(d, 5, 8, 10, 104, (i, j) => (i === 9 ? "6" : j % 30 === 0 ? "r" : "R"));
  still("bdoor", [2, 1], d, [T, 111]);
}

// ---- The table and its seats, the lamp, the cabinet, the coat rack, the bread crates, the wastebasket.

/** The table's top, in px over its foot: the board in a challenge goes here (a park table's is 27). */
export const SHOP_ZEBRA_BACK_TABLE_TOP = 27; // (the crew rig's ZEBRA_TABLE_TOP: their pokes and the roll lying on it)
const TB = { w: 3 * T + 8, h: 84 };
/** Where the board lies on the table (its middle), in the table's pixels; the scattered pieces and cups keep clear of it. */
export const SHOP_ZEBRA_BACK_BOARD_PX: Pt = [Math.floor(TB.w / 2), 48];
{
  const { w, h } = TB;
  const c = cv(w, h);
  const foot = h - 4;
  const topFront = foot - SHOP_ZEBRA_BACK_TABLE_TOP; // the top's front edge
  const topBack = topFront - 34; // two squares deep, foreshortened
  // Legs (four, the back two shorter: hidden mostly), the apron.
  for (const lx of [6, w - 9]) rect(c, lx, topFront + 4, 4, foot - topFront - 4, (i) => (i === 0 ? "8" : i === 3 ? "6" : "7"));
  rect(c, 3, topFront, w - 6, 7, (i, j) => (j === 0 ? "9" : j === 6 ? "6" : "7"));
  // The top: dark polished wood, a trapezoid (narrower at the back), lit along its front edge.
  for (let y = topBack; y < topFront; y++) {
    const t = (y - topBack) / (topFront - topBack);
    const inset = Math.round((1 - t) * 7);
    for (let x = inset; x < w - inset; x++) put(c, x, y, y === topFront - 1 ? "9" : hash(x >> 3, y, 41) < 0.12 ? "7" : y < topBack + 2 ? "6" : "8");
  }
  // The roll-up board in the middle: green and cream vinyl, 8 x 8, foreshortened.
  const bxm = SHOP_ZEBRA_BACK_BOARD_PX[0];
  const bym = SHOP_ZEBRA_BACK_BOARD_PX[1];
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const y0 = bym - 12 + Math.round(r * 3);
      const half = 13 + r * 0.5;
      const x0 = bxm - half + (f * 2 * half) / 8;
      rect(c, Math.round(x0), y0, Math.ceil((2 * half) / 8), 3, (r + f) % 2 ? "v" : "3");
    }
  // A position on it: a few pieces mid-game (white's near, black's far).
  for (const [f, r, k, s] of [
    [2, 6, "k", "w"],
    [3, 6, "p", "w"],
    [5, 5, "n", "w"],
    [4, 4, "p", "w"],
    [6, 7, "r", "w"],
    [1, 1, "k", "b"],
    [4, 3, "p", "b"],
    [5, 1, "q", "b"],
    [2, 2, "b", "b"],
    [6, 0, "r", "b"],
  ] as const) {
    const half = 13 + r * 0.5;
    tinyPiece(c, Math.round(bxm - half + ((f + 0.5) * 2 * half) / 8), bym - 12 + r * 3 + 2, k, s);
  }
  // Scattered pieces off the board: standing, knocked over, a few in piles; coffee cups, an open notebook, a basket of breadsticks.
  const scatter: [number, number, string, "w" | "b", boolean][] = [
    [10, topBack + 10, "p", "w", false],
    [16, topBack + 14, "n", "b", false],
    [11, topBack + 24, "q", "w", true],
    [22, topBack + 30, "p", "b", false],
    [24, topBack + 20, "r", "w", false],
    [w - 14, topBack + 12, "b", "w", true],
    [w - 20, topBack + 26, "p", "b", false],
    [w - 12, topBack + 30, "k", "b", true],
    [w - 26, topBack + 8, "n", "w", false],
    [33, topBack + 6, "p", "w", false],
    [w - 34, topBack + 31, "p", "w", true],
    [36, topBack + 31, "b", "b", false],
  ];
  for (const [x, y, k, s, lying] of scatter) tinyPiece(c, x, y, k, s, lying);
  // Coffee cups.
  for (const [x, y] of [[28, topBack + 14], [w - 30, topBack + 20], [8, topBack + 32]] as const) {
    rect(c, x - 3, y - 5, 6, 5, (i, j) => (j === 0 ? "6" : i === 0 ? "X" : "x"));
    put(c, x + 3, y - 3, "x");
  }
  // The open notebook (lines of moves).
  rect(c, w - 44, topBack + 4, 16, 9, (i, j) => (i === 8 ? "x" : "X"));
  for (let j = 0; j < 3; j++) line(c, w - 42, topBack + 6 + j * 2, w - 37, topBack + 6 + j * 2, "s");
  for (let j = 0; j < 3; j++) line(c, w - 34, topBack + 6 + j * 2, w - 30, topBack + 6 + j * 2, "s");
  // The basket of breadsticks (the crew's "spares").
  rect(c, 40, topBack + 2, 14, 6, (i, j) => ((i + j) % 2 ? "9" : "8"));
  for (let i = 0; i < 5; i++) line(c, 41 + i * 3, topBack + 3, 39 + i * 4, topBack - 9, i % 2 ? "c" : "C");
  // Shadow.
  const sh = cv(w, h);
  blob(sh, w / 2, foot - 1, w / 2 - 2, 4, () => "`");
  def("table", [3, 2], w, h, [Math.floor(w / 2), foot], [bits(cropBit(sh, false), cropBit(c, true))]);
}
{
  // The kingpin's wingback chair, at the head (west end), facing east (side on): burgundy leather, brass studs, its tall back and
  // wing on the west, a low seat (11 px, the zebras' seat height), a rolled arm on the near side.
  const c = cv(T + 8, 66);
  const F = 62; // the foot line
  // The back and its wing (west).
  for (let y = 6; y < F - 2; y++) {
    const lean = Math.round((F - y) * 0.08);
    for (let x = 2 + lean; x < 12 + lean; x++) put(c, x, y, x === 2 + lean ? "R" : y < 9 ? "R" : x > 9 + lean ? "*" : hash(x, y, 3) < 0.08 ? "r" : "r");
  }
  blob(c, 9, 9, 7, 5, (dx, dy) => (dy < -0.2 ? "R" : "r"));
  for (let y = 12; y < F - 8; y += 5) put(c, 11 + Math.round((F - y) * 0.08), y, "Y");
  // The seat cushion (its top 11 px over the foot) and the skirt to the floor.
  rect(c, 8, F - 15, 32, 4, (i, j) => (j === 0 ? "R" : j === 3 ? "r" : "R"));
  rect(c, 8, F - 11, 32, 9, (i, j) => (j === 0 ? "r" : i === 31 ? "*" : (i + j) % 7 === 0 ? "r" : "R"));
  for (let i = 0; i < 32; i += 4) put(c, 8 + i, F - 10, "Y");
  // The near arm: rolled, lower than the back.
  rect(c, 12, F - 24, 28, 7, (i, j) => (j === 0 ? "R" : j > 4 ? "*" : "r"));
  blob(c, 39, F - 21, 4, 4, (dx, dy) => (dx + dy < -0.3 ? "R" : "r"));
  for (const lx of [9, 36]) rect(c, lx, F - 2, 3, 3, "6");
  blob(c, 22, F + 1, 20, 2.5, () => "`");
  still("armchair", [1, 1], c, [22, F], true);
}
{
  // The crew's bench along the table's north side: one dark wooden plank on three trestles, its seat 11 px over the floor.
  const c = cv(3 * T, 22);
  const F = 18;
  rect(c, 2, F - 13, 3 * T - 4, 3, (i, j) => (j === 0 ? "0" : j === 2 ? "7" : "9"));
  rect(c, 2, F - 10, 3 * T - 4, 2, (i) => (i % 9 === 0 ? "6" : "8"));
  for (const lx of [8, 3 * T / 2 - 2, 3 * T - 12]) for (const d of [-2, 2]) line(c, lx, F - 8, lx + d * 2, F, "7", 2);
  blob(c, 3 * T / 2, F + 1, 3 * T / 2 - 4, 2, () => "`");
  still("bench", [3, 1], c, [Math.floor((3 * T) / 2), F], true);
}
/** The seats' height over the floor, px (the bench's and the wingback's, the zebra rig's `sit: 11`). */
export const SHOP_ZEBRA_BACK_SEAT_H = 11;
{
  // The green card-table lamp, hanging low over the table on a long cord. Not solid.
  const c = cv(T + 20, 150);
  const cx = 28;
  line(c, cx, 0, cx, 12, "Z");
  for (let y = 12; y < 26; y++) {
    const half = 6 + (y - 12) * 1.4;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) put(c, x, y, y === 25 ? "?" : x < cx - half * 0.5 ? "?" : x > cx + half * 0.55 ? ">" : "/");
  }
  rect(c, cx - 4, 9, 9, 4, "y");
  blob(c, cx, 27, 6, 2.5, () => "L");
  still("lamp-green", [1, 1], c, [cx, 149], false);
}
const GLAMP_Y = 27;
{
  // The filing cabinet of openings: four drawers labelled A, B, C, D, E (the openings' index letters), one drawer ajar, papers.
  const c = cv(T, 76);
  rect(c, 5, 6, 27, 66, (i, j) => (i === 0 ? "I" : i === 26 ? "S" : j === 0 ? "I" : "i"));
  const L = ["A B", "C", "D", "E"];
  for (let d = 0; d < 4; d++) {
    const y = 9 + d * 16;
    const ajar = d === 1 ? 3 : 0;
    rect(c, 7 - ajar, y, 23, 13, (i, j) => (j === 0 ? "I" : j === 12 ? "S" : "s"));
    rect(c, 13 - ajar, y + 3, 11, 6, (i, j) => (i === 0 || j === 0 || i === 10 || j === 5 ? "y" : "X"));
    textC(c, 18 - ajar, y + 4, L[d]!.replace(" ", ""), "Z");
    if (ajar) for (let i = 0; i < 4; i++) rect(c, 8 + i * 5, y - 3, 4, 4, "X");
  }
  blob(c, 18, 73, 15, 2.5, () => "`");
  still("cabinet", [1, 1], c, [18, 72], true);
}
{
  // The coat rack: a dark stand with three fedoras and a trench coat.
  const c = cv(T, 104);
  rect(c, 17, 10, 3, 88, (i) => (i === 0 ? "8" : "7"));
  for (const [x0, x1] of [[5, 17], [20, 32]] as const) line(c, x0 === 5 ? 18 : 19, 98, x0 === 5 ? 6 : 31, 100, "7", 2);
  for (const [hx, hy, k] of [[9, 14, "Z"], [27, 12, "1"], [18, 6, "z"]] as const) {
    rect(c, hx - 7, hy + 4, 15, 2, k);
    blob(c, hx, hy + 1, 5, 4, (dx, dy) => (dy < -0.2 ? k : dy > 0.4 ? "R" : k));
  }
  // The trench coat hanging.
  for (let y = 22; y < 74; y++) {
    const half = 5 + (y - 22) * 0.12;
    for (let x = Math.round(18 - half); x <= Math.round(18 + half); x++) put(c, x, y, x < 18 - half * 0.5 ? "C" : x > 18 + half * 0.6 ? "b" : "c");
  }
  rect(c, 12, 46, 13, 2, "B");
  blob(c, 18, 101, 13, 2.5, () => "`");
  still("coatrack", [1, 1], c, [18, 100], true);
}
{
  // Two bread crates stacked, loaves in the top one ("inventory").
  const c = cv(T, 48);
  for (const [y, h] of [[24, 20], [6, 18]] as const) rect(c, 3, y, 31, h, (i, j) => (j === 0 ? "0" : j % 6 === 0 ? "8" : i === 0 ? "0" : i === 30 ? "7" : "9"));
  for (let i = 0; i < 3; i++) boule(c, 10 + i * 9, 6, 5, true);
  blob(c, 18, 46, 15, 2.5, () => "`");
  still("crates", [1, 1], c, [18, 45], true);
}
{
  // The wastebasket of crumpled score sheets.
  const c = cv(T, 30);
  rect(c, 10, 10, 17, 17, (i, j) => (i === 0 ? "i" : i === 16 ? "S" : j === 0 ? "I" : "s"));
  for (const [x, y] of [[14, 8], [21, 7], [17, 4], [24, 10]] as const) blob(c, x, y, 3.5, 3, (dx, dy) => (hash(Math.round(dx * 5), Math.round(dy * 5), x) < 0.4 ? "x" : "X"));
  blob(c, 21, 26, 4, 3, (dx, dy) => (dx + dy < 0 ? "X" : "x"));
  blob(c, 18, 28, 12, 2, () => "`");
  still("wastebasket", [1, 1], c, [18, 27], true);
}

// ---- The back room's layout.

const BACK = layoutOf();
{
  const { at } = BACK;
  for (let row = 0; row < 14; row++)
    for (let col = 0; col < 14; col++) {
      if (!isBackOpen(col, row)) at("bfloor-stock", col, row, false);
      else if (col >= RUG.c0 && col <= RUG.c1 && row >= RUG.r0 && row <= RUG.r1) at(`rug-${col}-${row}`, col, row, false);
      else at((col + row) % 3 ? "bfloor-a" : "bfloor-b", col, row, false);
    }
}
const BACK_FLOOR_COUNT = BACK.list.length;
{
  const { at } = BACK;
  for (let col = 1; col <= 12; col++) {
    if (col === 9) continue;
    at(col === 8 ? "tv" : `bb-${col}`, col, 3, true);
  }
  const W_SIDE = ["bside", "bside-books", "bside", "bside-sketch", "bside", "bside"];
  const E_SIDE = ["bside", "bside-tally", "bside", "bside", "bside-sketch", "bside"];
  for (let row = 4; row <= 9; row++) {
    at(W_SIDE[row - 4]!, 1, row, true);
    at(E_SIDE[row - 4]!, 12, row, true);
  }
  at("bhem-post", 1, 10, true);
  for (let col = 2; col <= 11; col++) if (col !== 3 && col !== 4) at("bhem", col, 10, true);
  at("bdoor", 3, 10, false, { door: "front" });
  at("bhem-post", 12, 10, true, { flip: true });
  // The table (its 3 x 2 squares solid), the kingpin's chair at its head (west), the crew's three chairs along its north side.
  at("table", 5, 7, true);
  at("armchair", 4, 7, true);
  at("bench", 5, 5, true);
  at("lamp-green", 6, 7, false);
  at("coatrack", 2, 4, true);
  at("cabinet", 11, 4, true);
  at("crates", 11, 9, true);
  at("wastebasket", 10, 4, true);
}
/** Where every piece of the back room goes: floor tiles first, then the upright pieces north to south. */
export const SHOP_ZEBRA_BACK_LAYOUT: readonly ShopPlace[] = [
  ...BACK.list.slice(0, BACK_FLOOR_COUNT),
  ...BACK.list.slice(BACK_FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col),
];

/**
 * The back room's people (squares, a figure's foot). The kingpin sits in his wingback at the head of the table (west), facing east
 * (as drawn); the three crew sit on the bench along the table's north side, turned to him (facing west: mirrored), seat 11 px. In the
 * challenge they stand up where they are and turn to face you (east, as drawn) to draw.
 */
export const SHOP_ZEBRA_BACK_SEATS = {
  kingpin: { at: [4.3, 6.82], face: 1, chair: "armchair" },
  crew: [
    { id: "npc-zebra-crew-c", at: [5.15, 5.06], face: -1 },
    { id: "npc-zebra-crew-d", at: [6.15, 5.06], face: -1 },
    { id: "npc-zebra-crew-e", at: [7.15, 5.06], face: -1 },
  ],
} as const;
/**
 * The challenge's marks (squares): the boss seated at the head (west), you standing at the foot (east), the board on the table between
 * you (the table's middle). Boss on the left, you on the right, as every home.
 */
export const SHOP_ZEBRA_BACK_MARKS = { boss: [4.3, 6.82], you: [8.45, 6.75], table: [6, 6.5] } as const;
/**
 * The back room's camera through the challenge (its own, as Ginger's: `BossIntro.cam`, from the table's middle): CHALLENGE_FEEL's
 * usual (south 0.8, west 0.75) is made for a 20-square room and leaves this small room's lower half empty and you at the phone's edge;
 * this one centers the kingpin and you (west -0.35: a little east of the table) and comes north (south 0.1). Zoom 1 (the town's).
 */
export const SHOP_ZEBRA_BACK_CAM = { south: 0.1, west: -0.35, zoom: 1 } as const;
/** The doors: the way back to the front room (row 10), its squares, the squares just inside it, and where you arrive. */
export const SHOP_ZEBRA_BACK_DOORS = {
  front: { squares: [{ c: 3, r: 10 }, { c: 4, r: 10 }], inside: [{ c: 3, r: 9 }, { c: 4, r: 9 }], arrive: [3.5, 9], to: "front" },
} as const;
/** The back room's lights: the green lamp (a strong warm halo, a pool on the table), the TV's cool glow, the doorway's warm spill. */
export const SHOP_ZEBRA_BACK_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  { piece: "lamp-green", x: 22, y: GLAMP_Y - 2, w: 13, h: 4, keys: "L", color: "#ffd98a", strength: 1, halo: 34 },
  { piece: "tv", x: TV.x, y: TV.y, w: TV.w, h: TV.h, keys: '}|;,:\'"', color: "#8fb8ff", strength: 0.45, halo: 18 },
  { piece: "bdoor", x: 6, y: 8, w: 2 * T - 12, h: 100, keys: "34WA", color: "#ffe2a8", strength: 0.4 },
];
export const SHOP_ZEBRA_BACK_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "lamp-green", x: 28, y: 149, rx: 70, ry: 26, color: "#ffd98a", strength: 0.3 },
  { piece: "bdoor", x: T, y: 108, rx: 34, ry: 9, color: "#ffe2a8", strength: 0.22 },
];

// =====================================================================================================================================
// The front in the town: HOUSE_ZEBRA.
// =====================================================================================================================================

const HW = 144;
const HH = 134;
const HCX = 72;
const HFOOT = 128;
/** The picture's extra sky over the drawing (the chimney's smoke rises into it). */
const HOY = 12;
const SIGN = { x: 24, y: 30, w: 96, h: 17 };
/** Where the game writes the bakery's name: the sign board's face (as kit.ts signFace). */
export const HOUSE_ZEBRA_SIGN = { x: SIGN.x + 2, y: HOY + SIGN.y + 3, w: SIGN.w - 5, h: SIGN.h - 6 } as const;
function makeHouse(): Character {
  const frames: Bit[][] = [];
  for (let f = 0; f < 8; f++) {
    const c = cv(HW, HH);
    const L = 12;
    const R = HW - 12;
    // The facade: cream plaster, a cornice, a parapet with a wheat sheaf in its little pediment; brick quoins at the corners.
    for (let y = 8; y < HFOOT; y++)
      for (let x = L; x < R; x++) {
        const quoin = (x < L + 6 || x >= R - 6) && Math.floor((y - 8) / 6) % 2 === 0;
        put(c, x, y, quoin ? (x === L || x === R - 1 ? "B" : "b") : hash(x >> 1, y >> 1, 3) < 0.05 ? "1" : x < L + 10 ? "3" : "2");
      }
    rect(c, L - 3, 22, R - L + 6, 5, (i, j) => (j === 0 ? "3" : j === 4 ? "1" : "2"));
    rect(c, L - 2, 8, R - L + 4, 3, (i, j) => (j === 0 ? "3" : "1"));
    for (let y = 0; y < 9; y++)
      for (let x = HCX - 18 + y * 2; x <= HCX + 18 - y * 2; x++) if (y > 0) put(c, x, 8 - y, y === 1 ? "1" : "2");
    for (let k = -2; k <= 2; k++) line(c, HCX, 7, HCX + k * 2, 1, "y");
    rect(c, HCX - 3, 5, 7, 1, "R");
    // The chimney (east), its smoke (the oven's): a puff rising and drifting each frame.
    rect(c, R - 22, 0, 9, 10, (i, j) => (j === 0 ? "1" : i === 0 ? "c" : (i + j) % 4 ? "b" : "B"));
    // (The smoke is drawn on the taller picture below.)
    // The sign board (blank: the game writes the name), dark wood frame, cream face.
    {
      const { x: x0, y: y0, w, h } = SIGN;
      rect(c, x0, y0, w, h, (i, j) => {
        const edge = Math.min(i, j, w - 1 - i, h - 1 - j);
        if (edge < 2) {
          if ((i === 1 || i === w - 2) && (j === 1 || j === h - 2)) return "Y";
          return j === 0 || i === 0 ? "9" : j === h - 1 || i === w - 1 ? "6" : "7";
        }
        return j === 2 ? "3" : j === h - 3 || i === w - 3 ? "1" : "2";
      });
    }
    // Two gooseneck lamps over the sign.
    for (const lx of [SIGN.x + 14, SIGN.x + SIGN.w - 15]) {
      line(c, lx, SIGN.y - 1, lx, SIGN.y - 6, "S");
      line(c, lx, SIGN.y - 6, lx + 3, SIGN.y - 8, "S");
      rect(c, lx + 1, SIGN.y - 9, 6, 2, (i, j) => (j === 0 ? "s" : "S"));
      rect(c, lx + 2, SIGN.y - 7, 4, 1, "L");
    }
    // The awning: zebra stripes, sloping out over the windows, a scalloped valance.
    const AW = { y0: 50, y1: 64 };
    for (let y = AW.y0; y <= AW.y1 + 4; y++)
      for (let x = L - 4; x < R + 4; x++) {
        const slope = y - AW.y0;
        const reach = (x - (L - 4)) % 12;
        if (y > AW.y1 && Math.hypot(reach - 6, (y - AW.y1) * 1.4) > 6) continue;
        const stripe = Math.floor((x - (L - 4) + slope * 0.25) / 6) % 2 === 0;
        put(c, x, y, y === AW.y0 ? "x" : stripe ? (y > AW.y1 - 2 ? "z" : "Z") : y > AW.y1 - 2 ? "x" : "X");
      }
    // The ground floor: the big display window (west), the door, a small window (east).
    const GF = { y: AW.y1 + 5, foot: HFOOT };
    // The display window: a dark wood frame, glass with daylight glint, a tiered stand of bread, gold lettering (FRESH BREAD).
    const WIN = { x: L + 6, w: 56, y: GF.y + 2, h: 44 };
    rect(c, WIN.x - 3, WIN.y - 3, WIN.w + 6, WIN.h + 10, (i, j) => (i < 3 || i >= WIN.w + 3 || j < 3 ? (i === 0 || j === 0 ? "9" : "7") : j >= WIN.h + 3 ? (j === WIN.h + 3 ? "0" : "8") : null));
    rect(c, WIN.x, WIN.y, WIN.w, WIN.h, (i, j) => (j > WIN.h - 10 ? "7" : "6"));
    // Inside: warm light, three tiers of bread.
    rect(c, WIN.x + 1, WIN.y + 1, WIN.w - 2, WIN.h - 11, (i, j) => (j < 6 ? "9" : "8"));
    for (const [ty, kind] of [[WIN.y + 17, "boule"], [WIN.y + 27, "baguette"], [WIN.y + 37, "roll"]] as const) {
      rect(c, WIN.x + 2, ty, WIN.w - 4, 2, (i, j) => (j === 0 ? "I" : "s"));
      if (kind === "boule") for (let i = 0; i < 4; i++) boule(c, WIN.x + 9 + i * 13, ty - 5, 5.5, true);
      else if (kind === "baguette") for (let i = 0; i < 3; i++) baguette(c, WIN.x + 5 + i * 17, ty - 2, WIN.x + 20 + i * 17, ty - 7, 2.6, 3);
      else for (let i = 0; i < 6; i++) croissant(c, WIN.x + 6 + i * 9, ty - 3, 4);
    }
    textC(c, WIN.x + WIN.w / 2, WIN.y + 4, "FRESH BREAD", "Y");
    for (let i = 0; i < 3; i++) line(c, WIN.x + 4 + i * 18, WIN.y + 30, WIN.x + 10 + i * 18, WIN.y + 10, "G");
    // The door: burgundy, a glass panel with blinds (a slat lifts and two eyes peek out in frames 4-6), a brass handle, the step.
    const DR = { x: WIN.x + WIN.w + 5, w: 24, y: GF.y, h: HFOOT - GF.y - 2 };
    rect(c, DR.x - 2, DR.y - 2, DR.w + 4, DR.h + 2, (i, j) => (i < 2 || i >= DR.w + 2 || j < 2 ? "6" : null));
    rect(c, DR.x, DR.y, DR.w, DR.h, (i, j) => (i === 0 ? "r" : j > 34 && (j - 34) % 12 === 0 ? "r" : "R"));
    rect(c, DR.x + 4, DR.y + 4, DR.w - 8, 24, (i, j) => (j % 3 === 2 ? "x" : "X"));
    if (f >= 4 && f <= 6) {
      // The slat lifted: a dark gap, and two eyes in it (a zebra's, white with dark pupils), looking left then right.
      rect(c, DR.x + 4, DR.y + 13, DR.w - 8, 3, "6");
      const look = f === 4 ? -1 : f === 5 ? 0 : 1;
      for (const ex of [DR.x + 8, DR.x + 13]) {
        rect(c, ex, DR.y + 13, 3, 2, "X");
        put(c, ex + 1 + look, DR.y + 14, "Z");
      }
    }
    rect(c, DR.x + DR.w - 5, DR.y + 36, 2, 6, "Y");
    rect(c, DR.x - 3, HFOOT - 2, DR.w + 6, 2, (i, j) => (j === 0 ? "5" : "1"));
    // A brass letter slot.
    rect(c, DR.x + 6, DR.y + 31, 12, 3, (i, j) => (j === 0 ? "Y" : "y"));
    // The small east window: a pyramid of rolls, a basil pot.
    const EW = { x: DR.x + DR.w + 6, y: GF.y + 2 };
    const ew = R - 6 - EW.x;
    rect(c, EW.x - 3, EW.y - 3, ew + 6, 40, (i, j) => (i < 3 || i >= ew + 3 || j < 3 ? (i === 0 || j === 0 ? "9" : "7") : j >= 33 ? "8" : null));
    rect(c, EW.x, EW.y, ew, 30, (i, j) => (j < 4 ? "9" : "8"));
    for (let r = 0; r < 3; r++) for (let i = 0; i <= r; i++) roll(c, EW.x + ew / 2 - r * 4 + i * 8, EW.y + 18 + r * 5, 4, 3);
    line(c, EW.x + 2, EW.y + 22, EW.x + 8, EW.y + 4, "G");
    // The step and pavement line.
    rect(c, L - 4, HFOOT - 1, R - L + 8, 1, "1");
    // The A-board on the pavement (east of the door): chalk on black. JUST BREAD. MOVE ALONG.
    const AB = { x: R - 2, y: HFOOT - 32 };
    for (let j = 0; j < 32; j++) {
      const sp2 = Math.round(j * 0.15);
      put(c, AB.x - 13 - sp2, AB.y + j, "7");
      put(c, AB.x + 12 + sp2, AB.y + j, "7");
    }
    rect(c, AB.x - 12, AB.y, 24, 27, (i, j) => (i === 0 || j === 0 || i === 23 || j === 26 ? "8" : "K"));
    textC(c, AB.x, AB.y + 2, "JUST", "J");
    textC(c, AB.x, AB.y + 8, "BREAD", "J");
    textC(c, AB.x, AB.y + 15, "MOVE", "J");
    textC(c, AB.x, AB.y + 21, "ALONG", "J");
    // The ground shadow.
    const sh = cv(HW, HH + HOY);
    blob(sh, HCX, HOY + HFOOT, 66, 5, (dx, dy) => (dy > -0.1 ? "`" : null));
    // The chimney's smoke (the oven's), three puffs rising and drifting east, a third of the loop apart.
    const smoke = cv(HW, HH + HOY);
    for (let k = 0; k < 3; k++) {
      const t = (f + k * 3) % 8;
      if (t > 6) continue;
      blob(smoke, R - 18 + t * 1.6, HOY - 1 - t * 2.2, 2 + t * 0.45, 1.6 + t * 0.35, (dx, dy) => (dy < -0.1 ? "X" : "x"));
    }
    frames.push(bits(cropBit(sh, false), cropBit(c, true, 0, HOY), cropBit(smoke, false)));
  }
  const parts: Record<string, Part> = {};
  const fr: Frame[] = frames.map((bs, f) => ({
    ms: f >= 4 && f <= 6 ? 420 : 260,
    ...(f === 4 ? { cue: "peek" } : {}),
    layers: bs.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] } as Layer;
    }),
  }));
  return { id: "house-zebra", name: "The zebras' bakery", w: HW, h: HH + HOY, foot: [HCX, HOY + HFOOT], palette: PALETTE, parts, anims: { idle: { loop: true, frames: fr } } };
}
/** The bakery in the town: 144 x 146, its foot [72, 140] (the top 12 px are sky for the chimney's smoke). Idle: 8 frames (2.6 s): the chimney puffs; at f4-f6 a slat of the door's blind
 * lifts and two eyes look left, ahead, right (cue `peek` f4), then it drops. */
export const HOUSE_ZEBRA: Character = makeHouse();
/** Its windows' warm light at dusk and night (the display window, the door's glass, the east window). */
export const HOUSE_ZEBRA_LIGHTS: readonly LightSpot[] = [
  { x: 19, y: HOY + 72, w: 54, h: 33, keys: "89", color: "#ffb85c", strength: 0.8 },
  { x: 106, y: HOY + 72, w: 20, h: 30, keys: "89", color: "#ffb85c", strength: 0.7 },
  ...[SIGN.x + 16, SIGN.x + SIGN.w - 13].map((x) => ({ x, y: HOY + SIGN.y - 7, w: 4, h: 1, keys: "L", color: "#ffd08a", strength: 0.9, halo: 8 })),
];

// =====================================================================================================================================
// Exports for review and the code round.
// =====================================================================================================================================

/** Every piece by its name (as the layouts name them), each its own Character `shop-zebra-<name>`. Both rooms' pieces are here. */
export const SHOP_ZEBRA_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
/** The bakery's palette (the crew's props use the same colors). */
export const SHOP_ZEBRA_PALETTE: Readonly<Record<string, string>> = PALETTE;
export const SHOP_ZEBRA_SQ = T;

/** The front room laid flat (each upright piece at its foot), for the review scripts: HOUSE_SHOP_ZEBRA (front) and _BACK. */
function roomChar(id: string, name: string, layout: readonly ShopPlace[], n: number): Character {
  const TOP = 160;
  const RW = n * T;
  const RH = TOP + n * T + 4;
  const parts: Record<string, Part> = {};
  const nameOf = new Map<Part, string>();
  const pn = (p: Part) => {
    let k = nameOf.get(p);
    if (!k) {
      k = `r${nameOf.size}`;
      nameOf.set(p, k);
      parts[k] = p;
    }
    return k;
  };
  const frameAt = (f: number): Frame => {
    const layers: Layer[] = [];
    for (const pl of layout) {
      const p = PIECES[pl.name]!;
      const fx = pl.col * T + Math.floor((p.sq[0] * T) / 2);
      const fy = TOP + pl.row * T + 18;
      const footX = pl.flip ? p.w - 1 - p.foot[0] : p.foot[0];
      for (const b of p.frames[f % p.frames.length]!) {
        const pw = Math.max(...b.part.grid.map((r) => r.length));
        const x = pl.flip ? p.w - b.at[0] - pw : b.at[0];
        layers.push({ part: pn(b.part), x: fx - footX + x, y: fy - p.foot[1] + b.at[1], ...(pl.flip ? { flipX: true } : {}) });
      }
    }
    return { ms: 110, layers };
  };
  const anims: Record<string, Anim> = { idle: { loop: true, frames: [frameAt(0), frameAt(3), frameAt(6), frameAt(9)] } };
  return { id, name, w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts, anims };
}
export const HOUSE_SHOP_ZEBRA: Character = roomChar("house-shop-zebra", "The zebras' bakery: the front room", SHOP_ZEBRA_LAYOUT, 20);
export const HOUSE_SHOP_ZEBRA_BACK: Character = roomChar("house-shop-zebra-back", "The zebras' bakery: the back room", SHOP_ZEBRA_BACK_LAYOUT, SHOP_ZEBRA_BACK_N);
/** The room stills' top margin (px above row 0), for the review scripts. */
export const SHOP_ZEBRA_TOP = 160;
export type { LightPool, LightSpot };
