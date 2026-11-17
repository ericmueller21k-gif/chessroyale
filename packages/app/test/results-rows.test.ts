import { describe, expect, it } from "vitest";
import { CROWD_CUTS, CROWD_SETTINGS, DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { lossRows } from "../src/game.ts";

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
