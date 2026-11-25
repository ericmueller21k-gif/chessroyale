import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankView, type LadderAnswer, type LadderRow } from "@chessroyale/core";
import { LADDER_KEEP_MS, forgetLadder, keepLadderScroll, keptLadder, loadLadder, placeText, placementLine, recordLine, rowsWithYou, totalLine, winPct } from "../src/ladder.ts";

/**
 * The season ladder's page helpers (ladder.ts; docs/decisions/2026-11-25-ladder.md): you in your place when the shared list
 * leaves you out, the words a row shows, and the answer asked once more on a failure and kept a minute for a profile's Back.
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

describe("rowsWithYou", () => {
  const rows = [row("a", 1), row("b", 2), row("c", 2), row("d", 4)];
  it("you in the list already: the list as it is", () => {
    expect(rowsWithYou({ rows, you: row("c", 2) }).map((r) => r.uid)).toEqual(["a", "b", "c", "d"]);
  });
  it("a place within the list the shared list doesn't have you at (the engine pool, a test account): you at your place, after your ties", () => {
    expect(rowsWithYou({ rows, you: row("me", 2) }).map((r) => r.uid)).toEqual(["a", "b", "c", "me", "d"]);
    expect(rowsWithYou({ rows, you: row("me", 4) }).map((r) => r.uid)).toEqual(["a", "b", "c", "d", "me"]);
  });
  it("below the list, in placements, signed out, or an empty list: never added", () => {
    expect(rowsWithYou({ rows, you: row("me", 5) })).toBe(rows);
    expect(rowsWithYou({ rows, you: { placement: { played: 2, of: 5 } } })).toBe(rows);
    expect(rowsWithYou({ rows, you: null })).toBe(rows);
    expect(rowsWithYou({ rows: [], you: row("me", 1) })).toEqual([]);
  });
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

  it("asks once more after a failure, then keeps the answer a minute (with how far the list was scrolled)", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => (++calls === 1 ? Response.json({ message: "busy" }, { status: 503 }) : Response.json(ANSWER)));
    expect(await loadLadder("1v1", () => 1000)).toEqual(ANSWER);
    expect(calls).toBe(2);
    keepLadderScroll("1v1", 640);
    expect(keptLadder("1v1", 1000 + LADDER_KEEP_MS - 1)).toEqual({ at: 1000, answer: ANSWER, scroll: 640 });
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
