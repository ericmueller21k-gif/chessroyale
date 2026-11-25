/**
 * A gold amount that floats up from a spot and fades, as in TFT (Eric, Oct 20: auto chess shows "+22" right above the square or
 * bench slot a piece was sold from; a pawn cashing in at the far end will use it too, "+5"). The spot is a square of the board
 * (place it in the board's overlay layer, `ac-layer`: its squares are eighths of `--board-size`, as the layer's other marks are)
 * or a slot of the bench (place it inside the bench row). It is one small box holding the number, and the rise and the fade are one
 * CSS animation on it: nothing runs per frame in script. The caller removes it after `FLOAT_MS`.
 */
export const FLOAT_MS = 1000;

export type FloatAt = { col: number; row: number } | { slot: number; of: number };

export function FloatGold({ amount, at }: { amount: number; at: FloatAt }) {
  const style: Record<string, number> = "slot" in at ? { "--slot": at.slot, "--slots": at.of } : { "--sq-x": at.col, "--sq-y": at.row };
  return (
    <span class={`ac-float ${"slot" in at ? "on-bench" : "on-board"}`} style={style} data-amount={amount} aria-hidden="true">
      <b>+{amount}</b>
    </span>
  );
}
