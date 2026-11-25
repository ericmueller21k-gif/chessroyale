import { APP_CACHE } from "@chessroyale/core";

/**
 * A deploy landed while this page was open: the old version's files are gone from the server, so opening a part of the
 * game loaded on demand (the town square's chunk) fails ("Unable to preload CSS for …", a module that won't load). The page
 * loads again, so it gets the new version and opens where it was (/town). Once: not again within a minute, so a file
 * missing for another reason is reported (problems.ts) rather than reloaded in a loop; and never without storage to
 * remember that it tried.
 *
 * Only for a deploy (Nov 25, docs/decisions/2026-11-25-stale-reload-only-for-a-deploy.md): a file that failed for any other reason (a
 * dropped connection, a phone between networks) is no reason to load the page again, which threw the Boss Battle screen back to home
 * (xp.spec's "No XP" loop, main's run 45559755980: the opening library, fetched in the background there, dropped once) and lost a
 * Resume's tap (Nov 23). So a failed chunk asks the server which build it runs (`/version.json`): another than this page's, the page
 * loads again; the same (or no answer), the load fails as any failed load does, and its caller tries again next time or says so.
 *
 * Older Chromium (CI's 141; Safari too) keeps a failed import() and fails the same file again without asking the server (#942, Nov 25),
 * so a try again can't load it until the page loads again. So a second failure while the server answers with this same build loads the
 * page again too (once a minute, as for a deploy), keeping the screen: the Boss Battle screen is a place (App.tsx), as the town is. A
 * newer browser fetches the file again, so one dropped connection never loads the page there.
 *
 * Since Nov 15 this is the fallback: the service worker keeps an open tab's version's files until it loads again
 * (sw-template.js), so it's for a page the worker doesn't answer (a first visit before it's ready, a browser without one). And
 * the page comes back where it was (`setPlace`, `takePlace`): in the town at your square, with the room or challenge your tap
 * was opening, opened.
 */
const KEY = "brc.staleReloadAt";
const PLACE_KEY = "brc.stalePlace";
const AGAIN_MS = 60_000;
let reloading = false;

/** Loads the page again for a missing chunk: true if it does (or already is), false if it tried within the minute. */
export function reloadForStaleChunk(now = Date.now()): boolean {
  if (reloading) return true;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < AGAIN_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  reloading = true;
  savePlace();
  location.reload();
  return true;
}

/** Where the player is, kept across that reload: a screen's own (the town's: town/Town.tsx), for the address it's at. */
type Place = Record<string, unknown>;
let placeOf: (() => Place | null) | null = null;

/** A screen tells where the player is in it, should the page load again (null: it's gone, `setPlace(null)`). */
export function setPlace(get: (() => Place | null) | null): void {
  placeOf = get;
}

function savePlace(): void {
  try {
    const place = placeOf?.();
    if (place) sessionStorage.setItem(PLACE_KEY, JSON.stringify({ path: location.pathname, place }));
  } catch {
    // (No storage, or a place that won't save: the page comes back as a fresh one.)
  }
}

/** The place kept by the reload that loaded this page, read once (as this module loads) and gone from storage at once. */
const saved: { path: string; place: Place } | null = (() => {
  try {
    const raw = sessionStorage.getItem(PLACE_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(PLACE_KEY);
    const v = JSON.parse(raw) as { path?: unknown; place?: unknown };
    return typeof v.path === "string" && v.place && typeof v.place === "object" ? { path: v.path, place: v.place as Place } : null;
  } catch {
    return null;
  }
})();
let taken = false;

/** A screen's place was `get`: it's gone (as `setPlace(null)`, unless another screen's has taken over since). */
export function dropPlace(get: () => Place | null): void {
  if (placeOf === get) placeOf = null;
}

/** The place kept for this page under `key` (a screen's own: the first ask only, and only at the address it was kept at), or null. */
export function takePlace(key: string, path = location.pathname): unknown {
  if (taken || !saved || saved.path !== path || !(key in saved.place)) return null;
  taken = true;
  return saved.place[key];
}

/** This page's build (vite.config.ts's `__APP_VERSION__`, as version.json names it); "dev" on the dev server, which has no version.json. */
declare const __APP_VERSION__: string | undefined;
const MINE = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/**
 * The server's build against this page's (`/version.json`): "another" (a deploy has landed since this page loaded), "same", or null:
 * no answer within `ms` (offline, a dropped connection again), an answer without a version, or a page that doesn't know its own build
 * ("dev").
 */
export async function serverBuild(mine = MINE, ms = APP_CACHE.staleCheckMs): Promise<"another" | "same" | null> {
  if (mine === "dev") return null;
  try {
    const res = await fetch("/version.json", { cache: "no-store", signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    const v = (await res.json()) as { version?: unknown };
    return typeof v.version !== "string" ? null : v.version === mine ? "same" : "another";
  } catch {
    return null;
  }
}

/**
 * The last failed chunk's error (Vite's event's) and verdict, for the import it fails (Vite fires the event before that import gives
 * `undefined`); the check under way (one for failures together); and whether a failure on this same build has stood already.
 */
let lastError: unknown = null;
let verdict: Promise<boolean> = Promise.resolve(false);
let check: Promise<boolean> | null = null;
let stood = false;

/**
 * A chunk failed: true once the page is loading again (reloadForStaleChunk) for a deploy, or for a second failure on the same build
 * (an older browser's kept failure: a try again can't load it); false: the failure stands.
 */
export function chunkFailed(error: unknown, build: () => Promise<"another" | "same" | null> = serverBuild): Promise<boolean> {
  lastError = error;
  if (reloading) return (verdict = Promise.resolve(true));
  return (verdict = check ??= build().then((b) => {
    check = null;
    if (b === "another" || (b === "same" && stood)) return reloadForStaleChunk();
    if (b === "same") stood = true;
    return false;
  }));
}

/**
 * A chunk loaded on demand (`chunk(import("./x.ts")).then((m) => m.x)`): as import() gives it. One that won't load reaches Vite's
 * "vite:preloadError" below, prevented (Vite's import then gives `undefined`): while the page loads again for a deploy, a promise that
 * never settles, so nothing goes on to use it (Nov 15: "reading 'loadIntro'" of undefined) or backs out as from a failure; otherwise
 * the load's own error, as if nothing had taken it over.
 */
export function chunk<M>(load: Promise<M>): Promise<M> {
  return load.then((m) =>
    m !== undefined
      ? m
      : verdict.then((reload) => (reload ? new Promise<M>(() => {}) : Promise.reject(lastError ?? new Error("A part of the game didn't load.")))),
  );
}

/**
 * Vite's event for a chunk that won't load: prevented always, as it must be decided at once, before the server can say whether a
 * deploy landed; the page loads again only if one did, or for a second failure (chunkFailed). A `lazyGroup` (lazy.tsx) takes the `undefined` as a load to try
 * again next time.
 */
export function watchStaleChunks(): void {
  addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    void chunkFailed((e as Event & { payload?: unknown }).payload);
  });
}
