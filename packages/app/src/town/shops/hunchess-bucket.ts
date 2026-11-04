/**
 * The HunChess bucket (Eric, Nov 4, with a photo: a classic 5-gallon hardware bucket), drawn at any angle: shared by the
 * barn's and Puddles' decoration (house-shop-pig, house-shop-puddles: `bucket*` pieces) and the intro's tumbling stools
 * (house-intro-pig: INTRO_PIG_BUCKET_B, INTRO_PIG_BUCKET_W). A straight plastic cylinder, 26 px across and 26 tall (no
 * taper); at its open end a wide, thick rim band of two stacked ridges, clearly wider than the body (29 across); a thin wire
 * handle hooked into two lugs just under the band; a soft highlight stripe down its lit side; "HunChess" in bold pixel
 * letters on its body (white on the black bucket, black on the white one), printed the normal way (it reads right way up
 * with the bucket rim up; upside down on a stool). Colors: black, white (the intro's stools), muted green, red and yellow
 * (decoration). Keys: BUCKET_PALETTE (U+00C0 to U+00E7), plus the outline (k), the rope's (r R t) and the wire's (M n).
 *
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-shop-pig/hunchess-bucket.ts at 0e4c00c6, Nov 4), its import
 * moved: next to the barn's art (shops/pig-art.ts), Puddles' (shops/puddles-art.ts) and the intro's (shops/pig-intro-art.ts).
 */
import type { Part } from "../../characters/sprite.ts";

type Pt = readonly [number, number];
type Bit = { part: Part; at: Pt };
/** The bucket's colors: the intro's black (his stool) and white (yours), and the decoration's muted green, red and yellow.
 *  Each: body, shade, deep, lit, highlight stripe, inside, far inside wall, lettering (black or white, contrasting). */
export type BucketColor = "b" | "w" | "green" | "red" | "yellow";
const HEX: Record<BucketColor, readonly string[]> = {
  b: ["#3d3c45", "#302f37", "#26252b", "#5e5d6a", "#5e5d6a", "#1f1e22", "#302f37", "#ffffff"],
  w: ["#f4f3ef", "#d2d1ca", "#a5a49c", "#f4f3ef", "#ffffff", "#a5a49c", "#d2d1ca", "#1f1e22"],
  green: ["#5a7d4b", "#486a3c", "#35502d", "#73966a", "#8eae80", "#243a20", "#486a3c", "#f2f2ee"],
  red: ["#9e4a3f", "#843b32", "#5f2a24", "#b56457", "#c98074", "#3a1915", "#843b32", "#f2f2ee"],
  yellow: ["#cfa84a", "#b08c38", "#80662a", "#e0bf68", "#ecd48f", "#5a4719", "#b08c38", "#1f1e22"],
};
const ROLES = ["body", "shade", "deep", "lit", "hi", "inside", "insideFar", "text"] as const;
const ORDER: readonly BucketColor[] = ["b", "w", "green", "red", "yellow"];
/** Each color's palette keys (Latin-1 letters from U+00C0, free in the barn's and Puddles' palettes), 8 a color. */
const keyOf = (c: BucketColor, role: number) => String.fromCharCode(0xc0 + ORDER.indexOf(c) * 8 + role);
/** The buckets' colors, to spread into a palette. */
export const BUCKET_PALETTE: Record<string, string> = Object.fromEntries(ORDER.flatMap((c) => HEX[c].map((hex, r) => [keyOf(c, r), hex])));
type Cv = string[][];
const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const stampRows = (c: Cv, x: number, y: number, rows: readonly string[]) => rows.forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(c, x + i, y + j, k)));
const cropBit = (c: Cv, outline = true): Bit | null => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  c.forEach((row, y) =>
    row.forEach((k, x) => {
      if (k === ".") return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }),
  );
  if (x1 < 0) return null;
  return { part: { grid: c.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline }, at: [x0, y0] };
};

/** The canvas a bucket is drawn on (the intro's frames: 64 x 72, foot [32, 64]); the barn passes its own. */
export const BW = 64;
export const BH = 72;
export const BF: Pt = [32, 64];
export const HALF_BODY = 13;
export const HALF_BAND = 14.6;
export const BAND = 6; // the rim band's depth, px from the mouth (two ridges)
export const TALL = 26; // mouth to base
export const HALF_MOUTH = HALF_BAND; // (the widest at the mouth end: the band)
export const HALF_BASE = HALF_BODY;

export type Ink = Record<(typeof ROLES)[number], string>;
export const INK = Object.fromEntries(ORDER.map((c) => [c, Object.fromEntries(ROLES.map((r, i) => [r, keyOf(c, i)]))])) as Record<BucketColor, Ink>;
/** "HunChess" in bold 3 x 5 letters, in two lines (Hun over Chess): 27 px across a 26 px body won't take it in one. */
const LOGO_GLYPH: Record<string, readonly string[]> = {
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  u: ["...", "#.#", "#.#", "#.#", "###"],
  n: ["...", "##.", "#.#", "#.#", "#.#"],
  C: ["###", "#..", "#..", "#..", "###"],
  h: ["#..", "#..", "###", "#.#", "#.#"],
  e: [".#.", "#.#", "###", "#..", ".##"],
  s: [".##", "#..", ".#.", "..#", "##."],
};
/** The logo's pixels, centred on (0, 0): upright with the bucket rim up (X right, Y toward its base). */
const LOGO: Set<string> = (() => {
  const set = new Set<string>();
  const lines = ["Hun", "Chess"];
  lines.forEach((word, li) => {
    const w = word.length * 4 - 1;
    let x = -Math.floor(w / 2);
    const y0 = li === 0 ? -6 : 1;
    for (const ch of word) {
      LOGO_GLYPH[ch]!.forEach((row, j) => [...row].forEach((c, i) => c === "#" && set.add(`${x + i},${y0 + j}`)));
      x += 4;
    }
  });
  return set;
})();
/** The logo's middle along the pail: px from the mouth (clear of the band, and of the base's face when it's a stool). */
const LOGO_AT = 14.5;
/**
 * The pail at angle `a` (radians, 0 mouth up; turning clockwise) with its middle at (cx, cy): its body (a cylinder lit from
 * the top left, a highlight stripe down its lit side), the rim band at the mouth, the logo, the end cap that faces up the
 * screen (the open mouth with the dark inside, or the flat base), the wire handle from its lugs (swung by `swing`, never
 * below the floor), the knot of rope on its grip. Returns the bits and where the grip is.
 */
export function pail(ink: Ink, cx: number, cy: number, a: number, swing: number, knot: boolean, back = false): { bits: Bit[]; grip: Pt } {
  const body = cv(BW, BH);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Local (u across, v along: v < 0 toward the mouth) to the frame, and back.
  const toF = (u: number, v: number): Pt => [cx + u * ca - v * sa, cy + u * sa + v * ca];
  const toL = (x: number, y: number): Pt => [(x - cx) * ca + (y - cy) * sa, -(x - cx) * sa + (y - cy) * ca];
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const [u, v] = toL(x + 0.5, y + 0.5);
      const tp = v + TALL / 2; // px from the mouth
      if (tp < 0 || tp > TALL) continue;
      const band = tp < BAND;
      const half = band ? HALF_BAND : HALF_BODY;
      if (Math.abs(u) > half) continue;
      const nu = u / half;
      const nx = nu * ca; // the wall's normal, across the frame
      const l = 0.58 - 0.5 * nx - 0.4 * (nu * sa) + 0.18 * Math.sqrt(Math.max(0, 1 - nu * nu));
      let k = l > 0.86 ? ink.lit : l > 0.48 ? ink.body : l > 0.2 ? ink.shade : ink.deep;
      if (band) {
        // Two stacked ridges: each lit along its top, shaded under; a groove between.
        const r = tp < 3 ? tp : tp - 3;
        k = r < 1 ? (l > 0.4 ? ink.hi : ink.body) : r < 2.2 ? (l > 0.5 ? ink.body : ink.shade) : ink.deep;
      } else if (tp < BAND + 1) k = ink.deep; // the band's shadow on the wall
      else if (tp > TALL - 1) k = ink.deep; // the base's edge
      else if (nx > -0.66 && nx < -0.38) k = ink.hi; // the soft highlight stripe down its lit side
      // The logo, printed the normal way: it reads right way up with the bucket standing rim up (so upside down on a stool).
      if (!band && LOGO.has(`${Math.round(u - 0.5)},${Math.round(tp - LOGO_AT - 0.5)}`) && Math.abs(nu) < 0.92) k = ink.text;
      put(body, x, y, k);
    }
  // The handle's lugs: a square boss either side just under the band.
  const LUG = BAND + 1.5;
  for (const side of [-1, 1]) {
    const [ex, ey] = toF(side * (HALF_BODY - 0.5), -TALL / 2 + LUG);
    stampRows(body, Math.round(ex) - 1, Math.round(ey) - 1, [ink.lit + ink.shade, ink.shade + ink.deep]);
  }
  // The end cap facing up the screen: the mouth (lip round it, the dark inside, the far inner wall lit) or the base.
  const cap = cv(BW, BH);
  const mouthUp = ca > 0;
  const capV = mouthUp ? -TALL / 2 : TALL / 2;
  const capHalf = (mouthUp ? HALF_BAND : HALF_BODY) - 0.2;
  const depth = Math.abs(ca) * (mouthUp ? 6.5 : 4.5) + 0.6;
  if (Math.abs(ca) > 0.25) {
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const [u, v] = toL(x + 0.5, y + 0.5);
        const dv = (v - capV) * (mouthUp ? 1 : -1); // < 0 toward the far edge
        const e = (u / capHalf) ** 2 + (dv / depth) ** 2;
        if (e > 1) continue;
        let k: string;
        if (mouthUp) {
          if (e > 0.6) k = dv < 0 || e > 0.85 ? ink.lit : ink.body; // the lip, all round
          else k = dv > depth * 0.15 ? ink.insideFar : ink.inside; // the inside: its far wall lit, the depth dark
        } else {
          k = e > 0.8 ? ink.shade : Math.abs(e - 0.45) < 0.08 ? ink.shade : dv < -depth * 0.2 ? ink.lit : ink.body; // the flat base, a recessed ring
        }
        put(cap, x, y, k);
      }
  }
  // The handle: a thin wire from ear to ear, swung over the mouth (swing 0) or down along its side; a plastic grip in the middle.
  const handle = cv(BW, BH);
  const [lx, ly] = toF(-(HALF_BODY - 0.5), -TALL / 2 + LUG);
  const [rx, ry] = toF(HALF_BODY - 0.5, -TALL / 2 + LUG);
  const [ax, ay0] = toF(0, -TALL / 2 + LUG - 22 * Math.cos(swing));
  const ay = ay0 + (back ? -3 : 8) * Math.abs(Math.sin(swing)); // (`back`: laid down behind it, over its far rim)
  const qx = 2 * ax - (lx + rx) / 2;
  const qy = 2 * ay - (ly + ry) / 2;
  let grip: Pt = [Math.round(ax), Math.round(ay)];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = (1 - t) ** 2 * lx + 2 * (1 - t) * t * qx + t * t * rx;
    const y = Math.min(BF[1] - 0.5, (1 - t) ** 2 * ly + 2 * (1 - t) * t * qy + t * t * ry); // (it lies on the floor, never under it)
    const mid = i >= 24 && i <= 36;
    put(handle, x, y, mid ? INK.b.inside : i % 6 === 0 ? "n" : "M");
    if (mid) put(handle, x, y + 1, INK.b.inside); // the grip is thicker than the wire
    if (i === 30) grip = [Math.round(x), Math.round(y)];
  }
  const knotC = cv(BW, BH);
  if (knot) stampRows(knotC, grip[0] - 1, grip[1] - 1, ["rRr", "RtR", ".r."]);
  const handleBehind = back || (!mouthUp && Math.abs(ca) > 0.6); // upside down: the handle hangs on its far side...
  const bits = [cropBit(body)!, ...(cropBit(cap, false) ? [cropBit(cap, false)!] : [])];
  const h = cropBit(handle, false);
  return { bits: h ? (handleBehind ? [h, ...bits] : [...bits, h]).concat(cropBit(knotC) ? [cropBit(knotC)!] : []) : bits, grip };
}
/** Its middle so its lowest point rests on the floor at angle `a`, lifted `hop`. */
export function restY(a: number, hop = 0): number {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let low = -Infinity;
  for (const [u, v] of [[-HALF_MOUTH, -TALL / 2], [HALF_MOUTH, -TALL / 2], [-HALF_BASE, TALL / 2], [HALF_BASE, TALL / 2]] as const) low = Math.max(low, u * sa + v * ca);
  return BF[1] - low - hop;
}

/** A bucket standing rim up, its foot at (fx, fy) in a picture: its bits (shifted from the bucket's own frame), its handle
 *  laid down behind it (so the lettering shows). `lift` raises it (a bucket nested in another). */
export function standingBucket(color: BucketColor, fx: number, fy: number, swing = 1.3, lift = 0): Bit[] {
  const p = pail(INK[color], BF[0], restY(0) - lift, 0, swing, false, true);
  return p.bits.map((b) => ({ part: b.part, at: [b.at[0] + fx - BF[0], b.at[1] + fy - BF[1]] as Pt }));
}
