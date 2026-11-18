import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOSS_POWERS, DASH_STALL, DEFAULT_SETTINGS, RAID_SETTINGS, bossClockSettings, type Settings } from "@chessroyale/core";
import { bulletIncrementAt, legalMoves, stallTimeline, type UciEngine } from "@chessroyale/chess";
import { HUMAN, loadOpenings, SoloMatch } from "../src/solo.ts";
import { COUNT_FROM_SECONDS } from "../src/components/Countdown.tsx";
import { DOCK_PLUS_MS, clockLeft } from "../src/components/BossDock.tsx";
import { clockShown } from "../src/clock-text.ts";

// (The opening library is its own chunk, loaded on first use: solo.ts.)
beforeAll(() => loadOpenings());

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

  it("what Eric saw (at 1+2, Oct 15): the three 1+0 moves empty the bank, then the first turn with the increment (1+10 since Nov 16: it starts above the count, which comes at its end); the dock's clock reads the count's number, and each instant move after rebuilds the bank", async () => {
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
    // The increment comes ("+10 s a move from now on"): this turn's clock is what was left plus the increment, 10.9 s.
    await yourMove();
    const p = m.phase as Extract<typeof m.phase, { kind: "play" }>;
    const INC = BOSS_POWERS.bulletIncrementSeconds * 1000;
    expect(p.deadline - p.startsAt).toBe(900 + INC);
    // On the turn's first frame: the big count only if it starts inside it (it did at 1+2: a lone "3", never the 3-2-1 build-up).
    const first = Math.ceil((900 + INC) / 1000);
    expect(countdown(p, p.startsAt)).toBe(first <= COUNT_FROM_SECONDS ? first : null);
    expect(clockShown(clockLeft(p, p.startsAt))).toBe(clockShown(900 + INC));
    // At its end the count and the dock's clock say the same, in the same rounding ("0:03"; the old dock line floored it: "0:02 left").
    expect(countdown(p, p.deadline - 2500)).toBe(3);
    expect(clockShown(clockLeft(p, p.deadline - 2500))).toBe("0:03");
    // And it shows the "+10" as this move begins.
    expect(Date.now() - p.startsAt).toBeLessThan(DOCK_PLUS_MS);
    // The instant Engine move: the number is gone a moment later, and he didn't lose on time.
    await vi.advanceTimersByTimeAsync(100);
    await engineMove();
    expect(m.phase.kind).not.toBe("play");
    await yourMove();
    expect(m.runner.bossTimedOut).toBeFalsy();
    // Each instant move from here banks nearly the whole increment.
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

describe("Dash's stall skit in solo (Eric, Nov 17: once a battle)", () => {
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

  const play = (m: SoloMatch) => {
    const p = m.phase as Extract<SoloMatch["phase"], { kind: "play" }>;
    m.submit((m.runner.crowdAllowed() ?? legalMoves(p.board.fen))[0]!);
  };
  /** Boss alone against Dash, his stall skit on the test switch's quick beats (as ?power=stall): the slam 1.5 s in, the fake move 3.5 s. */
  async function dashToPlay() {
    const m = new SoloMatch([engine], "Ann", { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1600, bossId: "dash", bossUnfinished: true, bossPowerTest: "stall" } as Settings);
    m.start();
    // (Out of his opening book first: his state, and so his skit, begins after it. Each move played at once until it's planned.)
    for (let moves = 0; moves < 30; moves++) {
      for (let i = 0; i < 240 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(250);
      expect(m.phase.kind).toBe("play");
      if (m.runner.stallPlan(HUMAN)) return m;
      const ply = (m.phase as Extract<SoloMatch["phase"], { kind: "play" }>).board.ply;
      play(m);
      for (let i = 0; i < 240 && (m.phase.kind !== "play" || (m.phase as Extract<SoloMatch["phase"], { kind: "play" }>).board.ply === ply); i++) await vi.advanceTimersByTimeAsync(250);
    }
    throw new Error("no stall skit planned");
  }
  const until = async (t: number) => {
    if (Date.now() < t) await vi.advanceTimersByTimeAsync(t - Date.now());
  };

  it("each once a battle, apart (Eric: \"each still occur once per game\"): a move between the slam and the fake move; the fake move comes alone on the next move (its pause only); then neither again", async () => {
    const m = await dashToPlay();
    let p = m.phase as Extract<SoloMatch["phase"], { kind: "play" }>;
    expect(p.stall).toBeUndefined();
    await until(p.startsAt + DASH_STALL.test.slamAt + 100);
    p = m.phase as typeof p;
    expect(p.stall?.beat).toBe("slam");
    expect(m.runner.boss!.powers!.dash!.slam).toEqual({ at: m.runner.boss!.crowdMoves });
    // You move before the fake move: it stays armed.
    await until(p.stall!.until + 200);
    play(m);
    expect(m.runner.boss!.powers!.dash!.stall ?? null).toBeNull();
    const next = async () => {
      const ply = p.board.ply;
      for (let i = 0; i < 240 && (m.phase.kind !== "play" || (m.phase as typeof p).board.ply === ply); i++) await vi.advanceTimersByTimeAsync(250);
      p = m.phase as typeof p;
      expect(p.kind).toBe("play");
    };
    // The next move: no slam, the fake move alone at its time, the deadline moved back by its hold only.
    await next();
    const deadline = p.deadline;
    await until(p.startsAt + DASH_STALL.test.slamAt + 500);
    expect((m.phase as typeof p).stall).toBeUndefined();
    await until(p.startsAt + DASH_STALL.test.fakeAt + 100);
    p = m.phase as typeof p;
    expect(p.stall).toMatchObject({ beat: "fake", alone: true });
    expect(p.deadline).toBe(deadline + stallTimeline().total);
    expect(m.runner.boss!.powers!.dash!.stall).toMatchObject({ at: m.runner.boss!.crowdMoves, move: p.stall!.move });
    await until(p.stall!.until + 200);
    play(m);
    // The moves after: neither, however long each takes.
    for (let n = 0; n < 2; n++) {
      await next();
      await until(p.startsAt + DASH_STALL.test.fakeAt + DASH_STALL.slamMs + 1000);
      expect((m.phase as typeof p).stall, `move ${n + 3}`).toBeUndefined();
      play(m);
    }
  });

  it("a real battle (no test switch, Boss alone's bank): his beats still come on a move that began with a short moment of his (a slap, a clock fit); Eric, Nov 18: \"his 20/30 second gag isn't firing ... I did nothing for a minute and he just stood there\"", async () => {
    const s = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, ...bossClockSettings({ bossMaxMoves: RAID_SETTINGS.bossMaxMoves ?? DEFAULT_SETTINGS.bossMaxMoves }), bossFixedElo: 1600, bossId: "dash", bossUnfinished: true } as Settings;
    const m = new SoloMatch([engine], "Ann", s);
    m.start();
    type P = Extract<SoloMatch["phase"], { kind: "play" }>;
    const beats: string[] = [];
    let tested = 0;
    for (let move = 0; move < 20 && tested < 2; move++) {
      for (let i = 0; i < 400 && m.phase.kind !== "play"; i++) await vi.advanceTimersByTimeAsync(250);
      expect(m.phase.kind).toBe("play");
      let p = m.phase as P;
      const kinds = m.runner.boss!.powers?.events.map((e) => e.kind) ?? [];
      // (On a move that began with his slap or clock fit and still has a beat to come, wait out the skit's whole time.)
      if (kinds.some((k) => k === "slap" || k === "clockFit") && m.runner.stallPlan(HUMAN)) {
        tested++;
        const end = p.startsAt + DASH_STALL.fakeSeconds * 1000 + DASH_STALL.slamMs + 2000;
        const seen: string[] = [];
        while (Date.now() < end && m.phase.kind === "play") {
          await vi.advanceTimersByTimeAsync(250);
          const q = m.phase as P;
          if (q.stall && !seen.includes(q.stall.beat)) seen.push(q.stall.beat);
          if (q.stall?.beat === "fake" && Date.now() > q.stall.until) break;
        }
        expect(seen.length, `move ${move} began with ${kinds.join(",")}`).toBeGreaterThan(0);
        beats.push(...seen);
        p = m.phase as P;
      }
      const ply = p.board.ply;
      play(m);
      for (let i = 0; i < 400 && (m.phase.kind !== "play" || (m.phase as P).board.ply === ply); i++) await vi.advanceTimersByTimeAsync(250);
    }
    expect(tested, "a move that began with a slap or clock fit").toBeGreaterThan(0);
    expect(beats.length).toBeGreaterThan(0);
  }, 60_000);

  it("disposed mid-move: the skit's timer dies with the match (no beat, no turn restarted, nothing recorded)", async () => {
    const m = await dashToPlay();
    const p = m.phase as Extract<SoloMatch["phase"], { kind: "play" }>;
    await until(p.startsAt + DASH_STALL.test.slamAt - 500);
    m.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(m.phase).toBe(p);
    expect(m.runner.boss!.powers!.dash!.stall ?? null).toBeNull();
  });
});
