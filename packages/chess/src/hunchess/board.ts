/**
 * The HunChess engine's board (docs/decisions/2026-10-21-hunchess-engine.md): a 0x88 board with make/unmake, legal moves and
 * the rules of an Auto chess fight inside the position itself, so the search plays toward them and away from them.
 *
 * Two rule sets:
 * - "fight" (Auto chess): no castling at the start, no promotion: a pawn that moves onto its last rank **cashes in** (it leaves
 *   the board; its owner gets gold after the round); a side left with only its king loses (both: a draw); a stall (threefold
 *   repetition, 10 moves a side with no capture or cash-in, or 60 moves a side) is decided by what each side gained over the fight:
 *   the engine's score of the final position less its score of the start (`gainBase`; `result()` marks it `stall`; index.ts
 *   judges it); mate, stalemate, the fifty-move rule and too little material to
 *   mate as in chess. (Docs: docs/decisions/2026-10-21-autochess-endings.md, docs/decisions/2026-10-21-autochess-gain.md.)
 * - "chess": the ordinary game (castling, promotion), used to measure the engine against Stockfish.
 *
 * Pure TypeScript, no DOM: it runs in a Web Worker, in Node and in tests alike. Written from scratch for HunChess.
 */

import * as pst from "./pst.ts";

// (Bound once here: an imported binding can be read through a getter in some module loaders, too slow for the search's inner loops.)
const PHASE_INC = pst.PHASE_INC;
const PST_MG = pst.PST_MG;
const PST_EG = pst.PST_EG;

// ---------------------------------------------------------------------------------------------------------------------
// Pieces and squares

export const WHITE = 0;
export const BLACK = 1;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

/** A piece code: its type (1 to 6) plus 8 for Black; 0 is an empty square. */
export const pieceOf = (color: number, type: number) => (color << 3) | type;
export const colorOf = (p: number) => p >> 3;
export const typeOf = (p: number) => p & 7;

/** 0x88 square: rank * 16 + file (rank 0 is the first rank). */
export const sq = (file: number, rank: number) => rank * 16 + file;
export const fileOf = (s: number) => s & 7;
export const rankOf = (s: number) => s >> 4;
export const squareName = (s: number) => String.fromCharCode(97 + fileOf(s)) + String(rankOf(s) + 1);
export const parseSquare = (name: string) => sq(name.charCodeAt(0) - 97, name.charCodeAt(1) - 49);
/** 0x88 to 0..63 (a1 = 0, h8 = 63), for tables. */
export const sq64 = (s: number) => (s >> 4) * 8 + (s & 7);

const KNIGHT_STEPS = [33, 31, 18, 14, -14, -18, -31, -33];
const KING_STEPS = [1, -1, 16, -16, 17, 15, -15, -17];
const BISHOP_DIRS = [17, 15, -15, -17];
const ROOK_DIRS = [1, -1, 16, -16];

// ---------------------------------------------------------------------------------------------------------------------
// Moves: from | to << 7 | promotion type << 14 | flags << 17

export const F_CAPTURE = 1;
export const F_EP = 2;
export const F_DOUBLE = 4;
export const F_CASTLE = 8;
export const F_CASHIN = 16;

export const moveFrom = (m: number) => m & 127;
export const moveTo = (m: number) => (m >> 7) & 127;
export const movePromo = (m: number) => (m >> 14) & 7;
export const moveFlags = (m: number) => m >> 17;
const mk = (from: number, to: number, promo: number, flags: number) => from | (to << 7) | (promo << 14) | (flags << 17);

/** A move in UCI notation; a cash-in is the plain from-to ("e7e8"), a promotion carries its piece ("e7e8q"). */
export function moveUci(m: number): string {
  const p = movePromo(m);
  return squareName(moveFrom(m)) + squareName(moveTo(m)) + (p ? " pnbrqk"[p] : "");
}

// ---------------------------------------------------------------------------------------------------------------------
// The rules

export interface HunRules {
  /** "fight": Auto chess's rules (cash-in, the counters); "chess": the ordinary game. */
  variant: "fight" | "chess";
  /** Moves a side with no capture or cash-in before the fight stalls (fight). */
  quietCap: number;
  /** Moves a side before the fight stalls (fight). */
  moveCap: number;
  /** A stall goes to the side the engine's score of the final position favors by at least this much (centipawns); closer is a draw (fight). */
  stallWinMargin: number;
}

export const CHESS_RULES: HunRules = { variant: "chess", quietCap: 0, moveCap: 0, stallWinMargin: 0 };
export const fightRules = (cfg: { quietCap: number; moveCap: number; stallWinMargin: number }): HunRules => ({
  variant: "fight",
  quietCap: cfg.quietCap,
  moveCap: cfg.moveCap,
  stallWinMargin: cfg.stallWinMargin,
});

/** How a game ended. "decided": a fight's side too far ahead for too long (the referee's rule, not the board's). */
export type HunEnd = "checkmate" | "decided" | "stalemate" | "repetition" | "fifty_moves" | "insufficient_material" | "cap" | "quiet" | "king_alone";

export interface HunResult {
  end: HunEnd;
  /** A fight's stall (a repetition, the quiet cap, the move cap): the winner is the engine's score's to decide (`winner` -1 until judged). */
  stall?: boolean;
  /** WHITE, BLACK, or -1 for a draw. */
  winner: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Zobrist keys (two 32-bit halves), from a fixed seed so every run hashes alike

function keyStream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // (mulberry32)
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
const nextKey = keyStream(0x48756e43);
const table = (n: number) => {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = nextKey() | 0;
  return a;
};
/** Piece code (16) x 0x88 square (128). */
const Z_PIECE_LO = table(16 * 128);
const Z_PIECE_HI = table(16 * 128);
const Z_SIDE_LO = nextKey() | 0;
const Z_SIDE_HI = nextKey() | 0;
const Z_CASTLE_LO = table(16);
const Z_CASTLE_HI = table(16);
const Z_EP_LO = table(8);
const Z_EP_HI = table(8);
/** The fight's counters (only in the search's table key, never in the repetition key): quiet plies, plies. */
const Z_QUIET_LO = table(256);
const Z_QUIET_HI = table(256);
const Z_PLY_LO = table(512);
const Z_PLY_HI = table(512);

/** Castling rights lost when a piece moves from or to a square. */
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[sq(4, 0)] = 15 & ~3;
CASTLE_MASK[sq(0, 0)] = 15 & ~2;
CASTLE_MASK[sq(7, 0)] = 15 & ~1;
CASTLE_MASK[sq(4, 7)] = 15 & ~12;
CASTLE_MASK[sq(0, 7)] = 15 & ~8;
CASTLE_MASK[sq(7, 7)] = 15 & ~4;


const MAX_PLY = 1024;

/** Exchange values (centipawns) by type, and scratch space for `see`. */
const SEE_VAL = [0, 100, 320, 330, 500, 950, 20000];
const SEE_GAINS = new Int32Array(40);
const SEE_CLEARED = new Int32Array(80);

/** One position and its history (for unmaking moves and spotting repetitions). */
export class Position {
  board = new Int8Array(128);
  side = WHITE;
  castling = 0;
  /** The en passant target square, or -1 (set only when a pawn could take there, as chess.js does). */
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = new Int32Array(2);
  /** How many of each piece code stand on the board. */
  counts = new Int32Array(16);
  /** Non-king pieces per color. */
  pieces = new Int32Array(2);
  /** Piece lists: each color's squares (kings too) at [color * 32 + i] for i below `listLen[color]`, and each square's place in its list. */
  list = new Int16Array(64);
  listLen = new Int32Array(2);
  private listIdx = new Int8Array(128);
  /** The position's key (placement, side, castling, en passant): repetitions compare it. */
  keyLo = 0;
  keyHi = 0;
  /** Incremental piece-square sums (White minus Black) and the game phase. */
  mg = 0;
  eg = 0;
  phase = 0;

  rules: HunRules;
  /** The fight's counters: plies since the last capture or cash-in, plies played. */
  quiet = 0;
  plies = 0;
  /**
   * A fight's yardstick for gains: the stall judge's score of the position the fight started from (centipawns, White's view). A
   * stall goes to the side whose score improved on it by `stallWinMargin` (Eric, Oct 21: what each side gained, not the bigger
   * army's lead). Set by whoever starts the fight (index.ts `replay`, the fight); 0 otherwise.
   */
  gainBase = 0;
  /** Pawns each side has cashed in so far (fight). */
  cashed = new Int32Array(2);
  /** Whether the side to move is in check. */
  inCheck = false;

  // The undo stack.
  private sp = 0;
  private uMove = new Int32Array(MAX_PLY);
  private uCaptured = new Int8Array(MAX_PLY);
  private uCastling = new Int8Array(MAX_PLY);
  private uEp = new Int16Array(MAX_PLY);
  private uHalf = new Int32Array(MAX_PLY);
  private uQuiet = new Int32Array(MAX_PLY);
  private uInCheck = new Uint8Array(MAX_PLY);
  private uMg = new Int32Array(MAX_PLY);
  private uEg = new Int32Array(MAX_PLY);
  /** Keys of every position so far (the starting one and after each move), for repetitions. */
  private histLo = new Int32Array(MAX_PLY + 1);
  private histHi = new Int32Array(MAX_PLY + 1);
  /** How many positions the history holds before the first unmakeable move (moves replayed from the start can't be unmade past this). */
  private base = 0;

  constructor(fen: string, rules: HunRules = CHESS_RULES) {
    this.rules = rules;
    this.setFen(fen);
  }

  get stackDepth() {
    return this.sp;
  }

  setFen(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    this.board.fill(0);
    this.counts.fill(0);
    this.pieces.fill(0);
    this.listLen.fill(0);
    this.mg = 0;
    this.eg = 0;
    this.phase = 0;
    const rows = parts[0]!.split("/");
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r] ?? "") {
        if (ch >= "1" && ch <= "8") f += Number(ch);
        else {
          const lower = ch.toLowerCase();
          const type = " pnbrqk".indexOf(lower);
          if (type < 1) throw new Error(`bad FEN piece ${ch}`);
          this.put(pieceOf(ch === lower ? BLACK : WHITE, type), sq(f, 7 - r));
          f++;
        }
      }
    }
    this.side = parts[1] === "b" ? BLACK : WHITE;
    const c = parts[2] ?? "-";
    this.castling = (c.includes("K") ? 1 : 0) | (c.includes("Q") ? 2 : 0) | (c.includes("k") ? 4 : 0) | (c.includes("q") ? 8 : 0);
    // (Rights only where the king and rook still stand.)
    if (this.board[sq(4, 0)] !== pieceOf(WHITE, KING)) this.castling &= ~3;
    if (this.board[sq(7, 0)] !== pieceOf(WHITE, ROOK)) this.castling &= ~1;
    if (this.board[sq(0, 0)] !== pieceOf(WHITE, ROOK)) this.castling &= ~2;
    if (this.board[sq(4, 7)] !== pieceOf(BLACK, KING)) this.castling &= ~12;
    if (this.board[sq(7, 7)] !== pieceOf(BLACK, ROOK)) this.castling &= ~4;
    if (this.board[sq(0, 7)] !== pieceOf(BLACK, ROOK)) this.castling &= ~8;
    this.ep = parts[3] && parts[3] !== "-" ? parseSquare(parts[3]) : -1;
    if (this.ep >= 0 && !this.epCapturable(this.ep)) this.ep = -1;
    this.halfmove = Number(parts[4] ?? 0) || 0;
    this.fullmove = Number(parts[5] ?? 1) || 1;
    this.cashed.fill(0);
    this.quiet = 0;
    this.plies = 0;
    this.sp = 0;
    this.computeKey();
    this.histLo[0] = this.keyLo;
    this.histHi[0] = this.keyHi;
    this.base = 0;
    this.inCheck = this.attacked(this.kings[this.side]!, this.side ^ 1);
  }

  fen(): string {
    let out = "";
    for (let r = 7; r >= 0; r--) {
      let gap = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[sq(f, r)]!;
        if (!p) gap++;
        else {
          if (gap) out += gap;
          gap = 0;
          const ch = " pnbrqk"[typeOf(p)]!;
          out += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
        }
      }
      if (gap) out += gap;
      if (r) out += "/";
    }
    const c = (this.castling & 1 ? "K" : "") + (this.castling & 2 ? "Q" : "") + (this.castling & 4 ? "k" : "") + (this.castling & 8 ? "q" : "");
    return `${out} ${this.side === WHITE ? "w" : "b"} ${c || "-"} ${this.ep >= 0 ? squareName(this.ep) : "-"} ${this.halfmove} ${this.fullmove}`;
  }

  private listAdd(c: number, s: number) {
    const idx = this.listLen[c]!++;
    this.list[c * 32 + idx] = s;
    this.listIdx[s] = idx;
  }

  private listRemove(c: number, s: number) {
    const idx = this.listIdx[s]!;
    const last = --this.listLen[c]!;
    const moved = this.list[c * 32 + last]!;
    this.list[c * 32 + idx] = moved;
    this.listIdx[moved] = idx;
  }

  private put(p: number, s: number) {
    this.board[s] = p;
    this.counts[p]!++;
    this.listAdd(colorOf(p), s);
    const t = typeOf(p);
    if (t === KING) this.kings[colorOf(p)] = s;
    else this.pieces[colorOf(p)]!++;
    this.mg += PST_MG[p * 128 + s]!;
    this.eg += PST_EG[p * 128 + s]!;
    this.phase += PHASE_INC[t]!;
  }

  /** Recomputes the piece-square sums (after eval.ts fills its tables). */
  refreshScores(): void {
    this.mg = 0;
    this.eg = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const p = this.board[s]!;
      if (p) {
        this.mg += PST_MG[p * 128 + s]!;
        this.eg += PST_EG[p * 128 + s]!;
      }
    }
  }

  private computeKey() {
    let lo = 0;
    let hi = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const p = this.board[s]!;
      if (p) {
        lo ^= Z_PIECE_LO[p * 128 + s]!;
        hi ^= Z_PIECE_HI[p * 128 + s]!;
      }
    }
    if (this.side === BLACK) {
      lo ^= Z_SIDE_LO;
      hi ^= Z_SIDE_HI;
    }
    lo ^= Z_CASTLE_LO[this.castling]!;
    hi ^= Z_CASTLE_HI[this.castling]!;
    if (this.ep >= 0) {
      lo ^= Z_EP_LO[fileOf(this.ep)]!;
      hi ^= Z_EP_HI[fileOf(this.ep)]!;
    }
    this.keyLo = lo;
    this.keyHi = hi;
  }

  /** The search table's key: the position's key plus the fight's counters (which change what a position is worth). */
  ttLo(): number {
    if (this.rules.variant !== "fight") return this.keyLo;
    // (The gain's yardstick too: the same position is worth something else in a fight that started elsewhere.)
    return this.keyLo ^ Z_QUIET_LO[this.quiet & 255]! ^ Z_PLY_LO[this.plies & 511]! ^ Math.imul(this.gainBase, 0x9e3779b1);
  }
  ttHi(): number {
    if (this.rules.variant !== "fight") return this.keyHi;
    return this.keyHi ^ Z_QUIET_HI[this.quiet & 255]! ^ Z_PLY_HI[this.plies & 511]! ^ Math.imul(this.gainBase, 0x85ebca6b);
  }

  /** Whether a pawn of the side to move could take en passant on `ep` (only then is the square kept, as in chess.js). */
  private epCapturable(ep: number): boolean {
    const us = this.side;
    const from = ep + (us === WHITE ? -16 : 16);
    const pawn = pieceOf(us, PAWN);
    return (!((from - 1) & 0x88) && this.board[from - 1] === pawn) || (!((from + 1) & 0x88) && this.board[from + 1] === pawn);
  }

  /** Whether `s` is attacked by any piece of `by`. */
  attacked(s: number, by: number): boolean {
    const b = this.board;
    // Pawns.
    if (by === WHITE) {
      const a = s - 15;
      const c = s - 17;
      if (!(a & 0x88) && b[a] === PAWN) return true;
      if (!(c & 0x88) && b[c] === PAWN) return true;
    } else {
      const a = s + 15;
      const c = s + 17;
      if (!(a & 0x88) && b[a] === 9) return true;
      if (!(c & 0x88) && b[c] === 9) return true;
    }
    const knight = pieceOf(by, KNIGHT);
    for (let i = 0; i < 8; i++) {
      const t = s + KNIGHT_STEPS[i]!;
      if (!(t & 0x88) && b[t] === knight) return true;
    }
    const king = pieceOf(by, KING);
    for (let i = 0; i < 8; i++) {
      const t = s + KING_STEPS[i]!;
      if (!(t & 0x88) && b[t] === king) return true;
    }
    const bishop = pieceOf(by, BISHOP);
    const rook = pieceOf(by, ROOK);
    const queen = pieceOf(by, QUEEN);
    for (let i = 0; i < 4; i++) {
      const d = BISHOP_DIRS[i]!;
      let t = s + d;
      while (!(t & 0x88)) {
        const p = b[t]!;
        if (p) {
          if (p === bishop || p === queen) return true;
          break;
        }
        t += d;
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = ROOK_DIRS[i]!;
      let t = s + d;
      while (!(t & 0x88)) {
        const p = b[t]!;
        if (p) {
          if (p === rook || p === queen) return true;
          break;
        }
        t += d;
      }
    }
    return false;
  }

  /**
   * Pseudo-legal moves of the side to move into `out` from `at`; returns the new end. `capturesOnly`: captures, promotions and
   * cash-ins (the quiescence search's moves).
   */
  generate(out: Int32Array, at: number, capturesOnly = false): number {
    const b = this.board;
    const us = this.side;
    const them = us ^ 1;
    const fight = this.rules.variant === "fight";
    let n = at;
    const up = us === WHITE ? 16 : -16;
    const startRank = us === WHITE ? 1 : 6;
    const lastRank = us === WHITE ? 7 : 0;
    const list = this.list;
    const base = us * 32;
    const count = this.listLen[us]!;
    for (let li = 0; li < count; li++) {
      const from = list[base + li]!;
      const p = b[from]!;
      const t = typeOf(p);
      if (t === PAWN) {
        const one = from + up;
        const promo = rankOf(one) === lastRank;
        // Pushes.
        if (!(one & 0x88) && !b[one]) {
          if (promo) {
            if (fight) out[n++] = mk(from, one, 0, F_CASHIN);
            else {
              out[n++] = mk(from, one, QUEEN, 0);
              if (!capturesOnly) {
                out[n++] = mk(from, one, KNIGHT, 0);
                out[n++] = mk(from, one, ROOK, 0);
                out[n++] = mk(from, one, BISHOP, 0);
              }
            }
          } else if (!capturesOnly) {
            out[n++] = mk(from, one, 0, 0);
            if (rankOf(from) === startRank && !b[one + up]) out[n++] = mk(from, one + up, 0, F_DOUBLE);
          }
        }
        // Captures.
        for (let side = -1; side <= 1; side += 2) {
          const to = one + side;
          if (to & 0x88) continue;
          const q = b[to]!;
          if (q && colorOf(q) === them) {
            if (promo) {
              if (fight) out[n++] = mk(from, to, 0, F_CAPTURE | F_CASHIN);
              else {
                out[n++] = mk(from, to, QUEEN, F_CAPTURE);
                if (!capturesOnly) {
                  out[n++] = mk(from, to, KNIGHT, F_CAPTURE);
                  out[n++] = mk(from, to, ROOK, F_CAPTURE);
                  out[n++] = mk(from, to, BISHOP, F_CAPTURE);
                }
              }
            } else out[n++] = mk(from, to, 0, F_CAPTURE);
          } else if (to === this.ep) out[n++] = mk(from, to, 0, F_CAPTURE | F_EP);
        }
        continue;
      }
      if (t === KNIGHT || t === KING) {
        const steps = t === KNIGHT ? KNIGHT_STEPS : KING_STEPS;
        for (let i = 0; i < 8; i++) {
          const to = from + steps[i]!;
          if (to & 0x88) continue;
          const q = b[to]!;
          if (!q) {
            if (!capturesOnly) out[n++] = mk(from, to, 0, 0);
          } else if (colorOf(q) === them) out[n++] = mk(from, to, 0, F_CAPTURE);
        }
        if (t === KING && !capturesOnly && this.castling) n = this.castles(out, n);
        continue;
      }
      // Sliders.
      const d0 = t === BISHOP ? 0 : t === ROOK ? 4 : 0;
      const d1 = t === BISHOP ? 4 : t === ROOK ? 8 : 8;
      for (let i = d0; i < d1; i++) {
        const d = i < 4 ? BISHOP_DIRS[i]! : ROOK_DIRS[i - 4]!;
        let to = from + d;
        while (!(to & 0x88)) {
          const q = b[to]!;
          if (!q) {
            if (!capturesOnly) out[n++] = mk(from, to, 0, 0);
          } else {
            if (colorOf(q) === them) out[n++] = mk(from, to, 0, F_CAPTURE);
            break;
          }
          to += d;
        }
      }
    }
    return n;
  }

  private castles(out: Int32Array, n: number): number {
    const b = this.board;
    const us = this.side;
    if (this.inCheck) return n;
    const r = us === WHITE ? 0 : 7;
    const k = sq(4, r);
    if (b[k] !== pieceOf(us, KING)) return n;
    const them = us ^ 1;
    const kingSide = us === WHITE ? 1 : 4;
    const queenSide = us === WHITE ? 2 : 8;
    if (this.castling & kingSide && !b[k + 1] && !b[k + 2] && b[k + 3] === pieceOf(us, ROOK) && !this.attacked(k + 1, them) && !this.attacked(k + 2, them))
      out[n++] = mk(k, k + 2, 0, F_CASTLE);
    if (this.castling & queenSide && !b[k - 1] && !b[k - 2] && !b[k - 3] && b[k - 4] === pieceOf(us, ROOK) && !this.attacked(k - 1, them) && !this.attacked(k - 2, them))
      out[n++] = mk(k, k - 2, 0, F_CASTLE);
    return n;
  }

  private move(p: number, from: number, to: number) {
    const i = p * 128;
    this.board[from] = 0;
    this.board[to] = p;
    const idx = this.listIdx[from]!;
    this.list[(p >> 3) * 32 + idx] = to;
    this.listIdx[to] = idx;
    this.mg += PST_MG[i + to]! - PST_MG[i + from]!;
    this.eg += PST_EG[i + to]! - PST_EG[i + from]!;
    this.keyLo ^= Z_PIECE_LO[i + from]! ^ Z_PIECE_LO[i + to]!;
    this.keyHi ^= Z_PIECE_HI[i + from]! ^ Z_PIECE_HI[i + to]!;
  }

  private remove(s: number) {
    const p = this.board[s]!;
    const i = p * 128 + s;
    this.board[s] = 0;
    this.listRemove(p >> 3, s);
    this.counts[p]!--;
    this.pieces[colorOf(p)]!--;
    this.phase -= PHASE_INC[typeOf(p)]!;
    this.mg -= PST_MG[i]!;
    this.eg -= PST_EG[i]!;
    this.keyLo ^= Z_PIECE_LO[i]!;
    this.keyHi ^= Z_PIECE_HI[i]!;
  }

  private add(p: number, s: number) {
    const i = p * 128 + s;
    this.board[s] = p;
    this.listAdd(p >> 3, s);
    this.counts[p]!++;
    this.pieces[colorOf(p)]!++;
    this.phase += PHASE_INC[typeOf(p)]!;
    this.mg += PST_MG[i]!;
    this.eg += PST_EG[i]!;
    this.keyLo ^= Z_PIECE_LO[i]!;
    this.keyHi ^= Z_PIECE_HI[i]!;
  }

  /**
   * Plays a pseudo-legal move. Returns false (and leaves the position as it was) if it would leave the mover's king attacked.
   * Afterwards `inCheck` says whether the move gave check, and the fight's counters have moved on.
   */
  make(m: number): boolean {
    const b = this.board;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const p = b[from]!;
    const us = this.side;
    const sp = this.sp;
    this.uMove[sp] = m;
    this.uCastling[sp] = this.castling;
    this.uEp[sp] = this.ep;
    this.uHalf[sp] = this.halfmove;
    this.uQuiet[sp] = this.quiet;
    this.uInCheck[sp] = this.inCheck ? 1 : 0;
    this.uMg[sp] = this.mg;
    this.uEg[sp] = this.eg;
    let captured = 0;
    if (flags & F_EP) {
      const cs = to + (us === WHITE ? -16 : 16);
      captured = b[cs]!;
      this.remove(cs);
    } else if (flags & F_CAPTURE) {
      captured = b[to]!;
      this.remove(to);
    }
    this.uCaptured[sp] = captured;
    if (flags & F_CASHIN) {
      // The pawn leaves the board.
      this.remove(from);
      this.cashed[us]!++;
    } else {
      this.move(p, from, to);
      const promo = movePromo(m);
      if (promo) {
        this.remove(to);
        this.add(pieceOf(us, promo), to);
      }
      if (typeOf(p) === KING) {
        this.kings[us] = to;
        if (flags & F_CASTLE) {
          if (to > from) this.move(pieceOf(us, ROOK), to + 1, to - 1);
          else this.move(pieceOf(us, ROOK), to - 2, to + 1);
        }
      }
    }
    this.sp = sp + 1;
    // Illegal: the mover's king is attacked.
    if (this.attacked(this.kings[us]!, us ^ 1)) {
      this.side = us; // (unchanged so far)
      this.undoBoard();
      return false;
    }
    // Castling rights, en passant, clocks, side.
    this.keyLo ^= Z_CASTLE_LO[this.castling]!;
    this.keyHi ^= Z_CASTLE_HI[this.castling]!;
    this.castling &= CASTLE_MASK[from]! & CASTLE_MASK[to]!;
    this.keyLo ^= Z_CASTLE_LO[this.castling]!;
    this.keyHi ^= Z_CASTLE_HI[this.castling]!;
    if (this.ep >= 0) {
      this.keyLo ^= Z_EP_LO[fileOf(this.ep)]!;
      this.keyHi ^= Z_EP_HI[fileOf(this.ep)]!;
    }
    this.side = us ^ 1;
    this.keyLo ^= Z_SIDE_LO;
    this.keyHi ^= Z_SIDE_HI;
    this.ep = -1;
    if (flags & F_DOUBLE) {
      const e = (from + to) >> 1;
      if (this.epCapturable(e)) {
        this.ep = e;
        this.keyLo ^= Z_EP_LO[fileOf(e)]!;
        this.keyHi ^= Z_EP_HI[fileOf(e)]!;
      }
    }
    this.halfmove = typeOf(p) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    const check = this.attacked(this.kings[us ^ 1]!, us);
    this.inCheck = check;
    // (Only a capture or a cash-in restarts the quiet count: a cash-in takes a piece off the board for good, like a capture. A check
    // doesn't: Eric, Oct 21.)
    this.quiet = captured || flags & F_CASHIN ? 0 : this.quiet + 1;
    this.plies++;
    this.histLo[this.sp] = this.keyLo;
    this.histHi[this.sp] = this.keyHi;
    return true;
  }

  /** Puts the pieces back for the move on top of the stack (the board part only) and pops it. */
  private undoBoard() {
    const sp = --this.sp;
    const m = this.uMove[sp]!;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const us = this.side;
    if (flags & F_CASHIN) {
      this.add(pieceOf(us, PAWN), from);
      this.cashed[us]!--;
    } else {
      const promo = movePromo(m);
      if (promo) {
        this.remove(to);
        this.add(pieceOf(us, PAWN), to);
      }
      const p = this.board[to]!;
      this.move(p, to, from);
      if (typeOf(p) === KING) {
        this.kings[us] = from;
        if (flags & F_CASTLE) {
          if (to > from) this.move(pieceOf(us, ROOK), to - 1, to + 1);
          else this.move(pieceOf(us, ROOK), to + 1, to - 2);
        }
      }
    }
    const captured = this.uCaptured[sp]!;
    if (captured) {
      const cs = flags & F_EP ? to + (us === WHITE ? -16 : 16) : to;
      this.add(captured, cs);
    }
    this.mg = this.uMg[sp]!;
    this.eg = this.uEg[sp]!;
  }

  /** Takes back the last move made. */
  unmake(): void {
    if (this.sp <= this.base) throw new Error("nothing to unmake");
    // Undo the side, the key's side/castling/ep parts, then the board.
    const sp = this.sp - 1;
    if (this.ep >= 0) {
      this.keyLo ^= Z_EP_LO[fileOf(this.ep)]!;
      this.keyHi ^= Z_EP_HI[fileOf(this.ep)]!;
    }
    this.keyLo ^= Z_CASTLE_LO[this.castling]!;
    this.keyHi ^= Z_CASTLE_HI[this.castling]!;
    this.castling = this.uCastling[sp]!;
    this.keyLo ^= Z_CASTLE_LO[this.castling]!;
    this.keyHi ^= Z_CASTLE_HI[this.castling]!;
    this.ep = this.uEp[sp]!;
    if (this.ep >= 0) {
      this.keyLo ^= Z_EP_LO[fileOf(this.ep)]!;
      this.keyHi ^= Z_EP_HI[fileOf(this.ep)]!;
    }
    this.side ^= 1;
    this.keyLo ^= Z_SIDE_LO;
    this.keyHi ^= Z_SIDE_HI;
    if (this.side === BLACK) this.fullmove--;
    this.halfmove = this.uHalf[sp]!;
    this.quiet = this.uQuiet[sp]!;
    this.inCheck = this.uInCheck[sp] === 1;
    this.plies--;
    this.undoBoard();
  }

  /** A null move (the side to move passes), for the search's null-move pruning. Never when in check. */
  makeNull(): void {
    const sp = this.sp;
    this.uMove[sp] = 0;
    this.uEp[sp] = this.ep;
    this.uHalf[sp] = this.halfmove;
    this.uQuiet[sp] = this.quiet;
    this.uInCheck[sp] = 0;
    if (this.ep >= 0) {
      this.keyLo ^= Z_EP_LO[fileOf(this.ep)]!;
      this.keyHi ^= Z_EP_HI[fileOf(this.ep)]!;
      this.ep = -1;
    }
    this.side ^= 1;
    this.keyLo ^= Z_SIDE_LO;
    this.keyHi ^= Z_SIDE_HI;
    // (Reset, so a repetition is never counted across a pass.)
    this.halfmove = 0;
    this.quiet++;
    this.plies++;
    this.sp = sp + 1;
    this.histLo[this.sp] = this.keyLo;
    this.histHi[this.sp] = this.keyHi;
  }

  unmakeNull(): void {
    const sp = --this.sp;
    this.side ^= 1;
    this.keyLo ^= Z_SIDE_LO;
    this.keyHi ^= Z_SIDE_HI;
    this.ep = this.uEp[sp]!;
    if (this.ep >= 0) {
      this.keyLo ^= Z_EP_LO[fileOf(this.ep)]!;
      this.keyHi ^= Z_EP_HI[fileOf(this.ep)]!;
    }
    this.halfmove = this.uHalf[sp]!;
    this.quiet = this.uQuiet[sp]!;
    this.inCheck = false;
    this.plies--;
  }

  /**
   * Static exchange evaluation of a capture (or any move) onto its square: what the mover wins (centipawns, pawn 100) if both sides
   * keep taking back there with their least valuable piece, each free to stop. X-rays (a rook behind a rook) count.
   */
  see(m: number): number {
    const b = this.board;
    const from = moveFrom(m);
    const to = moveTo(m);
    const flags = moveFlags(m);
    const gains = SEE_GAINS;
    const cleared = SEE_CLEARED;
    let nCleared = 0;
    gains[0] = flags & F_EP ? SEE_VAL[PAWN]! : b[to] ? SEE_VAL[typeOf(b[to]!)]! : 0;
    // (A cash-in's pawn leaves: it can't be taken back.)
    if (flags & F_CASHIN) return gains[0]! - SEE_VAL[PAWN]!;
    let onSquare = SEE_VAL[movePromo(m) || typeOf(b[from]!)]!;
    if (movePromo(m)) gains[0] = gains[0]! + onSquare - SEE_VAL[PAWN]!;
    cleared[nCleared++] = from;
    cleared[nCleared++] = b[from]!;
    b[from] = 0;
    let side = colorOf(cleared[1]!) ^ 1;
    let d = 0;
    for (;;) {
      const at = this.leastAttacker(to, side);
      if (at < 0) break;
      d++;
      gains[d] = onSquare - gains[d - 1]!;
      onSquare = SEE_VAL[typeOf(b[at]!)]!;
      cleared[nCleared++] = at;
      cleared[nCleared++] = b[at]!;
      b[at] = 0;
      side ^= 1;
      if (Math.max(-gains[d - 1]!, gains[d]!) < 0) break;
    }
    while (d > 0) {
      gains[d - 1] = -Math.max(-gains[d - 1]!, gains[d]!);
      d--;
    }
    for (let i = 0; i < nCleared; i += 2) b[cleared[i]!] = cleared[i + 1]!;
    return gains[0]!;
  }

  /** The square of `side`'s least valuable piece attacking `s` on the board as it stands, or -1. */
  private leastAttacker(s: number, side: number): number {
    const b = this.board;
    const pawn = pieceOf(side, PAWN);
    const p1 = side === WHITE ? s - 15 : s + 15;
    const p2 = side === WHITE ? s - 17 : s + 17;
    if (!(p1 & 0x88) && b[p1] === pawn) return p1;
    if (!(p2 & 0x88) && b[p2] === pawn) return p2;
    const knight = pieceOf(side, KNIGHT);
    for (let i = 0; i < 8; i++) {
      const t = s + KNIGHT_STEPS[i]!;
      if (!(t & 0x88) && b[t] === knight) return t;
    }
    let best = -1;
    let bestVal = 1e9;
    for (let i = 0; i < 8; i++) {
      const d = i < 4 ? BISHOP_DIRS[i]! : ROOK_DIRS[i - 4]!;
      let t = s + d;
      while (!(t & 0x88)) {
        const p = b[t]!;
        if (p) {
          if (colorOf(p) === side) {
            const ty = typeOf(p);
            if ((ty === QUEEN || ty === (i < 4 ? BISHOP : ROOK)) && SEE_VAL[ty]! < bestVal) {
              best = t;
              bestVal = SEE_VAL[ty]!;
            }
          }
          break;
        }
        t += d;
      }
    }
    if (best >= 0) return best;
    const king = pieceOf(side, KING);
    for (let i = 0; i < 8; i++) {
      const t = s + KING_STEPS[i]!;
      if (!(t & 0x88) && b[t] === king) return t;
    }
    return -1;
  }

  /** Plays moves for good: they can't be unmade (a game's history replayed before a search). Keeps the repetition history. */
  commit(): void {
    this.base = this.sp;
  }

  /**
   * How many times the current position stood before (same placement, side, castling and en passant), looking back over the
   * reversible moves only. `limit`: stop counting at this many.
   */
  repetitions(limit = 2): number {
    let n = 0;
    const lo = this.keyLo;
    const hi = this.keyHi;
    const stop = Math.max(0, this.sp - this.halfmove);
    for (let i = this.sp - 2; i >= stop; i -= 2) {
      if (this.histLo[i] === lo && this.histHi[i] === hi) {
        n++;
        if (n >= limit) break;
      }
    }
    return n;
  }

  /** Repetition inside the part being searched: the position stood before after the committed history (the search's two-fold). */
  repeatedInSearch(): boolean {
    const lo = this.keyLo;
    const hi = this.keyHi;
    const stop = Math.max(this.base, this.sp - this.halfmove);
    for (let i = this.sp - 2; i >= stop; i -= 2) if (this.histLo[i] === lo && this.histHi[i] === hi) return true;
    return false;
  }

  /** Too little material to mate, exactly as chess.js counts it (k v k, k v k + one minor, bishops all on one color). */
  insufficient(): boolean {
    const c = this.counts;
    const total = this.pieces[0]! + this.pieces[1]!;
    if (total === 0) return true;
    const bishops = c[pieceOf(WHITE, BISHOP)]! + c[pieceOf(BLACK, BISHOP)]!;
    const knights = c[pieceOf(WHITE, KNIGHT)]! + c[pieceOf(BLACK, KNIGHT)]!;
    if (total === 1 && (bishops === 1 || knights === 1)) return true;
    if (total === bishops) {
      let light = 0;
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) continue;
        if (typeOf(this.board[s]!) === BISHOP && (fileOf(s) + rankOf(s)) % 2 === 1) light++;
      }
      return light === 0 || light === bishops;
    }
    return false;
  }

  /** Whether a side has only its king and pawns left (no knight, bishop, rook or queen). */
  kingAndPawns(side: number): boolean {
    const c = this.counts;
    return !(c[pieceOf(side, KNIGHT)]! + c[pieceOf(side, BISHOP)]! + c[pieceOf(side, ROOK)]! + c[pieceOf(side, QUEEN)]!);
  }

  /** All legal moves of the side to move. */
  legalMoves(): number[] {
    const buf = new Int32Array(256);
    const n = this.generate(buf, 0);
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const m = buf[i]!;
      if (this.make(m)) {
        out.push(m);
        this.unmake();
      }
    }
    return out;
  }

  /** Whether the side to move has any legal move. */
  hasLegalMove(): boolean {
    const buf = new Int32Array(256);
    const n = this.generate(buf, 0);
    for (let i = 0; i < n; i++) {
      if (this.make(buf[i]!)) {
        this.unmake();
        return true;
      }
    }
    return false;
  }

  /**
   * The game's result if it is over now, by the rules in their order (the fight's first: a side with only its king loses, then
   * mate and stalemate, then the repetition, the fifty-move rule, too little material, then the caps); null if it goes on. A
   * fight's stall (a repetition or a cap) comes back marked `stall`, its winner -1: the engine's score decides it (index.ts).
   */
  result(): HunResult | null {
    const fight = this.rules.variant === "fight";
    if (fight && (this.pieces[0] === 0 || this.pieces[1] === 0)) {
      return { end: "king_alone", winner: this.pieces[0] ? WHITE : this.pieces[1] ? BLACK : -1 };
    }
    if (!this.hasLegalMove()) return this.inCheck ? { end: "checkmate", winner: this.side ^ 1 } : { end: "stalemate", winner: -1 };
    if (this.repetitions(2) >= 2) return fight ? { end: "repetition", winner: -1, stall: true } : { end: "repetition", winner: -1 };
    if (this.halfmove >= 100) return { end: "fifty_moves", winner: -1 };
    if (this.insufficient()) return { end: "insufficient_material", winner: -1 };
    if (fight) {
      const cap = this.plies >= 2 * this.rules.moveCap;
      if (cap || this.quiet >= 2 * this.rules.quietCap) return { end: cap ? "cap" : "quiet", winner: -1, stall: true };
    }
    return null;
  }

  /** The legal move written `uci`, or 0. A cash-in is the plain from-to; in chess a promotion without its letter is a queen. */
  parseMove(uci: string): number {
    const from = parseSquare(uci.slice(0, 2));
    const to = parseSquare(uci.slice(2, 4));
    const promo = uci.length > 4 ? " pnbrqk".indexOf(uci[4]!) : 0;
    let fallback = 0;
    for (const m of this.legalMoves()) {
      if (moveFrom(m) !== from || moveTo(m) !== to) continue;
      if (movePromo(m) === promo) return m;
      if (movePromo(m) === QUEEN && promo === 0) fallback = m;
    }
    return fallback;
  }

  /** Plays a move given in UCI; throws if it isn't legal. */
  play(uci: string): number {
    const m = this.parseMove(uci);
    if (!m || !this.make(m)) throw new Error(`illegal move ${uci} in ${this.fen()}`);
    return m;
  }
}

/** Counts leaf nodes to `depth` (move generator checks). */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const buf = new Int32Array(256);
  const n = pos.generate(buf, 0);
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (!pos.make(buf[i]!)) continue;
    total += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmake();
  }
  return total;
}
