# Chess Town's first visit paints on more cores (Nov 23, 2026)

**Eric (Nov 23):** "It sounds like we can use more cores, and also the drawn pictures between visits".

**What changed.** A first visit's pictures are painted ahead by up to 3 workers (`town/paint-pool.ts`) with the main thread's own code
(`town/paint-jobs.ts`); the main thread puts their pixels on canvases by the same `putImageData`, so every picture is identical (unit
test and perf hash). 4x slowed, tap to first frame: 21.5 s → 11.8 s. Second visits unchanged.

**Calls made.** No OffscreenCanvas: the painting needs no canvas, so pixels come back as buffers (works without it on Safari). The art
goes as JSON (a tenth of structured clone's main-thread cost), only what painting reads (`paintCopy`, `roofCopy`). The parts' lazy grids
are closures, so they stay on the main thread: why it's 1.8x, not 4x. Roof geometry moved to `box-geom.ts`: a 13 KB worker. CDP's
slowing misses workers, so `?paintslow=K` (tests) slows them; `?paintworkers=N` compares. Any failure paints on the main thread.

**Later:** the worker building the art itself (the grids too).
