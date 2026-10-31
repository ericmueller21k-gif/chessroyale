import { describe, expect, it } from "vitest";
import { BOSS_PARTY, DEFAULT_SETTINGS, cpFromExpected, drawMove, partyMove, scoreGroup, mulberry32 } from "../src/index.ts";

/** Expected scores whose centipawns are exactly these (cpFromExpected's curve, inverted). */
const exp = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));

describe("a Boss Battle party's move (Eric, Oct 29 and 30)", () => {
  it("reads centipawns off expected scores on Lichess's curve", () => {
    expect(cpFromExpected(0.5)).toBeCloseTo(0, 6);
    expect(cpFromExpected(exp(30))).toBeCloseTo(30, 6);
    expect(cpFromExpected(exp(-250))).toBeCloseTo(-250, 6);
    expect(cpFromExpected(1)).toBeLessThan(2100);
    expect(BOSS_PARTY.closeCp).toBe(30);
  });

  it("two or more on one move: it's played, always (even the worst of three)", () => {
    const expected = { e2e4: exp(10), d2d4: exp(-300) };
    for (let seed = 1; seed < 30; seed++) {
      expect(partyMove(["d2d4", "e2e4", "d2d4"], {}, mulberry32(seed), expected)).toBe("d2d4");
      expect(partyMove(["g1f3", "g1f3"], {}, mulberry32(seed), { g1f3: exp(-500) })).toBe("g1f3");
    }
  });

  it("no majority: the engine's best pick when the others are more than 30 cp worse", () => {
    const expected = { e2e4: exp(40), d2d4: exp(9), c2c4: exp(-200) };
    for (let seed = 1; seed < 30; seed++) {
      expect(partyMove(["e2e4", "d2d4", "c2c4"], {}, mulberry32(seed), expected)).toBe("e2e4");
      expect(partyMove(["c2c4", "d2d4"], {}, mulberry32(seed), expected)).toBe("d2d4");
    }
  });

  it("no majority, two within 30 cp: one of those at random (seeded: the same seed, the same pick), never the far one", () => {
    const expected = { e2e4: exp(40), d2d4: exp(15), c2c4: exp(-60) };
    const seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const m = partyMove(["e2e4", "d2d4", "c2c4"], {}, mulberry32(seed), expected);
      expect(m).toBe(partyMove(["e2e4", "d2d4", "c2c4"], {}, mulberry32(seed), expected));
      seen.add(m);
    }
    expect([...seen].sort()).toEqual(["d2d4", "e2e4"]);
  });

  it("one pick: it", () => {
    expect(partyMove(["h2h3"], {}, mulberry32(1), { h2h3: exp(-900) })).toBe("h2h3");
  });

  it("is the draw rule \"party\" in scoreGroup, with the judge's expected scores", () => {
    const evaluation = { bestMove: "g1f3", bestExpected: exp(50), expectedAfter: { g1f3: exp(50), e2e4: exp(45), d2d4: exp(-100), c2c4: exp(44) } };
    const picks = [
      { playerId: "a", move: "e2e4" },
      { playerId: "b", move: "d2d4" },
      { playerId: "c", move: "c2c4" },
    ];
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) seen.add(scoreGroup(picks, evaluation, mulberry32(seed), DEFAULT_SETTINGS, "party").playedMove);
    expect([...seen].sort()).toEqual(["c2c4", "e2e4"]);
    expect(drawMove(["d2d4", "d2d4", "e2e4"], { d2d4: 30, e2e4: 0 }, "party", mulberry32(3))).toBe("d2d4");
  });
});

describe("Boss Battle's no-strikes switch (Eric, Oct 31)", () => {
  it("bossKillDue never comes with bossNoStrikes; the party's settings have it", async () => {
    const { bossKillDue, bossPartySettings } = await import("../src/index.ts");
    expect(bossPartySettings("normal").bossNoStrikes).toBe(true);
    const state = { boss: { sinceKill: 9, minSurvivors: 1, kills: [] }, players: [] } as never;
    expect(bossKillDue(state, { ...DEFAULT_SETTINGS, bossNoStrikes: true })).toBe(false);
  });
});
