import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import { halfSquares, placeWords, squareBlock, type SquareBlock } from "./army.ts";
import type { Army } from "./types.ts";

/**
 * The adjust step (v6, Eric Oct 20: "the engine's going to make a strong move anyway"): after the buy step you get one change in
 * all: move one of your pieces (the king stays where the game put it) to any legal empty square of your half. It is not a chess
 * move: a knight may go to the far corner. "Legal" is the placement rules' (`squareBlock`): a pawn never on your back rank, the
 * square empty and yours. The change can be taken back while the step lasts, and stays hidden from the opponent until the fight.
 */

/** Where the piece on `from` may go: the empty squares of its own half where it may stand, or [] if there is no piece of this army there (the king isn't moved). */
export function adjustTargets(army: Army, from: string, cfg: AutoChessSettings = AUTOCHESS): string[] {
  const kind = army.board[from];
  if (!kind) return [];
  return halfSquares(army.color).filter((sq) => sq !== from && !squareBlock(army, kind, sq, from, cfg));
}

/** One thing done in the adjust step: a piece moved. */
export type AdjustAction = { type: "move"; from: string; to: string };

/** An army in the adjust step: the army it began with, where its pieces stand now, and what was done to get there, in order. */
export interface Adjusted {
  start: Army;
  army: Army;
  actions: AdjustAction[];
}

export const startAdjust = (army: Army): Adjusted => ({ start: army, army, actions: [] });

export const movesUsed = (state: Adjusted) => state.actions.length;

/** Plays one action on an army, or null if it isn't legal there. */
function play(army: Army, a: AdjustAction): Army | null {
  const kind = army.board[a.from];
  if (!kind || !adjustTargets(army, a.from).includes(a.to)) return null;
  const { [a.from]: _gone, ...rest } = army.board;
  return { ...army, board: { ...rest, [a.to]: kind } };
}

/** The army after these actions from `start`, or null if one of them isn't legal in that order. */
function replay(start: Army, actions: readonly AdjustAction[]): Army | null {
  let army: Army | null = start;
  for (const a of actions) {
    army = army && play(army, a);
    if (!army) return null;
  }
  return army;
}

/** Why this piece can't go there: the change is used, there is no piece of yours (or it is the king), or the square's rules. Null: it can. */
export type AdjustBlock = "used" | "none" | "kingfixed" | SquareBlock;

export function adjustBlock(state: Adjusted, from: string, to: string, cfg: AutoChessSettings = AUTOCHESS): AdjustBlock | null {
  const { army } = state;
  if (army.king === from) return "kingfixed";
  const kind = army.board[from];
  if (!kind) return "none";
  if (movesUsed(state) >= cfg.adjustMoves) return "used";
  return squareBlock(army, kind, to, from, cfg);
}

/** Makes the move (the caller checked `adjustBlock`). */
export function adjustMove(state: Adjusted, from: string, to: string): Adjusted {
  const action: AdjustAction = { type: "move", from, to };
  return { ...state, army: play(state.army, action)!, actions: [...state.actions, action] };
}

/** The squares of the pieces you moved (each shows ↩: tap it to take the move back): where a moved piece stands now. */
export function adjustMarks(state: Adjusted): { square: string; action: "move" }[] {
  const { army, actions } = state;
  const out: { square: string; action: "move" }[] = [];
  actions.forEach((a, i) => {
    const here = !!army.board[a.to];
    // (A piece moved on again isn't there any more, and its later move holds the mark.)
    const movedOn = actions.slice(i + 1).some((b) => b.from === a.to);
    if (here && !movedOn) out.push({ square: a.to, action: "move" });
  });
  return out;
}

/** The action a tap on this square would take back (the last one that left a piece there), or -1. */
const actionAt = (state: Adjusted, square: string) => {
  if (!adjustMarks(state).some((m) => m.square === square)) return -1;
  for (let i = state.actions.length - 1; i >= 0; i--) if (state.actions[i]!.to === square) return i;
  return -1;
};

/** Why a move can't be taken back, or null: nothing moved there, or a later move of yours stands on it. */
export function undoBlock(state: Adjusted, square: string): "none" | "needed" | null {
  const i = actionAt(state, square);
  if (i < 0) return "none";
  return replay(state.start, state.actions.filter((_, j) => j !== i)) ? null : "needed";
}

/** Takes the move on this square back (the caller checked `undoBlock`). */
export function undoAction(state: Adjusted, square: string): Adjusted {
  const i = actionAt(state, square);
  const actions = state.actions.filter((_, j) => j !== i);
  return { ...state, army: replay(state.start, actions)!, actions };
}

/** The words for a refused adjust move. */
export function adjustWords(block: AdjustBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "used":
      return cfg.adjustMoves === 1 ? "You've made your move. Tap the piece you moved (↩) to take it back." : `${cfg.adjustMoves} moves at most. Tap a piece you moved (↩) to take its move back.`;
    case "none":
      return "Pick one of your pieces.";
    case "kingfixed":
      return "Your king stays where the game put it.";
    default:
      return placeWords(block, cfg);
  }
}

export const undoWords = (block: "none" | "needed") => (block === "needed" ? "Take back your other move first." : "Nothing to take back there.");
