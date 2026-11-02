import { useEffect, useRef } from "preact/hooks";
import { renderFrame, type Character } from "../characters/sprite.ts";
import { sceneLayout } from "./layout.ts";

/**
 * The home's pixel-art pictures (Chess Town's scene and crest, Boss Battle's and Auto chess's cards; the drawings are
 * `home-art/arena-*.ts`, docs/areas/hub.md): a character's idle loop on a canvas, drawn by the same `renderFrame` as the bosses,
 * nearest-neighbor, an art pixel always a whole number of device pixels. A loop is a few frames a second, so a picture is drawn
 * only when its frame changes, never every animation frame; under reduced motion it's the first frame, still.
 */

interface Cell {
  canvas: HTMLCanvasElement;
  ms: number;
}
const cache = new Map<string, Cell[]>();

/** A character's idle frames, each drawn once to its own canvas (and kept: the home comes back often). */
function framesOf(ch: Character): Cell[] {
  let cells = cache.get(ch.id);
  if (!cells) {
    cells = ch.anims.idle!.frames.map((fr) => {
      const { w, h, data } = renderFrame(ch, fr);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
      return { canvas, ms: fr.ms };
    });
    cache.set(ch.id, cells);
  }
  return cells;
}

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Plays `ch`'s idle: `draw` gets the frame to show now and again at each frame's own time. `redraw` shows the current frame
 * again (a box that changed size); `stop` ends it. A hidden page draws nothing (the loop keeps its place).
 */
function play(ch: Character, draw: (frame: HTMLCanvasElement) => void) {
  const cells = framesOf(ch);
  let i = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const show = () => draw(cells[i]!.canvas);
  const next = () => {
    timer = setTimeout(() => {
      i = (i + 1) % cells.length;
      if (!document.hidden) show();
      next();
    }, cells[i]!.ms);
  };
  show();
  if (cells.length > 1 && !reducedMotion()) next();
  return { redraw: show, stop: () => clearTimeout(timer) };
}

/** Device pixels per art pixel for a picture drawn at `scale` CSS pixels per art pixel (a whole number, at least 1). */
const wholePixels = (scale: number) => Math.max(1, Math.floor(scale * (window.devicePixelRatio || 1)));

/** A picture at `scale` CSS pixels per art pixel (its own size: `ch.w` × `ch.h` times the scale, less on a fractional screen). */
export function Pic({ ch, scale = 1, class: cls }: { ch: Character; scale?: number; class?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = window.devicePixelRatio || 1;
  const d = wholePixels(scale);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    return play(ch, (frame) => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(frame, 0, 0, ch.w * d, ch.h * d);
    }).stop;
  }, [ch, d]);
  return (
    <canvas
      ref={ref}
      class={cls}
      width={ch.w * d}
      height={ch.h * d}
      style={{ width: `${(ch.w * d) / dpr}px`, height: `${(ch.h * d) / dpr}px`, imageRendering: "pixelated", display: "block" }}
      aria-hidden="true"
    />
  );
}

/**
 * A scene that fills its parent box (the parent is `position: relative`, with its own size), at the biggest whole-pixel scale that
 * fits its height (`sceneLayout`): down on the box's foot, centered across, the last `dropBottom` rows cut when the box is a little
 * short. Where the box is wider than the picture a narrow gap is filled by the ground's end column (from `groundRow` down), a wide
 * one by the picture's own ends repeating, so the ground runs unbroken to the edge and the town goes on.
 */
export function Scene({ ch, dropBottom = 0, groundRow, class: cls }: { ch: Character; dropBottom?: number; groundRow: number; class?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const box = cv.parentElement!;
    const g = cv.getContext("2d")!;
    const draw = (src: HTMLCanvasElement) => {
      const { d, x, y, sides } = sceneLayout(ch, { w: cv.width, h: cv.height }, window.devicePixelRatio || 1, dropBottom);
      const w = ch.w * d;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, cv.width, cv.height);
      if (sides === "ground") {
        const rows = ch.h - groundRow;
        g.drawImage(src, 0, groundRow, 1, rows, 0, y + groundRow * d, x, rows * d);
        g.drawImage(src, ch.w - 1, groundRow, 1, rows, x + w, y + groundRow * d, cv.width - x - w, rows * d);
        g.drawImage(src, x, y, w, ch.h * d);
      } else {
        for (let tx = x - Math.ceil(x / w) * w; tx < cv.width; tx += w) g.drawImage(src, tx, y, w, ch.h * d);
      }
    };
    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(box.clientWidth * dpr);
      cv.height = Math.round(box.clientHeight * dpr);
    };
    size();
    const loop = play(ch, draw);
    const watch = new ResizeObserver(() => {
      size();
      loop.redraw();
    });
    watch.observe(box);
    return () => {
      loop.stop();
      watch.disconnect();
    };
  }, [ch, dropBottom, groundRow]);
  return <canvas ref={ref} class={cls} aria-hidden="true" />;
}
