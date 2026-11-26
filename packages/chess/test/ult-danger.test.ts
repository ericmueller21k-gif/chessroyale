import { afterEach, describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { bossRules, dangerCharge, inDanger, legalMoves, rageNow, rageOf, type EngineLike, type MatchRunner } from "../src/index.ts";
import { KIT_OPENING, fakeScore, hash, runBattle } from "./boss-kit-lib.ts";

/**
 * The bosses in BOSS_POWERS.dangerBosses (Eric, Nov 26: "every boss has to ult in every game, no matter what ... we don't want bosses
 * to ... ult twice"; docs/decisions/2026-11-26-ult-danger-birdie-only.md): in a battle the judge says he has lost, before his first
 * ultimate, his meter is full by his next turn and his ultimate comes within two of his turns; after it, the rule is done for the
 * battle, so a second comes only at the meter's own pace. Below the line nothing changes. Every other boss: as before.
 */
const IDS = BOSS_POWERS.dangerBosses;

/** The judge has him lost from the crowd's move `from`: every crowd move 0.8-0.95, his 0.05-0.2. Before that, the kit's stand-in. */
function lostEngine(crowd: "w" | "b", lost: () => boolean): EngineLike {
  const score = (fen: string, m: string): number => (!lost() ? fakeScore(fen, m) : fen.split(" ")[1] === crowd ? 0.8 + 0.15 * hash(fen + m) : 0.05 + 0.15 * hash(fen + m));
  const ranked = (fen: string) =>
    legalMoves(fen)
      .map((move) => ({ move, expected: score(fen, move) }))
      .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
  return {
    topMoves: async (fen, n) => ranked(fen).slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    topMovesAt: async (fen, n) => ranked(fen).slice(0, n),
    playAtElo: async (fen) => ranked(fen)[0]?.move ?? "0000",
  };
}

/** The boss turn an ultimate whose `ultAt` is `at` came in. */
const ultTurn = (id: string, at: number): number => (bossRules({ id })?.ultimateOnHisTurn ? at : at - 1);

/** One battle lost from the crowd's move `from`: the crowd's move it was lost from and the boss turns his ultimates came in. */
async function lostBattle(id: string, from: number) {
  const came: number[] = [];
  let lost = false;
  let firstDanger: number | null = null;
  const watch = (r: MatchRunner, _fen: string, who: "crowd" | "boss") => {
    const p = r.boss!.powers!;
    if (who === "crowd" && r.boss!.crowdMoves + 1 >= from) lost = true;
    while ((p.ults ?? 0) > came.length) came.push(p.ultAt !== undefined ? ultTurn(id, p.ultAt) : r.boss!.crowdMoves);
    if (who === "boss" && firstDanger === null && inDanger(p.judged) && !came.length && p.ultAt === undefined && p.warnAt === undefined) firstDanger = r.boss!.crowdMoves;
  };
  const run = await runBattle({ boss: id, seed: 1 + Math.floor(hash(id) * 1000), side: "w", test: "", triggerFrom: 999, strikes: [], maxMoves: 30, opening: KIT_OPENING, engine: () => lostEngine("w", () => lost) }, null, watch);
  return { came, firstDanger, failures: run.failures };
}

describe("a boss in dangerBosses, losing before his first ultimate: it comes within two of his turns, and never a second close after", () => {
  for (const id of IDS) {
    it(`${id}: lost from the crowd's move 6 or 9`, async () => {
      let b: Awaited<ReturnType<typeof lostBattle>> | null = null;
      for (const from of [6, 9]) {
        b = await lostBattle(id, from);
        expect(b.failures.slice(0, 3).join("\n\n")).toBe("");
        if (b.firstDanger !== null) break;
      }
      const where = `${id}: in danger first after the crowd's move ${b!.firstDanger}, ultimates in his turns ${b!.came.join(", ") || "none"}`;
      expect(b!.firstDanger, where).not.toBeNull();
      expect(b!.came.length, where).toBeGreaterThan(0);
      expect(b!.came[0]! - b!.firstDanger! + 1, where).toBeLessThanOrEqual(2);
      // (Eric: never ult twice close together. After the first the rule is done (dangerCharge, below), so the next comes only as his
      // meter fills on its own: material he loses fills it faster (Hollow's came 12 and 8 turns apart here), never within a few turns.)
      for (let i = 1; i < b!.came.length; i++) expect(b!.came[i]! - b!.came[i - 1]!, where).toBeGreaterThanOrEqual(5);
    }, 120_000);
  }
});

/** A level battle's stand-in: every move 0.3-0.65 for whoever moves (never the danger line); rankings kept per position. */
const levelRanked = new Map<string, { move: string; expected: number }[]>();
function levelEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.35 * hash(fen + m);
  const ranked = (fen: string) => {
    let r = levelRanked.get(fen);
    if (!r) levelRanked.set(fen, (r = legalMoves(fen).map((move) => ({ move, expected: score(fen, move) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))));
    return r;
  };
  return {
    topMoves: async (fen, n) => ranked(fen).slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    topMovesAt: async (fen, n) => ranked(fen).slice(0, n),
    playAtElo: async (fen) => ranked(fen)[0]?.move ?? "0000",
  };
}

describe("below the line, nothing changes", () => {
  // (The list back however a test ends, a timeout too.)
  const list = BOSS_POWERS.dangerBosses;
  afterEach(() => {
    (BOSS_POWERS as { dangerBosses: readonly string[] }).dangerBosses = list;
  });
  async function level(id: string): Promise<string[]> {
    const seen: string[] = [];
    await runBattle({ boss: id, seed: 3 + Math.floor(hash(id) * 1000), side: "b", test: "", triggerFrom: 999, strikes: [], maxMoves: 30, opening: KIT_OPENING, engine: levelEngine }, null, (r, fen, who) => {
      const p = r.boss!.powers!;
      if (who === "crowd") seen.push(`${p.turn} ${rageOf(r.boss)} ${p.warnAt} ${p.ultAt} ${p.ults ?? 0} ${fen}`);
    });
    return seen;
  }
  for (const id of IDS) {
    it(`${id}: a level battle plays the same with the rule off`, async () => {
      const on = await level(id);
      (BOSS_POWERS as { dangerBosses: readonly string[] }).dangerBosses = [];
      const off = await level(id);
      expect(on.length).toBeGreaterThan(10);
      expect(on).toEqual(off);
    }, 120_000);
  }
});

describe("dangerCharge", () => {
  it("full now only for a boss in the list, in danger, before his first ultimate; otherwise the charge as it was", () => {
    const id = IDS[0]!;
    expect(IDS).toEqual(["timber", "hopper", "hollow", "alfil", "moo"]);
    for (const speed of [0.7, 1, 1.4])
      for (const p of [
        { charge: 0, lost: 0, rageUsed: 0 },
        { charge: 37, lost: 4, rageUsed: 0 },
      ]) {
        const full = dangerCharge(id, { ...p, judged: 0.8, ults: 0 }, speed);
        expect(rageNow({ ...p, charge: full }, speed)).toBeGreaterThanOrEqual(BOSS_POWERS.rageFull);
        expect(dangerCharge(id, { ...p, judged: 0.8, ults: 1 }, speed)).toBe(p.charge);
        expect(dangerCharge(id, { ...p, judged: BOSS_POWERS.dangerAt - 0.01, ults: 0 }, speed)).toBe(p.charge);
        expect(dangerCharge("gingerbread", { ...p, judged: 0.9, ults: 0 }, speed)).toBe(p.charge);
      }
  });
});
