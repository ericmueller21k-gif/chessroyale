import { account, onAccountChange, updateChatOn } from "./account.ts";

/**
 * Chat's opt-in (Eric, Nov 7: "Chat is OFF by default… Stored per account"): players' typed chat (the global chat in the computer's
 * right column) shows only once you've turned it on, after a one-time notice (components/ChatOptIn.tsx). A signed-in account keeps
 * it on the server (users.chat_on, PATCH /api/me {chatOn}); a guest's is kept on this device. The server refuses a post from an
 * account with it off. docs/decisions/2026-11-07-typed-chat-column.md.
 */

const GUEST_KEY = "brc.chatOn";
/** This device has seen the notice and turned chat on once: later it turns on without asking again. */
const SEEN_KEY = "brc.chatNoticeSeen";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not important: it's asked again.
  }
}

/** Whether chat is on: the account's (signed in), or this device's (a guest). Off by default. */
export function chatOn(): boolean {
  const p = account().profile;
  if (p?.user.signedIn) return !!p.chatOn;
  return read(GUEST_KEY) === "1";
}

/** Whether turning chat on asks first (the notice shows once: not seen on this device, nor ever on for this account). */
export const chatNoticeDue = () => read(SEEN_KEY) !== "1" && !chatOn();

/** Turns chat on or off (the account's, or this device's for a guest). Turning it on marks the notice seen. */
export async function setChatOn(on: boolean): Promise<void> {
  if (on) write(SEEN_KEY, "1");
  if (account().profile?.user.signedIn) await updateChatOn(on);
  else write(GUEST_KEY, on ? "1" : null);
  emit();
}

/** Hears chat turned on or off (here, or the account's answer changing it). */
export function onChatOn(fn: () => void): () => void {
  listeners.add(fn);
  const off = onAccountChange(fn);
  return () => {
    listeners.delete(fn);
    off();
  };
}
