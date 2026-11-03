/**
 * Blitz's Kicks: the speed-chess cheetah's home on the town square (Eric, Nov 3: "a straight up sneaker store ... the
 * outside can do the neon lighting, no chess clocks needed"). A flat-roofed little sneaker shop of charcoal painted brick:
 * a big neon sneaker (orange, a teal lightning stripe, teal speed lines behind its heel) on a black billboard standing on
 * the roof beside an air-conditioning box; a teal neon tube along the roofline and a teal neon cheetah paw over the door;
 * a teal and orange striped awning over a big window of sneakers on lit shelves, a red neon OPEN sign hung in it; a glass
 * door; a pair of sneakers hanging by their laces from a wire strung to a pole; a stack of orange shoe boxes by the door;
 * two cases of Cheetah Chug, the top one open on its cans. A blank sign board on two posts in front (the game writes the
 * name: no letters here). His colors (boss-blitz). No chess clocks anywhere.
 * `idle`: the neon buzzes (the speed lines blink off, the OPEN sign's N stutters), the hanging sneakers sway.
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-blitz/house-blitz.ts, Nov 3); only its imports moved. The
 * cheetah is Dash since Nov 3 (the art's file and exports keep `blitz`); the game writes "Dash's Kicks" on the sign (town/world.ts).
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { grain, groundShadow, paint, signBoard, signFace, signPost, WARM, type LightPool, type LightSpot, type Pt } from "./kit.ts";

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline (Blitz's)
  c: "#e0a53a", // his fur (cheetah print): mid, light, the spots
  d: "#f2c665",
  s: "#241610",
  A: "#0b4a4f", // his jacket's teal: dark to light
  B: "#137a7a",
  C: "#22a8a0",
  D: "#6fd8c8",
  E: "#8a3208", // his orange: dark to light
  F: "#d2601a",
  G: "#f28a2a",
  H: "#ffb860",
  I: "#5d6470", // greys (metal): mid, light, a steel shine
  J: "#a5adb8",
  L: "#8f96a3",
  M: "#c9ced8", // whites: shadow, white, bright
  N: "#eef1f5",
  O: "#ffffff",
  R: "#b01a22", // red: shade, mid
  S: "#ee3b3b",
  "1": "#262a33", // black metal: dark, mid
  "2": "#4f5562",
  a: "#221e2a", // the painted brick: mortar, then dark to lit
  e: "#2f2a3a",
  f: "#3d3749",
  g: "#4c4559",
  h: "#5e566c",
  p: "#707684", // concrete: dark to light
  q: "#9298a4",
  r: "#b8bcc6",
  t: "#d9dce2",
  W: "#fff3dc", // the lit shop inside: wall, shade, the light strip, the shelves' wood
  V: "#f0d6a6",
  X: "#fffdf6",
  U: "#c98f4e",
  u: "#c8eef2", // a reflection on the glass
  "!": "#f0fffd", // teal neon: the tube's core, its glow
  "@": "#35e4d2",
  "#": "#fff1dc", // orange neon: core, glow
  $: "#ff8c2e",
  "^": "#f0fffd", // the speed lines' teal neon (they blink): core, glow
  "~": "#35e4d2",
  "&": "#ff4f62", // the OPEN sign's red neon, and its N (it stutters)
  "*": "#ff4f62",
  "-": "#0d0e1280", // the ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};

const W = 144;
const H = 134;
const CX = 72;
const FOOT = 128;
/** The shop: its walls' sides, the parapet's cap, the top of the wall, the plinth. */
const BL = 22;
const BR = 122;
const CAP = 40;
const WALL_T = 44;
const BASE = 116;

const band = (l: number, ramp: string) => ramp[l < 0.2 ? 0 : l < 0.45 ? 1 : l < 0.75 ? 2 : 3]!;

// ---- The building: charcoal painted brick lit from the left, a concrete parapet cap, the roof deck seen over it.

const wall = paint(BL, WALL_T, BR - BL, BASE - WALL_T, (x, y) => {
  const j = y - WALL_T;
  const row = Math.floor(j / 4);
  if (j % 4 === 3) return "a";
  const sx = x - BL + (row % 2) * 4;
  if (sx % 8 === 0) return "a";
  const l = 0.72 - 0.5 * ((x - BL) / (BR - BL)) + (grain(Math.floor(sx / 8), row, 3) - 0.5) * 0.3 + (j % 4 === 0 ? 0.12 : 0);
  return band(l, "efgh");
});
const cap = paint(BL - 2, CAP, BR - BL + 4, WALL_T - CAP, (x, y) => {
  const j = y - CAP;
  if (j === 0) return x < BR - 20 ? "t" : "r";
  return j === 3 ? "p" : x > BR - 10 ? "q" : "r";
});
const deck = paint(BL + 2, 30, BR - BL - 4, CAP - 30, (x, y) => {
  if (y <= 31) return y === 30 ? "r" : "q"; // the back parapet's lip
  return grain(x, y, 5) < 0.12 ? "I" : "2"; // tar and gravel
});
/** The air-conditioning box on the roof: a lit top, a fan grille. */
const ac = paint(98, 22, 17, 15, (x, y) => {
  const i = x - 98;
  const j = y - 22;
  if (j < 3) return j === 0 ? "t" : "r";
  const d = Math.hypot(x + 0.5 - 106, y + 0.5 - 30);
  if (d < 4.6) return d > 3.6 ? "p" : (x + y) % 2 ? "I" : "1";
  return i === 0 ? "r" : i > 13 ? "p" : "q";
});
/** The plinth along the foot, and a step at the door. */
const plinth = paint(BL - 2, BASE, BR - BL + 4, 4, (x, y) => (y === BASE ? "t" : y === BASE + 3 ? "p" : x > BR - 12 ? "q" : "r"));
const step = paint(82, BASE + 2, 25, 4, (x, y) => (y === BASE + 2 ? "t" : y === BASE + 5 ? "p" : x > 102 ? "q" : "r"));

// ---- Neon: a 1-pixel bright core with a glow round it, on whatever it's mounted on (no outline).

type Tube = { core: string; glow: string; px: readonly Pt[] };
function neon(x0: number, y0: number, w: number, h: number, tubes: readonly Tube[]): { part: Part; at: Pt } {
  const m = new Map<string, string>();
  for (const t of tubes) for (const [x, y] of t.px) m.set(`${x},${y}`, t.core);
  for (const t of tubes)
    for (const [x, y] of t.px)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const k = `${x + dx},${y + dy}`;
          if (!m.has(k)) m.set(k, t.glow);
        }
  return paint(x0, y0, w, h, (x, y) => m.get(`${x},${y}`) ?? null, false);
}
/** The pixels of a straight line. */
function seg(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  return Array.from({ length: n + 1 }, (_, i) => [Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)] as Pt);
}

/** The roofline tube, all along under the cap. */
const stripe = neon(BL + 1, WALL_T, BR - BL - 2, 3, [{ core: "!", glow: "@", px: seg(BL + 2, WALL_T + 1, BR - 3, WALL_T + 1) }]);

/** The rooftop billboard: a black panel on two legs, the neon sneaker on it. */
const PNL = { x: 30, y: 6, w: 54, h: 24 } as const;
const panel = paint(PNL.x, PNL.y, PNL.w, PNL.h, (x, y) => {
  const i = x - PNL.x;
  const j = y - PNL.y;
  if ((i === 0 || i === PNL.w - 1) && (j === 0 || j === PNL.h - 1)) return null; // its rounded corners
  return j === 0 || i === 0 ? "2" : "1";
});
const legs = paint(42, PNL.y + PNL.h, 32, 8, (x) => (x === 42 || x === 70 ? "2" : x === 43 || x === 71 ? "1" : null));
/** The sneaker's outline (toe to the right): the heel, the collar's dip, the tongue, the vamp sloping to a round toe. */
const SHOE: readonly Pt[] = [
  [43, 12], [50, 10], [53, 13], [58, 13], [59, 9], [63, 9], [64, 13], [72, 17], [78, 19], [81, 22], [81, 26], [43, 26], [42, 22], [42, 14],
];
function inShoe(x: number, y: number): boolean {
  const xc = x + 0.5;
  const yc = y + 0.5;
  let inside = false;
  SHOE.forEach(([x0, y0], i) => {
    const [x1, y1] = SHOE[(i + 1) % SHOE.length]!;
    if (y0 <= yc !== y1 <= yc && xc < x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0)) inside = !inside;
  });
  return inside;
}
const shoeEdge: Pt[] = [];
for (let y = PNL.y; y < PNL.y + PNL.h; y++)
  for (let x = PNL.x; x < PNL.x + PNL.w; x++)
    if (inShoe(x, y) && (!inShoe(x - 1, y) || !inShoe(x + 1, y) || !inShoe(x, y - 1) || !inShoe(x, y + 1))) shoeEdge.push([x, y]);
const sign = neon(PNL.x + 1, PNL.y + 1, PNL.w - 2, PNL.h - 2, [
  { core: "#", glow: "$", px: [...shoeEdge, ...seg(45, 23, 79, 23), ...seg(61, 15, 62, 14), ...seg(64, 16, 65, 15), ...seg(67, 17, 68, 16)] }, // outline, midsole, laces
  { core: "!", glow: "@", px: [...seg(48, 20, 56, 17), ...seg(56, 17, 55, 19), ...seg(55, 19, 68, 16)] }, // a lightning stripe
  { core: "^", glow: "~", px: [...seg(33, 14, 38, 14), ...seg(32, 18, 39, 18), ...seg(34, 22, 39, 22)] }, // speed lines
]);

/** A cheetah paw over the door, in filled teal tubes: four toe beans over a pad, a bright core in each. */
const PAW_TOES: readonly Pt[] = [[89, 52], [92.5, 49.5], [97.5, 49.5], [101, 52]];
const paw = paint(86, 47, 18, 15, (x, y) => {
  const X = x + 0.5 - 95;
  const Y = y + 0.5 - 57.5;
  const pad = (X / 4.2) ** 2 + (Y / 3) ** 2 - (Y < 0 ? 0 : (Math.abs(X) / 4.2) * 0.35);
  if (pad <= 1) return pad < 0.35 ? "!" : "@";
  for (const [tx, ty] of PAW_TOES) {
    const d = Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 0.9);
    if (d < 1.9) return d < 0.9 ? "!" : "@";
  }
  return null;
}, false);

// ---- The awning: teal and orange stripes narrowing toward the wall, a scalloped valance in front.

const AW_L = 25;
const AW_R = 109;
const AW_T = 63;
const AW_F = 71; // where the slope meets the valance
const awning = paint(AW_L, AW_T, AW_R - AW_L, 79 - AW_T, (x, y) => {
  const inset = y < AW_F ? (AW_F - y) * 0.45 : 0;
  const l = AW_L + inset;
  const r = AW_R - inset;
  if (x + 0.5 < l || x + 0.5 > r) return null;
  const u = Math.floor(((x + 0.5 - l) / (r - l)) * 14); // its stripe (14 across)
  const ramp = u % 2 ? "EFGH" : "ABCD";
  if (y < AW_F) return ramp[y - AW_T < 3 ? 3 : 2]!;
  const i = (x - AW_L) % 6;
  if (y > 76 + (i >= 1 && i <= 4 ? 1 : 0)) return null; // the scallops
  if (y === AW_F) return ramp[0]!;
  return y === AW_F + 1 ? ramp[2]! : ramp[1]!;
});

// ---- The window: a black metal frame, the lit shop inside (shelves of sneakers), the OPEN sign hung in it, a sill.

const WL = 28;
const WR = 78;
const WT = 78;
const WS = 102;
const SHELVES = [86, 93, 100];
/** Colorways: upper, its shade, the stripe, the sole. "*" in the upper: cheetah print. */
const KICKS = ["CBGO", "GFCO", "SRNO", "NMCG", "21SO", "cdsO", "DCFN", "HGBO", "NMSR", "12GN"];
/** A sneaker 7 x 4, toe to the right: a high heel collar, the vamp, the stripe, the sole. */
const KICK = ["ab.....", "aaaab..", "asssaab", "ooooooo"];
const slots: { x: number; y: number; c: string }[] = [];
SHELVES.forEach((sy, si) => {
  for (let n = 0; n < 5; n++) {
    const x = 31 + n * 9;
    if (si === 0 && x > 52) continue; // the OPEN sign hangs there
    slots.push({ x, y: sy - 4, c: KICKS[(si * 5 + n * 3) % KICKS.length]! });
  }
});
const kickAt = (x: number, y: number): string | null => {
  for (const s of slots) {
    const i = x - s.x;
    const j = y - s.y;
    if (i < 0 || i > 6 || j < 0 || j > 3) continue;
    const ch = KICK[j]![i]!;
    if (ch === ".") return null;
    const k = ch === "a" ? s.c[0]! : ch === "b" ? s.c[1]! : ch === "s" ? s.c[2]! : s.c[3]!;
    if (s.c[0] === "c" && ch === "a" && (x + 2 * y) % 3 === 0) return "s"; // the cheetah print's spots
    return k;
  }
  return null;
};
const OPEN = ["###.###.###.##.", "#.#.#.#.#...#.#", "#.#.###.##..#.#", "#.#.#...#...#.#", "###.#...###.#.#"];
const OPN = { x: 58, y: 80 } as const;
const openAt = (x: number, y: number): string | null => {
  const i = x - OPN.x;
  const j = y - OPN.y;
  if (i < 0 || i > 16 || j < 0 || j > 6) return null;
  if (i === 0 || i === 16 || j === 0 || j === 6) return "@"; // its teal border tube
  return OPEN[j - 1]![i - 1] === "#" ? (i > 12 ? "*" : "&") : null;
};
const windowPart = paint(WL, WT, WR - WL, WS - WT + 3, (x, y) => {
  const i = x - WL;
  const j = y - WT;
  if (y >= WS) return y === WS ? "t" : y === WS + 1 ? "r" : "p"; // the sill
  if (i < 2 || j < 2 || i >= WR - WL - 2) return i === 0 || j === 0 ? "2" : "1";
  const o = openAt(x, y);
  if (o) return o;
  if ((i + j === 13 || i + j === 14 || i + j === 19) && j < 18) return "u"; // a reflection across the glass
  const k = kickAt(x, y);
  if (k) return k;
  if (SHELVES.includes(y)) return "U";
  if (SHELVES.includes(y - 1)) return "V";
  return y === WT + 2 ? "X" : "W";
});

// ---- The door: glass in a black metal frame, a steel push bar, the lit shop inside.

const DL = 84;
const DR = 104;
const DT = 78;
const door = paint(DL, DT, DR - DL, BASE - DT, (x, y) => {
  const i = x - DL;
  const j = y - DT;
  if (i < 2 || j < 2 || i >= DR - DL - 2) return i === 0 || j === 0 ? "2" : "1";
  if (y === 97) return i === 2 || i === DR - DL - 3 ? "I" : "J"; // the push bar
  if (y === 98) return "I";
  if (i + j === 12 || i + j === 13 || i + j === 30) return "u";
  if (y >= 108) return y === 108 ? "U" : "V"; // the floor inside
  return y === DT + 2 ? "X" : "W";
});

// ---- The hanging sneakers: a wire from the roof's corner to a pole, a white pair swinging from it by their laces.

const pole = paint(135, 32, 4, FOOT - 3 - 32, (x, y) => {
  if (y < 35) return x === 135 || x === 138 ? null : "J"; // its cap
  return x === 135 ? "J" : x === 138 ? "1" : "I";
});
const wireY = (x: number) => {
  const t = (x - 123) / 13;
  return Math.round(41 - 7 * t + 5 * Math.sin(Math.PI * t));
};
const wire = paint(123, 34, 13, 12, (x, y) => (y === wireY(x) ? "1" : null), false);
const HANG: Pt = [129, wireY(129)];
const SHOE_HANG = [".MN..", ".NNN.", "NCNNG", "NNCNG", "NNNCG", "NNNNG", ".NNNG", "..NGG"];
function hangers(dx: number) {
  const laces = paint(HANG[0] - 4, HANG[1] + 1, 9, 7, (x, y) => {
    for (const [ex, ey] of [[127.5 + dx, 49], [131.5 + dx, 50]] as const) {
      const t = (y + 0.5 - HANG[1]) / (ey - HANG[1]);
      if (t >= 0 && t <= 1 && Math.abs(x + 0.5 - (HANG[0] + 0.5 + (ex - HANG[0] - 0.5) * t)) < 0.6) return "J";
    }
    return null;
  }, false);
  const left = paint(125 + dx, 49, 5, 8, (x, y) => {
    const k = SHOE_HANG[y - 49]![x - 125 - dx]!;
    return k === "." ? null : k;
  });
  const right = paint(130 + dx, 50, 5, 8, (x, y) => {
    const k = SHOE_HANG[y - 50]![4 - (x - 130 - dx)]!;
    return k === "." ? null : k;
  });
  return [laces, left, right];
}

// ---- By the door: a stack of orange shoe boxes, each with a white stripe; two cases of Cheetah Chug by the pole.

const BOXES: readonly [number, number][] = [
  [106, 119],
  [107, 113],
  [105, 107],
  [107, 101],
];
const boxes = BOXES.map(([bx, by], n) =>
  paint(bx, by, 16, 6, (x, y) => {
    const i = x - bx;
    const j = y - by;
    if (j === 0) return i < 13 ? "H" : "G";
    if (j === 1) return "F"; // under the lid's lip
    if (i === 15) return "F";
    if (j - 2 === Math.round((i - 3) * -0.4 + 2.2) && i > 2 && i < 12) return n % 2 ? "N" : "O"; // the stripe
    return "G";
  }),
);
/** A case of Cheetah Chug: loud orange, cheetah spots, a teal band; the top one open on its cans (orange and teal). */
const chug = (y0: number, open: boolean) =>
  paint(124, y0, 18, open ? 12 : 11, (x, y) => {
    const i = x - 124;
    const j = y - y0;
    if (open && j < 2) return j === 0 ? (i % 3 === 2 ? null : i % 6 < 3 ? "J" : "M") : i % 3 === 2 ? "1" : i % 6 < 3 ? "G" : "C"; // can tops, can rims
    const jj = j - (open ? 2 : 0);
    if (jj === 4 || jj === 5) return jj === 4 ? "D" : "C"; // the band
    if (i === 17) return "E";
    if (jj === 0) return "H";
    const spot = grain(Math.floor((x + (jj > 5 ? 2 : 0)) / 3), Math.floor((y + i) / 3), 21) < 0.28 && (x + y) % 2 === 0;
    return spot ? "s" : i > 13 ? "F" : "G";
  });
const chugLow = chug(114, false);
const chugTop = chug(102, true);

// ---- The sign at the front left: a teal frame round a white board on two black posts; the game writes on its face.

const BOARD: Pt = [8, 102];
const BW = 50;
const BH = 22;
const board = signBoard(BOARD[0], BOARD[1], BW, BH, "ABCD", "MNO", "I");
const signPostL = signPost(BOARD[0] + 5, BOARD[1] + BH - 4, FOOT, "12I2");
const signPostR = signPost(BOARD[0] + BW - 8, BOARD[1] + BH - 4, FOOT, "12I2");

const shadow = groundShadow(CX, FOOT - 2, 70, 5);

// ---- Parts and frames.

const parts: Record<string, Part> = {};
const at: Record<string, Pt> = {};
const add = (name: string, p: { part: Part; at: Pt }) => ((parts[name] = p.part), (at[name] = p.at), name);
const back = [
  add("shadow", shadow),
  add("deck", deck),
  add("legs", legs),
  add("panel", panel),
  add("sign", sign),
  add("ac", ac),
  add("pole", pole),
  add("wall", wall),
  add("cap", cap),
  add("stripe", stripe),
  add("paw", paw),
  add("plinth", plinth),
  add("window", windowPart),
  add("door", door),
  add("step", step),
  add("awning", awning),
  add("wire", wire),
];
const SWAY = [0, 1, 1, 0, -1, -1] as const;
const hang: Record<number, string[]> = {};
for (const dx of [-1, 0, 1]) hang[dx] = hangers(dx).map((p, i) => add(`hang${dx}_${i}`, p));
const front = [
  ...boxes.map((p, i) => add(`box${i}`, p)),
  add("chugLow", chugLow),
  add("chugTop", chugTop),
  add("signPostL", signPostL),
  add("signPostR", signPostR),
  add("board", board),
];
const L = (part: string): Layer => ({ part, x: at[part]![0], y: at[part]![1] });

/** The neon's buzz, frame by frame: the speed lines blink off, the N stutters, the tubes hum a little. */
const OFF_CORE = "#3a3f48";
const BUZZ: readonly Record<string, string>[] = [
  {},
  { "@": "#2fd4c3", $: "#f7832a" },
  { "^": OFF_CORE, "~": PALETTE["1"]! },
  {},
  { "*": "#5a2a30", "@": "#2fd4c3" },
  { "^": OFF_CORE, "~": PALETTE["1"]!, "*": "#c23a4a" },
];
const frames: Frame[] = SWAY.map((dx, f) => ({
  ms: 200,
  layers: [...back.map(L), ...hang[dx]!.map(L), ...front.map(L)],
  pal: BUZZ[f],
}));

const idle: Anim = { loop: true, frames };

export const HOUSE_BLITZ: Character = {
  id: "house-blitz",
  name: "Blitz's Kicks",
  w: W,
  h: H,
  foot: [CX, FOOT],
  palette: PALETTE,
  parts,
  anims: { idle },
};

/** Where the sign's blank face is (frame pixels), for the game to write the shop's name on. */
export const HOUSE_BLITZ_SIGN = signFace(BOARD[0], BOARD[1], BW, BH);

/** The neon's colors at night. */
const NEON_TEAL = "#4ff0e0";
const NEON_ORANGE = "#ff9a3c";
const NEON_RED = "#ff5a6a";
/** Its lights at dusk and night: the neon (the sneaker, its stripe and speed lines, the roofline, the paw, OPEN), the lit window and door. */
export const HOUSE_BLITZ_LIGHTS: readonly LightSpot[] = [
  { x: PNL.x, y: PNL.y, w: PNL.w, h: PNL.h, keys: "#$", color: NEON_ORANGE, strength: 1, halo: 34 },
  { x: PNL.x, y: PNL.y, w: PNL.w, h: PNL.h, keys: "!@^~", color: NEON_TEAL, strength: 0.9 },
  { x: BL, y: WALL_T, w: BR - BL, h: 3, keys: "!@", color: NEON_TEAL, strength: 0.9 },
  { x: 86, y: 48, w: 18, h: 14, keys: "!@", color: NEON_TEAL, strength: 0.9, halo: 14 },
  { x: OPN.x, y: OPN.y, w: 17, h: 7, keys: "&*@", color: NEON_RED, strength: 1, halo: 12 },
  { x: WL + 2, y: WT + 2, w: WR - WL - 4, h: WS - WT - 2, keys: "WVXUu", color: WARM, strength: 0.8 },
  { x: DL + 2, y: DT + 2, w: DR - DL - 4, h: BASE - DT - 2, keys: "WVXUu", color: WARM, strength: 0.7 },
];
export const HOUSE_BLITZ_POOLS: readonly LightPool[] = [
  { x: 66, y: FOOT - 3, rx: 40, ry: 5, color: WARM, strength: 0.28 },
  { x: CX, y: FOOT - 2, rx: 64, ry: 7, color: NEON_TEAL, strength: 0.14 },
];
