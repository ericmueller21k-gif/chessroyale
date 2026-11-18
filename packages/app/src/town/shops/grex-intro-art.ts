/**
 * Copied as drawn from `claude/boss-art` (scripts/boss-art/out/house-intro-grex/house-intro-grex.ts at 0e4f6482, Nov 4, 2026; Eric approved the build Nov 4).
 * Changed: the import paths. It also re-exports his moves (characters/grex-intro.ts BOSS_GREX_INTRO), so his intro is one chunk. The notes: scripts/boss-art/out/shop-grex-nov4.md and intro-grex-nov4.md on that branch.
 */
/**
 * Jefferson's battle intro props (Eric's design, Nov 4), drawn by hand (weekly plan usage). The boss is on the left and you
 * on the right; the board already stands in the middle of his warehouse on its wobbly stack of crates.
 *
 * 1. INTRO_GREX_TABLE: the crate stack (the room's `board-stand` without its slab and board: the renderer draws those, at
 *    INTRO_GREX_TABLE_TOP over the foot). The tables' geometry: 111 wide, the foot [55, 66]. `idle` a slight wobble, `creak` a
 *    bigger one (when your lift clunks home). INTRO_GREX_TABLE_SWAY: the slab's shift per frame. He stands (no stool).
 * 2. INTRO_GREX_LIFT: your mark's floor plate rising out of the floor on a chrome piston, lifting you level with the board:
 *    `flush`, `rise` (0 to 32 px), `up`, `down`. INTRO_GREX_LIFT_H: the plate's height per frame (stand your pawn on it).
 * 3. INTRO_GREX_STORM (128 x 128, tiles both ways) and INTRO_GREX_FRONT (48 x 128): the wipe into the match, played as
 *    Alfil's sandstorm and Wrangler's dust are: a night sky full of bursting fireworks, sparkler trails and stars, its front
 *    a wall of sparkler fizz.
 * 4. INTRO_GREX_CREW_SPOTS: where each of the crew stands round the table, watching.
 */
import type { Anim, Character, Frame, Layer, Part, Speck } from "../../characters/sprite.ts";
import { groundShadow } from "../houses/kit.ts";
import { crateStack, SHOP_GREX_PALETTE, SHOP_GREX_PLATE, SHOP_GREX_TABLE_TOP } from "./grex-art.ts";
import { cropBit, cv, hash, put, type Bit, type Cv, type Key, type Pt } from "./warehouse-kit.ts";

const PALETTE: Record<string, string> = {
  ...SHOP_GREX_PALETTE,
  // The wipe's night: deep, mid, purple, the low glow.
  a: "#0d1030",
  c: "#18205a",
  e: "#3a2470",
  l: "#6a2a78",
  // Firework inks, bright (core to rim): white-hot, gold, orange; pink; cyan; green; violet.
  Q: "#fff6c2",
  W: "#ff8fd0",
  X: "#7fe3ff",
  S: "#8dff7a",
  s: "#c79bff",
};
const L = (part: string, at: Pt): Layer => ({ part, x: at[0], y: at[1] });
function framesOf(prefix: string, parts: Record<string, Part>, list: { bits: (Bit | null)[]; ms: number; cue?: string; specks?: Speck[] }[]): Frame[] {
  return list.map((f, i) => {
    const layers: Layer[] = [];
    f.bits.forEach((b, j) => {
      if (!b) return;
      const n = `${prefix}${i}-${j}`;
      parts[n] = b.part;
      layers.push(L(n, b.at));
    });
    return { ms: f.ms, layers, ...(f.cue ? { cue: f.cue } : {}), ...(f.specks ? { specks: f.specks } : {}) };
  });
}

// ================================================================================================================
// 1. The crate-stack table.
// ================================================================================================================

const TW = 111;
const TH = 72;
const TF = TH - 6; // 66
const TCX = 55;
/** The slab's top over the foot (px): 59, so 32 higher than the park tables' 27 (TABLE_BOARD.top). */
export const INTRO_GREX_TABLE_TOP = SHOP_GREX_TABLE_TOP;
const SWAY_IDLE = [0, 0, 1, 1, 0, 0, -1, -1];
const SWAY_CREAK = [1, 2, 1, -1, -2, -1, 0];
const tableParts: Record<string, Part> = {};
const stackBit = (sway: number): Bit => {
  const c = cv(TW, TH);
  crateStack(c, TCX, TF, sway);
  return cropBit(c)!;
};
const shadowT = () => groundShadow(TCX, TF + 1, 24, 4);
export const INTRO_GREX_TABLE: Character = {
  id: "intro-grex-table",
  name: "Jefferson's crate-stack table",
  w: TW,
  h: TH,
  foot: [TCX, TF],
  palette: PALETTE,
  parts: tableParts,
  anims: {
    /** A slight wobble (8 x 180 ms, the top three crates a px either way), a creak on f2. */
    idle: { loop: true, frames: framesOf("t-idle-", tableParts, SWAY_IDLE.map((s, i) => ({ bits: [shadowT(), stackBit(s)], ms: 180, ...(i === 2 ? { cue: "creak" } : {}) }))) },
    /** A bigger wobble (once, 7 x 90 ms): when your lift clunks home beside it (cue `creak` f0). */
    creak: { loop: false, frames: framesOf("t-creak-", tableParts, SWAY_CREAK.map((s, i) => ({ bits: [shadowT(), stackBit(s)], ms: 90, ...(i === 0 ? { cue: "creak" } : {}) }))) },
  },
};
/**
 * The slab's (and the board's) shift per frame, in the table's px: [dx, dy]. The top crate sways by the frame's number; the slab
 * on it goes with it. Draw the slab that much over (dx) at INTRO_GREX_TABLE_TOP.
 */
export const INTRO_GREX_TABLE_SWAY: Readonly<Record<string, readonly Pt[]>> = {
  idle: SWAY_IDLE.map((s) => [Math.round(s * 1.5), 0] as Pt),
  creak: SWAY_CREAK.map((s) => [Math.round(s * 1.5), Math.abs(s) === 2 ? 1 : 0] as Pt),
};
/** The slab: plank wood (keys "1" top edge to "5" deep, as the renderer reads them); the squares cream and firework orange. */
export const INTRO_GREX_TABLE_PALETTE: Record<string, string> = {
  k: PALETTE.k!,
  "1": "#e2b274",
  "2": "#c08a50",
  "3": "#9c6a3a",
  "4": "#7a4b28",
  "5": "#4f2d16",
  L: "#f4e4b8",
  D: "#cc5a2c",
  P: "#fbfbf6",
  Q: "#262321",
};
/** The board's squares: cream and firework orange (light enough that the charcoal pieces show on it). */
export const INTRO_GREX_TABLE_INK = {
  light: "#f4e4b8",
  lightShade: "#dcc590",
  lightLine: "#b39060",
  dark: "#cc5a2c",
  darkShade: "#a84522",
  darkLine: "#702c14",
} as const;

// ================================================================================================================
// 2. Your lift: the plate (the room's mark at SHOP_GREX_MARKS.you) on a chrome piston, rising out of the floor.
// ================================================================================================================

const LW = 37;
const LH = 80;
const LF = 64; // the foot: the plate's middle on the floor
const PW = SHOP_GREX_PLATE; // 30
const PD = 24; // the plate's depth as seen (its top face)
/** The plate's rise per frame of each anim (px over the floor; stand your pawn's foot that much up, on the plate's middle). */
const RISE_H = [0, 2, 5, 9, 14, 19, 24, 28, 31, 32];
/** The plate's height at the top: 32, so the board (INTRO_GREX_TABLE_TOP 59) is 27 over your feet, as a park table's over the floor. */
export const INTRO_GREX_LIFT_MAX = 32;
const LIFT_H: Record<string, number[]> = {
  flush: [0],
  rise: RISE_H.slice(1),
  up: [INTRO_GREX_LIFT_MAX, INTRO_GREX_LIFT_MAX],
  down: [...RISE_H].reverse().slice(1),
};
export const INTRO_GREX_LIFT_H: Readonly<Record<string, readonly number[]>> = LIFT_H;
/** The plate seen from above: the hazard rim, the steel tread, rivets (as the floor's mark), squashed to PD deep. */
function plateKey(lx: number, ly: number): Key {
  const P = PW;
  const y = Math.floor((ly * P) / PD);
  if (lx < 0 || ly < 0 || lx >= P || ly >= PD) return null;
  if (lx === 0 || ly === 0 || lx === P - 1 || ly === PD - 1) return "m";
  const rim = lx < 3 || y < 3 || lx >= P - 3 || y >= P - 3;
  if (rim) return Math.floor((lx + y) / 3) % 2 ? "0" : "Y";
  if ((lx === 5 || lx === P - 6) && (y === 5 || y === P - 6)) return "I";
  return (lx + 2 * y) % 6 === 0 || (lx - 2 * y + 60) % 6 === 0 ? "I" : (lx + y) % 2 ? "i" : "M";
}
const liftParts: Record<string, Part> = {};
function liftBits(h: number, f: number): (Bit | null)[] {
  const x0 = Math.floor((LW - PW) / 2);
  // The hole it rises out of: dark, a steel collar round it, the piston's base ring in it.
  const hole = cv(LW, LH);
  if (h > 0)
    for (let j = 0; j < PD; j++)
      for (let i = 0; i < PW; i++) {
        const edge = i === 0 || j === 0 || i === PW - 1 || j === PD - 1;
        put(hole, x0 + i, LF - PD / 2 + j, edge ? "M" : j < 3 ? "8" : "9");
      }
  // The piston: chrome, round (lit on its left), from the plate's underside down into the hole, a collar ring every 9 px.
  const pis = cv(LW, LH);
  const top = LF - h + PD / 2 - 2;
  const bottom = LF + 2;
  if (h > 2)
    for (let y = top; y <= bottom; y++)
      for (let x = 12; x <= 24; x++) {
        const u = (x - 12) / 12;
        let k = u < 0.12 ? "i" : u < 0.32 ? "x" : u < 0.55 ? "I" : u < 0.85 ? "i" : "M";
        if ((bottom - y) % 9 === 0 && y > top + 2) k = u < 0.4 ? "I" : "m";
        if (y >= LF - 1) k = u < 0.4 ? "M" : "m"; // its foot, in the dark of the hole
        put(pis, x, y, k);
      }
  // The plate: its top face (the mark), its front edge (steel, 3 px), hazard stripes on the edge.
  const plate = cv(LW, LH);
  const py = LF - PD / 2 - h;
  for (let j = 0; j < PD; j++) for (let i = 0; i < PW; i++) put(plate, x0 + i, py + j, plateKey(i, j)!);
  if (h > 0) for (let j = 0; j < 3; j++) for (let i = 0; i < PW; i++) put(plate, x0 + i, py + PD + j, j === 2 ? "m" : Math.floor((i + j + f) / 3) % 2 ? "0" : "Y");
  // A hiss of steam out of the hole while it moves (specks are added by the frame).
  return [h > 0 ? groundShadow(18, LF + PD / 2 - 1, 15, 2) : null, cropBit(hole, false), cropBit(pis), cropBit(plate, h > 0)];
}
const steam = (h: number, f: number): Speck[] => {
  const out: Speck[] = [];
  for (let n = 0; n < 6; n++) {
    const side = n % 2 ? 1 : -1;
    const x = 18 + side * (16 + hash(n, f, 3) * 3 + f * 0.6);
    const y = LF + 6 - hash(n, f, 5) * 6 - f * 0.8;
    if (h > 0) out.push([Math.round(x), Math.round(y), n % 3 ? "?" : "x"]);
  }
  return out;
};
function liftAnim(name: string, loop: boolean, ms: number[], cues: Record<number, string> = {}): Anim {
  const hs = LIFT_H[name]!;
  return {
    loop,
    frames: framesOf(`l-${name}-`, liftParts, hs.map((h, i) => ({ bits: liftBits(h, i), ms: ms[i % ms.length]!, ...(cues[i] ? { cue: cues[i] } : {}), ...(name === "rise" || name === "down" ? { specks: steam(h, i) } : {}) }))),
  };
}
export const INTRO_GREX_LIFT: Character = {
  id: "intro-grex-lift",
  name: "Your floor lift",
  w: LW,
  h: LH,
  foot: [18, LF],
  palette: PALETTE,
  parts: liftParts,
  anims: {
    /** Flush with the floor (as the room's mark): 1 frame. */
    flush: liftAnim("flush", true, [1000]),
    /** Rising (once, 9 frames, 1.2 s, eased): `hiss` f0, `clunk` f8 (it locks at the top). */
    rise: liftAnim("rise", false, [110, 120, 130, 130, 130, 140, 150, 170, 220], { 0: "hiss", 8: "clunk" }),
    /** Up, holding (2 x 400 ms). */
    up: liftAnim("up", true, [400]),
    /** Down again (once, 9 frames, 0.9 s): `hiss` f0, `clunk` f8. Not in the intro (the wipe covers it); for after the match. */
    down: liftAnim("down", false, [100], { 0: "hiss", 8: "clunk" }),
  },
};

// ================================================================================================================
// 3. The wipe: fireworks and sparklers. 128 x 128, tiling; 6 x 70 ms, looping (no flashing: each burst opens and fades over
//    the loop, out of step with the others; the sky never changes brightness).
// ================================================================================================================

const ST = 128;
const FW = 48;
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** The sky in soft bands (deep navy at the top to violet low down), a few faint clouds of smoke. */
function sky(x: number, y: number): string {
  const v = y + 6 * Math.sin((2 * Math.PI * x) / ST) + 4 * Math.sin((2 * Math.PI * 2 * x) / ST + 1);
  const band = v < 34 ? "a" : v < 70 ? "c" : v < 104 ? "e" : "l";
  return band;
}
/** The bursts: where (tiling), how big, the inks (core, mid, rim), and their phase in the 6-frame loop. */
const BURSTS = [
  { x: 28, y: 28, r: 20, inks: "QzW", p: 0 },
  { x: 94, y: 20, r: 17, inks: "QXt", p: 2 },
  { x: 68, y: 72, r: 22, inks: "QSg", p: 4 },
  { x: 14, y: 98, r: 15, inks: "Qhs", p: 3 },
  { x: 110, y: 100, r: 15, inks: "QzO", p: 1 },
  { x: 60, y: 30, r: 11, inks: "QsW", p: 5 },
  { x: 104, y: 60, r: 12, inks: "QzE", p: 3 },
  { x: 36, y: 66, r: 10, inks: "QXS", p: 1 },
] as const;
/** A burst's key at (dx, dy) from its middle on frame f: twelve thick rays opening out, tipped with stars, then drooping and thinning. */
function burstKey(dx: number, dy: number, R: number, inks: string, t: number): Key {
  // t: 0..5, how far through it is: the ring opens out (t 0-3), the rays droop and thin (4-5).
  const open = [0.35, 0.6, 0.8, 0.95, 1, 1][t]!;
  const droop = [0, 0, 0.6, 1.4, 2.6, 3.8][t]!;
  const yy = dy - droop * (Math.hypot(dx, dy) / R) ** 2;
  const r = Math.hypot(dx, yy);
  const a = Math.atan2(yy, dx);
  const rays = 12;
  const ray = (Math.abs(mod(a * (rays / (2 * Math.PI)) + 0.5, 1) - 0.5) * 2 * Math.PI * r) / rays; // px off the nearest ray
  const tip = R * open;
  if (t <= 1 && r < 3) return t === 0 ? inks[0]! : inks[1]!; // the bright heart as it pops
  if (r > tip + 1.6) return null;
  // A star at each ray's tip (a plus), brightest while it opens.
  if (r > tip - 1.6 && ray < 1.6) return t >= 4 ? inks[2]! : inks[0]!;
  if (ray > 1.0) return null;
  const inner = tip * [0, 0.2, 0.4, 0.55, 0.68, 0.78][t]!;
  if (r < inner) return null;
  if (t >= 4 && mod(Math.round(r), 2) === 0) return null; // thinning to dots
  if (t === 5 && hash(Math.round(dx), Math.round(dy), 7) < 0.4) return null;
  return r > tip * 0.66 ? inks[1]! : inks[2]!;
}
/** The sparkler trails: wavy glitter ribbons drifting across, their sparkle moving along them a step a frame. */
function trailKey(x: number, y: number, f: number): Key {
  for (const [y0, amp, ph, ink] of [[56, 7, 0, "z"], [116, 5, 2, "E"]] as const) {
    const cy = y0 + amp * Math.sin((2 * Math.PI * x) / ST + ph);
    if (Math.abs(y - cy) < 0.8) return mod(x - f * 4, 6) < 2 ? "Q" : mod(x - f * 4, 6) < 4 ? ink : null;
    if (Math.abs(y - cy) < 2.6 && hash(x, y, f + 31) < 0.12) return ink;
  }
  return null;
}
/** Stars: four-point twinkles, a few at a time, each one up on its own frame of the loop (a slow twinkle, not a flash). */
function starKey(x: number, y: number, f: number): Key {
  for (let n = 0; n < 9; n++) {
    const sx = Math.floor(hash(n, 1, 61) * ST);
    const sy = Math.floor(hash(n, 2, 61) * ST);
    const dx = mod(x - sx + 64, ST) - 64;
    const dy = mod(y - sy + 64, ST) - 64;
    const big = (n + f) % 6 < 3;
    if (dx === 0 && dy === 0) return "*";
    if ((Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0)) return big ? "Q" : "c";
    if (big && ((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0))) return "s";
  }
  return null;
}
/** A rocket going up, its tail of sparks (one per tile, its height by the frame). */
function rocketKey(x: number, y: number, f: number): Key {
  const rx = 50;
  const ry = mod(118 - f * 14, ST);
  const dy = mod(y - ry + 64, ST) - 64;
  if (x === rx && dy >= 0 && dy < 3) return dy === 0 ? "*" : "E";
  if (Math.abs(x - rx) <= 1 && dy >= 3 && dy < 12 && hash(x, y, f) < 0.5 - dy * 0.03) return dy < 7 ? "f" : "F";
  return null;
}
function stormKey(x: number, y: number, f: number): string {
  for (const b of BURSTS) {
    const t = mod(f + b.p, 6);
    const dx = mod(x - b.x + 64, ST) - 64;
    const dy = mod(y - b.y + 64, ST) - 64;
    if (Math.abs(dx) > b.r + 6 || Math.abs(dy) > b.r + 8) continue;
    const k = burstKey(dx + 0.5, dy + 0.5, b.r, b.inks, t);
    if (k) return k;
  }
  return trailKey(x, y, f) ?? rocketKey(x, y, f) ?? starKey(x, y, f) ?? sky(x, y);
}
const full = (fn: (x: number, y: number) => Key, w: number, h: number): Part => ({ grid: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) ?? ".").join("")), outline: false });
const stormParts: Record<string, Part> = {};
const STORM_CUES: Record<number, string> = { 0: "whistle", 2: "pop", 4: "bang" };
const stormFrames: Frame[] = Array.from({ length: 6 }, (_, f) => {
  stormParts[`s${f}`] = full((x, y) => stormKey(x, y, f), ST, ST);
  return { ms: 70, layers: [L(`s${f}`, [0, 0])], ...(STORM_CUES[f] ? { cue: STORM_CUES[f] } : {}) };
});
export const INTRO_GREX_STORM: Character = {
  id: "intro-grex-storm",
  name: "Jefferson's wipe (tile)",
  w: ST,
  h: ST,
  foot: [ST / 2, ST - 1],
  palette: PALETTE,
  parts: stormParts,
  anims: { idle: { loop: true, frames: stormFrames } },
};

/**
 * The leading edge: the night on its left (it meets STORM with no seam), then a wall of sparkler fizz: a ragged band of gold
 * and white glitter with sparkler wires poking out of it, sparks flying out ahead to the right.
 */
const WIRES = Array.from({ length: 6 }, (_, i) => ({ y: (i * ST) / 6 + 8 + hash(i, 1, 71) * 10, len: 9 + hash(i, 2, 71) * 6 }));
function edgeX(y: number, f: number): number {
  const ph = (2 * Math.PI * f) / 6;
  return 18 + 3 * Math.sin((2 * Math.PI * 3 * y) / ST + ph) + 2 * Math.sin((2 * Math.PI * 7 * y) / ST - ph * 2);
}
function frontKey(x: number, y: number, f: number): Key {
  const e = edgeX(y, f);
  if (x < e - 7) return stormKey(x, y, f);
  if (x < e) {
    // The fizz: dense glitter, hotter toward the edge.
    const h = hash(x, y, f + 3);
    const u = (x - (e - 7)) / 7;
    if (h < 0.18 + u * 0.4) return u > 0.7 ? "*" : "Q";
    if (h < 0.5 + u * 0.3) return u > 0.5 ? "z" : "E";
    return u < 0.3 ? stormKey(x, y, f) : "f";
  }
  // Sparkler wires sticking out of the fizz (grey, their ends burning), and sparks flying out ahead.
  for (const w of WIRES) {
    if (Math.abs(y - w.y) < 0.6 && x < e + w.len) return x > e + w.len - 2 ? "*" : (x | 0) % 3 === 2 ? "M" : "i";
    const dx = x - (e + w.len);
    const dy = y - w.y;
    if (dx >= 0 && dx < 10 && Math.abs(dy) < 6 && hash(x, y, f * 7 + 1) < 0.16 - dx * 0.012) return dx < 4 ? "E" : "f";
  }
  if (x < e + 18 && hash(x, y, f * 13 + 5) < 0.05 - (x - e) * 0.002) return "z";
  return null;
}
const frontParts: Record<string, Part> = {};
const frontFrames: Frame[] = Array.from({ length: 6 }, (_, f) => {
  frontParts[`f${f}`] = full((x, y) => frontKey(x, y, f), FW, ST);
  return { ms: 70, layers: [L(`f${f}`, [0, 0])], ...(f === 0 ? { cue: "fizz" } : {}) };
});
export const INTRO_GREX_FRONT: Character = {
  id: "intro-grex-front",
  name: "Jefferson's wipe (its leading edge)",
  w: FW,
  h: ST,
  foot: [0, ST - 1],
  palette: PALETTE,
  parts: frontParts,
  anims: { idle: { loop: true, frames: frontFrames } },
};

// ================================================================================================================
// 4. The crew round the table: a loose ring behind it (north), none in front of the board, you or him from the challenge
//    camera. Squares (a figure's foot); `face` 1 east, -1 west (mirrored), toward the table. Each walks there from his own place
//    (SHOP_GREX_CREW, SHOP_GREX_KEEPER; the two machine guys from beside their machines, NPC_GREX_STEP_OFF) and plays `watch`
//    (the dealer: his `idle`).
// ================================================================================================================

export const INTRO_GREX_CREW_SPOTS = {
  "lift-guy": { at: [6.6, 9.4], face: 1 },
  "leaner-a": { at: [7.3, 8.3], face: 1 },
  "crew-c": { at: [8.4, 7.6], face: 1 },
  dealer: { at: [9.6, 7.2], face: -1 },
  "crew-d": { at: [10.7, 7.6], face: -1 },
  "leaner-b": { at: [11.7, 8.3], face: -1 },
  "fork-guy": { at: [12.4, 9.4], face: -1 },
} as const;
/** The order they arrive in (each a little after the last), and when each sets off after his call (ms). */
export const INTRO_GREX_CREW_SETOFF = { "crew-c": 0, "leaner-a": 150, "leaner-b": 250, "lift-guy": 350, "fork-guy": 450, dealer: 600, "crew-d": 900 } as const;
export { BOSS_GREX_INTRO } from "../../characters/grex-intro.ts";
