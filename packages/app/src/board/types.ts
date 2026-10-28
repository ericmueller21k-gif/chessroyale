import type { ComponentChildren } from "preact";
import type { QuarterTurn } from "../board-view.ts";
import type { Brush } from "./logic.ts";

export interface Arrow {
  move: string;
  brush: Brush;
  /** Short text on the arrow, e.g. an expected score. */
  label?: string;
}

/**
 * What a screen draws on its pieces, as part of each piece's own element, so it slides, fades and is read with the piece (Auto chess's stars and their outline). `key` is
 * everything `of` depends on, as text: the board's drawing layer is drawn again when it changes (the same contract as `marks`).
 */
export interface PieceDecor {
  key: string;
  /** For the piece on `square` (`code`: color then role, "wr", "bn"): a class for its element and what is drawn inside it, or nothing. */
  of(square: string, code: string): { cls?: string; kids: ComponentChildren } | null | undefined;
}

/** The board's props (components/Board.tsx, board/OwnBoard.tsx). */
export interface BoardProps {
  fen: string;
  /**
   * Draw `fen` as the game holds it, whatever the battle hides (Smudgy's hidden rook is otherwise drawn as one of his
   * pawns: camo.ts). Only for a position the crowd could not play on as drawn.
   */
  unmasked?: boolean;
  orientation: "white" | "black";
  lastMove?: string | null;
  /** Enable moving for the side to move. */
  interactive?: boolean;
  /** Only these moves may be played (default: every legal move). */
  moves?: readonly string[];
  /** A move made on the board; `how.premove`: one made ahead (`premove`), played the moment your turn came. */
  onMove?: (uci: string, how?: { premove?: boolean }) => void;
  /**
   * A move tried (a tap on a square, or a drop) that's legal in chess but not one of `moves` (a boss power stops it):
   * the piece stays where it was, and the screen can say why.
   */
  onRefused?: (uci: string) => void;
  /**
   * A move the board offers (it is legal on the position it draws) that the game refuses: Smudgy's hidden rook, drawn as
   * a pawn, makes some moves illegal that look legal (your king into its line, a piece it pins). At such a move the board
   * calls `onRefused` instead of `onMove` and the piece stays where it was, so a refusal reads as one and never as a move
   * that snapped back.
   */
  stopped?: (uci: string) => boolean;
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
  /**
   * Alfil's elephants: the squares of the bishops drawn with their own art (bishops in every way; the boss view's
   * `elephants`). A piece that was one keeps its art as it fades.
   */
  elephants?: readonly string[];
  /** Drawn on each piece, inside its element (see `PieceDecor`). Not on a piece that is fading away. */
  decor?: PieceDecor;
  /**
   * Premoves (chess.com's), for a screen that opts in (docs/areas/board.md, "Arrows, highlights and premoves"). While
   * `side` isn't to move on the board you may move its pieces ahead (drag or tap-tap; a computer lines up several, a
   * phone one), and the first plays the moment the board is `interactive` with `side` to move (through `onMove`, marked
   * as a premove); one the game doesn't allow then is cancelled with every one after it (`onRefused` when a power stops
   * it). `key`: the game and your seat in it: your premoves, arrows and highlights stay through every screen of the game
   * that passes the same key (a raid's turn and the boss's), and a board with another key starts clean.
   */
  premove?: PremoveSeat;
}

/** A board's premoves: whose they are (see BoardProps.premove). */
export interface PremoveSeat {
  key: string;
  side: "w" | "b";
  /**
   * Only show the premoves waiting (a right-click still cancels them): a screen where a tap on the board means something
   * else (a crowd's reveal, which a tap skips).
   */
  watch?: boolean;
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
