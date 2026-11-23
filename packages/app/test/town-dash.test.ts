import { describe, expect, it, vi } from "vitest";

// An admin's town (Nov 3): the homes and kids of the bosses in the game for admins first are in it (admin-town.ts). The town is the
// street town for everyone since Nov 13 (its layout: town-street.test.ts, Dash's Kicks among the homes on their lots); a player's town
// without these homes: town-player.test.ts.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { ADMIN_BOTS, BOTS, TOWN_BOTS, createTown, homeDoor, sidekickText } = await import("../src/town/world.ts");

/** Tick in an admin's town (docs/decisions/2026-11-03-dash-home.md): among the bots, his door the store's. */
describe("an admin's town: Tick (Nov 3)", () => {
  it("walks with the other bots: the ladder's twenty, Rivet, then Tick, Dash's sidekick, his door the store's", () => {
    expect(TOWN_BOTS).toEqual([...BOTS, ...ADMIN_BOTS]);
    const tick = TOWN_BOTS[21]!;
    expect(tick.name).toBe("Tick");
    expect(tick.rating).toBe(1850);
    expect(sidekickText(tick)).toBe("Dash's sidekick");
    // (The store's lot, street-plan.json's "blitz": its door at (41, 39), its entry the lot's front row.)
    expect(homeDoor(tick)).toEqual({ c: 41, r: 40 });
    const t = createTown(0, undefined, null, TOWN_BOTS.length);
    expect(t.bots.map((p) => p.bot)).toEqual(TOWN_BOTS);
    expect(t.bots.find((p) => p.bot === tick)!.look).toBe(tick.look);
    // Dash starts on his rest square before his store, as every boss does before its home.
    expect(t.bosses.find((b) => b.home.id === "dash")!.walker.here()).toEqual({ c: 39, r: 39 });
  });
});
