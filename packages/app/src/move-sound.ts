import { applyMove, pieceAt } from "@chessroyale/chess";

/**
 * The knock for a move appearing on a big board: a capture sounds different, so does castling. `before` is the
 * position the board showed, `fen` the one it shows now, `lastMove` the move that made it. `exact`: only if `fen` is
 * `before` with that very move played (a board that has just taken over from another screen: the move made there,
 * never another game's position or a jump of several moves).
 */
export function moveKnock(before: string | null | undefined, fen: string, lastMove: string | null | undefined, exact = false): "move" | "capture" | "castle" | null {
  if (!before || !lastMove || before === fen) return null;
  const from = lastMove.slice(0, 2);
  const to = lastMove.slice(2, 4);
  const mover = pieceAt(before, from);
  if (!mover) return null;
  if (exact) {
    try {
      if (applyMove(before, lastMove).split(" ")[0] !== fen.split(" ")[0]) return null;
    } catch {
      return null;
    }
  }
  const captured = !!pieceAt(before, to) || (mover.type === "p" && from[0] !== to[0]);
  const castled = mover.type === "k" && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2;
  return captured ? "capture" : castled ? "castle" : "move";
}

/**
 * The position the big board on screen last showed, whichever screen drew it. Every phase of a match is its own
 * screen with its own board, and the screen where your move went in can be replaced by the next (the boss thinking)
 * before the browser paints, taking its knock with it: alone against a boss, a move the judge scores at once (the
 * engine's search already done) made no sound, and the first thing heard was the boss's reply (Eric, Oct 10, against
 * Hollow). The next screen's board knocks for it instead (`moveKnock`, exact).
 */
let shown: string | null = null;

/** What a big board should play as it shows `fen` (`mounted`: its first showing), and it's remembered as shown. */
export function knockFor(prev: string | null, fen: string, lastMove: string | null | undefined): "move" | "capture" | "castle" | null {
  const mounted = prev === null;
  const before = mounted ? shown : prev;
  shown = fen;
  return moveKnock(before, fen, lastMove, mounted);
}

/** Tests: forget what was shown. */
export function resetKnocks() {
  shown = null;
}
