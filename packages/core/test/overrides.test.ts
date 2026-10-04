import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, definedOnly, modeSettings } from "../src/index.ts";

describe("mode settings with playtest overrides", () => {
  it("an unset override leaves the mode's own value (Crowd keeps 20 quiet plies, cuts every move, a 20 s clock, no opening)", () => {
    const s = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: true }), ...definedOnly({ roundsPerStage: undefined, firstStageRounds: undefined, moveClockSeconds: undefined, openingMoves: undefined }) };
    expect(s).toMatchObject({ firstStageRounds: 20, roundsPerStage: 2, moveClockSeconds: 20, openingMoves: 0, lobbySize: 100 });
  });
  it("a set override wins", () => {
    const s = { ...DEFAULT_SETTINGS, ...modeSettings("crowd"), ...definedOnly({ firstStageRounds: 1, moveClockSeconds: 9 }) };
    expect(s).toMatchObject({ firstStageRounds: 1, moveClockSeconds: 9, roundsPerStage: 2 });
  });
});
