/**
 * The Hidden Boss's phase 2 (Eric, Oct 14): beaten on one board, he revives, the board splits into four, and he plays
 * all four at once in Chess960, each board from its own start position (Eric: "Every player gets a different one that
 * avoids everybody just discussing the same move"). The players are White on every board; he plays Black. Every board
 * must be won to beat him: a board lost (mate, time, resign) is lost and the others play on; a draw is not a win. The
 * battle ends when every board is decided.
 *
 * Pure rules, no clock of their own (`now` is passed in) and no engine: the app drives them (packages/app/src/
 * recluse-phase2.ts; today an admin's fight in Boss alone, on this device). His brain here is Stockfish only, at a
 * fixed strength (RECLUSE_PHASE2): Maia can't play Chess960.
 *
 * Each board is a BoardState from a base at ply 0 holding its start FEN (`bases: [{ ply: 0, fen }]`), so fenAtPly,
 * boardEnd and replays work as for any board (DECISIONS.md, "Chess960's rules").
 */
import { RECLUSE_PHASE2, mulberry32 } from "@chessroyale/core";
import { BOSS_OPENING, boardEnd, playOnBoard, type BoardState } from "../boards.ts";
import { chess960Fen } from "../chess960.ts";
import { legalMoves, sideToMove } from "../rules.ts";
import { powerRoll } from "./base.ts";

export type Phase2Settings = typeof RECLUSE_PHASE2;

/** How a board ended: who won it (the players, "crowd"; him, "boss"; or a draw) and how. */
export interface Phase2Result {
  winner: "crowd" | "boss" | "draw";
  how: "mate" | "time" | "resign" | "stalemate" | "draw";
}

export interface Phase2Board {
  /** 0 to boards-1. */
  id: number;
  /** Who plays it for the players (the human's id, or a bot's). */
  player: string;
  /** Its Chess960 start position (the standard numbering, 0 to 959; 518 the normal setup; -1 a test position). */
  number: number;
  board: BoardState;
  /** The player's bank (ms) as of `turnAt` (their clock isn't running: as it stands). */
  bankMs: number;
  /** When the player's current turn began (their clock running), or null: it's his move, or the board is decided. */
  turnAt: number | null;
  result: Phase2Result | null;
}

export interface Phase2State {
  boards: Phase2Board[];
}

/** The players' side on every board: White (they move first, as the crowd does in Boss alone); he's Black. */
export const PHASE2_CROWD = "w" as const;

/**
 * The test switch's position (?win=1): after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 from the normal setup (number 518), White to
 * move, written as Chess960 (Shredder-FEN, so the Chess960 rules and the engine's Chess960 mode play it): Qxf7 mates.
 */
export const PHASE2_WIN_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w HAha - 4 4";

/**
 * The start positions, one a board, all different, drawn from the battle's seed: the same seed, the same four. Drawn
 * without replacement from the 960 (each draw picks from those left), so there's no retry loop.
 */
export function phase2Numbers(seed: number, n: number = RECLUSE_PHASE2.boards): number[] {
  const rng = mulberry32(Math.floor(powerRoll(seed, "phase2") * 2 ** 32) >>> 0);
  const left = Array.from({ length: 960 }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < n && left.length; i++) out.push(left.splice(Math.min(left.length - 1, Math.floor(rng() * left.length)), 1)[0]!);
  return out;
}

/** A board from a Chess960 position: a base at ply 0 holds its FEN, so everything that replays it starts there. */
export function phase2Board(id: number, fen: string): BoardState {
  return {
    id,
    opening: { ...BOSS_OPENING, id: "chess960", name: "Chess960", family: "Chess960" },
    openingPlies: 0,
    history: [],
    fen,
    expected: 0.5,
    lastMove: null,
    generation: 0,
    evals: [0.5],
    bases: [{ ply: 0, fen }],
  };
}

/**
 * Phase 2 begins at `now`: a board a player (`players[i]` on board i), each from its own start position (`numbers`), or
 * every board from the test position (`win`). Every player's clock starts at once (they're White).
 */
export function startPhase2(opts: { players: readonly string[]; numbers: readonly number[]; now: number; win?: boolean; s?: Pick<Phase2Settings, "bankSeconds"> }): Phase2State {
  const s = opts.s ?? RECLUSE_PHASE2;
  return {
    boards: opts.players.map((player, id) => {
      const number = opts.win ? -1 : opts.numbers[id]!;
      const board = phase2Board(id, opts.win ? PHASE2_WIN_FEN : chess960Fen(number));
      return { id, player, number, board, bankMs: s.bankSeconds * 1000, turnAt: opts.now, result: null };
    }),
  };
}

/** The player's bank on a board at `now` (ms, never below 0): it runs only while it's their move. */
export function bankLeft(b: Pick<Phase2Board, "bankMs" | "turnAt">, now: number): number {
  return Math.max(0, b.bankMs - (b.turnAt === null ? 0 : Math.max(0, now - b.turnAt)));
}

/** Whose move it is on a live board: the player's ("crowd") or his ("boss"); null once it's decided. */
export function phase2ToMove(b: Pick<Phase2Board, "board" | "result">): "crowd" | "boss" | null {
  if (b.result) return null;
  return sideToMove(b.board.fen) === PHASE2_CROWD ? "crowd" : "boss";
}

/** A board's result from its position after a move (mate, stalemate, a draw by rule), or null: play on. */
function resultAfter(board: BoardState): Phase2Result | null {
  const end = boardEnd(board);
  if (!end) return null;
  if (end === "checkmate") return { winner: sideToMove(board.fen) === PHASE2_CROWD ? "boss" : "crowd", how: "mate" };
  return { winner: "draw", how: end === "stalemate" ? "stalemate" : "draw" };
}

const replace = (st: Phase2State, b: Phase2Board): Phase2State => ({ boards: st.boards.map((x) => (x.id === b.id ? b : x)) });

/**
 * A move on a board at `now`, by whoever's move it is there: the player's (their clock stops; out of time, the board is
 * lost and the move isn't played) or his (the player's clock starts). Unchanged (the same object) if the board is
 * decided or the move isn't legal there.
 */
export function phase2Move(st: Phase2State, boardId: number, move: string, now: number): Phase2State {
  const b = st.boards.find((x) => x.id === boardId);
  const who = b ? phase2ToMove(b) : null;
  if (!b || !who || !legalMoves(b.board.fen).includes(move)) return st;
  if (who === "crowd") {
    const left = bankLeft(b, now);
    if (left <= 0) return replace(st, { ...b, bankMs: 0, turnAt: null, result: { winner: "boss", how: "time" } });
    const board = playOnBoard(b.board, move, 0.5);
    return replace(st, { ...b, board, bankMs: left, turnAt: null, result: resultAfter(board) });
  }
  const board = playOnBoard(b.board, move, 0.5);
  const result = resultAfter(board);
  return replace(st, { ...b, board, turnAt: result ? null : now, result });
}

/** Every board whose player is out of time at `now` is lost on time. Unchanged (the same object) if none is. */
export function phase2Flags(st: Phase2State, now: number): Phase2State {
  if (!st.boards.some((b) => !b.result && b.turnAt !== null && bankLeft(b, now) <= 0)) return st;
  return { boards: st.boards.map((b) => (!b.result && b.turnAt !== null && bankLeft(b, now) <= 0 ? { ...b, bankMs: 0, turnAt: null, result: { winner: "boss", how: "time" } } : b)) };
}

/** The player resigns a board: it's lost, the others play on. Unchanged if it's already decided. */
export function phase2Resign(st: Phase2State, boardId: number, now: number): Phase2State {
  const b = st.boards.find((x) => x.id === boardId);
  if (!b || b.result) return st;
  return replace(st, { ...b, bankMs: bankLeft(b, now), turnAt: null, result: { winner: "boss", how: "resign" } });
}

/**
 * Where the battle stands: boards won, lost and drawn so far, whether every board is decided, and whether he's beaten
 * (every board won: all four must win; a draw is not a win).
 */
export function phase2Outcome(st: Phase2State): { won: number; lost: number; drawn: number; of: number; decided: boolean; beaten: boolean } {
  const won = st.boards.filter((b) => b.result?.winner === "crowd").length;
  const lost = st.boards.filter((b) => b.result?.winner === "boss").length;
  const drawn = st.boards.filter((b) => b.result?.winner === "draw").length;
  const of = st.boards.length;
  const decided = won + lost + drawn === of;
  return { won, lost, drawn, of, decided, beaten: decided && won === of };
}

/**
 * His brain in phase 2: Stockfish, always, at a fixed strength (RECLUSE_PHASE2), whatever BOSS_BRAIN says for him
 * (phase 1's `fixed` Maia), the player's rating, the difficulty or an admin's Brain picker. Maia can't play Chess960.
 */
export function phase2Brain(s: Pick<Phase2Settings, "elo" | "nodes" | "moveMs"> = RECLUSE_PHASE2): { brain: "stockfish"; elo: number; nodes: number; moveMs: number } {
  return { brain: "stockfish", elo: s.elo, nodes: s.nodes, moveMs: s.moveMs };
}

/** What his move needs of an engine: Stockfish at a strength, within a node and time budget (UciEngine.playAtElo). */
export interface Phase2Engine {
  playAtElo(fen: string, elo: number, nodes?: number, moveMs?: number): Promise<string>;
}

/** His move on a board (him to move): Stockfish's, at his strength, within his budget. Never Maia (it has no Chess960). */
export function phase2BossMove(engine: Phase2Engine, fen: string, s: Pick<Phase2Settings, "elo" | "nodes" | "moveMs"> = RECLUSE_PHASE2): Promise<string> {
  const b = phase2Brain(s);
  return engine.playAtElo(fen, b.elo, b.nodes, b.moveMs);
}

/**
 * The next board he moves on, from those where it's his move: the human's first (a phone stays responsive where
 * someone is watching the clock), then the one that has waited longest (`waiting`: board ids in the order they came).
 */
export function phase2Next(st: Phase2State, waiting: readonly number[], human: string): number | null {
  const ready = waiting.filter((id) => {
    const b = st.boards.find((x) => x.id === id);
    return !!b && phase2ToMove(b) === "boss";
  });
  return ready.find((id) => st.boards.find((b) => b.id === id)!.player === human) ?? ready[0] ?? null;
}
