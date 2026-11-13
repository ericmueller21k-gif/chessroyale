import { describe, expect, it, vi } from "vitest";

// The street town (an admin's since Nov 5, everyone's since Nov 13), here as an admin's: its layout from the plan (street.ts, street-plan.json).
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true }));

const { N, wrapI } = await import("../src/town/camera.ts");
const PLAN = (await import("../src/town/street-plan.json")).default;
const { ROW_GROUND, STREET_BUILDINGS, STREET_LOTS } = await import("../src/town/street.ts");
const { ROW_SIDES } = await import("../src/town/rows.ts");
const { ALL_HOMES, APRON, ARENA, BOARD_GROUND, WALL, COLISEUM, GARDEN, GRASS, HOMES, LAMPS, LOT, PARK, PAVING, PROPS, START, STATUES, TABLES, TOWN_BOTS, bossWalks, createTown, destFor, groundAt, homeDoor, inSquare, inWander, plotAt, stepsFrom, tick, walkable } =
  await import("../src/town/world.ts");
const { hasTownBoss } = await import("../src/town/world.ts");

/**
 * The street town, round 2: the layout (Nov 5; docs/decisions/2026-11-05-street-town-layout.md). Everything where the plan says
 * (every lot, door square, wander box, walkable square and the start); the park's twelve tables; every home's door reachable and a
 * tap on its plot leading there; the bosses in their boxes, stopping only on their rest squares; the bots never stopping on a door or
 * a table's square. Today's town (a player's, and the old admin one) keeps its own tests.
 */
const KEY: Record<string, number> = { "#": BOARD_GROUND, "=": PAVING, ",": GRASS, g: GARDEN, L: LOT, A: ARENA, W: WALL };
const lotOf = (id: string) => PLAN.lots.find((l) => l.kind === "home" && l.id === (id === "dash" ? "blitz" : id))!;
const at = (c: number, r: number) => `${c},${r}`;

describe("the street town's layout is the plan's (Nov 5)", () => {
  it("is 54 x 54 (the north edge round: grown 8 rows south and so 8 columns east), every square's ground as the plan has it, the rows' squares lots (round 4: a row stands on them, drawn paved)", () => {
    expect(N).toBe(PLAN.size);
    let rows = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const row = ROW_GROUND[r * N + c] === 1;
        if (row) rows++;
        expect(groundAt[r * N + c], at(c, r)).toBe(row ? LOT : KEY[PLAN.ground[r]![c]!]);
        // (A row only stands on the plan's lots and gardens: never a street, a sidewalk or the park.)
        if (row) expect("Lg", at(c, r)).toContain(PLAN.ground[r]![c]!);
      }
    expect(rows).toBeGreaterThan(400);
  });

  it("starts you on the promenade just south of the fountain, (22, 25) (round 4: the plan's rows moved up 6; the north edge round: 8 more), on paving", () => {
    expect(START).toEqual({ c: PLAN.start.c, r: PLAN.start.r });
    expect(START).toEqual({ c: 22, r: 25 });
    expect(PLAN.start.heading).toBe(0);
    expect(walkable(START.c, START.r)).toBe(true);
  });

  it("has all seventeen homes (an admin's, Rolling Dough the seventeenth since Nov 11), each on its lot, its picture's foot on the lot's front line, centred", () => {
    expect(HOMES).toEqual(ALL_HOMES);
    expect(HOMES).toHaveLength(18);
    for (const h of HOMES) {
      const l = lotOf(h.id);
      expect(h.cx, h.id).toBe(l.c0 + (l.w - 1) / 2);
      expect(h.cy - h.foot, h.id).toBeCloseTo(l.r0 - 0.5 + l.inset, 9);
      expect(h.door, h.id).toEqual(l.door);
      expect(h.rest, h.id).toEqual(l.rest);
      expect(h.wander, h.id).toEqual(l.wander);
      expect(h.entry, h.id).toEqual({ c: l.door!.c, r: l.r0 });
      // Its plot is its lot, every square of it, and nothing else.
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          const on = c >= l.c0 && c < l.c0 + l.w && r >= l.r0 && r < l.r0 + l.d;
          expect(plotAt[r * N + c] === h, `${h.id} ${at(c, r)}`).toBe(on);
        }
    }
  });

  it("stands every row's front on its row's building line facing its street (round 4), the skyline's towers on their lots, and every prop where the plan puts it but under a row", () => {
    const fronts = PROPS.filter((p) => p.kind === "front");
    expect(fronts).toHaveLength(STREET_BUILDINGS.length);
    // (The rows replace every everyday building; the tall ones stay, each a tower of look-alike parts.)
    expect(STREET_BUILDINGS.filter((b) => b.kind === "tall")).toHaveLength(PLAN.lots.filter((l) => l.kind === "tall").length);
    for (const b of STREET_BUILDINGS) {
      // (Round 5: the back wall and the Colosseum's side walls: their own art, where the plan puts them.)
      if (b.kind === "wall") {
        expect(b.wall && b.at, b.name).toBeTruthy();
        continue;
      }
      // (The north edge round: the Colosseum's ring, its stretches facing out from its oval.)
      if (b.kind === "ring") {
        expect(b.at && b.dir && b.ring !== undefined, b.name).toBeTruthy();
        continue;
      }
      expect(b.look && b.at, b.name).toBeTruthy();
      if (b.kind === "tall") continue;
      const side = ROW_SIDES.find((s) => s.street === b.street && s.facing === b.facing && Math.abs((b.facing === "S" || b.facing === "N" ? b.at!.y : b.at!.x) - (b.facing === "S" || b.facing === "W" ? s.d0 - 0.5 + s.inset : s.d0 + 0.5 - s.inset)) < 1e-9);
      expect(side, b.name).toBeTruthy();
    }
    for (const p of fronts) {
      const b = STREET_BUILDINGS[p.lot!]!;
      expect([p.x, p.y], b.name).toEqual([b.at!.x, b.at!.y]);
    }
    const others = PROPS.filter((p) => p.kind !== "front").map((p) => ({ kind: p.kind, x: p.x, y: p.y, v: p.v }));
    const under = (p: { kind: string; x: number; y: number }) => p.kind !== "lamp" && ROW_GROUND[wrapI(Math.round(p.y)) * N + wrapI(Math.round(p.x))] === 1;
    expect(others).toEqual(PLAN.props.filter((p) => !under(p)));
    expect(LAMPS).toHaveLength(PLAN.props.filter((p) => p.kind === "lamp").length);
    // (A lamp stands on a sidewalk, never under a row.)
    for (const l of LAMPS) expect(ROW_GROUND[l.r * N + l.c], at(l.c, l.r)).toBe(0);
    expect(STREET_LOTS.filter((l) => l.kind === "home")).toHaveLength(18);
  });

  it("no lamp stands in front of a boss's home (Eric, Nov 7: \"lamp posts right in front of Big Boy's Crib and Dash's Kicks… it just looks bad\"): none in any home's frontage box, its lot's width (its picture's, shifted) and half a square either side, from its front to the street's walking line", () => {
    const MARGIN = 0.5;
    const homes = STREET_LOTS.filter((l) => l.kind === "home");
    expect(homes).toHaveLength(18);
    for (const h of homes) {
      // (Every home's front faces south, onto the sidewalk row just south of it: the walking line is that row's street edge.)
      expect(h.facing, h.id).toBe("S");
      const s = h.shift ?? 0;
      const x0 = h.c0 - 0.5 + Math.min(0, s) - MARGIN;
      const x1 = h.c0 + h.w - 0.5 + Math.max(0, s) + MARGIN;
      const y0 = h.r0 - 1.5;
      const y1 = h.r0 - 0.5 + h.inset;
      for (const l of LAMPS) expect(l.c >= x0 && l.c <= x1 && l.r >= y0 && l.r <= y1, `the lamp at ${at(l.c, l.r)} is in ${h.id}'s frontage`).toBe(false);
    }
  });

  it("walks on the streets, sidewalks and the park, round everything standing there, never on a lot, a garden or the Colosseum", () => {
    const solid = new Set<string>();
    for (const p of PLAN.props) if (["tree", "bench", "lamp", "table", "shed"].includes(p.kind)) solid.add(at(Math.round(p.x), Math.round(p.y)));
    for (const f of PLAN.park.fountain) solid.add(at(f.c, f.r));
    let n = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const g = PLAN.ground[r]![c]!;
        const want = (g === "#" || g === "=" || g === ",") && !solid.has(at(c, r));
        expect(walkable(c, r), at(c, r)).toBe(want);
        if (want) n++;
      }
    // (And all of it is one: from the start every walkable square is reached.)
    const d = stepsFrom(START);
    let reached = 0;
    for (let k = 0; k < N * N; k++) if (d[k]! >= 0) reached++;
    expect(reached).toBe(n);
  });

  it("keeps the Colosseum, its apron and its statues where they were", () => {
    expect(COLISEUM).toEqual({ c0: PLAN.coliseum.c0, r0: PLAN.coliseum.r0, size: PLAN.coliseum.size });
    expect(STATUES.map((s) => ({ c: s.c, r: s.r }))).toEqual(PLAN.coliseum.statues);
    for (const s of APRON) expect(groundAt[s.r * N + s.c], at(s.c, s.r)).toBe(PAVING);
    for (const g of PLAN.coliseum.gate) expect(APRON.slice(0, 2)).toContainEqual({ c: g.c, r: g.r });
  });
});

describe("the park: the plus with its twelve tables (Nov 5)", () => {
  it("has twelve tables where the plan has them, each with a stool west and east, the stools walkable and the tables not", () => {
    expect(PARK).toEqual({ c0: 13, r1: 34, w: 20, d: 12 });
    expect(TABLES).toHaveLength(12);
    expect(TABLES.map((t) => ({ c: t.c, r: t.r }))).toEqual(PLAN.park.tables);
    for (const t of TABLES) {
      expect(t.stools).toEqual([
        { c: t.c - 1, r: t.r },
        { c: t.c + 1, r: t.r },
      ]);
      expect(walkable(t.c, t.r)).toBe(false);
      for (const s of t.stools) expect(walkable(s.c, s.r), at(s.c, s.r)).toBe(true);
      // (Each table's prop says which table it is.)
      expect(PROPS.find((p) => p.kind === "table" && p.c === t.c && p.r === t.r)?.table).toBe(t.i);
    }
  });
});

describe("the homes' doors (Nov 5: a tap on a home walks you to its door square)", () => {
  it("every door square is on the sidewalk before its home, walkable, reached from the start, and in its boss's box", () => {
    const d = stepsFrom(START);
    for (const h of HOMES) {
      expect(groundAt[h.door.r * N + h.door.c], h.id).toBe(PAVING);
      expect(walkable(h.door.c, h.door.r), h.id).toBe(true);
      expect(d[h.door.r * N + h.door.c], h.id).toBeGreaterThan(0);
      expect(inWander(h, h.door.c, h.door.r), h.id).toBe(true);
      // (Right before its plot: the square behind the door is the lot's.)
      expect(plotAt[wrapI(h.door.r + 1) * N + h.door.c], h.id).toBe(h);
    }
  });

  it("a tap on any square of a home's plot, or on the home, walks you to its door square", () => {
    const t = createTown(0);
    t.nextBotAt = Infinity;
    // (Nobody in the way: the bosses and bots off the board.)
    for (const w of t.all) if (w !== t.you.walker) w.c = w.r = -100;
    for (const h of HOMES) {
      expect(destFor(t, t.you.walker, { kind: "home", home: h }), h.id).toEqual(h.door);
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) if (plotAt[r * N + c] === h) expect(destFor(t, t.you.walker, { kind: "square", c, r }), `${h.id} ${at(c, r)}`).toEqual(h.door);
    }
  });

  it("a sidekick goes home through its boss's door: it fades at the plot's square behind the door square", () => {
    for (const b of TOWN_BOTS) {
      if (!b.boss) continue;
      const h = HOMES.find((x) => x.id === b.boss)!;
      expect(homeDoor(b), b.name).toEqual(h.entry);
    }
  });
});

describe("the bosses and the bots (Nov 5)", () => {
  /** Ten minutes of the town at a 30 fps tick, `check` at each. */
  function run(check: (t: ReturnType<typeof createTown>, now: number) => void) {
    const t = createTown(0, 20261105);
    t.turnMs = 20_000; // (the turns faster, so bots come and go many times)
    let now = 0;
    for (let i = 0; i < 10 * 60 * 30; i++) {
      tick(t, (now += 33));
      check(t, now);
    }
    return t;
  }

  it("each boss starts on its rest square, walks only its own box, and stops only on its rest square", () => {
    const t = createTown(0);
    for (const b of t.bosses) expect(b.walker.here(), b.home.id).toEqual(b.home.rest);
    const moved = new Set<string>();
    run((tw) => {
      for (const b of tw.bosses) {
        const h = b.walker.here();
        expect(bossWalks(b.home, h.c, h.r), `${b.home.id} at ${at(h.c, h.r)}`).toBe(true);
        if (!b.walker.moving()) expect(h, b.home.id).toEqual(b.home.rest);
        else moved.add(b.home.id);
      }
    });
    // (Every boss walks now and then: a lamp beside its rest square is passed, not a wall.)
    expect([...moved].sort()).toEqual(HOMES.filter(hasTownBoss).map((h) => h.id).sort());
  });

  it("the bots walk the streets, sidewalks and park: never stopping on a door square, a table's square or a boss's box", () => {
    const doors = new Set(HOMES.map((h) => at(h.door.c, h.door.r)));
    const tables = new Set(TABLES.map((tb) => at(tb.c, tb.r)));
    const seen = new Set<string>();
    run((tw) => {
      for (const p of tw.bots) {
        if (p.home) continue;
        const w = p.walker;
        const g = w.goal();
        expect(tables.has(at(w.hereC(), w.hereR())), `${p.name} on a table`).toBe(false);
        // (Going home a sidekick steps over its door square onto its plot, behind its door: never stopping on it.)
        if (!p.going && p.leaves === Infinity) {
          expect(doors.has(at(g.c, g.r)), `${p.name} stops on a door at ${at(g.c, g.r)}`).toBe(false);
          if (!w.moving()) seen.add(at(w.c, w.r));
        }
      }
    });
    for (const k of seen) {
      const [c, r] = k.split(",").map(Number) as [number, number];
      expect(walkable(c, r), k).toBe(true);
      expect(HOMES.some((h) => inWander(h, c, r)), k).toBe(false);
    }
    // (The bots' ground is every walkable square off the bosses' boxes.)
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) expect(inSquare(c, r), at(c, r)).toBe(groundAt[r * N + c]! <= GRASS && !HOMES.some((h) => inWander(h, c, r)));
  });
});

describe("Rolling Dough stands clear of the other homes (Eric, Nov 11: \"make sure his building is not right next to another one\")", () => {
  it("its lot is at least 4 squares from every other home's lot (look-alike fronts between, never a shared wall), the most open of its row", () => {
    const N0 = N;
    const homes = STREET_LOTS.filter((l) => l.kind === "home");
    const zebra = homes.find((l) => l.id === "zebra")!;
    // (The gap between two lots: across (round the east-west wrap) or along, whichever is wider; 0 when they touch.)
    const gap = (a: typeof zebra, b: typeof zebra) => {
      const dc = Math.min(...[0, N0, -N0].map((k) => Math.max(0, Math.max(a.c0, b.c0 + k) - Math.min(a.c0 + a.w, b.c0 + k + b.w))));
      const dr = Math.max(0, Math.max(a.r0, b.r0) - Math.min(a.r0 + a.d, b.r0 + b.d));
      return Math.max(dc, dr);
    };
    for (const h of homes) if (h !== zebra) expect(gap(zebra, h), h.id).toBeGreaterThanOrEqual(4);
  });
});
