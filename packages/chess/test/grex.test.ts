import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, bossDef, mulberry32, type BossPowerSettings, type BossState, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  GREX,
  ablaze,
  applyMove,
  blizzardNow,
  boardEnd,
  burnOnBoard,
  burnOutcome,
  candleAim,
  charSquares,
  chooseFireballs,
  chooseSpark,
  crowdAllowed,
  fenAfter,
  fenAtPly,
  fireAfterMove,
  fireEscapes,
  fireJudged,
  fireLoss,
  fireRanked,
  fireBurns,
  fireShadows,
  fireproofSquare,
  ownShots,
  shadowStage,
  boardAngle,
  funhouseDue,
  initPowers,
  legalMoves,
  newBoard,
  netBoard,
  pieceAt,
  playOnBoard,
  powerRoll as powerRollOf,
  powerTurn,
  prepareTurn,
  rageOf,
  ragePoints,
  rageTick,
  recentMoves,
  sanLineToUci,
  triggerUltimate,
  withPiece,
  withoutPiece,
  type Battle,
  type EngineLike,
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

function battle(id: "gingerbread" | "clown" | "grex", fen: string, patch: Partial<BossState> = {}, seed = 7): BossState {
  return { id, elo: 1500, crowdSide: "w", crowdMoves: 0, sinceKill: 0, kills: [], powers: initPowers(seed, fen, "w"), ...patch };
}
/** Turns 1..n begin, the position unchanged; `judged` after each crowd move. */
function turns(b: BossState, fen: string, n: number, judged?: number, s: BossPowerSettings = BOSS_POWERS): BossState[] {
  const out: BossState[] = [];
  for (let t = 1; t <= n; t++) {
    b = prepareTurn({ ...b, crowdMoves: t - 1, powers: { ...b.powers!, ...(judged !== undefined ? { judged } : {}) } }, fen, "", s);
    out.push(b);
  }
  return out;
}
const kinds = (b: BossState) => b.powers!.events.map((e) => e.kind);
/**
 * The meter's rates these tests were written for (5 a crowd move, up to 5 more ahead, a queen's worth a full meter,
 * every boss at speed 1), so a retune of the shipped numbers (settings.ts) doesn't move them.
 */
const S: BossPowerSettings = { ...BOSS_POWERS, ragePerMove: 5, rageAheadMax: 5, ragePerMaterial: 100 / 9, rageStrike: 25, rageSpeed: {} };

describe("the ultimate's meter", () => {
  it("fills a little each crowd move, faster while the crowd is ahead on the judged eval; the switch turns that off", () => {
    expect(rageTick(undefined, S)).toBe(S.ragePerMove);
    expect(rageTick(0.5, S)).toBe(5);
    expect(rageTick(0.3, S)).toBe(5);
    expect(rageTick(0.625, S)).toBeCloseTo(7.5);
    expect(rageTick(0.75, S)).toBe(10);
    expect(rageTick(0.95, S)).toBe(10);
    expect(rageTick(0.75, { ...S, rageOverTime: false })).toBe(0);
    // Material counts too: at these rates a queen's worth fills it alone; as shipped, half of it (it fills again and
    // again now, so trades would bring one ultimate after another).
    expect(ragePoints({ charge: 0, lost: 9 }, S)).toBeCloseTo(S.rageFull);
    expect(ragePoints({ charge: 0, lost: 9 })).toBeCloseTo(BOSS_POWERS.rageFull / 2);
  });

  it("on its own, it's full after 20 crowd moves (the warning as turn 21 begins, the ultimate on 22), then empties and fills again: 22, 46, 70", () => {
    const seen = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 70, undefined, S);
    const at = (turn: number) => seen[turn - 1]!;
    expect(rageOf(at(1), S)).toBe(0);
    expect(rageOf(at(10), S)).toBeCloseTo(0.45);
    // (The blizzard lasts three turns, the meter empty through them: each next one comes two turns later than a
    // one-turn ultimate's would.)
    expect(seen.filter((b) => kinds(b).includes("warn")).map((b) => b.powers!.turn)).toEqual([21, 45, 69]);
    expect(seen.filter((b) => kinds(b).includes("blizzard")).map((b) => b.powers!.turn)).toEqual([22, 46, 70]);
    // Full on the ultimate's turn; empty through its effect (22, 23, 24); over as turn 25 begins; then it fills again
    // from empty.
    expect(rageOf(at(22), S)).toBe(1);
    for (const t of [23, 24, 25]) expect(rageOf(at(t), S)).toBe(0);
    expect(at(24).powers!.ultAt).toBe(22);
    expect(rageOf(at(35), S)).toBeCloseTo(0.5);
    expect(at(25).powers!.ultAt).toBeUndefined();
    expect(at(25).powers!.warnAt).toBeUndefined();
    expect(at(70).powers!.ults).toBe(3);
  });

  it("each boss fills at its own speed (every gain times it): a faster one is full sooner", () => {
    const fast: BossPowerSettings = { ...S, rageSpeed: { gingerbread: 2 } };
    const seen = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 30, undefined, fast);
    expect(seen.findIndex((b) => kinds(b).includes("warn")) + 1).toBe(11);
    expect(rageOf(seen[4]!, fast)).toBeCloseTo(0.4);
    // As shipped, every boss with powers has a speed; Ginger's is a little faster than the usual (Eric, Oct 11).
    for (const id of ["gingerbread", "clown", "grex", "hollow", "bigboy", "sawyer"]) expect(BOSS_POWERS.rageSpeed[id]).toBeGreaterThan(0);
    expect(BOSS_POWERS.rageSpeed.gingerbread!).toBeGreaterThan(1);
  });

  it("with the crowd well ahead it's full twice as fast; losing material fills it faster still", () => {
    const ahead = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 20, 0.8, S);
    expect(ahead.findIndex((b) => kinds(b).includes("warn")) + 1).toBe(11);
    // A rook down (5 of 9) from the start: 55 points, then 5 a move: full after 9 moves.
    const rookDown = RUY_FEN.replace("r1bqk2r", "r1bqk3");
    const lost = turns(battle("gingerbread", RUY_FEN), rookDown, 20, undefined, S);
    expect(lost.findIndex((b) => kinds(b).includes("warn")) + 1).toBe(10);
  });

  it("with the switch off, only material fills it", () => {
    const off = { ...S, rageOverTime: false };
    const seen = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 45, 0.9, off);
    expect(seen.some((b) => kinds(b).includes("warn"))).toBe(false);
    expect(rageOf(seen[44]!, off)).toBe(0);
  });

  it("nothing gathers while the ultimate's effect runs: the Roman candle's barrage holds it empty, then it fills again", () => {
    // Turns 1..60, the crowd well ahead, the position unchanged; after each crowd move the fire burns out as in a match.
    const seen: BossState[] = [];
    let g = battle("grex", RUY_FEN);
    for (let t = 1; t <= 60; t++) {
      g = prepareTurn({ ...g, crowdMoves: t - 1, powers: { ...g.powers!, judged: 0.9 } }, RUY_FEN, "", S);
      seen.push(g);
      g = fireAfterMove({ ...g, crowdMoves: t }, RUY_FEN, null).boss;
    }
    const candles = seen.filter((b) => kinds(b).includes("candle")).map((b) => b.powers!.turn);
    expect(candles[0]).toBe(12);
    // Through the barrage (its shots still to fall, or fire still burning) the meter is held at nothing, however far
    // ahead the crowd is; it fills again from the turn the last fire went out.
    const over = seen.findIndex((b, i) => i + 1 > candles[0]! && b.powers!.ultAt === undefined) + 1;
    expect(over).toBeGreaterThan(candles[0]! + BOSS_POWERS.candleDelay + BOSS_POWERS.candleWaves.length - 1);
    for (let turn = candles[0]! + 1; turn < over; turn++) {
      const b = seen[turn - 1]!;
      expect((b.powers!.candle?.left ?? 0) > 0 || !!b.powers!.fire?.length).toBe(true);
      expect(rageOf(b, S)).toBe(0);
    }
    expect(rageOf(seen[over - 1]!, S)).toBe(0);
    expect(rageOf(seen[over]!, S)).toBeCloseTo(0.1);
    // The next candle: a full meter (10 moves at 10 a move) and the warning after it's over, never during the barrage.
    expect(candles[1]).toBe(over + 11);
  });
});

describe("the test trigger", () => {
  it("brings the ultimate as the next turn begins, without the warning; never while one is under way or the battle's over; again once it's over", () => {
    let b = prepareTurn(battle("gingerbread", RUY_FEN), RUY_FEN);
    const t = triggerUltimate(b);
    expect(t.ok).toBe(true);
    b = t.boss!;
    // Nothing changes this turn (the moves allowed, the meter).
    expect(crowdAllowed(b, RUY_FEN)).toBeNull();
    expect(prepareTurn(b, RUY_FEN)).toBe(b);
    // Twice is the same as once.
    expect(triggerUltimate(b).boss).toBe(b);
    b = prepareTurn({ ...b, crowdMoves: 1 }, RUY_FEN);
    expect(kinds(b)).toContain("blizzard");
    expect(kinds(b)).not.toContain("warn");
    expect(blizzardNow(b)).toBe(true);
    expect(b.powers!.ultNext).toBeUndefined();
    expect(b.powers!.ults).toBe(1);
    // Under way, through its three turns (the ice thawing on the second, gone on the third): nothing (one never
    // overlaps another).
    expect(triggerUltimate(b).ok).toBe(false);
    b = prepareTurn({ ...b, crowdMoves: 2 }, RUY_FEN);
    expect(kinds(b)).toContain("thaw");
    expect(blizzardNow(b)).toBe(true);
    expect(triggerUltimate(b).ok).toBe(false);
    b = prepareTurn({ ...b, crowdMoves: 3 }, RUY_FEN);
    expect(kinds(b)).toContain("thaw");
    expect(blizzardNow(b)).toBe(false);
    expect(triggerUltimate(b).ok).toBe(false);
    // Over as the next turn begins: it can be pulled again, and the blizzard comes again.
    b = prepareTurn({ ...b, crowdMoves: 4 }, RUY_FEN);
    expect(blizzardNow(b)).toBe(false);
    const again = triggerUltimate(b);
    expect(again.ok).toBe(true);
    b = prepareTurn({ ...again.boss!, crowdMoves: 5 }, RUY_FEN);
    expect(kinds(b)).toContain("blizzard");
    expect(b.powers!.ults).toBe(2);
    expect(triggerUltimate({ ...battle("clown", RUY_FEN), result: "crowd" }).ok).toBe(false);
    expect(triggerUltimate({ ...battle("clown", RUY_FEN), powers: undefined }).ok).toBe(false);
    expect(triggerUltimate(null).ok).toBe(false);
  });

  it("during the warning turn it changes nothing: the ultimate comes the next turn, once", () => {
    const down = RUY_FEN.replace("r1bqk2r", "r1b1k2r");
    let b = prepareTurn(battle("clown", RUY_FEN), RUY_FEN, "", S);
    b = prepareTurn({ ...b, crowdMoves: 1 }, down, "", S);
    expect(kinds(b)).toContain("warn");
    b = triggerUltimate(b).boss!;
    b = prepareTurn({ ...b, crowdMoves: 2 }, down, "", S);
    // (The funhouse's moment comes with the move he plays for the crowd: due now.)
    expect(b.powers!.funhouse?.turn).toBe(3);
    expect(funhouseDue(b)).toBe(true);
    expect(boardAngle(b)).toBe(180);
    expect(b.powers!.ultAt).toBe(3);
    expect(b.powers!.ults).toBe(1);
  });

  it("in a match: pressed mid-turn it waits for the turn's end, for Ginger and Boingo; after the end it does nothing", async () => {
    for (const id of ["gingerbread", "clown"] as const) {
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossId: id, lastStandFrom: 999, bossMaxMoves: 4 } as Settings;
      const runner = new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
      runner.deal();
      const before = runner.crowdAllowed();
      expect(runner.triggerUltimate()).toBe(true);
      expect(runner.crowdAllowed()).toEqual(before);
      expect(boardAngle(runner.boss)).toBe(0);
      await runner.score(new Map([["h0", { move: legalMoves(runner.boards.get(0)!.fen)[0]!, thinkMs: 1000 }]]));
      // While the boss is to move: still nothing; pressing again changes nothing.
      expect(runner.triggerUltimate()).toBe(true);
      await runner.playBoss();
      if (id === "gingerbread") expect(blizzardNow(runner.boss)).toBe(true);
      else expect(boardAngle(runner.boss)).toBe(180);
      expect(runner.bossView()!.powers!.events.some((e) => e.kind === "warn")).toBe(false);
      expect(runner.triggerUltimate()).toBe(false);
      // Play it out to the end: the board is never left without a move; once the battle's over, the trigger does nothing.
      for (let i = 0; i < 8 && !runner.stageComplete(); i++) {
        if (runner.bossToMove()) await runner.playBoss();
        if (runner.stageComplete()) break;
        // (Boingo's funhouse: his move for the crowd first.)
        if (runner.funhouseDue()) {
          await runner.playFunhouse();
          continue;
        }
        runner.deal();
        const allowed = runner.crowdAllowed() ?? legalMoves(runner.boards.get(0)!.fen);
        expect(allowed.length).toBeGreaterThan(0);
        await runner.score(new Map([["h0", { move: allowed[0]!, thinkMs: 1000 }]]));
      }
      runner.finishBossBattle();
      expect(runner.triggerUltimate()).toBe(false);
    }
  });
});

// White: Kg1, Nf3, pawns f2 g2 h2; Black: Kg8, pawns.
const KN_FEN = "6k1/5ppp/8/8/8/5N2/5PPP/6K1 w - - 0 1";

describe("G-REX's fire tiles", () => {
  it("the sparkler lands on the crowd's half, never on its king, empty or occupied; the same everywhere", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const sq = chooseSpark(RUY_FEN, "w", seed, 2)!;
      expect(Number(sq[1])).toBeLessThanOrEqual(4);
      expect(sq).not.toBe("g1");
      expect(chooseSpark(RUY_FEN, "w", seed, 2)).toBe(sq);
      seen.add(sq);
    }
    expect([...seen].some((sq) => pieceAt(RUY_FEN, sq))).toBe(true);
    expect([...seen].some((sq) => !pieceAt(RUY_FEN, sq))).toBe(true);
    // Black's crowd: ranks 5 to 8.
    expect(Number(chooseSpark(RUY_FEN, "b", 3, 2)![1])).toBeGreaterThanOrEqual(5);
  });

  it("burns in three stages, one a crowd turn; after the crowd's move on the third, a piece left on it is destroyed", () => {
    let b = turns(battle("grex", KN_FEN), KN_FEN, 1)[0]!;
    expect(b.powers!.fire ?? []).toEqual([]);
    // Turn 2: the sparkler (pin it on the knight's square for the test).
    b = prepareTurn({ ...b, crowdMoves: 1 }, KN_FEN);
    expect(kinds(b)).toEqual(["spark"]);
    b = { ...b, powers: { ...b.powers!, fire: [{ square: "f3", lit: 2 }] } };
    expect(powerTurn(b)).toBe(true);
    expect(ablaze(b)).toEqual([]);
    // Pieces may stand on it at any stage: after the crowd's move on turns 2 and 3 nothing burns.
    let out = fireAfterMove({ ...b, crowdMoves: 2 }, KN_FEN, "h2h3");
    expect(out.emptied).toEqual([]);
    b = prepareTurn({ ...out.boss, crowdMoves: 2 }, KN_FEN);
    out = fireAfterMove({ ...b, crowdMoves: 3 }, KN_FEN, "h2h3");
    expect(out.emptied).toEqual([]);
    b = prepareTurn({ ...out.boss, crowdMoves: 3 }, KN_FEN);
    // Turn 4: ablaze.
    expect(ablaze(b)).toEqual(["f3"]);
    out = fireAfterMove({ ...b, crowdMoves: 4 }, KN_FEN, "h2h3");
    expect(out.emptied).toEqual(["f3"]);
    expect(pieceAt(out.fen, "f3")).toBeNull();
    expect(out.boss.powers!.burnt).toEqual([{ turn: 4, square: "f3", piece: "n" }]);
    expect(out.boss.powers!.fire).toEqual([]);
    expect(out.boss.powers!.fireOut).toBe(4);
    // A full turn with no fire, then the next sparkler.
    b = prepareTurn({ ...out.boss, crowdMoves: 4 }, out.fen);
    expect(b.powers!.fire).toEqual([]);
    expect(kinds(b)).toEqual([]);
    b = prepareTurn({ ...b, crowdMoves: 5 }, out.fen);
    expect(kinds(b)).toEqual(["spark"]);
  });

  it("a piece that leaves in time is safe, and a piece that steps onto a tile ablaze burns at once", () => {
    const b = battle("grex", KN_FEN, { crowdMoves: 3, powers: { ...initPowers(7, KN_FEN, "w"), turn: 4, fire: [{ square: "f3", lit: 2 }] } });
    expect(ablaze(b)).toEqual(["f3"]);
    const left = fireAfterMove({ ...b, crowdMoves: 4 }, applyMove(KN_FEN, "f3e5"), "f3e5");
    expect(left.emptied).toEqual([]);
    // (The tile just burns out.)
    expect(left.boss.powers!.burnt).toEqual([{ turn: 4, square: "f3" }]);
    expect(left.boss.powers!.fire).toEqual([]);
    const onto = battle("grex", KN_FEN, { crowdMoves: 3, powers: { ...initPowers(7, KN_FEN, "w"), turn: 4, fire: [{ square: "e5", lit: 2 }] } });
    const burnt = fireAfterMove({ ...onto, crowdMoves: 4 }, applyMove(KN_FEN, "f3e5"), "f3e5");
    expect(burnt.emptied).toEqual(["e5"]);
  });

  it("the king is fireproof (the tile fizzles); so is a piece shielding its king, and one whose loss would give check", () => {
    expect(burnOutcome(KN_FEN, ["g1"], "w")).toEqual({ fen: KN_FEN, burnt: [{ square: "g1", fizzled: true }] });
    // The knight on f2 shields the king on g1 from the bishop on c5... (Black to move after White's move.)
    const pinned = "6k1/8/8/2b5/8/8/5N2/6K1 b - - 0 1";
    expect(burnOutcome(pinned, ["f2"], "w").burnt).toEqual([{ square: "f2", fizzled: true }]);
    // The knight on d1 blocks the rook on a1 from Black's king on h1: burning it would give check.
    const discover = "8/8/8/8/8/6K1/8/R2N3k b - - 0 1";
    expect(burnOutcome(discover, ["d1"], "w").burnt).toEqual([{ square: "d1", fizzled: true }]);
    // The boss's own pieces never burn.
    expect(burnOutcome(KN_FEN, ["g8", "f7"], "w").burnt).toEqual([]);
    // Nothing burns once the crowd's move has ended the game.
    const mated = "R5k1/5ppp/8/8/8/5N2/5PPP/6K1 b - - 0 1";
    expect(burnOutcome(mated, ["f3"], "w").burnt).toEqual([]);
  });

  it("a rook burnt in its corner takes its castling right; a pawn that just double-stepped takes en passant", () => {
    expect(withoutPiece("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 3 1", "h1").split(" ")[2]).toBe("Qkq");
    expect(withoutPiece("4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1", "e4").split(" ")[3]).toBe("-");
    expect(withoutPiece("4k3/8/8/8/8/8/8/4KN2 b - - 7 1", "f1").split(" ")[4]).toBe("0");
  });

  it("the once-a-match warning: the first crowd turn a piece steps onto a burning tile, and never again", () => {
    let b = battle("grex", KN_FEN, { crowdMoves: 2, powers: { ...initPowers(7, KN_FEN, "w"), turn: 3, fire: [{ square: "e5", lit: 2 }] } });
    // A move elsewhere: nothing.
    let out = fireAfterMove({ ...b, crowdMoves: 3 }, applyMove(KN_FEN, "h2h3"), "h2h3");
    expect(out.boss.powers!.stepped).toBeUndefined();
    out = fireAfterMove({ ...b, crowdMoves: 3 }, applyMove(KN_FEN, "f3e5"), "f3e5");
    expect(out.boss.powers!.stepped).toBe(3);
    b = { ...out.boss, crowdMoves: 3, powers: { ...out.boss.powers!, turn: 4, fire: [{ square: "g5", lit: 4 }] } };
    out = fireAfterMove({ ...b, crowdMoves: 4 }, applyMove(applyMove(applyMove(KN_FEN, "f3e5"), "g8f8"), "e5g4"), "e5g4");
    expect(out.boss.powers!.stepped).toBe(3);
  });
});

describe("the Roman candle", () => {
  /** He fires as turn 2 begins (the test trigger); then turn after turn, the crowd's moves leaving the position as it is. */
  function barrage(lastTurn: number, fen = RUY_FEN, seed = 7) {
    let b = prepareTurn(battle("grex", fen, {}, seed), fen);
    b = triggerUltimate(b).boss!;
    b = prepareTurn({ ...b, crowdMoves: 1 }, fen);
    const states = new Map<number, BossState>([[2, b]]);
    for (let t = 3; t <= lastTurn; t++) {
      // The crowd's move on the turn before: the fire burns out on schedule.
      const after = fireAfterMove({ ...b, crowdMoves: t - 1 }, fen, null);
      fen = after.fen;
      b = prepareTurn({ ...after.boss, crowdMoves: t - 1 }, fen);
      states.set(t, b);
    }
    return states;
  }

  it("fires 24 shots in a schedule that ramps up then down: 1, 2, 3, 4, 4, 4, 3, 2, 1", () => {
    expect(BOSS_POWERS.candleShots).toBe(24);
    const w = BOSS_POWERS.candleWaves;
    expect(w.reduce((x, y) => x + y, 0)).toBe(24);
    const peak = w.indexOf(Math.max(...w));
    for (let i = 1; i < w.length; i++) {
      if (i <= peak) expect(w[i]!).toBeGreaterThanOrEqual(w[i - 1]!);
      else expect(w[i]!).toBeLessThanOrEqual(w[i - 1]!);
    }
    expect(w[0]).toBe(1);
    expect(w.at(-1)).toBe(1);
  });

  it("3 crowd moves after the launch they fall a wave a turn, each a stage-1 fire tile, never on the king, spread out; some on his own half", () => {
    const states = barrage(18);
    const b2 = states.get(2)!;
    expect(kinds(b2)).toEqual(["candle"]);
    expect(b2.powers!.candle).toMatchObject({ at: 2, left: 24 });
    const waves: number[] = [];
    const sparks: number[] = [];
    let mine = 0;
    for (let t = 3; t <= 18; t++) {
      const b = states.get(t)!;
      const wave = b.powers!.events.find((e) => e.kind === "fireball");
      waves.push(wave ? wave.squares!.length : 0);
      if (kinds(b).includes("spark")) sparks.push(t);
      // (Each wave: candleOwnShare of it, rounded, on his half; the rest on the crowd's.)
      const own = (wave?.squares ?? []).filter((sq) => Number(sq[1]) > 4);
      expect(own.length).toBe(wave ? ownShots(wave.squares!.length) : 0);
      mine += own.length;
      for (const sq of wave?.squares ?? []) {
        expect(pieceAt(RUY_FEN, sq)?.type === "k" && pieceAt(RUY_FEN, sq)?.color === "w").toBe(false);
        expect(b.powers!.fire!.find((x) => x.square === sq)!.lit).toBe(t);
        expect(b.powers!.fire!.find((x) => x.square === sq)!.candle).toBe(true);
      }
      // No two tiles on one square; within a wave, none next to another.
      const squares = (b.powers!.fire ?? []).map((x) => x.square);
      expect(new Set(squares).size).toBe(squares.length);
      for (const a of wave?.squares ?? []) for (const c of wave!.squares!) if (a !== c) expect(Math.max(Math.abs(a.charCodeAt(0) - c.charCodeAt(0)), Math.abs(Number(a[1]) - Number(c[1])))).toBeGreaterThanOrEqual(2);
    }
    // Fired as turn 2 began: none as the 3rd and 4th begin; then 1, 2, 3, 4, 4, 4, 3, 2, 1 from the 5th.
    expect(waves.slice(0, 11)).toEqual([0, 0, 1, 2, 3, 4, 4, 4, 3, 2, 1]);
    expect(waves.reduce((x, y) => x + y, 0)).toBe(24);
    // As shipped: 10 of the 24 on his own half, 14 on the crowd's (all 24 fell on the crowd's before, Oct 11).
    expect(mine).toBe(BOSS_POWERS.candleWaves.reduce((n, w) => n + ownShots(w), 0));
    expect(mine).toBe(10);
    expect(states.get(13)!.powers!.candle!.left).toBe(0);
    // The shots still up as each turn begins (the pips): 24 until the first lands, then down to 0.
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((t) => states.get(t)!.powers!.candle!.left)).toEqual([24, 24, 24, 23, 21, 18, 14, 10, 6, 3, 1, 0]);
    // The sparkler waited through the barrage: the last tile (turn 13) burns out after turn 15, a turn with no fire, then turn 17.
    expect(sparks[0]).toBe(17);
  });

  it("picks each wave's squares 3 turns before it lands: what falls is exactly what was shadowed", () => {
    const states = barrage(14);
    for (let t = 2; t <= 10; t++) {
      const b = states.get(t)!;
      // As each turn from the launch begins, a new wave is picked to land 3 turns later.
      const picked = b.powers!.candle!.waves!.filter((w) => w.lands === t + 3);
      expect(picked, `turn ${t}`).toHaveLength(1);
      expect(picked[0]!.shots).toBe(BOSS_POWERS.candleWaves[t - 2]);
      expect(picked[0]!.squares).toHaveLength(picked[0]!.shots);
      // ...and 3 turns later exactly those squares are hit.
      const landed = states.get(t + 3)!.powers!.events.find((e) => e.kind === "fireball")!;
      expect(landed.squares).toEqual(picked[0]!.squares);
      // Never on a square that's burning or about to be hit when it lands.
      const before = states.get(t + 3)!.powers!.fire!.filter((f) => f.lit < t + 3).map((f) => f.square);
      for (const sq of picked[0]!.squares) expect(before).not.toContain(sq);
    }
    // Nothing is picked once all 24 are on their way.
    expect(states.get(11)!.powers!.candle!.waves!.map((w) => w.lands)).toEqual([12, 13]);
    expect(states.get(13)!.powers!.candle!.waves).toEqual([]);
  });

  it("each shadow shows small 3 turns out, bigger the next turn, bigger again the turn after, then the fireball drops", () => {
    const states = barrage(12);
    const sq = states.get(2)!.powers!.candle!.waves![0]!.squares[0]!;
    const stageOn = (t: number) => fireShadows(states.get(t)!.powers).find((x) => x.square === sq && x.lands === 5)?.stage ?? null;
    expect([2, 3, 4, 5].map(stageOn)).toEqual([1, 2, 3, null]);
    expect(shadowStage(5, 2)).toBe(1);
    expect(shadowStage(5, 4)).toBe(3);
    expect(states.get(5)!.powers!.fire!.find((f) => f.square === sq)!.lit).toBe(5);
    // At the barrage's height three waves are shadowed at once, in three sizes.
    const sizes = fireShadows(states.get(7)!.powers).map((x) => x.stage);
    expect(new Set(sizes)).toEqual(new Set([1, 2, 3]));
    // (Turn 7: the waves landing on turns 8, 9 and 10, four shots each.)
    expect(sizes.length).toBe(4 + 4 + 4);
  });

  it("a fireball whose square the crowd's king has stepped onto fizzles: never a tile under the king", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    let b = prepareTurn(battle("grex", fen), fen);
    b = triggerUltimate(b).boss!;
    b = prepareTurn({ ...b, crowdMoves: 1 }, fen);
    const target = b.powers!.candle!.waves![0]!.squares[0]!;
    expect(target).not.toBe("e1");
    // The king walks onto it by the time it lands.
    const kingOn = (() => {
      const rank = Number(target[1]);
      const file = target.charCodeAt(0) - 97;
      const rows = Array.from({ length: 8 }, (_, i) => (8 - i === rank ? `${file ? file : ""}K${7 - file ? 7 - file : ""}` : "8"));
      rows[0] = "4k3";
      return `${rows.join("/")} w - - 0 1`;
    })();
    expect(pieceAt(kingOn, target)?.type).toBe("k");
    for (let t = 3; t <= 5; t++) b = prepareTurn({ ...fireAfterMove({ ...b, crowdMoves: t - 1 }, t < 5 ? fen : kingOn, null).boss, crowdMoves: t - 1 }, t < 5 ? fen : kingOn);
    const wave = b.powers!.events.find((e) => e.kind === "fireball")!;
    expect(wave.squares).toContain(target);
    expect(wave.fizzled).toEqual([target]);
    expect((b.powers!.fire ?? []).map((f) => f.square)).not.toContain(target);
    expect(b.powers!.candle!.left).toBe(23);
  });

  it("the fireballs' squares are the same everywhere, and never more than there's room for", () => {
    expect(chooseFireballs(RUY_FEN, "w", 9, 5, 4)).toEqual(chooseFireballs(RUY_FEN, "w", 9, 5, 4));
    const all = chooseFireballs(RUY_FEN, "w", 9, 5, 40);
    expect(all.length).toBe(31);
    expect(all).not.toContain("g1");
    // The whole barrage is the same from the same seed, picked ahead or not.
    expect(JSON.stringify(barrage(13, RUY_FEN, 3).get(13))).toBe(JSON.stringify(barrage(13, RUY_FEN, 3).get(13)));
  });
});

describe("Jefferson's candle on his own half, and his fireproof laugh (Eric, Oct 11)", () => {
  it("a wave's own share falls on his half, the rest on the crowd's: never the crowd king's square, spread, the same from the seed", () => {
    for (let seed = 0; seed < 40; seed++) {
      const sq = chooseFireballs(RUY_FEN, "w", seed, 6, 4, [], 2);
      expect(sq).toHaveLength(4);
      expect(new Set(sq).size).toBe(4);
      // The crowd's first (the same squares as a wave with none on his half), then his.
      expect(sq.slice(0, 2).every((x) => Number(x[1]) <= 4)).toBe(true);
      expect(sq.slice(2).every((x) => Number(x[1]) >= 5)).toBe(true);
      expect(sq.slice(0, 2)).toEqual(chooseFireballs(RUY_FEN, "w", seed, 6, 2));
      expect(chooseFireballs(RUY_FEN, "w", seed, 6, 4, [], 2)).toEqual(sq);
      expect(sq).not.toContain("g1");
    }
    // A black crowd: his half is ranks 1-4.
    for (const x of chooseFireballs(RUY_FEN, "b", 3, 6, 4, [], 4)) expect(Number(x[1])).toBeLessThanOrEqual(4);
    // As shipped: about four in ten of each wave, rounded.
    expect(BOSS_POWERS.candleWaves.map((w) => ownShots(w))).toEqual([0, 1, 1, 2, 2, 2, 1, 1, 0]);
  });

  it("his pieces never burn: a tile ablaze under one of his does nothing", () => {
    // (A black pawn on e5 in this position: the crowd is White.)
    expect(burnOutcome(RUY_FEN, ["e5"], "w").burnt).toEqual([]);
    expect(burnOutcome(RUY_FEN, ["e5"], "w").fen).toBe(RUY_FEN);
  });

  it("the first time one of his pieces sits on the candle's fire: his laugh, once a match, its line from the seed", () => {
    const start = battle("grex", RUY_FEN, { crowdMoves: 3 }, 11);
    const powers = { ...start.powers!, turn: 3, ultAt: 2, candle: { at: 2, left: 6, next: 9, waves: [] }, fire: [{ square: "e5", lit: 3, candle: true as const }, { square: "a1", lit: 3, candle: true as const }] };
    let b = prepareTurn({ ...start, powers }, RUY_FEN);
    expect(b.powers!.fireproof).toEqual({ turn: 4, square: "e5", pick: Math.floor(powerRollOf(11, "fireproof") * 4096) });
    expect(b.powers!.events).toContainEqual({ kind: "fireproof", turn: 4, square: "e5", pick: b.powers!.fireproof!.pick });
    // Never again, though his pieces stand in the fire still.
    b = prepareTurn({ ...b, crowdMoves: 4 }, RUY_FEN);
    expect(kinds(b)).not.toContain("fireproof");
    expect(b.powers!.fireproof!.turn).toBe(4);
    // His sparkler's fire doesn't count (only the candle's), nor the crowd's own pieces on the candle's.
    expect(fireproofSquare([{ square: "e5", lit: 3 }], RUY_FEN, "w")).toBeNull();
    expect(fireproofSquare([{ square: "e4", lit: 3, candle: true }], RUY_FEN, "w")).toBeNull();
    expect(fireproofSquare([{ square: "e4", lit: 3, candle: true }, { square: "f6", lit: 3, candle: true }], RUY_FEN, "w")).toBe("f6");
    // The same seed, the same line; another seed may pick another.
    const pickOf = (seed: number) => prepareTurn({ ...start, powers: { ...powers, seed } }, RUY_FEN).powers!.fireproof!.pick;
    expect(pickOf(11)).toBe(pickOf(11));
    expect(new Set(Array.from({ length: 20 }, (_, i) => pickOf(i) % 4)).size).toBeGreaterThan(1);
  });
});

describe("Jefferson's Roman candle chars a piece first, then burns it (Eric, Nov 20)", () => {
  // (After the crowd's move h2-h3: the knight on f3 left on a tile of the candle's, ablaze on turn 4.)
  const AFTER = applyMove(KN_FEN, "h2h3");
  const onFire = (patch: Partial<BossState["powers"] & object> = {}, square = "f3", candle = true) =>
    battle("grex", KN_FEN, { crowdMoves: 4, powers: { ...initPowers(7, KN_FEN, "w"), turn: 4, fire: [{ square, lit: 2, ...(candle ? { candle: true as const } : {}) }], ...patch } });

  it("the first time the candle's fire reaches a piece, it's charred and stays; the second time it burns", () => {
    const first = fireAfterMove(onFire(), AFTER, "h2h3");
    expect(first.emptied).toEqual([]);
    expect(first.fen).toBe(AFTER);
    expect(first.boss.powers!.burnt).toEqual([{ turn: 4, square: "f3", charred: "n", hits: 1 }]);
    expect(first.boss.powers!.charred).toEqual([{ square: "f3", piece: "n", n: 1 }]);
    // (The tile burns out under it, as an empty one does.)
    expect(first.boss.powers!.fire).toEqual([]);
    // The second: it burns, and its mark goes with it.
    const second = fireAfterMove(onFire({ charred: first.boss.powers!.charred }), AFTER, "h2h3");
    expect(second.emptied).toEqual(["f3"]);
    expect(pieceAt(second.fen, "f3")).toBeNull();
    expect(second.boss.powers!.burnt).toEqual([{ turn: 4, square: "f3", piece: "n", hits: 2 }]);
    expect(second.boss.powers!.charred).toEqual([]);
    // Other marks stay as they were.
    const both = fireAfterMove(onFire({ charred: [{ square: "f3", piece: "n", n: 1 }, { square: "g2", piece: "p", n: 1 }] }), AFTER, "h2h3");
    expect(both.boss.powers!.charred).toEqual([{ square: "g2", piece: "p", n: 1 }]);
  });

  it("his sparkler still burns at once, and candleHitsToBurn 1 is the old candle (it burns the first time)", () => {
    const spark = fireAfterMove(onFire({}, "f3", false), AFTER, "h2h3");
    expect(spark.emptied).toEqual(["f3"]);
    expect(spark.boss.powers!.charred).toBeUndefined();
    const once = fireAfterMove(onFire(), AFTER, "h2h3", { ...BOSS_POWERS, candleHitsToBurn: 1 });
    expect(once.emptied).toEqual(["f3"]);
    expect(once.boss.powers!.burnt).toEqual([{ turn: 4, square: "f3", piece: "n", hits: 1 }]);
    // (The sparkler's: no count.)
    expect(spark.boss.powers!.burnt).toEqual([{ turn: 4, square: "f3", piece: "n" }]);
    // Three: charred twice, then it burns.
    const three = { ...BOSS_POWERS, candleHitsToBurn: 3 };
    const twice = fireAfterMove(onFire({ charred: [{ square: "f3", piece: "n", n: 1 }] }), AFTER, "h2h3", three);
    expect(twice.emptied).toEqual([]);
    expect(twice.boss.powers!.charred).toEqual([{ square: "f3", piece: "n", n: 2 }]);
    expect(fireAfterMove(onFire({ charred: twice.boss.powers!.charred }), AFTER, "h2h3", three).emptied).toEqual(["f3"]);
  });

  it("his own pieces are never charred or burnt, and the guards hold: never the king; a charred piece whose loss leaves a king in check stays charred", () => {
    // (A black pawn on f7: the crowd is White.)
    const his = fireAfterMove(onFire({}, "f7"), AFTER, "h2h3");
    expect(his.emptied).toEqual([]);
    expect(his.boss.powers!.burnt).toEqual([{ turn: 4, square: "f7" }]);
    expect(his.boss.powers!.charred).toBeUndefined();
    expect(charSquares(AFTER, [{ square: "f7", lit: 2, candle: true }], [], "w")).toEqual([]);
    // The king: the tile fizzles, no mark.
    const king = fireAfterMove(onFire({}, "g1"), AFTER, "h2h3");
    expect(king.boss.powers!.burnt).toEqual([{ turn: 4, square: "g1", fizzled: true }]);
    expect(king.boss.powers!.charred).toBeUndefined();
    // The knight on f2 shields its king from the bishop on c5: charred the first time (a mark takes nothing off the board),
    // and the second time it fizzles, still charred, still there.
    const pinned = "6k1/8/8/2b5/8/8/5N2/6K1 b - - 0 1";
    const pin = (patch: Partial<BossState["powers"] & object> = {}) => battle("grex", pinned, { crowdMoves: 4, powers: { ...initPowers(7, pinned, "w"), turn: 4, fire: [{ square: "f2", lit: 2, candle: true }], ...patch } });
    const once = fireAfterMove(pin(), pinned, null);
    expect(once.boss.powers!.charred).toEqual([{ square: "f2", piece: "n", n: 1 }]);
    const again = fireAfterMove(pin({ charred: once.boss.powers!.charred }), pinned, null);
    expect(again.emptied).toEqual([]);
    expect(again.boss.powers!.burnt).toEqual([{ turn: 4, square: "f2", fizzled: true }]);
    expect(again.boss.powers!.charred).toEqual([{ square: "f2", piece: "n", n: 1 }]);
  });

  it("the judge counts only what really burns: a piece the candle only chars isn't lost, a charred one is", () => {
    // Turn 4 begins (3 crowd moves made) with the candle's tile under the knight ablaze.
    const turn4 = (patch: Partial<BossState["powers"] & object> = {}, candle = true) => ({ ...onFire({ turn: 4, ...patch }, "f3", candle), crowdMoves: 3 });
    expect(ablaze(turn4())).toEqual(["f3"]);
    expect(fireBurns(turn4())).toEqual([]);
    expect(fireBurns(turn4({ charred: [{ square: "f3", piece: "n", n: 1 }] }))).toEqual(["f3"]);
    expect(fireBurns(turn4({}, false))).toEqual(["f3"]);
    // (A mark elsewhere doesn't count; a tile not yet ablaze doesn't either.)
    expect(fireBurns(turn4({ charred: [{ square: "g2", piece: "p", n: 1 }] }))).toEqual([]);
    expect(fireBurns({ ...turn4({ charred: [{ square: "f3", piece: "n", n: 1 }] }), crowdMoves: 2 })).toEqual([]);
    // Leaving the knight to be charred costs nothing; leaving the charred one costs it.
    expect(fireLoss(KN_FEN, "h2h3", fireBurns(turn4()), "w")).toBe(0);
    expect(fireLoss(KN_FEN, "h2h3", fireBurns(turn4({ charred: [{ square: "f3", piece: "n", n: 1 }] })), "w")).toBe(3);
  });

  it("the marks follow their pieces through every move, his and the crowd's, solo and online, and a rejoin keeps them", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossId: "gingerbread", lastStandFrom: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(2), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    // Jefferson in Ginger's place, a tile of his candle's ablaze under the knight on f3.
    const fen = runner.boards.get(0)!.fen;
    runner.state = { ...runner.state, boss: { ...runner.state.boss!, id: "grex", powers: { ...initPowers(7, fen, "w"), turn: 1, nextPassive: 99, fire: [{ square: "f3", lit: -1, candle: true }] } } };
    // (Only charred: the judge counts nothing lost.)
    expect(runner.fireBurn()).toEqual([]);
    runner.deal();
    await runner.score(new Map([["h0", { move: "d2d3", thinkMs: 1000 }]]));
    let board = runner.boards.get(0)!;
    expect(pieceAt(board.fen, "f3")).toEqual({ color: "w", type: "n" });
    expect(board.bases ?? []).toEqual([]);
    expect(runner.bossView()!.powers!.burnt).toEqual([{ turn: 1, square: "f3", charred: "n", hits: 1 }]);
    expect(runner.bossView()!.powers!.charred).toEqual([{ square: "f3", piece: "n", n: 1 }]);
    // His move (this seed's doesn't touch the knight): the mark stays on it.
    await runner.playBoss();
    board = runner.boards.get(0)!;
    expect(pieceAt(board.fen, "f3")).toEqual({ color: "w", type: "n" });
    expect(runner.bossView()!.powers!.charred).toEqual([{ square: "f3", piece: "n", n: 1 }]);
    // The crowd moves the knight: its mark goes with it.
    const hop = legalMoves(board.fen).filter((m) => m.startsWith("f3")).sort()[0]!;
    runner.deal();
    await runner.score(new Map([["h0", { move: hop, thinkMs: 1000 }]]));
    expect(runner.boards.get(0)!.lastMove).toBe(hop);
    expect(runner.bossView()!.powers!.charred).toEqual([{ square: hop.slice(2, 4), piece: "n", n: 1 }]);
    // A rejoin (the lobby's snapshot, solo's restore): the marks are still there.
    const back = MatchRunner.restore(JSON.parse(JSON.stringify(runner.snapshot())), { settings, rng: mulberry32(3), engines: [fakeEngine()], library: [opening(RUY)] });
    expect(back.bossView()!.powers!.charred).toEqual([{ square: hop.slice(2, 4), piece: "n", n: 1 }]);
  });

  it("in a match, the second hit burns the charred knight, and the judge scores saving it as the best", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossId: "gingerbread", lastStandFrom: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(2), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    const fen = runner.boards.get(0)!.fen;
    runner.state = { ...runner.state, boss: { ...runner.state.boss!, id: "grex", powers: { ...initPowers(7, fen, "w"), turn: 1, nextPassive: 99, fire: [{ square: "f3", lit: -1, candle: true }], charred: [{ square: "f3", piece: "n", n: 1 }] } } };
    expect(runner.fireBurn()).toEqual(["f3"]);
    runner.deal();
    const report = await runner.score(new Map([["h0", { move: "d2d3", thinkMs: 1000 }]]));
    expect(report.boards[0]!.bestMove.startsWith("f3")).toBe(true);
    const board = runner.boards.get(0)!;
    expect(pieceAt(board.fen, "f3")).toBeNull();
    expect(board.bases).toEqual([{ ply: board.history.length, fen: board.fen }]);
    expect(runner.bossView()!.powers!.burnt).toEqual([{ turn: 1, square: "f3", piece: "n", hits: 2 }]);
    expect(runner.bossView()!.powers!.charred).toEqual([]);
  });

  it("a mark whose piece is gone goes as the next turn begins", () => {
    const b = battle("grex", KN_FEN, { crowdMoves: 1, powers: { ...initPowers(7, KN_FEN, "w"), charred: [{ square: "f3", piece: "n", n: 1 }, { square: "e4", piece: "b", n: 1 }, { square: "g2", piece: "b", n: 1 }] } });
    expect(prepareTurn(b, KN_FEN).powers!.charred).toEqual([{ square: "f3", piece: "n", n: 1 }]);
  });

  it("on a floor of several, another boss's power that moves a charred piece outside a move takes its mark at once (followBoard)", () => {
    const marks = [{ square: "f3", piece: "n", n: 1 }, { square: "g2", piece: "p", n: 1 }];
    const boss = battle("grex", KN_FEN, { crowdMoves: 1, powers: { ...initPowers(7, KN_FEN, "w"), charred: marks } });
    // (Say Wrangler drags the knight from f3 to e5: no move, so no tracker follows it.)
    const moved = withPiece(withoutPiece(KN_FEN, "f3"), "e5", { color: "w", type: "n" });
    const b = { state: { boss, boards: [0] }, boards: new Map([[0, { fen: moved }]]) } as unknown as Battle;
    GREX.followBoard!(b);
    expect(b.state.boss!.powers!.charred).toEqual([{ square: "g2", piece: "p", n: 1 }]);
    // Nothing moved: the state is left as it was.
    const still = { state: { boss, boards: [0] }, boards: new Map([[0, { fen: KN_FEN }]]) } as unknown as Battle;
    GREX.followBoard!(still);
    expect(still.state.boss).toBe(boss);
  });

  it("the test switch (?power=candle) aims the crowd's share at its pieces: charred ones first, then pawns", () => {
    const aim = candleAim(RUY_FEN, "w", [{ square: "f3", piece: "n", n: 1 }]);
    expect(aim[0]).toEqual(["f3"]);
    expect(aim[1]!.every((sq) => pieceAt(RUY_FEN, sq)?.type === "p" && pieceAt(RUY_FEN, sq)?.color === "w")).toBe(true);
    expect(aim.flat()).not.toContain("g1");
    for (let seed = 0; seed < 20; seed++) {
      const sq = chooseFireballs(RUY_FEN, "w", seed, 6, 3, [], 1, aim);
      expect(sq[0]).toBe("f3");
      expect(pieceAt(RUY_FEN, sq[1]!)).toEqual({ color: "w", type: "p" });
      // (His share isn't aimed.)
      expect(Number(sq[2]![1])).toBeGreaterThanOrEqual(5);
      // No aim: the squares as before.
      expect(chooseFireballs(RUY_FEN, "w", seed, 6, 3, [], 1, [])).toEqual(chooseFireballs(RUY_FEN, "w", seed, 6, 3, [], 1));
    }
  });
});

describe("the judge treats a piece left to burn as already gone", () => {
  const burn = ["f3"];
  const raw = { bestMove: "h2h3", bestExpected: 0.6, expectedAfter: { h2h3: 0.6, g2g3: 0.58, f3e5: 0.55, f3d4: 0.5, g1f1: 0.52 } };

  it("a move that leaves the knight loses its value; saving it is never a mistake", () => {
    expect(fireLoss(KN_FEN, "h2h3", burn, "w")).toBe(3);
    expect(fireLoss(KN_FEN, "f3e5", burn, "w")).toBe(0);
    const judged = fireJudged(raw, KN_FEN, burn, "w");
    expect(judged.bestMove).toBe("f3e5");
    expect(judged.bestExpected).toBe(0.55);
    expect(judged.expectedAfter.f3e5).toBe(0.55);
    expect(judged.expectedAfter.h2h3!).toBeLessThan(0.1);
    // No fire: the numbers as they were.
    expect(fireJudged(raw, KN_FEN, [], "w")).toBe(raw);
  });

  it("bots and hints rank the same way, and the moves that save the piece are all looked at", () => {
    const ranked = fireRanked(Object.entries(raw.expectedAfter).map(([move, expected]) => ({ move, expected })), KN_FEN, burn, "w");
    expect(ranked[0]!.move).toBe("f3e5");
    expect(fireEscapes(KN_FEN, burn).sort()).toEqual(legalMoves(KN_FEN).filter((m) => m.startsWith("f3")).sort());
  });

  it("in a match, the runner scores the escape as the best and the burn happens after the crowd's move", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: 2000, bossId: "gingerbread", lastStandFrom: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(2), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    // G-REX in Ginger's place, with a tile ablaze under the knight on f3.
    const fen = runner.boards.get(0)!.fen;
    runner.state = { ...runner.state, boss: { ...runner.state.boss!, id: "grex", powers: { ...initPowers(7, fen, "w"), turn: 1, nextPassive: 99, fire: [{ square: "f3", lit: -1 }] } } };
    expect(ablaze(runner.boss)).toEqual(["f3"]);
    runner.deal();
    const report = await runner.score(new Map([["h0", { move: "d2d3", thinkMs: 1000 }]]));
    const round = report.boards[0]!;
    expect(round.power).toBe(true);
    expect(round.bestMove.startsWith("f3")).toBe(true);
    // The knight was left: it burnt, and the board says so (a base where it changed).
    const board = runner.boards.get(0)!;
    expect(pieceAt(board.fen, "f3")).toBeNull();
    expect(board.bases).toEqual([{ ply: board.history.length, fen: board.fen }]);
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(runner.bossView()!.powers!.burnt).toEqual([{ turn: 1, square: "f3", piece: "n" }]);
    expect(runner.bossView()!.board.bases).toEqual(board.bases);
    // The game goes on from the changed position.
    await runner.playBoss();
    const after = runner.boards.get(0)!;
    expect(after.fen).toBe(applyMove(board.fen, after.lastMove!));
    expect(fenAtPly(after.history, after.history.length, after.bases)).toBe(after.fen);
    expect(boardEnd(after)).toBeNull();
    expect(recentMoves(after, 5).moves).toEqual([after.lastMove]);
  });
});

describe("a board whose position changed between moves", () => {
  it("replays, game ends and recent moves start from the change", () => {
    let board = newBoard(0, opening(RUY), RUY.length);
    board = playOnBoard(board, "d2d3", 0.5);
    board = burnOnBoard(board, "f3");
    board = playOnBoard(board, "d7d6", 0.5);
    expect(pieceAt(board.fen, "f3")).toBeNull();
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(fenAtPly(board.history, RUY.length, board.bases)).toBe(fenAfter(RUY));
    expect(recentMoves(board, 5)).toEqual({ from: board.bases![0]!.fen, moves: ["d7d6"] });
    expect(netBoard(board).bases).toEqual(board.bases);
    expect(netBoard(newBoard(0, opening(RUY), RUY.length)).bases).toBeUndefined();
  });
});

describe("solo's difficulty", () => {
  it("the boss plays at your strength plus its offset plus the difficulty, capped at the engine's strongest; the boss stays random", () => {
    const elo = (extra: number, base = 2000) => {
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, raidOpening: true, bossFixedElo: base, bossDifficulty: extra } as Settings;
      return new MatchRunner({ settings, rng: mulberry32(4), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] }).boss!;
    };
    // (Its own offset under the lobby's strength: whichever boss the draw met.)
    const offset = bossDef(elo(0).id)!.offset;
    expect(elo(0).elo).toBe(2000 + offset);
    expect(elo(-300).elo).toBe(1700 + offset);
    expect(elo(250).elo).toBe(2250 + offset);
    expect(elo(500, 3000).elo).toBe(3190);
    expect(elo(500).id).toBe(elo(-300).id);
  });
});
