import { Chess } from "chess.js";
import { SQUADS, type SquadsSettings } from "@chessroyale/core";
import { allowsMateInOne, squadsLegalMoves, type Colour, type Side } from "./board.ts";

/**
 * Squads' move blocks (Eric, Oct 12: "It's not a full piece block ever. You tap their piece and play the move you
 * wanna block"). On its squad's turn on a board, before its move there is settled, a player may block one move of the
 * other squad: that piece to that square (every promotion of it, for a pawn) can't be played on their next turn on
 * that board. The piece's other moves stay legal. It costs the squad's block bank (per match) by the piece making the
 * move: pawn 1; knight, bishop or rook 2; queen 3; castling 2; the king's ordinary moves never.
 *
 * A block is placed before the squad's own move, so it names a move the other squad might have after it: any square
 * the piece could reach by how it moves (a slider up to and onto the first piece in its way, a pawn's pushes and both
 * diagonals, a knight's jumps), or castling while they still have the right. A squad may place as many as its bank
 * allows on a board in a turn (`blocks.maxPerTurn`). After the squad's move, a block that doesn't take effect is lifted
 * and refunded: their move isn't possible any more (taken, shut off, the game over), or a mercy rule on the turn's
 * blocks together (in check; no move left; every move left allows mate in one: the most recent go first). Pure:
 * chess.js, no engine.
 */

/** A block: one move of the other squad, and what it cost. */
export interface SquadsBlock {
  board: number;
  /** The blocking side (the side to move on that board when it was placed). */
  side: Side;
  /** Who placed it. */
  by: string;
  /** The blocked move, from and to ("g8f6"; castling as the king's move, "e8g8"; a promotion covers every piece). */
  move: string;
  /** The piece making it ("k": castling). */
  piece: BlockPiece;
  cost: number;
}

export type BlockPiece = "p" | "n" | "b" | "r" | "q" | "k";

/** Why a block didn't take effect (it's lifted and refunded). */
export type BlockLift =
  /** Their move isn't possible after yours: the piece taken, the way shut, the game over. */
  | "impossible"
  /** They're in check (every move answers it; the brief: "a piece that can answer the check can't be blocked"). */
  | "check"
  /** It was their only move. */
  | "no_move"
  /** Every other move of theirs allows mate in one. */
  | "mate";

/** Why a block was refused as it was placed. */
export type BlockError = "match_over" | "no_duty" | "already_moved" | "locked" | "block_taken" | "no_piece" | "king" | "not_a_move" | "bank";

const FILES = "abcdefgh";
const sq = (f: number, r: number) => FILES[f]! + String(r + 1);
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

/** The pieces on a position's board, by square ("e4" → "P"; upper case White). */
export function piecesOf(fen: string): Map<string, string> {
  const out = new Map<string, string>();
  const rows = fen.split(" ")[0]!.split("/");
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.set(sq(f, 7 - i), ch);
        f++;
      }
    }
  });
  return out;
}

const colourOfPiece = (p: string): Colour => (p === p.toUpperCase() ? "w" : "b");

/**
 * The squares a piece of the other squad could move to on their next turn, as far as this position shows: by how the
 * piece moves (a slider up to and onto the first piece in its way, either color: your move may take it; a pawn's
 * pushes and both diagonals; a knight's jumps), and castling while they still have the right (if castling can be
 * blocked). Never the king's ordinary moves. Empty if no piece of `colour` stands on `from`.
 */
export function blockTargets(fen: string, from: string, colour: Colour, s: SquadsSettings = SQUADS): string[] {
  const board = piecesOf(fen);
  const p = board.get(from);
  if (!p || colourOfPiece(p) !== colour) return [];
  const f = FILES.indexOf(from[0]!);
  const r = Number(from[1]) - 1;
  const type = p.toLowerCase();
  const out: string[] = [];
  const slide = (dirs: readonly (readonly [number, number])[]) => {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        const nf = f + df * k;
        const nr = r + dr * k;
        if (!onBoard(nf, nr)) break;
        out.push(sq(nf, nr));
        if (board.has(sq(nf, nr))) break;
      }
    }
  };
  const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  switch (type) {
    case "n":
      for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const) if (onBoard(f + df, r + dr)) out.push(sq(f + df, r + dr));
      break;
    case "b":
      slide(BISHOP);
      break;
    case "r":
      slide(ROOK);
      break;
    case "q":
      slide([...ROOK, ...BISHOP]);
      break;
    case "p": {
      const dir = colour === "w" ? 1 : -1;
      const home = colour === "w" ? 1 : 6;
      if (onBoard(f, r + dir)) out.push(sq(f, r + dir));
      if (r === home) out.push(sq(f, r + 2 * dir));
      for (const df of [-1, 1]) if (onBoard(f + df, r + dir)) out.push(sq(f + df, r + dir));
      break;
    }
    case "k": {
      // The king's ordinary moves can never be blocked; castling can, while they have the right.
      if (s.blocks.castlingCost === null) break;
      const rights = fen.split(" ")[2] ?? "-";
      const rank = colour === "w" ? 0 : 7;
      if (from !== sq(4, rank)) break;
      if (rights.includes(colour === "w" ? "K" : "k")) out.push(sq(6, rank));
      if (rights.includes(colour === "w" ? "Q" : "q")) out.push(sq(2, rank));
      break;
    }
  }
  return out;
}

/** What blocking a move by this piece costs (castling: the king's move; null: it can't be blocked). */
export function blockCost(piece: BlockPiece, s: SquadsSettings = SQUADS): number | null {
  return piece === "k" ? s.blocks.castlingCost : s.blocks.cost[piece];
}

/**
 * A block of `move` (from and to) against the pieces of `colour` (the squad not to move here), as placed: which piece
 * makes it and what it costs, or why it can't be blocked.
 */
export function checkBlock(fen: string, colour: Colour, move: string, s: SquadsSettings = SQUADS): { piece: BlockPiece; cost: number } | { error: BlockError } {
  if (typeof move !== "string" || !/^[a-h][1-8][a-h][1-8]$/.test(move)) return { error: "not_a_move" };
  const p = piecesOf(fen).get(move.slice(0, 2));
  if (!p || colourOfPiece(p) !== colour) return { error: "no_piece" };
  const piece = p.toLowerCase() as BlockPiece;
  if (!blockTargets(fen, move.slice(0, 2), colour, s).includes(move.slice(2, 4))) return { error: piece === "k" ? "king" : "not_a_move" };
  const cost = blockCost(piece, s);
  if (cost === null) return { error: "king" };
  return { piece, cost };
}

/** Blocked moves as a list (none, one, or several). */
const listOf = (blocks: readonly string[] | string | null | undefined): readonly string[] => (!blocks ? [] : typeof blocks === "string" ? [blocks] : blocks);

/** Whether a move (UCI) is one a block names (a promotion's every piece). */
export const isBlocked = (move: string, blocks: readonly string[] | string | null | undefined): boolean => listOf(blocks).includes(move.slice(0, 4));

/** The moves that may be played in a position with blocks in effect (all legal moves without any). */
export function allowedMoves(fen: string, blocks: readonly string[] | string | null | undefined): readonly string[] {
  const legal = squadsLegalMoves(fen);
  const list = listOf(blocks);
  return list.length ? legal.filter((m) => !isBlocked(m, list)) : legal;
}

/**
 * After the blocking squad's move, which of a turn's blocks on a board (in the order placed) take effect on the other
 * squad's turn (null) and which are lifted (and refunded), and why. `fen` is the position after that move, the other
 * squad to move. A block whose move isn't possible is lifted on its own; in check, every block is; then the mercy
 * rules weigh the blocks together: while they'd leave no move, or only moves that allow mate in one, the most recent
 * still standing is lifted.
 */
export function liftBlocks(fen: string, moves: readonly string[], s: SquadsSettings = SQUADS): (BlockLift | null)[] {
  const legal = squadsLegalMoves(fen);
  const out: (BlockLift | null)[] = moves.map((mv) => (legal.some((m) => isBlocked(m, mv)) ? null : "impossible"));
  if (s.blocks.liftInCheck && out.includes(null) && new Chess(fen).inCheck()) return out.map((x) => x ?? "check");
  for (let guard = 0; guard < moves.length; guard++) {
    const on = moves.filter((_, k) => out[k] === null);
    if (!on.length) break;
    const rest = legal.filter((m) => !isBlocked(m, on));
    const why: BlockLift | null = !rest.length ? "no_move" : s.blocks.liftBeforeMate && rest.every((m) => allowsMateInOne(fen, m)) ? "mate" : null;
    if (!why) break;
    out[out.lastIndexOf(null)] = why;
  }
  return out;
}

/** One block on its own: whether it would take effect after the move (null), or why it would be lifted. */
export const blockLift = (fen: string, block: string, s: SquadsSettings = SQUADS): BlockLift | null => liftBlocks(fen, [block], s)[0]!;
