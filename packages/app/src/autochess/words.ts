import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import type { GoldBreakdown, RoundResult } from "./economy.ts";
import type { FightEnd } from "./fight.ts";

/** What the result of a round says, in the words players read. */

/** How a fight ended ("both_checked": both kings were attacked as it began, so there was no fight). */
export type EndKind = FightEnd | "both_checked";

export function endWords(end: EndKind, draw: boolean, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (end) {
    case "checkmate":
      return "Checkmate.";
    case "stalemate":
      return "Stalemate.";
    case "repetition":
      return "Draw by repetition.";
    case "fifty_moves":
      return "Draw by the fifty-move rule.";
    case "insufficient_material":
      return "Draw: not enough pieces left to mate.";
    case "cap":
      return draw ? `${cfg.moveCap} moves played with equal material.` : `${cfg.moveCap} moves played: more material wins.`;
    case "both_checked":
      return "Both kings were in check at the start, so there was no fight.";
  }
}

/** The headline of a round. */
export const headline = (r: RoundResult) => (r.outcome === "you" ? "You win the round." : r.outcome === "bot" ? "You lose the round." : "The round is a draw.");

/** Who lost how much. */
export function damageWords(r: RoundResult): string {
  if (r.outcome === "you") return `Your opponent loses ${r.damage} HP.`;
  if (r.outcome === "bot") return `You lose ${r.damage} HP.`;
  return "Nobody loses HP.";
}

/** The next round's gold, line by line (the zero ones left out, but the savings and the income stay). */
export function goldWords(g: GoldBreakdown): string {
  const parts = [`${g.saved} saved`, `${g.income} income`];
  if (g.interest) parts.push(`${g.interest} interest`);
  if (g.streak) parts.push(`${g.streak} streak`);
  if (g.survivors) parts.push(`${g.survivors} survivors`);
  if (g.bench) parts.push(`${g.bench} bench`);
  return `Next round: ${parts.join(" + ")} = ${g.total} gold`;
}

export const matchWords = (won: boolean) => (won ? { head: "You win the match!", sub: "Your opponent is out of HP." } : { head: "You lose the match.", sub: "You are out of HP." });

/** A clock: minutes and seconds, rounded up (a countdown never shows 0:00 before it ends). */
export function clockWords(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
