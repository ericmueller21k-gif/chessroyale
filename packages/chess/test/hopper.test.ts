import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, HOPPER_NAME, RAID_SETTINGS, chooseBoss, isPlayable, menuBosses, mulberry32, type Settings } from "@chessroyale/core";
import {
  HOPPER_FX,
  LEAPFROG_TEST_MOVES,
  MatchRunner,
  POWER_FX,
  applyMove,
  fenAtPly,
  gameEndWith,
  hopFrom,
  hopOptions,
  kingAttacked,
  legalMoves,
  mateInOne,
  pieceAt,
  powerTurn,
  queenSlain,
  rageOf,
  sanLineToUci,
  sideToMove,
  stockfishRefuses,
  triggerUltimate,
  type EngineLike,
  type NetBoss,
  type Opening,
} from "../src/index.ts";

/**
 * Chub & Chirp (the hopper; Eric, Oct 18): Leapfrog. At the start of his turn, a pawn of his nose to nose with one of
 * the crowd's hops over it to the empty square beyond, never onto the crowd's back rank, never one that leaves his king
 * attacked or gives check; then he plays his move. The engine picks when several can. At most hopMax (2) a battle. His
 * ultimate isn't decided: none comes, and his meter is off. docs/decisions/2026-10-18-hopper-leapfrog.md.
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
const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });
const SETTINGS = (patch: Partial<Settings> = {}) => ({ ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "hopper", bossUnfinished: true, lastStandFrom: 999, ...patch }) as Settings;

/** A Boss alone against him (met as the test link does: his art isn't built yet). */
function raid(o: { patch?: Partial<Settings>; seed?: number; engine?: EngineLike; side?: "w" | "b"; moves?: string[] } = {}) {
  return new MatchRunner({ settings: SETTINGS(o.patch), rng: mulberry32(o.seed ?? 5), engines: [o.engine ?? fakeEngine()], library: [opening(o.moves ?? LINE)], entrants: [{ id: "h0", name: "H", isBot: false }], ...(o.side ? { raidSide: o.side } : {}) });
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** Your move (or the first allowed), as the crowd's pick. */
async function crowd(r: MatchRunner, move?: string) {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
  await r.score(new Map([["h0", { move: move ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
}
/** One crowd turn, then his: the hop if one is due, then his move. Returns the hop. */
async function turn(r: MatchRunner, move?: string) {
  await crowd(r, move);
  if (r.isOver() || r.stageComplete()) return null;
  const hop = r.hopDue() ? await r.playHop() : null;
  if (r.bossToMove()) await r.playBoss();
  return hop;
}
/** No position a power leaves may be one the engine refuses, or one where the side not to move is in check. */
const sound = (fen: string) => {
  expect(stockfishRefuses(fen)).toBeNull();
  expect(kingAttacked(fen, sideToMove(fen) === "w" ? "b" : "w")).toBe(false);
};
const B = "b" as const;
const W = "w" as const;

describe("Chub & Chirp: who they are", () => {
  it("are on the roster as hopper (🐇), named in one constant, with Leapfrog and a place held for the ultimate, an offset in the others' range", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "hopper")!;
    expect(HOPPER_NAME).toBe("Chub & Chirp");
    expect(def).toMatchObject({ name: HOPPER_NAME, icon: "🐇", kit: null, powers: { passive: "leapfrog", ultimate: "hopperult" } });
    const others = BOSS_ROSTER.filter(isPlayable).map((b) => b.offset);
    expect(def.offset).toBeGreaterThanOrEqual(Math.min(...others));
    expect(def.offset).toBeLessThanOrEqual(Math.max(...others));
  });

  it("are hidden from players until their art is wired in: never at random, never on a menu, never picked by name; the test link meets them", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "hopper")!;
    expect(isPlayable(def)).toBe(false);
    const met = new Set<string>();
    for (let roll = 0; roll < 1; roll += 0.01) met.add(chooseBoss(roll).id);
    expect(met).not.toContain("hopper");
    expect(chooseBoss(0.5, "hopper").id).not.toBe("hopper");
    for (const admin of [false, true]) for (const r of [false, true]) expect(menuBosses({ admin, raid: r }).map((b) => b.id)).not.toContain("hopper");
    // (?boss=hopper&wip=1: bossUnfinished.)
    expect(chooseBoss(0.5, "hopper", null, BOSS_ROSTER, true).id).toBe("hopper");
    expect(raid().boss!.id).toBe("hopper");
  });

  it("their meter is off and no ultimate comes (it isn't decided yet): not from the meter, the test trigger or the test switch", async () => {
    const r = raid({ patch: { bossPowerTest: "hopperult" } });
    expect(rageOf(r.boss)).toBeNull();
    for (let t = 0; t < 12 && !r.isOver() && !r.stageComplete(); t++) {
      r.triggerUltimate();
      await turn(r);
      const p = r.boss!.powers!;
      expect(p.warnAt).toBeUndefined();
      expect(p.ultAt).toBeUndefined();
      expect(p.events.some((e) => e.kind === "warn")).toBe(false);
      expect(rageOf(r.boss)).toBeNull();
    }
    expect(triggerUltimate(r.boss).boss!.powers!.ultAt).toBeUndefined();
  });
});

describe("Leapfrog: which pawns hop (hopOptions)", () => {
  it("his pawn nose to nose with yours hops over it to the empty square beyond: two squares on, yours untouched", () => {
    const fen = "4k3/8/8/4p3/4P3/8/8/4K3 b - - 0 1";
    const { options, refused } = hopOptions(fen, B);
    expect(refused).toEqual([]);
    expect(options).toEqual([{ from: "e5", over: "e4", to: "e3", fen: "4k3/8/8/8/4P3/4p3/8/4K3 b - - 0 1" }]);
    // He still moves after it (him to move), and the position is one the engine plays.
    expect(sideToMove(options[0]!.fen)).toBe("b");
    sound(options[0]!.fen);
  });

  it("as White (the crowd Black: ?side=b), the other way up", () => {
    const { options } = hopOptions("4k3/8/8/4p3/4P3/8/8/4K3 w - - 0 1", W);
    expect(options.map((o) => [o.from, o.over, o.to])).toEqual([["e4", "e5", "e6"]]);
  });

  it("only over a pawn of yours directly in front of his (no other piece, no pawn of his own, nothing beside it), and only on his turn", () => {
    expect(hopOptions("4k3/8/8/4p3/4N3/8/8/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [] });
    expect(hopOptions("4k3/8/8/4p3/4p3/8/8/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [] });
    expect(hopOptions("4k3/8/8/4p3/3P4/8/8/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [] });
    expect(hopOptions("4k3/8/8/4p3/4P3/8/8/4K3 w - - 0 1", B)).toEqual({ options: [], refused: [] });
  });

  it("never when the square beyond isn't empty, either side's piece", () => {
    expect(hopOptions("4k3/8/8/4p3/4P3/4N3/8/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "e5", why: "blocked" }] });
    expect(hopOptions("4k3/8/8/4p3/4P3/4n3/8/4K3 b - - 0 1", B).refused).toEqual([{ from: "e5", why: "blocked" }]);
  });

  it("never onto your back rank (Eric: no instant queen), either way up", () => {
    expect(hopOptions("4k3/8/8/8/8/4p3/4P3/K7 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "e3", why: "lastRank" }] });
    expect(hopOptions("k7/4p3/4P3/8/8/8/8/4K3 w - - 0 1", W)).toEqual({ options: [], refused: [{ from: "e6", why: "lastRank" }] });
  });

  it("never a pinned pawn: his king left attacked", () => {
    // (The d5 pawn stands between your bishop on g2 and his king on c6.)
    expect(hopOptions("8/8/2k5/3p4/3P4/8/6B1/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "d5", why: "pinned" }] });
  });

  it("in check as his turn begins: none (it waits; he answers the check with his move)", () => {
    // (Your bishop on b5 checks his king on e8; a hop of the e5 pawn can't answer it.)
    expect(hopOptions("4k3/8/8/1B2p3/4P3/8/8/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "e5", why: "inCheck" }] });
  });

  it("never one that gives check: the pawn itself, or a line it opens", () => {
    expect(hopOptions("8/8/4k3/2p5/2P5/8/3K4/8 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "c5", why: "check" }] });
    // (His bishop on b8 behind the d6 pawn, your king on h2: the hop opens the diagonal.)
    expect(hopOptions("1bk5/8/3p4/3P4/8/8/7K/8 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "d6", why: "check" }] });
  });

  it("clears the en passant square, starts the fifty-move count again, keeps castling and the move number", () => {
    // (You just played d2-d4 past his e4 pawn: d3 was his to take en passant.)
    const fen = "r3k2r/8/8/7p/3Pp2P/8/8/R3K2R b KQkq d3 7 30";
    expect(legalMoves(fen)).toContain("e4d3");
    const [o] = hopOptions(fen, B).options;
    expect(o).toMatchObject({ from: "h5", over: "h4", to: "h3" });
    expect(o!.fen).toBe("r3k2r/8/8/8/3Pp2P/7p/8/R3K2R b KQkq - 0 30");
    expect(legalMoves(o!.fen)).not.toContain("e4d3");
  });

  it("never one that leaves him without a move (no stalemate by a power)", () => {
    // (His king boxed in by your queen; the hopped pawn blocked by your knight, nothing to take.)
    expect(hopOptions("k7/2Q5/8/4p3/4P3/8/4N3/4K3 b - - 0 1", B)).toEqual({ options: [], refused: [{ from: "e5", why: "noMove" }] });
  });

  it("never one that gives him a mate in one he didn't have (you never see the hop before his move)", () => {
    // (The hop opens b8-h2 for his queen: Qh2 mates, the knight on g4 guarding it, the bishop on c4 taking f1.)
    const fen = "kq6/1p6/3p4/3P4/2b3n1/8/5PP1/6K1 b - - 0 1";
    expect(mateInOne(fen)).toBeNull();
    expect(hopOptions(fen, B)).toEqual({ options: [], refused: [{ from: "d6", why: "mate" }] });
    // A mate in one he already had doesn't stop it (the hop didn't make it): his queen on h8 mates on h2 either way.
    const had = "k6q/1p6/3p4/3P4/2b3n1/8/5PP1/6K1 b - - 0 1";
    expect(mateInOne(had)).not.toBeNull();
    expect(hopOptions(had, B).options.map((o) => o.from)).toEqual(["d6"]);
  });

  it("several at once: each pawn that can, in square order, each refused one with its reason", () => {
    const fen = "4k3/8/8/p2pp2p/P2PP2P/3N4/8/4K3 b - - 0 1";
    const { options, refused } = hopOptions(fen, B);
    expect(options.map((o) => o.from)).toEqual(["a5", "e5", "h5"]);
    expect(refused).toEqual([{ from: "d5", why: "blocked" }]);
    for (const o of options) sound(o.fen);
  });
});

describe("Leapfrog: the engine's pick (hopFrom)", () => {
  it("the hop best for him (him to move: the engine's own score of each), equals in the order given; no engine, none", async () => {
    const fen = "4k3/8/8/p3p2p/P3P2P/8/8/4K3 b - - 0 1";
    const fens = hopOptions(fen, B).options.map((o) => o.fen);
    expect(fens).toHaveLength(3);
    // (The engine likes the h-pawn's hop best.)
    const engine = fakeEngine((f) => (pieceAt(f, "h3") ? 0.8 : 0.5));
    expect(await hopFrom([engine], fen, fens)).toEqual({ fen: fens[2] });
    expect(await hopFrom([fakeEngine(() => 0.5)], fen, fens)).toEqual({ fen: fens[0] });
    expect(await hopFrom([], fen, fens)).toBeNull();
    expect(await hopFrom([engine], fen, [])).toBeNull();
  });
});

describe("Leapfrog in a battle", () => {
  it("the test switch (?power=leapfrog): from 1.e4 e5, the crowd to move: whatever you play first, his e5 pawn hops over your e4 (and the other way up)", async () => {
    for (const side of [W, B]) {
      const r = raid({ patch: { bossPowerTest: "leapfrog" }, side });
      expect(r.boss!.crowdSide).toBe(side);
      expect(r.boards.get(0)!.history).toEqual(LEAPFROG_TEST_MOVES[side]);
      expect(r.boss!.startPly).toBe(LEAPFROG_TEST_MOVES[side].length);
      const fen = fenOf(r);
      expect(sideToMove(fen)).toBe(side);
      // Every first move you could play leaves the hop due.
      for (const m of legalMoves(fen)) {
        const { options } = hopOptions(applyMove(fen, m), side === "w" ? "b" : "w");
        expect(options.map((o) => o.from), m).toEqual([side === "w" ? "e5" : "e4"]);
      }
    }
  });

  it("at the start of his turn: the hop, a base on the board at its ply (no move added), its moment with this turn's; then his move", async () => {
    const r = raid({ patch: { bossPowerTest: "leapfrog" } });
    await crowd(r, "g1f3");
    expect(r.bossToMove()).toBe(true);
    expect(r.hopDue()).toBe(true);
    expect(r.hopCandidates()).toHaveLength(1);
    expect(r.hopNeedsEngine()).toBe(false);
    const plies = r.boards.get(0)!.history.length;
    const hop = r.applyHop(null)!;
    expect(hop).toEqual({ at: 1, from: "e5", over: "e4", to: "e3" });
    const board = r.boards.get(0)!;
    expect(board.history).toHaveLength(plies);
    expect(board.bases).toContainEqual({ ply: plies, fen: board.fen });
    expect(pieceAt(board.fen, "e3")).toEqual({ color: "b", type: "p" });
    expect(pieceAt(board.fen, "e5")).toBeNull();
    expect(pieceAt(board.fen, "e4")).toEqual({ color: "w", type: "p" });
    expect(fenAtPly(board.history, plies, board.bases)).toBe(board.fen);
    const p = r.boss!.powers!;
    expect(p.hop).toEqual(hop);
    expect(p.hops).toBe(1);
    expect(p.events.at(-1)).toEqual({ kind: "hop", turn: p.turn, square: "e3", squares: ["e5", "e4", "e3"] });
    // One a turn: none again before his move; he still moves.
    expect(r.hopDue()).toBe(false);
    expect(r.applyHop(null)).toBeNull();
    expect(r.bossToMove()).toBe(true);
    const move = await r.playBoss();
    expect(legalMoves(board.fen)).toContain(move);
    expect(r.boards.get(0)!.history).toHaveLength(plies + 1);
    // Your turn right after it doesn't count for fair play; the one after does (unless another hop came).
    expect(powerTurn(r.boss)).toBe(true);
    await turn(r);
    expect(powerTurn(r.boss)).toBe(r.boss!.powers!.hop!.at === r.boss!.crowdMoves);
  });

  /** A battle from a position of our own (the crowd to move: a base on the board at its ply). */
  const from = (fen: string, o: Parameters<typeof raid>[0] = {}) => {
    const r = raid(o);
    const board = r.boards.get(0)!;
    r.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
    return r;
  };
  /** Pawns nose to nose on the a, d, e and h files, nothing in the way: four hops to choose from after your rook's move. */
  const FOUR = "r3k3/8/8/p2pp2p/P2PP2P/8/8/R3K3 w - - 0 20";

  it("several can: the host's (or this device's) engine picks; anything that isn't one of them (an older app's move, none), the first", async () => {
    const r = from(FOUR);
    await crowd(r, "a1b1");
    expect(r.hopNeedsEngine()).toBe(true);
    const c = r.hopCandidates();
    expect(c).toHaveLength(4);
    expect(r.applyHop(c[2]!)!.from).toBe("e5");
    for (const pick of ["e2e4", "", null]) {
      const s = from(FOUR);
      await crowd(s, "a1b1");
      expect(s.applyHop(pick)!.from).toBe("a5");
    }
    // This device's engines: the one best for him (hopFrom).
    const best = from(FOUR, { engine: fakeEngine((f) => (pieceAt(f, "h3") ? 0.9 : 0.4)) });
    await crowd(best, "a1b1");
    expect((await best.playHop())!.from).toBe("h5");
  });

  it("at most hopMax (2) a battle: nose to nose after that, nothing", async () => {
    expect(BOSS_POWERS.hopMax).toBe(2);
    const r = from(FOUR);
    let hops = 0;
    let stopped = 0;
    for (let t = 0; t < 10 && !r.isOver() && !r.stageComplete(); t++) {
      // (Your rook or king only: your pawns stay where they are.)
      await crowd(r, legalMoves(fenOf(r)).filter((m) => pieceAt(fenOf(r), m.slice(0, 2))?.type !== "p").sort()[0]);
      if (r.isOver() || r.stageComplete()) break;
      const could = hopOptions(fenOf(r), "b").options.length > 0;
      if (r.hopDue()) {
        await r.playHop();
        hops++;
      } else if (could && hops === 2) stopped++;
      expect(r.boss!.powers!.hops ?? 0).toBeLessThanOrEqual(2);
      if (r.bossToMove()) await r.playBoss();
    }
    expect(hops).toBe(2);
    expect(r.boss!.powers!.hops).toBe(2);
    expect(stopped).toBeGreaterThan(0);
  });

  it("the boss view carries the hop (optional: older apps ignore it), as JSON; his moment's length is the server's and the screens'", async () => {
    const r = raid({ patch: { bossPowerTest: "leapfrog" } });
    expect((JSON.parse(JSON.stringify(r.bossView())) as NetBoss).powers!.hop).toBeNull();
    await turn(r, "g1f3");
    const v = JSON.parse(JSON.stringify(r.bossView())) as NetBoss;
    expect(v.powers!.hop).toEqual({ at: 1, from: "e5", over: "e4", to: "e3" });
    expect(POWER_FX.hop).toBe(HOPPER_FX.hop);
  });

  it("QUEEN SLAIN! never again in his thinking after the hop", () => {
    const board = { history: ["d1d8"], bases: [{ ply: 0, fen: "3qk3/8/8/8/8/8/8/3QK3 w - - 0 1" }] };
    const view = { crowdSide: "w" as const, crowdMoves: 5, board, powers: { events: [] as { kind: string }[] } };
    expect(queenSlain(view)).toBe(true);
    expect(queenSlain({ ...view, powers: { events: [{ kind: "hop" }], hop: { at: 5 } } })).toBe(false);
    expect(queenSlain({ ...view, powers: { events: [], hop: { at: 4 } } })).toBe(true);
  });

  it("a runner restored from its snapshot (as every lobby event restores it) works the hop out the same", async () => {
    const r = raid({ patch: { bossPowerTest: "leapfrog" } });
    await crowd(r, "g1f3");
    const restored = MatchRunner.restore(structuredClone(r.snapshot()), { settings: SETTINGS({ bossPowerTest: "leapfrog" }), rng: mulberry32(5), engines: [fakeEngine()], library: [opening(LINE)] });
    expect(restored.hopDue()).toBe(true);
    expect(restored.hopCandidates()).toEqual(r.hopCandidates());
  });
});

describe("Leapfrog: the ground rules, over many battles (a fuzz, as #267's review)", () => {
  it("every hop and move leaves a legal position the engine plays, with a move or a real ending; replays match; never the back rank; never past the cap", async () => {
    const counts: Record<string, number> = {};
    for (let seed = 1; seed <= 20; seed++) {
      const r = raid({ seed, side: seed % 2 ? W : B, patch: seed % 3 ? { bossPowerTest: "leapfrog" } : {} });
      const rng = mulberry32(seed * 7919);
      const his = r.boss!.crowdSide === "w" ? "b" : "w";
      for (let t = 0; t < 40 && !r.isOver() && !r.stageComplete(); t++) {
        r.deal();
        const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
        // (Pawn moves first, often: they make nose-to-nose pawns.)
        const pawns = allowed.filter((m) => pieceAt(fenOf(r), m.slice(0, 2))?.type === "p");
        const pool = pawns.length && rng() < 0.6 ? pawns : allowed;
        await r.score(new Map([["h0", { move: [...pool].sort()[Math.floor(rng() * pool.length)]!, thinkMs: 1000 }]]));
        if (r.isOver() || r.stageComplete()) break;
        if (r.hopDue()) {
          const before = fenOf(r);
          const hop = (await r.playHop())!;
          counts.hops = (counts.hops ?? 0) + 1;
          const board = r.boards.get(0)!;
          sound(board.fen);
          expect(legalMoves(board.fen).length).toBeGreaterThan(0);
          expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
          expect(gameEndWith(board.history, board.bases)).toBeNull();
          expect(board.fen.split(" ")[3]).toBe("-");
          expect(board.fen.split(" ")[5]).toBe(before.split(" ")[5]);
          expect(Number(hop.to[1])).not.toBe(his === "b" ? 1 : 8);
          expect(Math.abs(Number(hop.to[1]) - Number(hop.from[1]))).toBe(2);
          expect(pieceAt(board.fen, hop.to)).toEqual({ color: his, type: "p" });
          expect(pieceAt(board.fen, hop.over)?.type).toBe("p");
          expect(kingAttacked(board.fen, his)).toBe(false);
          expect(r.bossToMove()).toBe(true);
        }
        expect(r.boss!.powers!.hops ?? 0).toBeLessThanOrEqual(BOSS_POWERS.hopMax);
        if (r.bossToMove()) await r.playBoss();
        const board = r.boards.get(0)!;
        expect(stockfishRefuses(board.fen)).toBeNull();
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
      }
    }
    // (Enough hops to mean something: the test switch's battles alone bring one each.)
    expect(counts.hops).toBeGreaterThanOrEqual(13);
  }, 90_000);
});
