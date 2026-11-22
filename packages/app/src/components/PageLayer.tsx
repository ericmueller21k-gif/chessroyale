import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef } from "preact/hooks";
import { ShopScreen } from "../screens/Shop.tsx";
import { play } from "../sound.ts";

/**
 * A page as a layer (Nov 22): a page's own screen over whatever you're on, so nothing underneath unmounts (a Battle Tower run, a party,
 * the town stay as they were). Two uses:
 * - **Your inventory** (`InventoryLayer`; Eric: "How do we make it so people don't have to like leave the town if they want to go to their
 *   inventory?"): the shop screen's own tabs (`ShopScreen`, not a copy) in the shop page's own frame (Eric: "it should still look the
 *   same, like when you go to your inventory from the main menu"), opaque, the whole window, over anything.
 * - **Chess Town on a computer** (App.tsx `townLayer`; Eric: "you should be able to just click play with friends, daily quests, shop in
 *   crates, and profile without exiting out of Chesttown"): the side menu's page in the town's middle column only (`inColumn`), so the
 *   side menu and the right column (the town's tools, the chat) stay as they are and usable.
 * Its Back, Escape and the phone's or browser's back gesture close it (one step pushed in the history; back takes it, the page never
 * navigates). Nothing under it hears a key or a tap (but typing in the right column's chat, as without it). Its opener owns it: when the
 * screen underneath moves on (a party's floor, a match starting, the town left), the layer goes with it.
 * docs/decisions/2026-11-22-inventory-layer.md, 2026-11-22-town-desktop-layers.md.
 */

/** The layer's history step: the state it pushes carries this (and whatever the step under it carried: the town's `townStep`). */
const STEP = "pageLayer";
/** Pops of our own step to let pass (a close by Back or Escape, or the layer going with its screen, goes back itself). */
let skip = 0;
/** The open layer's close, for the back gesture. */
let active: (() => void) | null = null;

/**
 * The app's popstate (App.tsx) asks this first: true when the pop was the layer's (the back gesture closing it, or the layer's own
 * `history.back()`), so nothing else acts on it.
 */
export function layerTakesPop(): boolean {
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
/** A key for typing (a field, a text box): its own, wherever it is. */
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || !!t.closest('[role="textbox"]'));

export function PageLayer({ label, testid, inColumn = false, see = false, onClose, children }: {
  label: string;
  testid: string;
  /** The town's middle column only (the frame's sides stay usable), not the whole window. */
  inColumn?: boolean;
  /** No background of its own: a pop-up's card (Daily Quests, Play with friends) over its own dimmed back, the town under it. */
  see?: boolean;
  onClose: () => void;
  children: ComponentChildren;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // (A layout effect, as every pop-up's: its key guard and its step are there in the commit that shows it. LESSONS.md, Nov 11.)
  useLayoutEffect(() => {
    history.pushState({ ...((history.state as object | null) ?? {}), [STEP]: true }, "", location.href);
    const mine = () => closeRef.current();
    active = mine;
    const el = root.current;
    if (el && !el.contains(document.activeElement)) (el.querySelector<HTMLElement>(".fd-back") ?? el).focus({ preventScroll: true });
    // (Before anything else hears it: no key reaches the screen under it (the town's walk, a match's history arrows, their Escapes). A
    // pop-up inside it (the locker's delete, the gambling warning, the shop's note, the quests, Play with friends) takes its own Escape,
    // in the capture phase too. Typing goes to its field: in the layer, or the right column's chat beside it.)
    const keys = (e: KeyboardEvent) => {
      const inside = e.target instanceof Node && !!root.current?.contains(e.target);
      // (A pop-up over it, outside it (the town's "Leave Chess Town?", asked from a page in it): its keys are its own.)
      const over = !inside && e.target instanceof Element && e.target.closest('[role="dialog"], [role="alertdialog"]');
      if (over || (!inside && typing(e.target))) return;
      if (e.key === "Escape") {
        if (root.current?.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        play("menuClose");
        closeRef.current();
        return;
      }
      if (!typing(e.target)) e.stopImmediatePropagation();
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
  const layer = (
    <div
      ref={root}
      tabIndex={-1}
      class={`page-layer${inColumn ? " in-column" : ""}${see ? " see" : ""}`}
      role="dialog"
      aria-modal={inColumn ? undefined : "true"}
      aria-label={label}
      data-testid={testid}
      // (A see-through layer's card not there yet (Daily Quests reading its answer): a tap on it closes it, as a tap outside a card.)
      onClick={see ? (e) => e.target === e.currentTarget && closeRef.current() : undefined}
    >
      {children}
    </div>
  );
  // (The whole window: on the body, over anything. In the column: where it's drawn, in the town's frame, whose sizes it reads.)
  return inColumn ? layer : createPortal(layer, document.body);
}

/** Your inventory as a layer: the shop screen in the shop page's own frame, over whatever you're on (RewardBox's "Go to inventory"). */
export function InventoryLayer({ onClose, initial = "crates" }: { onClose: () => void; initial?: "crates" | "locker" }) {
  return (
    <PageLayer label="Inventory" testid="inventory-layer" onClose={onClose}>
      {/* (The shop page's own frame (App.tsx's FrontFrame page="shop"), so it looks the same as from the main menu (Eric, Nov 22: "I
          don't want it to look like it's just some pop-up"): its font, colors and column. No side menu: its links would leave.) */}
      <div class="fd-root framed fd-on-shop">
        <main class="fd-center">
          <ShopScreen initial={initial} onBack={onClose} />
        </main>
      </div>
    </PageLayer>
  );
}
