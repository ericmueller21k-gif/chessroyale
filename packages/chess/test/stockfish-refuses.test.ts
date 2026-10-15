import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { START_FEN, UciEngine, applyMove960, chess960Fen, legalMoves960, stockfishRefuses, type UciTransport } from "../src/index.ts";
import { nodeTransport } from "../src/node.ts";
import { CASES } from "./stockfish-refuses-cases.ts";

/**
 * Positions Stockfish refuses (Oct 15): Stockfish 19 checks a position as it's set up, and a refused one ends its process
 * with an error (in a browser, its worker's "ExitStatus" thrown into the page) and leaves its last position in place.
 * `stockfishRefuses` says which it refuses, so they're never sent; checked here against the real engine. The cases are
 * shared with the engine server's check (`stockfish-refuses-cases.ts`).
 */
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
  it("names a reason for every position the real engine refuses, and only for the cases it should", async () => {
    const wrong: string[] = [];
    for (const [name, c] of Object.entries(CASES)) {
      expect(!!stockfishRefuses(c.fen), name).toBe(c.refused);
      // (Everything Stockfish 19 refuses is refused; beyond that, only what the engine server's Stockfish misreads.)
      if (c.sf19) expect(c.refused, name).toBe(true);
      if ((await refusedByStockfish(c.fen)) !== (c.sf19 ?? c.refused)) wrong.push(name);
    }
    expect(wrong, "cases where the real engine disagrees").toEqual([]);
  }, 180_000);

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

  it("refuses no position of a real Chess960 game (its castling rights by file included)", () => {
    let n = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let s = seed;
      const next = () => (s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0);
      let fen = chess960Fen(next() % 960);
      for (let ply = 0; ply < 120; ply++) {
        expect(stockfishRefuses(fen), fen).toBeNull();
        const moves = legalMoves960(fen);
        if (!moves.length) break;
        fen = applyMove960(fen, moves[next() % moves.length]!);
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
