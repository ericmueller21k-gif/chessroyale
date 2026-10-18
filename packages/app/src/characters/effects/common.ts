/** What every boss's effect sprites share: the frame sizes and a sparkle. See ../effects.ts for how effects work. */
import type { Speck } from "../sprite.ts";

/** Frame pixels per board square, for the one-square effects. */
export const SQUARE = 32;
/** Frame pixels per board square for the blizzard, which covers the whole board (8 x 8 squares). */
export const BOARD_CELL = 24;

export type Pt = readonly [number, number];

export const sparkle = (x: number, y: number, core = "F", ray = "f", big = false): Speck[] => [
  [x, y, core],
  [x - 1, y, ray],
  [x + 1, y, ray],
  [x, y - 1, ray],
  [x, y + 1, ray],
  ...(big ? ([[x - 2, y, ray], [x + 2, y, ray], [x, y - 2, ray], [x, y + 2, ray]] as Speck[]) : []),
];

export const BOARD = 8 * BOARD_CELL;

/**
 * A hit on a king's square for a boss's attack on a king (KingAttack.tsx), drawn coming in from the left edge and
 * mirrored for the right: `hit<kind><L|R>` for each [kind, y], three steps of `specks(y, step)` (50, 70 and 60 ms) and
 * then empty, about 200 ms. Specks outside the square are dropped.
 */
export function hitAnims(kinds: readonly (readonly [string, number])[], specks: (y: number, step: 0 | 1 | 2) => Speck[]): Record<string, { loop: false; frames: { ms: number; layers: []; specks?: Speck[] }[] }> {
  const out: Record<string, { loop: false; frames: { ms: number; layers: []; specks?: Speck[] }[] }> = {};
  for (const [kind, y] of kinds)
    for (const side of ["L", "R"] as const) {
      const sp = (step: 0 | 1 | 2): Speck[] =>
        specks(y, step)
          .filter(([x, yy]) => x >= 1 && yy >= 1 && x <= SQUARE - 2 && yy <= SQUARE - 2)
          .map(([x, yy, k]): Speck => [side === "L" ? x : SQUARE - 1 - x, yy, k]);
      out[`hit${kind}${side}`] = { loop: false, frames: [{ ms: 50, layers: [], specks: sp(0) }, { ms: 70, layers: [], specks: sp(1) }, { ms: 60, layers: [], specks: sp(2) }, { ms: 20, layers: [] }] };
    }
  return out;
}
