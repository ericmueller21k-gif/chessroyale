import { useEffect, useState } from "preact/hooks";
import { FdButton } from "./FrontDoor.tsx";
import { signInToSite, useSiteSignedOut } from "../site-gate.ts";

/** What the notice says (and Profile's and Settings' account line, AccountTrouble). */
export const SITE_SIGNED_OUT_LINE = "You've been signed out of the site, so your account, friends and chat can't load.";

/**
 * Signed out of the site's gate (site-gate.ts; before launch, Cloudflare Access): said once, app-wide, as a pop-up over the top of the
 * screen (Eric's rule: pop-ups sit on top and push nothing), with "Sign in again". ✕ hides it until the page is let in and signed out
 * again. Nothing on any other screen changes: they're empty because of this, and this says so.
 */
export function SiteGateNotice() {
  const out = useSiteSignedOut();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!out) setHidden(false);
  }, [out]);
  if (!out || hidden) return null;
  return (
    <div class="fd-notice site-gate" role="alert">
      <svg class="fd-notice-flag" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z" />
      </svg>
      <span class="fd-notice-text">{SITE_SIGNED_OUT_LINE}</span>
      <FdButton primary class="small fd-notice-go" onClick={signInToSite}>
        Sign in again
      </FdButton>
      <button type="button" class="fd-icon-btn fd-notice-x" aria-label="Dismiss" onClick={() => setHidden(true)}>
        ✕
      </button>
    </div>
  );
}
