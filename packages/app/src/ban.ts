/**
 * A ban means you can't sign in (Eric, Nov 13; docs/decisions/2026-11-13-ban-blocks-sign-in.md). The server gives a banned session,
 * a browser it marked banned, or a sign-in to a banned account one answer on every route: 403 with the `x-hc-banned` header
 * (server/ban-gate.ts). Any answer with it, from any request this page makes (`watchBans` wraps the page's fetch, so every call
 * counts, old and new), or a lobby's "banned" message (`showBanNotice` in components/FairPlay.tsx), drops the app to its ban screen
 * and nothing else: no menus, no town, no solo, no chat (main.tsx draws only that).
 *
 * This device remembers it (`brc.banned`), so a reload, a deep link or another tab shows the ban screen from its first frame. While the
 * screen is up it asks the server (`checkBan`: at load, a minute after each ban answer, sooner after a failed ask, and whenever the page
 * comes back into view or online), and leaves the screen once the server lets this browser in: the ban lifted, the browser's data
 * cleared (a guest again), or someone signed in to their own account on it (a shared device: the ban screen's sign-in box).
 */

const KEY = "brc.banned";
/** The server's mark on every ban answer (server/ban-gate.ts BAN_HEADER). */
export const BAN_HEADER = "x-hc-banned";

function readFlag(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let banned = readFlag();
const listeners = new Set<() => void>();
/** While the screen is up: ask the server again this long after a ban answer, so a lifted ban counts in an open tab (minor 3). */
export const RECHECK_MS = 60_000;
/** After no answer, or one that's neither the ban nor a way in (a 429, a 5xx), again after this, doubling up to RECHECK_MS. */
export const RETRY_MS = 5_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let asking = false;

/** The next ask while the screen is up (none once it's down). */
function askAgainIn(ms: number) {
  if (timer) clearTimeout(timer);
  timer = banned ? setTimeout(() => void checkBan(), ms) : null;
}

export const isBanned = () => banned;
export function onBanChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function set(next: boolean) {
  try {
    if (next) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // No storage: the server's answer at the next load says it again.
  }
  if (banned === next) return;
  banned = next;
  failures = 0;
  // (Up: ask again in a while; down: no more asking.)
  askAgainIn(RECHECK_MS);
  listeners.forEach((l) => l());
}

/** The server said this account is banned: the ban screen, now and at every load until the server lets this browser in again. */
export const enterBan = () => set(true);

/** Whether an answer is the server's ban answer. */
export const isBanAnswer = (res: Response) => res.status === 403 && res.headers.get(BAN_HEADER) === "1";

let watching = false;
/**
 * Every answer this page's fetch gets is looked at (only its status and one header: the body is left for its caller): the ban answer
 * drops the app to the ban screen, whichever call it came from. Called first thing (main.tsx), before anything asks the server.
 */
export function watchBans(): void {
  if (watching || typeof window === "undefined" || typeof window.fetch !== "function") return;
  watching = true;
  const real = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await real(...args);
    if (isBanAnswer(res)) enterBan();
    return res;
  };
  // (Back on screen, or back online: the screen asks at once, so an installed app opened again doesn't wait for its next ask.)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkBan();
  });
  window.addEventListener("online", () => void checkBan());
}

/**
 * While the ban screen is up, asks the server whether it still holds (`/api/me`: the gate answers before anything else runs). The ban
 * answer keeps the screen, and asks again in RECHECK_MS; a 2xx means the server let this browser in (the ban lifted, its data cleared,
 * or a sign-in here to an account that isn't banned), so the app loads as usual. No answer (offline), or any other (a 429, a 5xx, the
 * database down): the screen stays, and asks again after RETRY_MS, doubling, up to RECHECK_MS. A player who isn't banned is never kept
 * there for a page's life by one failed ask (the review of #687, minor 3).
 */
export async function checkBan(): Promise<void> {
  if (!banned || asking) return;
  asking = true;
  if (timer) clearTimeout(timer);
  timer = null;
  let next: number | null = RECHECK_MS;
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (isBanAnswer(res)) failures = 0;
    else if (res.ok) next = null;
    else failures++;
  } catch {
    failures++;
  }
  asking = false;
  if (next === null) return set(false);
  askAgainIn(failures ? Math.min(RECHECK_MS, RETRY_MS * 2 ** (failures - 1)) : RECHECK_MS);
}
