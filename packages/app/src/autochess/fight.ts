import { AUTOCHESS, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { F_CASHIN, fightRules, moveFlags, moveUci, parseSquare, Position, type HunEnd } from "@chessroyale/chess/hunchess";
import type { Color } from "./types.ts";

/**
 * The fight: the HunChess engine plays both sides, the same search for each, a move about every 0.35 s, until mate or 5 checks in
 * a row (a win either way), stalemate, a draw by the rules, the move cap or too long with no capture or check, when the side with
 * more material wins (equal is a draw). No promotion (Eric, Oct 20): a pawn that moves onto its last rank cashes in, leaving the
 * board, and its owner gets `cashInGold` at the round's end. A side left with only its king loses at once (both kings alone: a
 * draw), which is also true of a side that starts the fight so (Eric, Oct 20: "boring moving around... makes it go faster"). After
 * 30 moves a side, moves play twice as fast. The rules are the engine's own (`@chessroyale/chess/hunchess`), so what the engine
 * searches and what the fight plays are the same thing (docs/decisions/2026-10-21-hunchess-engine.md).
 */

export type FightEnd = HunEnd;

/** The fight's rules for the engine's board, from the settings. */
export const rulesFor = (cfg: AutoChessSettings = AUTOCHESS) => fightRules(cfg);

/** The moves a fight allows in a position (its start, no history): every legal move, a pawn's move onto its last rank a cash-in ("b7b8"). */
export const fightMoves = (fen: string, cfg: AutoChessSettings = AUTOCHESS): string[] => new Position(fen, rulesFor(cfg)).legalMoves().map(moveUci);

/** How long a move takes: `fightMoveMs`, and after `fightFastAfter` moves a side (this many plies so far, two to a move) `fightFastMoveMs`. */
export const moveMs = (plies: number, cfg: AutoChessSettings = AUTOCHESS) => (plies >= 2 * cfg.fightFastAfter ? cfg.fightFastMoveMs : cfg.fightMoveMs);

export interface FightResult {
  /** The winning color, or null for a draw. */
  winner: Color | null;
  end: FightEnd;
  /** The position at the end, and every move played (UCI). */
  fen: string;
  moves: string[];
  /** How many pawns of each color cashed in. */
  cashIns: { w: number; b: number };
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

export interface FightOptions {
  /** The engine's move for the fight so far, one of `allowed` (null when it has none to give: a stand-in is played). */
  pick: (game: FightSoFar, allowed: readonly string[]) => Promise<string | null>;
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
  for (;;) {
    // (The rules in their order: a bare king first, then mate and stalemate, 5 checks in a row, the draws, the caps.)
    const over = pos.result();
    if (over) return { winner: over.winner < 0 ? null : COLOR[over.winner]!, end: over.end, fen: pos.fen(), moves, cashIns };
    const allowed = pos.legalMoves().map(moveUci);
    // (The engine thinks while the move's time runs, so a move takes about `fightMoveMs`, not that plus the search.)
    const [asked] = await Promise.all([opts.pick({ startFen, moves: [...moves] }, allowed).catch(() => null), wait(moveMs(moves.length, cfg))]);
    if (opts.cancelled?.()) return null;
    const move = asked && allowed.includes(asked) ? asked : pickStandIn(pos, allowed, opts.rng)!;
    const mover = COLOR[pos.side]!;
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
