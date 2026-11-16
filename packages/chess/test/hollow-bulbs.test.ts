import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, BOSS_ALONE_SCORING, mulberry32, type Settings } from "@chessroyale/core";
import {
  HOLLOW_RULES,
  MatchRunner,
  START_FEN,
  addDarkBlock,
  applyMove,
  blockSquares,
  blocksAfter,
  bulbForces,
  chooseDarkBlock,
  darkForcedMoveFrom,
  legalMoves,
  pieceAt,
  powerTurn,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Hollow's ten bulbs in Boss alone, his bigger darkness and the dark's move for you (Eric, Nov 5, 2026;
 * docs/decisions/2026-11-05-hollow-bulbs.md): each wrong move into the dark puts a bulb out (no points), the 3rd and
 * 7th make the dark play a bad move for you, the 10th loses the battle; crowds keep the points; a 2 x 2 block on his
 * 6th, 12th and 18th moves (4 turns) and his 3 x 3 once a game on his 9th (2 turns).
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
function fakeEngine(): EngineLike {
  const score = (fen: string, m: string) => 0.3 + 0.4 * hash(fen + m);
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
  };
}
const LINE = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7", "f1e1", "b7b5"];
const opening: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves: LINE, namedPlies: LINE.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } };

/** Boss alone against Hollow (his bulbs on, as solo.ts sets them), or with bots (a crowd). */
function battle(opts: { bots?: number; patch?: Partial<Settings>; bulbs?: boolean; seed?: number } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, ...BOSS_ALONE_SCORING, bossNoStrikes: true, bossFixedElo: 2000, bossId: "hollow", lastStandFrom: 999, ...(opts.bulbs === false ? {} : { hollowBulbs: true }), ...opts.patch } as Settings;
  const bots = Array.from({ length: opts.bots ?? 0 }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, isBot: true, skill: 2 }));
  return new MatchRunner({ settings, rng: mulberry32(opts.seed ?? 5), engines: [fakeEngine()], library: [opening], entrants: [{ id: "h0", name: "H", isBot: false }, ...bots] });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
async function turn(r: MatchRunner, move?: string) {
  r.deal();
  await r.score(new Map([["h0", { move: move ?? legalMoves(fenOf(r)).sort()[0]!, thinkMs: 1000 }]]));
  if (r.isOver() || r.stageComplete()) return;
  if (r.lightsOutDue()) {
    r.startLightsOut();
    r.finishLightsOut({});
  }
  await r.playBoss();
}
/** A wrong move into the dark now: from a dark square of his to a square it can't reach. */
function wrongTry(r: MatchRunner): string {
  const fen = fenOf(r);
  const legal = legalMoves(fen);
  for (const d of r.darkSquares()) for (const t of ["a3", "h3", "a6", "h6", "d5"]) if (t !== d && !legal.includes(`${d}${t}`)) return `${d}${t}`;
  throw new Error("no wrong try");
}

describe("Hollow's bulbs in Boss alone (Eric, Nov 5)", () => {
  it("as the battle begins: his rule set, and the strand of 10 with none out; only alone, and only when Boss alone asks for it", () => {
    const r = battle();
    expect(r.boss!.powers!.hv).toBe(HOLLOW_RULES);
    expect(r.boss!.powers!.strand).toEqual({ out: 0 });
    expect(r.bossView()!.powers!.strand).toEqual({ out: 0, of: BOSS_POWERS.darkBulbs });
    expect(BOSS_POWERS.darkBulbs).toBe(10);
    // A crowd (a raid, a party) keeps the points, even asked; and so does a battle without the switch.
    expect(battle({ bots: 3 }).boss!.powers!.strand).toBeUndefined();
    expect(battle({ bulbs: false }).boss!.powers!.strand).toBeUndefined();
    // The test switch (?bulbs=N): already N out, never all of them.
    expect(battle({ patch: { hollowBulbsOut: 6 } }).boss!.powers!.strand).toEqual({ out: 6 });
    expect(battle({ patch: { hollowBulbsOut: 40 } }).boss!.powers!.strand).toEqual({ out: 9 });
  });

  it("each wrong move into the dark puts one out, costs no points and never ends the turn by count; the 3rd and the 7th bring the dark's move", async () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => bulbForces(n))).toEqual([3, 7]);
    const r = battle();
    await turn(r, "e2e4");
    r.deal();
    const before = r.player("h0").stageScore;
    const a = r.darkTry("h0", wrongTry(r));
    const b = r.darkTry("h0", wrongTry(r));
    expect(a).toEqual({ kind: "wrong", tries: 1, out: false, bulbs: 1 });
    expect(b).toEqual({ kind: "wrong", tries: 2, out: false, bulbs: 2 });
    // The 3rd: the dark plays this turn's move for you.
    expect(r.darkTry("h0", wrongTry(r))).toEqual({ kind: "wrong", tries: 3, out: true, bulbs: 3, forced: true });
    expect(r.darkForcedDue()).toBe(true);
    // Nothing more to try this turn (refused, free); the bulbs stay at 3.
    expect(r.darkTry("h0", wrongTry(r))).toEqual({ kind: "refused" });
    expect(r.boss!.powers!.strand).toEqual({ out: 3 });
    const forced = await r.playDarkForced();
    expect(r.darkForcedDue()).toBe(false);
    // Once picked it is the turn's only move, and asking again keeps it.
    expect(r.crowdAllowed()).toEqual([forced]);
    expect(r.applyDarkForced("a2a3")).toBe(forced);
    expect(r.bossView()!.powers!.forced).toMatchObject({ turn: r.boss!.crowdMoves + 1, at: 3, move: forced });
    expect(powerTurn(r.boss)).toBe(true);
    const report = await r.score(new Map([["h0", { move: forced, thinkMs: 1000 }]]));
    expect(report.boards[0]!.result.playedMove).toBe(forced);
    // No points off for the bulbs (alone, a move's own score is 0).
    expect(r.player("h0").stageScore - before).toBe(report.boards[0]!.result.players[0]!.roundScore);
    expect(report.boards[0]!.result.players[0]!.roundScore).toBeGreaterThanOrEqual(0);
    // Next turn: free again.
    await r.playBoss();
    r.deal();
    expect(r.darkForcedDue()).toBe(false);
    expect(r.crowdAllowed()).toBeNull();
  });

  it("five wrong tries in a turn don't end it (the 5-a-turn rule is the crowd's), and the 7th brings the dark's move again", async () => {
    const r = battle({ patch: { hollowBulbsOut: 3 } });
    await turn(r, "e2e4");
    r.deal();
    const outs = [1, 2, 3].map(() => r.darkTry("h0", wrongTry(r)));
    expect(outs.map((o) => o.kind === "wrong" && o.out)).toEqual([false, false, false]);
    expect(r.darkTry("h0", wrongTry(r))).toEqual({ kind: "wrong", tries: 4, out: true, bulbs: 7, forced: true });
  });

  it("the 10th loses the battle outright: the stage is over and the boss has won, whatever the board says", async () => {
    const r = battle({ patch: { hollowBulbsOut: 9 } });
    await turn(r, "e2e4");
    r.deal();
    expect(r.stageComplete()).toBe(false);
    expect(r.darkTry("h0", wrongTry(r))).toEqual({ kind: "wrong", tries: 1, out: true, bulbs: 10, blackout: true });
    expect(r.bossView()!.powers!.blackout).toEqual({ turn: 2 });
    expect(r.stageComplete()).toBe(true);
    expect(r.bossBlackout).toBe(true);
    expect(r.finishBossBattle()).toBe("boss");
    expect(r.boss!.result).toBe("boss");
    // Nothing more goes out.
    expect(r.darkTry("h0", wrongTry(r))).toEqual({ kind: "refused" });
  });

  it("a crowd keeps today's points: -5 a wrong try, the 5th a missed move, no bulbs", async () => {
    const r = battle({ bots: 3 });
    await turn(r, "e2e4");
    r.deal();
    const tries = [1, 2, 3, 4, 5].map(() => r.darkTry("h0", wrongTry(r)));
    expect(tries).toEqual([1, 2, 3, 4, 5].map((n) => ({ kind: "wrong", tries: n, out: n === 5 })));
    expect(r.boss!.powers!.strand).toBeUndefined();
    expect(r.darkForcedDue()).toBe(false);
    expect(r.bossView()!.powers!.strand).toBeUndefined();
    // And the 3 wrong tries cost 15 points as before.
    const s = battle({ bots: 3 });
    await turn(s, "e2e4");
    s.deal();
    for (let i = 0; i < 3; i++) s.darkTry("h0", wrongTry(s));
    const plain = battle({ bots: 3 });
    await turn(plain, "e2e4");
    plain.deal();
    const me = async (x: MatchRunner) => (await x.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]))).boards[0]!.result.players.find((p) => p.playerId === "h0")!.roundScore;
    expect(await me(s)).toBeCloseTo(Math.max(DEFAULT_SETTINGS.missedMoveScore, (await me(plain)) - 3 * BOSS_POWERS.darkTryCost), 6);
  });
});

describe("the dark's move for you: genuinely bad, never a mate either way", () => {
  /** An engine with set scores (the mover's expected score after each move); the rest 0.5. */
  const scripted = (scores: Record<string, number>, mates: Record<string, number> = {}): EngineLike => {
    const one = (m: string) => ({ move: m, expected: scores[m] ?? 0.5, ...(mates[m] !== undefined ? { mate: mates[m] } : {}) });
    return {
      topMoves: async (fen, n) => legalMoves(fen).map(one).sort((a, b) => b.expected - a.expected).slice(0, n),
      scoreMoves: async (_fen, moves) => [...new Set(moves)].map(one),
      playAtElo: async (fen) => legalMoves(fen)[0]!,
    };
  };

  it("gives away 15 to 30 points against the best, the one nearest the middle", async () => {
    const fen = START_FEN;
    const move = await darkForcedMoveFrom(scripted({ e2e4: 0.55, d2d4: 0.54, g1f3: 0.5, a2a3: 0.33, b2b4: 0.36, g2g4: 0.2 }), fen);
    // Best 0.55: a2a3 gives away 22, b2b4 19, g2g4 35 (past the range), the rest under 15.
    expect(move).toBe("a2a3");
    expect(BOSS_POWERS.darkForcedLoss).toEqual([15, 30]);
  });

  it("never one that lets him force mate, nor one that mates or stalemates on the spot", async () => {
    // White mates with Ra8; here it's scored as if it were a 22-point gift: still never played for you.
    const fen = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
    expect(legalMoves(applyMove(fen, "a1a8"))).toEqual([]);
    const move = await darkForcedMoveFrom(scripted({ a1a2: 0.9, a1a8: 0.68, g1f1: 0.7, a1a7: 0.68 }, { a1a7: -3 }), fen);
    expect(move).not.toBe("a1a8");
    expect(move).not.toBe("a1a7");
    expect(move).toBe("g1f1");
  });
});

describe("Hollow's bigger darkness (rule set 2)", () => {
  it("the cadence: a 2 x 2 after his 6th, 12th and 18th moves, his 3 x 3 once a game after his 9th; the test switch brings one on his first", () => {
    const at = (size: number) => Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => blocksAfter(n).includes(size));
    expect(at(2)).toEqual([6, 12, 18]);
    expect(at(3)).toEqual([9]);
    expect(blocksAfter(1, BOSS_POWERS, 2)).toEqual([2]);
    expect(blocksAfter(1, BOSS_POWERS, 3)).toEqual([3]);
    expect([BOSS_POWERS.darkBlockTurns, BOSS_POWERS.darkBigTurns]).toEqual([4, 2]);
  });

  it("placement: wholly on the board, never a king's square (so never all of a king's escape squares), with pieces in it, the same from the same seed", () => {
    const fens = [START_FEN, "4k3/8/8/8/8/8/8/K7 w - - 0 1", "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 9", "7k/6pp/8/8/8/8/PP6/K7 w - - 0 1"];
    for (const fen of fens)
      for (const size of [2, 3])
        for (let seed = 1; seed <= 60; seed++) {
          const b = chooseDarkBlock(fen, size, seed, 7, size === 3 ? BOSS_POWERS.darkBigMinPieces : BOSS_POWERS.darkBlockMinPieces)!;
          expect(b.squares).toHaveLength(size * size);
          expect(b.squares).toEqual(blockSquares(b.corner, size));
          const kings = b.squares.filter((sq) => pieceAt(fen, sq)?.type === "k");
          expect(kings).toEqual([]);
          // Every king keeps an escape square out of the block (when it has any on the board at all).
          for (const k of ["a1", "e8", "g8", "e1", "h8"].filter((sq) => pieceAt(fen, sq)?.type === "k")) {
            const f = k.charCodeAt(0) - 97;
            const r = Number(k[1]);
            const near = [-1, 0, 1].flatMap((df) => [-1, 0, 1].map((dr) => [f + df, r + dr] as const)).filter(([x, y]) => (x !== f || y !== r) && x >= 0 && x < 8 && y >= 1 && y <= 8).map(([x, y]) => `${"abcdefgh"[x]}${y}`);
            expect(near.every((sq) => b.squares.includes(sq))).toBe(false);
          }
          const pieces = b.squares.filter((sq) => pieceAt(fen, sq)).length;
          // (With pieces enough for one: the bare kings and the endgame may have none.)
          if (fen === fens[0] || fen === fens[2]) expect(pieces).toBeGreaterThanOrEqual(size === 3 ? BOSS_POWERS.darkBigMinPieces : BOSS_POWERS.darkBlockMinPieces);
          expect(chooseDarkBlock(fen, size, seed, 7, 2)).toEqual(chooseDarkBlock(fen, size, seed, 7, 2));
        }
  });

  it("overlap: a square already dark keeps one entry, dark until the later end; only new squares are newly dark", () => {
    const { dark, fresh } = addDarkBlock([{ square: "d4", at: 2, until: 11 }, { square: "e5", at: 3, until: 4 }], blockSquares("d4", 2), 4, 7);
    expect(fresh).toEqual(["e4", "d5"]);
    expect(dark).toEqual([
      { square: "d4", at: 2, until: 11 },
      { square: "e5", at: 3, until: 7 },
      { square: "e4", at: 4, until: 7 },
      { square: "d5", at: 4, until: 7 },
    ]);
  });

  it("in a battle: the 2 x 2 falls after his 6th move for 4 turns, the 3 x 3 after his 9th for 2; a battle of the old rule set has neither", async () => {
    const r = battle({ bulbs: false, patch: { bossMaxMoves: 40 } });
    const blocks: { turn: number; size: number; corner: string }[] = [];
    for (let t = 1; t <= 11 && !r.isOver() && !r.stageComplete(); t++) {
      await turn(r);
      const p = r.boss!.powers!;
      for (const e of p.events) if (e.kind === "darkBlock") blocks.push({ turn: e.turn, size: e.size!, corner: e.square! });
      for (const b of blocks.filter((x) => x.turn === p.turn)) {
        const len = b.size === 3 ? BOSS_POWERS.darkBigTurns : BOSS_POWERS.darkBlockTurns;
        for (const sq of blockSquares(b.corner, b.size)) expect(p.dark!.find((d) => d.square === sq)!.until).toBeGreaterThanOrEqual(p.turn + len - 1);
      }
    }
    // His 6th move is played before crowd turn 7, his 9th before turn 10.
    expect(blocks.map((b) => [b.turn, b.size])).toEqual([
      [7, 2],
      [10, 3],
    ]);
    // A battle begun before (no rule set): single squares only.
    const old = battle({ bulbs: false });
    old.state = { ...old.state, boss: { ...old.state.boss!, powers: { ...old.state.boss!.powers!, hv: undefined } } };
    for (let t = 1; t <= 10 && !old.isOver() && !old.stageComplete(); t++) {
      await turn(old);
      expect(old.boss!.powers!.events.some((e) => e.kind === "darkBlock")).toBe(false);
    }
  });

  it("the test switch (?darkblock=2 or 3): the block falls with his first cover", async () => {
    for (const size of [2, 3] as const) {
      const r = battle({ bulbs: false, patch: { hollowBlockTest: size } });
      await turn(r, "e2e4");
      const e = r.boss!.powers!.events.find((x) => x.kind === "darkBlock")!;
      expect(e.size).toBe(size);
      expect(r.darkSquares().length).toBeGreaterThanOrEqual(size * size);
    }
  });
});
