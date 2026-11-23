/**
 * Birdie's music in his battle (Eric, Nov 23, via the music helper; BIRDIE_ULT in settings.ts; docs/decisions/2026-11-23-birdie-ult-timing.md),
 * for App.tsx's musicBattle. Its own small module: App's bundle reads it, never his screens'.
 * - Until his fall: his theme (`birdie`), his ult's piece decoded meanwhile (`next`), so it's ready the moment it's due.
 * - From his fall's moment on: `birdie-ult`, its drop (`dropAt`) on his train's impact (BirdieView.turnAt's `dropAt`: the lobby's or solo's,
 *   on this device's clock): the piece starts BIRDIE_ULT.introMs before it (music.ts, switchPlan), his theme from its top on the drop, then
 *   looping for the rest of the battle. A battle joined after his fall (or no drop sent): `dropAt` 0, long past, so his theme's loop
 *   alone, never the piece again.
 */
import { BIRDIE_ULT } from "@chessroyale/core";
import type { BossView } from "./game.ts";

export function birdieMusic(boss: Pick<BossView, "id" | "powers">): { theme: string; dropAt?: number; next?: string } | null {
  if (boss.id !== "birdie") return null;
  const bd = boss.powers?.birdie;
  if (bd?.fell == null) return { theme: "birdie", next: BIRDIE_ULT.theme };
  return { theme: BIRDIE_ULT.theme, dropAt: bd.turnAt?.turn === boss.powers!.turn ? (bd.turnAt.dropAt ?? 0) : 0 };
}
