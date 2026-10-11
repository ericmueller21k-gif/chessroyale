// Maia box (AGPL-3.0, see LICENSE): from the model's raw output to moves with probabilities, and the official
// engine's way of choosing one (maia3/uci.py sample_from_logits: temperature, then nucleus "top-p").
import { moveIndex } from "./encode.ts";

export interface MoveProb {
  move: string;
  /** Maia's probability for it among the moves considered (they sum to 1). */
  p: number;
  logit: number;
}

/** The given moves (legal ones, UCI) with Maia's probabilities: a softmax over just these, most likely first. */
export function policy(logits: ArrayLike<number>, moves: readonly string[], black: boolean): MoveProb[] {
  const ls = moves.map((move) => ({ move, logit: logits[moveIndex(move, black)] ?? -Infinity }));
  if (!ls.length) return [];
  const max = Math.max(...ls.map((m) => m.logit));
  let z = 0;
  for (const m of ls) z += Math.exp(m.logit - max);
  return ls.map((m) => ({ move: m.move, logit: m.logit, p: Math.exp(m.logit - max) / z })).sort((a, b) => b.p - a.p || (a.move < b.move ? -1 : 1));
}

/**
 * One move drawn as the official engine draws it: temperature 0 (or less) is the most likely move; otherwise
 * probabilities from logits / temperature, cut to the smallest set of the likeliest whose running total stays within
 * topP (always at least the first), and one drawn from those. `rand` gives numbers in [0, 1).
 */
export function sample(moves: readonly MoveProb[], temperature: number, topP: number, rand: () => number): string | null {
  if (!moves.length) return null;
  if (!(temperature > 0)) return moves[0]!.move;
  const max = Math.max(...moves.map((m) => m.logit));
  const w = moves.map((m) => Math.exp((m.logit - max) / temperature));
  const z = w.reduce((a, b) => a + b, 0);
  const probs = moves.map((m, i) => ({ move: m.move, p: w[i]! / z })).sort((a, b) => b.p - a.p);
  let kept = probs;
  if (topP < 1) {
    let total = 0;
    kept = probs.filter((m, i) => {
      total += m.p;
      return i === 0 || total <= topP;
    });
  }
  const sum = kept.reduce((a, m) => a + m.p, 0);
  let r = rand() * sum;
  for (const m of kept) {
    r -= m.p;
    if (r < 0) return m.move;
  }
  return kept[kept.length - 1]!.move;
}

/** A small seeded random source (mulberry32), for repeatable draws (the Seed option). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
