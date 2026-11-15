/**
 * A deploy landed while this page was open: the old version's files are gone from the server, so opening a part of the
 * game loaded on demand (the town square's chunk) fails ("Unable to preload CSS for …", a module that won't load). The page
 * loads again, so it gets the new version and opens where it was (/town). Once: not again within a minute, so a file
 * missing for another reason is reported (problems.ts) rather than reloaded in a loop; and never without storage to
 * remember that it tried.
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

/** The place kept for this page (the first ask only, and only at the address it was kept at), or null. */
export function takePlace(path = location.pathname): Place | null {
  if (taken || !saved || saved.path !== path) return null;
  taken = true;
  return saved.place;
}

/**
 * A chunk loaded on demand (`chunk(import("./x.ts")).then((m) => m.x)`): as import() gives it, or, when it's gone after a deploy
 * and the page is loading again (the "vite:preloadError" below, prevented: Vite's import then gives `undefined`), a promise that
 * never settles, so nothing goes on to use it (Nov 15: "reading 'loadIntro'" of undefined) or backs out as from a failure.
 */
export function chunk<M>(load: Promise<M>): Promise<M> {
  return load.then((m) => (m === undefined ? new Promise<M>(() => {}) : m));
}

/** Vite's event for a chunk that won't load: the page loads again instead of the error (when it does). */
export function watchStaleChunks(): void {
  addEventListener("vite:preloadError", (e) => {
    if (reloadForStaleChunk()) e.preventDefault();
  });
}
