/**
 * A deploy landed while this page was open: the old version's files are gone from the server, so opening a part of the
 * game loaded on demand (the town square's chunk) fails ("Unable to preload CSS for …", a module that won't load). The page
 * loads again, so it gets the new version and opens where it was (/town). Once: not again within a minute, so a file
 * missing for another reason is reported (problems.ts) rather than reloaded in a loop; and never without storage to
 * remember that it tried.
 */
const KEY = "brc.staleReloadAt";
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
  location.reload();
  return true;
}

/** Vite's event for a chunk that won't load: the page loads again instead of the error (when it does). */
export function watchStaleChunks(): void {
  addEventListener("vite:preloadError", (e) => {
    if (reloadForStaleChunk()) e.preventDefault();
  });
}
