import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import { ShopScreen } from "../screens/Shop.tsx";
import { play } from "../sound.ts";

/**
 * Your inventory as a layer (Nov 22; Eric: "How do we make it so people don't have to like leave the town if they want to go to their
 * inventory?"): the shop screen's own Crates, Locker and Shop tabs (`ShopScreen`, not a copy) over whatever you're on, so nothing
 * underneath unmounts: a Battle Tower run, a party, the town stay as they were. Its Back, Escape and the phone's back gesture close it
 * (one step pushed in the history; back takes it, the page never navigates). Nothing under it hears a key or a tap. Its opener owns
 * it: when the screen underneath moves on (a party's floor, a match starting), the layer goes with it and you go along.
 * docs/decisions/2026-11-22-inventory-layer.md.
 */

/** The layer's history step: the state it pushes carries this (and whatever the step under it carried: the town's `townStep`). */
const STEP = "inventoryLayer";
/** Pops of our own step to let pass (a close by Back or Escape, or the layer going with its screen, goes back itself). */
let skip = 0;
/** The open layer's close, for the back gesture. */
let active: (() => void) | null = null;

/**
 * The app's popstate (App.tsx) asks this first: true when the pop was the layer's (the back gesture closing it, or the layer's own
 * `history.back()`), so nothing else acts on it.
 */
export function inventoryTakesPop(): boolean {
  if (skip > 0) {
    skip--;
    return true;
  }
  if (!active) return false;
  const close = active;
  active = null;
  close();
  return true;
}

const ours = () => !!(history.state as Record<string, unknown> | null)?.[STEP];

export function InventoryLayer({ onClose, initial = "crates" }: { onClose: () => void; initial?: "crates" | "locker" }) {
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // (A layout effect, as every pop-up's: its key guard and its step are there in the commit that shows it. LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    history.pushState({ ...((history.state as object | null) ?? {}), [STEP]: true }, "", location.href);
    const mine = () => closeRef.current();
    active = mine;
    root.current?.querySelector<HTMLElement>(".fd-back")?.focus();
    // (Before anything else hears it: no key reaches the screen under it (the town's walk, a match's history arrows, their Escapes).
    // A pop-up inside it (the locker's delete, the gambling warning, the shop's note) takes its own Escape, in the capture phase too.)
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape" && root.current?.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.stopImmediatePropagation();
      if (e.key !== "Escape") return;
      e.preventDefault();
      play("menuClose");
      closeRef.current();
    };
    addEventListener("keydown", keys, true);
    return () => {
      removeEventListener("keydown", keys, true);
      if (active === mine) active = null;
      // (Closed by its Back, Escape or its screen moving on: its step goes too. Closed by the back gesture: that took it already.)
      if (ours()) {
        skip++;
        history.back();
      }
    };
  }, []);
  return createPortal(
    <div ref={root} class="inv-layer" role="dialog" aria-modal="true" aria-label="Inventory" data-testid="inventory-layer">
      <ShopScreen initial={initial} onBack={() => closeRef.current()} />
    </div>,
    document.body,
  );
}
