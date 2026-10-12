import type { ComponentChildren } from "preact";
import type { QuarterTurn } from "../board-view.ts";
import type { Brush } from "./logic.ts";

export interface Arrow {
  move: string;
  brush: Brush;
  /** Short text on the arrow, e.g. an expected score. */
  label?: string;
}

/** The board's props (components/Board.tsx, board/OwnBoard.tsx). */
export interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  lastMove?: string | null;
  /** Enable moving for the side to move. */
  interactive?: boolean;
  /** Only these moves may be played (default: every legal move). */
  moves?: readonly string[];
  onMove?: (uci: string) => void;
  arrows?: Arrow[];
  small?: boolean;
  /** No move or capture sound, whatever the sound setting (the home's live window). Small boards are silent too. */
  silent?: boolean;
  /** Animate changes (off for instant jumps). */
  animate?: boolean;
  /** Drawn over the board (e.g. everyone's picks as see-through pieces). */
  children?: ComponentChildren;
  /** Extra square highlights under the pieces: square → class (e.g. the God King's Last Stand marks the blunder). */
  marks?: Readonly<Record<string, string>>;
  /**
   * Hollow's dark: the squares covered (their pieces hidden by the power layer). No move dots from, onto or past them;
   * a tap on one selects it (the green glow, no dots, nothing picked up); and any move attempt that touches one goes to
   * `onDarkTry` unchecked (the server says whether it was legal).
   */
  dark?: readonly string[];
  onDarkTry?: (uci: string) => void;
  /**
   * The board turned a quarter of the way round, clockwise (Boingo's funhouse): every square is drawn where the turned
   * board shows it, and taps, drags and moves are turned back (board-view.ts). The coordinates name the real squares.
   */
  turn?: QuarterTurn;
}

// The board's own elements: a piece (also drawn over the board, and in the promotion picker) and a square's highlight.
declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      piece: HTMLAttributes<HTMLElement>;
      square: HTMLAttributes<HTMLElement>;
    }
  }
}
