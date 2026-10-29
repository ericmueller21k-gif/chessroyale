import { describe, expect, it } from "vitest";
import { BOTS, TABLES, addCrowd, addTestPlayer, anyTableFree, createTown, fillTables, ratingLine, ratingText, tableFor, tdist, type Town } from "../src/town/world.ts";

/**
 * The person card's pieces that aren't DOM (Oct 28, Eric's mockup; docs/decisions/2026-10-28-town-card.md): the test player a real
 * player's card is tried with (no real players walk in the town yet), the hook that fills every table, and the rating's words.
 * The card itself (its look, its one size, its picture, "Tables are full") is tested in e2e/town.spec.ts.
 */

/** A town with nobody wandering off on their own. */
function still(): Town {
  const t = createTown(0, undefined, null, BOTS.length);
  t.nextBotAt = Infinity;
  return t;
}

describe("the person card (Oct 28)", () => {
  it("a test player: a pawn with an account id, an icon and a rating, on a free square beside you, out of the wandering crowd", () => {
    const t = still();
    const n = t.people.length;
    const k = addTestPlayer(t, { uid: "u-cy", name: "Cy", icon: "data:image/png;base64,AAAA", rating: 1432 });
    expect(k).toBe(n);
    const p = t.people[k]!;
    expect(p).toMatchObject({ uid: "u-cy", name: "Cy", icon: "data:image/png;base64,AAAA", rating: 1432, bot: null, you: false, home: false });
    // Beside you (one step away), on a square nobody else is headed for, and in the lists the world reads.
    expect(tdist(p.walker.here(), t.you.walker.here())).toBeLessThanOrEqual(2);
    expect(t.all).toContain(p.walker);
    expect(t.all.filter((w) => w.goalC() === p.walker.goalC() && w.goalR() === p.walker.goalR())).toHaveLength(1);
    expect(t.crowd).not.toContain(p);
    // (The testers' crowd after it still counts from its own start: a test player isn't one of its Guests.)
    addCrowd(t, 3);
    expect(t.crowd.map((c) => c.name)).toEqual(["Guest 1", "Guest 2", "Guest 3"]);
  });

  it("only a test player has an account id: you, the bots and the crowd have none (so no card's picture is a profile button)", () => {
    const t = still();
    addCrowd(t, 5);
    expect(t.people.filter((p) => p.uid !== undefined)).toEqual([]);
    addTestPlayer(t, { uid: "u-1", name: "One" });
    expect(t.people.filter((p) => p.uid !== undefined).map((p) => p.name)).toEqual(["One"]);
    // A rating of 1500 without one given; no icon until given.
    expect(t.people.at(-1)).toMatchObject({ rating: 1500 });
    expect(t.people.at(-1)!.icon).toBeUndefined();
  });

  it("the table-filling hook: every table has someone on a stool, so none is free for you and a bot (Play greys); off, they're gone", () => {
    const t = still();
    const bot = t.bots[0]!;
    expect(anyTableFree(t, bot)).toBe(true);
    const n = t.all.length;
    fillTables(t, true);
    expect(t.all.length).toBe(n + TABLES.length);
    expect(anyTableFree(t, bot)).toBe(false);
    expect(tableFor(t, bot)).toBeNull();
    // Again: not twice as many.
    fillTables(t, true);
    expect(t.all.length).toBe(n + TABLES.length);
    fillTables(t, false);
    expect(t.all.length).toBe(n);
    expect(anyTableFree(t, bot)).toBe(true);
  });

  it("a rating is said one way on every card: 'Rating 2200'", () => {
    expect(ratingLine(2200)).toBe("Rating 2200");
    for (const b of BOTS) expect(ratingText(b)).toBe(ratingLine(b.rating));
    expect(ratingText(BOTS.find((b) => b.name === "Woolly")!)).toBe("Rating 2200");
  });
});
