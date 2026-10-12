import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossPowerSettings, type BossState, type Settings } from "@chessroyale/core";
import {
  MatchRunner,
  applyMove,
  blizzardFree,
  blizzardLength,
  blizzardNow,
  blizzardStep,
  crowdAllowed,
  icedSquares,
  inCheck,
  initPowers,
  legalMoves,
  pieceAt,
  powerTurn,
  prepareTurn,
  rageOf,
  ragePaused,
  sanLineToUci,
  strikeRage,
  triggerUltimate,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Ginger's blizzard, three turns and thawing (Eric, Oct 12: "1 unmelted piece turn 1, turn 2 about 4–5 pieces, then
 * all"): one crowd piece free as it comes, four or five free in all the turn after (the first still free, the pieces
 * named the turn before thawed, more if one was lost, those with a move first), every piece the turn after that; a
 * free piece always has a move (in check, one that answers it); everything from the seed; the meter empty throughout.
 */

/** The meter's rates these tests were written for (5 a crowd move, a queen's worth a full meter, speed 1). */
const S: BossPowerSettings = { ...BOSS_POWERS, ragePerMove: 5, rageAheadMax: 5, ragePerMaterial: 100 / 9, rageStrike: 25, rageSpeed: {} };

const RUY = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
const RUY_FEN = "r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 6 6";
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } });

const battle = (fen: string, seed: number): BossState => ({ id: "gingerbread", elo: 1500, crowdSide: "w", crowdMoves: 0, sinceKill: 0, kills: [], powers: initPowers(seed, fen, "w") });
const from = (m: string) => m.slice(0, 2);
/** The crowd's (White's) pieces, by square. */
const crowdPieces = (fen: string) => [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((sq) => pieceAt(fen, sq)?.color === "w");
const kinds = (b: BossState) => b.powers!.events.map((e) => e.kind);

/** Positions a game passes through from the Ruy Lopez (random play), White to move with a good few pieces. */
function starts(n: number, seed: number): string[] {
  const rng = mulberry32(seed);
  const out: string[] = [];
  let fen = RUY_FEN;
  for (let i = 0; out.length < n && i < 200; i++) {
    const legal = legalMoves(fen);
    if (!legal.length) break;
    if (fen.split(" ")[1] === "w" && crowdPieces(fen).length >= 7 && i % 3 === 0) out.push(fen);
    fen = applyMove(fen, legal[Math.floor(rng() * legal.length)]!);
  }
  return out;
}

interface Turn {
  b: BossState;
  fen: string;
  /** The crowd's move played on this turn (after it's set up). */
  move?: string;
}

/**
 * A blizzard played through from `fen` (White, the crowd, to move): the test trigger pulled on turn 1 brings it as turn
 * 2 begins. Each turn the crowd plays one of its allowed moves and the boss a legal move, both at random. The state
 * and the position as each crowd turn begins (turn 1 first), and the crowd's move on it.
 */
function play(fen: string, seed: number, turns = 6, s = S): Turn[] {
  const rng = mulberry32(seed * 7919 + 1);
  let b = prepareTurn(battle(fen, seed), fen, "", s);
  b = triggerUltimate(b).boss!;
  const out: Turn[] = [{ b, fen }];
  for (let t = 2; t <= turns; t++) {
    const allowed = crowdAllowed(b, fen) ?? legalMoves(fen);
    const move = allowed[Math.floor(rng() * allowed.length)]!;
    out[out.length - 1]!.move = move;
    fen = applyMove(fen, move);
    const reply = legalMoves(fen);
    if (!reply.length) break;
    fen = applyMove(fen, reply[Math.floor(rng() * reply.length)]!);
    if (!legalMoves(fen).length) break;
    b = prepareTurn({ ...b, crowdMoves: t - 1 }, fen, "", s);
    out.push({ b, fen });
  }
  return out;
}

describe("Ginger's blizzard: three turns, thawing", () => {
  it("as shipped: three turns, one piece free on the first, four or five on the second, every piece on the third", () => {
    expect(BOSS_POWERS.blizzardTurns).toBe(3);
    expect(BOSS_POWERS.blizzardFree).toEqual([
      [1, 1],
      [4, 5],
    ]);
    // One range for each turn but the last.
    expect(BOSS_POWERS.blizzardFree.length).toBe(BOSS_POWERS.blizzardTurns - 1);
    expect(blizzardLength({ blizzardTurns: 1 })).toBe(2);
    const counts = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      expect(blizzardFree(seed, 5, 0)).toBe(1);
      counts.add(blizzardFree(seed, 5, 1));
      expect(blizzardFree(seed, 5, 2)).toBe(Infinity);
    }
    expect([...counts].sort()).toEqual([4, 5]);
  });

  it("one piece free, then four or five in all (the first still free, the cracked ones thawed), then all; the meter empty throughout", () => {
    let games = 0;
    let checked = 0;
    for (const [i, start] of starts(10, 3).entries()) {
      for (let seed = 1; seed <= 12; seed++) {
        const g = play(start, seed + i * 100);
        if (g.length < 5) continue;
        games++;
        const [t2, t3, t4, t5] = [g[1]!, g[2]!, g[3]!, g[4]!];
        // Turn 2, as it comes: one piece free (named in its moment), every other crowd piece iced; three or four of
        // them named to thaw next turn, never the king.
        expect(kinds(t2.b)).toContain("blizzard");
        const first = t2.b.powers!.events.find((e) => e.kind === "blizzard")!.square!;
        const iced2 = icedSquares(t2.b, t2.fen);
        expect(iced2).toEqual(crowdPieces(t2.fen).filter((sq) => sq !== first));
        for (const m of crowdAllowed(t2.b, t2.fen)!) expect(from(m)).toBe(first);
        const n = blizzardFree(t2.b.powers!.seed, 2, 1);
        const due = t2.b.powers!.blizzard!.next!;
        const room = iced2.filter((sq) => pieceAt(t2.fen, sq)!.type !== "k").length;
        expect(due).toHaveLength(Math.min(n - 1, room));
        for (const sq of due) expect(pieceAt(t2.fen, sq)!.type).not.toBe("k");
        expect(rageOf(t2.b, S)).toBe(1);
        expect(powerTurn(t2.b)).toBe(true);
        // Turn 3: the first piece still free wherever it went, the cracked ones thawed (their moment names them),
        // n free in all unless the mercy rule freed one more; the rest named to thaw next turn.
        expect(kinds(t3.b)).toContain("thaw");
        const thawed = t3.b.powers!.events.find((e) => e.kind === "thaw")!.squares!;
        const iced3 = icedSquares(t3.b, t3.fen);
        const pieces3 = crowdPieces(t3.fen);
        const free3 = pieces3.filter((sq) => !iced3.includes(sq));
        // (Unless the boss took it.)
        if (pieceAt(t3.fen, t2.move!.slice(2, 4))?.color === "w") expect(free3).toContain(t2.move!.slice(2, 4));
        for (const sq of due) if (pieceAt(t3.fen, sq)?.color === "w") expect(thawed).toContain(sq);
        for (const sq of thawed) expect(free3).toContain(sq);
        const nonKing = pieces3.filter((sq) => pieceAt(t3.fen, sq)!.type !== "k").length;
        expect(free3.length).toBeGreaterThanOrEqual(Math.min(n, nonKing));
        expect(free3.length).toBeLessThanOrEqual(n + 1);
        expect(t3.b.powers!.blizzard?.next ?? []).toEqual(iced3);
        for (const m of crowdAllowed(t3.b, t3.fen) ?? legalMoves(t3.fen)) expect(iced3).not.toContain(from(m));
        expect(blizzardNow(t3.b)).toBe(iced3.length > 0);
        expect(rageOf(t3.b, S)).toBe(0);
        expect(ragePaused(t3.b)).toBe(true);
        expect(strikeRage(t3.b, S)).toBe(t3.b);
        // Turn 4, its last: the ice is gone, every piece moves; the meter still empty (no ultimate overlaps).
        expect(icedSquares(t4.b, t4.fen)).toEqual([]);
        expect(crowdAllowed(t4.b, t4.fen)).toBeNull();
        expect(t4.b.powers!.blizzard).toBeNull();
        const last = t4.b.powers!.events.find((e) => e.kind === "thaw")?.squares ?? [];
        expect(last).toEqual(iced3.filter((sq) => pieceAt(t4.fen, sq)?.color === "w"));
        expect(powerTurn(t4.b)).toBe(false);
        expect(t4.b.powers!.ultAt).toBe(2);
        expect(rageOf(t4.b, S)).toBe(0);
        expect(strikeRage(t4.b, S)).toBe(t4.b);
        expect(triggerUltimate(t4.b).ok).toBe(false);
        // Turn 5: it's over; the meter fills again from empty (nothing gathered during it is kept).
        expect(t5.b.powers!.ultAt).toBeUndefined();
        expect(rageOf(t5.b, S)).toBe(0);
        expect(triggerUltimate(t5.b).ok).toBe(true);
        if (g[5]) expect(rageOf(g[5].b, S)).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(games).toBeGreaterThan(80);
    expect(checked).toBe(games);
  });

  it("a free piece always has a legal move: the crowd's moves never fall back to every legal move, and never run out", () => {
    let turns = 0;
    for (const [i, start] of starts(12, 11).entries()) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const t of play(start, seed + i * 50).slice(1, 3)) {
          const iced = icedSquares(t.b, t.fen);
          const allowed = crowdAllowed(t.b, t.fen) ?? legalMoves(t.fen);
          expect(allowed.length).toBeGreaterThan(0);
          // (Had the ice been lifted, an iced piece's move would be among them.)
          for (const m of allowed) expect(iced).not.toContain(from(m));
          if (inCheck(t.fen)) for (const m of allowed) expect(legalMoves(t.fen)).toContain(m);
          turns++;
        }
      }
    }
    expect(turns).toBeGreaterThan(150);
  });

  it("the mercy rule in check: if no free piece can answer it, one that can thaws (never the king while another can)", () => {
    // White in check from the rook on e8. The pawn on h3 is the piece the blizzard freed (it moved there); none of the
    // pawns can answer the check; the knight (g1-e2) and the king (d1, f1) can.
    const fen = "4r1k1/8/8/8/8/7P/PPPP1PP1/4K1N1 w - - 0 1";
    expect(inCheck(fen)).toBe(true);
    const prev = ["a2", "b2", "c2", "d2", "e1", "f2", "g1", "g2"];
    for (let seed = 0; seed < 30; seed++) {
      const n = blizzardFree(seed, 2, 1);
      // The pawns named to thaw: n − 1 of them, with h3 that's n free, so nothing more thaws for the count.
      const due = ["a2", "b2", "c2", "d2"].slice(0, n - 1);
      const step = blizzardStep(fen, "w", seed, 2, 3, prev, due, BOSS_POWERS);
      expect(step.thawing).toEqual([...due, "g1"].sort());
      expect(step.iced).toContain("e1");
      // The crowd's moves: the knight's block, the one answer a free piece has.
      const b = battle(fen, seed);
      const state = { ...b, crowdMoves: 2, powers: { ...b.powers!, turn: 3, ultAt: 2, blizzard: { turn: 2, square: "h2", at: 3, iced: step.iced, next: step.next } } };
      expect(crowdAllowed(state, fen)).toEqual(["g1e2"]);
      // The knight among the pieces named to thaw (it can answer it): nothing more thaws.
      const named = ["g1", "a2", "b2", "c2"].slice(0, n - 1);
      expect(blizzardStep(fen, "w", seed, 2, 3, prev, named, BOSS_POWERS).thawing).toEqual([...named].sort());
    }
    // Only the king can answer it: the king thaws.
    const kingOnly = "4r1k1/8/8/8/8/7P/PPPP1PP1/4K3 w - - 0 1";
    for (let seed = 0; seed < 10; seed++) {
      const n = blizzardFree(seed, 2, 1);
      const step = blizzardStep(kingOnly, "w", seed, 2, 3, ["a2", "b2", "c2", "d2", "e1", "f2", "g2"], ["a2", "b2", "c2", "d2"].slice(0, n - 1), BOSS_POWERS);
      expect(step.thawing).toContain("e1");
      const b = battle(kingOnly, seed);
      const state = { ...b, crowdMoves: 2, powers: { ...b.powers!, turn: 3, ultAt: 2, blizzard: { turn: 2, square: "h2", at: 3, iced: step.iced, next: step.next } } };
      expect((crowdAllowed(state, kingOnly) ?? legalMoves(kingOnly)).every((m) => from(m) === "e1")).toBe(true);
    }
  });

  it("by the count, never the king, those with a move first; a free piece lost to the boss: another thaws in its place", () => {
    // White: king e1, knight b1, rook h1, pawns c2 d2, and pawns a2 h2 blocked by Black's on a3 h3 (no move).
    const fen = "4k3/8/8/8/8/p6p/P1PP3P/1N2K2R w - - 0 1";
    expect(legalMoves(fen).some((m) => m.startsWith("a2") || m.startsWith("h2"))).toBe(false);
    for (let seed = 0; seed < 40; seed++) {
      const n = blizzardFree(seed, 2, 1);
      // As it comes: the knight free; the n − 1 named to thaw are the pieces with a move first (never the king).
      const first = blizzardStep(fen, "w", seed, 2, 2, ["a2", "c2", "d2", "e1", "h1", "h2"], [], BOSS_POWERS);
      expect(first.thawing).toEqual([]);
      expect(first.next).toHaveLength(n - 1);
      expect(first.next).toEqual(expect.arrayContaining(["c2", "d2", "h1"]));
      expect(first.next).not.toContain("e1");
      // The knight was taken: one more thaws (n free in all), still not the king.
      const lost = fen.replace("1N2K2R", "4K2R");
      const next = blizzardStep(lost, "w", seed, 2, 3, first.iced, first.next, BOSS_POWERS);
      expect(next.thawing).toHaveLength(n);
      expect(next.iced).toContain("e1");
      expect(crowdPieces(lost).length - next.iced.length).toBe(n);
      // Everything left thaws next turn.
      expect(next.next).toEqual(next.iced);
    }
  });

  it("is the same from the same seed and position (every device works out the same thaw); another seed may not be", () => {
    const thaws = new Set<string>();
    for (const start of starts(4, 5)) {
      for (let seed = 1; seed <= 8; seed++) {
        const a = play(start, seed);
        const b = play(start, seed);
        expect(b.map((t) => t.b.powers)).toEqual(a.map((t) => t.b.powers));
        if (a[1]) thaws.add(JSON.stringify(a[1].b.powers!.blizzard?.next));
      }
    }
    expect(thaws.size).toBeGreaterThan(10);
  });

  it("the freeze waits until the blizzard is over", () => {
    let freezes = 0;
    for (const [i, start] of starts(6, 21).entries()) {
      for (let seed = 1; seed <= 6; seed++) {
        const g = play(start, seed + i * 10, 7);
        if (g.length < 6) continue;
        // (The freeze was due on turn 2: the blizzard came then.)
        for (const t of g.slice(1, 4)) expect(kinds(t.b)).not.toContain("freeze");
        if (kinds(g[4]!.b).includes("freeze")) freezes++;
      }
    }
    expect(freezes).toBeGreaterThan(10);
  });

  it("two turns: the first with its ice, the second with every piece free", () => {
    const two = { ...S, blizzardTurns: 2 };
    const g = play(RUY_FEN, 4, 5, two);
    expect(g[1]!.b.powers!.blizzard!.next).toEqual(g[1]!.b.powers!.blizzard!.iced);
    expect(icedSquares(g[2]!.b, g[2]!.fen)).toEqual([]);
    expect(kinds(g[2]!.b)).toContain("thaw");
    expect(g[3]!.b.powers!.ultAt).toBeUndefined();
  });
});

describe("Ginger's blizzard in a match (solo, and the host)", () => {
  /** A stand-in engine: each move's score is a hash of the position and the move. */
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

  it("the ice stays on through the boss's turn; the thaw's turn is scored by the free pieces' moves only; the last turn as usual", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "gingerbread", bossPowerTest: "blizzard", lastStandFrom: 999 } as Settings;
    const runner = new MatchRunner({ settings, rng: mulberry32(3), engines: [fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    const turn = async (pick?: (allowed: string[], fen: string) => string) => {
      runner.deal();
      const fen = runner.boards.get(0)!.fen;
      const allowed = runner.crowdAllowed() ?? legalMoves(fen);
      const report = await runner.score(new Map([["h0", { move: pick ? pick(allowed, fen) : allowed[0]!, thinkMs: 1000 }]]));
      return report.boards[0]!;
    };
    await turn();
    await runner.playBoss();
    await turn();
    await runner.playBoss();
    // Turn 3: the blizzard.
    expect(blizzardNow(runner.boss)).toBe(true);
    const iced3 = runner.bossView()!.powers!.iced;
    const due = runner.bossView()!.powers!.thaw!;
    expect(due.length).toBeGreaterThanOrEqual(3);
    await turn();
    // The boss's turn: the ice still shows (on every screen), the cracked ones too.
    expect(runner.bossToMove()).toBe(true);
    expect(runner.bossView()!.powers!.iced).toEqual(iced3);
    expect(runner.bossView()!.powers!.thaw).toEqual(due);
    await runner.playBoss();
    // Turn 4: the thaw. Its moment names the pieces freed; only free pieces move; a move of an iced one counts as none;
    // the turn doesn't count for fair play.
    const view = runner.bossView()!.powers!;
    expect(view.events.map((e) => e.kind)).toEqual(["thaw"]);
    for (const sq of due) if (pieceAt(runner.boards.get(0)!.fen, sq)?.color === "w") expect(view.events[0]!.squares).toContain(sq);
    const fen4 = runner.boards.get(0)!.fen;
    const icedMove = legalMoves(fen4).find((m) => view.iced.includes(from(m)));
    expect(view.thaw).toEqual(view.iced);
    if (icedMove) {
      runner.deal();
      const report = await runner.score(new Map([["h0", { move: icedMove, thinkMs: 1000 }]]));
      expect(report.boards[0]!.result.players[0]!.move).toBeNull();
      expect(view.iced).not.toContain(from(report.boards[0]!.bestMove));
      expect(report.boards[0]!.power).toBe(true);
    } else {
      const b = await turn();
      expect(b.power).toBe(true);
    }
    await runner.playBoss();
    // Turn 5, its last: the rest thaw; every move allowed; it counts for fair play again.
    expect(runner.bossView()!.powers!.iced).toEqual([]);
    expect(runner.crowdAllowed()).toBeNull();
    expect(runner.bossView()!.powers!.paused).toBe(true);
    const b5 = await turn();
    expect(b5.power).toBeFalsy();
  });
});
