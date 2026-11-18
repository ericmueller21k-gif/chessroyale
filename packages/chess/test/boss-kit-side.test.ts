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

const battle = (bosses: string[]): KitBattle => ({
  boss: bosses[0]!,
  bosses,
  seed: 1 + Math.floor(hash(bosses.join("+")) * 100000),
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
});

/** One battle of several bosses; its failures (the first few), and the kinds of step it played. */
async function side(bosses: string[]) {
  const run = await runBattle(battle(bosses), sf);
  return { failures: run.failures.slice(0, 3), played: run.played, steps: run.steps, result: run.result };
}

describe("the boss kit over several bosses: every pair", () => {
  for (const pair of kitPairs()) {
    it(`${pair.join(" + ")}: the invariants after every step`, async () => {
      const r = await side(pair);
      expect(r.failures.join("\n\n")).toBe("");
      expect(r.played.boss ?? 0).toBeGreaterThan(2);
    }, 60_000);
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
