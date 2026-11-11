import { describe, expect, it, vi } from "vitest";

// An admin's town (Nov 3): the homes and kids of the bosses in the game for admins first are in it (admin-town.ts).
// (Today's town with those homes: STREET_TOWN off. The street town, an admin's since Nov 5, has its own tests: town-street.test.ts.)
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: false }));

const { N, wrapF, wrapI } = await import("../src/town/camera.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");
const { ALL_HOMES, ADMIN_BOTS, APRON, BOTS, COLISEUM, HOMES, LAMPS, PARK, PROPS, START, STATUES, TABLES, TOWN_BOTS, createTown, groundAt, homeDoor, inSquare, plotDist, sidekickText, stepsFrom, walkable, BOARD_GROUND } = await import("../src/town/world.ts");

/**
 * Timber's Lumber Lodge and Rivet in an admin's town (docs/decisions/2026-11-03-timber-home.md): where the lodge stands (a free
 * 3 x 3 plot, open ground all round it, nothing cut off), Timber roaming there, Rivet among the bots. The rest of the town's tests
 * run as a player, whose town has neither.
 */
const lodge = HOMES.find((h) => h.id === "timber")!;
const others = ALL_HOMES.filter((h) => h.id !== "timber");

describe("an admin's town: Timber's Lumber Lodge (Nov 3)", () => {
  it("has every home, the lodge among them, west of the Colosseum", () => {
    expect(HOMES).toEqual(ALL_HOMES);
    // (Sixteen since Dash's Kicks, Nov 3: town-dash.test.ts.)
    expect(HOMES).toHaveLength(17);
    expect(lodge).toMatchObject({ boss: "Timber", name: "Timber's Lumber Lodge", cx: 11, cy: 32, half: 1.5, foot: 0.5 });
  });

  it("its plot was free: plain ground, off the park, the Colosseum and its apron, no lamp, prop, statue or table, and clear of every other home's roaming ground", () => {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = wrapI(lodge.cx + dc);
        const r = wrapI(lodge.cy + dr);
        const at = `${c},${r}`;
        expect(groundAt[r * N + c], at).toBe(BOARD_GROUND);
        expect(c >= COLISEUM.c0 && c < COLISEUM.c0 + COLISEUM.size && r >= COLISEUM.r0 && r < COLISEUM.r0 + COLISEUM.size, at).toBe(false);
        expect(c >= PARK.c0 && c < PARK.c0 + PARK.w && r > PARK.r1 - PARK.d && r <= PARK.r1, at).toBe(false);
        for (const s of [...APRON, ...LAMPS, ...PROPS, ...STATUES, ...TABLES]) expect(s.c === c && s.r === r, at).toBe(false);
        for (const h of others) expect(plotDist(h, c, r), `${at}: ${h.id}'s ground`).toBeGreaterThan(TOWN_FEEL.bossRoam);
      }
    // Its own roaming ground stays off the park, the Colosseum and the square (the bots' ground), as every home's does.
    for (let dr = -1 - TOWN_FEEL.bossRoam; dr <= 1 + TOWN_FEEL.bossRoam; dr++)
      for (let dc = -1 - TOWN_FEEL.bossRoam; dc <= 1 + TOWN_FEEL.bossRoam; dc++) {
        const c = wrapI(lodge.cx + dc);
        const r = wrapI(lodge.cy + dr);
        expect(groundAt[r * N + c], `${c},${r}`).toBe(BOARD_GROUND);
        expect(inSquare(c, r), `${c},${r}`).toBe(false);
      }
  });

  it("stands about as far from its neighbors as the others do, with four squares of open ground to the Colosseum's wall", () => {
    const dist = (h: { cx: number; cy: number }) => Math.hypot(wrapF(h.cx - lodge.cx), wrapF(h.cy - lodge.cy));
    const near = [...others].sort((a, b) => dist(a) - dist(b));
    // Boingo's Funhouse 7.8 (south-west), Moo & Moon Meadow 8.5 (north-west): the map's 8 to 10, give or take (it was the open ground left).
    // (Since Nov 3 Dash's Kicks is nearer, 7.3 to the west: the little ground left after the lodge. town-dash.test.ts.)
    expect(near.slice(0, 3).map((h) => [h.id, Math.round(dist(h) * 10) / 10])).toEqual([
      ["dash", 7.3],
      ["clown", 7.8],
      ["moo", 8.5],
    ]);
    expect(dist(near[0]!)).toBeLessThanOrEqual(10);
    expect(Math.hypot(wrapF(START.c - lodge.cx), wrapF(START.r - lodge.cy))).toBeGreaterThanOrEqual(7.5);
    // The plot's east edge (column 12) to the Colosseum's west wall (column 17): columns 13 to 16 open.
    expect(COLISEUM.c0 - (lodge.cx + 1) - 1).toBe(4);
  });

  it("is walkable all round, and nothing is cut off: every square you can stand on is still reachable from your start, its door's square too", () => {
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const c = wrapI(lodge.cx + dc);
        const r = wrapI(lodge.cy + dr);
        expect(walkable(c, r), `${c},${r}`).toBe(plotDist(lodge, c, r) > 0);
      }
    const d = stepsFrom(START);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (walkable(c, r)) expect(d[r * N + c], `${c},${r}`).toBeGreaterThanOrEqual(0);
    // In front of its door (where "Go in" walks you, a row out of the plot's front row), in a few steps from the park.
    expect(d[wrapI(lodge.cy - 2) * N + lodge.cx]).toBeGreaterThan(0);
  });
});

describe("an admin's town: Rivet (Nov 3)", () => {
  it("walks with the other bots: the ladder's twenty, then Rivet, Timber's sidekick, his door the lodge's", () => {
    expect(TOWN_BOTS).toEqual([...BOTS, ...ADMIN_BOTS]);
    const rivet = TOWN_BOTS[20]!;
    expect(rivet.name).toBe("Rivet");
    expect(sidekickText(rivet)).toBe("Timber's sidekick");
    expect(homeDoor(rivet)).toEqual({ c: 11, r: 31 });
    const t = createTown(0, undefined, null, TOWN_BOTS.length);
    expect(t.bots.map((p) => p.bot)).toEqual(TOWN_BOTS);
    expect(t.bots.find((p) => p.bot === rivet)!.look).toBe(rivet.look);
    // Timber starts in front of his lodge, as every boss does in front of its home.
    expect(t.bosses.find((b) => b.home.id === "timber")!.walker.here()).toEqual({ c: 11, r: 30 });
  });
});
