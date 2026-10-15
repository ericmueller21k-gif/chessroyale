import type { MaterialSlip } from "@chessroyale/core";
import { Chess, type Square } from "chess.js";
import { applyMove960, gameEnd960, isChess960Fen, legalMoves960, replay960, toSan960 } from "./chess960.ts";

/**
 * Chess rules via chess.js. Moves are in UCI form (e2e4, e7e8q).
 *
 * A Chess960 position (its castling rooks named by file, Shredder-FEN: chess960.ts) goes to our own Chess960 rules
 * instead, wherever castling matters (its moves, making them, SAN, the game's end); the read-only questions below that
 * castling can't change (a piece on a square, check) ask chess.js about the same position without its castling rights.
 * A normal FEN takes exactly the path it always did.
 */

/** The position for chess.js: a Chess960 one without its castling rights (chess.js can't read them); a normal one as it is. */
const plainFen = (fen: string) => (isChess960Fen(fen) ? fen.split(" ").map((f, i) => (i === 2 ? "-" : f)).join(" ") : fen);

export function legalMoves(fen: string): string[] {
  if (isChess960Fen(fen)) return legalMoves960(fen);
  return new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
}

export function applyMove(fen: string, uci: string): string {
  if (isChess960Fen(fen)) return applyMove960(fen, uci);
  const chess = new Chess(fen);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return chess.fen();
}

export function toSan(fen: string, uci: string): string {
  if (isChess960Fen(fen)) return toSan960(fen, uci);
  const chess = new Chess(fen);
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
}

/**
 * The piece on a square: color and type (p, n, b, r, q, k), or null. The screens ask about many squares of the same
 * position, some on every redraw (the ice over every frozen piece in the blizzard), so a position is read once.
 */
export function pieceAt(fen: string, square: string): { color: "w" | "b"; type: "p" | "n" | "b" | "r" | "q" | "k" } | null {
  let board = boards.get(fen);
  if (!board) board = remember(boards, fen, new Chess(plainFen(fen)).board(), 32);
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
  if (isChess960Fen(startFen)) return gameEnd960(startFen, uciHistory);
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
  if (isChess960Fen(startFen)) return remember(positions, key(uciMoves.length), replay960(base ?? startFen, uciMoves.slice(from)));
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
  const chess = new Chess(plainFen(fen));
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
  return new Chess(plainFen(fen)).inCheck();
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

// ---------------- The exchange check (the opening allowance's material fallback) ----------------
//
// Its own small board, not chess.js: chess.js builds a SAN and two FENs for every move it lists, which made one check
// cost about 10 ms; this one costs a few hundredths of that, run on every pick the opening allowance covers. It only
// asks what attacks a square, so a pinned piece still counts as a recapture and a check isn't answered first: simple on
// purpose, and it fails safe both ways (DECISIONS.md, "Opening grace and ties survive the cut").

/** Piece values for the exchange check (a king captures only onto a square the other side doesn't attack). */
const EXCHANGE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** A board for the exchange check: 64 squares, a1 = 0, b1 = 1 ... h8 = 63; a piece letter (White's upper case) or "". */
type XBoard = string[];

const sqIndex = (s: string) => s.charCodeAt(0) - 97 + 8 * (s.charCodeAt(1) - 49);
const isWhite = (p: string) => p !== "" && p === p.toUpperCase();
const kind = (p: string) => p.toLowerCase();

function xBoard(fen: string): XBoard {
  const b: XBoard = new Array<string>(64).fill("");
  const rows = fen.split(" ")[0]!.split("/");
  rows.forEach((row, r) => {
    let f = 0;
    for (const c of row) {
      if (c >= "1" && c <= "8") f += Number(c);
      else b[f++ + 8 * (7 - r)] = c;
    }
  });
  return b;
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const LINES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** The squares of `white`'s pieces that attack square `t` (the side to move doesn't matter, nor pins). */
function attackersOf(b: XBoard, t: number, white: boolean): number[] {
  const out: number[] = [];
  const tf = t % 8;
  const tr = (t - tf) / 8;
  const at = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? f + 8 * r : -1);
  const mine = (s: number, k: string) => s >= 0 && b[s] !== "" && isWhite(b[s]!) === white && kind(b[s]!) === k;
  // A pawn attacks one rank forward, diagonally: White's from below the square, Black's from above.
  const pr = white ? tr - 1 : tr + 1;
  for (const df of [-1, 1]) if (mine(at(tf + df, pr), "p")) out.push(at(tf + df, pr));
  for (const [df, dr] of KNIGHT) if (mine(at(tf + df, tr + dr), "n")) out.push(at(tf + df, tr + dr));
  for (const [df, dr] of KING) if (mine(at(tf + df, tr + dr), "k")) out.push(at(tf + df, tr + dr));
  for (const [dirs, kinds] of [
    [DIAGONALS, "bq"],
    [LINES, "rq"],
  ] as const) {
    for (const [df, dr] of dirs) {
      for (let f = tf + df, r = tr + dr; at(f, r) >= 0; f += df, r += dr) {
        const s = at(f, r);
        if (b[s] === "") continue;
        if (isWhite(b[s]!) === white && kinds.includes(kind(b[s]!))) out.push(s);
        break;
      }
    }
  }
  return out;
}

/**
 * What `white` wins capturing on square `t`, the cheapest piece first, each side free to stop (0 or more). A pawn
 * reaching the last rank becomes a queen. A king captures only when the other side doesn't attack the square.
 */
function exchangeOn(b: XBoard, t: number, white: boolean): number {
  const victim = b[t]!;
  if (victim === "") return 0;
  const from = attackersOf(b, t, white).reduce((a, s) => (a < 0 || EXCHANGE_VALUE[kind(b[s]!)]! < EXCHANGE_VALUE[kind(b[a]!)]! ? s : a), -1);
  if (from < 0) return 0;
  const piece = b[from]!;
  if (kind(piece) === "k" && attackersOf(b, t, !white).length) return 0;
  const promotes = kind(piece) === "p" && (t >= 56 || t < 8);
  b[from] = "";
  b[t] = promotes ? (white ? "Q" : "q") : piece;
  const back = exchangeOn(b, t, !white);
  b[t] = victim;
  b[from] = piece;
  return Math.max(0, EXCHANGE_VALUE[kind(victim)]! + (promotes ? 8 : 0) - back);
}

/**
 * The material a move nets by a static exchange check: what it takes (a promotion counting its gain too), less the
 * most the opponent can then win by one capture and the exchange on that square (en passant included). Pawn 1, knight
 * and bishop 3, rook 5, queen 9. Simple on purpose: it sees a piece left hanging and a capture passed up, not a fork or
 * a pin, and a check is answered only by taking the piece giving it. Null when it can't say (no piece of the side to
 * move on the move's square, a Chess960 castling). Pure: the same answer on every device.
 */
export function exchangeNet(fen: string, move: string): number | null {
  const b = xBoard(fen);
  const fields = fen.split(" ");
  const white = fields[1] !== "b";
  const from = sqIndex(move.slice(0, 2));
  const to = sqIndex(move.slice(2, 4));
  const piece = b[from];
  if (move.length < 4 || from < 0 || from > 63 || to < 0 || to > 63 || !piece || isWhite(piece) !== white) return null;
  if (b[to] !== "" && isWhite(b[to]!) === white) return null;
  let gain = b[to] ? EXCHANGE_VALUE[kind(b[to]!)]! : 0;
  // En passant: a pawn moving diagonally onto the empty en passant square takes the pawn beside it.
  const ep = fields[3] && fields[3] !== "-" ? sqIndex(fields[3]) : -1;
  if (kind(piece) === "p" && to === ep && b[to] === "" && from % 8 !== to % 8) {
    b[white ? to - 8 : to + 8] = "";
    gain += 1;
  }
  // Castling: the rook comes across too.
  if (kind(piece) === "k" && Math.abs(to - from) === 2) {
    const [rf, rt] = to > from ? [from + 3, from + 1] : [from - 4, from - 1];
    b[rt] = b[rf]!;
    b[rf] = "";
  }
  const promo = move[4];
  if (promo) gain += EXCHANGE_VALUE[promo]! - 1;
  b[from] = "";
  b[to] = promo ? (white ? promo.toUpperCase() : promo) : piece;
  // The opponent's best capture now: on any of the mover's pieces, or only on a piece giving check when there is one
  // (a check has to be answered first; a mate leaves no capture at all).
  const king = b.findIndex((p) => p === (white ? "k" : "K"));
  const checkers = king < 0 ? [] : attackersOf(b, king, white);
  let back = 0;
  for (let s = 0; s < 64; s++) {
    if (b[s] === "" || isWhite(b[s]!) !== white || kind(b[s]!) === "k" || (checkers.length && !checkers.includes(s))) continue;
    back = Math.max(back, exchangeOn(b, s, !white));
  }
  // A pawn pushed two squares past an enemy pawn can be taken en passant.
  if (kind(piece) === "p" && Math.abs(to - from) === 16 && !checkers.length) {
    const passed = (from + to) / 2;
    for (const s of attackersOf(b, passed, !white)) {
      if (kind(b[s]!) !== "p") continue;
      const taker = b[s]!;
      b[s] = "";
      b[to] = "";
      b[passed] = taker;
      back = Math.max(back, 1 - exchangeOn(b, passed, white));
      b[passed] = "";
      b[to] = piece;
      b[s] = taker;
    }
  }
  return gain - back;
}

/**
 * Picks that give up at least `threshold` pawns of material against the engine's best move by the exchange check
 * (exchangeNet), and how: "missed" when the best move is a capture that wins material and the pick loses none of its
 * own; else "gave". The opening allowance doesn't cover them (OPENING_ALLOWANCE.materialPawns). A move the check can't
 * read is never one.
 */
export function materialSlips(fen: string, best: string, moves: readonly string[], threshold: number): Map<string, MaterialSlip> {
  const out = new Map<string, MaterialSlip>();
  const bestNet = exchangeNet(fen, best);
  if (bestNet === null) return out;
  // (The best move takes something: a piece on its square, or a pawn en passant.)
  const target = xBoard(fen)[sqIndex(best.slice(2, 4))];
  const bestTakes = !!target || (best.slice(2, 4) === fen.split(" ")[3] && /^[pP]$/.test(xBoard(fen)[sqIndex(best.slice(0, 2))] ?? ""));
  for (const m of new Set(moves)) {
    if (m === best) continue;
    const net = exchangeNet(fen, m);
    if (net === null || bestNet - net < threshold) continue;
    out.set(m, bestTakes && bestNet >= threshold && net >= 0 ? "missed" : "gave");
  }
  return out;
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
    // (Chess960: a legal castling move can be all that keeps it from stalemate.)
    if (isChess960Fen(fen)) return !legalMoves960(fen).length;
    const chess = new Chess(fen);
    return chess.isCheckmate() || chess.isStalemate();
  } catch {
    return false;
  }
}
