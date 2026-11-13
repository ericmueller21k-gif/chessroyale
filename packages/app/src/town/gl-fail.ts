/**
 * The street town's WebGL failing (Eric, Nov 13: "How is the town broken? ... it's the old version"; docs/decisions/2026-11-13-town-no-old-fallback.md).
 * It never falls back to the old town. A context lost while the page is hidden doesn't count (iOS drops WebGL when the app goes to the
 * background): it gets `waitMs` from when the page shows again to come back. One that doesn't, or WebGL failing as the town starts, reloads
 * the street town once; failing again soon after that reload, the town's box says so with a Reload button (Town.tsx).
 */

/** How long after the reload a second failure counts as failing again (the reload's load, then a context's wait, fit well within it). */
export const RETRY_WINDOW_MS = 120_000;
const KEY = "town-gl-reload";

/**
 * What a failure does: "reload" (once: the time is kept in the tab's session storage) or "message" (it reloaded for this a moment ago, or
 * the storage can't keep the time, so a reload could loop).
 */
export function afterFail(now = Date.now(), store: Pick<Storage, "getItem" | "setItem"> | null = session()): "reload" | "message" {
  try {
    const at = Number(store!.getItem(KEY));
    if (at && now - at >= 0 && now - at < RETRY_WINDOW_MS) return "message";
    store!.setItem(KEY, String(now));
    return "reload";
  } catch {
    return "message";
  }
}
function session(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The lost-context rule: `changed()` when the context is lost or restored and as the page is hidden or shown. While it's lost and the
 * page shows, `fail` runs after `waitMs`; hidden, the wait stops, and showing again starts it afresh.
 */
export function lossWatch(isLost: () => boolean, isHidden: () => boolean, waitMs: number, fail: () => void) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const changed = () => {
    clearTimeout(t);
    t = undefined;
    if (!isLost() || isHidden()) return;
    t = setTimeout(() => {
      t = undefined;
      if (isLost() && !isHidden()) fail();
    }, waitMs);
  };
  return { changed, stop: () => clearTimeout(t) };
}
