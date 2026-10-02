import { useEffect, useState } from "preact/hooks";
import { gameEnd, sideToMove } from "@chessroyale/chess";
import { enginePool } from "../engine.ts";

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
  const [white, setWhite] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const end = gameEnd(fen, []);
    if (end === "checkmate") {
      setWhite(sideToMove(fen) === "w" ? 0 : 1);
      return;
    }
    if (end) {
      setWhite(0.5);
      return;
    }
    void (async () => {
      if (evaluate) {
        const w = await evaluate(fen);
        if (live && w !== null) setWhite(w);
        return;
      }
      const engines = await enginePool();
      // The last engine: the host's own duties use the first ones.
      const [best] = await engines[engines.length - 1]!.topMoves(fen, 1);
      if (live && best) setWhite(sideToMove(fen) === "w" ? best.expected : 1 - best.expected);
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
