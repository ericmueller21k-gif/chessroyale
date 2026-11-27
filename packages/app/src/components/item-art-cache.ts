import { LOCKER_ART } from "@chessroyale/core";

/**
 * Item drawings made once a session (Eric, Nov 27: the locker "lags for a sec"; docs/decisions/2026-11-27-locker-speed.md). An admin's
 * locker is about 80 drawings and 7,000 svg parts: building them part by part each time the Locker opened was the lag. Each drawing,
 * once drawn, is kept here as its markup (memory only: a closed tab starts over), and a locker cell that finds its drawing here sets
 * it in one go, about three times faster. Ids: every id the drawing defines, and every `url(#…)` or `href="#…"` that points at one,
 * is kept marked, and each copy set on screen gets a prefix of its own, so two copies never share an id.
 */

const kept = new Map<string, string>();
let copies = 0;

/** A drawing's key: the item, its colors, its blemish and seed, and the side it's drawn for. */
export const artKey = (def: string, f: { color: string; color2?: string | null; blemish: number; seed: number }, side: "w" | "b") =>
  `${def}|${f.color}|${f.color2 ?? ""}|${f.blemish}|${f.seed}|${side}`;

/** Keeps a drawing (the markup inside its svg), oldest first out past LOCKER_ART.keep. */
export function keepArt(key: string, markup: string): void {
  if (kept.has(key) || !markup) return;
  const own = new Set(Array.from(markup.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
  kept.set(key, markup.replace(/(\sid="|url\(#|url\(&quot;#|href="#)([^"&)]+)/g, (all, at: string, id: string) => (own.has(id) ? `${at}§${id}` : all)));
  if (kept.size > LOCKER_ART.keep) kept.delete(kept.keys().next().value!);
}

/** Whether a drawing is kept. */
export const artKept = (key: string) => kept.has(key);

/** A kept drawing's markup with ids of its own (undefined: not kept). */
export function keptArt(key: string): string | undefined {
  const m = kept.get(key);
  return m === undefined ? undefined : m.replaceAll("§", `ik${++copies}_`);
}

/** How many drawings are kept (tests). */
export const keptCount = () => kept.size;

// ---------------- Idle time ----------------

type Deadline = { timeRemaining(): number };
const idle = (fn: (d: Deadline) => void): void => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: LOCKER_ART.idleWaitMs });
  // (Safari has none: a beat later, with a slice's worth of time.)
  else
    setTimeout(() => {
      const end = performance.now() + 8;
      fn({ timeRemaining: () => Math.max(0, end - performance.now()) });
    }, 30);
};
const phone = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * Runs `step` in the page's idle time, a slice at a time (LOCKER_ART.slicePhone or sliceComputer steps at most, stopping with under
 * sliceLeftMs of the slice left), until it answers false, `go()` answers false, or the answer's stop is called.
 */
export function inIdle(step: () => boolean, go: () => boolean = () => true): () => void {
  let stopped = false;
  const slice = (d: Deadline) => {
    if (stopped || !go()) return;
    const most = phone() ? LOCKER_ART.slicePhone : LOCKER_ART.sliceComputer;
    for (let n = 0; n < most; n++) {
      if (!step()) return;
      if (stopped || d.timeRemaining() < LOCKER_ART.sliceLeftMs) break;
    }
    idle(slice);
  };
  idle(slice);
  return () => void (stopped = true);
}

// ---------------- The locker's cells: those in view first, the rest a slice a frame ----------------

const waiting: (() => void)[] = [];
let dripping = false;

/** One slice of the waiting cells, just after a frame is painted (the locker is the screen in use, so it doesn't wait for idle time). */
function drip() {
  requestAnimationFrame(() =>
    setTimeout(() => {
      const most = phone() ? LOCKER_ART.slicePhone : LOCKER_ART.sliceComputer;
      for (let n = 0; n < most && waiting.length; n++) waiting.shift()!();
      if (waiting.length) drip();
      else dripping = false;
    }),
  );
}

/** Asks for `draw` to be called a slice a frame after the next paint, in the order asked (a cell's drawing). Answers a cancel. */
export function drawLater(draw: () => void): () => void {
  waiting.push(draw);
  if (!dripping) {
    dripping = true;
    drip();
  }
  return () => {
    const i = waiting.indexOf(draw);
    if (i >= 0) waiting.splice(i, 1);
  };
}

/** Whether a device should warm drawings ahead at all: not with little memory or when it asks to save data. */
export function warmsAhead(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return !(nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory <= LOCKER_ART.warmMinMemoryGb));
}
