/**
 * Chess Town's pictures as the build baked them, loaded (Nov 28, the town's structure, phase 1b: DESIGN.md §2,
 * docs/decisions/2026-11-28-town-load-baked.md). The build paints every picture the town draws that is the same for every player
 * (pictures.ts, scripts/bake-town.ts) into files: a PNG a group's page, and a manifest. Here the loading screen fetches the manifest and
 * this town's files (baked-files.ts; the service worker keeps them), has the browser decode them off the main thread, and hands them to
 * the painter whole (`Painter.adopt`): nothing is painted on the device, on a first visit or a later one.
 *
 * Each picture is a canvas standing in for it (keep-pictures.ts `PageIO.standIn`: empty until something asks for its pixels, then cut
 * from its page), asked for by name (`pic`): render.ts's `plan` puts one where each painting would have gone. With them come what the
 * renderer worked out beside its paintings: each roof's and glow's pieces, each animation's frame times (so no animation is built to
 * count its frames), each box's solid top.
 *
 * All or nothing: the manifest unread, a file missing or not its size, or a picture this town draws not in it (`takeBaked` in render.ts)
 * gives none of it, before anything is put in place, and the town paints on the device as before, saying why once a page
 * (`TOWN_BAKED_FALLBACK`, problems.ts). So does a load where nothing arrives for `TOWN_PICTURES.stallMs` (a connection that hangs): the
 * loading screen never waits on a request that will never answer. The town closing mid-load stops the fetching and decoding.
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
  /** The files and the pictures standing in on each so far, for the painter to upload whole (`Painter.adopt`). */
  pages(): AtlasPage[];
  /** Puts a picture's pixels on its canvas now, if they aren't yet (the painter's `fill`). */
  fill(c: HTMLCanvasElement): void;
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
  /** Aborted as the town closes: nothing more is fetched or decoded, and null comes back (not a fallback: nothing to report). */
  closed?: AbortSignal;
  /** The limit with nothing arriving (`TOWN_PICTURES.stallMs`). */
  stallMs?: number;
}

/** (`loadBaked`) How often the stall is checked. Time with the page hidden doesn't count: a phone holds a hidden page's requests. */
const STALL_TICK_MS = 1000;
const pageHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * The baked town for a town of this `kind`. Else why not, and the device paints (`TOWN_BAKED_FALLBACK`): the manifest unread, a file
 * that didn't come, didn't decode or isn't its size, or nothing arriving for `stallMs`. Null: the town closed meanwhile.
 */
export async function loadBaked(kind: TownKind, net: BakedNet, io: PageIO | null, o: LoadBaked = {}): Promise<Baked | TownBakedFallback | null> {
  const { onShare = () => {}, closed, stallMs = TOWN_PICTURES.stallMs } = o;
  if (closed?.aborted) return null;
  if (!io) return "decode";
  // One switch stops every fetch and the wait for them: the town closing, or the stall below.
  const stop = new AbortController();
  const stopped = new Promise<never>((_, no) => stop.signal.addEventListener("abort", () => no(new Error("stopped")), { once: true }));
  stopped.catch(() => undefined);
  const onClose = () => stop.abort();
  closed?.addEventListener("abort", onClose, { once: true });
  // The stall (the review of phase 1b, S2): a request that never answers would hold the loading card up for good. Only when nothing
  // moves: any byte of any file, or a file decoded, starts the count again, so a slow connection still coming in is never cut off.
  let quiet = 0;
  let stalled = false;
  const moved = () => void (quiet = 0);
  const watch = setInterval(() => {
    if (pageHidden()) return;
    if ((quiet += STALL_TICK_MS) >= stallMs) {
      stalled = true;
      stop.abort();
    }
  }, STALL_TICK_MS);
  const ask: NetAsk = { signal: stop.signal, moved };
  /** How it ended: the town closed (null), nothing arrived (`stall`), else `why`. */
  const ended = (why: TownBakedFallback): TownBakedFallback | null => (closed?.aborted ? null : stalled ? "stall" : why);
  const decoded: Promise<Page>[] = [];
  const letGo = () => {
    for (const d of decoded) d.then((p) => p.close(), () => undefined);
  };
  try {
    const m = await Promise.race([net.manifest(ask), stopped]).catch(() => null);
    if (!m) return ended("manifest");
    const want = filesOf(m, kind);
    const total = want.reduce((s, i) => s + m.files[i]!.bytes, 0) || 1;
    let got = 0;
    /** The first thing that went wrong with a file. */
    let failed: TownBakedFallback | null = null;
    const fail = (why: TownBakedFallback) => {
      failed ??= why;
      throw new Error(why);
    };
    for (const i of want) {
      const f = m.files[i]!;
      decoded.push(
        (async () => {
          const b = await net.file(f.name, ask).catch(() => fail("file"));
          // (Stopped meanwhile: not decoded.)
          if (stop.signal.aborted) return fail("file");
          const pg = await io.decode(b).catch(() => fail("decode"));
          moved();
          if (!stop.signal.aborted) onShare((got += f.bytes) / total);
          return pg;
        })(),
      );
    }
    let pages: Page[];
    try {
      pages = await Promise.race([Promise.all(decoded), stopped]);
    } catch {
      letGo();
      return ended(failed ?? "file");
    }
    if (closed?.aborted || pages.some((p, k) => p.width !== m.files[want[k]!]!.w || p.height !== m.files[want[k]!]!.h)) {
      letGo();
      return ended("size");
    }
    return baked(m, want, pages, io);
  } finally {
    clearInterval(watch);
    closed?.removeEventListener("abort", onClose);
  }
}

/** (`loadBaked`) The loaded town over its decoded files. */
function baked(m: TownManifest, want: number[], pages: Page[], io: PageIO): Baked {
  /** Each fetched file's page, by its index in the manifest; and the pictures standing in on it. */
  const pageOf = new Map<number, Page>(want.map((i, k) => [i, pages[k]!]));
  const on = new Map<number, { src: HTMLCanvasElement; x: number; y: number }[]>(want.map((i) => [i, []]));
  return {
    manifest: m,
    files: want.length,
    bytes: want.reduce((s, i) => s + m.files[i]!.bytes, 0),
    has: (name) => {
      const at = m.pictures[name];
      return !!at && pageOf.has(at[0]);
    },
    pic: (name) => {
      const at = m.pictures[name];
      const page = at && pageOf.get(at[0]);
      if (!page) throw new Error(`baked town: no picture "${name}"`);
      const [f, x, y, w, h] = at;
      const src = io.standIn(page, x, y, w, h);
      on.get(f)!.push({ src, x, y });
      return src;
    },
    pages: () => want.map((i) => ({ img: pageOf.get(i) as unknown as TexImageSource, width: m.files[i]!.w, height: m.files[i]!.h, pics: on.get(i)! })),
    fill: (c) => io.fill(c),
    close: () => {
      for (const p of pages) p.close();
    },
  };
}

/**
 * Hands whole pages to the painter (`Painter.adopt`). Pages it couldn't take whole (no room left on the atlas: never today, 9 or 10
 * layers of 46): each picture kept alone as a painted one is (`keep`), so it's still uploaded under the loading card, never on its
 * first draw. Says whether it took them whole.
 */
export function adoptOrKeep(painter: Pick<Painter, "adopt" | "keep">, pages: readonly AtlasPage[], fill: (src: HTMLCanvasElement) => void): boolean {
  if (painter.adopt?.(pages, fill)) return true;
  for (const pg of pages) for (const p of pg.pics) painter.keep?.(p.src);
  return false;
}
