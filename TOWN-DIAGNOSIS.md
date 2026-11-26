# Chess Town: texture uploads while walking (diagnosis, Nov 26, 2026)

**Status: first version, one source confirmed. More runs under way (day, night, 4x, crossing areas, bots, repeat visit); this file is
updated as they finish.**

Read-only investigation of `origin/main` at `270ea48`. Nothing in the product was changed.

## Source 1 (confirmed, the big one): the windows' night lights are made and uploaded as you walk

- **What:** each building's lit-window picture ("glow": `render.ts` `bakeGlow`, about line 588) is made the first time that building's
  wall, front or place is drawn **while the lights are on** (`this.lightK > 0.01`: dusk, night, dawn). Every glow is several small new
  canvases (one per window or pool, `piece()`), and each new canvas is one `texSubImage3D` the first frame it's drawn
  (`paint-gl.ts` `entry` → `upload`). Nothing on the loading screen makes them: `warm` and `makeLabels` don't touch glows.
- **Call sites (all lazy, all in the draw):** `wallGlowOf` (render.ts:2210, a building's sides), `frontGlowOf` (2626, a street front),
  `glowOf` (3051, a place), the park lamp (2570, `lampGlow ??= bakeGlow(...)`). Drawn by `lightT` (2399) / `lightUp`.
- **Measured** (headless Chromium, 1360x948, DPR 1, WebGL on SwiftShader, the container's clock at 04:38, so night; `/town?report`,
  17 s of walking with W/A/S/D): **331 uploads in 215 frames, all `texSubImage3D`, 330 of them glow pieces** (stacks end in
  `lightT ← drawWall ← drawBoxFront / drawPart ← drawThings ← draw`), 342 new canvases made in the draw (`piece ← bakeGlow`), and one
  speech bubble. Sizes 18x15 to 88x50 px, all on spare page 11. Frame-report agreed: 331.
- **Why #937's guard didn't catch it:** the guard (`e2e/town-street.spec.ts`, "the town's loading screen…") opens
  **`/town?sky=day&report`**. By day `lightK` is 0, so no glow is ever made. Eric played at night. Every other town perf check pins
  `?sky=day` too (to be confirmed below). #937's own "116 → 0 uploads" measurement was by day as well.
- **Fix (zero while walking):** make every glow on the loading screen and `keep` it, whatever the sky is (the town can be open as the
  sun sets): in `warm`'s jobs, for every lot's front, every side's art with lights, every place with lights or pools, and the park
  lamp. And make the guard walk at night (`?sky=night`), past more than one block.

- **It is the whole of Eric's number (second version):** a 25 s tour of every street at `?sky=night` (headless, same window):
  **1,020 uploads, 1,018 of them glow pieces** (997 `lightT ← drawWall`, 21 `light ← lightUp`), 2 speech bubbles; up to 192 a second
  and 58 in one frame as a new block comes into view. The same walk at `?sky=day`: 4 uploads in 80 s (boss speech bubbles only).
  The town holds about 1,050 glow pieces without turning; Eric's 1,211 in 16.7 s and Nov 25's 1,063 in 15.6 s are that number.
  So #937 fixed the labels (real: 116 by day) but the bulk of the 1,063 was never the labels.

(Per-source table, stacks, the smaller sources and the "outside our code" findings follow in the next version.)
