/**
 * Boingo's pie (Eric, Nov 12: thrown in the face of one of the crowd's pieces whose two squares diagonally behind it are
 * empty; it splits onto those two). The target rule, the two squares pied for a crowd turn (both sides), the splat mark
 * that follows its piece, a second splat freezing it for a turn, and the guards. docs/decisions/2026-11-12-boingo-face-pie.md.
 */
import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DEFAULT_SETTINGS, RAID_SETTINGS, mulberry32, type BossState, type Settings, type SplatMark } from "@chessroyale/core";
import {
  MatchRunner,
  applyMove,
  behindSquares,
  bossAllowed,
  choosePieThrow,
  crowdAllowed,
  lands,
  followSplats,
  icedSquares,
  initPowers,
  legalMoves,
  pieceAt,
  powerTurn,
  prepareTurn,
  sanLineToUci,
  type EngineLike,
  type Opening,
} from "../src/index.ts";

/** A boss battle's state at the crowd's turn (White), Boingo's powers. */
const battle = (fen: string, patch: Partial<BossState> = {}, seed = 7): BossState => ({ id: "clown", elo: 1500, crowdSide: "w", crowdMoves: 0, sinceKill: 0, kills: [], powers: initPowers(seed, fen, "w"), ...patch });

/** As crowd turn `turn` begins (the boss has moved), in `fen`. */
const at = (b: BossState, fen: string, turn: number, test = "") => prepareTurn({ ...b, crowdMoves: turn - 1 }, fen, test);

// White: Ke1, Bb1 (can reach d3), Ng1 (can reach f3), the e4 pawn (d3 and f3 behind it empty). Black: Ke8, Ne5 (reaches d3, f3).
const B = "4k3/8/8/4n3/4P3/8/8/1B2K1N1 w - - 0 1";

describe("Boingo's pie: the target", () => {
  it("the two squares diagonally behind a piece, toward the crowd's own back rank; none on an edge file or the back rank", () => {
    expect(behindSquares("e4", "w")).toEqual(["d3", "f3"]);
    expect(behindSquares("e5", "b")).toEqual(["d6", "f6"]);
    expect(behindSquares("b2", "w")).toEqual(["a1", "c1"]);
    expect(behindSquares("g7", "b")).toEqual(["f8", "h8"]);
    for (const sq of ["a4", "h4", "a7", "h2"]) expect(behindSquares(sq, "w")).toBeNull();
    expect(behindSquares("d1", "w")).toBeNull();
    expect(behindSquares("d8", "b")).toBeNull();
  });

  it("only a piece (never the king) with both squares behind it on the board and empty; none: no throw", () => {
    // The e4 pawn: d3 and f3 empty.
    expect(choosePieThrow("4k3/8/8/8/4P3/8/8/4K3 w - - 0 1", "w", 1, 2)).toEqual({ square: "e4", piece: "p", pied: ["d3", "f3"], freeze: false });
    // One of them taken (a piece of either side), an edge file, the back rank, the king: no target.
    expect(choosePieThrow("4k3/8/8/8/4P3/5n2/8/4K3 w - - 0 1", "w", 1, 2)).toBeNull();
    expect(choosePieThrow("4k3/8/8/8/4P3/3B4/8/4K3 w - - 0 1", "w", 1, 2)?.square).not.toBe("e4");
    expect(choosePieThrow("4k3/8/8/8/P6P/8/8/4K3 w - - 0 1", "w", 1, 2)).toBeNull();
    expect(choosePieThrow("4k3/8/8/8/8/8/8/R2QK2R w - - 0 1", "w", 1, 2)).toBeNull();
    expect(choosePieThrow("4k3/8/8/8/4K3/8/8/8 w - - 0 1", "w", 1, 2)).toBeNull();
    // A square already pied isn't pied again.
    expect(choosePieThrow("4k3/8/8/8/4P3/8/8/4K3 w - - 0 1", "w", 1, 2, [], ["d3"])).toBeNull();
    // The crowd as Black: behind is toward rank 8.
    expect(choosePieThrow("4k3/8/8/4p3/8/8/8/4K3 b - - 0 1", "b", 1, 2)).toEqual({ square: "e5", piece: "p", pied: ["d6", "f6"], freeze: false });
  });

  it("a real nuisance: the piece whose pies take away the most of the crowd's moves (its own retreats double), a pick of the top three from the seed", () => {
    // Over many positions every pick is a valid target among the top three, the same for the same seed, and not always the same piece.
    const rng = mulberry32(4);
    let fen = "r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 6 6";
    let throws = 0;
    for (let i = 0; i < 120 && legalMoves(fen).length; i++) {
      if (fen.split(" ")[1] === "w") {
        const pick = choosePieThrow(fen, "w", 9, i);
        expect(choosePieThrow(fen, "w", 9, i)).toEqual(pick);
        if (pick) {
          throws++;
          const pc = pieceAt(fen, pick.square)!;
          expect(pc.color).toBe("w");
          expect(pc.type).not.toBe("k");
          expect(pick.pied).toEqual(behindSquares(pick.square, "w"));
          for (const sq of pick.pied) expect(pieceAt(fen, sq)).toBeNull();
        }
      }
      const legal = legalMoves(fen);
      fen = applyMove(fen, legal[Math.floor(rng() * legal.length)]!);
    }
    expect(throws).toBeGreaterThan(10);
    // Several targets: different seeds pick different pieces.
    const many = "4k3/8/8/8/2P1P1P1/8/8/4K3 w - - 0 1";
    expect(new Set(Array.from({ length: 30 }, (_, s) => choosePieThrow(many, "w", s, 2)!.square)).size).toBeGreaterThan(1);
    // (Here the e4 pawn is the only target: the bishop and the knight stand on the back rank.)
    const ranked = choosePieThrow(B, "w", 1, 2);
    expect(ranked?.square).toBe("e4");
  });

  it("the ranking (review of the face pie): the top three by moves taken away (own retreats double), then value, then square", () => {
    // Targets and their scores: Be3 6 (its retreats d2 and f2 double, the king's e1-d2 and e1-f2); the b5, d5 pawns 1 each
    // (c2-c4 onto their pie), the c2 pawn 1 (e1-d1); the g4 pawn 0. Top three: e3, then b5 and c2 (by square). Never d5 or g4.
    const fen = "4k3/8/8/1P1P4/6P1/4B3/2P5/4K3 w - - 0 1";
    const picks = new Set(Array.from({ length: 60 }, (_, s) => choosePieThrow(fen, "w", s, 2)!.square));
    expect([...picks].sort()).toEqual(["b5", "c2", "e3"]);
  });

  it("castling's rook can't land on a pie (review of the face pie, Nov 12)", () => {
    // He throws at the bishop on e2: d1 and f1 pied. O-O would put the rook on f1: refused.
    const F = "r3k3/pppppppp/8/8/Q7/8/4BPPP/4K2R w K - 0 1";
    expect(lands("e1g1", F).sort()).toEqual(["f1", "g1"]);
    expect(lands("e1f1", F)).toEqual(["f1"]);
    const b = at(battle(F), F, 2);
    expect((b.powers!.pies ?? []).map((p) => p.square).sort()).toEqual(["d1", "f1"]);
    expect(legalMoves(F)).toContain("e1g1");
    expect(crowdAllowed(b, F)).not.toContain("e1g1");
  });

  it("the guards: the crowd keeps a move with the squares pied (and the piece frozen), in check too", () => {
    // White in check from the rook on a8; the king's squares covered (b1 by the knight on d2, b2 by the one on d3). The only
    // move: Nc2-a3. The b4 pawn's pies (a3, c3) would take it: never b4. The knight on c2 (pies b1, d1) leaves a3 open.
    const fen = "r3k3/8/8/8/1P6/3n4/2Nn4/K7 w - - 0 1";
    expect(legalMoves(fen)).toEqual(["c2a3"]);
    for (let s = 0; s < 20; s++) expect(choosePieThrow(fen, "w", s, 2)?.square).toBe("c2");
    // A second splat on the knight would freeze its only move: no throw at all.
    expect(choosePieThrow(fen, "w", 1, 2, [{ square: "c2", piece: "n", n: 1 }])).toBeNull();
    // The rook on c4 is the only piece that can answer the check (Rc4-a4); its pies (b3, d3) don't stop that, its freeze would.
    const rook = "r3k3/8/8/8/2R5/2p5/3n4/K7 w - - 0 1";
    expect(legalMoves(rook)).toEqual(["c4a4"]);
    expect(choosePieThrow(rook, "w", 1, 2)?.square).toBe("c4");
    expect(choosePieThrow(rook, "w", 1, 2, [{ square: "c4", piece: "r", n: 1 }])).toBeNull();
  });
});

describe("Boingo's pie as a turn begins", () => {
  it("from turn 2: the two squares pied for one crowd turn, both sides kept off them; a splat mark on the piece; gone the turn after", () => {
    let b = at(battle(B), B, 1);
    expect(b.powers!.pies ?? []).toEqual([]);
    b = at(b, B, 2);
    expect(b.powers!.events).toEqual([{ kind: "pie", turn: 2, square: "e4", squares: ["d3", "f3"] }]);
    expect(b.powers!.pies).toEqual([{ square: "d3", until: 2 }, { square: "f3", until: 2 }]);
    expect(b.powers!.splats).toEqual([{ square: "e4", piece: "p", n: 1 }]);
    expect(BOSS_POWERS.pieTurns).toBe(1);
    // The crowd: not the bishop to d3 nor the knight to f3.
    expect(legalMoves(B)).toEqual(expect.arrayContaining(["b1d3", "g1f3"]));
    const allowed = crowdAllowed(b, B)!;
    expect(allowed).not.toContain("b1d3");
    expect(allowed).not.toContain("g1f3");
    expect(allowed).toContain("e1e2");
    expect(powerTurn(b)).toBe(true);
    // The boss, after the crowd's move: not his knight to d3 or f3.
    const after = applyMove(B, "e1e2");
    expect(legalMoves(after)).toEqual(expect.arrayContaining(["e5d3", "e5f3"]));
    const his = bossAllowed(b, after)!;
    expect(his).not.toContain("e5d3");
    expect(his).not.toContain("e5f3");
    // The next turn: the pies gone (just one turn), the mark still on the pawn, no throw (every pieEvery turns).
    b = at(b, B, 3);
    expect(b.powers!.pies).toEqual([]);
    expect(b.powers!.events).toEqual([]);
    expect(b.powers!.splats).toEqual([{ square: "e4", piece: "p", n: 1 }]);
    expect(crowdAllowed(b, B)).toBeNull();
  });

  it("a second splat on the same piece freezes it for one crowd turn, and its mark goes", () => {
    let b = battle(B);
    for (let turn = 1; turn <= 2 + BOSS_POWERS.pieEvery; turn++) b = at(b, B, turn);
    // (The e4 pawn is the only target: the second throw hits it again.)
    expect(b.powers!.events).toEqual([{ kind: "pie", turn: 4, square: "e4", squares: ["d3", "f3"] }]);
    expect(b.powers!.frozen).toEqual({ square: "e4", piece: "p", until: 4 });
    expect(b.powers!.splats).toEqual([]);
    expect(icedSquares(b, B)).toEqual(["e4"]);
    const allowed = crowdAllowed(b, B)!;
    expect(allowed.some((m) => m.startsWith("e4"))).toBe(false);
    expect(allowed.length).toBeGreaterThan(0);
    // One turn: free again the next.
    b = at(b, B, 5);
    expect(b.powers!.frozen).toBeNull();
    expect(icedSquares(b, B)).toEqual([]);
    expect(crowdAllowed(b, B)).toBeNull();
  });

  it("the test switch (?power=pie): a throw every turn, the splatted piece first, so the freeze comes on turn 3", () => {
    const fen = "4k3/8/8/8/2P1P1P1/8/8/4K3 w - - 0 1";
    let b = at(at(battle(fen), fen, 1, "pie"), fen, 2, "pie");
    const hit = b.powers!.events[0]!.square!;
    expect(b.powers!.splats).toEqual([{ square: hit, piece: "p", n: 1 }]);
    b = at(b, fen, 3, "pie");
    expect(b.powers!.events[0]!.square).toBe(hit);
    expect(b.powers!.frozen).toEqual({ square: hit, piece: "p", until: 3 });
  });
});

describe("Boingo's splat marks follow their pieces", () => {
  const mark = (square: string, piece = "p"): SplatMark => ({ square, piece, n: 1 });
  it("a move takes the mark with it; a capture, en passant too, takes it away; castling's rook and a promotion keep it", () => {
    const start = "4k3/8/8/8/4P3/8/8/4K3 w - - 0 1";
    expect(followSplats([mark("e4")], "e4e5", applyMove(start, "e4e5"), "w")).toEqual([mark("e5")]);
    // Another piece moving: it stays.
    expect(followSplats([mark("e4")], "e1d2", applyMove(start, "e1d2"), "w")).toEqual([mark("e4")]);
    // Taken by the boss.
    const taking = "4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1";
    expect(followSplats([mark("e4")], "d5e4", applyMove(taking, "d5e4"), "w")).toEqual([]);
    // En passant: the pawn that double-stepped to e4 is gone from e4 (the boss's pawn lands on e3).
    const ep = "4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1";
    expect(followSplats([mark("e4")], "d4e3", applyMove(ep, "d4e3"), "w")).toEqual([]);
    // Castling: the rook goes round the king, its mark with it (both sides).
    const castle = "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    expect(followSplats([mark("h1", "r")], "e1g1", applyMove(castle, "e1g1"), "w")).toEqual([mark("f1", "r")]);
    expect(followSplats([mark("a1", "r")], "e1c1", applyMove(castle, "e1c1"), "w")).toEqual([mark("d1", "r")]);
    // A promotion: the mark stays on the new piece, of its new kind.
    const promo = "k7/4P3/8/8/8/8/8/4K3 w - - 0 1";
    expect(followSplats([mark("e7")], "e7e8q", applyMove(promo, "e7e8q"), "w")).toEqual([mark("e8", "q")]);
  });

  it("in a match (solo, raids and online run the same runner): every mark stays on one of the crowd's pieces of its kind, and frozen pieces never move", async () => {
    const score = (fen: string, m: string) => {
      let h = 2166136261;
      for (const c of fen + m) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      return 0.3 + 0.4 * ((h >>> 0) / 4294967296);
    };
    const engine: EngineLike = {
      topMoves: async (fen, n) => legalMoves(fen).map((move) => ({ move, expected: score(fen, move) })).sort((a, b) => b.expected - a.expected).slice(0, n),
      scoreMoves: async (fen, moves) => [...new Set(moves)].sort().map((move) => ({ move, expected: score(fen, move) })),
      playAtElo: async (fen) => legalMoves(fen).sort()[0]!,
    };
    const moves = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7"]);
    const opening: Opening = { id: "o", eco: "", name: "Test", family: "Test", unusual: false, moves, namedPlies: moves.length, expected: { [moves.length]: 0.52 } };
    let marked = 0;
    let frozen = 0;
    for (const seed of [1, 2, 3]) {
      // (The test switch: a throw every turn, so marks and freezes come often.)
      const settings = { ...DEFAULT_SETTINGS, ...RAID_SETTINGS, bossFixedElo: 2000, bossId: "clown", bossPowerTest: "pie", lastStandFrom: 999, bossMaxMoves: 40 } as Settings;
      const runner = new MatchRunner({ settings, rng: mulberry32(seed), engines: [engine], library: [opening], entrants: [{ id: "h0", name: "H", isBot: false }] });
      const rng = mulberry32(seed * 11);
      for (let i = 0; i < 80 && !runner.stageComplete(); i++) {
        const check = () => {
          const fen = runner.boards.get(0)!.fen;
          for (const m of runner.boss!.powers!.splats ?? []) {
            expect(pieceAt(fen, m.square)).toEqual({ color: "w", type: m.piece });
            marked++;
          }
          expect(runner.bossView()!.powers!.splats).toEqual(runner.boss!.powers!.splats ?? []);
        };
        if (runner.bossToMove()) {
          await runner.playBoss();
          check();
          continue;
        }
        if (runner.funhouseDue()) {
          await runner.playFunhouse();
          check();
          continue;
        }
        runner.deal();
        check();
        const fen = runner.boards.get(0)!.fen;
        const allowed = runner.crowdAllowed() ?? legalMoves(fen);
        const f = runner.boss!.powers!.frozen;
        if (f && allowed.length < legalMoves(fen).length) {
          frozen++;
          expect(allowed.some((m) => m.startsWith(f.square))).toBe(false);
        }
        await runner.score(new Map([["h0", { move: allowed[Math.floor(rng() * allowed.length)]!, thinkMs: 1000 }]]));
        check();
      }
    }
    expect(marked).toBeGreaterThan(0);
    expect(frozen).toBeGreaterThan(0);
  });
});
