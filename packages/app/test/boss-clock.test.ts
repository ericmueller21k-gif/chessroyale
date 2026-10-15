import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { bulletIncrementAt, legalMoves, type UciEngine } from "@chessroyale/chess";
import { HUMAN, SoloMatch } from "../src/solo.ts";
import { COUNT_FROM_SECONDS } from "../src/components/Countdown.tsx";
import { DOCK_PLUS_MS, clockLeft } from "../src/components/BossDock.tsx";
import { clockShown } from "../src/clock-text.ts";

/** Whether this device's profile says admin (Engine move and the Hidden Boss are admins'). */
vi.mock("../src/account.ts", async (orig) => {
  const real = await orig<typeof import("../src/account.ts")>();
  return { ...real, account: () => ({ ...real.account(), profile: { admin: true } as never }) };
});

/** The big 3-2-1 as the play screen shows it (Play.tsx: `ending`): the number on screen at `now`, or null. */
const countdown = (phase: { deadline: number }, now: number): number | null => {
  const secs = Math.ceil((phase.deadline - now) / 1000);
  return phase.deadline > 0 && secs > 0 && secs <= COUNT_FROM_SECONDS ? secs : null;
};

/** A stand-in engine: its searches answer at once with the first legal moves (as Engine move does on a fast phone). */
const engine = {
  topMoves: async (fen: string, n: number) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
  scoreMoves: async (_fen: string, moves: string[]) => moves.map((move) => ({ move, expected: 0.5 })),
  topMovesAt: async (fen: string) => legalMoves(fen).slice(0, 1).map((move) => ({ move, expected: 0.5 })),
  playAtElo: async (fen: string) => legalMoves(fen)[0]!,
} as unknown as UciEngine;

/** Boss alone against the Hidden Boss, his bullet clock from turn 2 (the test switch, as ?power=bullet). */
function hiddenBoss() {
  const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "recluse", bossHidden: true, bossPowerTest: "bullet" } as Settings);
  m.start();
  return m;
}
const bank = (m: SoloMatch) => m.runner.player(HUMAN).bankMs;

describe("the dock's clock and the big 3-2-1 (Eric's playtest, Oct 15: \"just the big one popped up\")", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    vi.stubGlobal("location", { search: "" });
    // (Maia's worker never answers: its loading step ends at BOSS_BRAIN.loadGateMs, then the boss plays Stockfish.)
    vi.stubGlobal("Worker", class { onmessage = null; onerror = null; postMessage() {} terminate() {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("never counts early: Engine move spammed at every moment of the bullet clock (1+0, then 1+2), each turn's clock is the bank plus the increment, and the count shows only in its last 3 s", async () => {
    const m = hiddenBoss();
    for (let i = 0; i < 120 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    let turns = 0;
    let lastPly = -1;
    // (This turn's time as the bank says it, worked out apart from the phase's deadline: the bank and the increment.)
    let timeAtStart: number | null = null;
    let rng = 7;
    const rand = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let step = 0; step < 6000 && turns < 30; step++) {
      const p = m.phase;
      if (p.kind === "play") {
        if (p.board.ply !== lastPly) {
          lastPly = p.board.ply;
          turns++;
          const powers = m.boss?.powers;
          const inc = powers?.ultAt != null ? bulletIncrementAt(powers.turn, powers.ultAt) : null;
          timeAtStart = inc === null ? null : bank(m) + inc * 1000;
          // (On the bullet clock: the whole bank, plus the increment once he has added it.)
          if (timeAtStart !== null) expect(p.deadline - p.startsAt, `turn ${turns}`).toBe(timeAtStart);
        }
        // The big count only ever shows in the bank's own last 3 s.
        if (countdown(p, Date.now()) !== null && timeAtStart !== null) expect(timeAtStart - (Date.now() - p.startsAt)).toBeLessThanOrEqual(COUNT_FROM_SECONDS * 1000);
        // A tap now and then, at any moment of the turn (and between turns, when the button is grayed out).
        if (rand() < 0.3) m.engineMove();
      } else if (rand() < 0.2) m.engineMove();
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(turns).toBeGreaterThanOrEqual(10);
    m.dispose();
  }, 60_000);

  it("what Eric saw: the three 1+0 moves empty the bank, so the first 1+2 turn starts inside the count (one big number at once, then the instant Engine move); the dock's clock reads that same number, and each instant move after rebuilds the bank", async () => {
    const m = hiddenBoss();
    for (let i = 0; i < 120 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(500);
    const yourMove = async () => {
      for (let i = 0; i < 400 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(50);
      expect(m.phase.kind).toBe("play");
    };
    const engineMove = async () => {
      m.engineMove();
      await vi.advanceTimersByTimeAsync(0);
    };
    // Turn 1, then the bullet clock from turn 2: 60 s, its first 3 moves adding nothing.
    await engineMove();
    await yourMove();
    expect(bank(m)).toBe(BOSS_POWERS.bulletBankSeconds * 1000);
    // Three long thinks (19.7 s each, as a player thinking through bullet with no increment): 0.9 s left.
    for (let i = 0; i < BOSS_POWERS.bulletPlainMoves; i++) {
      await yourMove();
      await vi.advanceTimersByTimeAsync(19_700);
      await engineMove();
    }
    // The increment comes ("+2 s a move from now on"): this turn's clock is what was left plus 2 s, 2.9 s.
    await yourMove();
    const p = m.phase as Extract<typeof m.phase, { kind: "play" }>;
    expect(p.deadline - p.startsAt).toBe(900 + BOSS_POWERS.bulletIncrementSeconds * 1000);
    // On the turn's very first frame the big count is already showing: a lone "3" (never the 3-2-1 build-up).
    expect(countdown(p, p.startsAt)).toBe(3);
    // The dock's clock says the same, in the same rounding ("0:03"; the old dock line floored it: "0:02 left").
    expect(clockShown(clockLeft(p, p.startsAt))).toBe("0:03");
    // And it shows the "+2" as this move begins.
    expect(Date.now() - p.startsAt).toBeLessThan(DOCK_PLUS_MS);
    // The instant Engine move: the number is gone a moment later, and he didn't lose on time.
    await vi.advanceTimersByTimeAsync(100);
    await engineMove();
    expect(m.phase.kind).not.toBe("play");
    await yourMove();
    expect(m.runner.bossTimedOut).toBeFalsy();
    // Each instant move from here banks nearly the whole 2 s: about +1.9 s a turn (Eric's 0:20 by move 20).
    const before = bank(m);
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(100);
      await engineMove();
      await yourMove();
    }
    const gained = bank(m) - before;
    expect(gained).toBeGreaterThan(5 * (BOSS_POWERS.bulletIncrementSeconds * 1000 - 200));
    expect(gained).toBeLessThan(5 * BOSS_POWERS.bulletIncrementSeconds * 1000);
    m.dispose();
  }, 60_000);
});

describe("the dock's clock: what it shows", () => {
  it("counts in whole seconds rounded up, as the big 3-2-1 does: its \"1\" is 0:01, never 0:00", () => {
    expect(clockShown(60_000)).toBe("1:00");
    expect(clockShown(59_001)).toBe("1:00");
    expect(clockShown(2_050)).toBe("0:03");
    expect(clockShown(1)).toBe("0:01");
    expect(clockShown(0)).toBe("0:00");
    expect(clockShown(83_400)).toBe("1:24");
    for (let ms = 1; ms <= 3000; ms += 37) expect(clockShown(ms)).toBe(`0:0${countdown({ deadline: ms }, 0)}`);
  });

  it("runs from its start to its deadline, full until it starts, and stands still while frozen (the God King's strike)", () => {
    const run = { startsAt: 1_000, deadline: 21_000 };
    expect(clockLeft(run, 0)).toBe(20_000);
    expect(clockLeft(run, 6_000)).toBe(15_000);
    expect(clockLeft(run, 30_000)).toBe(0);
    const frozen = { ...run, deadline: 24_000, frozen: { at: 5_000, until: 8_000 } };
    expect(clockLeft(frozen, 5_000)).toBe(16_000);
    expect(clockLeft(frozen, 7_000)).toBe(16_000);
    expect(clockLeft(frozen, 9_000)).toBe(15_000);
  });
});
