import { memo } from "preact/compat";
import { RECLUSE_PHASE2 } from "@chessroyale/core";
import { slashLook, type SlashLook } from "../recluse-phase2.ts";
import type { SimulBoardView } from "../game.ts";

/**
 * The Hidden Boss's phase 2 hearts (Eric, Nov 16: each player's own, "you can line up one like the same size"): a column of
 * RECLUSE_PHASE2.hearts classic pixel hearts at the right of each board, each one of that board's squares tall (the big board's at its
 * size, a small board's at its own), cut from the top. A heart cut plays his slash on it (slashLook: a slow wind-up, a fast stroke
 * across, the halves sliding apart and fading; no flash), drawn from the time since the cut, so a board drawn again mid-cut carries
 * on where it was. Its slot then shows the empty heart: the column keeps its size and place.
 */

/** A classic pixel heart, 9 x 8: its outline (O), red (R), shine (H), shaded edge (D). */
const HEART = [".OO...OO.", "OHRO.ORRO", "OHRRORRRO", "ORRRRRRDO", ".ORRRRDO.", "..ORRDO..", "...ODO...", "....O...."];
const path = (chars: string) => HEART.flatMap((row, y) => [...row].map((c, x) => (chars.includes(c) ? `M${x} ${y}h1v1h-1z` : ""))).join("");
const PATHS = { o: path("O"), r: path("R"), h: path("H"), d: path("D"), fill: path("RHD") };

/** One heart, full or the empty slot a cut one leaves (drawn once: memo). */
const HeartArt = memo(function HeartArt({ empty }: { empty?: boolean }) {
  return (
    <svg viewBox="0 -0.5 9 9" shape-rendering="crispEdges" aria-hidden="true">
      {empty ? (
        <>
          <path class="rc-h-hole" d={PATHS.fill} />
          <path class="rc-h-rim" d={PATHS.o} />
        </>
      ) : (
        <>
          <path class="rc-h-o" d={PATHS.o} />
          <path class="rc-h-r" d={PATHS.r} />
          <path class="rc-h-d" d={PATHS.d} />
          <path class="rc-h-h" d={PATHS.h} />
        </>
      )}
    </svg>
  );
});

/** The cut over a heart's slot: the two halves of the heart (along the line from its top-right corner), his blade's glint and stroke. */
function Cut({ look }: { look: SlashLook }) {
  const half = (h: SlashLook["a"], cls: "a" | "b") => (
    <span class={`rc-hhalf ${cls}`} style={{ translate: `${h.x * 100}% ${h.y * 100}%`, rotate: `${h.r}deg`, opacity: h.o }}>
      <HeartArt />
    </span>
  );
  return (
    <span class="rc-hcut" aria-hidden="true">
      {half(look.a, "a")}
      {half(look.b, "b")}
      {look.glint && <span class="rc-hglint" style={{ left: `${look.glint.x * 100}%`, top: `${look.glint.y * 100}%`, opacity: look.glint.o, scale: `${look.glint.s}` }} />}
      {look.blade && (
        <span class="rc-hblade" style={{ opacity: look.blade.o }}>
          <i style={{ scale: `${look.blade.len} 1` }} />
        </span>
      )}
    </span>
  );
}

/** A board's column of hearts (`now`: the screen's frame time; the cut in progress drawn from it). */
export function Hearts({ b, now }: { b: Pick<SimulBoardView, "hearts" | "slashAt">; now: number }) {
  const n = RECLUSE_PHASE2.hearts;
  const lost = Math.max(0, n - b.hearts);
  const t = b.slashAt === null ? Infinity : now - b.slashAt;
  // (The heart being cut: the last one lost, while its cut plays.)
  const look = t >= 0 && t < RECLUSE_PHASE2.slash.ms && lost > 0 ? slashLook(t) : null;
  return (
    <span class="rc-hearts" role="img" aria-label={`Hearts: ${b.hearts} of ${n}`} data-hearts={b.hearts} style={{ "--rc-hearts": n }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} class={`rc-heart${i >= lost ? " full" : ""}`}>
          <HeartArt empty={i < lost} />
          {look && i === lost - 1 && <Cut look={look} />}
        </span>
      ))}
    </span>
  );
}

/** A board lost to its last heart: how grey it is now, and its word's opacity (slashLook), or null: not that kind of loss. */
export function wastedLook(b: Pick<SimulBoardView, "result" | "slashAt">, now: number): { grey: number; word: number } | null {
  if (b.result?.how !== "slow" || b.slashAt === null) return null;
  const l = slashLook(Math.max(0, now - b.slashAt));
  return { grey: l.grey, word: l.word };
}

/** The word over a board lost to its last heart (Eric, Nov 16: a "wasted" style fade to grey, a clean word over it). */
export const TOO_SLOW_WORD = "TOO SLOW";
