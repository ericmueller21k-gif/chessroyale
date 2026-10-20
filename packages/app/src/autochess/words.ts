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
    case "checks":
      return `${cfg.checksToWin} checks in a row count as mate.`;
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
    case "quiet":
      return draw ? `${cfg.quietCap} moves each with no capture or check, and equal material.` : `${cfg.quietCap} moves each with no capture or check: more material wins.`;
    case "king_alone":
      return draw ? "Both sides are down to a king: a draw." : "A side left with only its king loses at once.";
    case "both_checked":
      return "Both kings were in check at the start, so there was no fight.";
  }
}

/** The fight's move counter: "Move 12 of 60", and "twice as fast" once the moves speed up. */
export const moveWords = (plies: number, cfg: AutoChessSettings = AUTOCHESS) =>
  `Move ${Math.max(1, Math.ceil((plies + 1) / 2))} of ${cfg.moveCap}${plies >= 2 * cfg.fightFastAfter ? " · twice as fast" : ""}`;

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
  return `Next round: ${parts.join(" + ")} = ${g.total} gold`;
}

export const matchWords = (won: boolean) => (won ? { head: "You win the match!", sub: "Your opponent is out of HP." } : { head: "You lose the match.", sub: "You are out of HP." });

/** A clock: minutes and seconds, rounded up (a countdown never shows 0:00 before it ends). */
export function clockWords(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
