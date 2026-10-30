/**
 * The town's drawing layer (Oct 30): what puts pixels on the town's one canvas, with two backends behind one interface.
 *
 * - **Canvas 2D** (the default): `ctx` is the canvas's own CanvasRenderingContext2D, so every call render.ts and
 *   sky-draw.ts make is the call they made before this layer existed (nothing in between, nothing changed).
 * - **WebGL 2** (`?gl=1`; paint-gl.ts): `ctx` is a small stand-in for the same subset of the 2D context, which records the
 *   frame as batched quads and triangles and draws it in a few draw calls.
 *
 * Everything that decides what to draw (the camera, the world, the sprites and their art, the frame caches, the tags)
 * stays in render.ts; only the calls that put pixels on the canvas go through `ctx`. The extras below are the few things a
 * 2D context can't say in one call: a frame's start and end, a light layer, a canvas drawn before being drawn again, and
 * the far softening done the GPU's way.
 */

/** The part of CanvasRenderingContext2D the town draws with (render.ts, sky-draw.ts). Both backends speak it. */
export type Ctx = Pick<
  CanvasRenderingContext2D,
  | "canvas"
  | "globalAlpha"
  | "globalCompositeOperation"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineJoin"
  | "lineCap"
  | "imageSmoothingEnabled"
  | "shadowColor"
  | "shadowBlur"
  | "shadowOffsetX"
  | "shadowOffsetY"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "save"
  | "restore"
  | "setTransform"
  | "transform"
  | "translate"
  | "rotate"
  | "scale"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "closePath"
  | "rect"
  | "ellipse"
  | "arc"
  | "quadraticCurveTo"
  | "fill"
  | "stroke"
  | "clip"
  | "fillRect"
  | "clearRect"
  | "drawImage"
  | "fillText"
  | "strokeText"
  | "measureText"
  | "createLinearGradient"
>;

/** A light layer (render.ts's lights at dusk and night): drawn into with `g`, laid on the world with `ctx.drawImage(src, …)`. */
export interface PaintLayer {
  readonly g: Ctx;
  /** What `ctx.drawImage` takes to draw it. */
  readonly src: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  /** Sizes it (device pixels); a new size clears it, as a canvas's does. */
  size(w: number, h: number): void;
}

export type Backend = "2d" | "webgl";

export interface Painter {
  readonly kind: Backend;
  readonly ctx: Ctx;
  /** A frame starts (before anything is drawn) and ends (after the last draw: the WebGL backend draws what it holds). */
  frame(): void;
  done(): void;
  /** A new light layer (one canvas's size, sized by the caller). */
  layer(): PaintLayer;
  /** `src`, drawn before, has been drawn on again: the next draw shows its new pixels (the WebGL backend uploads it again). */
  changed(src: CanvasImageSource): void;
  /**
   * The far softening (render.ts's `blitSoft`) in one draw, or undefined where render.ts does it its own way (Canvas 2D:
   * a scratch canvas). `k`: the shrunk copy's pixels a CSS pixel; `haze`: how far toward `horizon` (a CSS color).
   */
  readonly soft?: (img: CanvasImageSource, x: number, y: number, w: number, h: number, f: number, haze: number, horizon: string) => void;
  /** Draw calls in the last frame (WebGL: the GPU's; Canvas 2D: not counted, 0). */
  readonly drawCalls: number;
  /** Lost (WebGL's context): nothing is drawn until it's back. */
  readonly lost: boolean;
  /** (Tests) The pixels of `x, y, w, h` (device pixels, from the top left) as the last frame drew them; call right after a draw. */
  pixels(x: number, y: number, w: number, h: number): ImageData;
  /** Lets go of what it holds (a backend swapped out). */
  dispose(): void;
}

/** The Canvas 2D backend: the canvas's own context, unchanged. */
export function painter2d(cv: HTMLCanvasElement): Painter {
  const ctx = cv.getContext("2d")!;
  return {
    kind: "2d",
    ctx,
    frame() {},
    done() {},
    layer() {
      const c = document.createElement("canvas");
      const g = c.getContext("2d")!;
      return {
        g,
        src: c,
        get width() {
          return c.width;
        },
        get height() {
          return c.height;
        },
        size(w: number, h: number) {
          c.width = w;
          c.height = h;
        },
      };
    },
    changed() {},
    drawCalls: 0,
    lost: false,
    pixels: (x, y, w, h) => ctx.getImageData(x, y, w, h),
    dispose() {},
  };
}
