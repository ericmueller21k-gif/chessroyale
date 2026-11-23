# Chess Town keeps its painted pictures between visits (Nov 23, 2026)

**Eric (Nov 23):** "It sounds like we can use more cores, and also the drawn pictures between visits ... it seems like just smart."

**What changed.** A first visit paints on the loading screen as before. After its first frame, its 1,912 pictures are packed into 9 PNG pages (5.8 MB), composed at most 3 ms a frame and encoded in a worker, then kept in IndexedDB with each picture's place and each roof's pieces. A later visit with the same key reads, decodes and cuts them back into canvases where the painting would have gone. The town draws from the same canvases, and every picture's pixels match (the perf check hashes them). iPhone 13, CPU 4x, 3 runs each: first visit 18.1 to 18.7 s, second 5.8 to 6.0 s.

**Calls made.** The key is the commit, the town chunk's hashed name and the layout's signature, so a deploy repaints once (the brief's "same build") and an admin's town has its own. Restored pictures go into the existing caches as real canvases, so no draw code changed. IndexedDB, not the Cache API, because the service worker deletes caches it doesn't know. Sidekick frames aren't kept: they're cut from the site's own sheets, as before. Anything odd paints as before and clears the entry (a read over 4 s included). The dev server never keeps pictures. `?paintall` (for anyone) paints, to compare.
