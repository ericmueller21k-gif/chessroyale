/** Big Boy's effects: the toy block and its flight, the Big Bounce's dust and crash. See ../effects.ts. */
import { canvas, ellipse, inEllipse, shade, toGrid } from "../paint.ts";
import { lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";
import { BOARD, SQUARE, hitAnims } from "./common.ts";

// ---- Big Boy's toys: the toy block (an ABC block on an empty square), its flight, his bounce's dust and crash.

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

/** The block's letters, 7 x 9 (and 3 x 5 for the little one in flight), with their panel's color key. */
const TOY_LETTERS = {
  A: { panel: "r", side: "U", big: ["..###..", ".##.##.", "##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"], small: [".#.", "#.#", "###", "#.#", "#.#"] },
  B: { panel: "u", side: "G", big: ["######.", "##...##", "##...##", "##...##", "######.", "##...##", "##...##", "##...##", "######."], small: ["##.", "#.#", "##.", "#.#", "##."] },
  C: { panel: "g", side: "R", big: [".#####.", "##...##", "##.....", "##.....", "##.....", "##.....", "##.....", "##...##", ".#####."], small: [".##", "#..", "#..", "#..", ".##"] },
} as const;
export type ToyLetter = keyof typeof TOY_LETTERS;
export const TOY_LETTER_NAMES = Object.keys(TOY_LETTERS) as ToyLetter[];

/**
 * A toy block seen from the front and a little above (light from the top left): a wooden cube, its front `w` x `h`
 * with a colored panel and its letter, its top and right side `d` deep, the side's panel another color.
 */
function toyCube(letter: ToyLetter, w: number, h: number, d: number): Part {
  const L = TOY_LETTERS[letter];
  const cv = canvas(w + d, h + d);
  // The top: light wood, slanting back to the right.
  for (let j = 0; j < d; j++) for (let x = 0; x < w; x++) cv[j]![x + d - j] = j === d - 1 || x === 0 ? "O" : "o";
  // The side: dark wood, its own panel.
  for (let i = 0; i < d; i++)
    for (let y = d - 1 - i; y < d - 1 - i + h; y++) {
      const inner = i > 0 && i < d - 1 && y > d - i + 1 && y < d - 1 - i + h - 2;
      cv[y]![w + i] = inner ? L.side : "D";
    }
  // The front: a wooden rim, the panel, the letter (with a shade down and to its right).
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cv[d + y]![x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? (x === 0 || y === 0 ? "o" : "O") : L.panel;
  const glyph = w >= 14 && h >= 13 ? L.big : L.small;
  const gx = Math.floor((w - glyph[0]!.length) / 2);
  const gy = d + Math.floor((h - glyph.length) / 2);
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && cv[gy + y + 1]?.[gx + x + 1] === L.panel && (cv[gy + y + 1]![gx + x + 1] = "y")));
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && (cv[gy + y]![gx + x] = "Y")));
  return { grid: toGrid(cv) };
}

/** Its shadow on the board, `w` wide. */
function toyShadow(w: number): Part {
  const cv = canvas(w, 4);
  ellipse(cv, w / 2, 2, w / 2, 2, "z");
  return { grid: toGrid(cv), outline: false };
}
/** A puff of dust, `r` across. */
function dustPuff(r: number, k: "s" | "S"): Part {
  const cv = canvas(2 * r + 1, 2 * r + 1);
  shade(cv, inEllipse(r + 0.5, r + 0.5, r + 0.4, r + 0.4), k === "s" ? "sS" : "S", (x, y) => 0.9 - 0.05 * x - 0.05 * y);
  return { grid: toGrid(cv), outline: false };
}

const TOY_PARTS = (() => {
  const { parts, add } = lazyParts();
  for (const l of TOY_LETTER_NAMES) {
    add(`${l}:n`, () => toyCube(l, 18, 18, 5));
    add(`${l}:sq`, () => toyCube(l, 21, 14, 5));
    add(`${l}:st`, () => toyCube(l, 15, 21, 5));
    add(`${l}:14`, () => toyCube(l, 14, 14, 4));
    add(`${l}:9`, () => toyCube(l, 9, 9, 3));
  }
  for (const w of [8, 14, 20, 24]) add(`shadow${w}`, () => toyShadow(w));
  for (const r of [2, 3, 4, 5, 6, 7, 8]) for (const k of ["s", "S"] as const) add(`puff${r}${k}`, () => dustPuff(r, k));
  return parts;
})();

/** The block's place in its square: its front's bottom-left corner on the board, `w` x `h`, `d` deep, `lift` up off it. */
const cubeAt = (l: ToyLetter, kind: "n" | "sq" | "st" | "14" | "9", lift = 0): Layer[] => {
  const [w, h, d] = ({ n: [18, 18, 5], sq: [21, 14, 5], st: [15, 21, 5], "14": [14, 14, 4], "9": [9, 9, 3] } as const)[kind];
  const x = Math.round(14 - w / 2 - d / 2 + 2);
  const y = 28 - h - d - lift;
  return [{ part: `${l}:${kind}`, x, y }];
};
const shadowAt = (w: number): Layer => ({ part: `shadow${w}`, x: Math.round(16 - w / 2), y: 27 });
/** Dust puffing out round the block's foot, `t` frames on. */
const toyDust = (t: number): Layer[] =>
  t > 3
    ? []
    : [
        { part: `puff${2 + Math.min(3, t)}s`, x: 3 - t * 2, y: 24 - t },
        { part: `puff${2 + Math.min(3, t)}S`, x: 23 + t * 2, y: 24 - t },
      ];
/** A glint running along the block's top edge (`i` of 6). */
const toyGlint = (i: number): Speck[] => (i < 3 ? [[8 + i * 6, 6 + (i === 0 ? 0 : 0), "F"], [9 + i * 6, 6, "F"]] : []);

const toyAnims: Record<string, Anim> = {};
for (const l of TOY_LETTER_NAMES) {
  /** It lands: thrown in from above (stretched as it falls), clacks down squashed, bounces a little, and settles. */
  toyAnims[`land${l}`] = {
    loop: false,
    frames: [
      { ms: 50, layers: [shadowAt(8), ...cubeAt(l, "st", 13)] },
      { ms: 50, layers: [shadowAt(14), ...cubeAt(l, "st", 5)] },
      { ms: 70, cue: "clack", shake: [0, 1], layers: [shadowAt(24), ...cubeAt(l, "sq"), ...toyDust(0)] },
      { ms: 70, layers: [shadowAt(20), ...cubeAt(l, "n", 2), ...toyDust(1)] },
      { ms: 60, layers: [shadowAt(20), ...cubeAt(l, "n"), ...toyDust(2)] },
      { ms: 100, layers: [shadowAt(20), ...cubeAt(l, "n"), ...toyDust(3)] },
    ],
  };
  /** Sitting there while it lasts; a glint runs along its top now and then. */
  toyAnims[`sit${l}`] = { loop: true, frames: Array.from({ length: 8 }, (_, i): Frame => ({ ms: i < 3 ? 90 : 300, layers: [shadowAt(20), ...cubeAt(l, "n")], specks: toyGlint(i) })) };
  /** It goes: a puff of dust and it shrinks away (ends empty). */
  toyAnims[`poof${l}`] = {
    loop: false,
    frames: [
      { ms: 70, cue: "poof", layers: [shadowAt(20), ...cubeAt(l, "14"), ...toyDust(0)] },
      { ms: 70, layers: [shadowAt(14), ...cubeAt(l, "9"), ...toyDust(1)] },
      { ms: 80, layers: [...toyDust(2)] },
      { ms: 80, layers: [...toyDust(3)] },
      { ms: 40, layers: [] },
    ],
  };
  /** In flight (on its own sprite, blockFly): tumbling end over end. */
  toyAnims[`fly${l}`] = {
    loop: true,
    frames: ([0, 1, 2, 3] as const).map((rot): Frame => ({ ms: 70, layers: [{ part: `${l}:9`, x: 10, y: 10, rot }] })),
  };
}

export const TOY_BLOCK: Character = {
  id: "toy-block",
  name: "A toy block on a square",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: TOY_PALETTE,
  parts: TOY_PARTS,
  anims: Object.fromEntries(Object.entries(toyAnims).filter(([k]) => !k.startsWith("fly"))),
};
export const BLOCK_FLY: Character = {
  id: "block-fly",
  name: "A toy block in flight",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: TOY_PALETTE,
  parts: TOY_PARTS,
  anims: Object.fromEntries(Object.entries(toyAnims).filter(([k]) => k.startsWith("fly"))),
};

/** Dust puffing up off a square as he lands on it (one of his bounce's 2x2 block, each square its own). */
export const BOUNCE_PUFF: Character = {
  id: "bounce-puff",
  name: "Dust off a bounce",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: TOY_PALETTE,
  parts: TOY_PARTS,
  anims: {
    puff: {
      loop: false,
      frames: [0, 1, 2, 3, 4].map((t): Frame => ({
        ms: t < 4 ? 70 : 40,
        layers:
          t < 4
            ? [
                { part: `puff${Math.min(5, 3 + t)}s`, x: 2 - t * 2, y: 18 - t * 2 },
                { part: `puff${Math.min(5, 2 + t)}S`, x: 20 + t * 2, y: 20 - t * 2 },
                { part: `puff${Math.min(5, 2 + t)}S`, x: 11, y: 22 - t * 3 },
              ]
            : [],
      })),
    },
  },
};

/** The crash's shockwave: a ring `r` from the board's middle, 4 pixels thick: a gold rim, bright cream, gold inside. */
function shockRing(r: number, fade: number): Speck[] {
  const out: Speck[] = [];
  const c = BOARD / 2;
  const seen = new Set<string>();
  for (let k = 0; k < 4; k++) {
    const rr = r - k;
    if (rr <= 0) continue;
    const steps = Math.ceil(2 * Math.PI * rr * 1.3);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      const x = Math.round(c + Math.cos(a) * rr);
      const y = Math.round(c + Math.sin(a) * rr);
      if (x < 0 || y < 0 || x >= BOARD || y >= BOARD || seen.has(`${x},${y}`)) continue;
      // (A broken ring as it thins out at the board's edges.)
      if (fade > 0 && (i * 7 + k * 3) % 10 < fade) continue;
      seen.add(`${x},${y}`);
      out.push([x, y, k === 0 ? "Q" : k <= 2 ? "W" : "A"]);
    }
  }
  return out;
}
/** Debris and specks of dust flying out from the crash, `t` frames on. */
const debris = (t: number): Speck[] =>
  Array.from({ length: 28 }, (_, i): Speck[] => {
    const a = (i / 28) * 2 * Math.PI + (i % 3) * 0.07;
    const d = 18 + t * (9 + (i % 4) * 3);
    const x = Math.round(BOARD / 2 + Math.cos(a) * d);
    const y = Math.round(BOARD / 2 + Math.sin(a) * d - t * (i % 2));
    return x < 1 || y < 1 || x > BOARD - 2 || y > BOARD - 2 ? [] : [[x, y, i % 3 ? "s" : "S"], [x + 1, y, "s"]];
  }).flat();

const CRASH_PALETTE = { ...TOY_PALETTE, W: "#fffbeef2", A: "#ffd56bdd", Q: "#e8a93ccc" } as const;
/** The crash's dust cloud round the middle: puffs in a ring, `t` frames on (bigger and further out, then thinning). */
const crashCloud = (t: number): Layer[] =>
  t > 6
    ? []
    : Array.from({ length: 14 }, (_, i): Layer => {
        const a = (i / 14) * 2 * Math.PI + (i % 2) * 0.2;
        const d = 9 + t * 5 + (i % 3) * 2;
        // (Big billows that overlap into one cloud, thinning out as it spreads.)
        const r = Math.max(2, Math.min(8, 4 + t - (t > 4 ? (t - 4) * 3 : 0) + (i % 2)));
        return { part: `puff${r}${i % 3 ? "s" : "S"}`, x: Math.round(BOARD / 2 + Math.cos(a) * d - r), y: Math.round(BOARD / 2 + Math.sin(a) * d * 0.7 - r - t * 2) };
      });

/**
 * The Big Bounce's crash on the board's four middle squares: a shockwave across the whole board (a bright ring
 * racing out to its corners), a cloud of dust puffing up round the middle, debris flying. Ends empty.
 */
export const BOUNCE_CRASH: Character = {
  id: "bounce-crash",
  name: "The Big Bounce's crash",
  w: BOARD,
  h: BOARD,
  foot: [BOARD / 2, BOARD - 1],
  palette: CRASH_PALETTE,
  parts: TOY_PARTS,
  anims: {
    crash: {
      loop: false,
      frames: [14, 30, 48, 68, 90, 112, 134, 0].map((r, t): Frame => ({
        ms: t < 7 ? 75 : 60,
        layers: crashCloud(t),
        specks: r ? [...shockRing(r, t >= 5 ? (t - 4) * 3 : 0), ...debris(t)] : [],
      })),
    },
  },
};

// ---- His attack on a king: the lollipop's bonk.

const BONK_PALETTE = { k: "#2a1712", F: "#ffffff", "1": "#ff3349", "2": "#ff8a1a", "3": "#ffe23b", "4": "#35c94b", "5": "#2e86ff", "6": "#a24cf5" } as const;
const RAINBOW = "123456";
/** A little star: a core and four one-pixel rays. */
const tinyStar = (x: number, y: number, core: string, ray: string): Speck[] => [[x, y, core], [x - 1, y, ray], [x + 1, y, ray], [x, y - 1, ray], [x, y + 1, ray]];
/**
 * The bonk at (12, y), the candy coming in from the left: a big white star with rainbow rays; then little stars in the
 * candy's colors bursting out round it; then the last of them flying on, dotted.
 */
function bonkSpecks(y: number, step: 0 | 1 | 2): Speck[] {
  const x = 12;
  const out: Speck[] = [];
  if (step === 0) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) < 2) out.push([x + dx, y + dy, "F"]);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ux, uy], i) => {
      for (let d = 2; d <= 5; d++) out.push([x + ux! * d, y + uy! * d, RAINBOW[(i + d) % 6]!]);
    });
    for (const [ux, uy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) out.push([x + ux! * 2, y + uy! * 2, "3"]);
    return out;
  }
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI + 0.3;
    const d = step === 1 ? 6 : 9.5;
    const sx = Math.round(x + Math.cos(a) * d * 1.15);
    const sy = Math.round(y + Math.sin(a) * d * 0.85 + (step === 2 ? 1 : 0));
    const k = RAINBOW[i % 6]!;
    if (step === 1) out.push(...tinyStar(sx, sy, i % 2 ? "F" : k, k));
    else if (i % 2 === 0) out.push([sx, sy, k], [sx + 1, sy, "F"]);
  }
  return out;
}

/**
 * A bonk of Big Boy's lollipop on a king (his attack on a king): `hit<H|L><L|R>`, on its head (the overhead bonk) or
 * its chest (sideways), from the left or right edge: a white star with rainbow rays, then candy-colored stars bursting
 * out. About 200 ms; ends empty. Over the piece (or the God King standing there), never covering it.
 */
export const BONK_HIT: Character = {
  id: "bonk-hit",
  name: "A bonk of Big Boy's lollipop",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: BONK_PALETTE,
  parts: {},
  anims: hitAnims([["H", 7], ["L", 15]], bonkSpecks),
};
