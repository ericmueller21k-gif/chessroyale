import { describe, expect, it } from "vitest";
import {
  BATTLE_TOWER,
  BOSS_ROSTER,
  ENGINE_MAX_ELO,
  adminFirstBosses,
  finishFloor,
  floorBossCount,
  floorStrength,
  hiddenBosses,
  leaveFloor,
  newRun,
  playableBosses,
  sideRefusal,
  startFloor,
  towerPool,
  type TowerRun,
} from "../src/index.ts";

/**
 * The Battle Tower's climb (core tower.ts; docs/decisions/2026-11-18-battle-tower-design.md, section 3): the floors' pattern and
 * strength (the design's table), the deal, the run's steps, and audit 1's finding 7 (what a floor's start takes). The runner's side
 * of finding 7 (every boss at the floor's strength) is in packages/chess/test/several-bosses.test.ts.
 */

const apart = (a: string, b: string) => BATTLE_TOWER.apart.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
/** Every floor won to the top (or up to floor `to`, open), from `seed`. */
const climb = (seed: number, pool: readonly string[], to?: number): TowerRun => {
  let run = newRun(seed, pool);
  while (run.status === "open" && (to === undefined || run.floors.length < to)) run = finishFloor(run, "won", pool);
  return run;
};
/** The pool once the bosses in the game for admins first are live (18: Dash, and his `apart` pair with Smudgy, in it). */
const fullPool = [...towerPool(), ...adminFirstBosses().map((b) => b.id)];

describe("the tower: floors and strength", () => {
  it("the boss count loops 1, 2, 2, 3 over the 99 floors", () => {
    expect(BATTLE_TOWER.floors).toBe(99);
    expect(BATTLE_TOWER.pattern).toEqual([1, 2, 2, 3]);
    expect(Array.from({ length: 8 }, (_, i) => floorBossCount(i + 1))).toEqual([1, 2, 2, 3, 1, 2, 2, 3]);
    expect([97, 96, 98, 99].map((f) => floorBossCount(f))).toEqual([1, 3, 2, 2]);
  });

  it("the design's table, row by row (floor, bosses, brain, rating)", () => {
    const row = (f: number) => {
      const n = floorBossCount(f);
      const s = floorStrength(f, n);
      return [f, n, s.full ? "full" : s.brain, s.rating];
    };
    expect([1, 2, 3, 4, 5, 10, 15, 18, 20, 50, 51, 60, 79, 80, 99].map(row)).toEqual([
      [1, 1, "maia", 800],
      [2, 2, "maia", 700],
      [3, 2, "maia", 800],
      [4, 3, "maia", 900],
      [5, 1, "maia", 1200],
      [10, 2, "maia", 1500],
      [15, 2, "maia", 2000],
      [18, 2, "maia", 2300],
      [20, 3, "maia", 2500],
      [50, 2, "maia", 2500],
      [51, 2, "stockfish", 2500],
      [60, 3, "stockfish", 2725],
      [79, 2, "stockfish", ENGINE_MAX_ELO],
      [80, 3, "full", ENGINE_MAX_ELO],
      [99, 2, "full", ENGINE_MAX_ELO],
    ]);
  });

  it("every floor: Maia +100 a floor to 2500 and held there to floor 50, a lone boss +200 within it; Stockfish from 51, +25 a floor, held at its ceiling on 79; its best from 80", () => {
    for (let f = 1; f <= 99; f++) {
      const n = floorBossCount(f);
      const s = floorStrength(f, n);
      if (f <= 50) {
        expect(s).toEqual({ brain: "maia", rating: Math.min(2500, 600 + 100 * (f - 1) + (n === 1 ? 200 : 0)), full: false });
        // (A lone boss plays more, never less, than the same floor with company.)
        expect(floorStrength(f, 1).rating).toBeGreaterThanOrEqual(floorStrength(f, 2).rating);
      } else if (f < 80) {
        expect(s).toEqual({ brain: "stockfish", rating: Math.min(ENGINE_MAX_ELO, 2500 + 25 * (f - 51) + (n === 1 ? 200 : 0)), full: false });
      } else {
        expect(s).toEqual({ brain: "stockfish", rating: ENGINE_MAX_ELO, full: true });
      }
      expect(floorStrength(f, 3)).toEqual(floorStrength(f, 2));
    }
  });
});

describe("the tower: the pool and the deal", () => {
  it("the pool: every playable boss, never the hidden one nor one in the game for admins first, never one resting", () => {
    const pool = towerPool();
    expect(pool).toEqual(playableBosses().map((b) => b.id));
    expect(pool.length).toBe(14);
    for (const id of [...hiddenBosses(), ...adminFirstBosses()].map((b) => b.id)) expect(pool).not.toContain(id);
    for (const id of pool) expect(BOSS_ROSTER.find((b) => b.id === id)!.powers).not.toBeNull();
    expect(towerPool(["moo", "clown"])).toEqual(pool.filter((id) => id !== "moo" && id !== "clown"));
    // (Every one resting: the whole pool, as every mode (rosterWithout): the ways in close first.)
    expect(towerPool(pool)).toEqual(pool);
  });

  it("over many seeds: every boss once before any twice, never one on two floors in a row, never an apart pair, each floor's count; the same seed, the same run", () => {
    for (const pool of [towerPool(), fullPool]) {
      const problems: string[] = [];
      const runs = new Set<string>();
      for (let seed = 1; seed <= 300; seed++) {
        const run = climb(seed * 7919, pool);
        if (run.status !== "top" || run.floors.length !== 99) problems.push(`${seed}: ${run.status} at ${run.floors.length}`);
        // (Read in the order dealt, each stretch of the pool's size is the whole pool: a deck. The last, cut short, has no boss twice.)
        const dealt = run.floors.flat();
        for (let i = 0; i < dealt.length; i += pool.length) {
          const deck = dealt.slice(i, i + pool.length);
          if (new Set(deck).size < deck.length || (deck.length === pool.length && pool.some((id) => !deck.includes(id)))) problems.push(`${seed}: a boss twice in the deck from ${i}`);
        }
        run.floors.forEach((bosses, i) => {
          if (bosses.length !== floorBossCount(i + 1)) problems.push(`${seed}: floor ${i + 1} has ${bosses.length}`);
          const refused = sideRefusal(bosses, pool);
          if (refused) problems.push(`${seed}: floor ${i + 1}: ${refused}`);
          if (bosses.some((a) => bosses.some((b) => apart(a, b)))) problems.push(`${seed}: floor ${i + 1} an apart pair`);
          if (i && bosses.some((b) => run.floors[i - 1]!.includes(b))) problems.push(`${seed}: floor ${i + 1} repeats floor ${i}`);
        });
        if (JSON.stringify(climb(seed * 7919, pool)) !== JSON.stringify(run)) problems.push(`${seed}: another run from the same seed`);
        runs.add(JSON.stringify(run.floors));
      }
      expect(problems).toEqual([]);
      expect(runs.size).toBe(300);
    }
  });

  it("a pool the kill switches leave too small for the rules: never thrown, never an apart pair, at least one boss a floor", () => {
    for (const pool of [["gingerbread", "clown"], ["hollow", "smudgy"], ["gingerbread"], ["hollow", "smudgy", "alfil", "grex"]]) {
      const run = climb(5, pool);
      expect(run.status).toBe("top");
      for (const bosses of run.floors) {
        expect(bosses.length).toBeGreaterThan(0);
        expect(sideRefusal(bosses, pool)).toBeNull();
      }
      // (The deck holds less than two of the pool's decks: it never grows floor by floor.)
      expect(run.deck.length).toBeLessThan(2 * pool.length);
    }
  });
});

describe("the tower: the run's steps", () => {
  const pool = towerPool();

  it("a new run: floor 1 dealt, open", () => {
    const run = newRun(42, pool);
    expect(run.status).toBe("open");
    expect(run.floors.length).toBe(1);
    expect(run.floors[0]!.length).toBe(1);
    expect(pool).toContain(run.floors[0]![0]);
  });

  it("a win climbs: the next floor dealt as it's won; a loss or a draw ends the run; a finished run stays as it is", () => {
    const run = newRun(42, pool);
    const won = finishFloor(run, "won", pool);
    expect(won.status).toBe("open");
    expect(won.floors.length).toBe(2);
    expect(won.floors[0]).toEqual(run.floors[0]);
    expect(won.floors[1]!.length).toBe(2);
    for (const outcome of ["lost", "drawn"] as const) {
      const out = finishFloor(won, outcome, pool);
      expect(out).toEqual({ ...won, status: "out" });
      expect(finishFloor(out, "won", pool)).toBe(out);
    }
  });

  it("leaving: free before your 2nd move (the same floor, the same bosses), a loss after", () => {
    const run = finishFloor(newRun(42, pool), "won", pool);
    expect(leaveFloor(run, 0)).toBe(run);
    expect(leaveFloor(run, 1)).toBe(run);
    expect(leaveFloor(run, 2)).toEqual({ ...run, status: "out" });
    expect(leaveFloor(run, 30).status).toBe("out");
  });

  it("floor 99 won: the run is complete (top), and stays so", () => {
    const at99 = climb(42, pool, 99);
    expect(at99.status).toBe("open");
    expect(at99.floors.length).toBe(99);
    const top = finishFloor(at99, "won", pool);
    expect(top).toEqual({ ...at99, status: "top" });
    expect(finishFloor(top, "lost", pool)).toBe(top);
    expect(startFloor(top, pool)).toBeNull();
  });
});

describe("the tower: a floor's start (audit 1, finding 7)", () => {
  const pool = towerPool();

  it("takes its bosses from the run's deal, never from anywhere else: the floor, its bosses in turn order", () => {
    const run = climb(42, pool, 4);
    const start = startFloor(run, pool)!;
    expect(start.run).toBe(run);
    expect(start.settings).toEqual({ towerFloor: 4, bossId: run.floors[3]![0], bossIds: run.floors[3], bossAvoid: "" });
    expect(startFloor({ ...run, status: "out" }, pool)).toBeNull();
  });

  it("honors the kill switches: a resting boss is never dealt; a deal holding one since is dealt again at the start, and stays so", () => {
    const off = ["moo", "folio", "tiger"];
    const rested = towerPool(off);
    for (let seed = 1; seed <= 50; seed++) for (const bosses of climb(seed, rested).floors) for (const id of off) expect(bosses).not.toContain(id);
    // (Floor 4 dealt with Moo on it; then Moo rests.)
    let run = newRun(1, pool);
    while (!run.floors[run.floors.length - 1]!.includes("moo")) run = finishFloor(run, "won", pool);
    const floor = run.floors.length;
    const start = startFloor(run, towerPool(["moo"]))!;
    const bosses = start.run.floors[floor - 1]!;
    expect(bosses).not.toContain("moo");
    expect(bosses.length).toBe(run.floors[floor - 1]!.length);
    expect(sideRefusal(bosses, towerPool(["moo"]))).toBeNull();
    for (const b of bosses) expect(run.floors[floor - 2] ?? []).not.toContain(b);
    // (The others dealt stay on the floor; the floors before are as they were.)
    for (const b of run.floors[floor - 1]!.filter((id) => id !== "moo")) expect(bosses).toContain(b);
    expect(start.run.floors.slice(0, -1)).toEqual(run.floors.slice(0, -1));
    expect(start.settings.bossIds).toEqual(bosses);
    expect(startFloor(start.run, towerPool(["moo"]))!.run).toBe(start.run);
  });

  it("a deal that can't be played (a saved run's: an unknown boss, one twice, an apart pair, none, four) is dealt again, never thrown", () => {
    const run = climb(42, pool, 4);
    for (const bad of [["nobody", "clown"], ["clown", "clown"], ["hollow", "smudgy"], ["alfil", "grex", "moo"], [], ["gingerbread", "clown", "moo", "bigboy"]]) {
      const saved: TowerRun = { ...run, floors: [...run.floors.slice(0, -1), bad] };
      expect(sideRefusal(bad, pool)).not.toBeNull();
      const start = startFloor(saved, pool)!;
      const bosses = start.run.floors[3]!;
      expect(bosses.length).toBe(3);
      expect(sideRefusal(bosses, pool)).toBeNull();
      for (const b of bosses) expect(run.floors[2]).not.toContain(b);
      expect(start.settings.bossIds).toEqual(bosses);
    }
  });
});
