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
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { TOWN_FEEL } from "../feel.ts";
import { COLISEUM } from "../world.ts";
import { grain, groundShadow, paint, signBoard, signFace, TORCH, type LightPool, type LightSpot, type Pt } from "./kit.ts";
import { PED_W, STATUE_W, statueH, type StatueId } from "./statues.ts";

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
/** The queen and king either side of the gate. */
const GUARD = 86;
const W = 2 * (PIECE_2 + PLINTH_W / 2 + 6);
const FOOT = 364;
const H = FOOT + 8;
const CX = W / 2;
/** The oval wall: half its width and half its depth as drawn (seen a little from above), its height. */
const RX = 236;
const RY = 70;
const HW = 150;
/** The middles of its foot's oval and its top's. */
const BASE_CY = FOOT - RY;
const TOP_CY = BASE_CY - HW;

/** Light from the top left: how lit the wall's face is where it faces sideways by `s` (-1 left, 0 ahead, 1 right). */
const wallLight = (s: number, c: number) => 0.56 - 0.42 * s + 0.25 * (c - 0.7);
const STONE = "123456";
const stone = (l: number): string => (l > 0.8 ? "1" : l > 0.62 ? "2" : l > 0.44 ? "3" : l > 0.26 ? "4" : l > 0.1 ? "5" : "6");
/** One step darker (a joint, a shadow). */
const darker = (k: string): string => STONE[Math.min(5, STONE.indexOf(k) + 1)]!;

// ---- The wall: three tiers of arches round its curve, a tier of windows, the cornices between them, the checkered
// attic band on top; the portal in the middle of its front.

/** Its tiers, in pixels above its foot: where each starts, how tall its arches stand (0: square windows), where it ends. */
const TIERS = [
  { h0: 6, arch: 32, h1: 42 },
  { h0: 48, arch: 28, h1: 78 },
  { h0: 84, arch: 24, h1: 108 },
  { h0: 114, arch: 0, h1: 130 },
] as const;
/** The attic's checkered band (two rows of squares) and its lip. */
const ATTIC = 130;
const CHECK = 7;
/** Bays (arches) across its front half: odd, so one is in the middle (the gate's). */
const BAYS = 27;
const BAY = Math.PI / BAYS;
/** The portal: its pilasters' outer edge, the gate's half-width and height. */
const PORTAL = 54;
const GATE_R = 22;
const GATE_H = 64;

/** Is (ax, h) inside an arch `r` wide (half) whose top is at `top`, its foot at h0? (ax: across from its middle.) */
const inArch = (ax: number, h: number, h0: number, top: number, r: number) => h >= h0 && (h < top - r ? Math.abs(ax) < r : ax * ax + (h - (top - r)) ** 2 < r * r);

/** A small marble pawn standing in an arch (the middle tier's, every other bay): `ax` across its arch, `j` up from its foot, `r` the arch's half-width. */
function archPawn(ax: number, j: number, r: number): string | null {
  const u = r / 9; // its size follows the arch's, foreshortened round the curve
  const X = ax / u;
  const J = j / u;
  if (J < 0 || J > 19) return null;
  const hw = J < 3 ? 5.5 : J < 11 ? 4.5 - ((J - 3) / 8) * 2 : J < 12.5 ? 4.6 : J < 13 ? 2 : Math.sqrt(Math.max(0, 9.6 - (J - 16) ** 2));
  if (Math.abs(X) > hw) return null;
  return X < -hw * 0.3 ? "M" : X > hw * 0.45 ? "o" : "m";
}

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
  const base = stone(lit + (grain(Math.floor((th + 2) * 70), Math.floor(h / 6), 4) - 0.5) * 0.1);
  // The portal: the gate, its arch of voussoirs and keystone, the pilasters either side (the tablet and relief are parts).
  if (Math.abs(X) < PORTAL && h < ATTIC) {
    const ax = Math.abs(X);
    if (inArch(X, h, 0, GATE_H, GATE_R)) {
      // The tunnel: dark, a smaller arch at its far end lit by the arena, the board's squares on the floor there.
      if (inArch(X, h, 6, 40, 13)) return h < 14 ? ((Math.floor((X + 16) / 4) + Math.floor(h / 3.5)) % 2 ? "L" : "D") : h < 18 ? "X" : "x";
      // The portcullis, raised: its teeth hang under the arch, a bar across them.
      if (h > 48 && (Math.floor(X + 30) % 5 === 0 || (h > 55 && h < 58))) return "5";
      return "z";
    }
    if (inArch(X, h, 0, GATE_H + 7, GATE_R + 7)) {
      if (ax < 4 && h > GATE_H - 2) return ax < 3 ? "1" : "3"; // the keystone
      const k = Math.floor(Math.atan2(h - (GATE_H - GATE_R), X) * 7) % 2;
      return h > GATE_H + 5 || ax > GATE_R + 5.5 ? "4" : k ? "2" : "3"; // the voussoirs, a shadowed rim
    }
    // Pilasters, each with a capital and a fluted shaft.
    if (ax >= PORTAL - 10) {
      if (ax >= PORTAL - 1) return "5";
      if (h > ATTIC - 6) return h > ATTIC - 2 ? "1" : "3"; // the capital
      if (h < 6) return "4"; // the base
      const f = Math.floor(ax) % 3 === 0;
      return X < 0 ? (f ? "2" : "1") : f ? "5" : "4";
    }
    if (h < 6) return "4";
    // The portal's face: dressed blocks.
    const row = Math.floor(h / 8);
    if (h % 8 < 1 || Math.floor(X + 200 + (row % 2) * 9) % 18 < 1) return X < 0 ? "3" : "4";
    return X < 0 ? "2" : "3";
  }
  // The plinth course at its foot.
  if (h < 6) return h > 5 ? stone(lit) : h > 3 ? darker(base) : darker(darker(base));
  // The attic: two rows of the board's squares round the curve, a lit lip on top.
  if (h >= ATTIC) {
    if (h >= ATTIC + 2 * CHECK) return h >= HW - 1 ? "1" : h >= HW - 3 ? stone(lit + 0.2) : darker(stone(lit + 0.1));
    const col = Math.floor((th + Math.PI / 2) / (BAY / 4));
    const sq = (col + Math.floor((h - ATTIC) / CHECK)) % 2 ? "L" : "D";
    return lit < 0.15 && sq === "L" ? "4" : sq;
  }
  for (let ti = 0; ti < TIERS.length; ti++) {
    const t = TIERS[ti]!;
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
      if (inArch(ax, h, t.h0, t.h0 + t.arch, r)) {
        // A marble pawn in every other arch of the middle tier, where the arches face us enough to show one.
        if (ti === 1 && i % 2 === 0 && c > 0.55) {
          const k = archPawn(ax, h - t.h0 - 1, r);
          if (k) return k;
        }
        return ax > r - 1.6 ? "X" : "x";
      }
      if (inArch(ax, h, t.h0, t.h0 + t.arch + 2, r + 2)) {
        if (Math.abs(ax) < 1.2 && h > t.h0 + t.arch) return "1"; // the keystone
        return stone(lit + 0.18); // the arch's lit stone frame
      }
    } else if (Math.abs(ax) < r * 0.7 && h >= t.h0 + 4 && h < t.h1 - 3) return ax > r * 0.7 - 1.6 ? "X" : "x"; // a window
    // Half-columns between the bays, with a capital under each cornice.
    if (Math.abs(a) > 0.42) return h >= t.h1 - 2 ? stone(lit + 0.25) : a < 0 ? darker(base) : stone(lit + 0.15);
    return base;
  }
  return base;
}
const wall = paint(CX - RX, TOP_CY, 2 * RX, BASE_CY + RY - TOP_CY + 1, wallPixel);

// ---- The open top: its rim, the seats inside (rows stepping down to the arena), the podium's checkered wall, the
// arena's floor (a chessboard). Each pixel shows the row whose far edge passes through it.

const RIM = 11;
/** The seats' ovals step down from the rim (s = 0) to the arena's edge (s = 1): middle, half-width, half-depth. */
const SEAT_DROP = 46;
const ARENA_RX = 124;
const ARENA_RY = 23;
const rowAt = (s: number) => ({ cy: TOP_CY + s * SEAT_DROP, rx: RX - RIM - s * (RX - RIM - ARENA_RX), ry: RY - 4 - s * (RY - 4 - ARENA_RY) });
const ROWS = 14;
const PODIUM = 0.88;
const bowl = paint(CX - RX, TOP_CY - RY, 2 * RX, 2 * RY + 1, (x, y) => {
  const X = x + 0.5 - CX;
  const Y = y + 0.5;
  if ((X / RX) ** 2 + ((Y - TOP_CY) / RY) ** 2 > 1) return null;
  const inside = (s: number) => {
    const o = rowAt(s);
    return (X / o.rx) ** 2 + ((Y - o.cy) / o.ry) ** 2 <= 1;
  };
  if (!inside(0)) {
    // The rim's walk: lit on the left, a joint every so often round it.
    if (Math.floor(Math.atan2(Y - TOP_CY, X) * 30 + 100) % 6 === 0) return "4";
    return X < -RX * 0.5 ? "1" : X < RX * 0.6 ? "2" : "3";
  }
  let s = 0;
  while (s < 1 && inside(s)) s += 1 / 160;
  const side = X / RX; // the right side faces the light (it faces left); the left side faces away
  if (s >= 1) {
    // The arena: a chessboard, eight squares across.
    const u = Math.floor((X + ARENA_RX) / ((2 * ARENA_RX) / 8));
    const v = Math.floor((Y - (TOP_CY + SEAT_DROP - ARENA_RY)) / ((2 * ARENA_RY) / 8));
    return (u + v) % 2 ? "L" : "D";
  }
  if (s >= PODIUM) return s < PODIUM + 0.02 ? "1" : Math.floor(X / 7 + 80) % 2 ? "L" : "D"; // the podium's wall, a lit lip on it
  const f = (s / PODIUM) * ROWS;
  const tread = f - Math.floor(f) < 0.45;
  // Dark doorways (vomitoria) in three of the rows, spaced round the bowl; gold seats for the honored in the front row.
  if (!tread && (Math.floor(f) === 3 || Math.floor(f) === 7 || Math.floor(f) === 11) && Math.floor(X / 12 + 80 + Math.floor(f)) % 5 === 0) return "x";
  if (Math.floor(f) === ROWS - 1 && tread) return side > 0 ? "Y" : "O";
  if (tread) return side > -0.35 ? "2" : "3";
  return side > 0.25 ? "3" : side > -0.45 ? "4" : "5";
});

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
/** The banners' places across its face; each hangs from the attic's foot there. */
const BANNERS = [-164, -124, 124, 164];
const banY = (bx: number) => TOP_CY + Math.round(RY * Math.sqrt(1 - (bx / RX) ** 2)) + HW - ATTIC + 1;

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
const mast = (px: number, top: number, foot: number) => paint(px, top, 2, foot - top, (x, y) => (y < top + 2 ? "y" : x === px ? "w" : "W"));
/** The pennants' masts on the far rim (gold and navy pennants in turn). */
const MASTS = [-196, -116, 116, 196];
const mastFoot = (mx: number) => TOP_CY - Math.round(RY * Math.sqrt(1 - (mx / RX) ** 2)) + 1;
const MAST_H = 30;
const FLAG_FOOT = TOP_CY - RY + 3;
const FLAG_TOP = FLAG_FOOT - 70;
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
const BACK = BASE_CY - 8;
const STAND = FRONT - PLINTH_H;
const BACK_X = RX + 16;

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
parts.banner = banner();
parts.flag = flag;
parts.penGold = pennant("Y", "O");
parts.penNavy = pennant("N", "Y");
const shadow = add("shadow", groundShadow(CX, BASE_CY + 14, RX + 40, RY + 18));
const back = [
  add("plinthPL", plinth(CX - BACK_X, BACK)),
  add("pawnL", lathe(CX - BACK_X, BACK - PLINTH_H, PAWN, MARBLE)),
  add("plinthPR", plinth(CX + BACK_X, BACK)),
  add("pawnR", lathe(CX + BACK_X, BACK - PLINTH_H, PAWN, MARBLE)),
  ...MASTS.map((mx, i) => add(`mast${i}`, mast(CX + mx - 1, mastFoot(mx) - MAST_H, mastFoot(mx)))),
  add("flagMast", mast(CX - 1, FLAG_TOP, FLAG_FOOT)),
];
const body = [add("bowl", bowl), add("wall", wall), add("tablet", tablet), add("relief", relief)];
const front = [
  add("plinthRk", plinth(CX - PIECE_2, FRONT)),
  add("rook", lathe(CX - PIECE_2, STAND, ROOK, MARBLE)),
  add("plinthB", plinth(CX - PIECE_1, FRONT)),
  add("bishop", lathe(CX - PIECE_1, STAND, BISHOP, MARBLE)),
  add("plinthN", plinth(CX + PIECE_1, FRONT)),
  add("knight", knight(CX + PIECE_1, STAND, false)),
  add("plinthP", plinth(CX + PIECE_2, FRONT)),
  add("pawn", lathe(CX + PIECE_2, STAND, PAWN, MARBLE)),
  add("plinthQ", plinth(CX - GUARD, FRONT)),
  add("queen", lathe(CX - GUARD, STAND, QUEEN, BRONZE)),
  add("plinthK", plinth(CX + GUARD, FRONT)),
  add("king", lathe(CX + GUARD, STAND, KING, BRONZE)),
];
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

const frames: Frame[] = [0, 1, 2, 3].map((f) => {
  const ph = (f * Math.PI) / 2;
  const hang = (p: number) => ({ along: "rows" as const, amp: 1.4, len: 48, phase: p, pin: "top" as const });
  const fly = (p: number, amp: number, len: number) => ({ along: "cols" as const, amp, len, phase: p, pin: "left" as const });
  return {
    ms: 260,
    layers: [
      L(shadow),
      ...back.map(L),
      ...MASTS.map((mx, i) => ({ part: i % 2 ? "penNavy" : "penGold", x: CX + mx + 1, y: mastFoot(mx) - MAST_H + 1, wave: fly(ph + i * 0.9, 1.4, 18) })),
      { part: "flag", x: CX + 1, y: FLAG_TOP + 1, wave: fly(ph + 0.6, 2.4, 34) },
      ...body.map(L),
      ...BANNERS.map((bx, i) => ({ part: "banner", x: CX + bx - BAN_W / 2, y: banY(bx), wave: hang(ph + i * 1.4) })),
      ...front.map(L),
    ],
  };
});

const idle: Anim = { loop: true, frames };

export const HOUSE_COLISEUM: Character = {
  id: "house-coliseum",
  name: "The Colosseum",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/**
 * Where a statue's picture stands over this one (frame pixels: its top left; it is STATUE_W x statueH(id)), its
 * pedestal's foot on the front row's line, either side of the gate.
 */
export const statueSpot = (id: StatueId): Pt => [CX + (id === "marble" ? -1 : 1) * STATUE_OFF - STATUE_W / 2, FRONT + 1 - statueH(id)];

/** Where the tablet's blank face is (frame pixels), for the game to write "The Colosseum" on. */
export const HOUSE_COLISEUM_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

/** A bay's arch on a tier (the box round its opening, a little wider, in picture pixels): where its light shines. */
function archBox(tier: number, i: number): { x: number; y: number; w: number; h: number } {
  const t = TIERS[tier]!;
  const th = (i + 0.5) * BAY - Math.PI / 2;
  const c = Math.cos(th);
  const r = 0.32 * RX * BAY * c;
  const yb = BASE_CY + RY * c;
  const x = Math.floor(CX + RX * Math.sin(th) - r - 2);
  return { x, y: Math.floor(yb - t.h0 - t.arch - 3), w: Math.ceil(2 * r) + 5, h: t.arch + 6 };
}
/**
 * Its lights at dusk and night (Oct 27): the gate's tunnel glows as if torches burn inside, and so do a scattered few of
 * its arches (two of the lower tier's, one of the middle tier's without a marble pawn; none near the statues, the queen
 * and the king, or under a banner), all flickering; a little of the gate's light falls on the apron in front.
 */
export const HOUSE_COLISEUM_LIGHTS: readonly LightSpot[] = [
  { x: CX - GATE_R, y: FOOT - GATE_H, w: 2 * GATE_R + 1, h: GATE_H, keys: "zxXLD", color: TORCH, strength: 0.85, flicker: true },
  ...([
    [0, 7],
    [1, 9],
    [0, 18],
  ] as const).map(([tier, i]) => ({ ...archBox(tier, i), keys: "xX", color: TORCH, strength: 0.75, flicker: true })),
];
export const HOUSE_COLISEUM_POOLS: readonly LightPool[] = [{ x: CX, y: FOOT - 1, rx: 34, ry: 8, color: TORCH, strength: 0.3 }];

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
  anims: { idle: { loop: true, frames: [{ ms: 1000, layers: [{ part: "crown", x: chipCrown.at[0], y: chipCrown.at[1] }] }] } },
};
