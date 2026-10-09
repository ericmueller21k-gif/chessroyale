import { fenAtPly, pieceAt, type Base } from "./rules.ts";

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
export function bossShowMs(lastMove: { captured?: string } | null | undefined, alone = false): number {
  // Alone (a solo boss raid), the game flows like any chess site: the boss's move animates and it's your turn,
  // unless it took your queen (its banner plays first).
  if (alone && lastMove?.captured !== "q") return BOSS_MOVE_ALONE_MS;
  return 1800 + (lastMove?.captured === "q" ? 1300 : 0);
}

/**
 * Boss powers' moments as the turn passes to the crowd, after the boss's move shows: how long each holds the screen
 * (ms). The crowd's clock starts after them, solo and online, so a power never costs anyone thinking time. A freeze
 * or a pie: its banner and the board effect; the warning: its banner over the full rage meter; the blizzard: its
 * banner, the sweep across the board and the God King's line; the funhouse: the clown pogos onto the board, it flips,
 * he speaks and plays the crowd's move; the Roman candle: G-REX drops onto the board, slams the candle down and fires
 * its 24 shots (see the app's PowerMoment for the beats).
 */
export const POWER_FX = { freeze: 2300, pie: 2300, warn: 1700, blizzard: 3600, funhouse: 5200, spark: 2300, candle: 7100, fireball: 1700 } as const;

/**
 * G-REX's fire after the crowd's move: a piece left on a tile ablaze burns (or the tile fizzles under the king) as the
 * boss's turn begins. The boss's move waits for it (at least this long after the crowd's move), solo and online.
 */
export const FIRE_BURN_MS = 1500;

/** How long a turn's power moments take, one after another. */
export function powerMomentMs(events: readonly { kind: keyof typeof POWER_FX }[] | null | undefined): number {
  return (events ?? []).reduce((t, e) => t + (POWER_FX[e.kind] ?? 0), 0);
}

/** Alone: how long the boss's move shows before your turn (the piece's slide, and a beat). */
export const BOSS_MOVE_ALONE_MS = 450;

/** The last move in a game (from the starting position, with its bases: G-REX's fire) took a queen. */
export function lastMoveTookQueen(history: readonly string[], bases?: readonly Base[] | null): boolean {
  const m = history[history.length - 1];
  if (!m) return false;
  return pieceAt(fenAtPly(history, history.length - 1, bases), m.slice(2, 4))?.type === "q";
}

/**
 * The boss thinks for at least this long; longer when the crowd has just taken its queen (your banner plays first),
 * or when G-REX's fire has just burnt (`burnt`: it plays first).
 */
export function bossThinkMs(history: readonly string[], bases?: readonly Base[] | null, burnt = false): number {
  return Math.max(lastMoveTookQueen(history, bases) ? 2000 : 1200, burnt ? FIRE_BURN_MS : 0);
}

/**
 * The God King's Last Stand, beat by beat (ms after the crowd's disastrous move lands on the board). The reveal
 * where it happens lasts LAST_STAND_MS longer, solo and online; the next move's clock only starts after it, so
 * nobody loses any time.
 *
 * 0. The warning (`warnMs` long): a red "??" badge pops on the piece's square (`badgeAt`), the square pulses red,
 *    a danger sting plays, the eval bar plunges to the crowd's chances after the move, and the dock says in plain
 *    words what it loses ("?? Blunder: Nb5 / Loses your knight").
 * 1. Everything freezes (`freezeAt`): the board goes cold and grey, under a dark red pulse.
 * 2. He leaps up out of the dock (`leapAt`), out of view, and crashes down onto the piece's square (`fallAt`,
 *    landing at `crashAt`): a dark red shockwave, dust, the board shakes.
 * 3. The "LAST STAND" cut-in with his battle-worn portrait and one of his lines (`bannerAt`, for `bannerMs`).
 * 4. The piece slides back to the square it came from (`slideAt`); he stands alone where it was. The eval bar
 *    goes back to what it was before the move.
 * 5. The blow meant for it: `slashes` rapid slashes, one every `slashEveryMs` from `slashAt`, each with a red
 *    damage number; his armour cracks (`crackAt`), grunts of agony, a few stylised red drops.
 * 6. He staggers (`staggerAt`), collapses (`collapseAt`) and fades from the board (`fadeAt`, for `fadeMs`);
 *    his fallen figure lies in the dock from then on, with his last words (and his leftover charges, as power-ups).
 * 7. At `endMs` the reveal ends: the crowd picks again with a fresh clock.
 *
 * Beats 1 to 7 are as they were before the warning, all `warnMs` later.
 */
const LS_WARN_MS = 1300;
const after = (ms: number) => LS_WARN_MS + ms;
export const LAST_STAND = {
  badgeAt: 80,
  warnMs: LS_WARN_MS,
  freezeAt: after(250),
  leapAt: after(650),
  fallAt: after(1150),
  crashAt: after(1400),
  bannerAt: after(1950),
  bannerMs: 2100,
  slideAt: after(4150),
  slashAt: after(4650),
  slashes: 25,
  slashEveryMs: 80,
  crackAt: [after(5050), after(5650), after(6250)] as readonly number[],
  staggerAt: after(6800),
  collapseAt: after(7250),
  fadeAt: after(7800),
  fadeMs: 500,
  endMs: after(8600),
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
