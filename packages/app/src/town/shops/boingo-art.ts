/**
 * Inside Boingo's Funhouse (Nov 6): an arcade fun place, drawn by hand in code. A box room of 24 x 24 squares (larger than the other
 * rooms: Eric, Nov 6, "it can be larger than the other rooms, we'll add more"), seen as the town square is seen (the camera looks
 * north, things stand upright at their foot, 37 px a square), built as Folio's and Hollow's shops are: every piece its own
 * Character (`shop-boingo-<name>`), the layout, the lights.
 *
 * WIP (Nov 6, paused at the usage reset): the floor, the marquee walls, the battle mat and its marks, the prize counter, the prize
 * wall, the pogo on its pedestal under a spotlight with its price sign, the crate, the play structure with its spiral slide, the
 * ball pit, the spinning light game, the roll-ball lanes, the squirt race and the claw machine. Not yet wired into SHOPS (no
 * Shopkeeper sheet yet). No real brands, mascots or venues: generic names only.
 *
 * Boingo's colors: characters/clown.ts CLOWN_PALETTE, with the arcade's own (carpet, chrome, glass, bulbs) added.
 */
import { BOSS_CRATE_PRICE } from "@chessroyale/core";
import type { Character, Frame, Part } from "../../characters/sprite.ts";
import { CLOWN_PALETTE } from "../../characters/clown.ts";
import type { LightPool, LightSpot } from "../houses/kit.ts";
import { crop, cv, ellipse, hash, line, put, rect, type Cv, type Pt } from "./paper-kit.ts";
import type { ShopPlace } from "./room.ts";

const T = 37;
/** The room's size in squares. */
export const SHOP_BOINGO_N = 24;

/** CLOWN_PALETTE plus the arcade's own keys. */
export const FUN_PALETTE: Record<string, string> = {
  ...CLOWN_PALETTE,
  // carpet: a deep night blue with confetti specks
  c: "#1c1640",
  C: "#2a2160",
  d: "#141030",
  // the battle mat: a bright carnival rug
  h: "#ff5aa8",
  H: "#c43a7f",
  i: "#36c6c0",
  I: "#22827e",
  // chrome, glass and the dark cabinets
  j: "#cfd6e4",
  J: "#8790a6",
  l: "#9fe3ff80",
  L: "#e8faff",
  v: "#2c2238",
  V: "#3e3150",
  // bulbs, lit and dim
  a: "#fff3b0",
  A: "#ffd04a",
  f: "#ff8fe0",
  F: "#7affc6",
  // nets and pads
  N: "#f2f2f2",
  G: "#2fa84f",
  x: "#ff9a3c",
  // the walls
  Z: "#3a1d4f",
  M: "#55286f",
  // spotlight wash (see-through)
  "-": "#fff6c840",
  "+": "#fff6c822",
};

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
  return { id: `shop-boingo-${p.name}`, name: `Boingo's Funhouse: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette: FUN_PALETTE, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Cv[], ms = 1000, outline = false): Character {
  PIECES[name] = { name, sq, w, h, foot, frames: frames.map((c) => [whole(c, outline)]), ms };
  return toChar(PIECES[name]!);
}
const whole = (c: Cv, outline = false): Bit => {
  const r = crop(c);
  return r ? { part: { grid: r.grid, outline }, at: r.at } : { part: { grid: ["."], outline }, at: [0, 0] };
};
/** An upright piece `sqW` squares wide, `h` px tall, its foot the middle of its width on its row. */
const upright = (name: string, sqW: number, sqD: number, h: number, frames: Cv[], ms = 1000, outline = true) =>
  def(name, [sqW, sqD], sqW * T, h, [Math.floor((sqW * T) / 2), h - 2], frames, ms, outline);

// ==== The floor: arcade carpet (night blue, confetti specks: the old kind of kids' arcade carpet), the battle mat a carnival rug.

const SPECK = ["y", "f", "F", "u", "r", "g"];
function carpet(seed: number): Cv {
  const c = cv(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const h = hash(x, y, seed);
      c[y]![x] = h < 0.035 ? SPECK[Math.floor(hash(y, x, seed + 3) * SPECK.length)]! : h < 0.3 ? "C" : "c";
    }
  // a few squiggles and stars
  for (let k = 0; k < 3; k++) {
    const sx = Math.floor(hash(k, seed, 7) * 30) + 3;
    const sy = Math.floor(hash(seed, k, 9) * 30) + 3;
    const col = SPECK[(k + seed) % SPECK.length]!;
    for (let t = 0; t < 6; t++) put(c, sx + t, sy + Math.round(Math.sin(t) * 1.5), col);
  }
  return c;
}
const tile = (name: string, c: Cv) => def(name, [1, 1], T, T, [18, 18], [c]);
for (let s = 0; s < 4; s++) tile(`floor-${s}`, carpet(11 + s * 7));

/** The battle mat: 6 x 6 squares (columns 9-14, rows 9-14), pink and teal stripes in a ring, a gold edge, the two marks. */
export const MAT = { c0: 9, r0: 9, c1: 14, r1: 14 } as const;
/** The marks: Boingo's west (his red-and-gold star), yours east (a gold ring with a pawn), on the mat's middle line. */
export const SHOP_BOINGO_MARKS = { boss: [10, 11.5], you: [13, 11.5] } as const;
function matTile(col: number, row: number): Cv {
  const c = cv(T, T);
  const mx = ((MAT.c0 + MAT.c1 + 1) / 2) * T;
  const my = ((MAT.r0 + MAT.r1 + 1) / 2) * T;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const gx = col * T + x;
      const gy = row * T + y;
      const edge = gx < MAT.c0 * T + 4 || gx >= (MAT.c1 + 1) * T - 4 || gy < MAT.r0 * T + 4 || gy >= (MAT.r1 + 1) * T - 4;
      if (edge) {
        c[y]![x] = (Math.floor((gx + gy) / 6) & 1) === 0 ? "y" : "Y";
        continue;
      }
      const d = Math.hypot(gx - mx, (gy - my) * 1.05);
      const band = Math.floor(d / 14);
      const ang = Math.atan2(gy - my, gx - mx);
      const ray = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 16) & 1;
      c[y]![x] = band % 2 === 0 ? (ray ? "h" : "H") : ray ? "i" : "I";
      if (d < 18) c[y]![x] = "y";
    }
  // the marks
  const mark = (mc: number, mr: number, boss: boolean) => {
    const cx = (mc + 0.5) * T - col * T;
    const cy = (mr + 0.5) * T - row * T;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= 13 && d < 16) c[y]![x] = boss ? "r" : "y";
        if (boss && d < 9) {
          const a = Math.atan2(y - cy, x - cx);
          const star = 5 + 4 * Math.cos(5 * a);
          if (d < star) c[y]![x] = "y";
        }
        if (!boss && Math.abs(x - cx) < 3 && y - cy > -8 && y - cy < 7) c[y]![x] = "w";
        if (!boss && Math.abs(y - cy - 6) < 2 && Math.abs(x - cx) < 6) c[y]![x] = "w";
        if (!boss && Math.hypot(x - cx, y - cy + 8) < 3.5) c[y]![x] = "w";
      }
  };
  // (A room's (c, r) is the middle of its square: the pixel (c + 0.5, r + 0.5) squares in, as Folio's marks.)
  mark(SHOP_BOINGO_MARKS.boss[0], SHOP_BOINGO_MARKS.boss[1], true);
  mark(SHOP_BOINGO_MARKS.you[0], SHOP_BOINGO_MARKS.you[1], false);
  return c;
}
for (let r = MAT.r0; r <= MAT.r1; r++) for (let col = MAT.c0; col <= MAT.c1; col++) tile(`ring-${col}-${r}`, matTile(col, r));

// ==== The walls: purple with a harlequin band, a marquee of bulbs along the top that chase (3 frames).

const WALL_H = 130;
function wallCv(f: number, seed: number): Cv {
  const c = cv(T, WALL_H);
  for (let y = 0; y < WALL_H; y++)
    for (let x = 0; x < T; x++) {
      const diamond = ((Math.floor((x + y) / 9) + Math.floor((x - y + 90) / 9)) & 1) === 1;
      c[y]![x] = y < 14 ? "v" : y < 22 ? "y" : y > WALL_H - 18 ? "P" : diamond ? "M" : "Z";
      if (y === 22 || y === WALL_H - 18) c[y]![x] = "Y";
    }
  // marquee bulbs: every 6 px, every third lit in turn
  for (let i = 0; i < 6; i++) {
    const bx = 3 + i * 6;
    const lit = (i + seed + f) % 3 === 0;
    ellipse(c, bx, 7, 2, 2, lit ? "a" : "A");
    if (lit) put(c, bx, 6, "L");
  }
  // a poster now and then
  if (seed % 3 === 1) {
    rect(c, 7, 40, 23, 30, "w");
    rect(c, 9, 42, 19, 26, seed % 2 ? "i" : "h");
    ellipse(c, 18, 52, 6, 6, "y");
    for (let k = 0; k < 5; k++) put(c, 12 + k * 3, 64, "w");
  }
  return c;
}
const BULB_MS = 260;
for (let s = 0; s < 3; s++) def(`wall-${s}`, [1, 1], T, WALL_H, [18, WALL_H - 1], [0, 1, 2].map((f) => wallCv(f, s)), BULB_MS);

/** The front's low band and the way out. */
const HEM_H = 24;
{
  const c = cv(T, HEM_H);
  rect(c, 0, 0, T, HEM_H, "Z");
  rect(c, 0, 0, T, 4, "y");
  for (let i = 0; i < 6; i++) ellipse(c, 3 + i * 6, 12, 2, 2, i % 2 ? "a" : "f");
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [c]);
}
{
  const c = cv(T, 8);
  rect(c, 0, 0, T, 8, "d");
  def("entrance", [1, 1], T, 8, [18, 7], [c]);
}

// ==== The prize counter: a glass counter (4 squares), its shelves of small prizes behind the glass.

const CW = 4 * T;
const CH = 32;
function stuffy(c: Cv, x: number, y: number, body: string, dark: string) {
  ellipse(c, x, y, 4, 4, body);
  ellipse(c, x, y - 6, 3, 3, body);
  put(c, x - 3, y - 9, body);
  put(c, x + 3, y - 9, body);
  put(c, x - 1, y - 6, "k");
  put(c, x + 1, y - 6, "k");
  put(c, x, y - 4, dark);
}
const TOYS: readonly (readonly [string, string])[] = [["r", "R"], ["u", "P"], ["g", "G"], ["y", "Y"], ["h", "H"], ["i", "I"], ["o", "O"]];
function counterCv(): Cv {
  const c = cv(CW, CH);
  rect(c, 0, 10, CW, CH - 10, "J");
  rect(c, 2, 12, CW - 4, CH - 18, "l");
  rect(c, 0, 8, CW, 3, "j");
  rect(c, 0, CH - 6, CW, 6, "p");
  for (let x = 4; x < CW - 4; x += 8) stuffy(c, x + 2, 23, TOYS[(x >> 3) % TOYS.length]![0], TOYS[(x >> 3) % TOYS.length]![1]);
  // glass glints
  for (let k = 0; k < 4; k++) line(c, 10 + k * 36, 13, 14 + k * 36, 21, "L");
  return c;
}
export const SHOP_BOINGO_COUNTER = upright("counter", 4, 1, CH, [counterCv()]);
/** Where the crate sits on the counter (the counter's pixels). */
export const SHOP_BOINGO_CRATE_AT: Pt = [118, 10];

/** Boingo's Boss Crate: a red-and-gold striped box with a pompom, its lid bobbing (a crate's idle). */
function crateCv(lid: number): Cv {
  const c = cv(32, 32);
  rect(c, 3, 10, 26, 20, "r");
  for (let x = 3; x < 29; x += 6) rect(c, x, 10, 3, 20, "y");
  rect(c, 2, 8 - lid, 28, 4, "R");
  ellipse(c, 16, 5 - lid, 3, 3, "y");
  rect(c, 3, 28, 26, 2, "q");
  return c;
}
export const SHOP_BOINGO_CRATE = def("crate", [1, 1], 32, 32, [16, 30], [0, 0, 0, 0, 0, 1, 1, 0].map(crateCv), 200, true);

// ==== The prize wall: shelves of stuffed animals and goofy trinkets (repetitive is fine), up the back wall behind the counter.

const PW_H = 120;
function prizeWallCv(seed: number): Cv {
  const c = cv(T, PW_H);
  rect(c, 0, 0, T, PW_H, "V");
  for (let s = 0; s < 4; s++) {
    const y = 26 + s * 26;
    rect(c, 0, y, T, 3, "o");
    for (let k = 0; k < 4; k++) {
      const [b, d] = TOYS[(k + s + seed) % TOYS.length]!;
      const x = 5 + k * 9;
      if ((k + s + seed) % 3 === 2) {
        // a goofy trinket: a rubber duck, a slinky or a pair of joke glasses
        ellipse(c, x, y - 4, 3, 3, (k + seed) % 2 ? "y" : "j");
        put(c, x + 3, y - 5, "o");
      } else stuffy(c, x, y - 5, b, d);
    }
  }
  // the PRIZES banner
  rect(c, 0, 4, T, 12, "y");
  return c;
}
for (let s = 0; s < 2; s++) def(`prize-wall-${s}`, [1, 1], T, PW_H, [18, PW_H - 1], [prizeWallCv(s * 3)], 1000, true);

// ==== The centerpiece: Boingo's pogo stick on a pedestal under a spotlight cone, and its price sign beside it.

const PG_H = 150;
function pogoCv(): Cv {
  const c = cv(T * 2, PG_H);
  // the spotlight cone (see-through), from a lamp at the top
  for (let y = 6; y < PG_H - 20; y++) {
    const half = 4 + (y - 6) * 0.22;
    for (let x = Math.round(T - half); x <= Math.round(T + half); x++) put(c, x, y, Math.abs(x - T) < half * 0.6 ? "-" : "+");
  }
  rect(c, T - 6, 0, 12, 6, "t");
  ellipse(c, T, 6, 4, 2, "a");
  // the pedestal: velvet top, gold trim
  rect(c, T - 16, PG_H - 26, 32, 24, "p");
  rect(c, T - 18, PG_H - 28, 36, 4, "y");
  rect(c, T - 18, PG_H - 4, 36, 3, "Y");
  // the pogo: steel shaft, red frilly seat, handles, a spring
  rect(c, T - 1, 46, 3, 74, "s");
  line(c, T + 1, 46, T + 1, 120, "S");
  rect(c, T - 9, 54, 19, 3, "t");
  ellipse(c, T - 10, 55, 2, 2, "r");
  ellipse(c, T + 10, 55, 2, 2, "r");
  ellipse(c, T, 44, 7, 4, "r");
  for (let x = -7; x <= 7; x += 2) put(c, T + x, 48, "y");
  for (let k = 0; k < 6; k++) line(c, T - 4, 92 + k * 4, T + 4, 94 + k * 4, k % 2 ? "S" : "s");
  rect(c, T - 3, 118, 7, 3, "t");
  return c;
}
export const SHOP_BOINGO_POGO = def("pogo", [2, 1], 2 * T, PG_H, [T, PG_H - 2], [pogoCv()], 1000, false);
/** The sign's words, its price read from the crate settings (so it never drifts): "BOINGO'S POGO: 3 Boingo tokens". */
export const pogoSign = (tokens: number = BOSS_CRATE_PRICE.tokens): string => `BOINGO'S POGO: ${tokens} Boingo token${tokens === 1 ? "" : "s"}`;
export const POGO_SIGN = pogoSign();
/** The price sign: a gold board 2 squares wide on two posts, its face (`SIGN_FACE`, its pixels) where the room writes POGO_SIGN. */
const SIGN = { w: 2 * T, h: 66 } as const;
export const SIGN_FACE = { x: 6, y: 6, w: 2 * T - 12, h: 30 } as const;
{
  const c = cv(SIGN.w, SIGN.h);
  rect(c, SIGN_FACE.x - 3, SIGN_FACE.y - 3, SIGN_FACE.w + 6, SIGN_FACE.h + 6, "r");
  rect(c, SIGN_FACE.x - 1, SIGN_FACE.y - 1, SIGN_FACE.w + 2, SIGN_FACE.h + 2, "y");
  rect(c, SIGN_FACE.x, SIGN_FACE.y, SIGN_FACE.w, SIGN_FACE.h, "w");
  // (Little bulbs round its red frame.)
  for (let x = SIGN_FACE.x - 2; x < SIGN_FACE.x + SIGN_FACE.w + 3; x += 5) (put(c, x, SIGN_FACE.y - 2, "a"), put(c, x, SIGN_FACE.y + SIGN_FACE.h + 1, "a"));
  rect(c, 14, SIGN_FACE.y + SIGN_FACE.h + 3, 3, SIGN.h - SIGN_FACE.h - 11, "t");
  rect(c, SIGN.w - 17, SIGN_FACE.y + SIGN_FACE.h + 3, 3, SIGN.h - SIGN_FACE.h - 11, "t");
  def("price-sign", [2, 1], SIGN.w, SIGN.h, [T, SIGN.h - 2], [c], 1000, true);
}
/** The sign's words, line by line, as the room writes them on its face: "BOINGO'S POGO" over "3 Boingo tokens". */
export const SIGN_LINES = (): [string, string] => {
  const [a, b] = pogoSign().split(": ");
  return [a!, b!];
};

// ==== The play structure: three levels of nets and padded platforms, a spiral slide down from the top, a flag waving at the top.

const PS_W = 4 * T;
const PS_H = 230;
function playCv(f: number): Cv {
  const c = cv(PS_W, PS_H);
  const levels = [PS_H - 50, PS_H - 110, PS_H - 170];
  // posts
  for (const x of [8, 70, 132]) rect(c, x, 40, 5, PS_H - 42, "i");
  // nets between levels (a diamond mesh)
  // (The top level is under the roof: nets between the ground, the first and the second.)
  for (let li = 0; li < 2; li++) {
    const y1 = levels[li]!;
    const y0 = y1 - 56;
    for (let y = y0; y < y1; y++) for (let x = 13; x < 70; x++) if ((x + y) % 7 === 0 || (x - y + 700) % 7 === 0) put(c, x, y, "N");
  }
  // padded platforms
  for (const y of levels) {
    rect(c, 6, y, 72, 8, "r");
    rect(c, 6, y, 72, 2, "h");
    for (let x = 10; x < 78; x += 12) put(c, x, y + 4, "R");
  }
  // the spiral slide: round from the top platform (east side) down to the ground, a yellow chute in loops
  for (let t = 0; t < 1; t += 0.002) {
    const y = levels[2]! + t * (PS_H - 8 - levels[2]!);
    const a = t * Math.PI * 5;
    const x = 104 + Math.cos(a) * 24;
    const front = Math.sin(a) > 0;
    ellipse(c, Math.round(x), Math.round(y), 6, 3, front ? "y" : "Y");
    put(c, Math.round(x), Math.round(y) - 2, "a");
  }
  // the slide's center pole
  rect(c, 102, levels[2]! - 6, 4, PS_H - levels[2]! + 4, "j");
  // roof and flag
  for (let y = 0; y < 40; y++) for (let x = 40 - y; x <= 40 + y; x++) put(c, x, y + 20, (x >> 3) & 1 ? "r" : "y");
  rect(c, 39, 2, 2, 20, "t");
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) put(c, 41 + x, 3 + y + Math.round(Math.sin(x / 3 + f) * 1.5), (y >> 1) % 2 ? "p" : "y");
  return c;
}
export const SHOP_BOINGO_PLAY = upright("play", 4, 3, PS_H, [0, 1.5, 3, 4.5].map(playCv), 220);

/** The ball pit at the structure's foot: balls bouncing (4 frames). */
function pitCv(f: number): Cv {
  const c = cv(3 * T, 40);
  rect(c, 0, 14, 3 * T, 26, "i");
  rect(c, 2, 16, 3 * T - 4, 18, "c");
  const cols = ["r", "y", "u", "g", "h", "p"];
  for (let k = 0; k < 40; k++) {
    const x = 4 + Math.floor(hash(k, 1, 4) * (3 * T - 8));
    const bounce = k % 7 === f || k % 7 === f + 3 ? -6 : 0;
    ellipse(c, x, 22 + Math.floor(hash(k, 2, 4) * 8) + bounce, 2, 2, cols[k % cols.length]!);
  }
  rect(c, 0, 34, 3 * T, 6, "I");
  return c;
}
export const SHOP_BOINGO_PIT = upright("ball-pit", 3, 1, 40, [0, 1, 2, 3].map(pitCv), 160, true);

// ==== The spinning light game: a half-dome cabinet whose ring of lights chases round, a big button in front.

const SL_W = 2 * T;
const SL_H = 110;
const RING = 16;
function spinCv(f: number): Cv {
  const c = cv(SL_W, SL_H);
  rect(c, 6, 50, SL_W - 12, SL_H - 52, "v");
  rect(c, 6, 50, SL_W - 12, 3, "y");
  // the dome
  for (let y = 0; y < 44; y++) for (let x = 4; x < SL_W - 4; x++) if (Math.hypot(x - T, (y - 48) * 0.9) < 33) put(c, x, y + 6, "V");
  // the ring of lights, one running round
  for (let i = 0; i < RING; i++) {
    const a = Math.PI + (i / (RING - 1)) * Math.PI;
    const x = Math.round(T + Math.cos(a) * 27);
    const y = Math.round(52 + Math.sin(a) * 30);
    const lit = i === f % RING;
    ellipse(c, x, y, lit ? 3 : 2, lit ? 3 : 2, lit ? "a" : i === RING >> 1 ? "r" : "A");
  }
  ellipse(c, T, 40, 6, 6, "y");
  // the big button
  ellipse(c, T, 70, 9, 5, "r");
  ellipse(c, T, 68, 6, 3, "h");
  return c;
}
export const SHOP_BOINGO_SPIN = upright("spin-game", 2, 1, SL_H, Array.from({ length: RING }, (_, f) => spinCv(f)), 70);

// ==== The roll-ball lanes: a cabinet each, its ramp up toward ringed targets, three along a wall.

const RB_H = 96;
function laneCv(f: number, seed: number): Cv {
  const c = cv(T, RB_H);
  rect(c, 2, 20, T - 4, RB_H - 22, "v");
  // the ringed targets at the top
  ellipse(c, 18, 30, 13, 9, "w");
  ellipse(c, 18, 30, 9, 6, "r");
  ellipse(c, 18, 30, 5, 3, "w");
  ellipse(c, 18, 30, 2, 1, "y");
  // the ramp (narrowing up)
  for (let y = 42; y < RB_H - 6; y++) {
    const half = 5 + (y - 42) * 0.18;
    for (let x = Math.round(18 - half); x <= Math.round(18 + half); x++) put(c, x, y, (y >> 2) % 2 ? "o" : "x");
  }
  // a ball rolling up, a frame each
  const by = RB_H - 12 - ((f + seed) % 6) * 9;
  ellipse(c, 18, by, 2, 2, "j");
  // the score lights on top
  rect(c, 4, 6, T - 8, 12, "k");
  for (let k = 0; k < 4; k++) put(c, 9 + k * 6, 12, (k + f) % 4 === 0 ? "F" : "g");
  return c;
}
for (let s = 0; s < 3; s++) upright(`lane-${s}`, 1, 1, RB_H, Array.from({ length: 6 }, (_, f) => laneCv(f, s * 2)), 180);

// ==== The water-squirt race: five little clowns on stools squirting into targets, the race track of little knights above,
// on a loop; every so often a knight wins, a light flashes and the race resets. A 6-square-wide cabinet along the back wall.

export const RACE = { players: 5, frames: 48, ms: 120, winAt: 40 } as const;
const SQ_W = 6 * T;
const SQ_H = 120;
const RACE_COLORS: readonly (readonly [string, string])[] = [["r", "R"], ["u", "P"], ["g", "G"], ["y", "Y"], ["h", "H"]];
/** How far each knight has run by frame `f` (0 to 1), the winner a different lane each race. */
export function raceAt(f: number, race: number): number[] {
  const t = Math.min(1, f / RACE.winAt);
  const win = race % RACE.players;
  return Array.from({ length: RACE.players }, (_, i) => (i === win ? t : t * (0.72 + 0.2 * hash(i, race, 5))));
}
function knight(c: Cv, x: number, y: number, k: string) {
  rect(c, x - 2, y - 6, 5, 6, k);
  rect(c, x - 3, y - 9, 5, 4, k);
  put(c, x + 2, y - 8, k);
  put(c, x - 1, y - 8, "k");
}
function littleClown(c: Cv, x: number, y: number, col: readonly [string, string], squirt: boolean) {
  // stool
  rect(c, x - 4, y - 4, 9, 2, "o");
  line(c, x - 3, y - 2, x - 3, y + 6, "O");
  line(c, x + 3, y - 2, x + 3, y + 6, "O");
  // body, ruff, face, hair, hat
  rect(c, x - 3, y - 12, 7, 8, col[0]);
  rect(c, x - 4, y - 13, 9, 2, "w");
  ellipse(c, x, y - 17, 3, 3, "w");
  put(c, x, y - 17, "r");
  put(c, x - 3, y - 19, col[1]);
  put(c, x + 3, y - 19, col[1]);
  put(c, x, y - 21, "y");
  // the water gun, aimed up at the target
  rect(c, x + 2, y - 11, 4, 2, "u");
  if (squirt) for (let k = 0; k < 8; k++) put(c, x + 5, y - 13 - k * 2, "b");
}
function raceCv(f: number): Cv {
  const c = cv(SQ_W, SQ_H);
  rect(c, 0, 0, SQ_W, 64, "v");
  rect(c, 0, 0, SQ_W, 4, "y");
  const race = Math.floor(f / RACE.frames);
  const ff = f % RACE.frames;
  const won = ff >= RACE.winAt;
  // the win light
  ellipse(c, SQ_W / 2, 8, 8, 4, won && ff % 2 === 0 ? "a" : "A");
  // the track: five lanes, a knight each
  const run = raceAt(ff, race);
  for (let i = 0; i < RACE.players; i++) {
    const y = 18 + i * 8;
    line(c, 8, y, SQ_W - 14, y, "V");
    rect(c, SQ_W - 12, y - 6, 2, 7, "w");
    knight(c, Math.round(10 + run[i]! * (SQ_W - 28)), y, RACE_COLORS[i]![0]);
  }
  // the counter and the targets, the cabinet's front down to the floor behind the players
  rect(c, 0, 64, SQ_W, 8, "p");
  rect(c, 0, 72, SQ_W, SQ_H - 74, "P");
  for (let x = 6; x < SQ_W; x += 12) ellipse(c, x, 78, 1.5, 1.5, "A");
  for (let i = 0; i < RACE.players; i++) {
    const x = Math.round(T * 0.6 + i * T * 1.1);
    ellipse(c, x + 6, 60, 4, 4, "w");
    ellipse(c, x + 6, 60, 2, 2, "r");
    littleClown(c, x, SQ_H - 8, RACE_COLORS[i]!, !won && (ff + i) % 3 !== 0);
  }
  return c;
}
/** The race's frames: two races (each a different winner) of RACE.frames. */
export const SHOP_BOINGO_RACE = upright("squirt-race", 6, 1, SQ_H, Array.from({ length: RACE.frames * 2 }, (_, f) => raceCv(f)), RACE.ms);

// ==== The claw machine: a solid cabinet, 2 x 2 squares, drawn by the room in 3D through its camera (shops/claw-cabinet.ts; Eric, Nov 6:
// "the real claw machine in the room, a big 3D arcade cabinet you walk up to"). Its piece here only holds its place (and its pool of
// light); its picture is a dot the room never draws.

export const SHOP_BOINGO_CLAW = def("claw", [2, 2], 2 * T, 4, [T, 2], [cv(1, 1).map((r) => r.map(() => "k"))], 1000, false);
/** The claw machine's place (its west-most column, its south-most row) and where you stand to play it (in front of its coin slot). */
export const SHOP_BOINGO_CLAW_AT = { col: 18, row: 6, w: 2, d: 2 } as const;
export const SHOP_BOINGO_CLAW_SPOT = { c: 19, r: 7 } as const;

// ==== The lights: the marquee bulbs, every game's glow, the spotlight on the pogo. Each lights at every place its piece stands.

export const SHOP_BOINGO_LIGHTS: readonly (LightSpot & { piece: string })[] = [
  ...[0, 1, 2].map((s) => ({ piece: `wall-${s}`, x: 0, y: 4, w: T, h: 7, keys: "aA", color: "#ffe9a0", strength: 0.5, halo: 10 })),
  { piece: "spin-game", x: 6, y: 18, w: SL_W - 12, h: 40, keys: "aAr", color: "#ffd04a", strength: 0.6, halo: 26 },
  ...[0, 1, 2].map((s) => ({ piece: `lane-${s}`, x: 4, y: 6, w: T - 8, h: 12, keys: "gF", color: "#7affc6", strength: 0.5, halo: 14 })),
  { piece: "squirt-race", x: SQ_W / 2 - 8, y: 4, w: 16, h: 8, keys: "aA", color: "#fff3b0", strength: 0.6, halo: 22 },
  { piece: "pogo", x: T - 4, y: 4, w: 8, h: 4, keys: "a", color: "#fff6c8", strength: 0.8, halo: 16 },
  { piece: "hem", x: 0, y: 8, w: T, h: 8, keys: "af", color: "#ff8fe0", strength: 0.35, halo: 8 },
];
export const SHOP_BOINGO_POOLS: readonly (LightPool & { piece: string })[] = [
  { piece: "pogo", x: T, y: PG_H + 6, rx: 30, ry: 10, color: "#fff6c8", strength: 0.35 },
  { piece: "spin-game", x: T, y: SL_H + 8, rx: 34, ry: 10, color: "#ffd04a", strength: 0.25 },
  { piece: "claw", x: T, y: 20, rx: 54, ry: 14, color: "#ff8fe0", strength: 0.3 },
  { piece: "squirt-race", x: SQ_W / 2, y: SQ_H + 8, rx: 90, ry: 10, color: "#62bdf5", strength: 0.2 },
];

// ==== The layout.

const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) throw new Error(`no piece ${name}`);
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};
const N = SHOP_BOINGO_N;
for (let row = 0; row < N; row++)
  for (let col = 0; col < N; col++) {
    if (col >= MAT.c0 && col <= MAT.c1 && row >= MAT.r0 && row <= MAT.r1) at(`ring-${col}-${row}`, col, row, false);
    else at(`floor-${Math.floor(hash(col, row, 2) * 4)}`, col, row, false);
  }
const FLOOR_COUNT = LAYOUT.length;
// -- The back wall: the marquee, the prize wall behind the counter (columns 8-13).
for (let col = 0; col < N; col++) at(col >= 8 && col <= 13 ? `prize-wall-${col % 2}` : `wall-${col % 3}`, col, 0, true);
// -- The side walls.
for (let row = 1; row < N - 1; row++) {
  at(`wall-${row % 3}`, 0, row, true);
  at(`wall-${(row + 1) % 3}`, N - 1, row, true, { flip: true });
}
// -- The front, the way out in its middle (columns 11 and 12).
for (let col = 0; col < N; col++) if (col !== 11 && col !== 12) at("hem", col, N - 1, true);
at("entrance", 11, N - 1, false, { exit: true });
at("entrance", 12, N - 1, false, { exit: true });
// -- The prize counter: the glass counter on row 3 (columns 9-12), the crate on it, the pogo behind on its pedestal, its sign.
at("counter", 9, 3, true);
at("crate", 9, 3, false);
at("pogo", 13, 2, true);
at("price-sign", 15, 2, true);
// -- The play structure (west, columns 1-4, rows 5-7) with the ball pit at its foot.
at("play", 1, 7, true);
at("ball-pit", 1, 8, true);
// -- The squirt race along the back wall's east end, the spinning light game, the claw machine.
at("squirt-race", 16, 1, true);
at("spin-game", 19, 11, true);
at("claw", SHOP_BOINGO_CLAW_AT.col, SHOP_BOINGO_CLAW_AT.row, true);
// -- The roll-ball lanes along the west wall's south end.
at("lane-0", 1, 15, true);
at("lane-1", 1, 17, true);
at("lane-2", 1, 19, true);

/** Where every piece goes: floor tiles first, then the upright pieces north to south. */
export const SHOP_BOINGO_LAYOUT: readonly ShopPlace[] = [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
/** Every piece by its name, each its own Character `shop-boingo-<name>`. */
export const SHOP_BOINGO_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));
