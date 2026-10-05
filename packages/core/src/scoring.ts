import type { Rng } from "./rng.ts";
import { DEFAULT_SETTINGS, type DrawRule, type Settings } from "./settings.ts";

/**
 * Scoring from buildspec.md. Expected scores are from the mover's side, 0 to 1
 * (win chance plus half the draw chance). Loss is measured in points, where
 * 1 point = 0.01 of expected score.
 */

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
  /** Points given away versus the best move; null for a miss. */
  loss: number | null;
  roundScore: number;
  /** Called the King (boss battle) instead of picking: no score either way, and not a miss. */
  abstained?: boolean;
  /** Used a power-up (saw the engine's top moves) this round: the pick can't count as brilliant. */
  usedPowerUp?: boolean;
}

export interface GroupResult {
  players: PlayerRoundResult[];
  /** Average loss over the players who picked (null if nobody did). */
  averageLoss: number | null;
  /** The move played on the board. */
  playedMove: string;
  /** How it was chosen. */
  drawRule: DrawRule;
  /** Chance each distinct move had of being drawn. */
  drawOdds: Record<string, number>;
}

/**
 * Loss of each picked move. If a pick evaluates above the engine's own choice,
 * that pick is treated as the best, so loss is never negative.
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

export function scoreGroup(
  picks: readonly Pick[],
  evaluation: GroupEvaluation,
  rng: Rng,
  settings: Settings = DEFAULT_SETTINGS,
  rule: DrawRule = "random",
): GroupResult {
  const picked = picks.filter((p) => p.move !== null);
  const losses = moveLosses(
    evaluation,
    picked.map((p) => p.move!),
  );
  const averageLoss = picked.length ? picked.reduce((s, p) => s + losses[p.move!]!, 0) / picked.length : null;
  const players = picks.map((p) =>
    p.move === null
      ? { playerId: p.playerId, move: null, loss: null, roundScore: settings.missedMoveScore }
      : { playerId: p.playerId, move: p.move, loss: losses[p.move]!, roundScore: averageLoss! - losses[p.move]! },
  );
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
  const { minPickers = 6, nearBest = 1.5, maxShare = 0.2, minGap = 8 } = opts;
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
