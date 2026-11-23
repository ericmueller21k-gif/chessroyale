# Chess Town opens fast on later visits: keep its painted pictures between visits (Nov 23). Opus, high

Eric, Nov 23: "It sounds like we can use more cores, and also the drawn pictures between visits ... it seems like just smart."
Step 1 of 2 (this job). Step 2, painting on more cores (workers), comes after as its own job. Not wanted: baking pictures at build time.

**Today:** the loading screen paints every picture the town can show, then uploads them to the atlas (render.ts `warm`/`warmPlan`,
Town.tsx `loadTown`, paint-gl.ts `keep`/`kept`). That's 2,787 pictures and about 13 s of the 16.5 s on a 4x-slowed phone, a few
seconds on Eric's phone. Eric's rule stays: everything painted before the first frame, nothing painted while walking (notes/RULES.md).
The trace and ideas are in `docs/decisions/2026-11-23-town-load-bound.md`.

**Goal:** the first visit after a deploy paints as today, then keeps the finished atlas pages on the device. Later visits on the same
build load them and skip the painting.
- Keyed by the build (the app's version and a hash of what the pictures depend on: the town's layout, the art modules), so a deploy
  that changes art never shows stale pictures.
- Stored in the browser: the Cache API or IndexedDB, as compressed images (WebP or PNG blobs of each atlas page), or ImageBitmaps
  where supported. Measure the size and keep it small (target a few MB; say what it is).
- **It must never break the town.** Anything odd (no storage, a quota error, a corrupt or partial entry, a version mismatch, private
  mode, a decode failure) falls back to painting as today, silently, and clears the bad entry. Old builds' entries are deleted.
- The atlas pages plus whatever maps each picture to its place on them (the keep order/rects) must restore exactly. A frame-by-frame
  look (or a pixel compare of the first frame) must match a freshly painted town.
- Settings in `packages/core/src/settings.ts` (on/off switch, the size cap).
Measure (same machine, iPhone 13 emulation, CPU 4x, 3 runs each, tap to first frame): a first visit, then a second visit. Report
both, plus the stored size. Add one check to the existing town perf spec for the second visit (as a multiple of its reference job,
as #891 does), and a unit test for the fallbacks.
Read CLAUDE.md ("Simple beats flashy", "Fix the cause"), `.claude/LESSONS.md`, `docs/areas/` town pages, the decision note above.
Lane: targeted (the town's loading; frame rate measured). Start with exactly:
`git fetch origin main && git checkout -B claude/town-keep-pictures origin/main && git log --oneline -1`.
Write `.pr-body.md` (what changed, what players see, the numbers, changed checks old → new) and `.done`, push and stop. Don't open
PRs or wait on CI. Commits end with the `Claude-Session:` line only.
