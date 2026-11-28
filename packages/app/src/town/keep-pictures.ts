/**
 * Chess Town's pictures as pages (Nov 23; Nov 25: packed as the WebGL atlas packs, paint.ts `ATLAS`): how the build's baked files are
 * laid out (`packPictures`: scripts/bake-town.ts packs each group's pictures with it), and how the device holds them (baked.ts): each
 * file a decoded page handed to the painter whole (`Painter.adopt`), each picture a canvas standing in for it (`PageIO.standIn`), put
 * where its painting used to go (render.ts `plan`) and drawn by as before. A stand-in is empty until something asks for its pixels
 * (its 2D context: a tap's hit test, a statue's mask; a 2D context drawing from it: a chip's face, `cutBeforeDraw`; or the painter
 * uploading it alone), then cut from its page, or, once the pages are let go (Nov 28, phase 1c: baked.ts `release`), read back from
 * the GPU.
 *
 * Until phase 1c this file also kept a first visit's painted pictures in IndexedDB for the next visit (Eric, Nov 23: "the drawn
 * pictures between visits ... it seems like just smart"): gone with painting on the device; the build's files, kept by the service
 * worker, are every visit's pictures now. docs/decisions/2026-11-28-town-no-device-painting.md.
 */
import type { Baked } from "./baked.ts";
import type { Piece, RoofArt } from "./box-draw.ts";
import { ATLAS } from "./paint.ts";

/** A decoded page (an ImageBitmap in the browser). */
export interface Page {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** Where a stand-in's pixels come from now: its place on its open page, or the pixels themselves (as the GPU holds them, read back). */
export type PicSource = { page: Page; x: number; y: number } | { pixels: ImageData };

/** The browser's part (tests pass their own). */
export interface PageIO {
  decode(b: Blob): Promise<Page>;
  /**
   * A w x h canvas standing in for a picture: empty until its 2D context is asked for, a 2D context draws from it, or `fill`; then
   * its pixels are put on it from `source()`. Null from `source` (nowhere to read them just now: its page let go and the GPU's context
   * lost): it stays empty and is asked again the next time.
   */
  standIn(w: number, h: number, source: () => PicSource | null): HTMLCanvasElement;
  /** Puts a stand-in's pixels on it now, if they aren't yet. False: they couldn't be read just now (anything but a stand-in: true). */
  fill(c: HTMLCanvasElement): boolean;
}

/**
 * The loading screen's pictures, in the order its jobs come to them (render.ts `plan`), each once: the build's baked ones (`baked`,
 * baked.ts), a job's picture the one of its name and a roof's pieces the manifest's (`bakedRoof`). None is handed to the painter one
 * by one: it's given their files whole once every job has run (`Painter.adopt`). (What the device makes itself goes through the
 * picture service, picture-service.ts.)
 */
export class Pictures {
  readonly list: HTMLCanvasElement[] = [];
  private readonly at = new Set<object>();
  constructor(readonly baked: Baked) {}
  /** A picture the loading screen puts in place (kept with its file), listed the first time. */
  add(c: HTMLCanvasElement): void {
    if (this.at.has(c)) return;
    this.at.add(c);
    this.list.push(c);
  }
  /** The roof `name` as the build painted it: its pieces from the manifest, each sheet (`<name>/<n>`) a picture of its own here. */
  bakedRoof(name: string): RoofArt {
    const b = this.baked;
    const sheets = new Map<number, HTMLCanvasElement>();
    const sheet = (n: number) => sheets.get(n) ?? sheets.set(n, b.pic(`${name}/${n}`)).get(n)!;
    const piece = (f: readonly number[], k: number): Piece => ({ cv: sheet(f[k]!), sx: f[k + 1]!, sy: f[k + 2]!, w: f[k + 3]!, h: f[k + 4]!, ox: f[k + 5]!, oy: f[k + 6]! });
    return { faces: b.manifest.roofs[name]!.map((f) => ({ whole: piece(f, 0), tris: Array.from({ length: f.length / 7 - 1 }, (_, j) => piece(f, 7 * (j + 1))) })) };
  }
}

/** A picture the atlas gives a texture of its own (paint-gl.ts): on a page of its own, at its top left. */
const bigPic = (w: number, h: number) => w > ATLAS.big || h > ATLAS.big;

/**
 * Pictures of these sizes packed onto pages as the WebGL atlas holds them (`ATLAS`, Nov 25): `ATLAS.page` px square, shelves, tallest
 * first, each picture with `ATLAS.pad` clear pixels round it; one bigger than `ATLAS.big` either way alone on a page its size. Each
 * picture's page, x and y (its top left), and each page's size (as tall as it's filled).
 */
export function packPictures(sizes: readonly (readonly [number, number])[]): { at: [number, number, number][]; pages: [number, number][] } {
  const { page: side, pad } = ATLAS;
  const at: [number, number, number][] = sizes.map(() => [0, 0, 0]);
  const pages: { w: number; h: number; own: boolean; shelves: { y: number; h: number; x: number }[] }[] = [];
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]![1] - sizes[a]![1] || sizes[b]![0] - sizes[a]![0]);
  for (const i of order) {
    const [w, h] = sizes[i]!;
    if (bigPic(w, h)) {
      at[i] = [pages.length, 0, 0];
      pages.push({ w, h, own: true, shelves: [] });
      continue;
    }
    const W = w + 2 * pad;
    const H = h + 2 * pad;
    let placed = false;
    for (let p = 0; p < pages.length && !placed; p++) {
      const pg = pages[p]!;
      if (pg.own) continue;
      let s = pg.shelves.find((sh) => sh.h >= H && side - sh.x >= W);
      if (!s && pg.h + H <= side) pg.shelves.push((s = { y: pg.h, h: H, x: 0 })), (pg.h += H);
      if (s) {
        at[i] = [p, s.x + pad, s.y + pad];
        s.x += W;
        placed = true;
      }
    }
    if (!placed) {
      at[i] = [pages.length, pad, pad];
      pages.push({ w: side, h: H, own: false, shelves: [{ y: 0, h: H, x: W }] });
    }
  }
  return { at, pages: pages.map((p) => [p.w, Math.max(1, p.h)]) };
}

// ---- The browser's parts.

/** (`domPageIO`) Each stand-in not cut yet: what cuts it (false: it couldn't just now). */
const uncut = new WeakMap<object, () => boolean>();
let cutOnDraw = false;
/**
 * (Nov 25, round 2) A 2D context drawing FROM a stand-in (or making a pattern of one) cuts it first. Drawing from a canvas never asks
 * for its context, so a picture drawn anywhere but the WebGL painter (which cuts one before uploading it alone, paint-gl.ts `upload`)
 * copied an empty canvas: the chips' and the large map's boss faces were blank on a repeat visit (render.ts `chipFace`). One place for
 * every 2D reader there is or will be, rather than a cut at each. Set once, as the first stand-in is made; a draw from anything else
 * costs one WeakMap look.
 */
function cutBeforeDraw(): void {
  if (cutOnDraw || typeof CanvasRenderingContext2D === "undefined") return;
  cutOnDraw = true;
  const P = CanvasRenderingContext2D.prototype;
  const draw = P.drawImage as (...a: unknown[]) => void;
  const pattern = P.createPattern;
  P.drawImage = function (this: CanvasRenderingContext2D, img: CanvasImageSource) {
    uncut.get(img)?.();
    return draw.apply(this, arguments as unknown as unknown[]);
  } as typeof P.drawImage;
  P.createPattern = function (this: CanvasRenderingContext2D, img: CanvasImageSource, rep: string | null) {
    uncut.get(img)?.();
    return pattern.call(this, img, rep);
  };
}

/** Decoding pages, and putting their pictures' pixels on their stand-ins as they're asked for, in the browser (null: it can't). */
export function domPageIO(art2d: (c: HTMLCanvasElement) => CanvasRenderingContext2D): PageIO | null {
  if (typeof createImageBitmap !== "function") return null;
  const fill = (c: HTMLCanvasElement) => uncut.get(c)?.() ?? true;
  const own = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => RenderingContext | null;
  return {
    // (Its pixels as they are: no color space conversion, alpha as the browser keeps a canvas's (premultiplied), so a cut is the painted
    // canvas exactly and the atlas holds what the painted canvas gave it: every texel of every page the same, measured Nov 25 (Chromium),
    // and twice as quick to upload as one made "premultiply", 11 ms a page against 27.)
    decode: (b) => createImageBitmap(b, { colorSpaceConversion: "none", premultiplyAlpha: "default" }),
    standIn: (w, h, source) => {
      cutBeforeDraw();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      // (Its 2D context asked for (anything reading or drawing on its pixels), or a 2D context drawing from it (`cutBeforeDraw`): cut
      // first. No canvas is made for the picture until then.)
      const patched = function (this: HTMLCanvasElement, ...a: Parameters<HTMLCanvasElement["getContext"]>) {
        fill(c);
        return own.apply(this, a);
      } as HTMLCanvasElement["getContext"];
      c.getContext = patched;
      const cut = (): boolean => {
        let from: PicSource | null = null;
        try {
          from = source();
        } catch {
          // (Nowhere to read it: as null.)
        }
        if (!from) return false;
        // (Its own `getContext` from here on: `art2d` below must not come back in.)
        uncut.delete(c);
        delete (c as { getContext?: unknown }).getContext;
        try {
          if ("page" in from) art2d(c).drawImage(from.page as ImageBitmap, from.x, from.y, w, h, 0, 0, w, h);
          else art2d(c).putImageData(from.pixels, 0, 0);
          return true;
        } catch {
          // (Its page let go between the asking and the drawing: asked again the next time.)
          c.getContext = patched;
          uncut.set(c, cut);
          return false;
        }
      };
      uncut.set(c, cut);
      return c;
    },
    fill,
  };
}
