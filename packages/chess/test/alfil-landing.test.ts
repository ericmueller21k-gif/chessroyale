import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossBrain, type BossPowerState, type BossState, type Settings, type SlamPiece } from "@chessroyale/core";
import {
  DEFAULT_BOSS_GUARD,
  MatchRunner,
  START_FEN,
  alfilBattle,
  applyMove,
  bossMoveFrom,
  brainLine,
  fuseFrom,
  fusionOptions,
  initPowers,
  landing,
  landingGuard,
  landsAfterHisMove,
  legalMoves,
  pieceAt,
  sanLineToUci,
  sideToMove,
  slamAhead,
  type Battle,
  type BossAhead,
  type BossMoveKind,
  type BrainNote,
  type EngineLike,
  type HumanEngineLike,
  type MoveScore,
  type Opening,
  type UciEngine,
} from "../src/index.ts";
import { createNodeEngine } from "../src/node.ts";

/**
 * Alfil sees his Mammoth Slam's pieces coming down (Eric, after playing him: "can we make the engine think, the turn
 * before the pieces land, that they're there? Because he put his queen right where the pawn dropped next turn, and I
 * captured it for free"; docs/decisions/2026-10-17-alfil-sees-the-landing.md). His moves still come from the board as
 * it is; on his move just before they land, each is judged with them down (the landing guard).
 */

/**
 * Eric's kind of position: the crowd (White) is far behind with two pawns and a bishop up (a3, d4, c1), and they land
 * after his move. His queen can take your knight on e5: on this board it wins a piece; with your d-pawn back on d4 it
 * hangs the queen to dxe5.
 */
const ERIC = "rn3rk1/pbp2ppp/1p1q4/4N3/8/8/1PP2PPP/R2Q2K1 b - - 0 15";
const UP: SlamPiece[] = [
  { piece: "p", square: "a3" },
  { piece: "p", square: "d4" },
  { piece: "b", square: "c1" },
];
const QXE5 = "d6e5";

/** The real engine, with the brain's pick (Stockfish's limited-strength move) scripted. */
const picking = (engine: UciEngine, pick: string): EngineLike => ({
  topMoves: (fen, n) => engine.topMoves(fen, n),
  topMovesAt: (fen, n, nodes) => engine.topMovesAt(fen, n, nodes),
  scoreMoves: (fen, moves) => engine.scoreMoves(fen, moves),
  playAtElo: async () => pick,
});

/** A stand-in Maia that always plays `move`. */
const maiaPlaying = (move: string): HumanEngineLike => ({
  ready: () => true,
  candidates: async () => ({ best: move, moves: [{ move, p: 0.9 }], ms: 5 }),
});

const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });

/** A Boss alone against Alfil, put on `fen` (him to move, the crowd White) with `powers` on top: his move is next. */
function alfilAt(engine: EngineLike, fen: string, powers: Partial<BossPowerState>, crowdMoves = 14): MatchRunner {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossStumbleBelow: 0, bossId: "alfil", lastStandFrom: 999 } as Settings;
  const r = new MatchRunner({ settings, rng: mulberry32(5), engines: [engine], library: [opening(LINE)], entrants: [{ id: "h0", name: "H", isBot: false }] });
  const id = r.state.boards[0]!;
  const board = r.boards.get(id)!;
  r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
  const boss = r.state.boss!;
  r.state = { ...r.state, boss: { ...boss, crowdSide: "w", crowdMoves, powers: { ...initPowers(1, fen, "w"), turn: crowdMoves, ...powers } } };
  return r;
}
/** The Slam's pieces up since crowd move `at`, landing as crowd turn `lands` begins. */
const up = (pieces: SlamPiece[], at: number, lands: number): Partial<BossPowerState> => ({ ultAt: at, slam: { at, pieces, lands, loss: 0.5 }, airborne: pieces });

describe("the landing guard: Eric's position, on the real engine", () => {
  let engine: UciEngine;
  beforeAll(async () => {
    engine = await createNodeEngine({ nodes: 100_000, hashMb: 16 });
  }, 60_000);
  afterAll(() => engine?.close());

  it("the pieces land where the rules put them: your d-pawn back on d4, attacking e5", () => {
    const down = slamAhead(UP).after(applyMove(ERIC, QXE5));
    expect(down).toBe(landing(applyMove(ERIC, QXE5), UP, "w").fen);
    expect(pieceAt(down, "d4")).toEqual({ color: "w", type: "p" });
    expect(legalMoves(down)).toContain("d4e5");
  });

  it("before, his queen takes your knight where your pawn lands next turn; with the landing guard, it doesn't", async () => {
    // (Without the look ahead: today's move, the knight taken, as Eric saw.)
    expect(await bossMoveFrom(picking(engine, QXE5), ERIC, 1500, 100_000, "elo")).toBe(QXE5);
    const seen: { pick: string; move: string; searched: number }[] = [];
    const ahead: BossAhead = { ...slamAhead(UP), onCheck: (c) => seen.push(c) };
    const move = await bossMoveFrom(picking(engine, QXE5), ERIC, 1500, 100_000, "elo", Math.random, [5, 15], DEFAULT_BOSS_GUARD, null, undefined, ahead);
    expect(move).not.toBe(QXE5);
    expect(legalMoves(ERIC)).toContain(move);
    expect(seen).toEqual([expect.objectContaining({ pick: QXE5, move })]);
    expect(seen[0]!.searched).toBeLessThanOrEqual(BOSS_POWERS.slamGuardLooks + 1);
    // (With them down, no pawn of yours takes his queen.)
    const down = slamAhead(UP).after(applyMove(ERIC, move));
    expect(legalMoves(down).filter((m) => pieceAt(down, m.slice(0, 2))?.type === "p" && pieceAt(down, m.slice(2, 4))?.type === "q")).toEqual([]);
  });

  it("Maia's pick too (no guard of its own): it gives way, and the admins' line says the landing guard played", async () => {
    const notes: BrainNote[] = [];
    const brain = { brain: "maia-raw" as BossBrain, rating: 1200, engine: maiaPlaying(QXE5), onNote: (n: BrainNote) => notes.push(n) };
    expect(await bossMoveFrom(picking(engine, QXE5), ERIC, 1500, 100_000, "elo", Math.random, [5, 15], DEFAULT_BOSS_GUARD, null, brain)).toBe(QXE5);
    expect(notes.at(-1)).toMatchObject({ by: "maia" });
    const move = await bossMoveFrom(picking(engine, QXE5), ERIC, 1500, 100_000, "elo", Math.random, [5, 15], DEFAULT_BOSS_GUARD, null, brain, slamAhead(UP));
    expect(move).not.toBe(QXE5);
    expect(notes.at(-1)).toMatchObject({ by: "stockfish", why: "landing" });
    expect(brainLine(notes.at(-1)!)).toBe("Maia 1200 · no guard · landing guard → Stockfish");
  });

  it("in a battle: on his move just before they land, he doesn't play it, and they land; a turn earlier he does (no look ahead)", async () => {
    const r = alfilAt(picking(engine, QXE5), ERIC, up(UP, 11, 15));
    expect(r.bossAhead()).not.toBeNull();
    const move = await r.playBoss();
    expect(move).not.toBe(QXE5);
    expect(r.landingCheck).toMatchObject({ pick: QXE5, move });
    // (They land as your turn begins, wherever his move left room for them.)
    const fen = r.boards.get(r.state.boards[0]!)!.fen;
    expect(r.boss!.powers!.airborne).toBeNull();
    const landed = r.boss!.powers!.landed!.pieces;
    expect(landed.map((x) => x.from).sort()).toEqual(["a3", "c1", "d4"]);
    for (const x of landed) expect(pieceAt(fen, x.to)?.color).toBe("w");
    expect(legalMoves(fen).filter((m) => pieceAt(fen, m.slice(0, 2))?.type === "p" && pieceAt(fen, m.slice(2, 4))?.type === "q")).toEqual([]);
    // One crowd turn earlier (they land after his next move): no look ahead, his pick as ever.
    const early = alfilAt(picking(engine, QXE5), ERIC, up(UP, 11, 16));
    expect(early.bossAhead()).toBeNull();
    expect(await early.playBoss()).toBe(QXE5);
    expect(early.landingCheck).toBeNull();
    expect(early.boss!.powers!.airborne).toEqual(UP);
  }, 60_000);
});

// ---------------- With stand-in engines ----------------

/** Every engine call, for counting what the guard adds. */
type Call = { what: "top" | "topAt" | "score" | "elo"; fen: string; nodes?: number };

/**
 * A stand-in engine: on `fen` (the real board), `top` as its top moves and `eloPick` as its limited-strength move; on
 * any other position, the side to move's expected score from `after` (by position; 0.5 if not listed).
 */
function scripted(fen: string, top: MoveScore[], eloPick: string, after: Map<string, number> = new Map(), calls: Call[] = []): EngineLike {
  const line = (f: string): MoveScore[] => (f === fen ? top : [{ move: legalMoves(f)[0] ?? "a1a1", expected: after.get(f) ?? 0.5 }]);
  return {
    topMoves: async (f, n) => (calls.push({ what: "top", fen: f }), line(f).slice(0, n)),
    topMovesAt: async (f, n, nodes) => (calls.push({ what: "topAt", fen: f, nodes }), line(f).slice(0, n)),
    scoreMoves: async (f, moves) => (calls.push({ what: "score", fen: f }), moves.map((m) => ({ move: m, expected: top.find((t) => t.move === m)?.expected ?? 0.05 }))),
    playAtElo: async (f) => (calls.push({ what: "elo", fen: f }), eloPick),
  };
}

/** A look ahead that changes nothing (a stand-in for the landing), scored by `after`. */
const sameBoard = (looks = BOSS_POWERS.slamGuardLooks): BossAhead => ({ after: (f) => f, looks, nodes: BOSS_POWERS.slamGuardNodes });

const TOP: MoveScore[] = [
  { move: "e2e4", expected: 0.52 },
  { move: "d2d4", expected: 0.5 },
  { move: "g1f3", expected: 0.47 },
  { move: "b1c3", expected: 0.44 },
  { move: "f2f3", expected: 0.3 },
];
/** After "the landing": his score after each move (the crowd's is the rest). */
const crowdAfter = (his: Record<string, number>) => new Map(Object.entries(his).map(([m, v]) => [applyMove(START_FEN, m), 1 - v]));

describe("the landing guard: never an illegal pick", () => {
  // His c-pawn could take your d-pawn if it were down; it's in the air: c5d4 isn't a move on this board.
  const fen = "4k3/8/8/2p5/8/8/8/4K3 b - - 0 40";
  const air: SlamPiece[] = [{ piece: "p", square: "d4" }];
  // (An engine that names it anyway, as if the pawn were there: first, and best.)
  const ghost: MoveScore[] = [{ move: "c5d4", expected: 0.99 }, ...legalMoves(fen).map((move) => ({ move, expected: 0.5 }))];

  it("the moves weighed are his on this board: a capture of a piece still in the air is never weighed nor played", async () => {
    expect(legalMoves(fen)).not.toContain("c5d4");
    const calls: Call[] = [];
    const check = await landingGuard(scripted(fen, ghost, "e8d7", new Map(), calls), fen, "e8d7", ghost, slamAhead(air), DEFAULT_BOSS_GUARD);
    expect(check.move).not.toBe("c5d4");
    expect(legalMoves(fen)).toContain(check.move);
    // (Each position searched comes from a legal move of his, then the landing.)
    const fromLegal = new Set(legalMoves(fen).map((m) => slamAhead(air).after(applyMove(fen, m))));
    for (const c of calls) expect(fromLegal.has(c.fen)).toBe(true);
  });

  it("whichever kind of move and brain, and the engine's own pick the ghost capture: he plays a legal move", async () => {
    const kinds: BossMoveKind[] = ["elo", "stumble", "stagger"];
    const errors = console.error;
    const refused: string[] = [];
    console.error = (m: string) => refused.push(m);
    try {
      for (const kind of kinds)
        for (const maia of [false, true]) {
          const brain = maia ? { brain: "maia-raw" as BossBrain, rating: 1200, engine: maiaPlaying("c5d4") } : undefined;
          const move = await bossMoveFrom(scripted(fen, ghost, "c5d4"), fen, 1500, 1000, kind, mulberry32(3), [5, 15], DEFAULT_BOSS_GUARD, null, brain, slamAhead(air));
          expect(legalMoves(fen)).toContain(move);
        }
    } finally {
      console.error = errors;
    }
    // (Each time the last check caught the engine's ghost move, as #266 has it.)
    expect(refused.length).toBe(kinds.length * 2);
    for (const m of refused) expect(m).toMatch(/^boss move refused: c5d4/);
  });

  it("a look ahead that throws never costs him his move: the pick stands, checked as ever", async () => {
    const broken: BossAhead = { after: () => {
      throw new Error("no board");
    }, looks: 4, nodes: 1000 };
    const errors = console.error;
    console.error = () => {};
    try {
      expect(await bossMoveFrom(scripted(START_FEN, TOP, "g1f3"), START_FEN, 1500, 1000, "elo", Math.random, [5, 15], DEFAULT_BOSS_GUARD, null, undefined, broken)).toBe("g1f3");
    } finally {
      console.error = errors;
    }
  });
});

describe("the landing guard: its rule", () => {
  it("his pick stands unless it gives away more than the blunder guard allows against the best of his top moves, judged with them down", async () => {
    // b1c3 is fine on the board (8 points under e2e4); with the pieces down it's 12 under: past the guard's 10.
    const after = crowdAfter({ e2e4: 0.52, d2d4: 0.5, g1f3: 0.47, b1c3: 0.4 });
    const check = await landingGuard(scripted(START_FEN, TOP, "b1c3", after), START_FEN, "b1c3", TOP, sameBoard(), DEFAULT_BOSS_GUARD);
    expect(check).toMatchObject({ pick: "b1c3", move: "e2e4", searched: 4 });
    // 9 under: within it, his pick.
    const close = crowdAfter({ e2e4: 0.52, d2d4: 0.5, g1f3: 0.47, b1c3: 0.43 });
    expect((await landingGuard(scripted(START_FEN, TOP, "b1c3", close), START_FEN, "b1c3", TOP, sameBoard(), DEFAULT_BOSS_GUARD)).move).toBe("b1c3");
    // The best is the highest scored with them down, not his search's first line.
    const turned = crowdAfter({ e2e4: 0.2, d2d4: 0.5, g1f3: 0.6, b1c3: 0.3 });
    expect((await landingGuard(scripted(START_FEN, TOP, "e2e4", turned), START_FEN, "e2e4", TOP, sameBoard(), DEFAULT_BOSS_GUARD)).move).toBe("g1f3");
  });

  it("looks at his pick and slamGuardLooks of his best moves: one search each, at slamGuardNodes", async () => {
    const calls: Call[] = [];
    const check = await landingGuard(scripted(START_FEN, TOP, "f2f3", new Map(), calls), START_FEN, "f2f3", TOP, sameBoard(), DEFAULT_BOSS_GUARD);
    expect(check.searched).toBe(BOSS_POWERS.slamGuardLooks + 1);
    expect(calls.map((c) => c.what)).toEqual(Array(BOSS_POWERS.slamGuardLooks + 1).fill("topAt"));
    expect(new Set(calls.map((c) => c.nodes))).toEqual(new Set([BOSS_POWERS.slamGuardNodes]));
    // (His pick among his best moves: no search twice.)
    expect((await landingGuard(scripted(START_FEN, TOP, "e2e4"), START_FEN, "e2e4", TOP, sameBoard(), DEFAULT_BOSS_GUARD)).searched).toBe(BOSS_POWERS.slamGuardLooks);
  });

  it("the King's strike keeps its own wider guard: a step back it chose isn't taken away for being one", async () => {
    // The strike's pick here is b1c3 (8 points back). With the pieces down it's 12 under the best: within the strike's 15.
    const after = crowdAfter({ e2e4: 0.52, d2d4: 0.5, g1f3: 0.47, b1c3: 0.4 });
    const strike = await bossMoveFrom(scripted(START_FEN, TOP, "e2e4", after), START_FEN, 1500, 1000, "stagger", Math.random, [5, 15], DEFAULT_BOSS_GUARD, null, undefined, sameBoard());
    expect(strike).toBe("b1c3");
    // The same pick by Stockfish at his strength: past the blunder guard's 10 with them down, so it gives way.
    expect(await bossMoveFrom(scripted(START_FEN, TOP, "b1c3", after), START_FEN, 1500, 1000, "elo", Math.random, [5, 15], DEFAULT_BOSS_GUARD, null, undefined, sameBoard())).toBe("e2e4");
  });

  it("a move that ends the game is scored by its ending (nothing lands then): his mate in one is never given up", async () => {
    // Fool's mate: Qh4 mates. The landing would put a pawn on g3, but the game is over first.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
    const top: MoveScore[] = [{ move: "d8h4", expected: 0.6 }, { move: "b8c6", expected: 0.55 }];
    const air: BossAhead = { ...slamAhead([{ piece: "p", square: "g3" }]) };
    const check = await landingGuard(scripted(fen, top, "d8h4"), fen, "d8h4", top, air, DEFAULT_BOSS_GUARD);
    expect(check.move).toBe("d8h4");
  });
});

describe("the landing guard costs nothing when no pieces are up", () => {
  it("no look ahead: the same engine calls as before, no search more", async () => {
    for (const kind of ["elo", "stumble", "stagger"] as BossMoveKind[]) {
      const a: Call[] = [];
      const b: Call[] = [];
      const m1 = await bossMoveFrom(scripted(START_FEN, TOP, "g1f3", new Map(), a), START_FEN, 1500, 1000, kind, mulberry32(9));
      const m2 = await bossMoveFrom(scripted(START_FEN, TOP, "g1f3", new Map(), b), START_FEN, 1500, 1000, kind, mulberry32(9), [5, 15], DEFAULT_BOSS_GUARD, null, undefined, null);
      expect(m2).toBe(m1);
      expect(b).toEqual(a);
      expect(a.some((c) => c.what === "topAt")).toBe(false);
    }
  });

  it("which pieces land after his move: none up, or not due yet: none; due as the crowd's next turn begins: those in the air", () => {
    const at = (powers: Partial<BossPowerState>, crowdMoves = 14, result?: string) => ({ id: "alfil", crowdSide: "w", crowdMoves, result, powers: { ...initPowers(1, ERIC, "w"), turn: crowdMoves, ...powers } }) as unknown as BossState;
    expect(landsAfterHisMove(null)).toBeNull();
    expect(landsAfterHisMove(at({}))).toBeNull();
    expect(landsAfterHisMove(at(up(UP, 11, 16)))).toBeNull();
    expect(landsAfterHisMove(at(up(UP, 11, 15)))).toEqual(UP);
    // (A piece that had nowhere to go stays up a turn: due again.)
    expect(landsAfterHisMove(at({ ...up(UP.slice(1), 11, 15) }))).toEqual(UP.slice(1));
    expect(landsAfterHisMove(at(up(UP, 11, 15), 14, "boss"))).toBeNull();
  });

  it("in a battle: his moves are searched more only on the one just before the pieces land", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "alfil", lastStandFrom: 999, bossPowerTest: "slam" } as Settings;
    const hash = (s: string) => {
      let h = 2166136261;
      for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      return (h >>> 0) / 4294967296;
    };
    const fake: EngineLike = {
      topMoves: async (f, n) => legalMoves(f).map((move) => ({ move, expected: 0.3 + 0.4 * hash(f + move) })).sort((x, y) => y.expected - x.expected || (x.move < y.move ? -1 : 1)).slice(0, n),
      scoreMoves: async (f, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: 0.3 + 0.4 * hash(f + move) })),
      playAtElo: async (f) => legalMoves(f).sort()[0]!,
    };
    const r = new MatchRunner({ settings, rng: mulberry32(3), engines: [fake], library: [opening(LINE)], entrants: [{ id: "h0", name: "H", isBot: false }] });
    const looked: { ahead: boolean; searches: number; landed: boolean }[] = [];
    for (let i = 0; i < 12 && !r.isOver() && !r.stageComplete(); i++) {
      r.deal();
      const fen = r.boards.get(r.state.boards[0]!)!.fen;
      await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fen))].sort()[0]!, thinkMs: 1000 }]]));
      if (r.isOver() || r.stageComplete()) break;
      for (let s = r.alfilStep(); s; s = r.alfilStep()) await r.playAlfil();
      if (!r.bossToMove()) continue;
      let searches = 0;
      const counting: EngineLike = { ...fake, topMovesAt: async (f, n, nodes) => (searches++, fake.topMoves(f, n)) };
      const ahead = !!r.bossAhead();
      await r.playBoss(counting);
      looked.push({ ahead, searches, landed: r.boss!.powers!.landed?.turn === r.boss!.crowdMoves + 1 && !r.boss!.powers!.landed.early });
    }
    // (This seed's Slam lifts, and they come down within the twelve turns.)
    expect(looked.filter((x) => x.landed)).toHaveLength(1);
    for (const x of looked) {
      expect(x.ahead).toBe(x.landed);
      if (!x.ahead) expect(x.searches).toBe(0);
      else expect(x.searches).toBeLessThanOrEqual(BOSS_POWERS.slamGuardLooks + 1);
    }
  });
});

// ---------------- His fusion on the turn they land ----------------

/** A battle's state as his rules see it, around `fen` (him to move, the crowd White). */
function battleAt(fen: string, powers: Partial<BossPowerState>, crowdMoves = 14): Battle {
  // (Crowd first: his moves so far are one fewer than the crowd's.)
  const history = Array.from({ length: 2 * crowdMoves - 1 }, () => "e2e4");
  const boards = new Map([[0, { id: 0, history, fen, expected: 0.5, lastMove: null, generation: 0, bases: [{ ply: history.length, fen }] } as never]]);
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS } as Settings;
  return {
    state: { boards: [0], boss: { id: "alfil", crowdSide: "w", crowdMoves, startPly: 0, powers: { ...initPowers(7, fen, "w"), turn: crowdMoves, ...powers } } as unknown as BossState } as never,
    boards,
    settings,
    bossLast: null,
    engines: [],
    alive: () => [],
    finalGameOver: () => false,
    bossToMove: () => sideToMove((boards.get(0) as unknown as { fen: string }).fen) === "b",
    crowdAllowed: () => null,
    boardOf: () => null,
    afterCrowdMove: () => {},
    bossPassed: () => {},
    memo: new Map(),
  } as unknown as Battle;
}

describe("the landing guard: his fusion just before they land", () => {
  // His a- and h-pawns are marked. Your b-pawn lands on b6 after his turn: an elephant on a7 would stand where it takes it.
  const fen = "4k3/p6p/8/8/8/8/6PP/7K b - - 0 30";
  const air: SlamPiece[] = [{ piece: "p", square: "b6" }];
  const marked = { tusks: { turn: 1, at: 13, pawns: ["a7", "h7"] } };
  /** An engine that sees an elephant on a7 beside your pawn on b6 for what it is: lost for him (the crowd to move: 0.9); else even. */
  const seesThePawn = (seen: string[] = []): EngineLike => ({
    topMoves: async (f) => (seen.push(f), [{ move: legalMoves(f)[0]!, expected: f === fen ? 0.5 : pieceAt(f, "b6") && pieceAt(f, "a7")?.type === "b" ? 0.9 : 0.5 }]),
    scoreMoves: async () => [],
  });

  it("its squares are weighed with them down; the pick is still one of its squares", async () => {
    const b = battleAt(fen, { ...marked, ...up(air, 11, 15) });
    expect(alfilBattle.step(b)).toBe("fuse");
    const ahead = alfilBattle.fusionAhead(b)!;
    expect(ahead).not.toBeNull();
    const options = fusionOptions(fen, ["a7", "h7"], "b");
    expect(options.map((o) => o.at)).toEqual(["a7", "h7"]);
    const seen: string[] = [];
    const engine = seesThePawn(seen);
    const pick = await fuseFrom([engine], fen, options.map((o) => o.fen), undefined, ahead);
    expect(pick!.fen).toBe(options[1]!.fen);
    expect(seen.slice(1)).toEqual(options.map((o) => landing(o.fen, air, "w").fen));
    // Without the look ahead the engine sees no pawn on b6: a7 and h7 alike, the first (a7).
    expect((await fuseFrom([engine], fen, options.map((o) => o.fen)))!.fen).toBe(options[0]!.fen);
  });

  it("solo and the sims: the fusion lands on the square weighed that way, and then they land", async () => {
    const b = battleAt(fen, { ...marked, ...up(air, 11, 15) });
    expect(await alfilBattle.play(b, [seesThePawn()])).toBe("fuse");
    const p = b.state.boss!.powers!;
    expect(p.fusion!.to).toBe("h7");
    expect(p.airborne).toBeNull();
    expect(p.landed!.pieces).toEqual([{ piece: "p", from: "b6", to: "b6" }]);
    // (A turn earlier, nothing lands after it: the engine sees no pawn on b6, and a7 comes first.)
    const early = battleAt(fen, { ...marked, ...up(air, 11, 16) });
    await alfilBattle.play(early, [seesThePawn()]);
    expect(early.state.boss!.powers!.fusion!.to).toBe("a7");
  });

  it("only the fusion, only when they land right after it: not a turn earlier, not his cast", () => {
    expect(alfilBattle.fusionAhead(battleAt(fen, { ...marked, ...up(air, 11, 16) }))).toBeNull();
    expect(alfilBattle.fusionAhead(battleAt(fen, marked))).toBeNull();
    // (His cast: his move follows it, judged on its own.)
    const cast = battleAt(fen, { ...up(air, 11, 15), tusksNext: 1 });
    expect(alfilBattle.step(cast)).toBe("tusks");
    expect(alfilBattle.fusionAhead(cast)).toBeNull();
  });
});
