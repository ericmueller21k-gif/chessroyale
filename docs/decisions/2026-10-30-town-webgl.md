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
