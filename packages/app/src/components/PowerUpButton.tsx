import { useEffect, useState } from "preact/hooks";

/** The count last shown, kept across rounds so a newly earned power-up flashes. */
let lastShown: number | null = null;

/**
 * One round button with a lightning bolt and "x1" above it: lit when you
 * have a power-up to use, greyed out when you don't. When you earn one it
 * flashes a few times as the count goes up.
 */
export function PowerUpButton({ count, used, disabled = false, onUse }: { count: number; used: boolean; disabled?: boolean; onUse: () => void }) {
  const [shown, setShown] = useState(lastShown ?? count);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    const gained = lastShown !== null && count > lastShown && count !== Infinity;
    const first = lastShown === null && count > 0;
    lastShown = count;
    if (!gained && !first) return setShown(count);
    setFlashing(true);
    // The number ticks over partway through the flashing.
    const a = setTimeout(() => setShown(count), 500);
    const b = setTimeout(() => setFlashing(false), 1800);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [count]);
  const label = count === Infinity ? "∞" : `x${shown}`;
  const ready = !used && !disabled && count > 0;
  return (
    <button
      type="button"
      class={`pu-btn${ready ? " ready" : ""}${used ? " used" : ""}${flashing ? " flashing" : ""}`}
      disabled={!ready}
      onClick={onUse}
      aria-label={used ? "Power-up in use: the engine's top 3 moves" : `Use a power-up (${count === Infinity ? "unlimited" : count} available): show the engine's top 3 moves`}
    >
      <span class="pu-count">{label}</span>
      <span class="pu-ring" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2L13.5 2Z" />
        </svg>
      </span>
    </button>
  );
}
