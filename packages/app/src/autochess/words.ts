import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import type { GoldBreakdown, RoundResult } from "./economy.ts";
import type { FightEnd } from "./fight.ts";
import type { Color } from "./types.ts";

/** What the result of a round says, in the words players read. */

/** How a fight ended ("both_checked": both kings were attacked as it began, so there was no fight). */
export type EndKind = FightEnd | "both_checked";

/**
 * A fight's end in detail: who won, what White gained during the fight by the judge (centipawns, Black's gain the negative: a
 * stall's or "too far ahead"'s), and the player's color (the sides are named "you" and "your opponent", as the rest of the screen
 * names them; without it, White and Black).
 */
export interface EndDetail {
  winner?: Color | null;
  gain?: number;
  you?: Color;
}

const SIDE: Record<Color, string> = { w: "White", b: "Black" };

/**
 * A side's gain as players read it: whole pawns from 1 up ("2 pawns", "1 pawn"), "the edge" under a pawn (a stall can be won by half
 * a pawn: never "0 pawns"), "a winning edge" for a mate the judge saw.
 */
function gainWords(gain: number): string {
  const g = Math.abs(gain);
  if (g >= 10000) return "a winning edge";
  if (g < 100) return "the edge";
  const pawns = Math.round(g / 100);
  return `${pawns} ${pawns === 1 ? "pawn" : "pawns"}`;
}

/** A side by name: "you", "your opponent" (or "White" when the player's color isn't given). */
function who(side: Color, you: Color | undefined): string {
  if (!you) return SIDE[side];
  return side === you ? "you" : "your opponent";
}

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function endWords(end: EndKind, draw: boolean, cfg: AutoChessSettings = AUTOCHESS, detail: EndDetail = {}): string {
  /** A stall: why it stalled, then who gained since the start and how much (Eric, Oct 21: gains count, not army size), or that nobody gained enough. */
  const stall = (why: string) => {
    if (draw || detail.gain === undefined) return `Fight stalled (${why}): neither side gained the edge, a draw.`;
    const winner = detail.winner ?? (detail.gain > 0 ? "w" : "b");
    return `Fight stalled (${why}): ${who(winner, detail.you)} gained ${gainWords(detail.gain)}.`;
  };
  switch (end) {
    case "checkmate":
      return "Checkmate.";
    case "decided":
      return detail.winner ? `${capital(who(detail.winner, detail.you))} gained ${cfg.decisiveMargin / 100}+ pawns and held it for ${cfg.decisiveMoves} moves.` : "One side gained too much to catch.";
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

/**
 * The fight's rules, in the box while it plays (short: it must fit a 320 px phone; the speed-up shows in the move counter, "twice as
 * fast", so it isn't repeated here).
 */
export const fightRulesWords = (cfg: AutoChessSettings = AUTOCHESS) =>
  `One engine plays both armies. A side left with only its king loses. Gains count, not army size: ${cfg.decisiveMargin / 100} pawns gained for ${cfg.decisiveMoves} moves wins, ` +
  `and a stall (repeats, ${cfg.quietCap} moves each with no capture, or ${cfg.moveCap}) goes to the side that gained more. A pawn at the far end cashes in for +${cfg.cashInGold} gold.`;

/** The fight's move counter: "Move 12 of 60", and "twice as fast" once the moves speed up (after 30 moves each, or once the fight has thinned out: `thin`, thinFight). */
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
