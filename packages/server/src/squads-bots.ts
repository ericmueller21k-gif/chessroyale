import { Chess } from "chess.js";
import { JUDGES, SQUADS, SQUADS_LOBBY, type SquadsSettings } from "@chessroyale/core";
import type { MoveScore } from "@chessroyale/chess";
import { squadsLegalMoves } from "@chessroyale/chess/squads";

/**
 * Squad bots' engine work on the server's side (docs/areas/squads.md, "The server"): checking a device's answer,
 * comparing two, and the server's own quick look for when no device can answer. The bots themselves are phase 1's
 * (`bots.ts` in the rules: the bot engine's top moves, then `botPick` at the bot's skill); only where their top
 * moves come from is decided here.
 */

/**
 * A device's answer to a bot-work job, cleaned: the top moves, best first, each legal, its expected score in [0, 1],
 * and its line's reply if it gave one (a move's shape: the bots read it, to block). A move listed twice keeps its
 * first line (the engine interface can report one move on two MultiPV lines; every device does the same, so answers
 * still compare). Null if it doesn't hold together (the device gets a strike).
 */
export function cleanTop(fen: string, top: unknown, n: number = SQUADS.bots.candidates): MoveScore[] | null {
  if (!Array.isArray(top) || !top.length || top.length > Math.max(n, 1)) return null;
  const legal = new Set(squadsLegalMoves(fen));
  const out: MoveScore[] = [];
  for (const m of top as Partial<MoveScore>[]) {
    if (!m || typeof m.move !== "string" || !legal.has(m.move)) return null;
    if (typeof m.expected !== "number" || !Number.isFinite(m.expected) || m.expected < 0 || m.expected > 1) return null;
    if (m.mate !== undefined && (!Number.isInteger(m.mate) || m.mate === 0)) return null;
    if (m.reply !== undefined && (typeof m.reply !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.reply))) return null;
    if (out.some((x) => x.move === m.move)) continue;
    out.push({ move: m.move, expected: m.expected, ...(m.mate !== undefined ? { mate: m.mate } : {}), ...(m.reply !== undefined ? { reply: m.reply } : {}) });
  }
  return out;
}

/**
 * Two devices' answers agree: the same moves in the same order, every expected score within `tolerance` (the browser
 * engine is deterministic: JUDGES.tolerance is 0, an exact match), the same mates and replies.
 */
export function topsAgree(a: readonly MoveScore[], b: readonly MoveScore[], tolerance: number = JUDGES.tolerance): boolean {
  return a.length === b.length && a.every((m, i) => m.move === b[i]!.move && Math.abs(m.expected - b[i]!.expected) <= tolerance + 1e-12 && m.mate === b[i]!.mate && m.reply === b[i]!.reply);
}

/** The moves to put to the engine server when two answers disagree: both lists, alternately, at most 8 (its limit). */
export function verdictMovesOf(answers: readonly (readonly MoveScore[])[], max = 8): string[] {
  const out: string[] = [];
  const longest = Math.max(0, ...answers.map((a) => a.length));
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const a of answers) {
      const m = a[i]?.move;
      if (m && !out.includes(m) && out.length < max) out.push(m);
    }
  }
  return out;
}

/** How far an answer is from the engine server's verdict: the largest gap on a move both scored (1 if it scored none of them). */
export function distanceFromVerdict(answer: readonly MoveScore[], verdict: readonly MoveScore[]): number {
  let d = 0;
  let shared = 0;
  for (const v of verdict) {
    const a = answer.find((m) => m.move === v.move);
    if (!a) continue;
    shared++;
    d = Math.max(d, Math.abs(a.expected - v.expected));
  }
  return shared ? d : 1;
}

// ---- The server's quick look (no devices) ----

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MATE = 100;

interface InternalMove {
  from: number;
  to: number;
  piece: string;
  captured?: string;
  promotion?: string;
}
interface Internals {
  _moves(o: { legal: boolean }): InternalMove[];
  _makeMove(m: InternalMove): void;
  _undoMove(): unknown;
}
const square = (i: number) => "abcdefgh"[i & 15]! + String(8 - (i >> 4));
const uciOf = (m: InternalMove) => square(m.from) + square(m.to) + (m.promotion ?? "");
const gainOf = (m: InternalMove) => (m.captured ? VALUE[m.captured]! : 0) + (m.promotion ? VALUE[m.promotion]! - 1 : 0);
/**
 * A small nudge between moves of equal material (a fraction of a pawn): towards the centre, castling, knights and
 * bishops off the back rank, not the king for a walk.
 */
function nudge(m: InternalMove): number {
  const file = m.to & 15;
  const rank = 7 - (m.to >> 4);
  const centre = (3.5 - Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5))) * 0.04;
  const castle = m.piece === "k" && Math.abs((m.to & 15) - (m.from & 15)) === 2 ? 0.3 : 0;
  const walk = m.piece === "k" && !castle ? -0.15 : 0;
  const fromRank = 7 - (m.from >> 4);
  const develop = (m.piece === "n" || m.piece === "b") && (fromRank === 0 || fromRank === 7) ? 0.1 : 0;
  return centre + castle + walk + develop;
}

/** The mover's material lead (pawn 1, knight and bishop 3, rook 5, queen 9). */
function lead(fen: string, s: SquadsSettings): number {
  let out = 0;
  const mover = fen.split(" ")[1] === "b" ? "b" : "w";
  for (const ch of fen.split(" ")[0]!) {
    const t = ch.toLowerCase() as keyof SquadsSettings["material"];
    const v = s.material[t];
    if (v === undefined) continue;
    out += (ch === t) === (mover === "b") ? v : -v;
  }
  return out;
}

const known = new Map<string, MoveScore[]>();

/**
 * The server's own quick look at a position, for a bot when no device can answer in time: no engine, only the rules'
 * chess library. Each legal move scores the mover's material lead after it, less the most the opponent can win at
 * once (a capture we can take back costs them their piece; a mate in one counts as the game); a mating move wins outright, a stalemate or a dead draw is level. The
 * lead becomes an expected score through a logistic (`fallbackScale` per pawn), so `candidatesFrom` and `botPick`
 * treat it as they treat the engine's top moves. Weak, but it takes free material, keeps its pieces and mates in one.
 * Each move's reply is the opponent's biggest threat after it (what a bot would block), if any.
 */
export function fallbackTop(fen: string, n: number = SQUADS.bots.candidates, s: SquadsSettings = SQUADS, scale: number = SQUADS_LOBBY.botWork.fallbackScale): MoveScore[] {
  const hit = known.get(fen);
  if (hit) return hit.slice(0, n);
  const chess = new Chess(fen);
  const x = chess as unknown as Partial<Internals>;
  const base = lead(fen, s);
  const expected = (pawns: number) => 1 / (1 + Math.exp(-scale * pawns));
  const scored: MoveScore[] = [];
  if (typeof x._moves === "function" && typeof x._makeMove === "function" && typeof x._undoMove === "function") {
    const it = x as Internals;
    for (const m of it._moves({ legal: true })) {
      it._makeMove(m);
      const replies = it._moves({ legal: true });
      let score: number;
      let mate: number | undefined;
      let reply: string | undefined;
      if (!replies.length) {
        score = chess.inCheck() ? MATE : 0;
        if (chess.inCheck()) mate = 1;
      } else if (chess.isInsufficientMaterial()) {
        score = 0;
      } else {
        let threat = 0;
        const us = chess.turn() === "w" ? "b" : "w";
        for (const r of replies) {
          let g = gainOf(r);
          it._makeMove(r);
          if (chess.inCheck() && !it._moves({ legal: true }).length) g = MATE;
          // (A capture we can answer by taking back costs them the capturing piece: only the difference counts.)
          else if (r.captured && chess.isAttacked(square(r.to) as never, us)) g -= VALUE[r.promotion ?? r.piece]!;
          it._undoMove();
          if (g > threat) {
            threat = g;
            reply = uciOf(r);
          }
          if (threat >= MATE) break;
        }
        if (threat >= MATE) mate = -1;
        score = base + gainOf(m) - threat + nudge(m);
      }
      it._undoMove();
      scored.push({ move: uciOf(m), expected: score >= MATE ? 1 : score <= -MATE ? 0 : expected(score), ...(mate !== undefined ? { mate } : {}), ...(reply ? { reply } : {}) });
    }
  } else {
    // (chess.js without its internals: the public API, slower.)
    for (const m of chess.moves({ verbose: true })) {
      chess.move(m);
      let score: number;
      let mate: number | undefined;
      if (chess.isCheckmate()) {
        score = MATE;
        mate = 1;
      } else if (chess.isDraw()) score = 0;
      else {
        let threat = 0;
        for (const r of chess.moves({ verbose: true })) threat = Math.max(threat, r.san.endsWith("#") ? MATE : (r.captured ? VALUE[r.captured]! : 0) + (r.promotion ? VALUE[r.promotion]! - 1 : 0));
        if (threat >= MATE) mate = -1;
        score = base + (m.captured ? VALUE[m.captured]! : 0) + (m.promotion ? VALUE[m.promotion]! - 1 : 0) - threat;
      }
      chess.undo();
      scored.push({ move: m.from + m.to + (m.promotion ?? ""), expected: score >= MATE ? 1 : score <= -MATE ? 0 : expected(score), ...(mate !== undefined ? { mate } : {}) });
    }
  }
  // Best first (a stable order: the chess library's move order breaks ties).
  const out = scored.map((m, i) => ({ m, i })).sort((a, b) => b.m.expected - a.m.expected || a.i - b.i).map((x) => x.m);
  known.set(fen, out);
  if (known.size > 256) known.delete(known.keys().next().value!);
  return out.slice(0, n);
}
