import type { Rng } from "@chessroyale/core";
import { shuffle } from "@chessroyale/core";

/**
 * The opening library: positions reached by named lines from the Lichess
 * chess-openings data (CC0), for every opening length from 0 to 10 moves per
 * side, kept only if balanced. Built by scripts/build-openings.ts.
 */
export interface Opening {
  id: string;
  eco: string;
  /** Full name, e.g. "Sicilian Defense: Najdorf Variation". */
  name: string;
  /** The name for each length the line is shown at (the longest named line those moves match). */
  names?: Record<number, string>;
  /** Opening family (the part before the colon), used to keep boards distinct. */
  family: string;
  unusual: boolean;
  /** UCI moves from the starting position. */
  moves: string[];
  /** How many of `moves` come from the named line; the rest are engine moves. */
  namedPlies: number;
  /** Side to move's expected score after the first N plies, for each usable length. */
  expected: Record<number, number>;
}

/** True if the line can be played to `plies` and lands inside the balance window. */
export function usableAt(o: Opening, plies: number, window: readonly [number, number]): boolean {
  const e = o.expected[plies];
  return e !== undefined && o.moves.length >= plies && e >= window[0] && e <= window[1];
}

/**
 * Openings for a match: `classic` classic lines plus `unusual` unusual ones,
 * all from different families, all usable at the given length (so every board
 * has the same side to move).
 */
export function pickOpenings(
  rng: Rng,
  library: readonly Opening[],
  counts: { classic: number; unusual: number },
  plies: number,
  window: readonly [number, number],
  excludeFamilies: ReadonlySet<string> = new Set(),
): Opening[] {
  const chosen: Opening[] = [];
  const families = new Set(excludeFamilies);
  for (const [unusual, n] of [
    [false, counts.classic],
    [true, counts.unusual],
  ] as const) {
    for (const o of shuffle(rng, library)) {
      if (chosen.filter((c) => c.unusual === unusual).length >= n) break;
      if (o.unusual !== unusual || families.has(o.family) || !usableAt(o, plies, window)) continue;
      chosen.push(o);
      families.add(o.family);
    }
  }
  // Short openings have few families (none at all at 0 moves): fill up with repeats, distinct lines first.
  const want = counts.classic + counts.unusual;
  for (const allowSame of [false, true]) {
    for (const o of shuffle(rng, library)) {
      if (chosen.length >= want) break;
      if (!usableAt(o, plies, window) || (!allowSame && chosen.includes(o))) continue;
      chosen.push(o);
    }
  }
  return chosen;
}
