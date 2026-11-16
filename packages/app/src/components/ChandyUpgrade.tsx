/**
 * Chandy's upgrade window (Eric, Nov 15: "it would go in the middle of the board... it would pause the game for a second, and then it
 * shows his gun... it'll say like, you know, upgrade"; Nov 16: 2 s, everything paused): the God King's command-window look
 * (`.gk-command`'s blue, its white border and pixel font), front and center over the board. The rifle at its new stage, 2.5x; the new
 * part (the pixels that differ from the stage before) slides down onto it and snaps with a flash; "UPGRADE!", the part's name and
 * "n/5", and the move it unlocked. Art only: his rules show it (the parent places it over the board and takes it away after
 * UPGRADE_MS). docs/decisions/2026-11-16-chandy-art.md.
 *
 * Its animations run from `since` (a negative delay), so a redrawn copy shows the same moment, never the start again (.claude/LESSONS.md:
 * "A level that popped twice a move").
 */
import { useLayoutEffect, useRef } from "preact/hooks";
import { CHANDY_RIFLE, RIFLE_STAGES, type RifleStage } from "../characters/chandy.ts";
import { spriteCanvas } from "../characters/sprite-kit.ts";

/** How long the window shows (Eric, Nov 16: 2 s, everything paused). */
export const UPGRADE_MS = 2000;

/** The rifle at `stage` with the new part's pixels taken out (`base`), and the new part alone (`part`). */
function drawStage(stage: Exclude<RifleStage, 0>, base: HTMLCanvasElement, part: HTMLCanvasElement) {
  const now = spriteCanvas(CHANDY_RIFLE, `stage${stage}`, 0);
  const before = spriteCanvas(CHANDY_RIFLE, `stage${stage - 1}`, 0);
  const w = now.width;
  const h = now.height;
  const a = now.getContext("2d")!.getImageData(0, 0, w, h);
  const b = before.getContext("2d")!.getImageData(0, 0, w, h);
  const kept = new ImageData(w, h);
  const added = new ImageData(w, h);
  for (let i = 0; i < a.data.length; i += 4) {
    const same = a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2] && a.data[i + 3] === b.data[i + 3];
    // The old rifle's pixels the new part replaces stay on the base until it lands (the stage before shows under the sliding part).
    const into = same ? kept : added;
    for (let c = 0; c < 4; c++) into.data[i + c] = a.data[i + c]!;
    if (!same) for (let c = 0; c < 4; c++) kept.data[i + c] = b.data[i + c]!;
  }
  for (const [cv, img] of [[base, kept], [part, added]] as const) {
    cv.width = w;
    cv.height = h;
    cv.getContext("2d")!.putImageData(img, 0, 0);
  }
}

export function ChandyUpgrade({ stage, move, since, class: cls = "" }: { stage: Exclude<RifleStage, 0>; move?: string; since: number; class?: string }) {
  const base = useRef<HTMLCanvasElement>(null);
  const part = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (base.current && part.current) drawStage(stage, base.current, part.current);
  }, [stage]);
  // (How long ago it began, measured once per `since`: a redraw mustn't move its animations' delay again, which would count the time twice.)
  const first = useRef({ since, ago: Math.max(0, Date.now() - since) });
  if (first.current.since !== since) first.current = { since, ago: Math.max(0, Date.now() - since) };
  const ago = first.current.ago;
  const name = RIFLE_STAGES[stage].toUpperCase();
  return (
    <div class={`ch-upgrade ${cls}`} role="status" aria-label={`Upgrade: ${RIFLE_STAGES[stage]}, ${stage} of 5`} style={{ "--ch-ago": `-${ago}ms` }}>
      <div class="ch-up-title">UPGRADE!</div>
      <div class="ch-up-art">
        <canvas ref={base} class="ch-up-base" aria-hidden="true" />
        <canvas ref={part} class="ch-up-part" aria-hidden="true" />
        <i class="ch-up-flash" aria-hidden="true" />
      </div>
      <div class="ch-up-label">
        {name} {stage}/5
      </div>
      <div class="ch-up-note">{move ? `New move unlocked: ${move}` : " "}</div>
    </div>
  );
}
