import { useLayoutEffect, useRef } from "preact/hooks";
import { bossDef } from "@chessroyale/core";
import { play } from "../sound.ts";
import { unlockNoticeText, useUnlockNotice } from "../unlocks.ts";
import { BossPortrait } from "./BossPortrait.tsx";

/**
 * "The Stranger is now available in Boss Battle" (Eric, Nov 27: "when you beat him, it should have that same blue pop-up style we use
 * for other things"): the one-time notice as a boss is unlocked by a win (unlocks.ts wonUnlockFloor), on the floor's result screen. The
 * blue window the Welcome Crate's notice and the boss token's box use (`ff-window locker-dialog`), his face in it, one button: OK (or
 * Escape, or a tap outside). One button only: a second, to Boss Battle, would take you out of your climb.
 */
export function UnlockNotice() {
  const [id, close] = useUnlockNotice();
  const ok = useRef<HTMLButtonElement>(null);
  const done = () => {
    play("menuClose");
    close();
  };
  // (A layout effect, as the token box's: an Escape the moment it shows closes it.)
  useLayoutEffect(() => {
    if (!id) return;
    ok.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && done();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [id]);
  if (!id) return null;
  const boss = bossDef(id);
  const title = unlockNoticeText(id);
  return (
    <div class="locker-dialog-back" onClick={done}>
      <div class="ff-window locker-dialog gamble-dialog token-box unlock-notice" role="dialog" aria-modal="true" aria-label={title} data-boss={id} onClick={(e) => e.stopPropagation()}>
        {boss && (
          <span class="unlock-notice-art">
            <BossPortrait boss={boss} label="" />
          </span>
        )}
        <p>
          <strong>{title}</strong>
        </p>
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" ref={ok} onClick={done}>
            ▶ OK
          </button>
        </div>
      </div>
    </div>
  );
}
