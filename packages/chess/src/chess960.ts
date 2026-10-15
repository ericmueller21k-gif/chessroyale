/**
 * Chess960 (Fischer Random): its 960 start positions and its rules, castling included. chess.js (1.4) knows only
 * normal castling and can't even load a Chess960 position's castling rights, so Chess960 games use these rules
 * instead. rules.ts hands a position here only when its FEN names its castling rooks by file (below); every normal
 * game stays on chess.js, unchanged (DECISIONS.md, "Chess960's rules").
 *
 * - **Positions** are FEN strings with castling rights written Shredder-style: the file of each rook that may still
 *   castle, White's in capitals, the king's side first ("HAha" for the normal setup, "HFhf" for a king on g1 between
 *   rooks on f1 and h1). Reading also takes X-FEN's KQkq (the outermost rook on that side).
 * - **Moves** are UCI, with castling written as the king taking its own rook (e1h1), as Stockfish writes it with
 *   UCI_Chess960 on. SAN writes castling as O-O and O-O-O.
 * - **Castling**, whatever the setup: the king lands on g1 (the king's side) or c1 (the queen's side), the rook beside
 *   it on f1 or d1 (g8, f8, c8, d8 for Black). Every square the king or the rook crosses or lands on is empty but for
 *   those two; the king isn't in check, and no square from where it stands to where it lands is attacked (judged with
 *   the king and that rook lifted off, so the rook can't shield a square it leaves). The right goes when the king
 *   moves (castling included), when that rook moves, or when that rook is taken. A king or rook may already stand on
 *   its square, and the two may swap.
 * - A position is a value: a move makes a new one and "undo" is the previous one, kept.
 */
import type { GameEnd } from "./rules.ts";

type Color = "w" | "b";

/** A position, read from a FEN. Squares 0 to 63: a1 = 0, b1 = 1, ... h8 = 63. */
interface Pos {
  /** The piece on each square as its FEN letter ("P", "k", ...), or "" for none. */
  board: string[];
  turn: Color;
  /** The squares of the rooks that may still castle, both colors (a rook on rank 1 is White's, on rank 8 Black's). */
  castle: number[];
  /** The square a pawn just skipped with its double step (-1: none). */
  ep: number;
  half: number;
  full: number;
}

/** A move. Castling: `to` is the castling rook's square (the king takes its own rook, as in UCI). */
interface Move {
  from: number;
  to: number;
  promo?: string;
  castle?: boolean;
}

/** The normal start position's number in the standard (Scharnagl) numbering of the 960. */
export const CHESS960_STANDARD_INDEX = 518;

const FILES = "abcdefgh";
const sqName = (s: number) => `${FILES[s & 7]}${(s >> 3) + 1}`;
const sqOf = (name: string): number => {
  const f = name.charCodeAt(0) - 97;
  const r = name.charCodeAt(1) - 49;
  return name.length === 2 && f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
};
const colorOf = (p: string): Color => (p === p.toUpperCase() ? "w" : "b");
const other = (c: Color): Color => (c === "w" ? "b" : "w");
/** A piece of a color: `kind` in lower case ("n") becomes "N" for White. */
const piece = (kind: string, c: Color) => (c === "w" ? kind.toUpperCase() : kind);
/** The first square of a color's back rank. */
const homeRank = (c: Color) => (c === "w" ? 0 : 56);

const KNIGHT: readonly (readonly [number, number])[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING: readonly (readonly [number, number])[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const STRAIGHT: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAGONAL: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** The square `df` files and `dr` ranks from `s`, or -1 off the board. */
const step = (s: number, df: number, dr: number) => {
  const f = (s & 7) + df;
  const r = (s >> 3) + dr;
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
};

// ---------------- Start positions ----------------

/** Where the two knights go among the five squares left after the bishops and the queen (the numbering's table). */
const KNIGHT_PAIRS: readonly (readonly [number, number])[] = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];

/**
 * White's back rank in start position `index` (0 to 959), in the standard numbering: the light-squared bishop on b, d,
 * f or h (index mod 4), the dark-squared one on a, c, e or g (the next mod 4), the queen on one of the six squares left
 * (mod 6), the knights on two of the five left (the last 0 to 9), and a rook, the king and a rook on the three left.
 * 0 is BBQNNRKR, 518 the normal RNBQKBNR, 959 RKRNNQBB.
 */
export function chess960BackRank(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 959) throw new RangeError(`No Chess960 start position ${index}`);
  const rank: string[] = Array(8).fill("");
  const empty = () => rank.flatMap((p, i) => (p ? [] : [i]));
  let n = index;
  rank[(n % 4) * 2 + 1] = "B";
  n = Math.floor(n / 4);
  rank[(n % 4) * 2] = "B";
  n = Math.floor(n / 4);
  rank[empty()[n % 6]!] = "Q";
  n = Math.floor(n / 6);
  const left = empty();
  for (const i of KNIGHT_PAIRS[n]!) rank[left[i]!] = "N";
  const [r1, k, r2] = empty();
  rank[r1!] = "R";
  rank[k!] = "K";
  rank[r2!] = "R";
  return rank.join("");
}

/** Start position `index` (0 to 959) as a FEN, every castling right on ("HAha" for 518, the normal setup). */
export function chess960Fen(index: number): string {
  const rank = chess960BackRank(index);
  return writeFen(readFen(`${rank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${rank} w KQkq - 0 1`));
}

/** A start position drawn from a random source (a float in [0, 1), e.g. a seeded one: same source, same position). */
export function randomChess960(rng: () => number): { index: number; fen: string } {
  const index = Math.min(959, Math.floor(rng() * 960));
  return { index, fen: chess960Fen(index) };
}

/**
 * Whether a FEN is a Chess960 position for these rules: its castling rights name rooks by file (Shredder-FEN). A normal
 * FEN (KQkq or "-") never does, so normal games never come here. (A Chess960 game whose rights are all gone plays the
 * same under either rules.)
 */
export function isChess960Fen(fen: string): boolean {
  const a = fen.indexOf(" ");
  const b = a < 0 ? -1 : fen.indexOf(" ", a + 1);
  if (b < 0) return false;
  const end = fen.indexOf(" ", b + 1);
  const rights = fen.slice(b + 1, end < 0 ? undefined : end);
  return /[A-Ha-h]/.test(rights);
}

// ---------------- FEN ----------------

function bad(fen: string, why: string): never {
  throw new Error(`Invalid Chess960 FEN (${why}): ${fen}`);
}

function readFen(fen: string): Pos {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0]?.split("/") ?? [];
  if (rows.length !== 8) bad(fen, "placement");
  const board: string[] = Array.from({ length: 64 }, () => "");
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") f += Number(ch);
      else if ("pnbrqkPNBRQK".includes(ch) && f < 8) board[(7 - i) * 8 + f++] = ch;
      else bad(fen, "placement");
    }
    if (f !== 8) bad(fen, "placement");
  });
  for (const c of ["w", "b"] as const) if (board.filter((p) => p === piece("k", c)).length !== 1) bad(fen, "kings");
  if ([0, 7].some((r) => board.slice(r * 8, r * 8 + 8).some((p) => p === "P" || p === "p"))) bad(fen, "pawns");
  const turn = parts[1] ?? "w";
  if (turn !== "w" && turn !== "b") bad(fen, "side to move");
  const castle: number[] = [];
  for (const ch of parts[2] && parts[2] !== "-" ? parts[2] : "") {
    const c: Color = ch === ch.toUpperCase() ? "w" : "b";
    const home = homeRank(c);
    const king = board.indexOf(piece("k", c));
    const rook = piece("r", c);
    if (king < home || king > home + 7) bad(fen, "castling: the king is off its back rank");
    let sq = -1;
    const lower = ch.toLowerCase();
    if (lower === "k" || lower === "q") {
      // X-FEN: the outermost rook on that side of the king.
      const files = lower === "k" ? [7, 6, 5, 4, 3, 2, 1] : [0, 1, 2, 3, 4, 5, 6];
      for (const f of files) if (sq < 0 && board[home + f] === rook && (lower === "k" ? home + f > king : home + f < king)) sq = home + f;
    } else if (lower >= "a" && lower <= "h") sq = home + lower.charCodeAt(0) - 97;
    if (sq < 0 || board[sq] !== rook || sq === king) bad(fen, "castling: no rook there");
    // (One rook a side.)
    if (castle.some((s) => (s >> 3) === (sq >> 3) && s > king === sq > king)) bad(fen, "castling: two rooks on one side");
    castle.push(sq);
  }
  const ep = parts[3] && parts[3] !== "-" ? sqOf(parts[3]) : -1;
  if (parts[3] && parts[3] !== "-" && (ep < 0 || (ep >> 3) !== (turn === "w" ? 5 : 2))) bad(fen, "en passant");
  const half = parts[4] === undefined ? 0 : Number(parts[4]);
  const full = parts[5] === undefined ? 1 : Number(parts[5]);
  if (!Number.isInteger(half) || half < 0 || !Number.isInteger(full) || full < 1) bad(fen, "move counts");
  return { board, turn, castle, ep, half, full };
}

/** The castling field: each rook's file, White's then Black's, the king's side before the queen's. */
function castleField(pos: Pos): string {
  let out = "";
  for (const c of ["w", "b"] as const) {
    const king = pos.board.indexOf(piece("k", c));
    const mine = pos.castle.filter((s) => (s >> 3) === homeRank(c) >> 3).sort((a, b) => (b > king ? 1 : 0) - (a > king ? 1 : 0));
    for (const s of mine) out += c === "w" ? FILES[s & 7]!.toUpperCase() : FILES[s & 7]!;
  }
  return out || "-";
}

/**
 * A position as a FEN. The en passant square is written only when a capture there is legal (as chess.js writes it),
 * so the same position always has the same FEN.
 */
function writeFen(pos: Pos): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let gap = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[r * 8 + f]!;
      if (!p) gap++;
      else {
        if (gap) row += gap;
        gap = 0;
        row += p;
      }
    }
    rows.push(gap ? row + gap : row);
  }
  return `${rows.join("/")} ${pos.turn} ${castleField(pos)} ${epCapturable(pos) ? sqName(pos.ep) : "-"} ${pos.half} ${pos.full}`;
}

/** Whether the side to move can legally take en passant now. */
function epCapturable(pos: Pos): boolean {
  if (pos.ep < 0) return false;
  const pawn = piece("p", pos.turn);
  const back = pos.turn === "w" ? -1 : 1;
  return [-1, 1].some((df) => {
    const from = step(pos.ep, df, back);
    return from >= 0 && pos.board[from] === pawn && isLegal(pos, { from, to: pos.ep });
  });
}

/** The position's identity for repetition: placement, side to move, castling rights and a live en passant square. */
const positionKey = (pos: Pos) => writeFen(pos).split(" ").slice(0, 4).join(" ");

// ---------------- Attacks ----------------

/** Each color's pieces as FEN letters (looked up, not made, in the hot loops). */
const LETTERS = { w: { p: "P", n: "N", b: "B", r: "R", q: "Q", k: "K" }, b: { p: "p", n: "n", b: "b", r: "r", q: "q", k: "k" } } as const;

/** Whether a slider of `by`'s (`slider` or its queen) reaches `s` from direction (df, dr). */
function rayHits(board: readonly string[], s: number, df: number, dr: number, slider: string, queen: string): boolean {
  for (let at = step(s, df, dr); at >= 0; at = step(at, df, dr)) {
    const p = board[at];
    if (p) return p === slider || p === queen;
  }
  return false;
}

/** Whether square `s` is attacked by any piece of color `by` on this board. */
function attacked(board: readonly string[], s: number, by: Color): boolean {
  const L = LETTERS[by];
  const pawnFrom = by === "w" ? -1 : 1;
  if (board[step(s, -1, pawnFrom)] === L.p || board[step(s, 1, pawnFrom)] === L.p) return true;
  for (const [df, dr] of KNIGHT) if (board[step(s, df, dr)] === L.n) return true;
  for (const [df, dr] of KING) if (board[step(s, df, dr)] === L.k) return true;
  for (const [df, dr] of STRAIGHT) if (rayHits(board, s, df, dr, L.r, L.q)) return true;
  for (const [df, dr] of DIAGONAL) if (rayHits(board, s, df, dr, L.b, L.q)) return true;
  return false;
}

const kingSquare = (board: readonly string[], c: Color) => board.indexOf(LETTERS[c].k);
const inCheckPos = (pos: Pos) => attacked(pos.board, kingSquare(pos.board, pos.turn), other(pos.turn));

// ---------------- Moves ----------------

/** Every move of the side to move that obeys how the pieces move, before checking its own king is safe. */
function pseudoMoves(pos: Pos): Move[] {
  const out: Move[] = [];
  const us = pos.turn;
  const them = other(us);
  const b = pos.board;
  const enemy = (s: number) => !!b[s] && colorOf(b[s]!) === them;
  for (let from = 0; from < 64; from++) {
    const p = b[from]!;
    if (!p || colorOf(p) !== us) continue;
    const kind = p.toLowerCase();
    if (kind === "p") {
      const dir = us === "w" ? 1 : -1;
      const last = us === "w" ? 7 : 0;
      const add = (to: number) => {
        if (to >> 3 === last) for (const promo of ["q", "r", "b", "n"]) out.push({ from, to, promo });
        else out.push({ from, to });
      };
      const one = step(from, 0, dir);
      if (one >= 0 && !b[one]) {
        add(one);
        const two = step(one, 0, dir);
        if (from >> 3 === (us === "w" ? 1 : 6) && !b[two]) out.push({ from, to: two });
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, dir);
        if (to >= 0 && (enemy(to) || to === pos.ep)) add(to);
      }
    } else if (kind === "n" || kind === "k") {
      for (const [df, dr] of kind === "n" ? KNIGHT : KING) {
        const to = step(from, df, dr);
        if (to >= 0 && (!b[to] || enemy(to))) out.push({ from, to });
      }
    } else {
      const dirs = kind === "r" ? STRAIGHT : kind === "b" ? DIAGONAL : [...STRAIGHT, ...DIAGONAL];
      for (const [df, dr] of dirs) {
        for (let to = step(from, df, dr); to >= 0; to = step(to, df, dr)) {
          if (!b[to]) out.push({ from, to });
          else {
            if (enemy(to)) out.push({ from, to });
            break;
          }
        }
      }
    }
  }
  out.push(...castlingMoves(pos));
  return out;
}

/** The castling moves of the side to move that the rules allow now (see the top of this file). */
function castlingMoves(pos: Pos): Move[] {
  const us = pos.turn;
  const home = homeRank(us);
  const king = kingSquare(pos.board, us);
  const out: Move[] = [];
  for (const rook of pos.castle) {
    if (rook >> 3 !== home >> 3) continue;
    const short = rook > king;
    const kingTo = home + (short ? 6 : 2);
    const rookTo = home + (short ? 5 : 3);
    const lo = Math.min(king, kingTo, rook, rookTo);
    const hi = Math.max(king, kingTo, rook, rookTo);
    let clear = true;
    for (let s = lo; s <= hi; s++) if (s !== king && s !== rook && pos.board[s]) clear = false;
    if (!clear) continue;
    const lifted = pos.board.slice();
    lifted[king] = "";
    lifted[rook] = "";
    let safe = true;
    for (let s = Math.min(king, kingTo); s <= Math.max(king, kingTo); s++) if (attacked(lifted, s, other(us))) safe = false;
    if (safe) out.push({ from: king, to: rook, castle: true });
  }
  return out;
}

/** The board after a move (any move the pieces could make; legality is checked elsewhere). */
function boardAfter(pos: Pos, m: Move): string[] {
  const us = pos.turn;
  const b = pos.board.slice();
  const moving = b[m.from]!;
  if (m.castle) {
    const home = homeRank(us);
    const short = m.to > m.from;
    b[m.from] = "";
    b[m.to] = "";
    b[home + (short ? 6 : 2)] = moving;
    b[home + (short ? 5 : 3)] = LETTERS[us].r;
    return b;
  }
  b[m.to] = m.promo ? piece(m.promo, us) : moving;
  b[m.from] = "";
  // (En passant: the pawn taken stands behind the square the taker lands on.)
  if (m.to === pos.ep && moving === LETTERS[us].p) b[step(m.to, 0, us === "w" ? -1 : 1)] = "";
  return b;
}

/** The position after a move: the board, the castling rights, the en passant square and the clocks. */
function make(pos: Pos, m: Move): Pos {
  const us = pos.turn;
  const moving = pos.board[m.from]!;
  const pawn = moving === LETTERS[us].p;
  let castle: number[];
  if (m.castle) castle = pos.castle.filter((s) => s >> 3 !== homeRank(us) >> 3);
  else {
    // The king moving takes both its rights; a rook leaving its square, or taken on it, takes that one.
    const kingMoved = moving === LETTERS[us].k;
    castle = pos.castle.filter((s) => s !== m.from && s !== m.to && !(kingMoved && s >> 3 === homeRank(us) >> 3));
  }
  const reset = pawn || (!m.castle && !!pos.board[m.to]);
  return {
    board: boardAfter(pos, m),
    turn: other(us),
    castle,
    ep: pawn && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1,
    half: reset ? 0 : pos.half + 1,
    full: pos.full + (us === "b" ? 1 : 0),
  };
}

/** Whether a move leaves its own king safe. */
function isLegal(pos: Pos, m: Move): boolean {
  const board = boardAfter(pos, m);
  return !attacked(board, kingSquare(board, pos.turn), other(pos.turn));
}

const legal = (pos: Pos) => pseudoMoves(pos).filter((m) => isLegal(pos, m));
const uciOf = (m: Move) => sqName(m.from) + sqName(m.to) + (m.promo ?? "");

/** The legal move written as `uci` (castling as the king taking its own rook), or an error. */
function findMove(pos: Pos, uci: string, fen: string): Move {
  const m = legal(pos).find((x) => uciOf(x) === uci);
  if (!m) throw new Error(`Illegal Chess960 move ${uci} in ${fen}`);
  return m;
}

// ---------------- The rules, FEN in and out ----------------

/** Every legal move in UCI, castling as the king taking its own rook (e1h1). */
export function legalMoves960(fen: string): string[] {
  return legal(readFen(fen)).map(uciOf);
}

/** The position after a move (UCI; castling as the king taking its own rook). Throws on an illegal move. */
export function applyMove960(fen: string, uci: string): string {
  const pos = readFen(fen);
  return writeFen(make(pos, findMove(pos, uci, fen)));
}

/** A move in SAN: O-O and O-O-O for castling (the king's side and the queen's), with + or # after a check or mate. */
export function toSan960(fen: string, uci: string): string {
  const pos = readFen(fen);
  return sanOf(pos, findMove(pos, uci, fen), legal(pos));
}

function sanOf(pos: Pos, m: Move, all: readonly Move[]): string {
  return sanBody(pos, m, all) + checkSuffix(make(pos, m));
}

function checkSuffix(next: Pos): string {
  if (!inCheckPos(next)) return "";
  return legal(next).length ? "+" : "#";
}

/** SAN without the check or mate sign. */
function sanBody(pos: Pos, m: Move, all: readonly Move[]): string {
  if (m.castle) return m.to > m.from ? "O-O" : "O-O-O";
  const p = pos.board[m.from]!;
  const kind = p.toLowerCase();
  const takes = !!pos.board[m.to] || (kind === "p" && m.to === pos.ep);
  if (kind === "p") return (takes ? `${FILES[m.from & 7]}x` : "") + sqName(m.to) + (m.promo ? `=${m.promo.toUpperCase()}` : "");
  // Another piece of the same kind that could go there too: the file if that tells them apart, else the rank, else both.
  const rivals = all.filter((x) => !x.castle && x.to === m.to && x.from !== m.from && pos.board[x.from] === p);
  let from = "";
  if (rivals.length) {
    if (!rivals.some((x) => (x.from & 7) === (m.from & 7))) from = FILES[m.from & 7]!;
    else if (!rivals.some((x) => x.from >> 3 === m.from >> 3)) from = String((m.from >> 3) + 1);
    else from = sqName(m.from);
  }
  return kind.toUpperCase() + from + (takes ? "x" : "") + sqName(m.to);
}

/** A SAN move (O-O, O-O-O, Nf3, exd5, e8=Q, ...; check signs optional) as UCI. Throws if it isn't legal here. */
export function sanToUci960(fen: string, san: string): string {
  const pos = readFen(fen);
  const want = san.trim().replace(/[+#!?]+$/, "").replace(/0/g, "O");
  const all = legal(pos);
  const m = all.find((x) => sanBody(pos, x, all) === want);
  if (!m) throw new Error(`Illegal Chess960 move ${san} in ${fen}`);
  return uciOf(m);
}

/**
 * Castling made the way a normal board makes it: the king onto the square it lands on (g1 or c1; g8 or c8), for each
 * castling move in `moves`, wherever that can't mean anything else: the king isn't already there, its rook isn't
 * standing there (then the move is already the king onto its rook), and no other move of the king goes there. The
 * gestures, "from" + "to" → the castling move (e.g. "e1g1" → "e1h1"; "b1c1" → "b1a1").
 */
export function castleShortcuts960(fen: string, moves: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const pos = readFen(fen);
  const king = kingSquare(pos.board, pos.turn);
  const home = homeRank(pos.turn);
  for (const m of moves) {
    const from = sqOf(m.slice(0, 2));
    const to = sqOf(m.slice(2, 4));
    if (from !== king || to < 0 || pos.board[to] !== piece("r", pos.turn) || !pos.castle.includes(to)) continue;
    const lands = home + (to > from ? 6 : 2);
    if (lands === from || lands === to) continue;
    const gesture = sqName(from) + sqName(lands);
    if (moves.some((x) => x.startsWith(gesture))) continue;
    out.set(gesture, m);
  }
  return out;
}

// ---------------- Game end ----------------

/** Whether neither side can mate with what's left (as chess.js judges it: lone kings, one minor, or bishops all on one color). */
function insufficient(pos: Pos): boolean {
  const pieces = pos.board.flatMap((p, s) => (p ? [{ kind: p.toLowerCase(), shade: ((s & 7) + (s >> 3)) % 2 }] : []));
  if (pieces.length === 2) return true;
  const bishops = pieces.filter((p) => p.kind === "b");
  if (pieces.length === 3 && pieces.some((p) => p.kind === "b" || p.kind === "n")) return true;
  return pieces.length === bishops.length + 2 && bishops.length > 0 && new Set(bishops.map((p) => p.shade)).size === 1;
}

/** The last game replayed for gameEnd960, so a game a move or two on carries on from it. */
let replayed: { start: string; moves: string[]; pos: Pos; seen: Map<string, number> } | null = null;
const endings = new Map<string, GameEnd>();

/**
 * Whether a game is over: mate, stalemate, or a draw by the rules (threefold repetition, insufficient material, the
 * fifty-move rule), the same checks in the same order as normal games. A Chess960 stalemate can hide a legal
 * castling move, which is why chess.js can't judge it.
 */
export function gameEnd960(startFen: string, uciHistory: readonly string[]): GameEnd {
  const key = `${startFen}|${uciHistory.join(" ")}`;
  const known = endings.get(key);
  if (known !== undefined) return known;
  const r = replayed;
  const on = !!r && r.start === startFen && r.moves.length <= uciHistory.length && r.moves.every((m, i) => m === uciHistory[i]);
  let pos = on ? r!.pos : readFen(startFen);
  const seen = on ? new Map(r!.seen) : new Map([[positionKey(pos), 1]]);
  for (const uci of uciHistory.slice(on ? r!.moves.length : 0)) {
    pos = make(pos, findMove(pos, uci, startFen));
    const k = positionKey(pos);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  replayed = { start: startFen, moves: [...uciHistory], pos, seen };
  let end: GameEnd = null;
  if (!legal(pos).length) end = inCheckPos(pos) ? "checkmate" : "stalemate";
  else if ((seen.get(positionKey(pos)) ?? 0) >= 3) end = "repetition";
  else if (insufficient(pos)) end = "insufficient_material";
  else if (pos.half >= 100) end = "fifty_moves";
  endings.set(key, end);
  if (endings.size > 256) endings.delete(endings.keys().next().value!);
  return end;
}

/** The position after a line of moves from `startFen`. */
export function replay960(startFen: string, uciMoves: readonly string[]): string {
  let pos = readFen(startFen);
  for (const uci of uciMoves) pos = make(pos, findMove(pos, uci, startFen));
  return writeFen(pos);
}

// ---------------- Perft ----------------

/** The number of move sequences `depth` plies deep (perft): the standard check of a move generator. */
export function perft960(fen: string, depth: number): number {
  const count = (pos: Pos, d: number): number => {
    const moves = legal(pos);
    if (d <= 1) return d === 1 ? moves.length : 1;
    let n = 0;
    for (const m of moves) n += count(make(pos, m), d - 1);
    return n;
  };
  return count(readFen(fen), depth);
}

// ---------------- A quick material search (no engine) ----------------

const MATERIAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Material for `c` (pawn 1 ... queen 9) less the other side's. */
function materialOf(board: readonly string[], c: Color): number {
  let total = 0;
  for (const p of board) if (p) total += colorOf(p) === c ? MATERIAL[p.toLowerCase()]! : -MATERIAL[p.toLowerCase()]!;
  return total;
}

/**
 * The moves that keep the most material two moves deep, in UCI as legalMoves960 writes them (castling as the king
 * taking its own rook): each move scored by the reply that hurts most. A mate in one scores above any material, a reply
 * that mates below any, a position with no reply a draw (0, as even). (A stalemate after a quiet reply isn't looked for:
 * it's rare, and only the side far behind gets it.) The Hidden Boss's last resort in phase 2, when no device can play
 * his move (recluse-phase2.ts, phase2FallbackMove). Any position, normal or Chess960; empty with no legal move.
 */
export function materialBest960(fen: string): string[] {
  const pos = readFen(fen);
  const me = pos.turn;
  const MATE = 1000;
  let best = -Infinity;
  let picks: Move[] = [];
  for (const m of legal(pos)) {
    const after = make(pos, m);
    const replies = legal(after);
    let worst = Infinity;
    if (!replies.length) worst = inCheckPos(after) ? MATE : 0;
    for (const r of replies) {
      const next = make(after, r);
      const v = inCheckPos(next) && !legal(next).length ? -MATE : materialOf(next.board, me);
      if (v < worst) worst = v;
      // (Already worse than the best so far: it can't win or tie.)
      if (worst < best) break;
    }
    if (worst > best) {
      best = worst;
      picks = [m];
    } else if (worst === best) picks.push(m);
  }
  return picks.map(uciOf);
}
