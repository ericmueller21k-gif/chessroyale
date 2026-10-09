import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossState, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  applyMove,
  blizzardNow,
  boardFlipped,
  bossAllowed,
  bossMoveFrom,
  chooseFreeze,
  choosePie,
  crowdAllowed,
  funhouseDue,
  funhouseMoveFrom,
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

  it("in check, a pie lifts when the only escape lands on it", () => {
    // The king on h1 is checked by the rook on h8; its only move is to g1... a pie there would leave none.
    const fen = "6kr/8/8/8/8/8/6PP/7K w - - 0 1";
    const legal = legalMoves(fen);
    const b = battle("clown", fen);
    // (The pie is near the centre in play; here it sits on the escape square to test the rule.)
    for (const sq of new Set(legal.map((m) => m.slice(2, 4)))) {
      const pied = { ...b, powers: { ...b.powers!, pie: { square: sq, until: 3 } } };
      const allowed = crowdAllowed(pied, fen) ?? legal;
      expect(allowed.length).toBeGreaterThan(0);
      if (legal.length === 1) expect(allowed).toEqual(legal);
    }
  });

  it("the blizzard: only the queen moves; no queen (or she can't), the king; neither, any move", () => {
    const withQueen = "4k3/8/8/8/8/8/PPP5/1K1Q4 w - - 0 1";
    const b = battle("gingerbread", withQueen, { crowdMoves: 2 });
    const bliz = { ...b, powers: { ...b.powers!, warnAt: 2, ultAt: 3 } };
    expect(blizzardNow(bliz)).toBe(true);
    const a = crowdAllowed(bliz, withQueen)!;
    expect(a.length).toBeGreaterThan(0);
    for (const m of a) expect(pieceAt(withQueen, m.slice(0, 2))?.type).toBe("q");
    expect(icedSquares(bliz, withQueen).sort()).toEqual(["a2", "b1", "b2", "c2"]);
    const noQueen = "4k3/8/8/8/8/8/PPP5/1K6 w - - 0 1";
    const k = crowdAllowed(bliz, noQueen)!;
    for (const m of k) expect(pieceAt(noQueen, m.slice(0, 2))?.type).toBe("k");
    // The king boxed in and no queen: the ice lifts for the turn.
    const boxed = "4k3/8/8/8/8/8/PPPPP3/RK1N4 w - - 0 1";
    const boxedKing = legalMoves(boxed).filter((m) => m.startsWith("b1"));
    if (!boxedKing.length) expect(crowdAllowed(bliz, boxed)).toBeNull();
    // One turn only.
    expect(blizzardNow({ ...bliz, crowdMoves: 3 })).toBe(false);
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

  it("puts the pie on an empty square near the centre that the fewest moves can reach", () => {
    for (const fen of positions(30, 3)) {
      const sq = choosePie(fen, 1, 2);
      if (!sq) continue;
      expect(pieceAt(fen, sq)).toBeNull();
      expect("cdef").toContain(sq[0]!);
      expect("3456").toContain(sq[1]!);
    }
  });

  it("freezes every 5-7 turns from turn 2, for 2 turns; the second call for the same turn changes nothing", () => {
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

  it("pies for 3 turns, then 2 clear, and repeats", () => {
    let b = battle("clown", RUY_FEN);
    const pied: boolean[] = [];
    for (let turn = 1; turn <= 12; turn++) {
      b = prepareTurn({ ...b, crowdMoves: turn - 1 }, RUY_FEN);
      pied.push(!!b.powers!.pie);
    }
    expect(pied).toEqual([false, true, true, true, false, false, true, true, true, false, false, true]);
  });

  it("the rage meter fills as the boss loses material: a warning, the ultimate the turn after, once a match", () => {
    let b = battle("gingerbread", RUY_FEN);
    b = prepareTurn(b, RUY_FEN);
    expect(rageOf(b)).toBe(0);
    // The boss loses its queen (9: a full meter).
    const down = RUY_FEN.replace("r1bqk2r", "r1b1k2r");
    b = prepareTurn({ ...b, crowdMoves: 1 }, down);
    expect(rageOf(b)).toBe(1);
    expect(b.powers!.events.map((e) => e.kind)).toContain("warn");
    expect(blizzardNow(b)).toBe(false);
    b = prepareTurn({ ...b, crowdMoves: 2 }, down);
    expect(b.powers!.events.map((e) => e.kind)).toContain("blizzard");
    expect(blizzardNow(b)).toBe(true);
    expect(powerTurn(b)).toBe(true);
    for (let t = 3; t < 20; t++) {
      b = prepareTurn({ ...b, crowdMoves: t }, down);
      expect(b.powers!.events.map((e) => e.kind)).not.toContain("blizzard");
      expect(b.powers!.events.map((e) => e.kind)).not.toContain("warn");
    }
    expect(rageOf(b)).toBeNull();
  });

  it("the test switch brings an ultimate early: warned as turn 2 begins (after the boss's first move), unleashed on turn 3", () => {
    let b = prepareTurn(battle("clown", RUY_FEN), RUY_FEN, "funhouse");
    expect(b.powers!.warnAt).toBeUndefined();
    b = prepareTurn({ ...b, crowdMoves: 1 }, RUY_FEN, "funhouse");
    expect(b.powers!.warnAt).toBe(2);
    expect(b.powers!.pie).toBeTruthy(); // the passive's first turn too
    b = prepareTurn({ ...b, crowdMoves: 2 }, RUY_FEN, "funhouse");
    expect(funhouseDue(b)).toBe(true);
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

  it("the runner (solo, and the host) scores a blizzard turn by the queen's moves only", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "gingerbread", bossPowerTest: "blizzard", lastStandLoss: 999, lastStandLossFloor: 999 } as Settings;
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
    const allowed = runner.crowdAllowed()!;
    expect(allowed.every((m) => pieceAt(fen, m.slice(0, 2))?.type === "q")).toBe(true);
    expect(runner.bossView()!.powers!.iced.length).toBeGreaterThan(5);
    runner.deal();
    // A pawn move isn't allowed: it counts as no move. The best is a queen move; the turn doesn't count for fair play.
    const report = await runner.score(new Map([["h0", { move: "a2a3", thinkMs: 1000 }]]));
    const b = report.boards[0]!;
    expect(b.result.players[0]!.move).toBeNull();
    expect(pieceAt(fen, b.bestMove.slice(0, 2))?.type).toBe("q");
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
  });

  it("the funhouse respects the allowed moves (a pie), and plays the only move when there's one", async () => {
    const engine = fakeEngine();
    const allowed = legalMoves(RUY_FEN).filter((m) => m.slice(2, 4) !== "d4");
    expect(allowed).toContain(await funhouseMoveFrom(engine, RUY_FEN, allowed));
    expect(await funhouseMoveFrom(engine, RUY_FEN, ["h2h3"])).toBe("h2h3");
  });

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

  it("a funhouse match: warned, the boss plays the crowd's move (unscored), then the board shows flipped for 2 turns", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "clown", bossPowerTest: "funhouse", lastStandLoss: 999, lastStandLossFloor: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(3), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    expect(runner.boss!.id).toBe("clown");
    runner.deal();
    await runner.score(new Map([["h0", { move: "d2d3", thinkMs: 1000 }]]));
    await runner.playBoss();
    expect(runner.bossView()!.powers!.warned).toBe(true);
    runner.deal();
    await runner.score(new Map([["h0", { move: legalMoves(runner.boards.get(0)!.fen).find((m) => runner.crowdAllowed()?.includes(m) ?? true)!, thinkMs: 1000 }]]));
    expect(runner.funhouseDue()).toBe(false); // the boss moves first
    await runner.playBoss();
    expect(runner.funhouseDue()).toBe(true);
    const moves = runner.boss!.crowdMoves;
    const scores = runner.state.players[0]!.finalLosses.length;
    const m = await runner.playFunhouse();
    expect(runner.boss!.crowdMoves).toBe(moves + 1);
    expect(runner.state.players[0]!.finalLosses.length).toBe(scores);
    expect(runner.boss!.powers!.funhouse!.move).toBe(m);
    expect(runner.bossView()!.powers!.events.map((e) => e.kind)).toContain("funhouse");
    expect(runner.funhouseDue()).toBe(false);
    expect(runner.bossToMove()).toBe(true);
    await runner.playBoss();
    expect(boardFlipped(runner.boss)).toBe(true);
    runner.deal();
    await runner.score(new Map([["h0", { move: legalMoves(runner.boards.get(0)!.fen)[0]!, thinkMs: 1000 }]]));
    await runner.playBoss();
    expect(boardFlipped(runner.boss)).toBe(true);
    runner.deal();
    await runner.score(new Map([["h0", { move: legalMoves(runner.boards.get(0)!.fen)[0]!, thinkMs: 1000 }]]));
    await runner.playBoss();
    expect(boardFlipped(runner.boss)).toBe(false);
    // Once a match.
    for (let i = 0; i < 6; i++) {
      runner.deal();
      await runner.score(new Map([["h0", { move: legalMoves(runner.boards.get(0)!.fen)[0]!, thinkMs: 1000 }]]));
      if (runner.stageComplete()) break;
      await runner.playBoss();
      expect(runner.funhouseDue()).toBe(false);
    }
  });
});
