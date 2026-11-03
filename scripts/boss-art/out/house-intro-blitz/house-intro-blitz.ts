/**
 * Dash's battle intro (house-intro-blitz; the cheetah, once called Blitz): the props code plays when you challenge him.
 * Eric, Nov 3: "he suddenly bolts away leaving a train of dust and then comes back very fast drops the board, then again
 * runs off, comes back and suddenly the pieces are there, then again flies across and drops off both chairs." "A stack
 * of shoeboxes is perfect." "His screen cover should be numbers, clock/time themed."
 *
 * 1. INTRO_BLITZ_TABLE: PARK_TABLE's geometry, its leg a crooked stack of three shoe boxes from his shop, no stools.
 *    `land` (it drops in with a thud, a squash and puffs of dust) and `idle`. INTRO_BLITZ_TABLE_PALETTE (the slab is
 *    the board box's teal lid; the squares mint and orange) and INTRO_BLITZ_TABLE_INK.
 * 2. INTRO_BLITZ_STOOL: a shoe box stood on its end as a seat (`land`, `idle`). INTRO_BLITZ_STOOL_SEAT_H.
 * 3. INTRO_BLITZ_DUST: the dust trail he leaves when he bolts (6 frames: it billows and fades).
 * 4. INTRO_BLITZ_POP: the sparkle burst over the board as the pieces appear (5 frames, cue `pop`).
 * 5. INTRO_BLITZ_STORM (128 x 128, tiles both ways) and INTRO_BLITZ_FRONT (48 x 128): the clock-and-numbers screen cover.
 * 6. HOUSE_INTRO_BLITZ: the review sheet.
 * Colors from Dash (boss-blitz) and his shop (house-shop-blitz). Drawn by hand (Nov 3), not by the runner.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, paint } from "../../../../packages/app/src/town/houses/kit.ts";
import { TABLE_DIGITS, TABLE_PIECES } from "../../../../packages/app/src/town/houses/park.ts";
import { TOWN_FEEL } from "../../../../packages/app/src/town/feel.ts";

type Pt = readonly [number, number];
type Key = string | null;
type Bit = { part: Part; at: Pt };

// ---- Colors: one palette for every piece.

const PALETTE: Record<string, string> = {
  k: "#1a1210", // outline (his)
  A: "#0b4a4f", // his teal: dark to light, and its neon
  B: "#137a7a",
  C: "#22a8a0",
  D: "#6fd8c8",
  t: "#35e4d2",
  E: "#8a3208", // his orange: dark to light
  F: "#d2601a",
  G: "#f28a2a",
  H: "#ffb860",
  I: "#5d6470", // greys and the black box: grey, light grey, black, black lit
  J: "#a5adb8",
  "%": "#262a33",
  "&": "#3a3f4a",
  M: "#c9ced8", // whites: shadow, white, bright
  N: "#eef1f5",
  O: "#ffffff",
  R: "#b01a22", // red: shade, mid
  S: "#ee3b3b",
  y: "#ffe27a", // a gold sparkle
  // The slab (INTRO_BLITZ_TABLE_PALETTE): the board box's teal lid. Top edge, top, mid, front, deep.
  "1": "#9df0e2",
  "2": "#22a8a0",
  "3": "#1a9089",
  "4": "#137a7a",
  "5": "#0b4a4f",
  // The board: mint (light, its shade, its line) and orange (dark, its shade, its line).
  "6": "#c4ece4",
  "7": "#a2d6cb",
  "8": "#6fb3a6",
  "9": "#e3782f",
  "0": "#c45f1c",
  "=": "#8a3a0e",
  // The town's pieces, unchanged: cream, its shade, its line; charcoal, its shade, its line.
  W: "#f6f1e6",
  w: "#d3c9b6",
  Z: "#2b2622",
  X: "#2d2c33",
  x: "#57565f",
  z: "#0c0c10",
  // Dust: lit, mid, shade; see-through thick and faint (the same as his own dust in boss-blitz).
  i: "#fbf3df",
  j: "#e6d6b2",
  l: "#bfa57c",
  "~": "#f1e5c8a0",
  "^": "#f1e5c850",
  "*": "#ffffffb0", // a flash
  // The screen cover's night: deep, mid, its tick marks dim and bright, the digits' shadow; the neon edge's glow.
  a: "#0d1a1f",
  b: "#12262d",
  c: "#1c3a44",
  d: "#2c5966",
  e: "#050b0d",
  $: "#35e4d270",
  "|": "#35e4d230",
  "-": "#0d0e1280", // ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const HALO = "#fff4e030";

const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });
const mod = (a: number, n: number) => ((a % n) + n) % n;
const full = (fn: (x: number, y: number) => Key, w: number, h: number, outline = true): Part => ({
  grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")),
  outline,
});
/** Each frame's bits as named parts and layers. */
function bitsFrame(parts: Record<string, Part>, prefix: string, bits: readonly Bit[], ms: number, extra: Partial<Frame> = {}): Frame {
  return {
    ms,
    layers: bits.map((b, i) => {
      parts[`${prefix}_${i}`] = b.part;
      return L(`${prefix}_${i}`, b.at);
    }),
    ...extra,
  };
}
const inFrame = (s: readonly Speck[], w: number, h: number): Speck[] => s.filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h);

/** A cartoon dust cloud (his own, as in boss-blitz): round billows lit from the top, outlined; or see-through when thin. */
type Blob = readonly [cx: number, cy: number, r: number];
function cloud(blobs: readonly Blob[], thin = 0): Bit {
  const x0 = Math.floor(Math.min(...blobs.map(([x, , r]) => x - r))) - 1;
  const y0 = Math.floor(Math.min(...blobs.map(([, y, r]) => y - r))) - 1;
  const x1 = Math.ceil(Math.max(...blobs.map(([x, , r]) => x + r))) + 1;
  const y1 = Math.ceil(Math.max(...blobs.map(([, y, r]) => y + r))) + 1;
  return paint(x0, y0, x1 - x0, y1 - y0, (x, y) => {
    const X = x + 0.5;
    const Y = y + 0.5;
    let best: { d: number; b: Blob } | null = null;
    for (const b of blobs) {
      const d = Math.hypot(X - b[0], (Y - b[1]) * 1.15) / b[2];
      if (d <= 1 && (!best || d < best.d)) best = { d, b };
    }
    if (!best) return null;
    if (thin === 2) return (x * 3 + y * 5) % 4 === 0 ? "~" : (x + y) % 3 === 0 ? "^" : null;
    if (thin === 1) return best.d > 0.7 ? "^" : "~";
    const up = (Y - best.b[1]) / best.b[2];
    const left = (X - best.b[0]) / best.b[2];
    return up + 0.4 * left < -0.35 ? "i" : up > 0.45 ? "l" : "j";
  }, !thin);
}
/** A falling or flying streak: bright at its head. */
const streak = (x: number, y: number, len: number, dx: number, dy: number): Speck[] =>
  Array.from({ length: len }, (_, i): Speck => [x - i * dx, y - i * dy, i < len * 0.25 ? "O" : i < len * 0.55 ? "N" : i < len * 0.8 ? "M" : "J"]);
/** A twinkle: a white dot with four arms (gold, or teal). */
const star = (x: number, y: number, big = false, arm = "y"): Speck[] => [
  [x, y, "O"],
  ...[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([a, b]): Speck => [x + a!, y + b!, arm]),
  ...(big ? [[-2, 0], [2, 0], [0, -2], [0, 2]].map(([a, b]): Speck => [x + a!, y + b!, "H"]) : []),
];

// ---- The shoe box (front view, as his shop draws them): a lid band overhanging 1 px each side, the body with a lit left
// edge, its end in shade on the right, a white swoosh, a dark foot; its top seen as a band over it.
interface Style {
  top: string;
  lid: string;
  lip: string;
  body: string;
  lit: string;
  side: string;
  dark: string;
  mark: string;
}
const ORANGE: Style = { top: "H", lid: "G", lip: "F", body: "G", lit: "H", side: "F", dark: "E", mark: "O" };
const TEAL_LID: Style = { top: "D", lid: "C", lip: "B", body: "G", lit: "H", side: "F", dark: "E", mark: "O" };
const BLACK: Style = { top: "I", lid: "&", lip: "%", body: "&", lit: "I", side: "%", dark: "%", mark: "S" };
/** A box lying flat, centered at cx, its foot row at yb: `w` x `h` front, its top band `band` rows. */
function box(cx: number, yb: number, w: number, h: number, band: number, s: Style): Bit {
  const x0 = Math.round(cx - w / 2);
  const yt = yb - h + 1;
  return paint(x0 - 1, yt - band, w + 2, h + band, (x, y) => {
    const i = x - x0;
    const j = y - yt;
    const over = i === -1 || i === w;
    if (j < 0) return j === -band ? (over ? null : s.lip) : s.top; // the lid's top (its far edge in shade)
    if (j === 0) return s.lid;
    if (j === 1) return s.lip;
    if (over) return null;
    if (j === h - 1) return s.dark;
    // A swoosh: a white stroke rising to the right, then flicking back.
    const sj = Math.round(h - 2.2 - (i - 3) * 0.42);
    if (i >= 3 && i <= 3 + Math.round((h - 4.2) / 0.42) && j === sj && j >= 2) return s.mark;
    if (i === 3 && j === h - 3 && h > 5) return s.mark;
    if (i === 0) return s.lit;
    if (i >= w - 3) return i === w - 3 ? s.lid : s.side; // its end, a lighter crease where the end turns
    return s.body;
  });
}

// ================================================================================================================
// 1. The table: PARK_TABLE's geometry (111 x 50, foot [55, 44], the slab's top 27 over the foot). Its leg: three shoe
//    boxes stacked a little crooked (orange, black, orange with a teal lid). The renderer's slab is that top box's
//    board, a big teal lid; with no board on it yet, the top box's own teal lid shows. No stools.
// ================================================================================================================

const PX = 37;
const TW = 3 * PX; // 111
const TH = 50;
const TFOOT = TH - 6; // 44
const TCX = Math.floor(TW / 2); // 55
const TOP_Y = TFOOT - 27; // 17
const SEAT_H = Math.round(TOWN_FEEL.sitSeat * PX);

/** The stack, bottom up: middle x, front width, front height, top band, style. Its fronts span y 21 to 43. */
const STACK: readonly { cx: number; w: number; h: number; band: number; s: Style }[] = [
  { cx: TCX, w: 34, h: 8, band: 2, s: ORANGE },
  { cx: TCX + 2, w: 31, h: 7, band: 2, s: BLACK },
  { cx: TCX - 1, w: 30, h: 8, band: 3, s: TEAL_LID },
];
/** The stack `up` pixels in the air, each box `dh` taller and `dw` wider (a squash or stretch), nudged by `nudge`. */
function stackBits(up: number, dh = 0, dw = 0, nudge: readonly number[] = [0, 0, 0]): Bit[] {
  let yb = TFOOT - 1 - up;
  return STACK.map((b, i) => {
    const h = b.h + dh;
    const bit = box(b.cx + nudge[i]!, yb, b.w + dw, h, b.band, b.s);
    yb -= h;
    return bit;
  });
}
const tableShadow = (r = 1) => groundShadow(TCX + 1, TFOOT, Math.round(19 * r), Math.max(2, Math.round(4 * r)));
const tableParts: Record<string, Part> = {};
const tableIdle = bitsFrame(tableParts, "idle", [tableShadow(), ...stackBits(0)], 1000);

// ---- land (5 frames, 410 ms): it drops in (streaks over it), hits with a thud, squashed wide, dust puffing out both
// sides; it springs back, the boxes jostle, and it settles as the dust thins.
const basePuffs = (t: number): Bit[] => {
  const s = [0.7, 1, 1.25][Math.min(t, 2)]!;
  const blobs = (side: number): Blob[] => [[TCX + side * (19 + 5 * t), TFOOT - 3 - t, 4 * s], [TCX + side * (25 + 7 * t), TFOOT - 2 - t, 3 * s]];
  return [cloud(blobs(-1), t >= 2 ? 1 : 0), cloud(blobs(1), t >= 2 ? 1 : 0)];
};
/** Streaks trailing up beside the falling stack, their heads at y `head`. */
const fallLines = (head: number): Speck[] => [TCX - 21, TCX - 24, TCX + 21, TCX + 24].flatMap((x, i) => streak(x, head - (i % 2) * 3, 8 + (i % 2) * 3, 0, 1));
const landFrames: Frame[] = [
  bitsFrame(tableParts, "land0", [tableShadow(0.5), ...stackBits(12, 1, -2)], 60, { specks: fallLines(TFOOT - 12 - 8) }),
  bitsFrame(tableParts, "land1", [tableShadow(0.8), ...stackBits(4)], 50, { specks: fallLines(TFOOT - 4 - 6) }),
  bitsFrame(tableParts, "land2", [tableShadow(1.1), ...stackBits(0, -1, 2), ...basePuffs(0)], 90, { cue: "thud", shake: [0, 1] }),
  bitsFrame(tableParts, "land3", [tableShadow(), ...stackBits(1, 0, 0, [0, 1, -1]), ...basePuffs(1)], 90),
  bitsFrame(tableParts, "land4", [tableShadow(), ...stackBits(0), ...basePuffs(2)], 120),
];
export const INTRO_BLITZ_TABLE: Character = {
  id: "intro-blitz-table",
  name: "Dash's shoe-box table",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PALETTE,
  halo: HALO,
  parts: tableParts,
  anims: { idle: { loop: true, frames: [tableIdle] }, land: { loop: false, frames: landFrames } },
};

/** The slab's colors for the renderer ("1" top edge, "2" top, "4" front): a teal shoe-box lid. L/D the squares, P/Q the pieces. */
export const INTRO_BLITZ_TABLE_PALETTE: Record<string, string> = {
  k: PALETTE.k!,
  "1": PALETTE["1"]!,
  "2": PALETTE["2"]!,
  "3": PALETTE["3"]!,
  "4": PALETTE["4"]!,
  "5": PALETTE["5"]!,
  L: PALETTE["6"]!,
  D: PALETTE["9"]!,
  P: "#fbfbf6",
  Q: "#262321",
};
/** The board in his colors: mint and orange (a mid orange, so the charcoal pieces still show on it). */
export const INTRO_BLITZ_TABLE_INK = {
  light: PALETTE["6"]!,
  lightShade: PALETTE["7"]!,
  lightLine: PALETTE["8"]!,
  dark: PALETTE["9"]!,
  darkShade: PALETTE["0"]!,
  darkLine: PALETTE["="]!,
} as const;

// ================================================================================================================
// 2. The stool: 34 x 36, foot [17, 31]. A shoe box stood on its end: its lid down the right side (teal), a white label
//    and the swoosh on its end, its top (the seat) at SEAT_H over the foot.
// ================================================================================================================

export const INTRO_BLITZ_STOOL_SEAT_H = SEAT_H;
const SW = 34;
const SH = 36;
const SCX = 17;
const SF = 31;
/** The box on end: `w` x `h` front (default 13 x 9) and a 3-row top, `up` pixels over its spot. */
function stoolBox(up: number, dw = 0, dh = 0): Bit {
  const w = 13 + dw;
  const h = 9 + dh;
  const x0 = Math.round(SCX - w / 2);
  const yb = SF - 1 - up;
  const yt = yb - h + 1;
  return paint(x0, yt - 3, w, h + 3, (x, y) => {
    const i = x - x0;
    const j = y - yt;
    const lid = i >= w - 3;
    if (j < 0) return lid ? (j === -3 ? "B" : "D") : j === -3 ? "F" : "H";
    if (lid) return i === w - 3 ? "D" : j === h - 1 ? "A" : i === w - 1 ? "B" : "C";
    if (j === h - 1) return "E";
    if (i === 0) return "H";
    // The end: a white label up top, the swoosh under it.
    if (j >= 1 && j <= 3 && i >= 2 && i <= w - 6) return j === 1 ? "O" : i === 2 ? "N" : j === 3 && i > 4 ? "M" : "N";
    const sj = Math.round(h - 2.4 - (i - 2) * 0.5);
    if (i >= 2 && i <= w - 5 && j === sj && j >= 5) return "O";
    return "G";
  });
}
const stoolShadow = (r = 1) => groundShadow(SCX + 1, SF, Math.round(9 * r), Math.max(2, Math.round(3 * r)));
const stoolParts: Record<string, Part> = {};
const stoolIdle = bitsFrame(stoolParts, "idle", [stoolShadow(), stoolBox(0)], 1000);
const stoolPuffs = (t: number, thin: number): Bit[] => [
  cloud([[SCX - 9 - 3 * t, SF - 2 - t, 2 + t * 0.7]], thin),
  cloud([[SCX + 9 + 3 * t, SF - 2 - t, 2 + t * 0.7]], thin),
];
// ---- land (5 frames, 400 ms): it drops in, hits squashed (thud) in a puff, bounces up, lands again and settles.
const stoolLand: Frame[] = [
  bitsFrame(stoolParts, "land0", [stoolShadow(0.5), stoolBox(14, -2, 2)], 60, { specks: [SCX - 4, SCX + 1, SCX + 5].flatMap((x, i) => streak(x, SF - 14 - 14 - 2 - i, 5, 0, 1)) }),
  bitsFrame(stoolParts, "land1", [stoolShadow(1.1), stoolBox(0, 3, -3), ...stoolPuffs(0, 0)], 80, { cue: "thud" }),
  bitsFrame(stoolParts, "land2", [stoolShadow(0.8), stoolBox(4, -1, 1), ...stoolPuffs(1, 0)], 70),
  bitsFrame(stoolParts, "land3", [stoolShadow(), stoolBox(0, 1, -1), ...stoolPuffs(2, 1)], 80),
  bitsFrame(stoolParts, "land4", [stoolShadow(), stoolBox(0), ...stoolPuffs(3, 2)], 110),
];
export const INTRO_BLITZ_STOOL: Character = {
  id: "intro-blitz-stool",
  name: "Dash's shoe-box stool",
  w: SW,
  h: SH,
  foot: [SCX, SF],
  palette: PALETTE,
  halo: HALO,
  parts: stoolParts,
  anims: { idle: { loop: true, frames: [stoolIdle] }, land: { loop: false, frames: stoolLand } },
};

// ================================================================================================================
// 3. The dust trail: 160 x 44, foot [152, 40] (its right end, where he bolts from). A low bank of dust billows along his
//    path to our left, biggest where he launched and tapering to wisps at its left end, with speed lines through it.
//    6 frames: it puffs up, billows, then thins away. Code: put its foot at his spot on `bolt`'s whoosh; for a longer run
//    stretch it to our left (up to 2x wide, its foot fixed) or lay a second copy against its left end.
// ================================================================================================================

const DW = 160;
const DH = 44;
const DFX = 152;
const DFY = 40;
const dustParts: Record<string, Part> = {};
const DUST_BLOBS: Blob[] = (() => {
  const out: Blob[] = [];
  let x = DFX - 4;
  for (let i = 0; i < 18; i++) {
    const r = Math.max(3, 10 - i * 0.45) * (0.8 + 0.4 * grain(i, 2, 21));
    out.push([x + Math.round((grain(i, 1, 21) - 0.5) * 3), DFY - Math.round(grain(i, 3, 21) * 3), r]);
    x -= r * 1.05;
  }
  return out;
})();
const GROW = [0.75, 0.92, 1, 1.08, 1.14, 1.2];
const dustFrames: Frame[] = GROW.map((g, f) => {
  const blobs: Blob[] = DUST_BLOBS.filter((_, i) => f < 5 || i % 3 !== 2)
    .map(([x, y, r], i) => [x - f * 1.5 * (i / 17), y - r * g * 0.75 - f * 1.2, r * g] as const);
  const bit = cloud(blobs, f <= 2 ? 0 : f <= 4 ? 1 : 2);
  const specks: Speck[] = [];
  const lines = [9, 6, 3, 0, 0, 0][f]!;
  for (let n = 0; n < lines; n++) {
    const y = 8 + Math.round(grain(n, 2, 22) * 28);
    const x = Math.round(grain(n, 3, 22) * 40) + f * 6;
    // Running left: the heads (bright) on the left.
    specks.push(...streak(x, y, Math.round((40 + grain(n, 4, 22) * 50) * (1 - f * 0.25)), -1, 0).map(([sx, sy, k]): Speck => [sx, sy, f === 2 && k === "O" ? "N" : k]));
  }
  if (f < 3) for (let n = 0; n < 10; n++) specks.push([Math.round(DFX - 10 - grain(n, 5, 23) * 120), Math.round(DFY - 4 - grain(n, 6, 23) * (8 + 6 * f)), n % 2 ? "l" : "j"]);
  return bitsFrame(dustParts, `d${f}`, [bit], 110, { specks: inFrame(specks, DW, DH), ...(f === 0 ? { cue: "whoosh" } : {}) });
});
export const INTRO_BLITZ_DUST: Character = {
  id: "intro-blitz-dust",
  name: "Dash's dust trail",
  w: DW,
  h: DH,
  foot: [DFX, DFY],
  palette: PALETTE,
  parts: dustParts,
  anims: { idle: { loop: false, frames: dustFrames } },
};

// ================================================================================================================
// 4. The pop: 80 x 56, foot [40, 50] (= the table's foot). "Suddenly the pieces are there": a zip of speed lines across
//    the board, a flash, and a burst of sparkles over it. Code shows the pieces from its cue frame (`pop`, frame 1).
// ================================================================================================================

const PW = 80;
const PH = 56;
const PCX = 40;
const PF = 50;
/** The middle of the board (and its standing pieces), over the foot. */
const PCY = PF - 36;
const popParts: Record<string, Part> = {};
const flash = (rx: number, ry: number): Bit =>
  paint(PCX - rx, PCY - ry, 2 * rx + 1, 2 * ry + 1, (x, y) => (((x + 0.5 - PCX) / rx) ** 2 + ((y + 0.5 - PCY) / ry) ** 2 <= 1 ? "*" : null), false);
/** A big four-pointed sparkle (outlined), its arms `r` long. */
const sparkle = (cx: number, cy: number, r: number, core = "y"): Bit =>
  paint(cx - r, cy - r, 2 * r + 1, 2 * r + 1, (x, y) => {
    const X = Math.abs(x - cx);
    const Y = Math.abs(y - cy);
    if (X === 0 && Y === 0) return "O";
    if ((X === 0 && Y <= r) || (Y === 0 && X <= r)) return X + Y <= r / 2 ? core : "O";
    if (X === 1 && Y === 1 && r >= 3) return core;
    return null;
  });
const BURST: readonly (readonly [number, number, string])[] = [[-22, -6, "y"], [21, -9, "t"], [-9, -16, "H"], [13, 4, "y"], [-19, 7, "t"], [4, -19, "y"]];
const popFrames: Frame[] = [
  // The zip: speed lines racing across the board from our left (he brought them).
  bitsFrame(popParts, "p0", [flash(12, 4)], 50, {
    specks: inFrame([-8, -4, 0, 4, 8].flatMap((dy, i) => streak(PCX + 18 - (i % 2) * 6, PCY + dy, 30 + (i % 3) * 6, 1, 0)), PW, PH),
  }),
  bitsFrame(popParts, "p1", [flash(20, 9), ...BURST.slice(0, 4).map(([dx, dy, c]) => sparkle(PCX + dx, PCY + dy, 3, c))], 70, {
    cue: "pop",
    specks: inFrame(BURST.flatMap(([dx, dy]) => streak(PCX + Math.round(dx * 1.25), PCY + Math.round(dy * 1.25), 4, -Math.sign(dx) || 0, -Math.sign(dy) || 0)), PW, PH),
  }),
  bitsFrame(popParts, "p2", BURST.map(([dx, dy, c], i) => sparkle(PCX + Math.round(dx * 1.3), PCY + Math.round(dy * 1.3), i % 2 ? 2 : 3, c)), 80, {
    specks: inFrame([...star(PCX - 30, PCY - 2), ...star(PCX + 29, PCY - 3), ...star(PCX - 2, PCY + 9)], PW, PH),
  }),
  bitsFrame(popParts, "p3", BURST.filter((_, i) => i % 2 === 0).map(([dx, dy, c]) => sparkle(PCX + Math.round(dx * 1.5), PCY + Math.round(dy * 1.5), 2, c)), 90, {
    specks: inFrame([...star(PCX + 26, PCY - 14), ...star(PCX - 27, PCY + 10, false, "t")], PW, PH),
  }),
  { ms: 110, layers: [], specks: inFrame([...star(PCX - 31, PCY - 12), ...star(PCX + 30, PCY + 6, false, "t")], PW, PH) },
];
export const INTRO_BLITZ_POP: Character = {
  id: "intro-blitz-pop",
  name: "Dash's pieces pop",
  w: PW,
  h: PH,
  foot: [PCX, PF],
  palette: PALETTE,
  parts: popParts,
  anims: { idle: { loop: false, frames: popFrames } },
};

// ================================================================================================================
// 5. The screen cover: STORM (128 x 128, tiles both ways) and FRONT (48 x 128, tiles top to bottom), 6 x 70 ms. As
//    Alfil's sandstorm: three layers race right, each a whole number of pixels a frame, a whole repeat in 6 frames.
//    - back (32 wide): the dark night, with rulers of ticking second marks;
//    - mid (64 wide): digital clock readouts (00:59, 12:00, 0:03, 9:58) in teal, orange and white, smeared behind;
//    - front (128 wide): stopwatches racing past, their red hands sweeping round once a loop, and white speed lines.
// ================================================================================================================

const ST = 128;
const FW = 48;
const cum = (steps: number[]) => steps.map((_, i) => steps.slice(0, i).reduce((s, v) => s + v, 0));
const SHIFT = {
  back: cum([5, 5, 6, 5, 5, 6]), // 32
  mid: cum([11, 11, 10, 11, 11, 10]), // 64
  front: cum([21, 21, 22, 21, 21, 22]), // 128
};
type Pat = Key[][];
const pat = (w: number): Pat => Array.from({ length: ST }, () => Array<Key>(w).fill(null));
const stamp = (p: Pat, x: number, y: number, k: string) => (p[mod(Math.round(y), ST)]![mod(Math.round(x), p[0]!.length)] = k);
const at = (p: Pat, x: number, y: number) => p[mod(y, ST)]![mod(x, p[0]!.length)];

/** The night: deep, a lighter band every 32 rows, and a ruler of second ticks (long every 8, short every 4). */
const backPat: Pat = pat(32);
for (let y = 0; y < ST; y++)
  for (let x = 0; x < 32; x++) {
    const r = y % 32;
    let k = r <= 1 ? "b" : "a";
    if (r === 26) k = "b";
    if (r >= 23 && r <= 25 && x % 8 === 0) k = r === 23 ? "d" : "c";
    if (r === 25 && x % 4 === 0) k = "c";
    if (r === 12 && x % 16 === 4) k = "c";
    backPat[y]![x] = k;
  }

/** The readouts: 3 x 5 digits (the town clock's) drawn 2x, a lit top row, a dark shadow, a dim smear behind. */
const midPat: Pat = pat(64);
const READOUTS: readonly { text: string; x: number; y: number; ink: string; lit: string }[] = [
  { text: "00:59", x: 6, y: 3, ink: "C", lit: "D" },
  { text: "12:00", x: 26, y: 35, ink: "G", lit: "H" },
  { text: "0:03", x: 14, y: 67, ink: "N", lit: "O" },
  { text: "9:58", x: 40, y: 99, ink: "C", lit: "D" },
];
for (const r of READOUTS) {
  let cx = r.x;
  const lit: Pt[] = [];
  for (const ch of r.text) {
    const g = TABLE_DIGITS[ch]!;
    g.forEach((row, j) => [...row].forEach((c, i) => {
      if (c !== "#") return;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) lit.push([cx + i * 2 + a, r.y + j * 2 + b]);
    }));
    cx += g[0]!.length * 2 + 2;
  }
  // The smear and the shadow under, then the digits on top.
  for (const [x, y] of lit) for (let d = 1; d <= 5; d++) if (!at(midPat, x - d, y)) stamp(midPat, x - d, y, d <= 2 ? "d" : "c");
  for (const [x, y] of lit) stamp(midPat, x + 1, y + 1, "e");
  for (const [x, y] of lit) stamp(midPat, x, y, (y - r.y) < 2 ? r.lit : r.ink);
}

/** A stopwatch face (outlined, orange rim, white face, 12 ticks, a crown and a button), its red hand at angle `a`. */
function stopwatch(p: Pat, cx: number, cy: number, R: number, a: number) {
  // The smear behind it.
  for (let dy = -R + 2; dy <= R - 2; dy += 2) for (let d = 1; d <= 10 + (dy % 4 === 0 ? 6 : 0); d++) stamp(p, cx - Math.sqrt(R * R - dy * dy) - d, cy + dy, d < 5 ? "d" : "c");
  // The crown and the button.
  for (let x = -1; x <= 1; x++) (stamp(p, cx + x, cy - R - 2, x ? "J" : "N"), stamp(p, cx + x, cy - R - 1, "I"));
  stamp(p, cx - 1, cy - R - 3, "k");
  stamp(p, cx, cy - R - 3, "k");
  stamp(p, cx + 1, cy - R - 3, "k");
  stamp(p, cx + Math.round(R * 0.75), cy - Math.round(R * 0.75) - 1, "J");
  stamp(p, cx + Math.round(R * 0.75) + 1, cy - Math.round(R * 0.75) - 1, "k");
  for (let y = -R - 1; y <= R + 1; y++)
    for (let x = -R - 1; x <= R + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > R + 0.5) continue;
      stamp(p, cx + x, cy + y, d > R - 0.6 ? "k" : d > R - 2.2 ? (x + y < -2 ? "H" : "F") : x + y < -R * 0.6 ? "O" : "N");
    }
  for (let t = 0; t < 12; t++) {
    const th = (t * Math.PI) / 6;
    const len = t % 3 === 0 ? 2 : 1;
    for (let s = 0; s < len; s++) stamp(p, cx + Math.round(Math.sin(th) * (R - 3 - s)), cy - Math.round(Math.cos(th) * (R - 3 - s)), t % 3 === 0 ? "%" : "J");
  }
  for (let s = 0; s <= R - 3; s++) stamp(p, cx + Math.round(Math.sin(a) * s), cy - Math.round(Math.cos(a) * s), s === 0 ? "k" : "S");
}
const WATCHES: readonly { x: number; y: number; r: number; a: number }[] = [
  { x: 30, y: 20, r: 9, a: 0.3 },
  { x: 100, y: 60, r: 8, a: 2.1 },
  { x: 52, y: 101, r: 10, a: 4.0 },
];
const frontPats: Pat[] = [0, 1, 2, 3, 4, 5].map((f) => {
  const p = pat(ST);
  // Speed lines: bright heads on the right, fading behind.
  for (let i = 0; i < 18; i++) {
    const ex = Math.floor(grain(i, 1, 41) * ST);
    const ey = Math.floor(grain(i, 2, 41) * ST);
    const len = 8 + Math.floor(grain(i, 3, 41) * 26);
    for (let x = 0; x < len; x++) {
      const t = x / len;
      stamp(p, ex - x, ey, t < 0.15 ? "O" : t < 0.45 ? "N" : t < 0.75 ? "J" : "I");
    }
  }
  for (const w of WATCHES) stopwatch(p, w.x, w.y, w.r, w.a + (f * Math.PI) / 3);
  // Little second ticks flying: pairs of teal and orange dashes.
  for (let i = 0; i < 14; i++) {
    const ex = Math.floor(grain(i, 5, 42) * ST);
    const ey = Math.floor(grain(i, 6, 42) * ST);
    if (at(p, ex, ey)) continue;
    stamp(p, ex, ey, i % 2 ? "t" : "G");
    stamp(p, ex - 1, ey, i % 2 ? "C" : "F");
  }
  return p;
});

const stormKey = (x: number, y: number, f: number): string =>
  at(frontPats[f]!, x - SHIFT.front[f]!, y) ?? at(midPat, x - SHIFT.mid[f]!, y) ?? at(backPat, x - SHIFT.back[f]!, y)!;

const stormParts: Record<string, Part> = {};
const stormFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), ST, ST, false);
  return { ms: 70, layers: [{ part: `s${f}`, x: 0, y: 0 }], ...(f === 0 ? { cue: "tick" } : {}) };
});
export const INTRO_BLITZ_STORM: Character = {
  id: "intro-blitz-storm",
  name: "Dash's clock rush (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};

/** The leading edge: the rush on its left (so it meets STORM with no seam), round clock-face lobes, a teal neon rim, a
 *  soft glow, and digits and little clock faces flying out ahead. */
const LOBES = [
  ...Array.from({ length: 6 }, (_, i) => ({ y: (i * 128) / 6 + grain(i, 1, 81) * 6, x: 14 + grain(i, 2, 81) * 8, r: 10 + grain(i, 3, 81) * 5, p: grain(i, 4, 81) * 6.28 })),
  ...Array.from({ length: 6 }, (_, i) => ({ y: ((i + 0.5) * 128) / 6 + grain(i, 5, 81) * 4, x: 25 + grain(i, 6, 81) * 6, r: 5 + grain(i, 7, 81) * 3, p: grain(i, 8, 81) * 6.28 })),
];
function outside(x: number, y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  const body = 10 + 2 * Math.sin((2 * Math.PI * 2 * y) / ST + ph);
  let out = x < body ? 0 : x - body;
  for (const l of LOBES) {
    const cy = l.y + 2 * Math.sin(ph + l.p);
    const cx = l.x + 3 * Math.cos(ph + l.p);
    const dy = mod(y + 0.5 - cy + 64, ST) - 64;
    out = Math.min(out, Math.max(0, Math.hypot(x + 0.5 - cx, dy) - l.r));
    if (out === 0) return 0;
  }
  return out;
}
function frontKey(x: number, y: number, f: number): Key {
  const out = outside(x, y, f);
  if (out === 0) {
    const o = (dx: number, dy: number) => outside(x + dx, y + dy, f) > 0;
    if (o(1, 0) || o(0, -1) || o(0, 1)) return "t";
    if (o(2, 0) || o(0, -2) || o(0, 2)) return "C";
    if (o(3, 0)) return "B";
    return stormKey(x, y, f);
  }
  if (out < 1.5) return "$";
  if (out < 3.5) return "|";
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  frontParts[`e${f}`] = full((x, y) => frontKey(x, y, f), FW, ST, false);
  // Digits and tiny clock faces flying ahead: each runs 3 px a frame over an 18 px stretch, round in 6 frames.
  const specks: Speck[] = [];
  const DIG = "0123456789";
  for (let i = 0; i < 14; i++) {
    const y = Math.floor((i * 128) / 14 + grain(i, 1, 72) * 4);
    const x = 28 + mod(Math.floor(grain(i, 2, 72) * 18) + 3 * f, 18);
    if (i % 3 === 2) {
      // A tiny clock: a ring with a hand.
      for (const [a, b] of [[-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-2, 1], [-2, 0], [-2, -1]] as const) specks.push([x + a, y + b, "H"]);
      specks.push([x, y, "O"], [x, y - 1, "O"], [x - 3, y, "|"]);
    } else {
      const g = TABLE_DIGITS[DIG[(i * 7) % 10]!]!;
      const ink = i % 3 === 0 ? "D" : "O";
      g.forEach((row, j) => [...row].forEach((c, k) => c === "#" && specks.push([x + k - 1, y + j - 2, ink])));
      specks.push([x - 3, y, "$"], [x - 4, y, "|"]);
    }
  }
  return { ms: 70, layers: [{ part: `e${f}`, x: 0, y: 0 }], specks: inFrame(specks, FW, ST) };
});
export const INTRO_BLITZ_FRONT: Character = {
  id: "intro-blitz-front",
  name: "Dash's clock rush (leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

// ================================================================================================================
// 6. The review sheet: the set (table, mock slab and both stools on their spots), a stool, the 8 x 8 board in his
//    colors with the town's pieces, the dust trail, the pop over a second set, and the rush tiled 3 x 2 with its front.
// ================================================================================================================

/** A mock slab as the renderer lays it: the teal lid around a little board. */
const SLAB_HALF = 16;
const mockSlab = paint(TCX - SLAB_HALF, TOP_Y - 9, 2 * SLAB_HALF + 1, 13, (x, y) => {
  const i = x - (TCX - SLAB_HALF);
  const j = y - (TOP_Y - 9);
  if (j >= 10) return j === 10 ? "3" : "4";
  if (j === 0 || i === 0) return "1";
  if (i === 2 * SLAB_HALF || j === 9) return "3";
  if (i >= 4 && i <= 2 * SLAB_HALF - 4 && j >= 2 && j <= 8) return (Math.floor((i - 4) / 3.2) + j) % 2 ? "9" : "6";
  return "2";
});
const SQ = 12;
const BOARD_PX = SQ * 8 + 4;
const boardBit = paint(0, 0, BOARD_PX, BOARD_PX, (x, y) => {
  if (x < 2 || y < 2 || x >= BOARD_PX - 2 || y >= BOARD_PX - 2) return x < 2 || y < 2 ? "1" : "4";
  const dark = (Math.floor((x - 2) / SQ) + Math.floor((y - 2) / SQ)) % 2 === 1;
  const i = (x - 2) % SQ;
  const j = (y - 2) % SQ;
  if (j === SQ - 1 || i === SQ - 1) return dark ? "0" : "7";
  return dark ? "9" : "6";
});
const BOARD_SET: [number, number, string, boolean][] = [
  [0, 0, "R", false], [1, 0, "N", false], [2, 0, "B", false], [3, 0, "Q", false], [4, 0, "K", false], [5, 0, "B", false], [7, 0, "R", false],
  [0, 1, "P", false], [1, 1, "P", false], [2, 1, "P", false], [5, 1, "P", false], [6, 1, "P", false], [7, 1, "P", false],
  [3, 2, "P", false], [5, 2, "N", false], [4, 3, "P", false], [3, 3, "P", true], [4, 4, "P", true], [2, 4, "B", true],
  [5, 5, "N", true], [0, 6, "P", true], [1, 6, "P", true], [2, 6, "P", true], [5, 6, "P", true], [6, 6, "P", true], [7, 6, "P", true],
  [0, 7, "R", true], [1, 7, "N", true], [2, 7, "B", true], [3, 7, "Q", true], [4, 7, "K", true], [7, 7, "R", true],
];
const piecesBit = (() => {
  const fill: Key[][] = Array.from({ length: BOARD_PX }, () => Array<Key>(BOARD_PX).fill(null));
  const lineOf: Key[][] = Array.from({ length: BOARD_PX }, () => Array<Key>(BOARD_PX).fill(null));
  for (const [f, r, p, white] of BOARD_SET) {
    const g = TABLE_PIECES[p]!;
    const x0 = 2 + f * SQ + 2;
    const y0 = 2 + r * SQ + SQ - 2 - g.length;
    g.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        const X = x0 + i;
        const Y = y0 + j;
        if (Y < 0) return;
        if (ch === "#") fill[Y]![X] = white ? (i >= 5 ? "w" : "W") : i >= 5 ? "X" : i <= 1 && j > 0 ? "x" : "X";
        else if (ch === "x") fill[Y]![X] = white ? "Z" : "z";
        if (ch !== ".") for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) lineOf[Y + dy]![X + dx] ??= white ? "Z" : "z";
      }),
    );
  }
  return paint(0, 0, BOARD_PX, BOARD_PX, (x, y) => fill[y]![x] ?? lineOf[y]![x] ?? null, false);
})();

type Slot = { prefix: string; ch: Character; frame: Frame; at: Pt };
function compose(parts: Record<string, Part>, slots: readonly Slot[], ms: number, cue?: string): Frame {
  const layers: Layer[] = [];
  const specks: Speck[] = [];
  for (const s of slots) {
    for (const l of s.frame.layers) {
      const name = `${s.prefix}:${l.part}`;
      parts[name] = s.ch.parts[l.part]!;
      layers.push({ ...l, part: name, x: l.x + s.at[0], y: l.y + s.at[1] });
    }
    for (const [x, y, k] of s.frame.specks ?? []) specks.push([x + s.at[0], y + s.at[1], k]);
  }
  return { ms, layers, specks, ...(cue ? { cue } : {}) };
}
const extraParts: Record<string, Part> = { slab: mockSlab.part, board: boardBit.part, pieces: piecesBit.part };
const EXTRA: Character = { id: "x", name: "x", w: 1, h: 1, foot: [0, 0], palette: PALETTE, parts: extraParts, anims: {} };
const slabFrame: Frame = { ms: 1000, layers: [L("slab", mockSlab.at)] };
const boardFrame: Frame = { ms: 1000, layers: [L("board", [0, 0]), L("pieces", [0, 0])] };

const AT = { setA: [4, 4] as Pt, stool: [124, 18] as Pt, board: [162, 4] as Pt, dust: [4, 110] as Pt, setB: [52, 214] as Pt, grid: [270, 4] as Pt };
const POP_AT: Pt = [AT.setB[0] + TCX - PCX, AT.setB[1] + TFOOT - PF];
const GRID_W = 3 * ST + FW;
const SHEET_W = AT.grid[0] + GRID_W + 4;
const SHEET_H = 2 * ST + 12;
const sheetParts: Record<string, Part> = {};
interface Over {
  table?: Frame;
  stoolL?: Frame;
  stoolR?: Frame;
  stool?: Frame;
  slab?: boolean;
  dust?: Frame;
  pop?: Frame;
  grid?: number;
}
/** The set at `at`: both stools on their spots (the table's foot x +- 37), the table, and the slab over it. */
const setSlots = (p: string, at: Pt, table: Frame, sl: Frame, sr: Frame, slab: boolean): Slot[] => [
  { prefix: `${p}sl`, ch: INTRO_BLITZ_STOOL, frame: sl, at: [at[0] + TCX - PX - SCX, at[1] + TFOOT - SF] },
  { prefix: `${p}sr`, ch: INTRO_BLITZ_STOOL, frame: sr, at: [at[0] + TCX + PX - SCX, at[1] + TFOOT - SF] },
  { prefix: `${p}t`, ch: INTRO_BLITZ_TABLE, frame: table, at },
  ...(slab ? [{ prefix: `${p}x`, ch: EXTRA, frame: slabFrame, at }] : []),
];
function sheetFrame(o: Over, ms: number, cue?: string): Frame {
  const slots: Slot[] = [
    ...setSlots("a", AT.setA, o.table ?? tableIdle, o.stoolL ?? stoolIdle, o.stoolR ?? stoolIdle, o.slab ?? true),
    { prefix: "st", ch: INTRO_BLITZ_STOOL, frame: o.stool ?? stoolIdle, at: AT.stool },
    { prefix: "bd", ch: EXTRA, frame: boardFrame, at: AT.board },
    { prefix: "du", ch: INTRO_BLITZ_DUST, frame: o.dust ?? dustFrames[1]!, at: AT.dust },
    ...setSlots("b", AT.setB, tableIdle, stoolIdle, stoolIdle, true),
    ...(o.pop ? [{ prefix: "po", ch: INTRO_BLITZ_POP, frame: o.pop, at: POP_AT }] : []),
    ...[0, 1, 2].flatMap((i) => [0, 1].map((j): Slot => ({ prefix: `s${i}${j}`, ch: INTRO_BLITZ_STORM, frame: stormFrames[o.grid ?? 0]!, at: [AT.grid[0] + i * ST, AT.grid[1] + j * ST] }))),
    ...[0, 1].map((j): Slot => ({ prefix: `f${j}`, ch: INTRO_BLITZ_FRONT, frame: frontFrames[o.grid ?? 0]!, at: [AT.grid[0] + 3 * ST, AT.grid[1] + j * ST] })),
  ];
  return compose(sheetParts, slots, ms, cue);
}
const each = (anim: Anim, over: (fr: Frame, i: number) => Over): Anim => ({ loop: anim.loop, frames: anim.frames.map((fr, i) => sheetFrame(over(fr, i), fr.ms, fr.cue)) });
const sheetAnims: Record<string, Anim> = { idle: { loop: true, frames: [sheetFrame({}, 1000)] } };
sheetAnims["table-land"] = each(INTRO_BLITZ_TABLE.anims.land!, (fr) => ({ table: fr, slab: false }));
sheetAnims["stool-land"] = each(INTRO_BLITZ_STOOL.anims.land!, (fr) => ({ stool: fr, stoolL: fr, stoolR: fr }));
sheetAnims.dust = each(INTRO_BLITZ_DUST.anims.idle!, (fr) => ({ dust: fr }));
sheetAnims.pop = each(INTRO_BLITZ_POP.anims.idle!, (fr) => ({ pop: fr }));
sheetAnims.storm = { loop: true, frames: [0, 1, 2, 3, 4, 5].map((f) => sheetFrame({ grid: f }, 70, f === 0 ? "tick" : undefined)) };

export const HOUSE_INTRO_BLITZ: Character = {
  id: "house-intro-blitz",
  name: "Dash's battle intro (review sheet)",
  w: SHEET_W,
  h: SHEET_H,
  foot: [SHEET_W / 2, SHEET_H - 4],
  palette: PALETTE,
  parts: sheetParts,
  anims: sheetAnims,
};
