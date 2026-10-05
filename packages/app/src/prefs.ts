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
