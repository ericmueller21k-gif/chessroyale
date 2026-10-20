/**
 * The HunChess engine's evaluation (centipawns, from the side to move's point of view): material and piece-square values (kept
 * by the board as moves are made), blended from middlegame to endgame by the pieces left; the bishop pair; pawn structure
 * (doubled, isolated, passed: in a fight a passed pawn is worth little, since it never queens: it only cashes in); mobility;
 * rooks on open files; king safety (the pawn shelter and pieces bearing on the king's squares); and the fight's own rules: a
 * side down to its last piece is one capture from losing, checks in a row count toward a win, and a cashed-in pawn is a
 * little gold.
 */

import type { Position } from "./board.ts";
import { PHASE_MAX as PHASE_MAX_ } from "./pst.ts";

// (Local constants: an imported binding can be read through a getter in some module loaders, too slow here.)
const PHASE_MAX = PHASE_MAX_;
const WHITE = 0;
const BLACK = 1;
const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;
const colorOf = (p: number) => p >> 3;
const typeOf = (p: number) => p & 7;
const pieceOf = (color: number, type: number) => (color << 3) | type;

/** What the evaluation can be told (the engine's settings). */
export interface EvalOptions {
  /** A cashed-in pawn's worth (centipawns): the gold, a small nudge (the pawn itself is already gone from the board). */
  cashInValue: number;
}

export const DEFAULT_EVAL: EvalOptions = { cashInValue: 20 };

const KNIGHT_STEPS = [33, 31, 18, 14, -14, -18, -31, -33];
const KING_STEPS = [1, -1, 16, -16, 17, 15, -15, -17];
const BISHOP_DIRS = [17, 15, -15, -17];
const ROOK_DIRS = [1, -1, 16, -16];

/** Passed pawn bonus by rank from its own side (0..7), chess and fight. */
const PASSED_MG = [0, 4, 8, 14, 26, 44, 70, 0];
const PASSED_EG = [0, 8, 16, 30, 52, 86, 130, 0];
const PASSED_FIGHT_MG = [0, 2, 3, 5, 8, 11, 14, 0];
const PASSED_FIGHT_EG = [0, 2, 4, 6, 9, 12, 16, 0];
/** A pawn's endgame value drops this much in a fight (no queen at the end). */
const FIGHT_PAWN_EG = -20;

/** Mobility: per square a piece reaches (not own pieces, not squares an enemy pawn guards), around a typical count. */
const MOB_MG = [0, 0, 4, 5, 2, 1, 0];
const MOB_EG = [0, 0, 4, 5, 4, 2, 0];
const MOB_BASE = [0, 0, 4, 6, 6, 12, 0];

/** A piece (not a pawn) attacked by an enemy pawn. */
const PAWN_THREAT_MG = 40;
const PAWN_THREAT_EG = 30;
/** King safety: attack units by piece type bearing on the king's squares, and the penalty for a total (mg). */
const ATTACK_UNITS = [0, 0, 2, 2, 3, 5, 0];
const SAFETY = (units: number) => Math.min(500, Math.round((units * units) / 2.2));

/** The fight: a side with this many pieces left (not the king) is close to losing them all. */
const LAST_PIECE = [0, 70, 20];
/** The fight: a side's checks in a row so far (toward the win at 5). */
const STREAK = [0, 6, 18, 45, 110, 200, 200, 200];

const pawnFiles = [new Int32Array(10), new Int32Array(10)];
/** Per file (1..8): White's lowest pawn rank and Black's highest (each side's rearmost pawn), for passed pawns. */
const backW = new Int32Array(10);
const backB = new Int32Array(10);

/** Scratch space for one evaluation: pawn guards and king zones by square, the pawns and pieces found. */
const guardW = new Uint8Array(128);
const guardB = new Uint8Array(128);
const zoneW = new Uint8Array(128);
const zoneB = new Uint8Array(128);
const pawnSq = new Int32Array(16);
const pieceSq = new Int32Array(32);
const SLIDE_DIRS: number[][] = [[], [], [], BISHOP_DIRS, ROOK_DIRS, [...BISHOP_DIRS, ...ROOK_DIRS]];

function markZone(zone: Uint8Array, k: number, on: number) {
  zone[k] = on;
  for (let i = 0; i < 8; i++) {
    const t = k + KING_STEPS[i]!;
    if (!(t & 0x88)) zone[t] = on;
  }
}

export function evaluate(pos: Position, opts: EvalOptions = DEFAULT_EVAL): number {
  const b = pos.board;
  const fight = pos.rules.variant === "fight";
  let mg = pos.mg;
  let eg = pos.eg;
  const c = pos.counts;

  // One pass: pawn files, pawn guards, the pieces.
  const pw = pawnFiles[0]!;
  const pb = pawnFiles[1]!;
  pw.fill(0);
  pb.fill(0);
  backW.fill(8);
  backB.fill(-1);
  let nPawns = 0;
  let nPieces = 0;
  const list = pos.list;
  for (let li = 0; li < 64; li++) {
    // (Both colors' lists: White's at 0..31, Black's at 32..63.)
    if (li === pos.listLen[0]!) li = 32;
    if (li >= 32 + pos.listLen[1]!) break;
    const s = list[li]!;
    const p = b[s]!;
    if (p === PAWN) {
      const f = (s & 7) + 1;
      const r = s >> 4;
      pw[f]!++;
      if (r < backW[f]!) backW[f] = r;
      if (!((s + 15) & 0x88)) guardW[s + 15] = 1;
      if (!((s + 17) & 0x88)) guardW[s + 17] = 1;
      pawnSq[nPawns++] = s;
    } else if (p === 9) {
      const f = (s & 7) + 1;
      const r = s >> 4;
      pb[f]!++;
      if (r > backB[f]!) backB[f] = r;
      if (!((s - 15) & 0x88)) guardB[s - 15] = 1;
      if (!((s - 17) & 0x88)) guardB[s - 17] = 1;
      pawnSq[nPawns++] = s;
    } else if ((p & 7) !== KING) pieceSq[nPieces++] = s;
  }

  const wk = pos.kings[WHITE]!;
  const bk = pos.kings[BLACK]!;
  markZone(zoneW, wk, 1);
  markZone(zoneB, bk, 1);
  let attackW = 0; // units White bears on Black's king
  let attackB = 0;
  let attackersW = 0;
  let attackersB = 0;

  // Pawn structure.
  for (let i = 0; i < nPawns; i++) {
    const s = pawnSq[i]!;
    const us = b[s]! >> 3;
    const sign = us === WHITE ? 1 : -1;
    const f = (s & 7) + 1;
    const r = s >> 4;
    const own = us === WHITE ? pw : pb;
    // Doubled (each pawn of a doubled file pays), isolated.
    if (own[f]! > 1) {
      mg -= sign * 6;
      eg -= sign * 12;
    }
    if (!own[f - 1] && !own[f + 1]) {
      mg -= sign * 10;
      eg -= sign * 12;
    }
    // Passed: no enemy pawn ahead on its file or the next ones.
    let passed: boolean;
    let rel: number;
    if (us === WHITE) {
      passed = backB[f]! <= r && backB[f - 1]! <= r && backB[f + 1]! <= r;
      rel = r;
    } else {
      passed = backW[f]! >= r && backW[f - 1]! >= r && backW[f + 1]! >= r;
      rel = 7 - r;
    }
    if (passed) {
      mg += sign * (fight ? PASSED_FIGHT_MG : PASSED_MG)[rel]!;
      eg += sign * (fight ? PASSED_FIGHT_EG : PASSED_EG)[rel]!;
      // Chess endings: an advanced passed pawn is stronger with its own king near the square ahead and the enemy king far.
      if (!fight && rel >= 3) {
        const ahead = s + (us === WHITE ? 16 : -16);
        const own = pos.kings[us]!;
        const enemy = pos.kings[us ^ 1]!;
        eg += sign * (rel - 2) * (5 * kingDist(enemy, ahead) - 2 * kingDist(own, ahead));
      }
    }
  }

  // Pieces: mobility (squares not guarded by an enemy pawn), attacks on the enemy king's squares, rooks on open files.
  for (let i = 0; i < nPieces; i++) {
    const s = pieceSq[i]!;
    const p = b[s]!;
    const t = p & 7;
    const us = p >> 3;
    const sign = us === WHITE ? 1 : -1;
    const guard = us === WHITE ? guardB : guardW;
    const zone = us === WHITE ? zoneB : zoneW;
    // A piece an enemy pawn attacks is in trouble (it must move or be lost).
    if (guard[s]) {
      mg -= sign * PAWN_THREAT_MG;
      eg -= sign * PAWN_THREAT_EG;
    }
    let mob = 0;
    let units = 0;
    if (t === KNIGHT) {
      for (let j = 0; j < 8; j++) {
        const to = s + KNIGHT_STEPS[j]!;
        if (to & 0x88) continue;
        const q = b[to]!;
        if (q && q >> 3 === us) continue;
        if (!guard[to]) mob++;
        units += zone[to]!;
      }
    } else {
      const dirs = SLIDE_DIRS[t]!;
      for (let j = 0; j < dirs.length; j++) {
        const d = dirs[j]!;
        let to = s + d;
        while (!(to & 0x88)) {
          const q = b[to]!;
          if (q && q >> 3 === us) break;
          if (!guard[to]) mob++;
          units += zone[to]!;
          if (q) break;
          to += d;
        }
      }
      if (t === ROOK) {
        const f = (s & 7) + 1;
        const own = us === WHITE ? pw : pb;
        const theirs = us === WHITE ? pb : pw;
        if (!own[f]) {
          mg += sign * (theirs[f] ? 10 : 22);
          eg += sign * (theirs[f] ? 4 : 10);
        }
      }
    }
    mg += sign * MOB_MG[t]! * (mob - MOB_BASE[t]!);
    eg += sign * MOB_EG[t]! * (mob - MOB_BASE[t]!);
    if (units) {
      if (us === WHITE) {
        attackW += units * ATTACK_UNITS[t]!;
        attackersW++;
      } else {
        attackB += units * ATTACK_UNITS[t]!;
        attackersB++;
      }
    }
  }

  // Clean the scratch space.
  markZone(zoneW, wk, 0);
  markZone(zoneB, bk, 0);
  for (let i = 0; i < nPawns; i++) {
    const s = pawnSq[i]!;
    if (b[s] === PAWN) {
      if (!((s + 15) & 0x88)) guardW[s + 15] = 0;
      if (!((s + 17) & 0x88)) guardW[s + 17] = 0;
    } else {
      if (!((s - 15) & 0x88)) guardB[s - 15] = 0;
      if (!((s - 17) & 0x88)) guardB[s - 17] = 0;
    }
  }

  // Bishop pair.
  if (c[pieceOf(WHITE, BISHOP)]! >= 2) {
    mg += 28;
    eg += 45;
  }
  if (c[pieceOf(BLACK, BISHOP)]! >= 2) {
    mg -= 28;
    eg -= 45;
  }

  // King safety (middlegame): pieces on the king's squares (two attackers at least, or a queen), and the pawn shelter.
  if (attackersW >= 2 || (attackersW >= 1 && c[pieceOf(WHITE, QUEEN)]! > 0 && attackW > 6)) mg += SAFETY(attackW);
  if (attackersB >= 2 || (attackersB >= 1 && c[pieceOf(BLACK, QUEEN)]! > 0 && attackB > 6)) mg -= SAFETY(attackB);
  mg += shelter(b, wk, WHITE) - shelter(b, bk, BLACK);

  if (fight) {
    eg += FIGHT_PAWN_EG * (c[PAWN]! - c[9]!);
    // A side down to its last piece or two is close to losing at once.
    const lw = pos.pieces[WHITE]!;
    const lb = pos.pieces[BLACK]!;
    if (lw < LAST_PIECE.length) {
      mg -= LAST_PIECE[lw]!;
      eg -= LAST_PIECE[lw]!;
    }
    if (lb < LAST_PIECE.length) {
      mg += LAST_PIECE[lb]!;
      eg += LAST_PIECE[lb]!;
    }
    const sw = STREAK[Math.min(7, pos.checks[WHITE]!)]!;
    const sb = STREAK[Math.min(7, pos.checks[BLACK]!)]!;
    mg += sw - sb;
    eg += sw - sb;
    const cash = opts.cashInValue * (pos.cashed[WHITE]! - pos.cashed[BLACK]!);
    mg += cash;
    eg += cash;
  }

  const phase = Math.min(PHASE_MAX, pos.phase);
  let score = Math.round((mg * phase + eg * (PHASE_MAX - phase)) / PHASE_MAX);

  // Chess endings: drive a lone king to the edge; a pawnless edge of a minor piece or less is nearly a draw.
  if (!fight) score = endgameScale(pos, score);

  // A small bonus for the move.
  score += pos.side === WHITE ? 10 : -10;
  return pos.side === WHITE ? score : -score;
}

/** The pawn shelter in front of a king on its first two ranks (middlegame), from that side's view. */
function shelter(b: Int8Array, k: number, us: number): number {
  const r = k >> 4;
  const home = us === WHITE ? r <= 1 : r >= 6;
  if (!home) return -20;
  const up = us === WHITE ? 16 : -16;
  const pawn = pieceOf(us, PAWN);
  let score = 0;
  for (let df = -1; df <= 1; df++) {
    const f = (k & 7) + df;
    if (f < 0 || f > 7) continue;
    const one = k + up + df;
    const two = one + up;
    if (!(one & 0x88) && b[one] === pawn) score += 12;
    else if (!(two & 0x88) && b[two] === pawn) score += 6;
    else score -= 10;
  }
  return score;
}

const centerDist = (s: number) => Math.max(3 - (s & 7), (s & 7) - 4) + Math.max(3 - (s >> 4), (s >> 4) - 4);
const kingDist = (a: number, c: number) => Math.max(Math.abs((a & 7) - (c & 7)), Math.abs((a >> 4) - (c >> 4)));

function endgameScale(pos: Position, score: number): number {
  const c = pos.counts;
  const strong = score > 0 ? WHITE : BLACK;
  const weak = strong ^ 1;
  const minors = (col: number) => c[pieceOf(col, KNIGHT)]! + c[pieceOf(col, BISHOP)]!;
  const majors = (col: number) => c[pieceOf(col, ROOK)]! * 5 + c[pieceOf(col, QUEEN)]! * 9;
  const pawns = (col: number) => c[pieceOf(col, PAWN)]!;
  // No pawns and not more than a minor piece up: hard to win.
  if (!pawns(strong) && majors(strong) + minors(strong) * 3 - majors(weak) - minors(weak) * 3 <= 3) score = Math.round(score / 4);
  // A lone king: to the edge, the kings together.
  if (pos.pieces[weak] === 0 && pos.pieces[strong]! > 0) {
    const bonus = 20 * centerDist(pos.kings[weak]!) + 8 * (7 - kingDist(pos.kings[WHITE]!, pos.kings[BLACK]!)) + 200;
    score += strong === WHITE ? bonus : -bonus;
  }
  return score;
}
