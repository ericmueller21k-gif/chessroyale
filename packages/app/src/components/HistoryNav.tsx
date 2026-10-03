import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { START_FEN, fenAfter } from "@chessroyale/chess";

/**
 * Stepping back and forth through a board's game. `ply` is null while showing
 * the live position; otherwise the position after that many moves.
 */
export function useHistoryView(history: readonly string[]) {
  const [ply, setPly] = useState<number | null>(null);
  const live = history.length;
  const at = ply ?? live;
  const go = (p: number) => setPly(p >= live ? null : Math.max(0, p));
  useEffect(() => {
    // Desktop: arrow keys step through the game.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(at - 1);
      else if (e.key === "ArrowRight") go(at + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, live]);
  return {
    browsing: ply !== null,
    ply: at,
    fen: ply === null ? null : ply === 0 ? START_FEN : fenAfter(history.slice(0, ply)),
    lastMove: ply === null ? null : (history[ply - 1] ?? null),
    go,
    live: () => setPly(null),
  };
}

const Chevrons = ({ back }: { back?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={back ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M6 6l6 6-6 6" />
    <path d="M12 6l6 6-6 6" />
  </svg>
);

/**
 * The line of controls under the board: back on the left, forward on the
 * right (double chevrons in soft rounded boxes), and between them `clock`
 * (hidden while looking back, when "Move 14 · back to live" shows instead;
 * tap it to return) and `extra` (the power-up).
 */
export function HistoryNav({
  view,
  total,
  clock,
  extra,
}: {
  view: ReturnType<typeof useHistoryView>;
  total: number;
  clock?: ComponentChildren;
  extra?: ComponentChildren;
}) {
  const moveNo = (p: number) => `${Math.ceil(p / 2)}${p % 2 === 1 ? "" : "…"}`;
  return (
    <div class={`history-nav ${view.browsing ? "browsing" : ""}`}>
      <button type="button" class="nav-btn" aria-label="Previous move" disabled={view.ply === 0} onClick={() => view.go(view.ply - 1)}>
        <Chevrons back />
      </button>
      <div class="nav-middle">
        {view.browsing ? (
          <button type="button" class="history-label" onClick={() => view.live()} aria-label="Back to the live position">
            Move {moveNo(view.ply)} · {view.ply}/{total} · back to live
          </button>
        ) : (
          clock && <span class="history-label">{clock}</span>
        )}
        {extra}
      </div>
      <button type="button" class="nav-btn" aria-label="Next move" disabled={!view.browsing} onClick={() => view.go(view.ply + 1)}>
        <Chevrons />
      </button>
    </div>
  );
}
