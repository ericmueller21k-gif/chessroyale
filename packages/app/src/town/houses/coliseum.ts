/**
 * The Colosseum: the heart of the town square, where raids with people will start (Eric, Oct 26: "a much bigger building…
 * a coliseum with chess theme, maybe even statues of chess pieces around it"; slice 6: "make the coliseum about twice the
 * size it is now so it's clearly standing out… looming over the park"). A Roman amphitheater seen from the front and a
 * little above, lit from the top left like everything in the square: an oval wall of warm stone in three tiers of arches
 * (marble chess pawns standing in the middle tier's arches, as the real one had statues), a tier of windows and a
 * checkered attic band on top (the board's light and dark squares); its open top shows the seats inside, stepping down
 * in rows with dark doorways, to the podium's checkered wall and the arena's floor, a chessboard. In the middle of its
 * front a tall portal with a dark arched gate (a raised portcullis, the sunlit floor at the tunnel's end), a stone tablet
 * over it (blank: the game writes "The Colosseum" on it) and a panel of chess pieces carved in relief above; four navy and
 * gold banners (the game's colors) hung on its face, four pennants on its far rim and a flag on a mast over it all.
 * Statues of chess pieces on plinths stand round it: the bronze queen and king either side of the gate; beyond them, on
 * pedestals of their own, the two statues (houses/statues.ts, drawn by the game over this picture, not in it: the marble
 * statue on the gate's left, the bronze one on its right, each before its ground's end column); beyond those a marble
 * bishop and rook on the left, a marble knight and pawn on the right, and a marble pawn at each back corner. `idle`: the
 * banners and pennants stir and the flag flutters.
 *
 * It stands on its 12 x 12 ground (world.ts, COLISEUM), its foot (the gate's sill) on the ground's front edge. Slice 6
 * redrew it at about twice its size (twice as wide and deep, half as tall again: three tiers of arches where it had two,
 * 27 bays where it had 15): at the homes' scale (37 pixels a square) it is about 17 squares across with its statues.
 */
import type { Character, Part } from "../../characters/sprite.ts";
import { TOWN_FEEL } from "../feel.ts";
import { COLISEUM } from "../world.ts";
import { paint, signBoard, type Pt } from "./kit.ts";
import { PED_W, STATUE_W, statueH, type StatueId } from "./statues.ts";
import { lazyAnim } from "../../characters/sprite.ts";

const PALETTE: Record<string, string> = {
  k: "#2a1c14", // outline
  "1": "#fbf0d8", // warm stone (travertine): lightest to darkest
  "2": "#ecd9b2",
  "3": "#d8bf93",
  "4": "#bb9e70",
  "5": "#93784f",
  "6": "#6a5539",
  x: "#2e2018", // inside the arches, and their lit jambs
  X: "#55402f",
  z: "#150e0a", // the gate's dark
  L: "#f4dcae", // the board's light and dark squares
  D: "#8e6440",
  N: "#1f2a44", // the game's navy, lit
  n: "#34466e",
  Y: "#f4b740", // the game's gold: mid, light, shade
  y: "#ffe08a",
  O: "#b97c10",
  B: "#5e3b1c", // bronze: dark, mid, light
  b: "#946231",
  c: "#cf9a52",
  M: "#f7f4ee", // marble: light, mid, dark
  m: "#d9d3c7",
  o: "#a39b8d",
  v: "#fff6dc", // a glint
  W: "#4e3219", // the masts' wood
  w: "#86592c",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

// ---- Where things are (frame pixels). Its axis is x = CX; the gate's sill on the ground at y FOOT.

/**
 * The two statues stand before its ground's first and last columns (their viewing squares right in front, world.ts
 * STATUES): this far either side of its axis, from its ground's size (so they follow it as it grows).
 */
export const STATUE_OFF = Math.round((COLISEUM.size / 2 - 0.5) * TOWN_FEEL.housePxPerSquare);
/** The chess pieces' size against the first Colosseum's (slice 5): half as big again, beside the bigger walls. */
const PS = 1.5;
/** A plinth under a chess piece. */
const PLINTH_W = 38;
const PLINTH_H = 20;
/** The chess pieces beyond the statues: the nearer pair just past a statue's pedestal, the outer pair past them. */
const PIECE_1 = STATUE_OFF + PED_W / 2 + PLINTH_W / 2 + 8;
const PIECE_2 = PIECE_1 + PLINTH_W + 6;
const W = 2 * (PIECE_2 + PLINTH_W / 2 + 6);
const FOOT = 364;
const CX = W / 2;

// ---- The wall: three tiers of arches round its curve, a tier of windows, the cornices between them, the checkered
// attic band on top; the portal in the middle of its front.

// ---- The open top: its rim, the seats inside (rows stepping down to the arena), the podium's checkered wall, the
// arena's floor (a chessboard). Each pixel shows the row whose far edge passes through it.


// ---- The chess pieces, as profiles: each piece's half-width at each height j above its foot (<= 0: nothing there),
// in the first Colosseum's units; and its cuts (a crenel, a coronet's gaps). The statues are turned on a lathe from these
// at PS times that size, and the relief over the gate carves them small.

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
/** Every piece's foot: a broad base and a step. */
const foot = (j: number, w: number) => (j < 3 ? w : w - 2);
type Profile = { h: number; hw: (j: number) => number; cut?: (X: number, j: number) => string | null | undefined };
const PAWN: Profile = { h: 30, hw: (j) => (j < 5 ? foot(j, 11) : j < 16 ? lerp(7.5, 4.5, (j - 5) / 11) : j < 18 ? 7.5 : j < 19 ? 4 : Math.sqrt(Math.max(0, 36 - (j - 24.5) ** 2))) };
const ROOK: Profile = {
  h: 40,
  hw: (j) => (j < 5 ? foot(j, 12) : j < 30 ? lerp(8.5, 7.5, (j - 5) / 25) : 10.5),
  cut: (X, j) => (j >= 35 && !(Math.abs(X) < 2.5 || Math.abs(X) > 6) ? null : j >= 30 && j < 31 ? "o" : undefined), // the crenels, the flare's shadow
};
const BISHOP: Profile = {
  h: 46,
  hw: (j) => (j < 5 ? foot(j, 12) : j < 22 ? lerp(8, 4.5, (j - 5) / 17) : j < 24 ? 8 : j < 25 ? 4.5 : j < 41 ? 7.5 * Math.sqrt(Math.max(0, 1 - ((j - 32) / 9) ** 2)) : Math.sqrt(Math.max(0, 6.25 - (j - 43.5) ** 2))),
  cut: (X, j) => (j > 30 && j < 38 && Math.abs(X - (j - 34) * 0.6) < 0.8 ? "o" : undefined), // the mitre's slit
};
const QUEEN: Profile = {
  h: 54,
  hw: (j) => (j < 5 ? foot(j, 13) : j < 26 ? lerp(8.5, 4.5, (j - 5) / 21) : j < 28 ? 8.5 : j < 29 ? 4.5 : j < 42 ? lerp(4.5, 9.5, (j - 29) / 13) : j < 50 ? 9.5 : Math.sqrt(Math.max(0, 4.4 - (j - 52) ** 2))),
  // Its band, then five points tapering up from it (a coronet: never a rook's flat merlons), a ball over them.
  cut: (X, j) => (j >= 42 && j < 44 ? "c" : j >= 44 && j < 50 ? (Math.abs(X - Math.round(X / 4.5) * 4.5) < 1.9 * (1 - (j - 44) / 6) + 0.3 ? undefined : null) : undefined),
};
const KING: Profile = {
  h: 58,
  hw: (j) => (j < 5 ? foot(j, 13) : j < 28 ? lerp(9, 5, (j - 5) / 23) : j < 30 ? 9 : j < 31 ? 5 : j < 43 ? lerp(5, 9, (j - 31) / 12) : j < 46 ? 9.5 : j < 48 ? 6 : j < 52 || j >= 55 ? 1.5 : 4.5),
  cut: (X, j) => (j >= 43 && j < 46 ? "c" : undefined), // the band under the cross
};
/** The knight, facing left (`flip`: right): its head and neck, on a plan of (X, j), j up from its foot. */
const KNIGHT: readonly [number, number][] = [
  [8, 5],
  [10, 14],
  [10, 24],
  [8, 32],
  [5, 38],
  [4.5, 45],
  [1.5, 40],
  [-0.5, 43],
  [-3, 37.5],
  [-7, 33.5],
  [-11.5, 26.5],
  [-12, 23],
  [-8.5, 21],
  [-4, 23],
  [-1.5, 20.5],
  [-3, 14],
  [-7, 9],
  [-8, 5],
];
function inPoly(px: number, py: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- The statues: chess pieces on plinths, turned on a lathe (marble or bronze, lit from the left); the knight carved.

/** Light, mid and dark keys of each stuff. */
const BRONZE = "cbB";
const MARBLE = "Mmo";
/** A piece standing on (cx, fy), PS times its profile's size. */
function lathe(cx: number, fy: number, pr: Profile, stuff: string) {
  const h = Math.ceil(pr.h * PS);
  const half = Math.ceil(14 * PS);
  return paint(cx - half, fy - h, 2 * half, h, (x, y) => {
    const X = (x + 0.5 - cx) / PS;
    const j = (fy - (y + 0.5)) / PS;
    const w = pr.hw(j);
    if (w <= 0 || Math.abs(X) > w) return null;
    const k = pr.cut?.(X, j);
    if (k !== undefined) return k;
    const t = X / w;
    if (stuff === BRONZE && t > -0.62 && t < -0.38 && Math.floor(j) % 9 === 4) return "v"; // a glint on the bronze
    return t < -0.4 ? stuff[0]! : t > 0.35 ? stuff[2]! : stuff[1]!;
  });
}
const knight = (cx: number, fy: number, flip: boolean) => {
  const h = Math.ceil(46 * PS);
  const half = Math.ceil(14 * PS);
  return paint(cx - half, fy - h, 2 * half, h, (x, y) => {
    const X = ((x + 0.5 - cx) / PS) * (flip ? -1 : 1);
    const j = (fy - (y + 0.5)) / PS;
    if (j < 5) return Math.abs(X) <= foot(j, 12) ? (X * (flip ? -1 : 1) < -5 ? "M" : X * (flip ? -1 : 1) > 4 ? "o" : "m") : null;
    if (!inPoly(X, j, KNIGHT)) return null;
    if (Math.hypot(X + 2.5, j - 33) < 1) return "o"; // its eye
    if (Math.hypot(X + 10, j - 24.5) < 0.8) return "o"; // its nostril
    if (X > 2 && j > 20 && inPoly(X + 2.6, j, KNIGHT) === false) return "o"; // the mane along its back
    // Lit where it faces the top left (its picture's left, whichever way it faces).
    const L = flip ? 1.2 : -1.2;
    if (!inPoly(X + L, j + 1.2, KNIGHT)) return "M";
    if (!inPoly(X - L, j - 1.2, KNIGHT)) return "o";
    return "m";
  });
};
/** A plinth under a chess piece: a cap, its block (lit on the left, a sunk panel), a base. */
const plinth = (cx: number, fy: number) =>
  paint(cx - PLINTH_W / 2, fy - PLINTH_H, PLINTH_W, PLINTH_H, (x, y) => {
    const X = x + 0.5 - cx;
    const j = fy - 1 - y;
    if (j >= PLINTH_H - 3) return j === PLINTH_H - 1 ? "1" : X < 8 ? "2" : "3";
    if (j < 3) return X < -8 ? "3" : X < 10 ? "4" : "5";
    if (Math.abs(X) > PLINTH_W / 2 - 2) return null;
    if (Math.abs(X) < PLINTH_W / 2 - 6 && j > 5 && j < PLINTH_H - 6) return j === PLINTH_H - 7 || X < -PLINTH_W / 2 + 7 ? "4" : "3"; // the panel
    return X < -10 ? "2" : X > 10 ? "4" : "3";
  });

// ---- The portal's tablet (blank: the game writes "The Colosseum" on it) and the relief of chess pieces over it.

const BW = 104;
const BH = 34;
const BOARD: Pt = [CX - BW / 2, FOOT - 108];
const tablet = signBoard(BOARD[0], BOARD[1], BW, BH, "Bbcy", "mMv", "Y");
/** Five pieces carved in a panel (rook, knight, king, queen, bishop), each about a third of a statue's size. */
const RELIEF_W = 104;
const RELIEF_H = 22;
const RELIEF_Y = FOOT - 130;
const RELIEF_K = 0.32; // relief pixels a profile unit
const RELIEF: (Profile | "knight")[] = [ROOK, "knight", KING, QUEEN, BISHOP];
/** Is the relief's piece `p` at (X, j) (profile units, X from its middle, j up from its foot)? */
function carvedAt(p: Profile | "knight", X: number, j: number): boolean {
  if (p === "knight") return j < 5 ? j >= 0 && Math.abs(X) <= foot(j, 12) : inPoly(X, j, KNIGHT);
  if (j < 0) return false;
  const w = p.hw(j);
  if (w <= 0 || Math.abs(X) > w) return false;
  return p.cut?.(X, j) !== null;
}
const relief = paint(CX - RELIEF_W / 2, RELIEF_Y, RELIEF_W, RELIEF_H, (x, y) => {
  const i0 = x - (CX - RELIEF_W / 2);
  const j0 = RELIEF_Y + RELIEF_H - 1 - y;
  if (j0 === RELIEF_H - 1 || i0 === 0) return "1";
  if (j0 === 0 || i0 === RELIEF_W - 1) return "4";
  const p = Math.floor((i0 - 2) / 20);
  if (p < 0 || p > 4) return "3";
  const X = (i0 - 2 - p * 20 - 9.5) / RELIEF_K;
  const j = (j0 - 2 + 0.5) / RELIEF_K;
  const pr = RELIEF[p]!;
  if (!carvedAt(pr, X, j)) return carvedAt(pr, X - 1 / RELIEF_K, j + 1 / RELIEF_K) ? "5" : "3"; // its shadow, down and right
  // The carving: lit on its top left edge.
  return !carvedAt(pr, X - 1 / RELIEF_K, j + 1 / RELIEF_K) ? "1" : "2";
});

// ---- Banners on its face, pennants on its far rim, the flag on its mast.

const BAN_W = 18;
const BAN_H = 62;
/** A small crown on an 8 x 8 plan: three points, a band. */
function crown(i: number, j: number): boolean {
  if (i < 0 || i > 7 || j < 0 || j > 7) return false;
  if (j >= 5) return true;
  return i === 0 || i === 7 || i === 3 || i === 4 ? j >= 1 : j >= 3;
}
/** A banner: navy with a gold edge, a gold crown on it over a band of the board's squares, its foot cut in a point with a gold fringe. */
function banner(): Part {
  const grid: string[] = [];
  for (let j = 0; j < BAN_H; j++) {
    let row = "";
    for (let i = 0; i < BAN_W; i++) {
      const point = Math.abs(i - (BAN_W - 1) / 2) * 0.6;
      if (j > BAN_H - 5 - point) row += j > BAN_H - 2 - point ? "." : i % 2 ? "Y" : "O";
      else if (i === 0 || i === BAN_W - 1) row += "Y";
      else if (j < 4) row += j === 1 || j === 2 ? "Y" : "N";
      else if (j >= 14 && j < 26 && crown(Math.floor((i - 3) / 1.5), Math.floor((j - 14) / 1.5))) row += j < 17 ? "y" : "Y";
      else if (j >= 32 && j < 38 && i > 1 && i < BAN_W - 2) row += (Math.floor((i - 2) / 3) + Math.floor((j - 32) / 3)) % 2 ? "L" : "D";
      else row += i < 5 ? "n" : "N";
    }
    grid.push(row);
  }
  return { grid };
}

const PEN_W = 22;
const PEN_H = 12;
/** A pennant: a long triangle, `main` with a stripe of `stripe`. */
function pennant(main: string, stripe: string): Part {
  const grid: string[] = [];
  for (let j = 0; j < PEN_H; j++) {
    let row = "";
    for (let i = 0; i < PEN_W; i++) {
      const half = (PEN_H / 2) * (1 - i / PEN_W);
      row += Math.abs(j + 0.5 - PEN_H / 2) < half ? (Math.abs(j + 0.5 - PEN_H / 2) < 1.2 ? stripe : main) : ".";
    }
    grid.push(row);
  }
  return { grid };
}
const FLAG_W = 44;
const FLAG_H = 26;
/** The flag: navy with a gold border, a gold crown over a band of the board's squares. */
const flagKey = (i: number, j: number): string => {
  if (j === 0 || j === FLAG_H - 1 || i === FLAG_W - 1 || i === 0) return "Y";
  if (crown(Math.floor((i - 14) / 1.5), Math.floor((j - 4) / 1.5))) return j < 8 ? "y" : "Y";
  if (j >= 18 && j < 22 && i > 10 && i < 34) return (Math.floor((i - 11) / 2) + Math.floor((j - 18) / 2)) % 2 ? "L" : "D";
  return j < 4 ? "n" : "N";
};
const flag: Part = { grid: Array.from({ length: FLAG_H }, (_, j) => Array.from({ length: FLAG_W }, (_, i) => flagKey(i, j)).join("")) };

/** The statues' rows: the front plinths' foot (just in front of its own), the back corners' (behind its oval's ends). */
const FRONT = FOOT + 4;

// ---- Parts and frames.

const parts: Record<string, Part> = {};
parts.banner = banner();
parts.flag = flag;
parts.penGold = pennant("Y", "O");
parts.penNavy = pennant("N", "Y");
/**
 * Where a statue's picture stands over this one (frame pixels: its top left; it is STATUE_W x statueH(id)), its
 * pedestal's foot on the front row's line, either side of the gate.
 */
export const statueSpot = (id: StatueId): Pt => [CX + (id === "marble" ? -1 : 1) * STATUE_OFF - STATUE_W / 2, FRONT + 1 - statueH(id)];

// ---- Its edge chip: a gold crown over a band of the board's squares, on the chip's white (24 x 24).

const chipCrown = paint(2, 3, 20, 18, (x, y) => {
  const X = x + 0.5 - 12;
  if (y >= 15) return y >= 20 ? null : (Math.floor((x - 2) / 2.5) + Math.floor((y - 15) / 2.5)) % 2 ? "L" : "N"; // the band
  // Three points (balls on their tips), the crown's body to the band.
  const d = Math.min(Math.abs(X + 7.5), Math.abs(X), Math.abs(X - 7.5));
  if (y < 6) return d < 1.6 && y >= 3 ? "y" : null;
  if (y < 6 + d * 1.1) return null;
  if (Math.abs(X) > 9.5) return null;
  if (y === 12 && Math.abs(X) < 1.5) return "N"; // a jewel
  return X < -4 ? "y" : X > 4 ? "O" : "Y";
});
export const COLISEUM_CHIP: Character = {
  id: "chip-coliseum",
  name: "The Colosseum",
  w: 24,
  h: 24,
  foot: [12, 23],
  palette: PALETTE,
  parts: { crown: chipCrown.part },
  anims: { idle: lazyAnim(() => ({ loop: true, frames: [{ ms: 1000, layers: [{ part: "crown", x: chipCrown.at[0], y: chipCrown.at[1] }] }] })) },
};

// ---- (The street town, the north edge round, Nov 5) What its 3D Colosseum (coliseum-ring.ts) reuses of this picture: the palette, the
// tablet, the relief, a banner and the flag as parts; and each chess piece on its plinth as a figure of its own, standing on the plaza.

export const COLISEUM_PALETTE: Readonly<Record<string, string>> = PALETTE;
/** The parts (position-free: each placed where its user wants it) and their sizes (px). */
export const COLISEUM_PARTS = { tablet: tablet.part, relief: relief.part, banner: parts.banner!, flag, penGold: parts.penGold!, penNavy: parts.penNavy! } as const;
export const COLISEUM_SIZES = { tablet: [BW, BH], relief: [RELIEF_W, RELIEF_H], banner: [BAN_W, BAN_H], flag: [FLAG_W, FLAG_H], pennant: [PEN_W, PEN_H] } as const;
/** The chess pieces that stand on the plaza (the plan's props, kind "piece", v its index here). */
export const PIECE_NAMES = ["queen", "king", "bishop", "rook", "knight", "pawn"] as const;
/** A piece on its plinth, as a figure: its foot (the plinth's) at the bottom middle, 3 px over its last row, the town's 37 px a square. */
function pieceArt(name: (typeof PIECE_NAMES)[number]): Character {
  const pw = Math.max(PLINTH_W, 2 * Math.ceil(14 * PS)) + 4;
  const ph = Math.ceil(({ queen: QUEEN.h, king: KING.h, bishop: BISHOP.h, rook: ROOK.h, knight: 46, pawn: PAWN.h } as const)[name] * PS);
  const w = pw;
  const h = PLINTH_H + ph + 6;
  const cx = w / 2;
  const fy = h - 2;
  const pl = plinth(cx, fy);
  const pc = name === "knight" ? knight(cx, fy - PLINTH_H, false) : lathe(cx, fy - PLINTH_H, { queen: QUEEN, king: KING, bishop: BISHOP, rook: ROOK, pawn: PAWN }[name], name === "queen" || name === "king" ? BRONZE : MARBLE);
  return {
    id: `coliseum-piece-${name}`,
    name,
    w,
    h,
    foot: [Math.floor(cx), h - 3],
    palette: PALETTE,
    parts: { plinth: pl.part, piece: pc.part },
    anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "plinth", x: pl.at[0], y: pl.at[1] }, { part: "piece", x: pc.at[0], y: pc.at[1] }] }] } },
  };
}
export const PIECE_ART: readonly Character[] = PIECE_NAMES.map(pieceArt);
