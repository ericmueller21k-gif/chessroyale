/**
 * The Hidden Boss's cutscene between his adult form and the cyborg (a MOCKUP for Eric, Nov 12; wired into no match yet:
 * shown only by the dev preview, `npm run preview:cutscene`). Over the board, from `at`:
 * 1. Everything dims, and a round spotlight with a soft, feathered edge shines on the board's middle (one fixed layer,
 *    a radial gradient: no filter, no canvas).
 * 2. Today's sprite kneels in the light. The ghost of him as a child poofs into being above the board, drops, lands, his
 *    knees buckle, and he straightens (`RECLUSE_CUTSCENE` in characters/recluse-ages.ts: one drawing for both).
 * 3. The 17 lines, each its own text box by its speaker (the game's speech box, `SpeechBox`), typed out; a line of two
 *    sentences types the first, pauses, then the second. Times: RECLUSE_CUTSCENE in settings.ts.
 * 4. After the last line the child fades out, and the man is left on his knees in the light (the book and the light
 *    that turns him are a later job).
 * Sizes are the board's own: the figure and the boxes sit on a stage laid exactly over `board`.
 */
import { createPortal } from "preact/compat";
import { useLayoutEffect, useMemo, useState } from "preact/hooks";
import { RECLUSE_CUTSCENE as C } from "@chessroyale/core";
import { RECLUSE } from "../characters/recluse.ts";
import { CUTSCENE_SPOTS, RECLUSE_CUTSCENE } from "../characters/recluse-ages.ts";
import { RECLUSE_CUTSCENE_LINES } from "../characters/recluse-lines.ts";
import { boxAt, cutTyped, cutsceneTimeline, type CutLine, type CutTimeline } from "../recluse-cutscene.ts";
import { SpeechBox } from "../speech.tsx";
import { SpriteAnim } from "./BossEffect.tsx";
import { useFrameNow } from "./Countdown.tsx";

const ch = RECLUSE_CUTSCENE;
const animMs = (name: string) => ch.anims[name]!.frames.reduce((s, f) => s + f.ms, 0);

/** The scene's timeline for these lines (the arrival's lengths from the figures' frames). */
export function recluseCutsceneTimeline(lines: readonly CutLine[] = RECLUSE_CUTSCENE_LINES): CutTimeline {
  return cutsceneTimeline(lines, { poofMs: animMs("poof"), dropMs: animMs("drop"), landMs: animMs("land"), fadeMs: animMs("fade") });
}

/** The figure's width, a share of the board's: today's sprite at the phase change's size (24% for his own frame). */
const FIG = (24 * ch.w) / RECLUSE.w;
/** Where the ground under them is on the board (a share of its height), the pair centered across it. */
const GROUND_Y = 0.66;

/** Which of the figure's animations shows at `t` (from the scene's start), and since when (ms from the start). */
function figAt(tl: CutTimeline, t: number): { anim: string; then?: string; since: number } {
  if (t < tl.poofAt) return { anim: "idle", since: 0 };
  if (t < tl.dropAt) return { anim: "poof", since: tl.poofAt };
  if (t < tl.landAt) return { anim: "drop", since: tl.dropAt };
  if (t < tl.standAt) return { anim: "land", since: tl.landAt };
  if (t >= tl.fadeAt) return { anim: "fade", then: "alone", since: tl.fadeAt };
  const up = boxAt(tl, t);
  // (The three loops share one clock, so a mouth starting or stopping never jumps the rest of the frame.)
  if (up && t < up.box.typed) return { anim: up.box.who === "kid" ? "kidTalk" : "manTalk", since: tl.standAt };
  return { anim: "together", since: tl.standAt };
}

/** The board's box on the screen, kept current (it can move with a resize). */
function useRect(board: HTMLElement | null): DOMRect | null {
  const [r, setR] = useState<DOMRect | null>(() => board?.getBoundingClientRect() ?? null);
  useLayoutEffect(() => {
    if (!board) return;
    const read = () => {
      const n = board.getBoundingClientRect();
      setR((o) => (o && o.x === n.x && o.y === n.y && o.width === n.width && o.height === n.height ? o : n));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(board);
    addEventListener("resize", read);
    addEventListener("scroll", read, true);
    return () => {
      ro.disconnect();
      removeEventListener("resize", read);
      removeEventListener("scroll", read, true);
    };
  }, [board]);
  return r;
}

export function RecluseCutscene({ at, board, lines = RECLUSE_CUTSCENE_LINES }: { at: number; board: HTMLElement | null; lines?: readonly CutLine[] }) {
  const now = useFrameNow();
  const tl = useMemo(() => recluseCutsceneTimeline(lines), [lines]);
  const rect = useRect(board);
  if (!rect) return null;
  const t = now - at;
  const fig = figAt(tl, t);
  // The light: centered on the board, its radius a share of the board's width (the CSS turns it into the feathered pool).
  const dim = Math.max(0, Math.min(1, t / C.dimMs));
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  // The figure on the stage (shares of the board's width; the board is square).
  const w = FIG / 100;
  const h = (w * ch.h) / ch.w;
  const left = 0.5 - w / 2;
  const top = GROUND_Y - (h * (ch.foot[1] / ch.h));
  const px = (x: number) => (left + (x / ch.w) * w) * rect.width;
  const py = (y: number) => (top + (y / ch.h) * h) * rect.width;
  const up = t >= tl.standAt ? boxAt(tl, t) : null;
  const line = up ? lines[up.i]! : null;
  return createPortal(
    <div class="cs-layer" aria-live="polite">
      <div class="cs-dim" style={{ opacity: String(dim), "--cs-x": `${cx}px`, "--cs-y": `${cy}px`, "--cs-r": `${rect.width * C.spot}px`, "--cs-in": `${C.spotInner * 100}%`, "--cs-a": String(C.dimAlpha) }} />
      <div class="cs-stage" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }}>
        <span class="cs-fig" style={{ left: `${left * 100}%`, top: `${top * rect.width}px`, width: `${w * 100}%`, aspectRatio: `${ch.w} / ${ch.h}` }}>
          <SpriteAnim ch={ch} anim={fig.anim} then={fig.then} since={at + fig.since} id="cs-fig" />
        </span>
        {up && line && (
          // (A point just above the speaker's head. His box stands on it, running right from it for the child and left for the man, and
          // SpeechBox moves a box that would run off the screen back into view; so the tail is drawn here, always over the speaker.)
          <span class={`cs-anchor cs-${up.box.who}`} style={{ left: `${px(CUTSCENE_SPOTS[up.box.who].x)}px`, top: `${py(CUTSCENE_SPOTS[up.box.who].head) - 14}px` }}>
            <SpeechBox key={up.i} class="bc-bubble cs-say" text={up.box.text} at={at + up.box.at} until={at + up.box.until} now={now} typed={cutTyped(line, up.box, t)} fits={1} data-line={up.i + 1} />
            <span class={`cs-tail${at + up.box.until - now < C.boxFadeMs ? " leaving" : ""}`} />
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
