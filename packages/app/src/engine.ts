import { UciEngine, type EngineLike, type MoveScore, type UciTransport } from "@chessroyale/chess";
import { DEFAULT_SETTINGS, JUDGES } from "@chessroyale/core";

const ENGINE_JS = "/engine/stockfish-19-lite-single.js";
const ENGINE_WASM = "/engine/stockfish-19-lite-single.wasm";

/**
 * Stockfish in a Web Worker, spoken to over UCI text (the same protocol as the simulation). Restartable: `restart` ends
 * the worker (its WebAssembly memory with it) and the next command starts a fresh one (UciEngine.pause).
 */
function workerTransport(): UciTransport {
  const listeners: ((line: string) => void)[] = [];
  const start = () => {
    const w = new Worker(`${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)}`);
    w.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      for (const line of e.data.split("\n")) for (const l of listeners) l(line.trim());
    };
    return w;
  };
  let worker: Worker | null = start();
  const end = () => {
    worker?.terminate();
    worker = null;
  };
  return {
    send: (c) => (worker ??= start()).postMessage(c),
    onLine: (l) => listeners.push(l),
    close: end,
    restart: end,
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

let own: Promise<UciEngine> | null = null;

/**
 * An engine of its own, outside the pool (Squads' cheat lines, a test control): never queued behind the bot work the
 * pool does for a lobby. Made the first time it's asked for.
 */
export function ownEngine(): Promise<UciEngine> {
  own ??= (async () => {
    const engine = new UciEngine(workerTransport(), { nodes: DEFAULT_SETTINGS.engineNodes, hashMb: DEFAULT_SETTINGS.engineHashMb });
    await engine.init();
    return engine;
  })();
  return own;
}

/**
 * This device's Stockfish paused until `until` settles (a solo boss battle's loading step: Maia loads alone, Eric's
 * iPhone, Oct 14): every engine's worker ends once the work already asked for is done, and starts afresh after; work
 * asked for meanwhile waits for it. Resolves once they've all ended. `revive`: called if a fresh engine doesn't answer
 * within `reviveMs` (to free memory for it: Maia closed), before it's started once more.
 */
export async function pauseEngines(until: Promise<unknown>, revive?: () => void, reviveMs?: number): Promise<void> {
  const engines = [...(pool ? await pool : []), ...(own ? [await own] : [])];
  let revived = false;
  const once = () => {
    if (revived) return;
    revived = true;
    revive?.();
  };
  await Promise.all(engines.map((e) => e.pause(until, once, reviveMs)));
}

let speedCheck: Promise<number> | null = null;

/**
 * This page's engine speed check (nodes per second), run once and reported to every lobby it joins (Crowd's many
 * judges, Squads' bot work), so the lobby gives faster devices more of the work.
 */
export function engineSpeed(): Promise<number> {
  speedCheck ??= enginePool().then(([engine]) => engine!.speed(JUDGES.benchNodes));
  return speedCheck;
}

/**
 * This device's engine, with its re-checks (the close calls before a cut) done by the engine server's much
 * deeper search when it answers in time, else by this device as before.
 */
export function withServerRecheck(engine: UciEngine, boards: () => number = () => 1): EngineLike {
  return {
    topMoves: (fen, n) => engine.topMoves(fen, n),
    scoreMoves: (fen, moves) => engine.scoreMoves(fen, moves),
    playAtElo: (fen, elo, nodes, moveMs) => engine.playAtElo(fen, elo, nodes, moveMs),
    topMovesAt: (fen, n, nodes) => engine.topMovesAt(fen, n, nodes),
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
