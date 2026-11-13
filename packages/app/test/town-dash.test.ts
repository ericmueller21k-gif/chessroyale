import { describe, expect, it, vi } from "vitest";

// An admin's town (Nov 3): the homes and kids of the bosses in the game for admins first are in it (admin-town.ts).
// (Today's town with those homes: STREET_TOWN off. The street town, an admin's since Nov 5, has its own tests: town-street.test.ts.)
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: false }));

const { N, wrapF, wrapI } = await import("../src/town/camera.ts");
const { TOWN_FEEL } = await import("../src/town/feel.ts");
const { HOUSES } = await import("../src/town/houses/index.ts");
const { ALL_HOMES, ADMIN_BOTS, APRON, BOTS, COLISEUM, HOMES, LAMPS, PARK, PROPS, START, STATUES, TABLES, TOWN_BOTS, createTown, groundAt, homeDoor, inSquare, plotDist, sidekickText, stepsFrom, walkable, BOARD_GROUND } = await import("../src/town/world.ts");

/**
 * Dash's Kicks and Tick in an admin's town (docs/decisions/2026-11-03-dash-home.md): where the store stands (a free 3 x 3 plot,
 * open ground all round it, nothing cut off, the hanging sneakers' pole on its own plot), Dash roaming there, Tick among the bots.
 * The rest of the town's tests run as a player, whose town has neither.
 */
const kicks = HOMES.find((h) => h.id === "dash")!;
const others = ALL_HOMES.filter((h) => h.id !== "dash");

describe("an admin's town: Dash's Kicks (Nov 3)", () => {
  it("has every home, the store among them, beside Timber's lodge in the west", () => {
    expect(HOMES).toEqual(ALL_HOMES);
    expect(HOMES).toHaveLength(18);
    expect(kicks).toMatchObject({ boss: "Dash", name: "Dash's Kicks", cx: 4, cy: 34, half: 1.5, foot: 0.5 });
  });

  it("its plot was free: plain ground, off the park, the Colosseum and its apron, no lamp, prop, statue, table or path, and clear of every other home's roaming ground", () => {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = wrapI(kicks.cx + dc);
        const r = wrapI(kicks.cy + dr);
        const at = `${c},${r}`;
        expect(groundAt[r * N + c], at).toBe(BOARD_GROUND);
        expect(c >= COLISEUM.c0 && c < COLISEUM.c0 + COLISEUM.size && r >= COLISEUM.r0 && r < COLISEUM.r0 + COLISEUM.size, at).toBe(false);
        expect(c >= PARK.c0 && c < PARK.c0 + PARK.w && r > PARK.r1 - PARK.d && r <= PARK.r1, at).toBe(false);
        for (const s of [...APRON, ...LAMPS, ...PROPS, ...STATUES, ...TABLES]) expect(s.c === c && s.r === r, at).toBe(false);
        for (const h of others) expect(plotDist(h, c, r), `${at}: ${h.id}'s ground`).toBeGreaterThan(TOWN_FEEL.bossRoam);
      }
    // Its own roaming ground stays on plain board (no path: groundAt's paving), off the park, the Colosseum and the square (the bots' ground).
    for (let dr = -1 - TOWN_FEEL.bossRoam; dr <= 1 + TOWN_FEEL.bossRoam; dr++)
      for (let dc = -1 - TOWN_FEEL.bossRoam; dc <= 1 + TOWN_FEEL.bossRoam; dc++) {
        const c = wrapI(kicks.cx + dc);
        const r = wrapI(kicks.cy + dr);
        expect(groundAt[r * N + c], `${c},${r}`).toBe(BOARD_GROUND);
        expect(inSquare(c, r), `${c},${r}`).toBe(false);
      }
  });

  it("the hanging sneakers' pole on its right stands on its own plot (its east column), with open ground east of it before the lodge", () => {
    const art = HOUSES.dash.ch;
    expect([art.w, art.h, ...art.foot]).toEqual([144, 134, 72, 128]);
    // (The art's 144 px are its plot's 3 squares, 48 a square: the pole, x 135 to 138, is in the east column's last quarter.)
    const pole = art.anims.idle!.frames[0]!.layers.find((l) => l.part === "pole")!;
    const sq = art.w / 3;
    expect(Math.floor((pole.x - (art.foot[0] - art.w / 2)) / sq) - 1).toBe(1);
    expect(pole.x + 4).toBeLessThanOrEqual(art.w);
    // East of the plot (column 6) open, walkable ground to the lodge's plot (columns 10 to 12): columns 6 to 9.
    const lodge = HOMES.find((h) => h.id === "timber")!;
    expect(lodge.cx - 1 - (kicks.cx + 1) - 1).toBe(4);
    for (let r = kicks.cy - 1; r <= kicks.cy + 1; r++) expect(walkable(kicks.cx + 2, r), `${kicks.cx + 2},${r}`).toBe(true);
  });

  it("stands as near its neighbors as the little ground left allows (7.1 to 7.6), far from your start", () => {
    const dist = (h: { cx: number; cy: number }) => Math.hypot(wrapF(h.cx - kicks.cx), wrapF(h.cy - kicks.cy));
    const near = [...others].sort((a, b) => dist(a) - dist(b));
    // Boingo's Funhouse 7.1 (north), Moo & Moon Meadow 7.2 (south-east), Timber's Lumber Lodge 7.3 (east), Big Boy's Crib 7.6 (west,
    // over the wrap): the map's 8 to 10 fits nowhere now; every other free plot has a neighbor nearer than 7.1.
    expect(near.slice(0, 4).map((h) => [h.id, Math.round(dist(h) * 10) / 10])).toEqual([
      ["clown", 7.1],
      ["moo", 7.2],
      ["timber", 7.3],
      ["bigboy", 7.6],
    ]);
    expect(Math.hypot(wrapF(START.c - kicks.cx), wrapF(START.r - kicks.cy))).toBeGreaterThanOrEqual(7.5);
  });

  it("is walkable all round, and nothing is cut off: every square you can stand on is still reachable from your start, its door's square too", () => {
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const c = wrapI(kicks.cx + dc);
        const r = wrapI(kicks.cy + dr);
        expect(walkable(c, r), `${c},${r}`).toBe(plotDist(kicks, c, r) > 0);
      }
    const d = stepsFrom(START);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (walkable(c, r)) expect(d[r * N + c], `${c},${r}`).toBeGreaterThanOrEqual(0);
    // In front of its door (where "Go in" walks you, a row out of the plot's front row).
    expect(d[wrapI(kicks.cy - 2) * N + kicks.cx]).toBeGreaterThan(0);
  });
});

describe("an admin's town: Tick (Nov 3)", () => {
  it("walks with the other bots: the ladder's twenty, Rivet, then Tick, Dash's sidekick, his door the store's", () => {
    expect(TOWN_BOTS).toEqual([...BOTS, ...ADMIN_BOTS]);
    const tick = TOWN_BOTS[21]!;
    expect(tick.name).toBe("Tick");
    expect(tick.rating).toBe(1850);
    expect(sidekickText(tick)).toBe("Dash's sidekick");
    expect(homeDoor(tick)).toEqual({ c: 4, r: 33 });
    const t = createTown(0, undefined, null, TOWN_BOTS.length);
    expect(t.bots.map((p) => p.bot)).toEqual(TOWN_BOTS);
    expect(t.bots.find((p) => p.bot === tick)!.look).toBe(tick.look);
    // Dash starts in front of his store, as every boss does in front of its home.
    expect(t.bosses.find((b) => b.home.id === "dash")!.walker.here()).toEqual({ c: 4, r: 32 });
  });
});
