import { fenAfter, pieceAt } from "./rules.ts";

/**
 * Boss battle timing shared by the lobby server and the solo game, so a screen
 * and the clock that ends it agree.
 *
 * The intro: the boss's card (with the opening roulette in a raid) over the
 * starting position, then the game so far replayed quickly from the start, one
 * move at a time, then a fighting-game "START!" banner.
 */
export const BOSS_INTRO = { cardMs: 2600, replayMs: 2400, minStepMs: 110, maxStepMs: 260, bannerGapMs: 250, bannerMs: 1500 } as const;

/** When each part of the intro happens (ms after it starts), for a game `plies` half-moves in. */
export function bossIntroTimeline(plies: number) {
  const step = plies > 0 ? Math.max(BOSS_INTRO.minStepMs, Math.min(BOSS_INTRO.maxStepMs, BOSS_INTRO.replayMs / plies)) : 0;
  const replayAt = BOSS_INTRO.cardMs;
  const bannerAt = replayAt + plies * step + BOSS_INTRO.bannerGapMs;
  return { step, replayAt, bannerAt, total: bannerAt + BOSS_INTRO.bannerMs };
}

/** How long the boss's move stays on screen: longer when it takes your queen (its banner and roar). */
export function bossShowMs(lastMove: { captured?: string } | null | undefined): number {
  return 1800 + (lastMove?.captured === "q" ? 1300 : 0);
}

/** The last move in a game (from the starting position) took a queen. */
export function lastMoveTookQueen(history: readonly string[]): boolean {
  const m = history[history.length - 1];
  if (!m) return false;
  return pieceAt(fenAfter(history.slice(0, -1)), m.slice(2, 4))?.type === "q";
}

/** The boss thinks for at least this long; longer when the crowd has just taken its queen (your banner plays first). */
export function bossThinkMs(history: readonly string[]): number {
  return lastMoveTookQueen(history) ? 2000 : 1200;
}
