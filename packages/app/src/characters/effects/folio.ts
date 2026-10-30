/**
 * Folio's marks on the board (Oct 27, the wiring lane's), each one board square (SQUARE px), drawn from its own palette in loose
 * pixels (no parts): its ink and its paper. components/Folio.tsx places them from the battle's view, so a reload shows each
 * as it stands without replaying its moment.
 *
 * - `inkMark`, under the marked piece: a blot of its blue-black ink spreading as the pen touches (`blot`, cue `ink`), held
 *   (`mark`; `mark1`, `mark2` with a small ink numeral at the corner: the crowd's moves left to answer it), and drying away
 *   (`fade`).
 * - `inkLine`, under the squares between the attacker and the marked piece: the attack's line, faint ink dots along it,
 *   across the square (`h`), down it (`v`), or corner to corner (`d1`: bottom left to top right as drawn; `d2`: top left to
 *   bottom right).
 * - `foldPaper`, over the folded piece: a sheet of its paper folds over it from the top right corner (`fold`, cue `fold`), held
 *   (`folded`: see-through paper with a crease across it, the corner turned down, its seal at the foot), and opens again
 *   (`unfold`, cue `unfold`). Clearly not Ginger's ice: warm paper, a turned corner and a red seal, no blue.
 * - `creaseEdge`, along each square beside the crease (`E`, `W`, `N`, `S`: which edge of the square, as drawn): the board folded
 *   along the line, a crisp dark crease on the edge, a soft highlight on the side toward the light (the left and the top: `E`, `S`)
 *   and a thin shadow on the other (`W`, `N`). `in*` presses it in (cue `crease`, one square's), `held*`, `out*` unfolds it (cue
 *   `unfold`).
 * - `creasePencil`, along the squares on the light side of a crease warned of: a faint pencil line on their edge (`E`, `S`).
 * - `inkStrike`, over a crossed-out move's squares (Revision): a slanted stroke of ink drawn across the square (`strike`, cue
 *   `strike`), then held (`struck`).
 * - `inkHit`, its attack on a king: a flick of ink splashing on the king (high, then low), from either side.
 */
import type { Anim, Character, Frame, Speck } from "../sprite.ts";
import { SQUARE, hitAnims } from "./common.ts";

const S = SQUARE;

const PALETTE: Record<string, string> = {
  k: "#2b2330",
  // Its ink, blue-black: deep, mid, the rim of a blot, a dot of the attack's line (see-through), a numeral's paper halo.
  I: "#232a47",
  J: "#36416b",
  L: "#575c78",
  d: "#36416bbb",
  h: "#f3e7cce6",
  // Its paper over a folded piece: the sheet (see-through, the piece shows), its edge, the crease, the turned corner (lit, shaded).
  p: "#f3e7cc8c",
  e: "#a58e69d0",
  c: "#76624cb0",
  A: "#fff7e6",
  C: "#d3bd95",
  D: "#a58e69",
  // Its seal: vermilion, pressed deeper.
  v: "#d8432a",
  w: "#a3301e",
  // The crease: the fold's dark line, its shadow (two steps), its highlight (two steps).
  K: "#1c1620d9",
  s: "#0c0d1166",
  t: "#0c0d112e",
  H: "#fff7e680",
  g: "#fff7e638",
  // A pencil's line (graphite, faint).
  P: "#5d6170b0",
  // The ink's splash on a king: its lighter stroke too.
  U: "#7486c0",
};

const char = (id: string, name: string, anims: Character["anims"]): Character => ({ id, name, w: S, h: S, foot: [16, 31], palette: PALETTE, parts: {}, anims });
const still = (ms: number, specks: Speck[], cue?: string): Frame => ({ ms, layers: [], specks, ...(cue ? { cue } : {}) });
const empty = (ms: number): Frame => ({ ms, layers: [] });
const inside = (sp: Speck[]): Speck[] => sp.filter(([x, y]) => x >= 0 && y >= 0 && x < S && y < S);

/** A small seeded jitter, the same every time (a hand-drawn edge). */
const jit = (a: number, b: number) => {
  let h = Math.imul(a + 7, 374761393) ^ Math.imul(b + 3, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------- The ink mark ----------------

/** A blot of ink round the square's middle low down (under the piece's foot), radius `r`: deep in the middle, a mid ring, a rim. */
function blot(r: number): Speck[] {
  const out: Speck[] = [];
  const cx = 15.5;
  const cy = 23.5;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (x - cx) / 1.35;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) + (jit(x, y) - 0.5) * 1.6;
      if (d > r) continue;
      out.push([x, y, d < r * 0.55 ? "I" : d < r * 0.82 ? "J" : "L"]);
    }
  // A couple of spatters off its edge.
  if (r >= 6) out.push([Math.round(cx + r * 1.5), Math.round(cy - 2), "J"], [Math.round(cx - r * 1.45), Math.round(cy + 2), "L"], [Math.round(cx + r * 1.2), Math.round(cy + 4), "L"]);
  return inside(out);
}

/** The numerals 1 and 2, three pixels by five, in ink with a paper halo round them, at the square's top right. */
const DIGITS: Record<1 | 2, readonly string[]> = {
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["##.", "..#", ".#.", "#..", "###"],
};
function numeral(n: 1 | 2): Speck[] {
  const g = DIGITS[n];
  const x0 = S - 6;
  const y0 = 2;
  const on = new Set<string>();
  g.forEach((row, y) => [...row].forEach((c, x) => c === "#" && on.add(`${x0 + x},${y0 + y}`)));
  const out: Speck[] = [];
  for (let y = y0 - 1; y <= y0 + 5; y++)
    for (let x = x0 - 1; x <= x0 + 3; x++) {
      if (on.has(`${x},${y}`)) continue;
      if ([-1, 0, 1].some((a) => [-1, 0, 1].some((b) => on.has(`${x + a},${y + b}`)))) out.push([x, y, "h"]);
    }
  for (const k of on) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    out.push([x, y, "I"]);
  }
  return out;
}

const FULL = 7.5;
export const INK_MARK = char("folio-ink-mark", "Folio's ink mark under a piece", {
  blot: { loop: false, frames: [still(60, blot(2.5), "ink"), still(60, blot(4.5)), still(70, blot(6.5)), still(90, blot(FULL + 0.8)), still(80, blot(FULL))] },
  mark: { loop: true, frames: [still(1000, blot(FULL))] },
  mark1: { loop: true, frames: [still(1000, [...blot(FULL), ...numeral(1)])] },
  mark2: { loop: true, frames: [still(1000, [...blot(FULL), ...numeral(2)])] },
  fade: {
    loop: false,
    frames: [still(90, blot(FULL).map(([x, y, k]): Speck => [x, y, k === "I" ? "J" : "L"])), still(90, blot(FULL - 2).map(([x, y]): Speck => [x, y, "L"])), still(90, blot(3).map(([x, y]): Speck => [x, y, "L"])), empty(40)],
  },
});
/** How long the blot takes to spread (ms). */
export const BLOT_MS = 360;

// ---------------- The attack's line ----------------

/** Faint ink dots along a line through the square's middle, every 4 px, in a direction (dx, dy). */
function dots(dx: number, dy: number): Speck[] {
  const out: Speck[] = [];
  const c = (S - 1) / 2;
  const n = Math.hypot(dx, dy);
  for (let s = -22; s <= 22; s += 4) {
    const x = Math.round(c + (dx / n) * s);
    const y = Math.round(c + (dy / n) * s);
    out.push([x, y, "d"], [x + (dy === 0 ? 1 : 0), y + (dy === 0 ? 0 : 1), "d"]);
  }
  return inside(out);
}
export type LineDir = "h" | "v" | "d1" | "d2";
export const INK_LINE = char("folio-ink-line", "The faint ink line of an attack Folio marked", {
  h: { loop: true, frames: [still(1000, dots(1, 0))] },
  v: { loop: true, frames: [still(1000, dots(0, 1))] },
  d1: { loop: true, frames: [still(1000, dots(1, -1))] },
  d2: { loop: true, frames: [still(1000, dots(1, 1))] },
});

// ---------------- The folded piece ----------------

const SEAL = [".vvvvv", "vvvAvv", "vvvAvv", "vvAAAv", "vvvvvw", "vvvww."];
/**
 * The paper over the piece, folded down from the top right to `t` (0 none, 1 all of it): the see-through sheet, its edge, a crease
 * across it (top left to bottom right), the corner turned down at the top right, and the seal at the foot (once it's all down).
 */
function paper(t: number): Speck[] {
  const out: Speck[] = [];
  // The sheet covers the square from its top right corner down to a diagonal that sweeps across as it folds.
  const reach = t * 2 * (S - 1);
  const corner = 9;
  for (let y = 1; y < S - 1; y++)
    for (let x = 1; x < S - 1; x++) {
      const fromCorner = (S - 1 - x) + y;
      if (fromCorner > reach) continue;
      const edge = x === 1 || y === S - 2 || fromCorner > reach - 1.5;
      const inCorner = x + (S - 1 - y) > 2 * (S - 1) - corner && t >= 1;
      if (inCorner) continue;
      const crease = t >= 1 && Math.abs(x - y) <= 0 && x > 3 && x < S - 4;
      out.push([x, y, edge ? "e" : crease ? "c" : "p"]);
    }
  if (t >= 1) {
    // The corner turned down: a triangle of the paper's back folded over the front, lit then shaded, with its outline.
    for (let y = 1; y <= corner; y++)
      for (let x = S - 1 - corner; x <= S - 2; x++) {
        const u = x - (S - 1 - corner);
        const v = y - 1;
        if (u + v > corner - 1 || u < v) continue;
        out.push([x, y, u + v === corner - 1 || u === v ? "k" : u - v < 3 ? "C" : "A"]);
      }
    // The seal pressed at the paper's foot, bottom right.
    SEAL.forEach((row, y) => [...row].forEach((k, x) => k !== "." && out.push([S - 9 + x, S - 9 + y, k])));
  }
  return out;
}
export const FOLD_PAPER = char("folio-fold-paper", "Folio's paper folded over a piece", {
  fold: { loop: false, frames: [still(70, paper(0.25), "fold"), still(70, paper(0.5)), still(70, paper(0.78)), still(90, paper(1))] },
  folded: { loop: true, frames: [still(1000, paper(1))] },
  unfold: { loop: false, frames: [still(80, paper(0.7), "unfold"), still(80, paper(0.4)), still(80, paper(0.15)), empty(40)] },
});
/** How long the paper takes to fold over (ms). */
export const FOLD_MS = 300;

// ---------------- The crease ----------------

/**
 * Along one edge of a square (`E` its right, `W` its left, `N` its top, `S` its bottom, as drawn), pressed in to `t` (0 to 1): the
 * crisp dark line on the edge itself, then, inward, a highlight (the light side: `E`, `S`) or a shadow (`W`, `N`), wider as it's
 * pressed in.
 */
export type CreaseSide = "E" | "W" | "N" | "S";
function creaseEdge(side: CreaseSide, t: number): Speck[] {
  const out: Speck[] = [];
  const light = side === "E" || side === "S";
  const band = Math.round(t * (light ? 3 : 5));
  for (let i = 0; i < S; i++)
    for (let d = 0; d <= band; d++) {
      // d: pixels in from the edge.
      const k = d === 0 ? (t > 0.3 ? "K" : light ? "g" : "t") : light ? (d <= 1 ? "H" : "g") : d <= 2 ? "s" : "t";
      const [x, y] = side === "E" ? [S - 1 - d, i] : side === "W" ? [d, i] : side === "N" ? [i, d] : [i, S - 1 - d];
      out.push([x, y, k]);
    }
  return out;
}
const creaseAnims: Record<string, Anim> = {};
for (const side of ["E", "W", "N", "S"] as const) {
  creaseAnims[`in${side}`] = { loop: false, frames: [still(80, creaseEdge(side, 0.3), "crease"), still(80, creaseEdge(side, 0.65)), still(100, creaseEdge(side, 1))] };
  creaseAnims[`held${side}`] = { loop: true, frames: [still(1000, creaseEdge(side, 1))] };
  creaseAnims[`out${side}`] = { loop: false, frames: [still(110, creaseEdge(side, 0.65), "unfold"), still(110, creaseEdge(side, 0.35)), still(110, creaseEdge(side, 0.1)), empty(40)] };
}
export const CREASE_EDGE = char("folio-crease", "The board creased along a line", creaseAnims);
/** How long the crease takes to press in, and to unfold (ms). */
export const CREASE_IN_MS = 260;
export const CREASE_OUT_MS = 370;

/** A faint pencil line along a square's right (`E`) or bottom (`S`) edge, broken here and there as a hand-drawn one is. */
function pencil(side: "E" | "S"): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < S; i++) {
    if (jit(i, side === "E" ? 1 : 2) < 0.12) continue;
    out.push(side === "E" ? [S - 1, i, "P"] : [i, S - 1, "P"]);
  }
  return out;
}
export const CREASE_PENCIL = char("folio-pencil", "The faint pencil line of a crease to come", {
  E: { loop: true, frames: [still(1000, pencil("E"))] },
  S: { loop: true, frames: [still(1000, pencil("S"))] },
});

// ---------------- Revision's strike-through ----------------

/** A slanted stroke of ink across the square, bottom left to top right, drawn to `t` (0 to 1): two pixels thick, a blob at its start. */
function stroke(t: number): Speck[] {
  const out: Speck[] = [];
  const x0 = 4;
  const y0 = 24;
  const x1 = 28;
  const y1 = 9;
  const n = 48;
  for (let i = 0; i <= n * t; i++) {
    const u = i / n;
    const x = Math.round(x0 + (x1 - x0) * u);
    const y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 1.5);
    out.push([x, y, "I"], [x, y + 1, "I"], [x + 1, y + 1, "J"]);
  }
  out.push([x0 - 1, y0, "I"], [x0 - 1, y0 + 1, "J"], [x0, y0 + 2, "J"]);
  return inside(out);
}
export const INK_STRIKE = char("folio-strike", "Folio's ink crossing out a move", {
  strike: { loop: false, frames: [still(60, stroke(0.3), "strike"), still(60, stroke(0.65)), still(60, stroke(1))] },
  struck: { loop: true, frames: [still(1000, stroke(1))] },
});
/** How long a strike takes to draw (ms). */
export const STRIKE_MS = 180;

// ---------------- Its attack on a king ----------------

/** A flick of ink landing on the king at height `y`, from the left: a streak, a splash, drops flying on. */
function splash(y: number, step: 0 | 1 | 2): Speck[] {
  const out: Speck[] = [];
  if (step === 0) for (let x = 2; x <= 14; x++) out.push([x, y + Math.round((14 - x) / 6), x > 10 ? "I" : "U"]);
  if (step <= 1)
    for (const [dx, dy, k] of [[0, 0, "I"], [1, 0, "I"], [0, 1, "I"], [1, 1, "J"], [-1, 0, "J"], [2, -1, "J"], [-1, 2, "L"], [3, 1, "L"], [1, -2, "U"]] as const)
      out.push([15 + dx + step * 2, y + dy, k]);
  if (step >= 1) for (const [dx, dy] of [[4, -3], [6, -1], [5, 3], [8, 1], [3, 4]] as const) out.push([15 + dx + step * 2, y + dy, step === 2 ? "L" : "J"]);
  return out;
}
export const INK_HIT = char("folio-ink-hit", "A flick of Folio's ink on a king", hitAnims([["H", 11], ["L", 17]], splash));
