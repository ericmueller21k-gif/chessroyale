// Battle Royale Chess service worker. Generated at build time by vite.config.ts from sw-template.js:
// VERSION and FILES are filled in. Caches the app shell and the chess engine so the app opens
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

// The precache waits for the page (Nov 10, a slow first load after a deploy): a new version installs while the page that found it is
// still loading, and all of its files at once (addAll) took most of the line from the page's own (a 12 Mbps line: home ready in 3.0 s
// instead of 1.7). So it starts once the page says it has loaded (install.ts), or after PAGE_WAIT_MS at most, two files at a time and
// at low priority, so a screen opened meanwhile still gets the line. A file already in this version's cache (an install tried before)
// isn't fetched again.
const PAGE_WAIT_MS = 8000;
let pageLoaded;
const loaded = new Promise((resolve) => (pageLoaded = resolve));
self.addEventListener("message", (event) => {
  if (event.data === "loaded") pageLoaded();
});

async function precache() {
  await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, PAGE_WAIT_MS))]);
  const cache = await caches.open(VERSION);
  const queue = [...FILES];
  const next = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      if (await cache.match(file)) continue;
      const res = await fetch(file, { priority: "low" });
      if (!res.ok) throw new Error(`precache: ${file} ${res.status}`);
      await cache.put(file, res);
    }
  };
  await Promise.all([next(), next()]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== MAIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
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
      fetch(request).catch(() => caches.match("/").then((cached) => cached || Response.error())),
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

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (LAZY.test(url.pathname) && res.ok && res.status === 200) {
            const copy = res.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
