import { useEffect, useRef, useState } from "preact/hooks";
import { play } from "../sound.ts";

export { unlockAudio } from "../sound.ts";

/** Seconds at which every timer starts ticking. */
export const TICK_FROM_SECONDS = 10;
/** The big 3-2-1 on the board. */
export const COUNT_FROM_SECONDS = 3;

/** The time, refreshed every animation frame (for smooth bars). */
export function useFrameNow(active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

/** Plays one clock tick per whole second while `secs` is between 1 and `from`. */
export function useTicks(secs: number, from = TICK_FROM_SECONDS, active = true) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!active || secs <= 0 || secs > from || last.current === secs) return;
    last.current = secs;
    play("tick");
  }, [secs, active]);
}

/**
 * The move clock as a thin bar snug to the top edge of the board: full when
 * the clock starts, shrinking right to left to nothing at the deadline. It
 * turns red, and ticks every second, for the last 10 seconds.
 */
export function TimerBar({ startsAt, deadline, total }: { startsAt: number; deadline: number; total: number }) {
  const now = useFrameNow();
  const left = Math.max(0, deadline - Math.max(now, startsAt));
  const secs = Math.ceil(left / 1000);
  const low = left <= TICK_FROM_SECONDS * 1000;
  useTicks(secs, TICK_FROM_SECONDS, now >= startsAt);
  return (
    <div class={`timer-bar${low ? " low" : ""}`} role="timer" aria-label={`${secs} seconds left`}>
      <div class="timer-fill" style={{ width: `${total > 0 ? Math.min(100, (100 * left) / total) : 0}%` }} />
    </div>
  );
}

/**
 * The same overlay for the start and the end of a round: a "Round start" or
 * "Round end" banner in one place, and a big 3, 2, 1 in the middle of the
 * board that grows, shrinks and fades. `n` is null while only the banner shows.
 */
export function CenterCount({ label, n }: { label: string; n: number | null }) {
  return (
    <div class="center-count" role="status" aria-live="polite">
      <div class="cc-banner">{label}</div>
      {n !== null && n > 0 && (
        <div class="cc-num" key={n}>
          {n}
        </div>
      )}
    </div>
  );
}
