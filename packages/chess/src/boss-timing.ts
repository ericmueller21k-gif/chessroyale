import { BOSS_BANNER } from "@chessroyale/core";
import { fenAtPly, gameEnd, pieceAt, sideToMove, type Base } from "./rules.ts";
import { GINGER_FX } from "./bosses/ginger.ts";
import { BOINGO_FX } from "./bosses/boingo.ts";
import { FIRE_BURN_MS, GREX_FX } from "./bosses/grex.ts";
import { CLAIM_MS, HOLLOW_FX, HOLLOW_FX_EXTRA } from "./bosses/hollow.ts";
import { BIGBOY_FX, SNACK_MS } from "./bosses/bigboy.ts";
import { SAWYER_FX } from "./bosses/sawyer.ts";
import { PIG_FX } from "./bosses/pig.ts";
import { RECLUSE_FX } from "./bosses/recluse.ts";
import { ALFIL_FX } from "./bosses/alfil.ts";
import { HOPPER_FX } from "./bosses/hopper.ts";

/**
 * Boss battle timing shared by the lobby server and the solo game, so a screen
 * and the clock that ends it agree.
 *
 * The intro: the boss's card (with the opening roulette in a raid) over the
 * starting position, then the game so far replayed quickly from the start, one
 * move at a time, then a fighting-game "START!" banner.
 */
export const BOSS_INTRO = { cardMs: 2600, replayMs: 2400, minStepMs: 110, maxStepMs: 260, bannerGapMs: 250, bannerMs: BOSS_BANNER.ms } as const;

/**
 * When each part of the intro happens (ms after it starts), for a game `plies` half-moves in. `claimed`: Hollow claims
 * the dark side after the card (`claimAt`), before "START!". `snack`: Big Boy eats the crowd's pawn then instead
 * (from `claimAt`, SNACK_MS).
 */
export function bossIntroTimeline(plies: number, claimed = false, snack = false) {
  const step = plies > 0 ? Math.max(BOSS_INTRO.minStepMs, Math.min(BOSS_INTRO.maxStepMs, BOSS_INTRO.replayMs / plies)) : 0;
  const replayAt = BOSS_INTRO.cardMs;
  const claimAt = replayAt + plies * step;
  const bannerAt = claimAt + (claimed ? CLAIM_MS : 0) + (snack ? SNACK_MS : 0) + BOSS_INTRO.bannerGapMs;
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
 * banner, the sweep across the board and the God King's line (each thaw after it: its banner and the ice melting
 * away); the funhouse (a screen of its own, after the move he
 * plays for the crowd): the clown pogos onto the board, it turns upside down, he speaks and the move lands (each later
 * step, `spin`: its banner, then the board turns again); the Roman candle: G-REX drops onto the board, slams the candle down and fires
 * its 24 shots (see the app's PowerMoment for the beats).
 */
export const POWER_FX = { warn: 1700, ...GINGER_FX, ...BOINGO_FX, ...GREX_FX, ...HOLLOW_FX, ...BIGBOY_FX, ...SAWYER_FX, ...PIG_FX, ...RECLUSE_FX, ...ALFIL_FX, ...HOPPER_FX } as const;

/** How long one power's moment holds the screen (ms). */
export const powerFxMs = (e: { kind: keyof typeof POWER_FX; first?: boolean }): number => (POWER_FX[e.kind] ?? 0) + (POWER_FX_EXTRA[e.kind]?.(e) ?? 0);

/** A moment that can hold longer (Hollow's first cover of the dark): the extra ms, by its kind. */
const POWER_FX_EXTRA: Partial<Record<keyof typeof POWER_FX, (e: { first?: boolean }) => number>> = { ...HOLLOW_FX_EXTRA };

/** How long a turn's power moments take, one after another. */
export function powerMomentMs(events: readonly { kind: keyof typeof POWER_FX; first?: boolean }[] | null | undefined): number {
  return (events ?? []).reduce((t, e) => t + powerFxMs(e), 0);
}

/**
 * The God King acting from his spot by the board (Eric, Oct 9, 2026), ms after he starts: he raises his sword where he
 * stands (`raiseAt`), his cut-in banner plays (`cutAt`, for `cutMs`: 2.5 s, and everything after it a second later,
 * since every banner got a second longer, Eric, Oct 15), then his bolt leaves the blade for the piece he
 * moves (`boltAt`; the move plays at `moveAt`), or a bolt and a slash land on the boss's king three times (`slashAt`).
 * He lowers his sword at `lowerAt` (a move) or `strikeLowerAt` (a strike). The reveal where he plays the move lasts
 * `moveMs` longer (solo and online); a strike stops the clock for settings.kingStrikeMs, which covers it.
 */
export const KING_COMMAND = {
  raiseAt: 0,
  cutAt: 300,
  cutMs: 2500,
  boltAt: 3000,
  moveAt: 3350,
  lowerAt: 3900,
  slashAt: [3050, 3500, 3950] as readonly number[],
  strikeLowerAt: 4400,
  moveMs: 2700,
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
  cutMs: 2500,
  boltAt: 4250,
  moveAt: 4600,
  slashAt: [4300, 4750, 5200] as readonly number[],
  strikeMs: 6900,
  moveMs: 6400,
} as const;

/** How much longer the reveal lasts when the God King plays the move. */
export const kingMoveMs = (s: { kingOnBoard?: boolean }): number => (s.kingOnBoard ? KING_SUMMON.moveMs : KING_COMMAND.moveMs);
/** How long the clock stands still while the God King strikes the boss. */
export const kingStrikeMs = (s: { kingOnBoard?: boolean; kingStrikeMs: number }): number => (s.kingOnBoard ? KING_SUMMON.strikeMs : s.kingStrikeMs);

/** Alone: how long the boss's move shows before your turn (the piece's slide, and a beat). */
export const BOSS_MOVE_ALONE_MS = 450;

/** What queenSlain reads: the sides, the crowd's turn, Big Boy's last bounce, the turn's events, and the board's moves (a boss's view). */
export interface QueenSlainView {
  crowdSide: "w" | "b";
  crowdMoves: number;
  powers?: { bounce?: { at: number } | null; hop?: { at: number } | null; events?: readonly { kind: string }[]; fusion?: { at: number; why?: string } | null } | null;
  board: { history: readonly string[]; bases?: readonly Base[] | null };
}

/**
 * What a boss's turn can begin with before his move (Alfil's cast and Slam, each its own screen; his fusion that found
 * no square, no screen): once one has played, the turn's thinking is a second one. (His fusion that landed was his
 * move, as the crowd's turn began: not one of these.)
 */
const HIS_TURN_STEPS: readonly string[] = ["tusks", "slam"];
const hisStepPlayed = (boss: { crowdMoves: number; powers?: { events?: readonly { kind: string }[]; fusion?: { at: number; why?: string } | null } | null }): boolean =>
  !!boss.powers?.events?.some((e) => HIS_TURN_STEPS.includes(e.kind)) || (boss.powers?.fusion?.at === boss.crowdMoves && boss.powers.fusion.why === "nowhere");

/**
 * The crowd's move has just taken the boss's queen: "QUEEN SLAIN!" plays while he thinks, and he thinks at least as
 * long (bossThinkMs). Only the crowd's own capture of his queen (never his capture of yours: Hollow thinks again after
 * his own move for his extra move), and only in the thinking straight after it: once Big Boy's Big Bounce, or one of
 * Alfil's steps (his cast, the fusion, the Slam), or the hopper's hop, has played between that move and his (his turn's
 * second thinking, the same last move), it's old news (Eric, Oct 16: the banner flashed up again for a second after his
 * bounce).
 */
export function queenSlain(boss: QueenSlainView): boolean {
  const { history, bases } = boss.board;
  const m = history[history.length - 1];
  if (!m || boss.powers?.bounce?.at === boss.crowdMoves || boss.powers?.hop?.at === boss.crowdMoves || hisStepPlayed(boss)) return false;
  const taken = pieceAt(fenAtPly(history, history.length - 1, bases), m.slice(2, 4));
  return taken?.type === "q" && taken.color !== boss.crowdSide;
}

/**
 * The boss thinks for at least this long; longer when the crowd has just taken its queen (queenSlain: your banner
 * plays first, and a beat after it), when G-REX's fire has just burnt (`burnt`: it plays first), or when something of
 * the boss's own played after the crowd's move (`afterMs`: Alfil's pieces coming down early, landedEarly).
 */
export function bossThinkMs(boss: QueenSlainView, burnt = false, afterMs = 0): number {
  return Math.max(queenSlain(boss) ? BOSS_BANNER.ms + 500 : 1200, burnt ? FIRE_BURN_MS : 0, afterMs);
}

/**
 * Alfil's Slam: its pieces came down early after the crowd's move just played (he had a mate in one only while they
 * were up): their landing plays before his turn goes on (the ms his first thinking waits for it; 0: none, or a step of
 * his has played since).
 */
export const landedEarlyMs = (boss: { crowdMoves: number; powers?: { landed?: { early?: true; at: number } | null; events?: readonly { kind: string }[]; fusion?: { at: number; why?: string } | null } | null } | null | undefined): number =>
  boss?.powers?.landed?.early && boss.powers.landed.at === boss.crowdMoves && !hisStepPlayed(boss) ? POWER_FX.land : 0;

/**
 * The God King's Last Stand, beat by beat (ms after the crowd's disastrous move lands on the board). The reveal
 * where it happens lasts LAST_STAND_MS longer, solo and online; the next move's clock only starts after it, so
 * nobody loses any time.
 *
 * 0. The warning (`warnMs` long): a red "??" badge pops on the piece's square (`badgeAt`), the square pulses red,
 *    a danger sting plays, the eval bar plunges to the crowd's chances after the move, and the dock says in plain
 *    words what it loses ("?? Blunder: Nb5 / Loses your knight").
 * 1. Everything freezes (`freezeAt`): the board goes cold and gray, under a dark red pulse.
 * 2. He leaps up out of the dock (`leapAt`), out of view, and crashes down onto the piece's square (`fallAt`,
 *    landing at `crashAt`): a dark red shockwave, dust, the board shakes.
 * 3. The "LAST STAND" cut-in with his battle-worn portrait and one of his lines (`bannerAt`, for `bannerMs`).
 * 4. The piece slides back to the square it came from (`slideAt`); he stands alone where it was. The eval bar
 *    goes back to what it was before the move.
 * 5. The blow meant for it: `slashes` rapid slashes, one every `slashEveryMs` from `slashAt`, each with a red
 *    damage number; his armor cracks (`crackAt`), grunts of agony, a few stylized red drops.
 * 6. He staggers (`staggerAt`), collapses (`collapseAt`) and fades from the board (`fadeAt`, for `fadeMs`);
 *    his fallen figure lies in the dock from then on, with his last words (and his leftover charges, as power-ups).
 * 7. At `endMs` the reveal ends: the crowd picks again with a fresh clock.
 *
 * Beats 1 to 7 are as they were before the warning, all `warnMs` later. Since Oct 15 (Eric: every banner a second
 * longer) the cut-in holds 3.1 s, not 2.1, and beats 4 to 7 come a second later, so it still ends before the slide.
 */
const LS_WARN_MS = 1300;
const after = (ms: number) => LS_WARN_MS + ms;
/**
 * With a boss whose character has a `kingAttack` (KING_ATTACKERS; Hollow, Eric, Oct 10), beat 5 is the boss's attack:
 * from `attackAt` (just as the piece starts sliding back) he drops in beside the God King and lashes him
 * (KING_ATTACK: the blows land on its lashes, `lastStandAttackHits`), then leaps off as the God King staggers. The
 * Last Stand lasts no longer: the attack fits between the slide and the stagger.
 */
export const LAST_STAND = {
  badgeAt: 80,
  warnMs: LS_WARN_MS,
  freezeAt: after(250),
  leapAt: after(650),
  fallAt: after(1150),
  crashAt: after(1400),
  bannerAt: after(1950),
  bannerMs: 3100,
  slideAt: after(5150),
  slashAt: after(5650),
  slashes: 25,
  slashEveryMs: 80,
  attackAt: after(5250),
  crackAt: [after(6050), after(6650), after(7250)] as readonly number[],
  staggerAt: after(7800),
  collapseAt: after(8250),
  fadeAt: after(8800),
  fadeMs: 500,
  endMs: after(9600),
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

/**
 * A boss's attack on a king (its character's `kingAttack` moment), ms after it starts: the same beats for every boss
 * that has one, so the God King's frames, the hit numbers, the sounds and the server's clock agree. His shadow grows
 * and he drops in beside the king (`landAt`), winds up, then lashes it `lashes` times, the first at `lashAt` and one
 * every `lashEveryMs` (a hit each: a "−N" pops off the king), cackles, leaps off at `leaveAt` and is gone at `ms`.
 *
 * Where it plays: the God King's Last Stand (from LAST_STAND.attackAt, on the God King: the blow meant for the piece)
 * and the boss's mate (from `mateAt` after its move shows, on the crowd's king, which flickers at each lash, then
 * topples at the last (`toppleAt`, for `toppleMs`) and fades into the dark; the result waits `mateHoldMs` in all).
 */
export const KING_ATTACK = {
  landAt: 470,
  lashAt: 560,
  lashes: 10,
  lashEveryMs: 170,
  leaveAt: 2380,
  ms: 2780,
  mateAt: 600,
  toppleAt: 2180,
  toppleMs: 600,
  mateHoldMs: 600 + 2780 + 500,
} as const;

/** When each of the attack's lashes lands, ms after it starts. */
export const kingAttackHits = (): number[] => Array.from({ length: KING_ATTACK.lashes }, (_, i) => KING_ATTACK.lashAt + i * KING_ATTACK.lashEveryMs);

/** The Last Stand's blows when a boss attacks the God King: its lashes, ms after the crowd's move lands. */
export const lastStandAttackHits = (): number[] => kingAttackHits().map((t) => LAST_STAND.attackAt + t);

/**
 * The bosses whose character has a `kingAttack` (the app's BOSS_KITS: a unit test keeps the two the same), by
 * BOSS_ROSTER id, in the kits' order. Hollow first (Eric, Oct 10: to try it before the others get theirs); Alfil's ankus
 * jabs (Oct 17); Boingo's pies, Sawyer's saw and Wrangler's lasso (Eric, Oct 18); Ginger's cane, Jefferson's Roman
 * candle and Big Boy's lollipop (Eric, Oct 18); Chub & Chirp's carrots (Oct 18): every playable boss but the Hidden Boss.
 */
export const KING_ATTACKERS: readonly string[] = ["clown", "gingerbread", "grex", "hollow", "bigboy", "sawyer", "pig", "alfil", "hopper"];
export const hasKingAttack = (bossId: string | null | undefined): boolean => !!bossId && KING_ATTACKERS.includes(bossId);

/** The crowd is checkmated on this board (the boss's move mated it). */
export const crowdMated = (fen: string, crowdSide: "w" | "b"): boolean => sideToMove(fen) === crowdSide && gameEnd(fen, []) === "checkmate";

/** The boss's attack on the crowd's king plays now: its move has mated the crowd, and its character has the attack. */
export const mateAttackDue = (boss: { id?: string; crowdSide: "w" | "b"; board: { fen: string }; result?: string | null } | null | undefined): boolean =>
  !!boss && hasKingAttack(boss.id) && crowdMated(boss.board.fen, boss.crowdSide);

/**
 * How long the boss's move holds the screen before the crowd's turn (or the result), solo and online: its move (and its
 * banner if it took the queen), then its powers' moments; at a mate, its attack on the crowd's king if it has one, which
 * the result waits for (no powers come with a mate).
 */
export function bossTurnShowMs(view: { id?: string; crowdSide: "w" | "b"; board: { fen: string }; lastMove?: { captured?: string } | null; powers?: { events: readonly { kind: keyof typeof POWER_FX; first?: boolean }[] } } | null | undefined, alone = false): number {
  if (mateAttackDue(view)) return KING_ATTACK.mateHoldMs;
  return bossShowMs(view?.lastMove, alone) + powerMomentMs(view?.powers?.events);
}
