/**
 * Chess Town's pictures kept between visits (Nov 23, Eric: "the drawn pictures between visits ... it seems like just smart").
 *
 * The loading screen paints every picture the town can show (render.ts `warm`) before the first frame (Eric's rule: nothing painted
 * while you walk). On the first visit on a build, that's as before; then the pictures are packed into pages, encoded as PNG off the
 * main thread (keep-pictures.worker.ts) and kept in IndexedDB with a manifest: each picture's place on its page, in the order the
 * loading screen keeps them, and each roof's pieces. A later visit on the same build and layout (`pictureKey`) decodes the pages and
 * cuts each picture out into a canvas of its own, put where its painting would have gone (render.ts `plan`): the town draws exactly
 * what it drew before, from the same canvases.
 *
 * It never breaks the town: no storage, a quota error, a missing, partial, corrupt or other build's entry, a decode failure or a slow
 * read (`TOWN_PICTURES.waitMs`) paints as before, silently, and the entry is cleared. Only one entry is ever kept (the last build's).
 * docs/decisions/2026-11-23-town-keep-pictures.md.
 */
import { TOWN_PICTURES } from "@chessroyale/core";
import type { Piece, RoofArt } from "./box-draw.ts";

/** A decoded page (an ImageBitmap in the browser). */
export interface Page {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** What's kept: the manifest and its pages' PNGs. */
export interface Manifest {
  v: 1;
  key: string;
  /** Each page's width and height, two numbers a page. */
  pages: number[];
  /** Each picture's page, x, y, width and height, five numbers a picture, in the order the loading screen keeps them. */
  pics: number[];
  /** Each roof painted, in the loading screen's order: its faces, each its whole then its triangles, seven numbers a piece
   * (picture, sx, sy, w, h, ox, oy). */
  roofs: number[][][];
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
  /** Picture `i`, cut from its page the first time it's asked for. */
  pic(i: number): HTMLCanvasElement;
  /** Lets go of the decoded pages. */
  close(): void;
}

/** The browser's part (tests pass their own). */
export interface PageIO {
  decode(b: Blob): Promise<Page>;
  cut(page: Page, x: number, y: number, w: number, h: number): HTMLCanvasElement;
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
  /** (A later visit, once every job ran) whether every kept picture and roof was used: the layout was the last visit's. */
  matched(): boolean {
    return !!this.from && this.list.length === this.from.count && this.roofAt === this.from.roofs.length;
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

/**
 * Pictures of these sizes packed onto pages `side` px wide (shelves, tallest first; one wider than a page has a page its width): each
 * picture's page, x and y, and each page's size (as tall as it's filled).
 */
export function packPictures(sizes: readonly (readonly [number, number])[], side: number): { at: [number, number, number][]; pages: [number, number][] } {
  const at: [number, number, number][] = sizes.map(() => [0, 0, 0]);
  const pages: { w: number; h: number; shelves: { y: number; h: number; x: number }[] }[] = [];
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]![1] - sizes[a]![1] || sizes[b]![0] - sizes[a]![0]);
  for (const i of order) {
    const [w, h] = sizes[i]!;
    let placed = false;
    for (let p = 0; p < pages.length && !placed; p++) {
      const pg = pages[p]!;
      let s = pg.shelves.find((sh) => sh.h >= h && pg.w - sh.x >= w);
      if (!s && pg.h + h <= side && w <= pg.w) pg.shelves.push((s = { y: pg.h, h, x: 0 })), (pg.h += h);
      if (s) {
        at[i] = [p, s.x, s.y];
        s.x += w;
        placed = true;
      }
    }
    if (!placed) {
      const pg = { w: Math.max(side, w), h, shelves: [{ y: 0, h, x: w }] };
      at[i] = [pages.length, 0, 0];
      pages.push(pg);
    }
  }
  return { at, pages: pages.map((p) => [p.w, Math.max(1, p.h)]) };
}

/** The manifest for these pictures, packed (`packPictures`). */
export function manifestOf(key: string, pics: Pictures, side: number): Manifest {
  const { at, pages } = packPictures(
    pics.list.map((c) => [c.width, c.height] as const),
    side,
  );
  return { v: 1, key, pages: pages.flat(), pics: at.flatMap(([p, x, y], i) => [p, x, y, pics.list[i]!.width, pics.list[i]!.height]), roofs: pics.roofs };
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
/** `e` as an entry for `key`, every number in its place and every picture on its page; null if it's anything else. */
export function entryFor(e: unknown, key: string): Entry | null {
  const x = e as Partial<Entry> | null;
  const m = x?.manifest;
  if (!m || m.v !== 1 || m.key !== key || !Array.isArray(x!.blobs) || !Array.isArray(m.pages) || !Array.isArray(m.pics) || !Array.isArray(m.roofs)) return null;
  const nPages = m.pages.length / 2;
  if (!Number.isInteger(nPages) || nPages !== x!.blobs.length || !m.pages.every(isInt)) return null;
  if (!x!.blobs.every((b) => typeof Blob !== "undefined" && b instanceof Blob && b.size > 0)) return null;
  const n = m.pics.length / 5;
  if (!Number.isInteger(n) || !m.pics.every(isInt)) return null;
  for (let i = 0; i < n; i++) {
    const [p, px, py, w, h] = m.pics.slice(i * 5, i * 5 + 5) as [number, number, number, number, number];
    if (p >= nPages || !w || !h || px + w > m.pages[p * 2]! || py + h > m.pages[p * 2 + 1]!) return null;
  }
  for (const r of m.roofs) {
    // (A roof may have no faces: a box with none drawn from above.)
    if (!Array.isArray(r)) return null;
    for (const f of r) if (!Array.isArray(f) || !f.length || f.length % 7 || !f.every((v, j) => (j % 7 ? typeof v === "number" && Number.isFinite(v) : isInt(v) && v < n))) return null;
  }
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
    const cut: (HTMLCanvasElement | undefined)[] = new Array(n);
    let left = n;
    const close = () => {
      for (const p of pages) p.close();
      pages = [];
    };
    return {
      count: n,
      roofs: m.roofs,
      pic: (i: number) => {
        let c = cut[i];
        if (c) return c;
        if (i >= n || !pages.length) throw new Error("kept pictures: past the end");
        const [p, x, y, w, h] = m.pics.slice(i * 5, i * 5 + 5) as [number, number, number, number, number];
        c = cut[i] = io.cut(pages[p]!, x, y, w, h);
        if (--left === 0) close();
        return c;
      },
      close,
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
    const m = manifestOf(key, pics, TOWN_PICTURES.pagePx);
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

/** Decoding and cutting pages in the browser (null: it can't). */
export function domPageIO(art2d: (c: HTMLCanvasElement) => CanvasRenderingContext2D): PageIO | null {
  if (typeof createImageBitmap !== "function") return null;
  return {
    // (Its pixels as they are: no color space conversion, alpha as the canvas keeps it, so a cut is the painted canvas exactly.)
    decode: (b) => createImageBitmap(b, { colorSpaceConversion: "none", premultiplyAlpha: "default" }),
    cut: (page, x, y, w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      art2d(c).drawImage(page as ImageBitmap, x, y, w, h, 0, 0, w, h);
      return c;
    },
  };
}

/**
 * Composing and encoding pages in the browser: each page drawn on the main thread, a slice a frame, then encoded as PNG in a worker
 * (null: no worker or OffscreenCanvas). Stops once `alive` says no. Call `done` when finished.
 */
export function domSaveIO(art2d: (c: HTMLCanvasElement) => CanvasRenderingContext2D, alive: () => boolean): (SaveIO & { done(): void }) | null {
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
      // (A few milliseconds a frame (`TOWN_PICTURES.sliceMs`), so the first visit's walk doesn't feel it; stopped if the town closes.)
      let t = performance.now();
      for (let i = 0; i < pics.length; i++) {
        if (m.pics[i * 5] !== p) continue;
        g.drawImage(pics[i]!, m.pics[i * 5 + 1]!, m.pics[i * 5 + 2]!);
        if (performance.now() - t > TOWN_PICTURES.sliceMs) {
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
