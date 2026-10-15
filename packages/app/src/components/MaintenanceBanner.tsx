import { useState } from "preact/hooks";
import { useServerStatus } from "../status.ts";

const DISMISSED_KEY = "brc.bannerDismissed";

/**
 * The maintenance banner (the Worker variable MAINTENANCE_BANNER, through /api/status): its message in a slim band at
 * the top of every screen, over the page rather than pushing it down (screens are sized to the window). ✕ hides it on
 * this device until the message changes.
 */
export function MaintenanceBanner() {
  const { banner } = useServerStatus();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY);
    } catch {
      return null;
    }
  });
  if (!banner || dismissed === banner) return null;
  return (
    <div class="maint-banner" role="status">
      <span class="maint-banner-text">{banner}</span>
      <button
        type="button"
        class="maint-banner-x"
        aria-label="Hide this message"
        onClick={() => {
          setDismissed(banner);
          try {
            localStorage.setItem(DISMISSED_KEY, banner);
          } catch {
            // No storage: hidden until the app reloads.
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
