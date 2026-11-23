# Chess Town's first visit paints on more cores (Nov 23, 2026)

**Eric (Nov 23):** "It sounds like we can use more cores, and also the drawn pictures between visits". Step 1 (kept pictures, #895)
made a second visit fast; this is step 2: the **first** visit (and the first after a deploy). Eric's rule stays: every picture painted
on the loading screen, nothing painted while walking.

**What changed.** The loading screen's pictures are pure pixel work: a frame's palette keys read into RGBA (`renderFrame`), a roof's
faces baked (`roofCuts`). A pool of workers (`town/paint-pool.ts`, `paint.worker.ts`: the device's cores less one, at most 3,
`TOWN_PAINT_WORKERS`) paints them ahead in the loading screen's order. The main thread runs the loading screen's jobs as before: a
picture a worker made goes on its canvas from the worker's pixels by the same `putImageData`; one a worker is on waits (meanwhile the
main thread hands the workers more, or paints the last unsent ones); one no worker has is painted here as before. The painting code is
one copy (`town/paint-jobs.ts`: `framePixels`, `paintSpec`, `paintBatch`) that FrameCache, the roofs and the worker all call.

**Calls made.**
- **No OffscreenCanvas.** The paint code needs no canvas, so the worker sends the pixels' buffers back (handed over, not copied) and
  the main thread puts them on canvases exactly as before: identical by construction, and it runs on Safari without OffscreenCanvas.
  Fallback: no `Worker`, a worker that fails to load or errors, or art that can't go into JSON paints on the main thread, silently.
- **The art goes as JSON** (each character or box once, any worker that needs it gets the same string): a structured-clone copy of the
  objects took about 4 s of the main thread at 4x, JSON a tenth of it. Only what painting reads goes: a character's idle frames and the
  parts they draw (`paintCopy`), a roof's geometry (`roofCopy`, typed by box-geom.ts's key lists so new reads don't compile until
  listed). `test/town-paint-workers.test.ts` paints every frame and roof of an admin's town both ways: all identical (a copy missing
  `halo` failed 998 of 2,430).
- **What stays on the main thread:** the parts' lazy grids (houses/kit.ts `paint`: a closure per part, which can't go to a worker, run as
  its JSON is made), putting pixels on canvases, packing roofs, uploading. That's why it's about 1.8x, not 4x. A grid's row is now built
  with a plain loop (the same strings, a little faster on every path).
- **The roofs' geometry moved** from boxes.ts to `box-geom.ts` (moved, not copied; boxes.ts re-exports it), so the worker is 13 KB, not
  600 KB of the town's art.
- **Measuring honestly.** CDP's CPU slowing doesn't reach workers (checked: a worker's loop ran at full speed at 4x). `?paintslow=K` (tests
  only) makes each worker picture take K times as long, so the perf spec slows both. On this 4-core machine the workers also share cores
  with the slowed page, the software GPU and the server, so 4x runs read a little pessimistic. A real iPhone 13 has one more performance core
  and four slower efficiency cores beside the main thread's: expect less there than here. `?paintworkers=N` (anyone's, 0 = before) lets a phone compare.

**Numbers** (this machine, iPhone 13 emulation, CPU 4x, tap to first frame, 3 runs each, main `82bf8db7` vs this branch): see the PR
body's table. The perf spec's first-visit bound is now TOWN_LOAD_REFS (the median of its runs and a quarter), and it checks the workers
painted most pictures; the kept-pictures test adds a third visit painted without workers, whose every pixel must match.

**Ideas for later:** have the worker build the same art itself from the same modules (the grids too: about another 2x, but the worker
would load the town's art and its layout); bake the grids at build time.
