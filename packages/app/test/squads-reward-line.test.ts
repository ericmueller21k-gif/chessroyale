import { describe, expect, it } from "vitest";
import { SQUADS_LOBBY } from "@chessroyale/core";
import { NO_REWARD, squadsRewardLine } from "../src/screens/Squads.tsx";

/**
 * A Squads placement's reward words: its crates, or why none (the daily cap takes crates only). Its coins are the coin strip's, under
 * the XP box (Nov 25: coins show in one place; docs/decisions/2026-11-25-coin-strip.md).
 */
describe("Squads: the placement's reward line", () => {
  it("its crates, never its coins (the strip shows them)", () => {
    expect(squadsRewardLine({ crates: 1 }, false)).toBe("1 crate");
    expect(squadsRewardLine({ crates: 0 }, false)).toBe("");
  });

  it("the daily cap takes crates only: its words; a test lobby: no rewards", () => {
    expect(NO_REWARD.daily).toBe(`No crates: today's ${SQUADS_LOBBY.rewardsPerDay} paying lobbies are used. More tomorrow.`);
    expect(squadsRewardLine({ crates: 0, why: "daily" }, false)).toBe(NO_REWARD.daily);
    expect(squadsRewardLine({ crates: 1 }, true)).toBe("Test lobby: no rewards.");
  });
});
