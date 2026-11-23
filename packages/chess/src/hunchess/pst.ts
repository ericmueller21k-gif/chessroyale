/**
 * The HunChess engine's material and piece-square values (centipawns), middlegame and endgame, made by simple shapes of our
 * own (centralization, advancement, a sheltered king early and an active one late). The board keeps their sums up to date as
 * moves are made, so the evaluation reads them for free.
 */

/** [type] material: pawn, knight, bishop, rook, queen (king 0). */
export const MAT_MG = [0, 85, 335, 350, 480, 1000, 0];
export const MAT_EG = [0, 110, 300, 320, 530, 970, 0];

/** How much each piece type adds to the game phase (24 = the full set of pieces). */
export const PHASE_INC = [0, 0, 1, 1, 2, 4, 0];
export const PHASE_MAX = 24;

/** [piece code * 128 + 0x88 square]: White's values positive, Black's negative. */
export const PST_MG = new Int16Array(16 * 128);
export const PST_EG = new Int16Array(16 * 128);

/** A table for White from (file, rank 0..7 from White's side). */
type Shape = (f: number, r: number) => [number, number];

const center = (f: number, r: number) => Math.abs(f - 3.5) + Math.abs(r - 3.5);

const PAWN_MG_ADV = [0, 0, 4, 10, 20, 32, 50, 0];
const PAWN_EG_ADV = [0, 0, 4, 10, 20, 34, 55, 0];
const KING_MG_HOME = [18, 28, 8, -6, -6, 8, 28, 18];
const KING_MG_SECOND = [8, 8, -8, -16, -16, -8, 8, 8];

const SHAPES: Record<number, Shape> = {
  // Pawns: advancing, the center pawns more in the middlegame; the edge pawns a little less.
  1: (f, r) => {
    const mid = f === 3 || f === 4 ? (r >= 2 && r <= 4 ? 12 : 0) : f === 2 || f === 5 ? 4 : f === 0 || f === 7 ? -4 : 0;
    return [PAWN_MG_ADV[r]! + mid, PAWN_EG_ADV[r]!];
  },
  // Knights: in the middle, not on the rim.
  2: (f, r) => [Math.round(26 - 8 * center(f, r)), Math.round(18 - 6 * center(f, r))],
  // Bishops: toward the middle, gently.
  3: (f, r) => [Math.round(12 - 4 * center(f, r)) + (f === r || f === 7 - r ? 6 : 0), Math.round(10 - 3 * center(f, r))],
  // Rooks: the seventh rank, the middle files a touch.
  4: (f, r) => [(r === 6 ? 18 : 0) + (f === 3 || f === 4 ? 4 : 0), r === 6 ? 12 : 0],
  // Queens: a little toward the middle.
  5: (f, r) => [Math.round(4 - 1.5 * center(f, r)) + (r === 0 ? -2 : 0), Math.round(12 - 4 * center(f, r))],
  // Kings: sheltered on the back rank early, in the middle late.
  6: (f, r) => [r === 0 ? KING_MG_HOME[f]! : r === 1 ? KING_MG_SECOND[f]! : Math.max(-60, -24 - 12 * (r - 2)), Math.round(28 - 7 * center(f, r))],
};

for (let type = 1; type <= 6; type++) {
  const shape = SHAPES[type]!;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const [mg, eg] = shape(f, r);
      const white = type * 128 + r * 16 + f;
      PST_MG[white] = MAT_MG[type]! + mg;
      PST_EG[white] = MAT_EG[type]! + eg;
      // Black: the same, the board turned, negative.
      const black = (8 | type) * 128 + (7 - r) * 16 + f;
      PST_MG[black] = -(MAT_MG[type]! + mg);
      PST_EG[black] = -(MAT_EG[type]! + eg);
    }
  }
}
