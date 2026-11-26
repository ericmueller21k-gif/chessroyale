# Town: the lights' glows made on the loading screen (Nov 26, 2026)

Eric's `?report` on his laptop, Nov 26 evening (Edge, Windows, 1360x948, ratio 1, League's client open): 1,211 uploads in 16.7 s of
walking, the worst 10 frames 50 to 117 ms, all walking, most with 3 to 12 uploads; Buildings' worst 87 ms. #937's guard walked by day.

- **Cause:** at dusk and night every lit window, front, side wall and lamp had its glow baked the first time it shone, and each glow's
  pieces (2,551 in the town) were canvases of their own, each uploaded as it first showed. By day no light shines, so #937's guard
  (`?sky=day`) never met them. Reproduced headless at 1360x948, `?sky=night`: 1,145 uploads in 30 s of walking, every one a glow piece
  (by day: 3, the bosses' bubbles). Not #949: main and #949's kept pages upload the same by day. A second, smaller one: the bots' crate items
  (a dressed pawn each) were drawn just after the loading screen and uploaded as each first showed.
- **Fix:** the loading screen bakes every glow (render.ts `plan`, "glow:" jobs) and keeps it, whatever the sky now (the clock brings dusk
  as you play). A glow's pieces go on one sheet, 2 px apart as the atlas pads a picture (paint-jobs.ts `glowPixels`, `GLOW_GAP`): 338
  canvases instead of 2,551, and the same pixels (all 2,551 checked against their old canvases, 5.76 million values; a smoothed draw reads
  the same clear pixels round each). A first visit bakes them in the paint workers with the frames (`PaintSpec` "glow"); a later visit takes
  each sheet and its pieces from the kept pages (keep-pictures.ts `Manifest.glows`), baking nothing. The spill round a lit pixel is now
  stamped out from the lit pixels instead of searched for round every pixel (the same numbers, 1.05 million compared; 2.7 s → 0.4 s at 1x
  on the main thread). The loading screen also waits (up to `loadSheetWaitMs`, measured 0.1 ms) for the pawns' crate items and keeps them;
  and the sky's sun and clouds are kept for every look, not only the sky's now.
- **Report:** the panel now says what was uploaded ("Uploads by source: glow 1145"; frame-report.ts `upName`, named where each picture is
  made, a reason after it: "redrawn", "after a lost context", "its page started again"), so the next report places its uploads itself.
- **Measured** (headless Chromium, software WebGL, 1360x948 ratio 1, night, 30 s walking across the town, first and second visit):
  uploads 1,145 → 3 (the bosses' bubbles, one picture a line said; hushed in the guard: 0). 1x: 5th % 8.6 → 10.0 fps, 1st % 6.7–7.5 → 8.6.
  4x CPU: 5th % 3.7 → 6.0, 1st % 2.2 → 4.6–5.0. Over 33 ms: about 100% either way (software WebGL at that size can't make 30 fps here).
  Load (medians of 3): first visit 2.20 → 2.61 s at 1x, 5.77 → 6.52 s at 4x; a later visit 0.68 → 0.75 s, 2.13 → 2.33 s. One more atlas page
  (14, 16 MB). The perf spec's slowed phone: 10.2–10.7 → 10.8–10.9 reference jobs (bound 12).
- **"Outside our code"** is the frame's time less our measured work: the browser's own work, garbage collection, the GPU process running
  our draws and uploads, and the wait for the next refresh. An upload from a canvas is copied and sent to the GPU process; a frame with
  several waits for it, so Eric's worst frames showed up as Buildings (where the glow was baked and drawn) and as outside time. Another
  app drawing on the GPU (League's client) competes for that same GPU time. Ours that could add to it: the canvas at 1360x948 (ratio 1,
  capped at 2), 4x multisampling on a GPU, an alpha canvas, the stencil, 14 atlas pages (224 MB) and the light layer. Nothing measured here
  points at any of them (headless WebGL is software), so none is changed: Eric's next report, with uploads at 0, will say whether outside
  time stays high; then `alpha: false` and multisampling off at ratio 2 are the first to try.
- **Guard:** e2e/town-street.spec.ts "the town's loading screen…" now walks across the town (five legs through the areas) at
  `?sky=night&crowd=12` on both visits: uploads 0 (it fails on main with 1,459). Unit: the workers' glows equal the main thread's, every
  piece on its sheet with clear pixels round it; the kept glows round-trip; the report's uploads by source.
