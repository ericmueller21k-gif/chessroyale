import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { legalMoves, type UciEngine } from "@chessroyale/chess";
import { SoloMatch } from "../src/solo.ts";

/** A stand-in engine: its searches answer at once with the first legal moves. */
const engine = {
  topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
  scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
  topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
  playAtElo: async (fen: string) => legalMoves(fen)[0]!,
} as unknown as UciEngine;

describe("a refused move (solo)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    // (Maia's worker never answers: its loading step ends, then the boss plays Stockfish.)
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("leaves the turn's timeout running: a move the turn doesn't allow changes nothing, and the turn still ends on time", async () => {
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread" } as Settings);
    m.start();
    for (let i = 0; i < 120 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    const p = m.phase;
    if (p.kind !== "play") throw new Error(`no turn: ${p.kind}`);
    // The move the God King took back is barred this turn (the board never offers it; sent anyway).
    const barred = legalMoves(p.board.fen)[0]!;
    m.runner.state.boss!.barred = barred;
    m.submit(barred);
    await vi.advanceTimersByTimeAsync(0);
    expect(m.phase).toBe(p);
    // Out of time: the turn ends (scored as no move) as if nothing had been sent.
    await vi.advanceTimersByTimeAsync(p.deadline - Date.now() + m.settings.lateGraceMs + 50);
    expect(m.phase.kind).not.toBe("play");
    m.dispose();
  }, 30_000);
});
