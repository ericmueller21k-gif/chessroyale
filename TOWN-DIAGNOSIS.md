# Chess Town: texture uploads while walking (diagnosis, Nov 26, 2026)

Read-only investigation of `origin/main` at `270ea48`. Nothing in the product was changed; this file is the only thing on the branch.

## The answer in five lines

1. **The uploads are the buildings' night lights.** Each lit window ("glow piece") is worked out and uploaded the first frame its
   building is drawn with the lights on (dusk and night). The town holds at least 1,650 of them. A 25 s walk round every street at
   night: **1,020 uploads, 1,018 of them glow pieces**. The same walk by day: 4. Eric's 1,211 and Nov 25's 1,063 are this.
2. **The hitch is mostly not the upload.** Working out one glow piece costs about **1 ms of CPU** here (5 ms at 4x), inside the
   "Buildings" part of the frame, and the report doesn't count it as "painted". A frame that meets 12 new pieces loses 12 ms; one that
   meets 58 loses 60. That is #937's unexplained "Buildings' 111 ms" spike.
3. **Why the fixes didn't hold:** #937's guard, and every measurement behind "0 uploads", opens **`/town?sky=day`**. By day the lights
   are off and no glow is ever made. Eric plays in the evening. #895, #897 and #949 were about the loading screen, not walking.
4. **The fix:** make every glow on the loading screen whatever the sky is, keep it (`keep`), and make the guard walk at night.
   Details and the smaller sources are ranked below.
5. **"Outside our code" is mostly the wait for the screen.** It is the frame's time less our work, so at a steady 60 fps a frame with
   6 ms of work reads "Outside 11 ms" with the GPU idle. It is not evidence of a GPU problem by itself.

## How it was measured

Headless Chromium (Playwright's), window 1360x948, device pixel ratio 1, the town's canvas 848x948 (the middle column), WebGL 2 on
SwiftShader (no GPU in the container), a 4-core 2.3 GHz Xeon, `npm run dev`. Before the page's scripts ran, the WebGL context's
`texImage2D`, `texSubImage2D`, `texImage3D`, `texSubImage3D`, `texStorage*`, `copyTexSubImage3D`, `createTexture`, `deleteTexture`,
`createFramebuffer`, `createBuffer`, `readPixels` and `document.createElement("canvas")` were wrapped to record each call's stack, size
and frame once the town was ready. Walking was by held W/A/S/D keys, by taps, and by `__townWalk` along a set route.

What this can and can't show: which calls happen, how many, from where, and our own CPU time. Not the real cost of an upload on
Eric's GPU (SwiftShader's upload is a memory copy: 0.014 ms each here), and not GPU or compositor time.

The frame report's own count agreed with the wrapped calls in every run (`upload()` in `paint-gl.ts:793` is the only place the town
uploads a picture after the loading screen: one `texSubImage3D` each, `paint-gl.ts:818`).

## Every source, by size

"While walking" is after the loading screen. Counts are from the runs above unless marked "read from the code".

| # | Source | Where it's made | When it fires | How many | To make it zero while walking |
|---|--------|-----------------|---------------|----------|-------------------------------|
| 1 | **A building's lit windows** (glow pieces, 18x15 to 88x50 px) | `render.ts` `bakeGlow` (588; each piece a new canvas, 619), asked for in the draw by `wallGlowOf` (2210), `frontGlowOf` (2626), `glowOf` (3051), the park lamp (2570); drawn by `lightT` (2399) and `light` (3085) | The first frame each wall, front, place or lamp is drawn while `lightK > 0.01` (dusk 0.7, night 1; day and dawn 0) | **At least 1,650 in the town.** Square legs 108, one turn on the spot 262, every street 662, a turn at four crossroads 621. Up to 192 a second, up to 61 in one frame. By day: 0 | Made on the loading screen for every art with lights, whatever the sky, and kept |
| 2 | **A rider's frames** (199x177 px) and its trail marks | `rides.ts` `frame` (307) and the trail's canvases (250): 48 frames and 24 marks a rider, composed ahead but never kept | Each frame the first time it's drawn: one upload a frame of animation, as the rider stands, then again as it walks each way | Two riders standing 10 s: 18 uploads in 18 frames. Up to 72 a rider. Yours: as you first walk each way (the report starts at your first move) | Yours kept on the loading screen (`readyYou` already composes them before the first frame). Someone else's uploaded as their frames are composed, before they're drawn |
| 3 | **A dressed pawn** (208x208 px) | `Town.tsx` `dressPerson` → `dressed()` (made after the town opens, never kept); drawn at `render.ts:1734` | The first time each dressed bot or player is drawn | 1 each: 4 in the first minute here as bots came out; 3 for 3 dressed arrivals | The bots' made and kept on the loading screen (it already waits for the sidekicks' sheets). An arrival's uploaded when it's made |
| 4 | **A name tag of someone who arrived later** (about 75x140 px) | `render.ts` `tagArtOf` (3636). `makeLabels` (3310) makes the 5 sizes only for who's there at load | The first time the tag shows at each size (8 to 12) | 5 arrivals: 5 uploads in one frame; up to 5 a person as you walk toward them | All 5 sizes made when the person arrives (they fade in), not as each size first shows |
| 5 | **A speech bubble** (about 125 to 230 x 60 px) | `render.ts` `bubbleArt` (3722), the last 8 lines kept | Each new line a boss says | 1 a line: 3 in 30 s and 4 in 80 s here | If each boss's lines are a fixed list, made on the loading screen. (Or left as the one allowed upload, as #937 chose) |
| 6 | **A statue up close**: its close-up (168x368 px) and its quote (about 270x110 px) | `render.ts` `buildCloseUps` (1212, built over the first frames, never kept), `quoteFor` (1345, one per panel size) | Walking up to each statue the first time; the quote again at another window size | 2 a statue, 4 in all | Made and kept on the loading screen |
| 7 | **The "zzz"** (14x14 px) | `zzz.ts` `glyph` (23) | The first time anyone is shown asleep | 1 | Made on the loading screen |
| 8 | **A new sky look's clouds and sun** (read from the code, not run) | `sky-draw.ts` `warm` (127 to 135) keeps only the looks whose weight is over 0.01 at load | The frame a blend starts (day to dusk, dusk to night, night to dawn, dawn to day) with the town open | One burst of every cloud and the sun for that look | `warm` makes all four looks |

Not while walking, and as designed: a lost context (everything on screen again), a browser zoom or a move to a screen with another
pixel ratio (the labels again), and a spare atlas page starting again when the two spare pages fill (everything on it again as it
shows). The last one matters for source 1: the glows live on the spare pages, not the kept ones, and a full night walk with turns
filled 41% of them. Riders, tags and bubbles share that room, so on a long evening visit a page can start again and every glow on it
comes back as an upload. Keeping the glows (source 1's fix) ends that too.

**Confirmed zero** by day: walking the square and every street (80 s), a full turn, zooming in and out with the buttons, standing by
a table with a game on (two bots seated, 5 s), 40 crowd pawns (`?crowd=40`), bots walking about. No texture or framebuffer was
created, no buffer re-made and no `readPixels` call was seen while walking in any run. Not tried: going into a building and out.

## Evidence

Night, walking with W/A/S/D for 17 s (the container's clock was 04:38, so the town was at night with no `?sky=`): 331 uploads, 330 of
them glow pieces, 342 new canvases made in the draw. The stacks (source lines):

```
texSubImage3D ← GLPainter.upload (paint-gl.ts:818) ← GLPainter.entry (788) ← GLCtx.drawImage
  ← Renderer.lightT (render.ts:2399) ← Renderer.drawWall (2295) ← Renderer.drawBoxFront (2111) ← drawThings ← draw    164 + 24
  ← Renderer.lightT ← Renderer.drawWall ← Renderer.drawPart (2180) ← drawThings ← draw                                 142
new canvas ← piece (render.ts:619) ← bakeGlow (588) ← Renderer.frontGlowOf (2626) ← drawBoxFront                        167
new canvas ← piece ← bakeGlow ← Renderer.wallGlowOf (2210) ← drawPart                                                    146
new canvas ← piece ← bakeGlow ← Renderer.glowOf (3051) ← drawBoxFront                                                     24
```

| Run (all 1360x948, ratio 1) | Uploads | Of them glow pieces |
|-----------------------------|---------|---------------------|
| `?sky=day`, keys, 30 s | 3 | 0 (3 bubbles) |
| `?sky=day`, keys, 80 s | 4 | 0 (4 bubbles) |
| no `?sky=` at 04:38, keys, 17 s | 331 | 330 |
| `?sky=night`, taps inside the square, 30 s | 0 | 0 (no new building came into view) |
| `?sky=night&crowd=40`, keys, 80 s | 203 | 196 |
| `?sky=night`, every street once, 25 s | 1,020 | 1,018 |
| `?sky=night`, square, turn, zoom, streets, turns at 4 crossroads, statues | 1,658 | 1,653 |

Uploads a second on the 25 s night tour: 152, 117, 146, 179, 15, 97, 0, 4, 13, 1, 0, 2, 0, 0, 0, 22, 53, 8, 192, 19. They come in
bursts as each new block comes into view: 68 of 304 frames had any, the most in one frame 58.

**The cost of a glow piece** (the frame report's own numbers, a set night walk; "Buildings" in frames with uploads against frames
without):

| | Frames with uploads | Buildings, those frames | Buildings, other frames | Extra Buildings time an upload | Upload time an upload |
|---|---|---|---|---|---|
| 1x | 65 of 210 | 12.9 ms | 0.4 ms | **1.03 ms** | 0.014 ms |
| 4x slowed | 40 of 125 | 96.9 ms | 1.5 ms | **5.0 ms** | 0.073 ms |

At 4x the worst frames were 82 pieces with 540 ms of Buildings, 95 with 434 ms, 63 with 421 ms. `bakeGlow` is slow because for every
pixel round a window it searches a square of neighbors for the nearest lit one, through a closure (`render.ts` 644 to 659). On a real
GPU the upload itself costs more than here, on top of this.

## Why it kept coming back

- **Every guard and every measurement was by day.** The one test that checks uploads (`e2e/town-street.spec.ts:428`) opens
  `/town?sky=day&report` (lines 446 and 525). In `e2e/`, `sky=day` appears 87 times and `sky=night` 11 times, none
  of the 11 looking at uploads. #937's "116 before, 0 after" was the same daytime walk. The area page's "After it, 30 s of walking and
  turning: 0 painted, 0 uploads" (Nov 11) was by day too. Eric's reports are from the evening.
- **#937 fixed something real but small.** The labels were about 116 uploads on that walk. The other 900 or so of Eric's 1,063 were
  never looked at, because by day they don't exist. Its decision note guessed the Buildings spikes were "most likely the same
  uploads"; they were `bakeGlow`.
- **The guard's walk is too short to meet anything new.** It hushes the bosses, walks 1.5 s to one square, turns once on the spot and
  zooms, on a phone-sized window only (`@phone-only`). Eric walks for 15 s across blocks on a 1360 px window with bots and riders out.
- **The report hides the cause.** `bakeGlow` isn't counted as a picture painted (`REC.paint`), so a glow shows as an upload and its
  CPU time is filed under Buildings. Reading the report, the uploads look like the whole story.
- **#895, #897 and #949** kept the pictures between visits, painted them on more cores and uploaded kept pages whole: all three shorten
  the loading screen. None changes what happens while walking, and none of them includes the glows.
- **The cause under all of it (the "fix the cause" rule):** the town's design is "made the first time it's drawn", and the loading
  screen is a list someone has to remember to add to. Eight lazy sites are still outside that list (the table above). Each fix so far
  moved the sites it had seen onto the list and tested those.

## Fixes, ranked

1. **Glows made on the loading screen, whatever the sky, and kept.** Add them to `warm`'s jobs: every lot's front, every side's art
   with lights, every place with lights or pools, the park lamp; `keep` each piece. This removes all of source 1, at dusk too (today
   the frame the lights come on bakes every building on screen at once), and the spare-page restart risk.
   - The cost has to be handled, not just moved: 1,650 pieces at about 1 ms is about 1.7 s on this machine's main thread and several
     times that on a phone. Three ways, in order of least code: make `bakeGlow`'s nearest-lit search cheap (a list of offsets sorted
     by distance, or two passes of a distance transform, instead of a full square search per pixel); bake in the paint workers
     (it's plain pixel math, as `paint-jobs.ts`); put the pieces in the kept pages so a repeat visit pays nothing.
   - Room: all 1,650 pieces filled 41% of two pages, so about one more 16 MB atlas page.
2. **The guard walks at night, far, on a computer-sized window too.** `?sky=night`, every street, a full turn at a crossroads, the
   statues, bots not hushed, riders and dressed bots out, 1360x948 as well as the phone. Assert 0 uploads and 0 pictures made.
3. **Make a late picture impossible to miss, so the next one doesn't need its own test.** After the loading screen, count every
   picture `upload()` meets for the first time, with what it was (`__townPaint().late`), and count `bakeGlow` as painted in the frame
   report. Then every town spec can end with "late is 0" (allowing only an arrival's tag and a new line's bubble, by name), instead
   of one spec guarding one walk. This is the cause-level fix: the lazy sites stop being invisible.
4. **Your rider's frames kept on the loading screen** (source 2): `readyYou` already composes them before the first frame; hand the
   72 pictures to `keep`. Other riders: uploaded as composed.
5. **Dressed bots made and kept on the loading screen** (source 3).
6. **The small ones** (sources 4 to 8): an arrival's 5 tag sizes at once; the statues' close-ups and quotes, the "zzz" and all four
   sky looks on the loading screen; the bosses' lines made at load, or left as the one named exception.
7. **The report tells the truth about the wait.** Split "Outside our code" into the wait for the screen (up to one refresh interval
   less our work) and what's over it, and show the GPU's name (`WEBGL_debug_renderer_info`). Today a healthy 60 fps frame reads
   "Outside 11 ms".

## "Outside our code": what I found

- **How it's worked out:** `frame-report.ts` `end`: the time between two frames less our marked work. At 60 Hz that includes the idle
  wait for the next refresh. The panel's "Outside our code 11 of 20 ms" is a mean (849 frames in 16.7 s is 19.7 ms a frame), so about 9 ms of it is our
  work. The 9 ms is the number to worry about, and it includes the glow baking.
- **Canvas size:** backing 848x948, CSS 848x948 at ratio 1. No oversizing. The ratio is capped at 2 (`Town.tsx:1913`).
- **One WebGL canvas.** The others on the page are small 2D ones: four edge chips (92x92 shown at 40x40), the minimap (110x92), the
  menu crest. None is redrawn every frame as far as the calls show; the minimap moves its dot with a transform.
- **Context:** `alpha: true, antialias: true (4 samples), stencil: true, depth: false, preserveDrawingBuffer: false,
  premultipliedAlpha: true`, no `powerPreference` (`paint-gl.ts:385`). Two things worth a try on Eric's laptop, each one line:
  `powerPreference: "high-performance"` (a laptop with two GPUs gives "default" the weaker one), and `alpha: false` if nothing shows
  through the canvas (the compositor can then skip blending it). 4x multisampling at 848x948 is small for any GPU.
- **No readbacks:** no `readPixels` or `getImageData` on the town's canvas while walking.
- **CSS over the canvas:** no `filter`, `backdrop-filter` or blend mode on the canvas or the HUD over it; one `drop-shadow` on the
  large map's icons (`town.css:927`), which is closed while walking.
- **At night only:** the lights are drawn into a layer the size of the canvas and blended in (6 draw calls a frame against 5 by day).
  One more full-screen pass; small.
- **Not measurable here:** real GPU and compositor time. To get it from Eric's laptop in one go: the report with the GPU's name on
  it (fix 7), by day and at night, after fix 1.

## Limits of this investigation

- No real GPU: upload cost and "outside" time on Eric's Edge and Windows laptop are inferred, not measured.
- No account or server: your own outfit and ride, real players arriving and friends were stood in for with `__townPlayer`.
- A repeat visit (kept pages) was read from the code, not run: the dev server doesn't keep pictures. The kept pages hold the 1,912
  pictures `warm` paints; the glows aren't among them, so a repeat visit bakes and uploads them the same way.
- Going into and out of a building was not tried.
