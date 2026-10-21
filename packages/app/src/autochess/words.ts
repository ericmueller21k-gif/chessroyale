import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import type { GoldBreakdown, RoundResult } from "./economy.ts";
import type { FightEnd } from "./fight.ts";
import type { Color } from "./types.ts";

/** What the result of a round says, in the words players read. */

/** How a fight ended ("both_checked": both kings were attacked as it began, so there was no fight). */
export type EndKind = FightEnd | "both_checked";

/** A fight's end in detail: who won, and a stall's deciding score (the engine's, centipawns, White's view). */
export interface EndDetail {
  winner?: Color | null;
  score?: number;
}

const SIDE: Record<Color, string> = { w: "White", b: "Black" };

/** A stall's winner's lead by the engine's score: "ahead by 2 pawns" (whole pawns, never under 1 for a win), "far ahead" for a mate it saw. */
function lead(score: number): string {
  if (Math.abs(score) >= 10000) return "far ahead";
  const pawns = Math.max(1, Math.round(Math.abs(score) / 100));
  return `ahead by ${pawns} ${pawns === 1 ? "pawn" : "pawns"}`;
}

export function endWords(end: EndKind, draw: boolean, cfg: AutoChessSettings = AUTOCHESS, detail: EndDetail = {}): string {
  /** A stall: why it stalled, then the side the engine's score favors and by how much, or that it's less than a pawn either way. */
  const stall = (why: string) => {
    if (draw || detail.score === undefined) return `Fight stalled (${why}): less than a pawn apart, a draw.`;
    const winner = detail.winner ?? (detail.score > 0 ? "w" : "b");
    return `Fight stalled (${why}): ${SIDE[winner]} ${lead(detail.score)}.`;
  };
  switch (end) {
    case "checkmate":
      return "Checkmate.";
    case "decided":
      return detail.winner ? `${SIDE[detail.winner]} too far ahead: ${cfg.decisiveMargin / 100}+ pawns for ${cfg.decisiveMoves} moves.` : "One side too far ahead.";
    case "stalemate":
      return "Stalemate.";
    case "repetition":
      return stall("moves repeated");
    case "fifty_moves":
      return "Draw by the fifty-move rule.";
    case "insufficient_material":
      return "Draw: not enough pieces left to mate.";
    case "cap":
      return stall(`${cfg.moveCap} moves each`);
    case "quiet":
      return stall(`${cfg.quietCap} moves each, no capture`);
    case "king_alone":
      return draw ? "Both sides are down to a king: a draw." : "A side left with only its king loses at once.";
    case "both_checked":
      return "Both kings were in check at the start, so there was no fight.";
  }
}

/** Centipawns as players read them: "a pawn", "5 pawns". */
const pawnsWords = (cp: number) => (cp === 100 ? "a pawn" : `${cp / 100} pawns`);

/** The fight's rules, in the box while it plays. */
export const fightRulesWords = (cfg: AutoChessSettings = AUTOCHESS) =>
  `The engine plays both armies at the same strength. A side left with only its king loses, and so does one the engine sees ${pawnsWords(cfg.decisiveMargin)} behind for ${cfg.decisiveMoves} moves. ` +
  `A stall (moves repeated, ${cfg.quietCap} moves each with no capture, or ${cfg.moveCap} each) goes to the side it sees ${pawnsWords(cfg.stallWinMargin)} ahead. ` +
  `After ${cfg.fightFastAfter} moves each, or once a side has only pawns, moves play twice as fast. A pawn that reaches the far end cashes in for +${cfg.cashInGold} gold.`;

/** The fight's move counter: "Move 12 of 60", and "twice as fast" once the moves speed up (after 30 moves each, or a side down to king and pawns: `thin`). */
export const moveWords = (plies: number, cfg: AutoChessSettings = AUTOCHESS, thin = false) =>
  `Move ${Math.max(1, Math.ceil((plies + 1) / 2))} of ${cfg.moveCap}${thin || plies >= 2 * cfg.fightFastAfter ? " · twice as fast" : ""}`;

/** The headline of a round. */
export const headline = (r: RoundResult) => (r.outcome === "you" ? "You win the round." : r.outcome === "bot" ? "You lose the round." : "The round is a draw.");

/** Who lost how much. */
export function damageWords(r: RoundResult): string {
  if (r.outcome === "you") return `Your opponent loses ${r.damage} HP.`;
  if (r.outcome === "bot") return `You lose ${r.damage} HP.`;
  return "Nobody loses HP.";
}

/** The next round's gold, line by line (the zero ones left out, but the savings and the income stay); "from cash-ins": the gold of pawns that reached the far end. */
export function goldWords(g: GoldBreakdown): string {
  const parts = [`${g.saved} saved`, `${g.income} income`];
  if (g.interest) parts.push(`${g.interest} interest`);
  if (g.streak) parts.push(`${g.streak} streak`);
  if (g.survivors) parts.push(`${g.survivors} survivors`);
  if (g.cashIns) parts.push(`${g.cashIns} from cash-ins`);
  return `Next round: ${parts.join(" + ")} = ${g.total} gold`;
}

export const matchWords = (won: boolean) => (won ? { head: "You win the match!", sub: "Your opponent is out of HP." } : { head: "You lose the match.", sub: "You are out of HP." });

/** A clock: minutes and seconds, rounded up (a countdown never shows 0:00 before it ends). */
export function clockWords(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
