/**
 * The baked town's files, fetched (Nov 28, the town's structure, phase 1b: docs/decisions/2026-11-28-town-load-baked.md). The build
 * paints Chess Town's pictures and writes them under /town-pictures/ with a manifest named by its contents (scripts/bake-town.ts), and
 * hands this build that name (`__TOWN_PICTURES__`, vite.config.ts). The town's loading screen fetches the manifest and this town's
 * files through here (town/baked.ts); home fetches the same files when idle, one at a time at low priority (`fetchTownAhead`), so
 * the service worker keeps them (sw-template.js, TOWN_FILE) before the first visit to the town. No town code here: the main bundle
 * holds it.
 */
import { TOWN_PICTURES } from "@chessroyale/core";
import { TOWN_PICTURES_DIR, filesOf, manifestFrom, type TownKind, type TownManifest } from "./manifest.ts";

declare const __TOWN_PICTURES__: string | undefined;
/** This build's baked town's manifest's name (null: none baked for it; tests). */
export const TOWN_MANIFEST: string | null = typeof __TOWN_PICTURES__ === "string" && __TOWN_PICTURES__ ? __TOWN_PICTURES__ : null;

/** Files being fetched now, by name: the town's loading screen and home's fetch ahead never download one twice at once. */
const fetching = new Map<string, Promise<Blob>>();

/**
 * One baked file as the server (or the service worker's kept copy) has it. Rejects for anything but the file itself: no answer, an
 * error, or the app's page sent for a file the server no longer has. `low`: at low priority (home's fetch ahead).
 */
export function bakedFile(name: string, low = false): Promise<Blob> {
  let p = fetching.get(name);
  if (!p) {
    const want = name.endsWith(".json") ? "json" : "image/png";
    p = fetch(`/${TOWN_PICTURES_DIR}/${name}`, low ? ({ priority: "low" } as RequestInit) : undefined)
      .then((res) => (res.ok && (res.headers.get("content-type") ?? "").includes(want) ? res.blob() : Promise.reject(new Error(`${name}: ${res.status}`))))
      .finally(() => fetching.delete(name));
    fetching.set(name, p);
  }
  return p;
}

let manifest: Promise<TownManifest | null> | null = null;
/** This build's manifest, fetched and read once a page (null: none, or it couldn't be read; asked again next time then). */
export function bakedManifest(): Promise<TownManifest | null> {
  if (!TOWN_MANIFEST || !TOWN_PICTURES.baked) return Promise.resolve(null);
  return (manifest ??= bakedFile(TOWN_MANIFEST)
    .then((b) => b.text())
    .then((t) => manifestFrom(JSON.parse(t)))
    .catch(() => null)
    .then((m) => {
      if (!m) manifest = null;
      return m;
    }));
}

/**
 * Home, once it has shown a while (`TOWN_PICTURES.homeFetchAfterMs`) and the page is idle: the town's files fetched ahead, one at a
 * time at low priority, each read to its end and let go (the service worker keeps it as it passes), as the town fetches the bosses'
 * music. Not on a connection that asks to save data. Call what it returns to stop (home closed).
 */
export function fetchTownAhead(kind: TownKind): () => void {
  let live = true;
  const go = async () => {
    const m = live ? await bakedManifest() : null;
    if (!m) return;
    for (const i of filesOf(m, kind)) {
      if (!live) return;
      await bakedFile(m.files[i]!.name, true).catch(() => undefined);
    }
  };
  const saving = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const timer = saving || !TOWN_MANIFEST ? null : setTimeout(() => (idle ? idle(() => void go(), { timeout: 3000 }) : void go()), TOWN_PICTURES.homeFetchAfterMs);
  return () => {
    live = false;
    if (timer !== null) clearTimeout(timer);
  };
}
