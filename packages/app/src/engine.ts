import { UciEngine, type EngineLike, type MoveScore, type UciTransport } from "@chessroyale/chess";
import { DEFAULT_SETTINGS } from "@chessroyale/core";

const ENGINE_JS = "/engine/stockfish-19-lite-single.js";
const ENGINE_WASM = "/engine/stockfish-19-lite-single.wasm";

/** Stockfish in a Web Worker, spoken to over UCI text (the same protocol as the simulation). */
function workerTransport(): UciTransport {
  const worker = new Worker(`${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)}`);
  const listeners: ((line: string) => void)[] = [];
  worker.onmessage = (e: MessageEvent) => {
    if (typeof e.data !== "string") return;
    for (const line of e.data.split("\n")) for (const l of listeners) l(line.trim());
  };
  return {
    send: (c) => worker.postMessage(c),
    onLine: (l) => listeners.push(l),
    close: () => worker.terminate(),
  };
}

let pool: Promise<UciEngine[]> | null = null;

/** Several engines in separate workers so boards are scored in parallel. */
export function enginePool(): Promise<UciEngine[]> {
  pool ??= (async () => {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const engines = Array.from(
      { length: n },
      () => new UciEngine(workerTransport(), { nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb }),
    );
    await Promise.all(engines.map((e) => e.init()));
    return engines;
  })();
  return pool;
}

/**
 * This device's engine, with its re-checks (the close calls before a cut) done by the engine server's much
 * deeper search when it answers in time, else by this device as before.
 */
export function withServerRecheck(engine: UciEngine, boards: () => number = () => 1): EngineLike {
  return {
    topMoves: (fen, n) => engine.topMoves(fen, n),
    scoreMoves: (fen, moves) => engine.scoreMoves(fen, moves),
    playAtElo: (fen, elo, nodes) => engine.playAtElo(fen, elo, nodes),
    scoreMovesAt: async (fen, moves, nodes) => (await serverScoreAt(fen, moves, boards())) ?? engine.scoreMovesAt(fen, moves, nodes),
  };
}

let serverDown = false;

async function serverScoreAt(fen: string, moves: readonly string[], boards: number): Promise<MoveScore[] | null> {
  if (serverDown) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch("/api/engine/score", { method: "POST", body: JSON.stringify({ fen, moves, boards }), signal: ctl.signal });
    clearTimeout(t);
    if (res.status === 404) serverDown = true; // no engine server here (e.g. the dev server): stop asking
    if (!res.ok) return null;
    const body = (await res.json()) as { moves?: MoveScore[] };
    return Array.isArray(body.moves) && body.moves.length ? body.moves : null;
  } catch {
    return null;
  }
}

/** Wakes the engine server as a game starts (so the first re-check doesn't wait for it to boot). */
export function warmEngineServer() {
  void fetch("/api/engine/ping").catch(() => undefined);
}
