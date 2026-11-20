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
import { stopReason, heldIn, type StopFields } from "@chessroyale/chess";

/** How long a refused move's reason stays in the dock (unless the position changes first). */
export const REFUSED_MS = 3000;

/** Why a move of yours was refused: a power that stops it, your frozen, folded or moonstruck piece, or the move the God King took back. */
export const REFUSED: Record<StopReason | "frozen" | "folded" | "stunned" | "dizzy" | "barred", string> = {
  boardsaw: "The board saw blocks that move.",
  cut: "The saw cut blocks that move.",
  pie: "A pie blocks that square.",
  block: "A toy block is in the way.",
  paint: "A painted piece stops that move.",
  plant: "A plant is in the way.",
  hoop: "A burning hoop is in the way.",
  // (Folio's crease stops only your pieces: its own cross it.)
  crease: "The crease stops your pieces.",
  gold: "Pawns can't take a gold piece.",
  // (Never said: dough only stops his pieces; yours squash it.)
  dough: "That square holds his dough.",
  frozen: "That piece is frozen.",
  folded: "That piece is folded.",
  stunned: "Moonlight holds that piece.",
  barred: "The God King took that move back.",
  // (Chandy's: the beam (its walls, or one of your pieces in it), a scatter shot's square, a shield, a dizzy piece.)
  beam: "The beam blocks that move.",
  scatter: "Scatter shot blocks that square.",
  shield: "A shield guards that piece.",
  dizzy: "That piece is dizzy.",
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
  // (Never said: gold only ever stops a pawn of yours.)
  gold: "His pawn takes the gold.",
  dough: "His only move: onto his dough.",
  // (Never said: the beam and shields only stop your pieces.)
  beam: "His only move: through the beam.",
  scatter: "His only move: onto the sparks.",
  shield: "His only move: past the shield.",
};

/** The boss as the screens see it, as far as these words need (on a floor of several, each boss's own part: `side`). */
type BossLike = { id?: string; barred?: string | null; powers?: (StopFields & { iced?: readonly string[]; folded?: readonly string[]; stunned?: readonly string[]; chandy?: { dizzy?: readonly string[] } | null }) | null; lastMove?: { through?: StopReason } | null; side?: { bosses: readonly BossLike[] } };

/**
 * Why `move` (legal in chess, not allowed now) was refused, in the dock's words. On a floor of several, every boss on the side is asked
 * (each his own marks), the first with a reason answering: the move may be stopped by a boss not in focus (audit 2, finding 1).
 */
export function refusedLine(boss: BossLike, fen: string, move: string): string {
  for (const b of boss.side && boss.side.bosses.length > 1 ? [boss, ...boss.side.bosses] : []) {
    const line = refusedLine({ ...b, side: undefined }, fen, move);
    if (line !== REFUSED_OTHER) return line;
  }
  if (boss.barred && boss.barred === move) return REFUSED.barred;
  // (Ginger's ice: the frozen piece's own move, or castling with a frozen rook.)
  if (boss.powers?.iced?.length && heldIn(fen, move, boss.powers.iced)) return REFUSED.frozen;
  // (Folio's folded piece: its own move, or castling with a folded rook.)
  if (boss.powers?.folded?.length && heldIn(fen, move, boss.powers.folded)) return REFUSED.folded;
  // (Moo's moonbeam: the stunned piece's own move, or castling with a stunned rook.)
  if (boss.powers?.stunned?.length && heldIn(fen, move, boss.powers.stunned)) return REFUSED.stunned;
  // (Chandy's rapid fire: a dizzy piece's own move, or castling with a dizzy rook.)
  const dizzy = boss.powers?.chandy?.dizzy;
  if (dizzy?.length && heldIn(fen, move, dizzy)) return REFUSED.dizzy;
  const why = stopReason(boss, fen, move);
  return why ? REFUSED[why] : REFUSED_OTHER;
}

/**
 * Sawyer's Saw Swap came at the start of his last turn (Nov 20): the dock's words through your turn after it (its banner named it). Short
 * enough to be whole in the dock at 320 px (142 of its 159 px, measured; e2e/sawyer.spec.ts checks it).
 */
export const SAW_SWAP_LINE = "Swapped out of check.";

/** The dock's words for Sawyer's Saw Swap through your turn after it (it came as your check landed, before his move), or null. */
export const swapLine = (boss: { crowdMoves?: number; powers?: { sawSwap?: { at: number } | null } | null } | null | undefined): string | null =>
  boss?.powers?.sawSwap && boss.powers.sawSwap.at === boss.crowdMoves ? SAW_SWAP_LINE : null;

/** The boss's last move went through a power (his only move): the dock's words, or null. */
export const throughLine = (boss: BossLike | null | undefined): string | null => (boss?.lastMove?.through ? THROUGH[boss.lastMove.through] : null);
