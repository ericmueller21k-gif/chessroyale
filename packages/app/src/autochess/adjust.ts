import { AUTOCHESS, type AutoChessSettings } from "@chessroyale/core";
import { boardCount, inHalf, onBoard, placeBlock, placeFromBench, placeWords, squareOf, type PlaceBlock } from "./army.ts";
import type { Army, Kind } from "./types.ts";

/**
 * The adjust step (v5): after the reveal you get one chess move in total (any one of your pieces, the king too) and one drop of
 * a bench piece onto an empty square of your half for gold: either, both or neither, in any order, and each can be taken back
 * while the step lasts. A move is the piece's own move, onto an empty square of your own half with the path clear; no captures,
 * nothing into their half, no castling, no en passant. A pawn pushes one square (two from its start rank when both are empty).
 * Check doesn't matter here: the fight's start rule covers it. A drop follows the placement rules and the board's limit.
 */

const ORTHO: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT: readonly (readonly [number, number])[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/** Where the piece on `from` can go (empty squares of its own half), or [] if there is no piece of this army there. */
export function adjustTargets(army: Army, from: string): string[] {
  const isKing = army.king === from;
  const kind = isKing ? "k" : army.board[from];
  if (!kind) return [];
  const taken = (sq: string) => sq === army.king || !!army.board[sq];
  const free = (file: number, rank: number) => onBoard(file, rank) && inHalf(squareOf(file, rank), army.color) && !taken(squareOf(file, rank));
  const f0 = from.charCodeAt(0) - 97;
  const r0 = Number(from[1]);
  const out: string[] = [];
  const step = (dirs: readonly (readonly [number, number])[], slide: boolean) => {
    for (const [df, dr] of dirs) {
      for (let n = 1; n <= (slide ? 7 : 1); n++) {
        const f = f0 + df * n;
        const r = r0 + dr * n;
        // (Blocked by anything standing there, or by the half's edge: nothing is passed through, nothing captured.)
        if (!free(f, r)) break;
        out.push(squareOf(f, r));
      }
    }
  };
  switch (kind) {
    case "p": {
      const dir = army.color === "w" ? 1 : -1;
      const start = army.color === "w" ? 2 : 7;
      if (free(f0, r0 + dir)) {
        out.push(squareOf(f0, r0 + dir));
        if (r0 === start && free(f0, r0 + 2 * dir)) out.push(squareOf(f0, r0 + 2 * dir));
      }
      break;
    }
    case "n":
      for (const [df, dr] of KNIGHT) if (free(f0 + df, r0 + dr)) out.push(squareOf(f0 + df, r0 + dr));
      break;
    case "b":
      step(DIAG, true);
      break;
    case "r":
      step(ORTHO, true);
      break;
    case "q":
      step([...ORTHO, ...DIAG], true);
      break;
    case "k":
      step([...ORTHO, ...DIAG], false);
      break;
  }
  return out;
}

/** One thing done in the adjust step: a chess move, or a drop of a bench piece (its slot and kind when it was dropped). */
export type AdjustAction = { type: "move"; from: string; to: string } | { type: "drop"; slot: number; kind: Kind; square: string };

/** An army in the adjust step: the army it began with, where its pieces stand now, and what was done to get there, in order. */
export interface Adjusted {
  start: Army;
  army: Army;
  actions: AdjustAction[];
}

export const startAdjust = (army: Army): Adjusted => ({ start: army, army, actions: [] });

export const movesUsed = (state: Adjusted) => state.actions.filter((a) => a.type === "move").length;
export const dropsUsed = (state: Adjusted) => state.actions.filter((a) => a.type === "drop").length;

/** The square an action left its piece on. */
const actionSquare = (a: AdjustAction) => (a.type === "move" ? a.to : a.square);

/** Plays one action on an army, or null if it isn't legal there (moves: the piece's own; drops: the placement rules, the same piece in the slot). */
function play(army: Army, a: AdjustAction, cfg: AutoChessSettings): Army | null {
  if (a.type === "move") {
    if (!adjustTargets(army, a.from).includes(a.to)) return null;
    return army.king === a.from ? { ...army, king: a.to } : { ...army, board: Object.fromEntries(Object.entries(army.board).map(([sq, k]) => [sq === a.from ? a.to : sq, k])) };
  }
  if (army.bench[a.slot] !== a.kind || placeBlock(army, a.kind, a.square, undefined, cfg)) return null;
  return placeFromBench(army, a.slot, a.square);
}

/** The army after these actions from `start`, or null if one of them isn't legal in that order (taking one back can break a later one). */
function replay(start: Army, actions: readonly AdjustAction[], cfg: AutoChessSettings): Army | null {
  let army: Army | null = start;
  for (const a of actions) {
    army = army && play(army, a, cfg);
    if (!army) return null;
  }
  return army;
}

export type AdjustBlock = "used" | "none" | "illegal";

/** Why this piece can't make this move, or null. */
export function adjustBlock(state: Adjusted, from: string, to: string, cfg: AutoChessSettings = AUTOCHESS): AdjustBlock | null {
  const { army } = state;
  if (army.king !== from && !army.board[from]) return "none";
  if (movesUsed(state) >= cfg.adjustMoves) return "used";
  return adjustTargets(army, from).includes(to) ? null : "illegal";
}

/** Makes the move (the caller checked `adjustBlock`). */
export function adjustMove(state: Adjusted, from: string, to: string, cfg: AutoChessSettings = AUTOCHESS): Adjusted {
  const action: AdjustAction = { type: "move", from, to };
  return { ...state, army: play(state.army, action, cfg)!, actions: [...state.actions, action] };
}

/** Why a bench piece can't be dropped at all now (before a square is picked), or null: the drop is used, the gold isn't there, or the board is full. */
export type DropBlock = "used" | "gold" | "limit";

export function dropBlock(state: Adjusted, gold: number, cfg: AutoChessSettings = AUTOCHESS): DropBlock | null {
  if (dropsUsed(state) >= cfg.adjustDrops) return "used";
  if (gold < cfg.adjustDropCost) return "gold";
  if (boardCount(state.army) >= cfg.boardLimit) return "limit";
  return null;
}

/** Why the bench piece in `slot` can't go on `square`, or null: the drop's own reasons first, then the placement rules. */
export function dropSquareBlock(state: Adjusted, slot: number, square: string, gold: number, cfg: AutoChessSettings = AUTOCHESS): DropBlock | PlaceBlock | "none" | null {
  const kind = state.army.bench[slot];
  if (!kind) return "none";
  return dropBlock(state, gold, cfg) ?? placeBlock(state.army, kind, square, undefined, cfg);
}

/** Drops the bench piece in `slot` on `square` (the caller checked `dropSquareBlock`). */
export function adjustDrop(state: Adjusted, slot: number, square: string, cfg: AutoChessSettings = AUTOCHESS): Adjusted {
  const action: AdjustAction = { type: "drop", slot, kind: state.army.bench[slot]!, square };
  return { ...state, army: play(state.army, action, cfg)!, actions: [...state.actions, action] };
}

/** The squares of the pieces you changed (each shows ↩: tap it to take the change back): the last action that left a piece there, if it's still there. */
export function adjustMarks(state: Adjusted): { square: string; action: "move" | "drop" }[] {
  const { army, actions } = state;
  const out: { square: string; action: "move" | "drop" }[] = [];
  actions.forEach((a, i) => {
    const square = actionSquare(a);
    const here = army.king === square || !!army.board[square];
    // (A piece moved on again isn't there any more, and its later move holds the mark.)
    const movedOn = actions.slice(i + 1).some((b) => b.type === "move" && b.from === square);
    if (here && !movedOn) out.push({ square, action: a.type });
  });
  return out;
}

/** The action a tap on this square would take back (the last one that left a piece there), or -1. */
const actionAt = (state: Adjusted, square: string) => {
  const mark = adjustMarks(state).find((m) => m.square === square);
  if (!mark) return -1;
  for (let i = state.actions.length - 1; i >= 0; i--) if (actionSquare(state.actions[i]!) === square && state.actions[i]!.type === mark.action) return i;
  return -1;
};

/** Why a change can't be taken back, or null: nothing changed there, or a later change of yours stands on it. */
export function undoBlock(state: Adjusted, square: string, cfg: AutoChessSettings = AUTOCHESS): "none" | "needed" | null {
  const i = actionAt(state, square);
  if (i < 0) return "none";
  return replay(state.start, state.actions.filter((_, j) => j !== i), cfg) ? null : "needed";
}

/** Takes the change on this square back (the caller checked `undoBlock`): a drop's piece goes back to its bench slot. `gives`: gold back (a drop's price). */
export function undoAction(state: Adjusted, square: string, cfg: AutoChessSettings = AUTOCHESS): { state: Adjusted; gives: number } {
  const i = actionAt(state, square);
  const actions = state.actions.filter((_, j) => j !== i);
  return { state: { ...state, army: replay(state.start, actions, cfg)!, actions }, gives: state.actions[i]!.type === "drop" ? cfg.adjustDropCost : 0 };
}

/** The words for a refused adjust move. */
export function adjustWords(block: AdjustBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "used":
      return cfg.adjustMoves === 1 ? "You've made your move. Tap the piece you moved (↩) to take it back." : `${cfg.adjustMoves} moves at most. Tap a piece you moved (↩) to take its move back.`;
    case "none":
      return "Pick one of your pieces.";
    case "illegal":
      return "That piece can't move there: one chess move, onto an empty square of your half.";
  }
}

/** The words for a drop that can't be made (the reason is on the bench piece too, greyed). */
export function dropWords(block: DropBlock | PlaceBlock | "none", gold: number, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "used":
      return cfg.adjustDrops === 1 ? "You've made your drop. Tap the piece you dropped (↩) to take it back." : `${cfg.adjustDrops} drops at most.`;
    case "gold":
      return `Not enough gold: a drop costs ${cfg.adjustDropCost} and you have ${gold}.`;
    case "none":
      return "Pick a piece from your bench.";
    case "limit":
      return `Your board is full: ${cfg.boardLimit} pieces and your king at most.`;
    default:
      // (A square that refuses the piece: the placement rules' own words.)
      return placeWords(block, cfg);
  }
}

export const undoWords = (block: "none" | "needed") => (block === "needed" ? "Take back your other change first." : "Nothing to take back there.");
