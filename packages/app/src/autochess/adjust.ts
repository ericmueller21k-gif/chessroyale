import { AUTOCHESS, mulberry32, type AutoChessSettings } from "@chessroyale/core";
import { halfSquares, inHalf, placeWords, squareBlock, type SquareBlock } from "./army.ts";
import { fightMoves } from "./fight.ts";
import { armiesFen } from "./position.ts";
import type { Army, Kind } from "./types.ts";

/**
 * The adjust step, shown to players as the **move step**. Two modes (`AUTOCHESS.adjustMode`):
 *
 * - **"legal"** (v7, Eric Oct 21: "it highlights one piece at random of yours and you get 7 seconds to do a LEGAL move on your half
 *   of the board"; the default): one of your pieces is picked for you at random (seeded by the round; never the king; only a piece
 *   with at least one legal chess move that stays on your half), and you play one legal chess move with it that stays on your half,
 *   or skip. "Legal" is the fight's own rules (the HunChess engine's move generator, `fightMoves`) on the position as the step
 *   shows it, your army against theirs: a pawn steps one square (two from its start rank), a knight jumps, a slider is blocked by
 *   the pieces in its way, and a move that would leave your king in check is no move. Since the target has to be on your half, where
 *   only your pieces and your king stand, nothing is ever captured. With no such piece you have no move that round.
 * - **"teleport"** (the v6 step, kept in code, off; Eric, Oct 20): move one of your pieces (the king stays where the game put it) to any
 *   legal empty square of your half. It is not a chess move: a knight may go to the far corner. "Legal" is the placement rules'
 *   (`squareBlock`): a pawn never on your back rank, the square empty and yours.
 *
 * Either way the change can be taken back while the step lasts, and stays hidden from the opponent until the fight.
 */

/** Where the piece on `from` may go in the teleport step: the empty squares of its own half where it may stand, or [] if there is no piece of this army there (the king isn't moved). */
export function adjustTargets(army: Army, from: string, cfg: AutoChessSettings = AUTOCHESS): string[] {
  const kind = army.board[from];
  if (!kind) return [];
  return halfSquares(army.color).filter((sq) => sq !== from && !squareBlock(army, kind, sq, from, cfg));
}

/** Where the buy step leads: the adjust step, or (with the step turned off, `adjustStep` false) straight to the fight. */
export const stepAfterBuy = (cfg: AutoChessSettings = AUTOCHESS): "adjust" | "fight" => (cfg.adjustStep ? "adjust" : "fight");

// ---------------------------------------------------------------------------------------------------------------------
// The legal move step (v7)

/** The piece picked for a side's move step: where it stands, what it is, and the squares it may legally go to (sorted). */
export interface MovePick {
  square: string;
  kind: Kind;
  targets: string[];
}

/**
 * Every piece of this army (never the king) with at least one legal move that stays on its half, in a steady order (square names
 * sorted), with the squares it may go to. The moves are the fight's own (`fightMoves`) in the position of this army against
 * `opponent`'s, this army to move: their pieces block and attack, and a move that leaves your king in check isn't legal.
 */
export function movablePieces(army: Army, opponent: Army, cfg: AutoChessSettings = AUTOCHESS): MovePick[] {
  const moves = fightMoves(armiesFen(army, opponent, army.color), cfg);
  const out: MovePick[] = [];
  for (const square of Object.keys(army.board).sort()) {
    const targets = new Set<string>();
    for (const m of moves) {
      const to = m.slice(2, 4);
      if (m.startsWith(square) && inHalf(to, army.color)) targets.add(to);
    }
    if (targets.size) out.push({ square, kind: army.board[square]!, targets: [...targets].sort() });
  }
  return out;
}

/** The squares the piece on `from` may legally move to while staying on its half (none if it isn't a piece of this army that can move). */
export const legalTargets = (army: Army, opponent: Army, from: string, cfg: AutoChessSettings = AUTOCHESS): string[] => movablePieces(army, opponent, cfg).find((p) => p.square === from)?.targets ?? [];

/** The one piece picked at random for a side's move step (seeded: the same round, the same pick), or null if no piece can move. */
export function movePick(army: Army, opponent: Army, seed: number, cfg: AutoChessSettings = AUTOCHESS): MovePick | null {
  const pieces = movablePieces(army, opponent, cfg);
  if (!pieces.length) return null;
  return pieces[Math.floor(mulberry32(seed >>> 0)() * pieces.length)]!;
}

/** The seeds of a round's move picks, yours and the bot's (from the round's seed; they differ). */
export const youMoveSeed = (roundSeed: number) => (roundSeed ^ 0x3c6ef372) >>> 0;
export const botMoveSeed = (roundSeed: number) => (roundSeed ^ 0xa54ff53a) >>> 0;

// ---------------------------------------------------------------------------------------------------------------------
// The state of the step

/** One thing done in the adjust step: a piece moved. */
export type AdjustAction = { type: "move"; from: string; to: string };

/**
 * An army in the adjust step: the army it began with, where its pieces stand now, and what was done to get there, in order. In the
 * legal mode `pick` is the piece picked for it (null: no piece could move; in the teleport step any piece may move, so it is null too).
 */
export interface Adjusted {
  start: Army;
  army: Army;
  actions: AdjustAction[];
  pick: MovePick | null;
}

/** The teleport step's start: nothing picked, any piece may go. */
export const startAdjust = (army: Army): Adjusted => ({ start: army, army, actions: [], pick: null });

/** The legal move step's start: this army against theirs, with its piece picked at random by `seed` (null if none can move). */
export const startMove = (army: Army, opponent: Army, seed: number, cfg: AutoChessSettings = AUTOCHESS): Adjusted => ({ start: army, army, actions: [], pick: movePick(army, opponent, seed, cfg) });

export const movesUsed = (state: Adjusted) => state.actions.length;

/** Plays one action on an army, or null if it isn't a possible one there (every legal move onto an empty square of your half is also a teleport target, so this holds for both modes). */
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

/**
 * Why this piece can't go there, or null: it is the king, there is no piece of yours there, or (legal mode) no piece can move, it
 * isn't the lit piece, or the square is no legal move of it; or the change is used; or the square's rules (a square not on your
 * half, taken, your king's, a pawn on your back rank, a fourth pawn in a file).
 */
export type AdjustBlock = "used" | "none" | "kingfixed" | "notpicked" | "nomove" | "illegal" | SquareBlock;

export function adjustBlock(state: Adjusted, from: string, to: string, cfg: AutoChessSettings = AUTOCHESS): AdjustBlock | null {
  const { army } = state;
  if (army.king === from) return "kingfixed";
  const kind = army.board[from];
  if (!kind) return "none";
  if (cfg.adjustMode === "legal") {
    if (!state.pick) return "nomove";
    if (movesUsed(state) >= cfg.adjustMoves) return "used";
    if (state.pick.square !== from) return "notpicked";
    const square = squareBlock(army, kind, to, from, cfg);
    if (square) return square;
    return state.pick.targets.includes(to) ? null : "illegal";
  }
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

/**
 * The squares to light while the step runs (legal mode): the picked piece's legal squares, until it has moved (the one move is
 * used, then there are none). The teleport step lights the squares of the piece you tap (`adjustTargets`).
 */
export const pickTargets = (state: Adjusted, cfg: AutoChessSettings = AUTOCHESS): string[] => (state.pick && movesUsed(state) < cfg.adjustMoves ? state.pick.targets : []);

/** The words for a refused adjust move (short: they show in the small spot under the board, about 15 characters a line). */
export function adjustWords(block: AdjustBlock, cfg: AutoChessSettings = AUTOCHESS): string {
  switch (block) {
    case "used":
      return cfg.adjustMoves === 1 ? "Moved. Tap ↩ to undo." : `${cfg.adjustMoves} moves max. Tap ↩ to undo.`;
    case "none":
      return "Pick one of yours";
    case "kingfixed":
      return "King stays put";
    case "notpicked":
      return "Only the lit piece";
    case "nomove":
      return "No piece can move";
    case "illegal":
      return "Not a legal move";
    default:
      return placeWords(block, cfg);
  }
}

export const undoWords = (block: "none" | "needed") => (block === "needed" ? "Undo the other first" : "Nothing to undo");
