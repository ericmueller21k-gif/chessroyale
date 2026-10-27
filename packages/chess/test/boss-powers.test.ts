import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossPowerSettings, type BossState, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  applyMove,
  blizzardNow,
  boardFlipped,
  bossAllowed,
  chooseBlizzard,
  bossMoveFrom,
  chooseFreeze,
  choosePie,
  crowdAllowed,
  boardAngle,
  funhouseAngle,
  funhouseDue,
  funhouseMoveFrom,
  funhousePlayed,
  shownAngle,
  icedSquares,
  initPowers,
  inCheck,
  judgeBotPicks,
  judgedBoard,
  legalMoves,
  pieceAt,
  powerTurn,
  prepareTurn,
  rageOf,
  runJudgeJob,
  sanLineToUci,
  strikeRage,
  verdictMoves,
  type EngineLike,
  type JudgeJob,
  type Opening,
} from "../src/index.ts";

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

/** A stand-in engine: each move's score is a hash of the position and the move. */
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

const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const RUY_FEN = "r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 6 6";
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });

/**
 * The meter's rates these tests were written for (5 a crowd move, a queen's worth a full meter, every boss at speed 1),
 * so a retune of the shipped numbers (settings.ts) doesn't move them.
 */
const S: BossPowerSettings = { ...BOSS_POWERS, ragePerMove: 5, rageAheadMax: 5, ragePerMaterial: 100 / 9, rageStrike: 25, rageSpeed: {} };

/** A boss battle's state at the crowd's turn, with powers. */
function battle(id: "gingerbread" | "clown", fen: string, patch: Partial<BossState> = {}, seed = 7): BossState {
  return { id, elo: 1500, crowdSide: "w", crowdMoves: 0, sinceKill: 0, kills: [], powers: initPowers(seed, fen, "w"), ...patch };
}

/** Random play from the Ruy Lopez: the positions a long game passes through, the crowd (White) to move. */
function positions(n: number, seed: number): string[] {
  const rng = mulberry32(seed);
  const out: string[] = [];
  let fen = RUY_FEN;
  for (let i = 0; i < n * 2 && legalMoves(fen).length; i++) {
    if (fen.split(" ")[1] === "w") out.push(fen);
    const legal = legalMoves(fen);
    fen = applyMove(fen, legal[Math.floor(rng() * legal.length)]!);
  }
  return out;
}

describe("boss powers: the ground rules", () => {
  it("never leaves the crowd without a legal move, and never a move that isn't legal (freeze, pie, blizzard, together)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const fen of positions(40, seed)) {
        const legal = legalMoves(fen);
        if (!legal.length) continue;
        const freeze = chooseFreeze(fen, "w", seed, 3);
        const pie = choosePie(fen, seed, 3);
        for (const [id, powers] of [
          ["gingerbread", { frozen: freeze ? { ...freeze, until: 9 } : null }],
          ["gingerbread", { ultAt: 1, frozen: freeze ? { ...freeze, until: 9 } : null }],
          ["clown", { pie: pie ? { square: pie, until: 9 } : null }],
        ] as const) {
          const b = battle(id, fen);
          const state = { ...b, powers: { ...b.powers!, ...powers } };
          const allowed = crowdAllowed(state, fen) ?? legal;
          expect(allowed.length).toBeGreaterThan(0);
          for (const m of allowed) expect(legal).toContain(m);
          const boss = bossAllowed(state, applyMove(fen, legal[0]!));
          if (boss) expect(boss.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never freezes the king, nor a piece without a move, nor the only piece that can move", () => {
    for (const seed of [1, 2, 3]) {
      for (const fen of positions(40, seed)) {
        const f = chooseFreeze(fen, "w", seed, 4);
        if (!f) continue;
        const p = pieceAt(fen, f.square)!;
        expect(p.color).toBe("w");
        expect(p.type).not.toBe("k");
        const legal = legalMoves(fen);
        expect(legal.some((m) => m.startsWith(f.square))).toBe(true);
        expect(legal.some((m) => !m.startsWith(f.square))).toBe(true);
      }
    }
  });

  it("in check, a freeze lifts when the frozen piece holds the only escapes", () => {
    // White's king is checked along the first rank; only the knight can block (Nc1, Ng1).
    const fen = "6k1/8/8/8/8/8/4N1PP/r6K w - - 0 1";
    expect(inCheck(fen)).toBe(true);
    expect(legalMoves(fen).sort()).toEqual(["e2c1", "e2g1"]);
    const b = battle("gingerbread", fen);
    const frozen = { ...b, powers: { ...b.powers!, frozen: { square: "e2", piece: "n", until: 3 } } };
    expect(crowdAllowed(frozen, fen)).toBeNull(); // every legal move, i.e. both escapes
    // And the freeze itself would never pick it: freezing it leaves nothing else.
    expect(chooseFreeze(fen, "w", 1, 1)).toBeNull();
  });

  it("a frozen rook can't castle either (the king's step that moves it)", () => {
    // White can castle short; the rook on h1 is frozen. (Found by the review of Folio's fold, Oct 27.)
    const fen = "k6r/8/8/8/8/8/5N2/4K2R w K - 0 20";
    expect(legalMoves(fen)).toContain("e1g1");
    const b = battle("gingerbread", fen);
    const frozen = { ...b, powers: { ...b.powers!, frozen: { square: "h1", piece: "r", until: 3 } } };
    const allowed = crowdAllowed(frozen, fen)!;
    expect(allowed).not.toContain("e1g1");
    expect(allowed.some((m) => m.startsWith("h1"))).toBe(false);
    expect(allowed).toEqual(expect.arrayContaining(["e1f1", "e1d1", "f2g4"]));
  });

  it("in check, a pie lifts when the only escape lands on it", () => {
    // The king on h1 is checked by the rook on h8; its only move is to g1... a pie there would leave none.
    const fen = "6kr/8/8/8/8/8/6PP/7K w - - 0 1";
    const legal = legalMoves(fen);
    const b = battle("clown", fen);
    // (The pie is near the center in play; here it sits on the escape square to test the rule.)
    for (const sq of new Set(legal.map((m) => m.slice(2, 4)))) {
      const pied = { ...b, powers: { ...b.powers!, pie: { square: sq, until: 3 } } };
      const allowed = crowdAllowed(pied, fen) ?? legal;
      expect(allowed.length).toBeGreaterThan(0);
      if (legal.length === 1) expect(allowed).toEqual(legal);
    }
  });

  it("the blizzard: one crowd piece moves, at random from the seed among those with a move; never the king while another can", () => {
    const fen = "4k3/8/8/8/8/2N5/PPP5/1K1Q4 w - - 0 1";
    const free = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const b = battle("gingerbread", fen, { crowdMoves: 2 }, seed);
      const sq = chooseBlizzard(fen, "w", seed, 3)!;
      // The same seed, the same piece; it always has a move; never the king here.
      expect(chooseBlizzard(fen, "w", seed, 3)).toBe(sq);
      expect(legalMoves(fen).some((m) => m.startsWith(sq))).toBe(true);
      expect(pieceAt(fen, sq)?.type).not.toBe("k");
      free.add(sq);
      const iced = ["a2", "b1", "b2", "c2", "c3", "d1"].filter((x) => x !== sq);
      const bliz = { ...b, powers: { ...b.powers!, turn: 3, warnAt: 2, ultAt: 3, blizzard: { turn: 3, square: sq, at: 3, iced, next: [] } } };
      expect(blizzardNow(bliz)).toBe(true);
      const a = crowdAllowed(bliz, fen)!;
      expect(a.length).toBeGreaterThan(0);
      for (const m of a) expect(m.slice(0, 2)).toBe(sq);
      // Every other crowd piece shows ice.
      expect(icedSquares(bliz, fen)).toEqual(iced);
      // Its ice is for its own turn: the next is set up as that turn begins (ginger.test.ts: the thaw).
      expect(blizzardNow({ ...bliz, crowdMoves: 3 })).toBe(false);
    }
    // Different seeds pick different pieces (the queen, the knight, a pawn…): it's no longer always the queen.
    expect(free.size).toBeGreaterThan(3);
    // The frozen piece isn't picked while another can move; the king only when nothing else can; nothing: null.
    for (let seed = 0; seed < 30; seed++) expect(chooseBlizzard(fen, "w", seed, 3, "d1")).not.toBe("d1");
    expect(chooseBlizzard("4k3/8/8/8/8/8/8/1K6 w - - 0 1", "w", 1, 3)).toBe("b1");
    expect(chooseBlizzard("4k3/8/8/8/8/8/8/1K6 w - - 0 1", "w", 1, 3, null)).toBe("b1");
    expect(chooseBlizzard("7k/8/8/8/8/8/6q1/7K w - - 0 1", "w", 1, 3)).toBe("h1");
  });

  it("the blizzard keeps the mercy rules: in check only a piece that can answer it is free; a piece with no move left lifts it", () => {
    // White in check from the rook on e8: only the king (moving) and the bishop (blocking on e2) can answer it.
    const check = "4r1k1/8/8/8/8/8/PP3B2/4K3 w - - 0 1";
    const answers = new Set(legalMoves(check).map((m) => m.slice(0, 2)));
    for (let seed = 0; seed < 40; seed++) {
      const sq = chooseBlizzard(check, "w", seed, 3)!;
      expect(answers.has(sq)).toBe(true);
      // Never the king while the bishop can answer.
      expect(sq).toBe("f2");
    }
    // The free piece's only move barred (the God King's Last Stand): the ice lifts rather than leave no move.
    const one = "4k3/8/8/8/8/8/P7/4K3 w - - 0 1";
    const b = battle("gingerbread", one, { crowdMoves: 2 });
    const bliz = { ...b, powers: { ...b.powers!, turn: 3, warnAt: 2, ultAt: 3, blizzard: { turn: 3, square: "a2", at: 3, iced: ["e1"], next: [] } }, barred: "a2a3" };
    const a = crowdAllowed(bliz, one)!;
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toContain("a2a3");
  });

  it("the blizzard as a turn begins: its free piece from the seed and the position, named in its moment", () => {
    const down = RUY_FEN.replace("r1bqk2r", "r1b1k2r");
    const at = (seed: number) => {
      let b = prepareTurn(battle("gingerbread", RUY_FEN, {}, seed), RUY_FEN, "", S);
      b = prepareTurn({ ...b, crowdMoves: 1 }, down, "", S);
      return prepareTurn({ ...b, crowdMoves: 2 }, down, "", S);
    };
    for (let seed = 1; seed < 12; seed++) {
      const b = at(seed);
      const e = b.powers!.events.find((x) => x.kind === "blizzard")!;
      expect(e.square).toBe(b.powers!.blizzard!.square);
      expect(e.square).toBe(chooseBlizzard(down, "w", b.powers!.seed, 3, b.powers!.frozen?.square));
      expect(at(seed).powers!.blizzard).toEqual(b.powers!.blizzard);
      for (const m of crowdAllowed(b, down)!) expect(m.slice(0, 2)).toBe(e.square);
      // Every other crowd piece iced; three or four of them named to thaw next turn (four or five free in all then).
      expect(b.powers!.blizzard!.iced).toHaveLength(15);
      expect(b.powers!.blizzard!.next!.length).toBeGreaterThanOrEqual(3);
      expect(b.powers!.blizzard!.next!.length).toBeLessThanOrEqual(4);
    }
  });

  it("the move the God King took back stays barred on top of a power, but never leaves no move", () => {
    const fen = "6k1/8/8/8/8/8/4N1PP/r6K w - - 0 1";
    const b = battle("gingerbread", fen, { barred: "e2c1" });
    expect(crowdAllowed(b, fen)).toEqual(["e2g1"]);
  });
});

describe("boss powers: as each turn begins", () => {
  it("is deterministic: the same seed and position give the same freeze and pie, a different seed may not", () => {
    const fens = positions(30, 9);
    for (const fen of fens) {
      expect(chooseFreeze(fen, "w", 42, 5)).toEqual(chooseFreeze(fen, "w", 42, 5));
      expect(choosePie(fen, 42, 5)).toEqual(choosePie(fen, 42, 5));
    }
    const picks = new Set(fens.slice(0, 10).map((fen) => JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8].map((s) => chooseFreeze(fen, "w", s, 5)))));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("puts the pie on an empty square near the center that the fewest moves can reach", () => {
    for (const fen of positions(30, 3)) {
      const sq = choosePie(fen, 1, 2);
      if (!sq) continue;
      expect(pieceAt(fen, sq)).toBeNull();
      expect("cdef").toContain(sq[0]!);
      expect("3456").toContain(sq[1]!);
    }
  });

  it("freezes every 4-6 turns from turn 2, for 2 turns; the second call for the same turn changes nothing", () => {
    let b = battle("gingerbread", RUY_FEN);
    const freezes: number[] = [];
    for (let turn = 1; turn <= 30; turn++) {
      b = prepareTurn({ ...b, crowdMoves: turn - 1 }, RUY_FEN);
      expect(prepareTurn(b, RUY_FEN)).toBe(b);
      if (b.powers!.events.some((e) => e.kind === "freeze")) freezes.push(turn);
      if (b.powers!.frozen) expect(b.powers!.frozen.until).toBeGreaterThanOrEqual(turn);
    }
    expect(freezes[0]).toBe(BOSS_POWERS.firstPassive);
    for (let i = 1; i < freezes.length; i++) {
      expect(freezes[i]! - freezes[i - 1]!).toBeGreaterThanOrEqual(BOSS_POWERS.freezeEvery[0]);
      expect(freezes[i]! - freezes[i - 1]!).toBeLessThanOrEqual(BOSS_POWERS.freezeEvery[1]);
    }
  });

  it("pies: each for 3 turns, a new one every 2 turns, up to 2 at once, never two on one square, nobody moves onto one", () => {
    let b = battle("clown", RUY_FEN);
    const counts: number[] = [];
    for (let turn = 1; turn <= 12; turn++) {
      b = prepareTurn({ ...b, crowdMoves: turn - 1 }, RUY_FEN);
      counts.push(b.powers!.pies?.length ?? 0);
    }
    expect(counts).toEqual([0, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
    // Over many positions: never more than two, never on one square, each lasts its 3 turns, and no move (either side's)
    // lands on one.
    for (const [i, fen] of positions(30, 5).entries()) {
      let c = battle("clown", fen, {}, 100 + i);
      const born = new Map<string, number>();
      for (let turn = 1; turn <= 9; turn++) {
        c = prepareTurn({ ...c, crowdMoves: turn - 1 }, fen);
        const pies = c.powers!.pies ?? [];
        expect(pies.length).toBeLessThanOrEqual(BOSS_POWERS.pieMax);
        expect(new Set(pies.map((p) => p.square)).size).toBe(pies.length);
        for (const p of pies) {
          if (!born.has(`${p.square}:${p.until}`)) born.set(`${p.square}:${p.until}`, turn);
          expect(p.until - born.get(`${p.square}:${p.until}`)! + 1).toBe(BOSS_POWERS.pieTurns);
        }
        const allowed = crowdAllowed(c, fen) ?? legalMoves(fen);
        if (allowed.length < legalMoves(fen).length) for (const m of allowed) expect(pies.some((p) => p.square === m.slice(2, 4))).toBe(false);
        const after = applyMove(fen, legalMoves(fen)[0]!);
        const bossOk = bossAllowed(c, after);
        if (bossOk) for (const m of bossOk) expect(pies.some((p) => p.square === m.slice(2, 4))).toBe(false);
      }
    }
  });

  it("the rage meter fills as the boss loses material: a warning, the ultimate the turn after; then it empties and fills again", () => {
    let b = battle("gingerbread", RUY_FEN);
    b = prepareTurn(b, RUY_FEN, "", S);
    expect(rageOf(b, S)).toBe(0);
    // The boss loses its queen (9: a full meter at these rates).
    const down = RUY_FEN.replace("r1bqk2r", "r1b1k2r");
    b = prepareTurn({ ...b, crowdMoves: 1 }, down, "", S);
    expect(rageOf(b, S)).toBe(1);
    expect(b.powers!.events.map((e) => e.kind)).toContain("warn");
    expect(blizzardNow(b)).toBe(false);
    b = prepareTurn({ ...b, crowdMoves: 2 }, down, "", S);
    expect(b.powers!.events.map((e) => e.kind)).toContain("blizzard");
    expect(blizzardNow(b)).toBe(true);
    expect(powerTurn(b)).toBe(true);
    // Spent: the queen's rage is gone with it; the meter stays empty through the blizzard's three turns (3, 4, 5), then
    // fills from nothing (5 a move) and the blizzard comes again.
    const blizzards: number[] = [];
    for (let t = 4; t < 60; t++) {
      b = prepareTurn({ ...b, crowdMoves: t - 1 }, down, "", S);
      if (t <= 6) expect(rageOf(b, S)).toBe(0);
      if (b.powers!.events.some((e) => e.kind === "blizzard")) blizzards.push(t);
    }
    expect(blizzards).toEqual([27, 51]);
    expect(b.powers!.ults).toBe(3);
  });

  it("the God King's strike adds a chunk of rage (at the boss's speed); none while an ultimate's effect runs", () => {
    let b = prepareTurn(battle("gingerbread", RUY_FEN), RUY_FEN, "", S);
    b = strikeRage(b, S);
    expect(rageOf(b, S)).toBeCloseTo(0.25);
    // Four strikes fill it: the warning as the next turn begins, the blizzard the turn after.
    for (let i = 0; i < 3; i++) b = strikeRage(b, S);
    expect(rageOf(b, S)).toBe(1);
    b = prepareTurn({ ...b, crowdMoves: 1 }, RUY_FEN, "", S);
    expect(b.powers!.events.map((e) => e.kind)).toContain("warn");
    b = prepareTurn({ ...b, crowdMoves: 2 }, RUY_FEN, "", S);
    expect(blizzardNow(b)).toBe(true);
    // During it (its three turns, the ice gone on the last): a strike adds nothing.
    for (let t = 4; t <= 6; t++) {
      expect(strikeRage(b, S)).toBe(b);
      b = prepareTurn({ ...b, crowdMoves: t - 1 }, RUY_FEN, "", S);
      expect(rageOf(b, S)).toBe(0);
    }
    expect(b.powers!.ultAt).toBeUndefined();
    // A faster boss's strike counts for more.
    const fast = strikeRage(b, S);
    expect(rageOf(fast, { ...S, rageSpeed: { gingerbread: 1.2 } })).toBeCloseTo(0.3);
    // As shipped: a quarter of the meter.
    expect(BOSS_POWERS.rageStrike).toBe(BOSS_POWERS.rageFull / 4);
  });

  it("the God King's strike in a match: the meter gains as he strikes, for everyone (the boss's view)", () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "gingerbread", lastStandFrom: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(3), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    runner.deal();
    const before = runner.bossView()!.powers!.rage!;
    expect(runner.callStrike("h0").struck).toBe(true);
    const after = runner.bossView()!.powers!.rage!;
    expect(after - before).toBeCloseTo((BOSS_POWERS.rageStrike * BOSS_POWERS.rageSpeed.gingerbread!) / BOSS_POWERS.rageFull);
  });

  it("the test switch brings an ultimate early: warned as turn 2 begins (after the boss's first move), unleashed on turn 3", () => {
    let b = prepareTurn(battle("clown", RUY_FEN), RUY_FEN, "funhouse");
    expect(b.powers!.warnAt).toBeUndefined();
    b = prepareTurn({ ...b, crowdMoves: 1 }, RUY_FEN, "funhouse");
    expect(b.powers!.warnAt).toBe(2);
    expect(b.powers!.pies?.length).toBe(1); // the passive's first turn too
    b = prepareTurn({ ...b, crowdMoves: 2 }, RUY_FEN, "funhouse");
    expect(b.powers!.funhouse!.turn).toBe(3);
    expect(boardAngle(b)).toBe(180);
    // Its move is due (its moment comes with that move, so a screen shows the board the right way up till then).
    expect(funhouseDue(b)).toBe(true);
    expect(b.powers!.events.map((e) => e.kind)).not.toContain("funhouse");
    expect(shownAngle(b.powers!.funhouse, 3)).toBe(0);
    expect(shownAngle({ ...b.powers!.funhouse!, move: "d2d3", san: "d3" }, 3)).toBe(180);
  });
});

describe("the judge plays by the same rules", () => {
  const job = (allowed?: string[], picks: string[] = []): JudgeJob => ({
    id: "j",
    fen: RUY_FEN,
    picks,
    bots: [{ skill: 5, powerUps: 0 }, { skill: 2, powerUps: 1 }],
    seed: 11,
    rules: { botCandidateMoves: 8, botRandomMoveChance: 0, botPowerUpLoss: DEFAULT_SETTINGS.botPowerUpLoss },
    ...(allowed ? { allowed } : {}),
  });

  it("scores the best allowed move as the best, and the bots pick only allowed moves", async () => {
    const engine = fakeEngine();
    const legal = legalMoves(RUY_FEN);
    const top = await engine.topMoves(RUY_FEN, 8);
    // Freeze the piece of the engine's best move: its moves are out.
    const frozen = top[0]!.move.slice(0, 2);
    const allowed = legal.filter((m) => !m.startsWith(frozen));
    const j = job(allowed, [allowed[0]!]);
    const report = await runJudgeJob(engine, j);
    const board = judgedBoard(j, report)!;
    expect(board).toBeTruthy();
    expect(board.bestMove.startsWith(frozen)).toBe(false);
    const bestAllowed = top.find((m) => !m.move.startsWith(frozen))!;
    expect(board.bestMove).toBe(bestAllowed.move);
    for (const m of board.botPicks) expect(allowed).toContain(m);
    expect(Object.keys(board.expectedAfter).every((m) => allowed.includes(m))).toBe(true);
  });

  it("with none of the top moves allowed (the blizzard), searches every allowed move and takes the best of them", async () => {
    const engine = fakeEngine();
    const top = await engine.topMoves(RUY_FEN, 8);
    const allowed = legalMoves(RUY_FEN).filter((m) => !top.some((t) => t.move === m)).slice(0, 5);
    const j = job(allowed);
    const report = await runJudgeJob(engine, j);
    expect(report.extra.map((m) => m.move).sort()).toEqual([...allowed].sort());
    const board = judgedBoard(j, report)!;
    const best = (await engine.scoreMoves(RUY_FEN, allowed)).sort((a, b) => b.expected - a.expected)[0]!;
    expect(board.bestMove).toBe(best.move);
    for (const m of board.botPicks) expect(allowed).toContain(m);
    // The lobby works the same board out from the report (bots included): an honest device is never struck.
    expect(judgeBotPicks(j, report.top, report.extra)).toEqual({ picks: board.botPicks, powerUps: board.botPowerUps });
    expect(verdictMoves(j, [report], [board]).every((m) => allowed.includes(m))).toBe(true);
  });

  it("the runner (solo, and the host) scores a blizzard turn by the free piece's moves only", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "gingerbread", bossPowerTest: "blizzard", lastStandFrom: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(3), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    expect(runner.boss!.id).toBe("gingerbread");
    for (let i = 0; i < 2; i++) {
      runner.deal();
      const fen0 = runner.boards.get(0)!.fen;
      await runner.score(new Map([["h0", { move: (runner.crowdAllowed() ?? legalMoves(fen0))[0]!, thinkMs: 1000 }]]));
      await runner.playBoss();
    }
    expect(blizzardNow(runner.boss)).toBe(true);
    const fen = runner.boards.get(0)!.fen;
    const free = runner.boss!.powers!.blizzard!.square;
    const allowed = runner.crowdAllowed()!;
    expect(allowed.every((m) => m.startsWith(free))).toBe(true);
    expect(runner.bossView()!.powers!.iced.length).toBeGreaterThan(5);
    expect(runner.bossView()!.powers!.iced).not.toContain(free);
    // The pieces due to thaw next turn are among the iced ones, for every screen.
    expect(runner.bossView()!.powers!.thaw!.length).toBeGreaterThanOrEqual(3);
    for (const sq of runner.bossView()!.powers!.thaw!) expect(runner.bossView()!.powers!.iced).toContain(sq);
    runner.deal();
    // A move of another piece isn't allowed: it counts as no move. The best is the free piece's; the turn doesn't count
    // for fair play.
    const other = legalMoves(fen).find((m) => !m.startsWith(free))!;
    const report = await runner.score(new Map([["h0", { move: other, thinkMs: 1000 }]]));
    const b = report.boards[0]!;
    expect(b.result.players[0]!.move).toBeNull();
    expect(b.bestMove.startsWith(free)).toBe(true);
    expect(b.power).toBe(true);
  });
});

describe("Boingo's powers", () => {
  /** A scripted engine: listed moves score as given (from the mover's side), everything else 0.6 minus a little. */
  function scripted(scores: Record<string, { expected: number; mate?: number; reply?: string }>): EngineLike {
    const line = (fen: string, move: string) => ({ move, ...(scores[move] ?? { expected: 0.6 - 0.04 * hash(fen + move) }) });
    return {
      topMoves: async (fen, n) =>
        legalMoves(fen)
          .map((m) => line(fen, m))
          .sort((a, b) => b.expected - a.expected)
          .slice(0, n),
      scoreMoves: async (fen, moves) => moves.map((m) => line(fen, m)),
    };
  }

  it("the boss never moves onto the pie either", async () => {
    const after = applyMove(RUY_FEN, "d2d3");
    const legal = legalMoves(after);
    for (const sq of ["d5", "e6", "c5", "f5"]) {
      if (!legal.some((m) => m.slice(2, 4) === sq)) continue;
      const allowed = legal.filter((m) => m.slice(2, 4) !== sq);
      for (const kind of ["elo", "stumble", "stagger"] as const) {
        const m = await bossMoveFrom(fakeEngine(), after, 1500, 1000, kind, Math.random, [5, 15], undefined, allowed);
        expect(m.slice(2, 4)).not.toBe(sq);
      }
    }
  });

  it("the funhouse plays a weak but recoverable move: 1 to 2.5 pawns worse, never allowing mate or dropping the queen", async () => {
    const fen = RUY_FEN;
    const engine = scripted({
      d2d4: { expected: 0.62 },
      // A mate allowed, and a queen left hanging: never.
      f3g5: { expected: 0.45, mate: -3 },
      d1e2: { expected: 0.46, reply: "c6d4" },
      // In range (16 and 20 points worse): one of these.
      b2b4: { expected: 0.46 },
      a2a3: { expected: 0.42 },
      // Too much (40 points worse).
      a4c6: { expected: 0.22 },
    });
    const m = await funhouseMoveFrom(engine, fen);
    expect(["b2b4", "a2a3"]).toContain(m);
    expect(BOSS_POWERS.funhouseLoss).toEqual([10, 25]);
  });

  it("the funhouse's cap: never more than funhouseMaxLogit in log-odds (a lost cause stays a fight)", async () => {
    // Far ahead (0.95): 20 points down is 1.85 in log-odds, past the cap (1.6); 10 points down (1.21) is within it.
    const engine = scripted({
      d2d4: { expected: 0.95 },
      b2b4: { expected: 0.85 },
      a2a3: { expected: 0.75 },
      a4c6: { expected: 0.74 },
    });
    // (Everything else scores 0.56 to 0.6: 35+ points down, past the range and the cap.)
    expect(await funhouseMoveFrom(engine, RUY_FEN)).toBe("b2b4");
    expect(BOSS_POWERS.funhouseMaxLogit).toBe(1.6);
  });

  it("the funhouse respects the allowed moves (a pie), and plays the only move when there's one", async () => {
    const engine = fakeEngine();
    const allowed = legalMoves(RUY_FEN).filter((m) => m.slice(2, 4) !== "d4");
    expect(allowed).toContain(await funhouseMoveFrom(engine, RUY_FEN, allowed));
    expect(await funhouseMoveFrom(engine, RUY_FEN, ["h2h3"])).toBe("h2h3");
  });

  it("the funhouse's angles: upside down, a quarter turn to its side, a half turn to the other, back; 4 turns a step", () => {
    const f90 = { turn: 3, side: 90 as const };
    const f270 = { turn: 3, side: 270 as const };
    const at = (f: typeof f90 | typeof f270) => Array.from({ length: 18 }, (_, i) => funhouseAngle(f, i + 1));
    expect(at(f90)).toEqual([0, 0, 180, 180, 180, 180, 90, 90, 90, 90, 270, 270, 270, 270, 0, 0, 0, 0]);
    expect(at(f270)).toEqual([0, 0, 180, 180, 180, 180, 270, 270, 270, 270, 90, 90, 90, 90, 0, 0, 0, 0]);
    expect(funhouseAngle(null, 7)).toBe(0);
    expect(BOSS_POWERS.funhouseStepTurns).toBeGreaterThanOrEqual(3);
    expect(BOSS_POWERS.funhouseStepTurns).toBeLessThanOrEqual(5);
    // Its side from the seed: the same for the same seed, both sides across seeds.
    const side = (seed: number) => {
      let b = prepareTurn(battle("clown", RUY_FEN, {}, seed), RUY_FEN, "funhouse");
      b = prepareTurn({ ...b, crowdMoves: 1 }, RUY_FEN, "funhouse");
      return prepareTurn({ ...b, crowdMoves: 2 }, RUY_FEN, "funhouse").powers!.funhouse!.side;
    };
    const sides = Array.from({ length: 24 }, (_, i) => side(i));
    expect(new Set(sides)).toEqual(new Set([90, 270]));
    expect(Array.from({ length: 24 }, (_, i) => side(i))).toEqual(sides);
  });

  it("a funhouse match: as it comes he plays the crowd's move (unscored, once), then the board turns 4 turns a step and stays back; the meter waits", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "clown", bossPowerTest: "funhouse", lastStandFrom: 999, bossMaxMoves: 40 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(3), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    expect(runner.boss!.id).toBe("clown");
    const seen: { turn: number; angle: number; kinds: string[]; ultAt: number | null; rage: number | null }[] = [];
    const forced: { turn: number; move: string }[] = [];
    for (let i = 0; i < 40 && seen.length < 17 && !runner.stageComplete(); i++) {
      if (runner.funhouseDue()) {
        // Before it: the board still the right way up on screen, and nobody's move.
        expect(runner.bossView()!.powers!.angle).toBe(0);
        expect(runner.bossToMove()).toBe(false);
        const moves = runner.boss!.crowdMoves;
        const ply = runner.boards.get(0)!.history.length;
        const scored = runner.state.players[0]!.finalLosses.length;
        const allowed = runner.crowdAllowed() ?? legalMoves(runner.boards.get(0)!.fen);
        const m = await runner.playFunhouse();
        forced.push({ turn: moves + 1, move: m });
        expect(allowed).toContain(m);
        // On the board as the crowd's move, unscored; its moment now; the boss to reply.
        expect(runner.boards.get(0)!.history.length).toBe(ply + 1);
        expect(runner.boards.get(0)!.history.at(-1)).toBe(m);
        expect(runner.boss!.crowdMoves).toBe(moves + 1);
        expect(runner.state.players[0]!.finalLosses.length).toBe(scored);
        const v = runner.bossView()!.powers!;
        expect(v.funhouse!.move).toBe(m);
        expect(v.funhouse!.san).toBeTruthy();
        expect(v.events.map((e) => e.kind)).toContain("funhouse");
        // (His joke, from the seed: the same on every screen.)
        const pick = v.events.find((e) => e.kind === "funhouse")!.pick!;
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(4096);
        expect(funhousePlayed(runner.boss!, m, "x").powers!.events.at(-1)!.pick).toBe(pick);
        expect(v.angle).toBe(180);
        expect(runner.funhouseDue()).toBe(false);
        expect(runner.bossToMove()).toBe(true);
        await runner.playBoss();
        continue;
      }
      runner.deal();
      const v = runner.bossView()!.powers!;
      seen.push({ turn: v.turn, angle: v.angle!, kinds: v.events.map((e) => e.kind), ultAt: v.ultAt, rage: v.rage });
      expect(boardAngle(runner.boss)).toBe(v.angle);
      // Every other turn is the crowd's own pick, scored as usual.
      const scored = runner.state.players[0]!.finalLosses.length;
      const fen = runner.boards.get(0)!.fen;
      await runner.score(new Map([["h0", { move: (runner.crowdAllowed() ?? legalMoves(fen))[0]!, thinkMs: 1000 }]]));
      expect(runner.state.players[0]!.finalLosses.length).toBe(scored + 1);
      if (runner.stageComplete()) break;
      await runner.playBoss();
    }
    // Once, as the funhouse came (turn 3).
    expect(forced.map((x) => x.turn)).toEqual([3]);
    expect(seen.map((x) => x.turn)).toEqual([1, 2, ...Array.from({ length: 15 }, (_, i) => i + 4)]);
    const f = runner.boss!.powers!.funhouse!;
    expect(f.turn).toBe(3);
    expect(f.move).toBe(forced[0]!.move);
    const other = f.side === 90 ? 270 : 90;
    // Turn 3 was his: the crowd plays on from turn 4, upside down through turn 6, then 4 turns a step.
    expect(seen.map((x) => x.angle)).toEqual([0, 0, 180, 180, 180, f.side, f.side, f.side, f.side, other, other, other, other, 0, 0, 0, 0]);
    expect(seen.filter((x) => x.kinds.includes("spin")).map((x) => x.turn)).toEqual([7, 11, 15]);
    expect(seen.some((x) => x.kinds.includes("funhouse"))).toBe(false);
    // The meter: held empty while the board is turned (through turn 14), filling again from 15.
    for (const x of seen.filter((x) => x.turn > 3 && x.turn < 15)) {
      expect(x.ultAt).toBe(3);
      expect(x.rage).toBe(0);
    }
    expect(seen.find((x) => x.turn === 15)!.ultAt).toBeNull();
    expect(seen.find((x) => x.turn === 17)!.rage).toBeGreaterThan(0);
    // The turns it's turned are power turns (fair play doesn't count them); back the right way up, not for the funhouse.
    expect(powerTurn({ ...runner.boss!, powers: { ...runner.boss!.powers!, pies: [] } })).toBe(false);
  });

  it("each funhouse plays the crowd's move exactly once: a repeat ultimate plays it again, once", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "clown", lastStandFrom: 999, bossMaxMoves: 60 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    const forced: number[] = [];
    const funhouses = new Set<number>();
    for (let i = 0; i < 200 && !runner.stageComplete() && funhouses.size < 3; i++) {
      // (The admins' trigger whenever it may be pulled: a funhouse after each one ends.)
      runner.triggerUltimate();
      if (runner.bossToMove()) {
        await runner.playBoss();
        const f = runner.boss!.powers!.funhouse;
        if (f) funhouses.add(f.turn);
        continue;
      }
      if (runner.funhouseDue()) {
        forced.push(runner.boss!.crowdMoves + 1);
        await runner.playFunhouse();
        expect(runner.funhouseDue()).toBe(false);
        continue;
      }
      runner.deal();
      const fen = runner.boards.get(0)!.fen;
      await runner.score(new Map([["h0", { move: [...(runner.crowdAllowed() ?? legalMoves(fen))].sort()[0]!, thinkMs: 1000 }]]));
    }
    // One forced move per funhouse, on the turn it came (the last one's may still be to come as the loop stops).
    const turns = [...funhouses].sort((a, b) => a - b);
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(forced).toEqual(turns.slice(0, forced.length));
    expect(forced.length).toBeGreaterThanOrEqual(turns.length - 1);
    expect(forced.length).toBeGreaterThanOrEqual(2);
  });

});
