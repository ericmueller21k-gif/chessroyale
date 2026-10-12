/**
 * A board turned a quarter of the way round (Boingo's funhouse, Eric, Oct 11): the squares as chessground draws them.
 *
 * Chessground draws a board only one of two ways up (White's side or Black's), and maps a tap or a drag to a square from
 * its own box, so a CSS rotation of the board would put every tap on the wrong square. A quarter turn is drawn instead by
 * moving every square to where the turned board shows it: chessground gets the pieces on their "view" squares and works
 * as usual (taps, drags, dots, highlights all exact), and each move it reports is turned back into the real squares
 * (Board.tsx). Everything drawn over the board places its squares the same way (squareXY's `turn`). A half turn is
 * simply the other side's orientation, as before.
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

/** A move (uci) from the view's squares back to the real ones (a promotion's piece kept). */
export const realMove = (move: string, turn: QuarterTurn) => (turn ? realSquare(move.slice(0, 2), turn) + realSquare(move.slice(2, 4), turn) + move.slice(4) : move);

/** A move (uci) onto the view's squares. */
export const viewMove = (move: string, turn: QuarterTurn) => (turn ? viewSquare(move.slice(0, 2), turn) + viewSquare(move.slice(2, 4), turn) + move.slice(4) : move);

/**
 * The position's pieces on their view squares, as a FEN's placement (the rest of the FEN as it was): what chessground
 * draws. Only the placement: chessground needs nothing else.
 */
export function viewFen(fen: string, turn: QuarterTurn): string {
  if (!turn) return fen;
  const [placement, ...rest] = fen.split(" ");
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null));
  placement!.split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else {
        const v = viewSquare(at(f, 7 - i), turn);
        grid[Number(v[1]) - 1]![v.charCodeAt(0) - 97] = c;
        f++;
      }
    }
  });
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const c = grid[r]![f];
      if (c) {
        if (empty) row += empty;
        empty = 0;
        row += c;
      } else empty++;
    }
    rows.push(row + (empty ? empty : ""));
  }
  return [rows.join("/"), ...rest].join(" ");
}

/**
 * The labels chessground's coordinates should show on a turned board: its edge along the bottom (its "files", a to h
 * as it draws them) runs along the real ranks, and its edge at the side (its "ranks") along the real files. `label` is
 * what chessground wrote (the view's file letter or rank number); the answer names the real square's.
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
