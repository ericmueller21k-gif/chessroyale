import type { ComponentChildren } from "preact";
import { useLayoutEffect } from "preact/hooks";

/**
 * A sheet over the page (a profile's full list of matches or a worn item's details, the 1 v 1 Ranks pop-up): ✕, Escape or a tap outside
 * closes it. `class`: the sheet's own extra class.
 */
export function Sheet({ id, title, onClose, children, class: cls = "" }: { id: string; title: string; onClose: () => void; children: ComponentChildren; class?: string }) {
  // (A layout effect, as every pop-up's: an effect waits for a paint, and an Escape pressed as it opened was lost. LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    // (Its Escape is its own, heard first: nothing under it (a page layer, a screen, the town) acts on it too.)
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopImmediatePropagation(), onClose());
    addEventListener("keydown", key, true);
    return () => removeEventListener("keydown", key, true);
  }, []);
  return (
    <div class="fd-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`fd-sheet ${cls}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div class="fd-sheet-head">
          <h2 id={id}>{title}</h2>
          <button type="button" class="fd-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
