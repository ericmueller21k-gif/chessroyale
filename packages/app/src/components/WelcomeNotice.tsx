import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { WELCOME_TEXT } from "@chessroyale/core";
import { refreshProfile, welcomeNoticeSeen } from "../account.ts";
import { useAccount } from "../screens/Profile.tsx";
import { play } from "../sound.ts";
import { HunchessCrateArt } from "./Items.tsx";

/**
 * The one-time "You earned a Welcome Crate!" notice (Eric, Nov 6; server/welcome.ts): when the server says your Welcome Crate is
 * earned and its notice not seen, a box in the boss token's look (TokenBox: the locker's dialog, `role="dialog"`), the gold-and-black
 * crate in it, "Thank you for being an early tester!" and OK. OK (or Escape, or a tap outside) closes it for good (the server keeps
 * that it was seen). Shown where the token box shows (the result screen: `refresh` asks the server again a little after the result,
 * while the room writes it) and on home (an account that earned it by the backfill sees it the next time it opens the app).
 */
export function WelcomeNotice({ refresh = false }: { refresh?: boolean }) {
  const welcome = useAccount().profile?.locker?.welcome;
  useEffect(() => {
    if (!refresh) return;
    // (A solo result reloads your profile itself; an online room writes its results a moment after: ask again then.)
    const timers = [2_500, 7_000].map((ms) => setTimeout(() => void refreshProfile().catch(() => undefined), ms));
    return () => timers.forEach(clearTimeout);
  }, [refresh]);
  const due = welcome?.notice === true && welcome.status !== "locked";
  const ok = useRef<HTMLButtonElement>(null);
  const close = () => {
    play("menuClose");
    void welcomeNoticeSeen();
  };
  // (A layout effect, as the token box's: an Escape the moment it shows closes it.)
  useLayoutEffect(() => {
    if (!due) return;
    ok.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [due]);
  if (!due) return null;
  return (
    <div class="locker-dialog-back" onClick={close}>
      <div class="ff-window locker-dialog gamble-dialog token-box welcome-notice" role="dialog" aria-modal="true" aria-label={WELCOME_TEXT.earned} onClick={(e) => e.stopPropagation()}>
        <span class="welcome-notice-art">
          <HunchessCrateArt />
        </span>
        <p>
          <strong>{WELCOME_TEXT.earned}</strong>
        </p>
        <p class="small welcome-thanks">{WELCOME_TEXT.thanks}</p>
        <p class="small muted">It's in your inventory's Crates. {WELCOME_TEXT.notTradeable}.</p>
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" ref={ok} onClick={close}>
            ▶ OK
          </button>
        </div>
      </div>
    </div>
  );
}
