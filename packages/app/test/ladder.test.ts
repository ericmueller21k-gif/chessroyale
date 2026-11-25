import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankView, type LadderAnswer, type LadderRow } from "@chessroyale/core";
import { LADDER_KEEP_MS, cameBack, forgetLadder, keptLadder, loadLadder, openFromLadder, placeText, placementLine, recordLine, totalLine, winPct } from "../src/ladder.ts";
import { closeProfile, openProfile, profileBack, profileTarget } from "../src/profile-nav.ts";

/**
 * The season ladder's page helpers (ladder.ts; docs/decisions/2026-11-25-ladder.md): the words a row shows, the answer asked once
 * more on a failure and kept a minute, and the list's place kept for the Back of the profile a row opened (and only that Back).
 * (Your own row in the list, the engine pool's "as ever" view included, is the server's: server/test/ladder.test.ts.)
 */

const row = (uid: string, place: number, ladder = 3000 - place): LadderRow => ({
  uid,
  name: uid,
  look: {},
  place,
  rank: rankView({ games: 40, ladder, place }),
  wins: 10,
  losses: 5,
  draws: 1,
  streak: 0,
});

describe("a row's words", () => {
  it("record, win %, place, the count, placements", () => {
    expect(recordLine({ wins: 142, losses: 88 })).toBe("142 – 88");
    expect(winPct({ wins: 2, losses: 1, draws: 0 })).toBe("67%");
    expect(winPct({ wins: 0, losses: 0, draws: 0 })).toBe("–");
    expect(placeText(2418)).toBe("#2,418");
    expect(totalLine(12408)).toBe("12,408 ranked players");
    expect(totalLine(1)).toBe("1 ranked player");
    expect(placementLine({ played: 2, of: 5 })).toBe("Play 3 more placement games to join the ladder");
    expect(placementLine({ played: 4, of: 5 })).toBe("Play 1 more placement game to join the ladder");
  });
});

describe("loadLadder", () => {
  const ANSWER: LadderAnswer = { season: 1, mode: "1v1", total: 1, rows: [row("a", 1)], you: null };
  beforeEach(() => forgetLadder());
  afterEach(() => vi.unstubAllGlobals());

  it("asks once more after a failure, then keeps the answer a minute", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => (++calls === 1 ? Response.json({ message: "busy" }, { status: 503 }) : Response.json(ANSWER)));
    expect(await loadLadder("1v1", () => 1000)).toEqual(ANSWER);
    expect(calls).toBe(2);
    expect(keptLadder("1v1", 1000 + LADDER_KEEP_MS - 1)).toEqual(ANSWER);
    expect(keptLadder("1v1", 1000 + LADDER_KEEP_MS)).toBeNull();
  });

  it("two failures: thrown (the page says it didn't load, with Retry); an answer without rows is a failure", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ message: "down" }, { status: 500 }));
    await expect(loadLadder("1v1")).rejects.toThrow("down");
    vi.stubGlobal("fetch", async () => Response.json({ season: 1 }));
    await expect(loadLadder("1v1")).rejects.toThrow("The ladder didn't load.");
    expect(keptLadder("1v1")).toBeNull();
  });
});

describe("Back from the profile a row opened (the same list, at the same place)", () => {
  const anna = { uid: "a", name: "Anna" };
  afterEach(() => closeProfile());

  it("that profile's own Back: the list's place, however long the profile was open (the answer may be asked again; the place stays)", () => {
    openFromLadder(anna, 640);
    expect(profileTarget()).toBe(anna);
    profileBack();
    expect(profileTarget()).toBeNull();
    expect(cameBack()).toBe(640);
    // (Asked once: the next time here is a fresh list from the top.)
    expect(cameBack()).toBeNull();
  });

  it("the profile closed any other way (the side menu, another page): the next ladder starts at the top, even after another profile's Back", () => {
    openFromLadder(anna, 640);
    closeProfile();
    expect(cameBack()).toBeNull();
    // (Left by the side menu, then any profile's Back elsewhere, then the ladder again from the menu: still the top.)
    openFromLadder(anna, 640);
    closeProfile();
    openProfile({ uid: "b", name: "Bea" });
    profileBack();
    expect(cameBack()).toBeNull();
    // (From the profile a row opened, on to another player's: that one's Back isn't the row's.)
    openFromLadder(anna, 640);
    openProfile({ uid: "b", name: "Bea" });
    profileBack();
    expect(cameBack()).toBeNull();
  });
});
