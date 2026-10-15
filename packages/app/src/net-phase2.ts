import { applyMove, legalMoves, phase2BossMove, type NetPhase2, type ServerMessage, type UciEngine } from "@chessroyale/chess";
import type { SimulBoardView, SimulView } from "./game.ts";

/**
 * The Hidden Boss's phase 2 online, on this device (the lobby runs it: packages/server/src/bosses/recluse-phase2.ts):
 * the screens' view of the lobby's boards, and the moves this device makes for the lobby when it's the host.
 */

/** Your move on your board, sent and not yet back from the lobby: shown at once (it doesn't snap back meanwhile). */
export interface Phase2Pending {
  board: number;
  /** The moves on the board before it. */
  ply: number;
  move: string;
  /** Your bank as you moved (ms). */
  bankMs: number;
}

/** Phase 2 with its times made local (as each message's are, when it comes). */
export function localPhase2(p: NetPhase2, local: (t: number) => number): NetPhase2 {
  return {
    ...p,
    at: local(p.at),
    ...(p.until !== undefined ? { until: local(p.until) } : {}),
    lastSlow: p.lastSlow && { board: p.lastSlow.board, at: local(p.lastSlow.at) },
    ultAt: p.ultAt === null ? null : local(p.ultAt),
    boards: p.boards.map((b) => ({ ...b, turnAt: b.turnAt === null ? null : local(b.turnAt) })),
  };
}

/** Whether a move sent is still to come back: its board hasn't moved on from where you moved. */
export function stillPending(p: NetPhase2, pending: Phase2Pending | null): boolean {
  const b = pending && p.boards.find((x) => x.id === pending.board);
  return !!b && !b.result && b.history.length === pending!.ply && b.toMove === "crowd";
}

/**
 * Phase 2 as the screens see it (game.ts, SimulView; solo builds the same from its own boards): your board first (the
 * screens put the first where yours goes; a watcher's are in the lobby's order), named "You", your move sent shown.
 */
export function simulFromNet(p: NetPhase2, me: string | null, pending: Phase2Pending | null): SimulView {
  const playing = p.stage !== "change";
  const boards: SimulBoardView[] = p.boards.map((b) => {
    const view: SimulBoardView = {
      id: b.id,
      you: b.player === me,
      name: b.player === me ? "You" : b.name,
      number: b.number,
      fen: b.fen,
      lastMove: b.lastMove,
      history: b.history,
      ...(b.bases ? { bases: b.bases } : {}),
      bankMs: b.bankMs,
      turnAt: playing ? b.turnAt : null,
      toMove: playing ? b.toMove : null,
      result: b.result,
    };
    if (!pending || pending.board !== b.id || !stillPending(p, pending)) return view;
    return { ...view, fen: applyMove(b.fen, pending.move), lastMove: pending.move, history: [...b.history, pending.move], bankMs: pending.bankMs, turnAt: null, toMove: "boss" };
  });
  boards.sort((a, b) => (a.you === b.you ? a.id - b.id : a.you ? -1 : 1));
  const won = boards.filter((b) => b.result?.winner === "crowd").length;
  const lost = boards.filter((b) => b.result?.winner === "boss").length;
  const drawn = boards.filter((b) => b.result?.winner === "draw").length;
  const of = boards.length;
  const decided = won + lost + drawn === of;
  return { from: p.from, boards, playing, won, lost, drawn, of, decided, beaten: decided && won === of, slow: p.slow, lastSlow: p.lastSlow, ultAt: p.ultAt };
}

/** Your move on your board, if it's yours to make now and legal there: what to send, and what to show meanwhile. */
export function phase2MoveFor(p: NetPhase2, me: string | null, boardId: number, move: string, now: number): { send: Extract<import("@chessroyale/chess").ClientMessage, { t: "p2Move" }>; pending: Phase2Pending } | null {
  const b = p.boards.find((x) => x.id === boardId);
  if (p.stage !== "play" || !b || b.player !== me || b.result || b.toMove !== "crowd" || b.turnAt === null || !legalMoves(b.fen).includes(move)) return null;
  const bankMs = p.ultAt !== null ? b.bankMs : Math.max(0, b.bankMs - Math.max(0, now - b.turnAt));
  return { send: { t: "p2Move", board: b.id, ply: b.history.length, move }, pending: { board: b.id, ply: b.history.length, move, bankMs } };
}

/**
 * A move the lobby asked this device for (it's the host): his on a board (Stockfish at his strength, within his budget,
 * on the first engine, as solo's one engine for him), or a bot finalist's (on the last engine, as solo's bots; the test
 * switch's: its best move).
 */
export async function phase2HostMove(engines: readonly UciEngine[], q: Extract<ServerMessage, { t: "p2Request" }>): Promise<string> {
  if (!q.bot) return phase2BossMove(engines[0]!, q.fen, { elo: q.elo, nodes: q.nodes, moveMs: q.moveMs });
  const e = engines[engines.length - 1]!;
  if (q.best) return (await e.topMoves(q.fen, 1))[0]?.move ?? legalMoves(q.fen)[0]!;
  return e.playAtElo(q.fen, q.elo, q.nodes, q.moveMs);
}
