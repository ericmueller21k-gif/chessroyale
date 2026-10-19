import { AUTOCHESS, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { applyMove, gameEnd, legalMoves, sideToMove } from "@chessroyale/chess";
import { material } from "./position.ts";
import { other, type Color } from "./types.ts";

/**
 * The fight: the engine plays both sides, the same search for each, a move about every 0.35 s, until mate, stalemate, a
 * draw by the rules, or the move cap, when the side with more material wins (equal is a draw).
 */

export type FightEnd = "checkmate" | "stalemate" | "repetition" | "fifty_moves" | "insufficient_material" | "cap";

export interface FightResult {
  /** The winning color, or null for a draw. */
  winner: Color | null;
  end: FightEnd;
  /** The position at the end, and every move played (UCI). */
  fen: string;
  moves: string[];
}

/** One move as played: what the screen shows (the position after it, the move, how many plies so far). */
export interface FightStep {
  fen: string;
  move: string;
  ply: number;
}

export interface FightOptions {
  /** The engine's move for a position (null when it has none to give: a stand-in is played). */
  pick: (fen: string, history: readonly string[]) => Promise<string | null>;
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

/** A move when the engine gave none: a capture if there is one, else any legal move. */
export function standInMove(fen: string, rng: Rng): string | null {
  const moves = legalMoves(fen);
  if (!moves.length) return null;
  const board = fen.split(" ")[0]!;
  const rows = board.split("/");
  const occupied = (sq: string) => {
    let f = 0;
    for (const ch of rows[8 - Number(sq[1])]!) {
      if (ch >= "1" && ch <= "8") f += Number(ch);
      else {
        if (f === sq.charCodeAt(0) - 97) return true;
        f++;
      }
    }
    return false;
  };
  const captures = moves.filter((m) => occupied(m.slice(2, 4)));
  const from = captures.length ? captures : moves;
  return from[Math.floor(rng() * from.length)]!;
}

/** Plays a fight out from `startFen`. Null if it was cancelled. */
export async function playFight(startFen: string, opts: FightOptions): Promise<FightResult | null> {
  const cfg = opts.cfg ?? AUTOCHESS;
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const moves: string[] = [];
  let fen = startFen;
  for (;;) {
    const end = gameEnd(startFen, moves);
    if (end) return { winner: end === "checkmate" ? other(sideToMove(fen)) : null, end, fen, moves };
    if (moves.length >= 2 * cfg.moveCap) {
      const m = material(fen);
      return { winner: m.w > m.b ? "w" : m.b > m.w ? "b" : null, end: "cap", fen, moves };
    }
    // (The engine thinks while the move's time runs, so a move takes about `fightMoveMs`, not that plus the search.)
    const [asked] = await Promise.all([opts.pick(fen, moves).catch(() => null), wait(cfg.fightMoveMs)]);
    if (opts.cancelled?.()) return null;
    const move = asked && legalMoves(fen).includes(asked) ? asked : standInMove(fen, opts.rng);
    if (!move) return { winner: null, end: "stalemate", fen, moves };
    fen = applyMove(fen, move);
    moves.push(move);
    opts.onStep?.({ fen, move, ply: moves.length });
  }
}
