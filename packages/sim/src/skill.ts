/**
 * Stockfish's own "limited strength" (UCI_LimitStrength / UCI_Elo), emulated from a MultiPV-4 search: the
 * honest players of the fair-play simulation. Stockfish turns a UCI_Elo into a skill level, searches with four
 * lines, and when the search reaches depth 1 + level it picks a move with its "magic formula" (a deterministic push
 * towards weaker moves plus a random one, both larger at lower levels). One search to depth 11 gives every level up
 * to about UCI_Elo 2800 its input, so any number of honest picks at any strength cost nothing more.
 *
 * From Stockfish's search.cpp (Skill, Skill::pick_best). Scores are Stockfish's internal units; the search's
 * printed centipawns are converted back with its own material-based normalisation (to_cp's `a`). That only matters
 * where the fourth line is more than a pawn behind (the formula caps its spread at PawnValue).
 */

export const LOWEST_ELO = 1320;
export const HIGHEST_ELO = 3190;
const PAWN_VALUE = 208;

/** Stockfish's skill level (0 to 19, fractional) for a UCI_Elo. */
export function skillLevel(elo: number): number {
  const e = (Math.max(LOWEST_ELO, Math.min(HIGHEST_ELO, elo)) - LOWEST_ELO) / (HIGHEST_ELO - LOWEST_ELO);
  return Math.max(0, Math.min(19, ((37.2473 * e - 40.8525) * e + 22.2943) * e - 0.311438));
}

/** The search depth at which Stockfish picks its move at this strength. */
export const pickDepth = (elo: number) => 1 + Math.floor(skillLevel(elo));

/** Stockfish's material count for its centipawn normalisation (from a FEN's board). */
export function sfMaterial(fen: string): number {
  const board = fen.split(" ")[0]!;
  let m = 0;
  for (const c of board.toLowerCase()) m += c === "p" ? 1 : c === "n" || c === "b" ? 3 : c === "r" ? 5 : c === "q" ? 9 : 0;
  return m;
}

/** Printed centipawns back to internal units (to_cp's inverse: v = cp * a / 100). */
export function internalFromCp(cp: number, material: number): number {
  const m = Math.max(17, Math.min(78, material)) / 58;
  const as = [-13.5003, 40.9278, -36.8275, 386.83];
  const a = ((as[0]! * m + as[1]!) * m + as[2]!) * m + as[3]!;
  return Math.round((cp * a) / 100);
}

/** A mate score as an internal value (mate in n: positive if the mover mates). */
export const internalFromMate = (n: number) => (n > 0 ? 32000 - 2 * n : -32000 - 2 * n);

/**
 * Stockfish's pick at a strength from that depth's lines (best first, internal scores). `rand` returns a uniform
 * unsigned integer like Stockfish's PRNG.
 */
export function skillPick(lines: readonly (readonly [string, number])[], elo: number, rand: () => number): string {
  const level = skillLevel(elo);
  const n = Math.min(4, lines.length);
  const top = lines[0]![1];
  const delta = Math.min(top - lines[n - 1]![1], PAWN_VALUE);
  const weakness = 120 - 2 * level;
  let max = -Infinity;
  let best = lines[0]![0];
  for (let i = 0; i < n; i++) {
    const push = Math.trunc((weakness * Math.trunc(top - lines[i]![1]) + delta * (rand() % Math.trunc(weakness))) / 128);
    if (lines[i]![1] + push >= max) {
      max = lines[i]![1] + push;
      best = lines[i]![0];
    }
  }
  return best;
}

/** A uniform unsigned 32-bit integer from a [0, 1) random source. */
export const randUint = (rng: () => number) => () => Math.floor(rng() * 4294967296);
