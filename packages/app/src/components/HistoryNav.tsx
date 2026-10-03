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

/**
 * ◀ and ▶ either side of the board's foot. The middle shows `children` (the
 * move clock) on the live position, or which move you're looking at; tap it
 * then to jump back to the live position.
 */
export function HistoryNav({ view, total, children }: { view: ReturnType<typeof useHistoryView>; total: number; children?: ComponentChildren }) {
  const moveNo = (p: number) => `${Math.ceil(p / 2)}${p % 2 === 1 ? "" : "…"}`;
  return (
    <div class={`history-nav ${view.browsing ? "browsing" : ""}`}>
      <button type="button" aria-label="Previous move" disabled={view.ply === 0} onClick={() => view.go(view.ply - 1)}>
        ◀
      </button>
      {view.browsing ? (
        <button type="button" class="history-label" onClick={() => view.live()} aria-label="Back to the live position">
          Move {moveNo(view.ply)} · {view.ply}/{total} · back to live
        </button>
      ) : (
        <span class="history-label">{children}</span>
      )}
      <button type="button" aria-label="Next move" disabled={!view.browsing} onClick={() => view.go(view.ply + 1)}>
        ▶
      </button>
    </div>
  );
}
