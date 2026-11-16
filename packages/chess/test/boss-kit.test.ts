import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOSS_ROSTER } from "@chessroyale/core";
import { applyMove, sanLineToUci, START_FEN } from "../src/index.ts";
import { KNOWN_STEPS, PROMOTION_OPT_OUT, StockfishMoves, epKept, kitBattles, kitBosses, newPromotions, positionProblems, quickSearches, runBattle, unknownSteps } from "./boss-kit-lib.ts";

/**
 * The shared boss test kit (Oct 18; docs/decisions/2026-10-18-boss-test-kit.md): every boss in BOSS_ROSTER, hidden
 * ones included, read from the roster so a new boss is covered with no edit here. Three short seeded battles each (his
 * passive switched on early, crowd White; his ultimate switched on early and the admins' trigger pulled again and
 * again, crowd Black; the stress start, the trigger from the first turn, crowd White; the God King's strike called now
 * and then), cheap legal moves for the crowd, a stand-in engine for the boss, and Stockfish 19's own move list as the
 * referee. After every step, the invariants in
 * `boss-kit-lib.ts` (a position Stockfish plays, chess.js's moves equal Stockfish's, a move for whoever is to move,
 * the replay, no instant queen from a power, a power's win over a draw, its moments before the result).
 */

/** Crowd moves a battle at most (a short fuzz: the whole file stays well under a minute). */
const MAX_MOVES = 20;
/** More seeds of each battle, for a deeper run by hand: `KIT_SEEDS=5 npx vitest run packages/chess/test/boss-kit.test.ts`. */
const EXTRA = Number(process.env.KIT_SEEDS ?? 0);

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

describe("the boss kit: its own ground", () => {
  it("covers every boss in the roster with powers, hidden ones too", () => {
    const ids = kitBosses().map((d) => d.id);
    expect(ids).toEqual(BOSS_ROSTER.filter((d) => d.powers).map((d) => d.id));
    expect(ids).toContain("recluse");
  });

  it("plays every kind of step the match runner has (a new one must be added to the driver, never skipped)", () => {
    expect(unknownSteps(), `add these to KNOWN_STEPS and to runBattle in boss-kit-lib.ts (and the parity test's host): ${unknownSteps().join(", ")}`).toEqual([]);
    expect(KNOWN_STEPS.length).toBeGreaterThan(0);
  });

  it("the promotion opt-outs are only bosses on the roster, each with its sheet's reason", () => {
    for (const [id, why] of Object.entries(PROMOTION_OPT_OUT)) {
      expect(BOSS_ROSTER.some((d) => d.id === id), id).toBe(true);
      expect(why.length, id).toBeGreaterThan(10);
    }
  });
});

describe("the boss kit: its checks catch the past bugs' own positions", () => {
  it("#275's S2: an en passant square Stockfish drops (a piece on the square behind it): chess.js has a move Stockfish doesn't", async () => {
    // (The review's case: his d7-d5 past your c5 pawn, en passant on d6; his prize, a pawn, put on d7 behind it.)
    const before = "r1bqk1nr/pp2p1bp/n4pp1/2Pp4/7P/B4P2/P1PPP1P1/RNQ1KBNR w KQkq d6 0 7";
    expect(positionProblems(before, await sf.moves(before))).toEqual([]);
    const kept = "r1bqk1nr/pp1pp1bp/n4pp1/2Pp4/7P/B4P2/P1PPP1P1/RNQ1KBNR w KQkq d6 0 7";
    expect(epKept(kept)).toBe(false);
    const problems = positionProblems(kept, await sf.moves(kept));
    expect(problems.join("; ")).toMatch(/en passant square Stockfish drops \(d6\)/);
    expect(problems.join("; ")).toMatch(/only chess\.js: c5d6/);
    // (Cleared, as the fix does: nothing wrong.)
    const cleared = kept.replace(" d6 ", " - ");
    expect(positionProblems(cleared, await sf.moves(cleared))).toEqual([]);
  });

  it("#273: a hop onto your second rank hands him a queen before you move (1.e3 e5 2.a3 e4 3.a4, then e4 over e3 to e2)", () => {
    const crowdLeft = sanLineToUci(["e3", "e5", "a3", "e4", "a4"]).reduce((f, m) => applyMove(f, m), START_FEN);
    const hopped = crowdLeft.replace("P3p3/4P3/1PPP1PPP", "P7/4P3/1PPPpPPP");
    expect(hopped).not.toBe(crowdLeft);
    expect(newPromotions(crowdLeft, hopped).sort()).toEqual(["e2d1", "e2f1"]);
    expect(newPromotions(crowdLeft, crowdLeft)).toEqual([]);
  });
});

describe("the boss kit: every boss, every step", () => {
  for (const def of kitBosses()) {
    it(`${def.id}: his passive and his ultimate forced on early, the invariants after every step`, async () => {
      const failures: string[] = [];
      const kinds = new Set<string>();
      let steps = 0;
      for (const battle of kitBattles(def, MAX_MOVES, EXTRA)) {
        const run = await runBattle(battle, sf);
        failures.push(...run.failures);
        steps += run.steps;
        for (const e of run.events) kinds.add(e);
        for (const p of Object.keys(run.played)) kinds.add(`step:${p}`);
      }
      expect(failures.slice(0, 5).join("\n\n")).toBe("");
      // (Enough of the battle to mean something, and his powers seen at work.)
      expect(steps).toBeGreaterThan(30);
      expect(kinds.has("step:boss") && kinds.has("step:crowd")).toBe(true);
      expect([...kinds].filter((k) => !k.startsWith("step:") && k !== "warn").length, `no power event in ${def.id}'s battles`).toBeGreaterThan(0);
    }, 60_000 * (1 + EXTRA));
  }
});
