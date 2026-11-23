/**
 * The loading screen's pictures as pure pixel work (Nov 23, Eric: "It sounds like we can use more cores"): what render.ts paints for
 * each picture, with no canvas, so it runs the same on the main thread and in a paint worker (paint.worker.ts). This is the only copy:
 * render.ts's FrameCache and roofs call these too, so a picture painted in a worker is the main thread's byte for byte (its pixels go
 * on a canvas on the main thread either way, by the same `putImageData`). docs/decisions/2026-11-23-town-paint-workers.md.
 */
import { renderFrame, type Character } from "../characters/sprite.ts";
import { stepChar } from "./kit/bake.ts";
import type { Cut } from "./kit/bake.ts";
import { roofCuts } from "./box-draw.ts";
import type { BoxInst } from "./boxes.ts";

/** A picture's pixels, ImageData-shaped. */
export interface Pixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** A character's idle frame `i` as pixels (render.ts FrameCache: a frame's canvas holds exactly these). */
export function framePixels(ch: Character, i: number): Pixels {
  return renderFrame(ch, ch.anims.idle!.frames[i]!);
}

/**
 * One picture to paint: a character's frame `k` (or one ramp step darker, as render.ts's FrameCache `dark`), or a box's roof for the
 * camera's quarter `q` (box-draw.ts `bakeRoof`: its pixels here, packed onto sheets on the main thread).
 */
export type PaintSpec = { kind: "frame"; ch: Character; k: number; dark: boolean } | { kind: "roof"; b: BoxInst; q: number };
/** A frame's pixels, or a roof's faces' cuts. */
export type Painted = Pixels | Cut[][];

/** Paints one picture (the main thread's code, wherever it runs). */
export function paintSpec(s: PaintSpec): Painted {
  if (s.kind === "frame") return framePixels(s.dark ? stepChar(s.ch, -1) : s.ch, s.k);
  return roofCuts(s.b, s.b.box, s.q);
}
