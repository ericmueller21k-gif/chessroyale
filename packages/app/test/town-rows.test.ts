import { describe, expect, it, vi } from "vitest";

// An admin's town is the street town (admin-town.ts STREET_TOWN): round 4's rows and chase camera (Nov 5; the mockup's first cut).
vi.mock("../src/town/admin-town.ts", () => ({ ADMIN_TOWN: true, STREET_TOWN: true }));

const { layRow, ROW_SIDES, homeSpan, splitGap, HOME_BODY } = await import("../src/town/rows.ts");
const { homeBox } = await import("../src/town/home-boxes.ts");
const { lookalikeWith } = await import("../src/town/lookalike.ts");
const { STREET_LOTS, colosseumSeen } = await import("../src/town/street.ts");
const { chaseTarget } = await import("../src/town/turn.ts");

const HOME_IDS = ["timber", "sawyer", "gingerbread", "grex", "clown", "tiger", "bigboy", "hollow"] as const;

/** Every point of a row side from end to end is covered by a front, each butting the next. */
function covered(side: (typeof ROW_SIDES)[number], placed: ReturnType<typeof layRow>) {
  expect(placed[0]!.s0).toBeCloseTo(side.a0, 6);
  expect(placed[placed.length - 1]!.s1).toBeCloseTo(side.a1, 6);
  for (let i = 1; i < placed.length; i++) expect(placed[i]!.s0, `${side.id}: front ${i} butts the one before`).toBeCloseTo(placed[i - 1]!.s1, 6);
  for (const p of placed) expect(p.s1 - p.s0, `${side.id}: no front under ${0.5} squares`).toBeGreaterThan(0.5);
}

describe("the rows (round 4)", () => {
  it("each of Fountain Street's sides is covered from corner to corner by fronts butted edge to edge", () => {
    for (const side of ROW_SIDES) {
      const homes = STREET_LOTS.filter((l) => l.kind === "home" && l.street === side.street && l.facing === side.facing && l.c0 > side.a0 && l.c0 < side.a1).map((l) => ({ id: l.id as never, a: l.c0, w: l.w }));
      covered(side, layRow(side, homes));
    }
  });
  it("after random swaps (homes moved, removed or added, other seeds) every side is still covered", () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 300; n++) {
      const side = { ...ROW_SIDES[n % ROW_SIDES.length]!, seed: Math.floor(r() * 1e6), landmark: r() < 0.5 };
      const homes: { id: (typeof HOME_IDS)[number]; a: number; w: number }[] = [];
      let a = side.a0 + 0.5 + Math.floor(r() * 3);
      while (a + 4 <= side.a1 + 0.5 && r() < 0.7) {
        homes.push({ id: HOME_IDS[Math.floor(r() * HOME_IDS.length)]!, a, w: 4 });
        a += 4 + Math.floor(r() * 3);
      }
      covered(side, layRow(side, homes));
    }
  });
  it("a gap of any length splits into look-alikes of at least 0.6 squares that add up to it", () => {
    for (let len = 0.6; len < 12; len += 0.37) {
      const ws = splitGap(len, Math.random);
      expect(ws.reduce((s, w) => s + w, 0)).toBeCloseTo(len, 6);
      for (const w of ws) expect(w).toBeGreaterThanOrEqual(0.6 - 1e-9);
    }
  });
  it("the rows' copy of each home's body matches its art", () => {
    for (const [id, [w, x0, x1]] of Object.entries(HOME_BODY)) {
      const b = homeBox(id as never);
      expect([b.front.w, b.body.x0, b.body.x1], id).toEqual([w, x0, x1]);
    }
  });
  it("a home's body is centred on its lot", () => {
    const [s0, s1] = homeSpan("timber", 3, 4, "S");
    expect((s0 + s1) / 2).toBeGreaterThan(4);
    expect((s0 + s1) / 2).toBeLessThan(5);
  });
  it("a look-alike's wall fills every column of its picture at the ground floor (no gap to its neighbour)", () => {
    for (let seed = 1; seed < 40; seed++) {
      const { box } = lookalikeWith({ seed, w: 20 + seed * 3, tall: (seed % 4) as 0 | 1 | 2 | 3, depth: 2.3 });
      expect(box.body.x0).toBe(0);
      expect(box.body.x1).toBe(box.front.w);
    }
  });
});

describe("the chase camera's heading (round 4)", () => {
  it("keys: forward stays, left and right turn a quarter, back doesn't turn", () => {
    expect(chaseTarget(0, 0, 1, 1, true, true)).toBe(0);
    expect(chaseTarget(0, 1, 0, 1, true, true)).toBe(90);
    expect(chaseTarget(0, -1, 0, 1, true, true)).toBe(-90);
    expect(chaseTarget(0, 0, -1, 1, true, true)).toBe(0);
    expect(chaseTarget(270, 0, 1, 1, true, true)).toBe(360);
  });
  it("a tap's path: turns for a leg of 2 or more, or the last leg; not for a 1-square jog", () => {
    expect(chaseTarget(0, 1, 0, 1, false, false)).toBe(0);
    expect(chaseTarget(0, 1, 0, 2, false, false)).toBe(90);
    expect(chaseTarget(0, 1, 0, 1, true, false)).toBe(90);
    expect(chaseTarget(0, 0, -1, 3, false, false)).toBe(180);
  });
});

describe("the Colosseum hides behind the rows (round 4)", () => {
  it("shows from the park's promenade, facing it; hides from Fountain Street behind its north row", () => {
    expect(colosseumSeen(22, 16)).toBe(true);
    expect(colosseumSeen(8, 15)).toBe(false);
  });
});
