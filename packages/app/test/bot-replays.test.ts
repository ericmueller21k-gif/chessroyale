import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { LIVE_WINDOW } from "@chessroyale/core";
import { START_FEN, legalMoves, toSan } from "@chessroyale/chess";
import { cycleMs, replayAt, replayMs, replayPositions, replayView, type Replay, type ReplayFile } from "../src/bot-replays.ts";

const path = new URL("../public/replays/crowd-bots.json", import.meta.url);
const shipped = JSON.parse(readFileSync(path, "utf8")) as ReplayFile;
const T = { plySeconds: 10, finalPlySeconds: 5, startSeconds: 4, endSeconds: 6 };
const tiny = (id: string, moves: string[], final = 0): Replay => ({
  id,
  names: ["A", "B", "C"],
  plies: moves.map((m, i) => ({ m, v: [[m, 3]], a: 3, ...(i >= moves.length - final ? { w: 1 } : { n: 0 }) })),
  end: { winner: "w", top: [2, 0, 1] },
});

describe("the live window's bot replays", () => {
  it("the cycle: by the clock, the same moment for everyone; start, each move, the result, then the next replay", () => {
    const file: ReplayFile = { version: 1, replays: [tiny("one", ["e2e4", "e7e5"]), tiny("two", ["d2d4", "d7d5", "c2c4"], 1)] };
    // one: 4 + 10 + 10 + 6 = 30 s; two: 4 + 10 + 10 + 5 + 6 = 35 s.
    expect(replayMs(file.replays[0]!, T)).toBe(30_000);
    expect(replayMs(file.replays[1]!, T)).toBe(35_000);
    expect(cycleMs(file, T)).toBe(65_000);
    const base = 65_000 * 1_000_000;
    const at = (s: number) => replayAt(file, base + s * 1000, T)!;
    expect(at(0)).toEqual({ replay: 0, ply: -1, until: base + 4_000 });
    expect(at(3.9)).toMatchObject({ replay: 0, ply: -1 });
    expect(at(4)).toEqual({ replay: 0, ply: 0, until: base + 14_000 });
    expect(at(14)).toMatchObject({ replay: 0, ply: 1, until: base + 24_000 });
    expect(at(24)).toEqual({ replay: 0, ply: 2, until: base + 30_000 });
    expect(at(30)).toMatchObject({ replay: 1, ply: -1, until: base + 34_000 });
    expect(at(54)).toMatchObject({ replay: 1, ply: 2, until: base + 59_000 });
    expect(at(59)).toMatchObject({ replay: 1, ply: 3, until: base + 65_000 });
    // Round the cycle, and two viewers at the same instant agree.
    expect(at(65)).toEqual({ replay: 0, ply: -1, until: base + 69_000 });
    expect(replayAt(file, 1_791_000_123_456, T)).toEqual(replayAt(file, 1_791_000_123_456, T));
    // Every moment's `until` is the next change: nothing changes before it, and something does at it.
    for (let s = 0; s < 130; s += 0.5) {
      const m = at(s);
      const before = replayAt(file, m.until - 1, T)!;
      const after = replayAt(file, m.until, T)!;
      expect([before.replay, before.ply]).toEqual([m.replay, m.ply]);
      expect([after.replay, after.ply]).not.toEqual([m.replay, m.ply]);
    }
    // No replays: nothing to show.
    expect(replayAt({ version: 1, replays: [] }, base, T)).toBeNull();
  });

  it("what shows: the position after each move (worked out once per replay), the votes, the final's player, the result", () => {
    const r: Replay = { ...tiny("v", ["e2e4", "e7e5", "g1f3"], 1), plies: [] };
    r.plies = [
      { m: "e2e4", v: [["e4", 20], ["d4", 9]], n: 0, a: 100 },
      { m: "e7e5", v: [["e5", 14]], n: 1, a: 84 },
      // (A restart: the game began again from the start.)
      { m: "d2d4", v: [["d4", 1]], w: 2, a: 8, s: START_FEN },
    ];
    expect(replayView(r, -1)).toMatchObject({ fen: START_FEN, lastMove: null, votes: [], end: null, ply: 0 });
    const v0 = replayView(r, 0);
    expect(v0).toMatchObject({ lastMove: "e2e4", side: "w", votes: [["e4", 20], ["d4", 9]], name: "A", final: false, alive: 100, ply: 1, end: null });
    expect(v0.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
    expect(replayView(r, 1)).toMatchObject({ side: "b", name: "B", alive: 84 });
    const v2 = replayView(r, 2);
    expect(v2).toMatchObject({ lastMove: "d2d4", side: "w", final: true, name: "C" });
    expect(v2.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR");
    expect(replayView(r, 3)).toMatchObject({ fen: v2.fen, end: { winner: "w", top: ["C", "A", "B"] } });
    // The positions are worked out once and kept.
    expect(replayPositions(r)).toBe(replayPositions(r));
  });

  it("the shipped replays: real Crowd 50 v 50 matches, every move legal, the most-voted move played, small enough", () => {
    expect(shipped.version).toBe(1);
    expect(shipped.replays.length).toBeGreaterThanOrEqual(10);
    expect(new Set(shipped.replays.map((r) => r.id)).size).toBe(shipped.replays.length);
    // (About 75 KB for ten; the server compresses it to about 15 KB on the way.)
    expect(statSync(path).size).toBeLessThan(15_000 * shipped.replays.length);
    for (const r of shipped.replays) {
      expect(r.names).toHaveLength(100);
      expect(r.plies.length).toBeGreaterThan(40);
      let fen = START_FEN;
      let alive = 100;
      let finalSeen = false;
      for (const [k, p] of r.plies.entries()) {
        const before = p.s ?? fen;
        expect(legalMoves(before), `${r.id} ply ${k}`).toContain(p.m);
        const san = toSan(before, p.m);
        expect(p.v[0]![0], `${r.id} ply ${k}`).toBe(san);
        const counts = p.v.map((x) => x[1]);
        expect(counts).toEqual([...counts].sort((a, b) => b - a));
        if (p.w !== undefined) {
          finalSeen = true;
          expect(p.v).toEqual([[san, 1]]);
          expect(p.w).toBeLessThan(100);
        } else {
          // The crowd's vote: one team of 50 (fewer once players are cut).
          expect(finalSeen).toBe(false);
          expect(counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(50);
          expect(p.n).toBeLessThan(100);
        }
        expect(p.a).toBeLessThanOrEqual(alive);
        alive = p.a;
        fen = replayPositions(r)[k]!;
      }
      expect(finalSeen).toBe(true);
      expect(r.end.top).toHaveLength(3);
      for (const i of r.end.top) expect(r.names[i]).toBeTruthy();
    }
    // The whole cycle, as the settings time it: over an hour, so a viewer rarely sees a repeat.
    expect(cycleMs(shipped, LIVE_WINDOW)).toBeGreaterThan(60 * 60_000);
  });
});
