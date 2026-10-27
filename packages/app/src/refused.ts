/**
 * What the dock says when a power stops a move (Eric, Oct 17: his move across Sawyer's board saw went straight back
 * with nothing said, "like it glitched", and then the boss's queen crossed the saw: his only way out of check, which
 * every power lets through). docs/decisions/2026-10-17-power-limits-said-on-screen.md.
 * - A move of yours that a power refuses (legal in chess, not allowed this turn): why, in the dock in place of "Your
 *   move." for REFUSED_MS or until the position changes (refusedLine).
 * - The boss's last move went through a power (it stopped every move he had, so the limit lifted for the turn): said
 *   in the dock in place of "Your move." through your turn after it (throughLine).
 * Each is the dock's whole line: whole in its two lines at 320 px (its box is 112 px wide there; e2e/sawyer.spec.ts
 * measures every one), which "Your move." in front didn't leave room for.
 */
import type { StopReason } from "@chessroyale/core";
import { stopReason, stunnedIn, type StopFields } from "@chessroyale/chess";

/** How long a refused move's reason stays in the dock (unless the position changes first). */
export const REFUSED_MS = 3000;

/** Why a move of yours was refused: a power that stops it, your frozen, folded or moonstruck piece, or the move the God King took back. */
export const REFUSED: Record<StopReason | "frozen" | "folded" | "stunned" | "barred", string> = {
  boardsaw: "The board saw blocks that move.",
  cut: "The saw cut blocks that move.",
  pie: "A pie blocks that square.",
  block: "A toy block is in the way.",
  paint: "A painted piece stops that move.",
  plant: "A plant is in the way.",
  hoop: "A burning hoop is in the way.",
  // (Folio's crease stops only your pieces: its own cross it.)
  crease: "The crease stops your pieces.",
  frozen: "That piece is frozen.",
  folded: "That piece is folded.",
  stunned: "Moonlight holds that piece.",
  barred: "The God King took that move back.",
};

/** Refused for a reason none of the above names (Wrangler's duels: the dock already says to take one). */
export const REFUSED_OTHER = "That move isn't allowed this turn.";

/** The boss's only move, through a power that stops it (the limit lifted for the turn). */
export const THROUGH: Record<StopReason, string> = {
  boardsaw: "His only move: across the saw.",
  cut: "His only move: across the cut.",
  pie: "His only move: onto the pie.",
  block: "His only move: past the block.",
  // (Never said: "paint" is only ever a move of yours, refused for his hidden rook.)
  paint: "His only move: out of paint.",
  plant: "His only move: past the plant.",
  hoop: "His only move: through the hoop.",
  // (Never said: the crease never stops Folio's own pieces, so its move is never "through" it.)
  crease: "Its pieces cross the crease.",
};

/** The boss as the screens see it, as far as these words need. */
type BossLike = { id?: string; barred?: string | null; powers?: (StopFields & { iced?: readonly string[]; folded?: readonly string[]; stunned?: readonly string[] }) | null; lastMove?: { through?: StopReason } | null };

/** Why `move` (legal in chess, not allowed now) was refused, in the dock's words. */
export function refusedLine(boss: BossLike, fen: string, move: string): string {
  if (boss.barred && boss.barred === move) return REFUSED.barred;
  if (boss.powers?.iced?.includes(move.slice(0, 2))) return REFUSED.frozen;
  // (Folio's folded piece.)
  if (boss.powers?.folded?.includes(move.slice(0, 2))) return REFUSED.folded;
  // (Moo's moonbeam: the stunned piece's own move, or castling with a stunned rook.)
  if (boss.powers?.stunned?.length && stunnedIn(fen, move, boss.powers.stunned)) return REFUSED.stunned;
  const why = stopReason(boss, fen, move);
  return why ? REFUSED[why] : REFUSED_OTHER;
}

/** The boss's last move went through a power (his only move): the dock's words, or null. */
export const throughLine = (boss: BossLike | null | undefined): string | null => (boss?.lastMove?.through ? THROUGH[boss.lastMove.through] : null);
