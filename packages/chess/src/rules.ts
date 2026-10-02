import { Chess, type Square } from "chess.js";

/** Chess rules via chess.js. Moves are in UCI form (e2e4, e7e8q). */

export function legalMoves(fen: string): string[] {
  return new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
}

export function applyMove(fen: string, uci: string): string {
  const chess = new Chess(fen);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return chess.fen();
}

export function toSan(fen: string, uci: string): string {
  const chess = new Chess(fen);
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
}

/** The piece on a square: colour and type (p, n, b, r, q, k), or null. */
export function pieceAt(fen: string, square: string): { color: "w" | "b"; type: "p" | "n" | "b" | "r" | "q" | "k" } | null {
  const p = new Chess(fen).get(square as Square);
  return p ? { color: p.color, type: p.type } : null;
}

export function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export type GameEnd = "checkmate" | "stalemate" | "repetition" | "fifty_moves" | "insufficient_material" | null;

/** For a board, a game is over by mate, stalemate, or a draw by the rules. History matters for repetition. */
export function gameEnd(startFen: string, uciHistory: readonly string[]): GameEnd {
  const chess = new Chess(startFen);
  for (const m of uciHistory) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isThreefoldRepetition()) return "repetition";
  if (chess.isInsufficientMaterial()) return "insufficient_material";
  if (chess.isDraw()) return "fifty_moves";
  return null;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Replays SAN moves from the start position; returns UCI moves. */
export function sanLineToUci(sans: readonly string[]): string[] {
  const chess = new Chess();
  return sans.map((san) => {
    const m = chess.move(san);
    return m.from + m.to + (m.promotion ?? "");
  });
}

export function fenAfter(uciMoves: readonly string[], startFen = START_FEN): string {
  const chess = new Chess(startFen);
  for (const m of uciMoves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  return chess.fen();
}
