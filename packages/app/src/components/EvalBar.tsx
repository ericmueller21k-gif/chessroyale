import { useEffect, useState } from "preact/hooks";
import { gameEnd, sideToMove } from "@chessroyale/chess";
import { enginePool } from "../engine.ts";
import { evalBarOn, onPrefsChange } from "../prefs.ts";

/**
 * What the bar last showed, and every position's value so far. A screen change
 * mounts a new bar: it starts from these instead of 50%, so the bar only moves
 * when the position on the board changes.
 */
let lastShown: number | null = null;
const known = new Map<string, number>();
/** White's expected score in a position the bar has already worked out, if it has. */
export function knownEval(fen: string): number | undefined {
  return known.get(fen);
}
const remember = (fen: string, w: number) => {
  if (known.size > 200) known.clear();
  known.set(fen, w);
};

/**
 * The evaluation bar: White's expected score in the position on screen, worked
 * out in this browser. `evaluate` lets a match reuse a search it already has.
 * `override` shows another value for a moment (White's expected score): the God
 * King's Last Stand plunges the bar to the crowd's chances after a blunder that
 * never stands on the board, and lets it go back as the piece slides back.
 *
 * A player can switch the bar off in Settings (prefs.ts, `evalBarOn`): then nothing shows and the board takes its room
 * (every screen's CSS narrows the board only for `.eval-bar ~ .board-wrap`). The value is still worked out, so what
 * reads it (`knownEval`: the God King's word on how it's going) is the same either way.
 */
export function EvalBar({
  fen,
  orientation,
  evaluate,
  override = null,
}: {
  fen: string;
  orientation: "w" | "b";
  evaluate?: (fen: string) => Promise<number | null>;
  override?: number | null;
}) {
  const [white, setWhite] = useState<number | null>(() => known.get(fen) ?? lastShown);
  const [on, setOn] = useState(evalBarOn);
  useEffect(() => onPrefsChange(() => setOn(evalBarOn())), []);

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

  if (!on) return null;
  const shown = override ?? white;
  const w = shown ?? 0.5;
  const label = shown === null ? "…" : `${Math.round(w * 100)}%`;
  return (
    <div class={`eval-bar ${orientation === "b" ? "flipped" : ""}${override !== null ? " plunged" : ""}`} title="White's expected score">
      <div class="eval-white" style={{ height: `${w * 100}%` }} />
      <span class="eval-label">{label}</span>
    </div>
  );
}
