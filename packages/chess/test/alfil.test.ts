import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, chooseBoss, isPlayable, menuBosses, mulberry32, type BossPowerState, type BossState, type Settings } from "@chessroyale/core";
import {
  ALFIL_FX,
  MatchRunner,
  POWER_FX,
  START_FEN,
  airborneView,
  alfilBattle,
  applyMove,
  bossAllowed,
  bossThinkMs,
  castPick,
  editedFen,
  fenAtPly,
  followSquares,
  fuseFrom,
  fusionOptions,
  fusedFen,
  tusksPairs,
  hisTurn,
  initPowers,
  kingAttacked,
  landedEarlyMs,
  landing,
  legalMoves,
  liftedPieces,
  mateInOne,
  passTurn,
  pickSlam,
  pieceAt,
  powerTurn,
  queenSlain,
  sanLineToUci,
  sideToMove,
  slamCandidates,
  slamDue,
  slamFrom,
  slamPawnsLost,
  stockfishRefuses,
  type Battle,
  type EngineLike,
  type NetBoss,
  type Opening,
} from "../src/index.ts";

/**
 * Alfil, the woolly mammoth (Eric, Oct 17): Tusks (at the start of his turn he marks two of his pawns, then plays his
 * move; unless the crowd takes one, on his next turn they fuse into an elephant, a bishop, on the engine's pick of their
 * two squares, and that's his move; at most two a battle) and the Mammoth Slam (two of the crowd's pawns and a knight or
 * bishop up for three crowd turns, then back on their own squares, the nearest allowed when taken; the engine keeps the
 * swing capped; down early to stop a mate in one). docs/decisions/2026-10-17-alfil-rules.md.
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
/** A stand-in engine: every legal move scored by a hash (or `score`), best first; the boss plays the first legal move. */
function fakeEngine(score: (fen: string, m: string) => number = (fen, m) => 0.3 + 0.4 * hash(fen + m), mate?: (fen: string) => number | undefined): EngineLike {
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move), ...(mate?.(fen) !== undefined ? { mate: mate(fen)! } : {}) }))
        .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
  };
}
const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });

/** A Boss alone against Alfil (met as the test link does: his art isn't built yet). */
function raid(opts: { patch?: Partial<Settings>; seed?: number; engine?: EngineLike } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "alfil", bossUnfinished: true, lastStandFrom: 999, ...opts.patch } as Settings;
  return new MatchRunner({ settings, rng: mulberry32(opts.seed ?? 5), engines: [opts.engine ?? fakeEngine()], library: [opening(LINE)], entrants: [{ id: "h0", name: "H", isBot: false }] });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** What his steps did on one turn of his, in order. */
type Done = string[];
/** One crowd turn: you play `move` (or the first allowed move); then his steps, one after another, and his move (unless the fusion was it). */
async function turn(r: MatchRunner, move?: string): Promise<Done> {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
  await r.score(new Map([["h0", { move: move ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  const done: Done = [];
  if (r.isOver() || r.stageComplete()) return done;
  for (let s = r.alfilStep(); s; s = r.alfilStep()) {
    done.push(s);
    await r.playAlfil();
    expect(done.length).toBeLessThanOrEqual(3);
  }
  // (His fusion is his move: then his turn is over.)
  if (r.bossToMove()) await r.playBoss();
  return done;
}

/** The battle's state as a boss's rules see it, around a position of our own (him to move unless the FEN says not). */
function battleAt(fen: string, powers: Partial<BossPowerState> = {}, o: { crowd?: "w" | "b"; crowdMoves?: number; test?: string; maxMoves?: number } = {}): Battle & { board: () => { fen: string; history: string[]; bases?: { ply: number; fen: string }[] } } {
  const crowd = o.crowd ?? "w";
  const crowdMoves = o.crowdMoves ?? 4;
  // (Crowd first: his moves so far are one fewer than the crowd's.)
  const history = Array.from({ length: 2 * crowdMoves - (sideToMove(fen) === crowd ? 0 : 1) }, () => "e2e4");
  const boards = new Map([[0, { id: 0, history, fen, expected: 0.5, lastMove: null, generation: 0, bases: [{ ply: history.length, fen }] } as never]]);
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossPowerTest: o.test ?? "", bossMaxMoves: o.maxMoves ?? 60 } as Settings;
  const b = {
    state: {
      boards: [0],
      boss: { id: "alfil", crowdSide: crowd, crowdMoves, startPly: 0, powers: { ...initPowers(7, fen, crowd), turn: crowdMoves, ...powers } } as unknown as BossState,
    } as never,
    boards,
    settings,
    bossLast: null,
    engines: [fakeEngine()],
    alive: () => [],
    finalGameOver: () => !legalMoves((boards.get(0) as unknown as { fen: string }).fen).length,
    bossToMove: () => sideToMove((boards.get(0) as unknown as { fen: string }).fen) !== crowd,
    crowdAllowed: () => null,
    boardOf: () => null,
    afterCrowdMove: () => {},
    bossPassed: () => {},
    memo: new Map(),
    board: () => boards.get(0) as never,
  } as unknown as Battle & { board: () => { fen: string; history: string[]; bases?: { ply: number; fen: string }[] } };
  return b;
}
const powersOf = (b: Battle) => b.state.boss!.powers!;
/** The crowd's move played on a fake battle's board (the move as the runner plays it), then his rules after it. */
function crowdMoves(b: ReturnType<typeof battleAt>, move: string) {
  const board = b.board();
  const fen = applyMove(board.fen, move);
  b.boards.set(0, { ...(board as never as object), fen, history: [...board.history, move] } as never);
  b.state = { ...b.state, boss: { ...b.state.boss!, crowdMoves: b.state.boss!.crowdMoves + 1 } };
  alfilBattle.afterCrowdMove(b, move);
}
/** No position a power leaves may be one the engine refuses, or one with no move for the side to move but a real ending. */
const playable = (fen: string) => stockfishRefuses(fen) === null && legalMoves(fen).length > 0;

describe("Alfil: who he is", () => {
  it("is on the roster as alfil (🦣) with Tusks and the Mammoth Slam, and an offset in the others' range", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "alfil")!;
    expect(def).toMatchObject({ name: "Alfil", icon: "🦣", kit: null, powers: { passive: "tusks", ultimate: "slam" } });
    const others = BOSS_ROSTER.filter(isPlayable).map((b) => b.offset);
    expect(def.offset).toBeGreaterThanOrEqual(Math.min(...others));
    expect(def.offset).toBeLessThanOrEqual(Math.max(...others));
  });

  it("is hidden from players until his art ships: never playable, never random, on no menu; the test link's switch meets him", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "alfil")!;
    expect(isPlayable(def)).toBe(false);
    for (let roll = 0; roll < 1; roll += 0.01) expect(chooseBoss(roll).id).not.toBe("alfil");
    // Picked by name (a raid lobby's creator, Boss alone, a queue): someone else.
    expect(chooseBoss(0.5, "alfil").id).not.toBe("alfil");
    expect(chooseBoss(0.5, "alfil", null, undefined, false, true).id).not.toBe("alfil");
    for (const admin of [false, true]) for (const raid of [false, true]) expect(menuBosses({ admin, raid }).map((b) => b.id)).not.toContain("alfil");
    // ?boss=alfil&wip=1 (a test switch: admins, test servers, dev): him.
    expect(chooseBoss(0.5, "alfil", null, undefined, true).id).toBe("alfil");
    expect(raid().boss!.id).toBe("alfil");
  });
});

describe("Tusks: the cast", () => {
  const MID = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5";

  it("weighs a few pairs of his pawns, anywhere, from the seed (the same everywhere): never a passed pawn or his king's shield while others will do", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const pairs = tusksPairs(MID, "b", seed, 3);
      expect(pairs).toHaveLength(BOSS_POWERS.tusksLooks);
      expect(tusksPairs(MID, "b", seed, 3)).toEqual(pairs);
      for (const p of pairs) {
        expect(p.pawns).toHaveLength(2);
        for (const sq of p.pawns) expect(pieceAt(MID, sq)).toEqual({ color: "b", type: "p" });
        expect(p.options).toEqual(fusionOptions(MID, p.pawns, "b"));
        expect(p.options.length).toBeGreaterThan(0);
        // (His king on e8, castled nowhere yet: d7, e7 is gone, f7 shield it.)
        expect(p.pawns.filter((sq) => ["d7", "f7"].includes(sq))).toEqual([]);
      }
      seen.add(pairs.map((p) => p.pawns.join()).join(" "));
    }
    expect(seen.size).toBeGreaterThan(1);
    // A White Alfil (the crowd Black): his own pawns.
    const asWhite = applyMove(applyMove(START_FEN, "e2e4"), "e7e5");
    for (const p of tusksPairs(asWhite, "w", 1, 3)) for (const sq of p.pawns) expect(pieceAt(asWhite, sq)).toEqual({ color: "w", type: "p" });
    // Fewer than two pawns: no cast.
    expect(tusksPairs("4k3/p7/8/8/8/8/8/4K3 b - - 0 1", "b", 1, 3)).toEqual([]);
  });

  it("the cast marks the pair that helps him most (Eric), by its ways to go as the fusion is picked; no engine, the first", async () => {
    const pairs = tusksPairs(MID, "b", 4, 3);
    const ways = pairs.flatMap((p) => p.options.map((o) => o.fen));
    const at = (pawns: number) => 1 / (1 + Math.exp(-pawns * BOSS_POWERS.bouncePawnLogit));
    // The engine: the third pair's way gains him two pawns, the rest one. (Each way is the crowd's move: its score is
    // the crowd's, his the rest.)
    const third = pairs[2]!.options[0]!.fen;
    const pick = await fuseFrom([fakeEngine((f) => (f === MID ? 0.5 : f === third ? 1 - at(2) : 1 - at(1)))], MID, ways);
    expect(pick).toEqual({ fen: third, gain: 2 });
    expect(castPick(pairs, pick!.fen)).toEqual(pairs[2]!.pawns);
    expect(castPick(pairs, null)).toEqual(pairs[0]!.pawns);
    expect(castPick(pairs, "junk")).toEqual(pairs[0]!.pawns);
    expect(castPick([], null)).toBeNull();
  });

  it("never a fusion that leaves his king attacked (it's his move): a pawn that blocks a check gives way only to the elephant on its own square", () => {
    // His e7 pawn blocks the crowd's rook on e1 from his king on e8.
    const fen = "4k3/p3p2p/8/8/8/8/8/4R2K b - - 0 1";
    expect(fusionOptions(fen, ["a7", "e7"], "b").map((o) => o.at)).toEqual(["e7"]);
    expect(fusionOptions(fen, ["a7", "h7"], "b").map((o) => o.at)).toEqual(["a7", "h7"]);
    for (let seed = 0; seed < 30; seed++) for (const p of tusksPairs(fen, "b", seed, 3)) for (const o of p.options) expect(kingAttacked(o.fen, "b")).toBe(false);
    // A pin along a diagonal (the pinning bishop defended): the same.
    const pin = "4k3/3p3p/8/1B6/P7/8/8/6K1 b - - 0 1";
    expect(fusionOptions(pin, ["d7", "h7"], "b").map((o) => o.at)).toEqual(["d7"]);
    // In check as his turn begins (the crowd's move gave it): no fusion answers it, so none (his move must; the fusion
    // waits for his next turn: "Tusks: the counter and the fusion").
    const checked = "4k3/p6p/8/8/8/8/8/4R2K b - - 0 1";
    expect(kingAttacked(checked, "b")).toBe(true);
    expect(fusionOptions(checked, ["a7", "h7"], "b")).toEqual([]);
  });

  it("never an elephant giving check (no power's piece ever lands giving one); none allowed, no cast with that pair", () => {
    // A bishop on e4 would check the king on d5; on a7 it doesn't. (Your h2 pawn: not a dead draw after it.)
    const fen = "7k/p7/8/3K4/4p3/8/7P/8 b - - 0 1";
    expect(fusionOptions(fen, ["a7", "e4"], "b").map((o) => o.at)).toEqual(["a7"]);
    // On e7 it checks c5; without e7 the rook checks his king: neither.
    const neither = "4k3/p3p3/8/2K5/8/8/8/4R3 b - - 0 1";
    expect(fusionOptions(neither, ["a7", "e7"], "b")).toEqual([]);
    expect(tusksPairs(neither, "b", 1, 3)).toEqual([]);
  });

  it("every fused position is one the engine plays (two pawns fewer, a bishop more: never past what promotions make), the crowd to move", () => {
    // Already two bishops and seven pawns: a third bishop is one promotion, with two pawns missing.
    const fen = "r2qkb1r/pp1bpppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 5";
    for (const o of tusksPairs(fen, "b", 3, 3).flatMap((p) => p.options)) {
      expect(stockfishRefuses(o.fen)).toBeNull();
      expect(playable(o.fen)).toBe(true);
      expect(sideToMove(o.fen)).toBe("w");
      expect(kingAttacked(o.fen, "b")).toBe(false);
    }
  });

  it("never a fusion that leaves the crowd without a move: a stalemate by a power", () => {
    // The elephant on e6 would take a2 from your king on a1 (b1 and b2 are his king's; your g5 pawn is blocked):
    // stalemate. On h7, a2 is free.
    const fen = "8/7p/4p1p1/6P1/8/8/2k5/K7 b - - 0 1";
    expect(fusionOptions(fen, ["e6", "h7"], "b").map((o) => o.at)).toEqual(["h7"]);
  });

  it("never a fusion that ends the game in a dead draw: a lone bishop against a lone king, or bishops all on one color; no cast with that pair", () => {
    // Two pawns and his king against your lone king: the elephant would leave king and bishop against king.
    const lone = "4k3/p6p/8/8/8/8/8/4K3 b - - 0 1";
    expect(fusionOptions(lone, ["a7", "h7"], "b")).toEqual([]);
    expect(tusksPairs(lone, "b", 1, 3)).toEqual([]);
    // Your light-squared bishop: an elephant on light h7 is bishops all on one color; on dark a7 the game goes on.
    const bishops = "4k3/p6p/8/8/8/8/8/4KB2 b - - 0 1";
    expect(fusionOptions(bishops, ["a7", "h7"], "b").map((o) => o.at)).toEqual(["a7"]);
    // Any other piece of yours, or a pawn: the game goes on, either square.
    expect(fusionOptions("4k3/p6p/8/8/8/8/8/4KN2 b - - 0 1", ["a7", "h7"], "b").map((o) => o.at)).toEqual(["a7", "h7"]);
  });

  it("his turns: his moves so far (each fusion was one), plus one, whoever moved first", () => {
    expect(hisTurn({ crowdMoves: 1, startPly: 10 }, 11)).toBe(1);
    expect(hisTurn({ crowdMoves: 3, startPly: 10 }, 15)).toBe(3);
    // He moved first (the crowd Black): after the crowd's 2nd move, his 3rd.
    expect(hisTurn({ crowdMoves: 2, startPly: 0 }, 4)).toBe(3);
    // A fusion was his 3rd turn (no move on the board): after the crowd's 4th move, his 4th.
    expect(hisTurn({ crowdMoves: 4, startPly: 0, powers: { fused: 1 } }, 6)).toBe(4);
  });

  it("from his 3rd turn, then every tusksEvery of his turns; at most tusksMax elephants; the test switch: from his first, every other", async () => {
    for (const test of ["", "tusks"]) {
      const r = raid({ patch: { bossPowerTest: test } });
      const casts: number[] = [];
      const fusions: number[] = [];
      for (let t = 1; t <= 22 && !r.isOver() && !r.stageComplete(); t++) {
        const done = await turn(r);
        if (done.includes("tusks")) casts.push(t);
        if (done.includes("fuse")) fusions.push(t);
      }
      const { first, every } = test ? { first: 1, every: 2 } : { first: BOSS_POWERS.tusksFirst, every: BOSS_POWERS.tusksEvery };
      expect(casts[0]).toBe(first);
      for (let i = 1; i < casts.length; i++) expect(casts[i]! - casts[i - 1]!).toBeGreaterThanOrEqual(every);
      for (const f of fusions) expect(casts).toContain(f - 1);
      expect(r.boss!.powers!.fused ?? 0).toBeLessThanOrEqual(BOSS_POWERS.tusksMax);
      if ((r.boss!.powers!.fused ?? 0) >= BOSS_POWERS.tusksMax) expect(casts.length).toBeLessThanOrEqual(BOSS_POWERS.tusksMax + casts.filter((c) => !fusions.includes(c + 1)).length);
    }
  });
});

describe("Tusks: the counter and the fusion", () => {
  // His marked pawns: d5 (the crowd's e4 pawn can take it) and a7.
  const COUNTER = "4k3/p7/8/3p4/4P3/8/8/4K3 w - - 0 1";

  it("your turn: take either marked pawn and the fusion fails, at once (no elephant, the next cast as scheduled)", () => {
    const b = battleAt(COUNTER, { tusks: { turn: 3, at: 4, pawns: ["a7", "d5"] }, tusksNext: 8 });
    crowdMoves(b, "e4d5");
    const p = powersOf(b);
    expect(p.tusks).toBeNull();
    expect(p.fusion).toEqual({ at: 5, from: ["a7", "d5"], to: null, why: "taken" });
    expect(p.elephants ?? []).toEqual([]);
    expect(p.fused ?? 0).toBe(0);
    expect(alfilBattle.step(b)).toBeNull();
    // Any other move: the marks stay for his turn.
    const c = battleAt(COUNTER, { tusks: { turn: 3, at: 4, pawns: ["a7", "d5"] }, tusksNext: 8 });
    crowdMoves(c, "e1e2");
    expect(powersOf(c).tusks!.pawns).toEqual(["a7", "d5"]);
    expect(alfilBattle.step(c)).toBe("fuse");
  });

  it("en passant counts: the pawn taken is the marked one", () => {
    // His d-pawn has just made its double step beside the crowd's e5 pawn.
    const fen = "4k3/p7/8/3pP3/8/8/8/4K3 w - d6 0 2";
    const b = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "d5"] } });
    crowdMoves(b, "e5d6");
    expect(powersOf(b).fusion).toMatchObject({ to: null, why: "taken" });
  });

  it("the marks travel with the pawns, and the elephants with their bishops; one taken or promoted is dropped", () => {
    expect(followSquares(["d7", "a7"], "d7d5", "4k3/p7/8/3p4/8/8/8/4K3 w - - 0 1", "p")).toEqual(["d5", "a7"]);
    expect(followSquares(["c5"], "c5f2", "4k3/8/8/8/8/8/5b2/4K3 w - - 0 1", "b")).toEqual(["f2"]);
    expect(followSquares(["f2"], "e1f2", "4k3/8/8/8/8/8/5K2/8 b - - 0 1", "b")).toEqual([]);
    expect(followSquares(["b2"], "b2b1q", "4k3/8/8/8/8/8/8/1q2K3 w - - 0 1", "p")).toEqual([]);
  });

  it("his next turn: both lifted off, the elephant on the engine's pick of the two, and that's his move (a base, the crowd to move)", async () => {
    const fen = "4k3/p6p/8/8/8/8/P7/4K3 b - - 0 1";
    const b = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "h7"] } });
    const plies = b.board().history.length;
    let passed = 0;
    b.bossPassed = () => void passed++;
    expect(alfilBattle.step(b)).toBe("fuse");
    const options = alfilBattle.candidates(b);
    expect(options).toHaveLength(2);
    expect(alfilBattle.needsEngine(b)).toBe(true);
    // The engine (each way the crowd's move: its score is the crowd's): the position before 0.5 for him; the elephant on
    // a7 gains him a pawn, on h7 two: h7 (whichever the engine prefers, Eric; unbounded: docs/decisions/2026-10-17-alfil-rules.md).
    const at = (pawns: number) => 1 / (1 + Math.exp(-pawns * BOSS_POWERS.bouncePawnLogit));
    const engine = fakeEngine((f) => (f === options[0] ? 1 - at(1) : f === options[1] ? 1 - at(2) : 0.5));
    expect(await fuseFrom([engine], fen, options)).toEqual({ fen: options[1], gain: 2 });
    // However much it gains him: still the best of them; and when it costs him (the crowd's tempo), the least bad.
    const won = fakeEngine((f) => (f === options[0] ? 0.001 : f === options[1] ? 0.02 : 0.5));
    expect((await fuseFrom([won], fen, options))!.fen).toBe(options[0]);
    const lost = fakeEngine((f) => (f === options[0] ? 0.9 : f === options[1] ? 0.95 : 0.5));
    expect((await fuseFrom([lost], fen, options))!.fen).toBe(options[0]);
    // Equal: the first (the squares in order).
    expect((await fuseFrom([fakeEngine((f) => (f === fen ? 0.5 : 0))], fen, options))!.fen).toBe(options[0]);
    expect(await fuseFrom([], fen, options)).toBeNull();
    // The second, as the host's answer:
    expect(alfilBattle.apply(b, options[1]!)).toBe("fuse");
    const p = powersOf(b);
    expect(b.board().fen).toBe(options[1]!);
    expect(sideToMove(b.board().fen)).toBe("w");
    expect(pieceAt(b.board().fen, "h7")).toEqual({ color: "b", type: "b" });
    expect(pieceAt(b.board().fen, "a7")).toBeNull();
    // No move on the board: a base at the same ply, no last move to show; the crowd's turn set up as after his move.
    expect(b.board().history.length).toBe(plies);
    expect(b.board().bases!.at(-1)).toEqual({ ply: plies, fen: options[1] });
    expect(fenAtPly(b.board().history, plies, b.board().bases)).toBe(options[1]);
    expect((b.board() as unknown as { lastMove: string | null }).lastMove).toBeNull();
    expect(b.bossLast).toBeNull();
    expect(passed).toBe(1);
    expect(p).toMatchObject({ tusks: null, fusion: { at: 4, from: ["a7", "h7"], to: "h7" }, elephants: ["h7"], fused: 1 });
    // (Its moment comes with the crowd's turn: below.)
    expect(p.events.some((e) => e.kind === "fuse")).toBe(false);
    // Done: not his move any more.
    expect(alfilBattle.step(b)).toBeNull();
  });

  it("in a battle: the fusion is his turn: no move after it, its moment first as the crowd's turn begins, his turns counted on", async () => {
    const r = raid({ patch: { bossPowerTest: "tusks" } });
    expect(await turn(r)).toEqual(["tusks"]);
    const marked = r.boss!.powers!.tusks!.pawns;
    // (Your move takes neither marked pawn.)
    r.deal();
    const move = [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort().find((m) => !marked.includes(m.slice(2, 4)))!;
    await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
    expect(r.alfilStep()).toBe("fuse");
    const plies = r.boards.get(0)!.history.length;
    const turnBefore = r.boss!.powers!.turn;
    await r.playAlfil();
    const v = r.bossView()!;
    const p = r.boss!.powers!;
    expect(p.fusion!.to).toBeTruthy();
    expect(r.bossToMove()).toBe(false);
    expect(r.alfilStep()).toBeNull();
    expect(r.boards.get(0)!.history.length).toBe(plies);
    expect(v.lastMove).toBeNull();
    expect(v.board.lastMove ?? null).toBeNull();
    // The crowd's turn has begun (its powers set), the fusion's moment first among its moments.
    expect(p.turn).toBe(turnBefore + 1);
    expect(p.events.find((e) => e.kind === "fuse")).toEqual({ kind: "fuse", turn: p.turn, squares: [...p.fusion!.from], square: p.fusion!.to });
    // On: your move, then his next turn (his 3rd: from the first, every other, the next cast), a move after it.
    const done = await turn(r);
    expect(done).toEqual(["tusks"]);
    expect(r.boss!.powers!.tusks!.turn).toBe(3);
    expect(r.boards.get(0)!.history.length).toBe(plies + 2);
  });

  it("never a square where it leaves your material hanging (Big Boy's rule: the crowd sees the pawns glow, never the square)", () => {
    // d5 is attacked by the crowd's e4 pawn: an elephant there would just be taken, and it hits nothing; a6 is fine.
    expect(fusionOptions("7k/8/p7/3p4/4P3/8/8/6K1 b - - 0 1", ["a6", "d5"], "b").map((o) => o.at)).toEqual(["a6", "d5"]);
    // An elephant on b7 would hit the crowd's undefended knight on f3; on a6, nothing.
    const fork = "7k/1p6/p7/8/8/5N2/8/6K1 b - - 0 1";
    expect(fusionOptions(fork, ["a6", "b7"], "b").map((o) => o.at)).toEqual(["a6"]);
    // Lifting a pawn that blocked his rook's way onto your knight: only where the elephant takes its place.
    expect(fusionOptions("7k/8/8/8/3r1p1N/8/p7/6K1 b - - 0 1", ["a2", "f4"], "b").map((o) => o.at)).toEqual(["f4"]);
  });

  it("a square that would let him mate next is allowed: the fusion is his move, the crowd sees the elephant and answers it", () => {
    // With a7 and c7 gone and the elephant on c7, Ra1 would mate (h2 covered): your move comes first.
    const fen = "r5k1/p1p5/8/8/8/8/6P1/7K b - - 0 1";
    expect(mateInOne("r5k1/2b5/8/8/8/8/6P1/7K b - - 0 1")).toBe("a8a1");
    expect(fusionOptions(fen, ["a7", "c7"], "b").map((o) => o.at)).toEqual(["a7", "c7"]);
    expect(legalMoves(fusionOptions(fen, ["a7", "c7"], "b")[1]!.fen)).toContain("g2g3");
  });

  it("no engine answer, or one that isn't a way to go (an older app's move): the fusion still comes, on the first square allowed", () => {
    const fen = "4k3/p6p/8/8/8/8/P7/4K3 b - - 0 1";
    for (const pick of [null, "", "8/8/8/8/8/8/8/K6k b - - 0 1", "e8e7"]) {
      const b = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "h7"] } });
      alfilBattle.apply(b, pick);
      expect(powersOf(b)).toMatchObject({ tusks: null, fusion: { from: ["a7", "h7"], to: "a7" }, elephants: ["a7"], fused: 1 });
      expect(powersOf(b).fusion!.why).toBeUndefined();
      expect(pieceAt(b.board().fen, "a7")).toEqual({ color: "b", type: "b" });
      expect(pieceAt(b.board().fen, "h7")).toBeNull();
    }
  });

  it("one way allowed: no engine needed, that one; none: it fails there (the pawns stay), with no moment, and he moves", () => {
    const one = battleAt("4k3/p3p2p/8/8/8/8/8/4R2K b - - 0 1", { tusks: { turn: 3, at: 4, pawns: ["a7", "e7"] } });
    expect(alfilBattle.candidates(one)).toHaveLength(1);
    expect(alfilBattle.needsEngine(one)).toBe(false);
    alfilBattle.apply(one, null);
    expect(powersOf(one).fusion!.to).toBe("e7");
    const none = battleAt("4k3/p3p3/8/2K5/8/8/8/4R3 b - - 0 1", { tusks: { turn: 3, at: 4, pawns: ["a7", "e7"] } });
    expect(alfilBattle.needsEngine(none)).toBe(false);
    alfilBattle.apply(none, null);
    expect(powersOf(none)).toMatchObject({ tusks: null, fusion: { to: null, why: "nowhere" } });
    expect(powersOf(none).elephants ?? []).toEqual([]);
    expect(powersOf(none).events.some((e) => e.kind === "fuse")).toBe(false);
    expect(none.board().fen).toBe("4k3/p3p3/8/2K5/8/8/8/4R3 b - - 0 1");
    expect(none.bossToMove()).toBe(true);
  });

  it("the fusion is a full move passed when he's Black: the move number goes up, as after Black's move; as White it stays", () => {
    // (Hollow's pass is the crowd's, White's: its number stays, as before.)
    expect(passTurn("4k3/p6p/8/8/8/8/P7/4K3 b - - 0 7")).toBe("4k3/p6p/8/8/8/8/P7/4K3 w - - 0 8");
    expect(passTurn("4k3/p6p/8/8/8/8/P7/4K3 w - - 0 7")).toBe("4k3/p6p/8/8/8/8/P7/4K3 b - - 0 7");
    expect(fusedFen("4k3/p6p/8/8/8/8/P7/4K3 b - - 3 7", ["a7", "h7"], "a7", "b")).toBe("4k3/b7/8/8/8/8/P7/4K3 w - - 0 8");
    expect(fusedFen("4k3/p7/8/8/8/8/P6P/4K3 w - - 3 7", ["a2", "h2"], "a2", "w")).toBe("4k3/p7/8/8/8/8/B7/4K3 b - - 0 7");
  });

  it("in check as his turn begins: the fusion waits, the marks staying; he answers the check with a move, and it comes on his next turn", () => {
    // Your rook on e1 checks his king on e8; his a7 and h7 are marked.
    const fen = "4k3/p6p/8/8/8/8/8/4R2K b - - 0 1";
    const b = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "h7"] } });
    expect(alfilBattle.step(b)).toBeNull();
    expect(powersOf(b).tusks).toEqual({ turn: 3, at: 4, pawns: ["a7", "h7"] });
    expect(powersOf(b).fusion ?? null).toBeNull();
    // His move out of check, then yours (it takes neither: the counter is as ever), then his turn: the fusion.
    const board = b.board();
    b.boards.set(0, { ...(board as never as object), fen: applyMove(fen, "e8d8"), history: [...board.history, "e8d8"] } as never);
    alfilBattle.afterHisMove(b, "e8d8");
    crowdMoves(b, "h1h2");
    expect(powersOf(b).tusks!.pawns).toEqual(["a7", "h7"]);
    expect(alfilBattle.step(b)).toBe("fuse");
    expect(alfilBattle.apply(b, null)).toBe("fuse");
    expect(powersOf(b)).toMatchObject({ tusks: null, fusion: { from: ["a7", "h7"], to: "a7" }, elephants: ["a7"], fused: 1 });
  });

  it("the God King's strike just before a fusion hits it: the worse of the two squares for him, the strike spent on it", async () => {
    const fen = "4k3/p6p/8/8/8/8/P7/4K3 b - - 0 1";
    const staggered = () => {
      const b = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "h7"] } });
      b.state = { ...b.state, boss: { ...b.state.boss!, staggerNext: true } };
      return b;
    };
    // The engine's pick is h7 (the host's answer): staggered, the elephant lands on a7, the square it didn't pick.
    const b = staggered();
    const options = alfilBattle.candidates(b);
    expect(alfilBattle.apply(b, options[1]!)).toBe("fuse");
    expect(powersOf(b).fusion!.to).toBe("a7");
    expect(b.state.boss!.staggerNext).toBe(false);
    // Picked a7: h7.
    const c = staggered();
    alfilBattle.apply(c, options[0]!);
    expect(powersOf(c).fusion!.to).toBe("h7");
    // Not staggered: the pick.
    const plain = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "h7"] } });
    alfilBattle.apply(plain, options[1]!);
    expect(powersOf(plain).fusion!.to).toBe("h7");
    // One square allowed: that one, as ever, and the strike is spent; no engine's answer: the first, spent too.
    const one = battleAt("4k3/p3p2p/8/8/8/8/8/4R2K b - - 0 1", { tusks: { turn: 3, at: 4, pawns: ["a7", "e7"] } });
    one.state = { ...one.state, boss: { ...one.state.boss!, staggerNext: true } };
    alfilBattle.apply(one, null);
    expect(powersOf(one).fusion!.to).toBe("e7");
    expect(one.state.boss!.staggerNext).toBe(false);
    const none = staggered();
    alfilBattle.apply(none, null);
    expect(powersOf(none).fusion!.to).toBe("a7");
    expect(none.state.boss!.staggerNext).toBe(false);
    // In a battle: no "Boss staggered." over your next turn, and the crowd can call the strike again.
    const r = raid({ patch: { bossPowerTest: "tusks" } });
    await turn(r);
    const marked = r.boss!.powers!.tusks!.pawns;
    r.deal();
    expect(r.callStrike("h0").struck).toBe(true);
    const move = [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort().find((m) => !marked.includes(m.slice(2, 4)) && !kingAttacked(applyMove(fenOf(r), m), r.boss!.crowdSide === "w" ? "b" : "w"))!;
    await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
    expect(r.boss!.staggerNext).toBe(true);
    expect(r.alfilStep()).toBe("fuse");
    await r.playAlfil();
    expect(r.boss!.powers!.fusion!.to).toBeTruthy();
    expect(r.bossToMove()).toBe(false);
    expect(r.bossView()!.staggerNext).toBe(false);
    r.deal();
    expect(r.callStrike("h0").struck).toBe(true);
  });

  it("in a battle: elephants tracked as they move and dropped when taken, never more than two; every position playable and replayable", async () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = raid({ seed, patch: { bossPowerTest: "tusks" } });
      for (let t = 0; t < 16 && !r.isOver() && !r.stageComplete(); t++) {
        await turn(r);
        const board = r.boards.get(0)!;
        const p = r.boss!.powers!;
        const his = r.boss!.crowdSide === "w" ? "b" : "w";
        for (const sq of p.elephants ?? []) expect(pieceAt(board.fen, sq)).toEqual({ color: his, type: "b" });
        for (const sq of p.tusks?.pawns ?? []) expect(pieceAt(board.fen, sq)).toEqual({ color: his, type: "p" });
        expect(p.fused ?? 0).toBeLessThanOrEqual(BOSS_POWERS.tusksMax);
        expect(stockfishRefuses(board.fen)).toBeNull();
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
      }
      expect(r.boss!.powers!.fused).toBeGreaterThan(0);
    }
  });

  it("a turn with his pawns marked doesn't count for fair play; he limits nobody's moves", async () => {
    const r = raid({ patch: { bossPowerTest: "tusks" } });
    await turn(r);
    expect(r.boss!.powers!.tusks).toBeTruthy();
    expect(powerTurn(r.boss)).toBe(true);
    expect(r.crowdAllowed()).toBeNull();
    expect(bossAllowed(r.boss, fenOf(r))).toBeNull();
  });
});

describe("the Mammoth Slam: what flies", () => {
  const MID = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5";

  it("two of the crowd's pawns and one of its knights or bishops, never a queen, rook or king; slamLooks lifts, from the seed", () => {
    const list = slamCandidates(MID, "w", 7, 9);
    expect(list).toHaveLength(BOSS_POWERS.slamLooks);
    expect(slamCandidates(MID, "w", 7, 9)).toEqual(list);
    for (const c of list) {
      expect(c.pieces.map((x) => x.piece).sort()).toEqual(expect.arrayContaining(["p", "p"]));
      expect(c.pieces.filter((x) => x.piece === "n" || x.piece === "b")).toHaveLength(1);
      expect(c.pieces).toHaveLength(3);
      for (const x of c.pieces) {
        expect(pieceAt(MID, x.square)).toEqual({ color: "w", type: x.piece });
        expect(pieceAt(c.fen, x.square)).toBeNull();
      }
      expect(liftedPieces(MID, c.fen, "w")).toEqual([...c.pieces].sort((a, b) => (a.square < b.square ? -1 : 1)));
      expect(playable(c.fen)).toBe(true);
      expect(sideToMove(c.fen)).toBe("b");
    }
    expect(new Set(slamCandidates(MID, "w", 8, 9).map((c) => c.fen)).size).toBe(BOSS_POWERS.slamLooks);
  });

  it("fewer if you have fewer: one pawn and no minor, one pawn; none, nothing", () => {
    expect(slamCandidates("4k3/8/8/8/8/8/P7/R3K3 b - - 0 1", "w", 1, 9).map((c) => c.pieces)).toEqual([[{ piece: "p", square: "a2" }]]);
    expect(slamCandidates("4k3/8/8/8/8/8/8/R2QK3 b - - 0 1", "w", 1, 9)).toEqual([]);
  });

  it("never a piece whose lift leaves your king in check (a blocker: it's his move); a lone blocker: two pawns alone", () => {
    // Your knight on e2 blocks his rook on e8; your bishop on d2 doesn't.
    const two = "4r1k1/8/8/8/8/8/PP1BNPPP/4K3 b - - 0 1";
    for (let seed = 0; seed < 20; seed++) for (const c of slamCandidates(two, "w", seed, 9)) {
      expect(c.pieces.map((x) => x.square)).not.toContain("e2");
      expect(kingAttacked(c.fen, "w")).toBe(false);
    }
    const lone = "4r1k1/8/8/8/8/8/PP2NPPP/4K3 b - - 0 1";
    const list = slamCandidates(lone, "w", 3, 9);
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) expect(c.pieces.map((x) => x.piece)).toEqual(["p", "p"]);
  });

  it("a check on his king (your last move gave it) doesn't stop the Slam; a lift never adds a check on him", () => {
    // Your queen on e2 checks his king on e8 (the review's position): lifts are weighed as ever.
    const checked = "rnb1kbnr/pppp1ppp/8/8/8/2N2N2/PPPPQPPP/R1B1KB1R b KQkq - 0 5";
    expect(kingAttacked(checked, "b")).toBe(true);
    const list = slamCandidates(checked, "w", 1, 4);
    expect(list).toHaveLength(BOSS_POWERS.slamLooks);
    for (const c of list) {
      expect(playable(c.fen)).toBe(true);
      expect(kingAttacked(c.fen, "w")).toBe(false);
    }
    // In check from your queen, with your b5 pawn between your a4 bishop and his king: a lift with that pawn but not
    // the bishop would add the bishop's check, so never; with both, or without the pawn, it's weighed.
    const two = "4k3/8/8/1P6/B7/8/PPPPQPPP/4K3 b - - 0 1";
    let seen = 0;
    for (let seed = 0; seed < 20; seed++)
      for (const c of slamCandidates(two, "w", seed, 4)) {
        const up = c.pieces.map((x) => x.square);
        if (up.includes("b5")) expect(up).toContain("a4");
        expect(playable(c.fen)).toBe(true);
        seen++;
      }
    expect(seen).toBeGreaterThan(0);
  });

  it("a crowd pawn that has just made its double step takes its en passant square up with it", () => {
    const fen = "4k3/8/8/8/3pP3/8/1P3P2/1N2K3 b - e3 0 3";
    const c = slamCandidates(fen, "w", 2, 9).find((x) => x.pieces.some((p) => p.square === "e4"));
    expect(c).toBeTruthy();
    expect(c!.fen.split(" ")[3]).toBe("-");
    expect(editedFen(fen, new Map([...Object.entries({ e8: "k", d4: "p", e4: "P", e1: "K" })]))).toContain(" e3 ");
  });
});

describe("the Mammoth Slam: the swing cap", () => {
  it("measures the loss in pawns of log-odds once they're down, and picks nearest the target in the band; else the nearest below; never past the cap or a mate", () => {
    const s = { slamLoss: [0.25, 1.5] as const, slamTarget: 0.75, bouncePawnLogit: 0.95 };
    const at = (loss: number) => 1 / (1 + Math.exp(-(Math.log(0.5 / 0.5) - loss * 0.95)));
    expect(slamPawnsLost(0.5, at(1))).toBeCloseTo(1, 6);
    const pick = (losses: (number | "mate")[]) => pickSlam(0.5, losses.map((l, i) => (l === "mate" ? { fen: `f${i}`, crowd: 0, mate: true as const } : { fen: `f${i}`, crowd: at(l) })), s);
    expect(pick([0.1, 0.7, 1.4, 2])).toMatchObject({ fen: "f1" });
    expect(pick([0.1, 0.2, 3, 2])).toMatchObject({ fen: "f1" });
    expect(pick([-0.3, 3])).toMatchObject({ fen: "f0" });
    expect(pick([3, 2, "mate"])).toBeNull();
    expect(pick(["mate", 0.8])).toMatchObject({ fen: "f1" });
    expect(pick([])).toBeNull();
  });

  it("plays the turns out with the engine (his move, then the crowd's and his, slamTurns times), puts them down, and scores that", async () => {
    const fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5";
    const list = slamCandidates(fen, "w", 7, 9).map((c) => c.fen);
    const seen: string[] = [];
    const base = fakeEngine();
    const engine: EngineLike = { ...base, topMoves: async (f, n) => (seen.push(f), base.topMoves(f, n)) };
    const pick = await slamFrom([engine], fen, list);
    // The position before, then each candidate's line: at least its own start, and a position with the pieces back.
    expect(seen[0]).toBe(fen);
    for (const c of list) expect(seen).toContain(c);
    if (pick) expect(list).toContain(pick.fen);
    // A forced mate against you on the way: never that one.
    const mates = fakeEngine(undefined, (f) => (f === list[0] ? 2 : undefined));
    const p2 = await slamFrom([mates], fen, list, { ...BOSS_POWERS, slamLoss: [-99, 99], slamTarget: 0 });
    expect(p2?.fen).not.toBe(list[0]);
    expect(await slamFrom([], fen, list)).toBeNull();
  });
});

describe("the Mammoth Slam: the landing", () => {
  it("back on their own squares when they're free", () => {
    const fen = "4k3/8/8/8/8/8/5PPP/6K1 w - - 0 1";
    const down = landing(fen, [{ piece: "p", square: "a2" }, { piece: "b", square: "c1" }, { piece: "n", square: "b1" }], "w");
    expect(down.landed).toEqual(expect.arrayContaining([{ piece: "p", from: "a2", to: "a2" }, { piece: "b", from: "c1", to: "c1" }, { piece: "n", from: "b1", to: "b1" }]));
    expect(down.stuck).toEqual([]);
    expect(pieceAt(down.fen, "c1")).toEqual({ color: "w", type: "b" });
  });

  it("taken: the nearest empty square, a bishop on its color, a pawn never on the first or last rank", () => {
    // His knights sit on a2 and c1. The pawn: a1 and b1 are nearer than b3 but on the first rank; a3 and b2 are as near
    // (a3 first by name). The bishop (dark-squared): b1 and d1 are light; b2 and d2 are dark, b2 first.
    const fen = "4k3/8/8/8/8/8/n4PPP/2n3K1 w - - 0 1";
    const down = landing(fen, [{ piece: "p", square: "a2" }, { piece: "b", square: "c1" }], "w");
    expect(down.landed).toEqual([{ piece: "p", from: "a2", to: "a3" }, { piece: "b", from: "c1", to: "b2" }]);
    const light = (sq: string) => (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 0;
    expect(light("b2")).toBe(light("c1"));
    expect(playable(down.fen)).toBe(true);
    // The first rank's squares only for a piece: a lone pawn whose square is taken never lands there, however near.
    const low = landing("4k3/8/8/8/8/8/1n6/K7 w - - 0 1", [{ piece: "p", square: "b2" }], "w");
    expect(Number(low.landed[0]!.to[1])).toBeGreaterThan(1);
  });

  it("never giving check, never hanging when another square avoids it (Big Boy's rule), never leaving the side to move without a move", () => {
    // Your knight's own square (f3) is taken; the nearest squares around it: e5 would check his king on d7... it skips
    // any square giving check, and any where it's simply taken when a safe one is near.
    const fen = "8/3k4/8/8/8/4pr2/8/4K3 w - - 0 1";
    const down = landing(fen, [{ piece: "n", square: "f3" }], "w");
    const to = down.landed[0]!.to;
    const after = down.fen;
    expect(kingAttacked(after, "b")).toBe(false);
    // Not where his pawn or rook simply takes it (a square neither attacks was there to choose).
    const c = new Map<string, string>();
    for (const m of legalMoves(after.replace(" w ", " b "))) c.set(m.slice(2, 4), m);
    expect(c.has(to)).toBe(false);
    expect(playable(after)).toBe(true);
  });

  it("a piece landing on the en passant square takes it away (no capture onto a piece): your pawn lands on its own square", () => {
    // His e-pawn has just made its double step past e6, your airborne pawn's own square.
    const fen = "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 2";
    const down = landing(fen, [{ piece: "p", square: "e6" }], "w");
    expect(down.landed).toEqual([{ piece: "p", from: "e6", to: "e6" }]);
    expect(down.fen).toBe("4k3/8/4P3/3Pp3/8/8/8/4K3 w - - 0 2");
    expect(playable(down.fen)).toBe(true);
    expect(editedFen(fen, new Map(Object.entries({ e8: "k", e6: "P", d5: "P", e5: "p", e1: "K" })))).toContain(" w - - ");
  });

  it("as the crowd turn they're due begins (after his move): an event, the landing's squares, the meter free to fill again", async () => {
    const r = raid({ patch: { bossPowerTest: "slam" }, seed: 3 });
    await turn(r);
    const warned = r.bossView()!;
    expect(warned.powers!.warned).toBe(true);
    const done = await turn(r);
    expect(done).toContain("slam");
    const p = r.boss!.powers!;
    const at = p.slam!.at;
    expect(p.slam!.lands).toBe(at + 1 + BOSS_POWERS.slamTurns);
    const up = p.airborne ?? [];
    // (It may lift nothing if no lift is within the cap; this seed's lifts one.)
    expect(up.length).toBeGreaterThan(0);
    const shadows: number[] = [];
    for (let i = 0; i < BOSS_POWERS.slamTurns; i++) {
      const v = r.bossView()!.powers!;
      expect(v.airborne!.map((x) => x.square)).toEqual(up.map((x) => x.square));
      shadows.push(v.airborne![0]!.stage);
      expect(v.airborne![0]!.left).toBe(BOSS_POWERS.slamTurns - i);
      expect(v.paused).toBe(true);
      expect(v.rage).toBe(0);
      if (i < BOSS_POWERS.slamTurns - 1) await turn(r);
    }
    expect(shadows).toEqual([1, 2, 3]);
    await turn(r);
    const v = r.bossView()!.powers!;
    expect(v.airborne).toEqual([]);
    expect(v.landed).toMatchObject({ turn: at + 1 + BOSS_POWERS.slamTurns });
    expect(v.events.find((e) => e.kind === "land")!.squares).toEqual(v.landed!.pieces.map((x) => x.to));
    for (const x of v.landed!.pieces) expect(pieceAt(fenOf(r), x.to)?.color).toBe(r.boss!.crowdSide);
    expect(v.ultAt).toBeNull();
    expect(v.ults).toBe(1);
  });

  it("down early, at the start of his turn, when he has a mate in one only because they're up", () => {
    // Re1 is mate with your bishop up; with it back on d2 it isn't.
    const fen = "4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1";
    expect(mateInOne(fen)).toBe("e8e1");
    const before = "4r1k1/5ppp/8/8/8/8/P4PPP/6K1 w - - 0 1";
    const b = battleAt(before, { airborne: [{ piece: "b", square: "d2" }], slam: { at: 2, pieces: [{ piece: "b", square: "d2" }], lands: 6, loss: 0.5 }, ultAt: 2 }, { crowdMoves: 3 });
    crowdMoves(b, "a2a3");
    const p = powersOf(b);
    expect(p.airborne).toBeNull();
    expect(p.landed).toEqual({ turn: 3, at: 4, pieces: [{ piece: "b", from: "d2", to: "d2" }], early: true });
    expect(p.events.at(-1)).toEqual({ kind: "land", turn: 3, squares: ["d2"] });
    expect(mateInOne(b.board().fen)).toBeNull();
    expect(b.board().bases!.at(-1)!.fen).toBe(b.board().fen);
    // A mate in one they can't stop: they stay up.
    const c = battleAt(before, { airborne: [{ piece: "p", square: "c2" }], slam: { at: 2, pieces: [{ piece: "p", square: "c2" }], lands: 6, loss: 0.5 }, ultAt: 2 }, { crowdMoves: 3 });
    crowdMoves(c, "a2a3");
    expect(powersOf(c).airborne).toEqual([{ piece: "p", square: "c2" }]);
  });

  it("near the battle's last move: they land by the crowd's last turn at the latest (its result counts them)", () => {
    const fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5";
    const b = battleAt(fen, { warnAt: 58, fused: 2 }, { crowdMoves: 58, maxMoves: 60 });
    expect(alfilBattle.step(b)).toBe("slam");
    alfilBattle.apply(b, alfilBattle.candidates(b)[0]!, 0.5);
    expect(powersOf(b).slam!.lands).toBe(60);
  });
});

describe("the Mammoth Slam: when", () => {
  it("the meter full: RAGE! as a turn begins; at the start of his turn after your move, the Slam, then his move; the meter spent", async () => {
    const r = raid({ patch: { bossPowerTest: "slam" } });
    await turn(r);
    expect(r.boss!.powers!.warnAt).toBe(2);
    expect(slamDue(r.boss)).toBe(false);
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(slamDue(r.boss)).toBe(true);
    expect(r.alfilStep()).toBe("slam");
    expect(r.alfilNeedsEngine()).toBe(true);
    const plies = r.boards.get(0)!.history.length;
    await r.playAlfil();
    // Not a move: his move comes after it.
    expect(r.boards.get(0)!.history.length).toBe(plies);
    expect(r.bossToMove()).toBe(true);
    expect(r.alfilStep()).toBeNull();
    expect(r.boss!.powers).toMatchObject({ ultAt: 2, ults: 1 });
    expect(r.boss!.powers!.events.at(-1)!.kind).toBe("slam");
    await r.playBoss();
    expect(r.boards.get(0)!.history.length).toBe(plies + 1);
  });

  it("a Slam that lifts nothing keeps the meter and shows nothing: it comes again at the start of his next turn", async () => {
    // Every lift weighed has a mate against you on the way: none can go.
    const mates = fakeEngine(undefined, () => 1);
    const even = fakeEngine(() => 0.5);
    const r = raid({ patch: { bossPowerTest: "slam" } });
    await turn(r);
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(r.alfilStep()).toBe("slam");
    const fen = fenOf(r);
    const events = r.boss!.powers!.events.length;
    expect(await r.playAlfil([mates])).toBeNull();
    const p = r.boss!.powers!;
    expect(fenOf(r)).toBe(fen);
    expect(p.ultAt).toBeUndefined();
    expect(p.ults ?? 0).toBe(0);
    expect(p.slam ?? null).toBeNull();
    expect(p.airborne ?? null).toBeNull();
    expect(p.events).toHaveLength(events);
    expect(r.bossView()!.powers!.warned).toBe(true);
    // Not again this turn: his move.
    expect(r.alfilStep()).not.toBe("slam");
    expect(r.bossToMove()).toBe(true);
    await r.playBoss();
    expect(r.bossView()!.powers!.warned).toBe(true);
    // Your move, then his turn: the Slam again, and this time it lifts; the meter spent then.
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(r.alfilStep()).toBe("slam");
    expect(await r.playAlfil([even])).toBe("slam");
    expect(r.boss!.powers!.airborne!.length).toBeGreaterThan(0);
    expect(r.boss!.powers!).toMatchObject({ ultAt: r.boss!.crowdMoves, ults: 1 });
    expect(r.boss!.powers!.events.at(-1)!.kind).toBe("slam");
    // The admins' trigger the same: kept for his next turn. (Both elephants made: no cast after it.)
    const b = battleAt("r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5", { ultNext: true, fused: 2 });
    expect(alfilBattle.step(b)).toBe("slam");
    expect(alfilBattle.apply(b, null)).toBeNull();
    expect(powersOf(b)).toMatchObject({ ultNext: true, slamWait: 4 });
    expect(alfilBattle.step(b)).toBeNull();
    expect(slamDue({ ...b.state.boss!, crowdMoves: 5 })).toBe(true);
  });

  it("the admins' trigger while the host weighs another step: that pick is dropped, nothing changes, and the Slam is asked for", () => {
    const fen = "4k3/p6p/8/8/8/8/P7/4K3 b - - 0 1";
    const b = battleAt(fen, { tusks: { turn: 3, at: 4, pawns: ["a7", "h7"] } });
    expect(alfilBattle.step(b)).toBe("fuse");
    const pick = alfilBattle.candidates(b)[1]!;
    // (The trigger, pulled while the host's engine works.)
    b.state = { ...b.state, boss: { ...b.state.boss!, powers: { ...powersOf(b), ultNext: true } } };
    expect(alfilBattle.step(b)).toBe("slam");
    expect(alfilBattle.apply(b, pick, null, "fuse")).toBeNull();
    expect(b.board().fen).toBe(fen);
    expect(powersOf(b)).toMatchObject({ tusks: { pawns: ["a7", "h7"] }, ultNext: true });
    expect(powersOf(b).ultAt).toBeUndefined();
    expect(powersOf(b).ults ?? 0).toBe(0);
    expect(powersOf(b).slamWait).toBeUndefined();
    expect(alfilBattle.step(b)).toBe("slam");
  });

  it("the admins' trigger: at the start of his next turn, without the warning; never while pieces are up", async () => {
    const r = raid();
    await turn(r);
    expect(r.triggerUltimate()).toBe(true);
    const done = await turn(r);
    expect(done).toContain("slam");
    expect(r.boss!.powers!.warnAt).toBeUndefined();
    if (r.boss!.powers!.airborne?.length) expect(r.triggerUltimate()).toBe(false);
  });
});

describe("Alfil's view and timing", () => {
  it("the boss view carries his fields (optional: older apps ignore them), as JSON", async () => {
    const r = raid({ patch: { bossPowerTest: "tusks" } });
    await turn(r);
    await turn(r);
    const v = r.bossView() as NetBoss;
    const p = JSON.parse(JSON.stringify(v)).powers;
    expect(p).toHaveProperty("tusks");
    expect(p).toHaveProperty("fusion");
    expect(p.elephants).toEqual(r.boss!.powers!.elephants ?? []);
    expect(p).toHaveProperty("slam");
    expect(p.airborne).toEqual([]);
    expect(p).toHaveProperty("landed");
  });

  it("the airborne list: each piece's own square (where it lands), the turn it lands, the turns left and its shadow's size", () => {
    const p = { airborne: [{ piece: "n", square: "f3" }], slam: { at: 9, pieces: [{ piece: "n", square: "f3" }], lands: 13, loss: 0.5 }, turn: 9 };
    expect(airborneView(p)).toEqual([{ piece: "n", square: "f3", lands: 13, left: 3, stage: 1 }]);
    expect(airborneView({ ...p, turn: 10 })[0]).toMatchObject({ left: 3, stage: 1 });
    expect(airborneView({ ...p, turn: 11 })[0]).toMatchObject({ left: 2, stage: 2 });
    expect(airborneView({ ...p, turn: 12 })[0]).toMatchObject({ left: 1, stage: 3 });
    expect(airborneView({ ...p, airborne: null })).toEqual([]);
  });

  it("his moments' lengths are the server's and the screens' (POWER_FX); QUEEN SLAIN! never again after one of his steps", () => {
    for (const k of ["tusks", "fuse", "slam", "land"] as const) expect(POWER_FX[k]).toBe(ALFIL_FX[k]);
    // Your move took his queen; then his cast played: the thinking for his move is the turn's second.
    const board = { history: ["d1d8"], bases: [{ ply: 0, fen: "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1" }] };
    const view = { crowdSide: "w" as const, crowdMoves: 5, board, powers: { events: [] as { kind: string }[] } };
    expect(queenSlain(view)).toBe(true);
    expect(queenSlain({ ...view, powers: { events: [{ kind: "tusks" }] } })).toBe(false);
    expect(queenSlain({ ...view, powers: { events: [{ kind: "slam" }] } })).toBe(false);
    // His fusion that found no square after your move is a step (no screen); one that landed was his move, as your turn
    // began, and the counter is your move: neither is.
    expect(queenSlain({ ...view, powers: { events: [], fusion: { at: 5, why: "nowhere" } } })).toBe(false);
    expect(queenSlain({ ...view, powers: { events: [{ kind: "fuse" }], fusion: { at: 4 } } })).toBe(true);
    expect(queenSlain({ ...view, powers: { events: [], fusion: { at: 5, why: "taken" } } })).toBe(true);
    // His pieces came down early after your move: his first thinking waits for it.
    const early = { crowdMoves: 5, powers: { landed: { early: true as const, at: 5 }, events: [] } };
    expect(landedEarlyMs(early)).toBe(POWER_FX.land);
    expect(bossThinkMs({ ...view, powers: { events: [] } }, false, landedEarlyMs(early))).toBe(Math.max(POWER_FX.land, 1200 + 0, bossThinkMs(view)));
    expect(landedEarlyMs({ ...early, powers: { ...early.powers, events: [{ kind: "slam" }] } })).toBe(0);
    expect(landedEarlyMs({ ...early, powers: { ...early.powers, fusion: { at: 5, why: "nowhere" } } })).toBe(0);
    expect(landedEarlyMs({ ...early, powers: { ...early.powers, events: [{ kind: "fuse" }], fusion: { at: 4 } } })).toBe(POWER_FX.land);
    expect(landedEarlyMs({ ...early, crowdMoves: 6 })).toBe(0);
  });
});

describe("Alfil: the ground rules, over many battles", () => {
  it("every step and move leaves a position the engine plays, with a move for the side to move or a real ending; replays match", async () => {
    for (const seed of [11, 12, 13]) {
      const r = raid({ seed, patch: { bossPowerTest: seed === 12 ? "tusks" : "slam" } });
      for (let t = 0; t < 24 && !r.isOver() && !r.stageComplete(); t++) {
        r.deal();
        await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
        if (r.isOver() || r.stageComplete()) break;
        for (let s = r.alfilStep(); s; s = r.alfilStep()) {
          await r.playAlfil();
          const board = r.boards.get(0)!;
          expect(stockfishRefuses(board.fen)).toBeNull();
          expect(legalMoves(board.fen).length).toBeGreaterThan(0);
          expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
          expect(kingAttacked(board.fen, r.boss!.crowdSide)).toBe(false);
          expect(kingAttacked(board.fen, r.boss!.crowdSide === "w" ? "b" : "w") && !r.bossToMove()).toBe(false);
        }
        // (His fusion is his move: then his turn is over.)
        if (r.bossToMove()) await r.playBoss();
        const board = r.boards.get(0)!;
        expect(stockfishRefuses(board.fen)).toBeNull();
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
        // (Each crowd turn: the meter's trigger again once nothing's up, so the Slam comes again and again.)
        if (!r.boss!.powers!.airborne?.length) r.triggerUltimate();
      }
    }
  });

  it("a runner restored from its snapshot (as every lobby event restores it) works his steps out the same", async () => {
    const r = raid({ patch: { bossPowerTest: "slam" } });
    await turn(r);
    r.deal();
    await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
    expect(r.alfilStep()).toBe("slam");
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "alfil", bossUnfinished: true, lastStandFrom: 999, bossPowerTest: "slam" } as Settings;
    const restored = MatchRunner.restore(structuredClone(r.snapshot()), { settings, rng: mulberry32(5), engines: [fakeEngine()], library: [opening(LINE)] });
    expect(restored.alfilStep()).toBe("slam");
    expect(restored.alfilCandidates()).toEqual(r.alfilCandidates());
  });
});
