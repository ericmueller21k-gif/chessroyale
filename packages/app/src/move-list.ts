import { START_FEN, applyMove, type Base } from "@chessroyale/chess";

/**
 * The boss battle's running move list (Eric, Oct 25: "a move by move thing… with little icons and all the details of each
 * move… a running tally"; docs/decisions/2026-10-25-board-layout.md). Its moves are the match's own history (the boss
 * board's `history` and `bases`), never a copy kept elsewhere: this module only reads them, a ply at a time.
 *
 * - `plyRows`: what each move was (the piece, the square it went to, what it took, a promotion, castling), worked out
 *   once per new ply from the position before it and remembered (`PlyCache`), so a screen drawn five times a second never
 *   replays the game (lesson: "Lag that grows with the match"). A move taken back (the God King's Last Stand) or a board
 *   changed between moves (a new base) is noticed and only what changed is worked out again.
 * - `noteTurns` / `turnTimes`: how long each move took, as this device saw it (the boss's think from its turn starting
 *   to its move landing; the crowd's from the move clock starting to its move being in), and in a raid how many picked
 *   the crowd's move. The game's history has no times, so these are what this device watched; a move played before it
 *   was watching (a reload, a late join) shows none.
 */

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

/** One move of the game, as the history has it. */
export interface PlyRow {
  /** Its index in the history (0: the game's first move). */
  ply: number;
  move: string;
  /** The side that moved. */
  color: "w" | "b";
  piece: PieceType;
  /** The square it went to (castling: the king's). */
  to: string;
  /** The piece it took (en passant: a pawn), else null. */
  captured: PieceType | null;
  promo: PieceType | null;
  castle: "O-O" | "O-O-O" | null;
  /** The position before it and after it (true positions: what's drawn goes through camo.ts). */
  fenBefore: string;
  fenAfter: string;
}

/** The piece on a square of a FEN (a plain parse: no chess library, cheap enough for every row). */
export function pieceOn(fen: string, square: string): { color: "w" | "b"; type: PieceType } | null {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (file < 0 || file > 7 || !(rank >= 1 && rank <= 8)) return null;
  const row = fen.split(" ")[0]!.split("/")[8 - rank];
  if (!row) return null;
  let x = 0;
  for (const ch of row) {
    if (ch >= "1" && ch <= "8") {
      x += Number(ch);
      if (x > file) return null;
      continue;
    }
    if (x === file) return { color: ch === ch.toUpperCase() ? "w" : "b", type: ch.toLowerCase() as PieceType };
    x++;
  }
  return null;
}

/** One move's row from the position before it (null: not a move there). */
export function plyRow(ply: number, move: string, fenBefore: string): PlyRow | null {
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const mover = pieceOn(fenBefore, from);
  if (!mover) return null;
  let fenAfter: string;
  try {
    fenAfter = applyMove(fenBefore, move);
  } catch {
    return null;
  }
  const target = pieceOn(fenBefore, to);
  // (En passant: a pawn moving diagonally onto an empty square takes the pawn beside it.)
  const enPassant = mover.type === "p" && from[0] !== to[0] && !target;
  const captured = target && target.color !== mover.color ? target.type : enPassant ? "p" : null;
  const castle = mover.type === "k" && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2 ? (to[0] === "g" ? "O-O" : "O-O-O") : null;
  return { ply, move, color: mover.color, piece: mover.type, to, captured, promo: (move[4] as PieceType | undefined) ?? null, castle, fenBefore, fenAfter };
}

/** What `plyRows` remembers between calls (one per board). */
export interface PlyCache {
  key: string;
  rows: PlyRow[];
}

export const newPlyCache = (): PlyCache => ({ key: "", rows: [] });

/**
 * Every move of the history as a row, working out only the plies the cache doesn't have yet. `key` names the board (its
 * id and generation): a new one starts again. Bases (a position changed between moves: G-REX's fire, a slam) start the
 * move at their ply from their position; a base the cache didn't know about redoes the rows from its ply on.
 */
export function plyRows(cache: PlyCache, key: string, history: readonly string[], bases?: readonly Base[] | null): PlyRow[] {
  const baseFen = new Map<number, string>();
  for (const b of bases ?? []) baseFen.set(b.ply, b.fen);
  if (cache.key !== key) {
    cache.key = key;
    cache.rows = [];
  }
  const rows = cache.rows;
  // Keep what still matches: the same move from the same position (a move taken back, or a base, ends it).
  let keep = 0;
  while (keep < rows.length && keep < history.length) {
    const r = rows[keep]!;
    const before = baseFen.get(keep) ?? (keep === 0 ? START_FEN : rows[keep - 1]!.fenAfter);
    if (r.move !== history[keep] || r.fenBefore !== before) break;
    keep++;
  }
  rows.length = keep;
  for (let ply = keep; ply < history.length; ply++) {
    const before = baseFen.get(ply) ?? (ply === 0 ? START_FEN : rows[ply - 1]!.fenAfter);
    const row = plyRow(ply, history[ply]!, before);
    if (!row) break;
    rows.push(row);
  }
  return rows;
}

/** Who made a move, for its picture: the boss, the crowd (you, alone), the God King for the crowd, or the opening before the battle. */
export type Mover = "boss" | "crowd" | "king" | "opening";

/**
 * Whose move each row was: before `startPly` the opening the battle started from; then the crowd's side's moves are the
 * crowd's, the God King's when he played that crowd move (`kingMoves`: the crowd moves he played, counted from 1), and the
 * rest the boss's.
 */
export function moverOf(row: Pick<PlyRow, "ply" | "color">, crowdSide: "w" | "b", startPly: number, kingMoves: readonly number[]): Mover {
  if (row.ply < startPly) return "opening";
  if (row.color !== crowdSide) return "boss";
  // (The crowd's nth move of the battle: its plies alternate with the boss's from startPly; the history starts from the
  // starting position, so an even ply is White's.)
  const first = startPly + ((startPly % 2 === 0 ? "w" : "b") === crowdSide ? 0 : 1);
  const n = Math.floor((row.ply - first) / 2) + 1;
  return kingMoves.includes(n) ? "king" : "crowd";
}

/** The battle's first ply from its NetBoss.startMove (a move number: the ply is its White half). */
export const battleStartPly = (startMove: number) => Math.max(0, (startMove - 1) * 2);

/** "12." for White's move, "12…" for Black's. */
export const moveNumber = (ply: number) => `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "." : "…"}`;

/** A move's time as the list shows it: "4s", "12s", "1:05". */
export function timeShown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What `noteTurns` reads from a match: the phase and the boss's board (a slice of GameView). */
export interface TurnInput {
  phase:
    | { kind: "play"; board: { ply: number }; startsAt: number }
    | { kind: "boss"; boss: { board: { history: readonly string[] } }; thinking?: boolean; intro?: boolean; loading?: boolean }
    | { kind: "reveal"; board: { ply: number }; mine: { result: { players: readonly { move: string | null }[]; playedMove: string } } }
    | { kind: string };
  board: { id: number; generation: number; history: readonly string[] } | null;
}

/** One board's watched turns: when each ply's turn started and its move was in (ms), and a raid's picks. */
export interface TurnBook {
  key: string;
  start: Map<number, number>;
  end: Map<number, number>;
  picks: Map<number, { n: number; of: number }>;
}

const books = new WeakMap<object, TurnBook>();

/** The turns this device has watched in a match (made on first use). */
export function turnBook(match: object): TurnBook {
  let b = books.get(match);
  if (!b) books.set(match, (b = { key: "", start: new Map(), end: new Map(), picks: new Map() }));
  return b;
}

/**
 * Notes what the match shows now (call it whenever a screen with the list draws; it's cheap): a crowd move's clock
 * starting, the boss starting to think, a raid's reveal (the votes are in: the crowd's move is decided, and how many
 * picked it), and any move that has landed in the history since.
 */
export function noteTurns(book: TurnBook, m: TurnInput, now: number): void {
  const board = m.board;
  if (!board) return;
  const key = `${board.id}:${board.generation}`;
  if (book.key !== key) {
    book.key = key;
    book.start.clear();
    book.end.clear();
    book.picks.clear();
  }
  const p = m.phase;
  if (p.kind === "play") {
    const ply = (p as { board: { ply: number } }).board.ply;
    // (The latest clock for a move not yet in: a re-pick after the Last Stand starts afresh.)
    const at = (p as { startsAt: number }).startsAt;
    if (!book.end.has(ply) && (book.start.get(ply) ?? -Infinity) < at) book.start.set(ply, at);
  } else if (p.kind === "boss") {
    const b = p as Extract<TurnInput["phase"], { kind: "boss" }>;
    if (b.thinking && !b.intro && !b.loading) {
      const ply = b.boss.board.history.length;
      if (!book.start.has(ply)) book.start.set(ply, now);
    }
  } else if (p.kind === "reveal") {
    const r = p as Extract<TurnInput["phase"], { kind: "reveal" }>;
    const ply = r.board.ply;
    if (book.start.has(ply) && !book.end.has(ply)) book.end.set(ply, now);
    if (!book.picks.has(ply)) {
      const picked = r.mine.result.players.filter((x) => x.move);
      book.picks.set(ply, { n: picked.filter((x) => x.move === r.mine.result.playedMove).length, of: picked.length });
    }
  }
  // Moves in the history whose turn this device saw start: in by now.
  const h = board.history.length;
  for (const [ply] of book.start) if (ply < h && !book.end.has(ply)) book.end.set(ply, now);
  // (A move taken back: its turn starts again.)
  for (const [ply] of book.end) if (ply >= h && !(p.kind === "reveal" && ply === (p as { board: { ply: number } }).board.ply)) book.end.delete(ply);
}

/** How long a move took as this device saw it (ms), or null when it didn't see the turn start. */
export function turnMs(book: TurnBook, ply: number): number | null {
  const a = book.start.get(ply);
  const b = book.end.get(ply);
  return a === undefined || b === undefined ? null : Math.max(0, b - a);
}
