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
