import { describe, expect, it } from "vitest";
import {
  BATTLE_TOWER,
  BOSS_BRAIN,
  BOSS_ROSTER,
  ENGINE_MAX_ELO,
  adminFirstBosses,
  finishFloor,
  floorBossCount,
  floorDraw,
  floorsWonBest,
  floorStrength,
  hiddenBosses,
  leaveFloor,
  livesLeft,
  newRun,
  playableBosses,
  sideRefusal,
  startFloor,
  towerPool,
  type TowerRun,
} from "../src/index.ts";

/**
 * The Battle Tower's climb (core tower.ts; docs/decisions/2026-11-18-battle-tower-design.md, section 3): the floors' pattern and
 * strength (the design's table), the deal, the run's steps (its lives since Nov 20), and audit 1's finding 7 (what a floor's start takes). The runner's side
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

  it("the design's table, row by row (floor, bosses, brain, rating): Eric's gentler climb of Nov 20", () => {
    const row = (f: number) => {
      const n = floorBossCount(f);
      const s = floorStrength(f, n);
      return [f, n, s.full ? "full" : s.brain, s.rating];
    };
    expect([1, 2, 3, 4, 5, 6, 10, 11, 20, 25, 30, 31, 40, 50, 51, 60, 97, 98, 99].map(row)).toEqual([
      [1, 1, "maia", 700],
      [2, 2, "maia", 620],
      [3, 2, "maia", 640],
      [4, 3, "maia", 660],
      [5, 1, "maia", 780],
      [6, 2, "maia", 710],
      [10, 2, "maia", 830],
      [11, 2, "maia", 870],
      [20, 3, "maia", 1230],
      [25, 1, "maia", 1530],
      [30, 2, "maia", 1630],
      [31, 2, "maia", 1634],
      [40, 3, "maia", 1670],
      [50, 2, "maia", 1710],
      [51, 2, "stockfish", 1750],
      [60, 3, "stockfish", 2029],
      [97, 1, "stockfish", ENGINE_MAX_ELO],
      [98, 2, "stockfish", ENGINE_MAX_ELO],
      [99, 2, "full", ENGINE_MAX_ELO],
    ]);
  });

  it("every floor: Maia +20 a floor to 5, +30 to 10, +40 to 30, +4 to 50 (held in Eric's 1500 to 1700 band from about 25), a lone boss +100; Stockfish from 51 at 1750, +31 a floor, its ceiling on 98, its best on 99", () => {
    const step = (g: number) => (g >= 31 ? 4 : g >= 11 ? 40 : g >= 6 ? 30 : g >= 2 ? 20 : 0);
    let maia = 600;
    for (let f = 1; f <= 99; f++) {
      const n = floorBossCount(f);
      const s = floorStrength(f, n);
      if (f <= 50) {
        maia += step(f);
        expect(s).toEqual({ brain: "maia", rating: maia + (n === 1 ? 100 : 0), full: false });
        // (A lone boss plays more, never less, than the same floor with company; the climb never goes down with company alike.)
        expect(floorStrength(f, 1).rating).toBeGreaterThanOrEqual(floorStrength(f, 2).rating);
        if (f > 1) expect(floorStrength(f, 2).rating).toBeGreaterThan(floorStrength(f - 1, 2).rating);
      } else if (f < 99) {
        expect(s).toEqual({ brain: "stockfish", rating: Math.min(ENGINE_MAX_ELO, 1750 + 31 * (f - 51) + (n === 1 ? 100 : 0)), full: false });
        expect(s.rating).toBeGreaterThan(floorStrength(50, 2).rating);
      } else {
        expect(s).toEqual({ brain: "stockfish", rating: ENGINE_MAX_ELO, full: true });
      }
      expect(floorStrength(f, 3)).toEqual(floorStrength(f, 2));
    }
  });
});

describe("the tower: how Maia's move is drawn by floor (floorDraw; Eric, Nov 26: \"play like bad players for the first 8 to 10 levels\")", () => {
  it("the first floors draw looser than BOSS_BRAIN (a temperature above 1, every move in reach), easing back to BOSS_BRAIN's own by the last row, held there to floor 50; never a gift on any floor", () => {
    const rows = BATTLE_TOWER.carelessDraw;
    const [, t1, p1] = rows[0]!;
    const last = rows[rows.length - 1]!;
    expect(floorDraw(1)).toEqual({ temperature: t1, topP: p1, noGift: true });
    expect(t1).toBeGreaterThan(1);
    expect(p1).toBe(1);
    // (The last row is BOSS_BRAIN's own draw, so the ease ends where every other boss draws: no step at its floor.)
    expect([last[1], last[2]]).toEqual([BOSS_BRAIN.temperature, BOSS_BRAIN.topP]);
    expect(last[0]).toBeLessThanOrEqual(10);
    let prev = floorDraw(1);
    for (let f = 1; f <= 50; f++) {
      const d = floorDraw(f);
      expect(d.noGift).toBe(true);
      expect(d.temperature).toBeLessThanOrEqual(prev.temperature);
      expect(d.topP).toBeLessThanOrEqual(prev.topP);
      if (f >= last[0]) expect(d).toEqual({ temperature: BOSS_BRAIN.temperature, topP: BOSS_BRAIN.topP, noGift: true });
      prev = d;
    }
  });

  it("straight between the rows, held at the first before it, the brain's own from the last row's floor on", () => {
    const rows = [[2, 2, 1], [6, 1.2, 1], [10, 1, 0.5]] as const;
    const own = { temperature: 0.7, topP: 0.8 };
    expect(floorDraw(1, rows, own)).toEqual({ temperature: 2, topP: 1, noGift: true });
    expect(floorDraw(4, rows, own)).toEqual({ temperature: 1.6, topP: 1, noGift: true });
    expect(floorDraw(8, rows, own)).toEqual({ temperature: 1.1, topP: 0.75, noGift: true });
    expect(floorDraw(10, rows, own)).toEqual({ temperature: 0.7, topP: 0.8, noGift: true });
    expect(floorDraw(40, [], own)).toEqual({ temperature: 0.7, topP: 0.8, noGift: true });
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

  it("audit 2, finding 7: a kill switch flipped mid-run never leaves a boss twice in the deck (a new deck leaves out the bosses still waiting)", () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      // (Half the runs: a kill switch flips at random as each floor is won, a seeded draw, on 1 to 3 of the pool's bosses.)
      let r = (seed * 2654435761) >>> 0;
      const rnd = () => ((r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32);
      const flips = seed % 2 === 0;
      let pool = fullPool;
      let run = newRun(seed * 397, pool);
      while (run.status === "open") {
        if (flips && rnd() < 0.3) pool = fullPool.filter(() => rnd() > 0.15).slice(0, fullPool.length);
        run = finishFloor(run, "won", pool.length >= 6 ? pool : fullPool);
        if (new Set(run.deck).size < run.deck.length) problems.push(`${seed}, floor ${run.floors.length}: ${run.deck.join(" ")}`);
      }
    }
    expect(problems).toEqual([]);
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

  it("a win climbs: the next floor dealt as it's won, no life spent", () => {
    const run = newRun(42, pool);
    expect(run.lost).toEqual([]);
    expect(livesLeft(run)).toBe(BATTLE_TOWER.lives);
    const won = finishFloor(run, "won", pool);
    expect(won.status).toBe("open");
    expect(won.floors.length).toBe(2);
    expect(won.floors[0]).toEqual(run.floors[0]);
    expect(won.floors[1]!.length).toBe(2);
    expect(won.lost).toEqual([]);
    expect(floorsWonBest(won)).toBe(1);
  });

  it("lives (Eric, Nov 20): a loss or a draw costs one and the run climbs on, the next floor dealt as after a win; the third loss ends it; a finished run stays as it is", () => {
    expect(BATTLE_TOWER.lives).toBe(2);
    const won = finishFloor(newRun(42, pool), "won", pool);
    for (const outcome of ["lost", "drawn"] as const) {
      // (Floor 2 lost or drawn: it counts, a life spent; floor 3 dealt exactly as a win on floor 2 would deal it.)
      const one = finishFloor(won, outcome, pool);
      const asWin = finishFloor(won, "won", pool);
      expect(one).toEqual({ ...asWin, lost: [2] });
      expect(livesLeft(one)).toBe(1);
      expect(floorsWonBest(one)).toBe(1);
      // (Floor 3 won, floor 4 lost: the last life spent, still climbing; floor 5's loss ends the run, on floor 5.)
      const two = finishFloor(finishFloor(one, "won", pool), outcome, pool);
      expect(two).toMatchObject({ status: "open", lost: [2, 4] });
      expect(two.floors.length).toBe(5);
      expect(livesLeft(two)).toBe(0);
      expect(floorsWonBest(two)).toBe(3);
      const out = finishFloor(two, outcome, pool);
      expect(out).toEqual({ ...two, status: "out", lost: [2, 4, 5] });
      expect(livesLeft(out)).toBe(0);
      expect(floorsWonBest(out)).toBe(3);
      expect(finishFloor(out, "won", pool)).toBe(out);
      expect(startFloor(out, pool)).toBeNull();
    }
    // (Losses in a row: floors 1, 2 and 3; none won, the best 0.)
    let run = newRun(7, pool);
    for (let i = 0; i < 3; i++) run = finishFloor(run, "lost", pool);
    expect(run).toMatchObject({ status: "out", lost: [1, 2, 3] });
    expect(run.floors.length).toBe(3);
    expect(floorsWonBest(run)).toBe(0);
    // (Other numbers, as a test or the sim passes them: 0 lives, out at the first loss, as before Nov 20.)
    expect(finishFloor(won, "lost", pool, { ...BATTLE_TOWER, lives: 0 })).toEqual({ ...won, status: "out", lost: [2] });
    // (The setting lowered below a run's floors lost (two lost, lives now 1): a win still climbs, never ends it; the next loss does. The
    // review of #839, finding 4.)
    const lower = { ...BATTLE_TOWER, lives: 1 };
    const spent = finishFloor(finishFloor(won, "lost", pool), "lost", pool);
    const on = finishFloor(spent, "won", pool, lower);
    expect(on).toMatchObject({ status: "open", lost: [2, 3] });
    expect(on.floors.length).toBe(spent.floors.length + 1);
    expect(livesLeft(on, lower)).toBe(0);
    expect(finishFloor(on, "lost", pool, lower)).toMatchObject({ status: "out", lost: [2, 3, 5] });
  });

  it("a run with no floor lost (as every run saved before lives reads: server tower.ts runOf): all its lives; its best its floor less one, or 99 at the top", () => {
    const won = finishFloor(newRun(42, pool), "won", pool);
    expect(livesLeft(won)).toBe(2);
    expect(floorsWonBest({ ...won, status: "out" })).toBe(1);
    expect(floorsWonBest({ ...climb(42, pool, 99), status: "top" })).toBe(99);
  });

  it("leaving: free before your 2nd move (the same floor, the same bosses), a loss after: a life, the climb on", () => {
    const run = finishFloor(newRun(42, pool), "won", pool);
    expect(leaveFloor(run, 0, pool)).toBe(run);
    expect(leaveFloor(run, 1, pool)).toBe(run);
    expect(leaveFloor(run, 2, pool)).toEqual(finishFloor(run, "lost", pool));
    expect(leaveFloor(run, 30, pool)).toMatchObject({ status: "open", lost: [2] });
    // (With no life left, a counted leave ends the run.)
    const last = { ...climb(42, pool, 3), lost: [1, 2] };
    expect(leaveFloor(last, 2, pool)).toEqual({ ...last, status: "out", lost: [1, 2, 3] });
  });

  it("floor 99 won: the run is complete (top), and stays so; floor 99 lost with a life left: the climb is done too (top), the best 98", () => {
    const at99 = climb(42, pool, 99);
    expect(at99.status).toBe("open");
    expect(at99.floors.length).toBe(99);
    const top = finishFloor(at99, "won", pool);
    expect(top).toEqual({ ...at99, status: "top" });
    expect(floorsWonBest(top)).toBe(99);
    expect(finishFloor(top, "lost", pool)).toBe(top);
    expect(startFloor(top, pool)).toBeNull();
    const lostTop = finishFloor(at99, "lost", pool);
    expect(lostTop).toEqual({ ...at99, status: "top", lost: [99] });
    expect(floorsWonBest(lostTop)).toBe(98);
    // (No life left on floor 99: out there.)
    expect(finishFloor({ ...at99, lost: [3, 9] }, "drawn", pool)).toMatchObject({ status: "out", lost: [3, 9, 99] });
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
