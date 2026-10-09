/**
 * Fair play's one signal from the device: how many times the page was hidden or lost focus during a move's clock,
 * before the pick (someone switching to a chess engine on the same phone). Weak on its own: the server only weighs it
 * next to the moves themselves (core/fairplay.ts). Counted as episodes: a blur and a hide together are one look-away.
 */
export class LookAways {
  private count = 0;
  private away = false;
  private on = false;

  constructor() {
    if (typeof window === "undefined") return;
    const leave = () => {
      if (!this.on || this.away) return;
      this.away = true;
      this.count++;
    };
    const back = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) this.away = false;
    };
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? leave() : back()));
  }

  /** A move's clock starts: count from zero. */
  start() {
    this.count = 0;
    this.on = true;
    this.away = typeof document !== "undefined" && (document.visibilityState === "hidden" || !document.hasFocus());
  }

  /** How many look-aways so far, counting on (a move attempt into Hollow's dark: it may or may not be the pick). */
  peek(): number {
    return this.count;
  }

  /** The pick (or the end of the move): how many look-aways there were, and stop counting. */
  stop(): number {
    this.on = false;
    return this.count;
  }
}
