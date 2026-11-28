# The town's first seconds stutter: fix the causes, then keep the curtain up until it's warm. Opus, high (rendering, frame loop). Targeted lane.

Eric, Nov 28 (his frame report, `/town?report`, Edge 158 on Windows, 1360×948, WebGL, 60 Hz): "Why is this still happening every time I
load into the town? It's laggy as hell… I don't want it to lag at all when the town loads… nobody's gonna touch this garbage." He said
on Nov 27 an extra couple of seconds of loading is fine if it then plays smooth.

His report, 326 frames in 5.9 s from the load: median 60 fps, 5th and 1st percentile 30; 7% of frames over 20 ms, 3% over 33.
- **55 texture uploads in 5.9 s**, all but one "other": **247×174 ×21, 247×175 ×14, 41×34 ×19** (bubble ×1). Texture uploads avg 1.5 ms,
  worst 30 ms. Something drawn to a canvas is re-uploaded again and again while walking (the minimap is about 247×174? find out).
- **A 44 ms long task: IdleRequestCallback.** Some idle work does too much in one slice.
- **Stalls outside our code**, worst 33 ms, mostly in the first 1.5 s (Worst 10: "50 ms 1.3 s: Stall 33 · walking · 1 upload · gap",
  "50 ms 0.0 s: Stall 33", "45 ms 4.0 s: Stall 28"…). Likely first use of textures or shaders on the GPU.

Read `notes/briefs/rules-common.md`, `.claude/LESSONS.md`, `docs/areas/` (the town pages) and the frame report's code
(`packages/app/src/town/frame-report*.ts`) first. Branch `claude/town-load-smooth` from `origin/main`; push at each real step.
1. **Find each repeated upload's source and fix its cause:** a picture that doesn't change is uploaded once and kept; one that changes
   (the minimap's dot?) changes only its small part (a separate sprite, or `texSubImage2D` of the dirty rect), never the whole canvas per
   step. Name the sources in the report (no more "other") so the next report says what it is.
2. **The idle callback:** find it; split it into slices under ~4 ms, or do it behind the curtain, or not at all if nothing needs it.
3. **Warm up behind the loading curtain:** before the town shows, every atlas and texture it will draw at the start is uploaded, every
   shader program used once (draw a frame offscreen or under the curtain), fonts ready, idle work done, then a run of smooth frames drawn
   under the curtain; only then does it lift. **No time cap** (Eric, Nov 28, after the first brief said "cap it at 2 s": "Load the town
   first so it doesn't lag. That doesn't mean so it lags for a few seconds… It means load the town so it doesn't lag."). Reuse the existing
   loading screen; nothing new to draw.
4. Prove it: the frame report (or a @perf spec) from a cold load, on a slowed phone (CPU ×4) and the computer project: no frame over 33 ms
   after the curtain lifts, and say the 5th percentile before and after. Add one focused check to the existing busy-town @perf spec, not a
   new spec. Watch the first seconds frame by frame (`LESSONS.md`).
Decision note (five lines), area page update. Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, then stop.
