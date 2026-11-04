/**
 * Wrangler's battle intro (house-intro-pig): the props code plays when you challenge the cowboy pig in his barn (Eric's
 * design, Nov 4). Drawn by hand (weekly plan usage), in the barn's colors (out/house-shop-pig: SHOP_PIG_PALETTE) and his.
 *
 * 1. INTRO_PIG_ROPE: his lasso's loop: `fly` (open, spinning through the air), `catch` (dropped over the bale and cinched),
 *    `cinched` (tight round the bale while it's dragged), `free` (shaken loose off it). The line from his hand to the loop
 *    is code's: a 2 px twisted rope (INTRO_PIG_ROPE_INK) from PIG_INTRO_HANDS (boss-pig) to INTRO_PIG_ROPE_KNOT.
 * 2. INTRO_PIG_TABLE: the hay bale the board stands on (PARK_TABLE's geometry: 111 x 50, foot [55, 44], the slab's top 27 over
 *    the foot; the bale alone, the renderer draws the slab and the board), the same bale as the barn's `board-stand`. `idle`,
 *    `slide` (dragged: bumping, straw flying), `land` (it stops in the middle). INTRO_PIG_TABLE_PALETTE, INTRO_PIG_TABLE_INK,
 *    INTRO_PIG_TABLE_LIFT (the slab's lift on each slide frame).
 * 3. INTRO_PIG_BUCKET_B and INTRO_PIG_BUCKET_W: the black bucket (from our left) and the white one (from our right), 5-gallon
 *    pails with wire handles, the rope's end knotted on the handle: `tumble` (end over end), `land` (upside down, a clatter
 *    and a thunk), `stool` (upside down: a seat, its top at the park stools' seat height). INTRO_PIG_BUCKET_HANDLE.
 * 4. INTRO_PIG_STORM (128 x 128, tiles both ways) and INTRO_PIG_FRONT (48 x 128): the wipe into the match, played as
 *    Alfil's sandstorm is: a dusty sunset, tumbleweeds rolling, spurs spinning, toy cap guns popping BANG! flags.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../../../packages/app/src/characters/sprite.ts";
import { grain, groundShadow, paint } from "../../../../packages/app/src/town/houses/kit.ts";
import { TOWN_FEEL } from "../../../../packages/app/src/town/feel.ts";
import { SHOP_PIG_PALETTE, standBale } from "../house-shop-pig/house-shop-pig.ts";

type Pt = readonly [number, number];
type Key = string | null;
type Bit = { part: Part; at: Pt };

// ---- Colors: the barn's, and the buckets', the wipe's.

const PALETTE: Record<string, string> = {
  ...SHOP_PIG_PALETTE,
  a: "#ffd585", // the sunset: gold, orange, salmon, rose, dusky plum
  b: "#ffad5e",
  d: "#f5826a",
  H: "#d9617a",
  I: "#9f4f6e",
  j: "#f7e2b6", // dust: pale, mid, shade
  W: "#e3c08a",
  "=": "#c49a62",
  "#": "#ea3b30", // the toy cap guns: red, its shade; blue, its shade; the orange safety tip
  $: "#a3201b",
  "%": "#3586dd",
  "&": "#1f5299",
  "*": "#ff8a1c",
  "^": "#ffffff", // a cap's pop: white, smoke grey
  "~": "#e6e1d6",
  "(": "#f4f3ef", // the white bucket: white, shade, deep
  ")": "#d2d1ca",
  "[": "#a5a49c",
  "]": "#3d3c45", // the black bucket: its lit edge, black, deepest
  "{": "#26252b",
  "}": "#5e5d6a",
  "|": "#302f37", // (the black bucket's shade)
  "<": "#1f1e22", // the handles' grip
};
const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });
type Cv = string[][];
const cv = (w: number, h: number): Cv => Array.from({ length: h }, () => Array<string>(w).fill("."));
const put = (c: Cv, x: number, y: number, k: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < c.length && x >= 0 && x < c[0]!.length) c[y]![x] = k;
};
const get = (c: Cv, x: number, y: number) => c[y]?.[x] ?? ".";
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
/** Frames from lists of bits: each bit its own part (`<prefix><f>p<i>`). */
function framesOf(prefix: string, parts: Record<string, Part>, list: { bits: (Bit | null)[]; ms: number; cue?: string; specks?: Speck[] }[], w: number, h: number): Frame[] {
  return list.map((fr, f) => ({
    ms: fr.ms,
    ...(fr.cue ? { cue: fr.cue } : {}),
    ...(fr.specks ? { specks: fr.specks.filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h) } : {}),
    layers: fr.bits
      .filter((b): b is Bit => b !== null)
      .map((b, i) => {
        const n = `${prefix}${f}p${i}`;
        parts[n] = b.part;
        return L(n, b.at);
      }),
  }));
}
const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Rope along points (2 px: its twist on top, the dark underside), as the barn draws it. */
function rope(c: Cv, pts: readonly Pt[], phase = 0) {
  let s = phase;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 3));
    for (let j = 0; j < n; j++) {
      const x = ax + ((bx - ax) * j) / n;
      const y = ay + ((by - ay) * j) / n;
      s += Math.hypot(bx - ax, by - ay) / n;
      const u = mod(s, 3);
      put(c, Math.floor(x), Math.floor(y), u < 1 ? "r" : u < 2 ? "R" : "t");
      const below = get(c, Math.floor(x), Math.floor(y) + 1);
      if (below !== "t" && below !== "R") put(c, Math.floor(x), Math.floor(y) + 1, u < 1.2 ? "r" : "R");
    }
  }
}
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, tilt = 0, n = 40): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    const t = (tilt * Math.PI) / 180;
    return [cx + x * Math.cos(t) - y * Math.sin(t), cy + x * Math.sin(t) + y * Math.cos(t)] as Pt;
  });

// ================================================================================================================
// 1. The rope: 48 x 28, foot [24, 24]. `fly`: its foot is the loop's middle. `catch`, `cinched`, `free`: its foot is the
//    bale's foot (the table's foot), the loop round the bale 10 px up (the bale is 34 wide).
// ================================================================================================================

const RW = 48;
const RH = 28;
const RF: Pt = [24, 24];
/** Where the line meets the loop (its honda, the knot), per frame of each anim, in the rope's pixels. */
const KNOT: Record<string, Pt[]> = {};
const ropeParts: Record<string, Part> = {};
/** The loop: an ellipse (or its front half round the bale), with its knot; the knot's place returned. */
function loopBit(cx: number, cy: number, rx: number, ry: number, tilt: number, phase: number, knotAt: number, front: boolean): { bit: Bit | null; knot: Pt } {
  const c = cv(RW, RH);
  const pts = front ? arc(cx, cy, rx, ry, -0.15, Math.PI + 0.15, tilt) : arc(cx, cy, rx, ry, 0, 2 * Math.PI, tilt, 56);
  rope(c, pts, phase);
  const [kx, ky] = arc(cx, cy, rx, ry, knotAt, knotAt, tilt, 1)[0]!;
  stampRows(c, Math.round(kx) - 1, Math.round(ky) - 1, ["rR", "Rtr", ".r"]);
  return { bit: cropBit(c), knot: [Math.round(kx), Math.round(ky)] };
}
const ropeAnims: Record<string, Anim> = {};
function ropeAnim(name: string, loop: boolean, list: { cx: number; cy: number; rx: number; ry: number; tilt: number; knotAt: number; front: boolean; ms: number; cue?: string; specks?: Speck[] }[]) {
  const made = list.map((l, i) => ({ ...l, ...loopBit(l.cx, l.cy, l.rx, l.ry, l.tilt, i, l.knotAt, l.front) }));
  KNOT[name] = made.map((m) => m.knot);
  ropeAnims[name] = { loop, frames: framesOf(`rope-${name}-`, ropeParts, made.map((m) => ({ bits: [m.bit], ms: m.ms, cue: m.cue, specks: m.specks })), RW, RH) };
}
// fly: the open loop spinning as it flies (its foot its middle), the knot going round.
ropeAnim("fly", true, [0, 1, 2, 3].map((f) => ({ cx: 24, cy: 24 - 10, rx: 11 + (f % 2), ry: 3.6 + (f % 2) * 0.6, tilt: [-10, -4, 6, -2][f]!, knotAt: (f * Math.PI) / 2 + 0.6, front: false, ms: 60 })));
// catch: dropping over the bale, settling round it, pulled tight (the knot toward his side: our right, low).
ropeAnim("catch", false, [
  { cx: 24, cy: 2, rx: 15, ry: 4, tilt: 0, knotAt: 0.3, front: false, ms: 70 },
  { cx: 24, cy: 8, rx: 18, ry: 4.5, tilt: 0, knotAt: 0.3, front: false, ms: 70 },
  { cx: 24, cy: 14, rx: 19, ry: 4, tilt: 0, knotAt: 0.3, front: true, ms: 90, cue: "catch", specks: [[5, 15, "q"], [43, 14, "q"], [8, 11, "Q"]] },
  { cx: 24, cy: 14, rx: 17.5, ry: 3.2, tilt: 0, knotAt: 0.25, front: true, ms: 120, cue: "snap" },
]);
ropeAnim("cinched", true, [{ cx: 24, cy: 14, rx: 17.5, ry: 3.2, tilt: 0, knotAt: 0.25, front: true, ms: 1000 }]);
// free: shaken loose off the bale and flicked up, gone (code reels the line in after).
ropeAnim("free", false, [
  { cx: 24, cy: 12, rx: 20, ry: 4.5, tilt: 4, knotAt: 0.3, front: false, ms: 80, cue: "flick" },
  { cx: 26, cy: 5, rx: 14, ry: 3.5, tilt: 10, knotAt: 0.3, front: false, ms: 80 },
  { cx: 30, cy: 2, rx: 8, ry: 2, tilt: 14, knotAt: 0.3, front: false, ms: 80 },
]);
export const INTRO_PIG_ROPE: Character = {
  id: "intro-pig-rope",
  name: "Wrangler's lasso (the loop)",
  w: RW,
  h: RH,
  foot: RF,
  palette: PALETTE,
  parts: ropeParts,
  anims: { idle: ropeAnims.cinched!, ...ropeAnims },
};
/** The loop's knot (where the line from his hand ends) on each frame of each rope anim, in the rope's pixels. */
export const INTRO_PIG_ROPE_KNOT: Readonly<Record<string, readonly Pt[]>> = KNOT;
/**
 * The line from his hand to the knot, as code draws it (between PIG_INTRO_HANDS and the knot, at the room's scale): a cord
 * `width` art pixels thick (its outline round it), its middle color with a `dark` tick every `twist` px along it and a
 * `light` one between, so it reads as twisted rope. Taut while hauling; on a throw, sagging into a curve that bows down
 * by about 12% of its length.
 */
export const INTRO_PIG_ROPE_INK = { outline: PALETTE.k!, dark: PALETTE.r!, mid: PALETTE.R!, light: PALETTE.t!, width: 2, twist: 3, sag: 0.12 } as const;

// ================================================================================================================
// 2. The table: PARK_TABLE's geometry (111 x 50, foot [55, 44], the slab's top 27 over the foot): the hay bale alone, the
//    same bale as the barn's `board-stand` (its foot here at the table's). No stools.
// ================================================================================================================

const PX = 37;
const TW = 3 * PX; // 111
const TH = 50;
const TFOOT = TH - 6; // 44
const TCX = Math.floor(TW / 2); // 55
const SEAT_H = Math.round(TOWN_FEEL.sitSeat * PX);

const baleBit = (() => {
  const c = cv(TW, TH);
  standBale(c, TCX);
  return cropBit(c)!;
})();
const tableParts: Record<string, Part> = {};
/** Straw flying off the bale as it slides, `t` frames on, out behind and to the sides. */
function strawSpray(t: number, seed: number): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const g = grain(i, seed, 5);
    const x = TCX + side * (14 + g * 6 + t * (2 + g * 3));
    const y = TFOOT - 2 - g * 10 - t * (1.5 - g) + t * t * 0.4;
    if (t > 1 && i % 3 === 0) continue;
    out.push([Math.round(x), Math.round(y), i % 3 ? "q" : "p"]);
    if (i % 4 === 0) out.push([Math.round(x + side), Math.round(y), "Q"]);
  }
  return out;
}
/** Dust under it as it scrapes along the boards. */
const scrape = (t: number): Speck[] =>
  Array.from({ length: 8 }, (_, i): Speck => [TCX - 18 + i * 5 + (t % 2), TFOOT + (i % 2), i % 3 ? "W" : "j"]);
const LIFT = { slide: [0, 1, 2, 1], land: [0, 0, 0, 0] } as const;
const lifted = (b: Bit, dy: number): Bit => ({ part: b.part, at: [b.at[0], b.at[1] - dy] });
const tableAnims: Record<string, Anim> = {
  idle: { loop: true, frames: framesOf("t-idle-", tableParts, [{ bits: [groundShadow(TCX + 1, TFOOT, 17, 3), baleBit], ms: 1000 }], TW, TH) },
  slide: {
    loop: true,
    frames: framesOf(
      "t-slide-",
      tableParts,
      LIFT.slide.map((dy, f) => ({ bits: [groundShadow(TCX + 1, TFOOT, 17 - dy, 3), lifted(baleBit, dy)], ms: 90, cue: f === 0 ? "slide" : undefined, specks: [...strawSpray(f, 1), ...scrape(f)] })),
      TW,
      TH,
    ),
  },
  land: {
    loop: false,
    frames: framesOf(
      "t-land-",
      tableParts,
      [0, 1, 2, 3].map((f) => ({ bits: [groundShadow(TCX + 1, TFOOT, 17, 3), baleBit], ms: [90, 110, 120, 200][f]!, cue: f === 0 ? "thunk" : undefined, specks: f < 3 ? strawSpray(f + 1, 7) : [] })),
      TW,
      TH,
    ),
  },
};
export const INTRO_PIG_TABLE: Character = {
  id: "intro-pig-table",
  name: "Wrangler's hay-bale table",
  w: TW,
  h: TH,
  foot: [TCX, TFOOT],
  palette: PALETTE,
  parts: tableParts,
  anims: tableAnims,
};
/** How far the slab and the board rise with the bale on each frame of `slide` and `land` (px; draw them that much higher). */
export const INTRO_PIG_TABLE_LIFT: Readonly<Record<string, readonly number[]>> = LIFT;
/** The slab: a plank board (keys "1" top edge to "5" deep, as the renderer reads them); the squares straw cream and barn red. */
export const INTRO_PIG_TABLE_PALETTE: Record<string, string> = {
  k: PALETTE.k!,
  "1": "#e0b070",
  "2": "#c08a50",
  "3": "#9c6a3a",
  "4": "#7a4b28",
  "5": "#52301a",
  L: "#efd9a4",
  D: "#b5523a",
  P: "#fbfbf6",
  Q: "#262321",
};
/** The board in his barn's colors: straw cream and barn red (light enough that the charcoal pieces show on it). */
export const INTRO_PIG_TABLE_INK = {
  light: "#efd9a4",
  lightShade: "#d9bd84",
  lightLine: "#b39060",
  dark: "#b5523a",
  darkShade: "#94402c",
  darkLine: "#6e2c1e",
} as const;

// ================================================================================================================
// 3. The buckets: 40 x 40, foot [20, 35]. A 5-gallon pail (15 px across its mouth, 11 tall), a wire handle with a grip, two
//    ribs under the rim; the rope's end knotted on the handle. Upside down as a stool, its bottom (the seat) at SEAT_H over the
//    foot (the park stools' seat).
// ================================================================================================================

export const INTRO_PIG_BUCKET_SEAT_H = SEAT_H;
const BW = 40;
const BH = 40;
const BF: Pt = [20, 35];
const HALF_MOUTH = 7.6;
const HALF_BASE = 6.1;
const TALL = 10.5; // the pail, mouth to bottom: upside down, its seat (its bottom) is SEAT_H (11) over the foot
type Ink = { body: string; shade: string; deep: string; lit: string };
const INK: Record<"w" | "b", Ink> = {
  w: { body: "(", shade: ")", deep: "[", lit: "(" },
  b: { body: "]", shade: "|", deep: "{", lit: "}" },
};
/**
 * The pail at angle `a` (radians, 0 mouth up; turning clockwise) with its middle at (cx, cy): its body (lit to the top
 * left), the ribs, the end cap that faces up (the open mouth, dark inside, or its bottom), the handle (swung by `swing`),
 * the knot of rope on the handle's grip (or none). Returns the bits and where the grip is.
 */
function pail(ink: Ink, cx: number, cy: number, a: number, swing: number, knot: boolean): { bits: Bit[]; grip: Pt } {
  const body = cv(BW, BH);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  // Local (u across, v along: v < 0 toward the mouth) to the frame.
  const toF = (u: number, v: number): Pt => [cx + u * ca - v * sa, cy + u * sa + v * ca];
  const toL = (x: number, y: number): Pt => [(x - cx) * ca + (y - cy) * sa, -(x - cx) * sa + (y - cy) * ca];
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const [u, v] = toL(x + 0.5, y + 0.5);
      const t = (v + TALL / 2) / TALL; // 0 at the mouth, 1 at the bottom
      if (t < 0 || t > 1) continue;
      const half = HALF_MOUTH + (HALF_BASE - HALF_MOUTH) * t;
      if (Math.abs(u) > half) continue;
      // Lit from the top left in the frame: its normal's direction.
      const nx = (u / half) * ca;
      const ny = (u / half) * sa;
      const l = 0.55 - 0.45 * nx - 0.35 * ny;
      const rib = Math.abs(t - 0.14) < 0.045 || Math.abs(t - 0.26) < 0.045;
      let k = l > 0.78 ? ink.lit : l > 0.42 ? ink.body : l > 0.18 ? ink.shade : ink.deep;
      if (rib) k = l > 0.5 ? ink.shade : ink.deep;
      if (t < 0.06) k = l > 0.4 ? ink.lit : ink.shade; // the rolled rim
      put(body, x, y, k);
    }
  // The end cap facing up the screen: the mouth (dark inside, a rim round it) when the mouth is up, else its bottom.
  const cap = cv(BW, BH);
  const mouthUp = ca > 0;
  const capV = mouthUp ? -TALL / 2 : TALL / 2;
  const capHalf = mouthUp ? HALF_MOUTH : HALF_BASE;
  const depth = Math.abs(ca) * 2.6 + 0.4;
  if (Math.abs(ca) > 0.3) {
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const [u, v] = toL(x + 0.5, y + 0.5);
        const e = (u / capHalf) ** 2 + ((v - capV) / depth) ** 2;
        if (e > 1) continue;
        put(cap, x, y, mouthUp ? (e > 0.55 ? ink.lit : ink === INK.w ? "[" : "{") : e > 0.6 ? ink.shade : ink.lit);
      }
  }
  // The handle: a wire arc from its ears (under the rim, either side) out over the mouth, swung; a black grip in the middle.
  const handle = cv(BW, BH);
  const ear = TALL / 2 - TALL * 0.2;
  // Its ears under the rim, either side; its top (the grip) swung over the mouth (swing 0) or down along its side (swing
  // near a quarter turn: then it lies on the pail's front, a little lower on the screen).
  const [lx, ly] = toF(-HALF_MOUTH + 0.6, -ear);
  const [rx, ry] = toF(HALF_MOUTH - 0.6, -ear);
  const [ax, ay0] = toF(0, -ear - 8 * Math.cos(swing));
  const ay = ay0 + 3.5 * Math.abs(Math.sin(swing));
  const qx = 2 * ax - (lx + rx) / 2;
  const qy = 2 * ay - (ly + ry) / 2;
  let grip: Pt = [Math.round(ax), Math.round(ay)];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = (1 - t) ** 2 * lx + 2 * (1 - t) * t * qx + t * t * rx;
    const y = (1 - t) ** 2 * ly + 2 * (1 - t) * t * qy + t * t * ry;
    const mid = i >= 12 && i <= 18;
    put(handle, x, y, mid ? "<" : i % 4 === 0 ? "n" : "M");
    if (i === 15) grip = [Math.round(x), Math.round(y)];
  }
  const knotC = cv(BW, BH);
  if (knot) stampRows(knotC, grip[0] - 1, grip[1] - 1, ["rRr", "RtR", ".r."]);
  return { bits: [cropBit(body)!, ...(cropBit(cap, false) ? [cropBit(cap, false)!] : []), ...(cropBit(handle, false) ? [cropBit(handle, false)!] : []), ...(cropBit(knotC) ? [cropBit(knotC)!] : [])], grip };
}
/** Its middle when it stands upside down on its spot: its rim on the floor. */
const REST_C: Pt = [BF[0], BF[1] - TALL / 2 - 0.5];
const HANDLE: Record<string, Pt[]> = {};
function bucket(color: "w" | "b", dir: 1 | -1): Character {
  const ink = INK[color];
  const parts: Record<string, Part> = {};
  const id = `intro-pig-bucket-${color}`;
  // tumble: end over end, 8 frames (a turn every 8), rolling toward the middle (dir 1: from our left, turning clockwise).
  const tumble = Array.from({ length: 8 }, (_, f) => {
    const a = dir * ((f * Math.PI) / 4);
    const hop = Math.abs(Math.sin((f * Math.PI) / 4)) * 2.5;
    const p = pail(ink, BF[0], REST_C[1] - 2 - hop, a, Math.sin(f * 1.7) * 0.8, true);
    return { bits: [groundShadow(BF[0], BF[1], 9, 1.6), ...p.bits], ms: 60, grip: p.grip, cue: f % 4 === 0 ? "clatter" : undefined };
  });
  // land: it comes down upside down (mouth to the floor), a bounce, a thunk, it settles; the rope slack, untied.
  const landList = [
    { a: Math.PI * 0.82, dy: -6, sw: 0.6, knot: true, ms: 70, cue: "clatter" },
    { a: Math.PI, dy: 0.5, sw: 1.2, knot: true, ms: 90, cue: "thunk" },
    { a: Math.PI * 1.04, dy: -2, sw: 1.4, knot: false, ms: 80 },
    { a: Math.PI, dy: 0, sw: 1.5, knot: false, ms: 140 },
  ].map((l) => {
    const p = pail(ink, BF[0], REST_C[1] + l.dy, dir * l.a, dir * l.sw, l.knot);
    return { bits: [groundShadow(BF[0], BF[1], 9, 1.6), ...p.bits], ms: l.ms, cue: l.cue, grip: p.grip };
  });
  const stoolP = pail(ink, BF[0], REST_C[1], Math.PI, dir * 1.5, false);
  HANDLE[`${color}:tumble`] = tumble.map((t) => t.grip);
  HANDLE[`${color}:land`] = landList.map((t) => t.grip);
  return {
    id,
    name: color === "w" ? "Wrangler's white bucket" : "Wrangler's black bucket",
    w: BW,
    h: BH,
    foot: BF,
    palette: PALETTE,
    parts,
    anims: {
      idle: { loop: true, frames: framesOf("idle-", parts, [{ bits: [groundShadow(BF[0], BF[1], 9, 1.6), ...stoolP.bits], ms: 1000 }], BW, BH) },
      stool: { loop: true, frames: framesOf("stool-", parts, [{ bits: [groundShadow(BF[0], BF[1], 9, 1.6), ...stoolP.bits], ms: 1000 }], BW, BH) },
      tumble: { loop: true, frames: framesOf("tumble-", parts, tumble, BW, BH) },
      land: { loop: false, frames: framesOf("land-", parts, landList, BW, BH) },
    },
  };
}
/** The black bucket: comes tumbling in from our left (it's the boss's stool, on his side). */
export const INTRO_PIG_BUCKET_B = bucket("b", 1);
/** The white bucket: comes tumbling in from our right (your stool). */
export const INTRO_PIG_BUCKET_W = bucket("w", -1);
/** Where the rope's end is knotted (the handle's grip) on each frame of `tumble` and `land`, by `<w|b>:<anim>`, in the bucket's pixels. */
export const INTRO_PIG_BUCKET_HANDLE: Readonly<Record<string, readonly Pt[]>> = HANDLE;

// ================================================================================================================
// 4. The wipe: STORM (128 x 128, tiles both ways) and FRONT (48 x 128, tiles top to bottom), 6 x 70 ms. As Alfil's
//    sandstorm: three layers race right, each a whole number of pixels a frame, a whole repeat in 6 frames.
//    - back (32 wide): a dusty sunset in bands, streaks of blown dust;
//    - mid (64 wide): dust puffs and sparkles;
//    - front (128 wide): tumbleweeds rolling, spurs spinning, toy cap guns popping their BANG! flags.
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
const pset = (p: Pat, x: number, y: number, k: string) => (p[mod(Math.round(y), ST)]![mod(Math.round(x), p[0]!.length)] = k);
const pget = (p: Pat, x: number, y: number) => p[mod(y, ST)]![mod(x, p[0]!.length)];
const bay = (x: number, y: number) => ([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][mod(y, 4) * 4 + mod(x, 4)]! + 0.5) / 16;

/** The sunset: bands top to bottom (gold, orange, salmon, rose, plum, and round again), dithered where they meet, dust streaks. */
const BANDS = "abdHIHdb";
const backPat: Pat = pat(32);
for (let y = 0; y < ST; y++)
  for (let x = 0; x < 32; x++) {
    const t = (y / ST) * BANDS.length;
    const i = Math.floor(t);
    const fr = t - i;
    let k = fr > 0.7 && (fr - 0.7) / 0.3 > bay(x, y) ? BANDS[(i + 1) % BANDS.length]! : BANDS[i]!;
    // Streaks of blown dust: thin pale dashes.
    if ((y % 11 === 4 && mod(x - y * 3, 32) < 9) || (y % 17 === 9 && mod(x + y, 32) < 5)) k = y % 2 ? "j" : "W";
    backPat[y]![x] = k;
  }

/** Dust puffs (round, pale, a shade under) and a few twinkles. */
const midPat: Pat = pat(64);
const PUFFS = [
  { x: 10, y: 18, r: 7 },
  { x: 18, y: 22, r: 5 },
  { x: 44, y: 58, r: 8 },
  { x: 54, y: 63, r: 5 },
  { x: 26, y: 98, r: 6 },
  { x: 34, y: 101, r: 4.5 },
];
for (const p of PUFFS)
  for (let y = -p.r - 1; y <= p.r + 1; y++)
    for (let x = -p.r - 6; x <= p.r + 1; x++) {
      const d = Math.hypot(x, y * 1.2);
      if (d <= p.r) pset(midPat, p.x + x, p.y + y, d > p.r - 1.2 && y > 0 ? "=" : x + y < -p.r * 0.4 ? "j" : "W");
      else if (x < -p.r && Math.abs(y) < p.r * 0.5 && d <= p.r + 6 && mod(x + y, 3) === 0) pset(midPat, p.x + x, p.y + y, "W"); // its smear behind
    }
for (const [x, y] of [[40, 12], [6, 76], [58, 110], [30, 40]] as const) {
  pset(midPat, x, y, "^");
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) pset(midPat, x + dx, y + dy, "a");
}

/** A tumbleweed: a ball of tangled twigs (rings of scribble), turned `a`, radius R. */
function tumbleweed(p: Pat, cx: number, cy: number, R: number, a: number) {
  // Its smear of dust behind it.
  for (let dy = -R + 2; dy <= R - 2; dy += 2) for (let d = 1; d <= 8; d++) if (!pget(p, Math.round(cx - R - d), Math.round(cy + dy))) pset(p, cx - R - d, cy + dy, d < 4 ? "W" : "j");
  for (let y = -R - 1; y <= R + 1; y++)
    for (let x = -R - 1; x <= R + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > R + 0.4) continue;
      // Rotated coordinates: twigs are arcs (sines of the angle) that turn with it.
      const th = Math.atan2(y, x) - a;
      const twig = Math.abs(Math.sin(th * 3 + d * 0.9)) < 0.28 || Math.abs(Math.sin(th * 5 - d * 0.7)) < 0.2 || d > R - 0.9;
      if (!twig) continue;
      const lit = x + y < -R * 0.3;
      pset(p, cx + x, cy + y, d > R - 0.9 ? (lit ? "5" : "3") : lit ? "6" : (x + y) % 3 === 0 ? "3" : "4");
    }
}
/** A spur's rowel: a six-pointed gold star round a hub, turned `a`, on its little shank. */
function spur(p: Pat, cx: number, cy: number, R: number, a: number) {
  for (let y = -R - 1; y <= R + 1; y++)
    for (let x = -R - 1; x <= R + 1; x++) {
      const d = Math.hypot(x, y);
      const th = Math.atan2(y, x) - a;
      const point = Math.abs(Math.cos(th * 3)) ** 3; // six points
      const rr = R * (0.35 + 0.65 * point);
      if (d > rr + 0.3) continue;
      if (d < 1.6) {
        pset(p, cx + x, cy + y, "m");
        continue;
      }
      pset(p, cx + x, cy + y, d > rr - 0.8 ? "O" : x + y < 0 ? "y" : "Y");
    }
  // The shank and the heel band it rides on (iron), out to its left.
  for (let i = 2; i <= R + 5; i++) pset(p, cx - i, cy - Math.floor(i / 4), i > R + 2 ? "n" : "M");
  // A glint.
  pset(p, cx - 2, cy - R, "L");
}
/** BANG! in a 3 x 5 pixel font. */
const GLYPH: Record<string, readonly string[]> = {
  B: ["##.", "#.#", "##.", "#.#", "##."],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  "!": ["#", "#", "#", ".", "#"],
};
/**
 * A toy cap gun (a chunky plastic six-shooter: red or blue body, a fat orange safety tip on its barrel, a cream grip with a
 * star), facing right, its muzzle at (mx, my). `pop` 0..5: 0 still, 1 the cap's puff, 2 to 4 the BANG! flag out on its
 * stick (fully at 3), 5 drooping back.
 */
function capGun(p: Pat, mx: number, my: number, blue: boolean, pop: number) {
  const body = blue ? "%" : "#";
  const shade = blue ? "&" : "$";
  const G = [
    "....kkkkkkkkkkkkkkkkkk**",
    "...kBBBBBBBBBBBBBBBBBB**",
    "..kBBBBSSSSSSSSSSSSSSS**",
    ".kBBBccccBSSSSSSSSSSSSk.",
    ".kBBcccccBkkkkkkkkkkkk..",
    ".kBBBcccBBk.............",
    "..kSBBBBSk..............",
    "...kCKKKk...............",
    "...kCKyKk...............",
    "..kCKKKKk...............",
    "..kCCKKk................",
    "..kCCKk.................",
    "..kkkk..................",
  ];
  const x0 = mx - 23;
  const y0 = my - 1;
  G.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === ".") return;
      const k = ch === "B" ? body : ch === "S" ? shade : ch === "c" ? "M" : ch === "K" ? "K" : ch === "C" ? "C" : ch === "y" ? "Y" : ch === "*" ? "*" : "k";
      pset(p, x0 + i, y0 + j, k);
    }),
  );
  // The cylinder's chambers, and the trigger guard.
  pset(p, x0 + 6, y0 + 4, "n");
  pset(p, x0 + 8, y0 + 4, "n");
  for (const [dx, dy] of [[9, 5], [10, 6], [11, 6], [12, 5]] as const) pset(p, x0 + dx, y0 + dy, "k");
  if (pop === 1) {
    // The cap's puff at the muzzle.
    for (const [dx, dy, k] of [[2, 0, "^"], [3, -1, "^"], [3, 1, "~"], [4, 0, "^"], [5, -2, "~"], [5, 1, "~"], [6, 0, "^"], [1, -1, "~"]] as const) pset(p, mx + dx, my + dy, k);
    return;
  }
  if (pop >= 2 && pop <= 5) {
    // The stick out of the barrel, the flag on it (cream, a red edge, BANG! in red).
    const ext = pop === 2 ? 5 : pop === 5 ? 4 : 8;
    for (let i = 1; i <= ext; i++) pset(p, mx + i, my + 1, "M");
    const fx = mx + ext + 1;
    const fy = my - (pop === 5 ? 1 : 4);
    const fw = pop === 2 ? 14 : 24;
    const fh = pop === 2 ? 7 : 10;
    for (let j = 0; j < fh; j++)
      for (let i = 0; i < fw; i++) {
        const droop = pop === 5 ? Math.floor(i / 5) : 0;
        const edge = i === 0 || j === 0 || i === fw - 1 || j === fh - 1;
        pset(p, fx + i, fy + j + droop, edge ? "k" : j === 1 ? "s" : "K");
      }
    if (pop !== 2) {
      let cx = fx + 2;
      for (const ch of "BANG!") {
        const g = GLYPH[ch]!;
        g.forEach((row, j) => [...row].forEach((c, i) => c === "#" && pset(p, cx + i, fy + 3 + j + (pop === 5 ? Math.floor((cx + i - fx) / 5) : 0), "s")));
        cx += g[0]!.length + 1;
      }
    } else {
      // Unfurling: a crumple of cream, a streak of red.
      for (let i = 2; i < fw - 2; i += 3) pset(p, fx + i, fy + 3, "s");
    }
  }
}
const frontPats: Pat[] = [0, 1, 2, 3, 4, 5].map((f) => {
  const p = pat(ST);
  // Speed streaks of dust.
  for (let i = 0; i < 14; i++) {
    const ex = Math.floor(grain(i, 1, 51) * ST);
    const ey = Math.floor(grain(i, 2, 51) * ST);
    const len = 6 + Math.floor(grain(i, 3, 51) * 18);
    for (let x = 0; x < len; x++) pset(p, ex - x, ey, x < 3 ? "j" : x < len * 0.6 ? "W" : "=");
  }
  // Two tumbleweeds rolling (a sixth of a turn a frame, against their own pattern's three-fold twigs: a seamless loop).
  tumbleweed(p, 30, 100, 11, (f * Math.PI) / 3);
  tumbleweed(p, 98, 34, 8, (f * Math.PI) / 3 + 1);
  // Two spurs spinning (a sixth of their points a frame).
  spur(p, 82, 92, 7, (f * Math.PI) / 9);
  spur(p, 22, 22, 6, -(f * Math.PI) / 9 + 0.4);
  // Two cap guns, their BANG! flags popping out of step.
  capGun(p, 70, 58, false, f);
  capGun(p, 118, 112, true, (f + 3) % 6);
  return p;
});

const stormKey = (x: number, y: number, f: number): string =>
  pget(frontPats[f]!, x - SHIFT.front[f]!, y) ?? pget(midPat, x - SHIFT.mid[f]!, y) ?? pget(backPat, x - SHIFT.back[f]!, y)!;
const full = (fn: (x: number, y: number) => Key, w: number, h: number): Part => ({
  grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")),
  outline: false,
});
const stormParts: Record<string, Part> = {};
const stormFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), ST, ST);
  return { ms: 70, layers: [L(`s${f}`, [0, 0])], ...(f === 0 ? { cue: "jingle" } : f === 3 ? { cue: "pop" } : {}) };
});
export const INTRO_PIG_STORM: Character = {
  id: "intro-pig-storm",
  name: "Wrangler's wipe (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};

/** The leading edge: the wipe on its left (so it meets STORM with no seam), a billowing dust cloud's lobes, a lasso's rope
 *  along its rim, and a few spur sparks and dust puffs flying out ahead. */
const LOBES = [
  ...Array.from({ length: 7 }, (_, i) => ({ y: (i * 128) / 7 + grain(i, 1, 61) * 5, x: 13 + grain(i, 2, 61) * 4, r: 9 + grain(i, 3, 61) * 5, p: grain(i, 4, 61) * 6.28 })),
  ...Array.from({ length: 7 }, (_, i) => ({ y: ((i + 0.5) * 128) / 7 + grain(i, 5, 61) * 4, x: 17 + grain(i, 6, 61) * 3, r: 4 + grain(i, 7, 61) * 4, p: grain(i, 8, 61) * 6.28 })),
];
function outside(x: number, y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  const body = 13 + 2 * Math.sin((2 * Math.PI * 2 * y) / ST + ph);
  let out = x < body ? 0 : x - body;
  for (const l of LOBES) {
    const cy = l.y + 2 * Math.sin(ph + l.p);
    const cx = l.x + 2 * Math.cos(ph + l.p);
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
    // The rope round its rim: twisted (dark, mid, light along it), then a dusty band inside it.
    if (o(1, 0) || o(0, -1) || o(0, 1)) return "k";
    if (o(2, 0) || o(0, -2) || o(0, 2)) return mod(y + f * 2, 3) === 0 ? "r" : mod(y + f * 2, 3) === 1 ? "R" : "t";
    if (o(3, 0) || o(0, -3) || o(0, 3)) return "r";
    if (o(5, 0)) return "W";
    return stormKey(x, y, f);
  }
  if (out < 2) return "j";
  if (out < 3.5) return mod(x + y, 2) ? "W" : null;
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = [0, 1, 2, 3, 4, 5].map((f) => {
  frontParts[`e${f}`] = full((x, y) => frontKey(x, y, f), FW, ST);
  // Puffs of dust and spur sparks flying ahead: each runs 3 px a frame over an 18 px stretch, round in 6 frames.
  const specks: Speck[] = [];
  for (let i = 0; i < 12; i++) {
    const y = Math.floor((i * 128) / 12 + grain(i, 1, 62) * 5);
    const x = 27 + mod(Math.floor(grain(i, 2, 62) * 18) + 3 * f, 18);
    if (i % 3 === 0) {
      for (const [a, b, k] of [[0, -1, "L"], [-1, 0, "y"], [1, 0, "y"], [0, 1, "Y"], [0, 0, "L"]] as const) specks.push([x + a, y + b, k]);
    } else {
      for (const [a, b, k] of [[0, 0, "j"], [1, 0, "j"], [0, 1, "W"], [1, 1, "W"], [-1, 0, "W"], [-2, 1, "="]] as const) specks.push([x + a, y + b, k]);
    }
  }
  return { ms: 70, layers: [L(`e${f}`, [0, 0])], specks: specks.filter(([x, y]) => x >= 0 && y >= 0 && x < FW && y < ST) };
});
export const INTRO_PIG_FRONT: Character = {
  id: "intro-pig-front",
  name: "Wrangler's wipe (leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

void paint;
