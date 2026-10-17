/**
 * What the dock says when a power stops a move (Eric, Oct 17: his move across Sawyer's board saw went straight back
 * with nothing said, "like it glitched", and then the boss's queen crossed the saw: his only way out of check, which
 * every power lets through). docs/decisions/2026-10-17-power-limits-said-on-screen.md.
 * - A move of yours that a power refuses (legal in chess, not allowed this turn): why, beside "Your move." for
 *   REFUSED_MS or until the position changes (refusedLine).
 * - The boss's last move went through a power (it stopped every move he had, so the limit lifted for the turn): said
 *   on your turn after it (throughLine).
 */
import type { StopReason } from "@chessroyale/core";
import { stopReason, type StopFields } from "@chessroyale/chess";

/** How long a refused move's reason stays beside "Your move." (unless the position changes first). */
export const REFUSED_MS = 3000;

/** Why a move of yours was refused: a power that stops it, your frozen piece, or the move the God King took back. */
export const REFUSED: Record<StopReason | "frozen" | "barred", string> = {
  boardsaw: "The board saw blocks that move.",
  cut: "The saw cut blocks that move.",
  pie: "A pie blocks that square.",
  block: "A toy block is in the way.",
  frozen: "That piece is frozen.",
  barred: "The God King took that move back.",
};

/** Refused for a reason none of the above names (Wrangler's duels: the dock already says to take one). */
export const REFUSED_OTHER = "That move isn't allowed this turn.";

/** The boss's only move, through a power that stops it (the limit lifted for the turn). */
export const THROUGH: Record<StopReason, string> = {
  boardsaw: "His only move: the board saw let it through.",
  cut: "His only move: the saw cut let it through.",
  pie: "His only move: the pie let it through.",
  block: "His only move: the toy block let it through.",
};

/** The boss as the screens see it, as far as these words need. */
type BossLike = { id?: string; barred?: string | null; powers?: (StopFields & { iced?: readonly string[] }) | null; lastMove?: { through?: StopReason } | null };

/** Why `move` (legal in chess, not allowed now) was refused, in the dock's words. */
export function refusedLine(boss: BossLike, fen: string, move: string): string {
  if (boss.barred && boss.barred === move) return REFUSED.barred;
  if (boss.powers?.iced?.includes(move.slice(0, 2))) return REFUSED.frozen;
  const why = stopReason(boss, fen, move);
  return why ? REFUSED[why] : REFUSED_OTHER;
}

/** The boss's last move went through a power (his only move): the dock's words, or null. */
export const throughLine = (boss: BossLike | null | undefined): string | null => (boss?.lastMove?.through ? THROUGH[boss.lastMove.through] : null);
