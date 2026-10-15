import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { START_FEN, UciEngine, stockfishRefuses, type UciTransport } from "../src/index.ts";
import { nodeTransport } from "../src/node.ts";

/**
 * Positions Stockfish refuses (Oct 15): Stockfish 19 checks a position as it's set up, and a refused one ends its process
 * with an error (in a browser, its worker's "ExitStatus" thrown into the page) and leaves its last position in place.
 * `stockfishRefuses` says which it refuses, so they're never sent; checked here against the real engine.
 */
const CASES: Record<string, { fen: string; refused: boolean }> = {
  start: { fen: START_FEN, refused: false },
  ninePawns: { fen: "4k3/8/8/8/8/P7/PPPPPPPP/4K3 w - - 0 1", refused: true },
  nineBlackPawns: { fen: "4k3/pppppppp/p7/8/8/8/8/4K3 b - - 0 1", refused: true },
  thirtyThreePieces: { fen: "rnbqkbnr/pppppppp/8/8/8/P7/PPPPPPPP/RNBQKBNR w KQkq - 0 1", refused: true },
  pawnOnEighth: { fen: "P3k3/8/8/8/8/8/8/4K3 w - - 0 1", refused: true },
  pawnOnFirst: { fen: "4k3/8/8/8/8/8/8/p3K3 b - - 0 1", refused: true },
  noBlackKing: { fen: "8/8/8/8/8/8/8/4K3 w - - 0 1", refused: true },
  twoWhiteKings: { fen: "4k3/8/8/8/8/8/8/3KK3 w - - 0 1", refused: true },
  sideNotToMoveInCheck: { fen: "4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1", refused: true },
  sideToMoveInDoubleCheck: { fen: "4k3/8/8/8/8/8/8/1r2K2r w - - 0 1", refused: false },
  tooManyQueens: { fen: "4k3/8/8/8/8/8/QQQQQQQQ/QQ2K3 w - - 0 1", refused: true },
  nineKnightsNoPawns: { fen: "4k3/8/8/8/8/8/NNNNNNNN/N3K3 w - - 0 1", refused: false },
  extraKnightEightPawns: { fen: "4k3/8/8/8/8/N7/PPPPPPPP/RNBQKBNR w - - 0 1", refused: true },
  extraKnightSevenPawns: { fen: "4k3/8/8/8/8/N7/PPPPPPP1/RNBQKBNR w - - 0 1", refused: false },
  threeRooksEightPawns: { fen: "4k3/8/8/8/8/8/PPPPPPPP/RR2K2R w - - 0 1", refused: true },
  twoQueensSevenPawns: { fen: "4k3/8/8/8/8/8/PPPPPPP1/QQ2K3 w - - 0 1", refused: false },
  twoSameColorBishops: { fen: "4k3/8/8/8/8/8/PPPPPPPP/1B1BK3 w - - 0 1", refused: false },
  epWrongRankWhite: { fen: "4k3/8/8/8/8/8/8/4K3 w - e3 0 1", refused: true },
  epWrongRankBlack: { fen: "4k3/8/8/8/8/8/8/4K3 b - e6 0 1", refused: true },
  epNoCapturer: { fen: "4k3/8/8/4p3/8/8/8/4K3 w - e6 0 1", refused: false },
  epNoPawnInFront: { fen: "4k3/8/8/8/8/8/8/4K3 w - e6 0 1", refused: false },
  epLegal: { fen: "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1", refused: false },
  castlingWithoutRook: { fen: "4k3/8/8/8/8/8/8/4K3 w K - 0 1", refused: false },
  fiveCastlingRights: { fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkqK - 0 1", refused: true },
  unreadableCastling: { fen: "r3k2r/8/8/8/8/8/8/R3K2R w Kx - 0 1", refused: true },
  bigCounters: { fen: "4k3/8/8/8/8/8/8/4K3 w - - 1000 900", refused: false },
  chess960: { fen: "bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9", refused: false },
};

/** What the real engine says to `fen`: refused ("CRITICAL ERROR"), or not. A refused one ends its process. */
async function refusedByStockfish(fen: string): Promise<boolean> {
  const t = nodeTransport();
  const lines: string[] = [];
  t.onLine((l) => lines.push(l));
  const until = (re: RegExp, ms: number) =>
    new Promise<boolean>((resolve) => {
      const t0 = Date.now();
      const tick = () => (lines.some((l) => re.test(l)) ? resolve(true) : Date.now() - t0 > ms ? resolve(false) : setTimeout(tick, 10));
      tick();
    });
  t.send("uci");
  t.send("isready");
  await until(/^readyok/, 20_000);
  lines.length = 0;
  t.send(`position fen ${fen}`);
  t.send("isready");
  await until(/^readyok|CRITICAL ERROR/, 5000);
  t.close();
  return lines.some((l) => l.includes("CRITICAL ERROR"));
}

describe("stockfishRefuses: the positions Stockfish refuses", () => {
  it("names a reason for exactly the positions the real engine refuses", async () => {
    const wrong: string[] = [];
    for (const [name, c] of Object.entries(CASES)) {
      const ours = !!stockfishRefuses(c.fen);
      expect(ours, name).toBe(c.refused);
      if ((await refusedByStockfish(c.fen)) !== c.refused) wrong.push(name);
    }
    expect(wrong, "cases where the real engine disagrees").toEqual([]);
  }, 120_000);

  it("refuses no position of a real game (random games, both sides to move, en passant squares included)", () => {
    let n = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const c = new Chess();
      let s = seed;
      while (!c.isGameOver() && c.history().length < 120) {
        const moves = c.moves();
        s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
        c.move(moves[s % moves.length]!);
        expect(stockfishRefuses(c.fen()), c.fen()).toBeNull();
        n++;
      }
    }
    expect(n).toBeGreaterThan(1000);
  });
});

describe("UciEngine never sends a refused position", () => {
  function fake() {
    const sent: string[] = [];
    const listeners: ((line: string) => void)[] = [];
    const say = (line: string) => queueMicrotask(() => listeners.forEach((l) => l(line)));
    const transport: UciTransport = {
      send: (c) => {
        sent.push(c);
        if (c === "uci") say("uciok");
        if (c === "isready") say("readyok");
        if (c.startsWith("go ")) {
          say("info depth 10 multipv 1 score cp 20 wdl 400 300 300 pv e2e4 e7e5");
          say("bestmove e2e4");
        }
      },
      onLine: (l) => listeners.push(l),
      close: () => undefined,
    };
    return { transport, sent };
  }

  it("a search of one has no lines (as a position with no moves), a move at a strength throws; nothing reaches the engine", async () => {
    const f = fake();
    const engine = new UciEngine(f.transport, { nodes: 1000, hashMb: 16 });
    await engine.init();
    const n = f.sent.length;
    const bad = CASES.ninePawns!.fen;
    expect(await engine.topMoves(bad, 3)).toEqual([]);
    expect(await engine.scoreMoves(bad, ["a3a4"])).toEqual([]);
    expect(await engine.topMovesAt(bad, 2, 500)).toEqual([]);
    await expect(engine.playAtElo(bad, 1500)).rejects.toThrow(/refuses it \(White has more than 8 pawns\)/);
    expect(f.sent.slice(n).filter((c) => c.startsWith("position") || c.startsWith("go"))).toEqual([]);
    // (A good position goes on as ever.)
    expect((await engine.topMoves(START_FEN, 1))[0]!.move).toBe("e2e4");
  });
});
