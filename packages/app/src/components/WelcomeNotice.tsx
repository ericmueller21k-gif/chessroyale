import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { WELCOME_GIFT, WELCOME_TEXT, welcomeOpens } from "@chessroyale/core";
import { refreshProfile, welcomeNoticeSeen } from "../account.ts";
import { useAccount } from "../screens/Profile.tsx";
import { play } from "../sound.ts";
import { HunchessCrateArt } from "./Items.tsx";
import { InventoryLayer } from "./PageLayer.tsx";

/**
 * The one-time "You earned a Welcome Crate!" notice (Eric, Nov 6; server/welcome.ts): when the server says your Welcome Crate is
 * earned and its notice not seen, a box in the boss token's look (TokenBox: the locker's dialog, `role="dialog"`), the gold-and-black
 * crate in it, "Thank you for being an early tester!" and OK. OK (or Escape, or a tap outside) closes it for good (the server keeps
 * that it was seen). Shown where the token box shows (the result screen: `refresh` asks the server again a little after the result,
 * while the room writes it) and on home (an account that earned it by the backfill sees it the next time it opens the app).
 *
 * Nov 27 (Eric: "a golden ride beta crate is given when you open the game for the first time on the main page, and it says go to your
 * inventory to view it"): the first, given on the first visit, says "A Welcome Crate is waiting in your inventory" and when it opens
 * (level 5); the second keeps "You earned a Welcome Crate!". Beside OK, **Go to inventory** closes it for good too and opens your
 * inventory's Crates tab as a layer over this screen (`InventoryLayer`, as the reward card's), whose Back returns here.
 */
export function WelcomeNotice({ refresh = false, held = false }: { refresh?: boolean; held?: boolean }) {
  const profile = useAccount().profile;
  const welcome = profile?.locker?.welcome;
  useEffect(() => {
    if (!refresh) return;
    // (A solo result reloads your profile itself; an online room writes its results a moment after: ask again then.)
    const timers = [2_500, 7_000].map((ms) => setTimeout(() => void refreshProfile().catch(() => undefined), ms));
    return () => timers.forEach(clearTimeout);
  }, [refresh]);
  // (`held`: home's walkthrough is open over it. It waits, unseen and with no Escape of its own, until that closes; review of #1012, S4.)
  const due = welcome?.notice === true && welcome.status !== "locked" && !held;
  // (The first crate's notice while the second is still to earn; both earned: the second's words.)
  const first = welcome?.next === WELCOME_GIFT.milestones[1];
  const title = first ? WELCOME_TEXT.waiting : WELCOME_TEXT.earned;
  // (The level words only below the level it opens at, for either crate; review of #1012, N3.)
  const below = !welcomeOpens(profile?.xp ?? 0);
  const [inventory, setInventory] = useState(false);
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
  if (inventory) return <InventoryLayer onClose={() => setInventory(false)} />;
  if (!due) return null;
  return (
    <div class="locker-dialog-back" onClick={close}>
      <div class="ff-window locker-dialog gamble-dialog token-box welcome-notice" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <span class="welcome-notice-art">
          <HunchessCrateArt />
        </span>
        <p>
          <strong>{title}</strong>
        </p>
        <p class="small welcome-thanks">{WELCOME_TEXT.thanks}</p>
        <p class="small">
          It's in your inventory's Crates{below ? `: see what's inside now, and open it at level ${WELCOME_GIFT.openLevel}` : ""}. {WELCOME_TEXT.notTradeable}.
        </p>
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" ref={ok} onClick={close}>
            ▶ OK
          </button>
          <button
            type="button"
            class="ff-button small"
            onClick={() => {
              close();
              setInventory(true);
            }}
          >
            ▶ Go to inventory
          </button>
        </div>
      </div>
    </div>
  );
}
