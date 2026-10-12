import { Chess } from "chess.js";
import { DEFAULT_SETTINGS, SQUADS, botPick, type Candidate, type Rng, type SquadsSettings } from "@chessroyale/core";
import type { EngineLike } from "../runner.ts";
import type { MoveScore } from "../uci.ts";
import { blockLift, checkBlock, isBlocked } from "./blocks.ts";
import type { Colour } from "./board.ts";

/**
 * Squad bots: the existing bot engine (the engine's top moves, then `botPick` at the bot's skill: a temperature over
 * each move's loss) making Relay moves, pair picks (different from the partner's, unless it's an only move and the
 * squad has a same-move token), the final's votes (sometimes copying a person on the squad), and now and then a block
 * of the other squad's likely best reply. The game's rules never ask an engine; only a bot deciding what to play does,
 * as in every other mode.
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

/** The engine's top moves a bot may play here: blocks in effect take their moves' lines away. */
export const topAllowed = (top: readonly MoveScore[], blocks: readonly string[]): MoveScore[] => top.filter((t) => !isBlocked(t.move, blocks));

/**
 * Only-move-like (for a bot deciding whether to spend a same-move token): `move` is the engine's best here and beats
 * every other line by at least `bots.sameMoveGap` of expected score.
 */
export function isOnlyMove(top: readonly MoveScore[], move: string, s: SquadsSettings = SQUADS): boolean {
  const sorted = [...top].sort((a, b) => b.expected - a.expected);
  if (sorted[0]?.move !== move) return false;
  const next = sorted[1];
  return !next || sorted[0]!.expected - next.expected >= s.bots.sameMoveGap - 1e-9;
}

/**
 * Pairs: the bot's pick. Its partner's move only when `sameMove` (an only move, and the squad has a token: the caller
 * decides with `isOnlyMove`); otherwise never the move its partner has already picked.
 */
export function botPairPick(rng: Rng, candidates: readonly Candidate[], skill: number, legal: readonly string[], partnerPick: string | null, sameMove = false): string {
  if (sameMove && partnerPick && legal.includes(partnerPick)) return partnerPick;
  return pickAvoiding(rng, candidates, skill, legal, new Set(partnerPick ? [partnerPick] : []));
}

/**
 * The final's vote: with `bots.copyHumanChance`, a pick a person on the squad has already made (the more of them on
 * it, the likelier), so the bots feel like teammates; otherwise its own pick at its skill.
 */
export function botVotePick(rng: Rng, candidates: readonly Candidate[], skill: number, legal: readonly string[], humanPicks: readonly string[], s: SquadsSettings = SQUADS): string {
  const copyable = humanPicks.filter((m) => legal.includes(m));
  if (copyable.length && rng() < s.bots.copyHumanChance) return copyable[Math.floor(rng() * copyable.length)]!;
  return pickAvoiding(rng, candidates, skill, legal, new Set());
}

/**
 * A bot's block, sparingly: the other squad's likely best reply to the bot's own move (`reply`: the second move of the
 * engine's line for it), if that's a move a block can name (blocks.ts), affordable, and would take effect after the
 * move (no mercy rule lifts it). It blocks with `bots.blockChance`, or `sharpChance` if the reply captures or gives
 * check (times `share`: a move chosen by several, each of them a share), and keeps `blockReserve` in its bank unless
 * the reply is sharp. Null: no block.
 */
export function botBlock(rng: Rng, o: { fen: string; ownMove: string; reply: string | undefined; bank: number; share?: number }, s: SquadsSettings = SQUADS): string | null {
  const reply = o.reply?.slice(0, 4);
  if (!reply || !/^[a-h][1-8][a-h][1-8]$/.test(reply)) return null;
  const them: Colour = o.fen.split(" ")[1] === "w" ? "b" : "w";
  const c = checkBlock(o.fen, them, reply, s);
  if ("error" in c || c.cost > o.bank) return null;
  let after: Chess;
  try {
    after = new Chess(o.fen);
    after.move({ from: o.ownMove.slice(0, 2), to: o.ownMove.slice(2, 4), promotion: o.ownMove[4] });
  } catch {
    return null;
  }
  const fenAfter = after.fen();
  if (blockLift(fenAfter, reply, s)) return null;
  let sharp = !!after.get(reply.slice(2, 4) as never);
  try {
    after.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: "q" });
    sharp ||= after.inCheck();
  } catch {
    return null;
  }
  if (!sharp && o.bank - c.cost < s.bots.blockReserve) return null;
  return rng() < (sharp ? s.bots.sharpChance : s.bots.blockChance) * (o.share ?? 1) ? reply : null;
}

/**
 * A bot's thinking time (ms): its squad's bank over `movesToGo`, plus `incrementShare` of the increment and the free
 * seconds, times a random factor in `thinkRange`; at least `minThinkSeconds`, and never past its deadline (in sudden
 * death, the free seconds: it always moves in time).
 */
export function squadBotThinkMs(rng: Rng, clock: { bankMs: number; incrementMs: number; delayMs: number; deadlineMs: number }, s: SquadsSettings = SQUADS): number {
  const [lo, hi] = s.bots.thinkRange;
  const target = (clock.bankMs / s.bots.movesToGo + s.bots.incrementShare * (clock.incrementMs + clock.delayMs)) * (lo + rng() * (hi - lo));
  const ms = Math.max(Math.min(s.bots.minThinkSeconds * 1000, clock.delayMs * 0.5), target);
  return Math.round(Math.min(ms, clock.deadlineMs * 0.9));
}

/** The colour a bot squad takes when it picks Armageddon's colours. */
export const botArmageddonColour = (s: SquadsSettings = SQUADS): Colour => s.bots.armageddonColour;
