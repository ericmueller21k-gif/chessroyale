/**
 * Chess Town's pictures kept between visits (Nov 23, Eric: "the drawn pictures between visits ... it seems like just smart").
 *
 * The loading screen paints every picture the town can show (render.ts `warm`) before the first frame (Eric's rule: nothing painted
 * while you walk). On the first visit on a build, that's as before; then the pictures are packed into pages, encoded as PNG off the
 * main thread (keep-pictures.worker.ts) and kept in IndexedDB with a manifest: each picture's place on its page, in the order the
 * loading screen keeps them, and each roof's pieces. A later visit on the same build and layout (`pictureKey`) decodes the pages, and
 * since Nov 25 hands them to the painter whole (`Painter.adopt`): they're packed as the WebGL atlas packs (paint.ts `ATLAS`), so each is
 * uploaded as one layer, never cut up and uploaded a picture at a time (1,912 of them: 3.3 s and 0.55 s of a slowed phone's 7 s). Each
 * picture is a canvas standing in for it, put where its painting would have gone (render.ts `plan`) and drawn by as before; it's empty
 * until something asks for its pixels (its 2D context: a tap's hit test, a statue's mask; a 2D context drawing from it: a chip's face,
 * `cutBeforeDraw`; or the painter uploading it alone), then cut from its page. The town draws exactly what it drew before.
 *
 * It never breaks the town: no storage, a quota error, a missing, partial, corrupt or other build's entry, a decode failure or a slow
 * read (`TOWN_PICTURES.waitMs`) paints as before, silently, and the entry is cleared. Only one entry is ever kept (the last build's).
 * docs/decisions/2026-11-23-town-keep-pictures.md.
 */
import { TOWN_PICTURES } from "@chessroyale/core";
import type { Piece, RoofArt } from "./box-draw.ts";
import { ATLAS, type AtlasPage } from "./paint.ts";

/** A decoded page (an ImageBitmap in the browser). */
export interface Page {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** What's kept: the manifest and its pages' PNGs. */
export interface Manifest {
  /** 2 since Nov 25: packed as the atlas packs (`ATLAS`). */
  v: 2;
  key: string;
  /** Each page's width and height, two numbers a page. */
  pages: number[];
  /** Each picture's page, x, y, width and height, five numbers a picture, in the order the loading screen keeps them. */
  pics: number[];
  /** Each roof painted, in the loading screen's order: its faces, each its whole then its triangles, seven numbers a piece
   * (picture, sx, sy, w, h, ox, oy). */
  roofs: number[][][];
  /** (Nov 26) Each glow baked (render.ts bakeGlow: a lit window's, a lamp's), in the loading screen's order: none for no pieces, else
   * seven numbers a piece (sx, sy, w, h on its sheet, the next picture; x, y in its picture's pixels; 1 if it flickers). */
  glows: number[][];
}
export interface Entry {
  manifest: Manifest;
  blobs: Blob[];
}

/** Where the entry lives (IndexedDB in the browser; an in-memory one in tests). */
export interface Shelf {
  read(): Promise<unknown>;
  write(e: Entry): Promise<void>;
  clear(): Promise<void>;
}

/** The last visit's pictures, ready to be put in place (`Pictures`). */
export interface Restored {
  readonly count: number;
  readonly roofs: readonly (readonly (readonly number[])[])[];
  readonly glows: readonly (readonly number[])[];
  /** Picture `i`: the canvas standing in for it (empty until its pixels are asked for, `PageIO.standIn`). */
  pic(i: number): HTMLCanvasElement;
  /** The pages and the pictures on each, for the painter to upload whole (`Painter.adopt`). */
  readonly pages: readonly AtlasPage[];
  /** Puts a picture's pixels on its canvas now, if they aren't yet (the painter's `fill`). */
  fill(c: HTMLCanvasElement): void;
  /** Lets go of the decoded pages (the town closing: a picture still empty stays so). */
  close(): void;
}

/** The browser's part (tests pass their own). */
export interface PageIO {
  decode(b: Blob): Promise<Page>;
  /**
   * A w x h canvas for the picture at (x, y) on `page`: empty until its 2D context is asked for, a 2D context draws from it, or `fill`,
   * then cut from the page.
   */
  standIn(page: Page, x: number, y: number, w: number, h: number): HTMLCanvasElement;
  /** Cuts a stand-in's picture onto it now, if it isn't yet (anything else: nothing). */
  fill(c: HTMLCanvasElement): void;
}

/**
 * One visit's pictures, in the order the loading screen keeps them (render.ts `plan`), each once. On a later visit (`from`), a job's
 * picture is the last visit's at the same place in that order (`next`), and a roof's pieces its kept ones (`roof`).
 */
export class Pictures {
  readonly list: HTMLCanvasElement[] = [];
  private readonly at = new Map<object, number>();
  /** (Painting) each roof painted: its faces' pieces, as `Manifest.roofs`. */
  readonly roofs: number[][][] = [];
  private roofAt = 0;
  /** (Painting) each glow baked, as `Manifest.glows`. */
  readonly glows: number[][] = [];
  private glowAt = 0;
  constructor(
    readonly keep: (c: CanvasImageSource) => void,
    readonly from: Restored | null,
  ) {}
  /** A picture the loading screen keeps (the painter's `keep`), listed the first time. */
  add(c: HTMLCanvasElement): void {
    if (!this.at.has(c)) {
      this.at.set(c, this.list.length);
      this.list.push(c);
    }
    this.keep(c);
  }
  /** (A later visit) the next new picture: the last visit's at this place. */
  next(): HTMLCanvasElement {
    return this.from!.pic(this.list.length);
  }
  /** (A later visit) the next roof painted, as the last visit painted it. */
  roof(): RoofArt {
    const r = this.from!.roofs[this.roofAt++];
    if (!r) throw new Error("kept pictures: a roof short");
    const piece = (f: readonly number[], k: number): Piece => ({ cv: this.from!.pic(f[k]!), sx: f[k + 1]!, sy: f[k + 2]!, w: f[k + 3]!, h: f[k + 4]!, ox: f[k + 5]!, oy: f[k + 6]! });
    return { faces: r.map((f) => ({ whole: piece(f, 0), tris: Array.from({ length: f.length / 7 - 1 }, (_, j) => piece(f, 7 * (j + 1))) })) };
  }
  /** A roof just made (its pieces added): kept for the next visit. */
  roofDone(a: RoofArt): void {
    if (this.from) return;
    this.roofs.push(a.faces.map((f) => [f.whole, ...f.tris].flatMap((p) => [this.at.get(p.cv) ?? -1, p.sx, p.sy, p.w, p.h, p.ox, p.oy])));
  }
  /** (A later visit) the next glow baked, as the last visit baked it (`Manifest.glows`: its sheet is the next picture). */
  glow(): readonly number[] {
    const g = this.from!.glows[this.glowAt++];
    if (!g) throw new Error("kept pictures: a glow short");
    return g;
  }
  /** A glow just baked (its sheet added, if it has pieces): kept for the next visit. */
  glowDone(row: number[]): void {
    if (!this.from) this.glows.push(row);
  }
  /** (A later visit, once every job ran) whether every kept picture, roof and glow was used: the layout was the last visit's. */
  matched(): boolean {
    return !!this.from && this.list.length === this.from.count && this.roofAt === this.from.roofs.length && this.glowAt === this.from.glows.length;
  }
}

/** A short hash of a string (cyrb53). */
export function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * The entry's key: the app's version (each deploy's commit), the town's code and everything it imports (its file's hashed name,
 * which changes when any of them does), and the loading screen's pictures (render.ts `pictureSig`: the layout; an admin's town is
 * another). Any of them changed, and the pictures are painted again.
 */
export function pictureKey(version: string, code: string, sig: string): string {
  return `${version}|${code}|${hash(sig)}`;
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

/** The manifest for these pictures, packed (`packPictures`). */
export function manifestOf(key: string, pics: Pictures): Manifest {
  const { at, pages } = packPictures(pics.list.map((c) => [c.width, c.height] as const));
  return { v: 2, key, pages: pages.flat(), pics: at.flatMap(([p, x, y], i) => [p, x, y, pics.list[i]!.width, pics.list[i]!.height]), roofs: pics.roofs, glows: pics.glows };
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
/** `e` as an entry for `key`, every number in its place and every picture on its page; null if it's anything else. */
export function entryFor(e: unknown, key: string): Entry | null {
  const x = e as Partial<Entry> | null;
  const m = x?.manifest;
  if (!m || m.v !== 2 || m.key !== key || !Array.isArray(x!.blobs) || !Array.isArray(m.pages) || !Array.isArray(m.pics) || !Array.isArray(m.roofs) || !Array.isArray(m.glows)) return null;
  const nPages = m.pages.length / 2;
  if (!Number.isInteger(nPages) || nPages !== x!.blobs.length || !m.pages.every(isInt)) return null;
  if (!x!.blobs.every((b) => typeof Blob !== "undefined" && b instanceof Blob && b.size > 0)) return null;
  const n = m.pics.length / 5;
  if (!Number.isInteger(n) || !m.pics.every(isInt)) return null;
  for (let i = 0; i < n; i++) {
    const [p, px, py, w, h] = m.pics.slice(i * 5, i * 5 + 5) as [number, number, number, number, number];
    if (p >= nPages || !w || !h || px + w > m.pages[p * 2]! || py + h > m.pages[p * 2 + 1]!) return null;
    // (As the atlas holds it: a big one alone at its page's top left, its page its size; any other on a page no bigger than the atlas's.)
    const pw = m.pages[p * 2]!;
    const ph = m.pages[p * 2 + 1]!;
    if (bigPic(w, h) ? px || py || pw !== w || ph !== h : pw > ATLAS.page || ph > ATLAS.page) return null;
  }
  for (const r of m.roofs) {
    // (A roof may have no faces: a box with none drawn from above.)
    if (!Array.isArray(r)) return null;
    for (const f of r) if (!Array.isArray(f) || !f.length || f.length % 7 || !f.every((v, j) => (j % 7 ? typeof v === "number" && Number.isFinite(v) : isInt(v) && v < n))) return null;
  }
  for (const g of m.glows) if (!Array.isArray(g) || g.length % 7 || !g.every((v, j) => typeof v === "number" && Number.isFinite(v) && (j % 7 >= 4 || isInt(v)))) return null;
  return x as Entry;
}

/** Clears the entry, never throwing. */
async function drop(shelf: Shelf): Promise<void> {
  try {
    await shelf.clear();
  } catch {
    // (Nothing to do: the next visit paints.)
  }
}

/** `p`, or null after `ms` (what it gives later is handed to `late`). */
function within<T>(p: Promise<T>, ms: number, late: (v: T) => void): Promise<T | null> {
  return new Promise((done) => {
    let over = false;
    const t = setTimeout(() => ((over = true), done(null)), ms);
    p.then(
      (v) => (over ? late(v) : (clearTimeout(t), done(v))),
      () => (over ? undefined : (clearTimeout(t), done(null))),
    );
  });
}

/**
 * The last visit's pictures for `key`, decoded (null: paint them). Anything odd clears the entry: one from another build or layout, one
 * that doesn't read as an entry, a page that doesn't decode or isn't its size. Up to `TOWN_PICTURES.waitMs` all told.
 */
export async function restore(shelf: Shelf | null, key: string, io: PageIO | null, waitMs: number = TOWN_PICTURES.waitMs): Promise<Restored | null> {
  if (!TOWN_PICTURES.on || !shelf || !io) return null;
  const go = async (): Promise<Restored | null> => {
    let raw: unknown;
    try {
      raw = await shelf.read();
    } catch {
      await drop(shelf);
      return null;
    }
    if (raw == null) return null;
    const e = entryFor(raw, key);
    if (!e) {
      await drop(shelf);
      return null;
    }
    const m = e.manifest;
    const decoded = e.blobs.map((b) => io.decode(b));
    let pages: Page[];
    try {
      pages = await Promise.all(decoded);
    } catch {
      for (const d of decoded) d.then((p) => p.close(), () => undefined);
      await drop(shelf);
      return null;
    }
    if (pages.some((p, i) => p.width !== m.pages[i * 2] || p.height !== m.pages[i * 2 + 1])) {
      for (const p of pages) p.close();
      await drop(shelf);
      return null;
    }
    const n = m.pics.length / 5;
    const on: AtlasPage["pics"][number][][] = pages.map(() => []);
    const pics: HTMLCanvasElement[] = [];
    for (let i = 0; i < n; i++) {
      const [p, x, y, w, h] = m.pics.slice(i * 5, i * 5 + 5) as [number, number, number, number, number];
      const src = io.standIn(pages[p]!, x, y, w, h);
      pics.push(src);
      on[p]!.push({ src, x, y });
    }
    return {
      count: n,
      roofs: m.roofs,
      glows: m.glows,
      pic: (i: number) => {
        if (i >= n) throw new Error("kept pictures: past the end");
        return pics[i]!;
      },
      pages: pages.map((pg, i) => ({ img: pg as unknown as TexImageSource, width: pg.width, height: pg.height, pics: on[i]! })),
      fill: (c) => io.fill(c),
      close: () => {
        for (const p of pages) p.close();
      },
    };
  };
  return within(go(), waitMs, (r) => r?.close());
}

/** Turns pages into PNGs (keep-pictures.worker.ts in the browser). */
export interface SaveIO {
  /** Page `p` of `m`: its pictures drawn in place. */
  compose(m: Manifest, p: number, pics: readonly HTMLCanvasElement[]): Promise<Blob>;
}

/**
 * Keeps this visit's pictures for the next (`Pictures` after a clean loading screen), one page at a time: what it kept (bytes), or null
 * (nothing kept, and any older entry cleared): no storage, more than `TOWN_PICTURES.maxMB`, or anything that fails.
 */
export async function save(shelf: Shelf | null, key: string, pics: Pictures, io: SaveIO | null): Promise<number | null> {
  if (!TOWN_PICTURES.on || !shelf || !io || pics.from || !pics.list.length) return null;
  try {
    const m = manifestOf(key, pics);
    const blobs: Blob[] = [];
    let bytes = 0;
    for (let p = 0; p < m.pages.length / 2; p++) {
      const b = await io.compose(m, p, pics.list);
      bytes += b.size;
      if (!b.size || bytes > TOWN_PICTURES.maxMB * 1024 * 1024) throw new Error("kept pictures: too big");
      blobs.push(b);
    }
    await shelf.write({ manifest: m, blobs });
    return bytes;
  } catch {
    await drop(shelf);
    return null;
  }
}

// ---- The browser's parts.

const DB = "hunchess-town";
const STORE = "pictures";
const ID = "town";

/** The entry in IndexedDB (null: none in this browser). Each call opens the database and closes it after. */
export function idbShelf(): Shelf | null {
  if (typeof indexedDB === "undefined") return null;
  const open = () =>
    new Promise<IDBDatabase>((ok, no) => {
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(STORE);
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
      q.onblocked = () => no(new Error("blocked"));
    });
  const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    try {
      return await new Promise<T>((ok, no) => {
        const tx = db.transaction(STORE, mode);
        const q = f(tx.objectStore(STORE));
        tx.oncomplete = () => ok(q.result as T);
        tx.onerror = () => no(tx.error);
        tx.onabort = () => no(tx.error ?? new Error("aborted"));
      });
    } finally {
      db.close();
    }
  };
  return {
    read: () => run("readonly", (s) => s.get(ID)),
    write: (e) => run("readwrite", (s) => s.put(e, ID)),
    clear: () => run("readwrite", (s) => s.delete(ID)),
  };
}

/** (`domPageIO`) Each stand-in not cut yet: what cuts it. */
const uncut = new WeakMap<object, () => void>();
let cutOnDraw = false;
/**
 * (Nov 25, round 2) A 2D context drawing FROM a stand-in (or making a pattern of one) cuts it first. Drawing from a canvas never asks
 * for its context, so a picture drawn anywhere but the WebGL painter (which cuts one before uploading it alone, paint-gl.ts `upload`)
 * copied an empty canvas: the chips' and the large map's boss faces were blank on a repeat visit (render.ts `chipFace`). One place for
 * every 2D reader there is or will be, rather than a cut at each. Set once, as the first stand-in is made (never on a first visit or a
 * 2D painter); a draw from anything else costs one WeakMap look.
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

/** Decoding pages, and cutting their pictures as they're asked for, in the browser (null: it can't). */
export function domPageIO(art2d: (c: HTMLCanvasElement) => CanvasRenderingContext2D): PageIO | null {
  if (typeof createImageBitmap !== "function") return null;
  const fill = (c: HTMLCanvasElement) => uncut.get(c)?.();
  const own = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => RenderingContext | null;
  return {
    // (Its pixels as they are: no color space conversion, alpha as the browser keeps a canvas's (premultiplied), so a cut is the painted
    // canvas exactly and the atlas holds what the painted canvas gave it: every texel of every page the same, measured Nov 25 (Chromium),
    // and twice as quick to upload as one made "premultiply", 11 ms a page against 27.)
    decode: (b) => createImageBitmap(b, { colorSpaceConversion: "none", premultiplyAlpha: "default" }),
    standIn: (page, x, y, w, h) => {
      cutBeforeDraw();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      // (Its 2D context asked for (anything reading or drawing on its pixels), or a 2D context drawing from it (`cutBeforeDraw`): cut
      // first. No canvas is made for the picture until then.)
      c.getContext = function (this: HTMLCanvasElement, ...a: Parameters<HTMLCanvasElement["getContext"]>) {
        fill(c);
        return own.apply(this, a);
      } as HTMLCanvasElement["getContext"];
      uncut.set(c, () => {
        uncut.delete(c);
        delete (c as { getContext?: unknown }).getContext;
        try {
          art2d(c).drawImage(page as ImageBitmap, x, y, w, h, 0, 0, w, h);
        } catch {
          // (Its page let go: the town closed. It stays empty.)
        }
      });
      return c;
    },
    fill,
  };
}

/**
 * Composing and encoding pages in the browser: each page drawn on the main thread, a slice a frame, then encoded as PNG in a worker
 * (null: no worker or OffscreenCanvas). Stops once `alive` says no. Call `done` when finished.
 */
export function domSaveIO(art2d: (c: HTMLCanvasElement) => CanvasRenderingContext2D, alive: () => boolean, sliceMs: number = TOWN_PICTURES.sliceMs): (SaveIO & { done(): void }) | null {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") return null;
  let w: Worker | null = null;
  let n = 0;
  const waiting = new Map<number, { ok: (b: Blob) => void; no: (e: unknown) => void }>();
  const worker = () => {
    if (w) return w;
    w = new Worker(new URL("./keep-pictures.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
      const q = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      if (e.data.blob) q?.ok(e.data.blob);
      else q?.no(new Error(e.data.error ?? "encode"));
    };
    w.onerror = (e) => {
      for (const q of waiting.values()) q.no(e);
      waiting.clear();
    };
    return w;
  };
  return {
    compose: async (m, p, pics) => {
      const cv = document.createElement("canvas");
      cv.width = m.pages[p * 2]!;
      cv.height = m.pages[p * 2 + 1]!;
      const g = art2d(cv);
      // (`sliceMs` a frame: the loading screen's slice, as it's kept under the card since Nov 28; stopped if the town closes.)
      let t = performance.now();
      for (let i = 0; i < pics.length; i++) {
        if (m.pics[i * 5] !== p) continue;
        g.drawImage(pics[i]!, m.pics[i * 5 + 1]!, m.pics[i * 5 + 2]!);
        if (performance.now() - t > sliceMs) {
          await new Promise<void>((go) => requestAnimationFrame(() => go()));
          if (!alive()) throw new Error("kept pictures: the town closed");
          t = performance.now();
        }
      }
      const bm = await createImageBitmap(cv);
      // (Let go of the page's pixels at once: one page in memory at a time.)
      cv.width = cv.height = 0;
      const id = ++n;
      return new Promise<Blob>((ok, no) => {
        waiting.set(id, { ok, no });
        worker().postMessage({ id, page: bm }, [bm]);
      });
    },
    done: () => {
      w?.terminate();
      w = null;
    },
  };
}
