import { SQUADS, type SquadsSettings } from "@chessroyale/core";
import type { MoveScore } from "../uci.ts";
import { allowedMoves } from "./blocks.ts";
import type { Colour, Side } from "./board.ts";

/**
 * Pairs' same-move tokens (Eric, Oct 12). Each squad has `tokens.perMatch` a Pairs match. Partners who both pick the
 * same move while their squad has one get it played (no coin), and a token is burned. After the move the judge (the
 * bot engine's top moves for the position, worked out on players' devices as for the bots) decides a refund: the move
 * was the only real one if it was the best and every other legal move was worse by at least `tokens.refundGap` of
 * expected score. No judge, no refund. The rules only weigh the judge's numbers; they never ask an engine.
 */

/** One token burned: where, by whom, the move, and (once the judge has answered) the verdict. */
export interface TokenUse {
  turn: number;
  half: Colour;
  board: number;
  side: Side;
  players: readonly string[];
  move: string;
  /** The position the move was chosen in (what the judge looks at). */
  fen: string;
  /** Blocks in effect then: those moves weren't theirs to play, so the judge leaves them out. */
  blocked: readonly string[];
  /** Null while the judge is still to answer. */
  verdict: TokenVerdict | null;
}

/**
 * The judge's verdict on a token use, with its numbers in pawns' worth (expected score over `tokens.pawnWorth`, one
 * decimal), for the post-match breakdown:
 * - only_move: refunded; every other move lost at least `pawns` (`rival`: the next best, when the judge listed one);
 * - close: kept; `rival` was within `pawns` (`mate`: it mates too);
 * - better: kept; `rival` was better by `pawns` (`atLeast`: the move wasn't among the judge's lines at all);
 * - unranked: kept; the judge's lines held no other move to compare with, and the gap to its last line was too small;
 * - no_judge: kept; no device could judge it in time.
 */
export interface TokenVerdict {
  refunded: boolean;
  why: "only_move" | "close" | "better" | "unranked" | "no_judge";
  rival?: string;
  pawns?: number;
  mate?: true;
  atLeast?: true;
}

/** An expected-score gap in pawns' worth, one decimal. */
export const pawnsWorth = (gap: number, s: SquadsSettings = SQUADS) => Math.round((Math.max(0, gap) / s.tokens.pawnWorth) * 10) / 10;

/**
 * The judge's verdict on a token use, from its top moves for the position (best first or not: the best is the line
 * with the highest score). Null top: the judge wasn't available. Moves a block took away aren't counted.
 */
export function judgeTokenUse(use: Pick<TokenUse, "fen" | "move" | "blocked">, top: readonly MoveScore[] | null, s: SquadsSettings = SQUADS): TokenVerdict {
  if (!top?.length) return { refunded: false, why: "no_judge" };
  const allowed = new Set(allowedMoves(use.fen, use.blocked));
  const lines = top.filter((t) => allowed.has(t.move)).sort((a, b) => b.expected - a.expected);
  const floor = Math.min(...top.map((t) => t.expected));
  const mine = lines.find((t) => t.move === use.move);
  const best = lines[0];
  if (!mine) {
    // Not among the judge's lines: every one of them was better (by at least the gap to its last line).
    return best ? { refunded: false, why: "better", rival: best.move, pawns: pawnsWorth(best.expected - floor, s), atLeast: true } : { refunded: false, why: "no_judge" };
  }
  if (best && best.move !== mine.move && best.expected > mine.expected) return { refunded: false, why: "better", rival: best.move, pawns: pawnsWorth(best.expected - mine.expected, s) };
  const next = lines.find((t) => t.move !== use.move);
  if (next) {
    const gap = mine.expected - next.expected;
    if (gap >= s.tokens.refundGap - 1e-9) return { refunded: true, why: "only_move", rival: next.move, pawns: pawnsWorth(gap, s) };
    return { refunded: false, why: "close", rival: next.move, pawns: pawnsWorth(gap, s), ...(next.mate !== undefined && next.mate > 0 ? { mate: true as const } : {}) };
  }
  // No other move in the judge's lines (the rest were blocked, or ranked below its last line).
  const gap = mine.expected - floor;
  if (top.length > 1 && gap >= s.tokens.refundGap - 1e-9) return { refunded: true, why: "only_move", pawns: pawnsWorth(gap, s) };
  return { refunded: false, why: "unranked" };
}
