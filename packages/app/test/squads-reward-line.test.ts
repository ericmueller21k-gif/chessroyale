import { describe, expect, it } from "vitest";
import { SQUADS_LOBBY, type PlayCoins, type XpGrant } from "@chessroyale/core";
import { NO_REWARD, squadsRewardLine } from "../src/screens/Squads.tsx";

/**
 * A Squads placement's reward words (Nov 25): the lobby's coins are PLAY_COINS', paid with its XP (the grant the XP box shows), its
 * crates the placement's; the daily cap takes crates only.
 */
const coins = (play: number, bonus: number): PlayCoins => ({ play, bonus, parts: [], step: null, today: { play, bonus } });
const grant = (c?: PlayCoins): XpGrant => ({ before: 0, after: 190, levelBefore: 1, levelAfter: 1, parts: [], ...(c ? { coins: c } : {}) });

describe("Squads: the placement's reward line", () => {
  it("the coins from the game's grant (play coins and the placement's bonus), its crates; '+… coins' while the grant is coming", () => {
    expect(squadsRewardLine({ crates: 1, recorded: true }, grant(coins(25, 40)), false, " · ")).toBe("+65 coins · 1 crate");
    expect(squadsRewardLine({ crates: 1, recorded: true }, grant(coins(25, 40)), false, " and ")).toBe("+65 coins and 1 crate");
    expect(squadsRewardLine({ crates: 0, recorded: true }, grant(coins(54, 5)), false, " · ")).toBe("+59 coins");
    expect(squadsRewardLine({ crates: 1, recorded: true }, undefined, false, " · ")).toBe("+… coins · 1 crate");
    // (No coins: none in the grant, a grant from before them, or no grant at all.)
    expect(squadsRewardLine({ crates: 0, recorded: true }, grant({ ...coins(0, 0), none: "left" }), false, " · ")).toBe("");
    expect(squadsRewardLine({ crates: 1, recorded: true }, grant(), false, " · ")).toBe("1 crate");
    expect(squadsRewardLine({ crates: 0, recorded: false }, null, false, " · ")).toBe("");
  });

  it("the daily cap takes crates only: its words after the coins; a test lobby: no rewards", () => {
    expect(NO_REWARD.daily).toBe(`No crates: today's ${SQUADS_LOBBY.rewardsPerDay} paying lobbies are used. More tomorrow.`);
    expect(squadsRewardLine({ crates: 0, recorded: true, why: "daily" }, grant(coins(25, 40)), false, " · ")).toBe(`+65 coins. ${NO_REWARD.daily}`);
    expect(squadsRewardLine({ crates: 0, recorded: true, why: "daily" }, grant(), false, " · ")).toBe(NO_REWARD.daily);
    expect(squadsRewardLine({ crates: 1, recorded: true }, grant(coins(25, 40)), true, " · ")).toBe("Test lobby: no rewards.");
  });
});
