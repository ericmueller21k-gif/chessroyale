# The town square drawn with WebGL, behind `?gl=1` (Oct 30, 2026)

## Why (Eric, Oct 30)

The town is the game's hub and will keep growing (real players, crowds, shops, lights); "number one is the quality as far
as how it feels". It was drawn with Canvas 2D: hundreds of separate draws a frame. That holds 144 fps on Eric's desktop and
fits his laptop alone (Edge, Intel Iris Xe, about 8 of 16.7 ms a frame on the main thread), but drops frames there when
another game shares the chip. The goal: the same picture through WebGL 2, batched into a few draw calls, so the town has
room to grow. Only the town's canvas changes.

## What was built

- **A drawing layer** (`town/paint.ts`): a `Painter` with a `ctx` that speaks the part of CanvasRenderingContext2D the
  town uses (`Ctx`), plus a frame's start and end, light layers, `changed(canvas)` and the far softening (`soft`).
  render.ts and sky-draw.ts draw through it; everything that decides what to draw stays where it was.
- **Canvas 2D backend:** `ctx` *is* the canvas's own 2D context, so the default draws with exactly the calls it made
  before (the only additions are no-op calls: `frame`, `done`, `changed`). Default, unchanged.
- **WebGL 2 backend** (`town/paint-gl.ts`, about 2,000 lines, no dependency): a stand-in for that 2D subset, with the same
  state carried call to call and frame to frame (the town relies on that: e.g. image smoothing set by the last prop drawn
  is still set when the next frame's clouds are drawn). It records triangles into one vertex stream per target (the
  canvas, each light layer) and draws a stream in one call when it must: a new clip shape for the stencil, a second
  texture of its own in one draw, the frame's end: **5 or 6 draw calls a frame**, day or night. One shader:
  - solid fills (premultiplied; each subpath fanned, as all the town's are convex), smoothed by 4x multisampling;
  - textured quads, any four corners, from the atlas (one array texture, a page a layer) and one texture of its own a draw
    (a light layer, a picture over 1024 px), nearest or smooth per quad (nearest reads the texel's middle smoothly, so
    `imageSmoothingEnabled` never breaks a batch);
  - **soft lines** for a stroke's shadow (the table's ring, the pressed square's glow): a Gaussian across a line has a
    closed form, worked out per pixel (Chrome's canvas uses sigma = shadowBlur / 2 device pixels, which it matches);
  - **soft pictures** for the far band (render.ts's `blitSoft`: shrink, haze, stretch back): both resamplings done per
    pixel in one draw (four smooth samples), no scratch canvases.
- **Blending:** every composite the town uses is premultiplied source-over (ONE, ONE_MINUS_SRC_ALPHA): "lighter" adds its
  color with no alpha, "destination-out" and clearRect cut with no color. So the night's lights and the cuts out of them
  batch together, and the light layer costs one draw call however many lights and covers there are.
- **Textures** from the canvases render.ts already makes, found by their source (a WeakMap), packed into 2048 px atlas
  pages (layers of one array texture, grown two pages at a time and copied on the GPU) with 2 transparent pixels round each (a picture over 1024 px gets its own texture); uploaded once, and again only
  when render.ts says a canvas was drawn on again (`changed`: a tag repainted, a table's board cached anew). Six pages at
  most; when full, the page least lately drawn from starts again. Pictures not drawn for 600 frames are let go.
- **Clips:** an upright rectangle (a sitting pawn, a light's cut) is kept as numbers and everything drawn is cut to it on
  the CPU (no state change, so no extra draw call); any other shape (the ground under the rim, the far Colosseum, the
  pressed square's glow) takes a stencil bit (a bit a clip level, even-odd): one pass a clip, nothing to let it go, and the
  same shape again (the ground's clip, then the haze's) is still there. What's drawn inside is also cut to the clip's box.
- **Software WebGL** (SwiftShader: the headless tests' renderer, and any machine without a GPU) runs every branch of a
  shader for every pixel. A first version read 8 textures twice over a pixel plus 32 reads for the soft path and ran at
  2 fps headless; with the array atlas and the leaner stencil, 6 fps at 2 to 6 draw calls (Canvas 2D: 55 to 60), the floor being
  SwiftShader's fill of about four screens of pixels a frame. Real GPUs do this in well under a millisecond.
- **Text** (the homes' names, the bubble's lines; the tags already were) is drawn once per string, font and style into a
  canvas and laid on at the nearest device pixel; a web font arriving draws them again. A fill with a shadow (the bubble)
  is drawn once into a canvas by a 2D context, shadow and all, kept by its shape and colors.
- **`?gl=1`** turns it on for anyone, read once as the page opens (`TOWN_ASKED.gl`, beside `?crowd` and `?fps`). No WebGL
  2, or its context can't be made (or its shader fails): Canvas 2D, silently (on a new canvas, since a canvas keeps the
  first kind of context it gave). Context lost: nothing drawn until it's restored, then its textures are made again as
  they show; lost twice within a minute, or not back within 5 s (`LOST_WAIT_MS`: the browser isn't giving it back, and a
  blank town would be worse than a Canvas 2D one), Canvas 2D for the rest of the page. The canvas carries `data-backend`.
- **The `?fps` pill** ends with "· WebGL" or "· 2D", from town.css (`::after` from `data-backend`), so the pill's text
  (which `town.spec.ts` reads with an anchored pattern) stays the numbers and that spec is unedited.
- **Test hooks** (test switches only): `__townHold(on)` holds the frame loop; `__townBackend("2d" | "webgl")` swaps the
  backend on a new canvas and draws the held frame again; `__townPaint()` gives the backend and the last frame's draw
  calls (and uploads); `__townBench(n)` draws the held frame n times and gives the ms a draw. And a WebGL canvas's `getContext("2d")` returns a reader whose `getImageData` draws the last frame again (same
  moment, same camera) and reads it right after the draw, so the specs' pixel reads work on both backends **without
  editing them** (the tags' guard test in `town-tags.spec.ts` reads pixels, and a guard test isn't to be edited without
  Eric).

## Judgment calls

- **Our own layer, no library.** PixiJS or similar would be 100 kB+ gzipped, retained-mode (a scene graph), and would mean
  rewriting render.ts's drawing; ours is about 2,000 lines in the same immediate-mode style as render.ts, speaks the same
  calls, and adds nothing to the main bundle (it's in the town's lazy chunk).
- **A 2D-context stand-in, not new drawing calls in render.ts.** render.ts's code stays exactly what draws the Canvas 2D
  picture, so the two backends can't drift apart in what they draw, only in how; and the default is untouched.
- **Multisampling (4x) for edges** instead of analytic coverage: simple, and on the GPU it's free; edges differ from the 2D
  canvas's by a little (the comparison's largest single-pixel differences are edges).
- **Running the town specs on WebGL: a build switch, not edits to every spec.** The brief suggested an env var the specs
  read to add `gl=1` to their addresses. That would mean editing every town spec, including the guard tests of Eric's rules
  (name tags, the chat), and wouldn't reach pages opened from home or second players' contexts. Instead a local build with
  `VITE_TOWN_GL=1` makes WebGL the default, and the specs run unchanged. Not wired into CI (as asked).
- **Shadows:** a stroke's is analytic (per pixel); a fill's is baked once by a 2D context (only the bubble has one). Neither
  blurs per draw.
- **What it doesn't do:** `softenFarBand` (off in feel.ts; it reads the canvas back) is Canvas 2D only; a clip on a light
  layer that isn't a rectangle would be cut to its box (none is); `filter` is ignored (only the 2D softening used it).

## The comparison (e2e/town-webgl.spec.ts)

One page, one frame held, drawn by each backend in turn, compared pixel by pixel (each pixel's largest channel
difference, 0 to 255), phone (780 x 1224 device pixels) and computer (768 x 800, inside the front door's frame):

| Scene | Largest difference (where) | Mean | Over 8 | Over 32 | WebGL draw calls |
| --- | --- | --- | --- | --- | --- |
| phone, the park by day | 62 at (674, 643) | 0.99 | 2.11% | 0.133% | 5 |
| phone, the park at night (the lights) | 33 at (187, 456) | 1.41 | 1.66% | 0.000% | 6 |
| phone, a statue up close at night | 138 at (344, 209) | 1.09 | 0.17% | 0.011% | 5 |
| computer, the park by day | 60 at (229, 444) | 1.02 | 2.34% | 0.126% | 15 |
| computer, the park at night | 123 at (542, 694) | 1.45 | 1.92% | 0.007% | 6 |
| computer, a statue up close at night | 150 at (317, 259) | 1.00 | 0.14% | 0.016% | 6 |

The spec passes when the mean is under 3, under 5% of pixels are more than 8 apart and under 0.4% more than 32.

The differences are edges (multisampled against the canvas's antialiasing) and pixel-art columns where a nearest texel is
picked across a tie: nothing shifted, nothing missing (a pixel out of place everywhere would put tens of percent over 32).
Full-page stills of both, phone and computer, day and night, are with the PR.

## Frame rate (eric.md's method, and two closer looks)

This machine has no GPU: headless WebGL runs on SwiftShader, the CPU pretending to be a GPU, so WebGL's fps here say
little (Eric's laptop recording decides). `?crowd=50` by day, the medians of four runs taken in turn, one pass; `main` is
d66eafc3.

**1. eric.md's method** (5 s walking): fps; JS = the main thread's script time a frame (CDP `ScriptDuration`); task = all
its work a frame. Calls a frame: for Canvas 2D the canvas calls (fill, stroke, fillRect, clearRect, drawImage, fillText,
strokeText) on every 2D context, the town's canvas in brackets; for WebGL its draw calls.

| | main | branch, Canvas 2D | branch, `?gl=1` |
| --- | --- | --- | --- |
| phone 390 x 844 | 42.9 fps, JS 3.94 ms, task 23.1 ms, 714 calls (689) | 44.8 fps, JS 3.77 ms, task 22.1 ms, 719 calls (692) | 4.3 fps, JS 15.4 ms, task 226 ms, 11 draw calls (39 canvas calls: tags, text) |
| computer 1440 x 900 | 49.9 fps, JS 3.48 ms, task 19.8 ms, 719 (699) | 50.7 fps, JS 3.48 ms, task 19.5 ms, 728 (707) | 6.2 fps, JS 12.4 ms, task 156 ms, 10 draw calls |
| computer 1885 x 940 | 38.8 fps, JS 3.98 ms, task 25.5 ms, 776 (751) | 36.5 fps, JS 4.29 ms, task 27.2 ms, 770 (745) | 4.0 fps, JS 17.4 ms, task 239 ms, 10 draw calls |

The branch without `?gl` is level with main (inside the run-to-run spread): the same calls, as built. WebGL's headless
fps are SwiftShader's fill (about four screens of pixels a frame on the CPU). Its JS a frame is inflated at 4 to 6 fps:
everything that happens per second (tags redrawn as people move, and uploaded again; the page's chat and panels) falls on
a few frames.

**2. The renderer's `draw()` a frame** (inclusive, from a CPU profile while walking, same runs' setup): Canvas 2D 3.7 ms
(phone), 2.9 (1440), 4.0 (1885), on main and the branch alike; WebGL about 9.7 ms on the phone, of which about 2.5 ms is
those per-second costs (tags redrawn and uploaded) landing on few frames. Canvas 2D's `draw()` only records: its pixels
are painted after it, outside this number (in headless, on the CPU; on Eric's laptop, by the GPU).

**3. The same held frame drawn again 40 times** (`__townBench`; nothing moves, nothing new: each backend's whole cost of
drawing the frame on the main thread, the 2D canvas's painting included):

| `?crowd=50` | phone | computer 1440 | computer 1885 |
| --- | --- | --- | --- |
| day: Canvas 2D / WebGL | 11.1 / 3.6 ms | 15.2 / 4.0 ms | 22.9 / 4.7 ms |
| night: Canvas 2D / WebGL | 22.9 / 4.4 ms | 19.7 / 4.7 ms | 31.4 / 4.5 ms |

WebGL's main-thread cost is its recording (the 2D calls turned into triangles: about 3.5 to 4.7 ms here, on a slow
machine) plus handing them to the GPU; the painting goes to the GPU in 5 or 6 draw calls, whatever the frame holds (the
night's lights add none). Canvas 2D's recording is a little cheaper (about 3 to 4 ms here), but then hundreds of separate
paths, images and blurs have to be painted: the GPU work that drops frames when another game shares the chip.

## The town's specs on both backends (local, Oct 30)

- **Canvas 2D** (the normal build): town, town-desktop, town-tags, town-chat, town-chat-history and town-webgl all pass, phone
  and computer (the same 7 skips as main). CI's whole suite on the PR: green.
- **WebGL** (`VITE_TOWN_GL=1 npm run build`, one worker, software WebGL at 4 to 6 fps): 109 passed, 6 failed, 7 skipped. Run
  again alone, the failures move around (phone and computer swap which ones pass): the chat's timing checks (a fade's
  CSS, a line still taking touches after minutes, a moderator's menu) and one race that holds steady,
  `town-chat.spec.ts:953` "less left" (it reads the "Sorry… N seconds" line right after Enter, and with software WebGL holding
  the page's thread the old line is still showing). The tags' fade passed on its rerun. Every check that reads the
  canvas (the world drawn, the sky's colors, the lights, the tags, the statues' close-up, the cards) passes on WebGL. The
  chat is HTML over the canvas; on a GPU the load that makes these late isn't there.

## What's left

- The recording's JS could shrink further (indexed quads instead of six vertices a square; a leaner vertex): about 3.5 to
  4.7 ms a frame here against Canvas 2D's 3 to 4 ms of recording.
- Eric's laptop recording (Edge, Iris Xe, a game sharing the chip) with `?gl=1&fps` against without, to decide whether
  WebGL becomes the default; then the specs on a `VITE_TOWN_GL=1` build in CI.
- Real phones (iPhone Safari has WebGL 2 since iOS 15): a look on Eric's phone with `?gl=1`.
- If it becomes the default: the Canvas 2D path stays as the fallback; `softenFarBand` would need a GPU version if it's
  ever turned back on.

## Oct 30, later: ready for default

Eric is trying `?gl=1` on his phones and computers ("so far feels flawless" on his phone); if he says yes, WebGL becomes the
default in a later PR (his call: not this one). Three things had to be ready first. Canvas 2D stays the default, unchanged.

### 1. The town's specs on WebGL: each failure's cause

Every failure came from one thing: software WebGL is slow, and the page's thread waits for it. Headless Chromium has no GPU
compositing, so it reads each WebGL frame back for the page, and that waits for SwiftShader (the CPU playing GPU) to finish
the frame: measured on a phone (780 x 1584 device pixels, `?crowd=50` by day), 6 ms of script and 0.15 ms of GL calls a
frame, but 187 ms of the page's thread. Every check a spec makes is a round trip into that page: 150 to 200 ms (Canvas 2D: 18),
and 300 to 400 with two such pages on 4 CPUs (two Playwright workers). Where SwiftShader's time went:

- **4x multisampling:** a frame with nothing drawn cost 75 ms, 21 ms without multisampling (four samples a pixel cleared and
  resolved on the CPU); with the drawing, about half the frame.
- **The shader:** one shader for every mode, and SwiftShader runs every branch for every pixel: a flat-color shader took
  the held frame from 329 to 150 ms.
- **Overdraw:** 3.5 screens of fragments a frame by day (the ground's squares 1.45, seams under faces; the skirt under the
  ground 0.75; the sky 0.3; pictures about 1), 5 at night (the tint, a whole screen, and the lights' layer).
- **Uploads:** not it (`texSubImage3D` 0.11 ms a frame: tags as they change).

What fixed it, the picture on a GPU unchanged (`paint-gl.ts`):

- **The shader in three builds** (solid; with textures; with the soft lines and pictures too), each draw using the least
  that covers the modes it holds (`Stream.modes`). The same code for each mode, so the same pixels; the ground's and the
  sky's solid fills skip the rest. Cost: three programs compiled as the town opens instead of one (a few ms), a program
  switch per draw (5 or 6 a frame).
- **No multisampling where WebGL is software:** the context is asked for as before (4x multisampling) with
  `failIfMajorPerformanceCaveat`; where the browser would draw it in software, that one is refused and it's made without
  multisampling. A GPU gets exactly what it got. Cost, on a software renderer only: the edges are stair-stepped, so
  `town-webgl.spec.ts` (which runs on SwiftShader) measures more difference from Canvas 2D (phone by day: 3.80% of pixels
  over 8 and 0.288% over 32, from 2.11% and 0.133%; computer by day 4.11% and 0.333%; the limits 5% and 0.4%). It
  passes unedited.
- **Nothing made per frame** in the sky's gradient any more (an array and two closures a frame).

Headless, `?crowd=50` by day, standing at the start, one page: phone 5.2 to 13.9 fps, computer 6.7 to 15.1 (night: 9.0 and
10.7); a round trip into the page 198 to 70 ms on the phone. Walking (eric.md's method, below): 2.5 to 5.6 fps on the phone,
5.8 to 14.6 on the computer.

Each failure (the 6 of the first run, and the one that came up with two workers):

| Test | Cause | Fix |
| --- | --- | --- |
| town-chat "the typing line … one message per 15 seconds", "less left" (steady) | The ~40 checks between the sent message and the second early try each wait for a frame: about 20 s with two software-WebGL pages, so the second try came after the 15 s wait, was sent instead of refused, and the old "Sorry" line was read | The speed-up and one worker: about 45 s, passes. Unedited |
| town-chat "new messages … fade after the wait" | The checks between the messages and the 5.5 s wait took 3 s, so "still showing" was checked after the fade | Edited: the wait counts from the messages (the same check, at the moment it meant) |
| town-chat "always on never fades" | Playwright's clock: with time flowing, its catch-up can be running a slow frame's timer as `fastForward` starts and set the time back when it ends, undoing the jump (one run in four on WebGL): the old line was still there at "5 minutes" | Edited: the clock held (`pauseAt`) before the jumps; the same for "the text's tone flips with the clock", which jumps the same way. 12 of 12 then |
| town-chat "a tap on a player's name" | Three town pages in one browser share one software GPU process: the test's 180 s ran out | The speed-up and one worker: 2 minutes, passes. Unedited |
| town-tags "tags fade as you walk away" | You cross the fading square in 90 ms; at 3 to 6 fps no frame landed in it, so it looked like a pop | The speed-up: at 14 fps a frame lands in it. Unedited |
| town-chat "press and hold … drag" (two workers) | A drag's moves reach the page with its frames, so at 3 fps the first came after the 400 ms hold and picked the box up | One worker: passes. Unedited |

Run on a `VITE_TOWN_GL=1` build with one worker, after the fixes: the drawing specs (town, town-desktop, town-tags,
town-webgl) 66 passed, 6 skipped (the skips as on Canvas 2D), 19.6 minutes; the chat's two (town-chat, town-chat-history) 49 passed, 1 skipped, 35.8 minutes: 115 passed, 7 skipped (as on Canvas 2D), none failed. None of the edited
tests guards an eric.md rule (the chat's guard, "typing works wherever the box shows", is untouched).

### 2. CI runs them on WebGL

A change to the town's area (`webgl` in `e2e/areas.json`: a path of the town square's area, or one of the drawing specs)
also runs town, town-desktop, town-tags and town-webgl on a `VITE_TOWN_GL=1` build: two more jobs beside the shards,
`webgl-phone` and `webgl-desktop` (one project each, one worker), on PRs, on the push to main that merges one, with the
full-e2e label and on a manual run. About 10 minutes of tests each (9 for the phone, 10.5 for the computer, measured
locally) plus a minute or two of setup, running beside the shards, so a town PR takes about as long as before (its shard with
town-chat takes longer); about 25 runner minutes more per run, free on a public repository. Calls made:

- **One worker per job:** with two, each check took 300 to 400 ms and three timing checks missed (above).
- **A job per project** rather than per file: town.spec is most of the time and can't be split; the phone and the computer
  halves are even.
- **The chat's two specs left out:** HTML over the canvas, nothing in them depends on the backend, and on software WebGL they
  take about 45 minutes of a worker (four more jobs to keep a PR as fast). They pass on WebGL locally (above).

### 3. Counting the fallbacks

When the town asked for WebGL and drew with Canvas 2D instead, the page says so once, through the error reporting it
already has (`reportTownFallback` in the app's problems.ts): kind `town-gl-fallback`, its reason the message (`no-webgl2`,
`no-context`, `shader`, `lost-twice`, `not-back`; `TOWN_GL_FALLBACK` in core's settings.ts). The same request an error
makes: the build, screen, breadcrumbs, user agent, viewport and memory class, the account if signed in; no GPU name, nothing
typed; under the same limits (once a page, `maxErrorsPerPage`, the endpoint's rate limits, the store's bounded writes and
caps, 30 days). Stored as an error row (`ops_errors`, one per reason per hour): no new table or column. Nothing shows to the
player, and it's never on the frame loop (it happens where the town falls back: as it opens, or in the lost context's
timers). The health view (`/api/admin/health` `townFallbacks`, a line on `/admin/ops`, a line in `npm run ops:report`)
counts page loads in the last 24 hours and 7 days, in all and by reason, only those five reasons (anyone can post an error of
any kind), and leaves them out of the errors' numbers, so they never make "Errors are up".

### Not done

- **Soft draws in draws of their own** (so the textured draws never need the full shader): another 10 to 20% on
  software, but 20 to 30 more draw calls a frame on a GPU. Not worth it.
- **For players:** a machine whose WebGL is software (no GPU, or one the browser won't use) now gets 12 to 15 fps with
  WebGL against about 50 with Canvas 2D. If WebGL becomes the default, drawing with Canvas 2D there (the same
  `failIfMajorPerformanceCaveat`, as a sixth fallback reason) is worth deciding with it.

### Frame rate (eric.md's method)

`paint-gl.ts` changed what the WebGL backend does each frame (which shader a draw uses; nothing new per frame, nothing
allocated: one allocation a frame fewer), so: headless, a phone 390 x 844 and a computer 1440 x 900, 5 s walking, `?crowd=50`
by day, the medians of four runs taken in turn, one pass; `main` is ddaab0a5 (#415). fps; JS = the main thread's script
time a frame; task = all its work a frame; calls a frame (Canvas 2D: every canvas call, the town's canvas in brackets;
WebGL: its draw calls).

| | main | branch | main `?gl=1` | branch `?gl=1` |
| --- | --- | --- | --- | --- |
| phone 390 x 844 | 39.6 fps, JS 4.47 ms, task 25.1 ms, 710 calls (684) | 40.2 fps, JS 4.44 ms, task 24.6 ms, 713 (687) | 2.5 fps, JS 27.9 ms, task 387 ms, 12.1 draw calls | 5.6 fps, JS 19.4 ms, task 171 ms, 9.6 draw calls |
| computer 1440 x 900 | 49.7 fps, JS 3.69 ms, task 19.9 ms, 720 (700) | 47.6 fps, JS 3.84 ms, task 20.8 ms, 713 (694) | 5.8 fps, JS 12.7 ms, task 168 ms, 8.5 draw calls | 14.6 fps, JS 9.14 ms, task 67.4 ms, 8.0 draw calls |

Canvas 2D is level with main (inside the run-to-run spread: the same calls; nothing on its path changed). WebGL's numbers here
are software WebGL's (no GPU on this machine): 2.2 to 2.5 times main's, the page's thread waiting about half as long a frame.
On a GPU the shader builds change nothing visible and the multisampling is as before. The phone walking (5.6 fps) is slower
than standing at the start (13.9): the walk ends at a busier view (6.5 standing there), and the tags are drawn again and
uploaded as people move (4.8 uploads a frame walking, 1.1 standing), each a draw call more where pending draws read the
atlas.
