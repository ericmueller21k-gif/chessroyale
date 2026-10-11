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
import { BOSS_POWERS, type BossPowerSettings, type BossPowerState, type BossState, type PowerEvent } from "@chessroyale/core";
import { legalMoves } from "./rules.ts";
import type { EngineLike } from "./runner.ts";
import type { MoveScore } from "./uci.ts";
import {
  bossPowers,
  materialOf,
  moveLoss,
  moveSquares,
  other,
  powerRoll,
  ragePoints,
  rageTick,
  turnOf,
  type Battle,
  type BossLastMove,
  type BossRules,
  type JudgedEvaluation,
  type RageRates,
  type Side,
  type TurnContext,
} from "./bosses/base.ts";
import { bossRules } from "./bosses/index.ts";

// Every boss's file, and the shared pieces of the base boss, for the whole package.
export { bossPowers, materialOf, moveLoss, moveSquares, powerRoll, ragePoints, rageTick };
export type { Battle, BossLastMove, BossRules, JudgedEvaluation, RageRates, TurnContext };
export * from "./bosses/ginger.ts";
export * from "./bosses/boingo.ts";
export * from "./bosses/grex.ts";
export * from "./bosses/hollow.ts";
export * from "./bosses/bigboy.ts";
export * from "./bosses/sawyer.ts";
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
 * The meter is the same for every boss; the rest is the boss's own rules (BossRules), in this order: what wore off,
 * the ultimate's step, anything every turn, then the passive (not on the turn the ultimate came, if it was due then:
 * it waits a turn).
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
  const next: BossPowerState = { ...rest, turn, lost, charge, events, ...(ultNext && rules.ultimateOnHisTurn ? { ultNext } : {}) };
  const t: TurnContext = { turn, fen, crowd, seed: p.seed, passive: powers.passive, ultimate: powers.ultimate, test, ultNext: !!ultNext, lastMove, s, events };
  rules.wearOff?.(next, t);
  const ultNow = next.ultAt === undefined ? rules.ultimate(next, t) : false;
  rules.everyTurn?.(next, t);
  if (ultNow && turn >= next.nextPassive) next.nextPassive = turn + 1;
  else rules.passive(next, t);
  return { ...boss, powers: next };
}

// ---------------- The test trigger ----------------

/**
 * An admin's test trigger: the boss's ultimate comes as the next crowd turn begins, without the warning. Safe at any
 * moment: nothing happens if the boss has no ultimate, it's spent or already on its way, or the battle is over; it
 * only takes effect as a turn begins (prepareTurn), never in the middle of one or of a moment.
 */
export function triggerUltimate(boss: BossState | null | undefined): { boss: BossState | null | undefined; ok: boolean } {
  const p = boss?.powers;
  if (!boss || !p || !bossPowers(boss) || boss.result || p.ultAt !== undefined) return { boss, ok: false };
  if (p.ultNext) return { boss, ok: true };
  return { boss: { ...boss, powers: { ...p, ultNext: true } }, ok: true };
}

/**
 * The moves the crowd may play this turn, or null when every legal move is allowed. Frozen pieces can't move and
 * nobody can move onto the pie; in the blizzard only the queen moves (no queen, or she can't: the king). The God
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
    const filter = bossRules(boss)?.crowdFilter;
    if (filter) allowed = filter(allowed, boss!, fen);
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
 * A power touches this crowd turn (a frozen piece, a pie, a toy block, the blizzard, a flipped board, fire): its picks
 * don't count as fair-play signals.
 */
export function powerTurn(boss: BossState | null | undefined): boolean {
  const p = boss?.powers;
  return !!p && !!bossRules(boss)?.powerTurn?.(boss!);
}

/** The squares that show ice: the frozen piece; in the blizzard every crowd piece but the one(s) still free to move. */
export function icedSquares(boss: BossState | null | undefined, fen: string): string[] {
  const p = boss?.powers;
  if (!p || !boss) return [];
  return bossRules(boss)?.iced?.(boss, fen, crowdAllowed) ?? [];
}

/** The rage meter, 0 to 1 (full: the warning, then the ultimate); null once the ultimate is spent. */
export function rageOf(boss: BossState | null | undefined, s: RageRates = BOSS_POWERS): number | null {
  const p = boss?.powers;
  if (!p || !bossPowers(boss)) return null;
  if (p.ultAt !== undefined && turnOf(boss!) > p.ultAt) return null;
  return Math.max(0, Math.min(1, ragePoints(p, s) / s.rageFull));
}

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
