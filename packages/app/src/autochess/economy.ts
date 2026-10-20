import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import type { Army, Color, Kind, Offer } from "./types.ts";

/**
 * Gold, streaks and hit points between rounds. Nothing carries over between rounds but gold, HP, the win streak and the bench
 * (docs/decisions/2026-10-19-autochess-demo.md, "v4", and "v6" for the bench): the board's pieces still go home each round.
 */

/** A round's income: 100 in round 1, 20 more each round, up to 200. */
export const incomeFor = (round: number, cfg: AutoChessSettings = AUTOCHESS) => Math.min(cfg.income.max, cfg.income.first + cfg.income.step * Math.max(0, round - 1));

/** Interest on gold banked before the income: 10 for every full 100, up to 30. */
export const interestFor = (banked: number, cfg: AutoChessSettings = AUTOCHESS) => Math.min(cfg.interest.max, Math.floor(Math.max(0, banked) / cfg.interest.per) * cfg.interest.gold);

/** Gold for a streak of `n` rounds in a row: the highest row of the table that `n` reaches. */
export function streakGold(table: AutoChessSettings["winStreakGold"], n: number): number {
  let gold = 0;
  for (const row of table) if (n >= row.n) gold = row.gold;
  return gold;
}

/** What a fight gives back to its side: a share of the price of the pieces still on the board. */
export interface Refund {
  survivors: number;
}

export interface SideState {
  gold: number;
  hp: number;
  /** Rounds won in a row now, and rounds lost in a row. A draw ends both. */
  wins: number;
  losses: number;
  /** From the last fight; paid out with the next round's income. */
  refund: Refund;
  /** The pieces held on the bench (v6), each with the square it will land on; they stay from round to round. */
  bench: Offer[];
}

export interface MatchState {
  seed: number;
  /** 0 before the first round starts. */
  round: number;
  you: SideState;
  bot: SideState;
}

export function newMatch(seed: number, cfg: AutoChessSettings = AUTOCHESS): MatchState {
  const side = (): SideState => ({ gold: cfg.startGold, hp: cfg.hp, wins: 0, losses: 0, refund: { survivors: 0 }, bench: [] });
  return { seed, round: 0, you: side(), bot: side() };
}

/** You are White in round 1, then the colors alternate. */
export const youColor = (round: number): Color => (round % 2 === 1 ? "w" : "b");

/** The seed for a round's random choices (the kings, the bot's buys and places). */
export const roundSeed = (match: MatchState) => (match.seed + match.round * 7919) >>> 0;

/** Where a round's gold comes from, line by line: what's in the total, in the order the result line says it. */
export interface GoldBreakdown {
  saved: number;
  survivors: number;
  income: number;
  interest: number;
  streak: number;
  total: number;
}

/**
 * The gold a side starts `round` with. Interest counts everything banked before the income, the last fight's refund
 * included.
 */
export function goldBreakdown(round: number, side: SideState, cfg: AutoChessSettings = AUTOCHESS): GoldBreakdown {
  const banked = side.gold + side.refund.survivors;
  const income = incomeFor(round, cfg);
  const interest = interestFor(banked, cfg);
  const streak = Math.max(streakGold(cfg.winStreakGold, side.wins), streakGold(cfg.lossStreakGold, side.losses));
  return { saved: side.gold, survivors: side.refund.survivors, income, interest, streak, total: banked + income + interest + streak };
}

/** Starts the next round: both sides are paid, and the round number goes up. */
export function beginRound(match: MatchState, cfg: AutoChessSettings = AUTOCHESS): { match: MatchState; gold: { you: GoldBreakdown; bot: GoldBreakdown } } {
  const round = match.round + 1;
  const gold = { you: goldBreakdown(round, match.you, cfg), bot: goldBreakdown(round, match.bot, cfg) };
  const paid = (s: SideState, g: GoldBreakdown): SideState => ({ ...s, gold: g.total, refund: { survivors: 0 } });
  return { match: { ...match, round, you: paid(match.you, gold.you), bot: paid(match.bot, gold.bot) }, gold };
}

/** What a lost round costs: 2 plus 1 for every enemy piece (not the king) left. */
export const damageFor = (enemyPiecesLeft: number, cfg: AutoChessSettings = AUTOCHESS) => cfg.damageBase + cfg.damagePerPiece * enemyPiecesLeft;

/** The summed price of some pieces. */
export const worth = (kinds: readonly Kind[], cfg: AutoChessSettings = AUTOCHESS) => kinds.reduce((sum, k) => sum + cfg.prices[k], 0);

/** What a side gets back after a fight: 25% (rounded down) of the summed price of what's still on the board. */
export function refundFor(onBoard: readonly Kind[], cfg: AutoChessSettings = AUTOCHESS): Refund {
  return { survivors: Math.floor(worth(onBoard, cfg) * cfg.survivorRefund) };
}

export type RoundOutcome = "you" | "bot" | "draw";

/** The round, settled: what each side lost and got. */
export interface RoundResult {
  outcome: RoundOutcome;
  /** HP the loser loses (0 for a draw). */
  damage: number;
  /** The enemy pieces (not the king) the damage counted. */
  piecesLeft: number;
  refund: { you: Refund; bot: Refund };
}

/**
 * Settles a round: the loser loses HP, the win and loss streaks move on (a draw ends both), and each side's refund waits
 * for the next round's pay. `left`: the pieces on the board when the fight ended, by side.
 */
export function settleRound(
  match: MatchState,
  outcome: RoundOutcome,
  left: { you: readonly Kind[]; bot: readonly Kind[] },
  cfg: AutoChessSettings = AUTOCHESS,
): { match: MatchState; result: RoundResult } {
  const piecesLeft = outcome === "you" ? left.you.length : outcome === "bot" ? left.bot.length : 0;
  const damage = outcome === "draw" ? 0 : damageFor(piecesLeft, cfg);
  const refund = { you: refundFor(left.you, cfg), bot: refundFor(left.bot, cfg) };
  const next = (s: SideState, won: boolean, lost: boolean, r: Refund): SideState => ({
    ...s,
    hp: lost ? s.hp - damage : s.hp,
    wins: won ? s.wins + 1 : 0,
    losses: lost ? s.losses + 1 : 0,
    refund: r,
  });
  return {
    match: { ...match, you: next(match.you, outcome === "you", outcome === "bot", refund.you), bot: next(match.bot, outcome === "bot", outcome === "you", refund.bot) },
    result: { outcome, damage, piecesLeft, refund },
  };
}

/** Who has won the match, if anyone: the first side at 0 HP loses. */
export function matchWinner(match: MatchState): "you" | "bot" | null {
  if (match.you.hp <= 0) return "bot";
  if (match.bot.hp <= 0) return "you";
  return null;
}

/** An army's pieces on the board, as kinds (for settling). */
export const armyKinds = (army: Army): Kind[] => Object.values(army.board);
