import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mulberry32 } from "@chessroyale/core";
import { chess960Fen, legalMoves, legalMoves960, perft960, randomChess960, START_FEN, toSan, UciEngine, type UciTransport } from "../src/index.ts";
import { createNodeEngine, nodeTransport } from "../src/node.ts";

/** A pretend engine that answers at once and keeps every command it was sent. */
function fakeTransport(): UciTransport & { sent: string[] } {
  const listeners: ((line: string) => void)[] = [];
  const say = (l: string) => queueMicrotask(() => listeners.forEach((f) => f(l)));
  const sent: string[] = [];
  return {
    sent,
    send(c) {
      sent.push(c);
      if (c === "uci") say("uciok");
      if (c === "isready") say("readyok");
      if (c.startsWith("go")) say("bestmove a2a3");
    },
    onLine: (l) => listeners.push(l),
    close: () => undefined,
  };
}

describe("UCI_Chess960 for Chess960 positions only", () => {
  const c960 = chess960Fen(0);

  it("a normal search sends exactly what it always did", async () => {
    const t = fakeTransport();
    const engine = new UciEngine(t, { nodes: 1000, hashMb: 16 });
    await engine.topMoves(START_FEN, 2);
    expect(t.sent).toEqual(["ucinewgame", "setoption name MultiPV value 2", "isready", `position fen ${START_FEN}`, "go nodes 1000"]);
  });

  it("switches it on just before a Chess960 position, and off again before the next normal one", async () => {
    const t = fakeTransport();
    const engine = new UciEngine(t, { nodes: 1000, hashMb: 16 });
    await engine.topMoves(c960, 1);
    await engine.topMoves(c960, 1);
    await engine.playAtElo(c960, 3000);
    await engine.topMoves(START_FEN, 1);
    await engine.topMoves(START_FEN, 1);
    const toggles = t.sent.flatMap((c, i) => (c.includes("UCI_Chess960") ? [[c, t.sent[i + 1]]] : []));
    expect(toggles).toEqual([
      ["setoption name UCI_Chess960 value true", `position fen ${c960}`],
      ["setoption name UCI_Chess960 value false", `position fen ${START_FEN}`],
    ]);
  });
});

describe("Stockfish and our Chess960 rules agree", () => {
  /** Raw UCI lines from a fresh Stockfish, for the commands the game itself never sends (d, go perft). */
  async function raw(commands: string[], until: (l: string) => boolean): Promise<string[]> {
    const t = nodeTransport();
    const lines: string[] = [];
    const done = new Promise<void>((resolve) =>
      t.onLine((l) => {
        lines.push(l);
        if (until(l)) resolve();
      }),
    );
    for (const c of commands) t.send(c);
    await done;
    t.close();
    return lines;
  }

  it("on the FEN (Shredder-FEN both ways) and the perft of start positions", async () => {
    const rng = mulberry32(42);
    const indices = [0, 518, 959, ...Array.from({ length: 5 }, () => randomChess960(rng).index)];
    const cmds = ["uci", "setoption name UCI_Chess960 value true"];
    for (const i of indices) cmds.push(`position fen ${chess960Fen(i)}`, "d", "go perft 3");
    cmds.push("isready");
    const lines = await raw(cmds, (l) => l === "readyok");
    const fens = lines.filter((l) => l.startsWith("Fen: ")).map((l) => l.slice(5));
    const nodes = lines.filter((l) => l.startsWith("Nodes searched: ")).map((l) => Number(l.slice(16)));
    expect(fens).toEqual(indices.map((i) => chess960Fen(i)));
    expect(nodes).toEqual(indices.map((i) => perft960(chess960Fen(i), 3)));
  }, 60_000);

  it("on every move of mid-game positions, castling written as the king taking its rook", async () => {
    const fens = [
      "bbnrk1rq/pp2p1pp/2ppn3/5p2/8/3NNP1P/PPPPP1P1/BB1RK1RQ w GDgd - 0 1",
      "n1rkbqrb/pp1ppp2/2n3p1/2p4p/P5PP/1P6/2PPPP2/NNRKBQRB w GCgc - 0 1",
      "qnbnr1kr/ppp1b1pp/4p3/3p1p2/8/2NPP3/PPP1BPPP/QNB1R1KR w HEhe - 0 1",
    ];
    const cmds = ["uci", "setoption name UCI_Chess960 value true"];
    for (const f of fens) cmds.push(`position fen ${f}`, "go perft 1");
    cmds.push("isready");
    const lines = await raw(cmds, (l) => l === "readyok");
    // (perft 1 lists each move as "e1g1: 1", one block per position, each ending in "Nodes searched".)
    const blocks: string[][] = [[]];
    for (const l of lines) {
      const m = l.match(/^([a-h][1-8][a-h][1-8][qrbn]?): 1$/);
      if (m) blocks[blocks.length - 1]!.push(m[1]!);
      if (l.startsWith("Nodes searched")) blocks.push([]);
    }
    fens.forEach((f, i) => expect(blocks[i]!.sort(), f).toEqual(legalMoves960(f).sort()));
    expect(blocks[0]).toContain("e1g1");
    expect(blocks[0]).toContain("e1d1");
  }, 60_000);
});

describe("the engine wrapper on Chess960 (WebAssembly Stockfish, fixed budget)", () => {
  let engine: UciEngine;
  beforeAll(async () => {
    engine = await createNodeEngine({ nodes: 20_000, hashMb: 16 });
  }, 30_000);
  afterAll(() => engine.close());

  it("scores a start position's moves, all of them legal there", async () => {
    const fen = chess960Fen(0);
    const top = await engine.topMoves(fen, 4);
    expect(top).toHaveLength(4);
    for (const m of top) {
      expect(legalMoves960(fen)).toContain(m.move);
      expect(m.expected).toBeGreaterThan(0.2);
      expect(m.expected).toBeLessThan(0.8);
    }
  }, 30_000);

  it("finds a castling move and writes it as the king taking its rook (O-O in SAN)", async () => {
    // Castling is White's only legal move here.
    const fen = "k4r2/8/8/8/8/7p/7P/6KR w H - 0 1";
    const [best] = await engine.topMoves(fen, 1);
    expect(best!.move).toBe("g1h1");
    expect(toSan(fen, best!.move)).toBe("O-O");
    expect(await engine.playAtElo(fen, 3000)).toBe("g1h1");
  }, 30_000);

  it("scores castling moves asked for by name, and plays at a set strength", async () => {
    const fen = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK5R w HAha - 0 1";
    const scored = await engine.scoreMoves(fen, ["b1h1", "b1a1"]);
    expect(scored.map((m) => m.move).sort()).toEqual(["b1a1", "b1h1"]);
    for (const m of scored) expect(m.expected).toBeGreaterThan(0);
    const played = await engine.playAtElo(chess960Fen(777), 3000);
    expect(legalMoves960(chess960Fen(777))).toContain(played);
  }, 30_000);

  it("goes back to normal chess after: normal castling written as e1g1 again", async () => {
    await engine.topMoves(chess960Fen(518), 1);
    // A normal Italian position where castling short is among the best moves.
    const fen = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const top = await engine.topMoves(fen, 8);
    for (const m of top) expect(legalMoves(fen)).toContain(m.move);
    expect(top.map((m) => m.move)).toContain("e1g1");
  }, 30_000);
});
