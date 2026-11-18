/**
 * Smudgy's intro props (house-intro-smudgy, Nov 6), drawn by hand in code with the paint kit (shops/paint-kit.ts):
 * - INTRO_SMUDGY_TABLE: the battle spot's round wooden table on its pedestal, a stool either side (the life class's stools: `stool`),
 *   PARK_TABLE's geometry (111 px across, its top 27 px over its foot, so the renderer's slab and board sit on it as on any table).
 *   The picture holds the leg, the round top and the stools; the renderer draws the slab and the board.
 * - INTRO_SMUDGY_CLOTH: the big white drop cloth over it, blotched with paint, draped on all sides, a board-shaped something under it:
 *   `covered` (one frame), `whip` (Smudgy whips it off: it lifts, sails up and west over his head and drops), `heap` (it lies in a heap
 *   on the floor between him and his stool). Its foot is the table's foot; drawn over the table.
 * - The slab's and board's colors (INTRO_SMUDGY_TABLE_PALETTE): walnut, the squares cream and deep teal.
 * - The splatter's colors (INTRO_SMUDGY_SPLATS): the room's deep paints, and the brush stroke's.
 * Light from the top left, as everywhere in the game.
 */
import type { Character, Part } from "../../characters/sprite.ts";
import { PAINT_PALETTE, cv, ellipse, get, hash, inPoly, line, put, rect, splat, type Cv, type Pt } from "./paint-kit.ts";

const T = 37;
const whole = (c: Cv, outline = false): Part => ({ grid: c.map((r) => r.join("")), outline });

// ---- A wooden stool (the life class's and the table's): a round seat seen from a little above, three legs, a rung.

/** Its seat's height over its foot (px). */
export const STOOL_SEAT = 9;
export function stool(c: Cv, cx: number, foot: number) {
  ellipse(c, cx + 1, foot, 9, 2.2, (x, y) => (get(c, x, y) === "." ? "-" : null));
  const sy = foot - STOOL_SEAT;
  for (const [lx, k] of [[cx - 6, "V"], [cx + 6, "v"], [cx + 1, "V"]] as const) line(c, lx, sy + 1, lx + (lx < cx ? -1 : lx > cx + 1 ? 1 : 0), foot, k);
  line(c, cx - 6, foot - 4, cx + 6, foot - 4, "v");
  ellipse(c, cx, sy + 1, 9, 3, "v");
  ellipse(c, cx, sy, 9, 3, (x, y) => (x + 0.5 < cx - 3 && y + 0.5 < sy ? "W" : "V"));
  for (let x = cx - 8; x <= cx + 8; x++) if (get(c, x, sy + 2) === "v") put(c, x, sy + 3, "k");
}

// ---- The table.

export const TW = 3 * T;
export const TH = 60;
export const TFOOT = 54;
export const TCX = Math.floor(TW / 2);
const TOP_Y = TFOOT - 27;
function tableCv(): Cv {
  const c = cv(TW, TH);
  ellipse(c, TCX + 1, TFOOT, 24, 4, "-");
  stool(c, TCX - T, TFOOT);
  stool(c, TCX + T, TFOOT);
  // The pedestal: a turned post on a cross foot.
  ellipse(c, TCX, TFOOT - 1, 10, 2.5, (x) => (x < TCX - 3 ? "V" : "v"));
  for (let y = TOP_Y + 4; y < TFOOT - 2; y++) for (let x = TCX - 3; x <= TCX + 3; x++) put(c, x, y, x < TCX - 1 ? "W" : x > TCX + 1 ? "v" : "V");
  rect(c, TCX - 4, TFOOT - 12, 9, 2, "V");
  // The round top: its rim, then its face (lit toward the top left), a ring of grain.
  ellipse(c, TCX, TOP_Y + 2, 22, 7, (x, y) => (y + 0.5 > TOP_Y + 2 ? (x < TCX - 8 ? "V" : "v") : null));
  ellipse(c, TCX, TOP_Y, 22, 7, (x, y, d) => (d > 0.82 ? "V" : x + y < TCX + TOP_Y - 6 ? "y" : "W"));
  ellipse(c, TCX, TOP_Y, 14, 4.5, (x, y, d) => (d > 0.9 && hash(x, y, 2) < 0.5 ? "V" : null));
  return c;
}
const TABLE_CV = tableCv();
export const INTRO_SMUDGY_TABLE: Character = {
  id: "intro-smudgy-table",
  name: "Smudgy's round table",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PAINT_PALETTE,
  parts: { table: whole(TABLE_CV, true) },
  anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "table", x: 0, y: 0 }] }] } },
};
/** The slab (keys "1" its lit top edge to "5" deep, as the renderer reads them): walnut; the squares cream and deep teal. */
export const INTRO_SMUDGY_TABLE_PALETTE: Readonly<Record<string, string>> = { "1": "#a87b52", "2": "#86603e", "3": "#6f4b2e", "4": "#563922", "5": "#3b2717", L: "#e9e0cb", D: "#2a5c5c" };

// ---- The cloth.

/** The cloth's frame: the table's foot at (CX, CF); room for it to sail up and west (toward Smudgy, 2.6 squares west). */
export const CLW = 230;
export const CLH = 130;
export const CX = 160;
export const CF = 122;
/** The paint blotches on the cloth, as fractions across its sheet (u west to east, v top to hem), each a color pair and a size. */
const BLOTS: readonly (readonly [number, number, string, string, number])[] = [
  [0.2, 0.35, "P", "p", 2.4],
  [0.62, 0.2, "T", "t", 2.8],
  [0.8, 0.62, "R", "r", 2.2],
  [0.38, 0.72, "B", "b", 2],
  [0.5, 0.45, "Y", "y", 1.6],
  [0.12, 0.8, "R", "r", 1.4],
];
/** The cloth draped over the table, its foot at (fx, ff) in `c`: the bump of the board under it, folds, the hem, paint blots. */
export function drapeOn(c: Cv, fx: number, ff: number) {
  const top = ff - 29;
  const inside = (x: number, y: number) => {
    const v = (y - top) / (ff - 1 - top);
    if (v < 0) return false;
    const rx = 23 + 4 * v + (y > ff - 4 ? Math.sin(x * 0.7) * 1.2 : 0);
    const hem = ff - 1 - Math.abs(Math.sin((x - fx) * 0.32)) * 2;
    return Math.abs(x + 0.5 - fx) <= rx && y <= hem;
  };
  ellipse(c, fx + 2, ff, 30, 4, (x, y) => (get(c, x, y) === "." || get(c, x, y) === "-" ? "-" : null));
  for (let y = top; y < ff; y++)
    for (let x = fx - 30; x <= fx + 30; x++) {
      if (!inside(x, y)) continue;
      const u = (x - fx) / 27;
      const fold = Math.sin((x - fx) * 0.42 + (y - top) * 0.05);
      let k = u < -0.35 ? "h" : u > 0.45 ? "i" : "H";
      if (fold > 0.75) k = u > 0.2 ? "I" : "i";
      else if (fold < -0.85 && u < 0.3) k = "h";
      if (y === top || !inside(x, y - 1)) k = u < 0.3 ? "h" : "H";
      put(c, x, y, k);
    }
  // The board under it: a flat, squared bump on top (its lit north face, its front in shade).
  for (let y = top - 5; y <= top + 2; y++)
    for (let x = fx - 15; x <= fx + 15; x++) {
      const edge = Math.abs(x - fx) === 15;
      put(c, x, y, y < top - 3 ? "h" : edge ? "i" : y === top + 2 ? "I" : x < fx ? "H" : "i");
    }
  rect(c, fx - 15, top - 6, 31, 1, "I");
  // The outline: the drape's edge.
  const fill = new Set(["h", "H", "i", "I"]);
  const snap = c.map((r) => r.slice());
  for (let y = top - 7; y <= ff + 1; y++)
    for (let x = fx - 32; x <= fx + 32; x++) {
      if (fill.has(snap[y]?.[x] ?? ".")) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fill.has(snap[y + dy!]?.[x + dx!] ?? "."))) put(c, x, y, "8");
    }
  for (const [u, v, d, l, r] of BLOTS) splat(c, fx - 24 + u * 48, top + v * 26, r, d, l, Math.round(u * 100 + v * 10), (x, y) => fill.has(get(c, x, y)));
}

/** One frame of the sheet in the air: its middle (cx, cy), w x h, turned `rot`, its long edges bowed `bow` (+ up), its folds at `ph`. */
function sheet(c: Cv, cx: number, cy: number, w: number, h: number, rot: number, bow: number, ph: number) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const at = (u: number, v: number): Pt => {
    const x = (u - 0.5) * w;
    const y = (v - 0.5) * h - bow * Math.sin(Math.PI * u) + Math.sin(u * 9 + ph) * 1.6;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  };
  const pts: Pt[] = [];
  for (let i = 0; i <= 12; i++) pts.push(at(i / 12, 0));
  for (let i = 12; i >= 0; i--) pts.push(at(i / 12, 1));
  const ins = inPoly(pts);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)) + 1; y++)
    for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x++) {
      if (!ins(x, y)) continue;
      // Folds run across the sheet: shade by where the pixel is along it.
      const lx = (x - cx) * cos + (y - cy) * sin;
      const f = Math.sin((lx / w) * 11 + ph);
      put(c, x, y, f > 0.6 ? "i" : f < -0.6 ? "h" : "H");
    }
  for (let i = 1; i < pts.length; i++) line(c, pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1], "8");
  line(c, pts[pts.length - 1]![0], pts[pts.length - 1]![1], pts[0]![0], pts[0]![1], "8");
  for (const [u, v, d, l, r] of BLOTS) {
    const [x, y] = at(u, v);
    splat(c, x, y, r * 0.9, d, l, Math.round(u * 100 + v * 10), (xx, yy) => ins(xx, yy) && get(c, xx, yy) !== "8");
  }
}
/** The heap on the floor: a lumpy mound of cloth, folds and a blot or two showing. */
function heap(c: Cv, cx: number, foot: number, squash: number) {
  ellipse(c, cx + 2, foot, 19, 3, "-");
  const lumps: readonly (readonly [number, number, number, number])[] = [
    [-8, -4, 9, 5],
    [5, -5, 10, 6],
    [-1, -9 * squash, 8, 5 * squash],
    [9, -2, 7, 3],
    [-12, -1, 6, 3],
  ];
  for (const [dx, dy, rx, ry] of lumps) ellipse(c, cx + dx, foot + dy, rx + 1, ry + 1, "8");
  for (const [dx, dy, rx, ry] of lumps)
    ellipse(c, cx + dx, foot + dy, rx, ry, (x, y) => {
      const lx = x + 0.5 - (cx + dx);
      const ly = y + 0.5 - (foot + dy);
      return lx < -rx * 0.3 && ly < 0 ? "h" : lx > rx * 0.4 || ly > ry * 0.4 ? "i" : "H";
    });
  splat(c, cx - 4, foot - 6, 1.8, "P", "p", 4, (x, y) => get(c, x, y) !== "." && get(c, x, y) !== "8" && get(c, x, y) !== "-");
  splat(c, cx + 8, foot - 3, 1.4, "T", "t", 5, (x, y) => get(c, x, y) !== "." && get(c, x, y) !== "8" && get(c, x, y) !== "-");
}
/** Where the heap lies, from the table's foot (px; west). */
export const HEAP_DX = -76;
/** The whip's keyframes: the sheet's middle (from the table's foot), size, turn, bow; then the heap. */
const WHIP: readonly (readonly [number, number, number, number, number, number])[] = [
  [-6, -34, 56, 26, -0.08, 8],
  [-22, -54, 64, 24, -0.3, 11],
  [-42, -76, 70, 20, -0.55, 12],
  [-62, -88, 72, 18, -0.85, 7],
  [-78, -80, 66, 20, -1.15, -5],
  [-84, -58, 54, 24, -1.35, -9],
  [-80, -30, 44, 28, -1.48, -6],
];
/** The whip's frame times (ms): a snap up, a sail, a drop; then the heap's squash and settle. */
export const WHIP_MS = [60, 70, 80, 90, 90, 80, 70, 90, 120] as const;
/** On which of `whip`'s frames the board under it shows (the cloth is off the table's top). */
export const WHIP_BOARD_FRAME = 1;
function clothFrames() {
  const covered = cv(CLW, CLH);
  drapeOn(covered, CX, CF);
  const whip: Cv[] = WHIP.map(([dx, dy, w, h, rot, bow], i) => {
    const c = cv(CLW, CLH);
    sheet(c, CX + dx, CF + dy, w, h, rot, bow, i * 0.9);
    return c;
  });
  for (const sq of [1.4, 1.15]) {
    const c = cv(CLW, CLH);
    heap(c, CX + HEAP_DX, CF, sq);
    whip.push(c);
  }
  const rest = cv(CLW, CLH);
  heap(rest, CX + HEAP_DX, CF, 1);
  return { covered, whip, rest };
}
const CL = clothFrames();
const frameOf = (name: string, ms: number) => ({ ms, layers: [{ part: name, x: 0, y: 0 }] });
export const INTRO_SMUDGY_CLOTH: Character = {
  id: "intro-smudgy-cloth",
  name: "The drop cloth over Smudgy's table",
  w: CLW,
  h: CLH,
  foot: [CX, CF],
  palette: PAINT_PALETTE,
  parts: { covered: whole(CL.covered), heap: whole(CL.rest), ...Object.fromEntries(CL.whip.map((c, i) => [`whip${i}`, whole(c)])) },
  anims: {
    covered: { loop: true, frames: [frameOf("covered", 1000)] },
    whip: { loop: false, frames: CL.whip.map((_, i) => ({ ...frameOf(`whip${i}`, WHIP_MS[i]!), ...(i === 0 ? { cue: "whoosh" } : i === WHIP.length ? { cue: "flop" } : {}) })) },
    heap: { loop: true, frames: [frameOf("heap", 1000)] },
  },
};
/** The covered table as one picture, the table's size (the room's own piece: the stools, the drape over the table). */
export function coveredTableCv(): Cv {
  const c = TABLE_CV.map((r) => r.slice());
  drapeOn(c, TCX, TFOOT);
  return c;
}

// ---- The splatter into the match: the room's deep paints (hex, for a canvas), and the brush stroke's.

export const INTRO_SMUDGY_SPLATS: readonly string[] = ["T", "B", "R", "P", "t", "b", "r", "p", "Y"].map((k) => PAINT_PALETTE[k]!);
/** What the splats cover the screen with once they've filled it (under them): the deepest blue. */
export const INTRO_SMUDGY_GROUND = PAINT_PALETTE.B!;
/** The brush stroke that wipes it away: its paint, its bristles' streaks. */
export const INTRO_SMUDGY_STROKE = { paint: PAINT_PALETTE.y!, streak: PAINT_PALETTE.Y!, edge: PAINT_PALETTE.O! } as const;
