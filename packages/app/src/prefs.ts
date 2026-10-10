/** Small per-device preferences. */

const ANIM_KEY = "brc.crowdAnim";
const listeners = new Set<() => void>();

/** Crowd: animate every pick as a ghost piece (on) or just show name tags and move only the chosen piece (off). */
export function crowdAnimations(): boolean {
  const q = new URLSearchParams(location.search).get("anim");
  if (q !== null) return q !== "0";
  try {
    return localStorage.getItem(ANIM_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setCrowdAnimations(on: boolean) {
  try {
    localStorage.setItem(ANIM_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const TRAIL_KEY = "brc.crowdTrail";

/**
 * Crowd, with animations on: the motion trail. Every new pick flies from its piece's square to where it lands
 * (with a short trail), then hands over to the one fixed ghost on that square. Off: picks just pop in place.
 */
export function crowdTrail(): boolean {
  const q = new URLSearchParams(location.search).get("trail");
  if (q !== null) return q !== "0";
  try {
    return localStorage.getItem(TRAIL_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setCrowdTrail(on: boolean) {
  try {
    localStorage.setItem(TRAIL_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

const EVAL_BAR_KEY = "brc.evalBar";

/**
 * The eval bar (the engine's winning chances, left of the board): on unless switched off in Settings (remembered on
 * the device). Every screen that shows it reads this; off, the board takes its room.
 */
export function evalBarOn(): boolean {
  try {
    return localStorage.getItem(EVAL_BAR_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setEvalBarOn(on: boolean) {
  try {
    localStorage.setItem(EVAL_BAR_KEY, on ? "1" : "0");
  } catch {
    // Not important: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

const CHAT_OFF_KEY = "brc.chatOff";
const CHAT_BUBBLES_KEY = "brc.chatBubbles";

/** Quick chat off: nothing shows and nothing can be sent (remembered on the device). */
export function chatOff(): boolean {
  try {
    return localStorage.getItem(CHAT_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setChatOff(off: boolean) {
  try {
    localStorage.setItem(CHAT_OFF_KEY, off ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

/** Phone: the newest message's bubble under the top bar while chat is hidden (on unless switched off). */
export function chatBubbles(): boolean {
  try {
    return localStorage.getItem(CHAT_BUBBLES_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setChatBubbles(on: boolean) {
  try {
    localStorage.setItem(CHAT_BUBBLES_KEY, on ? "1" : "0");
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}

/**
 * Phone: the space under the board. One view, remembered on the device, so its buttons can never disagree:
 * - `layout`: the scoreboard and chat side by side (split), or one of them full width (board, chat);
 * - `open`: false folds it to just its header bar (the board takes the room).
 * Showing a layout (a panel full width, or side by side again) always opens it; folding keeps the layout.
 * Without chat (solo, Classic, or chat off) the scoreboard is alone, full width, whatever the layout says.
 */
export type UnderBoardLayout = "split" | "board" | "chat";
export interface UnderBoardView {
  layout: UnderBoardLayout;
  open: boolean;
}

const UNDER_BOARD_VIEW_KEY = "brc.underBoardView";
/** An older build's two settings, one per button (Oct 7, 2026): the layout, and the fold ("0": folded). */
const LEGACY_LAYOUT_KEY = "brc.underBoard";
const LEGACY_OPEN_KEY = "brc.miniTower";

const layoutOf = (v: unknown): UnderBoardLayout => (v === "board" || v === "chat" ? v : "split");
let view: UnderBoardView | null = null;

export function underBoardView(): UnderBoardView {
  if (view) return view;
  view = { layout: "split", open: true };
  try {
    const saved = localStorage.getItem(UNDER_BOARD_VIEW_KEY);
    if (saved) {
      const v = JSON.parse(saved) as Partial<UnderBoardView> | null;
      view = { layout: layoutOf(v?.layout), open: v?.open !== false };
    } else {
      // From an older build: its layout, and its fold, except that a full-width panel opens (folded, it could be
      // a full-height empty box, and in this view a full-width panel is always shown open).
      const layout = layoutOf(localStorage.getItem(LEGACY_LAYOUT_KEY));
      view = { layout, open: layout !== "split" || localStorage.getItem(LEGACY_OPEN_KEY) !== "0" };
      localStorage.setItem(UNDER_BOARD_VIEW_KEY, JSON.stringify(view));
      localStorage.removeItem(LEGACY_LAYOUT_KEY);
      localStorage.removeItem(LEGACY_OPEN_KEY);
    }
  } catch {
    // No storage: the default, kept in memory.
  }
  return view;
}

function saveUnderBoardView(next: UnderBoardView) {
  view = next;
  try {
    localStorage.setItem(UNDER_BOARD_VIEW_KEY, JSON.stringify(next));
  } catch {
    // Not important: it lasts until a reload.
  }
  listeners.forEach((l) => l());
}

/** A panel full width, or both side by side: always shown open (bigger means you see what's in it). */
export const showUnderBoard = (layout: UnderBoardLayout) => saveUnderBoardView({ layout, open: true });

/** Folds the space under the board to its header bar, or opens it again, keeping the layout. */
export const foldUnderBoard = (open: boolean) => saveUnderBoardView({ ...underBoardView(), open });
