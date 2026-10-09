import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossState, type Settings } from "@chessroyale/core";
import {
  LIGHTS_OUT,
  MatchRunner,
  START_FEN,
  applyMove,
  botLightsMisses,
  bulbsAt,
  bossIntroTimeline,
  chooseDark,
  chooseLightsOut,
  coversAfter,
  darkAttempt,
  initPowers,
  judgeTaps,
  legalMoves,
  lightsOutDue,
  lightsOutTimeline,
  moveSquares,
  pieceAt,
  powerTurn,
  prepareTurn,
  rageOf,
  sanLineToUci,
  touchesDark,
  triggerUltimate,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Hollow, the Darkness boss: the dark (a square covered after his first move and every 3rd after it, for 10 crowd
 * turns; its piece hidden; a move attempt touching it judged unchecked, -5 a wrong one, the 5th a missed move, a turn
 * never below a missed move's score) and Lights out (a memory test in 3 rounds at the start of his turn, -10 a piece
 * not found, bots from the seed). See DECISIONS.md, "Hollow, the Darkness boss".
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
const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });

/** A raid against Hollow: you alone (or with bots), from the starting position. */
function raid(opts: { side?: "b"; bots?: number; patch?: Partial<Settings>; seed?: number } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "hollow", lastStandLoss: 999, lastStandLossFloor: 999, ...opts.patch } as Settings;
  const bots = Array.from({ length: opts.bots ?? 0 }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, isBot: true, skill: 2 }));
  return new MatchRunner({
    settings,
    rng: mulberry32(opts.seed ?? 5),
    engines: [fakeEngine()],
    library: [opening(LINE)],
    entrants: [{ id: "h0", name: "H", isBot: false }, ...bots],
    ...(opts.side ? { raidSide: opts.side } : {}),
  });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** One crowd turn: you play `move` (or the first legal move), then the boss replies. */
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

describe("Hollow: who he is and where he starts", () => {
  it("plays Black from the starting position (no opening moves), with the dark and Lights out", () => {
    const r = raid();
    expect(r.boss!.id).toBe("hollow");
    expect(r.boss!.crowdSide).toBe("w");
    expect(fenOf(r)).toBe(START_FEN);
    expect(r.boards.get(0)!.history).toEqual([]);
    expect(r.bossView()!.openingName).toBeNull();
    expect(r.bossView()!.startMove).toBe(1);
    expect(r.bossView()!.powers).toMatchObject({ passive: "dark", ultimate: "lightsout", dark: [], bulbs: 1 });
    expect(r.bossView()!.powers!.claimed).toBeUndefined();
  });

  it("when the usual pick would have made the crowd Black, he claims the dark side before move 1 (the crowd is White all the same)", () => {
    const r = raid({ side: "b" });
    expect(r.boss!.crowdSide).toBe("w");
    expect(fenOf(r)).toBe(START_FEN);
    expect(r.bossView()!.powers!.claimed).toBe(true);
    // The intro makes room for his claim before "START!".
    expect(bossIntroTimeline(0, true).bannerAt - bossIntroTimeline(0).bannerAt).toBeGreaterThan(2000);
  });
});

describe("Hollow's dark", () => {
  it("covers after his 1st move and every 3rd after it (4, 7, 10…); the bulbs count his moves to the next", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => coversAfter(n))).toEqual([1, 4, 7, 10]);
    // As crowd turns 1..9 begin: 1 bulb before his first move, then 3, 2, 1, 3, 2, 1…
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => bulbsAt(t))).toEqual([1, 3, 2, 1, 3, 2, 1, 3, 2]);
  });

  it("first covers the square of the piece he just moved; then a random occupied square, never a king's, never one already dark", () => {
    const fen = applyMove(START_FEN, "e2e4");
    const after = applyMove(fen, "g8f6");
    expect(chooseDark(after, "w", 3, 2, [], "f6")).toBe("f6");
    // (A king's square is never covered, even as the piece he moved.)
    expect(chooseDark(after, "w", 3, 2, [], "e8")).not.toBe("e8");
    const sides = { w: 0, b: 0 };
    for (let seed = 0; seed < 400; seed++) {
      const dark = [{ square: "d2", at: 2, until: 11 }];
      const sq = chooseDark(after, "w", seed, 5, dark)!;
      const pc = pieceAt(after, sq)!;
      expect(pc.type).not.toBe("k");
      expect(sq).not.toBe("d2");
      sides[pc.color]++;
      // The same from the same seed, everywhere.
      expect(chooseDark(after, "w", seed, 5, dark)).toBe(sq);
    }
    // His or the crowd's, roughly half each.
    expect(sides.w).toBeGreaterThan(150);
    expect(sides.b).toBeGreaterThan(150);
  });

  it("in a battle: each dark square lasts 10 crowd turns (thinning on its last), on its square, never two on one; the rage meter's warning never shows", async () => {
    const r = raid({ patch: { bossMaxMoves: 40 } });
    const seen = new Map<string, { at: number; until: number }>();
    let first: string | null = null;
    for (let t = 1; t <= 24 && !r.isOver() && !r.stageComplete(); t++) {
      await turn(r);
      const v = r.bossView()!;
      const p = v.powers!;
      const turnNow = p.turn;
      for (const d of p.dark!) {
        if (!seen.has(d.square + d.at)) seen.set(d.square + d.at, d);
        expect(d.until - d.at + 1).toBe(BOSS_POWERS.darkTurns);
        expect(turnNow).toBeLessThanOrEqual(d.until);
      }
      expect(new Set(p.dark!.map((d) => d.square)).size).toBe(p.dark!.length);
      for (const e of p.events) {
        expect(e.kind).not.toBe("warn");
        if (e.kind === "dark") {
          expect(e.turn).toBe(turnNow);
          // His moves so far: turn - 1. A cover after his 1st, 4th, 7th...
          expect(coversAfter(turnNow - 1)).toBe(true);
          if (turnNow === 2) {
            expect(e.first).toBe(true);
            first = e.square!;
            // The piece he just moved.
            expect(r.boards.get(0)!.lastMove!.slice(2, 4)).toBe(e.square);
          } else expect(e.first).toBeUndefined();
        }
      }
      expect(p.bulbs).toBe(bulbsAt(turnNow));
      // About 4 at once, at most.
      expect(p.dark!.length).toBeLessThanOrEqual(Math.ceil(BOSS_POWERS.darkTurns / BOSS_POWERS.darkEvery));
      // The dark doesn't make a turn a power turn for fair play (forgetting is never cheat-like).
      expect(powerTurn(r.boss)).toBe(false);
    }
    expect(first).not.toBeNull();
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("knows what a move attempt touches: where it starts and lands, every square it slides over, a castling king's way to his rook", () => {
    expect(moveSquares("a1a8").sort()).toEqual(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"]);
    expect(moveSquares("c1h6").sort()).toEqual(["c1", "d2", "e3", "f4", "g5", "h6"]);
    expect(moveSquares("e2e4").sort()).toEqual(["e2", "e3", "e4"]);
    expect(moveSquares("g1f3").sort()).toEqual(["f3", "g1"]);
    const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(moveSquares("e1g1", castle).sort()).toEqual(["e1", "f1", "g1", "h1"]);
    expect(moveSquares("e1c1", castle).sort()).toEqual(["a1", "b1", "c1", "d1", "e1"]);
    expect(touchesDark("a1a8", ["a4"])).toBe(true);
    expect(touchesDark("g1f3", ["g2"])).toBe(false);
    expect(touchesDark("e1c1", ["b1"], castle)).toBe(true);
    expect(touchesDark("e2e4", [])).toBe(false);
    // From the dark, a pawn's move to the last rank without a piece is a queen's.
    expect(darkAttempt("8/P6k/8/8/8/8/8/K7 w - - 0 1", "a7a8")).toBe("a7a8q");
    expect(darkAttempt(START_FEN, "e2e5")).toBeNull();
  });

  it("an attempt into the dark: a legal one is the pick; an illegal one costs -5 and the player tries again; the 5th ends the turn as a miss; anything else is refused", async () => {
    const r = raid();
    await turn(r, "e2e4");
    const dark = r.darkSquares();
    expect(dark).toHaveLength(1);
    r.deal();
    const sq = dark[0]!;
    const fen = fenOf(r);
    const hisPiece = pieceAt(fen, sq)!;
    expect(hisPiece.color).toBe("b");
    // A move from the dark square isn't yours to make: wrong, -5.
    const tries: unknown[] = [];
    for (let i = 0; i < 4; i++) tries.push(r.darkTry("h0", `${sq}a3`));
    expect(tries).toEqual([1, 2, 3, 4].map((n) => ({ kind: "wrong", tries: n, out: false })));
    // Not touching the dark: refused, free.
    expect(r.darkTry("h0", "e4e6")).toEqual({ kind: "refused" });
    expect(r.darkTries()).toEqual({ h0: 4 });
    // The 5th: out of tries.
    expect(r.darkTry("h0", `${sq}a3`)).toEqual({ kind: "wrong", tries: 5, out: true });
    // A legal attempt is the pick, as played.
    const legal = legalMoves(fen).find((m) => touchesDark(m, dark, fen));
    if (legal) expect(r.darkTry("h0", legal)).toEqual({ kind: "move", move: legal });
  });

  it("a turn's score loses 5 a wrong attempt, but never below a missed move's; out of tries, it is a missed move", async () => {
    const run = async (wrong: number, miss = false) => {
      const r = raid({ bots: 3 });
      await turn(r, "e2e4");
      r.deal();
      const sq = r.darkSquares()[0]!;
      for (let i = 0; i < wrong; i++) r.darkTry("h0", `${sq}a3`);
      const before = r.player("h0").stageScore;
      const report = await r.score(new Map([["h0", { move: miss ? null : "d2d4", thinkMs: 1000 }]]));
      const me = report.boards[0]!.result.players.find((p) => p.playerId === "h0")!;
      // (Bots never try: their scores are the plain ones.)
      expect(r.darkTries()).toEqual({});
      return { me, delta: r.player("h0").stageScore - before };
    };
    const plain = await run(0);
    const two = await run(2);
    expect(two.me.move).toBe("d2d4");
    expect(two.me.roundScore).toBeCloseTo(Math.max(DEFAULT_SETTINGS.missedMoveScore, plain.me.roundScore - 2 * BOSS_POWERS.darkTryCost), 6);
    const four = await run(4);
    expect(four.me.roundScore).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.missedMoveScore);
    expect(four.me.roundScore).toBeCloseTo(Math.max(DEFAULT_SETTINGS.missedMoveScore, plain.me.roundScore - 4 * BOSS_POWERS.darkTryCost), 6);
    const out = await run(5, true);
    expect(out.me.move).toBeNull();
    expect(out.me.roundScore).toBe(DEFAULT_SETTINGS.missedMoveScore);
    expect(out.delta).toBe(DEFAULT_SETTINGS.missedMoveScore);
  });
});

describe("Hollow's Lights out", () => {
  it("names 1, 2, then 3 of his pieces: never a pawn while he has others, none twice while others remain; a type twice needs both squares", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rounds = chooseLightsOut(START_FEN, "b", seed);
      expect(rounds.map((r) => r.pieces.length)).toEqual([1, 2, 3]);
      expect(rounds.map((r) => r.ms)).toEqual([3000, 4000, 5000]);
      const all = rounds.flatMap((r) => r.pieces);
      expect(all).not.toContain("p");
      // Six pieces named from his eight: by type, never more than he has (2 rooks, 2 knights, 2 bishops, 1 queen, 1 king).
      const count = (t: string) => all.filter((x) => x === t).length;
      for (const [t, n] of Object.entries({ r: 2, n: 2, b: 2, q: 1, k: 1 })) expect(count(t)).toBeLessThanOrEqual(n);
      for (const r of rounds) {
        expect(r.answers.every((sq) => pieceAt(START_FEN, sq)?.color === "b" && r.pieces.includes(pieceAt(START_FEN, sq)!.type))).toBe(true);
      }
      expect(chooseLightsOut(START_FEN, "b", seed)).toEqual(rounds);
    }
    // Just a king, a rook and pawns: the pieces come back before any pawn.
    const few = chooseLightsOut("4k2r/pppppppp/8/8/8/8/8/4K3 w - - 0 1", "b", 1);
    expect(few[0]!.pieces).not.toContain("p");
    expect([...few[1]!.pieces].sort()).toEqual(["k", "r"]);
    expect([...few[2]!.pieces].sort()).toEqual(["k", "p", "r"]);
    // Only pawns left besides his king: pawns, then.
    const pawns = chooseLightsOut("4k3/pppppppp/8/8/8/8/8/4K3 w - - 0 1", "b", 1);
    expect(pawns[2]!.pieces).toContain("p");
  });

  it("judges taps in order: a piece still to find is found; a square already found changes nothing; anything else is wrong; tries = pieces", () => {
    // Both rooks named: both squares needed.
    const rooks = { pieces: ["r", "r"] };
    expect(judgeTaps(rooks, START_FEN, "b", ["a8", "a8", "h8"])).toEqual({ found: ["a8", "h8"], wrong: [], missed: 0, done: true });
    // One rook named: either counts; the other then changes nothing.
    expect(judgeTaps({ pieces: ["r"] }, START_FEN, "b", ["h8", "a8"])).toEqual({ found: ["h8"], wrong: [], missed: 0, done: true });
    expect(judgeTaps({ pieces: ["q", "n"] }, START_FEN, "b", ["e4", "a8", "g8"])).toEqual({ found: [], wrong: ["e4", "a8"], missed: 2, done: true });
    expect(judgeTaps({ pieces: ["q", "n"] }, START_FEN, "b", ["b8"])).toEqual({ found: ["b8"], wrong: [], missed: 1, done: false });
    // The crowd's own pieces are never his.
    expect(judgeTaps({ pieces: ["q"] }, START_FEN, "b", ["d1"]).wrong).toEqual(["d1"]);
  });

  it("bots find each piece at their round's rate, from the seed", () => {
    const rounds = chooseLightsOut(START_FEN, "b", 3);
    let missed = 0;
    for (let i = 0; i < 400; i++) missed += botLightsMisses(11, `bot${i}`, rounds);
    const expected = rounds.reduce((n, r, i) => n + r.pieces.length * (1 - BOSS_POWERS.lightsOutBotHit[i]!), 0) * 400;
    expect(Math.abs(missed - expected) / expected).toBeLessThan(0.12);
    expect(botLightsMisses(11, "bot1", rounds)).toBe(botLightsMisses(11, "bot1", rounds));
  });

  it("its beats: the drop, then each round's seconds with the late grace and its answers, then the lights back", () => {
    const tl = lightsOutTimeline(BOSS_POWERS.lightsOutRounds, 300);
    expect(tl.rounds.map((r) => r.until - r.at)).toEqual([3000, 4000, 5000]);
    expect(tl.rounds[0]!.at).toBe(LIGHTS_OUT.dropAt + LIGHTS_OUT.dropMs + LIGHTS_OUT.gapMs);
    for (const r of tl.rounds) expect(r.answersAt).toBe(r.until + 300);
    expect(tl.total).toBe(tl.backAt + LIGHTS_OUT.backMs);
  });

  it("comes at the start of his turn once the meter is full (its only warning: no RAGE!), with the test switch, or the test trigger", async () => {
    // The test switch: full as the 2nd turn begins; Lights out after the crowd's 2nd move.
    const r = raid({ patch: { bossPowerTest: "lightsout" } });
    await turn(r, "e2e4");
    expect(r.bossView()!.powers!.ultAt).toBe(2);
    expect(r.bossView()!.powers!.events.some((e) => e.kind === "warn")).toBe(false);
    // (The meter shows full for this turn: the screens draw it so while ultAt is set.)
    expect(rageOf(r.boss)).not.toBeNull();
    r.deal();
    expect(r.lightsOutDue()).toBe(false);
    await r.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]));
    expect(r.lightsOutDue()).toBe(true);
    // The trigger does nothing now: it's on its way.
    expect(triggerUltimate(r.boss).ok).toBe(false);
    const test = r.startLightsOut();
    expect(test.at).toBe(2);
    expect(r.lightsOutDue()).toBe(false);
    // Once: spent, the meter gone.
    await r.playBoss();
    expect(rageOf(r.boss)).toBeNull();
    expect(r.bossView()!.powers!.lightsAt).toBe(2);
    expect(lightsOutDue(r.boss)).toBe(false);

    // The trigger, pressed during the crowd's turn: it comes as his turn begins.
    const t = raid();
    t.deal();
    expect(t.triggerUltimate()).toBe(true);
    await t.score(new Map([["h0", { move: "e2e4", thinkMs: 1000 }]]));
    expect(t.lightsOutDue()).toBe(true);
    // Pressed while he thinks: at the start of his next turn.
    const u = raid();
    u.deal();
    await u.score(new Map([["h0", { move: "e2e4", thinkMs: 1000 }]]));
    expect(u.triggerUltimate()).toBe(true);
    expect(u.lightsOutDue()).toBe(true);
    // (It's there for as long as he's to move; his move doesn't change that it's due next time he is.)
    await u.playBoss();
    expect(u.bossView()!.powers!.ultNext).toBe(true);
    u.deal();
    await u.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]));
    expect(u.lightsOutDue()).toBe(true);
  });

  it("costs 10 a piece not found, for everyone still in (bots from the seed); it isn't a move, and it happens once", async () => {
    const r = raid({ bots: 4, patch: { bossPowerTest: "lightsout" } });
    await turn(r, "e2e4");
    r.deal();
    await r.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]));
    const before = new Map(r.state.players.map((p) => [p.id, { ...p }]));
    const crowdMoves = r.boss!.crowdMoves;
    const test = r.startLightsOut();
    const all = test.rounds.reduce((n, x) => n + x.pieces.length, 0);
    const missed = r.finishLightsOut({ h0: 2 });
    expect(missed.h0).toBe(2);
    expect(r.player("h0").stageScore).toBe(before.get("h0")!.stageScore - 2 * BOSS_POWERS.lightsOutMiss);
    for (const p of r.state.players.filter((x) => x.isBot)) {
      expect(missed[p.id]).toBe(botLightsMisses(r.boss!.powers!.seed, p.id, test.rounds));
      expect(p.stageScore).toBe(before.get(p.id)!.stageScore - missed[p.id]! * BOSS_POWERS.lightsOutMiss);
      expect(missed[p.id]).toBeLessThanOrEqual(all);
    }
    // Not a move: nothing else changes.
    for (const p of r.state.players) {
      const b = before.get(p.id)!;
      expect([p.stageRounds, p.finalLosses.length, p.misses ?? 0, p.bankMs]).toEqual([b.stageRounds, b.finalLosses.length, b.misses ?? 0, b.bankMs]);
    }
    expect(r.boss!.crowdMoves).toBe(crowdMoves);
    // Once.
    expect(r.finishLightsOut({ h0: 6 })).toEqual(missed);
    expect(r.player("h0").stageScore).toBe(before.get("h0")!.stageScore - 2 * BOSS_POWERS.lightsOutMiss);
    // A person with nothing found (no taps at all) missed every piece.
    const q = raid({ patch: { bossPowerTest: "lightsout" } });
    await turn(q, "e2e4");
    q.deal();
    await q.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]));
    const s0 = q.player("h0").stageScore;
    q.startLightsOut();
    expect(q.finishLightsOut({}).h0).toBe(6);
    expect(q.player("h0").stageScore).toBe(s0 - 6 * BOSS_POWERS.lightsOutMiss);
  });

  it("leaves the board and the dark squares as they were; the battle goes on with his move", async () => {
    const r = raid({ patch: { bossPowerTest: "lightsout" } });
    await turn(r, "e2e4");
    r.deal();
    await r.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]));
    const fen = fenOf(r);
    const dark = r.darkSquares();
    r.startLightsOut();
    r.finishLightsOut({});
    expect(fenOf(r)).toBe(fen);
    expect(r.darkSquares()).toEqual(dark);
    await r.playBoss();
    expect(fenOf(r)).not.toBe(fen);
    expect(r.bossView()!.powers!.dark!.map((d) => d.square)).toEqual(expect.arrayContaining(dark.filter((sq) => r.darkSquares().includes(sq))));
  });
});

describe("Hollow in the Crowd's boss final", () => {
  it("starts from the starting position too", () => {
    const b: BossState = { id: "hollow", elo: 1500, crowdSide: "w", crowdMoves: 0, sinceKill: 0, kills: [], powers: initPowers(1, START_FEN, "w") };
    const next = prepareTurn(b, START_FEN);
    expect(next.powers!.bulbs).toBe(1);
    expect(next.powers!.dark).toEqual([]);
    expect(next.powers!.events).toEqual([]);
  });
});
