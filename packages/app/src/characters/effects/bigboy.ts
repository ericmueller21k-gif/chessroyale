/** Big Boy's effects: the Big Bounce's dust and crash (his toy blocks and tower: bigboy-tower.ts). See ../effects.ts. */
import { canvas, ellipse, inEllipse, shade, toGrid } from "../paint.ts";
import { lazyAnim, lazyParts, type Anim, type Character, type Frame, type Layer, type Part, type Speck } from "../sprite.ts";
import { BOARD, SQUARE, hitAnims } from "./common.ts";

// ---- Big Boy's toys: his bounce's dust and crash (the palette is his toy blocks').

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

/** A puff of dust, `r` across. */
function dustPuff(r: number, k: "s" | "S"): Part {
  const cv = canvas(2 * r + 1, 2 * r + 1);
  shade(cv, inEllipse(r + 0.5, r + 0.5, r + 0.4, r + 0.4), k === "s" ? "sS" : "S", (x, y) => 0.9 - 0.05 * x - 0.05 * y);
  return { grid: toGrid(cv), outline: false };
}

const TOY_PARTS = (() => {
  const { parts, add } = lazyParts();
  for (const r of [2, 3, 4, 5, 6, 7, 8]) for (const k of ["s", "S"] as const) add(`puff${r}${k}`, () => dustPuff(r, k));
  return parts;
})();

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
    puff: lazyAnim(() => ({
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
    })),
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
    crash: lazyAnim(() => ({
      loop: false,
      frames: [14, 30, 48, 68, 90, 112, 134, 0].map((r, t): Frame => ({
        ms: t < 7 ? 75 : 60,
        layers: crashCloud(t),
        specks: r ? [...shockRing(r, t >= 5 ? (t - 4) * 3 : 0), ...debris(t)] : [],
      })),
    })),
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
