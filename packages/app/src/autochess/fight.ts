import { AUTOCHESS, type AutoChessSettings, type Rng } from "@chessroyale/core";
import { applyMove, gameEnd, inCheck, legalMoves, sideToMove } from "@chessroyale/chess";
import { material } from "./position.ts";
import { other, type Color } from "./types.ts";

/**
 * The fight: the engine plays both sides, the same search for each, a move about every 0.35 s, until mate or 5 checks in
 * a row (a win either way), stalemate, a draw by the rules, the move cap or too long with no capture or check, when the
 * side with more material wins (equal is a draw). Pawns don't promote (Eric, Oct 19: armies of pawns racing to queen took
 * over): a pawn never moves onto its last rank.
 */

export type FightEnd = "checkmate" | "checks" | "stalemate" | "repetition" | "fifty_moves" | "insufficient_material" | "cap" | "quiet";

/** The moves a fight allows: every legal move but a promotion. */
export const fightMoves = (fen: string): string[] => legalMoves(fen).filter((m) => m.length === 4);

/** How many pieces stand on the board (kings too). */
const pieceCount = (fen: string) => fen.split(" ")[0]!.replace(/[^a-zA-Z]/g, "").length;

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
  /** The engine's move for a position, one of `allowed` (null when it has none to give: a stand-in is played). */
  pick: (fen: string, history: readonly string[], allowed: readonly string[]) => Promise<string | null>;
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
export function standInMove(fen: string, rng: Rng): string | null {
  const moves = fightMoves(fen);
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
  /** Moves (each side's) since the last capture or check. */
  let quiet = 0;
  /** Each side's checks in a row (its moves that gave check, with none between that didn't). */
  const checks = { w: 0, b: 0 };
  for (;;) {
    const allowed = fightMoves(fen);
    // (A side whose only legal moves were promotions has none: mated if its king is attacked, else stalemated.)
    if (!allowed.length) return inCheck(fen) ? { winner: other(sideToMove(fen)), end: "checkmate", fen, moves } : { winner: null, end: "stalemate", fen, moves };
    // (Before the draws by the rules: the checks that would repeat a position for a draw win here.)
    const checker = other(sideToMove(fen));
    if (checks[checker] >= cfg.checksToWin) return { winner: checker, end: "checks", fen, moves };
    const end = gameEnd(startFen, moves);
    if (end) return { winner: end === "checkmate" ? other(sideToMove(fen)) : null, end, fen, moves };
    if (moves.length >= 2 * cfg.moveCap || quiet >= 2 * cfg.quietCap) {
      const m = material(fen);
      return { winner: m.w > m.b ? "w" : m.b > m.w ? "b" : null, end: moves.length >= 2 * cfg.moveCap ? "cap" : "quiet", fen, moves };
    }
    // (The engine thinks while the move's time runs, so a move takes about `fightMoveMs`, not that plus the search.)
    const [asked] = await Promise.all([opts.pick(fen, moves, allowed).catch(() => null), wait(cfg.fightMoveMs)]);
    if (opts.cancelled?.()) return null;
    const move = asked && allowed.includes(asked) ? asked : standInMove(fen, opts.rng)!;
    const next = applyMove(fen, move);
    const check = inCheck(next);
    const mover = sideToMove(fen);
    checks[mover] = check ? checks[mover] + 1 : 0;
    quiet = check || pieceCount(next) < pieceCount(fen) ? 0 : quiet + 1;
    fen = next;
    moves.push(move);
    opts.onStep?.({ fen, move, ply: moves.length });
  }
}
