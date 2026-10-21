import { AUTOCHESS, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { BLACK, F_CASHIN, fightRules, judgedResult, moveFlags, moveUci, parseSquare, Position, WHITE, winMoves, type HunEnd } from "@chessroyale/chess/hunchess";
import type { Color } from "./types.ts";

/**
 * The fight: the HunChess engine plays both sides, the same search for each, a move about every 0.6 s, until mate (a win), a side
 * left with only its king (it loses at once; both kings alone: a draw; also a side that starts the fight so: Eric, Oct 20: "boring
 * moving around... makes it go faster"), stalemate or too little material (draws), or a **stall**: a threefold repetition, 10 moves a
 * side with no capture or cash-in, or 60 moves a side. A stall goes to the side the engine's score of the final position favors by a
 * pawn (`stallWinMargin`); closer is a draw. **Too far ahead:** a side the engine's score favors by 5 pawns (`decisiveMargin`) after 6
 * of its own moves in a row (`decisiveMoves`) wins at once, unless the engine has found it a forced mate (or a forced win by another
 * rule) within 5 moves (`mateShowMoves`), which plays out. Checks count for nothing (Eric, Oct 21: no more "5 checks in a row").
 * No promotion (Eric, Oct 20): a pawn that moves onto its last rank cashes in, leaving the board, and its owner gets `cashInGold` at the round's end. Moves play twice as fast after 30 moves a side, or once either side is down to
 * its king and pawns. The rules are the engine's own (`@chessroyale/chess/hunchess`), so what the engine searches and what the fight
 * plays are the same thing (docs/decisions/2026-10-21-hunchess-engine.md, docs/decisions/2026-10-21-autochess-endings.md).
 */

export type FightEnd = HunEnd;

/** The fight's rules for the engine's board, from the settings. */
export const rulesFor = (cfg: AutoChessSettings = AUTOCHESS) => fightRules(cfg);

/** The moves a fight allows in a position (its start, no history): every legal move, a pawn's move onto its last rank a cash-in ("b7b8"). */
export const fightMoves = (fen: string, cfg: AutoChessSettings = AUTOCHESS): string[] => new Position(fen, rulesFor(cfg)).legalMoves().map(moveUci);

/**
 * How long a move takes: `fightMoveMs`; `fightFastMoveMs` after `fightFastAfter` moves a side (this many plies so far, two to a
 * move) or once either side is down to its king and pawns (`thin`).
 */
export const moveMs = (plies: number, cfg: AutoChessSettings = AUTOCHESS, thin = false) => (thin || plies >= 2 * cfg.fightFastAfter ? cfg.fightFastMoveMs : cfg.fightMoveMs);

export interface FightResult {
  /** The winning color, or null for a draw. */
  winner: Color | null;
  end: FightEnd;
  /** The position at the end, and every move played (UCI). */
  fen: string;
  moves: string[];
  /** How many pawns of each color cashed in. */
  cashIns: { w: number; b: number };
  /** A stall's deciding score (the engine's, centipawns, White's view), or for "decided" the winner's last score (its own view). */
  score?: number;
}

/** One move as played: what the screen shows (the position after it, the move, how many plies so far, and whose pawn cashed in with it). */
export interface FightStep {
  fen: string;
  move: string;
  ply: number;
  /** The color whose pawn cashed in with this move (it reached the move's square and left the board), or null. */
  cashIn: Color | null;
}

/** A fight so far, for the engine: where it started and the moves since (the counters and repetitions come from them). */
export interface FightSoFar {
  startFen: string;
  moves: readonly string[];
}

/** The engine's answer: its move and its score for the side moving (centipawns; a found mate near the engine's WIN). */
export interface PickAnswer {
  move: string;
  score: number;
}

export interface FightOptions {
  /**
   * The engine's move for the fight so far, one of `allowed` (null when it has none to give: a stand-in is played). With its score,
   * it counts toward "too far ahead"; a bare move (or a stand-in) doesn't, and starts that side's count again.
   */
  pick: (game: FightSoFar, allowed: readonly string[]) => Promise<string | PickAnswer | null>;
  /** Shown after every move; the next move waits for it, and for the move's time (`wait`). */
  onStep?: (step: FightStep) => void;
  /** Waits this long (ms): a real clock, or a test's instant one. */
  wait?: (ms: number) => Promise<void>;
  /** Ends the fight at once (the player left), with no result. */
  cancelled?: () => boolean;
  /** Random choice for the stand-in move. */
  rng: Rng;
  cfg?: AutoChessSettings;
}

/** A move when the engine gave none: a capture if there is one, else any move the fight allows. */
export function standInMove(fen: string, rng: Rng, cfg: AutoChessSettings = AUTOCHESS): string | null {
  const pos = new Position(fen, rulesFor(cfg));
  return pickStandIn(pos, pos.legalMoves().map(moveUci), rng);
}

function pickStandIn(pos: Position, moves: readonly string[], rng: Rng): string | null {
  if (!moves.length) return null;
  const captures = moves.filter((m) => pos.board[parseSquare(m.slice(2, 4))] !== 0);
  const from = captures.length ? captures : moves;
  return from[Math.floor(rng() * from.length)]!;
}

const COLOR: readonly Color[] = ["w", "b"];

/** Plays a fight out from `startFen`. Null if it was cancelled. */
export async function playFight(startFen: string, opts: FightOptions): Promise<FightResult | null> {
  const cfg = opts.cfg ?? AUTOCHESS;
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  // (One board for the whole fight, a move made on it at a time: never replayed from the start.)
  const pos = new Position(startFen, rulesFor(cfg));
  const moves: string[] = [];
  const cashIns = { w: 0, b: 0 };
  /** Each side's own moves in a row after which the engine's score had it `decisiveMargin` or more ahead. */
  const ahead = { w: 0, b: 0 };
  let decided: { winner: Color; score: number } | null = null;
  for (;;) {
    // (The rules in their order: a bare king first, then mate and stalemate, the stalls and draws; then "too far ahead".)
    const over = judgedResult(pos, cfg.cashInValue);
    if (over) return { winner: over.winner < 0 ? null : COLOR[over.winner]!, end: over.end, fen: pos.fen(), moves, cashIns, ...(over.score !== undefined ? { score: over.score } : {}) };
    if (decided) return { winner: decided.winner, end: "decided", fen: pos.fen(), moves, cashIns, score: decided.score };
    const allowed = pos.legalMoves().map(moveUci);
    // (The engine thinks while the move's time runs, so a move takes about `fightMoveMs`, not that plus the search.)
    const thin = pos.kingAndPawns(WHITE) || pos.kingAndPawns(BLACK);
    const [asked] = await Promise.all([opts.pick({ startFen, moves: [...moves] }, allowed).catch(() => null), wait(moveMs(moves.length, cfg, thin))]);
    if (opts.cancelled?.()) return null;
    const answer = typeof asked === "string" ? { move: asked, score: null } : asked ? { move: asked.move, score: asked.score } : null;
    const engineMove = answer && allowed.includes(answer.move) ? answer : null;
    const move = engineMove ? engineMove.move : pickStandIn(pos, allowed, opts.rng)!;
    const mover = COLOR[pos.side]!;
    const score = engineMove?.score ?? null;
    ahead[mover] = score !== null && score >= cfg.decisiveMargin ? ahead[mover] + 1 : 0;
    if (score !== null && ahead[mover] >= cfg.decisiveMoves) {
      // (A forced win the engine has found soon plays out: a quick mate is fun to watch. So does a win by another rule it has
      // found, a bare king or a won stall: its score is a win's, not a lead of so many pawns, and it ends the fight in a few moves.)
      const win = winMoves(score);
      if (win === null || win > cfg.mateShowMoves) decided = { winner: mover, score };
    }
    const played = pos.play(move);
    const cashIn = moveFlags(played) & F_CASHIN ? mover : null;
    if (cashIn) cashIns[cashIn]++;
    moves.push(move);
    opts.onStep?.({ fen: pos.fen(), move, ply: moves.length, cashIn });
  }
}

/** A FEN with one more piece drawn on `square` (FEN letter `piece`): a pawn shown on the last rank for a moment as it cashes in (only drawn, never played). */
export function withPiece(fen: string, square: string, piece: string): string {
  const [placement, ...rest] = fen.split(" ");
  const rows = placement!.split("/").map((row) => row.replace(/\d/g, (d) => ".".repeat(Number(d))).split(""));
  rows[8 - Number(square[1])]![square.charCodeAt(0) - 97] = piece;
  return [rows.map((r) => r.join("").replace(/\.+/g, (dots) => String(dots.length))).join("/"), ...rest].join(" ");
}
