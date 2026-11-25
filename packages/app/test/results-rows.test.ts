import { describe, expect, it } from "vitest";
import { CROWD_CUTS, CROWD_SETTINGS, DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { cutCountdown, lossRows, nextCutValue, shortCountdown, stagesAhead, stagesLine } from "../src/game.ts";
import { endWords } from "../src/components/Podium.tsx";

/** The results table names what was played (the audit, Oct 15: a boss battle's row read "Duel"). */
describe("the results table's rows", () => {
  const crowd = (): Settings => ({ ...DEFAULT_SETTINGS, ...CROWD_SETTINGS });
  it("a raid or Boss alone: one row, the boss battle", () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS };
    expect(lossRows({ settings, lossesByStage: [[2, 4]] })).toEqual([{ label: "Boss battle", avg: 3 }]);
  });
  it("the 50 v 50 rework (C2): the cuts as one row, then the 1 v 1", () => {
    expect(lossRows({ settings: crowd(), lossesByStage: [...CROWD_CUTS.map((_, i) => [i]), [10, 20]] })).toEqual([
      { label: "Knockouts", avg: CROWD_CUTS.map((_, i) => i).reduce((a, b) => a + b, 0) / CROWD_CUTS.length },
      { label: "1 v 1", avg: 15 },
    ]);
  });
  it("out before the 1 v 1: the knockouts only; no moves in a part, no row", () => {
    expect(lossRows({ settings: crowd(), lossesByStage: [[1], [3], []] })).toEqual([{ label: "Knockouts", avg: 2 }]);
    expect(lossRows({ settings: crowd(), lossesByStage: [[]] })).toEqual([]);
  });
  it("Classic: each stage by number, then its final", () => {
    const settings = DEFAULT_SETTINGS;
    const n = settings.knockoutsPerStage.length;
    const rows = lossRows({ settings, lossesByStage: [...Array.from({ length: n }, () => [1]), [2]] });
    expect(rows.map((r) => r.label)).toEqual([...Array.from({ length: n }, (_, i) => `Stage ${i + 1}`), "Final"]);
  });
});

/** The 50 v 50 rework's words on screen (C3): the top bar's countdown, the cut screen's stages to come, the podium's headline. */
describe("the 50 v 50 rework's words", () => {
  const s: Settings = { ...DEFAULT_SETTINGS, ...CROWD_SETTINGS };
  it("the top bar: cut in N, the size a cut leaves on its move, the 1 v 1 from its move, then 1 v 1", () => {
    // Stage 4 (10 v 10, moves 27-30): move 27, White to move.
    expect(cutCountdown(s, 4, 0, 27)).toBe("cut in 4");
    expect(cutCountdown(s, 4, 6, 30)).toBe("6 v 6 next");
    expect(cutCountdown(s, 5, 0, 31)).toBe("cut in 3");
    expect(cutCountdown(s, 5, 5, 33)).toBe("4 v 4 next");
    // The 2 v 2 (moves 40-42): the 1 v 1's first move named.
    expect(cutCountdown(s, 7, 0, 40)).toBe("1 v 1 from move 43");
    expect(cutCountdown(s, 7, 3, 41)).toBe("1 v 1 from move 43");
    expect(cutCountdown(s, 7, 4, 42)).toBe("1 v 1 next");
    expect(cutCountdown(s, CROWD_CUTS.length, 0, 43)).toBe("1 v 1");
    // A narrow phone's: about 60 px under "Move 34".
    expect(["34 v 34 next", "1 v 1 from move 43", "1 v 1"].map(shortCountdown)).toEqual(["to 34v34", "1v1 at 43", "1v1"]);
    // A computer's labeled top row, NEXT CUT (Nov 26): the same words, as a value under the label.
    expect(["cut in 14", "34 v 34 next", "1 v 1 from move 43", "1 v 1 next", "1 v 1"].map((w) => nextCutValue(w, 0))).toEqual(["in 14 moves", "34 v 34", "1 v 1 at move 43", "1 v 1", "1 v 1"]);
    expect([nextCutValue(null, 4), nextCutValue(null, 1)]).toEqual(["in 4 moves", "now"]);
    // Not the rework: the old words stay the Hud's.
    expect(cutCountdown({ ...s, crowdCuts: undefined }, 0, 0, 1)).toBeNull();
  });
  it("the cut screen's stages to come, from the schedule", () => {
    expect(stagesLine(stagesAhead(s, 6, 34))).toBe("The 4 v 4 plays moves 34-39, then 2 v 2, then the 1 v 1 from move 43.");
    expect(stagesLine(stagesAhead(s, 7, 40))).toBe("The 2 v 2 plays moves 40-42, then the 1 v 1 from move 43.");
    expect(stagesLine(stagesAhead(s, 8, 43))).toBe("The 1 v 1 plays moves 43-60.");
    expect(stagesAhead(s, 1, 15)[0]).toEqual({ size: 34, from: 15, to: 18 });
  });
  it("the podium's headline: how the game ended", () => {
    const mate = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(endWords("b", mate, s)).toBe("Black wins by checkmate");
    const late = "8/8/4k3/8/8/4K3/4Q3/8 b - - 0 61";
    expect(endWords("w", late, s)).toBe("White wins on the judge's verdict");
    expect(endWords(null, late, s)).toBe("A draw at the move limit");
    expect(endWords(null, "7k/5Q2/6K1/8/8/8/8/8 b - - 0 50", s)).toBe("A draw by stalemate");
  });
});
