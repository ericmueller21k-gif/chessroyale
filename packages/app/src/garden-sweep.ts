/**
 * Where the hippo gardener's sweep is across the board, and when (docs/decisions/2026-10-23-gardener-wired.md): each seed's square sprouts as
 * the spray's front reaches it. Pure, so a test (and the e2e) can read it.
 */
import { SWEEP_MS } from "./characters/effects/gardener.ts";

/**
 * The spray's front across the board in the art (characters/effects/gardener.ts, `WATER_SWEEP`): the front is at x `front0 + step * i` (of the
 * board's 256 px) in frame i (`frameMs` each), and the lower rows lead by `lean` px a row. A test measures the sprite against these.
 * He casts at the board's left (its top-left corner), the sweep as drawn comes in from the left edge: it needs no flip for his side.
 */
export const SWEEP = { frameMs: 60, front0: -24, step: 50, lean: 0.35, board: 256 } as const;

/** When the spray's front reaches a square's middle, ms after the sweep starts (0 to SWEEP_MS): where it sprouts. */
export function frontMs(square: string, orientation: "white" | "black"): number {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  const front = (col + 0.5) * 32 - SWEEP.lean * ((row + 0.5) * 32 - SWEEP.board / 2);
  return Math.max(0, Math.min(SWEEP_MS, Math.round(((front - SWEEP.front0) / SWEEP.step) * SWEEP.frameMs)));
}
