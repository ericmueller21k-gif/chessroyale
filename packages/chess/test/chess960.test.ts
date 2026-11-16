import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { mulberry32 } from "@chessroyale/core";
import {
  applyMove,
  applyMove960,
  castleShortcuts960,
  CHESS960_STANDARD_INDEX,
  chess960BackRank,
  chess960Fen,
  fenAfter,
  gameEnd,
  gameEnd960,
  inCheck,
  isChess960Fen,
  legalMoves,
  legalMoves960,
  perft960,
  pieceAt,
  positionOver,
  randomChess960,
  replay960,
  sanToUci960,
  START_FEN,
  toSan,
  toSan960,
} from "../src/index.ts";

/** Perft through the FEN functions themselves (every position written out and read back in, as the game uses them). */
function perftByFen(fen: string, depth: number): number {
  const moves = legalMoves960(fen);
  if (depth === 1) return moves.length;
  return moves.reduce((n, m) => n + perftByFen(applyMove960(fen, m), depth - 1), 0);
}

describe("Chess960 start positions", () => {
  it("numbers them the standard way: 0, 518 (the normal setup) and 959", () => {
    expect(chess960BackRank(0)).toBe("BBQNNRKR");
    expect(chess960BackRank(CHESS960_STANDARD_INDEX)).toBe("RNBQKBNR");
    expect(chess960BackRank(959)).toBe("RKRNNQBB");
    expect(chess960Fen(518)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1");
    expect(chess960Fen(0)).toBe("bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1");
    expect(() => chess960BackRank(960)).toThrow();
    expect(() => chess960BackRank(-1)).toThrow();
    expect(() => chess960BackRank(1.5)).toThrow();
  });

  it("gives 960 different setups, each with bishops on both colors and the king between the rooks", () => {
    const ranks = new Set<string>();
    for (let i = 0; i < 960; i++) {
      const r = chess960BackRank(i);
      ranks.add(r);
      expect([...r].sort().join("")).toBe("BBKNNQRR");
      const bishops = [...r].flatMap((p, f) => (p === "B" ? [f % 2] : []));
      expect(bishops.sort()).toEqual([0, 1]);
      expect(r.indexOf("R")).toBeLessThan(r.indexOf("K"));
      expect(r.lastIndexOf("R")).toBeGreaterThan(r.indexOf("K"));
    }
    expect(ranks.size).toBe(960);
  });

  it("draws one from a seeded random source: the same seed, the same position", () => {
    const a = randomChess960(mulberry32(7));
    expect(randomChess960(mulberry32(7))).toEqual(a);
    expect(a.fen).toBe(chess960Fen(a.index));
    const seen = new Set(Array.from({ length: 200 }, (_, s) => randomChess960(mulberry32(s)).index));
    expect(seen.size).toBeGreaterThan(150);
    expect(randomChess960(() => 0).index).toBe(0);
    expect(randomChess960(() => 0.9999999999).index).toBe(959);
  });
});

describe("Chess960 FEN", () => {
  it("round-trips every start position and mid-game positions", () => {
    for (let i = 0; i < 960; i++) expect(replay960(chess960Fen(i), [])).toBe(chess960Fen(i));
    const mid = "bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9";
    expect(replay960(mid, [])).toBe(mid);
    // (A position given without its move counts gets the usual 0 and 1.)
    expect(replay960("bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf -", [])).toBe("bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 0 1");
  });

  it("reads X-FEN's KQkq as the outermost rooks and writes the files (Shredder-FEN)", () => {
    expect(replay960(START_FEN, [])).toBe(chess960Fen(518));
    expect(replay960("qnrbkrbn/pppppppp/8/8/8/8/PPPPPPPP/QNRBKRBN w KQkq - 0 1", [])).toBe("qnrbkrbn/pppppppp/8/8/8/8/PPPPPPPP/QNRBKRBN w FCfc - 0 1");
  });

  it("writes rights White first, the king's side first, and refuses rights with no rook to match", () => {
    expect(replay960("rk5r/8/8/8/8/8/8/RK5R w ahHA - 0 1", [])).toBe("rk5r/8/8/8/8/8/8/RK5R w HAha - 0 1");
    expect(() => replay960("rk5r/8/8/8/8/8/8/RK5R w G - 0 1", [])).toThrow();
    expect(() => replay960("rk5r/8/8/8/8/8/8/1K4RR w GH - 0 1", [])).toThrow();
    expect(() => replay960("rk5r/8/8/8/8/8/8/R6R w HA - 0 1", [])).toThrow();
  });

  it("writes an en passant square only when the capture is legal, as chess.js does", () => {
    const fen = chess960Fen(0);
    expect(applyMove960(fen, "e2e4").split(" ")[3]).toBe("-");
    const ready = replay960(fen, ["e2e4", "a7a6", "e4e5"]);
    expect(applyMove960(ready, "d7d5").split(" ")[3]).toBe("d6");
    expect(legalMoves960(applyMove960(ready, "d7d5"))).toContain("e5d6");
  });

  it("knows a Chess960 FEN by its castling field, never a normal one", () => {
    expect(isChess960Fen(chess960Fen(0))).toBe(true);
    expect(isChess960Fen(chess960Fen(518))).toBe(true);
    expect(isChess960Fen("rk5r/8/8/8/8/8/8/RK5R w Ha - 0 1")).toBe(true);
    for (const f of [START_FEN, "8/8/8/8/8/8/8/k6K w - - 0 1", "r3k2r/8/8/8/8/8/8/R3K2R b Kq e3 0 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"]) {
      expect(isChess960Fen(f)).toBe(false);
    }
  });
});

/**
 * Published Chess960 perft results (chessprogramming.org, "Chess960 Perft Results", the same table as python-chess's
 * examples/perft/chess960.perft and Ethereal's fischer.epd; ids are that table's). Chosen for their castling: the king
 * already on its square, the rook already on its square, the two swapping, the rook passing over the king, the king
 * taking a rook on its own landing square, rooks beside the king, and both sides able to castle at the root.
 */
const PERFT: { id: number; fen: string; counts: [number, number, number, number]; why: string }[] = [
  { id: 0, fen: "bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf -", counts: [21, 528, 12189, 326672], why: "king on g1 between its rooks" },
  { id: 2, fen: "b1q1rrkb/pppppppp/3nn3/8/P7/1PPP4/4PPPP/BQNNRKRB w GE -", counts: [20, 479, 10471, 273318], why: "short castling swaps king f1 and rook g1" },
  { id: 5, fen: "qnbnr1kr/ppp1b1pp/4p3/3p1p2/8/2NPP3/PPP1BPPP/QNB1R1KR w HEhe -", counts: [29, 899, 26578, 824055], why: "king already on g1 (only the rook moves)" },
  { id: 10, fen: "qnr1bkrb/pppp2pp/3np3/5p2/8/P2P2P1/NPP1PP1P/QN1RBKRB w GDg -", counts: [33, 823, 26895, 713420], why: "swap, and the long rook already on d1" },
  { id: 13, fen: "1qnrkbbr/1pppppp1/p1n4p/8/P7/1P1N1P2/2PPP1PP/QN1RKBBR w HDhd -", counts: [37, 883, 32187, 815535], why: "long rook already on d1, castling at the root" },
  { id: 30, fen: "nqnrkrb1/pppppp2/7p/4b1p1/8/PN1NP3/1PPP1PPP/1Q1RKRBB w FDfd -", counts: [26, 683, 18102, 473911], why: "both rooks already on f1 and d1" },
  { id: 74, fen: "n1rkbqrb/pp1ppp2/2n3p1/2p4p/P5PP/1P6/2PPPP2/NNRKBQRB w GCgc -", counts: [24, 804, 20712, 684001], why: "long castling swaps king d1 and rook c1" },
  { id: 78, fen: "nnr1qrbb/p2kpppp/1p1p4/2p5/6P1/PP1P4/2P1PP1P/NNRKQRBB w FC -", counts: [27, 604, 17043, 409665], why: "long swap and the short rook already on f1; Black has lost both rights" },
  { id: 103, fen: "qbnrb1kr/ppp1pp1p/3p4/2n3p1/1P6/6N1/P1PPPPPP/QBNRB1KR w HDhd -", counts: [29, 751, 23132, 610397], why: "king on g1 and the long rook on d1" },
  { id: 248, fen: "nrkb1qnr/ppppp1p1/6bp/5p2/1PP1P1P1/8/P2P1P1P/NRKBBQNR w HBhb -", counts: [32, 761, 24586, 632916], why: "king already on c1: the rook passes over it" },
  { id: 250, fen: "nrkqbr1b/1pppp1pp/5pn1/p6N/1P3P2/8/P1PPP1PP/NRKQB1RB w GBb -", counts: [26, 494, 13815, 296170], why: "king on c1, uneven rights" },
  { id: 271, fen: "bbnrk1rq/pp2p1pp/2ppn3/5p2/8/3NNP1P/PPPPP1P1/BB1RK1RQ w GDgd -", counts: [28, 697, 20141, 517917], why: "both castlings at the root; the short rook stands on g1, the king's square" },
];

describe("Chess960 perft (move generation against published counts)", () => {
  for (const p of PERFT) {
    it(`id ${p.id}: ${p.why}`, () => {
      expect([1, 2, 3, 4].map((d) => perft960(p.fen, d))).toEqual(p.counts);
    });
  }

  it("the same counts through the FEN functions, every position written out and read back", () => {
    for (const p of PERFT.slice(0, 4)) expect(perftByFen(p.fen, 3)).toBe(p.counts[2]);
  });

  it("normal chess positions as Chess960 (X-FEN rights): the start, and Kiwipete's castling, en passant and promotions", () => {
    expect(perft960(START_FEN, 4)).toBe(197281);
    expect(perft960("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 3)).toBe(97862);
    // (Chessprogramming.org's position 3: en passant, discovered checks, pins.)
    expect(perft960("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 4)).toBe(43238);
  });
});

describe("Chess960 castling", () => {
  // White: king b1, rooks a1 and h1, nothing else on the back rank. Black: king g8, rooks a8 and h8.
  const open = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK5R w HAha - 0 1";

  it("is written as the king taking its own rook, and lands the king on g1 or c1, the rook beside it", () => {
    const moves = legalMoves960(open);
    expect(moves).toContain("b1h1");
    expect(moves).toContain("b1a1");
    expect(applyMove960(open, "b1h1").split(" ")[0]).toBe("r5kr/pppppppp/8/8/8/8/PPPPPPPP/R4RK1");
    expect(applyMove960(open, "b1a1").split(" ")[0]).toBe("r5kr/pppppppp/8/8/8/8/PPPPPPPP/2KR3R");
    // Black, mirrored (the king on g8 already for the short one: only its rook moves).
    const black = applyMove960(open, "a2a3");
    expect(applyMove960(black, "g8h8").split(" ")[0]).toBe("r4rk1/pppppppp/8/8/8/P7/1PPPPPPP/RK5R");
    expect(applyMove960(black, "g8a8").split(" ")[0]).toBe("2kr3r/pppppppp/8/8/8/P7/1PPPPPPP/RK5R");
  });

  it("needs every square the king or the rook crosses or lands on empty, but for the two of them", () => {
    // A knight on e1, crossed by the king (b1 to g1): no short castling; the long one is untouched.
    const kingBlocked = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK2N2R w HAha - 0 1";
    expect(legalMoves960(kingBlocked)).not.toContain("b1h1");
    expect(legalMoves960(kingBlocked)).toContain("b1a1");
    // King on f1, rook on a1: a knight on b1, crossed only by the rook, stops the long castling.
    const rookBlocked = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RN3K1R w HAha - 0 1";
    expect(legalMoves960(rookBlocked)).not.toContain("f1a1");
    expect(legalMoves960(rookBlocked)).toContain("f1h1");
    // A bishop on the rook's square, d1 (king e1 to c1, rook a1 to d1).
    expect(legalMoves960("r5kr/pppppppp/8/8/8/8/PPPPPPPP/R2BK2R w HAha - 0 1")).not.toContain("e1a1");
    // The king itself in the rook's way doesn't block: king c1, rook b1 jumps over it to d1.
    expect(applyMove960("1r1k3r/8/8/8/8/8/8/1RK4R w HB - 0 1", "c1b1").split(" ")[0]).toBe("1r1k3r/8/8/8/8/8/8/2KR3R");
  });

  it("never out of check, through check or into check; an attacked square only the rook crosses is fine", () => {
    // In check from the rook on b8 (king b1): neither castling.
    const check = "1r4k1/8/8/8/8/8/8/RK5R w HA - 0 1";
    expect(legalMoves960(check).filter((m) => m === "b1h1" || m === "b1a1")).toEqual([]);
    // Through check: e1 attacked (by the rook on e8) on the king's way from b1 to g1.
    expect(legalMoves960("4r1k1/8/8/8/8/8/8/RK5R w HA - 0 1")).not.toContain("b1h1");
    // Into check: g1 attacked.
    expect(legalMoves960("6rk/8/8/8/8/8/8/RK5R w HA - 0 1")).not.toContain("b1h1");
    // King e1, rook a1: b1 attacked, only the rook crosses it, so the long castling stands (as in normal chess).
    expect(legalMoves960("1r4k1/8/8/8/8/8/8/R3K3 w A - 0 1")).toContain("e1a1");
  });

  it("can't use the rook as a shield it takes away: king c1, rook b1, a queen on a1 behind it", () => {
    // The king isn't in check now (the rook blocks), but castling moves the rook off b1 and leaves the king to the queen.
    const fen = "6k1/8/8/8/8/8/8/qRK5 w B - 0 1";
    expect(inCheck(fen)).toBe(false);
    expect(legalMoves960(fen)).not.toContain("c1b1");
    // Nothing behind the rook: the same castling is legal.
    expect(legalMoves960("6k1/8/8/8/8/8/8/1RK5 w B - 0 1")).toContain("c1b1");
  });

  it("handles the king already on its square, the rook already on its square, and the two swapping", () => {
    // King on g1 with the rook on h1: the king stays, the rook goes to f1.
    expect(applyMove960("6k1/8/8/8/8/8/8/6KR w H - 0 1", "g1h1").split(" ")[0]).toBe("6k1/8/8/8/8/8/8/5RK1");
    // Rook already on f1, king on e1: the king goes to g1, the rook stays.
    expect(applyMove960("6k1/8/8/8/8/8/8/4KR2 w F - 0 1", "e1f1").split(" ")[0]).toBe("6k1/8/8/8/8/8/8/5RK1");
    // King f1 and rook g1 swap; king d1 and rook c1 swap.
    expect(applyMove960("6k1/8/8/8/8/8/8/5KR1 w G - 0 1", "f1g1").split(" ")[0]).toBe("6k1/8/8/8/8/8/8/5RK1");
    expect(applyMove960("6k1/8/8/8/8/8/8/2RK4 w C - 0 1", "d1c1").split(" ")[0]).toBe("6k1/8/8/8/8/8/8/2KR4");
    // King on c1 already: only the rook moves, a1 to d1; the rights go, and the clock counts it as a quiet move.
    const still = applyMove960("6k1/8/8/8/8/8/8/R1K5 w A - 0 1", "c1a1");
    expect(still).toBe("6k1/8/8/8/8/8/8/2KR4 b - - 1 1");
  });

  it("loses the right when the king moves, when that rook moves or when that rook is taken", () => {
    const rights = (fen: string, moves: string[]) => replay960(fen, moves).split(" ")[2];
    // The king steps out and back: both rights gone.
    expect(rights(open, ["b1c1", "a7a6", "c1b1"])).toBe("ha");
    expect(legalMoves960(replay960(open, ["b1c1", "a7a6", "c1b1"])).filter((m) => m === "b1h1" || m === "b1a1")).toEqual([]);
    // The h-rook moves: only that right.
    expect(rights(open, ["h1g1"])).toBe("Aha");
    // A rook coming back to the square doesn't bring the right back.
    expect(rights(open, ["h1g1", "a7a6", "g1h1"])).toBe("Aha");
    // Castling uses up both.
    expect(rights(open, ["b1h1"])).toBe("ha");
    // A rook taken on its square takes its right: White's bishop takes the rook on h8.
    expect(rights("r5kr/pppppp1p/8/8/8/8/PBPPPPPP/RK5R w HAha - 0 1", ["b2h8"])).toBe("HAa");
  });

  it("counts a castling as a legal move: a position where it's the only one is no stalemate", () => {
    // King g1 hemmed in (f1 and f2 by the rook on f8, g2 by the pawn on h3); castling puts the rook on f1.
    const fen = "k4r2/8/8/8/8/7p/7P/6KR w H - 0 1";
    expect(legalMoves960(fen)).toEqual(["g1h1"]);
    expect(gameEnd960(fen, [])).toBeNull();
    expect(positionOver(fen)).toBe(false);
    // (chess.js, which can't castle here, would call it stalemate.)
    expect(new Chess(fen.replace(" H ", " - ")).isStalemate()).toBe(true);
    expect(gameEnd960("k4r2/8/8/8/8/7p/7P/6KR w - - 0 1", [])).toBe("stalemate");
  });
});

describe("Chess960 moves in and out: UCI and SAN", () => {
  it("writes castling as O-O and O-O-O, with + or # when it gives check", () => {
    const open = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK5R w HAha - 0 1";
    expect(toSan960(open, "b1h1")).toBe("O-O");
    expect(toSan960(open, "b1a1")).toBe("O-O-O");
    // The rook lands on d1, checking the king on d8.
    expect(toSan960("3k4/8/8/8/8/8/8/R3K3 w A - 0 1", "e1a1")).toBe("O-O-O+");
    expect(sanToUci960(open, "O-O")).toBe("b1h1");
    expect(sanToUci960(open, "0-0-0")).toBe("b1a1");
    expect(sanToUci960("3k4/8/8/8/8/8/8/R3K3 w A - 0 1", "O-O-O+")).toBe("e1a1");
  });

  it("every move's SAN reads back as the same move", () => {
    for (const p of PERFT) {
      const fen = p.fen;
      for (const m of legalMoves960(fen)) expect(sanToUci960(fen, toSan960(fen, m))).toBe(m);
    }
    expect(() => sanToUci960(PERFT[0]!.fen, "O-O-O")).toThrow();
  });
});

describe("Chess960 rules match chess.js wherever castling isn't involved (random games from the normal setup)", () => {
  // Our castling as chess.js writes it, for the normal setup: the king two squares over instead of onto its rook.
  const asChessJs = (fen: string, m: string) => {
    const mover = pieceAt(fen, m.slice(0, 2));
    const target = pieceAt(fen, m.slice(2, 4));
    if (mover?.type !== "k" || target?.color !== mover.color) return m;
    return m.slice(0, 2) + (m[2]! > m[0]! ? "g" : "c") + m[3];
  };
  const kqkq = (fen: string) => fen.split(" ").map((f, i) => (i === 2 ? f.replace("H", "K").replace("A", "Q").replace("h", "k").replace("a", "q") : f)).join(" ");

  it("the same legal moves, positions, SAN and endings, ply by ply", () => {
    const rng = mulberry32(960);
    let plies = 0;
    for (let game = 0; game < 12; game++) {
      const chess = new Chess();
      let fen = chess960Fen(518);
      const ours: string[] = [];
      const theirs: string[] = [];
      for (let ply = 0; ply < 200; ply++) {
        const moves = legalMoves960(fen);
        expect(moves.map((m) => asChessJs(fen, m)).sort()).toEqual(legalMoves(chess.fen()).sort());
        expect(kqkq(fen)).toBe(chess.fen());
        const end = gameEnd960(chess960Fen(518), ours);
        expect(end).toBe(gameEnd(START_FEN, theirs));
        if (end) break;
        const m = moves[Math.floor(rng() * moves.length)]!;
        const js = asChessJs(fen, m);
        expect(toSan960(fen, m)).toBe(toSan(chess.fen(), js));
        chess.move({ from: js.slice(0, 2), to: js.slice(2, 4), promotion: js[4] });
        fen = applyMove960(fen, m);
        ours.push(m);
        theirs.push(js);
        plies++;
      }
    }
    expect(plies).toBeGreaterThan(800);
  });
});

describe("rules.ts sends Chess960 positions to these rules, normal ones to chess.js as before", () => {
  const start = chess960Fen(0);
  it("legal moves, moves made, SAN, the board's pieces and check", () => {
    expect(legalMoves(start)).toEqual(legalMoves960(start));
    expect(applyMove(start, "d2d4")).toBe(applyMove960(start, "d2d4"));
    expect(toSan(start, "e1d3")).toBe("Nd3");
    expect(pieceAt(start, "g1")).toEqual({ color: "w", type: "k" });
    expect(pieceAt(start, "a8")).toEqual({ color: "b", type: "b" });
    expect(inCheck(start)).toBe(false);
  });

  it("the position after a line and the game's end, castling included", () => {
    // The f1 rook steps out of the way, then the king (already on g1) castles short: only the h1 rook moves, to f1.
    const line = ["f2f4", "f7f5", "f1f3", "f8f6", "g1h1"];
    expect(fenAfter(line, start)).toBe(replay960(start, line));
    expect(fenAfter(line, start)).toBe("bbqnn1kr/ppppp1pp/5r2/5p2/5P2/5R2/PPPPP1PP/BBQNNRK1 b h - 3 3");
    expect(gameEnd(start, line)).toBeNull();
    // A repetition: knights out and back twice.
    const shuffle = ["d1c3", "d8c6", "c3d1", "c6d8", "d1c3", "d8c6", "c3d1", "c6d8"];
    expect(gameEnd(start, shuffle)).toBe("repetition");
    expect(gameEnd(start, shuffle.slice(0, 7))).toBeNull();
  });

  it("the castling rights count in a repetition: the same squares with a right lost aren't the same position", () => {
    // The h-rook steps away and back three times: the pieces stand as at the start each time, but without that rook's
    // right, so the start (with it) counts once and the rest separately: threefold only on the third return.
    const fen = "4k3/8/8/8/8/8/8/R3K2R w HA - 0 1";
    const line = [0, 1, 2].flatMap(() => ["h1g1", "e8d8", "g1h1", "d8e8"]);
    expect(gameEnd960(fen, line.slice(0, 8))).toBeNull();
    expect(gameEnd960(fen, line)).toBe("repetition");
  });

  it("king-onto-the-square shortcuts for a board: only where nothing else can be meant", () => {
    const shortcuts = (fen: string) => [...castleShortcuts960(fen, legalMoves960(fen))];
    // King b1: g1 means castling short; c1 is also an ordinary king step, so it stays one.
    expect(shortcuts("r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK5R w HAha - 0 1")).toEqual([["b1g1", "b1h1"]]);
    // The normal setup, cleared: e1g1 and e1c1, as in normal chess.
    expect(shortcuts("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w HAha - 0 1")).toEqual([["e1g1", "e1h1"], ["e1c1", "e1a1"]]);
    // King f1, rook h1: g1 is an ordinary king step. King already on g1, or its rook on it: nothing to add.
    expect(shortcuts("6k1/8/8/8/8/8/8/5K1R w H - 0 1")).toEqual([]);
    expect(shortcuts("6k1/8/8/8/8/8/8/6KR w H - 0 1")).toEqual([]);
    expect(shortcuts("6k1/8/8/8/8/8/8/4K1R1 w G - 0 1")).toEqual([]);
  });
});
