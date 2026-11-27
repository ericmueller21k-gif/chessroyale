/**
 * The tests' hooks on `window` (`__townCam`, `__shopAt`, …): put on together, taken off together. Nov 27: each was put on by hand and
 * taken off by hand, and two a room set were never taken off (`__shopElves`, `__shopFlaps`): every hook holds its screen's closure, so
 * the last room, and through it the whole town with some 240 MB of its pictures, stayed in memory through every battle after it, and a
 * second town joined it once back (Eric's phone reloading itself after a Battle Tower floor). The function returned takes off each hook
 * that is still this one (a newer screen's own stays).
 */
export function setHooks(hooks: Record<string, unknown>): () => void {
  const w = window as unknown as Record<string, unknown>;
  Object.assign(w, hooks);
  return () => {
    for (const [k, v] of Object.entries(hooks)) if (w[k] === v) delete w[k];
  };
}
