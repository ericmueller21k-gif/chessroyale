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

/**
 * The WebGL atlas's layout (paint-gl.ts), which the baked town's files are packed to (keep-pictures.ts `packPictures`, Nov 25): pages
 * `page` px square, each picture with `pad` clear pixels round it; one bigger than `big` either way has a texture (and a page) of its own.
 */
export const ATLAS = { page: 2048, pad: 2, big: 1024 } as const;

/**
 * A whole page of pictures, packed as the atlas packs (`ATLAS`): one of the build's baked files (baked.ts: a group's page, as wide and
 * tall as its pictures reach). Its decoded pixels, its size, and each picture on it
 * (the canvas standing in for it, drawn by as any other, and its top left on the page; two may share a place).
 */
export interface AtlasPage {
  readonly img: TexImageSource;
  readonly width: number;
  readonly height: number;
  readonly pics: readonly { readonly src: HTMLCanvasElement; readonly x: number; readonly y: number }[];
}

/**
 * The 2D context of a picture the town makes (a frame, a tag, a sign, text, a cloud, the bubble). Once the street town's WebGL is
 * drawing (`artInMemory`, Nov 11), kept in memory rather than on the GPU (`willReadFrequently`): WebGL uploading a picture drawn on
 * the GPU first waits for the GPU to finish what it's drawing (measured: 30 to 120 ms an upload, headless; on Eric's iPhone, the
 * frame report's "Outside our code" and gaps), while one in memory is a plain copy. Today's town (Canvas 2D) draws its pictures on its
 * own canvas: as before.
 */
export function art2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext("2d", ART)!;
}
const ART: CanvasRenderingContext2DSettings = {};
/** (paint-gl.ts, as the street town's WebGL starts) The town's pictures are made in memory from now on (`art2d`). */
export function artInMemory(): void {
  ART.willReadFrequently = true;
}

export interface Painter {
  readonly kind: Backend;
  readonly ctx: Ctx;
  /** A frame starts (before anything is drawn) and ends (after the last draw: the WebGL backend draws what it holds). */
  frame(): void;
  done(): void;
  /** A new light layer (one canvas's size, sized by the caller). */
  layer(): PaintLayer;
  /**
   * `src` handed over to be uploaded and kept (WebGL; the street town's loading screen since Nov 11, and since Nov 28, phase 2, the only
   * way a picture reaches the GPU: the picture service's, picture-service.ts). It waits for `kept`, which uploads it onto the atlas
   * pages of its `group` (`PIC_GROUP`: 0, the town's own; the others have pages of their own, their room set by `reserve`). Never
   * uploaded as it's drawn: a picture not handed over is not drawn at all. Canvas 2D has nothing to upload: none.
   */
  keep?(src: CanvasImageSource, group?: number): void;
  /**
   * (With `keep`) Uploads what it was handed, a slice of up to `budgetMs` at a time, between frames only (inside one it does nothing);
   * says how much is done (0 to 1). Its first call (and the first after a lost context) makes the atlas, once, as deep as every
   * group needs.
   */
  kept?(budgetMs: number): number;
  /** (With `keep`, before the first `kept`) Group `group`'s pages: room for what it's handed on the loading screen and `px` texels more. */
  reserve?(group: number, px: number): void;
  /** (With `keep`) Whether `src` is on the GPU now: uploaded, and its place not lost with the context. */
  holds?(src: CanvasImageSource): boolean;
  /** (With `keep`) Lets `src` go: its place on its page is free for another picture (a big one's own texture is deleted). */
  free?(src: CanvasImageSource): void;
  /**
   * (With `keep`, the loading screen, before `kept`; Nov 25) Whole pages (the build's baked files), uploaded whole by `kept`, each
   * placed on the atlas's layers: each picture on them kept as `keep` keeps one, where its page put it, never uploaded alone. `fill`
   * puts a picture's pixels on its canvas (empty until then) should it be uploaded alone (false: they can't be read just now, and it
   * isn't uploaded). Says whether it took them: false (too many for the atlas, or `kept` has started), and none is placed: hand each
   * picture to `keep` then (baked.ts `adoptOrKeep`). After a lost context the pages are handed over again (their decoded copies are
   * let go once uploaded: baked.ts `release`, `reopen`).
   */
  adopt?(pages: readonly AtlasPage[], fill: (src: HTMLCanvasElement) => boolean): boolean;
  /**
   * (WebGL) What the GPU holds for `src` now, as a canvas would give its pixels: a baked picture's, its decoded page let go, for a 2D
   * context that asks (a tap's hit test, a chip's face). Null: nothing of it is there just now (a lost context).
   */
  read?(src: object): ImageData | null;
  /**
   * (WebGL, the loading screen's warm-up, Nov 28) Waits until the GPU has done everything sent so far (one pixel read back): a frame drawn
   * under the loading card pays its textures' and shaders' first use there, not in the first frames you see.
   */
  settle?(): void;
  /**
   * The far softening (render.ts's `blitSoft`) in one draw, or undefined where render.ts does it its own way (Canvas 2D:
   * a scratch canvas). `k`: the shrunk copy's pixels a CSS pixel; `haze`: how far toward `horizon` (a CSS color).
   */
  readonly soft?: (img: CanvasImageSource, x: number, y: number, w: number, h: number, f: number, haze: number, horizon: string) => void;
  /**
   * (Nov 27) Quads filled in the fill style, as one path of them filled: quad `order[i]` (8 floats from `pts[order[i] * 8]`) for i from
   * `from` to `to - 1`, those with `only[order[i]]` set (null: all). WebGL writes them straight in (the ground's squares); undefined:
   * render.ts builds the path.
   */
  readonly quads?: (pts: Float64Array, order: Int32Array, from: number, to: number, only: Uint8Array | null) => void;
  /** Draw calls in the last frame (WebGL: the GPU's; Canvas 2D: not counted, 0). */
  readonly drawCalls: number;
  /** Lost (WebGL's context): nothing is drawn until it's back. */
  readonly lost: boolean;
  /** (Tests) The pixels of `x, y, w, h` (device pixels, from the top left) as the last frame drew them; call right after a draw. */
  pixels(x: number, y: number, w: number, h: number): ImageData;
  /** (Tests, WebGL) A hash of what the textures hold for each of `list` (keep-pictures' pictures): its size and texels; 0 for none. */
  texels?(list: readonly object[]): Uint32Array;
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
    drawCalls: 0,
    lost: false,
    pixels: (x, y, w, h) => ctx.getImageData(x, y, w, h),
    dispose() {},
  };
}
