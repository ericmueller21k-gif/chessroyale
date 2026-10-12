/**
 * A board turned a quarter of the way round (Boingo's funhouse, Eric, Oct 11): where each square is drawn.
 *
 * A CSS rotation of the board would put every tap on the wrong square, so a quarter turn is drawn instead by putting
 * every square where the turned board shows it (its "view" square) and turning taps back into the real squares
 * (board/OwnBoard.tsx). Everything drawn over the board places its squares the same way (squareXY's `turn`). A half
 * turn is simply the other side's orientation.
 *
 * `turn` is how far the picture is turned clockwise: 90 or 270 (0: as it is). The same on either side's orientation.
 */
import { createContext } from "preact";

/** A quarter turn of the board's picture, clockwise (0: none). */
export type QuarterTurn = 0 | 90 | 270;

/** The quarter turn of the big board everything inside it is drawn for (Board provides it to what it draws over). */
export const BoardTurn = createContext<QuarterTurn>(0);

const FILES = "abcdefgh";
const at = (f: number, r: number) => `${FILES[f]}${r + 1}`;

/** The square a real square is drawn on, turned `turn` clockwise. */
export function viewSquare(square: string, turn: QuarterTurn): string {
  if (!turn) return square;
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return turn === 90 ? at(r, 7 - f) : at(7 - r, f);
}

/** The real square drawn on a view square (viewSquare's inverse). */
export function realSquare(view: string, turn: QuarterTurn): string {
  if (!turn) return view;
  const f = view.charCodeAt(0) - 97;
  const r = Number(view[1]) - 1;
  return turn === 90 ? at(7 - r, f) : at(r, 7 - f);
}

/**
 * The labels the board's coordinates show on a turned board: its edge along the bottom (its "files", a to h as an
 * unturned board would label them) runs along the real ranks, and its edge at the side (its "ranks") along the real
 * files. `label` is the view's file letter or rank number; the answer names the real square's.
 */
export function coordLabel(label: string, kind: "files" | "ranks", turn: QuarterTurn): string {
  if (!turn) return label;
  if (kind === "files") {
    // A view file F holds real rank F + 1 (90) or 8 - F (270), whichever row it's on.
    const F = label.charCodeAt(0) - 97;
    return String(turn === 90 ? F + 1 : 8 - F);
  }
  // A view rank R holds real file 7 - R (90) or R (270).
  const R = Number(label) - 1;
  return FILES[turn === 90 ? 7 - R : R]!;
}
