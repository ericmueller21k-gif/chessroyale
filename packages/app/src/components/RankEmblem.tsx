import type { RankView } from "@chessroyale/core";
import { EMBLEMS, EMBLEM_SHEET, EMBLEM_SIZE } from "../emblems/rank-emblems.ts";
import sheetUrl from "../emblems/rank-emblems.png?url";

/**
 * A 1 v 1 rank's emblem, a rank's or one by its id (Eric's set, Oct 28: packages/app/src/characters/rank-set.ts, baked by
 * scripts/bake-emblems.ts into one picture): a cut of the sheet, `scale` whole steps of its 48 × 48 pixels, smoothing off. Pearlescent's and
 * Transcendent's 2 s loops step along their row (CSS, a transform: no script and no redraw per frame); under reduced
 * motion they hold their first frame.
 *
 * The box is always its full size, with or without an emblem (placements, a bot) and before the picture loads, so
 * nothing moves when one arrives (docs/rules/eric.md, "Nothing hidden, nothing shifts").
 */
export function RankEmblem({ rank, id = rank?.emblem, scale = 1, class: cls = "" }: { rank?: RankView | null; id?: string | null; scale?: 1 | 2 | 3; class?: string }) {
  const cell = id ? EMBLEMS[id] : undefined;
  const size = EMBLEM_SIZE * scale;
  return (
    <span class={`re-box ${cls}`} style={{ width: `${size}px`, height: `${size}px` }} data-emblem={cell ? id! : undefined} aria-hidden="true">
      {cell && (
        <span
          class={`re-art${cell.frames > 1 ? " re-loop" : ""}`}
          style={{
            width: `${size * cell.frames}px`,
            height: `${size}px`,
            backgroundImage: `url(${sheetUrl})`,
            backgroundSize: `${EMBLEM_SHEET.w * scale}px ${EMBLEM_SHEET.h * scale}px`,
            backgroundPosition: `${-cell.x * scale}px ${-cell.y * scale}px`,
            ...(cell.frames > 1 ? { "--re-steps": cell.frames, "--re-ms": `${cell.frames * cell.ms}ms` } : {}),
          }}
        />
      )}
    </span>
  );
}
