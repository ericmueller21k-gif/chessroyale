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

/** The move number in a position ("Move 6" on the top bar: White's and Black's moves share one), from its FEN. */
export function moveNumber(fen: string): number {
  return Number(fen.split(" ")[5]) || 1;
}

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

/**
 * Whether `color`'s queen (any of them) is attacked by the other side and not
 * safely defended: attacked by a cheaper piece, or attacked and undefended.
 * For the God King's "your queen is under attack!".
 */
export function queenInDanger(fen: string, color: "w" | "b"): boolean {
  const chess = new Chess(fen);
  const them = color === "w" ? "b" : "w";
  const value = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 } as const;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.type !== "q" || sq.color !== color) continue;
      const attackers = chess.attackers(sq.square, them);
      if (!attackers.length) continue;
      const cheaper = attackers.some((a) => value[chess.get(a as Square)!.type] < value.q);
      if (cheaper || !chess.isAttacked(sq.square, color)) return true;
    }
  }
  return false;
}

/** Whether the side to move is in check. */
export function inCheck(fen: string): boolean {
  return new Chess(fen).inCheck();
}

/** What a blunder costs, in words a player knows: a forced mate, a piece lost, or (neither) just the chances. */
export type BlunderCost = { kind: "mate"; in: number } | { kind: "piece"; piece: "n" | "b" | "r" | "q" } | { kind: "chances" };

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;

/**
 * What the crowd's blunder `move` costs, from the opponent's best reply to it (`reply`, from the judge's own
 * search) and any forced mate it allows (`mateIn`: the opponent mates in that many moves).
 * - A quick mate (3 moves or fewer) comes first: "allows mate".
 * - Then a piece the reply wins outright: it takes a knight, bishop, rook or queen, and that's worth at least two
 *   pawns more than whatever recaptures it back (a queen for a bishop still "loses your queen"; a queen trade
 *   doesn't).
 * - Then a longer forced mate.
 * - Otherwise the reply wins nothing a player could name (a fork, a pin, a slow squeeze): the chances say it.
 */
export function blunderCost(fen: string, move: string, reply?: string | null, mateIn?: number | null): BlunderCost {
  if (mateIn && mateIn > 0 && mateIn <= 3) return { kind: "mate", in: mateIn };
  const after = applyMove(fen, move);
  if (reply && legalMoves(after).includes(reply)) {
    const to = reply.slice(2, 4);
    const taken = pieceAt(after, to);
    const by = pieceAt(after, reply.slice(0, 2));
    if (taken && by && taken.type !== "p" && taken.type !== "k") {
      const back = legalMoves(applyMove(after, reply)).some((m) => m.slice(2, 4) === to);
      const net = PIECE_VALUE[taken.type] - (back ? PIECE_VALUE[by.type] : 0);
      if (net >= 2) return { kind: "piece", piece: taken.type };
    }
  }
  if (mateIn && mateIn > 0) return { kind: "mate", in: mateIn };
  return { kind: "chances" };
}
