import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, DEFAULT_SETTINGS, RAID_SETTINGS, isPlayable, mulberry32, type BossPowerState, type BossState, type Settings } from "@chessroyale/core";
import {
  BOARD_SAW,
  MatchRunner,
  SPLIT,
  SAW_CUT,
  START_FEN,
  applyMove,
  bossAllowed,
  chooseCut,
  crossesCut,
  crossesMiddle,
  crowdAllowed,
  favouredHalf,
  fenAtPly,
  gameEndWith,
  inCheck,
  initPowers,
  legalMoves,
  moveEdges,
  pieceAt,
  powerMomentMs,
  powerTurn,
  prepareTurn,
  rageOf,
  sanLineToUci,
  splitRoom,
  splitSquare,
  trackHalves,
  triggerUltimate,
  withPiece,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/**
 * Sawyer, the raccoon with a saw: his split pawn (his first move a pawn move, then that pawn sawn in two, a second pawn
 * beside it, both tracked), his saw cuts (an edge between two squares nothing may move straight across, every 4 turns
 * for 3) and the board saw (no move across between the d and e files for 5 turns). Cuts block movement, never attacks;
 * never no move, never the only way out of check. See DECISIONS.md, "Sawyer, built".
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
function fakeEngine(score: (fen: string, m: string) => number = (fen, m) => 0.3 + 0.4 * hash(fen + m)): EngineLike {
  return {
    topMoves: async (fen, n) =>
      legalMoves(fen)
        .map((move) => ({ move, expected: score(fen, move) }))
        .sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1))
        .slice(0, n),
    scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
    playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
  };
}
const LINE = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
const opening = (moves: string[]): Opening => ({ id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { 10: 0.52, 11: 0.48, 12: 0.52 } });

/** An opening with a pawn of his already gone by move 5 (the Scandinavian): room for his split at once. */
const TRADED = sanLineToUci(["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3", "c6", "Bc4", "Bf5"]);

function raid(opts: { patch?: Partial<Settings>; seed?: number; engine?: EngineLike | ((r: () => MatchRunner) => EngineLike); line?: string[] } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "sawyer", lastStandLoss: 999, lastStandLossFloor: 999, ...opts.patch } as Settings;
  let runner: MatchRunner | null = null;
  const engine = typeof opts.engine === "function" ? opts.engine(() => runner!) : (opts.engine ?? fakeEngine());
  runner = new MatchRunner({ settings, rng: mulberry32(opts.seed ?? 5), engines: [engine], library: [opening(opts.line ?? TRADED)], entrants: [{ id: "h0", name: "H", isBot: false }] });
  return runner;
}
const fenOf = (r: MatchRunner) => r.boards.get(0)!.fen;
/** One crowd turn: you play `move` (or the first allowed move), then the boss replies. Returns the round's judged best move. */
async function turn(r: MatchRunner, move?: string): Promise<string | undefined> {
  r.deal();
  const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
  const res = await r.score(new Map([["h0", { move: move ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
  if (r.isOver() || r.stageComplete()) return res.boards[0]?.bestMove;
  await r.playBoss();
  return res.boards[0]?.bestMove;
}
/** A boss state for the rules alone (the crowd White unless said). */
function bossWith(fen: string, powers: Partial<BossPowerState>, crowdSide: "w" | "b" = "w", crowdMoves = 3): BossState {
  return { id: "sawyer", crowdSide, crowdMoves, powers: { ...initPowers(1, fen, crowdSide), turn: crowdMoves + 1, split: { turn: 2, pawn: null, square: null, halves: [] }, ...powers } } as unknown as BossState;
}
const cutOf = (a: string, b: string, at = 4) => ({ a, b, at, until: at + 2 });

describe("Sawyer: who he is", () => {
  it("is on the roster as sawyer (🪚) with saw cuts and the board saw, playable, and weaker underneath for his pawn", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "sawyer")!;
    expect(def).toMatchObject({ name: "Sawyer", icon: "🪚", kit: "Sawyer", powers: { passive: "cuts", ultimate: "boardsaw" } });
    expect(isPlayable(def)).toBe(true);
    for (const o of BOSS_ROSTER.filter((b) => isPlayable(b) && b.offset === -100)) expect(def.offset).toBeLessThan(o.offset);
  });
});

describe("Sawyer's split pawn", () => {
  it("the new half lands beside the pawn, left or right from the seed; one side free: that side; neither: no split", () => {
    const fen = applyMove(applyMove(START_FEN, "e2e4"), "e7e5");
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const sq = splitSquare(fen, "e5", "w", seed)!;
      expect(["d5", "f5"]).toContain(sq);
      expect(splitSquare(fen, "e5", "w", seed)).toBe(sq);
      seen.add(sq);
    }
    expect(seen.size).toBe(2);
    // d5 taken: f5; both taken: none.
    const left = withPiece(fen, "d5", { color: "w", type: "n" });
    for (let seed = 0; seed < 10; seed++) expect(splitSquare(left, "e5", "w", seed)).toBe("f5");
    expect(splitSquare(withPiece(left, "f5", { color: "b", type: "n" }), "e5", "w", 3)).toBeNull();
    // At the board's edge, only one side exists.
    const edge = applyMove(applyMove(START_FEN, "e2e4"), "a7a5");
    expect(splitSquare(edge, "a5", "w", 1)).toBe("b5");
    // A White Sawyer (the crowd Black): his pawn's rank, beside it.
    const white = applyMove(START_FEN, "d2d4");
    expect(["c4", "e4"]).toContain(splitSquare(white, "d4", "b", 9));
  });

  it("my call: never where the new pawn attacks one of the crowd's pieces (a fork or a piece won at once)", () => {
    // His pawn on e5, the crowd's knight on c4: a new pawn on d5 would hit the knight; one on f5 hits nothing.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/2N5/8/PPPPPPPP/R1BQKBNR w KQkq - 0 3";
    for (let seed = 0; seed < 10; seed++) expect(splitSquare(fen, "e5", "w", seed)).toBe("f5");
    // A knight on g4 as well: neither.
    expect(splitSquare(withPiece(fen, "g4", { color: "w", type: "n" }), "e5", "w", 1)).toBeNull();
    // Hitting a pawn is ordinary chess: allowed.
    const pawns = withPiece(withPiece(fen, "c4", { color: "w", type: "p" }), "g4", { color: "w", type: "p" });
    expect(new Set(Array.from({ length: 20 }, (_, s2) => splitSquare(pawns, "e5", "w", s2)))).toEqual(new Set(["d5", "f5"]));
  });

  it("my call: never where the new pawn gives check (or leaves the crowd without a move)", () => {
    // His pawn on e6 beside the crowd's king on e5: a pawn on d6 or f6 would check it.
    const fen = "4k3/8/4p3/4K3/8/8/8/8 w - - 0 1";
    expect(splitSquare(fen, "e6", "w", 1)).toBeNull();
    // With the king on c5, a pawn on d6 would check it (it attacks c5 and e5); f6 doesn't.
    const fen2 = "4k3/8/4p3/2K5/8/8/8/8 w - - 0 1";
    for (let seed = 0; seed < 10; seed++) expect(splitSquare(fen2, "e6", "w", seed)).toBe("f6");
  });

  it("needs room for another pawn of his: fewer than 8, and fewer than 32 pieces on the board (the engine plays no ninth pawn)", () => {
    expect(splitRoom(START_FEN, "b")).toBe(false);
    expect(splitRoom(START_FEN.replace("pppppppp", "ppp1pppp"), "b")).toBe(true);
    // Seven pawns but a full board (a pawn promoted): no room.
    expect(splitRoom("rnbqkbnr/ppp1pppp/8/8/8/3q4/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "b")).toBe(false);
    expect(splitRoom(START_FEN.replace("PPPPPPPP", "PPPP1PPP"), "b")).toBe(false);
    expect(splitRoom(START_FEN.replace("PPPPPPPP", "PPPP1PPP"), "w")).toBe(true);
  });

  it("with all 8 of his pawns on the board, the split waits, and comes on his first pawn move once one of them is gone", async () => {
    const r = raid({ line: LINE });
    // 6.Bxc6: his first move must be a pawn's: dxc6. Still 8 pawns: no split yet.
    r.deal();
    await r.score(new Map([["h0", { move: "a4c6", thinkMs: 1000 }]]));
    expect(r.bossAllowed()!.every((m) => pieceAt(fenOf(r), m.slice(0, 2))!.type === "p")).toBe(true);
    r.applyBossMove("d7c6");
    expect(r.boss!.powers!.split).toEqual({ turn: 2, pawn: "c6", square: null, halves: [], waiting: true });
    expect(r.boss!.powers!.events.map((e) => e.kind)).not.toContain("split");
    expect(r.boards.get(0)!.fen.split(" ")[0]!.split("").filter((c) => c === "p").length).toBe(8);
    // Not his first move any more: any move.
    expect(r.bossAllowed()).toBeNull();
    // 7.Nxe5 takes a pawn of his; his next move isn't a pawn's: still waiting.
    r.deal();
    await r.score(new Map([["h0", { move: "f3e5", thinkMs: 1000 }]]));
    r.applyBossMove("d8d4");
    expect(r.boss!.powers!.split!.waiting).toBe(true);
    // His first pawn move after it: the split, and its moment.
    r.deal();
    await r.score(new Map([["h0", { move: "d2d3", thinkMs: 1000 }]]));
    r.applyBossMove("b7b5");
    const split = r.boss!.powers!.split!;
    expect(split.waiting).toBeUndefined();
    expect(split).toMatchObject({ turn: 4, pawn: "b5" });
    expect(["a5", "c5"]).toContain(split.square);
    expect(pieceAt(fenOf(r), split.square!)).toEqual({ color: "b", type: "p" });
    expect(r.boss!.powers!.events).toContainEqual(expect.objectContaining({ kind: "split", turn: 4 }));
    const board = r.boards.get(0)!;
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
  });

  it("his first move is a pawn move; then the pawn is sawn in two: a second pawn beside it, a base where it changed", async () => {
    let splits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = raid({ seed });
      expect(r.boss!.id).toBe("sawyer");
      expect(r.boss!.powers!.split).toBeUndefined();
      expect(r.boss!.powers!.nextPassive).toBe(BOSS_POWERS.sawFirst);
      r.deal();
      await r.score(new Map([["h0", { move: [...(r.crowdAllowed() ?? legalMoves(fenOf(r)))].sort()[0]!, thinkMs: 1000 }]]));
      // His turn: only pawn moves.
      const before = fenOf(r);
      const allowed = r.bossAllowed()!;
      expect(allowed.length).toBeGreaterThan(0);
      for (const m of allowed) expect(pieceAt(before, m.slice(0, 2))!.type).toBe("p");
      await r.playBoss();
      const board = r.boards.get(0)!;
      const move = board.lastMove!;
      expect(pieceAt(before, move.slice(0, 2))!.type).toBe("p");
      const split = r.boss!.powers!.split!;
      expect(split.turn).toBe(2);
      expect(split.pawn).toBe(move.slice(2, 4));
      const plain = applyMove(before, move);
      if (split.square) {
        splits++;
        expect(split.square[1]).toBe(split.pawn![1]);
        expect(Math.abs(split.square.charCodeAt(0) - split.pawn!.charCodeAt(0))).toBe(1);
        expect(board.fen).toBe(withPiece(plain, split.square, { color: "b", type: "p" }));
        expect(board.bases).toContainEqual({ ply: board.history.length, fen: board.fen });
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
        // The two halves, each with its side of the cut.
        expect(split.halves.map((h) => h.square).sort()).toEqual([split.pawn, split.square].sort());
        expect(split.halves.find((h) => h.side === "a")!.square < split.halves.find((h) => h.side === "h")!.square).toBe(true);
        // Its moment as the crowd's 2nd turn begins (after his move shows).
        expect(r.boss!.powers!.events).toContainEqual({ kind: "split", turn: 2, square: split.square, squares: [split.pawn, split.square] });
        expect(r.bossView()!.powers!.split).toEqual(split);
      } else expect(board.fen).toBe(plain);
      // Not his first move any more: anything goes.
      await turn(r);
      expect(r.boss!.powers!.split).toEqual(expect.objectContaining({ turn: 2 }));
    }
    expect(splits).toBeGreaterThan(0);
    expect(powerMomentMs([{ kind: "split" }])).toBe(SPLIT.total);
  });

  it("the moves after it replay from the split, and the game goes on (a move only legal with the new pawn)", async () => {
    const r = raid({ seed: 3 });
    for (let i = 0; i < 6 && !r.isOver(); i++) await turn(r);
    const board = r.boards.get(0)!;
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
    expect(gameEndWith(board.history, board.bases)).toBeNull();
    // Every half still listed stands on one of his pawns.
    for (const h of r.boss!.powers!.split!.halves) expect(pieceAt(board.fen, h.square)).toEqual({ color: "b", type: "p" });
  });

  it("tracks the halves through moves, captures (en passant too) and promotion", () => {
    const halves = [
      { square: "d5", side: "a" as const },
      { square: "e5", side: "h" as const },
    ];
    // A half moves: it goes with the move.
    const f1 = "4k3/8/8/4p3/3p4/8/8/4K3 w - - 0 1";
    expect(trackHalves(halves, "d5d4", f1, "b")).toEqual([{ square: "d4", side: "a" }, { square: "e5", side: "h" }]);
    // The crowd takes one: it's gone.
    const f2 = "4k3/8/8/3Pp3/8/8/8/4K3 b - - 0 1";
    expect(trackHalves(halves, "c4d5", f2, "b")).toEqual([{ square: "e5", side: "h" }]);
    // En passant: the half on e5 (just stepped e7-e5) taken by d5xe6.
    const ep = [{ square: "e5", side: "h" as const }];
    const f3 = "4k3/8/4P3/8/8/8/8/4K3 b - - 0 1";
    expect(trackHalves(ep, "d5e6", f3, "b")).toEqual([]);
    // A half promotes: a whole queen now, no half.
    const pro = [{ square: "a2", side: "a" as const }, { square: "h4", side: "h" as const }];
    const f4 = "4k3/8/8/8/7p/8/8/q3K3 w - - 0 1";
    expect(trackHalves(pro, "a2a1q", f4, "b")).toEqual([{ square: "h4", side: "h" }]);
    // Someone else's move leaves them be.
    const f5 = "4k3/8/8/3pp3/8/8/8/3K4 b - - 1 1";
    expect(trackHalves(halves, "e1d1", f5, "b")).toEqual(halves);
  });

  it("in a battle the halves follow the board: taken, they're gone", async () => {
    // The crowd takes a half whenever it can (the engine prefers it).
    const r = raid({
      seed: 2,
      engine: (get) => fakeEngine((fen, m) => (get().boss?.powers?.split?.halves.some((h) => h.square === m.slice(2, 4)) ? 0.99 : 0.3 + 0.4 * hash(fen + m))),
    });
    for (let i = 0; i < 14 && !r.isOver(); i++) {
      r.deal();
      const fen = fenOf(r);
      const allowed = r.crowdAllowed() ?? legalMoves(fen);
      const halves = r.boss!.powers!.split?.halves ?? [];
      const take = allowed.find((m) => halves.some((h) => h.square === m.slice(2, 4)));
      await r.score(new Map([["h0", { move: take ?? [...allowed].sort()[0]!, thinkMs: 1000 }]]));
      for (const h of r.boss!.powers!.split?.halves ?? []) expect(pieceAt(fenOf(r), h.square)).toEqual({ color: "b", type: "p" });
      if (take) expect((r.boss!.powers!.split?.halves ?? []).some((h) => h.square === take.slice(2, 4))).toBe(false);
      if (r.isOver() || r.stageComplete()) break;
      await r.playBoss();
      for (const h of r.boss!.powers!.split?.halves ?? []) expect(pieceAt(fenOf(r), h.square)).toEqual({ color: "b", type: "p" });
    }
  });
});

describe("Sawyer's saw cuts", () => {
  it("block straight moves across their edge: sliders, pawns and the king; a piece still lands from another side", () => {
    // A rook's slide crosses every edge on its way.
    expect(moveEdges("a1a4")).toEqual([{ a: "a1", b: "a2" }, { a: "a2", b: "a3" }, { a: "a3", b: "a4" }]);
    expect(crossesCut("a1a4", cutOf("a2", "a3"))).toBe(true);
    expect(crossesCut("a1a2", cutOf("a2", "a3"))).toBe(false);
    expect(crossesCut("h1d1", cutOf("d1", "e1"))).toBe(true);
    expect(crossesCut("d8d1", cutOf("d4", "d5"))).toBe(true);
    // A pawn's push and double step.
    expect(crossesCut("e2e4", cutOf("e3", "e4"))).toBe(true);
    expect(crossesCut("e2e4", cutOf("e2", "e3"))).toBe(true);
    expect(crossesCut("e2e3", cutOf("e3", "e4"))).toBe(false);
    expect(crossesCut("e7e5", cutOf("e5", "e6"))).toBe(true);
    // The king's step.
    expect(crossesCut("e1e2", cutOf("e1", "e2"))).toBe(true);
    expect(crossesCut("e1d1", cutOf("d1", "e1"))).toBe(true);
    // Landing on e4 from d4 (another side) is fine.
    expect(crossesCut("d4e4", cutOf("e3", "e4"))).toBe(false);
    expect(crossesCut("e5e4", cutOf("e3", "e4"))).toBe(false);
  });

  it("knights jump a cut, and diagonal moves pass at the corners (a bishop, a pawn's capture, the king's diagonal step)", () => {
    expect(moveEdges("g1f3")).toEqual([]);
    expect(moveEdges("b1d2")).toEqual([]);
    expect(crossesCut("g1f3", cutOf("g1", "g2"))).toBe(false);
    expect(crossesCut("f1c4", cutOf("e1", "e2"))).toBe(false);
    expect(crossesCut("e4d5", cutOf("d4", "e4"))).toBe(false);
    expect(crossesCut("e1f2", cutOf("e1", "e2"))).toBe(false);
  });

  it("castling: blocked by a cut on the king's way or the rook's", () => {
    const castle = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(moveEdges("e1g1", castle)).toEqual([{ a: "e1", b: "f1" }, { a: "f1", b: "g1" }, { a: "g1", b: "h1" }]);
    expect(crossesCut("e1g1", cutOf("f1", "g1"), castle)).toBe(true);
    expect(crossesCut("e1g1", cutOf("g1", "h1"), castle)).toBe(true); // the rook's way
    expect(crossesCut("e1c1", cutOf("a1", "b1"), castle)).toBe(true); // the rook's way
    expect(crossesCut("e1c1", cutOf("c1", "d1"), castle)).toBe(true);
    expect(crossesCut("e1g1", cutOf("c1", "d1"), castle)).toBe(false);
    expect(crossesCut("e1g1", cutOf("e1", "e2"), castle)).toBe(false);
    // In a battle: the allowed moves leave out castling across the cut, keep the other side's.
    const allowed = crowdAllowed(bossWith(castle, { cut: cutOf("f1", "g1") }), castle)!;
    expect(allowed).not.toContain("e1g1");
    expect(allowed).toContain("e1c1");
    // And for the boss (Black), the same.
    const black = "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1";
    const his = bossAllowed(bossWith(black, { cut: cutOf("b8", "c8") }), black)!;
    expect(his).not.toContain("e8c8");
    expect(his).toContain("e8g8");
  });

  it("checks still count across a cut (it stops moves, never attacks)", () => {
    // His rook on e8 checks the crowd's king on e1 straight through a cut on e4-e5.
    const fen = "4r1k1/8/8/8/8/8/8/4K3 w - - 0 1";
    const boss = bossWith(fen, { cut: cutOf("e4", "e5") });
    expect(inCheck(fen)).toBe(true);
    const allowed = crowdAllowed(boss, fen) ?? legalMoves(fen);
    // Only real escapes: nothing that ignores the check.
    expect(allowed.sort()).toEqual(legalMoves(fen).sort());
    expect(allowed).not.toContain("e1e2");
    // And a piece pinned across a cut stays pinned (its moves off the line aren't legal at all).
    const pin = "4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1";
    const pinned = crowdAllowed(bossWith(pin, { cut: cutOf("e4", "e5") }), pin) ?? legalMoves(pin);
    expect(pinned.some((m) => m.startsWith("e2"))).toBe(false);
  });

  it("a side whose only legal moves cross a cut may play them; a cut never blocks the only way out of check", () => {
    // The king's only move, h1-g1, crosses the cut: allowed.
    const only = "7k/8/8/8/8/6p1/6P1/7K w - - 0 1";
    expect(legalMoves(only)).toEqual(["h1g1"]);
    expect(crowdAllowed(bossWith(only, { cut: cutOf("g1", "h1") }), only)).toBeNull();
    // In check, the only escape (h1-h2) crosses the cut: allowed.
    const check = "6k1/8/8/8/8/8/6P1/r6K w - - 0 1";
    expect(inCheck(check)).toBe(true);
    expect(legalMoves(check)).toEqual(["h1h2"]);
    expect(crowdAllowed(bossWith(check, { cut: cutOf("h1", "h2") }), check)).toBeNull();
    // Two ways out, one across the cut: the other one.
    const two = "6k1/8/8/8/8/8/8/r6K w - - 0 1";
    expect(legalMoves(two).sort()).toEqual(["h1g2", "h1h2"]);
    expect(crowdAllowed(bossWith(two, { cut: cutOf("h1", "h2") }), two)).toEqual(["h1g2"]);
    // The board saw, the same: a king whose only moves cross between the d and e files may play them.
    const saw = "2r4k/8/8/8/1n1K4/8/8/8 w - - 0 1";
    expect(legalMoves(saw).sort()).toEqual(["d4e3", "d4e4", "d4e5"]);
    expect(crowdAllowed(bossWith(saw, { boardSaw: { at: 4, until: 8 } }), saw)).toBeNull();
    // The boss is lifted the same way.
    const his = "7k/6p1/6P1/8/8/8/8/7K b - - 0 1";
    expect(legalMoves(his)).toEqual(["h8g8"]);
    expect(bossAllowed(bossWith(his, { cut: cutOf("g8", "h8") }), his)).toBeNull();
  });

  it("are sawn on an edge of the crowd's half that one of its legal moves crosses, from the seed", () => {
    for (const fen of [START_FEN, "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", "2r2rk1/1p1q1ppp/p2p1n2/4p3/4P3/1PN1QP2/P1P3PP/2KR3R w - - 2 18"]) {
      const crossed = new Set(legalMoves(fen).flatMap((m) => moveEdges(m, fen).map((e) => `${e.a}-${e.b}`)));
      const picks = new Set<string>();
      for (let seed = 0; seed < 60; seed++) {
        const e = chooseCut(fen, "w", seed, 3)!;
        expect(Number(e.a[1])).toBeLessThanOrEqual(4);
        expect(Number(e.b[1])).toBeLessThanOrEqual(4);
        expect(crossed.has(`${e.a}-${e.b}`)).toBe(true);
        expect(chooseCut(fen, "w", seed, 3)).toEqual(e);
        picks.add(`${e.a}-${e.b}`);
      }
      expect(picks.size).toBeGreaterThan(2);
    }
    const black = applyMove(START_FEN, "e2e4");
    for (let seed = 0; seed < 20; seed++) expect(Number(chooseCut(black, "b", seed, 3)!.a[1])).toBeGreaterThanOrEqual(5);
  });

  it("every 4 crowd turns from the 3rd, for 3 turns then a turn's gap, blocking both sides; a cut turn is a power turn; the judge plays by it", async () => {
    // The engine likes moves across the cut best: the judge must still pick an allowed one.
    const r = raid({ patch: { bossMaxMoves: 30 }, engine: (get) => fakeEngine((fen, m) => (crossesCut(m, get().boss?.powers?.cut, fen) ? 0.97 : 0.3 + 0.4 * hash(fen + m))) });
    const seen: { turn: number; cut: string | null }[] = [];
    let judged = 0;
    for (let i = 0; i < 14 && !r.isOver(); i++) {
      const b = r.boss!;
      const cut = b.powers!.cut ?? null;
      seen.push({ turn: b.powers!.turn, cut: cut ? `${cut.a}-${cut.b}` : null });
      const fen = fenOf(r);
      const allowed = r.crowdAllowed();
      if (cut) {
        for (const m of allowed ?? legalMoves(fen)) if (allowed) expect(crossesCut(m, cut, fen)).toBe(false);
        expect(powerTurn(b)).toBe(true);
        expect(r.bossView()!.powers!.cut).toEqual(cut);
        if (cut.at === b.powers!.turn) expect(b.powers!.events).toContainEqual({ kind: "cut", turn: cut.at, square: cut.a, squares: [cut.a, cut.b] });
      } else if (b.powers!.turn > 2) expect(powerTurn(b)).toBe(false);
      const best = await turn(r);
      if (cut && allowed && best) {
        expect(allowed).toContain(best);
        judged++;
      }
      // His own move didn't cross it either, while it was there.
      const last = r.boards.get(0)!.lastMove!;
      if (cut && cut.until >= r.boss!.crowdMoves) expect(crossesCut(last, cut)).toBe(false);
    }
    const on = seen.filter((s) => s.cut).map((s) => s.turn);
    expect(on.slice(0, 9)).toEqual([3, 4, 5, 7, 8, 9, 11, 12, 13]);
    expect(seen.find((s) => s.turn === 3)!.cut).toBe(seen.find((s) => s.turn === 5)!.cut);
    expect(seen.find((s) => s.turn === 6)!.cut).toBeNull();
    expect(judged).toBeGreaterThan(0);
    expect(powerMomentMs([{ kind: "cut" }])).toBe(SAW_CUT.ms);
  });
});

describe("Sawyer's board saw", () => {
  it("no move crosses between the d and e files, knights and castling included", () => {
    expect(crossesMiddle("d4e5")).toBe(true);
    expect(crossesMiddle("e4d5")).toBe(true);
    expect(crossesMiddle("d2e4")).toBe(true); // a knight
    expect(crossesMiddle("g1f3")).toBe(false);
    expect(crossesMiddle("b1d2")).toBe(false);
    expect(crossesMiddle("a1h1")).toBe(true);
    expect(crossesMiddle("e1c1")).toBe(true); // castling long
    expect(crossesMiddle("e1g1")).toBe(false);
    expect(crossesMiddle("d1d8")).toBe(false);
    const fen = "r3k2r/pppq1ppp/2n2n2/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1";
    const allowed = crowdAllowed(bossWith(fen, { boardSaw: { at: 4, until: 8 } }), fen)!;
    expect(allowed.length).toBeGreaterThan(0);
    for (const m of allowed) expect(crossesMiddle(m)).toBe(false);
    expect(allowed).toContain("e1g1");
    expect(allowed).not.toContain("e1c1");
    const black = fen.replace(" w ", " b ");
    for (const m of bossAllowed(bossWith(black, { boardSaw: { at: 4, until: 8 } }), black)!) expect(crossesMiddle(m)).toBe(false);
  });

  it("knows which half favours him on material", () => {
    expect(favouredHalf(START_FEN, "w")).toBeNull();
    // The crowd (White) without its a1 rook: files a-d are his.
    expect(favouredHalf(START_FEN.replace("RNBQKBNR", "1NBQKBNR"), "w")).toBe("a-d");
    // Without its g1 knight: e-h.
    expect(favouredHalf(START_FEN.replace("RNBQKBNR", "RNBQKB1R"), "w")).toBe("e-h");
    // For a Black crowd, the other way round.
    expect(favouredHalf(START_FEN.replace("rnbqkbnr", "rnbqkb1r"), "b")).toBe("e-h");
    expect(favouredHalf(START_FEN.replace("rnbqkbnr", "rnbqkb1r"), "w")).toBeNull();
  });

  it("needs the meter full, turn 10 or later and a half his: the warning, then the saw for 5 turns, then the halves rejoin", () => {
    const even = START_FEN;
    const his = START_FEN.replace("RNBQKBNR", "1NBQKBNR");
    // (No cuts in the way: the passive is held off.)
    const at = (fen: string, turn: number, p: Partial<BossPowerState> = {}) => prepareTurn(bossWith(fen, { turn: turn - 1, charge: 100, nextPassive: 99, ...p }, "w", turn - 1), fen);
    // The meter full, a half his, but turn 9: nothing.
    expect(at(his, 9).powers!.warnAt).toBeUndefined();
    // Turn 10 but no half his: nothing.
    expect(at(even, 10).powers!.warnAt).toBeUndefined();
    // The meter not full: nothing.
    expect(at(his, 10, { charge: 20 }).powers!.warnAt).toBeUndefined();
    // All three: the warning.
    const warned = at(his, 10);
    expect(warned.powers!.warnAt).toBe(10);
    expect(warned.powers!.events).toContainEqual({ kind: "warn", turn: 10 });
    // The next turn, the saw (whatever the material by then: the warning promised it).
    const sawn = prepareTurn({ ...warned, crowdMoves: 10 }, even);
    expect(sawn.powers!.ultAt).toBe(11);
    expect(sawn.powers!.boardSaw).toEqual({ at: 11, until: 15 });
    expect(sawn.powers!.events).toContainEqual({ kind: "boardsaw", turn: 11 });
    expect(rageOf({ ...sawn, crowdMoves: 11 })).toBeNull();
    // Through turn 15, then gone.
    let s = sawn;
    for (let t = 12; t <= 16; t++) {
      s = prepareTurn({ ...s, crowdMoves: t - 1 }, even);
      expect(!!s.powers!.boardSaw).toBe(t <= 15);
      expect(powerTurn(s)).toBe(t <= 15);
    }
    expect(powerMomentMs([{ kind: "boardsaw" }])).toBe(BOARD_SAW.total);
  });

  it("the test switch: warned as turn 2 begins and sawn on turn 3, whatever the board; the trigger: as the next turn begins", async () => {
    const r = raid({ patch: { bossPowerTest: "boardsaw" } });
    await turn(r);
    expect(r.boss!.powers!.warnAt).toBe(2);
    await turn(r);
    expect(r.boss!.powers!.ultAt).toBe(3);
    expect(r.boss!.powers!.boardSaw).toEqual({ at: 3, until: 7 });
    for (const m of r.crowdAllowed() ?? []) expect(crossesMiddle(m)).toBe(false);
    expect(r.bossView()!.powers!.boardSaw).toEqual({ at: 3, until: 7 });
    // The cut that was due on turn 3 waits a turn.
    expect(r.boss!.powers!.cut ?? null).toBeNull();
    await turn(r);
    expect(r.boss!.powers!.cut).toBeTruthy();

    const t = raid();
    await turn(t);
    expect(triggerUltimate(t.boss).ok).toBe(true);
    expect(t.triggerUltimate()).toBe(true);
    await turn(t);
    expect(t.boss!.powers!.warnAt).toBeUndefined();
    expect(t.boss!.powers!.boardSaw).toEqual({ at: 3, until: 7 });
    expect(t.triggerUltimate()).toBe(false);
  });
});
