import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CROWD_SETTINGS, DEFAULT_SETTINGS, type Settings } from "@chessroyale/core";
import { legalMoves, type UciEngine } from "@chessroyale/chess";
import { loadOpenings, SoloMatch } from "../src/solo.ts";

// (The opening library is its own chunk, loaded on first use: solo.ts.)
beforeAll(() => loadOpenings());

/** A stand-in engine: every move as good as any other, at once. */
const engine = {
  topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
  scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
  topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
  playAtElo: async (fen: string) => legalMoves(fen)[0]!,
} as unknown as UciEngine;

/**
 * The 50 v 50 rework (C3) in solo, cut: nothing may wait on you (PR #764's CI: account.spec's guest match, missing every move, sat
 * watching past its 3 minutes once a cut player watched the bots' game at watch pace). Not tapping Spectate plays the rest out at
 * once to the results and the podium; tapping it watches to the end, which still comes by itself. One move a stage (as a test's
 * ?rounds=2), the game to move 10, no votes, misses as before the AFK rule (you sink and are cut, never removed).
 */
describe("a cut player in a solo 50 v 50 (the rework, C3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, stageRounds: [], firstStageRounds: 2, roundsPerStage: 2, augments: false, crowdMoveLimit: 10, crowdMisses: undefined } as Settings;

  /** Plays (never picking) until you're cut: the cut screen with you out. */
  const toYourCut = async (m: SoloMatch) => {
    for (let i = 0; i < 2000; i++) {
      const p = m.phase;
      if (p.kind === "stageBreak" && p.youOut) return;
      if (p.kind === "results") throw new Error("results before your cut");
      await vi.advanceTimersByTimeAsync(500);
    }
    throw new Error(`never cut: ${m.phase.kind}`);
  };
  const seen = async (m: SoloMatch, maxMs: number) => {
    const kinds = new Set<string>();
    for (let t = 0; t < maxMs && m.phase.kind !== "results"; t += 500) {
      kinds.add(m.phase.kind);
      await vi.advanceTimersByTimeAsync(500);
    }
    return kinds;
  };

  it("not tapping Spectate: the rest is played out at once, then the results with the podium", async () => {
    const m = new SoloMatch([engine], "Ann", settings);
    m.start();
    await toYourCut(m);
    // (The break, then the rest at once: well inside a minute of the game's clock, never a turn to watch.)
    const kinds = await seen(m, 60_000);
    expect(m.phase.kind).toBe("results");
    expect(kinds.has("watching")).toBe(false);
    expect(m.phase.kind === "results" && m.phase.podium).toBeTruthy();
    expect(m.standings().every((s) => s.placement !== null)).toBe(true);
    m.dispose();
  }, 60_000);

  it("tapping Spectate: the game is watched move by move, and its end still brings the results by itself", async () => {
    const m = new SoloMatch([engine], "Ann", settings);
    m.start();
    await toYourCut(m);
    m.spectate();
    expect(m.spectateAsked).toBe(true);
    const kinds = await seen(m, 20 * 60_000);
    expect(kinds.has("watching")).toBe(true);
    expect(m.phase.kind).toBe("results");
    expect(m.phase.kind === "results" && m.phase.podium).toBeTruthy();
    m.dispose();
  }, 120_000);
});
