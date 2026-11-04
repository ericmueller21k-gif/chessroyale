import { describe, expect, it } from "vitest";
import { SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import { START_FEN, applyMove } from "@chessroyale/chess";
import type { NetDuty, NetSquadsHalf, SquadsEvent } from "@chessroyale/chess/squads";
import { byOfHalf, replayFrameAt, replayFrames, replayOn, replayTimes, setReplayOn, tagText } from "../src/move-replay.ts";
import { drainRate, freeMs, liveBank, replayCount, type LocalMatch } from "../src/squads-view.ts";

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

  it("turning the replay off changes nothing on the clock", () => {
    const m = match([duty(0, 0, ["a0"], 5_500, [7])]);
    const was = replayOn();
    const clock = () => [freeMs(m, 0), liveBank(m, 0, 6_000), drainRate(m, 0, 6_000)];
    setReplayOn(true);
    const on = clock();
    setReplayOn(false);
    expect(clock()).toEqual(on);
    setReplayOn(was);
  });
});
