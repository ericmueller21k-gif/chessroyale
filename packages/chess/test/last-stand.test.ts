import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, RAID_SETTINGS, lastStandBar, lastStandDue, mulberry32, type Settings } from "@chessroyale/core";
import { LAST_STAND, LAST_STAND_MS, MatchRunner, blunderCost, fenAfter, lastStandHits, legalMoves, sanLineToUci, toSan, type EngineLike, type Opening, type UciEngine } from "../src/index.ts";
import { createNodeEngine } from "../src/node.ts";

/** A raid from the Ruy Lopez, 10 plies in, White (the crowd) to move. */
const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

/**
 * A scripted judge: in every position the crowd's `best` move is worth `bestExpected`, the `blunder` (when legal)
 * `blunderExpected`, and every other move a little less than the best. The blunder's line can carry the boss's
 * best reply and a mate (from the mover's side), as a real search's does.
 */
function judge(script: { best?: string; bestExpected: number; blunder: string; blunderExpected: number; reply?: string; mate?: number }): EngineLike {
  const exp = (fen: string, move: string) =>
    move === script.blunder ? script.blunderExpected : move === script.best ? script.bestExpected : script.bestExpected - 0.02 - 0.05 * hash(fen + move);
  const line = (fen: string, move: string, expected = exp(fen, move)) => ({
    move,
    expected,
    ...(move === script.blunder && script.reply ? { reply: script.reply } : {}),
    ...(move === script.blunder && script.mate !== undefined ? { mate: script.mate } : {}),
  });
  return {
    async topMoves(fen, n) {
      const legal = legalMoves(fen);
      const best = script.best && legal.includes(script.best) ? script.best : null;
      return legal
        .map((move) => line(fen, move, best || move !== legal[0] ? exp(fen, move) : script.bestExpected))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n);
    },
    async scoreMoves(fen, moves) {
      return moves.map((move) => line(fen, move));
    },
  };
}

/** Solo boss raid (just you), the God King with all his charges unless told otherwise. */
function raid(engine: EngineLike, patch: Partial<Settings> = {}, players = 1) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, ...patch } as Settings;
  return new MatchRunner({
    settings,
    rng: mulberry32(5),
    engines: [engine],
    library: [opening(RUY)],
    entrants: Array.from({ length: players }, (_, i) => ({ id: `h${i}`, name: `H${i}`, isBot: false })),
  });
}

const BLUNDER = "f3g5"; // Ng5?: hangs the knight to the queen on d8 in the Ruy Lopez position
const pick = (move: string | null) => new Map([["h0", { move, thinkMs: 1000 }]]);

describe("the God King's Last Stand: the rule", () => {
  it("the bar starts at lastStandLoss (higher while he has charges) and falls to the floor over lastStandDecayMoves", () => {
    const s = { ...DEFAULT_SETTINGS, lastStandLoss: 30, lastStandChargedExtra: 5, lastStandLossFloor: 14, lastStandDecayMoves: 20 };
    expect(lastStandBar(0, 0, s)).toBe(30);
    expect(lastStandBar(0, 3, s)).toBe(35);
    expect(lastStandBar(10, 0, s)).toBe(22);
    expect(lastStandBar(20, 0, s)).toBe(14);
    expect(lastStandBar(45, 0, s)).toBe(14);
    expect(lastStandBar(45, 1, s)).toBe(19);
    // Never when the crowd was already lost before the move.
    expect(lastStandDue(60, 0.39, 0, 0, s)).toBe(false);
    expect(lastStandDue(30, 0.4, 0, 0, s)).toBe(true);
    expect(lastStandDue(29.9, 0.6, 0, 0, s)).toBe(false);
  });

  it("a disaster: the move is taken back, the scores stand, he falls (his charges go), and the crowd picks again without it", async () => {
    const runner = raid(judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.08 }));
    const before = runner.boards.get(0)!.fen;
    expect(runner.boss!.kingCharges).toBe(3);
    runner.deal();
    const r = await runner.score(pick(BLUNDER));
    const b = r.boards[0]!;
    expect(b.result.playedMove).toBe(BLUNDER);
    expect(b.lastStand).toEqual({ move: BLUNDER, loss: 47, bar: 35, before: 0.55, after: 0.08 });
    // Taken back: the board is as it was, the crowd still to move, and it's still crowd move 1.
    expect(runner.boards.get(0)!.fen).toBe(before);
    expect(runner.bossToMove()).toBe(false);
    expect(runner.boss!.crowdMoves).toBe(0);
    // His charges are gone with him; he has fallen.
    expect(runner.boss!.kingCharges).toBe(0);
    expect(runner.boss!.lastStand).toEqual({ atMove: 1, move: BLUNDER, loss: 47, bar: 35, charges: 3, fen: before, bestMove: b.bestMove, before: 0.55, after: 0.08 });
    expect(runner.bossView()!.barred).toBe(BLUNDER);
    // The scores stand: the loss is on your record.
    expect(runner.player("h0").finalLosses).toEqual([47]);
    expect(runner.player("h0").lossesByStage.flat()).toEqual([47]);
    // The re-pick: an ordinary scored round, with the blunder off the table.
    runner.deal();
    const again = await runner.score(pick("d2d3"));
    expect(again.boards[0]!.lastStand).toBeUndefined();
    expect(again.boards[0]!.result.playedMove).toBe("d2d3");
    expect(runner.boss!.barred).toBeUndefined();
    expect(runner.boss!.crowdMoves).toBe(1);
    expect(runner.bossToMove()).toBe(true);
  });

  it("scores are the same with or without the Last Stand", async () => {
    const engine = judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.08 });
    const players = ["h0", "h1", "h2"];
    const picks = new Map(players.map((id, i) => [id, { move: i < 2 ? BLUNDER : "d2d4", thinkMs: 1000 }]));
    const a = raid(engine, {}, 3);
    const b = raid(engine, { lastStandLoss: 999, lastStandLossFloor: 999 }, 3);
    a.deal();
    b.deal();
    const ra = await a.score(picks);
    const rb = await b.score(picks);
    expect(ra.boards[0]!.lastStand).toBeDefined();
    expect(rb.boards[0]!.lastStand).toBeUndefined();
    expect(ra.boards[0]!.result.players).toEqual(rb.boards[0]!.result.players);
    expect(a.leaderboard().map((s) => [s.id, s.points])).toEqual(b.leaderboard().map((s) => [s.id, s.points]));
  });

  it("not when the crowd was already lost, nor for a mistake under the bar", async () => {
    const lost = raid(judge({ bestExpected: 0.38, blunder: BLUNDER, blunderExpected: 0.0 }));
    lost.deal();
    expect((await lost.score(pick(BLUNDER))).boards[0]!.lastStand).toBeUndefined();
    expect(lost.bossToMove()).toBe(true);
    // 32 points at move 1: over the plain bar (30) but under the bar while he holds charges (35).
    const small = raid(judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.23 }));
    small.deal();
    expect((await small.score(pick(BLUNDER))).boards[0]!.lastStand).toBeUndefined();
    // With no charges left, the plain bar: the same mistake calls for him.
    const spent = raid(judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.23 }));
    spent.state = { ...spent.state, boss: { ...spent.state.boss!, kingCharges: 0 } };
    spent.deal();
    expect((await spent.score(pick(BLUNDER))).boards[0]!.lastStand).toMatchObject({ loss: 32, bar: 30 });
  });

  it("the bar falls the longer the battle goes without one: a smaller mistake is enough later on", async () => {
    // 20 points: nothing on move 1, but after enough quiet crowd moves (the floor is under 20), he steps in.
    const engine = judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.35 });
    const early = raid(engine);
    early.deal();
    expect((await early.score(pick(BLUNDER))).boards[0]!.lastStand).toBeUndefined();
    const late = raid(engine);
    late.state = { ...late.state, boss: { ...late.state.boss!, crowdMoves: late.settings.lastStandDecayMoves } };
    late.deal();
    const r = await late.score(pick(BLUNDER));
    expect(r.boards[0]!.lastStand).toMatchObject({ loss: 20, bar: late.settings.lastStandLossFloor + late.settings.lastStandChargedExtra });
  });

  it("once per game; never when the God King plays the move himself", async () => {
    const engine = judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.05 });
    const runner = raid(engine);
    runner.deal();
    runner.kingCallers.add("h0");
    const k = await runner.score(pick(null));
    expect(k.boards[0]!.king).toBe(true);
    expect(k.boards[0]!.lastStand).toBeUndefined();
    await runner.playBoss();
    // Now the disaster: he takes it.
    runner.deal();
    expect((await runner.score(pick(BLUNDER))).boards[0]!.lastStand).toBeDefined();
    runner.deal();
    await runner.score(pick(legalMoves(runner.boards.get(0)!.fen).find((m) => m !== BLUNDER)!));
    // He has fallen: the next disaster is played.
    while (runner.bossToMove()) await runner.playBoss();
    const fen = runner.boards.get(0)!.fen;
    const worst = (await engine.topMoves(fen, 99)).at(-1)!.move;
    runner.deal();
    const r = await runner.score(pick(worst));
    expect(r.boards[0]!.lastStand).toBeUndefined();
    expect(runner.boards.get(0)!.fen).not.toBe(fen);
  });

  it("the re-pick: bots never pick the barred move, it isn't the best, and the boss's strike waits for it", async () => {
    // Ten players (the 50 v 50 final's size): two humans, eight bots; the blunder forced by the test switch.
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, minSurvivors: 1 } as Settings;
    const engine = judge({ best: "d2d4", bestExpected: 0.55, blunder: "d2d4", blunderExpected: 0.55 });
    const runner = new MatchRunner({
      settings,
      rng: mulberry32(9),
      engines: [engine],
      library: [opening(RUY)],
      entrants: [
        { id: "h0", name: "H0", isBot: false },
        { id: "h1", name: "H1", isBot: false },
        ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 0.1 })),
      ],
    });
    runner.state = { ...runner.state, boss: { ...runner.state.boss!, minSurvivors: 1, sinceKill: 2 } };
    runner.forceLastStand = true;
    runner.deal();
    const r = await runner.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }], ["h1", { move: "d2d4", thinkMs: 1000 }]]));
    expect(r.boards[0]!.lastStand?.move).toBe("d2d4");
    // The strike was due after this round, but waits for the re-pick.
    expect(runner.bossKillDue()).toBe(false);
    runner.deal();
    expect(Object.values(runner.botPicksFor(0, [...runner.groups.values()][0]!, await engine.topMoves(runner.boards.get(0)!.fen, 8)))).not.toContain("d2d4");
    const again = await runner.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }], ["h1", { move: "c2c3", thinkMs: 1000 }]]));
    const b = again.boards[0]!;
    // The barred move isn't the best on offer any more; a pick of it counts as no move.
    expect(b.bestMove).not.toBe("d2d4");
    expect(b.result.playedMove).not.toBe("d2d4");
    expect(b.result.players.find((p) => p.playerId === "h0")!.move).toBeNull();
    expect(runner.bossKillDue()).toBe(true);
  });

  it("what it loses: the boss's best reply from the judge's own search, and a mate it allows, on the record", async () => {
    // The scripted search's line for the blunder: the boss answers h6, and mates in 7.
    const reply = "h7h6";
    const runner = raid(judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.08, reply, mate: -7 }));
    runner.deal();
    const b = (await runner.score(pick(BLUNDER))).boards[0]!;
    expect(b.lastStand).toMatchObject({ move: BLUNDER, reply, mateIn: 7, before: 0.55, after: 0.08 });
    expect(runner.boss!.lastStand).toMatchObject({ reply, mateIn: 7, fen: b.fenBefore, bestMove: b.bestMove });
    // A reply that isn't legal after the move is dropped; a mate for the crowd isn't one it allows.
    const odd = raid(judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.08, reply: "e2e4", mate: 4 }));
    odd.deal();
    const o = (await odd.score(pick(BLUNDER))).boards[0]!.lastStand!;
    expect(o.reply).toBeUndefined();
    expect(o.mateIn).toBeUndefined();
  });

  it("his leftover charges become power-ups for everyone still in: the engine's top 3, never brilliant", async () => {
    const engine = judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.08 });
    const runner = raid(engine, {}, 3);
    expect(runner.state.players.map((p) => p.powerUps)).toEqual([0, 0, 0]);
    runner.deal();
    await runner.score(new Map(["h0", "h1", "h2"].map((id) => [id, { move: BLUNDER, thinkMs: 1000 }])));
    // He fell with 3 charges: 3 power-ups each (lastStandPowerUps per charge), and they're on the leaderboard.
    expect(runner.boss!.lastStand!.charges).toBe(3);
    expect(runner.state.players.map((p) => p.powerUps)).toEqual([3, 3, 3]);
    expect(runner.leaderboard().map((s) => s.powerUps)).toEqual([3, 3, 3]);
    // The re-pick: h0 uses one and plays the engine's best. It's an ordinary pick, marked as a power-up move (so it
    // can never count as brilliant: see brilliance), and it costs one power-up.
    runner.deal();
    const best = (await engine.topMoves(runner.boards.get(0)!.fen, 8)).find((m) => m.move !== BLUNDER)!.move;
    const r = await runner.score(
      new Map([
        ["h0", { move: best, thinkMs: 1000, usedPowerUp: true }],
        ["h1", { move: legalMoves(runner.boards.get(0)!.fen).find((m) => m !== best && m !== BLUNDER)!, thinkMs: 1000 }],
        ["h2", { move: null, thinkMs: 20000 }],
      ]),
    );
    const mine = r.boards[0]!.result.players.find((p) => p.playerId === "h0")!;
    expect(mine.usedPowerUp).toBe(true);
    expect(runner.player("h0").powerUps).toBe(2);
    expect(runner.player("h0").powerUpsUsed).toBe(1);
    expect(runner.player("h1").powerUps).toBe(3);
  });

  it("no charges left when he falls: no power-ups", async () => {
    const runner = raid(judge({ bestExpected: 0.55, blunder: BLUNDER, blunderExpected: 0.08 }));
    runner.state = { ...runner.state, boss: { ...runner.state.boss!, kingCharges: 0 } };
    runner.deal();
    expect((await runner.score(pick(BLUNDER))).boards[0]!.lastStand).toBeDefined();
    expect(runner.boss!.lastStand!.charges).toBe(0);
    expect(runner.player("h0").powerUps).toBe(0);
  });

  it("its timeline: about 10 s, the warning first (1.2–1.5 s), every beat in order, 25 slashes with damage numbers the same on every screen", () => {
    expect(LAST_STAND_MS).toBeGreaterThanOrEqual(9200);
    expect(LAST_STAND_MS).toBeLessThanOrEqual(10500);
    expect(LAST_STAND.warnMs).toBeGreaterThanOrEqual(1200);
    expect(LAST_STAND.warnMs).toBeLessThanOrEqual(1500);
    // The warning only adds to it: everything after starts warnMs later than it used to (the freeze at 250 ms, the end at 8.6 s).
    expect(LAST_STAND.freezeAt - LAST_STAND.warnMs).toBe(250);
    expect(LAST_STAND.endMs - LAST_STAND.warnMs).toBe(8600);
    const beats = [0, LAST_STAND.badgeAt, LAST_STAND.warnMs, LAST_STAND.freezeAt, LAST_STAND.leapAt, LAST_STAND.fallAt, LAST_STAND.crashAt, LAST_STAND.bannerAt, LAST_STAND.bannerAt + LAST_STAND.bannerMs, LAST_STAND.slideAt, LAST_STAND.slashAt, LAST_STAND.slashAt + LAST_STAND.slashes * LAST_STAND.slashEveryMs, LAST_STAND.staggerAt, LAST_STAND.collapseAt, LAST_STAND.fadeAt, LAST_STAND.fadeAt + LAST_STAND.fadeMs, LAST_STAND.endMs];
    expect([...beats].sort((a, b) => a - b)).toEqual(beats);
    const hits = lastStandHits("e2e4");
    expect(hits).toHaveLength(25);
    expect(hits).toEqual(lastStandHits("e2e4"));
    expect(hits.every((h) => h >= 6 && h <= 14)).toBe(true);
    expect(new Set(hits).size).toBeGreaterThan(3);
  });
});

describe("the God King's Last Stand: real blunders, the real judge", () => {
  let engine: UciEngine;
  beforeAll(async () => {
    // The judge as the game runs it on a phone: the top 8 at engineNodes, close calls re-checked at recheckNodes.
    engine = await createNodeEngine({ nodes: DEFAULT_SETTINGS.engineNodes, hashMb: 16 });
  }, 30_000);
  afterAll(() => engine.close());

  // Real raid starts (named openings, 10 plies in, White to move), and an early blunder in each, on crowd move 1
  // with all three of his charges: the highest the bar ever is.
  const cases: [string, string[], string, "q" | "n" | "b"][] = [
    ["hangs the queen: Sicilian, Open", sanLineToUci(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "Nc6"]), "Qg4", "q"],
    ["hangs a knight to a pawn: Queen's Gambit Declined, Exchange", sanLineToUci(["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5", "Bg5", "c6"]), "Ne4", "n"],
    ["hangs a bishop: King's Indian, Fianchetto", sanLineToUci(["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "Nf3", "d6", "g3", "O-O"]), "Bh6", "b"],
  ];
  for (const [name, moves, san, piece] of cases) {
    it(`${name}: ${san} calls for the Last Stand from move 1`, async () => {
      const runner = new MatchRunner({
        settings: { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 3190 } as Settings,
        rng: mulberry32(1),
        engines: [engine],
        library: [opening(moves)],
        entrants: [{ id: "h0", name: "H0", isBot: false }],
      });
      const fen = fenAfter(moves);
      const blunder = legalMoves(fen).find((m) => toSan(fen, m).replace(/[+#]$/, "") === san)!;
      expect(blunder).toBeTruthy();
      runner.deal();
      const r = await runner.score(pick(blunder));
      const stand = r.boards[0]!.lastStand;
      expect(stand, `the judge gave ${blunder} a loss of ${r.boards[0]!.scored.find((m) => m.move === blunder)?.loss}`).toBeDefined();
      expect(stand!.bar).toBe(lastStandBar(0, 3, runner.settings));
      expect(stand!.loss).toBeGreaterThan(stand!.bar + 5);
      expect(runner.boards.get(0)!.fen).toBe(fen);
      // What it loses, from the judge's own search: the boss's best reply takes the piece.
      expect(stand!.reply, "the boss's reply").toBeDefined();
      expect(blunderCost(fen, blunder, stand!.reply, stand!.mateIn)).toEqual({ kind: "piece", piece });
      expect(stand!.before! - stand!.after!).toBeCloseTo(stand!.loss / 100, 2);
    }, 60_000);
  }
});
