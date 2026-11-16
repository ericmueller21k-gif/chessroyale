/**
 * Timber's effect sprites for the board: one, the wood chips off a hit of his on a king (his attack on a king: the God King's
 * Last Stand, the crowd's king at its mate). The art's notes (scripts/boss-art/out/timber-king-attack-nov2.md on
 * `claude/boss-art`): drawn by code like Sawyer's `sawHit`, in wood colors; the hammer's overhead whacks spray chips up and out,
 * the side knocks and the plank's bat send them sideways from the side he hits, and the plank's smash bursts into bigger
 * splinters. See ../effects.ts.
 */
import type { Character, Speck } from "../sprite.ts";
import { SQUARE, hitAnims } from "./common.ts";

const CHIP_PALETTE: Record<string, string> = {
  a: "#f6d38e", // fresh wood, lit
  b: "#e0aa5c",
  c: "#b47b36",
  d: "#7e5222", // its dark edge (under each chip: it reads on a light square as on a dark one)
  s: "#e8d2a4", // sawdust
  W: "#fff6dd", // the hit's bright spark
};

const bit = (n: number, salt = 0) => ((Math.imul(n + 7 * salt + 3, 2654435761) >>> 0) >>> 13) % 7;

/**
 * Chips off the hit at (bx, y), coming in from the left edge: a spark and a first puff (step 0), the burst (1), falling (2).
 * `from` to `to`: the spread of their angles (degrees: 0 right, -90 up); `reach`: how far each step flies; `n` per step; `big`:
 * splinters two pixels long.
 */
function chips(bx: number, y: number, step: 0 | 1 | 2, seed: number, from: number, to: number, reach: readonly [number, number, number], n: readonly [number, number, number], big = false): Speck[] {
  const out: Speck[] = [];
  if (step === 0) out.push([bx, y, "W"], [bx - 1, y, "W"], [bx + 1, y, "a"], [bx, y - 1, "a"], [bx, y + 1, "s"], [bx + 2, y, "s"]);
  for (let i = 0; i < n[step]; i++) {
    const a = ((from + ((to - from) * i) / Math.max(1, n[step] - 1) + bit(i, seed) * 3) * Math.PI) / 180;
    const d = reach[step] + (bit(i, seed + 1) % 3);
    const x = Math.round(bx + Math.cos(a) * d);
    const yy = Math.round(y + Math.sin(a) * d * 0.85 + (step === 2 ? 3 : 0));
    const k = step === 2 ? (i % 2 ? "c" : "s") : ["a", "b", "c"][i % 3]!;
    out.push([x, yy, k], [x, yy + 1, "d"]);
    if (big && i % 2 === 0) out.push([x + 1, yy, k], [x + 1, yy + 1, "d"]);
    if (step === 1 && i % 3 === 0) out.push([x - 1, yy, "s"]);
  }
  return out;
}

/**
 * The chips off a hit of Timber's on a king's square (his attack on a king), his blow coming in from the left or the right edge:
 * `hitU<L|R>` the hammer's overhead whack on its head (chips sprayed up and out), `hitS<L|R>` a side knock or the plank's bat
 * at its middle (chips flying on sideways, away from him), `hitX<L|R>` the plank's smash on its head (a bigger burst of
 * splinters). About 200 ms each; each ends empty. Over the piece (or the God King standing there).
 */
export const CHIP_HIT: Character = {
  id: "chip-hit",
  name: "Wood chips off a hit of Timber's",
  w: SQUARE,
  h: SQUARE,
  foot: [16, 31],
  palette: CHIP_PALETTE,
  parts: {},
  anims: {
    ...hitAnims([["U", 9]], (y, step) => chips(13, y, step, 3, -165, -20, [2, 5, 8], [6, 12, 10])),
    ...hitAnims([["S", 16]], (y, step) => chips(12, y, step, 5, -40, 35, [2, 6, 9], [5, 11, 9])),
    ...hitAnims([["X", 8]], (y, step) => chips(15, y, step, 7, -175, -5, [3, 7, 11], [8, 16, 14], true)),
  },
};

