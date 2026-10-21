/**
 * The hippo gardener's seed clock solo and in Boss alone (docs/decisions/2026-10-21-gardener-rules.md): the device's
 * time, counting only while the page is in view, so a player who walks away doesn't feed him seeds (Boss alone has no
 * move clock since Oct 21; his meter's cap bounds it too). In ms: the page's time since it loaded, less every stretch it
 * spent hidden; it stands still while the page is hidden. One clock for the page: the solo runner's (MatchRunner's
 * `clock`, read as he waters) and his meter's (seedsAt and seedFill, read as it's drawn). Online the server's clock
 * counts instead (the lobby's), whoever is looking.
 */
export interface VisibleClock {
  (): number;
}

/** A clock that stands still while `hidden()` (checked as `listen`'s handler is called on each change). */
export function visibleClock(now: () => number, hidden: () => boolean, listen: (change: () => void) => void): VisibleClock {
  let away = 0;
  let hiddenAt: number | null = hidden() ? now() : null;
  listen(() => {
    if (hidden()) {
      if (hiddenAt === null) hiddenAt = now();
    } else if (hiddenAt !== null) {
      away += now() - hiddenAt;
      hiddenAt = null;
    }
  });
  return () => (hiddenAt ?? now()) - away;
}

let page: VisibleClock | null = null;

/** The page's clock (made on first use: nothing for the gardener is made as the app loads). */
export function gardenClock(): number {
  if (!page) {
    const doc = typeof document !== "undefined" ? document : null;
    page = visibleClock(
      () => performance.now(),
      () => doc?.visibilityState === "hidden",
      (change) => doc?.addEventListener("visibilitychange", change),
    );
  }
  return page();
}
