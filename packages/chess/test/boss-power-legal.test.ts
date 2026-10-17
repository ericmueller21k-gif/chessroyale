import { afterEach, describe, expect, it, vi } from "vitest";
import { BOSS_BRAIN, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossBrain, type BossPowerState, type BossState, type Settings, type StopReason } from "@chessroyale/core";
import {
  DEFAULT_BOSS_GUARD,
  MatchRunner,
  applyMove,
  bossAllowed,
  bossMoveFrom,
  brainLine,
  crossesMiddle,
  crowdAllowed,
  initPowers,
  legalMoves,
  sanLineToUci,
  stopReason,
  type BossMoveKind,
  type BrainNote,
  type EngineLike,
  type HumanAnswer,
  type HumanEngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * The boss's move always comes from the moves his powers leave him, whichever brain picks it (Eric, Oct 17: Sawyer's
 * queen crossed the board saw; docs/decisions/2026-10-17-power-limits-said-on-screen.md). That move was his only legal
 * one (your knight's check, every other square covered), and a power never blocks the only way out of check: the
 * limit lifted, as the rules say, and nothing on screen said so. Here: Eric's position, every power that stops the
 * boss's moves on every brain path, the last checks (bossMoveFrom's own pick, the runner's applyBossMove), and what the
 * screens are told (`through`, `stopReason`).
 */

afterEach(() => vi.restoreAllMocks());

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

/** A boss state for the rules alone: the crowd White, the boss Black, `powers` on top of a fresh battle's. */
function bossWith(id: string, fen: string, powers: Partial<BossPowerState>, crowdMoves = 3): BossState {
  return { id, crowdSide: "w", crowdMoves, powers: { ...initPowers(1, fen, "w"), turn: crowdMoves + 1, ...powers } } as unknown as BossState;
}
const DONE_SPLIT: Pick<BossPowerState, "split"> = { split: { turn: 2, pawn: null, square: null, halves: [] } };

/**
 * A stand-in Stockfish that loves the moves a power stops (`favorites`, scored 0.95, its limited-strength move the
 * first of them); a move it doesn't know (`unknown`) scores as well as the best, so a wrong answer would pass its own
 * guard.
 */
function lovingEngine(favorites: readonly string[], opts: { eloMove?: string } = {}): EngineLike {
  const score = (fen: string, m: string) => (favorites.includes(m) || !legalMoves(fen).includes(m) ? 0.95 : 0.3 + 0.3 * hash(fen + m));
  const top = async (fen: string, n: number) =>
    legalMoves(fen)
      .map((move) => ({ move, expected: score(fen, move) }))
      .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
      .slice(0, n);
  return {
    topMoves: top,
    topMovesAt: (fen: string, n: number) => top(fen, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async () => opts.eloMove ?? favorites[0]!,
  };
}

/** A stand-in Maia: it names the moves a power stops first (ignoring the moves it was asked for) and draws one of them. */
function stubbornMaia(favorites: readonly string[], mode: "ready" | "not ready" | "slow" | "only favorites" = "ready"): HumanEngineLike {
  return {
    ready: () => mode !== "not ready",
    candidates: (fen, _rating, allowed): Promise<HumanAnswer> => {
      if (mode === "slow") return new Promise(() => {});
      const ok = (allowed ?? legalMoves(fen)).filter((m) => !favorites.includes(m)).slice(0, mode === "only favorites" ? 0 : 3);
      const moves = [...favorites, ...ok].map((move, k) => ({ move, p: 0.6 / (k + 1) }));
      return Promise.resolve({ best: favorites[0] ?? null, moves, ms: 5 });
    },
  };
}

/** Every way the boss's move is picked (BossMoveKind × brain, and Maia's fallbacks to Stockfish). */
const PATHS: { name: string; kind: BossMoveKind; brain?: BossBrain; maia?: "ready" | "not ready" | "slow" | "only favorites"; share?: number }[] = [
  { name: "Stockfish at his strength", kind: "elo" },
  { name: "Stockfish's slip", kind: "stumble" },
  { name: "the King's strike (staggered)", kind: "stagger" },
  { name: "the engine's best (a power's follow-up)", kind: "best" },
  { name: "Maia, no guard", kind: "elo", brain: "maia-raw" },
  { name: "Maia, light guard", kind: "elo", brain: "maia-light" },
  { name: "Maia, full guard", kind: "elo", brain: "maia-full" },
  { name: "Maia, strict guard", kind: "elo", brain: "maia-strict" },
  { name: "Maia when a slip was due", kind: "stumble", brain: "maia-raw" },
  { name: "Maia and the King's strike (Stockfish's step back)", kind: "stagger", brain: "maia-raw" },
  { name: "Maia not loaded: Stockfish", kind: "elo", brain: "maia-raw", maia: "not ready" },
  { name: "Maia too slow: Stockfish", kind: "elo", brain: "maia-raw", maia: "slow" },
  { name: "none of Maia's moves allowed: Stockfish", kind: "elo", brain: "maia-raw", maia: "only favorites" },
  { name: "the bridge band's share: Stockfish", kind: "elo", brain: "maia-light", share: 1 },
];

/** The opening the battles here start from (a raid starts from the game so far; the board is then set to the test's). */
const OPENING: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves: sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]), namedPlies: 12, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } };

const AFTER_E4 = applyMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4");
const OPEN = "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R b KQkq - 0 1";

/** Every power that stops the boss's own moves, in a position where his engine and Maia would rather play a stopped one. */
const POWERS: { name: string; boss: BossState; fen: string; favorites: string[]; why: StopReason | null }[] = [
  { name: "Sawyer's board saw", boss: bossWith("sawyer", OPEN, { ...DONE_SPLIT, boardSaw: { at: 4, until: 8 } }), fen: OPEN, favorites: ["d7g4", "c6e7"], why: "boardsaw" },
  { name: "Sawyer's saw cut", boss: bossWith("sawyer", OPEN, { ...DONE_SPLIT, cut: { a: "d6", b: "d7", at: 4, until: 6 } }), fen: OPEN, favorites: ["d7d6"], why: "cut" },
  { name: "Sawyer's first move (a pawn's)", boss: bossWith("sawyer", AFTER_E4, {}, 0), fen: AFTER_E4, favorites: ["g8f6", "b8c6"], why: null },
  { name: "Boingo's pie", boss: bossWith("clown", AFTER_E4, { pies: [{ square: "e5", until: 3 }] }, 0), fen: AFTER_E4, favorites: ["e7e5"], why: "pie" },
  { name: "Big Boy's toy block", boss: bossWith("bigboy", AFTER_E4, { block: { square: "f6", at: 1, until: 3 } }, 0), fen: AFTER_E4, favorites: ["g8f6"], why: "block" },
];

describe("Eric's position (Oct 17): the boss's queen across the board saw was his only move", () => {
  // Boss alone, Hard, Sawyer on Maia 600 (no guard), the board saw up. You (White) had just played Nh5-f6+.
  const BEFORE = "3qk2r/1q4Q1/1p1p4/3PpP1N/4PP2/8/1p3K2/7R w k - 0 35";
  const ERIC = "3qk2r/1q4Q1/1p1p1N2/3PpP2/4PP2/8/1p3K2/7R b k - 0 35";
  const saw = (fen: string) => bossWith("sawyer", fen, { ...DONE_SPLIT, boardSaw: { at: 30, until: 34 } }, 30);

  it("your Qxb7 the move before crossed the saw: refused, and the screens can say why", () => {
    expect(legalMoves(BEFORE)).toContain("g7b7");
    const allowed = crowdAllowed(saw(BEFORE), BEFORE)!;
    expect(allowed).toContain("h5f6");
    expect(allowed).not.toContain("g7b7");
    expect(stopReason(saw(BEFORE), BEFORE, "g7b7")).toBe("boardsaw");
    expect(stopReason(saw(BEFORE), BEFORE, "h5f6")).toBeNull();
  });

  it("after Nf6+ his only legal move is Qxf6, across the saw: the limit lifts (never the only way out of check)", () => {
    expect(applyMove(BEFORE, "h5f6").split(" ").slice(0, 4)).toEqual(ERIC.split(" ").slice(0, 4));
    expect(legalMoves(ERIC)).toEqual(["d8f6"]);
    expect(crossesMiddle("d8f6")).toBe(true);
    expect(bossAllowed(saw(ERIC), ERIC)).toBeNull();
    // (Not a hole in the saw: with any other move to play, Qxf6's like is stopped. The knight back on h5, no check.)
    const calm = "3qk2r/1q4Q1/1p1p4/3PpP1N/4PP2/8/1p3K2/7R b k - 0 35";
    const allowed = bossAllowed(saw(calm), calm)!;
    expect(allowed.length).toBeGreaterThan(0);
    for (const m of allowed) expect(crossesMiddle(m)).toBe(false);
    expect(legalMoves(calm)).toContain("d8f6");
  });

  it("in a battle: every brain path plays Qxf6, and the screens are told it went through the board saw", async () => {
    for (const path of PATHS) {
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1200, bossId: "sawyer", lastStandFrom: 999 } as Settings;
      const engine = lovingEngine([]);
      const r = new MatchRunner({ settings, rng: mulberry32(3), engines: [engine], library: [OPENING], entrants: [{ id: "h0", name: "H", isBot: false }] });
      const board = r.boards.get(0)!;
      const ply = board.history.length;
      r.boards.set(0, { ...board, fen: ERIC, bases: [...(board.bases ?? []).filter((x) => x.ply !== ply), { ply, fen: ERIC }] });
      const b = r.state.boss!;
      r.state = { ...r.state, boss: { ...b, crowdSide: "w", staggerNext: path.kind === "stagger", powers: { ...b.powers!, ...DONE_SPLIT, cut: null, boardSaw: { at: 1, until: 5 } } } };
      if (path.brain) r.humanBrain = { brain: path.brain, rating: 600, engine: stubbornMaia(["d8f6"], path.maia), ...(path.share ? { stockfishShare: path.share } : {}) };
      expect(r.bossToMove(), path.name).toBe(true);
      expect(r.bossAllowed(), path.name).toBeNull();
      expect(await r.playBoss(), path.name).toBe("d8f6");
      expect(r.boards.get(0)!.lastMove, path.name).toBe("d8f6");
      expect(r.bossView()!.lastMove, path.name).toMatchObject({ move: "d8f6", san: "Qxf6", captured: "n", through: "boardsaw" });
    }
  });

  it("an ordinary move under the saw isn't marked as through it", async () => {
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1200, bossId: "sawyer", lastStandFrom: 999 } as Settings;
    const calm = "3qk2r/1q4Q1/1p1p4/3PpP1N/4PP2/8/1p3K2/7R b k - 0 35";
    const r = new MatchRunner({ settings, rng: mulberry32(3), engines: [lovingEngine(["d8f6", "b7g7"])], library: [OPENING], entrants: [{ id: "h0", name: "H", isBot: false }] });
    const board = r.boards.get(0)!;
    r.boards.set(0, { ...board, fen: calm, bases: [...(board.bases ?? []), { ply: board.history.length, fen: calm }] });
    const b = r.state.boss!;
    r.state = { ...r.state, boss: { ...b, crowdSide: "w", powers: { ...b.powers!, ...DONE_SPLIT, cut: null, boardSaw: { at: 1, until: 5 } } } };
    const move = await r.playBoss();
    expect(crossesMiddle(move)).toBe(false);
    expect(r.bossView()!.lastMove!.through).toBeUndefined();
  });
});

describe("every power that stops the boss, on every brain path: his move is always one the power allows", () => {
  for (const power of POWERS) {
    it(`${power.name}`, async () => {
      const allowed = bossAllowed(power.boss, power.fen)!;
      expect(allowed.length).toBeGreaterThan(0);
      // (The test bites: his engine's and Maia's favorites are all stopped, and legal in chess.)
      for (const m of power.favorites) {
        expect(legalMoves(power.fen)).toContain(m);
        expect(allowed).not.toContain(m);
        expect(stopReason(power.boss, power.fen, m)).toBe(power.why);
      }
      for (const path of PATHS) {
        const engine = lovingEngine(power.favorites);
        const brain = path.brain ? { brain: path.brain, rating: 1500, engine: stubbornMaia(power.favorites, path.maia), settings: { ...BOSS_BRAIN, timeoutMs: 30 }, ...(path.share ? { stockfishShare: path.share } : {}) } : undefined;
        const move = await bossMoveFrom(engine, power.fen, 1500, 1000, path.kind, mulberry32(7), [5, 15], DEFAULT_BOSS_GUARD, allowed, brain);
        expect(allowed, `${power.name}, ${path.name}: ${move}`).toContain(move);
      }
    });
  }
});

describe("the last checks: a wrong pick never lands", () => {
  it("bossMoveFrom: an engine's answer for another position (illegal here) is logged, and his best legal move played", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Stockfish's limited-strength search answers e2e4 with Black to move (a stale answer), nothing limiting his moves.
    const move = await bossMoveFrom(lovingEngine([], { eloMove: "e2e4" }), AFTER_E4, 1500, 1000, "elo", mulberry32(1), [5, 15], DEFAULT_BOSS_GUARD, null);
    expect(legalMoves(AFTER_E4)).toContain(move);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("boss move refused: e2e4"));
    // Maia, no guard, naming a move that isn't legal here.
    error.mockClear();
    const notes: BrainNote[] = [];
    const maia = await bossMoveFrom(lovingEngine([]), AFTER_E4, 1500, 1000, "elo", mulberry32(1), [5, 15], DEFAULT_BOSS_GUARD, null, { brain: "maia-raw", rating: 1500, engine: stubbornMaia(["e1g1"]), onNote: (n) => notes.push(n) });
    expect(legalMoves(AFTER_E4)).toContain(maia);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("boss move refused: e1g1"));
    // The best legal one: the engine's top move.
    expect(maia).toBe((await lovingEngine([]).topMoves(AFTER_E4, 1))[0]!.move);
    // The admins' debug line says the pick was replaced, not that Maia's move was played.
    expect(notes.map((n) => n.by)).toEqual(["maia", "stockfish"]);
    expect(brainLine(notes.at(-1)!)).toBe("Maia 1500 · no guard · pick replaced (not allowed)");
  });

  /** A stand-in Stockfish whose limited-strength answer is for another position (e2e4, Black to move), and then: */
  const staleEngine = (then: "throws" | "names it again"): EngineLike => {
    const base = lovingEngine([], { eloMove: "e2e4" });
    return {
      ...base,
      // (bossMoveFrom's own fallback, his best allowed move, asks for one line: that fails too.)
      topMovesAt: async (fen, n) => {
        if (then === "throws") throw new Error("engine gone");
        return [{ move: "e2e4", expected: 0.99 }, ...(await base.topMoves(fen, n))];
      },
      // (It scores a move it wasn't asked about, the stale one, above the rest.)
      scoreMoves: async (fen, moves) => [{ move: "e2e4", expected: 0.99 }, ...(await base.scoreMoves(fen, moves)).filter((m) => m.move !== "e2e4")],
    };
  };

  it("bossMoveFrom: its fallback failing too (the engine throws, or names a move he may not play) still ends on one he may: the first", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const then of ["throws", "names it again"] as const) {
      error.mockClear();
      const move = await bossMoveFrom(staleEngine(then), AFTER_E4, 1500, 1000, "elo", mulberry32(1), [5, 15], DEFAULT_BOSS_GUARD, null);
      expect(move, then).toBe(legalMoves(AFTER_E4)[0]);
      expect(error, then).toHaveBeenCalledWith(expect.stringContaining("boss move refused: e2e4"));
    }
  });

  it("the runner's applyBossMove: a move across the saw (a host out of date, or tampered with) is logged and the first allowed one played", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 1200, bossId: "sawyer", lastStandFrom: 999 } as Settings;
    const r = new MatchRunner({ settings, rng: mulberry32(3), engines: [lovingEngine([])], library: [OPENING], entrants: [{ id: "h0", name: "H", isBot: false }] });
    const board = r.boards.get(0)!;
    r.boards.set(0, { ...board, fen: OPEN, bases: [...(board.bases ?? []), { ply: board.history.length, fen: OPEN }] });
    const b = r.state.boss!;
    r.state = { ...r.state, boss: { ...b, crowdSide: "w", powers: { ...b.powers!, ...DONE_SPLIT, cut: null, boardSaw: { at: 1, until: 5 } } } };
    const allowed = r.bossAllowed()!;
    const played = r.applyBossMove("d7g4");
    expect(played).toBe(allowed[0]);
    expect(r.boards.get(0)!.lastMove).toBe(allowed[0]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("boss move refused: d7g4"));
    expect(r.bossView()!.lastMove!.through).toBeUndefined();
  });
});

describe("which power stops a move (the screens' words)", () => {
  it("reads the match's state and the screens' view alike: the board saw before a cut on the same move; a pie; a toy block; none", () => {
    const both = bossWith("sawyer", OPEN, { ...DONE_SPLIT, boardSaw: { at: 4, until: 8 }, cut: { a: "d6", b: "d7", at: 4, until: 6 } });
    expect(stopReason(both, OPEN, "d7g4")).toBe("boardsaw");
    expect(stopReason(both, OPEN, "d7d6")).toBe("cut");
    expect(stopReason(both, OPEN, "a7a6")).toBeNull();
    // (The screens' view: the same fields, the boss's id.)
    expect(stopReason({ id: "sawyer", powers: { boardSaw: { at: 4, until: 8 } } }, OPEN, "c6e7")).toBe("boardsaw");
    expect(stopReason({ id: "clown", powers: { pies: [{ square: "e5", until: 3 }] } }, AFTER_E4, "e7e5")).toBe("pie");
    expect(stopReason({ id: "bigboy", powers: { block: { square: "f6", at: 1, until: 3 } } }, AFTER_E4, "g8f6")).toBe("block");
    // (Slides through a block too.)
    const slide = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(stopReason({ id: "bigboy", powers: { block: { square: "e7", at: 1, until: 3 } } }, slide, "f8d6")).toBe("block");
    expect(stopReason({ id: "gingerbread", powers: {} }, AFTER_E4, "e7e5")).toBeNull();
    expect(stopReason(null, AFTER_E4, "e7e5")).toBeNull();
  });
});
