import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useServerStatus } from "../status.ts";

const DISMISSED_KEY = "brc.bannerDismissed";

/**
 * The maintenance banner (the Worker variable MAINTENANCE_BANNER, through /api/status): its message in a slim band at
 * the top of every screen. Its height goes to --banner-h, so the page starts under it and is that much shorter
 * (styles.css: body's padding, --app-h): it never covers a control and nothing scrolls because of it. ✕ hides it on
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
  const shown = !!banner && dismissed !== banner;
  const el = useRef<HTMLDivElement>(null);
  // (Before the frame is painted, so the page moves with the banner as it comes and goes, never a frame apart.)
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const node = el.current;
    if (!shown || !node) return void root.removeProperty("--banner-h");
    const set = () => root.setProperty("--banner-h", `${Math.ceil(node.getBoundingClientRect().height)}px`);
    set();
    const watch = new ResizeObserver(set);
    watch.observe(node);
    return () => {
      watch.disconnect();
      root.removeProperty("--banner-h");
    };
  }, [shown, banner]);
  if (!shown) return null;
  return (
    <div class="maint-banner" role="status" ref={el}>
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
