import { useEffect, useRef, useState } from "preact/hooks";
import { play } from "../sound.ts";

export { unlockAudio } from "../sound.ts";

/** Shrinking bar and seconds left; the last 3 seconds turn red with a beep each second. */
export function Countdown({ deadline, total }: { deadline: number; total: number }) {
  const [now, setNow] = useState(Date.now());
  const lastBeep = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline]);
  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const urgent = left <= 3000;
  useEffect(() => {
    if (urgent && secs > 0 && lastBeep.current !== secs) {
      lastBeep.current = secs;
      play(secs === 1 ? "tickLast" : "tick");
    }
  }, [urgent, secs]);
  return (
    <div class={`countdown ${urgent ? "urgent" : ""}`} role="timer" aria-label={`${secs} seconds left`}>
      <div class="countdown-bar" style={{ width: `${(100 * left) / total}%` }} />
      <span class="countdown-secs">{secs}</span>
    </div>
  );
}
