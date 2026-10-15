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
import { chess960Fen, materialBest960 } from "../chess960.ts";
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
  /** Slow moves so far (anyone's, any board, longer than slowMoveSeconds), until his ultimate comes. */
  slow: number;
  /**
   * When his ultimate came (null: not yet): from then on every move has ultMoveSeconds, no bank; out of time, a random
   * legal move is played for that player (phase2Timeouts).
   */
  ultAt: number | null;
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
    slow: 0,
    ultAt: null,
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

const replace = (st: Phase2State, b: Phase2Board): Phase2State => ({ ...st, boards: st.boards.map((x) => (x.id === b.id ? b : x)) });

type UltSettings = Pick<Phase2Settings, "slowMoveSeconds" | "slowMovesForUlt" | "ultMoveSeconds">;

/** The time left for the player's move on a board at `now` (ms): their bank, or once his ultimate has come, the move's own few seconds. */
export function moveLeft(st: Pick<Phase2State, "ultAt">, b: Pick<Phase2Board, "bankMs" | "turnAt">, now: number, s: Pick<UltSettings, "ultMoveSeconds"> = RECLUSE_PHASE2): number {
  if (st.ultAt === null) return bankLeft(b, now);
  return b.turnAt === null ? s.ultMoveSeconds * 1000 : Math.max(0, s.ultMoveSeconds * 1000 - Math.max(0, now - b.turnAt));
}

/**
 * His ultimate comes at `now` (the team's slowMovesForUlt-th slow move, or the admins' trigger): every player whose
 * move it is starts their few seconds afresh now, however long they'd thought. Unchanged (the same object) once it has
 * come.
 */
export function phase2Ult(st: Phase2State, now: number): Phase2State {
  if (st.ultAt !== null) return st;
  return { ...st, ultAt: now, boards: st.boards.map((b) => (!b.result && b.turnAt !== null ? { ...b, turnAt: now } : b)) };
}

/**
 * A move on a board at `now`, by whoever's move it is there: the player's (their clock stops; out of time, the board is
 * lost and the move isn't played) or his (the player's clock starts). Unchanged (the same object) if the board is
 * decided or the move isn't legal there.
 */
export function phase2Move(st: Phase2State, boardId: number, move: string, now: number, s: UltSettings = RECLUSE_PHASE2): Phase2State {
  const b = st.boards.find((x) => x.id === boardId);
  const who = b ? phase2ToMove(b) : null;
  if (!b || !who || !legalMoves(b.board.fen).includes(move)) return st;
  if (who === "crowd") {
    const board = playOnBoard(b.board, move, 0.5);
    // (His ultimate: the bank is gone; the move's few seconds are checked by phase2Timeouts. No slow moves count now.)
    if (st.ultAt !== null) return replace(st, { ...b, board, turnAt: null, result: resultAfter(board) });
    const left = bankLeft(b, now);
    if (left <= 0) return replace(st, { ...b, bankMs: 0, turnAt: null, result: { winner: "boss", how: "time" } });
    const next = replace(st, { ...b, board, bankMs: left, turnAt: null, result: resultAfter(board) });
    // A slow move (longer than slowMoveSeconds): one more for the team; the slowMovesForUlt-th brings his ultimate.
    if (b.turnAt === null || now - b.turnAt <= s.slowMoveSeconds * 1000) return next;
    const slow = next.slow + 1;
    return slow >= s.slowMovesForUlt ? phase2Ult({ ...next, slow }, now) : { ...next, slow };
  }
  const board = playOnBoard(b.board, move, 0.5);
  const result = resultAfter(board);
  return replace(st, { ...b, board, turnAt: result ? null : now, result });
}

/** Every board whose player is out of time at `now` is lost on time. Unchanged (the same object) if none is. */
export function phase2Flags(st: Phase2State, now: number): Phase2State {
  // (Once his ultimate has come no flag falls: a move out of time is played at random instead, phase2Timeouts.)
  if (st.ultAt !== null) return st;
  if (!st.boards.some((b) => !b.result && b.turnAt !== null && bankLeft(b, now) <= 0)) return st;
  return { ...st, boards: st.boards.map((b) => (!b.result && b.turnAt !== null && bankLeft(b, now) <= 0 ? { ...b, bankMs: 0, turnAt: null, result: { winner: "boss", how: "time" } } : b)) };
}

/**
 * Once his ultimate has come: every player out of their few seconds at `now` has a random legal move played for them
 * (`rng` picks it, as Squads plays a missed move: never a loss on time). Unchanged (the same object) if nobody is.
 */
export function phase2Timeouts(st: Phase2State, now: number, rng: () => number, s: UltSettings = RECLUSE_PHASE2): Phase2State {
  if (st.ultAt === null) return st;
  let next = st;
  for (const b of st.boards) {
    if (phase2ToMove(b) !== "crowd" || b.turnAt === null || now - b.turnAt < s.ultMoveSeconds * 1000) continue;
    const legal = legalMoves(b.board.fen);
    next = phase2Move(next, b.id, legal[Math.min(legal.length - 1, Math.floor(rng() * legal.length))]!, now, s);
  }
  return next;
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

// ---------------- The driver's shared pieces (solo's Phase2Game and the lobby server's phase 2) ----------------

/**
 * His fall before the phase change and the phase change itself (ms), for the lobby server, which can't measure his frames:
 * the app works both out from them (packages/app/src/recluse-phase2.ts, PHASE_CHANGE), and a test there checks these
 * match. The clocks start once the change is over.
 */
export const PHASE2_FALL_MS = 1800;
export const PHASE2_CHANGE_MS = 15_840;

/** Every clock checked at `now`: before his ultimate a bank run out loses its board; after it, a move out of time is played at random. */
export function phase2Tick(st: Phase2State, now: number, rng: () => number, s: UltSettings = RECLUSE_PHASE2): Phase2State {
  return phase2Timeouts(phase2Flags(st, now), now, rng, s);
}

/**
 * When the next clock runs out (ms; null: no player's clock is running): the earliest bank to empty before his
 * ultimate, the earliest few seconds to end after it. phase2Tick at that time (or later) catches it.
 */
export function phase2Due(st: Phase2State, s: Pick<UltSettings, "ultMoveSeconds"> = RECLUSE_PHASE2): number | null {
  let at: number | null = null;
  for (const b of st.boards) {
    if (phase2ToMove(b) !== "crowd" || b.turnAt === null) continue;
    const t = st.ultAt !== null ? b.turnAt + s.ultMoveSeconds * 1000 : b.turnAt + b.bankMs;
    at = at === null ? t : Math.min(at, t);
  }
  return at;
}

/** What one change of the state brought (one move, a clock, a resign, his ultimate), for whatever drives it to act on. */
export interface Phase2Changes {
  /** Boards just decided. */
  results: number[];
  /** A slow move just made: on which board, and whether it was the one that brought his ultimate. */
  slow: { board: number; ult: boolean } | null;
  /** His ultimate just came. */
  ult: boolean;
  /** Boards that have just come to his move (each joins his queue once). */
  bossTurns: number[];
  /** Boards where a move was just played and it's the player's move now (a bot's turn to think). */
  crowdTurns: number[];
  /** Every board is decided now, and wasn't before. */
  done: boolean;
}

/** What changed from `before` to `next` (boards compared by identity: the rules replace only what they touch). */
export function phase2Changes(before: Phase2State, next: Phase2State): Phase2Changes {
  const out: Phase2Changes = { results: [], slow: null, ult: next.ultAt !== null && before.ultAt === null, bossTurns: [], crowdTurns: [], done: false };
  if (next === before) return out;
  if (next.slow > before.slow) {
    // (One move at a time changes the count: the board whose history grew.)
    const on = next.boards.find((b, i) => b.board.history.length > (before.boards[i]?.board.history.length ?? 0));
    if (on) out.slow = { board: on.id, ult: out.ult };
  }
  for (const b of next.boards) {
    const was = before.boards.find((x) => x.id === b.id);
    if (!was || was === b) continue;
    if (b.result && !was.result) out.results.push(b.id);
    const who = phase2ToMove(b);
    if (who === "boss" && phase2ToMove(was) !== "boss") out.bossTurns.push(b.id);
    if (who === "crowd" && b.board.history.length !== was.board.history.length) out.crowdTurns.push(b.id);
  }
  out.done = phase2Outcome(next).decided && !phase2Outcome(before).decided;
  return out;
}

/**
 * His queue after a change: boards that came to his move join the end (in the order they came), boards no longer
 * waiting for him (moved, decided) leave it. `phase2Next` picks from it.
 */
export function phase2Queue(waiting: readonly number[], st: Phase2State, changes?: Pick<Phase2Changes, "bossTurns">): number[] {
  const out = [...waiting, ...(changes?.bossTurns ?? []).filter((id) => !waiting.includes(id))];
  return out.filter((id) => {
    const b = st.boards.find((x) => x.id === id);
    return !!b && phase2ToMove(b) === "boss";
  });
}

/**
 * A bot's thinking for its move (its own clock running): a bullet player's while (`botMoveMs`), now and then longer
 * before his ultimate (`botSlowChance`, `botSlowMs`: a slow move, so his count comes from the bots too), a moment with
 * the test switch (`win`). `searchMs`: its search's budget (a slow one only waits longer: a shared engine isn't held up).
 */
export function phase2BotThink(rng: () => number, o: { ultCome: boolean; win?: boolean }, s: Pick<Phase2Settings, "botSlowChance" | "botSlowMs" | "botMoveMs"> = RECLUSE_PHASE2): { thinkMs: number; searchMs: number } {
  const slow = !o.ultCome && !o.win && rng() < s.botSlowChance;
  const [lo, hi] = slow ? s.botSlowMs : s.botMoveMs;
  const think = lo + rng() * (hi - lo);
  return { thinkMs: o.win ? 300 : think, searchMs: Math.min(think, s.botMoveMs[1]) };
}

/**
 * The last resort, when no device can play a move (DECISIONS.md, "The Hidden Boss's phase 2 online"): a quick search
 * of material two moves deep, no engine. A mate in one is taken; otherwise the move that keeps the most material against
 * the reply that hurts most (a mate against it counts as the worst; a stalemate as even), ties picked at random. It never
 * hangs a piece to a capture or walks into a mate in one, and takes what's left loose, so it doesn't give a board away
 * as a random move would; it's far weaker than his brain, so it doesn't make him stronger either. Null: no legal move.
 */
export function phase2FallbackMove(fen: string, rng: () => number = Math.random): string | null {
  const legal = legalMoves(fen);
  if (!legal.length) return null;
  // (The search writes castling as the king taking its rook, as the rules do for a Chess960 board; anything the rules
  // wouldn't take is dropped, and with nothing left any legal move goes.)
  const best = materialBest960(fen).filter((m) => legal.includes(m));
  const from = best.length ? best : legal;
  return from[Math.min(from.length - 1, Math.floor(rng() * from.length))]!;
}
