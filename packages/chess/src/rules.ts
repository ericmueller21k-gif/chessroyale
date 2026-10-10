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

/**
 * The piece on a square: colour and type (p, n, b, r, q, k), or null. The screens ask about many squares of the same
 * position, some on every redraw (the ice over every frozen piece in the blizzard), so a position is read once.
 */
export function pieceAt(fen: string, square: string): { color: "w" | "b"; type: "p" | "n" | "b" | "r" | "q" | "k" } | null {
  let board = boards.get(fen);
  if (!board) board = remember(boards, fen, new Chess(fen).board(), 32);
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 48;
  const p = square.length === 2 && file >= 0 && file < 8 && rank >= 1 && rank <= 8 ? board[8 - rank]![file] : null;
  return p ? { color: p.color, type: p.type } : null;
}
const boards = new Map<string, ReturnType<Chess["board"]>>();

export function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export type GameEnd = "checkmate" | "stalemate" | "repetition" | "fifty_moves" | "insufficient_material" | null;

/*
 * Replaying a whole game with chess.js costs more with every move, and the screens and the match flow ask for
 * positions and endings of the same game many times (some on every redraw): replaying on every ask was the lag that
 * grew with the match (.claude/LESSONS.md: "Lag that grows with the match"). So answers are remembered, and a line a
 * move or two on from one already replayed carries on from it. Same answers, same errors for an illegal move.
 */
const KEPT = 256;
const remember = <T>(cache: Map<string, T>, key: string, value: T, kept = KEPT): T => {
  cache.set(key, value);
  if (cache.size > kept) cache.delete(cache.keys().next().value!);
  return value;
};
const play = (chess: Chess, moves: readonly string[]) => {
  for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
};
/** The last game replayed for gameEnd (its repetition count needs the moves themselves, not only the position). */
let replayed: { start: string; moves: string[]; chess: Chess } | null = null;
const endings = new Map<string, GameEnd>();

/** For a board, a game is over by mate, stalemate, or a draw by the rules. History matters for repetition. */
export function gameEnd(startFen: string, uciHistory: readonly string[]): GameEnd {
  const key = `${startFen}|${uciHistory.join(" ")}`;
  const known = endings.get(key);
  if (known !== undefined) return known;
  const r = replayed;
  const on = !!r && r.start === startFen && r.moves.length <= uciHistory.length && r.moves.every((m, i) => m === uciHistory[i]);
  const chess = on ? r!.chess : new Chess(startFen);
  // (Off the shelf while it's moved on: an illegal move throws and leaves nothing half-played behind. A position
  // asked about on its own, with no moves, doesn't take its place.)
  if (on) replayed = null;
  play(chess, uciHistory.slice(on ? r!.moves.length : 0));
  if (on || uciHistory.length) replayed = { start: startFen, moves: [...uciHistory], chess };
  return remember(endings, key, endOf(chess));
}

function endOf(chess: Chess): GameEnd {
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

const positions = new Map<string, string>();

export function fenAfter(uciMoves: readonly string[], startFen = START_FEN): string {
  const key = (n: number) => `${startFen}|${uciMoves.slice(0, n).join(" ")}`;
  const known = positions.get(key(uciMoves.length));
  if (known !== undefined) return known;
  // From the position a few moves back, if it's known (a FEN is the whole position: the result is the same).
  let from = uciMoves.length;
  let base: string | undefined;
  while (base === undefined && from > 0 && uciMoves.length - from < 8) base = positions.get(key(--from));
  if (base === undefined) from = 0;
  const chess = new Chess(base ?? startFen);
  play(chess, uciMoves.slice(from));
  return remember(positions, key(uciMoves.length), chess.fen());
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

/**
 * The material `color` has hanging, whoever is to move: each of its pieces (not the king) attacked by a cheaper piece,
 * or attacked and not defended, by its value (pawn 1 ... queen 9). The Big Bounce's quick check that a thrown piece
 * didn't land where it's simply taken.
 */
export function hangingValue(fen: string, color: "w" | "b"): number {
  let chess: Chess;
  try {
    chess = new Chess(fen, { skipValidation: true });
  } catch {
    return 0;
  }
  const them = color === "w" ? "b" : "w";
  const value = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 } as const;
  let total = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === "k") continue;
      const attackers = chess.attackers(sq.square, them);
      if (!attackers.length) continue;
      const cheaper = attackers.some((a) => value[chess.get(a as Square)!.type] < value[sq.type]);
      if (cheaper || !chess.isAttacked(sq.square, color)) total += value[sq.type];
    }
  }
  return total;
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

// ---------------- Positions that change outside the moves (G-REX's fire) ----------------

/**
 * A board's position can change between moves: a piece the fire destroys. A base is the position after `ply` moves,
 * with whatever happened then: the moves after it are played from it. A game with no bases is a plain game from the
 * starting position.
 */
export interface Base {
  ply: number;
  fen: string;
}

/** The latest base at or before `ply` (none: the starting position). */
export function baseAt(ply: number, bases?: readonly Base[] | null): Base {
  let b: Base = { ply: 0, fen: START_FEN };
  for (const x of bases ?? []) if (x.ply <= ply && x.ply >= b.ply) b = x;
  return b;
}

/** The position after `ply` of a game's moves, with its bases (a destroyed piece stays gone). */
export function fenAtPly(history: readonly string[], ply: number, bases?: readonly Base[] | null): string {
  const b = baseAt(ply, bases);
  return fenAfter(history.slice(b.ply, ply), b.fen);
}

/** Whether a game is over, with its bases (from the latest one: no position before it can come again). */
export function gameEndWith(history: readonly string[], bases?: readonly Base[] | null): GameEnd {
  const b = baseAt(history.length, bases);
  return gameEnd(b.fen, history.slice(b.ply));
}

/**
 * The position with a square emptied (a piece the fire destroyed), still with the same side to move. A rook leaving
 * its corner takes its castling right with it, a pawn that has just made its double step takes the en passant
 * square, and the fifty-move count starts again (as after a capture).
 */
export function withoutPiece(fen: string, square: string): string {
  const parts = fen.split(" ");
  const rows = parts[0]!.split("/").map((r) => r.replace(/\d/g, (n) => ".".repeat(Number(n))).split(""));
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const row = rows[8 - rank];
  if (!row || file < 0 || file > 7) return fen;
  const piece = row[file]!;
  row[file] = ".";
  parts[0] = rows.map((r) => r.join("").replace(/\.+/g, (d) => String(d.length))).join("/");
  const corner: Record<string, string> = { a1: "Q", h1: "K", a8: "q", h8: "k" };
  if (parts[2] && corner[square] && piece.toLowerCase() === "r") parts[2] = parts[2].replace(corner[square]!, "") || "-";
  if (parts[3] && parts[3] !== "-") {
    // (The en passant square sits behind the pawn that just made its double step.)
    const behind = parts[3][1] === "3" ? `${parts[3][0]}4` : `${parts[3][0]}5`;
    if (behind === square) parts[3] = "-";
  }
  if (parts[4]) parts[4] = "0";
  return parts.join(" ");
}

/** The position with a piece put on a square (e.g. to show a destroyed piece one last time). */
export function withPiece(fen: string, square: string, piece: { color: "w" | "b"; type: string }): string {
  const parts = fen.split(" ");
  const rows = parts[0]!.split("/").map((r) => r.replace(/\d/g, (n) => ".".repeat(Number(n))).split(""));
  const row = rows[8 - Number(square[1])];
  const file = square.charCodeAt(0) - 97;
  if (!row || file < 0 || file > 7) return fen;
  row[file] = piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase();
  parts[0] = rows.map((r) => r.join("").replace(/\.+/g, (d) => String(d.length))).join("/");
  return parts.join(" ");
}

/** Whether `color`'s king is attacked in this position (whoever is to move). */
export function kingAttacked(fen: string, color: "w" | "b"): boolean {
  try {
    const chess = new Chess(fen, { skipValidation: true });
    const sq = chess.findPiece({ type: "k", color })[0];
    return !!sq && chess.isAttacked(sq, color === "w" ? "b" : "w");
  } catch {
    return true;
  }
}

/** The game is over in this position (mate or stalemate), with nothing else to go on. */
export function positionOver(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.isCheckmate() || chess.isStalemate();
  } catch {
    return false;
  }
}
