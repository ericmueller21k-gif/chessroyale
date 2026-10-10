import { Chess } from "chess.js";
import { SQUADS, type Rng, type SquadsSettings } from "@chessroyale/core";
import type { GameEnd } from "../rules.ts";

/**
 * A Squads board: a game from its start (the starting position or an opening's last position), its moves in this
 * match, each side's chess clock, and how it ended. Pure: chess rules come from chess.js; no engine. Moves are UCI
 * (e2e4, e1g1, e7e8q).
 */

export type Colour = "w" | "b";
/** A match's two squads: side 0 and side 1. */
export type Side = 0 | 1;

/**
 * How a board ended: by the rules of chess, on time (a flag fall), at the silent safety cap or by the test-only "Next
 * round" (both decided by material).
 */
export type BoardEnd = Exclude<GameEnd, null> | "flag" | "safety_cap" | "admin";

export interface BoardResult {
  /** The colour that won; null for a draw. */
  winner: Colour | null;
  reason: BoardEnd;
  /** The material count, when the safety cap (or the admin button) decided it. */
  material?: { w: number; b: number };
}

/** Where a board starts: the starting position, or an opening from the library. */
export interface BoardStart {
  fen: string;
  /** The opening's id in the library; null for the normal starting position. */
  openingId: string | null;
}

export interface SquadsBoard {
  /** The board's number in its match, from 0. */
  id: number;
  start: BoardStart;
  /** The position now. */
  fen: string;
  /** Moves played in this match (an opening's moves are in `start`). */
  moves: readonly string[];
  /** Each position since the start (the start included), for threefold repetition without replaying the game. */
  keys: readonly string[];
  /** The side of the match that plays White here. */
  white: Side;
  /** Each colour's time left on its clock (ms). */
  clock: { readonly w: number; readonly b: number };
  result: BoardResult | null;
}

export const otherSide = (s: Side): Side => (s === 0 ? 1 : 0);
export const otherColour = (c: Colour): Colour => (c === "w" ? "b" : "w");

/** The position's identity for repetition: placement, side to move, castling rights, en passant (as chess.js counts it). */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function newSquadsBoard(id: number, start: BoardStart, white: Side, clock: { w: number; b: number }): SquadsBoard {
  return { id, start, fen: start.fen, moves: [], keys: [positionKey(start.fen)], white, clock: { ...clock }, result: null };
}

/** The colour to move on a board. */
export function colourToMove(board: Pick<SquadsBoard, "fen">): Colour {
  return board.fen.split(" ")[1] === "b" ? "b" : "w";
}

/** The side of the match that plays `colour` on this board. */
export function sideOf(board: Pick<SquadsBoard, "white">, colour: Colour): Side {
  return colour === "w" ? board.white : otherSide(board.white);
}

/*
 * Legal moves, fast. chess.js's public `moves()` builds each move's SAN and two FENs, and the SAN generates every
 * legal move again, so a position costs a couple of milliseconds; a lobby asks tens of thousands of times. chess.js's
 * own Move class calls its internal generator (`_moves`, `_makeMove`, `_undoMove`), and so do these helpers, with the
 * public API as the fallback. The same moves in the same order as `legalMoves` (rules.ts): a unit test holds them to
 * it on random positions, so a chess.js update that changed its internals fails loudly.
 */
interface InternalMove {
  from: number;
  to: number;
  promotion?: string;
}
interface Internals {
  _moves(o: { legal: boolean }): InternalMove[];
  _makeMove(m: InternalMove): void;
  _undoMove(): unknown;
}
const internals = (c: Chess): Internals | null => {
  const x = c as unknown as Partial<Internals>;
  return typeof x._moves === "function" && typeof x._makeMove === "function" && typeof x._undoMove === "function" ? (x as Internals) : null;
};
/** A 0x88 square index (chess.js's) as a square name. */
const square = (i: number) => "abcdefgh"[i & 15]! + String(8 - (i >> 4));
const uciOf = (m: InternalMove) => square(m.from) + square(m.to) + (m.promotion ?? "");

function movesOf(chess: Chess): string[] {
  const x = internals(chess);
  return x ? x._moves({ legal: true }).map(uciOf) : chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
}

const known = new Map<string, readonly string[]>();
/** Every legal move in a position (UCI), as `legalMoves` gives them (a shared list: don't change it). */
export function squadsLegalMoves(fen: string): readonly string[] {
  const hit = known.get(fen);
  if (hit) return hit;
  const moves = movesOf(new Chess(fen));
  known.set(fen, moves);
  if (known.size > 512) known.delete(known.keys().next().value!);
  return moves;
}

export function isLegal(fen: string, move: string): boolean {
  return squadsLegalMoves(fen).includes(move);
}

const moveIn = (chess: Chess, uci: string) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

/**
 * The game's end in a position, by the same rules and in the same order as `gameEnd` (rules.ts): mate, stalemate,
 * threefold repetition, too little material, fifty moves. Repetition counts the board's positions since its start.
 */
function endOf(chess: Chess, keys: readonly string[]): BoardResult | null {
  if (!movesOf(chess).length) return chess.inCheck() ? { winner: chess.turn() === "w" ? "b" : "w", reason: "checkmate" } : { winner: null, reason: "stalemate" };
  const key = keys[keys.length - 1];
  if (keys.filter((k) => k === key).length >= 3) return { winner: null, reason: "repetition" };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: "insufficient_material" };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: "fifty_moves" };
  return null;
}

/** Plays a legal move on a live board (an illegal one, or a finished board, throws). */
export function playOnBoard(board: SquadsBoard, move: string): SquadsBoard {
  if (board.result) throw new Error(`Board ${board.id} is finished`);
  if (!isLegal(board.fen, move)) throw new Error(`Illegal move ${move} in ${board.fen}`);
  const chess = new Chess(board.fen);
  moveIn(chess, move);
  const fen = chess.fen();
  const keys = [...board.keys, positionKey(fen)];
  return { ...board, fen, moves: [...board.moves, move], keys, result: endOf(chess, keys) };
}

/** Each colour's material (pawn 1, knight and bishop 3, rook 5, queen 9; kings don't count). */
export function materialCount(fen: string, s: SquadsSettings = SQUADS): { w: number; b: number } {
  const out = { w: 0, b: 0 };
  for (const ch of fen.split(" ")[0]!) {
    const t = ch.toLowerCase() as keyof SquadsSettings["material"];
    const v = s.material[t];
    if (v === undefined) continue;
    out[ch === t ? "b" : "w"] += v;
  }
  return out;
}

/**
 * Whether `colour` could still mate: anything more than a lone king, or a king with a single knight or bishop (the
 * usual online rule for a flag fall).
 */
export function canMate(fen: string, colour: Colour): boolean {
  const pieces = [...fen.split(" ")[0]!].filter((ch) => /[pnbrq]/i.test(ch) && (colour === "w" ? ch === ch.toUpperCase() : ch === ch.toLowerCase()));
  return !(pieces.length === 0 || (pieces.length === 1 && /[nb]/i.test(pieces[0]!)));
}

/** A flag fall: `colour` ran out of time and loses the board, unless the other side can't mate (then a draw). */
export function flagFall(board: SquadsBoard, colour: Colour): SquadsBoard {
  if (board.result) return board;
  const other = otherColour(colour);
  return { ...board, clock: { ...board.clock, [colour]: 0 }, result: { winner: canMate(board.fen, other) ? other : null, reason: "flag" } };
}

/** Ends a live board on material: a lead of `materialLead` or more wins, anything less is a draw (no engine). */
export function decideByMaterial(board: SquadsBoard, reason: "safety_cap" | "admin", s: SquadsSettings = SQUADS): SquadsBoard {
  if (board.result) return board;
  const material = materialCount(board.fen, s);
  const lead = material.w - material.b;
  const winner: Colour | null = lead >= s.materialLead ? "w" : -lead >= s.materialLead ? "b" : null;
  return { ...board, result: { winner, reason, material } };
}

/** A side's points from a finished board (a win, a draw, a loss); null while it's still going. */
export function boardPoints(board: SquadsBoard, side: Side, s: SquadsSettings = SQUADS): number | null {
  if (!board.result) return null;
  if (board.result.winner === null) return s.drawPoints;
  return sideOf(board, board.result.winner) === side ? s.winPoints : 0;
}

/** A random legal move (a missed move or pick), never one of `exclude` unless nothing else is legal. */
export function randomLegalMove(fen: string, rng: Rng, exclude: readonly string[] = []): string {
  const legal = squadsLegalMoves(fen);
  if (!legal.length) throw new Error(`No legal moves in ${fen}`);
  const open = legal.filter((m) => !exclude.includes(m));
  const from = open.length ? open : legal;
  return from[Math.floor(rng() * from.length)]!;
}

/** Whether, after `move`, the opponent has a mate in one (chess.js marks a mating move with "#"). */
export function allowsMateInOne(fen: string, move: string): boolean {
  const chess = new Chess(fen);
  moveIn(chess, move);
  if (chess.isGameOver()) return false;
  const x = internals(chess);
  if (!x) return chess.moves().some((san) => san.endsWith("#"));
  for (const reply of x._moves({ legal: true })) {
    x._makeMove(reply);
    const mate = chess.inCheck() && x._moves({ legal: true }).length === 0;
    x._undoMove();
    if (mate) return true;
  }
  return false;
}

/** The same question through chess.js's public API only (slow), for the guard test. */
export function allowsMateInOneSlow(fen: string, move: string): boolean {
  const chess = new Chess(fen);
  moveIn(chess, move);
  return !chess.isGameOver() && chess.moves().some((san) => san.endsWith("#"));
}

/**
 * The final's mercy rule: a block on `block` is cancelled when every other legal move allows mate in one (blocking
 * it would leave the squad nothing but moves that get mated). Stops at the first move that doesn't.
 */
export function blockCancelledByMate(fen: string, block: string): boolean {
  const others = squadsLegalMoves(fen).filter((m) => m !== block);
  if (!others.length) return true;
  return others.every((m) => allowsMateInOne(fen, m));
}
