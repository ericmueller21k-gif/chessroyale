import { DEFAULT_SETTINGS, SQUADS, botPick, type Candidate, type Rng, type SquadsSettings } from "@chessroyale/core";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import type { Colour } from "./board.ts";

/**
 * Squad bots: the existing bot engine (the engine's top moves, then `botPick` at the bot's skill: a temperature over
 * each move's loss) making Relay moves, pair picks (never the partner's), and the final's picks and blocks. The game's
 * rules never ask an engine; only a bot deciding what to play does, as in every other mode.
 */

/**
 * The engine's top moves as candidates: each move's loss in points against the best (1 point = 0.01 expected score).
 * In a won position every top move scores about 1, so moves the engine ranks lower lose `wonRankLoss` points a place
 * (its own order breaks the tie), and a mate it sees is played: a longer one loses `mateStepLoss` points a move, a
 * move without one `mateMissLoss`. Without this a winning bot wanders and games never end.
 */
export function candidatesFrom(top: readonly MoveScore[], s: SquadsSettings = SQUADS): Candidate[] {
  const best = Math.max(...top.map((m) => m.expected));
  const won = best >= s.bots.wonAt;
  const mates = top.flatMap((m) => (m.mate !== undefined && m.mate > 0 ? [m.mate] : []));
  const quickest = mates.length ? Math.min(...mates) : null;
  return top.map((m, rank) => {
    let loss = Math.max(0, (best - m.expected) * 100);
    if (won) loss = Math.max(loss, rank * s.bots.wonRankLoss);
    if (quickest !== null) loss = Math.max(loss, m.mate !== undefined && m.mate > 0 ? (m.mate - quickest) * s.bots.mateStepLoss : s.bots.mateMissLoss);
    return { move: m.move, loss };
  });
}

/** A bot's skill in this position: winning, it plays with purpose (its temperature at most `wonSkill`). */
export function squadBotSkill(top: readonly MoveScore[], skill: number, s: SquadsSettings = SQUADS): number {
  return Math.max(...top.map((m) => m.expected)) >= s.bots.wonAt ? Math.min(skill, s.bots.wonSkill) : skill;
}

/** A squad bot's candidates in a position: the bot engine's top moves. */
export async function squadBotCandidates(engine: EngineLike, fen: string, s: SquadsSettings = SQUADS): Promise<Candidate[]> {
  return candidatesFrom(await engine.topMoves(fen, s.bots.candidates), s);
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

/**
 * A bot's thinking time (ms): its bank over `movesToGo`, plus `incrementShare` of the increment, times a random factor
 * in `thinkRange`; at least `minThinkSeconds`, and never past its deadline (it always moves in time).
 */
export function squadBotThinkMs(rng: Rng, clock: { bankMs: number; incrementMs: number; deadlineMs: number }, s: SquadsSettings = SQUADS): number {
  const [lo, hi] = s.bots.thinkRange;
  const target = (clock.bankMs / s.bots.movesToGo + s.bots.incrementShare * clock.incrementMs) * (lo + rng() * (hi - lo));
  const ms = Math.max(s.bots.minThinkSeconds * 1000, target);
  return Math.round(Math.min(ms, clock.deadlineMs * 0.9));
}

/** The colour a bot squad takes when it picks Armageddon's colours. */
export const botArmageddonColour = (s: SquadsSettings = SQUADS): Colour => s.bots.armageddonColour;
