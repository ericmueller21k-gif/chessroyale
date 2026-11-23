# Chess Town paints on more cores: step 2 of 2 (Nov 23). Opus, high

Eric, Nov 23: "It sounds like we can use more cores, and also the drawn pictures between visits". Step 1 (keeping the pictures between
visits) is merged (#895: a second visit 18.6 → 5.9 s on a 4x-slowed phone). This job is step 2: the **first** visit (and the first
after a deploy) paints its 2,787 pictures on several cores at once instead of one. Eric's rule stays: everything painted before the
first frame, nothing painted while walking (notes/RULES.md).

Read: `docs/decisions/2026-11-23-town-load-bound.md` and `2026-11-23-town-keep-pictures.md`, `render.ts` (`warm`, `warmPlan`,
`FrameCache`, `roofArt`), `Town.tsx` `loadTown`, `town/keep-pictures.ts` (#895 already encodes in a worker: reuse its pattern),
paint-gl.ts `keep`/`kept`.
- Paint in a small pool of workers (`navigator.hardwareConcurrency - 1`, capped, at least 1) with OffscreenCanvas, each picture's
  paint code run in a worker and its pixels sent back (transferable ImageBitmap or ImageData) to be kept and uploaded as today.
- The painting code must be the same code in the worker and on the main thread (no second copy that can drift: a lesson from
  #889). Anything that can't run in a worker (needs the DOM) stays on the main thread.
- Falls back to today's main-thread painting when OffscreenCanvas or workers are missing (older Safari), or on any worker error,
  silently.
- Every picture must be pixel-identical to the main-thread one (reuse #895's perf check that hashes every picture).
Measure (same machine, iPhone 13 emulation, CPU 4x, 3 runs each, tap to first frame): first visit before and after; second visit
unchanged. Add a first-visit check to the town perf spec as a multiple of its reference job. Lane: targeted (the town's loading; frame
rate measured). Start with exactly: `git fetch origin main && git checkout -B claude/town-paint-workers origin/main && git log --oneline -1`.
Write `.pr-body.md` (what changed, what players see, the numbers, changed checks old → new) and `.done`, push and stop. Don't open
PRs or wait on CI. Commits end with the `Claude-Session:` line only.
