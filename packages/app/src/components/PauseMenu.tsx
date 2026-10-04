import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

/**
 * A game-style pause menu: the screen dims and a pixel window sits over the
 * board with a title, a note and a list of choices (▶ marks the one you
 * point at). Tapping outside closes it. Not used yet; built for the God King
 * before his commands moved above his head, and kept for menus to come.
 */
export function PauseMenu({
  title,
  note,
  items,
  onClose,
}: {
  title: string;
  note?: ComponentChildren;
  items: { label: string; sub?: string; disabled?: boolean; back?: boolean; onPick: () => void }[];
  onClose: () => void;
}) {
  // Centred on the board, wherever it sits on the screen.
  const [top] = useState(() => {
    const r = document.querySelector(".board-wrap")?.getBoundingClientRect();
    return r ? r.top + r.height / 2 : window.innerHeight / 2;
  });
  return (
    <div class="gk-menu-backdrop" onClick={onClose}>
      <div class="gk-menu" role="dialog" aria-label={title} style={{ top: `${top}px` }} onClick={(e) => e.stopPropagation()}>
        <div class="gk-menu-title">{title}</div>
        {note && <div class="gk-menu-note">{note}</div>}
        {items.map((it) => (
          <button type="button" key={it.label} class={`gk-menu-item${it.back ? " back" : ""}`} disabled={it.disabled} onClick={it.onPick}>
            {it.label}
            {it.sub && <small>{it.sub}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
