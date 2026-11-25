# Town repeat visits: the kept pages uploaded whole (Nov 25, 2026)

The director's brief (from the town-hitches measurements): a repeat visit to Chess Town spent most of its load cutting 1,912 pictures back
out of the kept PNG pages, then uploading each. Plan: keep the pages as packed and upload them whole.

- **What changed:** the kept pages are packed as the WebGL atlas packs (paint.ts `ATLAS`: 2048 px pages, 2 px clear round each picture,
  one over 1024 px alone on its own page; manifest v2). A repeat visit hands the decoded pages to the painter (paint-gl.ts `adopt`): each is
  one layer of the atlas, uploaded whole by `kept`, every picture registered where its page has it. Each picture is a stand-in canvas,
  empty until something reads it (its 2D context: the house and prop hit tests, the statue masks) or the painter must upload it alone (a
  lost context, `changed`); then it's cut from its page. The pages stay decoded until the town closes (about what the cut canvases took).
- **Measured** (headless Chromium, software WebGL, repeat visit, tap to first frame, 4 runs each, main and this branch back to back):
  4x slowed 5.47 → 4.52 s (median; the load itself 3.16 → 2.37 s: cutting −1.15 s, uploading +0.35 s); 1x 2.32 → 1.83 s (load 0.94 → 0.83 s).
- **Why less than the brief's estimate (7.0 → ~4 s):** a whole page isn't free to upload. Here it's about 20 ms a page at 1x and 50 to 65 ms
  at 4x (the browser converts the bitmap on the main thread). The first write to a fresh atlas costs about 120 ms either way (the GPU
  process clearing it). Uploading raw bytes would be about 3x quicker (bench: 6 / 19 ms a page), but needs premultiplied bytes off the main
  thread and a new storage format. Not done; a possible follow-up. Decoding in workers was tried and was slower: the browser already decodes
  `createImageBitmap` off the main thread.
- **Calls (mine):** `premultiplyAlpha: "default"`, not "premultiply". Every texel of all 9 pages matched the canvas upload's either way, and
  "default" uploads twice as fast (11 against 27 ms a page). It's what main already used. `TOWN_PICTURES.pagePx` is gone: the pages' size is
  the atlas's. Fixed on the way: the painter kept a framebuffer across a lost context (`readFb`), which was dead after it came back.
- **Guards:** the kept-pictures perf spec's hash now also hashes what the GPU holds for each picture (`__townPictureSum().gpu`), the same on
  all three visits. The loading-screen spec still uploads nothing while walking on both visits, and now also loses the context on each
  visit: every picture uploaded again holds what it held before.
