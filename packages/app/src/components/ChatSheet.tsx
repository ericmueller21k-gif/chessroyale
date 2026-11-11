import { useLayoutEffect, useRef } from "preact/hooks";
import { GlobalChat } from "./GlobalChat.tsx";

/**
 * The phone's chat (Eric, Nov 11: "We don't have a chat function on mobile"): the global chat (GlobalChat, the same component the
 * computer's side menu shows, with its sign-in and on/off rules) as a full-screen sheet over home. The × closes it (Escape too),
 * and home is as it was: nothing under the sheet moves.
 */
export function ChatSheet({ onSignIn, onClose }: { onSignIn: () => void; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  // (The latest onClose, read by the key handler: the listener is added once, and the focus isn't taken back on each render.)
  const latest = useRef(onClose);
  latest.current = onClose;
  useLayoutEffect(() => {
    close.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && latest.current();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <div class="chat-sheet" role="dialog" aria-modal="true" aria-label="Chat">
      <div class="chat-sheet-top">
        <button ref={close} type="button" class="chat-sheet-close" aria-label="Close chat" onClick={onClose}>
          ×
        </button>
      </div>
      <GlobalChat onSignIn={onSignIn} />
    </div>
  );
}
