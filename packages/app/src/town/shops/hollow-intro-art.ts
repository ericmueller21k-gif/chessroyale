/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-intro-hollow/house-intro-hollow.ts at 3238dbf4, Nov 3; Eric
 * approved the intro Nov 3 with changes: docs/decisions/2026-11-03-hollow-intro.md), its imports moved (the cave is shops/hollow-art.ts),
 * with his own moves (characters/hollow-intro.ts) re-exported at the end. Played by shops/intro.ts and ShopRoom.tsx
 * (docs/areas/town-square.md, "Challenging a boss"). The art's own header follows.
 *
 * Hollow's battle intro (house-intro-hollow): the props code plays in his cave (house-shop-hollow) when you challenge him.
 * Eric, Nov 3: "The darkness ball in his belly/abdomen powers up: material builds up around it, spins, and it expands a
 * little. It sucks in the light: the lanterns go out one by one, the bulb string's lights are drawn in toward him, light
 * from everything around, even from your own chest piece. Everything goes black. It does NOT all switch back on: darkness
 * everywhere, and a dim, steady light around you, the board and him (not flickering), enough to see everything."
 * His moves are BOSS_HOLLOW_INTRO (out/boss-hollow/boss-hollow.ts). Drawn by hand (Nov 3), not by the runner.
 *
 * Every piece here stands in for a cave piece of the same name (SHOP_HOLLOW_PIECES), with its size, foot and frame timing,
 * so code swaps the Character at that placement and keeps drawing it as the room does:
 * 1. INTRO_HOLLOW_LANTERN_OUT, INTRO_HOLLOW_LANTERN_B_OUT (for `lantern`, `lantern-b`): `gutter<k>` (the flame flares,
 *    gutters, sputters and goes out, an ember, then a thin wisp of smoke: 6 frames of 170 ms, in step with the lantern's
 *    own sway from its sway frame k, cues `gutter` f0 and `snuff` f3), then `idle` (dark, swaying as before).
 *    INTRO_HOLLOW_LANTERN_GLOW: its light's strength (SHOP_HOLLOW_LIGHTS halo and SHOP_HOLLOW_POOLS pool) on each frame.
 * 2. INTRO_HOLLOW_BULB_PIECES (for `bulbs`, `bulbs-b`, `bulbs-c`, `bulbs-step`, `backdrop`, `sled`): `l<n>` (its n
 *    left-most bulbs dark, as drawn: west-most unless the placement is flipped) and `r<n>` (its n right-most dark); `l0`
 *    is the cave's own. The backdrop's candle goes out with its first bulb. INTRO_HOLLOW_BULB_RUN: every bulb in the order
 *    the dark runs along the string (west to east, the counter to the tree), each with its placement and its pixel.
 * 3. INTRO_HOLLOW_SHOWPIECE_OUT (for `showpiece`, the tree): `drain` (its lights go out from the bottom up the string, the
 *    star last, 10 x 110 ms, cues `drain` f0 and `star` f8), then `idle` (dark).
 * 4. INTRO_HOLLOW_MOTE: the light flying from every source into the ball (sizes and colors; `pawn` paler) and `sip` (one
 *    landing on the ball's rim). INTRO_HOLLOW_MOTE_GLOW: each one's color for its trail and glow.
 * 5. INTRO_HOLLOW_DARK, INTRO_HOLLOW_DIMPOOL: the blackout's tone and the room's darkening step by step; the dim steady
 *    pool round the board and the two of you (color, size, falloff).
 */
import type { Anim, Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import { frameKeys } from "../../characters/sprite.ts";
import { SHOP_HOLLOW_LIGHTS, SHOP_HOLLOW_LAYOUT, SHOP_HOLLOW_PIECES } from "./hollow-art.ts";

type Pt = readonly [number, number];

/** The cave's palette (every cave piece shares it), and the new keys: dark glass, an ember, smoke. */
const CAVE = SHOP_HOLLOW_PIECES["lantern"]!.palette;
const PALETTE: Record<string, string> = {
  ...CAVE,
  p: "#a49eb4cc", // smoke: thick, thin, last of it (see-through)
  q: "#7a748caa",
  A: "#77728a66",
  K: "#ff6a2a", // the ember on the wick
};

// ==== 1. The lanterns going out. The same lantern as the cave's (house-shop-hollow `lanternDef`: its chain, its iron
// cage, its glass), swaying the same way (8 frames, 170 ms), with its glass in each state of going out.

const T = 37;
const WALL_H = 130;
/** The lantern's ring this far down its picture (house-shop-hollow LT_TOP). */
const LT_TOP = 50;
const LANTERN_N = 8;
const LANTERN_MS = 170;
const sway = (f: number, phase: number) => 2.6 * Math.sin((2 * Math.PI * f) / LANTERN_N + phase);
/** The cage round the glass, as the cave draws it; rows 6 to 12 are the glass (by state, below). */
const CAGE_TOP = [".....2.2.....", ".....222.....", "....22322....", "...2233322...", "..222222222..", ".33333333333."];
const CAGE_BOTTOM = [".33333333333.", "..222222222..", "...2211122...", ".....222.....", "......2......"];
type Glass = "lit" | "lit1" | "lit2" | "flare" | "low" | "sputter" | "ember" | "dying" | "dark";
const GLASS: Record<Glass, readonly string[]> = {
  // The cave's own three flicker frames (lanternDef's fl 0, 1, 2).
  lit: ["..1LLLLLLL1..", "..1LLLyLLl1..", "..1LLyYyLl1..", "..1LLyYylm1..", "..1LlYYYlm1..", "..1llYYlmm1..", "..1lllllmm1.."],
  lit1: [],
  lit2: [],
  // Pulled hard: the flame leaps up white-hot, the glass all bright.
  flare: ["..1LLLyLLL1..", "..1LLyYyLL1..", "..1LyYYYyl1..", "..1LyYYYyl1..", "..1LlyYyll1..", "..1llYYllm1..", "..1lllllmm1.."],
  // Drawn down: a small flame, the glass dimming to amber.
  low: ["..1lllllmm1..", "..1lllllmm1..", "..1llllmmm1..", "..1llllmmm1..", "..1llyYlmm1..", "..1lmYYmmm1..", "..1mmmmmmm1.."],
  // A last sputter at the wick, the glass all but dark.
  sputter: ["..1cccccdd1..", "..1chcccdd1..", "..1chccddn1..", "..1cccccdn1..", "..1cccmcdn1..", "..1ccmYmdn1..", "..1cmmmmdn1.."],
  // Out: dark glass, the wick an ember (then a dull one).
  ember: ["..1cccccdd1..", "..1chcccdd1..", "..1chccddn1..", "..1ccccddn1..", "..1ccccddn1..", "..1cccKcdn1..", "..1cdddddn1.."],
  dying: ["..1cccccdd1..", "..1chcccdd1..", "..1chccddn1..", "..1ccccddn1..", "..1ccccddn1..", "..1cccRcdn1..", "..1cdddddn1.."],
  // Unlit: dark smoky glass, a cool sheen down its lit side.
  dark: ["..1cccccdd1..", "..1chcccdd1..", "..1chccddn1..", "..1ccccddn1..", "..1ccccddn1..", "..1ccc2cdn1..", "..1cdddddn1.."],
};
// (The cave's flicker: on its frame 1 of every 3 the flame's y and Y swap; on frame 2 its y goes L.)
GLASS.lit1 = GLASS.lit.map((r) => r.replace(/[yY]/g, (c) => (c === "y" ? "Y" : "y")));
GLASS.lit2 = GLASS.lit.map((r) => r.replace(/y/g, "L"));

/** Smoke over the lantern's cap (offsets from its ring, `dx` to our right, `dy` up), by frame after it goes out. */
const SMOKE: readonly (readonly (readonly [number, number, string])[])[] = [
  [],
  // A puff as it goes out, then a wisp curling up, then its last thin thread, drifting off.
  [[0, 1, "p"], [1, 1, "p"], [-1, 2, "p"], [0, 2, "p"], [1, 2, "q"], [0, 3, "q"], [-1, 3, "q"], [1, 3, "A"]],
  [[0, 2, "p"], [1, 2, "p"], [1, 3, "p"], [2, 4, "p"], [1, 5, "p"], [2, 5, "q"], [0, 6, "q"], [1, 6, "q"], [-1, 7, "q"], [0, 7, "q"], [-1, 8, "q"], [-1, 9, "A"], [0, 10, "A"], [1, 10, "A"], [2, 11, "A"]],
  [[2, 5, "q"], [2, 6, "q"], [1, 7, "q"], [1, 8, "q"], [0, 9, "q"], [-1, 10, "A"], [-1, 11, "A"], [0, 12, "A"], [1, 13, "A"], [2, 14, "A"], [2, 15, "A"], [1, 16, "A"]],
];

/** One frame of the lantern: sway frame `f` (with its `phase`), its glass, smoke `smoke` frames after it went out. */
function lanternFrame(f: number, phase: number, glass: Glass, smoke = 0): { part: Part; at: Pt } {
  const sw = sway(f, phase);
  const cv: string[][] = Array.from({ length: WALL_H }, () => Array<string>(T).fill("."));
  const put = (x: number, y: number, k: string) => {
    const X = Math.round(x);
    const Y = Math.round(y);
    if (X >= 0 && Y >= 0 && X < T && Y < WALL_H) cv[Y]![X] = k;
  };
  for (let y = 0; y < LT_TOP; y++) put(18 + (sw * y) / LT_TOP, y, y % 3 === 0 ? "3" : "2");
  const lx = Math.round(18 + sw);
  [...CAGE_TOP, ...GLASS[glass], ...CAGE_BOTTOM].forEach((r, j) => [...r].forEach((k, i) => k !== "." && put(lx - 6 + i, LT_TOP + 1 + j, k)));
  put(lx, LT_TOP, "3");
  // The smoke curls up from the cap, along the chain (drawn over it: it's in front).
  for (const [dx, dy, k] of SMOKE[smoke] ?? []) put(lx + dx + 2, LT_TOP - dy, k);
  // Cropped to what's drawn, as the cave's pieces are.
  let x0 = T, y0 = WALL_H, x1 = -1, y1 = -1;
  cv.forEach((row, y) => row.forEach((k, x) => k !== "." && ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)))));
  return { part: { grid: cv.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")), outline: false }, at: [x0, y0] };
}

/** The lantern's going out, frame by frame: glass and smoke. */
const GUTTER: readonly (readonly [Glass, number])[] = [["flare", 0], ["low", 0], ["sputter", 0], ["ember", 1], ["dying", 2], ["dark", 3]];
/** The light's strength on each `gutter` frame (times the cave's own: SHOP_HOLLOW_LIGHTS' halo, SHOP_HOLLOW_POOLS' pool), then 0. */
export const INTRO_HOLLOW_LANTERN_GLOW: readonly number[] = [1.3, 0.75, 0.35, 0.08, 0, 0];

function lanternOut(name: "lantern" | "lantern-b", phase: number): Character {
  const parts: Record<string, Part> = {};
  const fr = (ms: number, f: number, glass: Glass, smoke: number, cue?: string): Frame => {
    const b = lanternFrame(f, phase, glass, smoke);
    const n = `${glass}:${f}:${smoke}`;
    parts[n] = b.part;
    return { ms, layers: [{ part: n, x: b.at[0], y: b.at[1] }], ...(cue ? { cue } : {}) };
  };
  const anims: Record<string, Anim> = {
    // Its own (lit) loop, as the cave draws it: for checking it lines up, and for code that wants one name for both.
    lit: { loop: true, frames: Array.from({ length: LANTERN_N }, (_, f) => fr(LANTERN_MS, f, (["lit", "lit1", "lit2"] as const)[f % 3]!, 0)) },
    idle: { loop: true, frames: Array.from({ length: LANTERN_N }, (_, f) => fr(LANTERN_MS, f, "dark", 0)) },
  };
  for (let k = 0; k < LANTERN_N; k++)
    anims[`gutter${k}`] = { loop: false, frames: GUTTER.map(([g, s], i) => fr(LANTERN_MS, (k + i) % LANTERN_N, g, s, i === 0 ? "gutter" : i === 3 ? "snuff" : undefined)) };
  return { id: `intro-hollow-${name}-out`, name: `Hollow's intro: ${name} going out`, w: T, h: WALL_H, foot: [18, WALL_H - 1], palette: PALETTE, parts, anims };
}
/** For `lantern` (sway phase 0) and `lantern-b` (2.4): start `gutter<k>` on the lantern's sway frame k (floor(t / 170) % 8). */
export const INTRO_HOLLOW_LANTERN_OUT = lanternOut("lantern", 0);
export const INTRO_HOLLOW_LANTERN_B_OUT = lanternOut("lantern-b", 2.4);

// ==== 2. The bulbs going dark: each cave piece with bulbs, its bulbs found in its own light's box (SHOP_HOLLOW_LIGHTS),
// each bulb a connected run of bulb pixels; a dark bulb is drawn as the cave draws a burnt-out one (Ç, its glint 3).

const LIT = "ÀÁÂÃÄÅÆ";
const BULB_PX = LIT + "Ç";
interface Found {
  /** Each bulb's pixels (piece pixels), left to right by its middle. */
  bulbs: Pt[][];
  /** Each bulb's middle. */
  mids: Pt[];
}
function findBulbs(ch: Character, box: { x: number; y: number; w: number; h: number }): Found {
  const W = ch.w, H = ch.h;
  const on = new Uint8Array(W * H);
  for (const f of ch.anims.idle!.frames) {
    const k = frameKeys(ch, f);
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(H, box.y + box.h); y++)
      for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(W, box.x + box.w); x++) if (BULB_PX.includes(k[y]![x] ?? ".")) on[y * W + x] = 1;
  }
  const seen = new Uint8Array(W * H);
  const bulbs: Pt[][] = [];
  for (let i = 0; i < W * H; i++) {
    if (!on[i] || seen[i]) continue;
    const comp: Pt[] = [];
    const st = [i];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop()!;
      const x = j % W, y = (j - x) / W;
      comp.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const n = Y * W + X;
        if (on[n] && !seen[n]) (seen[n] = 1), st.push(n);
      }
    }
    if (comp.length >= 3) bulbs.push(comp);
  }
  const mid = (c: Pt[]): Pt => [c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length];
  bulbs.sort((a, b) => mid(a)[0] - mid(b)[0]);
  return { bulbs, mids: bulbs.map(mid) };
}

/**
 * A piece's frames with some bulbs dark (and, for the backdrop, its candle out): each layer whose pixels change gets a
 * recolored copy of its part (named `<part>~<tag>`); the rest are the cave's own parts.
 */
function recolor(ch: Character, frame: Frame, dark: ReadonlySet<string>, tag: string, parts: Record<string, Part>, also?: (x: number, y: number, k: string) => string | null): Frame {
  const layers: Layer[] = frame.layers.map((l) => {
    const src = ch.parts[l.part]!;
    let changed = false;
    const grid = src.grid.map((row, y) =>
      [...row]
        .map((k, x) => {
          const X = l.x + x, Y = l.y + y;
          let out = k;
          if (BULB_PX.includes(k) && dark.has(`${X},${Y}`)) out = k === "Æ" ? "3" : "Ç";
          const a = also?.(X, Y, out);
          if (a !== null && a !== undefined) out = a;
          if (out !== k) changed = true;
          return out;
        })
        .join(""),
    );
    parts[l.part] ??= src;
    if (!changed) return l;
    const n = `${l.part}~${tag}`;
    parts[n] ??= { ...src, grid };
    return { ...l, part: n };
  });
  return { ...frame, layers };
}

/** The backdrop's candle (in its niche): its flame's keys, in its light's box. */
const CANDLE = SHOP_HOLLOW_LIGHTS.find((l) => l.piece === "backdrop" && l.keys === "yYf")!;
const candleOut = (x: number, y: number, k: string): string | null => {
  if (x < CANDLE.x || x >= CANDLE.x + CANDLE.w || y < CANDLE.y || y >= CANDLE.y + CANDLE.h || !"yYf".includes(k)) return null;
  // The flame gone into the niche's dark, its wick left (its lowest flame pixel).
  return y === CANDLE.y + 3 ? "2" : "n";
};

interface BulbPiece {
  ch: Character;
  /** Its bulbs' middles (piece pixels, as drawn), left to right. */
  mids: readonly Pt[];
}
function bulbPiece(name: string): BulbPiece {
  const src = SHOP_HOLLOW_PIECES[name]!;
  const box = SHOP_HOLLOW_LIGHTS.find((l) => l.piece === name && l.keys === "ÀÆ")!;
  const found = findBulbs(src, box);
  const parts: Record<string, Part> = {};
  const anims: Record<string, Anim> = {};
  const n = found.bulbs.length;
  for (const side of ["l", "r"] as const)
    for (let k = 0; k <= n; k++) {
      const idx = side === "l" ? found.bulbs.slice(0, k) : found.bulbs.slice(n - k);
      const dark = new Set(idx.flat().map(([x, y]) => `${x},${y}`));
      const tag = `${side}${k}`;
      const candle = name === "backdrop" && k > 0 ? candleOut : undefined;
      anims[tag] = { loop: true, frames: src.anims.idle!.frames.map((f) => recolor(src, f, dark, tag + (candle ? "c" : ""), parts, candle)) };
    }
  return { ch: { ...src, id: `intro-hollow-${name}-out`, name: `Hollow's intro: ${name} going dark`, parts, anims }, mids: found.mids };
}
const BULB_NAMES = ["bulbs", "bulbs-b", "bulbs-c", "bulbs-step", "backdrop", "sled"] as const;
const BP = Object.fromEntries(BULB_NAMES.map((n) => [n, bulbPiece(n)])) as Record<(typeof BULB_NAMES)[number], BulbPiece>;
/** Each cave piece with bulbs, going dark: anims `l<n>` (its n left-most bulbs dark, as drawn) and `r<n>`; `l0` is the cave's own. */
export const INTRO_HOLLOW_BULB_PIECES: Readonly<Record<string, Character>> = Object.fromEntries(BULB_NAMES.map((n) => [n, BP[n].ch]));

/**
 * Every bulb on the string, in the order the dark runs along it: from the west corner behind the counter, across the
 * backdrop and round the curve to the tree (the cave's BULB_RUN), the sled's bulbs as it passes (12, 4). Each: its
 * placement (col, row, piece, flip), which of that placement's bulbs it is in the run (`n`: so its anim is `l<n + 1>`,
 * or `r<n + 1>` for a flipped placement), and its middle in the piece's own pixels (as drawn, before any flip).
 */
export interface RunBulb {
  col: number;
  row: number;
  piece: string;
  flip: boolean;
  n: number;
  at: Pt;
}
export const INTRO_HOLLOW_BULB_RUN: readonly RunBulb[] = (() => {
  const out: RunBulb[] = [];
  const places = SHOP_HOLLOW_LAYOUT.filter((p) => (BULB_NAMES as readonly string[]).includes(p.name));
  // West to east: by the placement's middle column, the sled with the string over it.
  const key = (p: (typeof places)[number]) => (p.name === "sled" ? 12.6 : p.name === "backdrop" ? 5.5 : p.col);
  for (const p of [...places].sort((a, b) => key(a) - key(b))) {
    const mids = BP[p.name as (typeof BULB_NAMES)[number]].mids;
    const order = p.flip ? [...mids.keys()].reverse() : [...mids.keys()];
    order.forEach((i, n) => out.push({ col: p.col, row: p.row, piece: p.name, flip: !!p.flip, n, at: [Math.round(mids[i]![0] * 10) / 10, Math.round(mids[i]![1] * 10) / 10] }));
  }
  return out;
})();

// ==== 3. The tree's lights going out, from the bottom up the string, the star last.

const SP = SHOP_HOLLOW_PIECES["showpiece"]!;
const STAR_SPOT = SHOP_HOLLOW_LIGHTS.find((l) => l.piece === "showpiece" && l.keys === "tTuÆ")!;
const STAR_C: Pt = [STAR_SPOT.x + STAR_SPOT.w / 2, STAR_SPOT.y + STAR_SPOT.h / 2];
export const INTRO_HOLLOW_SHOWPIECE_OUT: Character = (() => {
  const box = SHOP_HOLLOW_LIGHTS.find((l) => l.piece === "showpiece" && l.keys === "ÀÆ")!;
  const found = findBulbs(SP, box);
  // Bottom first (the string winds up from the bottom left).
  const order = [...found.bulbs.keys()].sort((a, b) => found.mids[b]![1] - found.mids[a]![1]);
  const parts: Record<string, Part> = {};
  const frames = SP.anims.idle!.frames;
  const n = order.length;
  /** The star: `0` lit, `1` dimming (rays and sparkles gone), `2` dark brass. */
  const star = (lvl: number) => (x: number, y: number, k: string): string | null => {
    if (lvl === 0 || Math.hypot(x + 0.5 - STAR_C[0], y + 0.5 - STAR_C[1]) > 16) return null;
    if (lvl === 1) return k === "u" || k === "Æ" ? "T" : null;
    return k === "u" || k === "T" ? "0" : k === "t" ? "9" : k === "Æ" ? "." : null;
  };
  const sparkLayer = (f: Frame, lvl: number): Frame => (lvl > 0 ? { ...f, layers: f.layers.slice(0, -1) } : f); // (the rays and sparkles: its last layer)
  const drain: Frame[] = Array.from({ length: 10 }, (_, i) => {
    const k = Math.min(n, Math.round(((i + 1) / 8) * n));
    const dark = new Set(order.slice(0, k).flatMap((b) => found.bulbs[b]!).map(([x, y]) => `${x},${y}`));
    const lvl = i < 8 ? 0 : i - 7;
    const fr = recolor(SP, sparkLayer(frames[i % frames.length]!, lvl), dark, `d${i}`, parts, star(lvl));
    return { ...fr, ms: 110, ...(i === 0 ? { cue: "drain" } : i === 8 ? { cue: "star" } : {}) };
  });
  const all = new Set(found.bulbs.flat().map(([x, y]) => `${x},${y}`));
  const idle = recolor(SP, sparkLayer(frames[0]!, 2), all, "dark", parts, star(2));
  return { ...SP, id: "intro-hollow-showpiece-out", name: "Hollow's intro: the tree going dark", parts, anims: { drain: { loop: false, frames: drain }, idle: { loop: true, frames: [{ ...idle, ms: 1000 }] } } };
})();
/** The tree's star (its pixels), where its last mote leaves from. */
export const INTRO_HOLLOW_STAR_AT: Pt = STAR_C;

// ==== 4. The motes: light flying into the ball. Each a soft dot of light with a hot core (13 x 13, foot [6, 6] its
// middle), twinkling (3 frames, 70 ms, looping); code moves it along its path and draws its trail (notes).

const MW = 13;
const MC = 6;
const MOTE_PAL: Record<string, string> = {
  k: "#08070c",
  w: "#fffbea", // a hot white core
  // lantern light: bright, mid, its glow (see-through)
  L: "#ffe9a8",
  l: "#ffb648",
  "1": "#ffb64870",
  // the bulbs: red, green, blue, gold, orange, pink (each bright, then its glow), as the cave's bulbs shine
  r: "#ff6a5a",
  R: "#ff5a4a70",
  g: "#6ae880",
  G: "#5ae07070",
  b: "#7aaaff",
  B: "#6aa0ff70",
  y: "#ffe070",
  Y: "#ffd86070",
  o: "#ffaa50",
  O: "#ffa04070",
  p: "#ff9ad6",
  P: "#ff8ad070",
  s: "#ffe27a", // the star's gold
  S: "#ffe27a70",
  // your pawn's light: pale, cool
  n: "#f2f0ff",
  N: "#cfc8ff60",
  // the ball sipping it: violet-white, violet
  x: "#e9ddff",
  U: "#9c6cff",
};
function mote(size: 1 | 2 | 3, core: string, mid: string, glow: string, f: number): Part {
  const cv: string[][] = Array.from({ length: MW }, () => Array<string>(MW).fill("."));
  const r = [1.2, 1.9, 2.7][size - 1]! + (f === 1 ? 0.3 : 0);
  for (let y = 0; y < MW; y++)
    for (let x = 0; x < MW; x++) {
      const d = Math.hypot(x - MC, y - MC);
      if (d <= r * 0.45) cv[y]![x] = core;
      else if (d <= r) cv[y]![x] = mid;
      else if (d <= r + 1.4 && size > 1) cv[y]![x] = glow;
    }
  // A twinkle: a cross of rays on one frame in three (bigger motes only).
  if (f === 1 && size > 1) for (let j = 1; j <= size + 1; j++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const X = MC + dx * (Math.ceil(r) + j - 1), Y = MC + dy * (Math.ceil(r) + j - 1);
    if (cv[Y]?.[X] === ".") cv[Y]![X] = j === size + 1 ? glow : mid;
  }
  return { grid: cv.map((row) => row.join("")), outline: false };
}
const MOTES: Record<string, readonly [1 | 2 | 3, string, string, string]> = {
  "warm-l": [3, "w", "L", "1"],
  "warm-m": [2, "L", "l", "1"],
  "warm-s": [1, "L", "l", "1"],
  red: [2, "w", "r", "R"],
  green: [2, "w", "g", "G"],
  blue: [2, "w", "b", "B"],
  gold: [2, "w", "y", "Y"],
  orange: [2, "w", "o", "O"],
  pink: [2, "w", "p", "P"],
  "red-s": [1, "w", "r", "R"],
  "green-s": [1, "w", "g", "G"],
  "blue-s": [1, "w", "b", "B"],
  "gold-s": [1, "w", "y", "Y"],
  "orange-s": [1, "w", "o", "O"],
  "pink-s": [1, "w", "p", "P"],
  star: [3, "w", "s", "S"],
  pawn: [2, "w", "n", "N"],
  "pawn-s": [1, "n", "n", "N"],
};
/** Each mote's light color, for its trail and the soft glow round it (as SHOP_HOLLOW_LIGHTS colors). */
export const INTRO_HOLLOW_MOTE_GLOW: Readonly<Record<string, string>> = {
  "warm-l": "#ffb648", "warm-m": "#ffb648", "warm-s": "#ffb648",
  red: "#ff5a4a", green: "#5ae070", blue: "#6aa0ff", gold: "#ffd860", orange: "#ffa040", pink: "#ff8ad0",
  "red-s": "#ff5a4a", "green-s": "#5ae070", "blue-s": "#6aa0ff", "gold-s": "#ffd860", "orange-s": "#ffa040", "pink-s": "#ff8ad0",
  star: "#ffe27a", pawn: "#d8d2ff", "pawn-s": "#d8d2ff",
};
/** A cave bulb's mote by its glass key (the cave's bulb colors). */
export const INTRO_HOLLOW_BULB_MOTE: Readonly<Record<string, string>> = { À: "red", Á: "green", Â: "blue", Ã: "gold", Ä: "orange", Å: "pink" };
export const INTRO_HOLLOW_MOTE: Character = (() => {
  const parts: Record<string, Part> = {};
  const anims: Record<string, Anim> = {};
  for (const [name, [size, c, m, g]] of Object.entries(MOTES)) {
    anims[name] = {
      loop: true,
      frames: [0, 1, 2].map((f) => {
        const n = `${name}:${f}`;
        parts[n] = mote(size, c, m, g, f === 2 ? 0 : f);
        return { ms: 70, layers: [{ part: n, x: 0, y: 0 }] };
      }),
    };
  }
  // A mote landing on the ball: a violet-white flick round where it went in, closing.
  const sip = [3.2, 2.2, 1.2].map((r, i): Frame => {
    const n = `sip:${i}`;
    const cv: string[][] = Array.from({ length: MW }, () => Array<string>(MW).fill("."));
    for (let y = 0; y < MW; y++) for (let x = 0; x < MW; x++) if (Math.abs(Math.hypot(x - MC, y - MC) - r) < 0.55) cv[y]![x] = (x + y + i) % 2 ? "x" : "U";
    cv[MC]![MC] = i === 2 ? "x" : ".";
    parts[n] = { grid: cv.map((row) => row.join("")), outline: false };
    return { ms: 50, layers: [{ part: n, x: 0, y: 0 }], ...(i === 0 ? { cue: "sip" } : {}) };
  });
  anims.sip = { loop: false, frames: sip };
  return { id: "intro-hollow-mote", name: "Hollow's intro: a mote of light", w: MW, h: MW, foot: [MC, MC], palette: MOTE_PAL, parts, anims };
})();

// ==== 5. The dark and the dim light.

/**
 * The blackout and the darkening before it. Code lays `tone` over the whole room (floor, pieces, figures) at the alpha
 * `level` reaches, then draws the lights still lit (their own lit pixels: SHOP_HOLLOW_LIGHTS' keys) and the motes over it,
 * so a lit lantern still shines in the dark. Each light gone adds its `steps` share; the blackout takes it to 1 over
 * `blackoutMs`. In the black only his eyes show, `eyes` dim (his DARK_PAL slits' violet, at `eyesAlpha`).
 */
export const INTRO_HOLLOW_DARK = {
  tone: "#040309",
  steps: { lantern: 0.08, string: 0.12, tree: 0.08, strand: 0.03, pawn: 0.03 },
  blackoutMs: 160,
  blackMs: 900,
  eyes: "#7d5bc8",
  eyesAlpha: 0.7,
} as const;
/**
 * The dim, steady light round the board and the two of you once it's black (it doesn't flicker or breathe): an ellipse
 * on the screen round the table, `west` squares west of its middle (between his clear place and yours) and `lift` squares
 * up from the floor (the figures stand in it), `rx` by `ry` squares (at the table's depth, k px a square). The room shows
 * through it at `level` in the middle, the same out to `inner` of the way to its edge, then smoothly (smoothstep) to the
 * black `tone` at its edge; inside it the room is tinted `tint` (multiply). It comes up over `inMs`.
 */
export const INTRO_HOLLOW_DIMPOOL = {
  west: 0.5,
  lift: 0.9,
  rx: 4.6,
  ry: 2.3,
  level: 0.72,
  inner: 0.55,
  tint: "#c2bdf0",
  inMs: 700,
} as const;

/**
 * The ball's own violet glow round it while it works (a light at his heart, drawn as SHOP_HOLLOW_LIGHTS' halos are: a soft
 * round glow added over the room), so it reads at phone size: its radius `r` his pixels past the ball's own (his heart and
 * the ball's radius per frame: HOLLOW_INTRO_HEART, HOLLOW_INTRO_BALL_R), its strength `a` by his move, a slow pulse
 * (0.85 to 1 every half second). None in `full`: the ball is dark then, and in the black.
 */
export const INTRO_HOLLOW_BALL_GLOW = {
  color: "#9c6cff",
  charge: { r: 16, a: 0.55 },
  swell: { r: 20, a: 0.7 },
  drink: { r: 22, a: 0.6 },
  settle: { r: 10, a: 0.2 },
} as const;

/** (For the mockup: every cave piece this intro swaps, by the cave's name.) */
export const INTRO_HOLLOW_PIECES: Readonly<Record<string, Character>> = {
  lantern: INTRO_HOLLOW_LANTERN_OUT,
  "lantern-b": INTRO_HOLLOW_LANTERN_B_OUT,
  showpiece: INTRO_HOLLOW_SHOWPIECE_OUT,
  ...INTRO_HOLLOW_BULB_PIECES,
};

// ---- His own moves (characters/hollow-intro.ts), in this chunk too: they load only when you challenge him.
export { BOSS_HOLLOW_INTRO, HOLLOW_INTRO_BALL_R, HOLLOW_INTRO_HEART } from "../../characters/hollow-intro.ts";
// ---- The cave's lights and pieces (shops/hollow-art.ts), for code that finds a piece's lit pixels.
export { SHOP_HOLLOW_LIGHTS, SHOP_HOLLOW_PIECES } from "./hollow-art.ts";
