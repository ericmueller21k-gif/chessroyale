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
 * the clock starts, shrinking from both ends towards the middle until it's
 * gone at the deadline, and fading from dark green through yellow to red as time
 * runs out. It ticks every second for the last 10 seconds.
 */
export function TimerBar({ startsAt, deadline, total }: { startsAt: number; deadline: number; total: number }) {
  const now = useFrameNow();
  const left = Math.max(0, deadline - Math.max(now, startsAt));
  const secs = Math.ceil(left / 1000);
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  useTicks(secs, TICK_FROM_SECONDS, now >= startsAt);
  // Dark green (hue 135) at full time down to red (hue 0) at none.
  const color = `hsl(${Math.round(135 * frac)} 70% ${Math.round(42 - 6 * frac)}%)`;
  return (
    <div class="timer-bar" role="timer" aria-label={`${secs} seconds left`}>
      <div class="timer-fill" style={{ width: `${frac * 100}%`, background: color }} />
    </div>
  );
}

/**
 * The same overlay for the start and the end of a round: a "Round start" or
 * "Round end" banner in one place, and a big 3, 2, 1 in the middle of the
 * board that grows, shrinks and fades. `n` is null while only the banner shows.
 */
export function CenterCount({ label, n, note }: { label: string; n: number | null; note?: string | null }) {
  return (
    <div class="center-count" role="status" aria-live="polite">
      <div class="cc-banner">{label}</div>
      {note && <div class="cc-note">{note}</div>}
      {n !== null && n > 0 && (
        <div class="cc-num" key={n}>
          {n}
        </div>
      )}
    </div>
  );
}
