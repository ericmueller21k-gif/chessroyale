import type { Rng } from "./rng.ts";
import { DEFAULT_SETTINGS, OPENING_ALLOWANCE, type DrawRule, type Settings } from "./settings.ts";

/**
 * Scoring from buildspec.md. Expected scores are from the mover's side, 0 to 1
 * (win chance plus half the draw chance). Loss is measured in points, where
 * 1 point = 0.01 of expected score.
 */

/** How a pick gave up material against the best move (the opening allowance's fallback): see PlayerRoundResult.material. */
export type MaterialSlip = "missed" | "gave";

/** The opening allowance for one picked move: points off its loss, or none because it gave up material. */
export interface Allowance {
  points: number;
  material?: MaterialSlip;
}

/** One player's pick in a group: a move (UCI) or null for a miss. */
export interface Pick {
  playerId: string;
  move: string | null;
}

export interface GroupEvaluation {
  /** Expected score after the engine's best move. */
  bestExpected: number;
  bestMove: string;
  /** Expected score after each picked move (keyed by move). */
  expectedAfter: Readonly<Record<string, number>>;
}

export interface PlayerRoundResult {
  playerId: string;
  move: string | null;
  /** Points given away versus the best move (raw: the board's draw, brilliance, fair play and ratings use it); null for a miss. */
  loss: number | null;
  /**
   * The loss that counts for points: the raw loss less the opening allowance (never below 0). Set only when the
   * allowance took something off; otherwise it's the raw loss.
   */
  counted?: number;
  /**
   * The opening allowance applied on this move but not to this pick: it gave up material against the best move ("gave":
   * it left something to be taken; "missed": it passed up a capture that won material). Its whole loss counts.
   */
  material?: MaterialSlip;
  roundScore: number;
  /** Called the King (boss battle) instead of picking: no score either way, and not a miss. */
  abstained?: boolean;
  /** Used a power-up (saw the engine's top moves) this round: the pick can't count as brilliant. */
  usedPowerUp?: boolean;
}

export interface GroupResult {
  players: PlayerRoundResult[];
  /** Average counted loss over the players who picked (null if nobody did): what each round score is measured from. */
  averageLoss: number | null;
  /** The move played on the board. */
  playedMove: string;
  /** How it was chosen. */
  drawRule: DrawRule;
  /** Chance each distinct move had of being drawn. */
  drawOdds: Record<string, number>;
}

/**
 * The board's best move: the engine's choice, unless a pick scored above it, which then is the best (the highest-scored
 * such pick; a tie keeps the engine's choice, and between equal picks the first by name). Every loss is measured from
 * the highest number (moveLosses), so the move that has it is the best everywhere: the reveal, the God King's move, the
 * exchange check and the re-check's anchor. Every judge runs this on the same numbers, so they agree exactly
 * (docs/decisions/2026-10-16-the-best-move-is-the-highest-scored.md).
 */
export function bestOf<E extends GroupEvaluation>(evaluation: E, picks: readonly (string | null | undefined)[]): E {
  let { bestMove, bestExpected } = evaluation;
  for (const m of [...new Set(picks)].sort()) {
    const e = m ? evaluation.expectedAfter[m] : undefined;
    if (e !== undefined && e > bestExpected) [bestMove, bestExpected] = [m!, e];
  }
  return bestMove === evaluation.bestMove ? evaluation : { ...evaluation, bestMove, bestExpected };
}

/**
 * Loss of each picked move. If a pick evaluates above the engine's own choice,
 * that pick is treated as the best (bestOf), so loss is never negative.
 */
export function moveLosses(evaluation: GroupEvaluation, moves: readonly string[]): Record<string, number> {
  let best = evaluation.bestExpected;
  for (const m of moves) best = Math.max(best, evaluation.expectedAfter[m] ?? -Infinity);
  const out: Record<string, number> = {};
  for (const m of moves) {
    const e = evaluation.expectedAfter[m];
    if (e === undefined) throw new Error(`No evaluation for move ${m}`);
    out[m] = Math.max(0, (best - e) * 100);
  }
  return out;
}

/** Each pick is one ticket; a move picked by two players has twice the chance. */
export function drawOdds(picks: readonly Pick[]): Record<string, number> {
  const moves = picks.flatMap((p) => (p.move ? [p.move] : []));
  const odds: Record<string, number> = {};
  for (const m of moves) odds[m] = (odds[m] ?? 0) + 1 / moves.length;
  return odds;
}

/** The draw rule for a stage: its entry in drawRuleByStage, or the last entry. */
export function drawRuleFor(stage: number, settings: Settings = DEFAULT_SETTINGS): DrawRule {
  const rules = settings.drawRuleByStage;
  return rules[Math.min(stage, rules.length - 1)] ?? "random";
}

/** Picks the move that continues the board, from the moves picked (one entry per pick) and their losses. */
export function drawMove(
  moves: readonly string[],
  losses: Readonly<Record<string, number>>,
  rule: DrawRule,
  rng: Rng,
  settings: Settings = DEFAULT_SETTINGS,
): string {
  const among = (xs: readonly string[]) => xs[Math.floor(rng() * xs.length)]!;
  const distinct = [...new Set(moves)];
  if (rule === "popular") {
    const count = (m: string) => moves.filter((x) => x === m).length;
    const top = Math.max(...distinct.map(count));
    return among(distinct.filter((m) => count(m) === top));
  }
  if (rule === "best") {
    const least = Math.min(...distinct.map((m) => losses[m]!));
    return among(distinct.filter((m) => losses[m]! - least < 1e-9));
  }
  if (rule === "weighted") {
    const weights = moves.map((m) => Math.exp(-losses[m]! / settings.drawWeightPoints));
    let r = rng() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < moves.length; i++) if ((r -= weights[i]!) <= 0) return moves[i]!;
    return moves[moves.length - 1]!;
  }
  return among(moves);
}

/** The opening allowance on move number `move` (the position's fullmove number): see OPENING_ALLOWANCE. */
export function openingAllowance(move: number, a: { points: number; flatThrough: number; goneBy: number } = OPENING_ALLOWANCE): number {
  if (move <= a.flatThrough) return a.points;
  if (move >= a.goneBy) return 0;
  return (a.points * (a.goneBy - move)) / (a.goneBy - a.flatThrough);
}

/** The loss a result counts for points: `counted` when the opening allowance took something off, else the raw loss. */
export const countedOf = (p: { loss: number | null; counted?: number }) => p.counted ?? p.loss;

/**
 * Scores a group's picks. `allowance` gives the opening allowance for each picked move: points taken off its loss before
 * it counts for points, or none because it gave up material (the runner's: OPENING_ALLOWANCE on the game's move number,
 * and the exchange check). Left out: none. The board's draw, and every raw `loss`, are before it.
 */
export function scoreGroup(
  picks: readonly Pick[],
  evaluation: GroupEvaluation,
  rng: Rng,
  settings: Settings = DEFAULT_SETTINGS,
  rule: DrawRule = "random",
  allowance?: (move: string) => Allowance,
): GroupResult {
  const picked = picks.filter((p) => p.move !== null);
  const losses = moveLosses(
    evaluation,
    picked.map((p) => p.move!),
  );
  const off = new Map(picked.map((p) => [p.move!, allowance?.(p.move!) ?? { points: 0 }]));
  const counted = (m: string) => Math.max(0, losses[m]! - off.get(m)!.points);
  const averageLoss = picked.length ? picked.reduce((s, p) => s + counted(p.move!), 0) / picked.length : null;
  const players = picks.map((p): PlayerRoundResult => {
    if (p.move === null) return { playerId: p.playerId, move: null, loss: null, roundScore: settings.missedMoveScore };
    const loss = losses[p.move]!;
    const c = counted(p.move);
    const material = off.get(p.move)!.material;
    return { playerId: p.playerId, move: p.move, loss, ...(c !== loss ? { counted: c } : {}), ...(material ? { material } : {}), roundScore: averageLoss! - c };
  });
  const playedMove = picked.length
    ? drawMove(
        picked.map((p) => p.move!),
        losses,
        rule,
        rng,
        settings,
      )
    : evaluation.bestMove;
  return { players, averageLoss, playedMove, drawRule: rule, drawOdds: drawOdds(picks) };
}

/** A round is dead when every pick in the group is within `margin` points of the others. */
export function isDeadRound(result: GroupResult, margin = 1): boolean {
  const losses = result.players.flatMap((p) => (p.loss === null ? [] : [p.loss]));
  if (losses.length < 2) return false;
  return Math.max(...losses) - Math.min(...losses) <= margin;
}

/** What makes a move brilliant (see `brilliance`). The FAQ quotes these, so change them here only. */
export const BRILLIANT = { minPickers: 6, nearBest: 1.5, maxShare: 0.2, minGap: 8 } as const;

/**
 * A brilliant move: one that separated the field. Among at least `minPickers` picks, the moves within
 * `nearBest` points of the best were found by at most `maxShare` of the pickers, and everyone else gave away
 * `minGap` points or more on average. The players who found it (without a power-up, which shows the engine's
 * moves) played brilliantly. Null when nothing separated the field.
 */
export function brilliance(
  players: readonly { playerId: string; move: string | null; loss: number | null; usedPowerUp?: boolean }[],
  opts: { minPickers?: number; nearBest?: number; maxShare?: number; minGap?: number } = {},
): { moves: string[]; players: string[]; found: number; total: number; othersLoss: number } | null {
  const { minPickers = BRILLIANT.minPickers, nearBest = BRILLIANT.nearBest, maxShare = BRILLIANT.maxShare, minGap = BRILLIANT.minGap } = opts;
  const picked = players.filter((p) => p.move !== null && p.loss !== null);
  if (picked.length < minPickers) return null;
  const good = picked.filter((p) => p.loss! <= nearBest);
  const rest = picked.filter((p) => p.loss! > nearBest);
  if (!good.length || !rest.length || good.length > maxShare * picked.length) return null;
  const othersLoss = rest.reduce((s, p) => s + p.loss!, 0) / rest.length;
  if (othersLoss < minGap) return null;
  return {
    moves: [...new Set(good.map((p) => p.move!))],
    players: good.filter((p) => !p.usedPowerUp).map((p) => p.playerId),
    found: good.length,
    total: picked.length,
    othersLoss,
  };
}
