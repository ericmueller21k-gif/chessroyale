/**
 * The HunChess engine's search: iterative deepening, principal variation search with aspiration windows, a quiescence search
 * on captures and cash-ins (all moves when in check), a transposition table keyed by the position and the fight's counters,
 * move ordering (the table's move, captures by most valuable victim and least valuable attacker, two killers, history), a
 * check extension, null-move pruning (off when the side to move has few pieces: zugzwang), late-move reductions, futility and
 * late-move pruning near the leaves. It stops at a fixed number of nodes, so a search is deterministic: the same position and
 * history give the same move.
 */

import type { Position } from "./board.ts";
import * as ev from "./eval.ts";
import type { EvalOptions } from "./eval.ts";

// (Local constants and bindings: an imported binding can be read through a getter in some module loaders, too slow here.)
const evaluate = ev.evaluate;
const DEFAULT_EVAL = ev.DEFAULT_EVAL;
const WHITE = 0;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const F_CAPTURE = 1;
const F_CASHIN = 16;
const moveFrom = (m: number) => m & 127;
const moveTo = (m: number) => (m >> 7) & 127;
const movePromo = (m: number) => (m >> 14) & 7;
const moveFlags = (m: number) => m >> 17;
const typeOf = (p: number) => p & 7;
const pieceOf = (color: number, type: number) => (color << 3) | type;

/** A win (mate, or a win by the fight's rules) in `ply` plies scores WIN - ply. */
export const WIN = 30000;
const WIN_BOUND = WIN - 1000;
const INF = 32000;
const MAX_PLY = 128;

const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

/** Piece values for ordering and pruning, by type. */
const VAL = [0, 100, 320, 330, 500, 950, 20000];

/** Late-move reductions by depth and move number. */
const LMR = Array.from({ length: 64 }, (_, d) => Array.from({ length: 64 }, (_, n) => (d && n ? Math.floor(0.6 + (Math.log(d) * Math.log(n)) / 2.1) : 0)));
const FUTILITY = [0, 110, 210, 320];
const LMP = [0, 5, 8, 13, 20];

export interface SearchOptions {
  /** Stop after about this many nodes (positions looked at). */
  nodes: number;
  /** At most this deep (plies); default: as deep as the nodes allow. */
  depth?: number;
}

export interface SearchResult {
  /** The best move (encoded), or 0 when there is none. */
  move: number;
  /** Its score in centipawns for the side to move (a win: near WIN). */
  score: number;
  depth: number;
  nodes: number;
  /** The best line, encoded moves. */
  pv: number[];
}

export class Searcher {
  readonly evalOpts: EvalOptions;
  private ttMask: number;
  private ttCheck: Int32Array;
  private ttMove: Int32Array;
  private ttData: Int32Array;
  private killers = new Int32Array(MAX_PLY * 2);
  private history = new Int32Array(16 * 128);
  private moves = new Int32Array(MAX_PLY * 256);
  private scores = new Int32Array(MAX_PLY * 256);
  private pvTable = new Int32Array(MAX_PLY * MAX_PLY);
  private pvLength = new Int32Array(MAX_PLY);
  private nodes = 0;
  private limit = 0;
  private stopped = false;
  private rootDepth = 0;
  private pos!: Position;

  /** `ttBits`: the table holds 2^ttBits entries (16 bytes... three 32-bit numbers each). */
  constructor(evalOpts: EvalOptions = DEFAULT_EVAL, ttBits = 18) {
    this.evalOpts = evalOpts;
    const size = 1 << ttBits;
    this.ttMask = size - 1;
    this.ttCheck = new Int32Array(size);
    this.ttMove = new Int32Array(size);
    this.ttData = new Int32Array(size);
  }

  /** Forgets everything learned (a new game). */
  clear(): void {
    this.ttCheck.fill(0);
    this.ttMove.fill(0);
    this.ttData.fill(0);
    this.killers.fill(0);
    this.history.fill(0);
  }

  search(pos: Position, opts: SearchOptions): SearchResult {
    this.pos = pos;
    this.nodes = 0;
    this.limit = opts.nodes;
    this.stopped = false;
    this.killers.fill(0);
    // (History from earlier searches, halved: still a hint, never a habit.)
    for (let i = 0; i < this.history.length; i++) this.history[i] = this.history[i]! >> 1;
    const maxDepth = Math.min(opts.depth ?? 64, MAX_PLY - 8);
    const legal = pos.legalMoves();
    let best: SearchResult = { move: legal[0] ?? 0, score: 0, depth: 0, nodes: 0, pv: legal[0] ? [legal[0]] : [] };
    if (legal.length <= 1) return { ...best, score: legal.length ? evaluate(pos, this.evalOpts) : 0 };
    let score = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      this.rootDepth = depth;
      this.iterMove = 0;
      let delta = 30;
      let alpha = -INF;
      let beta = INF;
      if (depth >= 4 && Math.abs(score) < WIN_BOUND) {
        alpha = score - delta;
        beta = score + delta;
      }
      for (;;) {
        const s = this.negamax(depth, alpha, beta, 0, true, false);
        if (this.stopped) break;
        if (s <= alpha) {
          alpha = Math.max(-INF, s - delta);
          delta *= 2;
        } else if (s >= beta) {
          beta = Math.min(INF, s + delta);
          delta *= 2;
        } else {
          score = s;
          break;
        }
        if (delta > 1000) {
          alpha = -INF;
          beta = INF;
        }
      }
      // A stopped iteration still counts when a root move was searched in full and raised alpha (it beat the last best).
      if (this.stopped) {
        if (this.iterMove) best = { move: this.iterMove, score: this.iterScore, depth: depth - 1, nodes: this.nodes, pv: [this.iterMove] };
        break;
      }
      const move = this.pvLength[0]! > 0 ? this.pvTable[0]! : best.move;
      best = { move, score, depth, nodes: this.nodes, pv: this.pv() };
      if (Math.abs(score) >= WIN_BOUND && depth > 2 && WIN - Math.abs(score) < depth) break;
      if (this.nodes >= this.limit) break;
    }
    best.nodes = this.nodes;
    return best;
  }

  /** The current iteration's best root move so far (searched in full), and its score. */
  private iterMove = 0;
  private iterScore = 0;

  private pv(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.pvLength[0]!; i++) out.push(this.pvTable[i]!);
    return out;
  }

  /** The fight's rules at a node: a score if the game is over here by them, else null. Mate and stalemate are found by the move loop. */
  private ruleScore(ply: number): number | null {
    const pos = this.pos;
    const us = pos.side;
    if (pos.rules.variant === "fight") {
      const mine = pos.pieces[us]!;
      const theirs = pos.pieces[us ^ 1]!;
      if (!mine || !theirs) return !mine && !theirs ? 0 : mine ? WIN - ply : -(WIN - ply);
      // (The side that just moved has given its 5th check: as mate, since a mated side would have lost too.)
      if (pos.checks[us ^ 1]! >= pos.rules.checksToWin) return -(WIN - ply);
      if (pos.repetitions(2) >= 2) return 0;
    } else if (pos.repeatedInSearch() || pos.repetitions(2) >= 2) return 0;
    if (pos.halfmove >= 100 || pos.insufficient()) return pos.inCheck && !pos.hasLegalMove() ? -(WIN - ply) : 0;
    if (pos.rules.variant === "fight") {
      if (pos.plies >= 2 * pos.rules.moveCap || pos.quiet >= 2 * pos.rules.quietCap) {
        // (Mate and stalemate come first.)
        if (!pos.hasLegalMove()) return pos.inCheck ? -(WIN - ply) : 0;
        const [w, b] = pos.capMaterial();
        const mineMat = us === WHITE ? w : b;
        const theirMat = us === WHITE ? b : w;
        return mineMat > theirMat ? WIN - ply : mineMat < theirMat ? -(WIN - ply) : 0;
      }
    }
    return null;
  }

  private nonPawnPieces(side: number): number {
    const c = this.pos.counts;
    return c[pieceOf(side, KNIGHT)]! + c[pieceOf(side, BISHOP)]! + c[pieceOf(side, ROOK)]! + c[pieceOf(side, QUEEN)]!;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number, pvNode: boolean, wasNull: boolean): number {
    const pos = this.pos;
    this.pvLength[ply] = 0;
    if (ply > 0) {
      const r = this.ruleScore(ply);
      if (r !== null) return r;
      // (Mate distance: nothing here beats a mate already found nearer the root.)
      alpha = Math.max(alpha, -(WIN - ply));
      beta = Math.min(beta, WIN - ply - 1);
      if (alpha >= beta) return alpha;
    }
    const inCheck = pos.inCheck;
    if (depth <= 0 && !inCheck) return this.quiesce(alpha, beta, ply);
    if (depth < 0) depth = 0;
    if (ply >= MAX_PLY - 2) return evaluate(pos, this.evalOpts);
    this.nodes++;
    if (this.nodes >= this.limit && this.rootDepth > 1) {
      this.stopped = true;
      return 0;
    }

    // The table.
    const lo = pos.ttLo();
    const hi = pos.ttHi();
    const slot = lo & this.ttMask;
    let ttMove = 0;
    if (this.ttCheck[slot] === hi) {
      ttMove = this.ttMove[slot]!;
      const data = this.ttData[slot]!;
      const ttDepth = (data >> 16) & 255;
      const flag = data >>> 24;
      let ttScore = (data & 0xffff) - 32768;
      if (ttScore >= WIN_BOUND) ttScore -= ply;
      else if (ttScore <= -WIN_BOUND) ttScore += ply;
      if (!pvNode && ttDepth >= depth && ply > 0) {
        if (flag === EXACT || (flag === LOWER && ttScore >= beta) || (flag === UPPER && ttScore <= alpha)) return ttScore;
      }
    }

    const staticEval = inCheck ? -INF : evaluate(pos, this.evalOpts);

    if (!pvNode && !inCheck && ply > 0) {
      // Reverse futility: far above beta near the leaves.
      if (depth <= 6 && staticEval - 85 * depth >= beta && Math.abs(beta) < WIN_BOUND) return staticEval;
      // Null move: pass, and if a reduced search still holds beta, so would a real move (not with few pieces: zugzwang).
      if (!wasNull && depth >= 3 && staticEval >= beta && this.nonPawnPieces(pos.side) >= 2 && Math.abs(beta) < WIN_BOUND) {
        const R = 3 + Math.floor(depth / 6);
        pos.makeNull();
        const s = -this.negamax(depth - 1 - R, -beta, -beta + 1, ply + 1, false, true);
        pos.unmakeNull();
        if (this.stopped) return 0;
        if (s >= beta) return s >= WIN_BOUND ? beta : s;
      }
    }

    // Internal deepening: no table move on a principal line, find one first.
    if (pvNode && !ttMove && depth >= 5) {
      this.negamax(depth - 2, alpha, beta, ply, true, false);
      if (this.stopped) return 0;
      if (this.ttCheck[slot] === hi) ttMove = this.ttMove[slot]!;
      this.pvLength[ply] = 0;
    }

    const base = ply * 256;
    const end = pos.generate(this.moves, base);
    this.order(base, end, ttMove, ply);

    let legal = 0;
    let bestScore = -INF;
    let bestMove = 0;
    const startAlpha = alpha;
    const k1 = this.killers[ply * 2]!;
    const k2 = this.killers[ply * 2 + 1]!;
    for (let i = base; i < end; i++) {
      const m = this.pick(i, end);
      const flags = moveFlags(m);
      const tactical = (flags & (F_CAPTURE | F_CASHIN)) !== 0 || movePromo(m) !== 0;
      if (!pos.make(m)) continue;
      legal++;
      const givesCheck = pos.inCheck;
      // Pruning of quiet moves near the leaves.
      if (!pvNode && !inCheck && !tactical && !givesCheck && legal > 1 && bestScore > -WIN_BOUND) {
        if (depth <= 4 && legal > LMP[depth]!) {
          pos.unmake();
          continue;
        }
        if (depth <= 3 && staticEval + FUTILITY[depth]! <= alpha) {
          pos.unmake();
          continue;
        }
      }
      const ext = givesCheck && ply < 2 * this.rootDepth ? 1 : 0;
      const newDepth = depth - 1 + ext;
      let s: number;
      if (legal === 1) s = -this.negamax(newDepth, -beta, -alpha, ply + 1, pvNode, false);
      else {
        let r = 0;
        if (depth >= 3 && !tactical && !inCheck && !givesCheck && legal > (pvNode ? 3 : 2) && m !== k1 && m !== k2) {
          r = LMR[Math.min(63, depth)]![Math.min(63, legal)]!;
          if (pvNode) r--;
          const h = this.history[pos.board[moveTo(m)]! * 128 + moveTo(m)]!;
          if (h > 4000) r--;
          if (r < 0) r = 0;
          if (r > newDepth - 1) r = Math.max(0, newDepth - 1);
        }
        s = -this.negamax(newDepth - r, -alpha - 1, -alpha, ply + 1, false, false);
        if (s > alpha && r > 0) s = -this.negamax(newDepth, -alpha - 1, -alpha, ply + 1, false, false);
        if (s > alpha && s < beta && pvNode) s = -this.negamax(newDepth, -beta, -alpha, ply + 1, true, false);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (s > bestScore) {
        bestScore = s;
        if (s > alpha) {
          alpha = s;
          bestMove = m;
          // The line.
          this.pvTable[ply * MAX_PLY] = m;
          const childLen = this.pvLength[ply + 1]!;
          for (let j = 0; j < childLen; j++) this.pvTable[ply * MAX_PLY + 1 + j] = this.pvTable[(ply + 1) * MAX_PLY + j]!;
          this.pvLength[ply] = childLen + 1;
          if (ply === 0) {
            this.iterMove = m;
            this.iterScore = s;
          }
          if (alpha >= beta) {
            if (!tactical) {
              if (k1 !== m) {
                this.killers[ply * 2 + 1] = k1;
                this.killers[ply * 2] = m;
              }
              const hIdx = pos.board[moveFrom(m)]! * 128 + moveTo(m);
              this.history[hIdx] = Math.min(1 << 20, this.history[hIdx]! + depth * depth);
            }
            break;
          }
        }
      }
    }
    if (!legal) return inCheck ? -(WIN - ply) : 0;

    // Store.
    const flag = bestScore >= beta ? LOWER : bestScore > startAlpha ? EXACT : UPPER;
    let stored = bestScore;
    if (stored >= WIN_BOUND) stored += ply;
    else if (stored <= -WIN_BOUND) stored -= ply;
    this.ttCheck[slot] = hi;
    this.ttMove[slot] = bestMove || ttMove;
    this.ttData[slot] = (Math.max(-32767, Math.min(32767, stored)) + 32768) | (Math.min(255, depth) << 16) | (flag << 24);
    return bestScore;
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    this.pvLength[ply] = 0;
    this.nodes++;
    if (this.nodes >= this.limit && this.rootDepth > 1) {
      this.stopped = true;
      return 0;
    }
    if (ply >= MAX_PLY - 2) return evaluate(pos, this.evalOpts);
    const inCheck = pos.inCheck;
    let best = -INF;
    if (!inCheck) {
      best = evaluate(pos, this.evalOpts);
      if (best >= beta) return best;
      if (best > alpha) alpha = best;
    }
    const base = ply * 256;
    const end = pos.generate(this.moves, base, !inCheck);
    this.order(base, end, 0, ply);
    let legal = 0;
    const them = pos.side ^ 1;
    for (let i = base; i < end; i++) {
      const m = this.pick(i, end);
      const flags = moveFlags(m);
      if (!inCheck) {
        const to = moveTo(m);
        const victim = flags & F_CAPTURE ? VAL[typeOf(pos.board[to]!) || 1]! : 0;
        const promo = movePromo(m);
        const gain = victim + (promo ? VAL[promo]! - 100 : 0) - (flags & F_CASHIN ? 100 : 0);
        // Delta: even winning this cleanly can't reach alpha.
        if (!promo && best + gain + 180 < alpha) continue;
        // A capture by a bigger piece onto a guarded square is likely a loss (a cheap stand-in for exchange evaluation).
        const attacker = VAL[typeOf(pos.board[moveFrom(m)]!)]!;
        if (!promo && !(flags & F_CASHIN) && attacker > victim + 50 && pos.attacked(to, them)) continue;
      }
      if (!pos.make(m)) continue;
      legal++;
      const r = this.ruleScore(ply + 1);
      const s = r !== null ? -r : -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (s > best) {
        best = s;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) break;
        }
      }
    }
    if (inCheck && !legal) return -(WIN - ply);
    return best;
  }

  /** Scores the moves in [base, end) for ordering. */
  private order(base: number, end: number, ttMove: number, ply: number): void {
    const b = this.pos.board;
    const k1 = this.killers[ply * 2]!;
    const k2 = this.killers[ply * 2 + 1]!;
    for (let i = base; i < end; i++) {
      const m = this.moves[i]!;
      let s: number;
      if (m === ttMove) s = 1 << 29;
      else {
        const flags = moveFlags(m);
        const promo = movePromo(m);
        if (flags & F_CAPTURE) {
          const victim = b[moveTo(m)] ? typeOf(b[moveTo(m)]!) : 1;
          s = (1 << 26) + victim * 64 - typeOf(b[moveFrom(m)]!) + (promo === QUEEN ? 1 << 25 : 0);
        } else if (promo) s = promo === QUEEN ? (1 << 26) + 600 : -(1 << 20);
        else if (flags & F_CASHIN) s = 1 << 22;
        else if (m === k1) s = (1 << 24) + 2;
        else if (m === k2) s = (1 << 24) + 1;
        else s = this.history[b[moveFrom(m)]! * 128 + moveTo(m)]!;
      }
      this.scores[i] = s;
    }
  }

  /** Brings the best-scored move of [i, end) to i and returns it. */
  private pick(i: number, end: number): number {
    let bi = i;
    let bs = this.scores[i]!;
    for (let j = i + 1; j < end; j++) {
      if (this.scores[j]! > bs) {
        bs = this.scores[j]!;
        bi = j;
      }
    }
    if (bi !== i) {
      const m = this.moves[bi]!;
      this.moves[bi] = this.moves[i]!;
      this.moves[i] = m;
      this.scores[bi] = this.scores[i]!;
      this.scores[i] = bs;
    }
    return this.moves[i]!;
  }
}
