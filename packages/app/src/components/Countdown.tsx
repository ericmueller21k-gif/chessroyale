import { useEffect, useRef, useState } from "preact/hooks";

let audio: AudioContext | null = null;

/** Call from a tap so browsers allow sound later. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // No audio: the countdown still changes colour.
  }
}

function beep(high: boolean) {
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.frequency.value = high ? 880 : 660;
  g.gain.setValueAtTime(0.0001, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.15);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.16);
}

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
      beep(secs === 1);
    }
  }, [urgent, secs]);
  return (
    <div class={`countdown ${urgent ? "urgent" : ""}`} role="timer" aria-label={`${secs} seconds left`}>
      <div class="countdown-bar" style={{ width: `${(100 * left) / total}%` }} />
      <span class="countdown-secs">{secs}</span>
    </div>
  );
}
