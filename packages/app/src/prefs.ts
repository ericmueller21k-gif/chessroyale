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

const CHAT_OFF_KEY = "brc.chatOff";
const CHAT_BUBBLES_KEY = "brc.chatBubbles";
const UNDER_BOARD_KEY = "brc.underBoard";

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

/** Phone: the space under the board, scoreboard and chat side by side (split) or one of them full width. */
export type UnderBoardMode = "split" | "board" | "chat";

export function underBoardMode(): UnderBoardMode {
  try {
    const v = localStorage.getItem(UNDER_BOARD_KEY);
    return v === "board" || v === "chat" ? v : "split";
  } catch {
    return "split";
  }
}

export function setUnderBoardMode(mode: UnderBoardMode) {
  try {
    localStorage.setItem(UNDER_BOARD_KEY, mode);
  } catch {
    // Not important.
  }
  listeners.forEach((l) => l());
}
