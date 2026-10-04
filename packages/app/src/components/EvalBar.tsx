import { useEffect, useState } from "preact/hooks";
import { gameEnd, sideToMove } from "@chessroyale/chess";
import { enginePool } from "../engine.ts";

/**
 * What the bar last showed, and every position's value so far. A screen change
 * mounts a new bar: it starts from these instead of 50%, so the bar only moves
 * when the position on the board changes.
 */
let lastShown: number | null = null;
const known = new Map<string, number>();
const remember = (fen: string, w: number) => {
  if (known.size > 200) known.clear();
  known.set(fen, w);
};

/**
 * The evaluation bar: White's expected score in the position on screen, worked
 * out in this browser. `evaluate` lets a match reuse a search it already has.
 */
export function EvalBar({
  fen,
  orientation,
  evaluate,
}: {
  fen: string;
  orientation: "w" | "b";
  evaluate?: (fen: string) => Promise<number | null>;
}) {
  const [white, setWhite] = useState<number | null>(() => known.get(fen) ?? lastShown);

  useEffect(() => {
    let live = true;
    const show = (w: number) => {
      remember(fen, w);
      if (!live) return;
      lastShown = w;
      setWhite(w);
    };
    const end = gameEnd(fen, []);
    if (end === "checkmate") {
      show(sideToMove(fen) === "w" ? 0 : 1);
      return;
    }
    if (end) {
      show(0.5);
      return;
    }
    const seen = known.get(fen);
    if (seen !== undefined) {
      show(seen);
      return;
    }
    void (async () => {
      if (evaluate) {
        const w = await evaluate(fen);
        if (w !== null) show(w);
        return;
      }
      const engines = await enginePool();
      // The last engine: the host's own duties use the first ones.
      const [best] = await engines[engines.length - 1]!.topMoves(fen, 1);
      if (best) show(sideToMove(fen) === "w" ? best.expected : 1 - best.expected);
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [fen]);

  const w = white ?? 0.5;
  const label = white === null ? "…" : `${Math.round(w * 100)}%`;
  return (
    <div class={`eval-bar ${orientation === "b" ? "flipped" : ""}`} title="White's expected score">
      <div class="eval-white" style={{ height: `${w * 100}%` }} />
      <span class="eval-label">{label}</span>
    </div>
  );
}
