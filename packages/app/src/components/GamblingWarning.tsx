import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { play } from "../sound.ts";

/** What the message says (Eric approved these words, Nov 1). */
export const GAMBLING_WARNING = "Crates are chance, like gambling. Only spend money you're okay losing.";

/**
 * The crate page's gambling warning (Eric, Nov 1): a small red ring, see-through in the middle, with a bubbly solid-red "!" in it,
 * always at the top right of the crate pages (the Crates tab and each crate's own page). It's positioned over the page's corner
 * (styles.css, `gamble-ring`), so it takes no room and moves nothing. A tap opens a short message box with a Close button (also
 * Escape, and a tap outside it); closing puts you back on the ring.
 */
export function GamblingWarning() {
  const [open, setOpen] = useState(false);
  const ring = useRef<HTMLButtonElement>(null);
  const close = () => {
    play("menuClose");
    setOpen(false);
    ring.current?.focus();
  };
  // (A layout effect: the listener is there in the same commit that shows the box, so an Escape pressed the moment it shows
  // closes it. A passive effect waits for the next paint, and a key in that gap was lost: PR #435's CI and main, Nov 1.)
  useLayoutEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  return (
    <>
      <button type="button" ref={ring} class="gamble-ring" aria-label="Gambling warning" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <circle cx="16" cy="16" r="13.2" fill="none" stroke="currentColor" stroke-width="3" />
          {/* (The "!": a chubby drop for the bar and a round dot, both solid, their corners all rounded.) */}
          <path
            fill="currentColor"
            d="M12.4 10.6C12.4 8.5 13.9 7 16 7s3.6 1.5 3.6 3.6c0 2.3-.9 5.3-1.5 7-.3 1-.9 1.5-2.1 1.5s-1.8-.5-2.1-1.5c-.6-1.7-1.5-4.7-1.5-7z"
          />
          <circle cx="16" cy="23.2" r="2.5" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div class="locker-dialog-back" onClick={close}>
          <div class="ff-window locker-dialog gamble-dialog" role="dialog" aria-modal="true" aria-label="Gambling warning" onClick={(e) => e.stopPropagation()}>
            <p>{GAMBLING_WARNING}</p>
            <div class="locker-dialog-actions">
              <button type="button" class="ff-button small" autoFocus onClick={close}>
                ▶ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
