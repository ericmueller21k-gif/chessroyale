/**
 * A ban means you can't sign in (Eric, Nov 13; docs/decisions/2026-11-13-ban-blocks-sign-in.md). The server gives a banned session,
 * a browser it marked banned, or a sign-in to a banned account one answer on every route: 403 with the `x-hc-banned` header
 * (server/ban-gate.ts). Any answer with it, from any request this page makes (`watchBans` wraps the page's fetch, so every call
 * counts, old and new), or a lobby's "banned" message (`showBanNotice` in components/FairPlay.tsx), drops the app to its ban screen
 * and nothing else: no menus, no town, no solo, no chat (main.tsx draws only that).
 *
 * This device remembers it (`brc.banned`), so a reload, a deep link or another tab shows the ban screen from its first frame; it
 * then asks the server (`checkBan`) and leaves the screen only if the server lets it in (the ban lifted, or the browser's data
 * cleared: a guest again).
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
/** The ban was remembered when this page loaded (checkBan asks the server about it). */
const atLoad = banned;
const listeners = new Set<() => void>();

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
}

/**
 * A device that remembered the ban as this page loaded asks the server once (main.tsx; `/api/me`: the gate answers before anything
 * else runs). The ban answer keeps the screen; any other answer from the server means it let this browser in (the ban lifted, or
 * its data cleared), so the app loads as usual. No answer (offline): the screen stays.
 */
export async function checkBan(): Promise<void> {
  if (!atLoad || !banned) return;
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (isBanAnswer(res)) return enterBan();
    if (res.ok) set(false);
  } catch {
    // Offline: the ban screen stays until the server can say.
  }
}
