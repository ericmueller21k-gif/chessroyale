import { describe, expect, it } from "vitest";
import { CROWD_KNOCKOUTS, CROWD_SETTINGS, DEFAULT_SETTINGS, RAID_SETTINGS, type Settings } from "@chessroyale/core";
import { lossRows } from "../src/game.ts";

/** The results table names what was played (the audit, Oct 15: a boss battle's row read "Duel"). */
describe("the results table's rows", () => {
  const crowd = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...CROWD_SETTINGS, ...patch });
  it("a raid or Boss alone: one row, the boss battle", () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS };
    expect(lossRows({ settings, lossesByStage: [[2, 4]] })).toEqual([{ label: "Boss battle", avg: 3 }]);
  });
  it("Crowd: the knockouts as one row, then its ending by name", () => {
    const boss = crowd({ finalFormat: "boss", knockoutsPerStage: CROWD_KNOCKOUTS.boss });
    const stages = [...CROWD_KNOCKOUTS.boss.map((_, i) => (i === 1 ? [] : [i])), [10, 20]];
    const avg = CROWD_KNOCKOUTS.boss.map((_, i) => i).filter((i) => i !== 1);
    expect(lossRows({ settings: boss, lossesByStage: stages })).toEqual([
      { label: "Knockouts", avg: avg.reduce((a, b) => a + b, 0) / avg.length },
      { label: "Boss final", avg: 15 },
    ]);
    expect(lossRows({ settings: crowd({ finalFormat: "duel", knockoutsPerStage: CROWD_KNOCKOUTS.duel }), lossesByStage: [...CROWD_KNOCKOUTS.duel.map(() => [1]), [3]] }).map((r) => r.label)).toEqual(["Knockouts", "Duel"]);
    expect(lossRows({ settings: crowd(), lossesByStage: [...CROWD_KNOCKOUTS.team.map(() => [1]), [3]] }).map((r) => r.label)).toEqual(["Knockouts", "Team final"]);
  });
  it("out before the final: the knockouts only; no moves in a part, no row", () => {
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
