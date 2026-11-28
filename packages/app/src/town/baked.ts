/**
 * Chess Town's pictures as the build baked them, loaded (Nov 28, the town's structure, phase 1: DESIGN.md §2,
 * docs/decisions/2026-11-28-town-load-baked.md, 2026-11-28-town-no-device-painting.md). The build paints every picture the town draws
 * that is the same for every player (pictures.ts, scripts/bake-town.ts) into files: a PNG a group's page, and a manifest. Here the
 * loading screen fetches the manifest and this town's files (baked-files.ts; the service worker keeps them), has the browser decode
 * them off the main thread, and hands them to the painter whole (`Painter.adopt`): nothing is painted on the device.
 *
 * Each picture is a canvas standing in for it (keep-pictures.ts `PageIO.standIn`: empty until something asks for its pixels), asked for
 * by name (`pic`): render.ts's `plan` puts one in each picture's place. With them come each roof's and glow's pieces, each animation's
 * frame times (so no animation is built to count its frames), each box's solid top.
 *
 * Memory (phase 1c, the review of 1b, S6): once the painter has uploaded the files whole they're let go (`release`: 145 to 160 MB of
 * decoded pixels, held beside the GPU's copy until then). A picture's pixels, should a 2D context still ask for them, are read back
 * from the GPU. After a lost WebGL context the files are fetched and decoded again (`reopen`: the service worker has them) and handed
 * to the painter again.
 *
 * All or nothing, and no other way to make them (phase 1c: the device no longer paints): the manifest unread, a file that didn't come,
 * didn't decode or isn't its size after its retries (`TOWN_PICTURES.retryMs`: asked for again, twice), or a picture this town draws
 * not in the manifest (`takeBaked` in render.ts), and the loading card says the town didn't load, with Retry, the page saying why once
 * (`TOWN_BAKED_FALLBACK`, problems.ts). So does a load where nothing arrives for `TOWN_PICTURES.stallMs` (a connection that hangs):
 * the loading screen never waits on a request that will never answer. The town closing mid-load stops the fetching and decoding.
 */
import { TOWN_PICTURES, type TownBakedFallback } from "@chessroyale/core";
import type { PageIO, Page } from "./keep-pictures.ts";
import type { AtlasPage, Painter } from "./paint.ts";
import { filesOf, type TownKind, type TownManifest } from "./manifest.ts";

/** The baked town, loaded: its manifest and this town's files, decoded. */
export interface Baked {
  readonly manifest: TownManifest;
  /** How many files it fetched, and their bytes. */
  readonly files: number;
  readonly bytes: number;
  /** Whether picture `name` is here: in the manifest, on a file this town fetched. */
  has(name: string): boolean;
  /** A canvas standing in for picture `name`: a new one each call (the device kept a canvas a painting), empty until its pixels are asked for. */
  pic(name: string): HTMLCanvasElement;
  /** Whether its decoded files are in memory now (until `release`, and again after `reopen`). */
  readonly open: boolean;
  /** The files and the pictures standing in on each so far, for the painter to upload whole (`Painter.adopt`). While `open` only. */
  pages(): AtlasPage[];
  /** Puts a picture's pixels on its canvas now, if they aren't yet (the painter's `fill`): false if they can't be read just now. */
  fill(c: HTMLCanvasElement): boolean;
  /**
   * Lets go of the decoded files, the painter holding them whole: from here a picture's pixels, should something still ask for them,
   * are `read(c)` (the painter's: what the GPU holds for it, null if it can't say just now).
   */
  release(read: (c: HTMLCanvasElement) => ImageData | null): void;
  /**
   * Fetches and decodes its files again (after a lost context: the painter needs them once more). "ok", else why not (as `loadBaked`),
   * or null: stopped (`closed`).
   */
  reopen(net: BakedNet, o?: LoadBaked): Promise<"ok" | TownBakedFallback | null>;
  /** Lets go of the decoded files (the town closing: a picture still empty stays so). */
  close(): void;
}

/** What a fetch is handed: `signal` stops it (the town closed, or the load stalled); `moved` is called as its bytes arrive. */
export interface NetAsk {
  signal: AbortSignal;
  moved: () => void;
}
/** Where the files come from (baked-files.ts in the browser; tests pass their own). */
export interface BakedNet {
  manifest(ask: NetAsk): Promise<TownManifest | null>;
  file(name: string, ask: NetAsk): Promise<Blob>;
}

export interface LoadBaked {
  /** The share of its bytes in and decoded so far (0 to 1), as each file lands. */
  onShare?: (share: number) => void;
  /** Aborted as the town closes: nothing more is fetched or decoded, and null comes back (not a failure: nothing to report). */
  closed?: AbortSignal;
  /** The limit with nothing arriving (`TOWN_PICTURES.stallMs`). */
  stallMs?: number;
  /** The waits before a failed file is asked for again (`TOWN_PICTURES.retryMs`). */
  retryMs?: readonly number[];
}

/** (`stallWatch`) How often the stall is checked. */
const STALL_TICK_MS = 1000;
const pageHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * The loading screen's no-progress guard (the review of phase 1b, S2): `stalled()` runs once `ms` have passed with nothing moving
 * (`moved()` starts the count again). Time with the page hidden doesn't count: a phone holds a hidden page's requests. Only when
 * nothing moves, so a slow connection still coming in is never cut off. `stop()` ends it.
 */
export function stallWatch(ms: number, stalled: () => void): { moved(): void; stop(): void } {
  let quiet = 0;
  const watch = setInterval(() => {
    if (pageHidden()) return;
    if ((quiet += STALL_TICK_MS) < ms) return;
    clearInterval(watch);
    stalled();
  }, STALL_TICK_MS);
  return { moved: () => void (quiet = 0), stop: () => clearInterval(watch) };
}

/**
 * Waits for every one of `all` to settle (the loading screen's fonts, crate items and rides: no time cap, Eric's "load first, then
 * show"). True: all settled. False: nothing of them settled for `stallMs` (the page showing), or `closed` stopped the wait: what's
 * still on its way shows when it lands.
 */
export function settledOrStalled(all: readonly Promise<unknown>[], stallMs: number = TOWN_PICTURES.stallMs, closed?: AbortSignal): Promise<boolean> {
  if (!all.length) return Promise.resolve(true);
  if (closed?.aborted) return Promise.resolve(false);
  return new Promise((done) => {
    let left = all.length;
    const end = (ok: boolean) => {
      watch.stop();
      closed?.removeEventListener("abort", onClose);
      done(ok);
    };
    const onClose = () => end(false);
    const watch = stallWatch(stallMs, () => end(false));
    closed?.addEventListener("abort", onClose, { once: true });
    const one = () => {
      watch.moved();
      if (--left === 0) end(true);
    };
    for (const p of all) p.then(one, one);
  });
}

/** A wait of `ms` that `signal` cuts short (it rejects then). */
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((go, no) => {
    if (signal.aborted) return no(new Error("stopped"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      go();
    }, ms);
    const stop = () => {
      clearTimeout(t);
      no(new Error("stopped"));
    };
    signal.addEventListener("abort", stop, { once: true });
  });

/**
 * (`loadBaked`, `reopen`) One fetching of files under one stall watch: `run` is handed what each fetch needs and `again`, which asks
 * for one thing up to three times in all (`retryMs` apart). What `run` gives; else why it ended (`stall`, or `run`'s own reason); null:
 * the town closed.
 */
async function fetching<T>(o: LoadBaked, run: (ask: NetAsk, again: <V>(why: () => TownBakedFallback, get: () => Promise<V>) => Promise<V>, stop: AbortSignal) => Promise<T | TownBakedFallback>): Promise<T | TownBakedFallback | null> {
  const { closed, stallMs = TOWN_PICTURES.stallMs, retryMs = TOWN_PICTURES.retryMs } = o;
  if (closed?.aborted) return null;
  // One switch stops every fetch and the wait for them: the town closing, or the stall.
  const stop = new AbortController();
  const stopped = new Promise<never>((_, no) => stop.signal.addEventListener("abort", () => no(new Error("stopped")), { once: true }));
  stopped.catch(() => undefined);
  const onClose = () => stop.abort();
  closed?.addEventListener("abort", onClose, { once: true });
  let stalled = false;
  const watch = stallWatch(stallMs, () => {
    stalled = true;
    stop.abort();
  });
  /** The first thing that went wrong for good (its retries spent). */
  let failed: TownBakedFallback | null = null;
  const again = async <V>(why: () => TownBakedFallback, get: () => Promise<V>): Promise<V> => {
    for (let tries = 0; ; tries++) {
      try {
        return await get();
      } catch (e) {
        if (stop.signal.aborted || tries >= retryMs.length) {
          failed ??= why();
          throw e;
        }
        await pause(retryMs[tries]!, stop.signal);
      }
    }
  };
  try {
    const got = await Promise.race([run({ signal: stop.signal, moved: watch.moved }, again, stop.signal), stopped]).catch(() => null);
    if (closed?.aborted) return null;
    if (stalled) return "stall";
    return got ?? failed ?? "file";
  } finally {
    watch.stop();
    closed?.removeEventListener("abort", onClose);
  }
}

/** (`loadBaked`, `reopen`) The files `want` of `m`, fetched and decoded, each its size: all of them, or none (what had decoded let go). */
async function pagesOf(m: TownManifest, want: readonly number[], net: BakedNet, io: PageIO, o: LoadBaked, ask: NetAsk, again: <V>(why: () => TownBakedFallback, get: () => Promise<V>) => Promise<V>, stop: AbortSignal): Promise<Page[]> {
  const { onShare = () => {} } = o;
  const total = want.reduce((s, i) => s + m.files[i]!.bytes, 0) || 1;
  let got = 0;
  const decoded = want.map((i) => {
    const f = m.files[i]!;
    /** Why this file's last try failed. */
    let why: TownBakedFallback = "file";
    return again(
      () => why,
      async () => {
        why = "file";
        const b = await net.file(f.name, ask);
        // (Stopped meanwhile: not decoded.)
        if (stop.aborted) throw new Error("stopped");
        why = "decode";
        const pg = await io.decode(b);
        if (pg.width !== f.w || pg.height !== f.h || stop.aborted) {
          pg.close();
          why = "size";
          throw new Error("size");
        }
        ask.moved();
        onShare((got += f.bytes) / total);
        return pg;
      },
    );
  });
  // (Stopped, the stall or the town closing: what has decoded is let go, and what decodes after. A request that never answers
  // would otherwise keep the rest in memory for good.)
  const letGo = () => {
    for (const d of decoded) d.then((p) => p.close(), () => undefined);
  };
  stop.addEventListener("abort", letGo, { once: true });
  try {
    const pages = await Promise.all(decoded);
    stop.removeEventListener("abort", letGo);
    return pages;
  } catch (e) {
    letGo();
    throw e;
  }
}

/**
 * The baked town for a town of this `kind`. Else why not (`TOWN_BAKED_FALLBACK`: the loading card then says the town didn't load): the
 * manifest unread, a file that didn't come, didn't decode or isn't its size (each asked for three times in all), or nothing arriving
 * for `stallMs`. Null: the town closed meanwhile.
 */
export async function loadBaked(kind: TownKind, net: BakedNet, io: PageIO | null, o: LoadBaked = {}): Promise<Baked | TownBakedFallback | null> {
  if (o.closed?.aborted) return null;
  if (!io) return "decode";
  return fetching<Baked>(o, async (ask, again, stop) => {
    const m = await again(
      () => "manifest",
      async () => (await net.manifest(ask)) ?? Promise.reject(new Error("manifest")),
    );
    const want = filesOf(m, kind);
    const pages = await pagesOf(m, want, net, io, o, ask, again, stop);
    if (stop.aborted) {
      for (const p of pages) p.close();
      throw new Error("stopped");
    }
    return baked(m, want, pages, io);
  });
}

/** (`loadBaked`) The loaded town over its decoded files. */
function baked(m: TownManifest, want: number[], first: Page[], io: PageIO): Baked {
  /** Each fetched file's page while it's open, by its index in the manifest; and the pictures standing in on each file. */
  let open: Map<number, Page> | null = new Map(want.map((i, k) => [i, first[k]!]));
  const on = new Map<number, { src: HTMLCanvasElement; x: number; y: number }[]>(want.map((i) => [i, []]));
  let read: ((c: HTMLCanvasElement) => ImageData | null) | null = null;
  const close = () => {
    for (const p of open?.values() ?? []) p.close();
    open = null;
  };
  return {
    manifest: m,
    files: want.length,
    bytes: want.reduce((s, i) => s + m.files[i]!.bytes, 0),
    has: (name) => {
      const at = m.pictures[name];
      return !!at && on.has(at[0]);
    },
    pic: (name) => {
      const at = m.pictures[name];
      if (!at || !on.has(at[0])) throw new Error(`baked town: no picture "${name}"`);
      const [f, x, y, w, h] = at;
      // (Its pixels: from its file while it's in memory; after `release`, what the GPU holds for it.)
      const src: HTMLCanvasElement = io.standIn(w, h, () => {
        const page = open?.get(f);
        if (page) return { page, x, y };
        const pixels = read?.(src);
        return pixels ? { pixels } : null;
      });
      on.get(f)!.push({ src, x, y });
      return src;
    },
    get open() {
      return !!open;
    },
    pages: () => want.map((i) => ({ img: open!.get(i) as unknown as TexImageSource, width: m.files[i]!.w, height: m.files[i]!.h, pics: on.get(i)! })),
    fill: (c) => io.fill(c),
    release: (from) => {
      read = from;
      close();
    },
    reopen: async (net, o = {}) => {
      close();
      const got = await fetching<Page[]>(o, (ask, again, stop) => pagesOf(m, want, net, io, o, ask, again, stop));
      if (!Array.isArray(got)) return got;
      if (o.closed?.aborted) {
        for (const p of got) p.close();
        return null;
      }
      open = new Map(want.map((i, k) => [i, got[k]!]));
      return "ok";
    },
    close,
  };
}

/**
 * Hands whole pages to the painter (`Painter.adopt`). Pages it couldn't take whole (no room left on the atlas: never today, 10 or 11
 * layers of 46): each picture kept alone as a painted one is (`keep`), so it's still uploaded under the loading card, never on its
 * first draw. Says whether it took them whole.
 */
export function adoptOrKeep(painter: Pick<Painter, "adopt" | "keep">, pages: readonly AtlasPage[], fill: (src: HTMLCanvasElement) => boolean): boolean {
  if (painter.adopt?.(pages, fill)) return true;
  for (const pg of pages) for (const p of pg.pics) painter.keep?.(p.src);
  return false;
}
