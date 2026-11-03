/**
 * Timber's battle intro (house-intro-timber): the props code plays when you challenge the beaver builder.
 *
 * 1. INTRO_TIMBER_LOG: the giant log. `lying` on the floor (64 x 30, east to west, its left cut end showing rings),
 *    `standing` on end in the middle (32 x 52, its top showing rings), `gnawed` (6 frames: bites, chips, an hourglass).
 *    Foot: the log's bottom middle. INTRO_TIMBER_LOG_LOOK: notes for Timber's own run (he carries this log).
 * 2. INTRO_TIMBER_SHAVINGS: the storm of shavings and sawdust (rise, hold, settle). Foot = the table's foot.
 * 3. INTRO_TIMBER_TABLE: PARK_TABLE's geometry, its leg a gnawed log pedestal, no stools. INTRO_TIMBER_TABLE_PALETTE.
 * 4. INTRO_TIMBER_STUMP: a seat (idle, pop). INTRO_TIMBER_STUMP_SEAT_H.
 * 5. INTRO_TIMBER_STORM (128 x 128, tiles both ways) and INTRO_TIMBER_FRONT (48 x 128): the sawdust transition.
 * 6. HOUSE_INTRO_TIMBER: the review sheet.
 * Colors from Timber (boss-beaver), his lodge (house-timber) and his shop.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, paint } from "../../../../packages/app/src/town/houses/kit.ts";
import { TABLE_PIECES } from "../../../../packages/app/src/town/houses/park.ts";
import { TOWN_FEEL } from "../../../../packages/app/src/town/feel.ts";

type Pt = readonly [number, number];
type Key = string | null;

// ---- Colors: one palette for every piece.

const PALETTE: Record<string, string> = {
  k: "#1e130d", // outline (Timber's)
  a: "#3e2415", // bark: his fur browns, dark to light
  b: "#5d361d",
  c: "#7d4a27",
  d: "#9c6334",
  e: "#b97f4a",
  J: "#7e5222", // raw wood (his planks'): grain, shade, mid, light, fresh-cut pale
  j: "#b47b36",
  h: "#e0aa5c",
  H: "#f6d38e",
  p: "#fff0c8",
  // Sawdust fog: light, mid, shade, deep shade; see-through thick, thin, faint.
  g: "#f6e8c8",
  G: "#e6cc9e",
  F: "#cfaa74",
  f: "#a9844f",
  q: "#f1dcb2d8",
  Q: "#e8cc9ca0",
  "%": "#ecd6ac60",
  // The table's slab (INTRO_TIMBER_TABLE_PALETTE): top edge, top, mid, front, deep. A varnished slab of his wood.
  "1": "#ffdc9c",
  "2": "#d99f5a",
  "3": "#b97a3a",
  "4": "#935a2a",
  "5": "#653b1a",
  // The board: maple (light, its shade, its line) and walnut (dark, its shade, its line).
  "6": "#efcf94",
  "7": "#dcb576",
  "8": "#b88c4e",
  "9": "#94603a",
  "0": "#7c4e2e",
  "=": "#57361e",
  // The town's pieces, unchanged: cream, its shade, its line; charcoal, its shade, its line.
  W: "#f6f1e6",
  w: "#d3c9b6",
  Z: "#2b2622",
  X: "#2d2c33",
  x: "#57565f",
  z: "#0c0c10",
  "-": "#0d0e1280", // ground shadow: core, rim (see-through)
  "+": "#0d0e1244",
};
const HALO = "#fff0c830";

type Bit = { part: Part; at: Pt };
const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const full = (fn: (x: number, y: number) => Key, w: number, h: number, outline = true): Part => ({
  grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")),
  outline,
});
const ramp = (keys: string, l: number) => keys[Math.floor(clamp(l, 0, 0.999) * keys.length)]!;

/** Bark, lit by `l` (0 dark to 1 light), furrowed along the grain: `t` runs round the trunk, `s` along it. */
function barkKey(l: number, t: number, s: number, x: number, y: number): string {
  const band = t * 3.4 + 0.1 * Math.sin(s * 0.3 + Math.floor(t * 3.4) * 1.9);
  const fr = band - Math.floor(band);
  if (fr < 0.17) l -= 0.34; // a furrow
  else if (fr < 0.3) l += 0.12; // the plate's lit lip beside it
  if (grain(x, y, 17) > 0.92) l -= 0.14;
  const plate = Math.floor(t * 3.4);
  const sc = s / 9 + plate * 0.45;
  if (Math.floor(sc) !== Math.floor(sc - 1 / 9) && fr > 0.35 && fr < 0.85 && grain(plate, Math.floor(sc), 5) > 0.55) l -= 0.26; // a crack across a plate
  return ramp("abcde", l);
}

/** Growth rings on a cut face: `d` the distance from the heart in pixels across, `r` the face's radius, `lit` 0..1. */
function ringKey(d: number, r: number, lit: number, ang: number): string {
  if (d > r - 1.2) return lit > 0.45 ? "d" : "c"; // the bark's thickness
  if (d > r - 2.4) return "p"; // the pale sapwood
  if (d < 1.3) return "J"; // the heart
  if (Math.abs(ang - 0.6) < 0.09 && d < r * 0.7) return "J"; // a seasoning crack from the heart
  for (const rr of [r * 0.3, r * 0.56, r * 0.8]) if (Math.abs(d - rr) < 0.55) return "j";
  return lit > 0.55 ? "H" : "h";
}

// ================================================================================================================
// 1. The log: 80 x 68, foot [40, 64] (its bottom middle).
// ================================================================================================================

const LW = 80;
const LH = 70;
const LCX = 40;
const LF = 64;
// Standing: half its width, its top's half-depth, the middle of its bottom and top ovals.
const SR = 16;
const ERY = 7;
const YB = LF - ERY; // 57
const YT = YB - (52 - 2 * ERY); // 19: the log's top at 12, 52 tall
const YMID = 38;
// Lying: its long middle line, half its thickness, its left (cut, facing us a little) end and its right end.
const LYC = LF - 15; // 49
const LYR = 15;
const LEX = 14; // the left face's middle
const LRX = 6; // the ends' half-width as drawn
const LEX2 = 66; // the right end's middle

/** The lying log: bark along it, its left end a cut face of rings, two knots. */
function lyingKey(x: number, y: number): Key {
  const X = x + 0.5;
  const v = (y + 0.5 - LYC) / LYR;
  if (Math.abs(v) >= 1) return null;
  const sq = Math.sqrt(1 - v * v);
  const fx = (X - LEX) / LRX;
  if (fx * fx + v * v <= 1) {
    const d = Math.hypot(fx, v) * LYR;
    return ringKey(d, LYR, 0.55 - 0.5 * fx - 0.5 * v, Math.atan2(v, fx));
  }
  if (X < LEX || X > LEX2 + LRX * sq) return null;
  // Knots: a dark ring round a grain-colored eye.
  for (const [kx, ky, kr] of [[44, 41, 2.6], [29, 56, 2]] as const) {
    const kd = Math.hypot((X - kx) / kr, (y + 0.5 - ky) / (kr * 0.65));
    if (kd < 0.55) return "j";
    if (kd < 1) return "a";
  }
  let l = 0.66 - 0.6 * v - 0.06 * ((X - 40) / 32);
  if (X > LEX2 + LRX * sq - 1.5) l -= 0.15; // its far end rolls away into shade
  return barkKey(l, Math.asin(v) / Math.PI + 0.5, X, x, y);
}

/** A gnawed log's state: how far its middle is pinched in, and its bites so far. */
interface Gnaw {
  pinch: number;
  bites: readonly { kind: "side" | "top" | "face"; at: number; side: number; r: number }[];
}
const pinchAt = (g: Gnaw, Y: number) => g.pinch * Math.exp(-(((Y - YMID) / 9) ** 2));
const halfW = (g: Gnaw, Y: number) => SR - pinchAt(g, Y);

/** Where a bite is (its middle). */
function biteXY(g: Gnaw, b: Gnaw["bites"][number]): Pt {
  if (b.kind === "side") return [b.side * halfW(g, b.at), b.at];
  if (b.kind === "top") return [b.at, YT - ERY * Math.sqrt(Math.max(0, 1 - (b.at / SR) ** 2))];
  return [b.side, b.at];
}

/** The standing log (gnawed or not): its top a cut face of rings, its sides bark, bitten and pinched to raw wood. */
function standKey(g: Gnaw, x: number, y: number): Key {
  const X = x + 0.5 - LCX;
  const Y = y + 0.5;
  const hw = halfW(g, Y);
  const tn = (X / SR) ** 2 + ((Y - YT) / ERY) ** 2;
  const inTop = tn <= 1;
  const nx = clamp(X / hw, -1, 1);
  const inBody = Y >= YT && Math.abs(X) < hw && Y <= YB + ERY * Math.sqrt(1 - nx * nx);
  if (!inTop && !inBody) return null;
  let rim = false;
  let faceBite: number | null = null;
  for (const b of g.bites) {
    const [bx, by] = biteXY(g, b);
    if (b.kind === "face") {
      const d = Math.hypot((X - bx) / b.r, (Y - by) / (b.r * 0.8));
      if (d < 1 && !inTop) faceBite = (Y - by) / (b.r * 0.8);
      continue;
    }
    const d = Math.hypot(X - bx, (Y - by) * (b.kind === "top" ? 1.4 : 1));
    if (d < b.r) return null;
    if (d < b.r + 1.6) rim = true;
  }
  if (inTop) {
    if (rim) return X < 0 ? "p" : "H";
    return ringKey(Math.sqrt(tn) * SR, SR, 0.6 - 0.4 * (X / SR) - 0.6 * ((Y - YT) / ERY), Math.atan2((Y - YT) / ERY, X / SR));
  }
  if (faceBite !== null) return faceBite < -0.45 ? "J" : faceBite < 0.2 ? "j" : faceBite < 0.7 ? "h" : "H";
  if (rim) return X < 2 ? "H" : "h";
  const bottom = YB + ERY * Math.sqrt(1 - nx * nx);
  const p = pinchAt(g, Y);
  let l = 0.66 - 0.55 * nx - (Y > bottom - 2 ? 0.16 : 0) - (Y < YT + ERY * Math.sqrt(1 - (X / SR) ** 2) + 2 ? 0.12 : 0);
  if (p > 1.1) {
    // Raw wood where he's chewed round it: rows of chisel marks, each lit on top.
    const t = (Y + 0.8 * Math.sin(Math.asin(nx) * 4)) / 2.6;
    const fr = t - Math.floor(t);
    if (fr < 0.3) l += 0.22;
    else if (fr > 0.78) l -= 0.3;
    if (p < 1.8) return grain(x, y, 3) > 0.5 ? "b" : "J"; // the torn bark at its edge
    return ramp("JjhhH", l - 0.1);
  }
  return barkKey(l, Math.asin(nx) / Math.PI + 0.5, Y, x, y);
}

const GNAW_STEPS: Gnaw[] = (() => {
  const B = (kind: "side" | "top" | "face", at: number, side: number, r: number) => ({ kind, at, side, r });
  const all = [
    [B("side", 36, -1, 4.5)],
    [B("side", 41, 1, 4.5)],
    [B("top", -8, 0, 4.5), B("face", 34, 3, 3.5)],
    [B("side", 46, -1, 3.5)],
    [B("side", 31, 1, 4), B("top", 7, 0, 4)],
    [B("face", 44, -4, 3)],
  ];
  const pinch = [0, 0.6, 1.6, 3, 4.6, 6.5];
  return pinch.map((p, f) => ({ pinch: p, bites: all.slice(0, f + 1).flat() }));
})();

const logParts: Record<string, Part> = {};
const logBit = (name: string, b: Bit): Layer => ((logParts[name] = b.part), L(name, b.at));
const lyShadow = logBit("lyShadow", groundShadow(41, LF - 1, 33, 5));
const stShadow = logBit("stShadow", groundShadow(LCX + 2, LF - 2, SR + 5, 6));
logParts.lying = full(lyingKey, LW, LH);
logParts.standing = full((x, y) => standKey({ pinch: 0, bites: [] }, x, y), LW, LH);
const lyingFrame: Frame = { ms: 1000, layers: [lyShadow, L("lying", [0, 0])] };
const standingFrame: Frame = { ms: 1000, layers: [stShadow, L("standing", [0, 0])] };

/** Chips flying from a bite (a fan out from it, `f` steps along), and the pile growing on the floor. */
function chipSpray(at: Pt, side: number, seed: number): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 1.9 + (grain(i, seed, 7) - 0.5) * 0.4;
    const r = 5 + grain(i, seed, 8) * 12;
    const x = Math.round(LCX + at[0] + side * Math.cos(a) * r);
    const y = Math.round(at[1] + Math.sin(a) * r * 0.9);
    const k = "pHhH"[i % 4]!;
    out.push([x, y, k]);
    if (i % 3 !== 2) out.push([x + side, y, i % 3 ? "j" : "d"]);
  }
  return out;
}
const floorChips = (n: number): Speck[] =>
  Array.from({ length: n }, (_, i): Speck => {
    const side = i % 2 ? 1 : -1;
    const x = Math.round(LCX + side * (17 + grain(i, 1, 9) * 14));
    const y = Math.round(LF - 2 + grain(i, 2, 9) * 4);
    return [x, y, "Hhjp"[i % 4]!];
  });

const gnawFrames: Frame[] = GNAW_STEPS.map((g, f) => {
  logParts[`gnaw${f}`] = full((x, y) => standKey(g, x, y), LW, LH);
  const newest = g.bites.filter((b) => b.kind !== "face").slice(-1)[0]!;
  const [bx, by] = biteXY(g, newest);
  const side = newest.kind === "side" ? newest.side : bx < 0 ? -1 : 1;
  return {
    ms: 250,
    layers: [stShadow, L(`gnaw${f}`, [0, 0])],
    specks: [...chipSpray([bx, by], side, f), ...floorChips(3 + f * 3)].filter(([x, y]) => x > 0 && y > 0 && x < LW - 1 && y < LH - 1),
    cue: f % 2 ? "chomp" : "gnaw",
    shake: f % 2 ? ([1, 0] as const) : undefined,
  };
});

export const INTRO_TIMBER_LOG: Character = {
  id: "intro-timber-log",
  name: "Timber's giant log",
  w: LW,
  h: LH,
  foot: [LCX, LF],
  palette: PALETTE,
  halo: HALO,
  parts: logParts,
  anims: {
    lying: { loop: false, frames: [lyingFrame] },
    standing: { loop: false, frames: [standingFrame] },
    gnawed: { loop: false, frames: gnawFrames },
  },
};

/** For Timber's own run (boss-beaver): how to draw this same log in his paws. */
export const INTRO_TIMBER_LOG_LOOK = `
The giant log (house-intro-timber, INTRO_TIMBER_LOG; picture 80 x 68, foot [40, 64] = the log's bottom middle).
Outline k #1e130d, 1 px round every part, as everywhere.
Bark (his fur browns, dark to light): a #3e2415, b #5d361d, c #7d4a27, d #9c6334, e #b97f4a.
  Lit from the top left; plates mostly c/d, e on the lit side, b/a in shade. Furrows run ALONG the log (about 7 round
  its girth, so 3 to 4 show), each a dark line (2 keys darker than its plate) with a lit lip beside it, wiggling a pixel;
  every 7 px or so a short dark crack crosses a plate. Two knots on the lying log's side: a dark "a" ring round a "j" eye.
Cut face (growth rings): rim of bark 1 px (d lit / c shade), then a 1 px ring of pale sapwood p #fff0c8, then the wood
  h #e0aa5c (H #f6d38e on its lit upper left) with 3 thin rings j #b47b36 at 30%, 56%, 80% of the radius, a heart
  J #7e5222 and one seasoning crack (J) from the heart toward the lower right.
Lying (east to west): 64 px long (x 8 to 72), 30 px thick (y 34 to 64); its LEFT end shows the cut face as an oval
  12 x 30 (middle x 14); the right end is bark rolling away into shade. Shadow under it.
Standing on end: 32 px across, 52 px tall (y 12 to 64); its top is the cut face as an oval 32 x 14; its foot an
  oval of the same size (front edge on the ground). Furrows run up and down.
Carried: draw it as the lying log (64 x 30), the cut face toward the left, at most a little tilted; it can be the
  INTRO_TIMBER_LOG_GRIDS.lying grid itself (outline it).
`;
/** The log's grids, cropped to their pixels (no outline yet: the sprite format adds it): lying 64 x 30, standing 32 x 52. */
export const INTRO_TIMBER_LOG_GRIDS = (() => {
  const crop = (g: readonly string[]) => {
    const rows = g.map((r, y) => [r, y] as const).filter(([r]) => /[^.]/.test(r));
    const xs = g.flatMap((r) => [...r].map((c, x) => (c !== "." ? x : -1)).filter((x) => x >= 0));
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    return rows.map(([r]) => r.slice(x0, x1 + 1));
  };
  return { lying: crop(logParts.lying!.grid), standing: crop(logParts.standing!.grid) };
})();

// ================================================================================================================
// 3. The table: PARK_TABLE's geometry (111 x 50, foot [55, 44], the slab's top 27 over the foot), its leg a log
//    pedestal he chewed out: an hourglass of chisel-marked raw wood, bark and roots left at its foot. No stools.
// ================================================================================================================

const PX = 37;
const TW = 3 * PX; // 111
const TH = 50;
const TFOOT = TH - 6; // 44
const TCX = Math.floor(TW / 2); // 55
const TOP_Y = TFOOT - 27; // 17
const SEAT_H = Math.round(TOWN_FEEL.sitSeat * PX);

const tableLeg = paint(TCX - 12, TOP_Y + 4, 25, TFOOT - TOP_Y - 4, (x, y) => {
  const X = x - TCX;
  const j = TFOOT - y; // 1 at the ground, 23 under the slab
  const hw = j >= 12 ? 5.5 + 2.6 * ((j - 12) / 11) ** 2 : 5.5 + 3.6 * ((12 - j) / 11) ** 2;
  // Roots flaring out at the foot, left and right.
  const root = j <= 3 && Math.abs(X) <= 11 - j * 0.8 && Math.abs(X) > hw;
  if (Math.abs(X) > hw && !root) return null;
  const nx = clamp(X / hw, -1, 1);
  let l = 0.62 - 0.55 * nx;
  const barkTop = 5 + (grain(X + 20, 0, 23) > 0.5 ? 1 : 0);
  if (root || j <= barkTop) {
    if (j === barkTop && grain(X + 20, 1, 24) > 0.6) return "J";
    return barkKey(l - (j <= 1 ? 0.15 : 0), Math.asin(nx) / Math.PI + 0.5, j * 2, x, y);
  }
  if (j >= 22) return j === 23 ? (X < 2 ? "p" : "H") : X < 0 ? "H" : X < 4 ? "h" : "j"; // the flat-chewed top, under the slab
  // Chisel marks: rows of scallops (each a tooth's bite), lit along their tops, offset row to row.
  const row = Math.floor(j / 3);
  const u = (((X + row * 2) % 5) + 5) % 5 - 2;
  const loc = (((j + Math.round(u * u * 0.3)) % 3) + 3) % 3;
  if (loc === 2) l += 0.24;
  else if (loc === 0) l -= 0.3;
  return ramp("JjhhH", l - 0.08);
});

const TABLE_BITS: Record<string, Bit> = {
  shadow: groundShadow(TCX + 1, TFOOT, 14, 4),
  leg: tableLeg,
};
const tableParts: Record<string, Part> = {};
for (const [n, b] of Object.entries(TABLE_BITS)) tableParts[n] = b.part;
const tableFrame: Frame = { ms: 1000, layers: Object.entries(TABLE_BITS).map(([n, b]) => L(n, b.at)) };

export const INTRO_TIMBER_TABLE: Character = {
  id: "intro-timber-table",
  name: "Timber's chess table",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PALETTE,
  halo: HALO,
  parts: tableParts,
  anims: { idle: { loop: true, frames: [tableFrame] } },
};

/** The slab's colors for the renderer ("1" top edge, "2" top, "4" front), L/D the board's squares, P/Q the pieces. */
export const INTRO_TIMBER_TABLE_PALETTE: Record<string, string> = {
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
/** The board in his woods: maple and walnut (a mid walnut, so the charcoal pieces still show on it). */
export const INTRO_TIMBER_TABLE_INK = {
  light: PALETTE["6"]!,
  lightShade: PALETTE["7"]!,
  lightLine: PALETTE["8"]!,
  dark: PALETTE["9"]!,
  darkShade: PALETTE["0"]!,
  darkLine: PALETTE["="]!,
} as const;

// ================================================================================================================
// 4. The stump: 34 x 40, foot [17, 35]; its sawn top at SEAT_H over the foot (the park stools' seat).
// ================================================================================================================

export const INTRO_TIMBER_STUMP_SEAT_H = SEAT_H;
const SW = 48;
const SH = 40;
const SCX = 24;
const SF = 35;

/** The stump at `lift` pixels over its spot (negative: still sunk in the floor, cut off at the ground). */
function stumpKey(x: number, y: number, lift: number): Key {
  const X = x + 0.5 - SCX;
  const j = SF - (y + 0.5) - lift; // up from the stump's own foot
  if (lift < 0 && y + 0.5 > SF) return null; // under the floor
  if (j > SEAT_H - 3) {
    const t = (X / 8) ** 2 + ((j - SEAT_H) / 3) ** 2;
    if (t <= 1) {
      const d = Math.sqrt(t) * 8;
      return ringKey(d, 8, 0.6 - 0.4 * (X / 8) + 0.6 * ((j - SEAT_H) / 3), Math.atan2(-(j - SEAT_H) / 3, X / 8));
    }
    if (j > SEAT_H) return null;
  }
  if (j < -0.5) return null;
  const front = -1.2 * Math.sqrt(Math.max(0, 1 - (X / 8) ** 2)); // its foot's front curve
  const w = j < 2.5 ? 8 - j * 0.4 : 7.5;
  // Roots: one either side, and a little one at the front left.
  const root = (j < 2.5 && j > front && Math.abs(X) < 11.5 - j * 1.5 && Math.abs(X) >= 7) || (j < 1.5 && j > front - 0.8 && X > -6 && X < -2);
  if (!root && (Math.abs(X) > w || j < front)) return null;
  const nx = clamp(X / 8, -1, 1);
  const l = 0.66 - 0.55 * nx - (j < 1.5 ? 0.16 : 0) - (j > SEAT_H - 2.5 ? 0.1 : 0);
  return barkKey(l, Math.asin(nx) / Math.PI + 0.5, j * 1.6, x, y);
}
const stumpParts: Record<string, Part> = {};
const stumpShadow = groundShadow(SCX + 1, SF, 9, 3);
stumpParts.shadow = stumpShadow.part;
stumpParts.stump = full((x, y) => stumpKey(x, y, 0), SW, SH);
const stumpIdle: Frame = { ms: 1000, layers: [L("shadow", stumpShadow.at), L("stump", [0, 0])] };

export const INTRO_TIMBER_STUMP: Character = {
  id: "intro-timber-stump",
  name: "Timber's stump seat",
  w: SW,
  h: SH,
  foot: [SCX, SF],
  palette: PALETTE,
  halo: HALO,
  parts: stumpParts,
  anims: { idle: { loop: true, frames: [stumpIdle] } },
};

// ---- pop: it springs up out of the floor in a puff of sawdust, hops a little over its spot, lands (knock) and settles.

/** A soft sawdust puff (no outline): a lumpy cloud, solid in its middle, see-through at its rim, or all thin. */
function puff(cx: number, cy: number, r: number, seed: number, thin = false): Bit {
  const R = Math.ceil(r) + 2;
  return paint(Math.floor(cx - R), Math.floor(cy - R), 2 * R + 1, 2 * R + 1, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = (y + 0.5 - cy) * 1.35;
    const lump = r * (0.82 + 0.22 * Math.sin(Math.atan2(dy, dx) * 3 + seed));
    const d = Math.hypot(dx, dy);
    if (d > lump) return null;
    if (thin) return d > lump * 0.6 ? "Q" : "q";
    if (d > lump * 0.8) return "q";
    return dy < -lump * 0.25 && dx < lump * 0.3 ? "g" : "G";
  }, false);
}
/** Each pop frame: the stump's lift over its spot (negative: still in the floor), the puffs' size, ms. */
const POP: readonly { lift: number; puff: number; thin: boolean; ms: number }[] = [
  { lift: -9, puff: 4, thin: false, ms: 70 },
  { lift: -3, puff: 6, thin: false, ms: 70 },
  { lift: 4, puff: 7, thin: false, ms: 80 },
  { lift: 0, puff: 8, thin: false, ms: 90 },
  { lift: 0, puff: 8, thin: true, ms: 110 },
  { lift: 0, puff: 6, thin: true, ms: 130 },
];
const popFrames: Frame[] = POP.map((p, f) => {
  stumpParts[`pop${f}`] = full((x, y) => stumpKey(x, y, p.lift), SW, SH);
  const layers: Layer[] = [L("shadow", stumpShadow.at)];
  const puffs: Bit[] = [];
  const spread = 6 + f * 1.6;
  puffs.push(puff(SCX - spread, SF - 2 - f * 0.6, p.puff, f, p.thin), puff(SCX + spread, SF - 2 - f * 0.4, p.puff - 1, f + 3, p.thin));
  // Behind it a puff first (it comes up through it), in front afterwards.
  const back = f <= 2;
  puffs.forEach((b, i) => (stumpParts[`popPuff${f}_${i}`] = b.part));
  const puffLayers = puffs.map((b, i) => L(`popPuff${f}_${i}`, b.at));
  if (back) layers.push(...puffLayers, L(`pop${f}`, [0, 0]));
  else layers.push(L(`pop${f}`, [0, 0]), ...puffLayers);
  // Sawdust and chips thrown up as it breaks out, falling back as it lands.
  const specks: Speck[] = [];
  for (let i = 0; i < 8 && f < 5; i++) {
    const side = i % 2 ? 1 : -1;
    const h = [6, 12, 15, 12, 7][f]! * (0.6 + grain(i, 1, 33) * 0.6);
    specks.push([Math.round(SCX + side * (5 + i + f * 1.5)), Math.round(SF - 3 - h), "pHhj"[i % 4]!]);
  }
  return { ms: p.ms, layers, specks: specks.filter(([x, y]) => x > 0 && y > 0 && x < SW - 1 && y < SH - 1), ...(f === 3 ? { cue: "knock" } : {}) };
});
(INTRO_TIMBER_STUMP.anims as Record<string, Anim>).pop = { loop: false, frames: popFrames };

// ---- For the review: a mock slab on the table, an 8 x 8 board with the town's pieces on it.

const SLAB_HALF = 16;
const mockSlab = paint(TCX - SLAB_HALF, TOP_Y - 9, 2 * SLAB_HALF + 1, 13, (x, y) => {
  const i = x - (TCX - SLAB_HALF);
  const j = y - (TOP_Y - 9);
  if (j >= 10) return j === 10 ? "3" : "4"; // the front face
  if (j === 0 || i === 0) return "1"; // the top edge
  if (i === 2 * SLAB_HALF || j === 9) return "3";
  if (i >= 4 && i <= 2 * SLAB_HALF - 4 && j >= 2 && j <= 8) return (Math.floor((i - 4) / 3.2) + Math.floor((j - 2) / 1)) % 2 ? "9" : "6";
  return "2";
});
const SQ = 12;
const BOARD_PX = SQ * 8 + 4;
const boardBit = paint(0, 0, BOARD_PX, BOARD_PX, (x, y) => {
  if (x < 2 || y < 2 || x >= BOARD_PX - 2 || y >= BOARD_PX - 2) return x < 2 || y < 2 ? "1" : "4"; // the slab's rim
  const c = Math.floor((x - 2) / SQ);
  const r = Math.floor((y - 2) / SQ);
  const dark = (c + r) % 2 === 1;
  const i = (x - 2) % SQ;
  const j = (y - 2) % SQ;
  if (j === SQ - 1 || i === SQ - 1) return dark ? "0" : "7";
  return dark ? "9" : "6";
});
/** The town's pieces on the board: [file, rank (0 at top), piece, white?]. */
const BOARD_SET: [number, number, string, boolean][] = [
  [0, 0, "R", false], [1, 0, "N", false], [2, 0, "B", false], [3, 0, "Q", false], [4, 0, "K", false], [5, 0, "B", false], [7, 0, "R", false],
  [0, 1, "P", false], [1, 1, "P", false], [2, 1, "P", false], [5, 1, "P", false], [6, 1, "P", false], [7, 1, "P", false],
  [3, 2, "P", false], [5, 2, "N", false], [4, 3, "P", false], [3, 3, "P", true], [4, 4, "P", true], [2, 4, "B", true],
  [5, 5, "N", true], [0, 6, "P", true], [1, 6, "P", true], [2, 6, "P", true], [5, 6, "P", true], [6, 6, "P", true], [7, 6, "P", true],
  [0, 7, "R", true], [1, 7, "N", true], [2, 7, "B", true], [3, 7, "Q", true], [4, 7, "K", true], [7, 7, "R", true],
];
const piecesBit = (() => {
  const W = BOARD_PX;
  const fill: Key[][] = Array.from({ length: W }, () => Array<Key>(W).fill(null));
  const lineOf: Key[][] = Array.from({ length: W }, () => Array<Key>(W).fill(null));
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
  return paint(0, 0, W, W, (x, y) => fill[y]![x] ?? lineOf[y]![x] ?? null, false);
})();

/** The table with its mock slab and both stumps on the stools' spots (TCX - 37, TCX + 37), as code will set them. */
const setParts: Record<string, Part> = { ...tableParts, slab: mockSlab.part, board: boardBit.part, pieces: piecesBit.part };
for (const [n, p] of Object.entries(stumpParts)) setParts[`st:${n}`] = p;
const stumpAt = (sx: number, fr: Frame): Layer[] => fr.layers.map((l) => ({ ...l, part: `st:${l.part}`, x: l.x + sx - SCX, y: l.y + TFOOT - SF }));
const setFrame = (stL: Frame, stR: Frame, ms = 1000): Frame => ({
  ms,
  layers: [...stumpAt(TCX - PX, stL), ...stumpAt(TCX + PX, stR), ...tableFrame.layers, L("slab", mockSlab.at)],
  specks: [...(stL.specks ?? []).map(([x, y, k]): Speck => [x + TCX - PX - SCX, y + TFOOT - SF, k]), ...(stR.specks ?? []).map(([x, y, k]): Speck => [x + TCX + PX - SCX, y + TFOOT - SF, k])],
  cue: stL.cue,
});
const TABLE_SET: Character = {
  id: "intro-timber-set",
  name: "Timber's table and stumps",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PALETTE,
  halo: HALO,
  parts: setParts,
  anims: {
    idle: { loop: true, frames: [setFrame(stumpIdle, stumpIdle)] },
    pop: { loop: false, frames: popFrames.map((fr) => setFrame(fr, fr, fr.ms)) },
    board: { loop: true, frames: [{ ms: 1000, layers: [L("board", [0, 0]), L("pieces", [0, 0])] }] },
  },
};

// ================================================================================================================
// 2. The shavings storm: 176 x 156, foot [88, 146] (= the table's foot). A cartoon cloud of billows (opaque sawdust fog,
//    outlined), curls of shavings and chips tumbling in it, sawdust flecks; rise, hold (loops), settle.
// ================================================================================================================

const VW = 176;
const VH = 162;
const VCX = 88;
const VF = 146;
/** The full cloud's billows, back to front: [x from the foot, height over it, radius]. */
const BILLOWS: readonly (readonly [number, number, number])[] = (() => {
  // Rows of lumps filling a dome 160 wide and 140 tall, the back (top) rows first; sizes and places jittered.
  const out: [number, number, number][] = [];
  const rows = [120, 104, 88, 72, 54, 36, 18, 3];
  rows.forEach((up, ri) => {
    const hw = 60 * Math.sqrt(Math.max(0.1, 1 - (up / 140) ** 2));
    const n = Math.max(2, Math.round((2 * hw) / 28) + 1);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const g = grain(ri, i, 91);
      const edgeS = Math.abs(t - 0.5) * 2; // 1 at the row's ends
      const r = (ri === rows.length - 1 ? 12 + g * 3 : 16 + g * 8) * (1 - edgeS * 0.15);
      out.push([(t - 0.5) * 2 * hw + (grain(ri, i, 92) - 0.5) * 8, up + (grain(ri, i, 93) - 0.5) * 7, r]);
    }
  });
  return out;
})();
type Billow = { x: number; y: number; r: number; i: number };
/** The fog's color at a pixel: the frontmost billow over it, lit from the top left, creased along its lower rim, a swirl
 * turning in it (`ph`), flecked with wood dust. */
/** The dome the billows fill (so there's no gap between them): its half-width and height from where they are. */
const domeOf = (bs: readonly Billow[]) => {
  const live = bs.filter((b) => b.r >= 1);
  if (!live.length) return { hw: 0, ht: 0 };
  return { hw: Math.max(...live.map((b) => Math.abs(b.x - VCX))) * 0.98, ht: Math.max(...live.map((b) => VF - b.y)) * 0.97 };
};
function cloudKey(bs: readonly Billow[], ph: number, x: number, y: number): Key {
  const X = x + 0.5;
  const Y = y + 0.5;
  const dome = domeOf(bs);
  for (let n = bs.length - 1; n >= 0; n--) {
    const b = bs[n]!;
    if (b.r < 1) continue;
    const nx = (X - b.x) / b.r;
    const ny = (Y - b.y) / (b.r * 0.92);
    const d = Math.hypot(nx, ny);
    if (d > 1) continue;
    let l = 0.6 - 0.3 * nx - 0.45 * ny;
    if (d > 0.82 && ny > 0.3 && grain(b.i, 0, 94) > 0.45) l -= 0.32; // the crease under it, where it rolls over the one behind
    const a = Math.atan2(ny, nx);
    const sw = (((a - ph - b.i * 1.7) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (b.r > 11 && b.i % 3 !== 1 && Math.abs(d - 0.55) < 0.08 && sw < 2.2) return sw < 0.7 ? "H" : sw < 1.5 ? "h" : "F"; // a streak of shavings churning round in it
    const g = grain(x, y, 61);
    if (g > 0.975) return l > 0.5 ? "H" : "h";
    if (g < 0.008) return "j";
    return ramp("fFGGgg", l * 0.85 + (0.47 - 0.25 * ((X - VCX) / (dome.hw + 1)) + 0.3 * ((VF - Y) / (dome.ht + 1))) * 0.15);
  }
  // Between the billows (inside two of them grown by a third): the fog's body, in the shade of the lumps round it.
  let near = 0;
  for (const b of bs) if (b.r >= 4 && Math.hypot(X - b.x, Y - b.y) < b.r * 1.22) near++;
  if (near >= 2) {
    // Between the billows: the fog's body, in the shade of the lumps round it.
    const g = grain(x, y, 62);
    if (g > 0.98) return "h";
    return ramp("fFGGgg", 0.38 - 0.18 * ((X - VCX) / dome.hw));
  }
  return null;
}

/** Curls of shaving (a ribbon rolled up: its dark inside shows) and bark chips, small outlined parts. */
const CURLS: Record<string, readonly string[]> = {
  curlA: ["..pHHh..", ".H....j.", "H..Hh..j", "H.h..j.j", "h..jj..j", ".h....j.", "..jjjj.."],
  curlB: [".pHH..", "pH.Hh.", "H..jh.", "h.jj..", "hj....", ".j...."],
  curlC: ["pHh..", "H..h.", "h.Hh.", "j.jj.", ".j..."],
  ribbon: ["pH....", ".Hh...", "..hhH.", "....jj"],
  chip: ["dc", "cb"],
  chip2: ["ed.", ".cb"],
};
const vParts: Record<string, Part> = {};
for (const [n, g] of Object.entries(CURLS)) vParts[n] = { grid: g };
const CURL_NAMES = ["curlA", "curlB", "curlC", "ribbon", "chip", "curlA", "chip2", "curlB"];
let vN = 0;
const vAdd = (p: Part, at: Pt = [0, 0]): Layer => {
  const n = `v${vN++}`;
  vParts[n] = p;
  return L(n, at);
};
const curlLayer = (k: number, x: number, y: number, turn: number): Layer => ({
  part: CURL_NAMES[k % CURL_NAMES.length]!,
  x: Math.round(x),
  y: Math.round(y),
  rot: (((turn % 4) + 4) % 4) as 0 | 1 | 2 | 3,
  flipX: k % 3 === 1,
});
const inFrame = (s: Speck[]) => s.filter(([x, y]) => x > 0 && y > 0 && x < VW - 1 && y < VH - 1);
const vShadow = (rx: number) => {
  const s = groundShadow(VCX + 2, VF, Math.min(rx, 80), clamp(rx / 12, 3, 6));
  return vAdd(s.part, s.at);
};
const billowsAt = (fn: (b: readonly [number, number, number], i: number) => [number, number, number]): Billow[] =>
  BILLOWS.map((b, i) => {
    const [dx, up, r] = fn(b, i);
    const lim = VCX - 4 - r * 1.32;
    return { x: VCX + clamp(dx, -lim, lim), y: VF - up, r, i };
  });

// ---- rise: it boils up from the log's foot, the low billows first, each swelling and climbing into place.

const riseFrames: Frame[] = Array.from({ length: 8 }, (_, f) => {
  const t = (f + 1) / 8;
  const bs = billowsAt(([dx, up, r]) => {
    const delay = 0.62 * (up / 126);
    const g = clamp((t - delay) / 0.42, 0, 1);
    const e = Math.sqrt(g);
    return [dx * (0.35 + 0.65 * e), up * (0.3 + 0.7 * e), r * e];
  });
  const layers: Layer[] = [vShadow(20 + 60 * t), vAdd(full((x, y) => cloudKey(bs, f * 0.8, x, y), VW, VH))];
  // Dust rolling out at its foot either side (see-through).
  const spread = 26 + 50 * t;
  for (const s of [-1, 1]) {
    const pb = puff(clamp(VCX + s * spread, 14, VW - 15), VF - 4, 6 + 5 * t, f + s);
    layers.push(vAdd(pb.part, pb.at));
  }
  // Curls and chips flung up out of its top and sides.
  const top = VF - Math.max(...bs.map((b) => VF - b.y + b.r));
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1;
    const a = 0.25 + (k / 8) * 1.1;
    const R = 10 + 70 * t * (0.7 + grain(k, 1, 71) * 0.5);
    layers.push(curlLayer(k, VCX + side * Math.cos(a) * R * 0.9, Math.max(3, top - 4 - Math.sin(a) * 12 + (VF - top) * (1 - Math.sin(a)) * 0.6), f + k));
  }
  const specks: Speck[] = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const R = 8 + (78 * t) * grain(i, 2, 72);
    specks.push([Math.round(VCX + side * R), Math.round(VF - 6 - grain(i, 3, 72) * (VF - top + 10)), "pHhjG"[i % 5]!]);
  }
  return { ms: 110, layers, specks: inFrame(specks), ...(f === 0 ? { cue: "clatter" } : {}), ...(f === 2 ? { shake: [1, 0] as const } : {}) };
});

// ---- hold: full, churning; each billow heaves on its own phase, curls tumble round, flecks swirl (4 frames, loops).

const CURL_SPOTS: readonly Pt[] = [
  [-44, 40], [-10, 30], [30, 34], [-26, 70], [12, 76], [44, 64], [-6, 104], [24, 100], [-58, 22], [56, 24],
  [-36, 96], [40, 92], [-50, 66], [56, 50], [8, 52], [-20, 120],
];
const holdFrames: Frame[] = Array.from({ length: 4 }, (_, f) => {
  const ph = (2 * Math.PI * f) / 4;
  const bs = billowsAt(([dx, up, r], i) => [dx + 1.6 * Math.cos(ph + i * 1.3), up + 1.6 * Math.sin(ph + i * 2.1), r + Math.sin(ph + i) * 1.1]);
  const layers: Layer[] = [vShadow(84), vAdd(full((x, y) => cloudKey(bs, ph + 0.5, x, y), VW, VH))];
  CURL_SPOTS.forEach(([dx, up], k) => {
    const a = ph * (k % 2 ? 1 : -1) + k;
    layers.push(curlLayer(k, VCX + dx + 5 * Math.cos(a) - 3, VF - up + 4 * Math.sin(a) - 3, f + k));
  });
  const specks: Speck[] = [];
  for (let i = 0; i < 40; i++) {
    const a = ph + i * 0.9;
    const cx = VCX + (grain(i, 1, 73) - 0.5) * 150;
    const cy = VF - 10 - grain(i, 2, 73) * 120;
    specks.push([Math.round(cx + 4 * Math.cos(a)), Math.round(cy + 3 * Math.sin(a)), "pHhjb"[i % 5]!]);
  }
  return { ms: 120, layers, specks: inFrame(specks), ...(f === 0 ? { cue: "saw" } : {}) };
});

// ---- settle: it sinks and thins (the top first), shavings fall out of it, and it ends as a ring of shavings on the floor.

/** The ring of shavings left round the table: heaps of sawdust and curls along an oval, clear of the leg and stumps. */
const RING_RX = 58;
const RING_RY = 10;
function shavingRing(x: number, y: number, u: number): Key {
  const X = x + 0.5 - VCX;
  const Y = y + 0.5 - VF;
  if (Math.abs(X) < 11 && Y < 2) return null; // the leg
  if (Math.abs(Math.abs(X) - PX) < 10 && Y < 3 && Y > -SEAT_H - 4) return null; // the stumps
  const e = Math.hypot(X / RING_RX, Y / RING_RY);
  const lump = 0.22 + 0.12 * Math.sin(Math.atan2(Y / RING_RY, X / RING_RX) * 7);
  if (Math.abs(e - 1) > lump * (0.4 + 0.6 * u)) return null;
  if (grain(x, y, 81) > 0.3 + 0.65 * u - Math.abs(e - 1) * 1.5) return null;
  const g = grain(x, y, 82);
  return g > 0.8 ? "H" : g > 0.6 ? "h" : Y < 0 && g < 0.2 ? "F" : g < 0.35 ? "G" : "g";
}
const settleFrames: Frame[] = Array.from({ length: 10 }, (_, f) => {
  const u = f / 9;
  const ph = f * 0.9;
  const thin = f >= 5;
  // It slumps into a low wide bank (frames 0 to 4), then breaks into motes that thin away.
  const s = Math.min(1, f / 4);
  const bs = billowsAt(([dx, up, r]) => {
    const h = up / 120;
    const rr = r * (1 - 0.5 * s * (0.4 + h)) * (thin ? 1 - (f - 4) * 0.08 : 1);
    return [dx * (1 + 0.3 * s), up * (1 - 0.82 * s) + (thin ? 2 : 0), rr];
  });
  const layers: Layer[] = thin ? [] : [vShadow(84 - 10 * f)];
  if (f >= 2) layers.push(vAdd(full((x, y) => shavingRing(x, y, clamp((f - 1) / 7, 0, 1)), VW, VH)));
  if (!thin) layers.push(vAdd(full((x, y) => cloudKey(bs, ph, x, y), VW, VH)));
  else if (f < 9)
    // Thinning dust: the billows' remains break into motes of sawdust, fewer each frame, no outline.
    layers.push(vAdd(full((x, y) => {
      const k = cloudKey(bs, ph, x, y);
      if (!k) return null;
      const g = grain(x, y, 90 + f);
      if (g > [0.55, 0.3, 0.16, 0.07][f - 5]!) return null;
      return g < 0.03 ? "h" : k === "f" || k === "F" ? "G" : "g";
    }, VW, VH, false)));
  // Shavings falling out of it down to the floor.
  CURL_SPOTS.forEach(([dx, up], k) => {
    const y0 = VF - up;
    const yl = VF - 3 + (k % 3) * 2;
    const y = Math.min(yl, y0 + (yl - y0) * Math.min(1, (u * 1.3) ** 2 * (1 + k * 0.1)));
    let x = VCX + dx * (1 + 0.3 * u) * (Math.abs(dx) < 15 ? 2.6 : 1);
    const ax = Math.abs(x - VCX);
    if (Math.abs(ax - PX) < 13 && y > VF - 26) x = VCX + Math.sign(x - VCX) * (ax < PX ? PX - 15 : PX + 15); // never onto a stump
    if (Math.abs(x - VCX) < 13 && y > VF - 30) return; // nor the table
    layers.push(curlLayer(k, x - 3, y - 4, y >= yl ? k : f + k));
  });
  const specks: Speck[] = [];
  for (let i = 0; i < 40 - f * 3; i++) {
    const cx = VCX + (grain(i, 1, 74) - 0.5) * (150 + 20 * u);
    const cy = VF - 8 - grain(i, 2, 74) * 120 * (1 - u) + u * 20 * grain(i, 3, 74);
    specks.push([Math.round(cx), Math.round(Math.min(VF + 6, cy)), "pHhjG"[i % 5]!]);
  }
  return { ms: 120, layers, specks: inFrame(specks), ...(f === 0 ? { cue: "slide" } : {}) };
});

export const INTRO_TIMBER_SHAVINGS: Character = {
  id: "intro-timber-shavings",
  name: "Timber's storm of shavings",
  w: VW,
  h: VH,
  foot: [VCX, VF],
  palette: PALETTE,
  parts: vParts,
  anims: {
    rise: { loop: false, frames: riseFrames },
    hold: { loop: true, frames: holdFrames },
    settle: { loop: false, frames: settleFrames },
  },
};

// ================================================================================================================
// 5. The sawdust transition: STORM (128 x 128, tiles both ways) and FRONT (48 x 128, tiles top to bottom), 6 frames.
//    As Alfil's sandstorm: three layers race right, each a whole number of pixels a frame, a whole repeat in 6 frames.
// ================================================================================================================

const ST = 128;
const FW = 48;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const cum = (steps: number[]) => steps.map((_, i) => steps.slice(0, i).reduce((s, v) => s + v, 0));
const SHIFT = {
  back: cum([5, 5, 6, 5, 5, 6]), // 32
  mid: cum([21, 22, 21, 22, 21, 21]), // 128
  front: cum([21, 21, 22, 21, 21, 22]), // 128
};
type Pat = Key[][];
const pat = (w: number): Pat => Array.from({ length: ST }, () => Array<Key>(w).fill(null));
const stamp = (p: Pat, x: number, y: number, k: string) => (p[mod(Math.round(y), ST)]![mod(Math.round(x), p[0]!.length)] = k);

/** The haze: bands of sawdust (pale to toasted) blowing in long waves, their seams ragged (opaque, the storm's body). */
const BACK_BANDS = "GFgjhFGgFjhgGFgh";
const BAND_TOP = cum([9, 6, 11, 7, 5, 10, 8, 6, 12, 7, 9, 5, 8, 10, 7, 8]);
const backPat: Pat = pat(32);
for (let y = 0; y < ST; y++)
  for (let u = 0; u < 32; u++) {
    const run = (b: number) => Math.floor(grain(Math.floor((u + b * 5) / 4) % 8, b, 31) * 3.2) - 1;
    const wave = 1.2 * Math.sin((2 * Math.PI * 3 * y) / ST);
    const by0 = mod(y + wave, ST);
    let b0 = 0;
    while (b0 < 15 && BAND_TOP[b0 + 1]! <= by0) b0++;
    const band = by0 - BAND_TOP[b0]! < run(b0) ? mod(b0 - 1, 16) : b0;
    backPat[y]![u] = BACK_BANDS[band]!;
  }

/** The gusts: toasted wind-shaped blobs, long curling shavings unrolling in the wind, pale dust wisps. */
const midPat: Pat = pat(ST);
for (let i = 0; i < 11; i++) {
  const ex = Math.floor(grain(i, 1, 51) * ST);
  const ey = Math.floor(i * 11.6) + Math.floor(grain(i, 2, 51) * 8);
  const rx = 15 + Math.floor(grain(i, 3, 51) * 9);
  const ry = 3 + Math.floor(grain(i, 4, 51) * 3);
  for (let dx = -rx * 2; dx <= rx; dx++) {
    const t = dx / rx;
    const h = t > 0 ? ry * Math.sqrt(1 - t * t) : ry * Math.pow(Math.max(0, 1 + t / 2), 1.3);
    for (let dy = -Math.ceil(h); dy <= Math.ceil(h); dy++) {
      if (Math.abs(dy) > h) continue;
      stamp(midPat, ex + dx, ey + dy, Math.abs(dy) < h * 0.5 && t > -1.2 ? "f" : "F");
    }
  }
}
for (let i = 0; i < 7; i++) {
  // A shaving: a ribbon of raw wood trailing in from the left, curling up into a roll at its head (2 px thick).
  const cx = Math.floor(grain(i, 5, 52) * ST);
  const cy = i * 18 + 8 + Math.floor(grain(i, 6, 52) * 8);
  const R = 4 + (i % 2);
  for (let x = -18; x <= 0; x++) {
    const wy = Math.round(Math.sin(x / 4 + i) * 1.2);
    stamp(midPat, cx + x, cy + R + wy, x < -12 ? "h" : "H");
    stamp(midPat, cx + x, cy + R + wy + 1, "j");
  }
  for (let a = 0; a < 2 * Math.PI * 1.2; a += 0.05) {
    const r = R * (1 - a / (2 * Math.PI * 1.6));
    const th = Math.PI / 2 - a;
    const px = cx + r * Math.cos(th + Math.PI);
    const py = cy - r * Math.sin(th + Math.PI);
    stamp(midPat, px, py, a > 4.2 ? "p" : "H");
    stamp(midPat, px + 1, py + 1, "j");
  }
}
for (let i = 0; i < 5; i++) {
  const ex = Math.floor(grain(i, 7, 53) * ST);
  const ey = i * 26 + 18;
  for (let x = 0; x < 30 + (i % 3) * 12; x++) stamp(midPat, ex + x, ey + 2 * Math.sin(x / 6 + i), x > 8 && x < 34 ? "g" : "G");
}

/** The streaks and chips: dashes of pale wood brightest at their heads (right), bark chips, little curls, grains. */
const frontPat: Pat = pat(ST);
for (let i = 0; i < 42; i++) {
  const ex = Math.floor(grain(i, 1, 61) * ST);
  const ey = Math.floor(grain(i, 2, 61) * ST);
  const len = 6 + Math.floor(grain(i, 3, 61) * 22);
  const kind = grain(i, 4, 61);
  const keys = kind < 0.55 ? "pHh" : kind < 0.85 ? "Hhj" : "gGF";
  for (let x = 0; x < len; x++) {
    const t = x / len;
    stamp(frontPat, ex - x, ey, keys[t < 0.3 ? 0 : t < 0.7 ? 1 : 2]!);
    if (kind > 0.4 && kind < 0.7 && x > 1 && x < len * 0.6) stamp(frontPat, ex - x - 2, ey + 1, keys[1]!);
  }
}
const CURL_STAMPS = [["Hh", "j.", ".j"], [".pH", "h.j", ".j."], ["dc", "cb"], ["e.", "cb"], ["pH", "hj"]];
for (let i = 0; i < 34; i++) {
  const ex = Math.floor(grain(i, 8, 63) * ST);
  const ey = Math.floor(grain(i, 9, 63) * ST);
  CURL_STAMPS[i % CURL_STAMPS.length]!.forEach((row, j) => [...row].forEach((k, x) => k !== "." && stamp(frontPat, ex + x, ey + j, k)));
}
for (let i = 0; i < 80; i++) {
  const ex = Math.floor(grain(i, 5, 62) * ST);
  const ey = Math.floor(grain(i, 6, 62) * ST);
  const g = grain(i, 7, 62);
  stamp(frontPat, ex, ey, g < 0.12 ? "b" : g < 0.55 ? "p" : "H");
  for (let x = 1; x <= 1 + (i % 3); x++) stamp(frontPat, ex - x, ey, g < 0.55 ? "g" : "h");
}

const stormKey = (x: number, y: number, f: number): string =>
  frontPat[mod(y, ST)]![mod(x - SHIFT.front[f]!, ST)] ?? midPat[mod(y, ST)]![mod(x - SHIFT.mid[f]!, ST)] ?? backPat[mod(y, ST)]![mod(x - SHIFT.back[f]!, 32)]!;

const stormParts: Record<string, Part> = {};
const stormFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), ST, ST, false);
  return { ms: 70, layers: [{ part: `s${f}`, x: 0, y: 0 }], ...(f === 0 ? { cue: "swoosh" } : {}) };
});
export const INTRO_TIMBER_STORM: Character = {
  id: "intro-timber-storm",
  name: "Timber's sawdust storm (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};

/** The leading edge: the storm on its left (so it meets STORM with no seam), billowing lobes, thinning dust, chips ahead. */
const LOBES = [
  ...Array.from({ length: 6 }, (_, i) => ({ y: (i * 128) / 6 + grain(i, 1, 81) * 6, x: 15 + grain(i, 2, 81) * 6, r: 12 + grain(i, 3, 81) * 5, p: grain(i, 4, 81) * 6.28 })),
  ...Array.from({ length: 6 }, (_, i) => ({ y: ((i + 0.5) * 128) / 6 + grain(i, 5, 81) * 4, x: 25 + grain(i, 6, 81) * 5, r: 6 + grain(i, 7, 81) * 3, p: grain(i, 8, 81) * 6.28 })),
];
function outside(x: number, y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  const body = 17 + 2 * Math.sin((2 * Math.PI * 2 * y) / ST + ph);
  let out = x < body ? 0 : x - body;
  for (const l of LOBES) {
    const cy = l.y + 2 * Math.sin(ph + l.p);
    const cx = l.x + 3 * Math.cos(ph + l.p);
    const r = l.r * (1 + 0.12 * Math.sin(ph + l.p * 2));
    const dy = mod(y + 0.5 - cy + 64, ST) - 64;
    out = Math.min(out, Math.max(0, Math.hypot(x + 0.5 - cx, dy * 1.1) - r));
    if (out === 0) return 0;
  }
  return out;
}
function frontKey(x: number, y: number, f: number): Key {
  const out = outside(x, y, f);
  if (out === 0) {
    const o = (dx: number, dy: number) => outside(x + dx, y + dy, f) > 0;
    if (o(0, -2) || o(-2, -1)) return o(0, -1) ? "p" : "g";
    if (o(0, 2)) return o(0, 1) ? "f" : "F";
    if (o(1, 0)) return "G";
    if (o(2, 0)) return "h";
    return stormKey(x, y, f);
  }
  if (out < 1.5) return "q";
  if (out < 3.5) return "Q";
  const wisp = grain(mod(Math.floor((x - 3 * f) / 6), 3), y >> 1, 71);
  if (out < 7) return wisp > 0.3 ? "%" : null;
  if (out < 12) return wisp > 0.72 ? "%" : null;
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  frontParts[`e${f}`] = full((x, y) => frontKey(x, y, f), FW, ST, false);
  // Chips and curls flying ahead: each runs 3 px a frame over an 18 px stretch, so it comes round in 6 frames.
  const specks: Speck[] = [];
  for (let i = 0; i < 18; i++) {
    const y = Math.floor((i * 128) / 18 + grain(i, 1, 72) * 5);
    const x = 28 + mod(Math.floor(grain(i, 2, 72) * 18) + 3 * f, 18);
    if (i % 3 === 0) specks.push([x, y, "H"], [x + 1, y, "h"], [x, y + 1, "j"], [x - 1, y, "Q"]); // a little curl
    else if (i % 3 === 1) specks.push([x, y, "c"], [x + 1, y, "b"], [x - 1, y, "Q"]); // a bark chip
    else specks.push([x, y, "p"], [x - 1, y, "q"], [x - 2, y, "Q"]); // a grain
  }
  return { ms: 70, layers: [{ part: `e${f}`, x: 0, y: 0 }], specks: specks.filter(([x, y]) => x < FW && y >= 0 && y < ST) };
});
export const INTRO_TIMBER_FRONT: Character = {
  id: "intro-timber-front",
  name: "Timber's sawdust storm (leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

// ================================================================================================================
// 6. The review sheet: every piece side by side; one animation per piece animation; the storm tiled 3 x 2 with its front.
// ================================================================================================================

function place(sheetParts: Record<string, Part>, prefix: string, ch: Character, frame: Frame, dx: number, dy: number): { layers: Layer[]; specks: Speck[] } {
  const layers = frame.layers.map((l) => {
    const name = `${prefix}:${l.part}`;
    sheetParts[name] = ch.parts[l.part]!;
    return { ...l, part: name, x: l.x + dx, y: l.y + dy };
  });
  const specks = (frame.specks ?? []).map(([x, y, k]): Speck => [x + dx, y + dy, k]);
  return { layers, specks };
}
type Slot = { prefix: string; ch: Character; frame: Frame; at: Pt };
function compose(parts: Record<string, Part>, slots: Slot[], ms: number, cue?: string): Frame {
  const layers: Layer[] = [];
  const specks: Speck[] = [];
  for (const s of slots) {
    const p = place(parts, s.prefix, s.ch, s.frame, s.at[0], s.at[1]);
    layers.push(...p.layers);
    specks.push(...p.specks);
  }
  return { ms, layers, specks, ...(cue ? { cue } : {}) };
}

const AT = { lying: [2, 2] as Pt, standing: [2, 76] as Pt, shav: [86, 2] as Pt, set: [266, 4] as Pt, stump: [300, 58] as Pt, board: [270, 104] as Pt, grid: [382, 2] as Pt };
const GRID_W = 3 * ST + FW;
const GRID_H = 2 * ST;
const SHEET_W = AT.grid[0] + GRID_W + 2;
const SHEET_H = GRID_H + 6;
const stormGridSlots = (f: number): Slot[] => [
  ...[0, 1, 2].flatMap((i) => [0, 1].map((j) => ({ prefix: `storm${i}${j}`, ch: INTRO_TIMBER_STORM, frame: stormFrames[f]!, at: [AT.grid[0] + i * ST, AT.grid[1] + j * ST] as Pt }))),
  ...[0, 1].map((j) => ({ prefix: `front${j}`, ch: INTRO_TIMBER_FRONT, frame: frontFrames[f]!, at: [AT.grid[0] + 3 * ST, AT.grid[1] + j * ST] as Pt })),
];
/** The table set, under the storm (same foot), for the hold and settle checks. */
const SET_UNDER: Pt = [AT.shav[0] + VCX - TCX, AT.shav[1] + VF - TFOOT];
const sheetParts: Record<string, Part> = {};
interface Over {
  lying?: Frame;
  standing?: Frame;
  shav?: Frame;
  under?: boolean;
  set?: Frame;
  stump?: Frame;
  grid?: number;
}
function sheetFrame(o: Over, ms: number, cue?: string): Frame {
  const setIdle = TABLE_SET.anims.idle!.frames[0]!;
  return compose(
    sheetParts,
    [
      { prefix: "ly", ch: INTRO_TIMBER_LOG, frame: o.lying ?? lyingFrame, at: AT.lying },
      { prefix: "stl", ch: INTRO_TIMBER_LOG, frame: o.standing ?? standingFrame, at: AT.standing },
      ...(o.under ? [{ prefix: "under", ch: TABLE_SET, frame: setIdle, at: SET_UNDER }] : []),
      { prefix: "sv", ch: INTRO_TIMBER_SHAVINGS, frame: o.shav ?? holdFrames[0]!, at: AT.shav },
      { prefix: "set", ch: TABLE_SET, frame: o.set ?? setIdle, at: AT.set },
      { prefix: "stp", ch: INTRO_TIMBER_STUMP, frame: o.stump ?? stumpIdle, at: AT.stump },
      { prefix: "brd", ch: TABLE_SET, frame: TABLE_SET.anims.board!.frames[0]!, at: AT.board },
      ...stormGridSlots(o.grid ?? 0),
    ],
    ms,
    cue,
  );
}
const sheetAnims: Record<string, Anim> = { idle: { loop: true, frames: [sheetFrame({}, 1000)] } };
const each = (anim: Anim, over: (fr: Frame) => Over): Anim => ({ loop: anim.loop, frames: anim.frames.map((fr) => sheetFrame(over(fr), fr.ms, fr.cue)) });
sheetAnims["log-lying"] = each(INTRO_TIMBER_LOG.anims.lying!, (fr) => ({ lying: fr }));
sheetAnims["log-standing"] = each(INTRO_TIMBER_LOG.anims.standing!, (fr) => ({ standing: fr }));
sheetAnims["log-gnawed"] = each(INTRO_TIMBER_LOG.anims.gnawed!, (fr) => ({ standing: fr }));
sheetAnims["shavings-rise"] = each(INTRO_TIMBER_SHAVINGS.anims.rise!, (fr) => ({ shav: fr }));
sheetAnims["shavings-hold"] = each(INTRO_TIMBER_SHAVINGS.anims.hold!, (fr) => ({ shav: fr, under: true }));
sheetAnims["shavings-settle"] = each(INTRO_TIMBER_SHAVINGS.anims.settle!, (fr) => ({ shav: fr, under: true }));
sheetAnims.table = { loop: true, frames: [sheetFrame({}, 1000)] };
sheetAnims["stump-idle"] = each(INTRO_TIMBER_STUMP.anims.idle!, (fr) => ({ stump: fr }));
sheetAnims["stump-pop"] = { loop: false, frames: popFrames.map((fr, i) => sheetFrame({ stump: fr, set: TABLE_SET.anims.pop!.frames[i]! }, fr.ms, fr.cue)) };
sheetAnims.storm = { loop: true, frames: [0, 1, 2, 3, 4, 5].map((f) => sheetFrame({ grid: f }, 70, f === 0 ? "swoosh" : undefined)) };

/** (While drawing, a single piece can be reviewed on its own here; the sheet when null.) */
const overParts: Record<string, Part> = {};
const OVER: Character = {
  id: "over",
  name: "The storm over the table",
  w: VW,
  h: VH,
  foot: [VCX, VF],
  palette: PALETTE,
  parts: overParts,
  anims: Object.fromEntries(
    (["rise", "hold", "settle"] as const).map((n) => [
      n,
      {
        loop: n === "hold",
        frames: INTRO_TIMBER_SHAVINGS.anims[n]!.frames.map((fr) =>
          compose(overParts, [...(n !== "rise" ? [{ prefix: "t", ch: TABLE_SET, frame: TABLE_SET.anims.idle!.frames[0]!, at: [VCX - TCX, VF - TFOOT] as Pt }] : [{ prefix: "l", ch: INTRO_TIMBER_LOG, frame: standingFrame, at: [VCX - LCX, VF - LF] as Pt }]), { prefix: "s", ch: INTRO_TIMBER_SHAVINGS, frame: fr, at: [0, 0] }], fr.ms),
        ),
      },
    ]),
  ),
};
const DEV = null as Character | null;
void OVER; // (OVER: the storm over the table / the log, same foot: set DEV = OVER to review it)
export const HOUSE_INTRO_TIMBER: Character = DEV
  ? { ...DEV, id: "house-intro-timber", anims: { idle: DEV.anims.lying ?? DEV.anims.idle ?? DEV.anims.hold!, ...DEV.anims } }
  : {
      id: "house-intro-timber",
      name: "Timber's battle intro (review sheet)",
      w: SHEET_W,
      h: SHEET_H,
      foot: [SHEET_W / 2, SHEET_H - 4],
      palette: PALETTE,
      parts: sheetParts,
      anims: sheetAnims,
    };
