// Battle Royale Chess service worker. Generated at build time by vite.config.ts from sw-template.js:
// VERSION and FILES are filled in. Caches the app shell and the chess engine so the app opens
// instantly and solo matches work offline. The API is never cached.
const VERSION = "__VERSION__";
const FILES = __FILES__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Every page (including /lobby/CODE invite links) is the single-page app. Fetch it fresh so an
  // update shows up on the next open; fall back to the cached copy only when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
