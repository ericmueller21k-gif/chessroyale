import { UciEngine, type UciTransport } from "@chessroyale/chess";
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
