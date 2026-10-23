/**
 * The hippo gardener's seed clock solo and in Boss alone (docs/decisions/2026-10-21-gardener-rules.md): the device's
 * time, counting only while the page is in view, so a player who walks away doesn't feed him seeds (Boss alone has no
 * move clock since Oct 21; his meter's cap bounds it too). In ms: the page's time since it loaded, less every stretch it
 * spent hidden; it stands still while the page is hidden. One clock for the page: the solo runner's (MatchRunner's
 * `clock`, read as he waters) and his meter's (seedsAt and seedFill, read as it's drawn). Online the server's clock
 * counts instead (the lobby's), whoever is looking.
 */
import { testParams } from "./test-switches.ts";

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

/**
 * Testing: `?seedspeed=N` (a test switch: test-switches.ts), the page's garden clock runs N times faster, so a seed (30 s) lands
 * every 30 / N seconds in a test that must not wait for it. The address is read once; whether it counts, each time.
 */
const SPEED_ASKED = (() => {
  try {
    const n = Number(new URLSearchParams(globalThis.location?.search ?? "").get("seedspeed"));
    return n > 1 && n <= 600 ? n : 1;
  } catch {
    return 1;
  }
})();
/** How many times faster the page's garden clock runs: 1, unless a test link asked and may. */
export const gardenSpeed = (): number => (SPEED_ASKED > 1 && testParams().has("seedspeed") ? SPEED_ASKED : 1);

/** The page's clock (made on first use: nothing for the gardener is made as the app loads). */
export function gardenClock(): number {
  if (!page) {
    const doc = typeof document !== "undefined" ? document : null;
    page = visibleClock(
      () => performance.now() * gardenSpeed(),
      () => doc?.visibilityState === "hidden",
      (change) => doc?.addEventListener("visibilitychange", change),
    );
  }
  return page();
}

let online: (() => number) | null = null;
/**
 * An online match tells the garden its server's clock (every message's `now`, less this device's: `Date.now() + offset`), which
 * the lobby's seeds count by; solo has none and uses the page's visible time. Cleared when the match ends.
 */
export function setGardenSource(source: (() => number) | null): void {
  online = source;
}

/** The garden's clock now, the one his meter and his tosses read: the server's online, else the page's visible time. */
export const gardenNow = (): number => (online ? online() : gardenClock());

/** Real ms a garden clock interval takes: the server's runs at real speed, the page's `gardenSpeed` times faster (a test link). */
export const realMs = (clockMs: number): number => clockMs / (online ? 1 : gardenSpeed());
