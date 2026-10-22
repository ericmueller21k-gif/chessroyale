import { AUTOCHESS, type AutoChessSettings, type Rng } from "@chessroyale/core";

/**
 * The two custom pawns' hops (v7.1, Eric Oct 22: "The bouncing is too much, should be randomly once every 7-10 seconds"): each pawn hops
 * once, then waits a random time between `hopEvery`'s two numbers (seconds, counted from the start of a hop to the start of the next)
 * before its next single hop. Each pawn draws its own waits, so the two never fall into step. The first hop of a pawn comes after a
 * random wait of up to the shorter of the two numbers, so the two don't start together either.
 */

/** How long until a pawn's next hop starts, in ms: a random time between `hopEvery`'s two numbers. */
export function hopWaitMs(rng: Rng, cfg: AutoChessSettings = AUTOCHESS): number {
  const [from, to] = cfg.hopEvery;
  return (from + (to - from) * rng()) * 1000;
}

/** How long until a pawn's first hop, in ms: a random time from now up to the shorter wait. */
export function firstHopMs(rng: Rng, cfg: AutoChessSettings = AUTOCHESS): number {
  return cfg.hopEvery[0] * 1000 * rng();
}
