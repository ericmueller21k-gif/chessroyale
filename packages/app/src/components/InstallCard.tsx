import { useEffect, useState } from "preact/hooks";
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from "../install.ts";

/**
 * Settings' first section, "THE APP" (Eric, Nov 20: "just put it in the settings ... somewhere near the top"): install HunChess as an
 * app. Always shown (nothing hidden): Chrome and Edge (computer, Android) get a live Install app button that opens the browser's own
 * install box; iPhone Safari has no install API, so its button is greyed and the line says how (Share, Add to Home Screen); installed,
 * or a browser that can't install, the button is greyed and the line says why.
 */
export function InstallCard() {
  const [, rerender] = useState(0);
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);
  const installed = isStandalone();
  const ios = !installed && isIos();
  const live = !installed && !ios && canPromptInstall();
  return (
    <section class="fd-section install-card" aria-label="Install HunChess">
      <h2 class="fd-label">THE APP</h2>
      <button type="button" class="btn btn-primary btn-wide" disabled={!live} onClick={promptInstall}>
        {installed ? "Installed ✓" : "Install app"}
      </button>
      <p class="install-text">
        {installed ? (
          "HunChess is installed on this device."
        ) : ios ? (
          <>
            Tap{" "}
            <svg class="share-icon" viewBox="0 0 24 24" width="18" height="18" aria-label="Share">
              <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>{" "}
            <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>. It opens full screen, like an app.
          </>
        ) : live ? (
          "Its own window and icon, no browser bars."
        ) : (
          "To install, open HunChess in Chrome or Edge. On a Mac in Safari: File, then Add to Dock."
        )}
      </p>
    </section>
  );
}
