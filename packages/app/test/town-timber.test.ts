import { describe, expect, it, vi } from "vitest";

// An admin's town (Nov 3): the homes and kids of the bosses in the game for admins first are in it (admin-town.ts). The town is the
// street town for everyone since Nov 13 (its layout: town-street.test.ts, Timber's lodge among the homes on their lots); a player's
// town without these homes: town-player.test.ts.
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { ADMIN_BOTS, BOTS, TOWN_BOTS, createTown, homeDoor, sidekickText } = await import("../src/town/world.ts");

/** Rivet in an admin's town (docs/decisions/2026-11-03-timber-home.md): among the bots, his door the lodge's. */
describe("an admin's town: Rivet (Nov 3)", () => {
  it("walks with the other bots: the ladder's twenty, then Rivet, Timber's sidekick, his door the lodge's", () => {
    expect(TOWN_BOTS).toEqual([...BOTS, ...ADMIN_BOTS]);
    const rivet = TOWN_BOTS[20]!;
    expect(rivet.name).toBe("Rivet");
    expect(sidekickText(rivet)).toBe("Timber's sidekick");
    // (The lodge's lot, street-plan.json: its door on Fountain Street's sidewalk at (5, 31), its entry the lot's front row.)
    expect(homeDoor(rivet)).toEqual({ c: 5, r: 32 });
    const t = createTown(0, undefined, null, TOWN_BOTS.length);
    expect(t.bots.map((p) => p.bot)).toEqual(TOWN_BOTS);
    expect(t.bots.find((p) => p.bot === rivet)!.look).toBe(rivet.look);
    // Timber starts on his rest square before his lodge, as every boss does before its home.
    expect(t.bosses.find((b) => b.home.id === "timber")!.walker.here()).toEqual({ c: 7, r: 31 });
  });
});
