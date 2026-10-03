import { useEffect, useRef, useState } from "preact/hooks";

/**
 * A number that counts to its new value (about 0.7 s) and flashes green when
 * it goes up or red when it goes down, so the scores feel live.
 * `goodWhenDown` flips the colours (e.g. a position number: lower is better).
 */
export function LiveNumber({
  value,
  format,
  class: cls = "",
  goodWhenDown = false,
}: {
  value: number;
  format: (x: number) => string;
  class?: string;
  goodWhenDown?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value || !Number.isFinite(from) || !Number.isFinite(value)) {
      setShown(value);
      return;
    }
    const better = goodWhenDown ? value < from : value > from;
    setFlash((f) => ({ dir: better ? "up" : "down", n: (f?.n ?? 0) + 1 }));
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(from + (value - from) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const off = setTimeout(() => setFlash(null), 1500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(off);
      setShown(value);
    };
  }, [value]);
  return (
    <span key={flash?.n ?? 0} class={`live-num${flash ? ` flash-${flash.dir}` : ""}${cls ? ` ${cls}` : ""}`}>
      {format(shown)}
    </span>
  );
}
