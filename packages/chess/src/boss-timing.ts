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

/** Hollow claiming the dark side in the intro (when the crowd would have been Black): his `claimDark` and his line. */
export const CLAIM_MS = 2400;

/**
 * When each part of the intro happens (ms after it starts), for a game `plies` half-moves in. `claimed`: Hollow claims
 * the dark side after the card (`claimAt`), before "START!".
 */
export function bossIntroTimeline(plies: number, claimed = false) {
  const step = plies > 0 ? Math.max(BOSS_INTRO.minStepMs, Math.min(BOSS_INTRO.maxStepMs, BOSS_INTRO.replayMs / plies)) : 0;
  const replayAt = BOSS_INTRO.cardMs;
  const claimAt = replayAt + plies * step;
  const bannerAt = claimAt + (claimed ? CLAIM_MS : 0) + BOSS_INTRO.bannerGapMs;
  return { step, replayAt, claimAt, bannerAt, total: bannerAt + BOSS_INTRO.bannerMs };
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
export const POWER_FX = { freeze: 2300, pie: 2300, warn: 1700, blizzard: 3600, funhouse: 5200, spark: 2300, candle: 7100, fireball: 1700, dark: 2700 } as const;

/** Hollow's first cover of the dark holds longer, for his first-cover line ("Don't forget what's there…"). */
export const DARK_FIRST_EXTRA_MS = 1300;

/** How long one power's moment holds the screen (ms). */
export const powerFxMs = (e: { kind: keyof typeof POWER_FX; first?: boolean }): number => (POWER_FX[e.kind] ?? 0) + (e.kind === "dark" && e.first ? DARK_FIRST_EXTRA_MS : 0);

/**
 * G-REX's fire after the crowd's move: a piece left on a tile ablaze burns (or the tile fizzles under the king) as the
 * boss's turn begins. The boss's move waits for it (at least this long after the crowd's move), solo and online.
 */
export const FIRE_BURN_MS = 1500;

/** How long a turn's power moments take, one after another. */
export function powerMomentMs(events: readonly { kind: keyof typeof POWER_FX; first?: boolean }[] | null | undefined): number {
  return (events ?? []).reduce((t, e) => t + powerFxMs(e), 0);
}

/**
 * Hollow's Lights out, beat by beat (ms from its start), the same for the server and every screen. Nobody's clock runs.
 *   0          "LIGHTS OUT!" (his banner) and his line, "It's time."
 *   dropAt     he drops onto the board's top edge (his `lightsOut`) and smashes his three bulbs: the board dims a step at
 *              each, night at the last.
 *   rounds     each round: his prompt ("Find my queen."), its seconds to tap (BOSS_POWERS.lightsOutRounds) and the
 *              usual late grace; then the answers show (`answerMs`) and the night closes over them again.
 *   backAt     the lights come back (his `lightsBack`: a fresh strand from the void, the dawn spreading from his spot),
 *              he returns to his corner (`backMs`), and his turn goes on: he plays his move.
 */
export const LIGHTS_OUT = { dropAt: 1300, dropMs: 2900, gapMs: 300, answerMs: 1800, backMs: 2300 } as const;

/** Lights out's beats for its rounds' seconds (`ms` each) and the late grace on each round. */
export function lightsOutTimeline(rounds: readonly { ms: number }[], graceMs: number) {
  let t = LIGHTS_OUT.dropAt + LIGHTS_OUT.dropMs + LIGHTS_OUT.gapMs;
  const out = rounds.map((r) => {
    const round = { at: t, until: t + r.ms, answersAt: t + r.ms + graceMs };
    t = round.answersAt + LIGHTS_OUT.answerMs;
    return round;
  });
  return { rounds: out, backAt: t, total: t + LIGHTS_OUT.backMs };
}

/**
 * The God King acting from his spot by the board (Eric, Oct 9, 2026), ms after he starts: he raises his sword where he
 * stands (`raiseAt`), his cut-in banner plays (`cutAt`, for `cutMs`), then his bolt leaves the blade for the piece he
 * moves (`boltAt`; the move plays at `moveAt`), or a bolt and a slash land on the boss's king three times (`slashAt`).
 * He lowers his sword at `lowerAt` (a move) or `strikeLowerAt` (a strike). The reveal where he plays the move lasts
 * `moveMs` longer (solo and online); a strike stops the clock for settings.kingStrikeMs, which covers it.
 */
export const KING_COMMAND = {
  raiseAt: 0,
  cutAt: 300,
  cutMs: 1500,
  boltAt: 2000,
  moveAt: 2350,
  lowerAt: 2900,
  slashAt: [2050, 2500, 2950] as readonly number[],
  strikeLowerAt: 3400,
  moveMs: 1700,
} as const;

/**
 * The old way, kept for later behind settings.kingOnBoard: summoned onto your king's square. Bolts converge, a beam,
 * he appears (`appearAt`), raises his sword with his cut-in (`raiseAt`), bolts the piece (`boltAt`; it moves at
 * `moveAt`, walking with a king move) or slashes the boss's king (`slashAt`), and holy light takes him off at the
 * end. The reveal lasts `moveMs` longer; a strike stops the clock for `strikeMs`.
 */
export const KING_SUMMON = {
  appearAt: 1300,
  raiseAt: 1550,
  cutAt: 1550,
  cutMs: 1500,
  boltAt: 3250,
  moveAt: 3600,
  slashAt: [3300, 3750, 4200] as readonly number[],
  strikeMs: 5900,
  moveMs: 5400,
} as const;

/** How much longer the reveal lasts when the God King plays the move. */
export const kingMoveMs = (s: { kingOnBoard?: boolean }): number => (s.kingOnBoard ? KING_SUMMON.moveMs : KING_COMMAND.moveMs);
/** How long the clock stands still while the God King strikes the boss. */
export const kingStrikeMs = (s: { kingOnBoard?: boolean; kingStrikeMs: number }): number => (s.kingOnBoard ? KING_SUMMON.strikeMs : s.kingStrikeMs);

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
