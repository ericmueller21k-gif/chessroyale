import { useLayoutEffect, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import type { ComponentChildren } from "preact";
import { chatNoticeDue, setChatOn } from "../chat-on.ts";
import { FdButton } from "./FrontDoor.tsx";

/** The notice's words (Eric's, Nov 7: brief-chat-column.md), shown once before chat first turns on. */
export const CHAT_OPT_IN_TITLE = "Turn on chat?";
export const CHAT_OPT_IN_TEXT =
  "Chat is typed by players. We filter hate speech and slurs, and you can report anyone by tapping their name. You may still see things you don't like: chat at your own risk. You can turn chat off any time in Settings.";

/**
 * "Turn on chat?" (Eric, Nov 7): the one-time notice before chat first turns on (the global chat's gear, its "Turn on chat", or
 * Settings). [Not now] closes it; [Turn on chat] turns chat on for the account (chat-on.ts). Escape or a tap outside is Not now.
 */
export function ChatOptIn({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  return (
    <div class="fd-sheet-scrim chat-optin-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="fd-sheet chat-optin" role="dialog" aria-modal="true" aria-labelledby="chat-optin-title">
        <h2 id="chat-optin-title">{CHAT_OPT_IN_TITLE}</h2>
        <p class="fd-sub">{CHAT_OPT_IN_TEXT}</p>
        <div class="chat-optin-buttons">
          <FdButton onClick={onClose}>Not now</FdButton>
          <FdButton
            primary
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void setChatOn(true).finally(onClose);
            }}
          >
            Turn on chat
          </FdButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Turning chat on from anywhere: the notice first if it's due (once), else at once. Returns the notice to draw (or null) and the
 * function that turns chat on.
 */
export function useTurnChatOn(): { ask: () => void; notice: ComponentChildren } {
  const [open, setOpen] = useState(false);
  return {
    ask: () => (chatNoticeDue() ? setOpen(true) : void setChatOn(true)),
    // (On the page's top, over everything: the right column is its own layer.)
    notice: open ? createPortal(<ChatOptIn onClose={() => setOpen(false)} />, document.body) : null,
  };
}
