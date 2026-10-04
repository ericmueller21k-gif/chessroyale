import { useEffect, useState } from "preact/hooks";
import { canPromptInstall, dismissInstall, installDismissed, isIos, isStandalone, onInstallChange, promptInstall } from "../install.ts";

/**
 * "Add to Home Screen" prompt. Android and desktop Chrome get a real install
 * button; iPhone Safari has no install API, so it gets instructions instead.
 */
export function InstallCard() {
  const [, rerender] = useState(0);
  const [hidden, setHidden] = useState(installDismissed);
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);

  if (hidden || isStandalone()) return null;
  const ios = isIos();
  if (!ios && !canPromptInstall()) return null;

  const close = () => {
    dismissInstall();
    setHidden(true);
  };

  return (
    <div class="install-card" role="region" aria-label="Install HunChess">
      <button type="button" class="install-close" onClick={close} aria-label="Dismiss">
        ✕
      </button>
      <div class="install-title">Put it on your home screen</div>
      {ios ? (
        <p class="install-text">
          Tap{" "}
          <svg class="share-icon" viewBox="0 0 24 24" width="18" height="18" aria-label="Share">
            <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>{" "}
          <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>. It opens full screen, like an app.
        </p>
      ) : (
        <button type="button" class="btn btn-primary btn-wide" onClick={promptInstall}>
          Install app
        </button>
      )}
    </div>
  );
}
