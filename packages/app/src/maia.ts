import { HumanUciEngine, type UciTransport } from "@chessroyale/chess";

/**
 * The Maia box: Maia-3 (CSSLab, University of Toronto), a separate program under the GNU AGPL in its own worker
 * (/engine/maia/, built from packages/maia-worker). The game only starts the worker and exchanges plain-text,
 * UCI-style lines with it, as with Stockfish (engine.ts); none of its code is imported or bundled here.
 */
const DIR = "/engine/maia/";
const WORKER = `${DIR}maia-worker.js`;
/** Its files, for the prefetch: the worker, onnxruntime's WebAssembly and the model. */
const FILES = [WORKER, `${DIR}ort-wasm-simd-threaded.wasm`, `${DIR}maia3-23m-int8.onnx`];

function workerTransport(onError: (reason: string) => void): UciTransport {
  const worker = new Worker(WORKER, { type: "module" });
  const listeners: ((line: string) => void)[] = [];
  worker.onmessage = (e: MessageEvent) => {
    if (typeof e.data !== "string") return;
    for (const line of e.data.split("\n")) for (const l of listeners) l(line.trim());
  };
  worker.onerror = (e) => onError(e.message || "worker error");
  return {
    send: (c) => worker.postMessage(c),
    onLine: (l) => listeners.push(l),
    close: () => worker.terminate(),
  };
}

/** The prefetch under way (or done), once per page. */
let prefetching: Promise<void> | null = null;

/**
 * Starts the Maia worker and loads the model (about 25 MB, from the service worker's cache after the first time):
 * the engine is returned at once and answers moves once ready (the boss plays Stockfish until then). A prefetch still
 * under way is let finish first, so the files come down once. Close it after the battle (it holds ~400 MB).
 */
export function startMaia(loadTimeoutMs = 60_000): HumanUciEngine | null {
  if (typeof Worker === "undefined") return null;
  let engine: HumanUciEngine | null = null;
  try {
    engine = new HumanUciEngine(workerTransport((reason) => engine?.fail(reason)));
  } catch {
    return null;
  }
  const e = engine;
  void (prefetching ?? Promise.resolve()).then(() => e.init(loadTimeoutMs));
  return engine;
}

/**
 * Fetches the Maia box's files ahead of a battle that may use it (into the service worker's cache), once per page: the
 * boss menu, a raid's lobby (on the device that plays the boss), the Crowd's vote for a boss battle.
 */
export function prefetchMaia() {
  if (prefetching || typeof fetch === "undefined") return;
  const done = Promise.all(FILES.map((f) => fetch(f).then((r) => r.arrayBuffer())))
    .then(() => undefined)
    .catch(() => {
      // (Offline, or a file missing: tried again next time.)
      if (prefetching === done) prefetching = null;
    });
  prefetching = done;
}
