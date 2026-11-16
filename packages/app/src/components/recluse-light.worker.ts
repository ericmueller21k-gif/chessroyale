/**
 * The light of the Hidden Boss's transformation, drawn off the main thread (Nov 14 review, B1): RecluseTransform hands its two
 * canvases here once (`init`, with the phase change's beats), then a frame each animation frame; only the latest is drawn.
 */
import { drawLight, type LightBeats, type LightFrame } from "./recluse-light.ts";

let back: OffscreenCanvas | null = null;
let front: OffscreenCanvas | null = null;
let beats: LightBeats | null = null;
let next: LightFrame | null = null;
let queued = false;

const draw = () => {
  queued = false;
  if (next && beats) drawLight(next, beats, back, front);
  next = null;
};

self.onmessage = (e: MessageEvent<{ init: { back: OffscreenCanvas; front: OffscreenCanvas; beats: LightBeats } } | { frame: LightFrame }>) => {
  const m = e.data;
  if ("init" in m) {
    ({ back, front, beats } = m.init);
    return;
  }
  next = m.frame;
  if (queued) return;
  queued = true;
  // (Drawn with the worker's own frame where it has one, else at once.)
  const raf = (self as unknown as { requestAnimationFrame?: (f: () => void) => number }).requestAnimationFrame;
  if (raf) raf(draw);
  else setTimeout(draw, 0);
};
