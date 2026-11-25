import { useState } from "preact/hooks";
import { FdButton } from "./FrontDoor.tsx";
import { retryAccount, type AccountFailure } from "../account.ts";
import { signInToSite } from "../site-gate.ts";
import { SITE_SIGNED_OUT_LINE } from "./SiteGateNotice.tsx";

/** Why your account didn't load, in plain words (account.ts's `failed`). */
export const ACCOUNT_TROUBLE: Record<AccountFailure, string> = {
  gate: SITE_SIGNED_OUT_LINE,
  offline: "Can't reach HunChess right now. Check your connection, then try again.",
  server: "HunChess couldn't load your account just now. Please try again.",
};

/**
 * Your account didn't load (Profile, and Settings' ACCOUNT): why, and Try again; signed out of the site's gate, "Sign in again" first
 * (Nov 20: Profile sat on "Loading…" for good and nothing said why). `onRetry`: what Try again loads (the account's load by default).
 */
export function AccountTrouble({ failed, onRetry = retryAccount }: { failed: AccountFailure; onRetry?: () => Promise<unknown> }) {
  const [trying, setTrying] = useState(false);
  const retry = () => {
    setTrying(true);
    void onRetry().finally(() => setTrying(false));
  };
  return (
    <div class="fd-account-trouble" role="alert">
      <p class="fd-sub">{ACCOUNT_TROUBLE[failed]}</p>
      <div class="fd-card-actions">
        {failed === "gate" && (
          <FdButton primary class="small" onClick={signInToSite}>
            Sign in again
          </FdButton>
        )}
        <FdButton primary={failed !== "gate"} class="small" disabled={trying} onClick={retry}>
          {trying ? "Trying…" : "Try again"}
        </FdButton>
      </div>
    </div>
  );
}
