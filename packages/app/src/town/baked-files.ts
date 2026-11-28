/**
 * The baked town's files, fetched (Nov 28, the town's structure, phase 1b: docs/decisions/2026-11-28-town-load-baked.md). The build
 * paints Chess Town's pictures and writes them under /town-pictures/ with a manifest named by its contents (scripts/bake-town.ts), and
 * hands this build that name (`__TOWN_PICTURES__`, vite.config.ts) and each town's pages' names (`__TOWN_PAGES__`). The town's loading
 * screen fetches the manifest and this town's files through here (town/baked.ts); home fetches the same files when idle, one at a time
 * at low priority (`fetchTownAhead`), so the service worker keeps them (sw-template.js, TOWN_FILE) before the first visit to the town.
 * No town code here: the main bundle holds it.
 */
import { TOWN_PICTURES } from "@chessroyale/core";
import { workerNever } from "../install.ts";
import { BAKED_NAME, TOWN_PICTURES_DIR, manifestFrom, type TownKind, type TownManifest } from "./manifest.ts";

declare const __TOWN_PICTURES__: string | undefined;
declare const __TOWN_PAGES__: Partial<Record<TownKind, readonly string[]>> | undefined;
/**
 * This build's baked town's manifest's name (null: none baked for it; tests). In the dev server, `order.json`: the bake's file that
 * names its manifest, read fresh each time the town loads (the dev server bakes when the town first asks, and again after the art
 * changes: vite.config.ts `townPictures`).
 */
export const TOWN_MANIFEST: string | null = typeof __TOWN_PICTURES__ === "string" && __TOWN_PICTURES__ ? __TOWN_PICTURES__ : null;
const NAMED_BY = "order.json";
/**
 * Each town's pages' names, as the build's manifest has them (`filesOf`; none in the dev server, where home fetches nothing ahead):
 * home fetches them by these, so it never reads the manifest (378 KB of JSON and 2,900 pictures checked, on its main thread; the review
 * of phase 1b). The town's own load reads the manifest, under its loading card.
 */
const TOWN_PAGES: Partial<Record<TownKind, readonly string[]>> = typeof __TOWN_PAGES__ === "object" && __TOWN_PAGES__ ? __TOWN_PAGES__ : {};

/** How a file is asked for. `low`: at low priority (home's fetch ahead). `signal`: stops it. `moved`: called as its bytes arrive. */
export interface FileAsk {
  low?: boolean;
  signal?: AbortSignal;
  moved?: () => void;
}

/** The files read to their end since the page loaded (by home or by the town): home's fetch ahead doesn't ask for one again. */
const fetched = new Set<string>();

/** An answer's body, read to its end, telling `moved` as each piece arrives (the loading screen's stall watch, baked.ts). */
async function read(res: Response, moved?: () => void): Promise<Blob> {
  const from = moved && res.body?.getReader();
  if (!from) return res.blob();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await from.read();
    if (done) break;
    parts.push(value);
    moved();
  }
  return new Blob(parts as BlobPart[], { type: res.headers.get("content-type") ?? "" });
}

/**
 * One baked file as the server (or the service worker's kept copy) has it. Rejects for anything but the file itself: no answer, an
 * error, the app's page sent for a file the server no longer has, or `signal` stopping it. Each call is a request of its own: the
 * town's load never waits on one home started at low priority (home's is stopped as home closes).
 */
export function bakedFile(name: string, o: FileAsk = {}): Promise<Blob> {
  const want = name.endsWith(".json") ? "json" : "image/png";
  const init: RequestInit & { priority?: string } = {};
  if (o.low) init.priority = "low";
  if (o.signal) init.signal = o.signal;
  return fetch(`/${TOWN_PICTURES_DIR}/${name}`, o.low || o.signal ? init : undefined)
    .then((res) => (res.ok && (res.headers.get("content-type") ?? "").includes(want) ? read(res, o.moved) : Promise.reject(new Error(`${name}: ${res.status}`))))
    .then((b) => {
      fetched.add(name);
      return b;
    });
}

let manifest: TownManifest | null = null;
/**
 * This build's manifest, fetched and read once a page (null: none, or it couldn't be read; asked again next time then). The dev
 * server's is read fresh each time the town loads: the one its latest bake's order.json names.
 */
export async function bakedManifest(o: FileAsk = {}): Promise<TownManifest | null> {
  if (!TOWN_MANIFEST || !TOWN_PICTURES.baked) return null;
  if (manifest) return manifest;
  try {
    const dev = TOWN_MANIFEST === NAMED_BY;
    const name = dev ? String(((await (await fetch(`/${TOWN_PICTURES_DIR}/${NAMED_BY}`, { cache: "no-store", signal: o.signal })).json()) as { manifest?: unknown }).manifest) : TOWN_MANIFEST;
    if (!BAKED_NAME.test(name)) return null;
    const m = manifestFrom(JSON.parse(await (await bakedFile(name, o)).text()));
    if (!dev) manifest = m;
    return m;
  } catch {
    return null;
  }
}

/**
 * Once the service worker answers this page's requests, so it keeps what home fetches (the review of phase 1b, S4: on a first visit
 * the worker takes over only after its own files are in, and a file fetched before that passed it by). At once where the page has one
 * already, or will have none (`workerNever`: the dev server, a browser without, a registration that failed), or `signal` stops the wait.
 */
function workerAnswers(signal: AbortSignal): Promise<void> {
  const sw = typeof navigator === "undefined" ? undefined : (navigator as Partial<Navigator>).serviceWorker;
  if (!sw || sw.controller) return Promise.resolve();
  return new Promise((go) => {
    const done = () => {
      sw.removeEventListener("controllerchange", done);
      signal.removeEventListener("abort", done);
      go();
    };
    sw.addEventListener("controllerchange", done);
    signal.addEventListener("abort", done);
    void workerNever.then(done);
  });
}

/**
 * Home, once it has shown a while (`TOWN_PICTURES.homeFetchAfterMs`) and the page is idle: the town's files fetched ahead (the manifest,
 * then this town's pages), one at a time at low priority, each read to its end and let go (the service worker keeps it as it passes), as
 * the town fetches the bosses' music. Not on a connection that asks to save data or is a slow one (`homeFetchNotOn`); never a file
 * this page has read already (after each match home shows again). Call what it returns to stop (home closed, or its queue showing):
 * the file on its way is stopped too.
 */
export function fetchTownAhead(kind: TownKind): () => void {
  // (Nor in the dev server, where asking would bake the town for every page that rests on home.)
  const all = TOWN_MANIFEST && TOWN_MANIFEST !== NAMED_BY && TOWN_PICTURES.baked ? [TOWN_MANIFEST, ...(TOWN_PAGES[kind] ?? [])].filter((n) => BAKED_NAME.test(n)) : [];
  const line = typeof navigator === "undefined" ? undefined : (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (all.every((n) => fetched.has(n)) || line?.saveData === true || (TOWN_PICTURES.homeFetchNotOn as readonly string[]).includes(line?.effectiveType ?? "")) return () => {};
  const stop = new AbortController();
  const go = async () => {
    await workerAnswers(stop.signal);
    for (const name of all) {
      if (stop.signal.aborted) return;
      if (!fetched.has(name)) await bakedFile(name, { low: true, signal: stop.signal }).catch(() => undefined);
    }
  };
  const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const timer = setTimeout(() => (stop.signal.aborted ? undefined : idle ? idle(() => void go(), { timeout: 3000 }) : void go()), TOWN_PICTURES.homeFetchAfterMs);
  return () => {
    clearTimeout(timer);
    stop.abort();
  };
}
