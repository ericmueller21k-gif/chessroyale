import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_BRAIN, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, bossBrainFor, isPlayable, maiaRatingFor, type Settings } from "@chessroyale/core";
import { isAdmin, maiaAllowed, maiaLikely, soloBrain } from "../src/boss-brain.ts";
import { SoloMatch } from "../src/solo.ts";

/**
 * Maia for players (BOSS_BRAIN.forPlayers, the one value; DECISIONS.md, "Every boss on Maia", Oct 12): on, a player's
 * device (not an admin's) plays every boss on Maia by the same rule as an admin's, with no admin's pick; off, it never
 * loads Maia. The value itself is set in settings.ts; these switch it for the test only.
 */
const raid = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, ...patch }) as Settings;

/** Workers started (their scripts' URLs): Maia's, here. A worker that never answers: Maia stays "loading". */
let workers: string[] = [];
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  constructor(url: string) {
    workers.push(url);
  }
  postMessage() {}
  terminate() {}
}

const shipped = BOSS_BRAIN.forPlayers;
const setForPlayers = (on: boolean) => ((BOSS_BRAIN as { forPlayers: boolean }).forPlayers = on);

describe("Maia for players (BOSS_BRAIN.forPlayers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    workers = [];
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  });
  afterEach(() => {
    setForPlayers(shipped);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("on: a player's device may run Maia (and fetch it ahead for a boss under Stockfish's start), with no admin's pick", () => {
    setForPlayers(true);
    expect(isAdmin()).toBe(false);
    expect(maiaAllowed()).toBe(true);
    expect(soloBrain(true)).toEqual({ picked: "", maia: true });
    expect(soloBrain(false)).toEqual({ picked: "", maia: true });
    expect(maiaLikely([1500])).toBe(true);
    expect(maiaLikely([BOSS_BRAIN.stockfishFrom])).toBe(false);
  });

  it("on, Boss alone: every playable boss plays Maia at the rule's rating for one player, as an admin's would", () => {
    setForPlayers(true);
    for (const b of BOSS_ROSTER.filter(isPlayable)) {
      workers = [];
      const m = new SoloMatch([], "Ann", raid({ bossId: b.id }));
      m.start();
      const boss = m.runner.state.boss!;
      expect(boss.id).toBe(b.id);
      // (The admin's plan: the same function, Maia allowed, no pick, one player.)
      const plan = bossBrainFor(b.id, boss.elo, "", true, { crowd: false });
      expect(plan.brain, b.id).not.toBe("stockfish");
      expect(plan.rating).toBe(maiaRatingFor(boss.elo));
      expect(m.runner.humanBrain, b.id).toMatchObject({ brain: plan.brain, rating: plan.rating });
      expect(workers, b.id).toEqual(["/engine/maia/maia-worker.js"]);
      // (No admin's debug line for a player.)
      expect(m.brainLine).toBeNull();
      m.dispose();
    }
  });

  it("on, a Solo raid: the crowd's margin; in the bridge band, the guard and Stockfish's share as for an admin", () => {
    setForPlayers(true);
    const crowd = new SoloMatch([], "Ann", raid({ bossId: "gingerbread" }), false, true);
    crowd.start();
    const elo = crowd.runner.state.boss!.elo;
    expect(crowd.runner.humanBrain).toMatchObject({ brain: "maia-raw", rating: maiaRatingFor(elo + BOSS_BRAIN.crowdMargin) });
    crowd.dispose();
    const strong = new SoloMatch([], "Ann", raid({ bossId: "gingerbread", bossFixedElo: 2700 }), false, true);
    strong.start();
    const top = strong.runner.state.boss!;
    const plan = bossBrainFor("gingerbread", top.elo, "", true, { crowd: true });
    expect(plan.stockfishShare).toBeGreaterThan(0);
    expect(strong.runner.humanBrain).toMatchObject({ brain: plan.brain, rating: plan.rating, stockfishShare: plan.stockfishShare });
    strong.dispose();
  });

  it("off: a player meets Stockfish and nothing of Maia's loads", () => {
    setForPlayers(false);
    expect(maiaAllowed()).toBe(false);
    expect(maiaLikely([1500])).toBe(false);
    const m = new SoloMatch([], "Ann", raid({ bossId: "gingerbread" }));
    m.start();
    expect(m.runner.state.boss).toBeTruthy();
    expect(m.runner.humanBrain).toBeNull();
    expect(workers).toEqual([]);
    m.dispose();
  });
});
