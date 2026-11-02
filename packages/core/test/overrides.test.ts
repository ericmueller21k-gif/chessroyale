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
  it("the rounds in a stage (Nov 1): the Crowd's own list, its last entry covering later stages; emptied (a test's ?rounds=) or unset, the first stage's then roundsPerStage", () => {
    const crowd = { ...DEFAULT_SETTINGS, ...modeSettings("crowd") };
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => roundsInStage(crowd, i))).toEqual([20, 10, 8, 8, 6, 6, 6, 4, 4]);
    // Cuts after moves 10, 15, 19, 23, 26, 29 (the team final), 32 (the boss final) and 34 (the duel).
    expect(CROWD_STAGE_ROUNDS.map((_, i) => CROWD_STAGE_ROUNDS.slice(0, i + 1).reduce((a, b) => a + b, 0) / 2)).toEqual([10, 15, 19, 23, 26, 29, 32, 34]);
    const rounds = { ...crowd, stageRounds: [], firstStageRounds: 2, roundsPerStage: 2 };
    expect([0, 1, 5].map((i) => roundsInStage(rounds, i))).toEqual([2, 2, 2]);
    expect([0, 1].map((i) => roundsInStage(DEFAULT_SETTINGS, i))).toEqual([DEFAULT_SETTINGS.firstStageRounds, DEFAULT_SETTINGS.roundsPerStage]);
    expect(roundsInStage({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS }, 0)).toBe(20);
  });
});
