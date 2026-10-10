/**
 * Sawyer's effects: a saw cut along one edge of a square (its half on each of the two squares: a groove, then taped
 * over as it heals), the crack as his pawn splits, and the board saw's gap down the middle of the board. See ../effects.ts.
 */
import { BOARD_SAW } from "@chessroyale/chess";
import { toGrid } from "../paint.ts";
import { lazyParts, type Anim, type Character, type Frame } from "../sprite.ts";
import { SQUARE } from "./common.ts";

const SAW_PALETTE = {
  k: "#1c1210", // outline (unused by the grooves: they carry their own edges)
  d: "#120b08", // the groove: deep, its shadow
  D: "#38241a",
  W: "#c9965a", // fresh-cut wood: the lip, its lit face
  w: "#f6deb0",
  s: "#ecd09a", // sawdust
  S: "#b88a52",
  t: "#cfd2d8", // duct tape: light, mid, shade, its edge
  T: "#a5a9b1",
  u: "#7a7e87",
  U: "#50535b",
  p: "#cfd2d899", // tape fading as the cut heals
  P: "#7a7e8799",
  o: "#cfd2d84d",
  O: "#7a7e874d",
  h: "#5a3a2299", // the healed scar
  H: "#5a3a2240",
  c: "#fff6dd", // the crack's bright core
} as const;

type Cv = string[][];
const blank = (w: number, h: number): Cv => Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
const put = (cv: Cv, x: number, y: number, k: string) => {
  if (cv[y]?.[x] !== undefined) cv[y]![x] = k;
};
/** A small fixed pattern by position (the groove's ragged depth, where splinters stick out): the same every time. */
const bit = (n: number, salt = 0) => ((Math.imul(n + 7 * salt + 3, 2654435761) >>> 0) >>> 13) % 7;

// ---------------- The saw cut: its half on one square, the edge along the top (N); turned for E, S and W ----------------

/**
 * The groove's half on one square, along its top edge: `upTo` of its 32 columns sawn (the rest not yet), `depth` 1
 * (closing) to 3 rows deep with a ragged fresh-cut lip, sawdust scattered below it (`dust`: which scatter), and duct
 * tape strips across it (`strips`: their columns; `fade`: 0 solid, 1 half, 2 nearly gone; `short`: slapped down, not
 * yet pressed flat).
 */
function cutHalf(o: { upTo?: number; depth?: number; dust?: number; strips?: readonly [number, number][]; fade?: 0 | 1 | 2; short?: boolean; scar?: 0 | 1 | 2 }): Cv {
  const cv = blank(SQUARE, SQUARE);
  const upTo = o.upTo ?? SQUARE;
  const depth = o.depth ?? 3;
  if (o.scar) {
    for (let x = 0; x < SQUARE; x++) put(cv, x, 0, o.scar === 1 ? "h" : "H");
  } else if (depth > 0) {
    for (let x = 0; x < upTo; x++) {
      const dd = Math.max(1, depth - (bit(x) === 0 ? 1 : 0));
      for (let y = 0; y < dd; y++) put(cv, x, y, y === dd - 1 && dd > 1 ? "D" : "d");
      // The lip: fresh-cut wood, ragged, a splinter sticking out here and there.
      put(cv, x, dd, bit(x, 1) < 3 ? "w" : "W");
      if (bit(x, 2) === 0 && depth >= 2) put(cv, x, dd + 1, "W");
    }
  }
  if (o.dust !== undefined) {
    for (let i = 0; i < 9; i++) {
      const x = (bit(i, 10 + o.dust) * 5 + i * 3) % Math.max(1, upTo);
      const y = depth + 2 + ((bit(i, 20 + o.dust) * 3) % 5);
      put(cv, x, y, i % 3 ? "s" : "S");
    }
  }
  for (const [x0, x1] of o.strips ?? []) {
    const len = o.short ? 4 : 7;
    const [light, mid, shade, edge] = o.fade === 2 ? ["o", "o", "O", "O"] : o.fade === 1 ? ["p", "p", "P", "P"] : ["t", "T", "u", "U"];
    for (let y = 0; y < len; y++)
      for (let x = x0; x <= x1; x++) {
        const torn = y === len - 1 && (x + y) % 2 === 1;
        if (torn) continue;
        put(cv, x, y, x === x0 || x === x1 ? edge : y === len - 1 ? shade : x === x0 + 1 ? light : mid);
      }
  }
  return cv;
}
/** The grid turned a quarter clockwise `q` times (N, then E, S, W). */
function turn(cv: Cv, q: number): Cv {
  let out = cv;
  for (let i = 0; i < q; i++) {
    const h = out.length;
    const w = out[0]!.length;
    out = Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => out[h - 1 - x]![y]!));
  }
  return out;
}

export const CUT_SIDES = ["N", "E", "S", "W"] as const;
export type CutSide = (typeof CUT_SIDES)[number];

const STRIPS1: readonly [number, number][] = [
  [7, 12],
  [19, 24],
];
const STRIPS2: readonly [number, number][] = [
  [1, 5],
  [7, 12],
  [14, 18],
  [19, 24],
  [26, 30],
];
const OPEN_MS = 95;

/** Every look of the cut's half, by name, before it's turned to its side. */
const CUT_LOOKS: Record<string, () => Cv> = {
  open0: () => cutHalf({ upTo: 8, dust: 0 }),
  open1: () => cutHalf({ upTo: 16, dust: 1 }),
  open2: () => cutHalf({ upTo: 24, dust: 2 }),
  open3: () => cutHalf({ dust: 3 }),
  raw0: () => cutHalf({ dust: 4 }),
  raw1: () => cutHalf({ dust: 5 }),
  tapeA: () => cutHalf({ depth: 3, dust: 4, strips: STRIPS1, short: true }),
  taped1: () => cutHalf({ depth: 2, strips: STRIPS1 }),
  tapeB: () => cutHalf({ depth: 2, strips: STRIPS2, short: true }),
  taped2: () => cutHalf({ depth: 1, strips: STRIPS2 }),
  heal0: () => cutHalf({ depth: 1, strips: STRIPS2, fade: 1 }),
  heal1: () => cutHalf({ depth: 0, scar: 1, strips: STRIPS2, fade: 2 }),
  heal2: () => cutHalf({ depth: 0, scar: 2 }),
};

const cutParts = (() => {
  const { parts, add } = lazyParts();
  for (const side of CUT_SIDES) for (const [name, make] of Object.entries(CUT_LOOKS)) add(`${name}${side}`, () => ({ grid: toGrid(turn(make(), CUT_SIDES.indexOf(side))), outline: false }));
  add("empty", () => ({ grid: ["."], outline: false }));
  return parts;
})();

const cutFrame = (part: string, ms: number, cue?: string): Frame => ({ ms, layers: [{ part, x: 0, y: 0 }], ...(cue ? { cue } : {}) });

/**
 * A saw cut's half on a square, the edge on its N, E, S or W side (on screen): `open<S>` (sawn open along the edge,
 * OPEN_MS a step, ends on the raw groove), `raw<S>` (loop, its first turn), `tape1<S>` then `taped1<S>` (loop, its
 * second turn: two strips of duct tape slapped across it, a `tape` cue), `tape2<S>` then `taped2<S>` (loop, its third:
 * more tape, the groove closing), `heal<S>` (the tape fading, a scar, ends empty).
 */
export const SAW_CUT: Character = {
  id: "sawCut",
  name: "Saw cut",
  w: SQUARE,
  h: SQUARE,
  foot: [SQUARE / 2, 0],
  palette: SAW_PALETTE,
  parts: cutParts,
  anims: Object.fromEntries(
    CUT_SIDES.flatMap((S): [string, Anim][] => [
      [`open${S}`, { loop: false, frames: [0, 1, 2, 3].map((i) => cutFrame(`open${i}${S}`, OPEN_MS)) }],
      [`raw${S}`, { loop: true, frames: [cutFrame(`raw0${S}`, 420), cutFrame(`raw1${S}`, 420)] }],
      [`tape1${S}`, { loop: false, frames: [cutFrame(`tapeA${S}`, 110, "tape"), cutFrame(`taped1${S}`, 200)] }],
      [`taped1${S}`, { loop: true, frames: [cutFrame(`taped1${S}`, 1000)] }],
      [`tape2${S}`, { loop: false, frames: [cutFrame(`tapeB${S}`, 110, "tape"), cutFrame(`taped2${S}`, 200)] }],
      [`taped2${S}`, { loop: true, frames: [cutFrame(`taped2${S}`, 1000)] }],
      [`heal${S}`, { loop: false, frames: [cutFrame(`heal0${S}`, 150), cutFrame(`heal1${S}`, 170), cutFrame(`heal2${S}`, 200), cutFrame("empty", 30)] }],
    ]),
  ),
};

// ---------------- The crack as his pawn splits ----------------

/** The crack: a bright jagged split down the middle of the square, chips of wood flying out, `t` steps on. */
function crackLook(t: number): Cv {
  const cv = blank(SQUARE, SQUARE);
  const c = SQUARE / 2;
  if (t < 3) {
    // The split itself: a zigzag line down the pawn, bright at its core.
    for (let y = 5; y < 29; y++) {
      const x = c + (Math.floor(y / 3) % 2 ? 0 : -1) + (t > 0 && y % 7 === 0 ? 1 : 0);
      put(cv, x, y, t === 2 ? "W" : "c");
      put(cv, x - 1, y, t === 0 ? "w" : "D");
      if (t > 0) put(cv, x + 1, y, "D");
    }
  }
  // Chips of wood and sawdust flying out from the line, further each step.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const r = 3 + t * 3.2 + (i % 3);
    const x = Math.round(c + Math.cos(a) * r * 1.1);
    const y = Math.round(16 + Math.sin(a) * r * 0.8 + t * t * 0.4);
    if (t >= 4 && i % 2) continue;
    put(cv, x, y, i % 4 === 0 ? "W" : i % 2 ? "s" : "S");
    if (t < 3 && i % 3 === 0) put(cv, x + 1, y, "s");
  }
  return cv;
}
const crackParts = (() => {
  const { parts, add } = lazyParts();
  for (let t = 0; t < 5; t++) add(`crack${t}`, () => ({ grid: toGrid(crackLook(t)), outline: false }));
  add("empty", () => ({ grid: ["."], outline: false }));
  return parts;
})();

/** The pawn cracking in two (on its square): `crack` (a `crack` cue), ends empty. */
export const SAW_CRACK: Character = {
  id: "sawCrack",
  name: "Saw crack",
  w: SQUARE,
  h: SQUARE,
  foot: [SQUARE / 2, SQUARE],
  palette: SAW_PALETTE,
  parts: crackParts,
  anims: {
    crack: { loop: false, frames: [cutFrame("crack0", 60, "crack"), cutFrame("crack1", 80), cutFrame("crack2", 90), cutFrame("crack3", 100), cutFrame("crack4", 110), cutFrame("empty", 20)] },
  },
};

// ---------------- The board saw's gap down the middle ----------------

/** The gap's strip: GAP_W columns, the board's height (8 squares), centred on the line between the d and e files. */
export const GAP_W = 14;
export const GAP_STEPS = 16;
const BOARD_H = 8 * SQUARE;

/**
 * The strip at `width` columns open (2 to GAP_W: a groove, the halves parting, the gap), from row `from` down to the
 * bottom (the saw has come up that far), sawdust at its top while it's being sawn (`dust`), and splinters along its
 * lips. The left half's cut face is in shadow, the right half's lit (light from the top left).
 */
function gapLook(width: number, from = 0, dust = false, faint = false): Cv {
  const cv = blank(GAP_W, BOARD_H);
  const x0 = Math.floor((GAP_W - width) / 2);
  const x1 = x0 + width - 1;
  for (let y = from; y < BOARD_H; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = faint ? "H" : x === x0 ? "W" : x === x1 ? "w" : width > 4 && (x === x0 + 1 || x === x1 - 1) ? "D" : "d";
      put(cv, x, y, k);
    }
    // Splinters sticking into the gap from its lips.
    if (!faint && width >= 6 && bit(y, 4) === 0) put(cv, x0 + 1, y, "W");
    if (!faint && width >= 6 && bit(y, 5) === 0) put(cv, x1 - 1, y, "w");
  }
  if (dust)
    for (let i = 0; i < 14; i++) {
      const x = (bit(i, 30 + from) + i) % GAP_W;
      const y = from - 1 - ((bit(i, 40 + from) * 2 + i) % 8);
      put(cv, x, y, i % 3 ? "s" : "S");
    }
  return cv;
}
const gapParts = (() => {
  const { parts, add } = lazyParts();
  for (let k = 0; k <= GAP_STEPS; k++) add(`run${k}`, () => ({ grid: toGrid(gapLook(4, Math.round(BOARD_H - (BOARD_H * k) / GAP_STEPS), k < GAP_STEPS)), outline: false }));
  for (const w of [7, 10, GAP_W]) add(`part${w}`, () => ({ grid: toGrid(gapLook(w)), outline: false }));
  for (const w of [10, 6, 2]) add(`close${w}`, () => ({ grid: toGrid(gapLook(w, 0, false, w === 2)), outline: false }));
  add("empty", () => ({ grid: ["."], outline: false }));
  return parts;
})();

/** How long each step of the run lasts (ms): the strip opens from the bottom to the top over BOARD_SAW.runMs. */
export const gapRunStep = (runMs: number) => Math.round(runMs / (GAP_STEPS + 1));

/**
 * The board saw's gap, a strip GAP_W wide and the board's height: `run` (a groove opening from the bottom to the top in
 * GAP_STEPS + 1 steps over BOARD_SAW.runMs), `part` (the halves parting: wider and wider, a `split` cue), `gap` (loop:
 * the board in two), `close` (the halves coming back together, a `rejoin` cue, ends empty).
 */
export const BOARD_GAP: Character = {
  id: "boardGap",
  name: "Board gap",
  w: GAP_W,
  h: BOARD_H,
  foot: [GAP_W / 2, BOARD_H],
  palette: SAW_PALETTE,
  parts: gapParts,
  anims: {
    run: { loop: false, frames: Array.from({ length: GAP_STEPS + 1 }, (_, k) => cutFrame(`run${k}`, gapRunStep(BOARD_SAW.runMs))) },
    // (The first frame long enough that a busy phone never skips it, and its sound with it.)
    part: { loop: false, frames: [cutFrame("part7", 160, "split"), cutFrame("part10", 90), cutFrame(`part${GAP_W}`, 100)] },
    gap: { loop: true, frames: [cutFrame(`part${GAP_W}`, 1000)] },
    close: { loop: false, frames: [cutFrame("close10", 110, "rejoin"), cutFrame("close6", 110), cutFrame("close2", 140), cutFrame("empty", 30)] },
  },
};
