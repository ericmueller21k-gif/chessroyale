import { describe, expect, it } from "vitest";
import { gridOf } from "../src/bosses/grid.ts";
import { editedFen } from "../src/bosses/alfil.ts";
import { nodeTransport } from "../src/node.ts";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type CarrotPatch, type CarrotPull, type Settings } from "@chessroyale/core";
import {
  CARROT_TEST_MOVES,
  DEFAULT_BOSS_GUARD,
  HOPPER_FX,
  MatchRunner,
  POWER_FX,
  applyMove,
  bossRules,
  carrotSpots,
  carrotsOf,
  carrotsOpen,
  countOdds,
  fenAtPly,
  gameEndWith,
  hisChances,
  hopOptions,
  jobOffers,
  judgeBotPicks,
  judgedBoard,
  kingAttacked,
  legalMoves,
  pieceAt,
  placePrize,
  plantCarrots,
  powerTurn,
  prizeFits,
  prizeSquares,
  prizeWorth,
  pullsOf,
  queenSlain,
  raceAdjust,
  raceGuard,
  raceJudged,
  raceOutlook,
  racePulls,
  raceRanked,
  raceWeight,
  raceWorth,
  rageOf,
  reachMap,
  runQuickJob,
  sideToMove,
  spinRoll,
  stockfishRefuses,
  triggerUltimate,
  type CarrotRace,
  type EngineLike,
  type JudgeJob,
  type MoveScore,
  type NetBoss,
  type Opening,
} from "../src/index.ts";

/**
 * Chub & Chirp's ultimate, the Carrot Patch (Eric's sheet, Oct 18; docs/decisions/2026-10-18-carrot-patch.md): the cast
 * (his whole turn), the placement's math, the race's pulls and end, his spin and prize, his race brain and the crowd's
 * judge, and how it sits with the other rules (the God King's strike and Last Stand, Leapfrog, QUEEN SLAIN!, fair play).
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
/** A stand-in engine: every legal move scored by a hash (or `score`), best first; the boss plays a hashed legal move. */
function fakeEngine(score: (fen: string, m: string) => number = (fen, m) => 0.3 + 0.4 * hash(fen + m)): EngineLike {
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen) => {
      const l = legalMoves(fen).sort();
      return l[Math.floor(hash(fen) * l.length)]!;
    },
  };
}
const RUY = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7", "f1e1", "b7b5"];
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });
/** His strength in these battles: no slips (bossStumbleBelow 0), so his race brain looks at every ordinary move. */
const SETTINGS = (patch: Partial<Settings> = {}) => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossStumbleBelow: 0, bossId: "hopper", lastStandFrom: 999, ...patch }) as Settings;

/** A Boss alone against him (met as the test link does: his art isn't built yet). */
function raid(o: { patch?: Partial<Settings>; seed?: number; engine?: EngineLike; side?: "w" | "b" } = {}) {
  return new MatchRunner({ settings: SETTINGS(o.patch), rng: mulberry32(o.seed ?? 5), engines: [o.engine ?? fakeEngine()], library: [opening(RUY)], entrants: [{ id: "h0", name: "H", isBot: false }], ...(o.side ? { raidSide: o.side } : {}) });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** A battle from a position of our own (the crowd to move: a base on the board at its ply). */
function from(fen: string, o: Parameters<typeof raid>[0] = {}) {
  const r = raid(o);
  const board = r.boards.get(0)!;
  r.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
  return r;
}
/** A battle from a position with the race on: these carrots, those already pulled, the race's moves so far. */
function racing(fen: string, squares: string[], o: Parameters<typeof raid>[0] & { his?: string[]; crowd?: string[]; crowdMoves?: number; bossMoves?: number } = {}) {
  const r = from(fen, o);
  const p = r.state.boss!.powers!;
  const pulls: CarrotPull[] = [...(o.his ?? []).map((square) => ({ square, by: "boss" as const, at: 0 })), ...(o.crowd ?? []).map((square) => ({ square, by: "crowd" as const, at: 0 }))];
  const carrots: CarrotPatch = { at: 0, squares, pulls, crowdMoves: o.crowdMoves ?? 0, bossMoves: o.bossMoves ?? 0 };
  r.state = { ...r.state, boss: { ...r.state.boss!, powers: { ...p, ultAt: 0, ults: 1, carrots } } };
  return r;
}
/** Your move (or the first allowed), as the crowd's pick. */
async function crowd(r: MatchRunner, move?: string) {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
  await r.score(new Map([["h0", { move: move ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
}
/** No position a power leaves may be one the engine refuses, or one where the side not to move is in check. */
const sound = (fen: string) => {
  expect(stockfishRefuses(fen)).toBeNull();
  expect(kingAttacked(fen, sideToMove(fen) === "w" ? "b" : "w")).toBe(false);
};
const carrots = (r: MatchRunner) => r.boss!.powers!.carrots!;
/** Stockfish's own legal moves in a position (`go perft 1`, the game's engine): what it plays from it, sorted. */
async function stockfishMoves(fen: string): Promise<string[]> {
  const t = nodeTransport();
  const moves: string[] = [];
  const done = new Promise<void>((resolve) =>
    t.onLine((l) => {
      if (/^[a-h][1-8][a-h][1-8][qrbn]?:/.test(l)) moves.push(l.split(":")[0]!);
      else if (l.startsWith("Nodes searched")) resolve();
    }),
  );
  t.send("uci");
  t.send(`position fen ${fen}`);
  t.send("go perft 1");
  await done;
  t.close();
  return moves.sort();
}
/** Your rook on b1 and his knight on d6 each one move from b5; the kings far off (h1, e8). */
const RACE_FEN = "4k3/8/3n4/8/8/8/8/1R5K w - - 0 30";
const touching = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1]))) <= 1;

describe("the Carrot Patch: its trigger, once a battle", () => {
  it("the usual meter and warning: the warning as a crowd turn begins, the cast at the start of his turn after it; the test switch warns as the first turn begins", async () => {
    const r = raid({ patch: { bossPowerTest: "carrotpatch" } });
    expect(bossRules(r.boss)?.ultimateOnHisTurn).toBe(true);
    // (The test switch's position: 1.e4 e5 2.Nf3 Nc6, your move.)
    expect(r.boards.get(0)!.history).toEqual(CARROT_TEST_MOVES.w);
    expect(r.boss!.powers!.warnAt).toBe(1);
    expect(r.boss!.powers!.events.map((e) => e.kind)).toContain("warn");
    expect(r.carrotDue()).toBe(false);
    await crowd(r, "d2d4");
    expect(r.bossToMove()).toBe(true);
    expect(r.carrotDue()).toBe(true);
    // (The cast is his whole turn: no hop before it.)
    expect(r.hopDue()).toBe(false);
    // Without the switch, nothing comes before the meter fills (no warning on the first turns).
    const plain = raid();
    expect(plain.boss!.powers!.warnAt).toBeUndefined();
    await crowd(plain);
    expect(plain.carrotDue()).toBe(false);
  });

  it("only Chub & Chirp's ultimate is once a battle", () => {
    expect(BOSS_ROSTER.filter((d) => bossRules({ id: d.id })?.ultimateOnce).map((d) => d.id)).toEqual(["hopper"]);
  });

  it("the admins' trigger: the cast at the start of his next turn, without the warning; once it's come, the trigger refuses and the meter is off", async () => {
    const r = raid();
    expect(r.triggerUltimate()).toBe(true);
    await crowd(r);
    expect(r.carrotDue()).toBe(true);
    expect(r.boss!.powers!.warnAt).toBeUndefined();
    expect(r.applyCarrots()).not.toBeNull();
    const p = r.boss!.powers!;
    expect(p.ultNext).toBeUndefined();
    expect(p.ults).toBe(1);
    expect(rageOf(r.boss)).toBeNull();
    expect(r.triggerUltimate()).toBe(false);
    expect(triggerUltimate(r.boss).ok).toBe(false);
    // Never again: the meter stays off and nothing gathers for the rest of the battle.
    for (let t = 0; t < 6 && !r.stageComplete(); t++) {
      await crowd(r);
      if (r.stageComplete()) break;
      expect(r.carrotDue()).toBe(false);
      if (r.hopDue()) await r.playHop();
      if (r.bossToMove()) await r.playBoss();
      expect(rageOf(r.boss)).toBeNull();
      expect(r.boss!.powers!.ults).toBe(1);
    }
  });

  it("the cast is his whole turn, as Alfil's fusion: the turn passes (en passant cleared, the fifty-move count kept, the move number on), a base at its ply, no move added, its moment as your turn begins", async () => {
    // (Black boss to move after your d2-d4 past nothing: an en passant square only as a pawn of his could take.)
    const r = from("4k3/8/8/8/2p5/8/3P4/4K3 w - - 7 30", { patch: { bossPowerTest: "carrotpatch" } });
    await crowd(r, "d2d4");
    const before = fenOf(r);
    expect(before.split(" ")[3]).toBe("d3");
    const plies = r.boards.get(0)!.history.length;
    const patch = r.applyCarrots()!;
    const board = r.boards.get(0)!;
    const after = board.fen;
    expect(after.split(" ")).toEqual([before.split(" ")[0], "w", "-", "-", "0", "31"]);
    expect(board.history).toHaveLength(plies);
    expect(board.bases).toContainEqual({ ply: plies, fen: after });
    expect(fenAtPly(board.history, plies, board.bases)).toBe(after);
    expect(gameEndWith(board.history, board.bases)).toBeNull();
    expect(board.lastMove).toBeNull();
    expect(r.bossToMove()).toBe(false);
    sound(after);
    // The crowd's turn is set up as after his move: the cast's moment with it.
    const p = r.boss!.powers!;
    expect(p.carrots).toEqual(patch);
    expect(p.events.find((e) => e.kind === "carrots")).toEqual({ kind: "carrots", turn: p.turn, squares: patch.squares });
    expect(p.turn).toBe(r.boss!.crowdMoves + 1);
    expect(r.bossView()!.lastMove).toBeNull();
    expect(POWER_FX.carrots).toBe(HOPPER_FX.carrots);
    // (The fifty-move count kept, from above 0: your king move makes it 8, and the cast leaves it 8.)
    const quiet = from("4k3/8/8/8/2p5/8/3P4/4K3 w - - 7 30", { patch: { bossPowerTest: "carrotpatch" } });
    await crowd(quiet, "e1f1");
    expect(fenOf(quiet).split(" ")[4]).toBe("8");
    quiet.applyCarrots();
    expect(fenOf(quiet).split(" ").slice(4)).toEqual(["8", "31"]);
  });

  it("in check as his turn begins, it waits (he answers the check with his move); the warning stays, and it comes at the start of his next turn", async () => {
    const r = from("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", { patch: { bossPowerTest: "carrotpatch" } });
    await crowd(r, "a1a8");
    expect(r.bossToMove()).toBe(true);
    expect(r.carrotDue()).toBe(false);
    expect(r.applyCarrots()).toBeNull();
    await r.playBoss();
    expect(r.boss!.powers!.warnAt).toBe(1);
    expect(r.boss!.powers!.carrots).toBeUndefined();
    await crowd(r, legalMoves(fenOf(r)).find((m) => m.startsWith("e1"))!);
    expect(r.carrotDue()).toBe(!kingAttacked(fenOf(r), "b"));
  });
});

describe("the Carrot Patch: where the carrots go (the math)", () => {
  it("each side's fewest moves to end a move on a square, with blockers as they stand: a pawn straight on to an empty square only, diagonally only onto a piece", () => {
    // (White: a pawn on e2, a rook on a1 behind its own pawn on a2, a king tucked away on h1. Black: a knight on d3.)
    const g = gridOf("7k/8/8/8/8/3n4/P3P3/R6K w - - 0 1");
    const w = reachMap(g, "w", 12);
    const at = (sq: string) => w[sq.charCodeAt(0) - 97 + (Number(sq[1]) - 1) * 8]!;
    expect(at("e3")).toBe(1);
    expect(at("e4")).toBe(1);
    expect(at("e5")).toBe(2);
    // (The pawn takes the knight on d3: a capture onto a piece. f3 is empty: no pawn of White's gets there in one.)
    expect(at("d3")).toBe(1);
    expect(at("f3")).toBeGreaterThan(1);
    // (The rook can't pass its own pawn: a3 is the pawn's, a4 too; the rook gets along the first rank.)
    expect(at("b1")).toBe(1);
    expect(at("a3")).toBe(1);
    expect(at("d1")).toBe(1);
    // Nothing reaches a square further than the moves allowed.
    expect(reachMap(g, "w", 1).filter((d) => d === 2)).toEqual([]);
  });

  it("five empty squares, at least one on each half, no two touching; the same position and seed always the same, another seed may differ", () => {
    const seen = new Set<string>();
    let fen = applyMove(applyMove(applyMove(applyMove(applyMove(applyMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4"), "e7e5"), "g1f3"), "b8c6"), "f1c4"), "g8f6");
    for (let i = 0; i < 30; i++) {
      for (const seed of [1, 2, 3]) {
        const crowd = sideToMove(fen);
        const squares = plantCarrots(fen, crowd, seed, i);
        expect(squares).toHaveLength(BOSS_POWERS.carrotCount);
        const g = gridOf(fen);
        for (const sq of squares) expect(g.has(sq)).toBe(false);
        expect(new Set(squares).size).toBe(squares.length);
        for (const a of squares) for (const b of squares) if (a !== b) expect(touching(a, b), `${a} ${b}`).toBe(false);
        expect(squares.some((sq) => Number(sq[1]) <= 4)).toBe(true);
        expect(squares.some((sq) => Number(sq[1]) >= 5)).toBe(true);
        expect(plantCarrots(fen, crowd, seed, i)).toEqual(squares);
        seen.add(squares.join());
      }
      const moves = legalMoves(fen);
      fen = applyMove(fen, moves[Math.floor(hash(fen) * moves.length)]!);
      if (!legalMoves(fen).length) break;
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it("aims each carrot at a lead (the crowd's fewest moves there less his; the crowd moves first, so a tie is the crowd's): carrotLeads, nearer first", () => {
    const fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5";
    const spots = carrotSpots(fen, "w");
    const squares = plantCarrots(fen, "w", 7, 8);
    const leads = squares.map((sq) => spots.find((x) => x.square === sq)!.lead);
    // (Each nearest its aim the board allows: here exactly, but for the first: no square within reach gives him a lead of
    // 3, so the nearest, 2.)
    expect(BOSS_POWERS.carrotLeads).toEqual([3, 1, 0, 0, -2]);
    expect(spots.some((x) => x.lead === 3 && Math.min(x.his, x.crowd) <= BOSS_POWERS.carrotReach)).toBe(false);
    expect(leads).toEqual([2, 1, 0, 0, -2]);
    for (const sq of squares) {
      const x = spots.find((y) => y.square === sq)!;
      expect(Math.min(x.his, x.crowd)).toBeLessThanOrEqual(BOSS_POWERS.carrotReach);
    }
  });

  it("all on one half by the aims: the cheapest one swaps to the other half", () => {
    // (A board where his pieces are all on his half: his leads come from there.)
    const fen = "r3k2r/pppppppp/8/8/8/8/8/4K3 w - - 0 30";
    const squares = plantCarrots(fen, "w", 3, 1, { ...BOSS_POWERS, carrotLeads: [3, 3, 3, 3, 3] });
    expect(squares.some((sq) => Number(sq[1]) <= 4)).toBe(true);
    expect(squares.some((sq) => Number(sq[1]) >= 5)).toBe(true);
  });
});

describe("the Carrot Patch: the race", () => {
  /** Pieces near a5 and h5 (Black's king on e8, White's rook on a1 and king on e1). */
  const ROOK = "4k3/8/8/8/8/8/8/R3K3 w - - 0 30";

  it("a piece pulls a carrot by ending its move on it: the crowd's (its event with this turn's), claimed for good; a piece passing over it pulls nothing", async () => {
    const r = racing(ROOK, ["a5", "a3", "h5", "e5", "c8"]);
    await crowd(r, "a1a5");
    const c = carrots(r);
    expect(c.pulls).toEqual([{ square: "a5", by: "crowd", at: 1 }]);
    expect(c.crowdMoves).toBe(1);
    expect(carrotsOf(c, "crowd")).toBe(1);
    expect(carrotsOpen(c)).toEqual(["a3", "h5", "e5", "c8"]);
    expect(r.boss!.powers!.events.at(-1)).toEqual({ kind: "carrot", turn: r.boss!.powers!.turn, square: "a5", by: "crowd" });
    // (The rook went over a3: still in the ground.)
    expect(carrotsOpen(c)).toContain("a3");
    // His move onto one: his, its event as your turn begins.
    r.applyBossMove("e8e7");
    expect(carrots(r).bossMoves).toBe(1);
    await crowd(r, "a5a4");
    r.applyBossMove("e7e6");
    await crowd(r, "a4a3");
    expect(carrots(r).pulls.at(-1)).toEqual({ square: "a3", by: "crowd", at: 3 });
    r.applyBossMove("e6e5");
    expect(carrots(r).pulls.at(-1)).toEqual({ square: "e5", by: "boss", at: 3 });
    expect(r.boss!.powers!.events).toContainEqual({ kind: "carrot", turn: 4, square: "e5", by: "boss" });
    // A pulled carrot stays pulled: moving off it changes nothing.
    await crowd(r, "e1d2");
    r.applyBossMove("e5f5");
    expect(carrotsOf(carrots(r), "boss")).toBe(1);
    expect(carrotsOpen(carrots(r))).toEqual(["h5", "c8"]);
  });

  it("a capture onto a carrot counts (en passant: the pawn ends there), and so does a castling rook landing on one", async () => {
    // (His d7-d5 just past your e5 pawn: e5xd6 en passant ends on the carrot.)
    const ep = racing("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 30", ["d6", "a1", "h8", "a8", "h2"]);
    expect(racePulls(fenOf(ep), { boss: "b", open: ["d6"], his: 0, crowdLeft: 12, bossLeft: 12 })).toEqual(["e5d6"]);
    await crowd(ep, "e5d6");
    expect(carrots(ep).pulls).toEqual([{ square: "d6", by: "crowd", at: 1 }]);
    const castle = racing("4k3/8/8/8/8/8/8/4K2R w K - 0 30", ["f1", "a8", "c5", "h6", "a3"]);
    expect(pullsOf(fenOf(castle), "e1g1", ["f1"])).toEqual(["f1"]);
    await crowd(castle, "e1g1");
    expect(carrots(castle).pulls).toEqual([{ square: "f1", by: "crowd", at: 1 }]);
  });

  it("his Leapfrog hop landing on one pulls it for him (its event just before the hop's, so the hop's screen stays its own); the hop counts toward his two as ever", async () => {
    const r = racing("4k3/8/8/4p3/4P3/8/8/K7 w - - 0 30", ["e3", "a5", "h5", "c8", "h1"]);
    await crowd(r, "a1b1");
    expect(r.hopDue()).toBe(true);
    const hop = r.applyHop(null)!;
    expect(hop.to).toBe("e3");
    expect(carrots(r).pulls).toEqual([{ square: "e3", by: "boss", at: 1, hop: true }]);
    const events = r.boss!.powers!.events;
    expect(events.slice(-2).map((e) => e.kind)).toEqual(["carrot", "hop"]);
    expect(r.boss!.powers!.hops).toBe(1);
    // (Not a move: his race moves don't change until his move.)
    expect(carrots(r).bossMoves).toBe(0);
    await r.playBoss();
    expect(carrots(r).bossMoves).toBe(1);
  });

  it("never a hop that wins the battle by his last carrot, nor one that sets up his move to pull it when it couldn't before (nothing decisive the crowd can't answer)", () => {
    const fen = "4k3/8/8/4p3/4P3/8/8/K7 b - - 0 30";
    expect(hopOptions(fen, "b", { open: ["e3"], his: 4 }).refused).toEqual([{ from: "e5", why: "carrots" }]);
    expect(hopOptions(fen, "b", { open: ["e3"], his: 3 }).options.map((o) => o.to)).toEqual(["e3"]);
    // (His 4th by the hop, and his king could then step onto the last one (d7 from e8): refused. Without the hop, his move
    // couldn't pull it: d7 is his king's in one either way, so the test is the 4th.)
    expect(hopOptions(fen, "b", { open: ["e3", "d7"], his: 3 }).refused).toEqual([{ from: "e5", why: "carrots" }]);
    // (His 5th within his move's reach already: the hop didn't make it.)
    expect(hopOptions(fen, "b", { open: ["d7", "a2"], his: 4 }).options.map((o) => o.to)).toEqual(["e3"]);
    // (No race: as ever.)
    expect(hopOptions(fen, "b").options.map((o) => o.to)).toEqual(["e3"]);
  });

  it("ends when all are pulled (no spin before his move; then his spin), or after his 12th move once the crowd has had its 12", async () => {
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"], { his: ["c3", "e6"], crowd: ["h5", "g2"] });
    await crowd(r, "a1a5");
    expect(carrots(r).over).toBe("pulled");
    expect(carrots(r).spin).toBeUndefined();
    r.applyBossMove("e8d7");
    const spin = carrots(r).spin!;
    expect(spin).toMatchObject({ at: 1, tier: 2 });
    expect(r.boss!.powers!.events.find((e) => e.kind === "carrotSpin")).toEqual({ kind: "carrotSpin", turn: 2, tier: 2, prize: spin.prize, squares: spin.squares });
    // By moves: still on after 11 each; over after the crowd's 12th, then his 12th.
    const m = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"], { crowdMoves: 10, bossMoves: 10 });
    await crowd(m, "e1e2");
    m.applyBossMove("e8d8");
    expect(carrots(m)).toMatchObject({ crowdMoves: 11, bossMoves: 11 });
    expect(carrots(m).over).toBeUndefined();
    await crowd(m, "e2d1");
    expect(carrots(m).crowdMoves).toBe(12);
    expect(carrots(m).over).toBeUndefined();
    m.applyBossMove("d8e8");
    expect(carrots(m).over).toBe("moves");
    expect(carrots(m).spin).toMatchObject({ tier: 0, rolled: [], prize: [], squares: [] });
    // (Unpulled carrots count for nobody: nothing changes after.)
    await crowd(m, "a1a5");
    expect(carrots(m).pulls).toEqual([]);
  });

  it("his last carrot wins the battle at once: a boss win with its own reason (the results' `carrots`), its moment as your turn begins", async () => {
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["d7", "c3", "h5", "e6", "g2"], { his: ["c3", "h5", "e6", "g2"] });
    await crowd(r, "e1d1");
    expect(r.stageComplete()).toBe(false);
    r.applyBossMove("e8d7");
    expect(carrots(r).over).toBe("won");
    expect(r.boss!.powers!.events.find((e) => e.kind === "carrotWin")).toEqual({ kind: "carrotWin", turn: 2, square: "d7" });
    expect(carrots(r).spin).toBeUndefined();
    expect(r.stageComplete()).toBe(true);
    expect(r.bossCarrotWin).toBe(true);
    expect(r.finishBossBattle()).toBe("boss");
    // His race brain takes it, like a mate: with the race on, a move that pulls his last carrot is always played.
    const b = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["d7", "c3", "h5", "e6", "g2"], { his: ["c3", "h5", "e6", "g2"] });
    await crowd(b, "e1d1");
    await b.playBoss();
    expect(b.raceCheck).toMatchObject({ won: true, move: "e8d7" });
    expect(b.stageComplete()).toBe(true);
  });

  it("his fifth carrot wins even when the same move draws on the board (a stalemate here), and his brain takes a fifth that doesn't when it can; a mate is his with the mate's own line", async () => {
    // (Your king on h2, his queen on d3 and king on f2: your only move is Kh1. His count is 4, the last carrot on g3:
    // Qd3-g3 pulls it and stalemates you; Kf2-g3 pulls it too, and doesn't.)
    const fen = "8/8/8/8/8/3q4/5k1K/8 w - - 0 60";
    const his = ["a1", "a8", "h8", "c6"];
    const r = racing(fen, ["g3", ...his], { his });
    await crowd(r, "h2h1");
    r.applyBossMove("d3g3");
    const board = r.boards.get(0)!;
    expect(gameEndWith(board.history, board.bases)).toBe("stalemate");
    expect(carrots(r).over).toBe("won");
    expect(r.stageComplete()).toBe(true);
    expect(r.bossCarrotWin).toBe(true);
    expect(r.finishBossBattle()).toBe("boss");
    // His brain, his pick the stalemating pull: it plays the other.
    const race: CarrotRace = { boss: "b", open: ["g3"], his: 4, crowdLeft: 11, bossLeft: 12, weight: 1 };
    const top: MoveScore[] = [{ move: "d3g3", expected: 0.99 }];
    expect(await raceGuard(fakeEngine(), applyMove(fen, "h2h1"), "d3g3", top, { race, looks: 4, nodes: 1 }, DEFAULT_BOSS_GUARD)).toMatchObject({ move: "f2g3", won: true });
    // (The last carrot on h3: Qd3-h3 pulls it and mates. His either way; the results keep the mate's line.)
    const m = racing(fen, ["h3", ...his], { his });
    await crowd(m, "h2h1");
    m.applyBossMove("d3h3");
    expect(gameEndWith(m.boards.get(0)!.history, m.boards.get(0)!.bases)).toBe("checkmate");
    expect(carrots(m).over).toBe("won");
    expect(m.bossCarrotWin).toBe(false);
    expect(m.finishBossBattle()).toBe("boss");
  });

  it("the battle ending first: no spin (his move mates as the race ends)", async () => {
    // (Mate test: he mates in one with his queen; the race is over, all pulled.)
    // (His rook mates on e1 along your back rank after your quiet a2-a3.)
    const r = racing("4r1k1/8/8/8/8/8/P5PP/7K w - - 0 30", ["a5", "c3", "h5", "e6", "b2"], { his: ["c3", "e6"], crowd: ["h5", "b2"], patch: { bossMateTest: true } });
    await crowd(r, "a2a3");
    r.state = { ...r.state, boss: { ...r.state.boss!, powers: { ...r.state.boss!.powers!, carrots: { ...carrots(r), pulls: [...carrots(r).pulls, { square: "a5", by: "crowd", at: 1 }], over: "pulled" } } } };
    await r.playBoss();
    expect(r.stageComplete()).toBe(true);
    expect(carrots(r).spin).toBeUndefined();
    expect(r.bossCarrotWin).toBe(false);
  });
});

describe("the Carrot Patch: the spin", () => {
  it("his tier is his carrots; each tier's odds are the sheet's (tier 3 the softened table); tier 0 a blank; tier 4 two queens; a roll is the seed's", () => {
    const rows = BOSS_POWERS.carrotOdds;
    expect(rows.map((row) => row.reduce((t, x) => t + x.p, 0))).toEqual([1, 1, 1, 1, 1]);
    expect(prizeWorth().map((x) => Math.round(x * 100) / 100)).toEqual([0, 1.4, 2.6, 5.05, 18]);
    expect(spinRoll(1, 5, 0)).toEqual([]);
    expect(spinRoll(1, 5, 4)).toEqual(["q", "q"]);
    expect(spinRoll(1, 5, 5)).toEqual([]);
    for (const tier of [1, 2, 3]) {
      const counts = new Map<string, number>();
      const n = 20_000;
      for (let seed = 0; seed < n; seed++) {
        const p = spinRoll(seed, 7, tier).join("+");
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      for (const x of rows[tier]!) expect(Math.abs((counts.get(x.prize.join("+")) ?? 0) / n - x.p), `${tier} ${x.prize}`).toBeLessThan(0.015);
      expect([...counts.keys()].sort()).toEqual(rows[tier]!.map((x) => x.prize.join("+")).sort());
    }
    // The same seed and turn, the same roll (host, server and replays agree); another turn, another draw.
    expect(spinRoll(42, 9, 3)).toEqual(spinRoll(42, 9, 3));
  });

  it("a battle's spin rolls from that battle's seed and turn: each roll spinRoll's for them, and battles with other seeds roll differently", async () => {
    const rolls = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      // (Tier 3, five prizes: the race over when you pull a5, then his move.)
      const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"], { his: ["c3", "e6", "h5"], crowd: ["g2"] });
      r.state = { ...r.state, boss: { ...r.state.boss!, powers: { ...r.state.boss!.powers!, seed } } };
      await crowd(r, "a1a5");
      r.applyBossMove("e8d7");
      const spin = carrots(r).spin!;
      expect(spin.tier).toBe(3);
      expect(spin.rolled).toEqual(spinRoll(seed, spin.at, 3));
      rolls.add(spin.rolled.join("+"));
    }
    // (Eight seeds: not one prize for every battle, which a roll that ignored the seed would give.)
    expect(rolls.size).toBeGreaterThan(1);
  });

  it("prize pieces on his side (Alfil's landing code): pawns on his 2nd row then 3rd, pieces on his back row then 2nd, nearest the middle first, never giving check", () => {
    expect(prizeSquares("p", "b").slice(0, 3)).toEqual(["d7", "e7", "c7"]);
    expect(prizeSquares("p", "b")[8]).toBe("d6");
    expect(prizeSquares("q", "b").slice(0, 2)).toEqual(["d8", "e8"]);
    expect(prizeSquares("r", "w")[0]).toBe("d1");
    // (His king on e8, yours on e1: the back row's d8 first.)
    const bare = "4k3/8/8/8/8/8/8/4K3 w - - 0 30";
    expect(placePrize(bare, ["q"], "b")!.squares).toEqual(["d8"]);
    expect(placePrize(bare, ["p", "p"], "b")!.squares).toEqual(["d7", "e7"]);
    expect(placePrize(bare, ["r", "q"], "b")!.squares).toEqual(["d8", "c8"]);
    // (Your king on d1: a queen on d8 or a rook down the d-file would give check: the next square.)
    const open = "4k3/8/8/8/8/8/8/3K4 w - - 0 30";
    const q = placePrize(open, ["q"], "b")!;
    expect(q.squares[0]).not.toBe("d8");
    sound(q.fen);
    expect(kingAttacked(q.fen, "w")).toBe(false);
    // (A gap on his back row: there first; his back row full: the 2nd row's middle next, as the order has it.)
    expect(placePrize("1nbqkbn1/1pp3p1/8/8/8/8/8/4K3 w - - 0 30", ["r"], "b")!.squares).toEqual(["a8"]);
    expect(placePrize("rnbqkbnr/1pp3p1/8/8/8/8/8/4K3 w - - 0 30", ["r"], "b")!.squares).toEqual(["d7"]);
    // (His back row full and his 2nd row's only gap on the edge: there, before anything further off.)
    expect(placePrize("rnbqkbnr/ppppppp1/8/8/8/8/8/4K3 w - - 0 30", ["q"], "b")!.squares).toEqual(["h7"]);
    // (Neither row has room: the nearest empty square to his back row's middle, here your pieces filling both.)
    const crowded = placePrize("RNBQKBNR/PPPPPPPP/8/8/8/4k3/8/8 w - - 0 30", ["r"], "b")!;
    expect(crowded.squares).toEqual(["d6"]);
  });

  it("the engines' limits: more than 8 pawns or more pieces than promotions could make is refused (Stockfish 19; chess.js and Maia take any), so the prize steps down to the next that fits", () => {
    // (His full army: nothing fits, a blank.)
    const army = "rnbqkbnr/pppppppp/8/8/8/8/8/4K3 w - - 0 30";
    expect(prizeFits(army, ["q", "q"], "b").prize).toEqual([]);
    expect(prizeFits(army, ["p"], "b").prize).toEqual([]);
    // (One pawn gone: one promotion's worth; two queens and a queen with a rook don't fit, a queen does.)
    const seven = "rnbqkbnr/ppppppp1/8/8/8/8/8/4K3 w - - 0 30";
    expect(prizeFits(seven, ["q", "q"], "b").prize).toEqual(["q"]);
    expect(prizeFits(seven, ["q", "r"], "b").prize).toEqual(["q"]);
    // (Seven pawns: one more fits, two don't: the two pawns step down to one.)
    expect(prizeFits(seven, ["p", "p"], "b").prize).toEqual(["p"]);
    // (A third knight is a promoted piece: it fits where a pawn is missing, one promotion's room.)
    const twoKnights = "r1bqkbnr/ppppppp1/2n5/8/8/8/8/4K3 w - - 0 30";
    expect(prizeFits(twoKnights, ["n"], "b").prize).toEqual(["n"]);
    // (Never up: with his whole army a knight doesn't fit, nor anything below it: a blank, never a better prize.)
    expect(prizeFits(army, ["n"], "b").prize).toEqual([]);
    for (const p of [["q", "q"], ["q", "r"], ["q"], ["r"], ["b"], ["n"], ["p", "p"], ["p"]]) {
      const got = prizeFits(seven, p, "b");
      expect(stockfishRefuses(got.fen)).toBeNull();
    }
  });

  it("a prize bishop goes on the color his bishops lack first, then the other (middle out as ever); with none or both, as any piece", () => {
    // (His king on e8: d8 is dark, c8 light.)
    expect(placePrize("4k3/8/8/8/8/8/8/4K3 w - - 0 30", ["b"], "b")!.squares).toEqual(["d8"]);
    // (His one bishop dark-squared, on b6: the light c8 first. Light-squared, on c6: the dark d8, first as ever. Both: d8.)
    expect(placePrize("4k3/8/1b6/8/8/8/8/4K3 w - - 0 30", ["b"], "b")!.squares).toEqual(["c8"]);
    expect(placePrize("4k3/8/2b5/8/8/8/8/4K3 w - - 0 30", ["b"], "b")!.squares).toEqual(["d8"]);
    expect(placePrize("4k3/8/1bb5/8/8/8/8/4K3 w - - 0 30", ["b"], "b")!.squares).toEqual(["d8"]);
    // (His back row's light squares all taken: his 2nd row's light d7, before the dark d8.)
    expect(placePrize("n1n1k1n1/8/1b6/8/8/8/8/4K3 w - - 0 30", ["b"], "b")!.squares).toEqual(["d7"]);
    // (Any other piece on the same board: no color rule, d8.)
    expect(placePrize("n1n1k1n1/8/1b6/8/8/8/8/4K3 w - - 0 30", ["r"], "b")!.squares).toEqual(["d8"]);
  });

  it("never an en passant square chess.js honors and Stockfish drops (a piece on the square behind it): the prize, and Alfil's landing, leave both seeing the same moves", async () => {
    // (His d7-d5 just past your c5 pawn: en passant on d6. His prize, a pawn, goes on d7 first: behind it.)
    const before = "r1bqk1nr/pp2p1bp/n4pp1/2Pp4/7P/B4P2/P1PPP1P1/RNQ1KBNR w KQkq d6 0 7";
    expect(legalMoves(before)).toContain("c5d6");
    const got = prizeFits(before, ["p"], "b");
    expect(got.squares).toEqual(["d7"]);
    expect(got.fen.split(" ")[3]).toBe("-");
    expect(legalMoves(got.fen)).not.toContain("c5d6");
    expect(await stockfishMoves(got.fen)).toEqual([...legalMoves(got.fen)].sort());
    // (Alfil's landing, the same code: a piece landing behind the square drops it; with nothing there it stays.)
    const g = gridOf(before);
    g.set("d7", "N");
    expect(editedFen(before, g).split(" ")[3]).toBe("-");
    expect(editedFen(before, gridOf(before)).split(" ")[3]).toBe("d6");
    expect(await stockfishMoves(before)).toEqual([...legalMoves(before)].sort());
  });
});

describe("the Carrot Patch: what the race is worth (his brain, the crowd's judge)", () => {
  it("one carrot at a time each: two carrots one move from him aren't both his; the side to move takes the most contested first", () => {
    // (Each side one move from each of two carrots; the crowd to move: it takes one, he the other.)
    const d = { boss: [1, 1], crowd: [1, 1] };
    const crowdFirst = raceOutlook(d, { boss: 12, crowd: 12 }, "crowd");
    expect(crowdFirst.filter((x) => x > 0.5)).toHaveLength(1);
    // (He's one move from two, the crowd far: both his, the second a little less sure: one in the ground isn't his yet.)
    const safe = raceOutlook({ boss: [1, 1], crowd: [6, 6] }, { boss: 12, crowd: 12 }, "boss");
    expect(safe[0]).toBeGreaterThan(0.95);
    expect(safe[1]).toBeLessThan(safe[0]!);
    // (No moves left: nobody gets it.)
    expect(raceOutlook({ boss: [1], crowd: [1] }, { boss: 0, crowd: 0 }, "crowd")).toEqual([0]);
    expect(countOdds(2, [1, 0, 0.5])).toEqual([0, 0, 0, 0.5, 0.5, 0]);
  });

  it("the judge (the crowd's turn): pulling a carrot he'd get first is worth far more than a quiet move; scores stay the engine's for the race's best move", () => {
    // (Your rook on b1 reaches b5 in one; so does his knight on d6: if you don't pull it, he does.)
    const fen = RACE_FEN;
    const r: CarrotRace = { boss: "b", open: ["b5", "h8", "a3", "h4", "e5"], his: 0, crowdLeft: 12, bossLeft: 12, weight: 1 };
    const top: MoveScore[] = [
      { move: "h1g1", expected: 0.5 },
      { move: "b1b5", expected: 0.48 },
      { move: "h1h2", expected: 0.5 },
    ];
    const ranked = raceRanked(top, fen, r);
    expect(ranked[0]!.move).toBe("b1b5");
    expect(ranked[0]!.expected).toBeCloseTo(0.48, 9);
    expect(ranked[1]!.expected).toBeLessThan(0.4);
    const ev = raceJudged({ bestMove: "h1g1", bestExpected: 0.5, expectedAfter: { h1g1: 0.5, b1b5: 0.48, h1h2: 0.5 } }, fen, r);
    expect(ev.bestMove).toBe("b1b5");
    expect(ev.expectedAfter.b1b5).toBeCloseTo(0.48, 9);
    // Without a race, nothing changes.
    expect(raceRanked(top, fen, null)).toEqual(top);
    expect(raceWorth(fen, { ...r, his: 5 })).toBe(BOSS_POWERS.carrotWinWorth);
    expect(raceAdjust(0.5, 0, 1)).toBe(0.5);
  });

  it("his brain prefers a carrot when it's safe (within the blunder guard, for the race), not when it costs too much; his last carrot always", async () => {
    // (His knight on d6 can pull b5 before your rook on b1 does; his pick is a quiet king move.)
    const fen = RACE_FEN.replace(" w ", " b ");
    const race: CarrotRace = { boss: "b", open: ["b5", "h8", "a3", "h4", "e5"], his: 0, crowdLeft: 12, bossLeft: 12, weight: 1 };
    const top: MoveScore[] = [
      { move: "e8e7", expected: 0.5 },
      { move: "d6b5", expected: 0.5 },
      { move: "e8d7", expected: 0.5 },
    ];
    // (The crowd's expected score after each of his moves: the pull safe, or the pull a blunder.)
    const engine = (pull: number): EngineLike => fakeEngine((f) => (pieceAt(f, "b5")?.type === "n" ? pull : 0.5));
    const look = { race, looks: 4, nodes: 30_000 };
    expect((await raceGuard(engine(0.5), fen, "e8e7", top, look, DEFAULT_BOSS_GUARD)).move).toBe("d6b5");
    expect((await raceGuard(engine(0.9), fen, "e8e7", top, look, DEFAULT_BOSS_GUARD)).move).toBe("e8e7");
    // (His last carrot: the battle, whatever the board says.)
    const won = await raceGuard(engine(0.99), fen, "e8e7", top, { ...look, race: { ...race, his: 4 } }, DEFAULT_BOSS_GUARD);
    expect(won).toMatchObject({ move: "d6b5", won: true, searched: 0 });
    // Never a stronger chess move dressed up as the race: a switch must be better for the race than his pick.
    const better: MoveScore[] = [
      { move: "e8e7", expected: 0.3 },
      { move: "e8d7", expected: 0.7 },
    ];
    const chessOnly = fakeEngine((f) => (pieceAt(f, "d7")?.type === "k" ? 0.2 : 0.6));
    expect((await raceGuard(chessOnly, fen, "e8e7", better, { race: { ...race, open: ["h8", "a1", "h1", "e5", "b5"] }, looks: 4, nodes: 1 }, DEFAULT_BOSS_GUARD)).move).not.toBe("e8d7");
  });

  it("a switch needs a real race gain (carrotMinGain): a move a hair better for the race and stronger at chess doesn't replace his pick", async () => {
    const fen = RACE_FEN.replace(" w ", " b ");
    const race: CarrotRace = { boss: "b", open: ["b5", "h8", "a3", "h4", "e5"], his: 0, crowdLeft: 12, bossLeft: 12, weight: 0.25 };
    // (His knight to c4 is 0.009 pawn better for the race than his pick, the knight to f5, and 8 points better at chess;
    // the pull to b5 a blunder.)
    const engine = fakeEngine((f) => (pieceAt(f, "c4")?.type === "n" ? 0.42 : pieceAt(f, "b5")?.type === "n" ? 0.95 : 0.5));
    const top: MoveScore[] = [
      { move: "d6c4", expected: 0.58 },
      { move: "d6f5", expected: 0.5 },
    ];
    const look = { race, looks: 4, nodes: 1 };
    expect(BOSS_POWERS.carrotMinGain).toBe(0.25);
    expect((await raceGuard(engine, fen, "d6f5", top, look, DEFAULT_BOSS_GUARD)).move).toBe("d6f5");
    // (With any race gain enough, as before: the chess carried it in.)
    expect((await raceGuard(engine, fen, "d6f5", top, look, DEFAULT_BOSS_GUARD, null, { ...BOSS_POWERS, carrotMinGain: 1e-9 })).move).toBe("d6c4");
  });

  it("he races as he plays: the race weighs less the weaker he is (Easy races worse), and not at all on a slip or under the King's strike", () => {
    expect(raceWeight(800)).toBe(BOSS_POWERS.carrotWeightMin);
    expect(raceWeight(1500)).toBeCloseTo(0.5, 9);
    expect(raceWeight(2400)).toBe(1);
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"]);
    expect(r.bossRace("stumble")).toBeNull();
    expect(r.bossRace("stagger")).toBeNull();
    // (The crowd to move: no race brain for him now.)
    expect(r.bossRace("elo")).toBeNull();
  });

  it("the bots pick by the race too, the pulls among their choices; a judge's job with the race works out the same bots' picks on every device", async () => {
    // (Your rook on b1 and his knight on d6 each a move from b5: every engine's score the same, so only the race tells them apart.)
    const fen = RACE_FEN;
    const race: CarrotRace = { boss: "b", open: ["b5", "h8", "a3", "h4", "e5"], his: 0, crowdLeft: 12, bossLeft: 12, weight: 1 };
    const flat = fakeEngine(() => 0.5);
    const job: JudgeJob = { id: "j", fen, picks: [], bots: Array.from({ length: 9 }, () => ({ skill: 1, powerUps: 0 })), seed: 3, rules: { botCandidateMoves: 2, botRandomMoveChance: 0, botPowerUpLoss: 99 }, race };
    expect(jobOffers(job)).toEqual(["b1b5"]);
    const report = await runQuickJob(flat, job);
    expect(report.extra.map((m) => m.move)).toContain("b1b5");
    const board = judgedBoard(job, report)!;
    expect(board.botPicks.filter((m) => m === "b1b5").length).toBeGreaterThan(4);
    expect(judgeBotPicks(job, report.top, report.extra)).toEqual({ picks: board.botPicks, powerUps: board.botPowerUps });
  });
});

describe("the Carrot Patch with the other rules", () => {
  it("the God King's strike just before the cast waits for his next move (the cast isn't a move), and staggers it: his race brain is off for it", async () => {
    const r = raid({ patch: { bossPowerTest: "carrotpatch" } });
    r.deal();
    expect(r.callStrike("h0").struck).toBe(true);
    await r.score(new Map([["h0", { move: "d2d4", thinkMs: 1000 }]]));
    expect(r.boss!.staggerNext).toBe(true);
    r.applyCarrots();
    expect(r.boss!.staggerNext).toBe(true);
    await crowd(r);
    expect(r.bossMoveKind()).toBe("stagger");
    expect(r.bossRace("stagger")).toBeNull();
    await r.playBoss();
    expect(r.raceCheck).toBeNull();
    expect(r.boss!.staggerNext).toBe(false);
  });

  it("the God King's Last Stand: the move he takes back pulls nothing and isn't one of the race's moves; the re-pick is", async () => {
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"]);
    r.forceLastStand = true;
    await crowd(r, "a1a5");
    expect(r.boss!.lastStand?.move).toBe("a1a5");
    expect(carrots(r).pulls).toEqual([]);
    expect(carrots(r).crowdMoves).toBe(0);
    await crowd(r, "e1d2");
    expect(carrots(r).crowdMoves).toBe(1);
  });

  it("QUEEN SLAIN!: your move that takes his queen plays its banner in his thinking before the cast (held for it); the cast passes the turn, and his next thinking comes after a new move of yours", async () => {
    // (Your rook takes his queen on d5; the cast is due: the thinking before it is the one straight after your move.)
    const r = from("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 30", { patch: { bossPowerTest: "carrotpatch" } });
    await crowd(r, "d1d5");
    expect(r.carrotDue()).toBe(true);
    expect(queenSlain(r.bossView()!)).toBe(true);
    r.applyCarrots();
    expect(r.bossToMove()).toBe(false);
    await crowd(r, "e1d2");
    expect(queenSlain(r.bossView()!)).toBe(false);
  });

  it("fair play: a race turn counts unless the race made another move the best than the engine's; the turn right after his spin doesn't; before and after, they do", async () => {
    // (Every engine score the same, so the race alone tells the moves apart.)
    const flat = (top: string) => fakeEngine((f, m) => (m === top ? 0.52 : 0.5));
    // Your rook on b1 and his knight on d6 each a move from b5: the race makes b1b5 the best, over the engine's h1g1.
    const raced = racing(RACE_FEN, ["b5", "h8", "a3", "h4", "e5"], { engine: flat("h1g1") });
    expect(powerTurn(raced.boss)).toBe(false);
    raced.deal();
    const changed = (await raced.evaluate(new Map([["h0", { move: "h1g1", thinkMs: 1000 }]]))).results[0]!;
    expect(changed.scored[0]!.move).toBe("b1b5");
    expect(changed.power).toBe(true);
    // The engine's best is the race's too: the turn counts, with the judge's numbers (a found best is an engine's).
    const same = racing(RACE_FEN, ["b5", "h8", "a3", "h4", "e5"], { engine: flat("b1b5") });
    same.deal();
    const kept = (await same.evaluate(new Map([["h0", { move: "h1g1", thinkMs: 1000 }]]))).results[0]!;
    expect(kept.scored[0]!.move).toBe("b1b5");
    expect(kept.power).toBeUndefined();
    // The turn right after his spin doesn't count (the spin's moment: the longest look at the board before the clock).
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"], { his: ["c3", "e6"], crowd: ["h5", "g2"] });
    await crowd(r, "a1a5");
    r.applyBossMove("e8d7");
    expect(carrots(r).spin).toBeTruthy();
    expect(powerTurn(r.boss)).toBe(true);
    await crowd(r, "a5a4");
    r.applyBossMove("d7d6");
    expect(powerTurn(r.boss)).toBe(false);
    expect(powerTurn(raid().boss)).toBe(false);
  });

  it("the boss view carries the race (optional: older apps ignore it), as JSON: squares, who pulled each, counts, moves left, his tier, his spin", async () => {
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"], { his: ["c3"], crowd: ["h5"], crowdMoves: 3, bossMoves: 3 });
    const v = (JSON.parse(JSON.stringify(r.bossView())) as NetBoss).powers!.carrots!;
    expect(v).toEqual({ at: 0, squares: ["a5", "c3", "h5", "e6", "g2"], by: [null, "boss", "crowd", null, null], crowd: 1, boss: 1, crowdLeft: 9, bossLeft: 9, over: null, tier: 1, spin: null });
    expect((JSON.parse(JSON.stringify(raid().bossView())) as NetBoss).powers!.carrots).toBeNull();
  });

  it("a runner restored from its snapshot (as every lobby event restores it) carries the race on the same", async () => {
    const r = racing("4k3/8/8/8/8/8/8/R3K3 w - - 0 30", ["a5", "c3", "h5", "e6", "g2"]);
    await crowd(r, "a1a5");
    const restored = MatchRunner.restore(structuredClone(r.snapshot()), { settings: SETTINGS(), rng: mulberry32(5), engines: [fakeEngine()], library: [opening(RUY)] });
    expect(restored.boss!.powers!.carrots).toEqual(carrots(r));
    restored.applyBossMove("e8e7");
    expect(restored.boss!.powers!.carrots!.bossMoves).toBe(1);
  });
});

// (The sims' and the review's bigger runs: reports/hopper-carrots-sim.md.)
describe("the Carrot Patch: the ground rules, over many battles (a fuzz, as #273's)", () => {
  it("every cast, pull, hop, move and prize leaves a legal position the engine plays; replays match; pulls only grow; never past the race's moves; prizes on his side, never more than the engines take", async () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const r = raid({ seed, side: seed % 2 ? "w" : "b", patch: { bossPowerTest: seed % 3 ? "carrotpatch" : "leapfrog", bossMaxMoves: 40 } });
      const rng = mulberry32(seed * 7919);
      let pulls = 0;
      if (seed % 3 === 0) r.triggerUltimate();
      for (let t = 0; t < 40 && !r.isOver() && !r.stageComplete(); t++) {
        r.deal();
        if (rng() < 0.1) r.callStrike("h0");
        const fen = fenOf(r);
        const allowed = r.crowdAllowed() ?? legalMoves(fen);
        const c = r.boss!.powers!.carrots;
        const open = c && !c.over ? carrotsOpen(c) : [];
        const pull = allowed.filter((m) => pullsOf(fen, m, open).length);
        const move = pull.length && rng() < 0.4 ? pull[Math.floor(rng() * pull.length)]! : allowed[Math.floor(rng() * allowed.length)]!;
        await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
        if (r.isOver() || r.stageComplete()) break;
        if (r.carrotDue()) {
          r.applyCarrots();
          counts.casts = (counts.casts ?? 0) + 1;
        } else {
          if (r.hopDue()) await r.playHop();
          if (r.bossToMove()) await r.playBoss();
        }
        const board = r.boards.get(0)!;
        if (!gameEndWith(board.history, board.bases)) sound(board.fen);
        expect(stockfishRefuses(board.fen)).toBeNull();
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
        const now = r.boss!.powers!.carrots;
        if (!now) continue;
        expect(now.pulls.length).toBeGreaterThanOrEqual(pulls);
        pulls = now.pulls.length;
        expect(now.crowdMoves).toBeLessThanOrEqual(BOSS_POWERS.carrotMoves);
        expect(now.bossMoves).toBeLessThanOrEqual(BOSS_POWERS.carrotMoves);
        expect(new Set(now.pulls.map((p) => p.square)).size).toBe(now.pulls.length);
        expect(carrotsOf(now, "boss") + carrotsOf(now, "crowd")).toBe(now.pulls.length);
        if (now.over === "pulled") expect(carrotsOpen(now)).toEqual([]);
        if (now.over === "won") expect(carrotsOf(now, "boss")).toBe(BOSS_POWERS.carrotCount);
        if (now.spin && now.spin.at === r.boss!.crowdMoves && r.boss!.powers!.events.some((e) => e.kind === "carrotSpin")) {
          counts.spins = (counts.spins ?? 0) + 1;
          const his = r.boss!.crowdSide === "w" ? "b" : "w";
          for (const sq of now.spin.squares) expect(pieceAt(board.fen, sq)?.color).toBe(his);
          expect(now.spin.tier).toBe(carrotsOf(now, "boss"));
          if (now.spin.squares.length) expect(board.bases).toContainEqual({ ply: board.history.length, fen: board.fen });
        }
      }
      if (r.boss!.powers!.carrots) counts.races = (counts.races ?? 0) + 1;
    }
    expect(counts.casts).toBeGreaterThanOrEqual(6);
    expect(counts.spins ?? 0).toBeGreaterThanOrEqual(2);
  }, 120_000);
});

describe("the carrots' test switch (?carrots=N: settings.bossCarrotTest)", () => {
  it("plants N carrots a step from one of his pieces and out of the crowd's reach, the rest a step from the crowd's and out of his", async () => {
    const { carrotsWithinReach, legalMoves } = await import("../src/index.ts");
    // (The test switch's start, 1.e4 e5 2.Nf3 Nc6 3.d3, his turn passed: the crowd White to move.)
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 0 3";
    const his = fen.replace(" w ", " b ");
    const to = (f: string) => new Set(legalMoves(f).map((m) => m.slice(2, 4)));
    for (const n of [0, 3, 5]) {
      const squares = carrotsWithinReach(fen, "w", n);
      expect(squares, `${n}`).toHaveLength(BOSS_POWERS.carrotCount);
      expect(new Set(squares).size).toBe(squares.length);
      squares.forEach((sq, i) => {
        expect(gridOf(fen).has(sq), sq).toBe(false);
        const [near, far] = i < n ? [his, fen] : [fen, his];
        expect(to(near).has(sq), `${n}: ${sq} a step away`).toBe(true);
        expect(to(far).has(sq), `${n}: ${sq} out of reach`).toBe(false);
      });
    }
  });

  it("and his race brain takes a carrot whenever a move of his pulls one (eager: the switch only; else his pick stands)", async () => {
    const { raceGuard, DEFAULT_BOSS_GUARD } = await import("../src/index.ts");
    // (Him to move, Black: his knight on c6 can step onto the carrot on b4; his pick is a quiet pawn move.)
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq - 0 3";
    const race = { boss: "b" as const, open: ["b4"], his: 0, crowdLeft: 12, bossLeft: 12 };
    const engine = { scoreMoves: async () => [], topMoves: async () => [] } as never;
    const eager = await raceGuard(engine, fen, "a7a6", [{ move: "a7a6", expected: 0.5 }] as never, { race, looks: 4, nodes: 1, eager: true }, DEFAULT_BOSS_GUARD);
    expect(eager.move).toBe("c6b4");
    expect(eager.searched).toBe(0);
  });
});
