import { describe, expect, it } from "vitest";
import { BOSS_POWERS } from "@chessroyale/core";
import { bossRules, dangerCharge, inDanger, legalMoves, rageNow, rageOf, type EngineLike, type MatchRunner } from "../src/index.ts";
import { KIT_OPENING, fakeScore, hash, kitBosses, runBattle } from "./boss-kit-lib.ts";

/**
 * A boss's ultimate comes when he's losing (Eric, Nov 26: "It should have detected like he was basically in danger, or like it was
 * already heavily in my favor, and it should start triggering very quickly thereafter, like a turn or two at most";
 * docs/decisions/2026-11-26-ult-danger.md). Every boss in the roster but the Hidden Boss (his fight's design is Eric's: his bullet
 * clock comes on its own turn) and Wrangler (NOT_HERE), each in a battle the judge says he has lost from one of the crowd's moves
 * (LOST_FROM): from each crowd move at or above BOSS_POWERS.dangerAt (two in a row for Birdie's Fall: fallDangerMoves) with none of his
 * under way, none come yet in this danger (one a danger: dangerSpent) and one still to come, his meter is full by his next turn (or his ultimate warned) and his ultimate comes within two of
 * his turns (in his very next turn, or the one after: a warning first), or, for an ultimate that needs more of the board
 * (CONDITIONS), once the board allows it.
 */

/**
 * The crowd's moves from which the judge has him lost (before it, the kit's stand-in: a level battle), first to last: the first that
 * gives a danger window (none of his under way, one still to come) is the battle's. 12 first: past every boss's opening rules (the
 * board saw from crowd turn 10, Smudgy's Camouflage before his Repaint).
 */
const LOST_FROM = [12, 9, 15, 6];
/**
 * Not here, each with why: the Hidden Boss (the brief: report only; his bullet clock is his fight's own design, Eric's); Wrangler (his
 * meter is full from his fifth move whatever the board says, and his showdown waits for a line-up the rules let him fire, which a lost
 * battle may never give: docs/decisions/2026-11-26-ult-danger.md, for the director and Eric).
 */
const NOT_HERE: Readonly<Record<string, string>> = { recluse: "report only", pig: "his showdown waits on a qualifying line-up" };
/**
 * Bosses whose ultimate needs something of the board besides a full meter (its own rule, kept): the meter is full in danger as for
 * every boss, and the ultimate comes once the board allows it, which can be a turn or more later. Each with its condition.
 */
const CONDITIONS: Readonly<Record<string, string>> = {
  sawyer: "the board saw from crowd turn boardSawFrom, with a half of the board more his than yours (favouredHalf)",
  smudgy: "the Repaint needs a pair he can paint, his Camouflage over (paintableNow)",
  zebra: "Gold Plate needs a piece to gild (gildPick)",
  folio: "the Crease needs a line its guard allows (creaseGuard)",
  tiger: "his hoops wait when his move gives check or none fit",
  dash: "Time Scramble waits while his Scramble Rush is warned",
  gingerbread: "the blizzard is only warned on a Super Freeze's turn",
};

/**
 * The judge has him lost once `lost()` says so (from the crowd's LOST_FROM move): the crowd to move, every move between 0.8 and
 * 0.95 for it; him to move, between 0.05 and 0.2 for him (his brain plays his best of them). Before that, the kit's stand-in.
 */
function lostEngine(crowd: "w" | "b", lost: () => boolean): EngineLike {
  const score = (fen: string, m: string): number => {
    if (!lost()) return fakeScore(fen, m);
    return fen.split(" ")[1] === crowd ? 0.8 + 0.15 * hash(fen + m) : 0.05 + 0.15 * hash(fen + m);
  };
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

/**
 * The crowd's moves in a row at the danger line his ultimate's rule asks for: Birdie's Fall, with no warning before it, two
 * (birdie.fallDangerMoves); every other boss one (his warning, or his meter full, as the next turn begins).
 */
const dangerMoves = (id: string): number => (id === "birdie" ? BOSS_POWERS.birdie.fallDangerMoves : 1);

/** How many ultimates a battle allows him (once a battle, ultimateMax, maxUltimates), Infinity: no cap. */
function capOf(id: string): number {
  const rules = bossRules({ id });
  if (rules?.ultimateOnce) return 1;
  return Math.min(rules?.ultimateMax ?? Infinity, BOSS_POWERS.maxUltimates?.[id] ?? Infinity);
}

/** The boss turn an ultimate whose `ultAt` is `at` came in: his turn after crowd move `at` (at the start of his turn), else the one before crowd turn `at`. */
const ultTurn = (id: string, at: number): number => (bossRules({ id })?.ultimateOnHisTurn ? at : at - 1);

interface Look {
  /** The crowd's move (its count): his turn after it has the same number. */
  turn: number;
  /** The judge's number after it (read as his turn begins). */
  judged?: number;
  /** As the crowd's turn began, before its move: one of his under way or warned, his ultimates so far and his meter (0-1). */
  busy: boolean;
  ults: number;
  meter: number | null;
}

/** One battle lost from the crowd's move `from`: its danger windows (each a crowd move) and the boss turns his ultimates came in. */
async function lostBattle(id: string, from: number): Promise<{ windows: Look[]; looks: Look[]; came: number[]; failures: string[] }> {
  const side = "w";
  const looks: Look[] = [];
  const came: number[] = [];
  let lost = false;
  const watch = (r: MatchRunner, _fen: string, who: "crowd" | "boss") => {
    const p = r.boss!.powers!;
    if (who === "crowd" && r.boss!.crowdMoves + 1 >= from) lost = true;
    while ((p.ults ?? 0) > came.length) came.push(p.ultAt !== undefined ? ultTurn(id, p.ultAt) : r.boss!.crowdMoves);
    const turn = r.boss!.crowdMoves + (who === "crowd" ? 1 : 0);
    if (who === "crowd" && !looks.some((l) => l.turn === turn)) looks.push({ turn, busy: p.ultAt !== undefined || p.warnAt !== undefined, ults: p.ults ?? 0, meter: rageOf(r.boss) });
    const look = looks.find((l) => l.turn === turn);
    if (who === "boss" && look) look.judged = p.judged;
    // (A turn of his that was a power, no move of his (Alfil's fusion, a Repaint): the judge's number read as the next turn begins.)
    const prev = looks.find((l) => l.turn === turn - 1);
    if (who === "crowd" && prev && prev.judged === undefined) prev.judged = p.judged;
  };
  const run = await runBattle({ boss: id, seed: 1 + Math.floor(hash(id) * 1000), side, test: "", triggerFrom: 999, strikes: [], maxMoves: 30, opening: KIT_OPENING, engine: () => lostEngine(side, () => lost) }, null, watch);
  // (A danger window: a move of the crowd's at the danger line (and the moves after it, for a boss whose rule asks for several in a
  // row: dangerMoves), none of his under way or warned as its turn began, none come yet in this danger (since the crowd's moves
  // last went under the line: one ultimate a danger, dangerSpent), one still to come; and a turn of his after it at least.)
  const last = looks.at(-1)?.turn ?? 0;
  const n = dangerMoves(id);
  const held = (l: Look) => looks.filter((x) => x.turn >= l.turn && x.turn < l.turn + n).every((x) => inDanger(x.judged));
  const since = (l: Look) => {
    let i = looks.indexOf(l);
    while (i > 0 && inDanger(looks[i - 1]!.judged)) i--;
    return looks[i]!.turn;
  };
  const fresh = (l: Look) => !came.some((j) => j >= since(l) && j < l.turn);
  return { windows: looks.filter((l) => inDanger(l.judged) && held(l) && !l.busy && fresh(l) && l.ults < capOf(id) && last - l.turn >= n), looks, came, failures: run.failures };
}

describe("a boss in danger: his ultimate within two of his turns (Eric, Nov 26)", () => {
  for (const def of kitBosses().filter((d) => !NOT_HERE[d.id])) {
    const cond = CONDITIONS[def.id];
    it(`${def.id}: the judge has him lost: from each crowd move in danger, his meter full by his next turn and his ultimate ${cond ? `once the board allows it (${cond})` : "in his next turn or the one after"}`, async () => {
      let battle: Awaited<ReturnType<typeof lostBattle>> | null = null;
      let from = 0;
      for (from of LOST_FROM) {
        battle = await lostBattle(def.id, from);
        expect(battle.failures.slice(0, 3).join("\n\n")).toBe("");
        if (battle.windows.length) break;
      }
      expect(battle!.windows.length, `${def.id}: no danger window from any of ${LOST_FROM.join(", ")}`).toBeGreaterThan(0);
      for (const w of battle!.windows) {
        const next = battle!.came.find((j) => j >= w.turn);
        const where = `${def.id}, lost from the crowd's move ${from}: in danger after its move ${w.turn} (judged ${w.judged?.toFixed(2)}), ultimates in his turns ${battle!.came.join(", ") || "none"}`;
        // (One move at the line: by his next turn's end, as the crowd's next turn begins, his meter full, or his ultimate warned, under
        // way or come.)
        const after = battle!.looks.find((l) => l.turn === w.turn + 1);
        if (dangerMoves(def.id) === 1) expect(!!after && (after.busy || (after.meter ?? 0) >= 1 || after.ults > w.ults), `${where}: his meter as the next turn began, ${after?.meter}`).toBe(true);
        expect(next, where).toBeDefined();
        if (!CONDITIONS[def.id]) expect(next! - w.turn + 1, where).toBeLessThanOrEqual(2);
      }
    }, 120_000);
  }
});

describe("one ultimate a danger, then the meter's usual pace (Nov 26: filled again at once, Big Boy's Bounce came 32 times in a battle)", () => {
  // (The shortest ultimates, over in their own turn or the next: filled at once after each, they came every other turn.)
  for (const id of ["bigboy", "hollow"]) {
    it(`${id}: lost from the crowd's move 6 to 30, his ultimates a handful, each after the danger's first at the meter's own pace`, async () => {
      const { came } = await lostBattle(id, 6);
      // (The meter's fastest pace with the crowd ahead: rageFull over ragePerMove + rageAheadMax a move, at his speed.)
      const pace = BOSS_POWERS.rageFull / ((BOSS_POWERS.ragePerMove + BOSS_POWERS.rageAheadMax) * (BOSS_POWERS.rageSpeed[id] ?? 1));
      const inLoss = came.filter((j) => j >= 6);
      expect(inLoss.length, `ultimates in his turns ${came.join(", ")}`).toBeGreaterThan(0);
      expect(inLoss.length, `ultimates in his turns ${came.join(", ")}`).toBeLessThanOrEqual(1 + Math.ceil(24 / pace));
    }, 60_000);
  }
});

/** A level battle's stand-in: every move between 0.3 and 0.65 for whoever moves (never the danger line), a pure function of the position. */
function levelEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.35 * hash(fen + m);
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

describe("below the line, nothing changes (the brief: the meters' normal pace in even games stays)", () => {
  /** One level battle: as each crowd turn begins, his turn, meter, warning, ultimate and their count, and the board. */
  async function level(id: string): Promise<string[]> {
    const seen: string[] = [];
    const watch = (r: MatchRunner, fen: string, who: "crowd" | "boss") => {
      const p = r.boss!.powers!;
      if (who === "crowd") seen.push(`${p.turn} ${rageOf(r.boss)} ${p.warnAt} ${p.ultAt} ${p.ults ?? 0} ${p.judged} ${fen}`);
    };
    await runBattle({ boss: id, seed: 3 + Math.floor(hash(id) * 1000), side: "b", test: "", triggerFrom: 999, strikes: [], maxMoves: 30, opening: KIT_OPENING, engine: levelEngine }, null, watch);
    return seen;
  }
  for (const def of kitBosses()) {
    it(`${def.id}: a level battle (the judge never at ${BOSS_POWERS.dangerAt}) plays the same with the danger rule switched off`, async () => {
      const on = await level(def.id);
      const powers = BOSS_POWERS as { dangerAt: number };
      const was = powers.dangerAt;
      powers.dangerAt = 2;
      let off: string[];
      try {
        off = await level(def.id);
      } finally {
        powers.dangerAt = was;
      }
      expect(on.length).toBeGreaterThan(10);
      expect(on).toEqual(off);
    }, 60_000);
  }
});

describe("the danger line", () => {
  it("in danger from dangerAt on (the judge's number after the crowd's move), never before anything is judged", () => {
    expect(inDanger(undefined)).toBe(false);
    expect(inDanger(BOSS_POWERS.dangerAt - 0.001)).toBe(false);
    expect(inDanger(BOSS_POWERS.dangerAt)).toBe(true);
    expect(inDanger(0.99)).toBe(true);
  });

  it("in danger, the meter is full now, whatever it held, his speed and what the last ultimate spent; below it, the charge as it was", () => {
    for (const speed of [0.7, 1, 1.3, 1.8])
      for (const p of [
        { charge: 0, lost: 0, rageUsed: 0 },
        { charge: 37, lost: 4, rageUsed: 20 },
        { charge: 140, lost: 9, rageUsed: 120 },
      ]) {
        const full = dangerCharge({ ...p, judged: 0.8 }, speed);
        expect(rageNow({ ...p, charge: full }, speed)).toBeGreaterThanOrEqual(BOSS_POWERS.rageFull);
        expect(full).toBeGreaterThanOrEqual(p.charge);
        expect(dangerCharge({ ...p, judged: 0.6 }, speed)).toBe(p.charge);
      }
    // (Already past full: kept.)
    expect(dangerCharge({ charge: 500, lost: 0, rageUsed: 0, judged: 0.9 }, 1)).toBe(500);
  });
});
