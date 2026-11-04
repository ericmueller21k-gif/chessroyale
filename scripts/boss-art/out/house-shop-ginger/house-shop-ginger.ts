/**
 * Inside Ginger Igloo: Ginger's shop (house-shop-ginger), a candy shop inside his igloo run by elves (Eric's design, Nov 5). A
 * room of 20 x 20 squares seen as the town square is seen (the camera looks north, things stand upright at their foot, 37 px a
 * square), with a floor mask (SHOP_GINGER_FLOOR, as Hollow's cave): a round floor 10 squares across, centred on the grid, packed
 * snow, and a short entry tunnel from the front. Curved ice-block walls stand round it (the dome's inside). Drawn by hand (Nov 5,
 * weekly plan usage), built as Jefferson's warehouse is (out/house-shop-grex).
 *
 * The back wall, left and right of the shopkeeper, is lined with candy dispensers like Eric's photo, curving with the wall: a
 * lower row of gravity-bin dispensers (clear bins, striped lids, handles, chutes, candy of every color) and an upper row of tall
 * clear tubes of candy. A wooden catwalk runs along the curve above the lower row, so the elves can reach the upper row, with a
 * little curved staircase at each end from the floor up to it (a second walking level: SHOP_GINGER_UPPER, SHOP_GINGER_STAIRS).
 * At the back middle, under a CANDY sign on the catwalk's rail, the shopkeeper elf stands behind a small half-round stand with
 * Ginger's Boss Crate on it (a present-like crate in candy stripes); the stockroom door is beside him under the catwalk. Barrels of
 * loose candy and barrels stuffed with big candy canes stand round; the sides and the near walls are lighter (frost, icicles, an
 * ice lantern, a sack or two). In the middle, the battle spot: glossy ice (the intro's ice shard cracks it), his mark (a
 * peppermint) on the west, yours (a snowflake) on the east.
 *
 * Footing: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on the middle of its row).
 * Floor tiles are flat, top-down, 37 x 37, foot at their middle; the battle spot's tiles are each drawn where they lie.
 */
import { frameKeys, type Anim, type Character, type Frame, type Layer, type Part } from "../../../../packages/app/src/characters/sprite.ts";
import type { LightPool, LightSpot } from "../../../../packages/app/src/town/houses/kit.ts";
import { barrel, bossCrate, bulbs, CANDY_PALETTE, candyAt, candyTube, caneOn, cv, gravityBin, hash, heap, iceBlock, icicles, MIXES, put, rect, sack, text, textWidth, whole, bit, type Bit, type Cv, type Key, type Mix, type Pt } from "./candy-kit.ts";

const PALETTE: Record<string, string> = { ...CANDY_PALETTE };

const T = 37;
const N = 20;
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
  const frames: Frame[] = p.frames.map((bs, f) => ({
    ms: p.ms,
    layers: bs.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-ginger-${p.name}`, name: `Ginger's igloo: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): Character {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
  return toChar(PIECES[name]!);
}

// ==== The floor's shape: 20 rows of 20, `.` floor, `#` ice (the dome's wall and the snow round it).

/** The round floor's middle (squares) and radius: a square is floor when its middle is under 5 squares from (9.5, 9.5). */
const MID = 9.5;
const RAD = 5;
const inCircle = (c: number, r: number) => (c - MID) ** 2 + (r - MID) ** 2 < RAD * RAD;
/** The entry tunnel: columns 9-10, rows 15-17; the way out (the igloo's doorway) at row 18, columns 9-10. */
const inTunnel = (c: number, r: number) => (c === 9 || c === 10) && r >= 15 && r <= 18;
/**
 * The walkable floor: a circle 10 squares across (columns 5-14, rows 5-14), its rows 8-11 columns 5-14, rows 6-7 and 12-13
 * columns 6-13, rows 5 and 14 columns 8-11; the tunnel (columns 9-10, rows 15-17) and the way out (row 18). Every `#` is ice.
 */
export const SHOP_GINGER_FLOOR: readonly string[] = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (inCircle(c, r) || inTunnel(c, r) ? "." : "#")).join(""));
const isOpen = (c: number, r: number) => SHOP_GINGER_FLOOR[r]?.[c] === ".";

// ==== The floor: packed snow (soft wind ripples, sparkles, a few boot prints), the dome's ice round it.

function snow(gx: number, gy: number, seed = 1): string {
  const s = hash(gx, gy, seed);
  if (s > 0.985) return "5";
  if (s < 0.025) return "2";
  // Soft ripples: long low swells across the floor (room pixels, so the tiles join).
  const v = Math.sin(gx * 0.11 + Math.sin(gy * 0.07) * 2.2) + Math.sin(gy * 0.19 + gx * 0.03) * 0.7;
  const patch = hash(Math.floor(gx / 11), Math.floor(gy / 8), seed + 3);
  if (v > 1.15) return "4";
  if (v < -1.2) return "2";
  return patch < 0.15 ? "4" : "3";
}
function tileDef(name: string, fn: (x: number, y: number) => Key): Character {
  const c = cv(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = fn(x, y) ?? ".";
  return def(name, [1, 1], T, T, [18, 18], [[whole(c)]]);
}
/** A boot print (an elf's little curly-toed boot), its heel at (hx, hy), pointing up (north). */
function bootPrint(x: number, y: number, hx: number, hy: number): boolean {
  const dx = x - hx;
  const dy = y - hy;
  const heel = dx * dx + (dy + 1) ** 2 <= 2.2;
  const sole = Math.abs(dx - (dy < -4 ? 1 : 0)) <= 1 && dy <= -2 && dy >= -6;
  return heel || sole;
}
// The plain floor tiles take the room's pixels from their square, so the ripples run on across them: one tile per square.
const snowTile = (col: number, row: number, seed: number, more?: (x: number, y: number) => Key) =>
  tileDef(`floor-${col}-${row}`, (x, y) => more?.(x, y) ?? snow(col * T + x, row * T + y, seed));
/** The dome's ice round the floor, seen from above: blocks of packed snow, darker, frosted. */
const deep = (gx: number, gy: number) => {
  const v = Math.sin(gx * 0.07 + Math.sin(gy * 0.05) * 2) + Math.sin(gy * 0.09 - gx * 0.02) * 0.8;
  if (hash(gx, gy, 5) < 0.02) return "b";
  return v > 1.1 ? "b" : v < -1.3 ? "A" : "a";
};
/** Outside, by the doorway: night snow, bluish. */
const nightSnow = (gx: number, gy: number) => (hash(gx, gy, 9) < 0.03 ? "*" : hash(gx >> 2, gy >> 2, 8) < 0.3 ? "b" : "B");

// -- The battle spot: glossy ice, a frosted rim, his mark (a peppermint) and yours (a snowflake).

const CX = 10 * T + 18.5; // its middle in the room's floor pixels: (10, 10.5), the table's spot
const CY = 10.5 * T + 18.5;
const ZX = 104; // its half-width and half-depth (an ellipse)
const ZY = 78;
const zoneD = (gx: number, gy: number) => Math.hypot((gx + 0.5 - CX) / ZX, (gy + 0.5 - CY) / ZY) - 1;
/** His mark (west) and yours (east), in squares: the table stands halfway between them, at (10, 10.5). */
export const SHOP_GINGER_MARKS = { boss: [8.5, 10.5], you: [11.5, 10.5] } as const;
const markPx = (m: readonly number[]): Pt => [m[0]! * T + 18.5, m[1]! * T + 18.5];
/** The marks' size: 26 px across. */
export const SHOP_GINGER_MARK = 26;
/** His mark: a big peppermint, red pinwheel on white, a dark red rim. */
function mintMark(dx: number, dy: number): Key {
  const r = Math.hypot(dx, dy);
  const R = SHOP_GINGER_MARK / 2;
  if (r > R) return null;
  if (r > R - 1.2) return "R";
  if (r < 2.2) return "x";
  const a = Math.atan2(dy, dx) + r * 0.13;
  const on = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 2 === 0;
  return on ? (dx + dy > 4 ? "R" : "r") : dx + dy > 6 ? "X" : "x";
}
/** Your mark: a blue disk with a white snowflake on it, a dark blue rim. */
function flakeMark(dx: number, dy: number): Key {
  const r = Math.hypot(dx, dy);
  const R = SHOP_GINGER_MARK / 2;
  if (r > R) return null;
  if (r > R - 1.2) return "T";
  // Six arms (every 60 degrees), each with two little side twigs.
  const a = Math.atan2(dy, dx);
  for (let i = 0; i < 6; i++) {
    const t = (i * Math.PI) / 3 + Math.PI / 6;
    const ax = Math.cos(t);
    const ay = Math.sin(t);
    const along = dx * ax + dy * ay;
    const off = Math.abs(-dx * ay + dy * ax);
    if (along > 0 && along < R - 3 && off < 0.8) return "x";
    for (const s of [4.5, 7]) {
      const bx = dx - ax * s;
      const by = dy - ay * s;
      for (const sg of [1, -1]) {
        const t2 = t + (sg * Math.PI) / 3;
        const al = bx * Math.cos(t2) + by * Math.sin(t2);
        const of2 = Math.abs(-bx * Math.sin(t2) + by * Math.cos(t2));
        if (al > 0 && al < (s === 4.5 ? 3 : 2.2) && of2 < 0.7) return "x";
      }
    }
  }
  void a;
  if (r < 1.5) return "x";
  return dx + dy > 5 ? "T" : "t";
}
function zoneKey(gx: number, gy: number): Key {
  const d = zoneD(gx, gy);
  if (d > 0.04) return null;
  for (const [m, fn] of [[SHOP_GINGER_MARKS.boss, mintMark], [SHOP_GINGER_MARKS.you, flakeMark]] as const) {
    const [mx, my] = markPx(m);
    const k = fn(gx + 0.5 - mx, gy + 0.5 - my);
    if (k) return k;
  }
  // The frosted rim: snow drifting onto the ice's edge.
  if (d > -0.02) return hash(gx, gy, 51) < 0.5 ? "4" : "5";
  if (d > -0.06) return hash(gx, gy, 52) < 0.35 ? "8" : "4";
  // The ice: glossy blue, long diagonal shine streaks, darker swirls under it, skate scratches.
  const shine = Math.sin((gx - gy * 0.6) * 0.09) + Math.sin((gx + gy) * 0.031) * 0.6;
  const deepIce = Math.sin(gx * 0.05 + gy * 0.08) + Math.sin(gy * 0.13 - gx * 0.02);
  const scratch = Math.abs(Math.sin(gx * 0.045 + gy * 0.012) * 40 - (gy - CY)) < 0.5 && hash(gx >> 3, 0, 53) < 0.6;
  if (scratch) return "8";
  if (shine > 1.35) return hash(gx, gy, 54) < 0.2 ? "9" : "8";
  if (deepIce < -1.2) return "6";
  if (hash(gx, gy, 55) < 0.012) return "9";
  return d < -0.5 && deepIce < -0.6 ? "6" : "7";
}
/** The battle spot's tiles: each square the ice touches, drawn where it lies (`circle-<col>-<row>`). */
const CIRCLE = new Set<string>();
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    let any = false;
    for (let y = 0; y < T && !any; y += 3) for (let x = 0; x < T && !any; x += 3) any = zoneKey(col * T + x, row * T + y) !== null;
    if (!any) continue;
    CIRCLE.add(`${col},${row}`);
    tileDef(`circle-${col}-${row}`, (x, y) => zoneKey(col * T + x, row * T + y) ?? snow(col * T + x, row * T + y, 1));
  }

// ==== The back wall: the dispenser bays and the catwalk (37 x 150 cards, one a square, round the curve).

/** The heights over a card's foot (px). */
const H = 150;
const F = H - 1; // the foot's row in a card's picture
const yOf = (h: number) => F - h;
/** The catwalk's deck: its top (where a figure's feet stand) is 40 px over the floor. */
export const SHOP_GINGER_DECK_H = 40;
const DECK = { top: 38, face: 33 } as const; // the deck's lit top (seen from a little above) from 38 to 41, its plank face 33 to 37
const BIN = { y: yOf(32), h: 18, w: 15, xs: [2, 20] } as const; // the bins: 15 x 18, their tops 32 px up; their chutes' feet 11 px up
const TUBE = { y: yOf(103), h: 47, w: 9, xs: [2, 14, 26] } as const; // the tubes: 9 wide, from 103 px up to 57; their spouts' feet 53 px up
const LEDGE = { top: 52, foot: 42 } as const; // the tubes' shelf behind the deck
const RIM = { top: 109, foot: 104 } as const; // the top shelf over the tubes
/** A dispenser's chute foot (px over the foot of its card) and its middle (px across the card), per row: where the candy comes out. */
export const SHOP_GINGER_CHUTES = {
  lower: { h: 11, x: BIN.xs.map((x) => x + Math.floor(BIN.w / 2)) },
  upper: { h: 53, x: TUBE.xs.map((x) => x + Math.floor(TUBE.w / 2)) },
} as const;

/** The dome's ice over the bays and behind the stairs: blocks in courses, frost, and icicles at a lip. */
function iceFace(c: Cv, x0: number, y0: number, w: number, h: number, gx: number, seed: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(c, x, y, iceBlock(gx + x, y, 10, 16, seed));
}
/** The cabinet's wood behind the bins: a dark board frame, posts at the card's edges (shared with the next card). */
function cabinet(c: Cv, seed: number) {
  for (let y = yOf(DECK.face - 1); y <= F; y++)
    for (let x = 0; x < T; x++) {
      const post = x === 0 || x === T - 1 || x === 18;
      const kick = y > F - 5;
      if (kick) put(c, x, y, y === F - 4 ? "U" : Math.floor((x + y) / 3) % 2 ? "r" : "x"); // a candy-striped kick plate
      else put(c, x, y, post ? (x === 18 ? "u" : "w") : hash(x, y >> 2, seed) < 0.15 ? "w" : "V");
    }
}
/** The catwalk across a card: its plank face (a string of warm bulbs along it) and its lit top, a shadow line at its back. */
function deck(c: Cv, seed: number, lit = true) {
  for (let x = 0; x < T; x++) {
    for (let h = DECK.face; h < DECK.top; h++) put(c, x, yOf(h), h === DECK.face ? "w" : h === DECK.top - 1 ? "v" : (x + seed * 5) % 13 === 0 ? "w" : "u");
    for (let h = DECK.top; h <= DECK.top + 3; h++) put(c, x, yOf(h), h === DECK.top + 3 ? "w" : (x + seed * 3) % 9 === 0 ? "U" : h === DECK.top ? "U" : "v");
  }
  bulbs(c, 0, T - 1, yOf(DECK.face + 3), 12, seed, lit);
}
/** The tubes' shelf behind the deck and the top shelf over them, both wood; candy-striped trim on the top one. */
function shelves(c: Cv) {
  for (let x = 0; x < T; x++) {
    for (let h = LEDGE.foot; h <= LEDGE.top; h++) put(c, x, yOf(h), h === LEDGE.top ? "U" : h === LEDGE.top - 1 ? "u" : "w");
    for (let h = LEDGE.top + 1; h < RIM.foot; h++) put(c, x, yOf(h), x === 0 || x === T - 1 ? "w" : "V"); // dark behind the tubes
    for (let h = RIM.foot; h <= RIM.top; h++) put(c, x, yOf(h), h === RIM.top ? "v" : h === RIM.foot ? "w" : h === RIM.foot + 1 ? (Math.floor(x / 3) % 2 ? "x" : "r") : "u");
  }
}
type BayOpts = { bins?: readonly [Mix, Mix] | null; lids?: string; tubes?: readonly (Mix | null)[] | null; lower?: "door" | "door-open" | "jars"; upper?: "sign-w" | "sign-e"; post?: boolean };
function bayCard(seed: number, o: BayOpts): Cv {
  const c = cv(T, H);
  iceFace(c, 0, 0, T, yOf(RIM.top) + 1, seed * T, seed);
  shelves(c);
  cabinet(c, seed);
  // Lower row.
  if (o.bins) o.bins.forEach((m, i) => gravityBin(c, BIN.xs[i]!, BIN.y, BIN.w, BIN.h, m, seed * 7 + i, (o.lids ?? "rtgp")[(seed + i) % (o.lids ?? "rtgp").length]!, hash(seed, i, 3) < 0.3 ? 2 : 0));
  if (o.lower === "door" || o.lower === "door-open") door(c, o.lower === "door-open");
  if (o.lower === "jars") jars(c, seed);
  // Upper row.
  if (o.tubes) o.tubes.forEach((m, i) => m && candyTube(c, TUBE.xs[i]!, TUBE.y, TUBE.w, TUBE.h, m, seed * 11 + i));
  if (o.post) {
    // A corner card: a stout wooden upright at its middle, the catwalk's and the shelves' join.
    for (let h = LEDGE.top + 1; h < RIM.foot; h++) for (let x = 15; x <= 21; x++) put(c, x, yOf(h), x === 15 ? "v" : x === 21 ? "w" : "u");
  }
  deck(c, seed);
  // Icicles under the top shelf, between the tubes.
  for (const x of [11, 23, 35]) for (let j = 0; j < 2 + (hash(x, seed, 4) < 0.5 ? 1 : 0); j++) put(c, x, yOf(RIM.foot - 1) + j, j ? "~" : "*");
  icicles(c, 0, yOf(RIM.top) - 1 - 0, T, seed, 3);
  return c;
}
/** The stockroom door (under the catwalk, beside the stand): an arched plank door in a candy-cane frame; open, the warm stockroom. */
function door(c: Cv, open: boolean) {
  const x0 = 6;
  const x1 = 30;
  const top = 31;
  for (let h = 0; h <= top; h++)
    for (let x = x0; x <= x1; x++) {
      const u = (x - (x0 + x1) / 2) / ((x1 - x0) / 2);
      const archTop = top - 6 + Math.round(6 * Math.sqrt(Math.max(0, 1 - u * u)));
      if (h > archTop) continue;
      const frame = x - x0 < 3 || x1 - x < 3 || h > archTop - 3;
      const y = yOf(h);
      if (frame) put(c, x, y, Math.floor((x + y) / 2) % 2 ? "x" : "r");
      else if (open) put(c, x, y, h < 2 ? "J" : hash(x, h, 5) < 0.06 ? "f" : h < 10 ? "J" : "N");
      else put(c, x, y, (x - x0) % 5 === 1 ? "w" : x < 16 ? "U" : "u");
    }
  if (!open) {
    put(c, x1 - 6, yOf(13), "z"); // its knob
    put(c, x1 - 6, yOf(12), "Z");
    // A wreath of candy on it: a little ring of gumdrops.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      put(c, 18 + Math.round(Math.cos(a) * 4), yOf(21) + Math.round(Math.sin(a) * 4), "grgy"[i % 4]!);
    }
  } else {
    // Boxes and a sack on shelves inside, in the warm glow.
    rect(c, 10, yOf(14), 8, 5, (i, j) => (j === 0 ? "v" : i === 7 ? "u" : "U"));
    rect(c, 20, yOf(9), 6, 7, (i, j) => (j === 0 ? "x" : Math.floor(i / 2) % 2 ? "r" : "x"));
  }
}
/** The back shelf behind the stand: two shelves of glass jars (lollipops, gumdrops, rock candy). */
function jars(c: Cv, seed: number) {
  for (const sh of [4, 18]) for (let x = 1; x < T - 1; x++) put(c, x, yOf(sh), "u"), put(c, x, yOf(sh - 1), "w");
  const JAR: [number, number, number, Mix | null][] = [
    [3, 5, 9, MIXES.gumMix!],
    [12, 5, 8, MIXES.mint!],
    [21, 5, 9, MIXES.sour!],
    [29, 5, 7, MIXES.jelly!],
    [4, 19, 8, null],
    [14, 19, 9, MIXES.gumPink!],
    [24, 19, 8, null],
  ];
  JAR.forEach(([x, h0, hh, m], n) => {
    const w = 6;
    for (let j = 0; j < hh; j++)
      for (let i = 0; i < w; i++) {
        const y = yOf(h0 + j);
        const edge = i === 0 || i === w - 1;
        if (j === hh - 1) put(c, x + i, y, i === 0 ? "I" : "M"); // its lid
        else if (edge) put(c, x + i, y, i ? "Q" : "q");
        else if (m) put(c, x + i, y, j < hh - 3 ? candyAt(i, j, m, seed + n) : "e");
        else put(c, x + i, y, "e");
      }
    if (!m) {
      // Lollipops standing in it: three sticks and swirled heads.
      for (const [dx, ink] of [[1, "r"], [3, "g"], [5, "p"]] as const) {
        for (let j = hh - 2; j < hh + 3; j++) put(c, x + dx, yOf(h0 + j), "x");
        for (const [a, b] of [[-1, 0], [1, 0], [0, 1], [0, -1], [0, 0]] as const) put(c, x + dx + a, yOf(h0 + hh + 4) + b, a === 0 && b === 0 ? "x" : ink);
      }
    }
  });
}

// The big letters of the CANDY sign: the town's sign capitals at 2x, red with a dark edge.
function bigText(c: Cv, x: number, y: number, s: string, ink: string, edge: string) {
  const tmp = cv(textWidth(s) + 2, 7);
  text(tmp, 1, 1, s, ink);
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < tmp[0]!.length; i++) {
      if (tmp[j]![i] !== ink) continue;
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(c, x + (i - 1) * 2 + a, y + (j - 1) * 2 + b, ink);
      put(c, x + (i - 1) * 2 + 2, y + (j - 1) * 2 + 2, edge);
    }
}
/** The CANDY sign over the stand (on both centre cards, 74 px): a white board in a candy-stripe frame, red letters, two peppermints. */
function signBoth(): [Cv, Cv] {
  const W2 = 2 * T;
  const c = cv(W2, H);
  for (let i = 0; i < 2; i++) {
    const half = bayCard(40 + i, { lower: "jars" });
    half.forEach((row, y) => row.forEach((k, x) => put(c, x + i * T, y, k)));
  }
  const top = yOf(98);
  const bot = yOf(62);
  for (let y = top; y <= bot; y++)
    for (let x = 3; x < W2 - 3; x++) {
      const frame = y - top < 3 || bot - y < 3 || x < 6 || x > W2 - 7;
      put(c, x, y, frame ? (Math.floor((x + y) / 3) % 2 ? "x" : "r") : (y - top) % 9 === 4 && hash(x, y, 3) < 0.05 ? "X" : "x");
    }
  bigText(c, Math.round(W2 / 2 - (textWidth("CANDY") * 2) / 2), top + 9, "CANDY", "r", "R");
  // Two peppermints either side under the letters, and a row of gumdrops along its foot.
  for (const px of [14, W2 - 15])
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        const r = Math.hypot(i, j);
        if (r > 4.3) continue;
        const a = Math.atan2(j, i) + r * 0.2;
        put(c, px + i, bot - 8 + j, r > 3.6 ? "R" : Math.floor(((a + Math.PI) / (2 * Math.PI)) * 8) % 2 ? "x" : "r");
      }
  for (let x = 20; x < W2 - 20; x += 5) {
    const ink = "gyhtp"[(x / 5) % 5]!;
    put(c, x, bot - 5, ink), put(c, x + 1, bot - 5, ink), put(c, x, bot - 6, "x");
  }
  // The posts holding it up from the catwalk's rail.
  for (const px of [10, W2 - 11]) for (let y = bot + 1; y < yOf(LEDGE.top); y++) put(c, px, y, "w"), put(c, px + 1, y, "u");
  const l = cv(T, H);
  const r = cv(T, H);
  c.forEach((row, y) => row.forEach((k, x) => (x < T ? (l[y]![x] = k) : (r[y]![x - T] = k))));
  return [l, r];
}

const M = MIXES;
const bayDef = (name: string, seed: number, o: BayOpts) => def(name, [1, 1], T, H, [18, F], [[whole(bayCard(seed, o), true)]]);
export const SHOP_GINGER_BAY_A = bayDef("bay-a", 1, { bins: [M.jelly!, M.gumRed!], lids: "rt", tubes: [M.gumYellow!, M.sprinkle!, M.gumBlue!] });
export const SHOP_GINGER_BAY_B = bayDef("bay-b", 2, { bins: [M.sour!, M.mint!], lids: "gr", tubes: [M.redWhite!, M.lemon!, M.jelly!] });
export const SHOP_GINGER_BAY_DOOR = bayDef("bay-door", 3, { lower: "door", tubes: [M.gumPink!, M.choc!, M.sour!] });
export const SHOP_GINGER_BAY_DOOR_OPEN = bayDef("bay-door-open", 3, { lower: "door-open", tubes: [M.gumPink!, M.choc!, M.sour!] });
export const SHOP_GINGER_BAY_C = bayDef("bay-c", 4, { bins: [M.gumBlue!, M.choc!], lids: "tp", tubes: [M.orange!, M.gumMix!, M.spearmint!] });
export const SHOP_GINGER_BAY_D = bayDef("bay-d", 5, { bins: [M.lemon!, M.pinkWhite!], lids: "yh", tubes: [M.grape!, M.redWhite!, M.gumYellow!] });
export const SHOP_GINGER_BAY_E = bayDef("bay-e", 6, { bins: [M.jelly!, M.grape!], lids: "rp", tubes: [M.blueWhite!, M.sprinkle!, M.lemon!] });
/** The two back corners (behind the curve's steps, so its join never shows a gap): a bay with a wooden upright at its middle. */
export const SHOP_GINGER_BAY_CORNER = bayDef("bay-corner", 7, { bins: [M.gumMix!, M.sour!], lids: "gt", tubes: [M.mint!, null, M.gumRed!], post: true });
const [SIGN_W, SIGN_E] = signBoth();
export const SHOP_GINGER_SIGN_W = def("bay-sign-w", [1, 1], T, H, [18, F], [[whole(SIGN_W, true)]]);
export const SHOP_GINGER_SIGN_E = def("bay-sign-e", [1, 1], T, H, [18, F], [[whole(SIGN_E, true)]]);

// ==== The stairs: a little wooden staircase at each end of the catwalk, curving with the wall, two squares, four steps (8 px each)
//      up from the floor, the fifth onto the deck at 40. Candy-cane banisters on the open side.

/** The ice wall behind the stairs (and round the sides): blocks to `top` px, a frosted lip with icicles. */
function iceWall(seed: number, top: number, gx: number, w = T): Cv {
  const c = cv(w, H);
  iceFace(c, 0, yOf(top), w, top + 1, gx, seed);
  for (let x = 0; x < w; x++) put(c, x, yOf(top), hash(x, 0, seed) < 0.6 ? "*" : "~");
  icicles(c, 0, yOf(top) + 1, w, seed, 6);
  // Frost creeping up from the foot.
  for (let x = 0; x < w; x++) for (let h = 0; h < 3 + Math.floor(hash(x >> 1, 9, seed) * 4); h++) put(c, x, yOf(h), h === 0 ? "c" : hash(x, h, seed) < 0.5 ? "C" : "*");
  return c;
}
/** A step's block: its riser face from the floor to `h` (wood, a plank line every 5 px), its tread on top (lit, seen from above), x0..x1. */
function stepBlock(c: Cv, x0: number, x1: number, h: number) {
  for (let x = x0; x <= x1; x++)
    for (let y = yOf(h) - 2; y <= F; y++) {
      const hh = F - y;
      const tread = hh > h - 1; // its top: 3 px of lit plank seen from a little above
      put(c, x, y, tread ? (hh === h + 2 ? "v" : hh === h ? "u" : "U") : x === x0 ? "v" : x === x1 ? "w" : hh % 5 === 0 ? "w" : hh < 3 ? "V" : "u");
    }
  put(c, x0, yOf(h) - 2, "~"); // frost on its front corner
}
/** Candy-cane banister: a post on each step's front (`[x, h]`: its foot on the tread), a rail 11 px over the treads from post to post. */
function banister(c: Cv, posts: readonly [number, number][]) {
  for (let i = 0; i < posts.length; i++) {
    const [x, h] = posts[i]!;
    for (let j = 1; j <= 11; j++) put(c, x, yOf(h + j), Math.floor((h + j) / 2) % 2 ? "r" : "x");
    const nxt = posts[i + 1];
    if (nxt) {
      const [x2, h2] = nxt;
      const n = Math.abs(x2 - x);
      for (let st = 0; st <= n; st++) {
        const xx = x + Math.sign(x2 - x) * st;
        const hh = h + 11 + ((h2 - h) * st) / n;
        put(c, xx, yOf(Math.round(hh)), Math.floor(st / 2) % 2 ? "r" : "x");
        put(c, xx, yOf(Math.round(hh)) + 1, "R");
      }
    }
  }
}
/** The stairs' step height (px), and each quarter of a stair card's lift (west to east, x 0-8, 9-17, 18-26, 27-36). */
export const SHOP_GINGER_STEP = 5;
const QX = [[0, 8], [9, 17], [18, 26], [27, 36]] as const;
const LO_W = [20, 15, 10, 5] as const; // the west low stair (5, 7): rising westward from the floor at its east edge
const HI_W = [25, 30, 35, 40] as const; // the west high stair (5, 6): rising eastward to the deck (40) at its east edge
/**
 * The west staircase, drawn as it stands on its squares (the east one is these mirrored): `lo` on (5, 7) and `hi` on (5, 6), eight
 * steps of 5 px, a quarter of a card each, curving with the wall: up westward across the low square (entered from the floor at its
 * east edge), north onto the high square, up eastward across it to the catwalk's deck (40) on (6, 5). Candy-cane banisters on the
 * open side. The figure's lift on a stair square is the step under its feet (SHOP_GINGER_STAIRS).
 */
const STAIR_LO = cv(T, H);
{
  // (No wall behind it on its own card: the high stair stands just behind it, and the side wall (4, 7) to its west.)
  QX.forEach(([a, b], i) => stepBlock(STAIR_LO, a, b, LO_W[i]!));
  banister(STAIR_LO, QX.map(([a, b], i) => [Math.round((a + b) / 2), LO_W[i]!] as [number, number]).reverse());
}
const STAIR_HI = cv(T, H);
{
  // The dome's ice behind it, from over its banister up (below that the low stair in front and its own steps show).
  const w = iceWall(22, 124, 5 * T + 400);
  w.forEach((row, y) => row.forEach((k, x) => k !== "." && F - y >= 30 + Math.round(x / 3) && put(STAIR_HI, x, y, k)));
  QX.forEach(([a, b], i) => stepBlock(STAIR_HI, a, b, HI_W[i]!));
  banister(STAIR_HI, QX.map(([a, b], i) => [Math.round((a + b) / 2), HI_W[i]!] as [number, number]));
}
export const SHOP_GINGER_STAIR_LO = def("stair-lo", [1, 1], T, H, [18, F], [[whole(STAIR_LO, true)]]);
export const SHOP_GINGER_STAIR_HI = def("stair-hi", [1, 1], T, H, [18, F], [[whole(STAIR_HI, true)]]);

/** Plain ice walls: the dome's sides (taller toward the back), the corners behind the curve, an ice lantern on one. */
const sideDef = (name: string, seed: number, top: number, more?: (c: Cv) => void) => {
  const c = iceWall(seed, top, seed * 41);
  more?.(c);
  return def(name, [1, 1], T, H, [18, F], [[whole(c, true)]]);
};
export const SHOP_GINGER_ICE = sideDef("ice", 31, 126);
export const SHOP_GINGER_ICE_B = sideDef("ice-b", 32, 118, (c) => frostFlower(c, 18, yOf(70), 32));
/** A carved ice lantern in a niche, a warm candle inside (a light). */
export const SHOP_GINGER_ICE_LAMP = sideDef("ice-lamp", 33, 112, (c) => {
  for (let h = 46; h <= 70; h++) for (let x = 9; x <= 27; x++) {
    const u = (x - 18) / 9;
    const arch = 64 + Math.round(6 * Math.sqrt(Math.max(0, 1 - u * u)));
    if (h > arch) continue;
    put(c, x, yOf(h), x === 9 || x === 27 || h === arch ? "a" : "A");
  }
  // The lantern: a block of clear ice, a warm flame in it.
  rect(c, 13, yOf(64), 11, 15, (i, j) => (i === 0 || j === 0 ? "C" : i === 10 || j === 14 ? "b" : j > 5 && j < 12 && i > 3 && i < 7 ? (j < 8 ? "F" : "f") : "c"));
  put(c, 18, yOf(64) + 5, "f");
});
/** A frost flower (a big snowflake etched on the ice). */
function frostFlower(c: Cv, cx: number, cy: number, seed: number) {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + hash(seed, 0, 1);
    for (let s = 1; s < 7; s++) put(c, Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s), s % 3 === 0 ? "*" : "C");
  }
  put(c, cx, cy, "*");
}
export const SHOP_GINGER_ICE_C = sideDef("ice-c", 37, 100);
export const SHOP_GINGER_ICE_MID = sideDef("ice-mid", 38, 78);
export const SHOP_GINGER_ICE_LOW = sideDef("ice-low", 34, 52);
/** The near ring and the tunnel: low ice walls (the dome comes down toward you), a fat snowy lip, icicles. */
export const SHOP_GINGER_HEM = (() => {
  const c = iceWall(35, 14, 0);
  return def("hem", [1, 1], T, H, [18, F], [[whole(c, true)]]);
})();
export const SHOP_GINGER_TUNNEL = (() => {
  const c = iceWall(36, 22, 0);
  return def("tunnel", [1, 1], T, H, [18, F], [[whole(c, true)]]);
})();
/** The way out: the igloo's low doorway (2 x 1), a round arch of ice blocks onto the snowy night, a star or two. */
const EW = 2 * T;
const EH = 72;
export const SHOP_GINGER_ENTRANCE = (() => {
  const c = cv(EW, EH);
  const cx = EW / 2;
  for (let y = 0; y < EH; y++)
    for (let x = 0; x < EW; x++) {
      const h = EH - 1 - y;
      const u = (x + 0.5 - cx) / cx;
      const outer = 34 + Math.round(30 * Math.sqrt(Math.max(0, 1 - u * u)));
      if (h > outer) continue;
      const iu = (x + 0.5 - cx) / (cx - 10);
      const inner = Math.abs(iu) < 1 ? 22 + Math.round(26 * Math.sqrt(1 - iu * iu)) : -1;
      if (h <= inner) {
        // The night through the doorway: deep blue, snow on the ground outside, stars.
        if (h < 8) c[y]![x] = hash(x, y, 3) < 0.06 ? "*" : h < 4 ? "B" : "b";
        else c[y]![x] = hash(x, y, 4) < 0.025 ? "*" : h < 16 ? "j" : "E";
      } else c[y]![x] = iceBlock(x, y, 9, 13, 37);
    }
  icicles(c, 12, 22, EW - 24, 38, 4);
  return def("entrance", [2, 1], EW, EH, [EW / 2, EH - 1], [[whole(c, true)]]);
})();

// ==== On the floor: the stand (the "counter"), the Boss Crate, barrels and sacks.

/** The shopkeeper's stand: a small half-round table (its flat side to the wall), a wooden top seen from a little above, a candy-stripe skirt. */
const CW = 2 * T;
const CH = 44;
const C_TOP = 16; // its top's front edge, px over its foot
const CF = 34; // its foot row (its round front's foot: 4 px south of row 6's middle... drawn at the square's middle, see footOf)
export const SHOP_GINGER_COUNTER_TOP = C_TOP;
export const SHOP_GINGER_COUNTER = (() => {
  const c = cv(CW, CH);
  const cx = CW / 2;
  const RX = 25; // its half-width
  const RY = 8; // its top's depth, seen from above
  const topY = CF - C_TOP; // the top's front edge
  // The skirt: candy-striped, rounded at its foot.
  for (let y = topY; y <= CF; y++)
    for (let x = cx - RX; x <= cx + RX; x++) {
      const u = (x - cx) / RX;
      const footY = CF - Math.round(2 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));
      if (y > footY) continue;
      const shadeSide = u > 0.55;
      const stripe = Math.floor((x * 1.0 + (y - topY) * 0.5) / 3) % 2 === 0;
      put(c, x, y, y <= topY + 1 ? "w" : stripe ? (shadeSide ? "R" : "r") : shadeSide ? "X" : "x");
    }
  // A row of gumdrops round its belt.
  for (let x = cx - RX + 3; x < cx + RX - 2; x += 5) put(c, x, topY + 5, "gyth"[(x >> 2) % 4]!), put(c, x + 1, topY + 5, "gyth"[(x >> 2) % 4]!), put(c, x, topY + 4, "x");
  // The top: a half ellipse (the flat back toward the wall), wood planks, its front edge lit.
  for (let y = topY - RY; y <= topY; y++)
    for (let x = cx - RX - 1; x <= cx + RX + 1; x++) {
      const dy = (topY - y) / RY;
      const half = (RX + 1) * Math.sqrt(Math.max(0, 1 - (1 - dy) ** 2 * 0)) * 1;
      const ux = (x - cx) / half;
      const back = topY - RY;
      if (Math.abs(ux) > 1) continue;
      // Round toward us: the front edge curves down at the middle (a half ellipse), the back is straight.
      const frontY = topY - Math.round(RY * (1 - Math.sqrt(Math.max(0, 1 - ux * ux))));
      if (y > frontY || y < back) continue;
      put(c, x, y, y === frontY ? "v" : (x - cx + 60) % 7 === 0 ? "u" : y === back ? "u" : "U");
    }
  return def("counter", [2, 1], CW, CH, [cx, CF], [[whole(c, true)]]);
})();
/** Where the crate stands on the stand: its foot, in the stand's pixels (on its east end, a little back, clear of the shopkeeper). */
export const SHOP_GINGER_CRATE_AT: Pt = [CW / 2 + 15, CF - C_TOP - 3];
/** None needed: the CANDY sign is drawn on the back wall's middle cards. */
export const SHOP_GINGER_COUNTER_SIGN = null;

/** Ginger's Boss Crate: a present-like crate in candy stripes, a green ribbon and bow, a gold tag; idle, a frost glint along its lid. */
const XW = 30;
const XH = 32;
export const SHOP_GINGER_CRATE = (() => {
  const frames: Bit[][] = [];
  for (let f = 0; f < 6; f++) {
    const c = cv(XW, XH);
    bossCrate(c, 13, XH - 2, 24, 20, f < 4 ? f * 6 + 2 : -1);
    frames.push([bit(c)]);
  }
  PIECES.crate = { name: "crate", sq: [1, 1], w: XW, h: XH, foot: [13, XH - 2], frames, ms: 160 };
  return toChar(PIECES.crate);
})();

/** Barrels: loose candy heaped in the top, or stuffed with big candy canes (white and a color). 37 x 60, foot [18, 56]. */
const BW = T;
const BH = 64;
const BF = BH - 5;
function barrelDef(name: string, seed: number, fill: "candy" | "canes", mix: Mix = M.jelly!) {
  const c = cv(BW, BH);
  const w = 22;
  const h = 26;
  // Canes first (behind the rim), then the barrel, then the heap over the rim.
  if (fill === "canes") {
    const inks: [string, string][] = [["r", "R"], ["g", "G"], ["t", "T"], ["p", "P"], ["r", "R"]];
    const lean = [-7, -3, 1, 5, 8];
    lean.forEach((dx, i) => caneOn(c, 18 + dx * 0.4, BF - 8, 18 + dx, BF - h - 18 - (i % 2) * 5, inks[(i + seed) % inks.length]!, 1.3, 3, dx < 0 ? -1 : 1));
  }
  barrel(c, 18, BF, w, h, seed);
  if (fill === "candy") heap(c, 18 - w / 2, BF - h, w, mix, seed, 4);
  else for (let i = 1; i < w - 1; i++) put(c, 18 - w / 2 + i, BF - h, "V");
  // A frosty rim and a little snow at its foot.
  for (let i = 0; i < w; i += 3) put(c, 18 - w / 2 + i, BF - h + 2, "~");
  return def(name, [1, 1], BW, BH, [18, BF], [[bit(c)]]);
}
export const SHOP_GINGER_BARREL_CANDY = barrelDef("barrel-candy", 1, "candy", M.jelly!);
export const SHOP_GINGER_BARREL_MINT = barrelDef("barrel-mint", 2, "candy", M.mint!);
export const SHOP_GINGER_BARREL_GUM = barrelDef("barrel-gum", 3, "candy", M.gumMix!);
export const SHOP_GINGER_BARREL_CANES = barrelDef("barrel-canes", 4, "canes");
export const SHOP_GINGER_BARREL_CANES_B = barrelDef("barrel-canes-b", 5, "canes");
/** A burlap sack of candy, tied with red string, two spilled. */
export const SHOP_GINGER_SACK = (() => {
  const c = cv(T, 34);
  sack(c, 18, 30, 20, 22, M.gumMix!, 7);
  return def("sack", [1, 1], T, 34, [18, 30], [[bit(c)]]);
})();
/** A little stack of candy boxes (white boxes with a red stripe and a gumdrop), tied with string. */
export const SHOP_GINGER_BOXES = (() => {
  const c = cv(T, 40);
  const box = (x: number, y: number, w: number, h: number, ink: string) =>
    rect(c, x, y, w, h, (i, j) => (j === 0 ? "x" : i === w - 1 ? "X" : j === Math.floor(h / 2) ? ink : i === Math.floor(w / 2) ? "y" : "x"));
  box(6, 22, 24, 14, "r");
  box(9, 12, 18, 10, "g");
  box(12, 4, 13, 8, "t");
  return def("boxes", [1, 1], T, 40, [18, 36], [[bit(c)]]);
})();

// ==== The lights, each on its piece (`piece`; x, y in its own pixels).

const WARM = "#ffcf8a"; // the candy shop's warm glow: the catwalk's bulbs, the lanterns
const ICE = "#a8dcff"; // the ice's cool light: the battle spot, the doorway's night
const BAYS = ["bay-a", "bay-b", "bay-door", "bay-door-open", "bay-c", "bay-d", "bay-e", "bay-corner", "bay-sign-w", "bay-sign-e"];
/** The catwalk's bulbs on every bay (warm, a soft halo), the ice lanterns, the doorway's night, the stockroom (when its door opens). */
export const SHOP_GINGER_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  ...BAYS.map((piece) => ({ piece, x: 0, y: yOf(DECK.face + 6), w: T, h: 5, keys: "F", color: WARM, strength: 0.7, halo: 8 })),
  { piece: "ice-lamp", x: 13, y: yOf(64), w: 11, h: 15, keys: "Ff", color: WARM, strength: 1, flicker: true, halo: 26 },
  { piece: "entrance", x: 10, y: 6, w: EW - 20, h: EH - 30, keys: "Ej*", color: ICE, strength: 0.4 },
  { piece: "bay-door-open", x: 9, y: yOf(28), w: 19, h: 27, keys: "JNf", color: WARM, strength: 0.6, halo: 14 },
];
/** ... and pools on the floor: warm along the bays' foot, cool on the battle spot's ice, cool before the doorway. */
export const SHOP_GINGER_POOLS: readonly (LightPool & { piece: string })[] = [
  ...BAYS.map((piece) => ({ piece, x: 18, y: F + 10, rx: 26, ry: 9, color: WARM, strength: 0.18 })),
  { piece: "ice-lamp", x: 18, y: F + 8, rx: 34, ry: 12, color: WARM, strength: 0.25 },
  { piece: "entrance", x: EW / 2, y: EH - 4, rx: 30, ry: 9, color: ICE, strength: 0.2 },
];
/** The battle spot's own cool shine (a pool on the floor at the table's spot, in the room's squares). */
export const SHOP_GINGER_ICE_POOL = { at: [10, 10.5], rx: ZX, ry: ZY * 0.9, color: ICE, strength: 0.16 } as const;

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
  /** Squares deep, for the deep pieces, from `row` north: it stands on `row`, and covers the rows north of it too. */
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

// -- The floor (every square): the snow on the floor, the battle spot's ice; the dome's ice under the walls, night snow outside.
const PRINTS: Record<string, [number, number][]> = {
  "6,9": [[12, 30], [20, 22], [13, 13]],
  "13,12": [[24, 28], [16, 20]],
  "9,14": [[14, 30], [22, 20], [15, 9]],
  "10,16": [[20, 28], [14, 15]],
  "12,7": [[8, 26], [16, 17]],
};
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const k = `${col},${row}`;
    if (!isOpen(col, row)) {
      if (row >= 18) tileDef(`floor-out-${col}-${row}`, (x, y) => nightSnow(col * T + x, row * T + y)), at(`floor-out-${col}-${row}`, col, row, false);
      else tileDef(`floor-ice-${col}-${row}`, (x, y) => deep(col * T + x, row * T + y)), at(`floor-ice-${col}-${row}`, col, row, false);
      continue;
    }
    if (CIRCLE.has(k)) {
      at(`circle-${col}-${row}`, col, row, false);
      continue;
    }
    const pr = PRINTS[k];
    snowTile(col, row, 1, pr ? (x, y) => (pr.some(([hx, hy]) => bootPrint(x, y, hx, hy)) ? "2" : null) : undefined);
    at(`floor-${col}-${row}`, col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;

// -- The walls, round the floor: every ice square next to it (or touching a corner) has a piece.
/** The back curve, west to east: the stairs' squares, the bays under the catwalk, the CANDY sign's two cards behind the stand. */
const BACK: [string, number, number, boolean?][] = [
  ["stair-lo", 5, 7],
  ["stair-hi", 5, 6],
  ["bay-a", 6, 5],
  ["bay-b", 7, 5],
  ["bay-door", 8, 4],
  ["bay-sign-w", 9, 4],
  ["bay-sign-e", 10, 4],
  ["bay-c", 11, 4],
  ["bay-d", 12, 5],
  ["bay-e", 13, 5],
  ["stair-hi", 14, 6, true],
  ["stair-lo", 14, 7, true],
];
const placedWall = new Set<string>();
for (const [name, c, r, flip] of BACK) at(name, c, r, true, flip ? { flip: true } : {}), placedWall.add(`${c},${r}`);
// The two back corners behind the curve's steps (so no gap shows between the bays), the stairs' back corners.
for (const [name, c, r, flip] of [["bay-corner", 7, 4], ["bay-corner", 12, 4, true], ["ice", 5, 5], ["ice", 14, 5, true], ["ice", 4, 7], ["ice", 15, 7, true]] as [string, number, number, boolean?][])
  at(name, c, r, true, flip ? { flip: true } : {}), placedWall.add(`${c},${r}`);
// The rest of the ring: the sides (an ice lantern on each), the near walls coming down, the tunnel's walls, the doorway.
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const k = `${col},${row}`;
    if (isOpen(col, row) || placedWall.has(k)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dc, dr]) => isOpen(col + dc!, row + dr!) && !(row + dr! >= 18));
    if (!near) continue;
    const east = col > MID;
    const flip = east ? { flip: true } : {};
    if (row >= 15 && (col === 8 || col === 11)) at(row === 18 ? "hem" : "tunnel", col, row, true, flip);
    else if (row >= 14) at("hem", col, row, true, flip);
    else if (row === 13) at("ice-low", col, row, true, flip);
    else if (row === 12) at("ice-mid", col, row, true, flip);
    else if (row === 9) at("ice-lamp", col, row, true, flip);
    else if (row >= 10) at(row === 10 ? "ice-b" : "ice-c", col, row, true, flip);
    else at(row % 2 ? "ice-b" : "ice", col, row, true, flip);
  }
at("entrance", 9, 18, false, { exit: true });

// -- On the floor.
at("counter", 9, 6, true); // the shopkeeper's half-round stand, the Boss Crate on it (SHOP_GINGER_CRATE_AT)
at("crate", 9, 6, false); // (its place is the stand's: drawn on its top)
at("barrel-canes", 5, 9, true);
at("barrel-candy", 5, 10, true);
at("sack", 6, 12, true);
at("barrel-mint", 14, 9, true);
at("barrel-canes-b", 14, 10, true);
at("barrel-gum", 13, 12, true);
at("boxes", 8, 13, true);

/** Where every piece goes: name, column (its west-most square), row (its south-most), solid; floor tiles first, then the upright pieces north to south. */
export const SHOP_GINGER_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];

// ==== The two walking levels (see shop-ginger-nov5.md).

/**
 * The catwalk (the upper level): its squares, west to east, all at SHOP_GINGER_DECK_H (40 px) over the floor. They're the back
 * wall's squares (`#` on the floor's mask: nobody stands there from the floor), reached only by the stairs. A figure up there stands
 * at the square's middle row (its card's foot), lifted 40 px, and walks along this chain (one square to the next, the steps round
 * the curve diagonal).
 */
export const SHOP_GINGER_UPPER = {
  h: SHOP_GINGER_DECK_H,
  squares: [
    { c: 6, r: 5 },
    { c: 7, r: 5 },
    { c: 8, r: 4 },
    { c: 9, r: 4 },
    { c: 10, r: 4 },
    { c: 11, r: 4 },
    { c: 12, r: 5 },
    { c: 13, r: 5 },
  ],
} as const;
/**
 * The two staircases, each from the floor to the catwalk: the floor square at its foot, its two squares (low, high) with the lift
 * of each quarter of the square (west to east, a quarter of its card each: x 0-8, 9-17, 18-26, 27-36), and the catwalk square at
 * its top. Eight steps of SHOP_GINGER_STEP (5 px); the last is level with the deck (40). The east one is the west one mirrored.
 */
export const SHOP_GINGER_STAIRS = {
  step: SHOP_GINGER_STEP,
  west: {
    foot: { c: 6, r: 7 },
    squares: [
      { c: 5, r: 7, quarters: [...LO_W] }, // entered from the east (from the foot): 5, 10, 15, 20 going west
      { c: 5, r: 6, quarters: [...HI_W] }, // entered from the south (its west quarter, 25): 30, 35, 40 going east
    ],
    top: { c: 6, r: 5 },
  },
  east: {
    foot: { c: 13, r: 7 },
    squares: [
      { c: 14, r: 7, quarters: [...LO_W].reverse() }, // entered from the west: 5, 10, 15, 20 going east
      { c: 14, r: 6, quarters: [...HI_W].reverse() }, // entered from the south (its east quarter, 25): 30, 35, 40 going west
    ],
    top: { c: 13, r: 5 },
  },
} as const;
/**
 * The dispensers: each bay's square and what it holds (two bins below, three tubes above); every chute's foot is
 * SHOP_GINGER_CHUTES (lower: 11 px over the floor at x 9 and 27 of its card; upper: 53 px over the floor at x 6, 18 and 30).
 */
export const SHOP_GINGER_DISPENSERS = [
  { piece: "bay-a", c: 6, r: 5, lower: 2, upper: 3 },
  { piece: "bay-b", c: 7, r: 5, lower: 2, upper: 3 },
  { piece: "bay-door", c: 8, r: 4, lower: 0, upper: 3 },
  { piece: "bay-c", c: 11, r: 4, lower: 2, upper: 3 },
  { piece: "bay-d", c: 12, r: 5, lower: 2, upper: 3 },
  { piece: "bay-e", c: 13, r: 5, lower: 2, upper: 3 },
] as const;

// -- The dispensing pair's loop (elf A with the box, elf B with the notepad).

/** Px across a card into squares from its middle. */
const across = (x: number) => (x - 18.5) / T;
/** How far ahead of his foot elf A holds the box (px; the elves' rig, npc-ginger-elf). */
export const ELF_BOX_DX = 7;
type Stop = { at: readonly [number, number]; lvl: "floor" | "up"; h: number; stop?: { row: "lower" | "upper"; piece: string; slot: number; face: 1 | -1 }; b?: readonly [number, number, number] };
const lowStop = (c: number, r: number, slot: number, piece: string): Stop => {
  const fc = c + across(SHOP_GINGER_CHUTES.lower.x[slot]! - ELF_BOX_DX);
  return { at: [+fc.toFixed(2), r + 0.6], lvl: "floor", h: 0, stop: { row: "lower", piece, slot, face: 1 }, b: [+(fc - 0.45).toFixed(2), r + 0.9, 0] };
};
const upStop = (c: number, r: number, slot: number, piece: string): Stop => {
  const fc = c + across(SHOP_GINGER_CHUTES.upper.x[slot]! + ELF_BOX_DX);
  return { at: [+fc.toFixed(2), r], lvl: "up", h: SHOP_GINGER_DECK_H, stop: { row: "upper", piece, slot, face: -1 } };
};
/** B's place at an upper stop: half a square back along A's path from it (on the catwalk's chain, or the stair's top step). */
function behind(path: Stop[], i: number, d = 0.5): readonly [number, number, number] {
  let at = path[i]!;
  for (let j = i - 1; j >= 0; j--) {
    const p = path[j]!;
    const L = Math.hypot(p.at[0] - at.at[0], p.at[1] - at.at[1]);
    if (L >= d) {
      const u = d / L;
      return [+(at.at[0] + (p.at[0] - at.at[0]) * u).toFixed(2), +(at.at[1] + (p.at[1] - at.at[1]) * u).toFixed(2), Math.round(at.h + (p.h - at.h) * u)];
    }
    d -= L;
    at = p;
  }
  return [at.at[0], at.at[1], at.h];
}
/**
 * Elf A's loop (squares: his foot; `lvl` floor or up; `h` his lift there, px), waypoint to waypoint in straight lines (each line
 * stays on floor or catwalk squares). At a `stop`, he faces the dispenser (`face` 1 east, -1 west), plays tap, boxOut, fill, full;
 * elf B stands at `b` ([c, r, lift]), facing the same way, and plays `write`. Between stops B follows A along the same waypoints,
 * half a square behind. Five on the lower row (west to east, round the stand's front), up the east stairs, five on the upper row
 * (east to west, over the stand), down the west stairs; then again.
 */
const RAW_PATH: Stop[] = [
  { at: [6, 7], lvl: "floor", h: 0 }, // the west stairs' foot: the loop's start
  lowStop(6, 5, 1, "bay-a"), // L1: bay-a's east bin (jelly beans? no: its gumballs)
  lowStop(7, 5, 1, "bay-b"), // L2: bay-b's east bin (peppermints)
  { at: [8, 7.2], lvl: "floor", h: 0 }, // round the stand's front (it and the shopkeeper are on rows 5-6, columns 9-10)
  { at: [11, 7.2], lvl: "floor", h: 0 },
  lowStop(11, 4, 1, "bay-c"), // L3: bay-c's east bin (chocolates)
  lowStop(12, 5, 0, "bay-d"), // L4: bay-d's west bin (lemon drops)
  lowStop(13, 5, 1, "bay-e"), // L5: bay-e's east bin (grape drops)
  { at: [13.2, 7], lvl: "floor", h: 0 }, // the east stairs' foot
  { at: [14, 7], lvl: "floor", h: 15 }, // up: the low stair square (5, 10, 15, 20 going east; its middle 15)
  { at: [14, 6], lvl: "floor", h: 30 }, // the high stair square (25, 30, 35, 40 going west; its middle 30)
  upStop(13, 5, 1, "bay-e"), // U1: bay-e's middle tube
  upStop(12, 5, 0, "bay-d"), // U2: bay-d's west tube
  { at: [11.5, 4.5], lvl: "up", h: 40 }, // round the curve (between (12, 5) and (11, 4))
  upStop(11, 4, 1, "bay-c"), // U3: bay-c's middle tube
  { at: [9.5, 4], lvl: "up", h: 40 }, // over the stand, behind the CANDY sign's posts
  upStop(8, 4, 1, "bay-door"), // U4: over the stockroom door, its middle tube
  { at: [7.5, 4.5], lvl: "up", h: 40 }, // round the curve (between (8, 4) and (7, 5))
  upStop(7, 5, 0, "bay-b"), // U5: bay-b's west tube
  { at: [6, 5], lvl: "up", h: 40 },
  { at: [5, 6], lvl: "floor", h: 30 }, // down: the high stair square (40, 35, 30, 25 going west; its middle 30)
  { at: [5, 7], lvl: "floor", h: 15 }, // the low stair square (20, 15, 10, 5 going east; its middle 15)
  { at: [6, 7], lvl: "floor", h: 0 }, // back at the start
];
export const SHOP_GINGER_DISPENSE_PATH: readonly Stop[] = RAW_PATH.map((p, i) => (p.stop?.row === "upper" ? { ...p, b: behind(RAW_PATH, i) } : p));
/** The shopkeeper: his squares and where he's drawn, behind the stand at the back middle, facing our right (as drawn). */
export const SHOP_GINGER_KEEPER = { at: [9.5, 5.2], keeper: [{ c: 9, r: 5 }, { c: 10, r: 5 }], face: 1 } as const;
/**
 * The walking elves (each with a big candy cane, white and his outfit's color): a loop each on the floor round the battle spot's
 * edge, never across it (squares: his foot), and the beat at each waypoint (`pause` ms standing: his `idle`, leaning on the cane).
 * Every pause is wholly in view from the challenge camera on phone and computer (shop-ginger-nov5.md).
 */
export const SHOP_GINGER_WALKERS = {
  red: [
    { at: [6.2, 8.4], pause: 1400 },
    { at: [6.2, 11.6], pause: 0 },
    { at: [7.6, 12.6], pause: 1800 },
    { at: [6.2, 11.6], pause: 0 },
  ],
  green: [
    { at: [13.2, 8.2], pause: 1600 },
    { at: [12.6, 7.4], pause: 0 },
    { at: [9.0, 7.6], pause: 1200 },
    { at: [12.6, 7.4], pause: 0 },
  ],
  blue: [
    { at: [11.4, 12.8], pause: 1500 },
    { at: [12.6, 11.6], pause: 0 },
    { at: [13.2, 9.0], pause: 1300 },
    { at: [12.6, 11.6], pause: 0 },
  ],
} as const;

// ==== The room still: the floor flat on its squares, each upright piece stood at its foot, north first.

const TOP = 180; // room above row 0 for the back wall's pictures
const RW = N * T;
const RH = TOP + N * T + 4;
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
export const footOf = (pl: ShopPlace): Pt => {
  const p = PIECES[pl.name]!;
  if (pl.name === "crate") {
    const cp = PIECES.counter!;
    const [cx, cy] = [pl.col * T + T, TOP + pl.row * T + 18];
    return [cx - cp.foot[0] + SHOP_GINGER_CRATE_AT[0], cy - cp.foot[1] + SHOP_GINGER_CRATE_AT[1]];
  }
  return [pl.col * T + Math.floor((p.sq[0] * T) / 2), TOP + pl.row * T + 18];
};
const roomFrame = (f: number): Frame => {
  const layers: Layer[] = [];
  for (const pl of SHOP_GINGER_LAYOUT) {
    const p = PIECES[pl.name]!;
    const [fx, fy] = footOf(pl);
    layers.push(...placed(p, f, fx, fy, pl.flip));
  }
  return { ms: 160, layers };
};
const anims: Record<string, Anim> = { idle: { loop: true, frames: [roomFrame(0)] } };
/** Each piece alone, for review, blown up (up to 4x). */
for (const p of Object.values(PIECES)) {
  if (/^(circle|floor)-/.test(p.name)) continue;
  const ch = toChar(p);
  const z = Math.max(1, Math.min(4, Math.floor((RW - 8) / p.w), Math.floor((RH - 8) / p.h)));
  const frames = ch.anims.idle!.frames.map((fr, f) => {
    const keys = frameKeys(ch, fr);
    const grid = Array.from({ length: p.h * z }, (_, y) => Array.from({ length: p.w * z }, (_, x) => keys[Math.floor(y / z)]![Math.floor(x / z)] ?? ".").join(""));
    const n = `zoom-${p.name}-${f}`;
    roomParts[n] = { grid, outline: false };
    return { ms: p.ms, layers: [{ part: n, x: 4, y: 4 }] };
  });
  anims[p.name] = { loop: true, frames };
}

/** Every piece by its name (as SHOP_GINGER_LAYOUT names them), each its own Character `shop-ginger-<name>`. */
export const SHOP_GINGER_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

export const HOUSE_SHOP_GINGER: Character = { id: "house-shop-ginger", name: "Ginger's igloo candy shop", w: RW, h: RH, foot: [RW / 2, RH - 4], palette: PALETTE, parts: roomParts, anims };

/** The igloo's palette (the elves' props and the intro's props use the same colors). */
export const SHOP_GINGER_PALETTE: Readonly<Record<string, string>> = PALETTE;
/** The room still's top margin (px above row 0), for the review scripts. */
export const SHOP_GINGER_TOP = TOP;
/** A card's height (px) and where in it a given height over the floor is: for the mockups. */
export const SHOP_GINGER_CARD = { h: H, foot: F } as const;
export type { LightPool, LightSpot };
