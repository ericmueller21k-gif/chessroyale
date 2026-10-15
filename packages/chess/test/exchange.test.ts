import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, OPENING_ALLOWANCE, mulberry32, openingAllowance } from "@chessroyale/core";
import { MatchRunner, exchangeNet, legalMoves, materialSlips, moveNumber, sanLineToUci, type EngineLike, type Opening } from "../src/index.ts";

// The exchange check: the opening allowance's material fallback (docs/decisions/2026-10-15-opening-allowance-and-ties.md).

describe("the exchange check", () => {
  it("sees a piece left hanging", () => {
    // After 1.e4 e5: Ba6 puts the bishop where b7 (or the knight) takes it, with nothing to take back.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(exchangeNet(fen, "f1a6")).toBe(-3);
    expect(exchangeNet(fen, "g1f3")).toBe(0);
    expect(materialSlips(fen, "g1f3", ["f1a6", "b1c3"], 1)).toEqual(new Map([["f1a6", "gave"]]));
  });

  it("sees a capture passed up", () => {
    // A black knight on e4, attacked by the knight on c3 and defended by nothing.
    const fen = "rnbqkb1r/pppppppp/8/8/4n3/2N5/PPPPPPPP/R1BQKBNR w KQkq - 2 3";
    expect(exchangeNet(fen, "c3e4")).toBe(3);
    expect(materialSlips(fen, "c3e4", ["a2a3", "c3e4", "g1f3"], 1)).toEqual(
      new Map([
        ["a2a3", "missed"],
        ["g1f3", "missed"],
      ]),
    );
  });

  it("sees a gambit as material given (it only loses the allowance: the engine's own small loss counts)", () => {
    // The King's Gambit: f4 can be taken, and nothing takes back.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(exchangeNet(fen, "f2f4")).toBe(-1);
    expect(materialSlips(fen, "g1f3", ["f2f4"], OPENING_ALLOWANCE.materialPawns).get("f2f4")).toBe("gave");
  });

  it("counts a capture en passant, made or allowed", () => {
    // 1.e4 f5 2.e5 d5: exd6 e.p. takes a pawn; a black pawn takes back on d6.
    const ep = "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
    expect(exchangeNet(ep, "e5d6")).toBe(0);
    // A pawn pushed two squares past an enemy pawn, with nothing to take back on the square it passed: lost en passant.
    const allow = "4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1";
    expect(exchangeNet(allow, "e2e4")).toBe(-1);
    expect(exchangeNet(allow, "e1f2")).toBe(0);
  });

  it("counts a promotion's gain, and a promoted piece that can be taken", () => {
    const fen = "3r4/4P3/8/8/8/k7/8/4K3 w - - 0 1";
    // Takes the rook (5) and makes a queen (8 more).
    expect(exchangeNet(fen, "e7d8q")).toBe(13);
    // A queen made on e8, where the rook takes it: 8 gained, 9 lost.
    expect(exchangeNet(fen, "e7e8q")).toBe(-1);
    expect(exchangeNet(fen, "e7e8n")).toBe(2 - 3);
  });

  it("follows the rules after a capture that gives check", () => {
    // Italian: Bxf7+ takes a pawn with check; the king takes back (one of its two ways out).
    const italian = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    expect(exchangeNet(italian, "c4f7")).toBe(-2);
    // Scholar's mate: a capture that mates keeps what it took.
    const scholar = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    expect(exchangeNet(scholar, "h5f7")).toBe(1);
  });

  it("can't read a move with no piece of the side to move: never a slip", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(exchangeNet(fen, "e7e5")).toBeNull();
    expect(exchangeNet(fen, "e3e4")).toBeNull();
    expect(materialSlips(fen, "e2e4", ["e7e5", "e3e4"], 1).size).toBe(0);
  });

  it("answers a check first, and castles the rook across", () => {
    // A check is answered first: after Bb5+ the knight on e4 can't be taken by ...Qxe4?? style captures elsewhere.
    const fen = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3";
    expect(exchangeNet(fen, "f1b5")).toBe(0);
    // Castling: the rook comes across, nothing is left to take.
    const castle = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5";
    expect(exchangeNet(castle, "e1g1")).toBe(0);
  });

  it("gives the same answer whatever order the picks come in, every time", () => {
    const fen = "rnbqkb1r/pppppppp/8/8/4n3/2N5/PPPPPPPP/R1BQKBNR w KQkq - 2 3";
    const moves = legalMoves(fen);
    const a = materialSlips(fen, "c3e4", moves, 1);
    const b = materialSlips(fen, "c3e4", [...moves].reverse(), 1);
    expect([...a].sort()).toEqual([...b].sort());
    expect([...materialSlips(fen, "c3e4", moves, 1)]).toEqual([...a]);
  });
});

describe("the allowance on a board", () => {
  const hash = (s: string) => {
    let h = 2166136261;
    for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
  };
  const fake: EngineLike = {
    async topMoves(fen, n) {
      return legalMoves(fen)
        .map((move) => ({ move, expected: 0.3 + 0.4 * hash(fen + move) }))
        .sort((a, b) => b.expected - a.expected)
        .slice(0, n);
    },
    async scoreMoves(fen, moves) {
      return moves.map((move) => ({ move, expected: 0.3 + 0.4 * hash(fen + move) }));
    },
  };
  const line = sanLineToUci(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"]);
  const library: Opening[] = Array.from({ length: 30 }, (_, i) => ({
    id: `o${i}`,
    eco: "C84",
    name: `Opening ${i}`,
    family: `Family ${i}`,
    unusual: i >= 25,
    moves: line,
    namedPlies: line.length,
    expected: Object.fromEntries(Array.from({ length: line.length + 1 }, (_, n) => [n, 0.5])),
  }));

  it("two judges of the same board give identical per-move allowances", () => {
    const make = () =>
      new MatchRunner({
        settings: DEFAULT_SETTINGS,
        rng: mulberry32(7),
        engines: [fake],
        library,
        entrants: Array.from({ length: 64 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 2 })),
      });
    const one = make();
    const groups = one.deal();
    const [boardId, ids] = [...groups][0]!;
    const fen = one.boards.get(boardId)!.fen;
    expect(openingAllowance(moveNumber(fen))).toBeGreaterThan(0);
    // Every legal move picked by someone, and the same scores on both judges.
    const legal = legalMoves(fen);
    const picks = Object.fromEntries(ids.map((id, i) => [id, legal[(i * 7) % legal.length]!]));
    const expectedAfter = Object.fromEntries(legal.map((m) => [m, 0.3 + 0.4 * hash(fen + m)]));
    const best = legal.reduce((a, b) => (expectedAfter[b]! > expectedAfter[a]! ? b : a));
    const evaluation = { bestMove: best, bestExpected: expectedAfter[best]!, expectedAfter };
    const two = MatchRunner.restore(one.snapshot(), { settings: DEFAULT_SETTINGS, rng: mulberry32(7), engines: [fake], library });
    const a = one.resolveBoard(boardId, ids, picks, evaluation).result.players;
    const b = two.resolveBoard(boardId, ids, picks, evaluation).result.players;
    const view = (ps: typeof a) => ps.map((p) => [p.playerId, p.loss, p.counted ?? null, p.material ?? null, p.roundScore]);
    expect(view(b)).toEqual(view(a));
    // Some picks were forgiven, and any slip kept its whole loss.
    expect(a.some((p) => p.counted !== undefined)).toBe(true);
    for (const p of a) if (p.material) expect(p.counted).toBeUndefined();
  });
});
