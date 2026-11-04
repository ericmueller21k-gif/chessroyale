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
/** The stairs' feet (floor squares added to the circle, Nov 5: each flight now stands on the catwalk's own row, its foot in front). */
const STAIR_FEET = new Set(["5,6", "5,7", "14,6", "14,7"]);
export const SHOP_GINGER_FLOOR: readonly string[] = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (inCircle(c, r) || inTunnel(c, r) || STAIR_FEET.has(`${c},${r}`) ? "." : "#")).join(""));
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
  return v > 1.55 ? "b" : v < -1.65 ? "A" : "a";
};
/** Outside, by the doorway: night snow, bluish. */
const nightSnow = (gx: number, gy: number) => (hash(gx, gy, 9) < 0.03 ? "*" : hash(gx >> 2, gy >> 2, 8) < 0.3 ? "b" : "B");

// -- The battle spot: glossy ice, a frosted rim, his mark (a peppermint) and yours (a snowflake).

const CX = 9.5 * T + 18.5; // its middle in the room's floor pixels: (9.5, 9.5), the room's middle and the table's spot
const CY = 9.5 * T + 18.5;
const ZX = 104; // its half-width and half-depth (an ellipse)
const ZY = 78;
const zoneD = (gx: number, gy: number) => Math.hypot((gx + 0.5 - CX) / ZX, (gy + 0.5 - CY) / ZY) - 1;
/** His mark (west) and yours (east), in squares: the table stands halfway between them, at (9.5, 9.5), the room's middle. */
export const SHOP_GINGER_MARKS = { boss: [8, 9.5], you: [11, 9.5] } as const;
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
/** Every wall card is 45 px wide: its square's 37 and 4 px over each neighbour, so the curve shows no gaps between them. */
const CARD = 45;
const OV = 4;
const yOf = (h: number) => F - h;
/** The catwalk's deck: its top (where a figure's feet stand) is 40 px over the floor. */
export const SHOP_GINGER_DECK_H = 40;
const DECK = { top: 38, face: 33 } as const; // the deck's lit top (seen from a little above) from 38 to 41, its plank face 33 to 37
const BIN = { y: yOf(32), h: 18, w: 15, xs: [2 + OV, 20 + OV] } as const; // the bins: 15 x 18, their tops 32 px up; their chutes' feet 11 px up
const TUBE = { y: yOf(103), h: 47, w: 9, xs: [2 + OV, 14 + OV, 26 + OV] } as const; // the tubes: 9 wide, from 103 px up to 57; their spouts' feet 53 px up
const LEDGE: { top: number; foot: number } = { top: 52, foot: 42 }; // the tubes' shelf behind the deck
const RIM: { top: number; foot: number } = { top: 109, foot: 104 }; // the top shelf over the tubes
/** A dispenser's chute foot (px over the foot of its card) and its middle (px across its 45 px card), per row: where the candy comes out. */
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
    for (let x = 0; x < CARD; x++) {
      const post = x === OV || x === OV + T - 1 || x === OV + 18;
      const kick = y > F - 5;
      if (kick) put(c, x, y, y === F - 4 ? "U" : Math.floor((x + y) / 3) % 2 ? "r" : "x"); // a candy-striped kick plate
      else put(c, x, y, post ? (x === OV + 18 ? "u" : "w") : hash(x, y >> 2, seed) < 0.15 ? "w" : "V");
    }
}
/** The catwalk across a card: its plank face (a string of warm bulbs along it) and its lit top, a shadow line at its back. */
function deck(c: Cv, seed: number, lit = true) {
  for (let x = 0; x < CARD; x++) {
    for (let h = DECK.face; h < DECK.top; h++) put(c, x, yOf(h), h === DECK.face ? "w" : h === DECK.top - 1 ? (lit ? (Math.floor(x / 2) % 2 ? "x" : "r") : "v") : (x + seed * 5) % 13 === 0 ? "w" : "u");
    for (let h = DECK.top; h <= DECK.top + 3; h++) put(c, x, yOf(h), h === DECK.top + 3 ? "w" : (x + seed * 3) % 9 === 0 ? "U" : h === DECK.top ? "U" : "v");
  }
  if (lit) bulbs(c, 0, CARD - 1, yOf(DECK.face + 3), 12, seed, true);
}
/** The tubes' shelf behind the deck and the top shelf over them, both wood; candy-striped trim on the top one. */
function shelves(c: Cv) {
  for (let x = 0; x < CARD; x++) {
    for (let h = LEDGE.foot; h <= LEDGE.top; h++) put(c, x, yOf(h), h === LEDGE.top ? "U" : h === LEDGE.top - 1 ? "u" : "w");
    for (let h = LEDGE.top + 1; h < RIM.foot; h++) put(c, x, yOf(h), x === OV || x === OV + T - 1 ? "w" : "V"); // dark behind the tubes
    for (let h = RIM.foot; h <= RIM.top; h++) put(c, x, yOf(h), h === RIM.top ? "v" : h === RIM.foot ? "w" : h === RIM.foot + 1 ? (Math.floor(x / 3) % 2 ? "x" : "r") : "u");
  }
}
type BayOpts = { bins?: readonly [Mix, Mix] | null; lids?: string; tubes?: readonly (Mix | null)[] | null; lower?: "door" | "door-open" | "jars" | "none"; post?: boolean; ledge?: boolean; iceTop?: number };
function bayCard(seed: number, o: BayOpts): Cv {
  const c = cv(CARD, H);
  const iceTop = o.iceTop ?? H - 1;
  iceFace(c, 0, yOf(iceTop), CARD, iceTop - RIM.top + 1, seed * T - OV, seed);
  if (o.iceTop) for (let x = 0; x < CARD; x++) put(c, x, yOf(iceTop), hash(x, 0, seed) < 0.6 ? "*" : "~");
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
    for (let h = LEDGE.top + 1; h < RIM.foot; h++) for (let x = 15 + OV; x <= 21 + OV; x++) put(c, x, yOf(h), x === 15 + OV ? "v" : x === 21 + OV ? "w" : "u");
  }
  // The catwalk's deck (lit bulbs along it); round the sides a plain ledge (no bulbs: not walked on).
  deck(c, seed, !o.ledge);
  // Icicles under the top shelf, between the tubes.
  for (const x of [11, 23, 35]) for (let j = 0; j < 2 + (hash(x, seed, 4) < 0.5 ? 1 : 0); j++) put(c, x + OV, yOf(RIM.foot - 1) + j, j ? "~" : "*");
  return c;
}
/** The stockroom door (under the catwalk, beside the stand): an arched plank door in a candy-cane frame; open, the warm stockroom. */
function door(c: Cv, open: boolean) {
  const x0 = 6 + OV;
  const x1 = 30 + OV;
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
      else put(c, x, y, (x - x0) % 5 === 1 ? "w" : x < 16 + OV ? "U" : "u");
    }
  if (!open) {
    put(c, x1 - 6, yOf(13), "z"); // its knob
    put(c, x1 - 6, yOf(12), "Z");
    // A wreath of candy on it: a little ring of gumdrops.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      put(c, 18 + OV + Math.round(Math.cos(a) * 4), yOf(21) + Math.round(Math.sin(a) * 4), "grgy"[i % 4]!);
    }
  } else {
    // Boxes and a sack on shelves inside, in the warm glow.
    rect(c, 10 + OV, yOf(14), 8, 5, (i, j) => (j === 0 ? "v" : i === 7 ? "u" : "U"));
    rect(c, 20 + OV, yOf(9), 6, 7, (i, j) => (j === 0 ? "x" : Math.floor(i / 2) % 2 ? "r" : "x"));
  }
}
/** The back shelf behind the stand: two shelves of glass jars (lollipops, gumdrops, rock candy). */
function jars(c: Cv, seed: number) {
  for (const sh of [4, 18]) for (let x = 0; x < CARD; x++) put(c, x, yOf(sh), "u"), put(c, x, yOf(sh - 1), "w");
  const JAR: [number, number, number, Mix | null][] = [
    [3, 5, 9, MIXES.gumMix!],
    [12, 5, 8, MIXES.mint!],
    [21, 5, 9, MIXES.sour!],
    [29, 5, 7, MIXES.jelly!],
    [4, 19, 8, null],
    [14, 19, 9, MIXES.gumPink!],
    [24, 19, 8, null],
  ];
  JAR.forEach(([x0, h0, hh, m], n) => {
    const x = x0 + OV;
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
  const c = cv(W2 + 2 * OV, H);
  for (let i = 0; i < 2; i++) {
    const half = bayCard(40 + i, { lower: "jars" });
    half.forEach((row, y) => row.forEach((k, x) => (i === 0 || x >= OV) && put(c, x + i * T, y, k)));
  }
  const top = yOf(98);
  const bot = yOf(62);
  for (let y = top; y <= bot; y++)
    for (let x = OV + 3; x < OV + W2 - 3; x++) {
      const frame = y - top < 3 || bot - y < 3 || x < OV + 6 || x > OV + W2 - 7;
      put(c, x, y, frame ? (Math.floor((x + y) / 3) % 2 ? "x" : "r") : (y - top) % 9 === 4 && hash(x, y, 3) < 0.05 ? "X" : "x");
    }
  bigText(c, Math.round(OV + W2 / 2 - (textWidth("CANDY") * 2) / 2), top + 9, "CANDY", "r", "R");
  // Two peppermints either side under the letters, and a row of gumdrops along its foot.
  for (const px of [OV + 14, OV + W2 - 15])
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        const r = Math.hypot(i, j);
        if (r > 4.3) continue;
        const a = Math.atan2(j, i) + r * 0.2;
        put(c, px + i, bot - 8 + j, r > 3.6 ? "R" : Math.floor(((a + Math.PI) / (2 * Math.PI)) * 8) % 2 ? "x" : "r");
      }
  for (let x = OV + 20; x < OV + W2 - 20; x += 5) {
    const ink = "gyhtp"[Math.floor(x / 5) % 5]!;
    put(c, x, bot - 5, ink), put(c, x + 1, bot - 5, ink), put(c, x, bot - 6, "x");
  }
  // The posts holding it up from the catwalk's rail.
  for (const px of [OV + 10, OV + W2 - 11]) for (let y = bot + 1; y < yOf(LEDGE.top); y++) put(c, px, y, "w"), put(c, px + 1, y, "u");
  // Its two cards, each 45 wide, overlapping over the middle.
  const l = cv(CARD, H);
  const r = cv(CARD, H);
  c.forEach((row, y) => row.forEach((k, x) => (x < CARD && (l[y]![x] = k), x >= T && (r[y]![x - T] = k))));
  return [l, r];
}

const M = MIXES;
const bayDef = (name: string, seed: number, o: BayOpts) => def(name, [1, 1], CARD, H, [22, F], [[whole(bayCard(seed, o), true)]]);
export const SHOP_GINGER_BAY_B = bayDef("bay-b", 2, { bins: [M.sour!, M.mint!], lids: "gr", tubes: [M.redWhite!, M.lemon!, M.jelly!] });
export const SHOP_GINGER_BAY_DOOR = bayDef("bay-door", 3, { lower: "door", tubes: [M.gumPink!, M.choc!, M.sour!] });
export const SHOP_GINGER_BAY_DOOR_OPEN = bayDef("bay-door-open", 3, { lower: "door-open", tubes: [M.gumPink!, M.choc!, M.sour!] });
export const SHOP_GINGER_BAY_C = bayDef("bay-c", 4, { bins: [M.gumBlue!, M.choc!], lids: "tp", tubes: [M.orange!, M.gumMix!, M.spearmint!] });
export const SHOP_GINGER_BAY_D = bayDef("bay-d", 5, { bins: [M.lemon!, M.pinkWhite!], lids: "yh", tubes: [M.grape!, M.redWhite!, M.gumYellow!] });
/** The two back corners (behind the curve's steps, so its join never shows a gap): a bay with a wooden upright at its middle. */
export const SHOP_GINGER_BAY_CORNER = bayDef("bay-corner", 7, { bins: [M.gumMix!, M.sour!], lids: "gt", tubes: [M.mint!, null, M.gumRed!], post: true });
/**
 * The candy wall going on round both sides (Eric, Nov 5: "extend the dispensers further round the curved walls"): the same bays,
 * bins below and tubes above, on a plain ledge (no bulbs: the catwalk ends at the stairs), the dome's ice over them lower (126).
 * West: (5, 5) and (4, 7) corners, (4, 8) to (4, 11); east the same, mirrored.
 */
export const SHOP_GINGER_SIDE_CORNER = bayDef("side-corner", 13, { bins: [M.lemon!, M.gumBlue!], lids: "yt", tubes: [M.jelly!, null, M.grape!], post: true, ledge: true, iceTop: 126 });
export const SHOP_GINGER_SIDE_A = bayDef("side-a", 9, { bins: [M.gumPink!, M.sprinkle!], lids: "hg", tubes: [M.lemon!, M.redWhite!, M.gumBlue!], ledge: true, iceTop: 126 });
export const SHOP_GINGER_SIDE_B = bayDef("side-b", 10, { bins: [M.orange!, M.spearmint!], lids: "or", tubes: [M.gumMix!, M.grape!, M.mint!], ledge: true, iceTop: 124 });
export const SHOP_GINGER_SIDE_C = bayDef("side-c", 11, { bins: [M.choc!, M.jelly!], lids: "tp", tubes: [M.sour!, M.blueWhite!, M.gumRed!], ledge: true, iceTop: 120 });
export const SHOP_GINGER_SIDE_D = bayDef("side-d", 12, { bins: [M.gumYellow!, M.redWhite!], lids: "gy", tubes: [M.pinkWhite!, M.lemon!, M.sprinkle!], ledge: true, iceTop: 114 });
const [SIGN_W, SIGN_E] = signBoth();
export const SHOP_GINGER_SIGN_W = def("bay-sign-w", [1, 1], CARD, H, [22, F], [[whole(SIGN_W, true)]]);
export const SHOP_GINGER_SIGN_E = def("bay-sign-e", [1, 1], CARD, H, [22, F], [[whole(SIGN_E, true)]]);

// ==== The stairs: a little wooden staircase at each end of the catwalk, curving with the wall, two squares, eight 5 px steps from
//      the floor up to the deck (40). Candy-cane banisters on the open side, running on into the catwalk's edge.

/** An ice wall card (45 px): blocks up to its top, which slopes from `topL` at its west edge to `topR` at its east (the dome coming
 * down toward you round the sides), a frosted lip with icicles, frost creeping up from the foot. */
function iceWall(seed: number, topL: number, gx: number, topR = topL): Cv {
  const c = cv(CARD, H);
  for (let x = 0; x < CARD; x++) {
    const top = Math.round(topL + ((topR - topL) * x) / (CARD - 1));
    for (let h = 0; h <= top; h++) put(c, x, yOf(h), iceBlock(gx + x, yOf(h), 10, 16, seed));
    put(c, x, yOf(top), hash(x, 0, seed) < 0.6 ? "*" : "~");
    if (x % 2 === 0 && hash(x >> 1, 0, seed) > 0.45) {
      const len = 2 + Math.floor(hash(x, 1, seed) * 5);
      for (let j = 1; j <= len && top - j > 2; j++) put(c, x, yOf(top - j), j === len ? "~" : "*");
    }
    for (let h = 0; h < 3 + Math.floor(hash(x >> 1, 9, seed) * 4); h++) put(c, x, yOf(h), h === 0 ? "c" : hash(x, h, seed) < 0.5 ? "C" : "*");
  }
  return c;
}
/** A step's block: its riser face from the floor to `h` (wood, a plank line every 5 px), its tread on top (lit, seen from above,
 * `deep` px: a deeper one is a landing running back), x0..x1. */
function stepBlock(c: Cv, x0: number, x1: number, h: number, deep = 3) {
  for (let x = x0; x <= x1; x++)
    for (let y = yOf(h) - deep + 1; y <= F; y++) {
      const hh = F - y;
      const tread = hh > h - 1;
      put(c, x, y, tread ? (hh === h + deep - 1 ? "v" : hh === h ? "u" : (x - x0) % 7 === 3 && deep > 3 ? "u" : "U") : x === x0 ? "v" : x === x1 ? "w" : hh % 5 === 0 ? "w" : hh < 3 ? "V" : "u");
    }
  put(c, x0, yOf(h) - deep + 1, "~"); // frost on its front corner
}
/** Candy-cane banister: a post on each step's front (`[x, h]`: its foot on the tread), a rail 11 px over the treads from post to post. */
function banister(c: Cv, posts: readonly [number, number][]) {
  for (let i = 0; i < posts.length; i++) {
    const [x, h] = posts[i]!;
    for (let j = 1; j <= 11; j++) put(c, x, yOf(h + j), Math.floor((h + j) / 2) % 2 ? "r" : "x");
    const nxt = posts[i + 1];
    if (nxt) {
      const [x2, h2] = nxt;
      const n = Math.abs(x2 - x) || 1;
      for (let st = 0; st <= n; st++) {
        const xx = x + Math.sign(x2 - x) * st;
        const hh = h + 11 + ((h2 - h) * st) / n;
        put(c, xx, yOf(Math.round(hh)), Math.floor(st / 2) % 2 ? "r" : "x");
        put(c, xx, yOf(Math.round(hh)) + 1, "R");
      }
    }
  }
}
/** The stairs' step height (px), and each quarter of a stair card's lift (west to east, across its square's 37 px: x 4-12, 13-21, 22-30, 31-40). */
export const SHOP_GINGER_STEP = 5;
const QX = [[0, OV + 8], [OV + 9, OV + 17], [OV + 18, OV + 26], [OV + 27, CARD - 1]] as const;
const LO_W = [5, 10, 15, 20] as const; // the west stairs' low square (5, 5): rising eastward from its foot (5, 6)
const HI_W = [25, 30, 35, 40] as const; // its high square (6, 5): on up eastward to the deck (40) on (7, 5)
/**
 * The west staircase (Nov 5, redrawn so it plainly joins): **one straight flight on the catwalk's own row**, (5, 5) and (6, 5),
 * eight steps of 5 px, a quarter of a square each, rising eastward from its foot on the floor at (5, 6) to its top step, level with
 * the deck and drawn as the deck (the same planks, the same candy-cane edge), which runs on into the catwalk at (7, 5). Both its
 * cards stand on the same row as the catwalk's, so the flight is one piece from the camera and laid out flat. Every step is a solid
 * wooden block down to the floor (no gap under it); one candy-cane banister runs unbroken from the foot along the steps and onto the
 * deck's candy-cane edge. Behind it the candy wall: the bins' cabinet, the tubes on their shelf, the top shelf, the dome's ice. The
 * east one is these mirrored, on (14, 5) and (13, 5).
 */
/** The banister's rail height (px over the floor) along the flight, by px along it from the low square's west edge (0) to the high square's east edge (74). */
const railH = (g: number) => 16 + Math.max(0, Math.min(1, (g - 2) / 68)) * 35;
function stairCard(hi: boolean, seed: number, tubes: readonly Mix[]): Cv {
  const c = bayCard(seed, { lower: "none", tubes, ledge: true });
  // The wall behind the steps: the cabinet's dark wood, from the floor up to the tubes' shelf (no deck band but at the top step).
  for (let x = 0; x < CARD; x++) for (let h = 0; h < LEDGE.foot; h++) put(c, x, yOf(h), h < 5 ? (Math.floor((x + h) / 3) % 2 ? "r" : "x") : x % 18 === OV ? "w" : "V");
  const steps = hi ? HI_W : LO_W;
  QX.forEach(([a, b], i) => {
    if (hi && i === 3) return;
    stepBlock(c, a, b, steps[i]!, 3);
  });
  if (hi) {
    // The top step is the deck itself: its plank face and lit top (the catwalk's), on a solid wooden support down to the floor.
    const d = cv(CARD, H);
    deck(d, seed, true);
    d.forEach((row, y) => row.forEach((k, x) => k !== "." && x >= QX[3][0] && put(c, x, y, k)));
    for (let x = QX[3][0]; x < CARD; x++) for (let h = 0; h < DECK.face; h++) put(c, x, yOf(h), x === QX[3][0] ? "v" : h % 5 === 0 ? "w" : h < 3 ? "V" : "u");
  } else {
    // Snow drifted at its foot, where it meets the floor.
    for (let x = 0; x < OV + 9; x++) for (let h = 0; h < 2 + (x % 3 === 0 ? 1 : 0); h++) put(c, x, yOf(h), h ? "4" : "3");
  }
  // The banister: posts at each step's middle, one rail along the whole flight (the same line on both cards), its last post on the deck's edge.
  const g0 = hi ? T : 0; // px along the flight at this card's square's west edge
  for (let x = 0; x < CARD; x++) {
    const g = g0 + x - OV;
    if (g < 1 || g > 2 * T + OV - 1) continue;
    const hh = Math.round(railH(g));
    put(c, x, yOf(hh), Math.floor(g / 2) % 2 ? "r" : "x");
    put(c, x, yOf(hh) + 1, "R");
  }
  const posts = hi ? [OV + 4, OV + 13, OV + 22, CARD - 1] : [OV + 1, OV + 13, OV + 22, OV + 31];
  posts.forEach((x, i) => {
    const step = hi && i === 3 ? DECK.top - 1 : steps[Math.min(3, i)]!;
    const top = Math.round(railH(g0 + x - OV));
    for (let h = step + 1; h < top; h++) put(c, x, yOf(h), Math.floor(h / 2) % 2 ? "r" : "x");
  });
  return c;
}
const STAIR_LO = stairCard(false, 21, [M.gumRed!, M.lemon!, M.blueWhite!]);
const STAIR_HI = stairCard(true, 22, [M.sprinkle!, M.gumYellow!, M.jelly!]);
export const SHOP_GINGER_STAIR_LO = def("stair-lo", [1, 1], CARD, H, [22, F], [[whole(STAIR_LO, true)]]);
export const SHOP_GINGER_STAIR_HI = def("stair-hi", [1, 1], CARD, H, [22, F], [[whole(STAIR_HI, true)]]);

/** A frost flower (a big snowflake etched on the ice). */
function frostFlower(c: Cv, cx: number, cy: number, seed: number) {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + hash(seed, 0, 1);
    for (let s = 1; s < 7; s++) put(c, Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s), s % 3 === 0 ? "*" : "C");
  }
  put(c, cx, cy, "*");
}
/** The dome's ice walls toward you (the candy stops at row 11): their tops by row, sloping down from the back to the front. */
const ICE_TOP: Record<number, number> = { 12: 72, 13: 46, 14: 28, 15: 22, 16: 20, 17: 18, 18: 16 };
const iceTop = (r: number) => ICE_TOP[Math.max(12, Math.min(18, r))]!;
/** An ice card for row `r` (its top sloping from the row behind's height at its back edge to its own at its front edge). */
const iceDef = (name: string, r: number, seed: number, more?: (c: Cv) => void) => {
  const back = r === 12 ? 100 : iceTop(r - 1);
  const c = iceWall(seed, Math.round((iceTop(r) + iceTop(r + 1)) / 2), seed * 41, Math.round((back + iceTop(r)) / 2));
  more?.(c);
  return def(name, [1, 1], CARD, H, [22, F], [[whole(c, true)]]);
};
export const SHOP_GINGER_ICE_12 = iceDef("ice-12", 12, 31, (c) => frostFlower(c, 26, yOf(44), 32));
/** A carved ice lantern in a niche, a warm candle inside (a light): on row 12, where the candy wall ends. */
export const SHOP_GINGER_ICE_LAMP = iceDef("ice-lamp", 12, 33, (c) => {
  for (let h = 30; h <= 56; h++)
    for (let x = 13; x <= 31; x++) {
      const u = (x - 22) / 9;
      const arch = 50 + Math.round(6 * Math.sqrt(Math.max(0, 1 - u * u)));
      if (h > arch) continue;
      put(c, x, yOf(h), x === 13 || x === 31 || h === arch ? "a" : "A");
    }
  rect(c, 17, yOf(50), 11, 15, (i, j) => (i === 0 || j === 0 ? "C" : i === 10 || j === 14 ? "b" : j > 5 && j < 12 && i > 3 && i < 7 ? (j < 8 ? "F" : "f") : "c"));
});
export const SHOP_GINGER_ICE_13 = iceDef("ice-13", 13, 34);
export const SHOP_GINGER_HEM = iceDef("hem", 14, 35);
export const SHOP_GINGER_HEM_15 = iceDef("hem-15", 15, 39);
export const SHOP_GINGER_TUNNEL = iceDef("tunnel", 16, 36);
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
const CH = 38;
const C_TOP = 10; // its top's front edge, px over its foot (low: the gnome-ish shopkeeper's head and beard show over it)
const CF = 28; // its foot row (its round front's foot: 4 px south of row 6's middle... drawn at the square's middle, see footOf)
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
const BAYS = ["bay-b", "bay-door", "bay-door-open", "bay-c", "bay-d", "bay-corner", "bay-sign-w", "bay-sign-e", "stair-hi"];
const SIDES = ["side-a", "side-b", "side-c", "side-d", "side-corner"];
/** The catwalk's bulbs on every bay (warm, a soft halo), the ice lanterns, the doorway's night, the stockroom (when its door opens). */
export const SHOP_GINGER_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  ...BAYS.filter((b) => b !== "stair-hi").map((piece) => ({ piece, x: 0, y: yOf(DECK.face + 6), w: CARD, h: 5, keys: "F", color: WARM, strength: 0.7, halo: 8 })),
  { piece: "ice-lamp", x: 17, y: yOf(50), w: 11, h: 15, keys: "Ff", color: WARM, strength: 1, flicker: true, halo: 26 },
  { piece: "entrance", x: 10, y: 6, w: EW - 20, h: EH - 30, keys: "Ej*", color: ICE, strength: 0.4 },
  { piece: "bay-door-open", x: 9 + OV, y: yOf(28), w: 19, h: 27, keys: "JNf", color: WARM, strength: 0.6, halo: 14 },
];
/** ... and pools on the floor: warm along the bays' foot, cool on the battle spot's ice, cool before the doorway. */
export const SHOP_GINGER_POOLS: readonly (LightPool & { piece: string })[] = [
  ...[...BAYS, ...SIDES].map((piece) => ({ piece, x: 22, y: F + 10, rx: 26, ry: 9, color: WARM, strength: 0.18 })),
  { piece: "ice-lamp", x: 22, y: F + 8, rx: 34, ry: 12, color: WARM, strength: 0.25 },
  { piece: "entrance", x: EW / 2, y: EH - 4, rx: 30, ry: 9, color: ICE, strength: 0.2 },
];
/** The battle spot's own cool shine (a pool on the floor at the table's spot, in the room's squares). */
export const SHOP_GINGER_ICE_POOL = { at: [9.5, 9.5], rx: ZX, ry: ZY * 0.9, color: ICE, strength: 0.16 } as const;

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
/** A wall square (next to the floor, or touching it at a corner): its tile shows in front of its card, inside the room. */
const ringSq = (c: number, r: number) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dc, dr]) => isOpen(c + dc!, r + dr!));
/** The squares under the back curve's bays and stairs: wooden floor boards there (the cabinets' and the steps' footing). */
const BAY_ROW = new Set(["5,5", "6,5", "7,5", "7,4", "8,4", "9,4", "10,4", "11,4", "12,4", "12,5", "13,5", "14,5"]);
/** Planks (the boards under the cabinets), running across, a dark seam every 6 px, a candy-trim kick board along their north edge. */
const planks = (x: number, y: number) => (y < 3 ? (Math.floor(x / 3) % 2 ? "r" : "x") : y % 6 === 0 ? "w" : hash(x >> 2, y, 7) < 0.15 ? "U" : "u");
/** Snow at a wall's foot: the floor's snow, a shade bluer toward the wall (north). */
const snowEdge = (gx: number, gy: number, ly: number) => (ly < 6 ? (hash(gx, gy, 3) < 0.5 ? "2" : "1") : ly < 14 ? (hash(gx, gy, 4) < 0.35 ? "2" : "3") : snow(gx, gy, 1));
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const k = `${col},${row}`;
    if (!isOpen(col, row)) {
      if (row >= 18) tileDef(`floor-out-${col}-${row}`, (x, y) => nightSnow(col * T + x, row * T + y)), at(`floor-out-${col}-${row}`, col, row, false);
      else if (ringSq(col, row)) tileDef(`floor-ice-${col}-${row}`, (x, y) => (BAY_ROW.has(`${col},${row}`) ? planks(x, y) : snowEdge(col * T + x, row * T + y, y))), at(`floor-ice-${col}-${row}`, col, row, false);
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
  ["stair-lo", 5, 5],
  ["stair-hi", 6, 5],
  ["bay-b", 7, 5],
  ["bay-door", 8, 4],
  ["bay-sign-w", 9, 4],
  ["bay-sign-e", 10, 4],
  ["bay-c", 11, 4],
  ["bay-d", 12, 5],
  ["stair-hi", 13, 5, true],
  ["stair-lo", 14, 5, true],
];
const placedWall = new Set<string>();
for (const [name, c, r, flip] of BACK) at(name, c, r, true, flip ? { flip: true } : {}), placedWall.add(`${c},${r}`);
// The two back corners behind the curve's steps (so no gap shows between the bays), the stairs' back corners.
// The candy wall goes on round both sides (side bays, a plain ledge, no catwalk), rows 5 to 11.
const SIDE_RUN: [string, number, number][] = [["side-corner", 4, 5], ["side-corner", 4, 6], ["side-corner", 4, 7], ["side-a", 4, 8], ["side-b", 4, 9], ["side-c", 4, 10], ["side-d", 4, 11]];
for (const [name, c, r, flip] of [["bay-corner", 7, 4], ["bay-corner", 12, 4, true], ...SIDE_RUN, ...SIDE_RUN.map(([n, c, r]) => [n, 19 - c, r, true])] as [string, number, number, boolean?][])
  at(name, c, r, true, flip ? { flip: true } : {}), placedWall.add(`${c},${r}`);
// The rest of the ring: the dome's ice coming down toward you (an ice lantern on each side at row 12), the tunnel's walls, the doorway.
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    const k = `${col},${row}`;
    if (isOpen(col, row) || placedWall.has(k)) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dc, dr]) => isOpen(col + dc!, row + dr!) && !(row + dr! >= 18));
    if (!near) continue;
    const east = col > MID;
    const flip = east ? { flip: true } : {};
    if (row >= 16) at("tunnel", col, row, true, flip);
    else if (row === 15) at("hem-15", col, row, true, flip);
    else if (row === 14) at("hem", col, row, true, flip);
    else if (row === 13) at("ice-13", col, row, true, flip);
    else at(col === 5 || col === 14 ? "ice-lamp" : "ice-12", col, row, true, flip);
  }
at("entrance", 9, 18, false, { exit: true });

// -- On the floor.
at("counter", 9, 6, true); // the shopkeeper's half-round stand, the Boss Crate on it (SHOP_GINGER_CRATE_AT)
at("crate", 9, 6, false); // (its place is the stand's: drawn on its top)
at("barrel-canes", 5, 11, true);
at("barrel-mint", 14, 11, true);
at("sack", 6, 12, true);
at("barrel-gum", 13, 12, true);
at("barrel-candy", 7, 13, true);
at("barrel-canes-b", 12, 13, true);
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
    { c: 7, r: 5 },
    { c: 8, r: 4 },
    { c: 9, r: 4 },
    { c: 10, r: 4 },
    { c: 11, r: 4 },
    { c: 12, r: 5 },
  ],
} as const;
/**
 * The two staircases, each one straight flight on the catwalk's row: the floor square at its foot (in front of its low square), its
 * two squares (low, high) with the lift of each quarter of the square (west to east, a quarter of its 37 px each: x 4-12, 13-21,
 * 22-30, 31-40 of its 45 px card), and the catwalk square at its top. Eight steps of SHOP_GINGER_STEP (5 px); the top quarter is
 * level with the deck (40) and joins it. The east one is the west one mirrored.
 */
export const SHOP_GINGER_STAIRS = {
  step: SHOP_GINGER_STEP,
  west: {
    foot: { c: 5, r: 6 },
    squares: [
      { c: 5, r: 5, quarters: [...LO_W] }, // entered from the south (its foot) at its west quarter, 5; 10, 15, 20 going east
      { c: 6, r: 5, quarters: [...HI_W] }, // 25, 30, 35, 40 going east; its east quarter is the deck
    ],
    top: { c: 7, r: 5 },
  },
  east: {
    foot: { c: 14, r: 6 },
    squares: [
      { c: 14, r: 5, quarters: [...LO_W].reverse() }, // entered from the south at its east quarter, 5; 10, 15, 20 going west
      { c: 13, r: 5, quarters: [...HI_W].reverse() }, // 25, 30, 35, 40 going west; its west quarter is the deck
    ],
    top: { c: 12, r: 5 },
  },
} as const;
/**
 * The dispensers: each bay's square and what it holds (two bins below, three tubes above); every chute's foot is
 * SHOP_GINGER_CHUTES (lower: 11 px over the floor at x 13 and 31 of its 45 px card; upper: 53 px over the floor at x 10, 22 and 34).
 */
export const SHOP_GINGER_DISPENSERS = [
  { piece: "bay-b", c: 7, r: 5, lower: 2, upper: 3 },
  { piece: "bay-door", c: 8, r: 4, lower: 0, upper: 3 },
  { piece: "bay-c", c: 11, r: 4, lower: 2, upper: 3 },
  { piece: "bay-d", c: 12, r: 5, lower: 2, upper: 3 },
] as const;

// -- The dispensing pair's loop (elf A with the box, elf B with the notepad).

/** Px across a (45 px) card into squares from its middle. */
const across = (x: number) => (x - OV - 18.5) / T;
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
 * half a square behind. Five on the lower row (west to east, round the stand's front), up the east stairs (one flight on the
 * catwalk's row), five on the upper row (east to west, over the stand), down the west stairs; then again.
 */
const RAW_PATH: Stop[] = [
  { at: [4.85, 6.3], lvl: "floor", h: 0 }, // the west stairs' foot (5, 6): the loop's start
  lowStop(7, 5, 0, "bay-b"), // L1: bay-b's west bin (sours)
  lowStop(7, 5, 1, "bay-b"), // L2: bay-b's east bin (peppermints)
  { at: [8, 7.2], lvl: "floor", h: 0 }, // round the stand's front (it and the shopkeeper are on rows 5-6, columns 9-10)
  { at: [11, 7.2], lvl: "floor", h: 0 },
  lowStop(11, 4, 1, "bay-c"), // L3: bay-c's east bin (chocolates)
  lowStop(12, 5, 0, "bay-d"), // L4: bay-d's west bin (lemon drops)
  lowStop(12, 5, 1, "bay-d"), // L5: bay-d's east bin (pink and white beans)
  { at: [14.3, 6.2], lvl: "floor", h: 0 }, // the east stairs' foot (14, 6)
  { at: [14.3, 5], lvl: "floor", h: 5 }, // up: onto the low square's east quarter (5), then west: 10, 15, 20
  { at: [12.62, 5], lvl: "up", h: 40 }, // across the high square (25, 30, 35) onto its deck quarter (40)
  upStop(12, 5, 1, "bay-d"), // U1: bay-d's middle tube
  { at: [11.5, 4.5], lvl: "up", h: 40 }, // round the curve (between (12, 5) and (11, 4))
  upStop(11, 4, 1, "bay-c"), // U2: bay-c's middle tube
  { at: [9.5, 4], lvl: "up", h: 40 }, // over the stand, behind the CANDY sign's posts
  upStop(8, 4, 1, "bay-door"), // U3: over the stockroom door, its middle tube
  { at: [7.5, 4.5], lvl: "up", h: 40 }, // round the curve (between (8, 4) and (7, 5))
  upStop(7, 5, 1, "bay-b"), // U4: bay-b's middle tube
  upStop(7, 5, 0, "bay-b"), // U5: bay-b's west tube
  { at: [6.38, 5], lvl: "up", h: 40 }, // the west stairs' top (the high square's deck quarter)
  { at: [4.65, 5], lvl: "floor", h: 5 }, // down the flight westward: 35, 30, 25, 20, 15, 10, 5
  { at: [4.85, 6.3], lvl: "floor", h: 0 }, // off its foot onto the floor: back at the start
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
    { at: [6.0, 8.6], pause: 1400 },
    { at: [6.0, 11.3], pause: 0 },
    { at: [6.9, 12.2], pause: 1800 },
    { at: [6.0, 11.3], pause: 0 },
  ],
  green: [
    { at: [12.8, 8.4], pause: 1600 },
    { at: [12.3, 7.2], pause: 0 },
    { at: [9.0, 7.2], pause: 1200 },
    { at: [12.3, 7.2], pause: 0 },
  ],
  blue: [
    { at: [11.6, 12.4], pause: 1500 },
    { at: [12.4, 11.4], pause: 0 },
    { at: [13.0, 9.4], pause: 1300 },
    { at: [12.4, 11.4], pause: 0 },
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
export const SHOP_GINGER_CARD = { w: CARD, h: H, foot: [22, F], over: OV } as const;
export type { LightPool, LightSpot };
