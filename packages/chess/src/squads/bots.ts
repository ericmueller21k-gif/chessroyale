import { DEFAULT_SETTINGS, SQUADS, botPick, type Candidate, type Rng, type SquadsSettings } from "@chessroyale/core";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import type { Colour } from "./board.ts";

/**
 * Squad bots: the existing bot engine (the engine's top moves, then `botPick` at the bot's skill: a temperature over
 * each move's loss) making Relay moves, pair picks (never the partner's), and the final's picks and blocks. The game's
 * rules never ask an engine; only a bot deciding what to play does, as in every other mode.
 */

/** The engine's top moves as candidates: each move's loss in points against the best (1 point = 0.01 expected score). */
export function candidatesFrom(top: readonly MoveScore[]): Candidate[] {
  const best = Math.max(...top.map((m) => m.expected));
  return top.map((m) => ({ move: m.move, loss: Math.max(0, (best - m.expected) * 100) }));
}

/** A squad bot's candidates in a position: the bot engine's top moves. */
export async function squadBotCandidates(engine: EngineLike, fen: string, s: SquadsSettings = SQUADS): Promise<Candidate[]> {
  return candidatesFrom(await engine.topMoves(fen, s.bots.candidates));
}

/** `botPick` among the moves not in `avoid` (if that leaves nothing legal, among them all). */
function pickAvoiding(rng: Rng, candidates: readonly Candidate[], skill: number, legal: readonly string[], avoid: ReadonlySet<string>): string {
  const open = legal.filter((m) => !avoid.has(m));
  if (!open.length) return botPick(rng, candidates, skill, legal, DEFAULT_SETTINGS);
  return botPick(rng, candidates.filter((c) => !avoid.has(c.move)), skill, open, DEFAULT_SETTINGS);
}

/** Relay: the bot's move. */
export function botRelayMove(rng: Rng, candidates: readonly Candidate[], skill: number, legal: readonly string[]): string {
  return pickAvoiding(rng, candidates, skill, legal, new Set());
}

/** Pairs: the bot's pick, never the move its partner has already picked. */
export function botPairPick(rng: Rng, candidates: readonly Candidate[], skill: number, legal: readonly string[], partnerPick: string | null): string {
  return pickAvoiding(rng, candidates, skill, legal, new Set(partnerPick ? [partnerPick] : []));
}

/**
 * The final: a picker's pick, never its partner's; and with `avoidBlockChance`, none of the blocks it can see (blocks
 * show live to everyone, unless the visibility setting hides them).
 */
export function botFinalPick(
  rng: Rng,
  candidates: readonly Candidate[],
  skill: number,
  legal: readonly string[],
  partnerPick: string | null,
  seenBlocks: readonly string[],
  s: SquadsSettings = SQUADS,
): string {
  const avoid = new Set(partnerPick ? [partnerPick] : []);
  if (seenBlocks.length && rng() < s.bots.avoidBlockChance) for (const b of seenBlocks) avoid.add(b);
  return pickAvoiding(rng, candidates, skill, legal, avoid);
}

/**
 * The final: a blocker's block, a move of the side to move that the bot thinks the pickers will want (the same
 * weighting as a pick: a strong bot blocks the best move), never its partner's block.
 */
export function botFinalBlock(rng: Rng, candidates: readonly Candidate[], skill: number, legal: readonly string[], partnerBlock: string | null): string {
  return pickAvoiding(rng, candidates, skill, legal, new Set(partnerBlock ? [partnerBlock] : []));
}

/** A bot's thinking time (ms): a random share of the move clock. */
export function botThinkShareMs(rng: Rng, paceSeconds: number, s: SquadsSettings = SQUADS): number {
  const [lo, hi] = s.bots.thinkShare;
  return Math.round((lo + rng() * (hi - lo)) * paceSeconds * 1000);
}

/** The colour a bot squad takes when it picks Armageddon's colours. */
export const botArmageddonColour = (s: SquadsSettings = SQUADS): Colour => s.bots.armageddonColour;
