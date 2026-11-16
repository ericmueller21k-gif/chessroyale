// Battle Royale Chess service worker. Generated at build time by vite.config.ts from sw-template.js:
// VERSION, FILES, HASHES and KEEP are filled in. Caches the app shell and the chess engine so the app opens
// instantly and solo matches work offline. The API is never cached.
const VERSION = "__VERSION__";
const FILES = __FILES__;
// The Maia box (/engine/maia/: the worker, its runtime and the model, about 40 MB): not precached, but kept once
// fetched (a battle that uses it, or the boss menu's prefetch), in a cache named by its files' contents.
const MAIA = "__MAIA__";
// Media streamed by an <audio> element (the Colosseum's hour of ambience): never precached nor answered here, so the
// browser's own Range requests go straight to the network (Safari won't stream media through a service worker's reply).
const STREAMED = ["/sounds/colosseum/ambient.mp3"];
// Pictures (not precached: vite.config.ts's LAZY_FILES, the same test): kept in this version's cache the first time they're
// shown, then answered from it. The landing page's demo video (/media/) streams from the network like the ambience.
const LAZY = /\.(png|jpe?g|webp|gif|avif)$/;
// The bosses' music (/music/, not precached: fetched after the town's first frame or when a battle needs it, music.ts): kept once
// fetched in MUSIC_CACHE, which every version shares, each piece with its contents' hash (HASH_HEADER), and answered from it only
// while that's the hash in MUSIC_HASHES (Nov 14): a deploy fetches again only the songs it changed.
const MUSIC = "/music/";
const MUSIC_CACHE = "brc-music";
const MUSIC_HASHES = __MUSIC_HASHES__;

// Each precached file's contents' hash (but under /assets/, where Vite puts it in the name), kept on its cached copy as HASH_HEADER.
const HASHES = __HASHES__;
const HASH_HEADER = "x-brc-hash";

// The precache (Nov 10, "the first time was slow because it was downloading"): one file at a time at low priority, so what the page
// asks for meanwhile (PLAY's screens and engine, right after a first visit's load) isn't stuck behind 127 files at once (10 Mbps: 4.4 s
// for those, 2.7 s now). After a deploy only what changed is downloaded: a file an older version keeps with the same contents (the
// same name under /assets/, else the same hash) is copied over (a deploy's update: 3.8 MB before). A file already in this version's
// cache (an install tried before) is left as it is.
async function precache() {
  const cache = await caches.open(VERSION);
  for (const file of FILES) {
    if (await cache.match(file)) continue;
    const kept = await caches.match(file);
    if (kept && (file.startsWith("/assets/") || (HASHES[file] && kept.headers.get(HASH_HEADER) === HASHES[file]))) {
      await cache.put(file, kept);
      continue;
    }
    const res = await fetch(file, { priority: "low" });
    if (!res.ok) throw new Error(`precache: ${file} ${res.status}`);
    if (!HASHES[file]) await cache.put(file, res);
    else {
      const headers = new Headers(res.headers);
      headers.set(HASH_HEADER, HASHES[file]);
      await cache.put(file, new Response(res.body, { status: res.status, statusText: res.statusText, headers }));
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

// (The music cache's pieces that this version doesn't have, or has with other contents: let go.)
async function dropOldMusic() {
  const cache = await caches.open(MUSIC_CACHE);
  for (const req of await cache.keys()) {
    const kept = await cache.match(req);
    if (!kept || kept.headers.get(HASH_HEADER) !== MUSIC_HASHES[new URL(req.url).pathname]) await cache.delete(req);
  }
}

// An open tab keeps its version's files until it loads again (Nov 15: a tab left open across a deploy tapped a challenge, and its room's
// code was gone from the server and, deleted by the new worker as it took over, from the device: the page loaded again, the town at its
// center). Each version's cache stays while a tab runs that version: each tab is asked which entry script it runs (its index-*.js under
// /assets/), and a version whose cache holds one stays. A tab that doesn't answer in time (asleep in the background, or a version from
// before this) can't be told apart: then the newest KEEP versions stay too. The rest go, here and each time a page loads (its "brc-loaded"),
// so an old version's cache goes once no tab runs it.
const KEEP = __KEEP_VERSIONS__;
const ASK_MS = 1500;
const VERSION_NAME = /^brc-[0-9a-f]{12}$/;

/**
 * The version caches to keep (`versions`: every version's cache name, oldest first): this one, each one an open tab runs (`runs`: per
 * tab, the versions holding its entry script; null for a tab that didn't say), and, if any tab didn't say, the newest `keep`.
 */
function keptVersions(versions, current, runs, keep) {
  const kept = new Set([current]);
  for (const r of runs) for (const v of r ?? []) kept.add(v);
  if (runs.some((r) => r === null)) for (const v of versions.slice(-keep)) kept.add(v);
  return kept;
}

/** Which entry script a tab runs (its path), or null if it doesn't answer within ASK_MS. */
function askEntry(client) {
  return new Promise((ok) => {
    const ch = new MessageChannel();
    const done = (v) => {
      clearTimeout(timer);
      ch.port1.close();
      ok(v);
    };
    const timer = setTimeout(() => done(null), ASK_MS);
    ch.port1.onmessage = (e) => done(typeof e.data === "string" && e.data.startsWith("/assets/") ? e.data : null);
    try {
      client.postMessage({ type: "brc-entry?" }, [ch.port2]);
    } catch {
      done(null);
    }
  });
}

/** Lets go of the caches no open tab needs: other versions' (but those kept, keptVersions), an older Maia box's, and music this version doesn't have. */
async function prune() {
  const keys = await caches.keys();
  const versions = keys.filter((k) => VERSION_NAME.test(k));
  const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const entries = await Promise.all(tabs.map(askEntry));
  const runs = await Promise.all(
    entries.map(async (entry) => {
      if (!entry) return null;
      const holding = [];
      for (const v of versions) if (await (await caches.open(v)).match(entry)) holding.push(v);
      return holding;
    }),
  );
  const kept = keptVersions(versions, VERSION, runs, KEEP);
  await Promise.all(keys.filter((k) => !kept.has(k) && k !== MAIA && k !== MUSIC_CACHE).map((k) => caches.delete(k)));
  await dropOldMusic();
}

self.addEventListener("activate", (event) => {
  event.waitUntil(prune().then(() => self.clients.claim()));
});

// (A page loaded: the tabs it replaced are gone, so their versions' caches may go now.)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "brc-loaded") event.waitUntil(prune());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || STREAMED.includes(url.pathname)) return;
  // (The landing page's demo video: streamed too, never cached.)
  if (url.pathname.startsWith("/media/")) return;

  // Every page (including /lobby/CODE invite links) is the single-page app. Fetch it fresh so an
  // update shows up on the next open; fall back to the cached copy only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(VERSION)
          .then((cache) => cache.match("/"))
          .then((cached) => cached || caches.match("/"))
          .then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  // (Not its source archive, which the game never fetches: from the network, like any other file not precached.)
  if (url.pathname.startsWith("/engine/maia/") && !url.pathname.endsWith(".tar.gz")) {
    event.respondWith(
      caches.open(MAIA).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((res) => {
              if (res.ok && res.status === 200) cache.put(request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  if (url.pathname.startsWith(MUSIC)) {
    const hash = MUSIC_HASHES[url.pathname];
    event.respondWith(
      caches.open(MUSIC_CACHE).then((cache) =>
        cache.match(request).then((cached) =>
          cached && hash && cached.headers.get(HASH_HEADER) === hash
            ? cached
            : fetch(request).then((res) => {
                if (hash && res.ok && res.status === 200) {
                  const headers = new Headers(res.headers);
                  headers.set(HASH_HEADER, hash);
                  void cache.put(request, new Response(res.clone().body, { status: 200, statusText: res.statusText, headers }));
                }
                return res;
              }),
        ),
      ),
    );
    return;
  }

  // A file under /assets/ (Vite's names carry their contents' hash) from any version kept: an older tab's own files are its version's.
  // Any other file (one name, whatever the version) from this version only, as the server would answer it: never an older copy.
  const hashed = url.pathname.startsWith("/assets/");
  event.respondWith(
    (hashed ? caches.match(request) : caches.open(VERSION).then((cache) => cache.match(request))).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          // (And a Vite asset fetched here, a new version's while the old worker still answers: the next version's precache copies it.
          // Not a page sent for a file the server no longer has.)
          const page = (res.headers.get("content-type") ?? "").includes("text/html");
          if ((LAZY.test(url.pathname) || hashed) && res.ok && res.status === 200 && !page) {
            const copy = res.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
