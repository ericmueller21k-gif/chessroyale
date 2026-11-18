import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, type BossState } from "@chessroyale/core";
import { boardAltered, bossRules, crowdAllowed, legalMoves, pieceAt, type BossRules } from "../src/index.ts";
import { kitBattles, quickSearches, runBattle, type KitBattle } from "./boss-kit-lib.ts";

/**
 * The held pieces' twin (Battle Tower PR 2, Nov 18; docs/decisions/2026-11-18-held-pieces-on-the-layer.md): Ginger's,
 * Boingo's, Moo's, Folio's and Chandy's held pieces moved from each boss's own `held` list and the dispatcher's `heldIn`
 * onto the board layer (`BossRules.layer`, `layerStop`). Over seeded battles of every boss in the family (the kit's, more
 * seeds, and each power that holds pieces switched on), the crowd's allowed moves and the Last Stand's test agree exactly
 * with today's rule, frozen here as it stood on main. The server and solo both ask the runner's `crowdAllowed`, which asks
 * the dispatcher read here (the server's own path: boss-kit-parity.test.ts).
 */

/** The family, by BOSS_ROSTER id, and each one's test switches that hold pieces beyond the kit's own battles. */
const FAMILY: Record<string, readonly string[]> = {
  gingerbread: ["freeze", "blizzard", "superfreeze"],
  clown: ["pie"],
  moo: ["moonbeam", "fullmoon"],
  folio: ["draft"],
  chandy: ["rapidfire", "beam"],
};
const MAX_MOVES = 24;
const SEEDS = 2;

// ---------------- Today's rule, frozen (main before the move) ----------------

/** bosses/base.ts `heldIn`: the held piece moves, or the king castles with a held rook (its corner on his rank). */
function oldHeldIn(fen: string, move: string, held: readonly string[]): boolean {
  if (held.includes(move.slice(0, 2))) return true;
  const f0 = move.charCodeAt(0);
  const f1 = move.charCodeAt(2);
  if (Math.abs(f1 - f0) !== 2 || move[1] !== move[3] || pieceAt(fen, move.slice(0, 2))?.type !== "k") return false;
  return held.includes(`${f1 > f0 ? "h" : "a"}${move[1]}`);
}

/** boss-powers.ts `limitCrowd`: the held pieces' moves out, then the boss's other limits. */
function oldLimitCrowd(rules: BossRules, boss: BossState, fen: string, legal: string[], held: readonly string[]): string[] {
  const free = held.length ? legal.filter((m) => !oldHeldIn(fen, m, held)) : legal;
  return rules.crowdFilter ? rules.crowdFilter(free, boss, fen) : free;
}

/** boss-powers.ts `crowdAllowed`: the limits, lifted if none is left; the Last Stand's barred move on top. */
function oldCrowdAllowed(rules: BossRules, boss: BossState, fen: string, held: readonly string[]): string[] | null {
  const legal = legalMoves(fen);
  let allowed = oldLimitCrowd(rules, boss, fen, legal, held);
  if (!allowed.length) allowed = legal;
  if (boss.barred) {
    const open = allowed.filter((m) => m !== boss.barred);
    allowed = open.length ? open : legal.filter((m) => m !== boss.barred);
    if (!allowed.length) allowed = legal;
  }
  return allowed.length === legal.length ? null : allowed;
}

/** boss-powers.ts `boardAltered`, the general test (every boss here has a held list, so it never stops early). */
function oldBoardAltered(rules: BossRules, boss: BossState, fen: string, held: readonly string[]): boolean {
  if (rules.powerTurn?.(boss, fen) || rules.bossStops?.(boss) || rules.altersBoard?.(boss)) return true;
  const legal = legalMoves(fen);
  return oldLimitCrowd(rules, boss, fen, legal, held).length < legal.length;
}

// ---------------- The twin ----------------

interface Tally {
  turns: number;
  held: number;
  stopped: number;
  castles: number;
  lifted: number;
}

function battlesOf(id: string): KitBattle[] {
  const def = BOSS_ROSTER.find((d) => d.id === id)!;
  const kit = kitBattles(def, MAX_MOVES, SEEDS - 1);
  const more = FAMILY[id]!.flatMap((test, i) =>
    Array.from({ length: SEEDS }, (_, k): KitBattle => ({ ...kit[0]!, seed: 7000 + 100 * i + k, side: k % 2 ? "b" : "w", test, triggerFrom: 4, strikes: [5] })),
  );
  return [...kit, ...more];
}

describe("the held pieces on the board layer: the twin of today's rule", () => {
  for (const id of Object.keys(FAMILY)) {
    it(`${id}: the crowd's allowed moves and the Last Stand's test are today's, every crowd turn`, async () => {
      const undo = quickSearches();
      const t: Tally = { turns: 0, held: 0, stopped: 0, castles: 0, lifted: 0 };
      const diffs: string[] = [];
      try {
        for (const k of battlesOf(id)) {
          await runBattle(k, null, (r, fen) => {
            const boss = r.boss!;
            if (!boss.powers) return;
            const rules = bossRules(boss)!;
            const held = (rules.layer?.(boss, fen)?.pieces ?? []).filter((m) => m.held).map((m) => m.square);
            t.turns++;
            const legal = legalMoves(fen);
            const stops = legal.filter((m) => oldHeldIn(fen, m, held));
            if (held.length) t.held++;
            if (stops.length) t.stopped++;
            if (stops.some((m) => pieceAt(fen, m.slice(0, 2))?.type === "k" && Math.abs(m.charCodeAt(0) - m.charCodeAt(2)) === 2)) t.castles++;
            if (stops.length === legal.length && legal.length) t.lifted++;
            const was = oldCrowdAllowed(rules, boss, fen, held);
            const now = crowdAllowed(boss, fen);
            if (JSON.stringify(was) !== JSON.stringify(now)) diffs.push(`seed ${k.seed} ?power=${k.test} turn ${boss.crowdMoves + 1} ${fen}: allowed ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
            const altWas = oldBoardAltered(rules, boss, fen, held);
            const altNow = boardAltered(boss, fen);
            if (altWas !== altNow) diffs.push(`seed ${k.seed} ?power=${k.test} turn ${boss.crowdMoves + 1} ${fen}: boardAltered ${altWas} -> ${altNow}`);
          });
        }
      } finally {
        undo();
      }
      expect(diffs).toEqual([]);
      // (The battles reach what the twin is for: held pieces that stop moves.)
      expect(t.held, JSON.stringify(t)).toBeGreaterThan(0);
      expect(t.stopped, JSON.stringify(t)).toBeGreaterThan(0);
    }, 120_000);
  }
});
