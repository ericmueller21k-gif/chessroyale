/** A Stockfish (Node, its WebAssembly build in a child process) that plays moves: at a limited strength (UCI_Elo) or full. */
import { nodeTransport, STOCKFISH_FULL_BUILD } from "@chessroyale/chess/node";

export interface SfMove {
  move: string;
  /** Centipawns for the side to move (a mate: ±100000 less its distance), from its last full line. */
  score: number;
  depth: number;
}

export interface SfPlayer {
  newGame(): Promise<void>;
  /** The move for the position after `moves` from `startFen`, searched for `ms` milliseconds (or `nodes` nodes). */
  move(startFen: string, moves: readonly string[], limit: { ms?: number; nodes?: number; depth?: number }): Promise<SfMove>;
  /** The best move and its score for a position (`only`: search just these moves). */
  search(fen: string, limit: { ms?: number; nodes?: number; depth?: number }, only?: readonly string[]): Promise<SfMove>;
  /** The top lines (MultiPV) for a position: [move, score] best first. */
  lines(fen: string, n: number, limit: { ms?: number; nodes?: number; depth?: number }): Promise<{ move: string; score: number }[]>;
  close(): void;
}

export async function sfPlayer(opts: { elo?: number; hashMb?: number; build?: string } = {}): Promise<SfPlayer> {
  const t = nodeTransport(opts.build ?? STOCKFISH_FULL_BUILD);
  let waiting: { test: (l: string) => boolean; resolve: (l: string) => void } | null = null;
  const seen: string[] = [];
  t.onLine((l) => {
    seen.push(l);
    if (waiting?.test(l)) {
      const w = waiting;
      waiting = null;
      w.resolve(l);
    }
  });
  const until = (test: (l: string) => boolean) => new Promise<string>((resolve) => (waiting = { test, resolve }));
  const ready = async () => {
    const r = until((l) => l === "readyok");
    t.send("isready");
    await r;
  };
  let r = until((l) => l === "uciok");
  t.send("uci");
  await r;
  t.send("setoption name Threads value 1");
  t.send(`setoption name Hash value ${opts.hashMb ?? 16}`);
  if (opts.elo) {
    t.send("setoption name UCI_LimitStrength value true");
    t.send(`setoption name UCI_Elo value ${opts.elo}`);
  }
  await ready();
  const go = (limit: { ms?: number; nodes?: number; depth?: number }) =>
    limit.depth ? `go depth ${limit.depth}` : limit.nodes ? `go nodes ${limit.nodes}` : `go movetime ${limit.ms ?? 350}`;
  const parse = (line: string) => {
    const m = / score (cp|mate) (-?\d+)/.exec(line);
    if (!m) return null;
    const v = Number(m[2]);
    return m[1] === "cp" ? v : v > 0 ? 100000 - v : -100000 - v;
  };
  const searchFrom = async (position: string, goLine: string): Promise<SfMove> => {
    seen.length = 0;
    t.send(position);
    const done = until((l) => l.startsWith("bestmove"));
    t.send(goLine);
    const best = (await done).split(" ")[1]!;
    let score = 0;
    let depth = 0;
    for (const l of seen) {
      if (!l.startsWith("info") || l.includes(" bound") || !l.includes(" pv ")) continue;
      const s = parse(l);
      if (s !== null) score = s;
      depth = Number(/ depth (\d+)/.exec(l)?.[1] ?? depth);
    }
    return { move: best, score, depth };
  };
  return {
    async newGame() {
      t.send("ucinewgame");
      await ready();
    },
    async move(startFen, moves, limit) {
      return searchFrom(`position fen ${startFen}${moves.length ? " moves " + moves.join(" ") : ""}`, go(limit));
    },
    search(fen, limit, only) {
      return searchFrom(`position fen ${fen}`, go(limit) + (only?.length ? ` searchmoves ${only.join(" ")}` : ""));
    },
    async lines(fen, n, limit) {
      seen.length = 0;
      t.send(`setoption name MultiPV value ${n}`);
      t.send(`position fen ${fen}`);
      const done = until((l) => l.startsWith("bestmove"));
      t.send(go(limit));
      await done;
      t.send("setoption name MultiPV value 1");
      // The last full line of each slot.
      const bySlot = new Map<number, { move: string; score: number }>();
      for (const l of seen) {
        if (!l.startsWith("info") || l.includes(" bound") || !l.includes(" pv ")) continue;
        const slot = Number(/ multipv (\d+)/.exec(l)?.[1] ?? 1);
        const s = parse(l);
        const mv = / pv (\S+)/.exec(l)?.[1];
        if (s !== null && mv) bySlot.set(slot, { move: mv, score: s });
      }
      return [...bySlot.values()].sort((a, b) => b.score - a.score);
    },
    close: () => t.close(),
  };
}
