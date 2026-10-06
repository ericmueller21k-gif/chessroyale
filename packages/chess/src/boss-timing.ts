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

/**
 * The God King's Last Stand, beat by beat (ms after the crowd's disastrous move lands on the board). The reveal
 * where it happens lasts LAST_STAND_MS longer, solo and online; the next move's clock only starts after it, so
 * nobody loses any time.
 *
 * 1. The move lands and everything freezes (`freezeAt`).
 * 2. He leaps up out of the dock (`leapAt`), out of view, and crashes down onto the piece's square (`fallAt`,
 *    landing at `crashAt`): an impact flash, the board shakes, dust.
 * 3. The "LAST STAND" cut-in with his battle-worn portrait and one of his lines (`bannerAt`, for `bannerMs`).
 * 4. The piece slides back to the square it came from (`slideAt`); he stands alone where it was.
 * 5. The blow meant for it: `slashes` rapid slashes, one every `slashEveryMs` from `slashAt`, each with a red
 *    damage number; his armour cracks (`crackAt`), grunts of agony, a few stylised red drops.
 * 6. He staggers (`staggerAt`), collapses (`collapseAt`) and fades from the board (`fadeAt`, for `fadeMs`);
 *    his fallen figure lies in the dock from then on, with his last words.
 * 7. At `endMs` the reveal ends: the crowd picks again with a fresh clock.
 */
export const LAST_STAND = {
  freezeAt: 250,
  leapAt: 650,
  fallAt: 1150,
  crashAt: 1400,
  bannerAt: 1950,
  bannerMs: 2100,
  slideAt: 4150,
  slashAt: 4650,
  slashes: 25,
  slashEveryMs: 80,
  crackAt: [5050, 5650, 6250] as readonly number[],
  staggerAt: 6800,
  collapseAt: 7250,
  fadeAt: 7800,
  fadeMs: 500,
  endMs: 8600,
} as const;

/** How much longer the reveal lasts when the God King makes his Last Stand. */
export const LAST_STAND_MS: number = LAST_STAND.endMs;

/**
 * The damage numbers on his Last Stand's slashes: `count` of them, 6 to 14 each, the same on every screen for
 * the same move (seeded by it).
 */
export function lastStandHits(seed: string, count: number = LAST_STAND.slashes): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ (i + 1);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    out.push(6 + ((h >>> 0) % 9));
  }
  return out;
}
