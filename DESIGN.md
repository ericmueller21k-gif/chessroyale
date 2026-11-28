# Chess Town: a permanent structure for loading and drawing

An independent audit and design (Nov 28, 2026). Measured on `main` at `9fc9f67d`; `claude/town-load-smooth` was **not** merged.
No code changed. How it was measured, and its limits, are at the end.

## In plain words (for Eric)

**What's wrong.** The town's pictures don't exist until your phone makes them. Every wall, roof, glow and name is worked out from
code, pixel by pixel, on the device: 2,250 pictures, 49.5 million pixels, the first time the town opens **and again after every
update we ship**, even one that changed nothing in the town. That is the 10 seconds. And because every picture must be made at
some moment, each new thing has only two places to go: into a frame (lag) or onto the loading screen (a longer load). For a month
we have moved things from one to the other. That is why it keeps coming back.

**What I'd build**, in this order:
1. **The build makes the pictures, not the phone.** When we ship, our build paints the town once and saves it as picture files. A
   phone downloads them once, keeps them, and only puts them on the screen. A first visit and a later one load the same.
2. **One file per piece of town.** Each home, each street's row, each district is its own file. Add a building and a phone
   downloads that one file; nothing else is fetched or made again.
3. **One door for pictures made on the phone** (name tags, speech bubbles, outfits): made between frames, never inside one. The
   drawing code can no longer make a picture mid-frame, so a new feature can't bring the lag back by accident.
4. **Only what's near you.** Each frame looks at the part of town in view, not all of it, so a bigger town costs the same per frame.

**What you get** (my estimates, from the measured parts). On the slowed-phone test, which stands for a slow phone: about 3 s after
step 1 (today 10.5 s after any update, 4.6 s otherwise), about 2 s once the roofs change in phase 3; about 1 s on a computer.

## 1. Findings

| Tap on Chess Town until the town shows | Phone, CPU slowed 4x | Computer |
| --- | --- | --- |
| First visit, **or any visit after a deploy** | 10.1 to 10.7 s | 3.1 to 3.5 s |
| Later visit on the same build | 4.4 to 4.9 s | 1.2 to 1.4 s |
| First ever, straight to `/town` | 12.5 s | 4.6 s |

- **Bytes are not the problem.** A first-ever visit: 46 requests, 3.4 MB (about 1.1 MB compressed). A later visit fetches nothing
  of the town from the network.
- **Per frame, walking:** our code takes 11.7 to 13.3 ms on the slowed phone (3.2 to 3.6 ms on a computer): the ground 2.9 to 3.5,
  placing and sorting 2.7 to 3.8, props 1.6 to 1.8, the edge chips 0.9 to 1.1, buildings 0.8 to 0.9. 6 draw calls a frame; 10,000 to
  20,000 vertices rebuilt and sent again each frame (0.5 to 1.0 MB).
- **Uploads while walking:** 1 in 6 to 10 s (a boss's speech bubble), 2 in a full turn, no atlas page started again. In an empty
  town by day, `main` is clean after the fixes of Nov 25 to 27.

### What the town does that it shouldn't

1. **It paints every picture on the device** (`render.ts:1844 warm`, `:1900 plan`, `:369`; `paint-pool.ts`). First visit, slowed
   phone: 7.1 of 11.9 s is the load, 5.8 s of it painting. Even with three paint workers the main thread spends 2.0 s handing them
   the art (parts built a pixel at a time as text, `houses/kit.ts:28`), 1.0 s putting pixels on canvases and 0.5 s making 3,452
   canvases. Its longest single freeze is 1.4 to 1.5 s, so the loading bar itself stops.
2. **It throws the saved pictures away on every deploy** (surprising). Their key starts with the build's commit id
   (`Town.tsx:2967`, `keep-pictures.ts:160`). I built the same code under another commit id: the next visit painted everything
   again, 10.1 s instead of 4.4 (computer 3.1 instead of 1.4). `main` deploys many times a day, so Eric nearly always gets the slow
   path, and players will after each update. That rebuild also renamed 80 of 98 script files (1.8 MB compressed, fetched again).
3. **A "fast" visit still rebuilds what it had** (surprising). Later visit, slowed phone: 1.0 s setting the renderer up, 0.8 s of
   it building every character's animation data only to count its frames (`render.ts:354`); 0.65 s reading the saved pages;
   0.8 s uploading them; 0.25 s making 258 label pictures again (`:3384`); 0.2 to 0.3 s cutting the sidekicks' sheets into
   875 canvases, each uploaded alone (`:445`).
4. **It holds far more pixels than the town needs.** Of 49.5 million: roofs 17.6 M (36%), each drawn ahead for four camera
   headings (`:2006`); a darker second copy of every wall, about 6.5 M (`:384`); **text 8.7 M (17%)**: 17 home names at 9 sizes
   and 21 name tags at 5 (`:238`). That is 14 to 16 atlas pages, 235 to 270 MB of GPU memory, with the pictures held again in
   ordinary memory (190 to 235 MB): by arithmetic, not a phone's reading, about 450 to 500 MB while the town is open.
5. **Any draw call can make and upload a picture inside a frame.** The painter uploads whatever it's handed the first time it's
   drawn (`paint-gl.ts:780`, `:793`). The speech bubble still does (`render.ts:3874`).
6. **Each frame walks the whole town:** about 200 boxes planned (`:1773`) and 1,100 items placed and sorted (`:1584`, `:1639`),
   whatever is on screen. That grows with the town.
7. **Work goes on after the town shows.** A first visit packs and saves its pictures from 1.5 s after the first frame, for 4.1 s
   on the slowed phone (`Town.tsx:3036`); the buildings' tops are worked out in idle slices (`render.ts:3724`). By its commit
   messages `town-load-smooth` moves both under the loading card: smoother after, a longer load than the table above.
8. **Small ones.** The edge chips' faces are cleared and redrawn about 8 times a second while walking (`Town.tsx:2228`). With 55
   players their tags alone (about 9 M pixels) overflow the 2 spare atlas pages (8.4 M, `paint-gl.ts:51`), so pages start again
   and upload again: the busy-town test says so in a comment.

### Why it keeps coming back

The history is one pendulum. Nov 10: pictures painted as they first show, to open faster. Nov 11: that lags, so a loading screen
paints them all. Nov 23: too long, so workers and a saved copy. Nov 25: labels lag, moved to the load. Nov 26: glows lag, moved to
the load. Nov 27: tags and item frames lag; the tops moved off the load. Nov 28 (the unmerged branch): the tops moved back, the
load's budget raised from 12 to 14. Three causes, all structural:

1. **The pictures are made on the device**, so each is paid for in a frame or in the load, and every addition adds to one.
2. **Nobody owns making pictures.** Drawing code makes a canvas and the painter uploads it on first use, so each new kind of
   picture (labels, glows, tags, rides, item frames) ships with a hitch until someone finds it and moves it by hand.
3. **The town is one lump:** one picture list, one atlas, one load, one loop over everything. Its cost follows its size.

## 2. The structure I'd build

**The rule: what is the same for every player is made by the build. The device fetches, uploads and draws.**

- **A bake step in the build** (`scripts/bake-town.ts`), running the painting code we have: `paint-jobs.ts` has no browser calls
  and is already the one copy the workers and the page share. It writes picture pages (PNG, named by their contents) and a small
  manifest: each picture's place, each animation's frame count and timing, the roofs' and glows' pieces, the tops.
- **Groups.** Pictures are packed by group: one a home (its frames, its boss, its glow), one a street's row, the park, the
  Colosseum, the props, each sidekick's sheet as it is. A group is a file; the device places groups on the atlas's pages itself,
  so a file's name and a GPU page aren't tied. Add a building: one new or changed file, nothing else moves.
- **Loading** becomes the path a later visit takes today (`paint-gl.ts:725 adopt`), fed by files the service worker keeps: fetch,
  decode off the main thread, upload. Home fetches the town's files quietly when idle, as it does the music.
- **A picture service for what the device must make** (a name, an outfit, a ride, a bubble): asked for ahead, made and uploaded
  between frames within a budget, drawn when ready and left out until then. Once the loading card lifts, the painter no longer
  uploads inside a draw. That removes the lazy path instead of checking for it.
- **Text at one size**, scaled by the GPU: one picture a name, not nine or five.
- **A grid over the town:** placing, sorting and sight lines visit only the cells in reach. Later, the ground as a mesh the GPU
  keeps, with the camera's formula (`camera.ts:237`, a few lines) in the shader.

**Keep:** the camera, the world and the street plan, the boxes' geometry, `render.ts`'s drawing and the WebGL painter (6 draw
calls and 12 ms slowed is sound), the atlas and `adopt`, `paint-jobs.ts` (it moves to the build), the frame report, the art as it's
authored. **Replace:** painting on the device (`paint-pool.ts`, the worker, the saved copy in `keep-pictures.ts`), the picture list
buried in the renderer, labels at every size, upload on first draw, the loops over the whole town.

**One honest trade.** A first-ever visit downloads more: about 6 MB of pictures once (today's pages are 6.4 MB as PNG) against
1.1 MB of code today. On a slow connection that one load is over 2 s until phase 3 shrinks it to about 2.5 MB. After that an update
fetches only the groups that changed.

## 3. The plan in phases

Each ships alone. Hours are helper-hours; anything over an hour or two is split into jobs.

| Phase | What | Measured by | Hours | Risk |
| --- | --- | --- | --- | --- |
| **0. Stop losing the saved town** | Key the saved pictures by a fingerprint of the town's art, taken by the build from the bundler's list of the town's modules, not the commit id. Chips' faces drawn once a place. | "After a deploy": 10.1 to 4.4 s slowed, 3.1 to 1.4 s on a computer. | 1 to 2 | Low. |
| **1. The build makes the pictures** | (a) The picture list out of the renderer; the bake script; a test that its pixels equal today's (the picture hash we have). (b) The app loads groups and the manifest; frame counts and tops from the manifest. (c) Device painting deleted; home fetches the town's files when idle. | First visit equals later visit: about 3 s slowed, about 1 s on a computer, no freeze over 200 ms. | 10 to 14, three jobs | Medium. No visible change. A longer build (10 to 30 s, my estimate). The bigger first download. |
| **2. One door for device-made pictures** | The picture service; no upload inside a draw; labels at one size; bubbles made ahead of their line. | 0 uploads inside frames on the 55-player walk; no page started again; text 8.7 M to about 1.5 M pixels. | 5 to 7 | Medium. Small text may look softer: a still for Eric first; two sizes if he prefers. |
| **3. The same look from fewer pictures** | Roofs drawn as faces from one roof texture a building; the darker step in the shader, not a second copy. | 49.5 M to about 20 M pixels; 15 pages to 6 or 7; about 2.5 MB; GPU memory about 110 MB; about 2 s slowed. | 8 to 12 | Higher, on looks: stills for Eric before any build. If roofs can't match, keep the baked ones. |
| **4. Only what's near** (when the town grows) | The grid; the ground on the GPU; groups by district with a half-size copy for far views, the start district before the card lifts and the rest between frames. | A test plan with the town doubled: frame cost and load within 10% of today's. | 6 to 10 | Medium. |

Phases 0 to 2 change no pixel of the world. Targeted lane for each; phase 1 with the `full-e2e` label, as it changes how the town
loads for everyone.

### Adding to the town, after phase 1

1. Draw it as today (a file in `houses/`, a look in `buildings.ts`) and place it in the plan.
2. Name its group: its own, or its street's.
3. Build. The bake prints what it cost: pictures, pixels and bytes for its group and the town's totals. That is the whole cost:
   one file's download, once.
4. Anything that changes while playing (text, an outfit, a state) asks the picture service. Nothing makes a canvas inside a draw.
5. Nothing to add to the loading code, the renderer's lists or a test's budget.

## How this was measured, and its limits

Headless Chromium on a 4-core machine. The phone is Playwright's iPhone 13 with the CPU slowed 4x (paint workers too,
`?paintslow=4`); the computer is 1280 x 800 at full speed; ranges are 2 to 5 runs. My own counters wrapped the browser's WebGL and
canvas calls, so the counts don't rest on the town's own; timings come from runs without them; CPU profiles from an unminified
build; pictures named by a local patch, not committed. "After a deploy" is the same code built under another commit id, opened in
the same browser profile.

**The limit:** WebGL here is drawn in software, so this machine's frame rate (7 to 15 a second) says nothing about a phone, and
GPU costs (overdraw, the 4x smoothing, real upload times) couldn't be measured. Our script's time per frame, the counts, the bytes
and the load's CPU time are sound; the memory figures are arithmetic. Each phase should be confirmed with Eric's `/town?report` on
his phone and laptop.
