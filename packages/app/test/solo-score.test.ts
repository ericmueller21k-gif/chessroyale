import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_CLOCK, DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
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
    // (Boss alone with the raid's short clock, as a test link's ?clock= gives it, so the turn ends in seconds.)
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread", bossAloneClock: false } as Settings);
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

describe("Boss alone plays on Boss Battle's clock, 10 + 10 (Eric, Oct 30: \"10 min + 10 per move\" for every boss)", () => {
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

  const turn = async (m: SoloMatch) => {
    for (let i = 0; i < 120 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    const p = m.phase;
    if (p.kind !== "play") throw new Error(`no turn: ${p.kind}`);
    return p;
  };

  it("the first move has the bank and its increment (10:10); what a move doesn't use stays, and the next adds 10 s", async () => {
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread", lastStandFrom: 999 } as Settings);
    m.start();
    const p = await turn(m);
    expect(BOSS_CLOCK).toEqual({ bankSeconds: 600, incrementSeconds: 10 });
    expect(p.deadline - p.startsAt).toBe((600 + 10) * 1000);
    expect(m.settings.bossClock).toBe(true);
    const ply = m.runner.boardOf("you")!.history.length;
    await vi.advanceTimersByTimeAsync(5_000);
    m.submit(legalMoves(p.board.fen)[0]!);
    for (let i = 0; i < 60 && m.runner.boardOf("you")!.history.length < ply + 2; i++) await vi.advanceTimersByTimeAsync(500);
    const q = await turn(m);
    // 600 + 10 - 5 left after the first, then 10 more as the second begins.
    expect(Math.abs(q.deadline - q.startsAt - (600 + 10 - 5 + 10) * 1000)).toBeLessThan(600);
    m.dispose();
  }, 30_000);

  it("out of time loses: the move isn't played and the boss wins on time", async () => {
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread", lastStandFrom: 999 } as Settings);
    m.start();
    const p = await turn(m);
    const ply = m.runner.boardOf("you")!.history.length;
    await vi.advanceTimersByTimeAsync(p.deadline - Date.now() + m.settings.lateGraceMs + 50);
    for (let i = 0; i < 60 && !m.runner.boss?.result; i++) await vi.advanceTimersByTimeAsync(500);
    expect(m.runner.boss?.result).toBe("boss");
    expect(m.runner.bossTimedOut).toBe(true);
    expect(m.runner.boardOf("you")!.history).toHaveLength(ply);
    m.dispose();
  }, 30_000);

  it("a test link's clock (bossAloneClock off) keeps the raid's clock", async () => {
    const clocked = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread", bossAloneClock: false } as Settings);
    clocked.start();
    const p = await turn(clocked);
    expect(p.deadline - p.startsAt).toBe(RAID_SETTINGS.moveClockSeconds! * 1000);
    expect(clocked.settings.bossClock).toBeFalsy();
    clocked.dispose();
  }, 30_000);

  it("no boss strikes (Eric, Oct 31): past the strike's move count, nobody struck and no count to one; a Solo raid keeps them", async () => {
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread", lastStandFrom: 999, bossKillEvery: 1 } as Settings);
    expect(m.settings.bossNoStrikes).toBe(true);
    m.start();
    for (let t = 0; t < 3; t++) {
      const p = await turn(m);
      expect(m.runner.bossView()!.strikeIn).toBeNull();
      const ply = m.runner.boardOf("you")!.history.length;
      m.submit(legalMoves(p.board.fen)[0]!);
      for (let i = 0; i < 60 && m.runner.boardOf("you")!.history.length < ply + 2; i++) await vi.advanceTimersByTimeAsync(500);
    }
    expect(m.runner.boss!.kills).toEqual([]);
    expect(m.runner.bossKillDue()).toBe(false);
    m.dispose();
    const raid = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread" } as Settings, false, true);
    expect(raid.settings.bossNoStrikes).toBeFalsy();
    raid.dispose();
  }, 30_000);

  it("a Solo raid (with bots) keeps the raid's clock", () => {
    const raid = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "gingerbread" } as Settings, false, true);
    expect(raid.settings.bossClock).toBeFalsy();
    expect(raid.settings.moveClockSeconds).toBe(RAID_SETTINGS.moveClockSeconds);
    raid.dispose();
  });
});
