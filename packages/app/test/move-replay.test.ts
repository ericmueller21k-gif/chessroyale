import { describe, expect, it } from "vitest";
import { SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import { START_FEN, applyMove } from "@chessroyale/chess";
import type { NetDuty, NetSquadsHalf, SquadsEvent } from "@chessroyale/chess/squads";
import {
  COACH_MARKS,
  arriveAt,
  seenAt,
  byOfHalf,
  coachDone,
  coachDue,
  nextCoachMark,
  queuedSquads,
  nextReplayMode,
  readReplayMode,
  replayFrameAt,
  replayFrames,
  replayMode,
  replayRange,
  replayTimes,
  setReplayMode,
  tagText,
} from "../src/move-replay.ts";
import { drainRate, freeMs, liveBank, replayCount, tickSecond, type LocalMatch } from "../src/squads-view.ts";

/**
 * Move replay on screen (Eric, Nov 5; src/move-replay.ts): the moves you missed in order, paced inside the extra free
 * time, gone once it's over; the name tags' words; and the free time the same whether the replay shows or not.
 */

const MOVES = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5"];
const PER = SQUADS.replaySecondsPerMove * 1000;

describe("Move replay: the moves you missed, in order, then the board as it stands", () => {
  it("the last n moves of the board, each played in turn from the position before them, each with who played it", () => {
    const by = MOVES.map((_, i) => [i % 2 ? "b1" : "a0"]);
    const f = replayFrames(START_FEN, MOVES, by, 3);
    expect(f).toHaveLength(4);
    const before = MOVES.slice(0, 5).reduce((fen, m) => applyMove(fen, m), START_FEN);
    expect(f[0]).toEqual({ fen: before, lastMove: "f1c4", by: [] });
    expect(f.slice(1).map((x) => x.lastMove)).toEqual(["g8f6", "d2d3", "f8c5"]);
    expect(f.slice(1).map((x) => x.by)).toEqual([["b1"], ["a0"], ["b1"]]);
    expect(f[3]!.fen).toBe(MOVES.reduce((fen, m) => applyMove(fen, m), START_FEN));
    // Nothing missed (or no moves yet): nothing to replay.
    expect(replayFrames(START_FEN, MOVES, by, 0)).toEqual([]);
    expect(replayFrames(START_FEN, [], [], 3)).toEqual([]);
  });

  it("paced at about 0.45 s a move inside the extra free time (0.5 s a move), the last held a beat; then it's over", () => {
    for (const n of [1, 2, 3, 5, 7]) {
      const total = n * PER;
      const at = replayTimes(n, total);
      expect(at).toHaveLength(n);
      expect(at[0]).toBe(SQUADS_LOBBY.replay.firstMs);
      for (let i = 1; i < n; i++) expect(at[i]! - at[i - 1]!).toBeCloseTo(SQUADS_LOBBY.replay.stepMs, 5);
      // The last lands with time to spare: held at least a fifth of a second before the free seconds start as usual.
      expect(total - at[n - 1]!).toBeGreaterThanOrEqual(Math.min(SQUADS_LOBBY.replay.stepMs, total * 0.2) - 1);
    }
    const f = replayFrames(START_FEN, MOVES, [], 3);
    const total = 3 * PER;
    expect(replayFrameAt(f, total, 0)).toBe(f[0]);
    expect(replayFrameAt(f, total, 160)).toBe(f[1]);
    expect(replayFrameAt(f, total, 700)).toBe(f[2]);
    expect(replayFrameAt(f, total, 1100)).toBe(f[3]);
    expect(replayFrameAt(f, total, total)).toBeNull();
  });

  it("who played each move of a half on a board: the Relay mover; a pair's coin's picker, or both on the same move", () => {
    const events = [
      { kind: "relay", turn: 0, half: "w", board: 0, side: 0, player: "a0", move: "e2e4", missed: false },
      { kind: "relay", turn: 0, half: "w", board: 1, side: 1, player: "b1", move: "d2d4", missed: false },
      { kind: "pair", turn: 0, half: "w", board: 2, side: 0, players: ["a1", "a2"], picks: ["e2e4", "d2d4"], missed: [false, false], same: false, token: null, coin: 1, move: "d2d4" },
      { kind: "pair", turn: 0, half: "w", board: 3, side: 1, players: ["b2", "b3"], picks: ["c2c4", "c2c4"], missed: [false, false], same: true, token: 0, coin: null, move: "c2c4" },
      { kind: "forced", turn: 0, half: "w", board: 3, side: 1, move: "e1f1" },
    ] as SquadsEvent[];
    expect(byOfHalf(events, 0)).toEqual([["a0"]]);
    expect(byOfHalf(events, 2)).toEqual([["a2"]]);
    expect(byOfHalf(events, 3)).toEqual([["b2", "b3"], []]);
  });

  it("a name tag's words: whole up to 12 letters; longer, cut to 12 with \"…\"", () => {
    expect(tagText(["Ann"])).toBe("Ann");
    expect(tagText(["Christopher"])).toBe("Christopher");
    expect(tagText(["Christopherson"])).toBe("Christopher…");
    expect(tagText(["Christopherson"]).length).toBe(SQUADS_LOBBY.replay.tagChars);
    expect(tagText(["Ann", "Bo"])).toBe("Ann + Bo");
  });
});

describe("Move replay's free time: the server's, the same with the replay on or off", () => {
  const duty = (board: number, side: 0 | 1, players: string[], freeMs?: number, replay?: number[]): NetDuty => ({ board, side, role: "move", players, deadline: 20_000, ...(freeMs ? { freeMs, replay } : {}) });
  const match = (duties: NetDuty[]): LocalMatch =>
    ({
      key: "r0m0",
      state: "half",
      banks: [60_000, 60_000],
      delayMs: 2_000,
      current: { seq: 0, turn: 4, half: "w", startedAt: 0, duties, scouts: [], forced: [], chips: [] } satisfies NetSquadsHalf,
      locked: [],
      lockedAt: {},
      boards: [],
    }) as unknown as LocalMatch;

  it("each move drains its squad's bank past its own free time: 2 s + 0.5 s for each of the 7 moves missed", () => {
    const m = match([duty(0, 0, ["a0"], 2_000 + 7 * PER, [7]), duty(2, 0, ["a2"]), duty(1, 1, ["b1"], 2_000 + 7 * PER, [7])]);
    expect(freeMs(m, 0)).toBe(5_500);
    expect(freeMs(m, 2)).toBe(2_000);
    expect(replayCount(m.current!.duties[0], "a0")).toBe(7);
    expect(replayCount(m.current!.duties[0], "a1")).toBe(0);
    // 6 s in: a0's move has drained 0.5 s, a2's 4 s; b1's 0.5 s.
    expect(liveBank(m, 0, 6_000)).toBe(60_000 - 500 - 4_000);
    expect(liveBank(m, 1, 6_000)).toBe(60_000 - 500);
    // 4 s in, only a2's move drains (a0's is still in its free time).
    expect(drainRate(m, 0, 4_000)).toBe(1);
    expect(drainRate(m, 0, 6_000)).toBe(2);
  });

  it("the replay button's setting changes nothing on the clock", () => {
    const m = match([duty(0, 0, ["a0"], 5_500, [7])]);
    const was = replayMode();
    const clock = () => [freeMs(m, 0), liveBank(m, 0, 6_000), drainRate(m, 0, 6_000)];
    setReplayMode("all");
    const on = clock();
    for (const mode of ["two", "off"] as const) {
      setReplayMode(mode);
      expect(clock()).toEqual(on);
    }
    setReplayMode(was);
  });

  it("the countdown tick: only while your squad's real bank runs out (its last 5 s), never in the free seconds", () => {
    expect(SQUADS_LOBBY.tickBankSeconds).toBe(5);
    const low = (bank: number, free = 2_000): LocalMatch => ({ ...match([duty(0, 0, ["a0"], free, [0])]), banks: [bank, 60_000] }) as LocalMatch;
    // A bank of 4 s: the free 2 s pass silently, then a tick each whole second it runs down.
    expect(tickSecond(low(4_000), "a0", 0)).toBeNull();
    expect(tickSecond(low(4_000), "a0", 1_999)).toBeNull();
    expect(tickSecond(low(4_000), "a0", 2_100)).toBe(4);
    expect(tickSecond(low(4_000), "a0", 3_500)).toBe(3);
    // Coming back to a board (more free seconds): still none until they're over.
    expect(tickSecond(low(4_000, 5_500), "a0", 4_000)).toBeNull();
    expect(tickSecond(low(4_000, 5_500), "a0", 5_600)).toBe(4);
    // A full bank: no tick; sudden death (no bank to run out): none; not your move, or made: none.
    expect(tickSecond(low(60_000), "a0", 8_000)).toBeNull();
    expect(tickSecond(low(0), "a0", 1_000)).toBeNull();
    expect(tickSecond(low(4_000), "b1", 2_500)).toBeNull();
    expect(tickSecond({ ...low(4_000), locked: ["a0"] } as LocalMatch, "a0", 2_500)).toBeNull();
  });
});

describe("The replay button's three settings (Eric, Nov 5, round 2)", () => {
  it("a tap steps off → the last 2 moves → all moves → off", () => {
    expect(nextReplayMode("off")).toBe("two");
    expect(nextReplayMode("two")).toBe("all");
    expect(nextReplayMode("all")).toBe("off");
  });

  it("off on a device's first match; the first button's stored on/off read as all/off", () => {
    expect(SQUADS_LOBBY.replay.mode).toBe("off");
    expect(readReplayMode(null)).toBeNull();
    expect(readReplayMode("1")).toBe("all");
    expect(readReplayMode("0")).toBe("off");
    for (const m of ["off", "two", "all"] as const) expect(readReplayMode(m)).toBe(m);
    expect(readReplayMode("junk")).toBeNull();
  });

  it("replays the moves made on the board while you weren't viewing it; the last 2 of them, or all; off, none", () => {
    // Back on a board 7 moves after you last played it (moves 1-7 of 8 missed), arriving as your move starts.
    const back = { total: 8, missed: 7, arrivedAt: 8 };
    expect(replayRange({ mode: "all", ...back })).toEqual([1, 8]);
    // The last 2: your teammate's last move there and the opponent's reply, then it's your move.
    expect(replayRange({ mode: "two", ...back })).toEqual([6, 8]);
    const f = replayFrames(START_FEN, MOVES.slice(0, 8), [], 2);
    expect(f.slice(1).map((x) => x.lastMove)).toEqual(MOVES.slice(6, 8));
    expect(replayRange({ mode: "off", ...back })).toBeNull();
  });

  it("moves watched live never replay: sat at the board all along, nothing; Quick board jump there early, only those before you came", () => {
    // You sat there since you last played it (it came on screen before then): nothing.
    expect(replayRange({ mode: "all", total: 8, missed: 7, arrivedAt: 1, seenBefore: 0 })).toBeNull();
    // Quick board jump took you there after move 5 (seen last after move 1, when you played it): moves 2-5 replay, not 6-8.
    expect(replayRange({ mode: "all", total: 8, missed: 7, arrivedAt: 5, seenBefore: 1 })).toEqual([1, 5]);
    expect(replayRange({ mode: "two", total: 8, missed: 7, arrivedAt: 5, seenBefore: 1 })).toEqual([3, 5]);
    // Looked in on it (a tap on its tiny board) after move 4: only what came after.
    expect(replayRange({ mode: "all", total: 8, missed: 7, arrivedAt: 8, seenBefore: 4 })).toEqual([4, 8]);
    // Not your move there (nothing since you last played it): nothing.
    expect(replayRange({ mode: "all", total: 8, missed: 0, arrivedAt: 8 })).toBeNull();
  });

  it("a board's views on this device: when it came on screen, and when it was last seen before", () => {
    expect(arriveAt("r0m9/1", 3)).toEqual({ arrivedAt: 3 });
    seenAt("r0m9/1", 5);
    expect(arriveAt("r0m9/1", 9)).toEqual({ arrivedAt: 9, seenBefore: 5 });
  });
});

describe("The first-time tips: three coach marks, one at a time", () => {
  it("settings, then the replay button, then the tiny boards; then done", () => {
    expect(COACH_MARKS.map((c) => c.id)).toEqual(["settings", "replay", "boards"]);
    expect(COACH_MARKS.map((c) => c.text)).toEqual(["Tap here for settings, like Quick board jump.", "Tap to replay moves: the last 2, all of them, or off.", "Tap a board to watch it. Tap yours to come back."]);
    expect([0, 1, 2].map(nextCoachMark)).toEqual([1, 2, null]);
  });

  it("run once a lobby; \"Don't show these again\" unticked, they come back at the next lobby; ticked, never again", () => {
    const store = new Map<string, string>();
    const was = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    try {
      expect(coachDue("abcde")).toBe(false);
      queuedSquads("ABCDE");
      expect(coachDue("abcde")).toBe(true);
      coachDone(false);
      expect(coachDue("ABCDE")).toBe(false);
      queuedSquads("FGHJK");
      expect(coachDue("FGHJK")).toBe(true);
      coachDone(true);
      queuedSquads("LMNPQ");
      expect(coachDue("LMNPQ")).toBe(false);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = was;
    }
  });
});
