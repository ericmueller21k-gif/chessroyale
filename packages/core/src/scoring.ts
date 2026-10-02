import type { Rng } from "./rng.ts";
import { DEFAULT_SETTINGS, type Settings } from "./settings.ts";

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
}

export interface GroupResult {
  players: PlayerRoundResult[];
  /** Average loss over the players who picked (null if nobody did). */
  averageLoss: number | null;
  /** The move played on the board. */
  playedMove: string;
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

export function scoreGroup(
  picks: readonly Pick[],
  evaluation: GroupEvaluation,
  rng: Rng,
  settings: Settings = DEFAULT_SETTINGS,
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
  const playedMove = picked.length ? picked[Math.floor(rng() * picked.length)]!.move! : evaluation.bestMove;
  return { players, averageLoss, playedMove, drawOdds: drawOdds(picks) };
}

/** A round is dead when every pick in the group is within `margin` points of the others. */
export function isDeadRound(result: GroupResult, margin = 1): boolean {
  const losses = result.players.flatMap((p) => (p.loss === null ? [] : [p.loss]));
  if (losses.length < 2) return false;
  return Math.max(...losses) - Math.min(...losses) <= margin;
}
