import { describe, expect, it } from "vitest";
import { CROWD_STAGE_ROUNDS, DEFAULT_SETTINGS, RAID_SETTINGS, definedOnly, modeSettings, roundsInStage } from "../src/index.ts";

describe("mode settings with playtest overrides", () => {
  it("an unset override leaves the mode's own value (Crowd keeps its stages, CROWD_STAGE_ROUNDS, a 20 s clock, no opening)", () => {
    const s = { ...DEFAULT_SETTINGS, ...modeSettings("crowd"), ...definedOnly({ roundsPerStage: undefined, firstStageRounds: undefined, stageRounds: undefined, moveClockSeconds: undefined, openingMoves: undefined }) };
    expect(s).toMatchObject({ stageRounds: CROWD_STAGE_ROUNDS, firstStageRounds: 20, roundsPerStage: 2, moveClockSeconds: 20, openingMoves: 0, lobbySize: 100 });
  });
  it("a set override wins", () => {
    const s = { ...DEFAULT_SETTINGS, ...modeSettings("crowd"), ...definedOnly({ firstStageRounds: 1, moveClockSeconds: 9 }) };
    expect(s).toMatchObject({ firstStageRounds: 1, moveClockSeconds: 9, roundsPerStage: 2 });
  });
  it("the rounds in a stage (Nov 1): the Crowd's own (its cuts' schedule), its last entry covering later stages; emptied (a test's ?rounds=) or unset, the first stage's then roundsPerStage", () => {
    const crowd = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };
    // The rework's (C2, Nov 16): cuts after moves 14, 18, 22, 26, 30, 33, 39 and 42, then the 1 v 1 to move 60 (crowdStageRounds).
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => roundsInStage(crowd, i))).toEqual([28, 8, 8, 8, 8, 6, 12, 6, 36]);
    const rounds = { ...crowd, stageRounds: [], firstStageRounds: 2, roundsPerStage: 2 };
    expect([0, 1, 5].map((i) => roundsInStage(rounds, i))).toEqual([2, 2, 2]);
    expect([0, 1].map((i) => roundsInStage(DEFAULT_SETTINGS, i))).toEqual([DEFAULT_SETTINGS.firstStageRounds, DEFAULT_SETTINGS.roundsPerStage]);
    expect(roundsInStage({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS }, 0)).toBe(20);
  });
});
