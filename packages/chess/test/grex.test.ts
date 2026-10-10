import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, bossDef, mulberry32, type BossPowerSettings, type BossState, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  ablaze,
  applyMove,
  blizzardNow,
  boardEnd,
  burnOnBoard,
  burnOutcome,
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
  fireShadows,
  shadowStage,
  funhouseDue,
  initPowers,
  legalMoves,
  newBoard,
  netBoard,
  pieceAt,
  playOnBoard,
  powerTurn,
  prepareTurn,
  rageOf,
  ragePoints,
  rageTick,
  recentMoves,
  sanLineToUci,
  triggerUltimate,
  withoutPiece,
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

describe("the ultimate's meter", () => {
  it("fills a little each crowd move, faster while the crowd is ahead on the judged eval; the switch turns that off", () => {
    expect(rageTick(undefined)).toBe(BOSS_POWERS.ragePerMove);
    expect(rageTick(0.5)).toBe(5);
    expect(rageTick(0.3)).toBe(5);
    expect(rageTick(0.625)).toBeCloseTo(7.5);
    expect(rageTick(0.75)).toBe(10);
    expect(rageTick(0.95)).toBe(10);
    expect(rageTick(0.75, { ...BOSS_POWERS, rageOverTime: false })).toBe(0);
    // Material still counts in full: a queen's worth fills it alone.
    expect(ragePoints({ charge: 0, lost: 9 })).toBeCloseTo(BOSS_POWERS.rageFull);
  });

  it("on its own, it's full after 20 crowd moves (the warning as turn 21 begins, the ultimate on 22), once a match", () => {
    const seen = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 40);
    expect(rageOf(seen[0]!)).toBe(0);
    expect(rageOf(seen[9]!)).toBeCloseTo(0.45);
    const warn = seen.findIndex((b) => kinds(b).includes("warn")) + 1;
    expect(warn).toBe(21);
    expect(kinds(seen[21]!)).toContain("blizzard");
    expect(seen.filter((b) => kinds(b).includes("blizzard")).length).toBe(1);
    expect(rageOf(seen[30]!)).toBeNull();
  });

  it("with the crowd well ahead it's full twice as fast; losing material fills it faster still", () => {
    const ahead = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 20, 0.8);
    expect(ahead.findIndex((b) => kinds(b).includes("warn")) + 1).toBe(11);
    // A rook down (5 of 9) from the start: 55 points, then 5 a move: full after 9 moves.
    const rookDown = RUY_FEN.replace("r1bqk2r", "r1bqk3");
    const lost = turns(battle("gingerbread", RUY_FEN), rookDown, 20);
    expect(lost.findIndex((b) => kinds(b).includes("warn")) + 1).toBe(10);
  });

  it("with the switch off, only material fills it", () => {
    const off = { ...BOSS_POWERS, rageOverTime: false };
    const seen = turns(battle("gingerbread", RUY_FEN), RUY_FEN, 45, 0.9, off);
    expect(seen.some((b) => kinds(b).includes("warn"))).toBe(false);
    expect(rageOf(seen[44]!, off)).toBe(0);
  });
});

describe("the test trigger", () => {
  it("brings the ultimate as the next turn begins, without the warning; once; never after it's spent or the battle's over", () => {
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
    // Spent: nothing more.
    expect(triggerUltimate(b).ok).toBe(false);
    b = prepareTurn({ ...b, crowdMoves: 2 }, RUY_FEN);
    expect(triggerUltimate(b).ok).toBe(false);
    expect(triggerUltimate({ ...battle("clown", RUY_FEN), result: "crowd" }).ok).toBe(false);
    expect(triggerUltimate({ ...battle("clown", RUY_FEN), powers: undefined }).ok).toBe(false);
    expect(triggerUltimate(null).ok).toBe(false);
  });

  it("during the warning turn it changes nothing: the ultimate comes the next turn, once", () => {
    const down = RUY_FEN.replace("r1bqk2r", "r1b1k2r");
    let b = prepareTurn(battle("clown", RUY_FEN), RUY_FEN);
    b = prepareTurn({ ...b, crowdMoves: 1 }, down);
    expect(kinds(b)).toContain("warn");
    b = triggerUltimate(b).boss!;
    b = prepareTurn({ ...b, crowdMoves: 2 }, down);
    expect(funhouseDue(b)).toBe(true);
    expect(b.powers!.ultAt).toBe(3);
  });

  it("in a match: pressed mid-turn it waits for the turn's end, for Ginger and Boingo; after the end it does nothing", async () => {
    for (const id of ["gingerbread", "clown"] as const) {
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: id, lastStandLoss: 999, lastStandLossFloor: 999, bossMaxMoves: 4 } as Settings;
      const runner = new MatchRunner({ settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
      runner.deal();
      const before = runner.crowdAllowed();
      expect(runner.triggerUltimate()).toBe(true);
      expect(runner.crowdAllowed()).toEqual(before);
      expect(runner.funhouseDue()).toBe(false);
      await runner.score(new Map([["h0", { move: legalMoves(runner.boards.get(0)!.fen)[0]!, thinkMs: 1000 }]]));
      // While the boss is to move: still nothing; pressing again changes nothing.
      expect(runner.triggerUltimate()).toBe(true);
      await runner.playBoss();
      if (id === "gingerbread") expect(blizzardNow(runner.boss)).toBe(true);
      else expect(runner.funhouseDue()).toBe(true);
      expect(runner.bossView()!.powers!.events.some((e) => e.kind === "warn")).toBe(false);
      expect(runner.triggerUltimate()).toBe(false);
      // Play it out to the end; the trigger never does anything again, and the board is never left without a move.
      for (let i = 0; i < 8 && !runner.stageComplete(); i++) {
        if (runner.funhouseDue()) await runner.playFunhouse();
        if (runner.bossToMove()) await runner.playBoss();
        if (runner.stageComplete()) break;
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

  it("3 crowd moves after the launch they fall a wave a turn, each a stage-1 fire tile, never on the king, spread out", () => {
    const states = barrage(18);
    const b2 = states.get(2)!;
    expect(kinds(b2)).toEqual(["candle"]);
    expect(b2.powers!.candle).toMatchObject({ at: 2, left: 24 });
    const waves: number[] = [];
    const sparks: number[] = [];
    for (let t = 3; t <= 18; t++) {
      const b = states.get(t)!;
      const wave = b.powers!.events.find((e) => e.kind === "fireball");
      waves.push(wave ? wave.squares!.length : 0);
      if (kinds(b).includes("spark")) sparks.push(t);
      for (const sq of wave?.squares ?? []) {
        expect(Number(sq[1])).toBeLessThanOrEqual(4);
        expect(pieceAt(RUY_FEN, sq)?.type === "k" && pieceAt(RUY_FEN, sq)?.color === "w").toBe(false);
        expect(b.powers!.fire!.find((x) => x.square === sq)!.lit).toBe(t);
      }
      // No two tiles on one square; within a wave, none next to another.
      const squares = (b.powers!.fire ?? []).map((x) => x.square);
      expect(new Set(squares).size).toBe(squares.length);
      for (const a of wave?.squares ?? []) for (const c of wave!.squares!) if (a !== c) expect(Math.max(Math.abs(a.charCodeAt(0) - c.charCodeAt(0)), Math.abs(Number(a[1]) - Number(c[1])))).toBeGreaterThanOrEqual(2);
    }
    // Fired as turn 2 began: none as the 3rd and 4th begin; then 1, 2, 3, 4, 4, 4, 3, 2, 1 from the 5th.
    expect(waves.slice(0, 11)).toEqual([0, 0, 1, 2, 3, 4, 4, 4, 3, 2, 1]);
    expect(waves.reduce((x, y) => x + y, 0)).toBe(24);
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
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "gingerbread", lastStandLoss: 999, lastStandLossFloor: 999 } as Settings;
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
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: base, bossDifficulty: extra } as Settings;
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
