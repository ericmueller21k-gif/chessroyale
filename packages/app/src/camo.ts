import { fenAtPly, maskedFen, pieceAt, toSan, type Base, type CamoView } from "@chessroyale/chess";

/**
 * The board as the crowd sees it, while Smudgy's rook hides (docs/decisions/2026-10-19-smudgy-wired.md). The position the
 * game plays has the rook on its square; every screen draws it as one of his pawns (`maskedFen`), so nothing a player
 * can see tells which pawn it is: the board, the dots a tap shows, the names of moves, the last-move rings, the
 * history, the God King's words, his character's mood.
 *
 * How it's done, in one place: the match tells this module about the battle each time its boss view changes
 * (`trackCamo`), and it remembers the hidden square at every position of the game so far. The board then asks for the
 * position it draws (`seenFen`), the screens for the name of a move (`seenSan`). A position this module has never heard
 * of (the one after a pick, a Last Stand's) is the latest one with the same piece hidden. Nothing here is a secret from
 * the app: like Hollow's dark, the true position is what the game plays and the screens hide the piece. What the engines
 * and the judge see is the true position (EvalBar, the hints, `refusedLine`): they are given the fen the game holds, and
 * only what is drawn or said goes through here.
 *
 * Once the rook is revealed (it struck, gave check, left you no move you could see, or you took it) or the battle is
 * over (`boss.result`), nothing is hidden: every board shows the true position, past ones too.
 */

/** The part of a boss view the mask reads. */
export interface CamoBoss {
  id?: string;
  crowdSide: "w" | "b";
  result?: string | null;
  board: { fen: string; history: readonly string[]; bases?: readonly Base[] | null };
  powers?: { camo?: CamoView | null } | null;
}

const other = (side: "w" | "b") => (side === "w" ? "b" : "w");

/**
 * The hidden rook's square after each ply of the game (index = ply, 0 to the last), null before the swap. Walks the game
 * from the swap on: the rook only ever moves as a pawn would (until it's revealed, and then nothing is hidden), so it
 * moves when a move of his leaves its square. Null when the rook doesn't hide now. The last ply is the view's own square
 * whatever the walk found.
 */
export function hiddenTrail(boss: CamoBoss): (string | null)[] | null {
  const camo = boss.powers?.camo;
  const now = camo?.square;
  if (!camo || !now) return null;
  const n = boss.board.history.length;
  const trail: (string | null)[] = new Array(n + 1).fill(null);
  trail[n] = now;
  const swap = camo.swap;
  if (!swap) return trail;
  const his = other(boss.crowdSide);
  // The swap is the first position change outside a move: the base whose rook stands where the swap says it hid.
  const base = [...(boss.board.bases ?? [])]
    .filter((b) => b.ply >= 1)
    .sort((a, b) => a.ply - b.ply)
    .find((b) => {
      const rook = pieceAt(b.fen, swap.pawn);
      const pawn = pieceAt(b.fen, swap.rook);
      return rook?.type === "r" && rook.color === his && pawn?.type === "p" && pawn.color === his;
    });
  if (!base || base.ply > n) return trail;
  let hidden = swap.pawn;
  for (let ply = base.ply; ply <= n; ply++) {
    if (ply > base.ply) {
      const m = boss.board.history[ply - 1]!;
      if (m.slice(0, 2) === hidden) hidden = m.slice(2, 4);
    }
    trail[ply] = hidden;
  }
  trail[n] = now;
  return trail;
}

/** The true position (the full fen) to its hidden square, for each position of the battle so far; null: nothing hidden then. */
let table = new Map<string, string | null>();
/** The hidden square now (null: nothing is hidden, and nothing is masked), and the color of the hidden rook. */
let latest: string | null = null;
let color: "w" | "b" | null = null;
let seenKey = "";

/**
 * Tells the mask about the battle as the match has it now (called whenever the boss view is made or changes: the
 * match's `boss`). Cheap when nothing changed. A battle with no hidden rook (any other boss, before the swap, after the
 * reveal, over) clears it.
 */
export function trackCamo(boss: CamoBoss | null | undefined): void {
  const camo = boss && boss.id === "smudgy" && !boss.result ? boss.powers?.camo : null;
  if (!boss || !camo?.square) {
    if (latest !== null || table.size) {
      table = new Map();
      latest = null;
      color = null;
      seenKey = "";
    }
    return;
  }
  const h = boss.board.history;
  const key = `${h.length}|${h[0] ?? ""}|${h.slice(-4).join("")}|${boss.board.bases?.length ?? 0}|${camo.square}|${camo.swap?.pawn ?? ""}|${boss.crowdSide}`;
  if (key === seenKey) return;
  seenKey = key;
  const trail = hiddenTrail(boss)!;
  const next = new Map<string, string | null>();
  for (let ply = 0; ply < trail.length; ply++) next.set(fenAtPly(h, ply, boss.board.bases), trail[ply]!);
  // (The position the view holds is the latest, whatever the replay made of a base.)
  next.set(boss.board.fen, camo.square);
  table = next;
  latest = camo.square;
  color = other(boss.crowdSide);
}

/** Whether a rook is hidden in this battle now (the board draws a pawn where it stands). */
export const camoHidden = (): boolean => latest !== null;

/** `fen` with the rook hidden at `square` drawn as a pawn, if it's his rook there. */
function drawn(fen: string, square: string): string {
  const p = pieceAt(fen, square);
  return p?.type === "r" && p.color === color ? maskedFen(fen, square) : fen;
}

/**
 * The position as the crowd sees it: `fen` (a position of this battle, or one made from one) with the hidden rook drawn
 * as a pawn. Unchanged when no rook hides.
 */
export function seenFen(fen: string): string {
  if (latest === null) return fen;
  const known = table.get(fen);
  const square = known === undefined ? latest : known;
  return square ? drawn(fen, square) : fen;
}

/**
 * A move's name on the board the crowd sees ("e6", never "Re6" for the hidden rook; the crowd's own moves as they read
 * there), or null when it isn't a move there (the hidden rook's strike, a move only the true board allows).
 */
export function seenSanOrNull(fen: string, move: string): string | null {
  try {
    return toSan(seenFen(fen), move);
  } catch {
    return null;
  }
}

/** A move's name for a screen: as the crowd sees it, else (a move the board it sees doesn't have: a strike, already shown) as it is, else the move itself. */
export function seenSan(fen: string, move: string): string {
  const san = seenSanOrNull(fen, move);
  if (san !== null) return san;
  try {
    return toSan(fen, move);
  } catch {
    return move;
  }
}
