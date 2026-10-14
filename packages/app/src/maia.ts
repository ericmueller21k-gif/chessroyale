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

/** Each file's size, unpacked (vite.config.ts writes them in at build time; none in unit tests, or without the box). */
declare const __MAIA_FILE_BYTES__: Record<string, number> | undefined;
const BUILT_BYTES: Record<string, number> = typeof __MAIA_FILE_BYTES__ !== "undefined" ? __MAIA_FILE_BYTES__ : {};

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
 * under way is let finish first, so the files come down once; and `after`, if given (a solo battle's loading step:
 * this device's Stockfish ended first). Close it after the battle (it holds ~400 MB).
 */
export function startMaia(loadTimeoutMs = 60_000, after?: Promise<unknown>): HumanUciEngine | null {
  if (typeof Worker === "undefined") return null;
  let engine: HumanUciEngine | null = null;
  try {
    engine = new HumanUciEngine(workerTransport((reason) => engine?.fail(reason)));
  } catch {
    return null;
  }
  const e = engine;
  void Promise.all([prefetching, after]).then(() => e.init(loadTimeoutMs));
  return engine;
}

// ---------------- The download, for the loading step's bar ----------------

/** One file of the download: the bytes read so far, and its size when known (null: unknown). */
export interface FileProgress {
  loaded: number;
  total: number | null;
}

/** The files there are (a file not started yet counts as one of unknown size). */
export const MAIA_FILE_COUNT = FILES.length;

/**
 * How far the download is, for the bar: the share done (null while any file's size is unknown: an indeterminate bar),
 * the bytes read and their total (null: unknown). `count`: how many files there are.
 */
export function downloadProgress(files: readonly FileProgress[], count = MAIA_FILE_COUNT): { share: number | null; loaded: number; total: number | null } {
  const loaded = files.reduce((s, f) => s + f.loaded, 0);
  const known = files.length >= count && files.every((f) => f.total !== null && f.total > 0);
  const total = known ? files.reduce((s, f) => s + f.total!, 0) : null;
  return { share: total ? Math.min(1, loaded / total) : null, loaded, total };
}

/**
 * A file's size, as the reader counts it (unpacked): what the build wrote down for it; else the response's
 * Content-Length when it isn't compressed (a compressed response's length is the packed size, or missing: live, the
 * worker and the WebAssembly come compressed); else unknown.
 */
export function fileTotal(built: number | undefined, contentLength: string | null, contentEncoding: string | null): number | null {
  if (built && built > 0) return built;
  if (contentEncoding && contentEncoding !== "identity") return null;
  const n = Number(contentLength);
  return contentLength && Number.isFinite(n) && n > 0 ? n : null;
}

/** The download as the loading step shows it. */
export interface MaiaDownload {
  /** "fetching": not all here yet; "done": all here (just fetched, or saved already); "failed": the worker tries itself. */
  state: "idle" | "fetching" | "done" | "failed";
  /** Every file was saved on this device already: nothing came down. */
  saved: boolean;
  files: FileProgress[];
}

let download: MaiaDownload = { state: "idle", saved: false, files: [] };

/** Where Maia's download is (read as the loading step draws: its screen redraws every frame). */
export function maiaDownload(): MaiaDownload {
  return download;
}

/** Whether every file is in the service worker's cache already (then nothing is fetched). */
async function allSaved(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const hits = await Promise.all(FILES.map((f) => caches.match(f)));
    return hits.every(Boolean);
  } catch {
    // (No storage here: a private window, say.)
    return false;
  }
}

/** Reads one file to its end, counting its bytes as they come; none are kept (the service worker keeps the file). */
async function readCounting(url: string, slot: FileProgress): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  slot.total = fileTotal(BUILT_BYTES[url.slice(DIR.length)], res.headers.get("content-length"), res.headers.get("content-encoding"));
  const reader = res.body?.getReader();
  if (!reader) {
    // (No stream to read as it comes: the whole file at once.)
    slot.loaded = (await res.arrayBuffer()).byteLength;
    return;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    slot.loaded += value.byteLength;
  }
}

/**
 * Fetches the Maia box's files ahead of a battle that may use it (into the service worker's cache), once per page: the
 * boss menu, a raid's lobby (on the device that plays the boss), the Crowd's vote for a boss battle, a solo battle's
 * loading step. Files already saved aren't read again. How far it is: maiaDownload().
 */
export function prefetchMaia() {
  if (prefetching || typeof fetch === "undefined") return;
  const files: FileProgress[] = [];
  download = { state: "fetching", saved: false, files };
  const done: Promise<void> = (async () => {
    if (await allSaved()) {
      download = { state: "done", saved: true, files };
      return;
    }
    await Promise.all(
      FILES.map((f) => {
        const slot: FileProgress = { loaded: 0, total: null };
        files.push(slot);
        return readCounting(f, slot);
      }),
    );
    download = { state: "done", saved: false, files };
  })().catch(() => {
    // (Offline, or a file missing: tried again next time; the worker fetches what it needs itself meanwhile.)
    download = { state: "failed", saved: false, files };
    if (prefetching === done) prefetching = null;
  });
  prefetching = done;
}
