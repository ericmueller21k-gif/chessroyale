/**
 * Boss powers: the dispatcher. Each boss's rules live in its own file (bosses/<boss>.ts, on the base boss in
 * bosses/base.ts, registered in bosses/index.ts); this file asks them, so the server, the solo game and every screen
 * work out the same thing for any boss: which moves the crowd (and the boss) may play this turn, what happens as a turn
 * begins, what each player sees, and whether a turn counts for fair play. It re-exports every boss's file, so the whole
 * package imports from here. The ground rules:
 *
 * - The server decides every power, from the battle's seed (drawn once, as it starts) and the position.
 * - A power never leaves anyone without a legal move and never breaks check: if a restriction would leave no legal
 *   move (or no escape from check), it lifts for that turn. The king is never frozen.
 * - The judge plays by the same rules: the best move is the best of the allowed ones (judge.ts, runner.ts).
 * - A turn the boss plays for the crowd (the funhouse) isn't scored; any turn a power touches doesn't count for
 *   fair play.
 *
 * Turns are the crowd's: turn N is the crowd's Nth move of the battle (crowdMoves + 1 while it's being picked).
 */
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent, type StopReason } from "@chessroyale/core";
import { legalMoves } from "./rules.ts";
import type { EngineLike } from "./runner.ts";
import type { MoveScore } from "./uci.ts";
import {
  bossPowers,
  heldIn,
  materialOf,
  moveLoss,
  moveSquares,
  other,
  powerRoll,
  rageNow,
  ragePoints,
  rageSpeedOf,
  rageTick,
  topEach,
  turnOf,
  unleashed,
  type Battle,
  type BossAsks,
  type BossLastMove,
  type BossRules,
  type JudgedEvaluation,
  type JudgedMove,
  type RageRates,
  type Side,
  type StopFields,
  type TurnContext,
} from "./bosses/base.ts";
import { bossRules } from "./bosses/index.ts";

// Every boss's file, and the shared pieces of the base boss, for the whole package.
export { bossPowers, heldIn, materialOf, moveLoss, moveSquares, powerRoll, rageNow, ragePoints, rageSpeedOf, rageTick, topEach, unleashed };
// (The pass guard: one rule for every power that spends his whole turn.)
export { PASS_WAIT, passAnswer, passLoses, passScores, type PassScore } from "./bosses/base.ts";
export type { Battle, BossAsks, BossLastMove, BossRules, JudgedEvaluation, JudgedMove, RageRates, StopFields, TurnContext };
export * from "./bosses/ginger.ts";
export * from "./bosses/boingo.ts";
export * from "./bosses/grex.ts";
export * from "./bosses/hollow.ts";
export * from "./bosses/bigboy.ts";
export * from "./bosses/sawyer.ts";
export * from "./bosses/pig.ts";
export * from "./bosses/recluse.ts";
export * from "./bosses/recluse-phase2.ts";
export * from "./bosses/alfil.ts";
export * from "./bosses/hopper.ts";
export * from "./bosses/carrots.ts";
export * from "./bosses/smudgy.ts";
export * from "./bosses/gardener.ts";
export * from "./bosses/tiger.ts";
export * from "./bosses/moo.ts";
export * from "./bosses/folio.ts";
export * from "./bosses/timber.ts";
export * from "./bosses/index.ts";

/** A battle's powers as it starts (nothing has happened yet; the first turn is set up by prepareTurn). */
export function initPowers(seed: number, fen: string, crowdSide: Side): BossPowerState {
  return { seed: seed >>> 0, turn: 0, material: materialOf(fen, other(crowdSide)), lost: 0, nextPassive: BOSS_POWERS.firstPassive, events: [] };
}

/**
 * As a crowd turn begins (after the boss's move, or as the battle starts): the rage meter, the ultimate's warning
 * and the ultimate, and the passive. `fen` is the position with the crowd to move. Once per turn: calling it again
 * for the same turn (the re-pick after the God King's Last Stand) changes nothing. `test`: an ultimate (the test switch)
 * warned as the second turn begins and unleashed on the third (the passive comes on the second turn anyway).
 * The test trigger (an admin's, `ultNext`) brings the ultimate as this turn begins, without the warning. `lastMove`: the
 * boss's move just played (Hollow covers its piece's square after his first).
 *
 * The meter is the same for every boss; the rest is the boss's own rules (BossRules), in this order: the ultimate
 * under way (still running: the meter stays empty; over: it clears, and the meter fills again from empty), what wore
 * off, the ultimate's step, anything every turn, then the passive (not on the turn the ultimate came, if it was due
 * then: it waits a turn).
 */
export function prepareTurn(boss: BossState, fen: string, test = "", s: BossPowerSettings = BOSS_POWERS, lastMove: string | null = null): BossState {
  const powers = bossPowers(boss);
  const p = boss.powers;
  const rules = bossRules(boss);
  if (!powers || !p || !rules) return boss;
  const turn = turnOf(boss);
  if (p.turn === turn) return boss;
  const crowd = boss.crowdSide;
  const events: PowerEvent[] = [];
  const lost = Math.max(p.lost, p.material - materialOf(fen, other(crowd)));
  // The meter over time: each crowd move since the last turn began, faster while the crowd is ahead on the judged eval.
  const moved = p.turn > 0 ? Math.max(0, turn - p.turn) : 0;
  const charge = (p.charge ?? 0) + moved * rageTick(p.judged, s);
  // (An ultimate at the start of the boss's turn keeps the test trigger until then.)
  const { ultNext, ...rest } = p;
  const next: BossPowerState = { ...rest, turn, lost, charge, events, ...(ultNext && (rules.ultimateOnHisTurn || rules.triggerAtHisTurn) ? { ultNext } : {}) };
  const t: TurnContext = { turn, fen, crowd, seed: p.seed, passive: powers.passive, ultimate: powers.ultimate, test, ultNext: !!ultNext, lastMove, rageSpeed: rageSpeedOf(boss.id, s), s, events };
  // The ultimate under way: while its effect runs, nothing gathers in the meter (it stays empty); once it's over, the
  // meter fills again from empty, and the next can come.
  if (next.ultAt !== undefined) {
    next.rageUsed = ragePoints(next, s);
    if (!(rules.ultimateRunning ? rules.ultimateRunning(next, turn, s) : turn <= next.ultAt)) {
      delete next.warnAt;
      delete next.ultAt;
    }
  }
  rules.wearOff?.(next, t);
  const before = next.ultAt;
  const ultNow = before === undefined ? rules.ultimate(next, t) : false;
  if (before === undefined && next.ultAt !== undefined) unleashed(next, s);
  rules.everyTurn?.(next, t);
  if (ultNow && turn >= next.nextPassive) next.nextPassive = turn + 1;
  else rules.passive(next, t);
  return { ...boss, powers: next };
}

/** An ultimate has come and its effect still runs (or it's its own turn): no rage gathers. */
export const ultimateUnderWay = (boss: Pick<BossState, "powers"> | null | undefined): boolean => boss?.powers?.ultAt !== undefined;

/**
 * The God King strikes the boss: a chunk of rage (BOSS_POWERS.rageStrike, at the boss's speed like every gain), unless
 * an ultimate is under way (it would be thrown away as the effect ends).
 */
export function strikeRage(boss: BossState, s: Pick<BossPowerSettings, "rageStrike"> = BOSS_POWERS): BossState {
  const p = boss.powers;
  // (A boss with a meter of its own, Wrangler: the strike adds nothing to it.)
  if (!p || !bossPowers(boss) || ultimateUnderWay(boss) || bossRules(boss)?.meter) return boss;
  return { ...boss, powers: { ...p, charge: (p.charge ?? 0) + s.rageStrike } };
}

// ---------------- The test trigger ----------------

/**
 * An admin's test trigger: the boss's ultimate comes as the next crowd turn begins, without the warning. Safe at any
 * moment: nothing happens if the boss has no ultimate, one is already under way (it never overlaps another) or on its
 * way, its once-a-battle ultimate has come (`ultimateOnce`: its `ultAt` is never cleared, as it stays under way), or the
 * battle is over; it only takes effect as a turn begins (prepareTurn), never in the middle of one or of a moment. Once
 * that ultimate's effect is over, it can be pulled again.
 */
export function triggerUltimate(boss: BossState | null | undefined): { boss: BossState | null | undefined; ok: boolean } {
  const p = boss?.powers;
  if (!boss || !p || !bossPowers(boss) || boss.result || p.ultAt !== undefined) return { boss, ok: false };
  if (p.ultNext) return { boss, ok: true };
  return { boss: { ...boss, powers: { ...p, ultNext: true } }, ok: true };
}

/**
 * The moves the crowd may play this turn, or null when every legal move is allowed. Frozen pieces can't move and
 * nobody can move onto the pie; in the blizzard only the pieces its ice doesn't hold move (Ginger's rules). The God
 * King's Last Stand bars the move he took back on top. Never empty: a restriction that would leave no legal move
 * lifts for the turn (and since only legal moves are counted, check is always answered).
 */
export function crowdAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const p = boss?.powers;
  const barred = boss?.barred;
  if (!p && !barred) return null;
  const legal = legalMoves(fen);
  let allowed = legal;
  if (p) {
    allowed = limitCrowd(bossRules(boss), boss!, fen, legal);
    if (!allowed.length) allowed = legal;
  }
  if (barred) {
    const open = allowed.filter((m) => m !== barred);
    allowed = open.length ? open : legal.filter((m) => m !== barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/**
 * The moves the boss may play (a pie stops it: nothing onto it; a toy block: nothing onto it or through it), or null
 * when every legal move is allowed. Never none: a restriction that would leave no move lifts.
 */
export function bossAllowed(boss: BossState | null | undefined, fen: string): string[] | null {
  const stops = boss ? (bossRules(boss)?.bossStops?.(boss) ?? null) : null;
  if (!stops) return null;
  const legal = legalMoves(fen);
  const allowed = legal.filter((m) => !stops(m, fen));
  return allowed.length && allowed.length < legal.length ? allowed : null;
}

/** A crowd move is allowed this turn. */
export const crowdMayPlay = (boss: BossState | null | undefined, fen: string, move: string): boolean => {
  const allowed = crowdAllowed(boss, fen);
  return allowed ? allowed.includes(move) : legalMoves(fen).includes(move);
};

/**
 * Which power stops `move` now, either side (Sawyer's saw, a pie, a toy block: BossRules.stopReason), for the screens'
 * words, or null. The match's state and the screens' view alike (the fields it reads are the same in both).
 */
export function stopReason(boss: { id?: string; powers?: StopFields | null } | null | undefined, fen: string, move: string): StopReason | null {
  return boss?.powers ? (bossRules(boss)?.stopReason?.(boss, fen, move) ?? null) : null;
}

/**
 * A power touches this crowd turn (a frozen piece, a pie, a toy block, the blizzard, a flipped board, fire): its picks
 * don't count as fair-play signals.
 */
export function powerTurn(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  return !!p && !!bossRules(boss)?.powerTurn?.(boss!);
}

/**
 * A boss's power has changed the board this crowd turn (`fen`: the crowd to move), so the God King's Last Stand sits out
 * (Eric, Oct 24: Babur's hoop stopped the recapture the plain-chess judge feared;
 * docs/decisions/2026-10-24-king-save-off-on-altered-boards.md). One rule for every boss, no list: a power touches the
 * turn (`powerTurn`, fair play's own test), something stops his moves (`bossStops`), something stops any of the crowd's
 * (`held`, `crowdFilter`), or something else of his is on the board (`altersBoard`: Hollow's dark, the Roman candle's shadows,
 * the carrots). `rules`: the boss's (a test's stand-in).
 */
export function boardAltered(boss: BossState | null | undefined, fen: string, rules: BossRules | null = bossRules(boss)): boolean {
  if (!boss?.powers || !rules) return false;
  if (rules.powerTurn?.(boss) || rules.bossStops?.(boss) || rules.altersBoard?.(boss)) return true;
  if (!rules.crowdFilter && !rules.held) return false;
  const legal = legalMoves(fen);
  return limitCrowd(rules, boss, fen, legal).length < legal.length;
}

/**
 * A boss's limits on the crowd's `legal` moves (none may be left: the caller lifts them): its held pieces first, one rule
 * for every boss (Eric, Oct 27): a held piece doesn't move, nor castles with a held rook (`heldIn`); then its other limits
 * (`crowdFilter`).
 */
export function limitCrowd(rules: Pick<BossRules, "held" | "crowdFilter"> | null | undefined, boss: BossState, fen: string, legal: string[]): string[] {
  if (!rules) return legal;
  const held = rules.held?.(boss, fen) ?? [];
  const free = held.length ? legal.filter((m) => !heldIn(fen, m, held)) : legal;
  return rules.crowdFilter ? rules.crowdFilter(free, boss, fen) : free;
}

/**
 * The squares that show ice: the frozen piece; in the blizzard the crowd's pieces its ice holds (every one but those
 * free), on the crowd's turn and through the boss's turn after it.
 */
export function icedSquares(boss: BossState | null | undefined, fen: string): string[] {
  const p = boss?.powers;
  if (!p || !boss) return [];
  return bossRules(boss)?.iced?.(boss, fen, crowdAllowed) ?? [];
}

/**
 * Its ultimate has come as often as a battle allows (`ultimateOnce`: once, Chub & Chirp's Carrot Patch; `ultimateMax`:
 * Smudgy's Repaint, twice): the meter is off from the turn after the last, and the admins' test trigger refuses.
 */
export function ultimateSpent(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  const rules = bossRules(boss);
  if (!p || !rules || p.ultAt === undefined) return false;
  return !!rules.ultimateOnce || (rules.ultimateMax !== undefined && (p.ults ?? 0) >= rules.ultimateMax);
}

/**
 * The rage meter, 0 to 1 (full: the warning, then the ultimate), null without powers. Full on the ultimate's own
 * turn; empty from then while its effect runs; then it fills again.
 */
export function rageOf(boss: BossState | null | undefined, s: RageRates = BOSS_POWERS): number | null {
  const p = boss?.powers;
  if (!p || !bossPowers(boss)) return null;
  // (A meter of its own: Wrangler's.)
  const own = bossRules(boss)?.meter;
  if (own) return own(p, turnOf(boss!), { ...BOSS_POWERS, ...s });
  // (Once a battle, Chub & Chirp's; Smudgy's last Repaint: from the turn after it, no meter.)
  if (p.ultAt !== undefined && ultimateSpent(boss) && turnOf(boss!) > p.ultAt) return null;
  if (p.ultAt !== undefined) return turnOf(boss!) <= p.ultAt ? 1 : 0;
  return Math.max(0, Math.min(1, rageNow(p, rageSpeedOf(boss!.id, s), s) / s.rageFull));
}

/** The meter is held empty: an ultimate came and its effect still runs (the screens show it paused). */
export const ragePaused = (boss: BossState | null | undefined): boolean => {
  const p = boss?.powers;
  return !!p && p.ultAt !== undefined && turnOf(boss!) > p.ultAt && !bossRules(boss)?.meter && !ultimateSpent(boss);
};

// ---------------- The judge plays by the same rules ----------------

/** What limits the crowd's moves in a judging job: the move the God King took back, and a power's allowed moves. */
export interface MoveLimits {
  barred?: string;
  allowed?: string[];
}

/** Whether the job lets the crowd play `move` (not the barred move; one of the allowed, when a power limits them). */
export function jobAllows(job: MoveLimits, move: string): boolean {
  return move !== job.barred && (!job.allowed || job.allowed.includes(move));
}

/**
 * The top moves the job may use: never the barred move, unless it's the only one; only allowed moves when a power
 * limits them (none of them in the top moves: empty, and the second search covers them all).
 */
export function judgeTop(job: MoveLimits, top: readonly MoveScore[]): MoveScore[] {
  const open = top.filter((m) => jobAllows(job, m.move));
  if (open.length || job.allowed) return open;
  return [...top];
}

/**
 * The scores the job's best move and bots' picks come from: the top moves it allows, or (a power left none of the
 * top moves) the second search over every allowed move, best first.
 */
export function judgeCandidates(job: MoveLimits, top: readonly MoveScore[], extra: readonly MoveScore[] = []): MoveScore[] {
  const t = judgeTop(job, top);
  if (t.length || !job.allowed) return t;
  // (Best first, ties by move: the same order whatever order the engine listed them in.)
  return extra.filter((m) => jobAllows(job, m.move)).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
}

/**
 * The moves the judge must score too this crowd turn, whatever the engine's top moves are (G-REX's fire: the ones that
 * save a piece from a tile ablaze). None without a boss, or for a boss whose rules don't ask.
 */
export function judgeMustScore(boss: BossState | null | undefined, fen: string): string[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.mustScore(boss!, fen) : [];
}

/** The moves the bots may pick this crowd turn besides the engine's top moves (BossRules.judge.offer: the race's pulls); none for most bosses. */
export function judgeOffers(boss: BossState | null | undefined, fen: string): string[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j?.offer ? j.offer(boss!, fen) : [];
}

/** Top moves as the judge ranks them this crowd turn under the boss's rules (for bots and hints), best first. */
export function judgeRanked(boss: BossState | null | undefined, top: readonly MoveScore[], fen: string): MoveScore[] {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.rank(boss!, top, fen) : [...top];
}

/** A board's evaluation as the judge sees it under the boss's rules (G-REX's fire: a piece left to burn counts as gone). */
export function judgeEvaluation<E extends JudgedEvaluation>(boss: BossState | null | undefined, evaluation: E, fen: string): E {
  const j = boss ? bossRules(boss)?.judge : undefined;
  return j ? j.evaluation(boss!, evaluation, fen) : evaluation;
}

/**
 * A power left none of the top moves open: one search over every allowed move (and any pick), whose best is the
 * best allowed move. Null when the top moves already hold an allowed one (or nothing limits the moves).
 */
export async function allowedSearch(engine: Pick<EngineLike, "scoreMoves">, job: MoveLimits & { fen: string; picks?: readonly string[] }, top: readonly MoveScore[]): Promise<MoveScore[] | null> {
  if (!job.allowed || judgeTop(job, top).length) return null;
  const have = new Set(top.map((m) => m.move));
  const moves = [...new Set([...job.allowed, ...(job.picks ?? [])].filter((m) => !have.has(m)))].sort();
  return engine.scoreMoves(job.fen, moves);
}
