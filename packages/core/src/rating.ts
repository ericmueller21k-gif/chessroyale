import { RATING_CURVE } from "./rating-curve.ts";

/**
 * An engine-based rating estimate from a player's move losses. It isn't a real
 * Elo (games aren't played out): it asks which Stockfish UCI_Elo setting loses
 * the same points per move on positions like these (see RATING_CURVE), so it
 * sits on Stockfish's CCRL-anchored scale. With few moves it's pulled towards
 * PRIOR_RATING and firms up as moves come in.
 */

export const PRIOR_RATING = 1500;
/** How many "average" moves the estimate starts with. */
const PRIOR_MOVES = 8;
const MIN_RATING = 400;
const MAX_RATING = 3400;

/** Moves needed before a rating is shown. */
export const RATING_MIN_MOVES = 3;

/** The rating whose expected loss per move is `meanLoss` (interpolated on log loss, extrapolated past the ends). */
export function ratingForLoss(meanLoss: number, curve = RATING_CURVE): number {
  const pts = [...curve].sort((a, b) => a.elo - b.elo).map((c) => ({ elo: c.elo, y: Math.log(Math.max(c.meanLoss, 0.05)) }));
  const y = Math.log(Math.max(meanLoss, 0.05));
  // Loss falls as rating rises; find the segment around y (or the nearest end segment).
  let k = pts.findIndex((p, i) => i > 0 && y >= p.y);
  if (k < 0) k = pts.length - 1;
  if (k === 0) k = 1;
  const a = pts[k - 1]!;
  const b = pts[k]!;
  const elo = a.y === b.y ? a.elo : a.elo + ((y - a.y) * (b.elo - a.elo)) / (b.y - a.y);
  return Math.round(Math.min(MAX_RATING, Math.max(MIN_RATING, elo)));
}

/** Expected loss per move at a rating (the inverse of ratingForLoss). */
export function lossForRating(rating: number, curve = RATING_CURVE): number {
  let lo = 0.05;
  let hi = 200;
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(lo * hi);
    if (ratingForLoss(mid, curve) > rating) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/** Rating estimate from a player's move losses (missed moves aren't included), or null with too few moves. */
export function estimateRating(losses: readonly number[], curve = RATING_CURVE): number | null {
  if (losses.length < RATING_MIN_MOVES) return null;
  const prior = lossForRating(PRIOR_RATING, curve);
  const mean = (losses.reduce((s, x) => s + x, 0) + PRIOR_MOVES * prior) / (losses.length + PRIOR_MOVES);
  return ratingForLoss(mean, curve);
}
