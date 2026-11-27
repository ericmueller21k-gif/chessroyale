import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BATTLE_TOWER } from "@chessroyale/core";
import { KIT_OPENING, StockfishMoves, hash, kitBosses, quickSearches, runBattle, type KitBattle } from "./boss-kit-lib.ts";

/**
 * The boss kit over several bosses on one side (Battle Tower PR 6; docs/decisions/2026-11-18-several-bosses.md): every pair of
 * the tower's bosses (every boss with powers but the Hidden Boss, never a pair BATTLE_TOWER.apart keeps apart) once, and a seeded
 * sample of threes, each through the match runner as solo plays it with the same invariants as the one-boss kit after every
 * step (boss-kit-lib.ts). The crowd White, from the starting position (the tower's floors), every boss's ultimate pulled by the
 * admins' trigger from the second turn on (each comes at his own turn change), the God King's strike called now and then.
 * More threes by hand: `KIT_THREES=40 npx vitest run packages/chess/test/boss-kit-side.test.ts`.
 */

const MAX_MOVES = 16;
const THREES = Number(process.env.KIT_THREES ?? 12);
/** More seeds of each pair, for a deeper run by hand: `KIT_PAIR_SEEDS=3 npx vitest run packages/chess/test/boss-kit-side.test.ts`. */
const PAIR_SEEDS = Number(process.env.KIT_PAIR_SEEDS ?? 1);
/**
 * Pull requests play a share of the pairs (Nov 27; docs/decisions/2026-11-27-kit-side-sample.md): with KIT_PAIR_SHARE=n (check.yml
 * sets 4 on pull_request events) a PR plays the pairs whose place in kitPairs() is KIT_PAIR_ROTATE (the PR number) mod n, so any n
 * PRs in a row cover every pair; the rest show as skipped. Unset (every push to main, and by hand): every pair.
 */
const PAIR_SHARE = Math.max(1, Math.floor(Number(process.env.KIT_PAIR_SHARE || 1)));
const PAIR_ROTATE = Math.floor(Number(process.env.KIT_PAIR_ROTATE || 0));

/**
 * Pairs the kit finds breaking, the seeds they break on (1: CI's; more by hand: KIT_PAIR_SEEDS) and the rule proposed for each (the
 * design's style), reported to the director, not fixed here (docs/decisions/2026-11-18-several-bosses.md). Their battles must still
 * break (it.fails): once the rule is built, or the pair joins BATTLE_TOWER.apart, the check goes red until its entry here goes.
 */
export const PAIR_BREAKS: Readonly<Record<string, { seeds: readonly number[]; rule: string }>> = {
  // (None now: the kit's two, Smudgy + Alfil and Alfil + Grex, joined BATTLE_TOWER.apart on Nov 19.)
};

/** The tower's bosses: every one with powers but the Hidden Boss. */
export const towerBosses = (): string[] => kitBosses().map((d) => d.id).filter((id) => id !== "recluse");
const apart = (ids: readonly string[]) => BATTLE_TOWER.apart.some(([a, b]) => ids.includes(a) && ids.includes(b));

/** Every pair once, the order dealt by the pair's own hash (so either boss may move first). */
export function kitPairs(): string[][] {
  const ids = towerBosses();
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const pair = [ids[i]!, ids[j]!];
      if (apart(pair)) continue;
      out.push(hash(pair.join("+")) < 0.5 ? pair : [pair[1]!, pair[0]!]);
    }
  return out;
}

/** Whether a pair at place i of kitPairs() plays in this run: every one unless KIT_PAIR_SHARE samples them. */
export const pairInSample = (i: number, share = PAIR_SHARE, rotate = PAIR_ROTATE): boolean =>
  share <= 1 || (((i - rotate) % share) + share) % share === 0;

/** A seeded sample of threes (none BATTLE_TOWER.apart keeps apart), each boss in as many as the sample allows. */
export function kitThrees(count: number): string[][] {
  const ids = towerBosses();
  const out: string[][] = [];
  for (let k = 0; out.length < count && k < count * 20; k++) {
    const pick = (n: number) => ids[Math.floor(hash(`three:${k}:${n}`) * ids.length)]!;
    const three = [ids[(k * 7) % ids.length]!, pick(1), pick(2)];
    if (new Set(three).size < 3 || apart(three) || out.some((t) => t.join() === three.join())) continue;
    out.push(three);
  }
  return out;
}

const battle = (bosses: string[], k = 0): KitBattle => ({
  boss: bosses[0]!,
  bosses,
  seed: 1 + Math.floor(hash(bosses.join("+")) * 100000) + 7 * k,
  side: "w",
  test: "",
  triggerFrom: 2,
  strikes: [4, 11],
  maxMoves: MAX_MOVES,
  opening: KIT_OPENING,
});

let sf: StockfishMoves;
let undoSearches: () => void;
beforeAll(async () => {
  undoSearches = quickSearches();
  sf = new StockfishMoves();
  await sf.init();
}, 30_000);
afterAll(() => {
  sf?.close();
  undoSearches?.();
});

describe("the boss kit over several bosses: its own ground", () => {
  it("every pair of the tower's bosses once (Hollow and Smudgy never), a sample of threes", () => {
    const ids = towerBosses();
    expect(ids).not.toContain("recluse");
    const pairs = kitPairs();
    expect(pairs.length).toBe((ids.length * (ids.length - 1)) / 2 - BATTLE_TOWER.apart.length);
    expect(pairs.some((p) => p.includes("hollow") && p.includes("smudgy"))).toBe(false);
    expect(kitThrees(THREES).length).toBe(THREES);
  });
  it("a PR's share of the pairs: about 1 in n, and any n PRs in a row play every pair", () => {
    const n = kitPairs().length;
    for (const share of [1, 4]) {
      const covered = new Set<number>();
      for (let rotate = 990; rotate < 990 + share; rotate++) {
        const picked = [...Array(n).keys()].filter((i) => pairInSample(i, share, rotate));
        expect(picked.length).toBeGreaterThanOrEqual(Math.floor(n / share));
        expect(picked.length).toBeLessThanOrEqual(Math.ceil(n / share));
        for (const i of picked) covered.add(i);
      }
      expect(covered.size).toBe(n);
    }
  });
});

/** One battle of several bosses; its failures (the first few), and the kinds of step it played. */
async function side(bosses: string[], k = 0) {
  const run = await runBattle(battle(bosses, k), sf);
  return { failures: run.failures.slice(0, 3), played: run.played, steps: run.steps, result: run.result };
}

describe("the boss kit over several bosses: every pair", () => {
  it("every known break is a pair the kit plays, with its proposed rule", () => {
    const names = new Set(kitPairs().map((p) => p.join(" + ")));
    for (const [pair, { seeds, rule }] of Object.entries(PAIR_BREAKS)) {
      expect(names.has(pair), pair).toBe(true);
      expect(seeds.length, pair).toBeGreaterThan(0);
      expect(rule).toMatch(/ \| .+ \| /);
    }
  });
  for (const [i, pair] of kitPairs().entries()) {
    const name = pair.join(" + ");
    for (let k = 0; k < PAIR_SEEDS; k++) {
      const known = !!PAIR_BREAKS[name]?.seeds.includes(k + 1);
      // (A known break always plays: it's the check that its rule or BATTLE_TOWER.apart has landed.)
      const play = known || pairInSample(i);
      (play ? (known ? it.fails : it) : it.skip)(`${name}${k ? ` (seed ${k + 1})` : ""}: the invariants after every step${known ? " (a known break: PAIR_BREAKS)" : ""}`, async () => {
        const r = await side(pair, k);
        expect(r.failures.join("\n\n")).toBe("");
        // (Enough of a battle: a move from each of two bosses at least; Lights out lost at once can end one there.)
        expect(r.played.boss ?? 0).toBeGreaterThanOrEqual(2);
      }, 60_000);
    }
  }
});

/**
 * The battles audit 1 broke on (Nov 19; docs/decisions/2026-11-19-battle-tower-audit-1.md), as it played them: trigger from turn 2,
 * strikes on 4, 11 and 19. clown + tiger: a balloon on the square behind the en passant square (finding 1); smudgy + clown and tiger +
 * bigboy + sawyer: the kit's invariant 9 taking a guard that binds the whole side for one boss's own forced move (finding 4).
 */
const AUDIT_SEEDS: readonly { bosses: string[]; seed: number; maxMoves: number; finding: number }[] = [
  { bosses: ["clown", "tiger"], seed: 56479, maxMoves: 40, finding: 1 },
  { bosses: ["smudgy", "clown"], seed: 30210, maxMoves: 40, finding: 4 },
  { bosses: ["tiger", "bigboy", "sawyer"], seed: 7972, maxMoves: 45, finding: 4 },
];

describe("the boss kit over several bosses: audit 1's seeds", () => {
  for (const a of AUDIT_SEEDS) {
    it(`${a.bosses.join(" + ")}, seed ${a.seed} (finding ${a.finding}): the invariants after every step`, async () => {
      const run = await runBattle({ boss: a.bosses[0]!, bosses: a.bosses, seed: a.seed, side: "w", test: "", triggerFrom: 2, strikes: [4, 11, 19], maxMoves: a.maxMoves, opening: KIT_OPENING }, sf);
      expect(run.failures.slice(0, 3).join("\n\n")).toBe("");
      expect(run.played.boss ?? 0).toBeGreaterThan(10);
    }, 120_000);
  }
});

describe("the boss kit over several bosses: a sample of threes", () => {
  for (const three of kitThrees(THREES)) {
    it(`${three.join(" + ")}: the invariants after every step`, async () => {
      const r = await side(three);
      expect(r.failures.join("\n\n")).toBe("");
      expect(r.played.boss ?? 0).toBeGreaterThan(2);
    }, 60_000);
  }
});
