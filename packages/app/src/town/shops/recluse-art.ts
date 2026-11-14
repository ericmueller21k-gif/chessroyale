/**
 * The Hidden Boss's room (Nov 12, a MOCKUP for Eric; no home opens it yet): the top floor of an old Brooklyn walk-up, a 1950s child's
 * room. A box room of 9 x 9 squares (Nov 13, Eric: "shrink the room to actually feel snug... about half the square footage") seen as the other rooms are (the camera looks north, things stand upright at their foot, 37 px a
 * square), built as Smudgy's and Big Boy's are: every piece its own Character (`shop-recluse-<name>`), the layout. Drawn by hand in code.
 *
 * Eric (Nov 12, "Update 3"): "a little rocking horse in the corner, a little table with a chessboard, a poster on the wall, a kid's
 * play mat, a small bed in the corner, a window with light gleaming through." So: old honey oak floorboards, a braided rag rug in the
 * middle (his mat: the child sits on it with his board; the scene draws them, shops/recluse-scene.ts), the sun from the window lying
 * across the boards in two bright panes; faded cream wallpaper with little blue sailboats over a white baseboard and under a dark
 * picture rail; the window in the back wall, gingham curtains, the sky and the brick across the street; a rocket poster (no words);
 * a felt pennant (no letters); a small bed with a patchwork quilt in the north-east corner; a dappled rocking horse on red rockers in
 * the north-west corner; a little table with its own chessboard and two chairs; the door out to the dark stair hall in the front wall.
 *
 * Footing as the other rooms: a piece's foot is the middle of its square (a wide piece's: the middle of its width, on its row; a deep
 * piece stands on its south row). Floor tiles are flat, 37 x 37, foot at their middle, painted from one picture of the whole floor so
 * the rug and the sun run across them. The east wall's pieces are the west's mirrored.
 */
import type { Character, Frame, Part } from "../../characters/sprite.ts";
import type { LightPool, LightSpot } from "../houses/kit.ts";
import { cv, ellipse, face, hash, line, put, rect, shadow, stamp, type Cv, type Pt } from "./paper-kit.ts";
import type { ShopPlace } from "./room.ts";
import type { RoomLight } from "../sky.ts";

const T = 37;
/** The room's size in squares, each way (`RoomArt.n`). */
export const SHOP_RECLUSE_N = 9;

const PALETTE: Record<string, string> = {
  k: "#2a1a14", // outline
  // Old oak floorboards: the gap, dark, mid, lit; in the sun: mid, lit.
  "1": "#4a2e1c",
  "2": "#80522f",
  "3": "#97643a",
  "4": "#ad7a49",
  "5": "#d9a466",
  "6": "#ecc283",
  // Wallpaper: faded cream, its stripe, its shade; the sailboats' faded blue and their sails' red.
  a: "#eadfbd",
  b: "#ddd0a8",
  c: "#c4b68c",
  d: "#7f9fba",
  e: "#b8655a",
  // Painted trim (baseboard, window frame, door frame): white, its shade, its deep; the picture rail's dark wood.
  F: "#f4efe0",
  f: "#d5ccb3",
  g: "#a69c82",
  W: "#5a3620",
  w: "#83532f",
  // Light wood (bed, table, chairs): dark, mid, lit.
  K: "#8a5530",
  L: "#b47a45",
  M: "#d29c5e",
  // Gingham and the rockers' red: deep, mid, light; white.
  R: "#a8352c",
  r: "#d4574a",
  q: "#f0b0a4",
  // The sky through the window, high to low; the brick across the street, its mortar; the sun's glint.
  s: "#7fbbe6",
  S: "#a9d6f2",
  t: "#d7eefa",
  B: "#9c5038",
  C: "#c07a5a",
  Y: "#fff6cf",
  y: "#ffe28a",
  // The quilt's patches: blue, yellow, green (with the red); the pillow and sheet white.
  N: "#4f78b0",
  n: "#7ea3d4",
  O: "#e3b545",
  o: "#f2d47c",
  G: "#5f8f4f",
  h: "#8dbb73",
  // The rocking horse: dapple grey, light; mane and tail; its eye.
  H: "#e8e4dc",
  I: "#b8b3aa",
  J: "#4a3326",
  // The poster: the night sky, its stars; the rocket's cream and its fins' red; the planet's ring.
  P: "#1d2a4a",
  p: "#30446e",
  Q: "#f3e4bf",
  U: "#e88a3a",
  // The rug's braids: cream, rust, navy, moss (with their shades).
  i: "#e9dcc0",
  j: "#c9b99a",
  l: "#b4553c",
  m: "#8a3d2b",
  u: "#3b4d72",
  v: "#2a3754",
  x: "#7c8a4a",
  z: "#5c6836",
  // The braids in the sun (Nov 13, Eric: "almost shining on the rug a little bit more"): cream, rust, navy, moss, lit.
  "7": "#fbf1d8",
  "8": "#dc7a52",
  "9": "#5f74a0",
  "0": "#a3b067",
  // The chessboard on the table: light, dark.
  D: "#efe0bf",
  E: "#6b3f24",
  // The stair hall past the door: dark planks, the banister.
  V: "#2a1d14",
  X: "#3d2a1d",
  // Shadows on the floor (see-through): core, rim.
  "-": "#1a0e0866",
  "+": "#1a0e0833",
  // The view through the window (its own keys, recolored by the time of day: LIGHT_PALETTE): the sky high, mid and low; the brick across
  // the street and its mortar; its windows' glass (top, rest) and a lit one's (top, rest); the sun or moon (core, halo, the moon's
  // marks); glints on the glass, or the stars.
  "<": "#a9d6f2",
  ">": "#d7eefa",
  "^": "#7fbbe6",
  "#": "#9c5038",
  "=": "#c07a5a",
  "~": "#d7eefa",
  "!": "#7fbbe6",
  ";": "#ffe3a0",
  ":": "#f2c062",
  "*": "#fff6cf",
  "%": "#ffe28a",
  ",": "#d8d4c4",
  "&": "#fff6cf",
  "@": "#d7eefa",
};
/**
 * The room by the time of day (Nov 14, Eric: "it's always light in that room... the outside shining should be like a moon at night"):
 * the view's keys and the light's panes on the floor (`5`, `6` the boards; `7` to `0` the rug's braids) recolored. Day: as drawn above.
 */
const LIGHT_PALETTE: Readonly<Record<RoomLight, Readonly<Record<string, string>>>> = {
  day: {},
  // Dusk (and dawn): a purple-to-orange sky over the roofline, the brick across the street in shade, its glass catching the glow, one
  // window lit; the panes on the floor a warm orange, dimmer than the sun's.
  dusk: {
    "<": "#7a5f96",
    ">": "#e98e83",
    "^": "#f7b46e",
    "#": "#7a3d2e",
    "=": "#985b45",
    "~": "#f6c393",
    "!": "#b8705f",
    "*": "#fff1c4",
    "%": "#ffc77e",
    "&": "#ffdcae",
    "@": "#f2a98f",
    "5": "#c98250",
    "6": "#dc9a5e",
    "7": "#f3cfa6",
    "8": "#d4673f",
    "9": "#64648f",
    "0": "#a69a5a",
  },
  // Night: a deep blue sky, the moon and a few stars, the brick dark, two windows lit across the street; the panes on the floor pale,
  // cool moonlight, a little lighter than the boards round them.
  night: {
    "<": "#0c1430",
    ">": "#152147",
    "^": "#22325e",
    "#": "#3b2724",
    "=": "#4c3631",
    "~": "#1f2742",
    "!": "#18203a",
    "*": "#f6f2df",
    "%": "#aab6d6",
    ",": "#d3cdb8",
    "&": "#eef1ff",
    "@": "#8e9fcb",
    "5": "#9b8f97",
    "6": "#b3aab2",
    "7": "#d8d5dc",
    "8": "#a3716e",
    "9": "#5f6d98",
    "0": "#8f9a7e",
  },
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
function toChar(p: Piece, palette: Record<string, string> = PALETTE): Character {
  const parts: Record<string, Part> = {};
  const frames: Frame[] = p.frames.map((bits, f) => ({
    ms: p.ms,
    layers: bits.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] };
    }),
  }));
  return { id: `shop-recluse-${p.name}`, name: `The child's room: ${p.name}`, w: p.w, h: p.h, foot: p.foot, palette, parts, anims: { idle: { loop: true, frames } } };
}
function def(name: string, sq: readonly [number, number], w: number, h: number, foot: Pt, frames: Bit[][], ms = 1000): void {
  PIECES[name] = { name, sq, w, h, foot, frames, ms };
}
const whole = (c: Cv, outline = false): Bit => ({ part: { grid: c.map((r) => r.join("")), outline }, at: [0, 0] });

// ==== The floor: one picture of the whole room's floor (12 x 12 squares), cut into its tiles.

/** The rug (an oval braided rag rug) and the sun's two panes on the boards, in the floor's pixels. */
export const SHOP_RECLUSE_RUG = { c: 4.0, r: 3.85, rc: 2.05, rr: 1.55 } as const;
/** The window's column (2 wide) in the back wall; the sun's two panes on the floor fall from it, as in round 1, now across the rug. */
const WINDOW_COL = 3;
/**
 * The window's two panes on the floor by the time of day: the day's sun; dusk's low sun, the panes longer and leaning further; the
 * night's moon, a little shorter. Their colors are LIGHT_PALETTE's.
 */
const SUNS: Readonly<Record<RoomLight, { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly slant: number }>> = {
  day: { x0: (WINDOW_COL - 0.7) * T, x1: (WINDOW_COL + 1.6) * T, y0: 1 * T, y1: 4.6 * T, slant: 0.55 },
  dusk: { x0: (WINDOW_COL - 0.7) * T, x1: (WINDOW_COL + 1.6) * T, y0: 1 * T, y1: 6.3 * T, slant: 1.05 },
  night: { x0: (WINDOW_COL - 0.6) * T, x1: (WINDOW_COL + 1.5) * T, y0: 1 * T, y1: 4.2 * T, slant: 0.35 },
};
function floorPx(X: number, Y: number, light: RoomLight): string {
  const SUN = SUNS[light];
  // Boards running north to south, 9 px wide, their end joints staggered.
  const col = Math.floor(X / 9.25);
  const xx = X - Math.floor(col * 9.25);
  const joint = (Y + col * 41) % 111 === 0;
  let k = xx === 0 || joint ? "1" : col % 3 === 0 ? "2" : "3";
  if (k !== "1" && xx === 1) k = "4";
  else if (k !== "1" && hash(col, Y >> 2, 7) < 0.07) k = "2";
  else if (k !== "1" && hash(X, Y, 9) < 0.03) k = "4";
  // The sun through the window: two panes (the sash between them), slanting toward us and our right.
  const u = (Y - SUN.y0) / (SUN.y1 - SUN.y0);
  if (u >= 0 && u <= 1) {
    const shift = u * SUN.slant * T;
    const x0 = SUN.x0 + shift;
    const x1 = SUN.x1 + shift;
    const mid = (x0 + x1) / 2;
    const inPane = X > x0 && X < x1 && Math.abs(X - mid) > 2 && Math.abs(Y - (SUN.y0 + SUN.y1) / 2) > 1.5;
    // (Its edge dithered, softer the further from the window.)
    const edge = Math.min(X - x0, x1 - X, (Y - SUN.y0) * 0.6, (SUN.y1 - Y) * 0.8);
    if (inPane && (edge > 2 || hash(X, Y, 3) < 0.5 - u * 0.3)) k = k === "1" ? "3" : k === "4" ? "6" : "5";
  }
  // The rug: concentric braids, each a twist of two colors.
  const R = SHOP_RECLUSE_RUG;
  const dx = (X / T - R.c) / R.rc;
  const dy = (Y / T - R.r) / R.rr;
  const d = Math.hypot(dx, dy);
  if (d <= 1) {
    const ring = Math.floor(d * 9);
    const braids = [["i", "j"], ["l", "m"], ["u", "v"], ["i", "j"], ["x", "z"], ["l", "m"], ["i", "j"], ["u", "v"], ["l", "m"]] as const;
    const [lit, deep] = braids[ring % braids.length]!;
    const a = Math.atan2(dy, dx);
    const twist = Math.floor((a * 14 + ring * 2) % 2 === 0 ? 0 : 1);
    const band = (d * 9) % 1;
    k = band < 0.18 ? deep : (Math.floor(a * 22 + ring) + twist) % 2 ? lit : deep;
    if (d > 0.965) k = deep;
    // (The sun on the rug: each braid a step lighter in the two panes, the sash's shadow between them, the edge dithered as on the boards.)
    const su = (Y - SUN.y0) / (SUN.y1 - SUN.y0);
    const sx0 = SUN.x0 + su * SUN.slant * T;
    const sx1 = SUN.x1 + su * SUN.slant * T;
    const sEdge = Math.min(X - sx0, sx1 - X, (Y - SUN.y0) * 0.6, (SUN.y1 - Y) * 0.8);
    const sunny = su >= 0 && su <= 1 && X > sx0 && X < sx1 && Math.abs(X - (sx0 + sx1) / 2) > 2 && (sEdge > 2 || hash(X, Y, 3) < 0.5 - su * 0.3);
    const SUNLIT: Record<string, string> = { i: "7", j: "i", l: "8", m: "l", u: "9", v: "u", x: "0", z: "x" };
    if (sunny) k = SUNLIT[k] ?? k;
  }
  return k;
}
/** The floor's tiles for one time of day, each `floor-<col>-<row>` (the day's are the room's pieces; the others replace them). */
function floorTiles(light: RoomLight): Piece[] {
  const out: Piece[] = [];
  for (let row = 0; row < SHOP_RECLUSE_N; row++)
    for (let col = 0; col < SHOP_RECLUSE_N; col++) {
      const c = cv(T, T);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) c[y]![x] = floorPx(col * T + x, row * T + y, light);
      out.push({ name: `floor-${col}-${row}`, sq: [1, 1], w: T, h: T, foot: [18, 18], frames: [[whole(c)]], ms: 1000 });
    }
  return out;
}
for (const p of floorTiles("day")) PIECES[p.name] = p;

// ==== The walls: faded cream wallpaper, little blue sailboats on it in rows, over a white baseboard and under a dark picture rail.

const WALL_H = 130;
const WF: Pt = [18, WALL_H - 1];
const BOAT = ["...e...", "..ee...", ".eeee..", "..e.e..", "ddddddd", ".ddddd."];
function paper(seed: number, w = T): Cv {
  const c = cv(w, WALL_H);
  for (let y = 8; y < WALL_H; y++)
    for (let x = 0; x < w; x++) {
      // A stripe every 12 px, the paper's age in specks.
      const stripe = (x + seed * 5) % 12;
      c[y]![x] = stripe === 0 ? "b" : hash(x >> 1, y >> 1, seed) < 0.05 ? "b" : "a";
    }
  // The boats, in rows, every other row shifted.
  for (let j = 0; j < 6; j++)
    for (let i = -1; i < w / 18 + 1; i++) {
      const x = i * 18 + (j % 2 ? 9 : 0) + ((seed * 3) % 18) - 9;
      const y = 22 + j * 17;
      if (y + 6 < WALL_H - 12) stamp(c, x, y, BOAT);
    }
  // The picture rail (dark wood) along the top, the plaster above it; the baseboard along the bottom.
  rect(c, 0, 8, w, 3, "F");
  rect(c, 0, 11, w, 3, "w");
  rect(c, 0, 14, w, 1, "W");
  rect(c, 0, WALL_H - 11, w, 1, "g");
  rect(c, 0, WALL_H - 10, w, 2, "F");
  rect(c, 0, WALL_H - 8, w, 7, "f");
  rect(c, 0, WALL_H - 1, w, 1, "g");
  return c;
}
const wallDef = (name: string, c: Cv, w = 1) => def(name, [w, 1], w * T, WALL_H, w === 1 ? WF : [Math.floor((w * T) / 2), WALL_H - 1], [[whole(c)]]);
for (let i = 0; i < 4; i++) wallDef(`wall-${i}`, paper(i + 1));

/**
 * The window (2 squares): a white double-hung sash, gingham curtains, the view across the street, its light by the time of day. Day: the
 * sky, the brick building across the street, the sun gleaming in at the top left, glints on the glass. Dusk: the sun's glow low over the
 * roofline, a window lit across the street. Night (Eric, Nov 14: "like a moon at night"): the moon at the top right, a few stars, two
 * windows lit across the street, no glints.
 */
function windowPiece(light: RoomLight): Piece {
  const W = 2 * T;
  const c = paper(9, W);
  const x0 = 13;
  const x1 = W - 14;
  const y0 = 26;
  const y1 = 96;
  // (The lit windows across the street: [column, row] of their grid.)
  const lit = light === "night" ? ["0,1", "2,0"] : light === "dusk" ? ["2,0"] : [];
  // The view: sky, then the brick building across the street (its windows).
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      let k = y < y0 + 18 ? "<" : y < y0 + 30 ? ">" : "^";
      if (y > y0 + 34) {
        const brick = (y - y0) % 4 === 0 || ((x + (((y - y0) >> 2) % 2) * 3) % 6 === 0 && (y - y0) % 4 !== 0) ? "=" : "#";
        k = brick;
        const wx = (x - x0) % 16;
        const wy = (y - y0 - 40) % 18;
        if (wx > 4 && wx < 11 && wy > 2 && wy < 13) {
          const on = lit.includes(`${Math.floor((x - x0) / 16)},${Math.floor((y - y0 - 40) / 18)}`);
          k = on ? (wy < 5 ? ";" : ":") : wy < 5 ? "~" : "!";
        }
      }
      c[y]![x] = k;
    }
  if (light === "day") {
    // The sun's glare at the top left; two glints streaking down the glass.
    for (let y = y0; y < y0 + 16; y++)
      for (let x = x0; x < x0 + 18; x++) {
        const d = Math.hypot(x - (x0 + 8), y - (y0 + 6));
        if (d < 9) c[y]![x] = d < 5 ? "*" : "%";
      }
    for (let i = 0; i < 26; i++) {
      put(c, x0 + 14 + i, y0 + 4 + i, "&");
      put(c, x0 + 18 + i, y0 + 4 + i, "@");
    }
  } else if (light === "dusk") {
    // The sun gone behind the roofs: its glow low on the left over the roofline; one faint glint.
    for (let y = y0 + 20; y <= y0 + 34; y++)
      for (let x = x0; x < x0 + 22; x++) {
        const d = Math.hypot((x - (x0 + 7)) * 0.8, y - (y0 + 35));
        if (d < 12) c[y]![x] = d < 6 ? "*" : "%";
      }
    for (let i = 0; i < 20; i++) put(c, x0 + 20 + i, y0 + 6 + i, "@");
  } else {
    // The moon, high on the right (a bright disc with a few grey marks and a pale ring round it); stars, a few bright, a few dim.
    const mx = x1 - 11;
    const my = y0 + 9;
    for (let y = my - 7; y <= my + 7; y++)
      for (let x = mx - 7; x <= mx + 7; x++) {
        const d = Math.hypot(x - mx, y - my);
        if (d < 4.6) c[y]![x] = "*";
        else if (d < 5.6) c[y]![x] = "%";
      }
    for (const [dx, dy] of [[-1, -1], [1, 1], [2, -2], [-2, 2]] as const) put(c, mx + dx, my + dy, ",");
    for (const [x, y, k] of [[x0 + 4, y0 + 4, "&"], [x0 + 11, y0 + 13, "@"], [x0 + 17, y0 + 3, "@"], [x0 + 23, y0 + 9, "&"], [x0 + 6, y0 + 22, "@"], [x0 + 15, y0 + 27, "&"], [x1 - 6, y0 + 23, "@"], [x0 + 26, y0 + 20, "@"]] as const) put(c, x, y, k);
  }
  // The frame and the sash: white, its shade; the meeting rail across the middle; the sill.
  rect(c, x0 - 3, y0 - 3, x1 - x0 + 6, 3, "F");
  rect(c, x0 - 3, y0, 3, y1 - y0, "F");
  rect(c, x1, y0, 3, y1 - y0, "f");
  rect(c, x0, (y0 + y1) / 2 - 1, x1 - x0, 3, "F");
  rect(c, x0, (y0 + y1) / 2 + 2, x1 - x0, 1, "g");
  rect(c, (x0 + x1) / 2 - 1, y0, 2, y1 - y0, "f");
  rect(c, x0 - 6, y1, x1 - x0 + 12, 4, "F");
  rect(c, x0 - 6, y1 + 4, x1 - x0 + 12, 1, "g");
  // A little potted cactus on the sill.
  rect(c, x1 - 12, y1 - 5, 6, 5, "r");
  rect(c, x1 - 11, y1 - 12, 4, 7, "G");
  put(c, x1 - 12, y1 - 10, "G");
  put(c, x1 - 7, y1 - 9, "G");
  // The curtains: red gingham, gathered to each side, a valance across the top.
  const ging = (x: number, y: number) => (((x >> 1) + (y >> 1)) % 2 ? ((x >> 1) % 2 ? "r" : "q") : (x >> 1) % 2 ? "R" : "r");
  for (const side of [-1, 1] as const)
    for (let y = y0 - 2; y < y1 + 12; y++) {
      const wid = 9 + Math.round(3 * Math.sin((y - y0) / 10));
      for (let i = 0; i < wid; i++) {
        const x = side < 0 ? x0 - 8 + i : x1 + 8 - i;
        put(c, x, y, ging(x, y));
      }
    }
  for (let y = y0 - 8; y < y0 + 3; y++) for (let x = x0 - 9; x < x1 + 9; x++) put(c, x, y, ging(x, y));
  for (let x = x0 - 9; x < x1 + 9; x += 3) put(c, x, y0 + 3, "R");
  rect(c, x0 - 10, y0 - 9, x1 - x0 + 20, 1, "W");
  return { name: "window", sq: [2, 1], w: W, h: WALL_H, foot: [37, WALL_H - 1], frames: [[whole(c)]], ms: 1000 };
}
PIECES.window = windowPiece("day");

/** The poster (on its panel): a red-finned rocket climbing over a ringed planet in a starry sky; four thumbtacks; no words. */
{
  const c = paper(6);
  const x0 = 4;
  const y0 = 24;
  const w = 29;
  const h = 40;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) c[y]![x] = y < y0 + 14 ? "P" : "p";
  for (let i = 0; i < 14; i++) put(c, x0 + 1 + hash(i, 1, 4) * (w - 2), y0 + 1 + hash(i, 2, 4) * (h - 14), i % 3 ? "Q" : "y");
  // The planet and its ring, low on the right.
  ellipse(c, x0 + 20, y0 + 31, 6, 6, (x, y) => (x + y < x0 + 20 + y0 + 29 ? "o" : "O"));
  line(c, x0 + 11, y0 + 33, x0 + 28, y0 + 28, "Q");
  // The rocket: cream body, red nose and fins, a flame.
  face(c, [[x0 + 9, y0 + 30], [x0 + 12, y0 + 9], [x0 + 15, y0 + 30]], "Q");
  face(c, [[x0 + 10, y0 + 13], [x0 + 12, y0 + 7], [x0 + 14, y0 + 13]], "r");
  face(c, [[x0 + 8, y0 + 32], [x0 + 10, y0 + 24], [x0 + 10, y0 + 31]], "r");
  face(c, [[x0 + 16, y0 + 32], [x0 + 14, y0 + 24], [x0 + 14, y0 + 31]], "r");
  put(c, x0 + 12, y0 + 18, "p");
  for (let j = 0; j < 6; j++) for (let i = -1; i <= 1; i++) if (Math.abs(i) * 3 < 6 - j) put(c, x0 + 12 + i, y0 + 31 + j, j < 2 ? "Y" : j < 4 ? "y" : "U");
  // Its paper's edge, a curl at a corner, the tacks.
  rect(c, x0, y0 + h, w, 1, "c");
  put(c, x0 + w - 1, y0 + h - 1, "a");
  put(c, x0 + w - 2, y0 + h - 1, "c");
  for (const [x, y] of [[x0 + 1, y0 + 1], [x0 + w - 2, y0 + 1], [x0 + 1, y0 + h - 2]] as const) put(c, x, y, "r");
  wallDef("wall-poster", c);
}

/** A felt pennant on a side wall: blue, a white star, no letters. */
{
  const c = paper(3);
  face(c, [[6, 40], [32, 50], [6, 60]], "N");
  rect(c, 4, 39, 3, 22, "F");
  stamp(c, 11, 46, ["..F..", "FFFFF", ".FFF.", "F...F"]);
  for (let y = 40; y < 61; y++) put(c, 7, y, "n");
  wallDef("wall-pennant", c);
}

/** A free blank piece: solid, drawn as nothing (a side wall's square when the scene draws the wall as one surface). */
def("wall-none", [1, 1], 1, 1, [0, 0], [[whole(cv(1, 1))]]);

/**
 * A side wall as ONE picture (Nov 13, Eric: "make the left and right walls not just like straight pieces of paper that look stacked"):
 * the paper, the picture rail and the baseboard running unbroken from the back wall forward, `squares` long; the pennant on the west's.
 * The scene draws it receding in perspective (recluse-scene.ts `drawSideWalls`).
 */
export function sideWallGrid(west: boolean, squares: number): { grid: string[]; palette: Record<string, string> } {
  const c = paper(west ? 5 : 7, squares * T);
  if (west) {
    // The pennant, about the third square back from the front... at its row in the cards' layout (row 3), its point toward the window.
    const x0 = Math.round(3 * T) - 13;
    face(c, [[x0 + 26, 40], [x0, 50], [x0 + 26, 60]], "N");
    rect(c, x0 + 26, 39, 3, 22, "F");
    stamp(c, x0 + 9, 46, ["..F..", "FFFFF", ".FFF.", "F...F"]);
    for (let y = 40; y < 61; y++) put(c, x0 + 25, y, "n");
  }
  return { grid: c.map((r) => r.join("")), palette: PALETTE };
}
/** The height of the walls (room pixels). */
export const SHOP_RECLUSE_WALL_H = WALL_H;

// -- The front: a low band of the baseboard under the wallpaper's foot, and the door out to the stair hall in its middle.
{
  const HEM_H = 22;
  const c = cv(T, HEM_H);
  for (let y = 3; y < HEM_H; y++) for (let x = 0; x < T; x++) c[y]![x] = y < 5 ? "F" : y < 7 ? "g" : (x + 5) % 12 === 0 ? "b" : "a";
  rect(c, 0, HEM_H - 5, T, 5, "f");
  def("hem", [1, 1], T, HEM_H, [18, HEM_H - 1], [[whole(c)]]);
}
{
  const EW = 2 * T;
  const EH = 112;
  const EF = EH - 1;
  const c = cv(EW, EH);
  // The stair hall: dark planks going back, the banister's spindles and rail, a dim landing.
  for (let y = 18; y < EF; y++) for (let x = 12; x < EW - 12; x++) put(c, x, y, y > 70 ? ((x >> 3) % 2 ? "V" : "X") : (y + x) % 9 === 0 ? "X" : "V");
  for (let x = 16; x < EW - 14; x += 6) rect(c, x, 44, 2, 28, "W");
  rect(c, 12, 42, EW - 24, 3, "w");
  // The frame: painted white; the door open against the east post, its panels.
  rect(c, 2, 12, 10, EF - 12, "F");
  rect(c, 2, 12, 2, EF - 12, "f");
  rect(c, EW - 12, 12, 10, EF - 12, "f");
  rect(c, 0, 6, EW, 7, "F");
  rect(c, 0, 12, EW, 1, "g");
  face(c, [[EW - 12, 18], [EW - 22, 26], [EW - 22, EF - 8], [EW - 12, EF - 2]], "F", { hi: "F", lo: "g" });
  rect(c, EW - 20, 34, 6, 20, "f");
  rect(c, EW - 20, 62, 6, 22, "f");
  put(c, EW - 20, 60, "O");
  def("entrance", [2, 1], EW, EH, [37, EF], [[whole(c, true)]]);
}

// ==== The bed (north-east corner, 2 squares wide and 3 deep, standing up whole): a turned-wood headboard against the back wall, a
// patchwork quilt over it, its pillow, a teddy bear on it, the footboard toward us.
{
  const W = 2 * T;
  const H = 104;
  const F = H - 3;
  const c = cv(W, H);
  shadow(c, W / 2, F - 1, W / 2 - 2, 3);
  // The headboard: two posts with knobs, a curved top rail, slats.
  rect(c, 6, 6, 4, 46, "K");
  rect(c, W - 10, 6, 4, 46, "K");
  ellipse(c, 8, 5, 3, 3, "L");
  ellipse(c, W - 8, 5, 3, 3, "L");
  for (let x = 10; x < W - 10; x++) {
    const top = 12 - Math.round(4 * Math.sin(((x - 10) / (W - 20)) * Math.PI));
    rect(c, x, top, 1, 4, x < W / 2 ? "M" : "L");
  }
  for (let x = 14; x < W - 12; x += 7) rect(c, x, 16, 3, 22, "L");
  // The mattress seen from above and the front: the quilt's top (foreshortened), the quilt hanging over the front edge.
  const qTop = 30;
  const qFront = F - 26;
  for (let y = qTop; y < qFront; y++)
    for (let x = 5; x < W - 5; x++) {
      const pc = Math.floor((x - 5) / 8) + Math.floor((y - qTop) / 7) * 3;
      const k = ["N", "O", "r", "G", "n", "o", "q", "h"][(pc * 5 + 3) % 8]!;
      c[y]![x] = (x - 5) % 8 === 0 || (y - qTop) % 7 === 0 ? "F" : k;
    }
  for (let y = qFront; y < F - 8; y++)
    for (let x = 5; x < W - 5; x++) {
      const pc = Math.floor((x - 5) / 8) + 11;
      const k = ["N", "O", "r", "G", "n", "o", "q", "h"][(pc * 5 + 3) % 8]!;
      c[y]![x] = (x - 5) % 8 === 0 ? "f" : y === qFront ? "F" : k === "n" ? "N" : k === "o" ? "O" : k === "q" ? "r" : k === "h" ? "G" : k;
    }
  // The pillow, the sheet's turned-down edge.
  ellipse(c, W / 2, qTop + 4, 18, 5, (x, y) => (y > qTop + 6 ? "f" : "F"));
  rect(c, 6, qTop + 10, W - 12, 3, "F");
  rect(c, 6, qTop + 13, W - 12, 1, "f");
  // A small teddy bear propped on the pillow.
  ellipse(c, 20, qTop + 7, 5, 5, "L");
  ellipse(c, 20, qTop + 1, 4, 4, "M");
  put(c, 16, qTop - 3, "L");
  put(c, 24, qTop - 3, "L");
  put(c, 19, qTop + 1, "k");
  put(c, 21, qTop + 1, "k");
  put(c, 20, qTop + 3, "K");
  // The footboard: two low posts and a rail.
  rect(c, 4, F - 14, 4, 14, "K");
  rect(c, W - 8, F - 14, 4, 14, "K");
  rect(c, 4, F - 13, W - 8, 4, "L");
  rect(c, 4, F - 13, W - 8, 1, "M");
  ellipse(c, 6, F - 15, 2, 2, "M");
  ellipse(c, W - 6, F - 15, 2, 2, "M");
  def("bed", [2, 3], W, H, [37, F], [[whole(c, true)]]);
}

// ==== The rocking horse (north-west corner): a little dappled horse on red rockers, a red saddle, a dark mane, facing east.
{
  const W = 44;
  const H = 46;
  const F = H - 3;
  const c = cv(W, H);
  shadow(c, W / 2, F, 18, 2);
  // The rockers: a long red curve, lit on top.
  for (let x = 3; x < W - 3; x++) {
    const y = F - 2 - Math.round(4 * Math.cos(((x - W / 2) / (W - 6)) * Math.PI * 0.9));
    rect(c, x, y - 1, 1, 3, "R");
    put(c, x, y - 2, "r");
  }
  // Legs splayed to the rockers.
  for (const [lx, ly] of [[11, 0], [15, 0], [27, 0], [31, 0]] as const) line(c, lx, 25, lx + (lx < 20 ? -3 : 3), F - 6 + ly, "I");
  // The body, the neck and the head (facing east), the dapples.
  ellipse(c, 21, 22, 12, 6, (x, y) => (y < 19 ? "H" : hash(x, y, 2) < 0.2 ? "I" : "H"));
  face(c, [[28, 20], [33, 7], [38, 9], [33, 22]], "H", { lo: "I" });
  ellipse(c, 37, 10, 5, 3.5, "H");
  put(c, 41, 11, "I");
  put(c, 36, 8, "k");
  put(c, 33, 4, "H");
  put(c, 34, 3, "H");
  for (let i = 0; i < 8; i++) put(c, 29 + i * 0.6, 8 + i * 1.6, "J");
  for (let i = 0; i < 6; i++) put(c, 30 + i * 0.6, 7 + i * 1.6, "J");
  // The tail, the saddle.
  line(c, 9, 19, 5, 30, "J");
  line(c, 10, 19, 6, 31, "J");
  rect(c, 16, 14, 10, 4, "R");
  rect(c, 16, 14, 10, 1, "r");
  rect(c, 20, 18, 2, 6, "W");
  for (let i = 0; i < 8; i++) put(c, 14 + hash(i, 1, 6) * 14, 20 + hash(i, 2, 6) * 5, "I");
  def("horse", [1, 1], W, H, [22, F], [[whole(c, true)]]);
}

// ==== The little table (2 squares) with its own chessboard set up, and two small chairs.
{
  const W = 2 * T;
  const H = 50;
  const F = H - 3;
  const c = cv(W, H);
  shadow(c, W / 2, F, W / 2 - 6, 3);
  // The top (seen from above and the front), its apron, four legs.
  face(c, [[8, 16], [W - 8, 16], [W - 4, 30], [4, 30]], "L", { hi: "M", lo: "K" });
  rect(c, 4, 30, W - 8, 4, "K");
  for (const x of [6, W - 9]) rect(c, x, 34, 3, F - 34, "K");
  for (const x of [14, W - 17]) rect(c, x, 34, 2, F - 37, "K");
  // The board on it: 8 x 8, foreshortened; the pieces set up as little dots of black and white.
  const bx0 = 22;
  const bx1 = W - 22;
  const by0 = 17;
  const by1 = 28;
  for (let y = by0; y < by1; y++)
    for (let x = 0; x < W; x++) {
      const u = (y - by0) / (by1 - by0);
      const xl = bx0 - u * 3;
      const xr = bx1 + u * 3;
      if (x < xl || x >= xr) continue;
      const f = Math.floor(((x - xl) / (xr - xl)) * 8);
      const r = Math.floor(u * 8);
      c[y]![x] = (f + r) % 2 ? "E" : "D";
    }
  for (let f = 0; f < 8; f++) {
    const x = Math.round(bx0 + 1 + f * ((bx1 - bx0) / 8));
    put(c, x, by0 - 1, "J");
    put(c, x, by0, "J");
    put(c, x, by0 + 1, "J");
    put(c, x - 1, by1 - 2, "F");
    put(c, x - 1, by1 - 3, "F");
    put(c, x - 1, by1 - 1, "F");
  }
  def("table", [2, 1], W, H, [37, F], [[whole(c, true)]]);
}
{
  const W = 24;
  const H = 40;
  const F = H - 3;
  const c = cv(W, H);
  shadow(c, W / 2, F, 9, 2);
  // A little chair seen from behind: its back (two posts, three rungs), the seat, the legs.
  rect(c, 5, 4, 3, F - 4, "K");
  rect(c, W - 8, 4, 3, F - 4, "K");
  for (const y of [6, 11, 16]) rect(c, 5, y, W - 10, 2, y === 6 ? "M" : "L");
  rect(c, 3, 21, W - 6, 4, "L");
  rect(c, 3, 21, W - 6, 1, "M");
  def("chair", [1, 1], W, H, [12, F], [[whole(c, true)]]);
}

// ==== Lights: the sun through the window (its glow on the glass, and a pool on the floor before it, over the sun baked into the boards).

const SUNLIGHT = "#ffe7a8";
export const SHOP_RECLUSE_LIGHTS: readonly (LightSpot & { piece: string })[] = [{ piece: "window", x: 14, y: 27, w: 46, h: 68, color: SUNLIGHT, strength: 0.35, halo: 40 }];
export const SHOP_RECLUSE_POOLS: readonly (LightPool & { piece: string })[] = [{ piece: "window", x: 52, y: WALL_H + 64, rx: 50, ry: 30, color: SUNLIGHT, strength: 0.32 }];

// ==== The layout.

const LAYOUT: ShopPlace[] = [];
const at = (name: string, col: number, row: number, solid: boolean, more: Partial<ShopPlace> = {}) => {
  const p = PIECES[name];
  if (!p) throw new Error(`no piece ${name}`);
  LAYOUT.push({ name, col, row, solid, ...(p.sq[0] > 1 ? { w: p.sq[0] } : {}), ...(p.sq[1] > 1 ? { d: p.sq[1] } : {}), ...more });
};
const N = SHOP_RECLUSE_N;
for (let row = 0; row < N; row++) for (let col = 0; col < N; col++) at(`floor-${col}-${row}`, col, row, false);
const FLOOR_COUNT = LAYOUT.length;
/** The side walls: each square its paper card (round 1's look), or solid blanks with the scene drawing each wall as one surface. */
function layoutOf(sideCards: boolean): ShopPlace[] {
  LAYOUT.length = FLOOR_COUNT;
  // -- The back wall: the window, the poster's panel (over the rocking horse), the paper elsewhere.
  for (let col = 0; col < N; col++) {
    if (col === WINDOW_COL) at("window", WINDOW_COL, 0, true);
    if (col === WINDOW_COL || col === WINDOW_COL + 1) continue;
    // (The corners: the side walls' surfaces run from there.)
    if (!sideCards && (col === 0 || col === N - 1)) {
      at("wall-none", col, 0, true);
      continue;
    }
    if (col === 1) at("wall-poster", 1, 0, true);
    else at(`wall-${(col * 3) % 4}`, col, 0, true, col > WINDOW_COL ? { flip: true } : {});
  }
  // -- The side walls: the paper, the pennant on the west wall.
  for (let row = 1; row < N - 1; row++) {
    if (!sideCards) {
      at("wall-none", 0, row, true);
      at("wall-none", N - 1, row, true);
      continue;
    }
    at(row === 3 ? "wall-pennant" : `wall-${(row * 5) % 4}`, 0, row, true);
    at(`wall-${(row * 5 + 2) % 4}`, N - 1, row, true, { flip: true });
  }
  // -- The front: the low band, and the door out at its east end (columns 6 and 7), clear of the board.
  for (let col = 0; col < N; col++) if (col !== 6 && col !== 7) at("hem", col, N - 1, true, col >= 5 ? { flip: true } : {});
  // (Since the building, Nov 13: the door down to the landing, a room-to-room door; the way out to the town is the hall's.)
  at("entrance", 6, N - 1, false, { door: "landing" });
  // -- The bed (north-east corner, its foot just onto the rug), the rocking horse (north-west), the little table and its chairs (west).
  at("bed", 6, 3, true);
  at("horse", 1, 1, true);
  at("table", 1, 6, true);
  at("chair", 1, 7, true);
  at("chair", 2, 7, true, { flip: true });
  return [...LAYOUT.slice(0, FLOOR_COUNT), ...LAYOUT.slice(FLOOR_COUNT).sort((a, b) => a.row - b.row || a.col - b.col)];
}

/** Where every piece goes: floor tiles first, then the upright pieces north to south (the side walls drawn as one surface each). */
export const SHOP_RECLUSE_LAYOUT: readonly ShopPlace[] = layoutOf(false);
/** Round 1's look: each side wall a row of paper cards (for the before and after; `?walls=cards` on the preview). */
export const SHOP_RECLUSE_LAYOUT_CARDS: readonly ShopPlace[] = layoutOf(true);
/** Every piece by its name, each its own Character `shop-recluse-<name>`. */
export const SHOP_RECLUSE_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(Object.values(PIECES).map((p) => [p.name, toChar(p)]));

/**
 * Where the scene stands (squares): the board on the rug (its middle; its size is feel.ts `HIDDEN_ROOM_FEEL.kid.board`), the child's
 * place behind it on Black's side (he goes round to White's side for White's moves: recluse-scene.ts), and the four stand-in players
 * for the summoning (the mockup's: real players later), round the rug's front.
 */
export const SHOP_RECLUSE_SCENE = {
  board: [4.0, 4.05] as const,
  players: [[2.1, 4.9], [3.0, 6.0], [5.0, 6.0], [5.9, 4.9]] as const,
  /** Where you stand as you come in (the mockup hides you). */
  you: [6, 7] as const,
};
/** The squares nobody walks on: the board and the child's way round it (the scene's, not a room piece's). */
export const SHOP_RECLUSE_STANDING = [{ c: 3, r: 3 }, { c: 4, r: 3 }, { c: 5, r: 3 }, { c: 3, r: 4 }, { c: 4, r: 4 }, { c: 5, r: 4 }, { c: 3, r: 5 }, { c: 4, r: 5 }, { c: 5, r: 5 }] as const;
/** The camera's fixed look at the town's zoom (a small room seen whole). */
export const SHOP_RECLUSE_CAM = { x: 4.0, y: 3.2 } as const;

/** A room's light by the time of day: its pieces, its lights and pools, and its wash (RoomArt's `dim`, `dimRGB`; none by day). */
export interface RecluseLit {
  pieces: Readonly<Record<string, Character>>;
  lights: readonly (LightSpot & { piece: string })[];
  pools: readonly (LightPool & { piece: string })[];
  dim?: number;
  dimRGB?: string;
}
/**
 * The window's light and the room's wash, by the time of day. Dusk: the glass's glow and the pool a warm orange, the pool further out
 * along the longer panes, a light warm wash. Night: the moon's pale cool glow, a dim pool, a gentle blue wash (the child, his board and
 * the rug still easy to see: the lights go on over it).
 */
const LIGHT_OF: Readonly<Record<Exclude<RoomLight, "day">, Omit<RecluseLit, "pieces">>> = {
  dusk: {
    lights: [{ piece: "window", x: 14, y: 27, w: 46, h: 68, color: "#ffb47a", strength: 0.32, halo: 40 }],
    pools: [{ piece: "window", x: 60, y: WALL_H + 92, rx: 56, ry: 42, color: "#ffa868", strength: 0.24 }],
    dim: 0.16,
    dimRGB: "70,32,40",
  },
  night: {
    lights: [{ piece: "window", x: 14, y: 27, w: 46, h: 68, color: "#c4d2ff", strength: 0.3, halo: 36 }],
    pools: [{ piece: "window", x: 48, y: WALL_H + 58, rx: 44, ry: 26, color: "#aebfff", strength: 0.16 }],
    dim: 0.3,
    dimRGB: "14,20,52",
  },
};
const LIT = new Map<RoomLight, RecluseLit>();
/** The room at one time of day (sky.ts `roomLight`): made the first time it's asked for, then kept. */
export function recluseLit(light: RoomLight): RecluseLit {
  let l = LIT.get(light);
  if (l) return l;
  if (light === "day") l = { pieces: SHOP_RECLUSE_PIECES, lights: SHOP_RECLUSE_LIGHTS, pools: SHOP_RECLUSE_POOLS };
  else {
    const palette = { ...PALETTE, ...LIGHT_PALETTE[light] };
    const own = [...floorTiles(light), windowPiece(light)];
    l = { ...LIGHT_OF[light], pieces: { ...SHOP_RECLUSE_PIECES, ...Object.fromEntries(own.map((p) => [p.name, toChar(p, palette)])) } };
  }
  LIT.set(light, l);
  return l;
}
