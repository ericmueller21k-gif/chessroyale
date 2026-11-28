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
 * All or nothing: the manifest unread, a file missing or not its size, or a picture this town draws not in it (`fits` in render.ts)
 * gives null, before anything is put in place, and the town paints on the device as before.
 */
import type { PageIO, Page } from "./keep-pictures.ts";
import type { AtlasPage } from "./paint.ts";
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

/** Where the files come from (baked-files.ts in the browser; tests pass their own). */
export interface BakedNet {
  manifest(): Promise<TownManifest | null>;
  file(name: string): Promise<Blob>;
}

/**
 * The baked town for a town of this `kind` (null: paint on the device). `onShare`: the share of its bytes in and decoded so far (0 to
 * 1), as each file lands.
 */
export async function loadBaked(kind: TownKind, net: BakedNet, io: PageIO | null, onShare: (share: number) => void = () => {}): Promise<Baked | null> {
  if (!io) return null;
  const m = await net.manifest().catch(() => null);
  if (!m) return null;
  const want = filesOf(m, kind);
  const total = want.reduce((s, i) => s + m.files[i]!.bytes, 0) || 1;
  let got = 0;
  const decoded = want.map((i) =>
    net
      .file(m.files[i]!.name)
      .then((b) => io.decode(b))
      .then((pg) => {
        onShare((got += m.files[i]!.bytes) / total);
        return pg;
      }),
  );
  let pages: Page[];
  try {
    pages = await Promise.all(decoded);
  } catch {
    for (const d of decoded) d.then((p) => p.close(), () => undefined);
    return null;
  }
  if (pages.some((p, k) => p.width !== m.files[want[k]!]!.w || p.height !== m.files[want[k]!]!.h)) {
    for (const p of pages) p.close();
    return null;
  }
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
