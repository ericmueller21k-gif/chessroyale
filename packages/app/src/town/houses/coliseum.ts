/**
 * The Coliseum: the heart of the town square, where raids with people will start (Eric, Oct 26: "a much bigger building…
 * a coliseum with chess theme, maybe even statues of chess pieces around it"). A Roman amphitheater seen from the front
 * and a little above, lit from the top left like everything in the square: an oval wall of warm stone in three tiers of
 * arches under a checkered attic band (the board's light and dark squares), its open top showing the seats inside and a
 * strip of the arena's floor, a chessboard; in the middle of its front a tall portal with a dark arched gate (a raised
 * portcullis, the sunlit floor at the tunnel's end), a stone tablet over it (blank: the game writes "The Coliseum" on it)
 * and a panel of chess pieces carved in relief above; navy and gold banners (the game's colors) hung on its face, two
 * pennants on its far rim and a flag on a mast over it all. Statues of chess pieces on plinths stand round it: the bronze
 * queen and king either side of the gate, a marble bishop beyond the king, a marble rook and knight at its front corners,
 * two marble pawns at its back corners, and one empty plinth on the gate's left beyond the queen with a small brass plate
 * (the Hidden Boss's statue comes later). `idle`: the banners and pennants stir and the flag flutters.
 *
 * It stands on its 6 x 6 ground (world.ts, COLISEUM), its foot (the gate's sill) on the ground's front edge; at the
 * homes' scale (37 pixels a square) it is about 8 squares across with its statues, twice a home's size.
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, type Pt } from "./kit.ts";

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

const W = 320;
const H = 246;
const CX = 160;
const FOOT = 236;
/** The oval wall: half its width and half its depth as drawn (seen a little from above), its height. */
const RX = 118;
const RY = 36;
const HW = 96;
/** The middles of its foot's oval and its top's. */
const BASE_CY = FOOT - RY;
const TOP_CY = BASE_CY - HW;

/** Light from the top left: how lit the wall's face is where it faces sideways by `s` (-1 left, 0 ahead, 1 right). */
const wallLight = (s: number, c: number) => 0.56 - 0.42 * s + 0.25 * (c - 0.7);
const STONE = "123456";
const stone = (l: number): string => (l > 0.8 ? "1" : l > 0.62 ? "2" : l > 0.44 ? "3" : l > 0.26 ? "4" : l > 0.1 ? "5" : "6");
/** One step darker (a joint, a shadow). */
const darker = (k: string): string => STONE[Math.min(5, STONE.indexOf(k) + 1)]!;

// ---- The wall: three tiers of arches round its curve, the cornices between them, the checkered attic band on top;
// the portal in the middle of its front.

/** Its tiers, in pixels above its foot: where each starts, how tall its arches stand (0: square windows), where it ends. */
const TIERS = [
  { h0: 4, arch: 26, h1: 36 },
  { h0: 40, arch: 22, h1: 66 },
  { h0: 70, arch: 0, h1: 86 },
] as const;
/** The attic's checkered band (two rows of squares) and its lip. */
const ATTIC = 86;
const CHECK = 4;
/** Bays (arches) across its front half: odd, so one is in the middle (the gate's). */
const BAYS = 15;
const BAY = Math.PI / BAYS;
/** The portal: its pilasters' outer edge, the gate's half-width and height. */
const PORTAL = 30;
const GATE_R = 15;
const GATE_H = 44;

/** Is (ax, h) inside an arch `r` wide (half) whose top is at `top`, its foot at h0? (ax: across from its middle.) */
const inArch = (ax: number, h: number, h0: number, top: number, r: number) => h >= h0 && (h < top - r ? Math.abs(ax) < r : ax * ax + (h - (top - r)) ** 2 < r * r);

function wallPixel(x: number, y: number): string | null {
  const X = x + 0.5 - CX;
  const s = X / RX;
  if (Math.abs(s) >= 1) return null;
  const c = Math.sqrt(1 - s * s);
  const Y = y + 0.5;
  const yb = BASE_CY + RY * c;
  if (Y < TOP_CY + RY * c || Y >= yb) return null;
  const h = yb - Y; // height above its foot
  const th = Math.asin(s);
  const lit = wallLight(s, c);
  const base = stone(lit + (grain(Math.floor((th + 2) * 40), Math.floor(h / 6), 4) - 0.5) * 0.1);
  // The portal: the gate, its arch of voussoirs and keystone, the pilasters either side (the tablet and relief are parts).
  if (Math.abs(X) < PORTAL && h < ATTIC) {
    const ax = Math.abs(X);
    if (inArch(X, h, 0, GATE_H, GATE_R)) {
      // The tunnel: dark, a smaller arch at its far end lit by the arena, the board's squares on the floor there.
      if (inArch(X, h, 4, 24, 8)) return h < 9 ? ((Math.floor((X + 8) / 3) + Math.floor(h / 2.5)) % 2 ? "L" : "D") : h < 12 ? "X" : "x";
      // The portcullis, raised: its teeth hang under the arch.
      if (h > 33 && (Math.floor(X + 16) % 4 === 0 || (h > 37 && h < 39))) return "5";
      return "z";
    }
    if (inArch(X, h, 0, GATE_H + 4, GATE_R + 4)) {
      if (ax < 2.5 && h > GATE_H - 2) return "1"; // the keystone
      return Math.floor(Math.atan2(h - (GATE_H - GATE_R), X) * 4.5) % 2 ? "2" : "3"; // the voussoirs
    }
    if (ax >= PORTAL - 6) return ax >= PORTAL - 1 ? "5" : X < 0 ? (ax < PORTAL - 4 ? "1" : "2") : ax < PORTAL - 4 ? "4" : "5"; // pilasters
    if (h < 4) return "4";
    return X < 0 ? "2" : "3";
  }
  // The plinth course at its foot.
  if (h < 4) return h > 3 ? darker(base) : darker(darker(base));
  // The attic: two rows of the board's squares round the curve, a lit lip on top.
  if (h >= ATTIC) {
    if (h >= ATTIC + 2 * CHECK) return h >= HW - 1 ? "1" : stone(lit + 0.2);
    const col = Math.floor((th + Math.PI / 2) / (BAY / 3));
    const sq = (col + Math.floor((h - ATTIC) / CHECK)) % 2 ? "L" : "D";
    return lit < 0.15 && sq === "L" ? "4" : sq;
  }
  for (const t of TIERS) {
    if (h >= t.h1) continue;
    if (h < t.h0) return h >= t.h0 - 1 ? "1" : h >= t.h0 - 3 ? stone(lit) : darker(base); // a cornice: a lit lip over its band
    // The bay this pixel is in, and how far across it (in pixels, foreshortened round the curve).
    const i = Math.floor((th + Math.PI / 2) / BAY);
    const a = (th + Math.PI / 2) / BAY - i - 0.5;
    const bayW = RX * BAY * c;
    const ax = a * bayW;
    const r = 0.32 * bayW;
    if (r < 1.6) return base; // too far round the curve for an arch to show
    if (t.arch) {
      if (inArch(ax, h, t.h0, t.h0 + t.arch, r)) return ax > r - 1.6 ? "X" : "x";
      if (inArch(ax, h, t.h0, t.h0 + t.arch + 1.5, r + 1.5)) return stone(lit + 0.18); // the arch's lit stone frame
    } else if (Math.abs(ax) < r * 0.8 && h >= t.h0 + 4 && h < t.h1 - 4) return ax > r * 0.8 - 1.6 ? "X" : "x"; // a window
    // Half-columns between the bays.
    if (Math.abs(a) > 0.42) return a < 0 ? darker(base) : stone(lit + 0.15);
    return base;
  }
  return base;
}
const wall = paint(CX - RX, TOP_CY, 2 * RX, BASE_CY + RY - TOP_CY + 1, wallPixel);

// ---- The open top: its rim, the seats inside (rows stepping down to the arena), the podium's checkered wall, the
// arena's floor (a chessboard). Each pixel shows the row whose far edge passes through it.

const RIM = 7;
/** The seats' ovals step down from the rim (s = 0) to the arena's edge (s = 1): middle, half-width, half-depth. */
const SEAT_DROP = 44;
const ARENA_RX = 58;
const ARENA_RY = 15;
const rowAt = (s: number) => ({ cy: TOP_CY + s * SEAT_DROP, rx: RX - RIM - s * (RX - RIM - ARENA_RX), ry: RY - 2.5 - s * (RY - 2.5 - ARENA_RY) });
const ROWS = 8;
const PODIUM = 0.86;
const bowl = paint(CX - RX, TOP_CY - RY, 2 * RX, 2 * RY + 1, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if ((X / RX) ** 2 + ((Y - TOP_CY) / RY) ** 2 > 1) return null;
  const inside = (s: number) => {
    const o = rowAt(s);
    return (X / o.rx) ** 2 + ((Y - o.cy) / o.ry) ** 2 <= 1;
  };
  if (!inside(0)) return X < -RX * 0.5 ? "1" : Math.abs(X) < RX * 0.5 && Y > TOP_CY ? "2" : X < RX * 0.6 ? "2" : "3"; // the rim
  let s = 0;
  while (s < 1 && inside(s)) s += 1 / 96;
  const side = X / RX; // the right side faces the light (it faces left); the left side faces away
  if (s >= 1) return (Math.floor(X / 7 + 40) + Math.floor((Y - (TOP_CY + SEAT_DROP)) / 3 + 40)) % 2 ? "L" : "D"; // the arena: a board
  if (s >= PODIUM) return s < PODIUM + 0.03 ? "1" : (Math.floor(X / 5 + 40) % 2 ? "L" : "D"); // the podium's wall, a lit lip on it
  const f = (s / PODIUM) * ROWS;
  const tread = f - Math.floor(f) < 0.45;
  // Dark doorways (vomitoria) in two of the rows, spaced round the bowl.
  if (!tread && (Math.floor(f) === 2 || Math.floor(f) === 5) && Math.floor(X / 9 + 40 + Math.floor(f)) % 4 === 0) return "x";
  if (tread) return side > -0.35 ? "2" : "3";
  return side > 0.25 ? "3" : side > -0.45 ? "4" : "5";
});

// ---- The portal's tablet (blank: the game writes "The Coliseum" on it) and the relief of chess pieces over it.

const BOARD: Pt = [CX - 31, FOOT - 74];
const BW = 62;
const BH = 24;
const tablet = signBoard(BOARD[0], BOARD[1], BW, BH, "Bbcy", "mMv", "Y");
/** Five pieces carved in a panel (rook, knight, king, queen, bishop), each 9 wide on a plan of 7 x 9 (x right, j up). */
const RELIEF_W = 52;
const RELIEF_H = 12;
const RELIEF_Y = FOOT - 86;
const carved: ((i: number, j: number) => boolean)[] = [
  (i, j) => j < 2 || (j < 7 && i > 0 && i < 6) || (j >= 7 && i !== 1 && i !== 5 && i !== 3), // rook
  (i, j) => j < 2 || (j < 4 && i > 0 && i < 6) || (j >= 4 && i >= 1 && i <= 5 && !(i < 3 && j < 6) && !(i === 1 && j > 7)), // knight (facing left)
  (i, j) => j < 2 || (i > 1 && i < 5 && j < 6) || (j >= 4 && j < 7 && i > 0 && i < 6) || (i === 3 && j >= 6) || (j === 7 && i > 1 && i < 5), // king
  (i, j) => j < 2 || (i > 1 && i < 5 && j < 5) || (j >= 4 && j < 7 && i > 0 && i < 6) || (j >= 7 && (i === 1 || i === 3 || i === 5)), // queen
  (i, j) => j < 2 || (i > 1 && i < 5 && j < 4) || (j >= 3 && j < 8 && i > 0 && i < 6 && !(i === 4 && j === 6)) || (i === 3 && j === 8), // bishop
];
const relief = paint(CX - RELIEF_W / 2, RELIEF_Y, RELIEF_W, RELIEF_H, (x, y) => {
  const i0 = x - (CX - RELIEF_W / 2);
  const j0 = RELIEF_Y + RELIEF_H - 1 - y;
  if (j0 === RELIEF_H - 1 || i0 === 0) return "1";
  if (j0 === 0 || i0 === RELIEF_W - 1) return "4";
  const p = Math.floor((i0 - 2) / 10);
  const i = i0 - 2 - p * 10 - 1;
  const j = j0 - 1;
  if (p >= 0 && p < 5 && i >= 0 && i < 7 && j < 9 && carved[p]!(i, j)) return i === 0 || j === 8 ? "2" : "5"; // the carving, lit on its top left
  return "3";
});

// ---- Banners on its face, pennants on its far rim, the flag on its mast.

const BAN_W = 14;
const BAN_H = 44;
/** A banner: navy with a gold edge, a gold crown on it, its foot cut in a point with a gold fringe. */
function banner(): Part {
  const grid: string[] = [];
  for (let j = 0; j < BAN_H; j++) {
    let row = "";
    for (let i = 0; i < BAN_W; i++) {
      const point = Math.abs(i - (BAN_W - 1) / 2) * 0.6;
      if (j > BAN_H - 4 - point) row += j > BAN_H - 2 - point ? "." : i % 2 ? "Y" : "O";
      else if (i === 0 || i === BAN_W - 1) row += "Y";
      else if (j < 3) row += j === 1 ? "Y" : "N";
      else if (j >= 12 && j < 20 && crown(i - 3, j - 12)) row += j < 14 ? "y" : "Y";
      else row += i < 4 ? "n" : "N";
    }
    grid.push(row);
  }
  return { grid };
}
/** A small crown on an 8 x 8 plan: three points, a band. */
function crown(i: number, j: number): boolean {
  if (i < 0 || i > 7 || j < 0 || j > 7) return false;
  if (j >= 5) return true;
  return (i === 0 || i === 7 || i === 3 || i === 4) ? j >= 1 : j >= 3;
}
const BAN_X = 66;
const BAN_Y = TOP_CY + Math.round(RY * Math.sqrt(1 - (BAN_X / RX) ** 2)) + HW - ATTIC + 1;

const PEN_W = 16;
const PEN_H = 9;
/** A pennant: a long triangle, `main` with a stripe of `stripe`. */
function pennant(main: string, stripe: string): Part {
  const grid: string[] = [];
  for (let j = 0; j < PEN_H; j++) {
    let row = "";
    for (let i = 0; i < PEN_W; i++) {
      const half = (PEN_H / 2) * (1 - i / PEN_W);
      row += Math.abs(j + 0.5 - PEN_H / 2) < half ? (Math.abs(j + 0.5 - PEN_H / 2) < 1 ? stripe : main) : ".";
    }
    grid.push(row);
  }
  return { grid };
}
const mast = (px: number, top: number, foot: number) => paint(px, top, 2, foot - top, (x, y) => (y < top + 2 ? "y" : x === px ? "w" : "W"));
const MAST_X = 84;
const MAST_FOOT = TOP_CY - Math.round(RY * Math.sqrt(1 - (MAST_X / RX) ** 2)) + 1;
const MAST_TOP = MAST_FOOT - 22;
const FLAG_FOOT = TOP_CY - RY + 2;
const FLAG_TOP = FLAG_FOOT - 44;
const FLAG_W = 30;
const FLAG_H = 17;
/** The flag: navy with a gold border and a gold crown. */
const flag: Part = {
  grid: Array.from({ length: FLAG_H }, (_, j) =>
    Array.from({ length: FLAG_W }, (_, i) => (j === 0 || j === FLAG_H - 1 || i === FLAG_W - 1 ? "Y" : crown(i - 11, j - 4) ? (j < 7 ? "y" : "Y") : j < 3 ? "n" : "N")).join(""),
  ),
};

// ---- The statues: chess pieces on plinths, turned on a lathe (marble or bronze, lit from the left); the knight carved.

/** Light, mid and dark keys of each stuff. */
const BRONZE = "cbB";
const MARBLE = "Mmo";
/** A piece standing on (cx, foot), `h` tall: its half-width at each height j above its foot (<= 0: nothing there). */
function lathe(cx: number, foot: number, h: number, hw: (j: number) => number, stuff: string, cut?: (X: number, j: number) => string | null | undefined) {
  return paint(cx - 14, foot - h, 28, h, (x, y) => {
    const X = x + 0.5 - cx;
    const j = foot - (y + 0.5);
    const w = hw(j);
    if (w <= 0 || Math.abs(X) > w) return null;
    const k = cut?.(X, j);
    if (k !== undefined) return k;
    const t = X / w;
    if (stuff === BRONZE && t > -0.6 && t < -0.35 && Math.floor(j) % 9 === 4) return "v"; // a glint on the bronze
    return t < -0.4 ? stuff[0]! : t > 0.35 ? stuff[2]! : stuff[1]!;
  });
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
/** Every piece's foot: a broad base and a step. */
const foot = (j: number, w: number) => (j < 3 ? w : w - 2);

const pawn = (cx: number, fy: number) =>
  lathe(cx, fy, 30, (j) => (j < 5 ? foot(j, 11) : j < 16 ? lerp(7.5, 4.5, (j - 5) / 11) : j < 18 ? 7.5 : j < 19 ? 4 : Math.sqrt(Math.max(0, 36 - (j - 24.5) ** 2))), MARBLE);
const rook = (cx: number, fy: number) =>
  lathe(
    cx,
    fy,
    40,
    (j) => (j < 5 ? foot(j, 12) : j < 30 ? lerp(8.5, 7.5, (j - 5) / 25) : 10.5),
    MARBLE,
    (X, j) => (j >= 35 && !(Math.abs(X) < 2.5 || Math.abs(X) > 6) ? null : j >= 30 && j < 31 ? "o" : undefined), // the crenels, the flare's shadow
  );
const bishop = (cx: number, fy: number) =>
  lathe(
    cx,
    fy,
    46,
    (j) => (j < 5 ? foot(j, 12) : j < 22 ? lerp(8, 4.5, (j - 5) / 17) : j < 24 ? 8 : j < 25 ? 4.5 : j < 41 ? 7.5 * Math.sqrt(Math.max(0, 1 - ((j - 32) / 9) ** 2)) : Math.sqrt(Math.max(0, 6.25 - (j - 43.5) ** 2))),
    MARBLE,
    (X, j) => (j > 30 && j < 38 && Math.abs(X - (j - 34) * 0.6) < 0.8 ? "o" : undefined), // the mitre's slit
  );
const queen = (cx: number, fy: number) =>
  lathe(
    cx,
    fy,
    54,
    (j) => (j < 5 ? foot(j, 13) : j < 26 ? lerp(8.5, 4.5, (j - 5) / 21) : j < 28 ? 8.5 : j < 29 ? 4.5 : j < 42 ? lerp(4.5, 9.5, (j - 29) / 13) : j < 50 ? 9.5 : Math.sqrt(Math.max(0, 4.4 - (j - 52) ** 2))),
    BRONZE,
    // Its band, then five points tapering up from it (a coronet: never a rook's flat merlons), a ball over them.
    (X, j) => (j >= 42 && j < 44 ? "c" : j >= 44 && j < 50 ? (Math.abs(X - Math.round(X / 4.5) * 4.5) < 1.9 * (1 - (j - 44) / 6) + 0.3 ? undefined : null) : undefined),
  );
const king = (cx: number, fy: number) =>
  lathe(
    cx,
    fy,
    58,
    (j) => (j < 5 ? foot(j, 13) : j < 28 ? lerp(9, 5, (j - 5) / 23) : j < 30 ? 9 : j < 31 ? 5 : j < 43 ? lerp(5, 9, (j - 31) / 12) : j < 46 ? 9.5 : j < 48 ? 6 : j < 52 || j >= 55 ? 1.5 : 4.5),
    BRONZE,
    (X, j) => (j >= 43 && j < 46 ? "c" : undefined), // the band under the cross
  );
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
const knight = (cx: number, fy: number, flip: boolean) =>
  paint(cx - 14, fy - 46, 28, 46, (x, y) => {
    const X = (x + 0.5 - cx) * (flip ? -1 : 1);
    const j = fy - (y + 0.5);
    if (j < 5) return Math.abs(X) <= foot(j, 12) ? (X * (flip ? -1 : 1) < -5 ? "M" : X * (flip ? -1 : 1) > 4 ? "o" : "m") : null;
    if (!inPoly(X, j, KNIGHT)) return null;
    if (Math.hypot(X + 2.5, j - 33) < 1) return "o"; // its eye
    if (Math.hypot(X + 10, j - 24.5) < 0.8) return "o"; // its nostril
    if (X > 2 && j > 20 && inPoly(X + 2.6, j, KNIGHT) === false) return "o"; // the mane along its back
    // Lit where it faces the top left (its picture's left, whichever way it faces).
    const L = flip ? 1.6 : -1.6;
    if (!inPoly(X + L, j + 1.6, KNIGHT)) return "M";
    if (!inPoly(X - L, j - 1.6, KNIGHT)) return "o";
    return "m";
  });
/** A plinth under a statue: a cap, its block (lit on the left), a base. `plate`: a small brass plate on its face. */
const PLINTH_W = 26;
const PLINTH_H = 14;
const plinth = (cx: number, fy: number, plate = false) =>
  paint(cx - PLINTH_W / 2, fy - PLINTH_H, PLINTH_W, PLINTH_H, (x, y) => {
    const X = x + 0.5 - cx;
    const j = fy - 1 - y;
    if (j >= PLINTH_H - 2) return j === PLINTH_H - 1 ? "1" : X < 6 ? "2" : "3";
    if (j < 2) return X < -6 ? "3" : X < 7 ? "4" : "5";
    if (Math.abs(X) > PLINTH_W / 2 - 1.5) return null;
    if (plate && Math.abs(X) < 5 && j >= 5 && j <= 7) return j === 7 ? "y" : j === 6 ? "Y" : "O";
    return X < -7 ? "2" : X > 7 ? "4" : "3";
  });

/**
 * The statues' places: the queen and king either side of the gate, the bishop and the empty plinth beyond them, the
 * rook and knight at the front corners, the pawns at the back corners.
 */
const FRONT = FOOT + 4;
const BACK = BASE_CY - 6;
const STAND = FRONT - PLINTH_H;

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
parts.banner = banner();
parts.flag = flag;
parts.penGold = pennant("Y", "O");
parts.penNavy = pennant("N", "Y");
const shadow = add("shadow", groundShadow(CX, BASE_CY + 8, RX + 22, RY + 10));
const back = [
  add("plinthPL", plinth(CX - 140, BACK)),
  add("pawnL", pawn(CX - 140, BACK - PLINTH_H)),
  add("plinthPR", plinth(CX + 140, BACK)),
  add("pawnR", pawn(CX + 140, BACK - PLINTH_H)),
  add("mastL", mast(CX - MAST_X - 1, MAST_TOP, MAST_FOOT)),
  add("mastR", mast(CX + MAST_X - 1, MAST_TOP, MAST_FOOT)),
  add("flagMast", mast(CX - 1, FLAG_TOP, FLAG_FOOT)),
];
const body = [add("bowl", bowl), add("wall", wall), add("tablet", tablet), add("relief", relief)];
const front = [
  add("plinthR", plinth(CX - 124, FRONT)),
  add("rook", rook(CX - 124, STAND)),
  add("plinthN", plinth(CX + 124, FRONT)),
  add("knight", knight(CX + 124, STAND, false)),
  add("plinthE", plinth(CX - 74, FRONT, true)), // empty: a statue comes later (the Hidden Boss); a brass plate for now
  add("plinthB", plinth(CX + 74, FRONT)),
  add("bishop", bishop(CX + 74, STAND)),
  add("plinthQ", plinth(CX - 42, FRONT)),
  add("queen", queen(CX - 42, STAND)),
  add("plinthK", plinth(CX + 42, FRONT)),
  add("king", king(CX + 42, STAND)),
];
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

const frames: Frame[] = [0, 1, 2, 3].map((f) => {
  const ph = (f * Math.PI) / 2;
  const hang = (p: number) => ({ along: "rows" as const, amp: 1.2, len: 36, phase: p, pin: "top" as const });
  const fly = (p: number, amp: number, len: number) => ({ along: "cols" as const, amp, len, phase: p, pin: "left" as const });
  return {
    ms: 260,
    layers: [
      L(shadow),
      ...back.map(L),
      { part: "penGold", x: CX - MAST_X + 1, y: MAST_TOP + 1, wave: fly(ph, 1.2, 14) },
      { part: "penNavy", x: CX + MAST_X + 1, y: MAST_TOP + 1, wave: fly(ph + 1.2, 1.2, 14) },
      { part: "flag", x: CX + 1, y: FLAG_TOP + 1, wave: fly(ph + 0.6, 2, 24) },
      ...body.map(L),
      { part: "banner", x: CX - BAN_X - BAN_W / 2, y: BAN_Y, wave: hang(ph) },
      { part: "banner", x: CX + BAN_X - BAN_W / 2, y: BAN_Y, wave: hang(ph + 1.4) },
      ...front.map(L),
    ],
  };
});

const idle: Anim = { loop: true, frames };

export const HOUSE_COLISEUM: Character = {
  id: "house-coliseum",
  name: "The Coliseum",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the tablet's blank face is (frame pixels), for the game to write "The Coliseum" on. */
export const HOUSE_COLISEUM_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

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
  name: "The Coliseum",
  w: 24,
  h: 24,
  foot: [12, 23],
  palette: PALETTE,
  parts: { crown: chipCrown.part },
  anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "crown", x: chipCrown.at[0], y: chipCrown.at[1] }] }] } },
};
