import { useEffect, useState } from "preact/hooks";

/** The count last shown, kept across rounds so newly earned power-ups light up with a flash. */
let lastShown: number | null = null;

/** The power-up's lightning bolt. */
export const Bolt = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2L13.5 2Z" />
  </svg>
);

/**
 * A row of small round slots, one per power-up you could hold (5): lit ones
 * you have, grey ones missing or used. Tap a lit one to use a power-up on
 * this move; a grey one just gives a little shake. Newly earned ones flash as
 * they light up. In practice mode every slot is lit and never runs out.
 */
export function PowerUps({
  count,
  max,
  used,
  disabled = false,
  onUse,
}: {
  count: number;
  max: number;
  used: boolean;
  disabled?: boolean;
  onUse: () => void;
}) {
  const unlimited = count === Infinity;
  const held = unlimited ? max : count;
  const [shown, setShown] = useState(unlimited ? max : (lastShown ?? held));
  const [fresh, setFresh] = useState<number[]>([]);
  const [shake, setShake] = useState<{ i: number; n: number } | null>(null);
  useEffect(() => {
    const from = lastShown ?? 0;
    lastShown = held;
    if (unlimited || held <= from) return setShown(held);
    // Light the new ones one after another, flashing.
    const added = Array.from({ length: held - from }, (_, k) => from + k);
    setFresh(added);
    setShown(held);
    const t = setTimeout(() => setFresh([]), 2000);
    return () => clearTimeout(t);
  }, [held]);
  const slots = Math.max(max, shown);
  // The one in use this move is the last lit slot, shown as an outlined ring.
  const lit = used ? shown + 1 : shown;
  return (
    <div class="pu-row" role="group" aria-label={`Power-ups: ${unlimited ? "unlimited" : shown} of ${max}`}>
      {Array.from({ length: slots }, (_, i) => {
        const on = i < lit;
        const active = used && i === lit - 1;
        const usable = on && !active && !used && !disabled;
        return (
          <button
            type="button"
            key={i}
            class={`pu-dot${on ? " on" : ""}${active ? " active" : ""}${fresh.includes(i) ? " fresh" : ""}${shake?.i === i ? " shake" : ""}`}
            style={fresh.includes(i) ? { animationDelay: `${fresh.indexOf(i) * 0.25}s` } : undefined}
            aria-label={active ? "Power-up in use: the engine's top 3 moves" : usable ? "Use a power-up: show the engine's top 3 moves" : on ? "Power-up" : "Empty power-up slot"}
            onClick={() => {
              if (usable) return onUse();
              setShake((s) => ({ i, n: (s?.n ?? 0) + 1 }));
              setTimeout(() => setShake((s) => (s?.i === i ? null : s)), 450);
            }}
          >
            <Bolt />
          </button>
        );
      })}
      {unlimited && <span class="pu-inf">∞</span>}
    </div>
  );
}
