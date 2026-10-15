import { describe, expect, it } from "vitest";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { chess960Fen, legalMoves, phase2Numbers, type NetPhase2 } from "@chessroyale/chess";
import { localPhase2, phase2MoveFor, simulFromNet, stillPending } from "../src/net-phase2.ts";

/** The Hidden Boss's phase 2 online on a device (net-phase2.ts): the lobby's boards as the screens see them, and your move. */

const T0 = 5_000_000;
function lobbyPhase2(over: Partial<NetPhase2> = {}): NetPhase2 {
  const numbers = phase2Numbers(11);
  return {
    stage: "play",
    at: T0,
    from: chess960Fen(518),
    slow: 0,
    lastSlow: null,
    ultAt: null,
    boards: ["b1", "p7", "b2", "p9"].map((player, id) => ({
      id,
      player,
      name: player === "p7" ? "Ann" : player === "p9" ? "Bo" : `Bot ${id}`,
      number: numbers[id]!,
      fen: chess960Fen(numbers[id]!),
      lastMove: null,
      history: [],
      bankMs: RECLUSE_PHASE2.bankSeconds * 1000,
      turnAt: T0,
      toMove: "crowd" as const,
      result: null,
    })),
    ...over,
  };
}

describe("phase 2 online on this device: the lobby's boards", () => {
  it("your board first, named You (the screens put the first where yours goes); a watcher's in the lobby's order", () => {
    const v = simulFromNet(lobbyPhase2(), "p9", null);
    expect(v.boards.map((b) => b.id)).toEqual([3, 0, 1, 2]);
    expect(v.boards[0]).toMatchObject({ you: true, name: "You" });
    expect(v.boards.slice(1).map((b) => b.name)).toEqual(["Bot 0", "Ann", "Bot 2"]);
    const watcher = simulFromNet(lobbyPhase2(), "p3", null);
    expect(watcher.boards.map((b) => b.id)).toEqual([0, 1, 2, 3]);
    expect(watcher.boards.some((b) => b.you)).toBe(false);
  });

  it("the phase change shows no clock running; the counts follow the boards' results (all four must be won)", () => {
    const change = simulFromNet(lobbyPhase2({ stage: "change" }), "p7", null);
    expect(change.playing).toBe(false);
    expect(change.boards.every((b) => b.turnAt === null && b.toMove === null)).toBe(true);
    const p = lobbyPhase2();
    p.boards = p.boards.map((b, i) => ({ ...b, toMove: null, turnAt: null, result: { winner: i === 2 ? "draw" : "crowd", how: i === 2 ? "draw" : "mate" } }));
    expect(simulFromNet(p, "p7", null)).toMatchObject({ won: 3, drawn: 1, lost: 0, of: 4, decided: true, beaten: false });
  });

  it("server times are made local as they come", () => {
    const p = localPhase2(lobbyPhase2({ ultAt: T0 + 10, lastSlow: { board: 1, at: T0 + 5 } }), (t) => t - 1000);
    expect(p.at).toBe(T0 - 1000);
    expect(p.ultAt).toBe(T0 - 990);
    expect(p.lastSlow).toEqual({ board: 1, at: T0 - 995 });
    expect(p.boards.every((b) => b.turnAt === T0 - 1000)).toBe(true);
  });

  it("your move: only on your board, at your move, legal; shown at once (your clock stopped) until the lobby's boards move on", () => {
    const p = lobbyPhase2();
    const legal = legalMoves(p.boards[1]!.fen);
    expect(phase2MoveFor(p, "p7", 0, legalMoves(p.boards[0]!.fen)[0]!, T0 + 1000)).toBeNull();
    expect(phase2MoveFor(p, "p7", 1, "a1a1", T0 + 1000)).toBeNull();
    expect(phase2MoveFor({ ...p, stage: "change" }, "p7", 1, legal[0]!, T0 + 1000)).toBeNull();
    const m = phase2MoveFor(p, "p7", 1, legal[0]!, T0 + 3000)!;
    expect(m.send).toEqual({ t: "p2Move", board: 1, ply: 0, move: legal[0] });
    expect(m.pending.bankMs).toBe(RECLUSE_PHASE2.bankSeconds * 1000 - 3000);
    const v = simulFromNet(p, "p7", m.pending);
    expect(v.boards[0]).toMatchObject({ id: 1, history: [legal[0]], lastMove: legal[0], toMove: "boss", turnAt: null, bankMs: RECLUSE_PHASE2.bankSeconds * 1000 - 3000 });
    // The lobby's next boards have it: it isn't pending any more.
    const moved = { ...p, boards: p.boards.map((b) => (b.id === 1 ? { ...b, history: [legal[0]!], toMove: "boss" as const, turnAt: null } : b)) };
    expect(stillPending(p, m.pending)).toBe(true);
    expect(stillPending(moved, m.pending)).toBe(false);
  });
});
