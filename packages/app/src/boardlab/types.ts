import type { PieceSet } from "./pieces.ts";

/** Board lab options, from the address (?board=cm&anim=fast&drag=off&dots=off&pieces=cm). */
export interface LabOpts {
  board: "cm" | "own";
  anim: "fast" | "normal" | "slow";
  drag: "on" | "off";
  dots: "on" | "off";
  pieces: PieceSet;
}

/** Slide durations. "normal" is the game board's own 220 ms (measured against it, Oct 12). */
export const ANIM_MS: Record<LabOpts["anim"], number> = { fast: 120, normal: 220, slow: 320 };

/** What every board in the lab is given. `onMove` applies a move (UCI, from+to) if it's legal and says so. */
export interface LabBoardProps {
  fen: string;
  lastMove: string | null;
  orientation: "white" | "black";
  opts: LabOpts;
  /** Destinations per origin square, for the side to move. */
  dests: Map<string, string[]>;
  /** The king's square when the side to move is in check. */
  check: string | null;
  onMove(from: string, to: string): boolean;
}
