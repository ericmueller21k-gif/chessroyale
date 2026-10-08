import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, MATCHMAKING, RAID_SETTINGS, modeSettings, type Settings } from "@chessroyale/core";
import { SoloMatch } from "../src/solo.ts";

/**
 * Solo (Matchmaking → Solo): the queue screen fills with the match's own bots, a few at a time, then the match begins.
 * A Solo raid has bots in its crowd; Boss alone is you against the boss.
 */

const crowd: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: true, augments: true }) };

describe("Solo's fill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // (Starting a match wakes the engine server: nothing to wake here.)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("you first, then the bots who'll play pop in over the fill time, never backwards; full for a moment; then the match", () => {
    const m = new SoloMatch([], "Ann", crowd);
    const counts: number[] = [];
    m.subscribe(() => counts.push(m.players.length));
    m.fill();
    expect(m.phase.kind).toBe("lobby");
    expect(m.queueType).toBe("solo");
    expect(m.players.map((p) => p.id)).toEqual(["you"]);
    vi.advanceTimersByTime(MATCHMAKING.soloFillMs / 2);
    const half = m.players.length;
    expect(half).toBeGreaterThan(20);
    expect(half).toBeLessThan(80);
    vi.advanceTimersByTime(MATCHMAKING.soloFillMs / 2 + 100);
    // All 100 seats: you and the 99 bots of the match itself (same ids and names).
    expect(m.players).toHaveLength(100);
    expect(m.filledAt).not.toBeNull();
    const bots = m.runner.state.players.filter((p) => p.isBot);
    expect(m.players.slice(1).map((p) => [p.id, p.name])).toEqual(bots.map((p) => [p.id, p.name]));
    expect(m.players.slice(1).every((p) => p.isBot)).toBe(true);
    // The count only ever climbs, a few at a time (each pop has its moment).
    for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
    expect(new Set(counts).size).toBeGreaterThan(15);
    // Still the full queue screen for the hold, then the pre-game vote.
    expect(m.phase.kind).toBe("lobby");
    vi.advanceTimersByTime(MATCHMAKING.soloHoldMs);
    expect(m.phase.kind).toBe("vote");
    expect(m.ranked).toBe(false);
    m.dispose();
  });

  it("a Solo raid: you and 49 bots in the crowd; Boss alone: just you", () => {
    const raid = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600 } as Settings;
    const solo = new SoloMatch([], "Ann", raid, false, true);
    solo.fill();
    vi.advanceTimersByTime(MATCHMAKING.soloFillMs + 100);
    expect(solo.players).toHaveLength(50);
    expect(solo.runner.state.players.filter((p) => p.isBot)).toHaveLength(49);
    solo.dispose();
    const alone = new SoloMatch([], "Ann", raid);
    alone.start();
    expect(alone.runner.state.players).toHaveLength(1);
    alone.dispose();
  });

  it("Cancel while it fills: nothing more happens", () => {
    const m = new SoloMatch([], "Ann", crowd);
    m.fill();
    vi.advanceTimersByTime(500);
    m.dispose();
    const n = m.players.length;
    vi.advanceTimersByTime(10_000);
    expect(m.players.length).toBe(n);
    expect(m.phase.kind).toBe("lobby");
  });
});
