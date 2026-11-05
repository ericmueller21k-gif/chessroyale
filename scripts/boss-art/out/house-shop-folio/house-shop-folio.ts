/**
 * Inside the Folded House: Folio's sanctuary and shop (house-shop-folio). A box room of 20 x 20 squares seen as the town
 * square is seen (the camera looks north, things stand upright at their foot, 37 px a square), built as Hollow's and
 * Timber's shops are: every piece its own Character (`shop-folio-<name>`), the layout, the room still.
 *
 * Folio (characters/folio.ts, its home town/houses/folio.ts) is a paper crane folded from one page of handwriting: calm,
 * honest, warm, a little unsettling. **The room is a page still being written.** Near the middle everything is folded,
 * coloured and solid: a floor of folded paper squares, stained-glass windows of tissue paper in folded frames, a fountain
 * whose water is ribbons of paper and ink pouring and looping, folded bonsai, hanging strings of small cranes, folding
 * screens, a low writing desk. Toward the edges and the back it thins into ink sketch: the floor's folds drawn only as
 * blue-black lines on blank cream, faint ruled lines, a margin line down the west side; pillars, a bench and a lantern drawn
 * only as outlines; the far wall fades into unwritten paper. A few lines write themselves in while you watch, then fade.
 * The battle spot is "the clean page": a large blank sheet on the floor, its edges a little lifted.
 *
 * Footing as the other shops: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on its
 * row). Floor tiles are flat, 37 x 37, foot at their middle, and seamless. The east wall's pieces are the west's mirrored.
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import { signFace, type LightPool, type LightSpot } from "../../../../packages/app/src/town/houses/kit.ts";
import {
  PAPER_PALETTE as PALETTE,
  crop,
  cursive,
  cv,
  ellipse,
  face,
  get,
  gilt,
  hash,
  inPoly,
  inkLine,
  inkPath,
  line,
  paragraph,
  put,
  putOn,
  rect,
  seal,
  shadow,
  stamp,
  tinyCrane,
  type Cv,
  type Pt,
} from "./paper-kit.ts";

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
  return { id: `shop-folio-${p.name}`, name: `Folio's sanctuary: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
  return toChar(PIECES[name]!);
}
const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });
const bitOf = (c: Cv, outline = true): Bit | null => {
  const r = crop(c);
  return r ? { part: { grid: r.grid, outline }, at: r.at } : null;
};
const bits = (...bs: (Bit | null)[]): Bit[] => bs.filter((b): b is Bit => b !== null);

// ==== The floor. Every tile is a square of the page. In the written middle it's a folded square sheet (a crease on one
// diagonal, the two halves a hair apart in tone, a lit lip on its north and west edges); toward the edges it's the same
// square drawn only in ink on blank cream, over faint ruled lines; at the very edge, ruled blank paper; along the west side,
// the margin line. Tiles join edge to edge (their edges are the same in every kind).

/** The ruled lines' rows in a tile (every 12 px; the page's lines run on across tiles). */
const RULED = [5, 17, 29];
const ruled = (y: number) => RULED.includes(y);
function blankPaper(x: number, y: number, seed: number, rule = true): string {
  if (rule && ruled(y)) return hash(x >> 2, y, seed) < 0.06 ? "a" : "r";
  return hash(x, y, seed + 40) < 0.012 ? "F" : "a";
}
/** A folded square: crease on the diagonal (NW-SE, or NE-SW when `turn`), the halves B and b, lit lip north and west. */
function foldedKey(x: number, y: number, turn: boolean): string {
  if (y === 0 || x === 0) return "A";
  if (y === T - 1 || x === T - 1) return "b";
  const u = turn ? T - 1 - x : x;
  if (u === y) return turn ? "C" : "C";
  if (u === y + 1) return "A";
  // The half toward the light (north-east of a NW-SE crease; north-west of a NE-SW one) is the lit one.
  return (turn ? u < y : u > y) ? "B" : "b";
}
const tile = (name: string, fn: (x: number, y: number) => string) => {
  const c = cv(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = fn(x, y);
  return def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
};
/** The written floor: folded squares, the crease turning square to square (`-b`), a few with a line or two of faint writing. */
tile("floor-a", (x, y) => foldedKey(x, y, false));
tile("floor-b", (x, y) => foldedKey(x, y, true));
{
  for (const [name, turn, seed] of [["floor-c", false, 3], ["floor-d", true, 5]] as const) {
    const c = cv(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = foldedKey(x, y, turn);
    // Two lines of faint cursive across the lit half.
    cursive(c, 6, turn ? 11 : 13, 20, (xx, yy) => (get(c, xx, yy) === "B" ? "K" : get(c, xx, yy) === "b" ? "K" : null), seed);
    cursive(c, 9, turn ? 16 : 18, 15, (xx, yy) => (get(c, xx, yy) === "B" || get(c, xx, yy) === "b" ? "K" : null), seed + 9);
    def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
  }
}
/**
 * The sketched floor: blank cream over ruled lines, the folded square drawn in ink: its north and west edges (the grid
 * running on from the folded floor) in the fading ink, the crease fainter and broken, a few strokes of hatching.
 */
function sketchTile(name: string, turn: boolean, seed: number, o: { hatch?: boolean; faint?: boolean } = {}) {
  const c = cv(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = blankPaper(x, y, seed);
  const ink = o.faint ? "K" : "J";
  inkLine(c, [0, 0], [T - 1, 0], ink, { seed, gaps: o.faint ? 0.3 : 0.12, wobble: 0.3 });
  inkLine(c, [0, 0], [0, T - 1], ink, { seed: seed + 1, gaps: o.faint ? 0.3 : 0.12, wobble: 0.3 });
  const a: Pt = turn ? [T - 3, 2] : [2, 2];
  const b: Pt = turn ? [3, T - 2] : [T - 2, T - 2];
  // The crease, only part drawn (a stroke from one corner, left off), on the nearer sketch tiles.
  if (!o.faint) inkLine(c, a, [a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45], "K", { seed: seed + 2, gaps: 0.2, wobble: 0.5 });
  if (o.hatch)
    for (let i = 0; i < 2; i++) {
      const hx = (turn ? 6 : 24) + i * 3;
      inkLine(c, [hx, 30], [hx + 3, 27], "K", { seed: seed + 5 + i, wobble: 0.2 });
    }
  return def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
}
sketchTile("floor-sketch", false, 11, { hatch: true });
sketchTile("floor-sketch-b", true, 12);
sketchTile("floor-sketch-c", false, 13, { faint: true });
sketchTile("floor-sketch-d", true, 14, { faint: true, hatch: true });
/** The edge: ruled blank paper (`-b`: a pen's dot or two, a stroke started and left), the back row unruled (unwritten). */
tile("floor-ruled", (x, y) => blankPaper(x, y, 21));
{
  const c = cv(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = blankPaper(x, y, 22);
  put(c, 12, 22, "K");
  put(c, 25, 9, "K");
  inkLine(c, [18, 30], [27, 27], "K", { seed: 3, wobble: 0.4 });
  def("floor-ruled-b", [1, 1], T, T, [18, 18], [[whole(c)]]);
}
tile("floor-blank", (x, y) => blankPaper(x, y, 23, false));
/** The margin line (pale vermilion, two px) down the west side, over the ruled lines. */
const MARGIN_X = 24;
tile("floor-margin", (x, y) => (x === MARGIN_X || x === MARGIN_X + 1 ? (ruled(y) ? "m" : "m") : blankPaper(x, y, 24)));

// ==== The clean page: a large blank sheet on the floor (6 x 6 squares, columns 7 to 12, rows 8 to 13), a little smaller than
// its squares, its edges lifted a hair (a soft shadow along them, wider toward the corners, falling south-east), two of its
// corners curling up to show the paper's back. The two start marks on it, on its middle line: Folio's (west), an ink ring
// with its seal; yours (east), a gilt ring with a pawn.

const PG = { x0: 7 * T + 4, y0: 8 * T + 4, x1: 13 * T - 5, y1: 14 * T - 5 } as const;
const MARKS_PX = { boss: [8.5 * T, 11 * T] as Pt, you: [11.5 * T, 11 * T] as Pt };
/** The start marks, in squares (as the other shops give them): the middle of their square, on the page's middle line. */
export const SHOP_FOLIO_MARKS = { boss: [8, 10.5], you: [11, 10.5] } as const;
/** How much a point of the sheet's edge is lifted (0 flat, 1 a corner): rises toward each corner. */
function lift(gx: number, gy: number): number {
  const dx = Math.min(gx - PG.x0, PG.x1 - gx);
  const dy = Math.min(gy - PG.y0, PG.y1 - gy);
  return Math.max(0, 1 - Math.hypot(dx, dy) / 34);
}
/** The curled corners (north-east and south-west): a little triangle of the paper's back turned up. */
function curl(gx: number, gy: number): Key {
  const ne = gx - (PG.x1 - 9) + (PG.y0 + 9 - gy);
  const sw = PG.x0 + 8 - gx + (gy - (PG.y1 - 8));
  // Inside the corner's triangle: the back (F, its fold line lit).
  if (gx > PG.x1 - 9 && gy < PG.y0 + 9 && ne > 9) return ne < 10.5 ? "A" : ne > 15 ? "f" : "F";
  if (gx < PG.x0 + 8 && gy > PG.y1 - 8 && sw > 8) return sw < 9.5 ? "A" : sw > 13 ? "f" : "F";
  return null;
}
function inSheet(gx: number, gy: number): boolean {
  return gx >= PG.x0 && gx <= PG.x1 && gy >= PG.y0 && gy <= PG.y1;
}
function markAt(gx: number, gy: number): Key {
  // Folio's: a brush ring, thicker on its lower left (the stroke's press), open a little at its upper right; its seal inside.
  {
    const [cx, cy] = MARKS_PX.boss;
    const dx = gx + 0.5 - cx;
    const dy = gy + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const th = 1.1 + 1.3 * (0.5 + 0.5 * Math.cos(a - 2.3));
    const open = a < -0.35 && a > -1.05;
    if (!open && d <= 9.6 && d >= 9.6 - th) return d > 9.6 - 0.9 ? "l" : "I";
    // Its tail: the brush lifting off past the gap (a dry flick).
    if (a <= -1.05 && a > -1.3 && d <= 9.6 && d >= 8.6) return "J";
    const sx = Math.round(gx - (cx - 3));
    const sy = Math.round(gy - (cy - 3));
    const k = [".vvvvv", "vvvAvv", "vvvAvv", "vvAAAv", "vvvvvw", "vvvww."][sy]?.[sx];
    if (k && k !== ".") return k;
  }
  // Yours: a gilt ring, lit on its upper left; a small gilt pawn inside.
  {
    const [cx, cy] = MARKS_PX.you;
    const dx = gx + 0.5 - cx;
    const dy = gy + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    if (d <= 9.6 && d >= 7.6) return dx + dy < -6 ? "H" : dx + dy > 5 ? "g" : "G";
    const px = Math.round(gx - (cx - 3.5));
    const py = Math.round(gy - (cy - 4.5));
    const k = ["..oo...", ".oGGo..", ".oGGo..", "..oo...", "..GG...", ".oGGG..", "oGGGGo.", "ooooooo"][py]?.[px];
    if (k && k !== ".") return k === "G" ? "G" : "g";
  }
  return null;
}
function pageKey(gx: number, gy: number): string {
  const c = curl(gx, gy);
  if (c) return c;
  if (inSheet(gx, gy)) {
    const m = markAt(gx, gy);
    if (m) return m;
    // The sheet: clean paper, its north and west edges a lit lip, its south and east edges a hair darker where they lift.
    if (gy === PG.y0 || gx === PG.x0) return "A";
    if ((gy === PG.y1 || gx === PG.x1) && lift(gx, gy) > 0.15) return "b";
    return hash(gx, gy, 77) < 0.006 ? "a" : "A";
  }
  // The shadow under the lifted edge, on the floor: a band south and east of the sheet, wider at the corners.
  const sx = gx - 1;
  const sy = gy - 1;
  for (let s = 1; s <= 5; s++) {
    const ox = Math.min(PG.x1, Math.max(PG.x0, gx - s));
    const oy = Math.min(PG.y1, Math.max(PG.y0, gy - s));
    if (inSheet(gx - s, gy - s) && !inSheet(gx, gy) && s <= 1 + 4 * lift(ox, oy)) return s <= 1 + 2 * lift(ox, oy) ? "D" : "C";
  }
  void sx;
  void sy;
  const col = Math.floor(gx / T);
  const row = Math.floor(gy / T);
  return foldedKey(gx - col * T, gy - row * T, (col + row) % 2 === 1);
}
const PAGE = new Set<string>();
for (let row = 8; row <= 13; row++)
  for (let col = 7; col <= 12; col++) {
    PAGE.add(`${col},${row}`);
    tile(`page-${col}-${row}`, (x, y) => pageKey(col * T + x, row * T + y));
  }

// ==== The walls. The back wall (row 0) fades into unwritten paper: blank hung sheets, their tops deckled; nearer the shop
// (either side of the backdrop) a shoji lattice and a pillar drawn in ink, and one line of the lattice writing itself in. The
// side walls (columns 0 and 19) are solid in the middle (folded shoji panels, and the stained-glass windows) and sketched
// toward the front and back. The front (row 19): a low blank band, its top edge an ink line; the door.

const WALL_H = 130;
const WF: Pt = [18, WALL_H - 1];
/** A hung sheet of blank paper, 37 wide: deckled at its top, a hair warmer toward its foot, a faint seam at its west edge. */
function blankSheet(seed: number, rule = false): Cv {
  const c = cv(T, WALL_H);
  for (let y = 0; y < WALL_H; y++)
    for (let x = 0; x < T; x++) {
      const deckle = 4 + Math.floor(hash(x >> 1, 1, seed) * 3);
      if (y < deckle) continue;
      if (y === deckle) {
        c[y]![x] = "A";
        continue;
      }
      if (y >= WALL_H - 2) {
        c[y]![x] = "b";
        continue;
      }
      if (x === 0 && hash(y >> 3, 2, seed) < 0.7) {
        c[y]![x] = "F";
        continue;
      }
      if (rule && (y - 12) % 12 === 0 && y > 12 && y < WALL_H - 6) {
        c[y]![x] = "r";
        continue;
      }
      c[y]![x] = y > WALL_H - 22 ? (hash(x, y, seed) < 0.5 ? "B" : "a") : blankPaper(x, y, seed, false);
    }
  return c;
}
const wallDef = (name: string, frames: Cv[], ms = 1000, sq: readonly [number, number] = [1, 1]) => def(name, sq, T, WALL_H, WF, frames.map((c) => [whole(c)]), ms);
/** A shoji lattice drawn in ink on the blank sheet: a frame and its bars (some left unfinished). `upTo` draws one bar part way. */
function latticeSketch(c: Cv, seed: number, o: { writing?: { bar: number; upTo: number; ink: string } } = {}) {
  const x0 = 5;
  const x1 = 31;
  const y0 = 30;
  const y1 = 104;
  inkLine(c, [x0, y0], [x1, y0], "J", { seed, gaps: 0.05 });
  inkLine(c, [x0, y0], [x0, y1], "J", { seed: seed + 1, gaps: 0.08 });
  inkLine(c, [x1, y0], [x1, y1 - 30], "K", { seed: seed + 2, gaps: 0.2 });
  inkLine(c, [x0, y1], [x1 - 12, y1], "K", { seed: seed + 3, gaps: 0.15 });
  const bars: [Pt, Pt][] = [
    [[x0, 55], [x1, 55]],
    [[x0, 80], [x1 - 6, 80]],
    [[18, y0], [18, y1 - 10]],
  ];
  bars.forEach(([a, b], i) => {
    const w = o.writing && o.writing.bar === i ? o.writing : null;
    if (w && w.upTo <= 0) return;
    inkLine(c, a, b, w ? w.ink : "K", { seed: seed + 10 + i, gaps: w ? 0 : 0.18, upTo: w ? w.upTo : 1, pen: w && w.upTo < 1 ? "I" : undefined });
  });
}
/** A pillar drawn in ink on the blank sheet: two uprights, a capital, a base; hatching down its shaded side, left half done. */
function pillarSketch(c: Cv, seed: number) {
  inkLine(c, [11, 14], [11, WALL_H - 4], "J", { seed, gaps: 0.06 });
  inkLine(c, [25, 14], [25, WALL_H - 30], "J", { seed: seed + 1, gaps: 0.1 });
  inkLine(c, [7, 14], [29, 14], "J", { seed: seed + 2 });
  inkLine(c, [7, 18], [29, 18], "K", { seed: seed + 3, gaps: 0.2 });
  inkLine(c, [8, WALL_H - 4], [22, WALL_H - 4], "K", { seed: seed + 4, gaps: 0.2 });
  for (let y = 24; y < 70; y += 4) inkLine(c, [21, y + 3], [24, y], "K", { seed: seed + y, wobble: 0.2 });
}
wallDef("wall", [blankSheet(31)]);
wallDef("wall-b", [blankSheet(32)]);
{
  const c = blankSheet(33);
  latticeSketch(c, 5);
  wallDef("wall-sketch", [c]);
  const p = blankSheet(34);
  pillarSketch(p, 9);
  wallDef("wall-pillar-sketch", [p]);
}
/**
 * Being written: a lattice sketch whose middle bar writes itself in (the pen's dot running ahead), holds, then fades back
 * into the paper, and rests unwritten a while. 16 frames at 180 ms (2.9 s); `-b` the same, a quarter loop out of step.
 */
const WRITE_UP = [0, 0.18, 0.38, 0.6, 0.82, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0];
const WRITE_INK = ["I", "I", "I", "I", "I", "I", "I", "I", "I", "J", "K", "r", "r", "I", "I", "I"];
function writingFrames(seed: number, shift: number): Cv[] {
  return Array.from({ length: 16 }, (_, i0) => {
    const i = (i0 + shift) % 16;
    const c = blankSheet(seed);
    latticeSketch(c, seed, { writing: { bar: 1, upTo: WRITE_UP[i]!, ink: WRITE_INK[i]! } });
    return c;
  });
}
wallDef("wall-writing", writingFrames(35, 0), 180);
wallDef("wall-writing-b", writingFrames(36, 8), 180);

// -- The side walls.

/** A solid folded shoji panel: kraft frame and bars, cream paper with its fold down the middle, a gilt cap, a kraft plinth. */
function shojiPanel(seed: number): Cv {
  const c = cv(T, WALL_H);
  // The frame: kraft, lit on its top and left.
  face(c, [[2, 12], [35, 12], [35, WALL_H], [2, WALL_H]], "8", { hi: "7", lo: "9" });
  // The paper in it: lit half and shaded half (a fold down the middle), faint cursive.
  face(c, [[5, 16], [18, 16], [18, WALL_H - 14], [5, WALL_H - 14]], "B", { hi: "A" });
  face(c, [[19, 16], [32, 16], [32, WALL_H - 14], [19, WALL_H - 14]], "b", { lo: "C" });
  for (const y of [44, 72, 100]) line(c, 5, y, 32, y, "8");
  line(c, 18, 16, 18, WALL_H - 14, "9");
  paragraph(c, 6, 17, 24, 3, 5, "i", seed, (x, y) => get(c, x, y) === "B");
  paragraph(c, 20, 31, 52, 2, 5, "j", seed + 3, (x, y) => get(c, x, y) === "b");
  // The plinth.
  face(c, [[2, WALL_H - 12], [35, WALL_H - 12], [35, WALL_H], [2, WALL_H]], "9", { hi: "8", lo: "0" });
  gilt(c, [2, 12], [35, 12], { glint: 0.2 });
  return c;
}
wallDef("side-shoji", [shojiPanel(41)]);
/**
 * The stained-glass window: tall panes of tissue paper lit from behind, cut in triangles (a fold pattern), in a folded-paper
 * frame (its four faces mitred at the corners, lit top and left), gilt along its inner edge, a sill. Three colours to a
 * window (`set`: light and deep keys), lighter toward the top where the sun comes through.
 */
const WIN = { x0: 7, y0: 24, x1: 29, y1: 104 } as const;
function stainedWindow(set: readonly (readonly [string, string])[], seed: number): Cv {
  const c = cv(T, WALL_H);
  // The wall around it: the folded panel's paper (solid, written).
  face(c, [[2, 12], [35, 12], [35, WALL_H], [2, WALL_H]], "B", { hi: "A", lo: "C" });
  // The frame: four folded faces, mitred.
  const o = 4;
  face(c, [[WIN.x0 - o, WIN.y0 - o], [WIN.x1 + o, WIN.y0 - o], [WIN.x1, WIN.y0], [WIN.x0, WIN.y0]], "A");
  face(c, [[WIN.x0 - o, WIN.y0 - o], [WIN.x0, WIN.y0], [WIN.x0, WIN.y1], [WIN.x0 - o, WIN.y1 + o]], "B");
  face(c, [[WIN.x1 + o, WIN.y0 - o], [WIN.x1 + o, WIN.y1 + o], [WIN.x1, WIN.y1], [WIN.x1, WIN.y0]], "C");
  face(c, [[WIN.x0 - o, WIN.y1 + o], [WIN.x0, WIN.y1], [WIN.x1, WIN.y1], [WIN.x1 + o, WIN.y1 + o]], "D");
  line(c, WIN.x0 - o, WIN.y0 - o, WIN.x0, WIN.y0, "C");
  line(c, WIN.x1 + o, WIN.y0 - o, WIN.x1, WIN.y0, "D");
  line(c, WIN.x0 - o, WIN.y1 + o, WIN.x0, WIN.y1, "C");
  line(c, WIN.x1 + o, WIN.y1 + o, WIN.x1, WIN.y1, "E");
  // The panes: a grid of 7 px cells, each cut on a diagonal (alternating) into two triangles of tissue, a kraft lead between.
  const cell = 7;
  for (let y = WIN.y0 + 1; y < WIN.y1; y++)
    for (let x = WIN.x0 + 1; x < WIN.x1; x++) {
      const gx = x - WIN.x0 - 1;
      const gy = y - WIN.y0 - 1;
      const ci = Math.floor(gx / cell);
      const cj = Math.floor(gy / cell);
      const u = gx % cell;
      const v = gy % cell;
      if (u === cell - 1 || v === cell - 1) {
        put(c, x, y, "9");
        continue;
      }
      const flip = (ci + cj) % 2 === 1;
      const upper = flip ? u + v < cell - 2 : u > v;
      const diag = flip ? u + v === cell - 2 : u === v;
      if (diag) {
        put(c, x, y, "9");
        continue;
      }
      const pick = Math.floor(hash(ci * 2 + (upper ? 1 : 0), cj, seed) * set.length);
      const [lit, deep] = set[pick]!;
      // Lighter toward the top; the lower panes deep on their lower triangle.
      const lowness = gy / (WIN.y1 - WIN.y0);
      const isDeep = (!upper && lowness > 0.35) || lowness > 0.8;
      put(c, x, y, isDeep ? deep : lit);
    }
  // A glint where the sun is strongest (upper left), a gilt line round the panes.
  for (let y = WIN.y0; y <= WIN.y1; y++) {
    put(c, WIN.x0, y, "o");
    put(c, WIN.x1, y, "o");
  }
  for (let x = WIN.x0; x <= WIN.x1; x++) {
    put(c, x, WIN.y0, "G");
    put(c, x, WIN.y1, "o");
  }
  put(c, WIN.x0 + 2, WIN.y0 + 2, "A");
  put(c, WIN.x0 + 3, WIN.y0 + 2, "A");
  put(c, WIN.x0 + 2, WIN.y0 + 3, "A");
  // The sill, and the plinth.
  face(c, [[3, WIN.y1 + 5], [34, WIN.y1 + 5], [34, WIN.y1 + 8], [3, WIN.y1 + 8]], "A", { lo: "C" });
  face(c, [[2, WALL_H - 12], [35, WALL_H - 12], [35, WALL_H], [2, WALL_H]], "9", { hi: "8", lo: "0" });
  gilt(c, [2, 12], [35, 12], { glint: 0.7 });
  return c;
}
/** Window colour sets (tissue light / deep): rose, gold, blue; jade, violet, gold. */
const GLASS_A = [["p", "P"], ["y", "Y"], ["u", "U"]] as const;
const GLASS_B = [["q", "Q"], ["x", "X"], ["y", "Y"]] as const;
wallDef("window", [stainedWindow(GLASS_A, 51)]);
wallDef("window-b", [stainedWindow(GLASS_B, 52)]);
/** The sketched side wall: the shoji panel drawn only in ink on blank cream, over faint ruled lines (`-b`: fainter, unfinished). */
function sideSketch(seed: number, faint: boolean): Cv {
  const c = blankSheet(seed, true);
  const ink = faint ? "K" : "J";
  inkLine(c, [3, 13], [34, 13], ink, { seed, gaps: faint ? 0.25 : 0.08 });
  inkLine(c, [3, 13], [3, WALL_H - 3], ink, { seed: seed + 1, gaps: faint ? 0.25 : 0.08 });
  inkLine(c, [34, 13], [34, faint ? 60 : WALL_H - 20], "K", { seed: seed + 2, gaps: 0.2 });
  inkLine(c, [18, 18], [18, faint ? 70 : WALL_H - 16], "K", { seed: seed + 3, gaps: 0.2 });
  for (const y of faint ? [44] : [44, 72, 100]) inkLine(c, [5, y], [faint ? 20 : 32, y], "K", { seed: seed + y, gaps: 0.2 });
  if (!faint) inkLine(c, [3, WALL_H - 12], [34, WALL_H - 12], ink, { seed: seed + 9, gaps: 0.1 });
  return c;
}
wallDef("side-sketch", [sideSketch(61, false)]);
wallDef("side-sketch-b", [sideSketch(62, true)]);
wallDef("side-blank", [blankSheet(63, true)]);

// -- The front: a low band of blank paper (24 px), its top edge an ink line, a ruled line along it.
const HEM_H = 24;
{
  const c = cv(T, HEM_H);
  for (let y = 4; y < HEM_H; y++) for (let x = 0; x < T; x++) c[y]![x] = y === HEM_H - 1 ? "b" : y === 14 ? "r" : blankPaper(x, y, 71, false);
  inkLine(c, [0, 4], [T - 1, 4], "J", { seed: 71, gaps: 0.1, wobble: 0.4 });
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
}

// -- The way out (2 squares): a folded-paper doorway, its door a flap folded open; through it the town square in daylight.
const EW = 2 * T;
const EH = 112;
const EFOOT = EH - 1;
{
  const c = cv(EW, EH);
  const ox = 12;
  const ow = EW - 24;
  const oy = 22;
  // Outside: a pale sky, the square's paving in sun, a path to the door.
  for (let y = oy; y < EFOOT; y++)
    for (let x = ox; x < ox + ow; x++) {
      const k = y < 60 ? (y < 40 ? "u" : "1") : y < 66 ? (hash(x, y, 3) < 0.5 ? "N" : "e") : Math.abs(x - EW / 2) < 4 + (y - 66) / 4 ? (hash(x >> 1, y >> 1, 4) < 0.2 ? "C" : "b") : hash(x, y, 5) < 0.3 ? "N" : "n";
      put(c, x, y, k);
    }
  // Far roofs (other homes), simple shapes against the sky.
  face(c, [[ox, 60], [ox + 8, 50], [ox + 16, 60]], "P");
  face(c, [[ox + 30, 60], [ox + 36, 48], [ox + ow, 54], [ox + ow, 60]], "U");
  // The doorway's posts and lintel: folded paper, lit top and left, gilt along the lintel.
  face(c, [[2, 14], [12, 14], [12, EFOOT], [2, EFOOT]], "B", { hi: "A", lo: "C" });
  face(c, [[EW - 12, 14], [EW - 2, 14], [EW - 2, EFOOT], [EW - 12, EFOOT]], "C", { hi: "B", lo: "D" });
  face(c, [[0, 8], [EW, 8], [EW - 2, 22], [2, 22]], "A", { lo: "C" });
  gilt(c, [2, 21], [EW - 3, 21], { glint: 0.3 });
  seal(c, EW / 2 - 3, 11);
  // The door: a flap folded open against the east post (a kite of paper, lit and shaded halves).
  face(c, [[EW - 12, 24], [EW - 24, 40], [EW - 22, 96], [EW - 12, EFOOT - 2]], "B", { hi: "A", lo: "C" });
  line(c, EW - 12, 24, EW - 22, 96, "C");
  paragraph(c, EW - 22, EW - 14, 50, 4, 6, "i", 7, (x, y) => get(c, x, y) === "B");
  def("entrance", [2, 1], EW, EH, [37, EFOOT], [[whole(c, true)]]);
}

// ==== The backdrop behind the counter (4 squares): a four-panel folding screen, standing zigzag (the panels alternately lit
// and in shade, a kraft frame, gilt along their tops). The outer panels are shelves of folded goods: scrolls, stacks of
// tissue, little masu boxes, small cranes. Across the two middle panels a round window of gold tissue, lit from behind, a
// folded branch across it; faint cursive under it.

const BDW = 4 * T;
const BDH = 150;
const MOON = { x: 74, y: 56, r: 25 } as const;
export const SHOP_FOLIO_BACKDROP = (() => {
  const c = cv(BDW, BDH);
  const top = (i: number) => (i % 2 ? 10 : 6);
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 36;
    const x1 = x0 + 36;
    const lit = i % 2 === 0;
    face(c, [[x0, top(i)], [x1, top(i)], [x1, BDH - 1], [x0, BDH - 1]], "8", { hi: "7", lo: "9" });
    face(c, [[x0 + 3, top(i) + 3], [x1 - 3, top(i) + 3], [x1 - 3, BDH - 14], [x0 + 3, BDH - 14]], lit ? "B" : "b", { hi: lit ? "A" : "B", lo: lit ? "b" : "C" });
    // The wainscot: pleats.
    for (let x = x0 + 1; x < x1; x++) for (let y = BDH - 13; y < BDH - 1; y++) put(c, x, y, (x - x0) % 4 === 0 ? "0" : (x - x0) % 4 === 1 ? "8" : "9");
    gilt(c, [x0, top(i)], [x1, top(i)], { glint: lit ? 0.25 : 0.7 });
  }
  // The outer panels: three shelves each, kraft boards with a lit top.
  const shelf = (x0: number, y: number) => {
    rect(c, x0 + 3, y, 30, 1, "7");
    rect(c, x0 + 3, y + 1, 30, 2, "9");
  };
  for (const x0 of [2, 110]) for (const y of [44, 80, 116]) shelf(x0, y);
  // Goods. Scrolls: rolled cream paper lying on a shelf, kraft ends, a tie.
  const scroll = (x: number, y: number, len: number, tie: string) => {
    rect(c, x, y - 5, len, 1, "A");
    rect(c, x, y - 4, len, 2, "B");
    rect(c, x, y - 2, len, 2, "C");
    rect(c, x - 1, y - 5, 1, 5, "8");
    rect(c, x + len, y - 5, 1, 5, "9");
    rect(c, x + Math.floor(len / 2), y - 5, 2, 5, tie);
  };
  // Stacks of folded tissue, each sheet's edge a colour.
  const stack = (x: number, y: number, keys: string) =>
    [...keys].forEach((k, j) => {
      rect(c, x + (j % 2), y - 2 - j * 2, 12, 2, k);
      put(c, x + (j % 2) + 11, y - 2 - j * 2, "D");
    });
  // A masu box: a lid, a body, a gilt edge.
  const box = (x: number, y: number, w: number, k: string, d: string) => {
    rect(c, x, y - 8, w, 3, "A");
    rect(c, x, y - 5, w, 5, k);
    rect(c, x + w - 2, y - 5, 2, 5, d);
    rect(c, x, y - 6, w, 1, "G");
  };
  scroll(8, 44, 20, "P");
  scroll(10, 39, 16, "U");
  stack(8, 80, "pyuqx");
  box(23, 80, 9, "B", "C");
  tinyCrane(c, 8, 109, "p", "P");
  tinyCrane(c, 16, 109, "y", "Y");
  tinyCrane(c, 24, 109, "u", "U");
  box(116, 44, 10, "B", "C");
  box(128, 44, 7, "q", "Q");
  stack(116, 80, "xqyup");
  scroll(130, 80, 9, "v");
  tinyCrane(c, 115, 109, "q", "Q", true);
  tinyCrane(c, 123, 109, "x", "X", true);
  scroll(131, 116, 7, "Y");
  // The moon window: gold tissue lit from behind, darker toward its lower right, pleated like a fan (kraft leads from its
  // middle), a gilt rim; a folded branch crossing it from the left with two pads of pleated leaves.
  ellipse(c, MOON.x, MOON.y, MOON.r + 3, MOON.r + 3, (x, y) => (x + y < MOON.x + MOON.y ? "A" : "C"));
  ellipse(c, MOON.x, MOON.y, MOON.r + 1, MOON.r + 1, "G");
  ellipse(c, MOON.x, MOON.y, MOON.r, MOON.r, (x, y) => {
    const a = Math.atan2(y + 0.5 - MOON.y, x + 0.5 - MOON.x);
    const pleat = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 16);
    const edge = Math.abs(((a + Math.PI) / (2 * Math.PI)) * 16 - Math.round(((a + Math.PI) / (2 * Math.PI)) * 16)) < 0.06;
    if (edge) return "Y";
    const d = Math.hypot(x + 0.5 - MOON.x - 6, y + 0.5 - MOON.y - 6) / MOON.r;
    return d < 0.55 ? "L" : pleat % 2 ? (d > 1.05 ? "Y" : "y") : d > 0.95 ? "Y" : "L";
  });
  const branch: Pt[] = [[40, 82], [52, 70], [64, 66], [74, 54], [86, 50], [94, 40]];
  for (let i = 1; i < branch.length; i++) {
    const [a, b] = [branch[i - 1]!, branch[i]!];
    const th = i < 3 ? 2 : 1;
    for (let t = 0; t <= 1; t += 0.05) {
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      for (let k = 0; k <= th; k++) put(c, x, y + k, k === 0 ? "8" : "0");
    }
  }
  const pad = (cx: number, cy: number, rx: number, ry: number) =>
    ellipse(c, cx, cy, rx, ry, (x, y) => {
      if (y + 0.5 > cy + ry * 0.4) return (x + y) % 3 === 0 ? "6" : "e";
      return (x - y) % 3 === 0 ? "e" : (x + y) % 2 ? "N" : "n";
    });
  pad(60, 63, 8, 4);
  pad(90, 44, 9, 4);
  pad(76, 49, 5, 3);
  // Cursive under the window, on the two middle panels.
  paragraph(c, 44, 70, 92, 4, 6, "i", 21, (x, y) => get(c, x, y) === "B");
  paragraph(c, 79, 104, 96, 4, 6, "j", 22, (x, y) => get(c, x, y) === "b");
  // The seal, pressed low on the second panel.
  seal(c, 98, 120);
  return def("backdrop", [4, 1], BDW, BDH, [74, BDH - 1], [[whole(c, true)]]);
})();

// ==== The counter (4 squares): a low folded-paper counter, 29 px tall (the turtle shows over it): its top a lit strip with a
// gilt front edge, its front pleated, its ends folded in; a blank plaque in a gilt frame. On it, a stack of folded pages and a
// brush on a rest at its west end; Folio's Boss Crate at its east end.

const CW = 4 * T;
const CH = 46;
const CFOOT = CH - 3;
const CTOP = 14;
const PLQ = { x: 44, y: CTOP + 10, w: 60, h: 14 } as const;
export const SHOP_FOLIO_COUNTER_SIGN = signFace(PLQ.x, PLQ.y, PLQ.w, PLQ.h);
export const SHOP_FOLIO_CRATE_AT: Pt = [122, CTOP + 3];
export const SHOP_FOLIO_COUNTER = (() => {
  const c = cv(CW, CH);
  shadow(c, CW / 2, CFOOT, CW / 2 + 2, 3);
  // Top: a lit strip seen from above (6 px), gilt along its front edge.
  face(c, [[4, CTOP], [CW - 4, CTOP], [CW - 2, CTOP + 6], [2, CTOP + 6]], "A", { lo: "B" });
  gilt(c, [2, CTOP + 6], [CW - 3, CTOP + 6], { glint: 0.15 });
  // Front: vertical pleats (a lit face, a shaded face, a crease), the ends folded in (triangles).
  for (let y = CTOP + 7; y < CFOOT; y++)
    for (let x = 2; x < CW - 2; x++) {
      const u = (x - 2) % 8;
      put(c, x, y, u === 0 ? "A" : u < 4 ? "B" : u === 7 ? "D" : "C");
    }
  face(c, [[2, CTOP + 7], [10, CTOP + 7], [2, CFOOT]], "C");
  face(c, [[CW - 2, CTOP + 7], [CW - 10, CTOP + 7], [CW - 2, CFOOT]], "D");
  rect(c, 2, CFOOT - 2, CW - 4, 2, "D");
  // The plaque: a blank cream card in a gilt frame (the game writes on it).
  face(c, [[PLQ.x - 1, PLQ.y - 1], [PLQ.x + PLQ.w + 1, PLQ.y - 1], [PLQ.x + PLQ.w + 1, PLQ.y + PLQ.h + 1], [PLQ.x - 1, PLQ.y + PLQ.h + 1]], "G", { hi: "H", lo: "g" });
  rect(c, PLQ.x + 1, PLQ.y + 1, PLQ.w - 1, PLQ.h - 1, "a");
  rect(c, PLQ.x + 1, PLQ.y + PLQ.h - 1, PLQ.w - 1, 1, "B");
  // On top, at its west end: a stack of folded pages, a brush on a little rest.
  for (let j = 0; j < 4; j++) {
    rect(c, 10 + (j % 2), CTOP + 2 - j * 2, 16, 2, j % 2 ? "B" : "A");
    put(c, 25 + (j % 2), CTOP + 2 - j * 2, "C");
  }
  cursive(c, 12, CTOP - 4, 12, "i", 5);
  rect(c, 32, CTOP + 2, 6, 2, "S");
  line(c, 30, CTOP + 1, 42, CTOP - 1, "8");
  line(c, 30, CTOP + 2, 42, CTOP, "9");
  put(c, 43, CTOP - 1, "T");
  put(c, 44, CTOP - 1, "T");
  return def("counter", [4, 1], CW, CH, [74, CFOOT], [[whole(c, true)]]);
})();

// ==== Folio's Boss Crate: a folded paper box (a masu box) with its lid on, sealed with Folio's vermilion seal across the
// seam. Idle: now and then the lid lifts a hair (a sliver of light under it) and settles.

const XW = 32;
const XH = 30;
const XF = XH - 2;
function crateCv(lid: number): Cv {
  const c = cv(XW, XH);
  shadow(c, 16, XF, 15, 2);
  // The box: its front lit, its east side in shade (seen three-quarters).
  face(c, [[4, 13], [25, 13], [25, XF], [4, XF]], "B", { hi: "A", lo: "C" });
  face(c, [[25, 13], [29, 10], [29, XF - 3], [25, XF]], "D", { lo: "E" });
  // The masu's folded front: two creases meeting under the seal.
  line(c, 5, 22, 14, XF - 1, "C");
  line(c, 24, 22, 15, XF - 1, "C");
  if (lid > 0) for (let x = 4; x <= 28; x++) put(c, x, 13 - lid, x < 25 ? "L" : "y");
  // The lid, lifted `lid` px: its top a square seen from above (the masu's pinwheel folds), its band, a gilt edge.
  const L = (pts: Pt[]) => pts.map(([x, y]) => [x, y - lid] as Pt);
  face(c, L([[3, 6], [26, 6], [30, 3], [8, 3]]), "A");
  face(c, L([[2, 7], [27, 7], [27, 13], [2, 13]]), "B", { hi: "A", lo: "C" });
  face(c, L([[27, 7], [31, 3], [31, 9], [27, 13]]), "C", { lo: "D" });
  line(c, 8, 3 - lid, 27, 7 - lid, "C");
  line(c, 26, 6 - lid, 30, 3 - lid, "B");
  gilt(c, [2, 13 - lid], [27, 13 - lid], { glint: 0.2 });
  gilt(c, [27, 13 - lid], [31, 9 - lid], { deep: true });
  // The seal across the seam: its top half on the lid's band, its bottom on the box (they part when the lid lifts).
  const S = ["vvvvvvv", "vvvAvvv", "vvAAAvv", "vvvAvvv", "vvAAAvv", "vAAAAAv", "vvvvvvw", ".vvvww."];
  S.forEach((row, j) => [...row].forEach((k, i) => k !== "." && put(c, 11 + i, 9 + j - (j < 4 ? lid : 0), k)));
  return c;
}
const CRATE_LID = [0, 0, 0, 0, 0, 1, 1, 0];
export const SHOP_FOLIO_CRATE = def("crate", [1, 1], XW, XH, [16, XF], CRATE_LID.map((l) => [whole(crateCv(l), true)]), 200);

// ==== The fountain (2 squares): a folded stone-paper basin (octagonal, its facets crisp, lit from the left), a stepped tower
// of folded paper in its middle, and its water: ribbons of paper and of ink pouring from the tower's top, arcing out, one
// looping on each side, falling into a pool that is rings of ink on cream. Idle: the ribbons flow (their stripes run down
// them), the rings spread. 8 frames at 120 ms.

const FW = 2 * T;
const FH = 92;
const FF = FH - 4;
/** A ribbon's path, from the tower's top out (dir -1 west, +1 east), arcing down into the basin, with a loop part way. */
function ribbonPath(dir: number, reach: number, loop: boolean, x0: number, y0: number): Pt[] {
  const pts: Pt[] = [];
  for (let t = 0; t <= 1.0001; t += 0.01) {
    let x = x0 + dir * reach * t;
    let y = y0 - 10 * t + 46 * t * t;
    if (loop && t > 0.32 && t < 0.62) {
      const u = (t - 0.32) / 0.3;
      x += dir * -Math.sin(u * 2 * Math.PI) * 5 * 0.5;
      y -= Math.sin(u * Math.PI) * 6 - (1 - Math.cos(u * 2 * Math.PI)) * 2;
    }
    pts.push([x, y]);
  }
  return pts;
}
interface Ribbon {
  pts: Pt[];
  lit: string;
  dark: string;
  under: string;
  ink?: boolean;
}
function fountainCv(f: number): Cv {
  const c = cv(FW, FH);
  const cx = 37;
  shadow(c, cx, FF, 35, 4);
  // The basin: rim ellipse (an octagon), three front facets, its lip.
  const rimY = 62;
  const oct = (rx: number, ry: number, y: number): Pt[] => Array.from({ length: 8 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 4 + Math.PI / 8), y + ry * Math.sin((i * Math.PI) / 4 + Math.PI / 8)] as Pt);
  const top = oct(34, 11, rimY);
  const bot = oct(30, 9, FF - 3);
  // Front facets (the octagon's lower half: indexes 0..3 run from the east, round the front, to the west).
  const facetKeys = ["4", "3", "2", "2"];
  for (let i = 0; i < 4; i++) face(c, [top[i]!, top[i + 1]!, bot[i + 1]!, bot[i]!], facetKeys[i]!, { lo: i === 0 ? "5" : undefined });
  for (let i = 0; i <= 4; i++) line(c, top[i]![0], top[i]![1], bot[i]![0], bot[i]![1], "4");
  // The rim and the pool inside it.
  face(c, top, "1");
  const inner = oct(30, 8.5, rimY);
  face(c, inner, (x, y) => {
    // Rings of ink on the cream "water", spreading from the tower's foot: radius grows with the frame.
    const d = Math.hypot((x + 0.5 - cx) / 3.4, (y + 0.5 - rimY) / 1);
    const ring = (d * 1.0 - f * 0.9) % 7;
    if (ring > 0 && ring < 1) return d > 6 ? "i" : "j";
    return y < rimY - 4 ? "C" : "B";
  });
  // The tower: three folded tiers, stepping in, lit on the left, gilt edges; a finial.
  const tier = (w: number, y0: number, h: number) => {
    face(c, [[cx - w, y0], [cx, y0 - 2], [cx, y0 + h - 2], [cx - w, y0 + h]], "B", { hi: "A" });
    face(c, [[cx, y0 - 2], [cx + w, y0], [cx + w, y0 + h], [cx, y0 + h - 2]], "C", { lo: "D" });
    gilt(c, [cx - w, y0], [cx, y0 - 2]);
    gilt(c, [cx, y0 - 2], [cx + w, y0], { deep: true });
  };
  tier(9, 52, 12);
  tier(7, 42, 10);
  tier(5, 34, 8);
  face(c, [[cx - 2, 33], [cx, 24], [cx + 2, 33]], "A", { lo: "C" });
  // The ribbons: two of paper (cream, a line of cursive down them), two of ink (blue), arcing out; one each side loops.
  const rib: Ribbon[] = [
    { pts: ribbonPath(-1, 26, true, cx - 2, 28), lit: "A", dark: "B", under: "C" },
    { pts: ribbonPath(1, 27, true, cx + 2, 28), lit: "B", dark: "b", under: "D" },
    { pts: ribbonPath(-1, 17, false, cx - 1, 30), lit: "u", dark: "U", under: "I", ink: true },
    { pts: ribbonPath(1, 16, false, cx + 1, 30), lit: "u", dark: "U", under: "I", ink: true },
  ];
  for (const r of rib) {
    let s = 0;
    for (let i = 0; i < r.pts.length; i++) {
      const [x, y] = r.pts[i]!;
      if (i > 0) s += Math.hypot(x - r.pts[i - 1]![0], y - r.pts[i - 1]![1]);
      if (y > rimY + 1) break;
      // A stripe running down the ribbon: its phase moves with the frame (the flow).
      const ph = (s - f * 2.5 + 400) % 8;
      const k = r.ink ? (ph < 4 ? r.lit : r.dark) : ph < 1 ? "i" : r.lit;
      put(c, x, y, k);
      put(c, x, y + 1, r.under);
    }
    // A splash where it lands: two little curls of the same ribbon.
    const end = r.pts.find((p) => p[1] > rimY - 1) ?? r.pts.at(-1)!;
    const up = f % 4 < 2 ? 1 : 0;
    put(c, end[0] - 1, end[1] - 1 - up, r.ink ? "u" : "A");
    put(c, end[0] + 1, end[1] - 2 + up, r.ink ? "U" : "B");
  }
  return c;
}
export const SHOP_FOLIO_FOUNTAIN = def("fountain", [2, 1], FW, FH, [37, FF], Array.from({ length: 8 }, (_, f) => [whole(fountainCv(f), true)]), 120);

// ==== Bonsai: folded paper on a low kraft stand: a stone-paper tray, an angular trunk of folded brown paper, pads of pleated
// green paper like little fans. The second has three tiny cranes perched in it, one fluttering its wings now and then.

const BW = T;
const BH = 70;
const BF = BH - 4;
function bonsaiCv(o: { cranes?: boolean; flutter?: number; seed: number }): Cv {
  const c = cv(BW, BH);
  shadow(c, 18, BF, 16, 3);
  // The stand.
  face(c, [[3, BF - 14], [33, BF - 14], [33, BF - 11], [3, BF - 11]], "8", { hi: "7", lo: "9" });
  rect(c, 5, BF - 11, 3, 11, "9");
  rect(c, 29, BF - 11, 3, 11, "0");
  rect(c, 5, BF - 11, 1, 11, "8");
  // The tray.
  face(c, [[8, BF - 21], [28, BF - 21], [27, BF - 15], [9, BF - 15]], "2", { hi: "1", lo: "4" });
  rect(c, 9, BF - 21, 19, 1, "1");
  // The trunk: angular folds.
  const trunk: Pt[] = o.cranes ? [[18, BF - 21], [14, BF - 30], [20, BF - 38], [16, BF - 46], [19, BF - 52]] : [[19, BF - 21], [16, BF - 29], [21, BF - 36], [17, BF - 44]];
  trunk.forEach((p, i) => {
    if (!i) return;
    const a = trunk[i - 1]!;
    const th = i < 2 ? 3 : i < 3 ? 2 : 1;
    for (let t = 0; t <= 1; t += 0.06) {
      const x = a[0] + (p[0] - a[0]) * t;
      const y = a[1] + (p[1] - a[1]) * t;
      for (let k = 0; k < th; k++) put(c, x + k, y, k === 0 ? "7" : k === th - 1 ? "9" : "8");
    }
  });
  // The pads: pleated fans (radiating pleats, lit and mid, a dark underside).
  const pad = (cx: number, cy: number, rx: number, ry: number) =>
    ellipse(c, cx, cy, rx, ry, (x, y) => {
      const yy = y + 0.5 - cy;
      if (yy > ry * 0.35) return "6";
      const a = Math.atan2(yy, x + 0.5 - cx);
      const pl = Math.floor((a + Math.PI) * 3.2);
      if (yy < -ry * 0.6) return "n";
      return pl % 2 ? "N" : "e";
    });
  if (o.cranes) {
    pad(9, BF - 34, 8, 5);
    pad(27, BF - 40, 8, 5);
    pad(15, BF - 50, 10, 5);
    pad(25, BF - 55, 6, 3);
    tinyCrane(c, 3, BF - 42, "p", "P");
    tinyCrane(c, 22, BF - 49, "y", "Y", true, (o.flutter ?? 0) as 0 | 1);
    tinyCrane(c, 12, BF - 59, "u", "U");
  } else {
    pad(10, BF - 30, 8, 4);
    pad(25, BF - 35, 8, 4);
    pad(17, BF - 45, 9, 5);
  }
  return c;
}
export const SHOP_FOLIO_BONSAI = def("bonsai", [1, 1], BW, BH, [18, BF], [[whole(bonsaiCv({ seed: 1 }), true)]]);
export const SHOP_FOLIO_BONSAI_CRANES = def("bonsai-cranes", [1, 1], BW, BH, [18, BF], [0, 0, 0, 0, 1, 0, 1, 0].map((fl) => [whole(bonsaiCv({ seed: 2, cranes: true, flutter: fl }), true)]), 260);

// ==== Strings of small paper cranes hanging from the ceiling (senbazuru), on ink-blue thread, a vermilion and gold tassel at
// the foot. They sway, more toward the foot; the two pieces are out of step and in a different order of colours.

const HC_H = 130;
const HC_COLORS = [["p", "P"], ["y", "Y"], ["u", "U"], ["q", "Q"], ["x", "X"], ["A", "C"]] as const;
function cranesCv(phase: number, order: number): Cv {
  const c = cv(T, HC_H);
  const sway = (y: number) => (y < 14 ? 0 : 2.6 * Math.sin(phase) * ((y - 14) / 64));
  for (let y = 0; y < 82; y++) put(c, 18 + sway(y), y, y < 14 ? "J" : "l");
  for (let i = 0; i < 7; i++) {
    const y = 18 + i * 8;
    const [lit, deep] = HC_COLORS[(i + order) % HC_COLORS.length]!;
    tinyCrane(c, 15 + sway(y + 2), y, lit, deep, i % 2 === 1);
  }
  // The tassel.
  const ty = 80;
  const tx = 18 + sway(ty);
  stamp(c, Math.round(tx) - 1, ty, ["GHG", "vvv", "vPv", "vvw", "w.w"]);
  return c;
}
const SWAY = [0, 0.8, 1.4, 1.6, 1.4, 0.8, 0, -0.8, -1.4, -1.6, -1.4, -0.8].map((a) => Math.asin(Math.max(-1, Math.min(1, a / 1.6))));
export const SHOP_FOLIO_CRANES = def("cranes", [1, 1], T, HC_H, [18, HC_H - 1], SWAY.map((ph) => [whole(cranesCv(ph, 0), true)]), 240);
export const SHOP_FOLIO_CRANES_B = def("cranes-b", [1, 1], T, HC_H, [18, HC_H - 1], SWAY.map((_, i) => [whole(cranesCv(SWAY[(i + 4) % SWAY.length]!, 3), true)]), 240);

// ==== Pages drifting upward in a corner, very slowly, like dust in light: a little pile of loose pages on the floor, and five
// pages rising from it, turning (a face, edge-on, the back), swaying; near the top each thins to an ink outline and is gone.
// 20 frames at 200 ms (4 s for one page to rise; five rise at once, out of step).

const DP_H = 130;
function pagesCv(f: number): Cv {
  const c = cv(T, DP_H);
  shadow(c, 18, DP_H - 3, 13, 2);
  // The pile.
  for (let j = 0; j < 4; j++) {
    const x = 9 + ((j * 5) % 7) - 2;
    face(c, [[x, DP_H - 6 - j * 2], [x + 14, DP_H - 7 - j * 2], [x + 15, DP_H - 4 - j * 2], [x + 1, DP_H - 3 - j * 2]], j % 2 ? "B" : "A", { lo: "C" });
  }
  for (let i = 0; i < 5; i++) {
    const p = (f / 20 + i / 5) % 1;
    const y = DP_H - 12 - p * 104;
    const x = 18 + 8 * Math.sin(2 * Math.PI * (p * 1.3 + i * 0.37));
    const turn = Math.cos(2 * Math.PI * (p * 1.7 + i * 0.21));
    const w = Math.max(1, Math.round(Math.abs(turn) * 5));
    const back = turn < 0;
    if (p > 0.93) continue;
    const ghost = p > 0.74;
    for (let yy = 0; yy < 4; yy++)
      for (let xx = -w; xx <= w; xx++) {
        const edge = yy === 0 || yy === 3 || Math.abs(xx) === w;
        const k = ghost ? (edge ? (p > 0.85 ? "K" : "J") : "a") : edge ? (back ? "f" : yy === 0 ? "A" : "C") : back ? "F" : yy === 1 && xx < 0 && xx % 2 === 0 ? "i" : "A";
        put(c, x + xx + (yy - 1.5) * turn * 0.4, y + yy, k);
      }
  }
  return c;
}
export const SHOP_FOLIO_PAGES = def("pages", [1, 1], T, DP_H, [18, DP_H - 3], Array.from({ length: 20 }, (_, f) => [whole(pagesCv(f), false)]), 200);

// ==== A folding screen (2 squares), standing as a room divider: four panels zigzag, lit and in shade, kraft frames, gilt
// along their tops, a line or two of cursive on each lit panel.

const SW = 2 * T;
const SH = 70;
const SF = SH - 4;
export const SHOP_FOLIO_SCREEN = (() => {
  const c = cv(SW, SH);
  shadow(c, SW / 2, SF, SW / 2, 3);
  for (let i = 0; i < 4; i++) {
    const x0 = 3 + i * 17;
    const x1 = x0 + 17;
    const lit = i % 2 === 0;
    const t0 = lit ? 8 : 11;
    const b0 = lit ? SF : SF - 2;
    const t1 = lit ? 11 : 8;
    const b1 = lit ? SF - 2 : SF;
    face(c, [[x0, t0], [x1, t1], [x1, b1], [x0, b0]], "9", { hi: "8", lo: "0" });
    face(c, [[x0 + 2, t0 + 3], [x1 - 2, t1 + 3], [x1 - 2, b1 - 5], [x0 + 2, b0 - 5]], lit ? "B" : "C", { hi: lit ? "A" : "b", lo: lit ? "b" : "D" });
    gilt(c, [x0, t0], [x1, t1], { glint: lit ? 0.3 : undefined, deep: !lit });
    paragraph(c, x0 + 3, x1 - 3, t0 + 14, 5, 6, lit ? "i" : "l", 30 + i, (x, y) => get(c, x, y) === (lit ? "B" : "C"));
  }
  return def("screen", [2, 1], SW, SH, [37, SF], [[whole(c, true)]]);
})();

// ==== A low writing desk (2 squares): dark folded kraft, its top seen from above: a sheet of paper half written, an inkstone
// with wet ink in its well, a brush on a rest, Folio's seal block.

const DW = 2 * T;
const DH = 44;
const DF = DH - 3;
export const SHOP_FOLIO_DESK = (() => {
  const c = cv(DW, DH);
  shadow(c, DW / 2, DF, DW / 2, 3);
  // The top (a parallelogram seen from above), its front apron, legs.
  face(c, [[6, 17], [DW - 4, 17], [DW - 2, 27], [4, 27]], "9", { hi: "8", lo: "0" });
  face(c, [[4, 28], [DW - 2, 28], [DW - 2, 31], [4, 31]], "0");
  rect(c, 6, 31, 3, 9, "9");
  rect(c, DW - 8, 31, 3, 9, "0");
  rect(c, 6, 31, 1, 9, "8");
  // The sheet: cream paper with cursive.
  face(c, [[10, 18], [32, 18], [33, 26], [9, 26]], "A", { lo: "C" });
  for (let j = 0; j < 3; j++) cursive(c, 12, 21 + j * 2, 16 - j * 3, "i", 40 + j);
  // The inkstone: a dark slab, its well, wet ink with a glint.
  face(c, [[38, 18], [52, 18], [53, 25], [37, 25]], "S", { hi: "t", lo: "s" });
  face(c, [[40, 19], [50, 19], [50, 21], [40, 21]], "T");
  put(c, 42, 19, "t");
  // The brush: a kraft handle on a little rest, its black tip.
  rect(c, 56, 24, 3, 2, "S");
  line(c, 54, 23, 66, 19, "7");
  line(c, 54, 24, 66, 20, "8");
  put(c, 67, 19, "T");
  put(c, 68, 19, "T");
  put(c, 53, 24, "s");
  // The seal block: a little vermilion cube.
  rect(c, 34, 22, 3, 3, "v");
  put(c, 36, 24, "w");
  return def("desk", [2, 1], DW, DH, [37, DF], [[whole(c, true)]]);
})();

// ==== Drawn only in ink on blank cream (the edges of the page): a pillar, a bench, a stone lantern. Their fill is the blank
// page and their lines the sketch line; some lines left unfinished. The lantern's roof writes itself in on a loop, holds,
// fades back into the paper, and rests unwritten (16 frames at 180 ms; `-b` out of step).

const SP_H = 150;
export const SHOP_FOLIO_SKETCH_PILLAR = (() => {
  const c = cv(T, SP_H);
  face(c, [[6, 8], [30, 8], [30, 17], [27, 17], [27, SP_H - 12], [30, SP_H - 12], [30, SP_H - 2], [6, SP_H - 2], [6, SP_H - 12], [9, SP_H - 12], [9, 17], [6, 17]], "a");
  inkLine(c, [6, 8], [30, 8], "I", { seed: 1, over: 1 });
  inkLine(c, [6, 8], [6, 17], "I", { seed: 2 });
  inkLine(c, [30, 8], [30, 17], "J", { seed: 3 });
  inkLine(c, [6, 17], [30, 17], "J", { seed: 4, gaps: 0.1 });
  inkLine(c, [9, 17], [9, SP_H - 30], "I", { seed: 5, gaps: 0.04 });
  inkLine(c, [27, 17], [27, SP_H - 12], "J", { seed: 6, gaps: 0.08 });
  inkLine(c, [6, SP_H - 12], [30, SP_H - 12], "J", { seed: 7, gaps: 0.1 });
  inkLine(c, [6, SP_H - 2], [30, SP_H - 2], "I", { seed: 8, over: 1 });
  inkLine(c, [6, SP_H - 12], [6, SP_H - 2], "J", { seed: 9 });
  inkLine(c, [30, SP_H - 12], [30, SP_H - 2], "J", { seed: 10 });
  for (let y = 24; y < 96; y += 4) inkLine(c, [22, y + 3], [26, y - 1], "K", { seed: y, wobble: 0.2 });
  return def("sketch-pillar", [1, 1], T, SP_H, [18, SP_H - 2], [[whole(c, false)]]);
})();
const SB_W = 2 * T;
const SB_H = 40;
export const SHOP_FOLIO_SKETCH_BENCH = (() => {
  const c = cv(SB_W, SB_H);
  const F = SB_H - 3;
  face(c, [[8, 18], [66, 18], [70, 22], [70, 26], [12, 26], [8, 22]], "a");
  face(c, [[12, 26], [16, 26], [16, F], [12, F]], "a");
  face(c, [[60, 26], [64, 26], [64, F], [60, F]], "a");
  inkPath(c, [[8, 18], [66, 18], [70, 22], [12, 22], [8, 18]], "I", { seed: 3 });
  inkLine(c, [12, 22], [12, 26], "J", { seed: 4 });
  inkLine(c, [70, 22], [70, 26], "J", { seed: 5 });
  inkLine(c, [12, 26], [70, 26], "J", { seed: 6, gaps: 0.08 });
  inkPath(c, [[12, 26], [12, F], [16, F], [16, 26]], "J", { seed: 7 });
  inkPath(c, [[60, 26], [60, F], [64, F]], "J", { seed: 8 });
  for (let x = 20; x < 50; x += 4) inkLine(c, [x, 25], [x + 3, 23], "K", { seed: x, wobble: 0.1 });
  return def("sketch-bench", [2, 1], SB_W, SB_H, [37, F], [[whole(c, false)]]);
})();
const SL_H = 76;
function lanternCv(upTo: number, ink: string): Cv {
  const c = cv(T, SL_H);
  const F = SL_H - 3;
  // The blank shapes (base, post, firebox, finial) and their lines.
  const base: Pt[] = [[6, F - 8], [30, F - 8], [30, F], [6, F]];
  const post: Pt[] = [[14, F - 26], [22, F - 26], [22, F - 8], [14, F - 8]];
  const box: Pt[] = [[9, F - 42], [27, F - 42], [27, F - 26], [9, F - 26]];
  for (const p of [base, post, box]) face(c, p, "a");
  inkPath(c, [...base, base[0]!], "I", { seed: 1, gaps: 0.04 });
  inkPath(c, [post[0]!, post[3]!], "I", { seed: 2 });
  inkPath(c, [post[1]!, post[2]!], "J", { seed: 3 });
  inkPath(c, [...box, box[0]!], "I", { seed: 4, gaps: 0.05 });
  // Its window, and the light drawn as a few rays.
  inkPath(c, [[14, F - 38], [22, F - 38], [22, F - 30], [14, F - 30], [14, F - 38]], "J", { seed: 5 });
  inkLine(c, [18, F - 36], [18, F - 32], "K", { seed: 6 });
  // The roof: a wide cap with upturned eaves and a finial (the line being written).
  if (upTo > 0) {
    const roof: Pt[] = [[2, F - 46], [6, F - 44], [12, F - 50], [18, F - 54], [24, F - 50], [30, F - 44], [34, F - 46]];
    if (upTo >= 1) face(c, [[6, F - 44], [12, F - 50], [18, F - 54], [24, F - 50], [30, F - 44], [27, F - 42], [9, F - 42]], "a");
    inkPath(c, roof, ink, { seed: 7, upTo, pen: upTo < 1 ? "I" : undefined });
    if (upTo >= 1) {
      inkPath(c, [[16, F - 54], [16, F - 60], [18, F - 63], [20, F - 60], [20, F - 54]], ink, { seed: 8 });
    }
  }
  return c;
}
const LT_UP = [0.12, 0.3, 0.5, 0.7, 0.88, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0];
const LT_INK = ["I", "I", "I", "I", "I", "I", "I", "I", "I", "I", "J", "K", "r", "r", "I", "I"];
export const SHOP_FOLIO_SKETCH_LANTERN = def("sketch-lantern", [1, 1], T, SL_H, [18, SL_H - 3], LT_UP.map((u, i) => [whole(lanternCv(u, LT_INK[i]!), false)]), 180);
export const SHOP_FOLIO_SKETCH_LANTERN_B = def("sketch-lantern-b", [1, 1], T, SL_H, [18, SL_H - 3], LT_UP.map((_, i) => [whole(lanternCv(LT_UP[(i + 7) % 16]!, LT_INK[(i + 7) % 16]!), false)]), 180);

// ==== The lights, each on its piece (`piece`; x, y in its own pixels). Repeated pieces (the windows) light at every place
// they stand; a flipped placement mirrors x.

/** The tissue's colours as light (rose, gold, blue, jade, violet), and the moon window's gold. */
const GLOW: Record<string, string> = { p: "#ffb4a2", y: "#ffe08a", u: "#a8c4ff", q: "#a8f0c0", x: "#d8b8ff" };
const MOON_GOLD = "#ffe39a";
const windowSpots = (piece: string, set: readonly (readonly [string, string])[]) =>
  set.map(([lit, deep]) => ({ piece, x: WIN.x0, y: WIN.y0, w: WIN.x1 - WIN.x0 + 1, h: WIN.y1 - WIN.y0 + 1, keys: lit + deep, color: GLOW[lit]!, strength: 0.55, halo: 22 }));
/** The windows' panes (each colour its own light, so each halo is its colour) and the backdrop's moon window. */
export const SHOP_FOLIO_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  ...windowSpots("window", GLASS_A),
  ...windowSpots("window-b", GLASS_B),
  { piece: "backdrop", x: MOON.x - MOON.r, y: MOON.y - MOON.r, w: 2 * MOON.r + 1, h: 2 * MOON.r + 1, keys: "LyY", color: MOON_GOLD, strength: 0.7, halo: 30 },
];
/**
 * A pool's slow drift as the "sun" moves: its middle swings `dx`, `dy` px either way (a sine) over `ms`, starting at `phase`
 * (0 to 1) of the loop. Every window's pools share one sun, so they drift together (the phase differs by colour a hair).
 */
export interface PoolDrift {
  dx: number;
  dy: number;
  ms: number;
  phase: number;
}
/**
 * The coloured pools each window throws on the floor (a west-wall window, unflipped, throws them east into the room; the
 * east wall's, flipped, west), its three colours in a slanting line; and the moon window's soft gold before the counter.
 */
const windowPools = (piece: string, set: readonly (readonly [string, string])[]) =>
  set.map(([lit], i) => ({ piece, x: 58 + i * 21, y: WALL_H + 4 + i * 5, rx: 19, ry: 8, color: GLOW[lit]!, strength: 0.3, drift: { dx: 9, dy: 4, ms: 40000, phase: i * 0.04 } as PoolDrift }));
export const SHOP_FOLIO_POOLS: readonly (LightPool & { piece: string; drift?: PoolDrift })[] = [
  ...windowPools("window", GLASS_A),
  ...windowPools("window-b", GLASS_B),
  { piece: "backdrop", x: BDW / 2, y: BDH + 10, rx: 46, ry: 10, color: MOON_GOLD, strength: 0.16 },
];

// ==== The layout.

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
  /** Squares deep, for the deep pieces, from `row` north. */
  d?: number;
  /** The way out (the entrance): walking into it leaves the shop. */
  exit?: boolean;
}
const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) throw new Error(`no piece ${name}`);
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};

/**
 * How written a square is: 0 at the middle of the page (the clean page's middle, 10, 11 in squares), rising to about 1 at
 * the side walls and the front, past 1 at the back (the back fades sooner); a little uneven square to square, so the
 * written part reaches out here and stops short there. The shop round the counter is written (lowered).
 */
export function unwritten(col: number, row: number): number {
  const cx = col + 0.5 - 10;
  const cy = row + 0.5 - 11;
  let d = Math.max(Math.abs(cx) / 9, Math.abs(cy) / 9.2) + (hash(col, row, 5) - 0.5) * 0.14;
  if (col >= 7 && col <= 12 && row >= 1 && row <= 4) d -= 0.25;
  return d;
}
/** Below this the floor is folded (written); below `SKETCH`, sketched; above, ruled blank (the back row unruled). */
export const WRITTEN = 0.66;
export const SKETCH = 0.82;
const WRITING = new Set(["6,7", "12,6", "5,10", "14,9", "8,15", "11,5", "13,14", "6,12"]);
for (let row = 0; row < 20; row++)
  for (let col = 0; col < 20; col++) {
    const k = `${col},${row}`;
    const turn = (col + row) % 2 === 1;
    const d = unwritten(col, row);
    if (PAGE.has(k)) at(`page-${col}-${row}`, col, row, false);
    else if (col === 1) at("floor-margin", col, row, false);
    else if (col === 0 || col === 19 || row === 0 || row === 19) at("floor-ruled", col, row, false);
    else if (d < WRITTEN) at(WRITING.has(k) ? (turn ? "floor-d" : "floor-c") : turn ? "floor-b" : "floor-a", col, row, false);
    else if (d < SKETCH) at(d > 0.75 ? (turn ? "floor-sketch-d" : "floor-sketch-c") : turn ? "floor-sketch-b" : "floor-sketch", col, row, false);
    else if (row === 1 && d > 0.95) at("floor-blank", col, row, false);
    else at(hash(col, row, 8) < 0.2 ? "floor-ruled-b" : "floor-ruled", col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The back wall (row 0): blank sheets, the sketched lattice and pillar nearer the backdrop, two lines writing themselves.
const BACK: Record<number, string> = { 5: "wall-pillar-sketch", 6: "wall-sketch", 7: "wall-writing", 12: "wall-writing-b", 13: "wall-sketch", 14: "wall-pillar-sketch" };
for (let col = 0; col < 20; col++) {
  if (col >= 8 && col <= 11) {
    if (col === 8) at("backdrop", 8, 0, true);
    continue;
  }
  at(BACK[col] ?? (col % 2 ? "wall" : "wall-b"), col, 0, true, col >= 12 ? { flip: true } : {});
}
// -- The side walls: sketched toward the back and front, folded shoji and stained glass in the middle.
const SIDE = ["", "side-blank", "side-sketch-b", "side-sketch", "side-sketch", "side-shoji", "window", "side-shoji", "window-b", "side-shoji", "window", "side-shoji", "window-b", "side-shoji", "side-sketch", "side-sketch", "side-sketch-b", "side-blank", "side-blank"];
const SIDE_E = SIDE.map((n) => (n === "window" ? "window-b" : n === "window-b" ? "window" : n));
for (let row = 1; row < 19; row++) {
  at(SIDE[row]!, 0, row, true);
  at(SIDE_E[row]!, 19, row, true, { flip: true });
}
// -- The front: the low blank band, and the way out in its middle.
for (let col = 0; col < 20; col++) if (col !== 9 && col !== 10) at("hem", col, 19, true, col >= 10 ? { flip: true } : {});
at("entrance", 9, 19, false, { exit: true });

// -- The shop and the sanctuary.
at("counter", 8, 3, true);
at("crate", 8, 3, false); // on the counter (see SHOP_FOLIO_CRATE_AT): its place is the counter's
at("desk", 4, 5, true);
at("fountain", 4, 9, true);
at("bonsai-cranes", 15, 8, true);
at("bonsai", 16, 11, true);
at("bonsai", 4, 13, true);
at("screen", 4, 15, true);
at("screen", 14, 15, true);
at("cranes", 6, 6, false);
at("cranes-b", 13, 6, false);
at("cranes-b", 5, 11, false);
at("cranes", 14, 12, false);
// -- The edges, drawn only in ink.
at("sketch-pillar", 6, 2, true);
at("sketch-pillar", 13, 2, true);
at("sketch-lantern", 2, 3, true);
at("sketch-lantern-b", 17, 16, true);
at("sketch-bench", 14, 2, true);
at("pages", 17, 2, false);

/** Where every piece goes: name, column (its west-most square), row, solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_FOLIO_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

// ==== The room still: the floor flat on its squares, each upright piece stood at its foot, north first.

const TOP = 150;
const RW = 20 * T;
const RH = TOP + 20 * T + 4;
const roomParts: Record<string, Part> = {};
const partName = new Map<Part, string>();
const nameOf = (p: Part) => {
  let n = partName.get(p);
  if (!n) {
    n = `r${partName.size}`;
    partName.set(p, n);
    roomParts[n] = p;
  }
  return n;
};
function placed(p: Piece, f: number, fx: number, fy: number, flip = false): Layer[] {
  const footX = flip ? p.w - 1 - p.foot[0] : p.foot[0];
  return p.frames[f % p.frames.length]!.map((b) => {
    const pw = Math.max(...b.part.grid.map((r) => r.length));
    const x = flip ? p.w - b.at[0] - pw : b.at[0];
    return { part: nameOf(b.part), x: fx - footX + x, y: fy - p.foot[1] + b.at[1], ...(flip ? { flipX: true } : {}) };
  });
}
const footOf = (pl: ShopPlace): Pt => {
  const p = PIECES[pl.name]!;
  if (pl.name === "crate") {
    const cp = PIECES["counter"]!;
    const [cx, cy] = footOf({ name: "counter", col: pl.col, row: pl.row, solid: true });
    return [cx - cp.foot[0] + SHOP_FOLIO_CRATE_AT[0], cy - cp.foot[1] + SHOP_FOLIO_CRATE_AT[1]];
  }
  return [pl.col * T + Math.floor((p.sq[0] * T) / 2), TOP + pl.row * T + 18];
};
const roomFrame = (f: number): Frame => {
  const layers: Layer[] = [];
  for (const pl of SHOP_FOLIO_LAYOUT) {
    const p = PIECES[pl.name]!;
    const [fx, fy] = footOf(pl);
    layers.push(...placed(p, f, fx, fy, pl.flip));
  }
  return { ms: 120, layers };
};
const anims: Record<string, Anim> = { idle: { loop: true, frames: [roomFrame(0)] } };
/** (For review: the room with every piece's idle running.) */
anims["room-live"] = { loop: true, frames: Array.from({ length: 20 }, (_, f) => roomFrame(f)) };
/** Each piece alone, for review, blown up (up to 4x); a floor tile three by three. */
for (const p of Object.values(PIECES)) {
  if (p.name.startsWith("page-")) continue;
  const ch = toChar(p);
  const flatTile = p.w === T && p.h === T;
  const [rx, ry] = flatTile ? [3, 3] : [1, 1];
  const z = Math.max(1, Math.min(4, Math.floor((RW - 8) / (p.w * rx)), Math.floor((RH - 8) / (p.h * ry))));
  const frames = ch.anims.idle!.frames.map((fr, f) => {
    const keys = frameKeys(ch, fr);
    const grid = Array.from({ length: p.h * ry * z }, (_, y) => Array.from({ length: p.w * rx * z }, (_, x) => keys[Math.floor(y / z) % p.h]![Math.floor(x / z) % p.w] ?? ".").join(""));
    const n = `zoom-${p.name}-${f}`;
    roomParts[n] = { grid, outline: false };
    return { ms: p.ms, layers: [{ part: n, x: 4, y: 4 }] };
  });
  anims[p.name] = { loop: true, frames };
}

/** Every piece by its name (as SHOP_FOLIO_LAYOUT names them), each its own Character `shop-folio-<name>`. */
export const SHOP_FOLIO_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export const HOUSE_SHOP_FOLIO: Character = { id: "house-shop-folio", name: "Folio's sanctuary", w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts: roomParts, anims };

export type { LightPool, LightSpot };
