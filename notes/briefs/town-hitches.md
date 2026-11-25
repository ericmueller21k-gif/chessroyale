# Town hitches on Eric's laptop: 1,063 texture uploads while walking (Nov 25). Opus high, town lane, targeted

Eric (Nov 25, 23:18 his time): "the town is slow as fuck on my laptop with nothing else open". His `/town?report` (transcribed):
- Edge 158 · Windows · ratio 1.25 · 1220×915 px · WebGL · ~60 Hz · on battery (84%).
- **60 fps median, 30 at the 5th %, 20 at the 1st %; 6% of frames over 20 ms, 3% over 33 ms.** So: hitches, not a slow average.
- 869 frames in 15.6 s, no turning (walking, some zoom). "Most time: Outside our code 9.5 of 18 ms (ours: Ground 3.2)".
  **"1 painted, 1063 uploads, 0 atlas resets."**
- Means (all): Ground 3.2, Buildings 2.7, Placing & sorting 1.0, Texture uploads 0.5 (worst 19), Outside our code 9.5 (worst 130),
  Whole frame 18 (worst 133). Worst single parts: Buildings 111, Placing & sorting 34, Camera 17, Texture uploads 19.
- Worst 10 frames, every one "walking · N uploads · gap": 133 ms (outside 130, 6 uploads), 83 (zoom, 18 uploads), 67 (3), 67 (zoom,
  25 uploads), 50s with 2-12 uploads each.
- The docs say after loading: "30 s of walking and turning: 0 painted, 0 uploads, 0 resets" (town-square.md, the loading screen). Here it's
  ~68 uploads a second while walking, each worst frame with uploads, and the time lands "outside our code" (the GPU/driver stalling on
  them). Suspects: the Nov 23 "kept between visits" path (pictures cut back out of IndexedDB pages, maybe uploaded lazily as they come into
  view instead of at load), the paint-workers path, the spare text pages (tags, bubbles, signs), or zoom re-uploads.

Start: `git fetch origin main && git checkout -B claude/town-hitches origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/town-square.md` (Frame report, the loading screen, Kept between visits, Painted on more cores),
`town/paint-gl.ts`, `render.ts`, `keep-pictures.ts`, `paint-pool.ts`.
1. Reproduce: `/town?report` headless (first visit AND a second visit with the kept pictures), walk and zoom 15 s; count uploads after load
   (`__townPaint()`, `__townReport()`). Find what uploads while walking and why.
2. Fix the cause (CLAUDE.md "fix the cause"): every picture uploaded during the loading screen, none while walking/zooming (or, if some
   must be lazy, spread at most one small one per frame). Keep the 0-uploads claim true and guarded: one check in an existing town spec
   (`e2e/town-street.spec.ts` or `perf.spec.ts`) that walking + zoom after load uploads nothing, on both visits.
3. Look at Buildings' 111 ms and Placing & sorting's 34 ms spikes too (likely the same uploads/GC): say if they remain after the fix.
4. `@perf` specs for the town (`npx playwright test --grep @perf --project phone`) before/after; a still not needed. Decision note (short),
   area page. `.pr-body.md` (lane: targeted; changed checks), `.done`, push, stop. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high (rendering). ~1 hour.
