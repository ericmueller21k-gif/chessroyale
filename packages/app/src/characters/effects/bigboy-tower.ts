/**
 * Big Boy's toy-block tower (Nov 18): a stack of 1 to 10 toy blocks on one square (`stand<N>`, its sway growing with its
 * height), a block landing on it (`add<N>`), and the stack going over (`tip<N>`, ending empty: the game flies each block to its
 * square). Drawn by the art runner (scripts/boss-art on claude/boss-art, out/bigboy-tower: $1.63); copied here as drawn, its
 * imports pointed at the game's. The frame is 48 x 136: the tower's square is its bottom 32 rows, columns 8 to 39.
 */
/**
 * Big Boy's toy-block tower: he stacks a toy block on one square each turn, up to 10, and then it topples.
 * A board effect in the sprite format (not a boss). The frame is 48 x 136: the square the tower stands on is the
 * bottom 32 rows, columns 8..39; above it the tower rises over the squares behind.
 */
import { canvas, ellipse, inEllipse, shade, toGrid } from "../paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck, type Wave } from "../sprite.ts";

// ---- Today's toy block (copied from effects/bigboy.ts so this file stands alone).

const TOY_PALETTE = {
  k: "#2a1712",
  o: "#f6d08e", // wood: top, front, side
  O: "#d9a159",
  D: "#a26f33",
  r: "#e2483f", // the letters' panels: red (A), blue (B), green (C); each darker on the side
  R: "#a52a26",
  u: "#3d7fe0",
  U: "#2554a8",
  g: "#3cb24c",
  G: "#24782f",
  Y: "#fff4d0", // the letter and its shade
  y: "#c9b98e",
  F: "#ffffff",
  z: "#0000004d", // its shadow on the board
  s: "#cfc6b4cc", // dust
  S: "#f3ecdccc",
} as const;

const TOY_LETTERS = {
  A: { panel: "r", side: "U", big: ["..###..", ".##.##.", "##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"], small: [".#.", "#.#", "###", "#.#", "#.#"] },
  B: { panel: "u", side: "G", big: ["######.", "##...##", "##...##", "##...##", "######.", "##...##", "##...##", "##...##", "######."], small: ["##.", "#.#", "##.", "#.#", "##."] },
  C: { panel: "g", side: "R", big: [".#####.", "##...##", "##.....", "##.....", "##.....", "##.....", "##.....", "##...##", ".#####."], small: [".##", "#..", "#..", "#..", ".##"] },
} as const;
type ToyLetter = keyof typeof TOY_LETTERS;

/** Today's toyCube: a wooden ABC block from the front and a little above, front w x h, top and side d deep. */
function toyCube(letter: ToyLetter, w: number, h: number, d: number): Part {
  const L = TOY_LETTERS[letter];
  const cv = canvas(w + d, h + d);
  for (let j = 0; j < d; j++) for (let x = 0; x < w; x++) cv[j]![x + d - j] = j === d - 1 || x === 0 ? "O" : "o";
  for (let i = 0; i < d; i++)
    for (let y = d - 1 - i; y < d - 1 - i + h; y++) {
      const inner = i > 0 && i < d - 1 && y > d - i + 1 && y < d - 1 - i + h - 2;
      cv[y]![w + i] = inner ? L.side : "D";
    }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cv[d + y]![x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? (x === 0 || y === 0 ? "o" : "O") : L.panel;
  const glyph = w >= 14 && h >= 13 ? L.big : L.small;
  const gx = Math.floor((w - glyph[0]!.length) / 2);
  const gy = d + Math.floor((h - glyph.length) / 2);
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && cv[gy + y + 1]?.[gx + x + 1] === L.panel && (cv[gy + y + 1]![gx + x + 1] = "y")));
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && (cv[gy + y]![gx + x] = "Y")));
  return { grid: toGrid(cv) };
}
function toyShadow(w: number): Part {
  const cv = canvas(w, 4);
  ellipse(cv, w / 2, 2, w / 2, 2, "z");
  return { grid: toGrid(cv), outline: false };
}
function dustPuff(r: number, k: "s" | "S"): Part {
  const cv = canvas(2 * r + 1, 2 * r + 1);
  shade(cv, inEllipse(r + 0.5, r + 0.5, r + 0.4, r + 0.4), k === "s" ? "sS" : "S", (x, y) => 0.9 - 0.05 * x - 0.05 * y);
  return { grid: toGrid(cv), outline: false };
}

// ---- The tower's blocks: each keeps its size, letter and sideways offset at every height.

/** Front width = height of block k (index 0 = the base, today's block). */
const SIZES = [18, 14, 13, 12, 11, 10, 10, 9, 9, 9];
const DEPTHS = [5, 4, 4, 4, 3, 3, 3, 3, 3, 3];
/** Hand-stacked: each block's own sideways offset from the column. */
const OFFS = [0, 2, -1, 3, -2, 1, -3, 2, -1, 2];
const LETTER_OF = (k: number): ToyLetter => (["A", "B", "C"] as const)[k % 3]!;
/** The squashed (landing) and stretched (falling) shapes of each block: [w, h]. */
const SQ = (k: number): [number, number] => (k === 0 ? [21, 14] : [SIZES[k]! + 2, SIZES[k]! - 3]);
const ST = (k: number): [number, number] => (k === 0 ? [15, 21] : [SIZES[k]! - 2, SIZES[k]! + 2]);

const { parts, add } = lazyParts();
for (let k = 0; k < 10; k++) {
  const l = LETTER_OF(k);
  const s = SIZES[k]!;
  const d = DEPTHS[k]!;
  add(`b${k}`, () => toyCube(l, s, s, d));
  add(`b${k}sq`, () => toyCube(l, ...SQ(k), d));
  add(`b${k}st`, () => toyCube(l, ...ST(k), d));
}
for (const w of [8, 14, 20, 24]) add(`shadow${w}`, () => toyShadow(w));
for (const r of [2, 3, 4, 5, 6, 7, 8]) for (const k of ["s", "S"] as const) add(`puff${r}${k}`, () => dustPuff(r, k));

/** Shift of the square inside the frame (today's 32 x 32 coordinates -> ours). */
const OX = 8;
const OY = 104;

interface Blk {
  x: number; // grid's top-left
  y: number;
  w: number; // front, square
  d: number;
  fy: number; // front's top row
  bot: number; // front's bottom row
}
/** The stack at rest: each block's front bottom two rows above the lower block's front top (on its top face). */
const REST: Blk[] = [];
for (let k = 0; k < 10; k++) {
  const w = SIZES[k]!;
  const d = DEPTHS[k]!;
  if (k === 0) {
    // Today's cubeAt("n") exactly, shifted into the tall frame.
    const x = Math.round(14 - w / 2 - d / 2 + 2) + OX;
    const y = 28 - w - d + OY;
    REST.push({ x, y, w, d, fy: y + d, bot: y + d + w - 1 });
  } else {
    const below = REST[k - 1]!;
    const bot = below.fy - 2;
    const fy = bot - w + 1;
    const x = 22 - Math.floor(w / 2) + OFFS[k]!;
    REST.push({ x, y: fy - d, w, d, fy, bot });
  }
}
const GROUND = REST[0]!.bot;
/** Height over the board of block k's bottom and of its top. */
const RISE = REST.map((b) => GROUND - b.bot);
const TOPRISE = REST.map((b) => GROUND - b.y);

export const TOWER_TOPS: number[] = REST.map((b) => b.y);
export const TOWER_BLOCKS: [number, number][] = REST.map((b) => [b.x + Math.floor(b.w / 2), b.fy + Math.floor(b.w / 2)]);

const rnd = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

/** A block leaning: its rows slide, the top `amp` pixels, the bottom row not at all. */
const lean = (amp: number): Wave | undefined => (amp ? { along: "rows", amp, len: 1e6, phase: Math.PI / 2, pin: "bottom" } : undefined);

/** A pose of block k: shifted dx, dy, its top leaning `sh` further, maybe turned. */
interface Pose {
  dx: number;
  dy?: number;
  sh?: number;
  rot?: 0 | 1 | 2 | 3;
}

/** The stack of n blocks bending about its base, the top of the top block `amp` over: each block's foot and top follow the curve. */
const bend = (n: number, amp: number, p = 1): Pose[] => {
  const R = TOPRISE[n - 1]!;
  const S = (r: number) => rnd(amp * Math.pow(r / R, p));
  // (Each block stays square: a sheared block's letter breaks up at this size. The curve is in the feet.)
  return Array.from({ length: n }, (_, k) => ({ dx: S(RISE[k]!) }));
};

const baseShadow = (): Layer => ({ part: "shadow20", x: 6 + OX, y: 27 + OY });
const shadowAt = (w: number): Layer => ({ part: `shadow${w}`, x: Math.round(16 - w / 2) + OX, y: 27 + OY });

const blockLayer = (k: number, p: Pose | undefined, part = `b${k}`): Layer => {
  const b = REST[k]!;
  const wave = p?.rot ? undefined : lean(p?.sh ?? 0);
  return { part, x: b.x + (p?.dx ?? 0), y: b.y + (p?.dy ?? 0), ...(p?.rot ? { rot: p.rot } : {}), ...(wave ? { wave } : {}) };
};

/** The stack of n blocks in poses (missing = at rest), plus a nudge of a pixel for some. */
const stack = (n: number, poses: Pose[] = [], nudge: Record<number, number> = {}): Layer[] => [
  ...(n > 0 ? [baseShadow()] : []),
  ...REST.slice(0, n).map((_, k) => {
    const p = poses[k] ?? { dx: 0 };
    return blockLayer(k, { ...p, dx: p.dx + (nudge[k] ?? 0) });
  }),
];

const toyDust = (t: number): Layer[] =>
  t > 3
    ? []
    : [
        { part: `puff${2 + Math.min(3, t)}s`, x: 3 - t * 2 + OX, y: 24 - t + OY },
        { part: `puff${2 + Math.min(3, t)}S`, x: 23 + t * 2 + OX, y: 24 - t + OY },
      ];
const toyGlint = (i: number): Speck[] => (i < 3 ? [[8 + i * 6 + OX, 6 + OY, "F"], [9 + i * 6 + OX, 6 + OY, "F"]] : []);

const anims: Record<string, Anim> = {};

// ---- stand1..stand10: the stack, alive; the sway grows with height. Each starts at rest.

const wave = (i: number, n: number) => Math.sin((2 * Math.PI * i) / n);

anims.stand1 = { loop: true, frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: i < 3 ? 110 : 240, layers: stack(1), specks: toyGlint(i) })) };
for (const n of [2, 3]) {
  // Steady; the top block shivers a pixel now and then.
  const shiver = [0, 0, 0, 0, 0, 1, -1, 0];
  anims[`stand${n}`] = {
    loop: true,
    frames: shiver.map((s, i): Frame => ({ ms: s ? 110 : 220, layers: stack(n, [], { [n - 1]: s }) })),
  };
}
for (const [n, amp, ms] of [[4, 1, 220], [5, 1.5, 200], [6, 2, 190]] as const) {
  anims[`stand${n}`] = { loop: true, frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms, layers: stack(n, bend(n, amp * wave(i, 8))) })) };
}
for (const [n, amp, ms, nb] of [[7, 2, 170, 4], [8, 2.5, 160, 5], [9, 3, 150, 3]] as const) {
  anims[`stand${n}`] = {
    loop: true,
    frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms, layers: stack(n, bend(n, amp * wave(i, 8)), i === 3 || i === 4 ? { [nb]: i === 3 ? -1 : 1 } : {}) })),
  };
}
anims.stand10 = {
  loop: true,
  frames: Array.from({ length: 10 }, (_, i): Frame => ({
    ms: 110,
    layers: stack(10, bend(10, 5 * wave(i, 10), 1.5), i === 2 || i === 3 ? { 6: 1 } : i === 7 ? { 3: -1, 8: -1 } : {}),
  })),
};
anims.idle = anims.stand7!;

// ---- add1..add10: block N drops in from the top, clacks down squashed, bounces, the stack shivers.

for (let n = 1; n <= 10; n++) {
  const k = n - 1;
  const b = REST[k]!;
  const d = b.d;
  /** Block k drawn as part `kind` (w x h) with its front's bottom `lift` above its rest. */
  const drop = (kind: "" | "sq" | "st", lift: number, dx = 0): Layer => {
    const [w, h] = kind === "sq" ? SQ(k) : kind === "st" ? ST(k) : [b.w, b.w];
    const x = k === 0 ? Math.round(14 - w / 2 - d / 2 + 2) + OX : b.x + Math.round((b.w - w) / 2);
    return { part: `b${k}${kind}`, x: x + dx, y: b.bot - lift - h - d + 1 };
  };
  const [, hs] = ST(k);
  const y0 = -Math.round((hs + d) * 0.4);
  const lift0 = Math.max(6, b.bot - y0 - d - hs + 1);
  const lifts = [lift0, Math.round(lift0 * 0.4), Math.min(5, Math.round(lift0 * 0.15))];
  const under = (amp: number) => (n > 1 ? bend(n, amp) : []);
  const sh = (w: number) => (n === 1 ? [shadowAt(w)] : []);
  const frames: Frame[] = [
    { ms: 40, layers: [...sh(8), ...stack(k), drop("st", lifts[0]!)] },
    { ms: 40, layers: [...sh(8), ...stack(k), drop("st", lifts[1]!)] },
    { ms: 40, layers: [...sh(14), ...stack(k), drop("st", lifts[2]!)] },
    { ms: 70, cue: "clack", shake: [0, 1], layers: [...sh(24), ...stack(k, under(1)), drop("sq", 0, under(1)[k]?.dx ?? 0), ...(n === 1 ? toyDust(0) : [])] },
    { ms: 70, layers: [...sh(20), ...stack(k, under(-1)), drop("", Math.min(2, b.y - 2), under(-1)[k]?.dx ?? 0), ...(n === 1 ? toyDust(1) : [])] },
    { ms: 60, layers: [...stack(n), ...(n === 1 ? toyDust(2) : [])] },
    { ms: 80, layers: [...stack(n), ...(n === 1 ? toyDust(3) : [])] },
    { ms: 40, layers: stack(n) },
  ];
  anims[`add${n}`] = { loop: false, frames };
}

// ---- tip2..tip10: the stack goes over (even N to our right, odd to our left), coming apart from the top.

/** Block k's pose in step t of the tip of n going `dir`, the column's top `D` over. */
function tipPose(n: number, k: number, t: number, dir: number, D: number): Pose {
  const R = TOPRISE[n - 1]!;
  const S = (r: number) => D * Math.pow(r / R, 1.3);
  // Breaks open from the top down: blocks above a break slide off further, lift a little and lean more.
  const breaks = [[], [n - 2], [n - 2, Math.ceil(n / 2) - 1], [n - 2, Math.ceil(n / 2) - 1, 1]][t]!.map((j) => Math.max(1, j));
  const above = new Set(breaks.filter((j) => k >= j)).size;
  let dx = S(RISE[k]!) + above * (1 + t) * 0.6;
  const sh = S(TOPRISE[k]!) - S(RISE[k]!) + (above ? 1 + t : 0);
  const arc = RISE[k]! > 0 ? (dx * dx) / (2 * Math.max(24, RISE[k]!)) : 0;
  let dy = arc - above * (n >= 8 ? 1 : 2);
  const rot: 0 | 1 | 2 | 3 = t === 3 && k === n - 1 && n > 2 ? (dir > 0 ? 1 : 3) : 0;
  if (k === 0) {
    dx = t === 3 ? 1 : 0;
    dy = 0;
  }
  return { dx: rnd(dir * dx), dy: Math.round(dy), sh: rot || k === 0 ? 0 : rnd(dir * sh), rot };
}
/** Does the pose stay inside the frame (one pixel off every edge, outline included)? */
function fits(k: number, p: Pose): boolean {
  const b = REST[k]!;
  const span = b.w + b.d;
  const x0 = b.x + p.dx + Math.min(0, p.sh ?? 0);
  const x1 = b.x + p.dx + span - 1 + Math.max(0, p.sh ?? 0);
  return x0 >= 2 && x1 <= 45 && b.y + (p.dy ?? 0) >= 2;
}

for (let n = 2; n <= 10; n++) {
  const dir = n % 2 === 0 ? 1 : -1;
  const steps = [0.22, 0.5, 0.78, 1];
  // As far over as fits the frame (a short stack goes well over, a tall one bends and breaks).
  let Dmax = 22;
  while (Dmax > 4 && !steps.every((f, t) => REST.slice(0, n).every((_, k) => fits(k, tipPose(n, k, t, dir, Dmax * f))))) Dmax--;
  const frames: Frame[] = steps.map((f, t): Frame => ({
    ms: t === 0 ? 80 : 75,
    cue: t === 0 ? "crash" : undefined,
    layers: [baseShadow(), ...Array.from({ length: n }, (_, k) => blockLayer(k, tipPose(n, k, t, dir, Dmax * f)))],
  }));
  frames.push({ ms: 30, layers: [] });
  anims[`tip${n}`] = { loop: false, frames };
}

export const TOY_TOWER: Character = {
  id: "bigboy-tower",
  name: "Big Boy's toy-block tower",
  w: 48,
  h: 136,
  foot: [24, 135],
  palette: TOY_PALETTE,
  parts,
  anims,
};
