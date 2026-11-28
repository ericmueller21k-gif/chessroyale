# Review: town phase 1c (no painting on the device, decoded pages let go, no time caps, the sidekicks' frames baked)

Independent, read-only, full lane. Reviewed `git diff origin/main...origin/claude/town-phase1c` at `a6ee42c1` (PR #1050, base
`fdebdd97`). I read the code and tests. I also ran these at the PR head: `npm run typecheck` (green, e2e included); the unit tests
`town-baked`, `town-bake`, `town-fallback` and `town-gl-fail` (41 passed); the bake (`npx tsx scripts/bake-town.ts <dir>`: 61 files; a
player's town 49 files, 2.50 MB; an admin's 56, 2.70 MB); and a check of every baked picture's padding in Node. I ran no browser and no
e2e. CI when I looked: `check` success; the full-suite e2e had 9 of 15 shards green and the rest still running.

## Blockers

None. Every failure I traced ends in the pictures or in "The town didn't load. Please retry." with Retry: never a half town, and
never a wait that can't end. That covers a file failing every time, a decode or size failing, the atlas full, a lost context
mid-load or in play, the worker's cache gone, a half-deployed site and an old tab after a deploy. Nothing still imports what was
deleted.

## Should-fix

1. **The two "Chess Town busy" `@perf` tests now always fail.** `e2e/perf.spec.ts:771` (in `busyTown`, used by the tests at `:721`
   and `:732`) polls `__townPaint().pictures.saved` until it isn't `undefined`, for up to 90 s. Phase 1c removed `saved`:
   `hookPaint`'s `pictures` is now `{ baked, bakedMs, files, bytes, count, open }` (`Town.tsx`, `hookPaint`). On `main` it was `null`
   for a baked load, so the poll passed.
   - *Failing case:* `npx playwright test e2e/perf.spec.ts --grep "Chess Town busy" --project phone`. Both tests wait 90 s at the
     poll and fail before they measure anything.
   - CI leaves `@perf` out, so the PR stays green. But these are the checks behind the 55-player frame budget and "the first walk
     after the loading screen uploads nothing" (its ride's frames kept). `docs/areas/town-square.md:1384` cites them, and phase 2
     will be measured with them.
   - The PR body's changed checks don't list them, and the `.done`'s "three @perf town tests" are the other three.
   - *Suggest:* drop the poll (nothing is saved after the card now), or poll `pictures.open === false`. Then run both once.

## Nits

- **A failure leaves the other files fetching, retrying and decoding under the Retry card** (`packages/app/src/town/baked.ts:180`).
  `fetching`'s `finally` stops the stall watch but never aborts `stop`. So after one file fails for good, the others keep downloading
  (each up to three tries now), and each is decoded and then closed by `letGo`, while the card says the town didn't load. This was a
  nit in 1b's delta re-review, and the retries make it larger.
  - *Failing case:* one file 404s (a half-deployed site). The other 48 still arrive and are decoded for nothing.
  - *Suggest:* `stop.abort()` in that `finally`. It's safe after a success: `pagesOf` takes its `letGo` listener off before returning.
- **A page whose WebGL failed as it started still fetches and decodes every town file and keeps them.** `loadTown` (`Town.tsx:3086`)
  is started at `:3286` whatever `failed` is. `loadBaked`, `takeBaked` and `warm` all run, and only `onGpu` stops (`if (... failed)`).
  `baked` stays open, about 145 to 160 MB of decoded pages, until the town closes.
  - *Failing case:* a device without WebGL 2 ("Chess Town can't run on this device."), or a second WebGL failure ("Please retry"):
    2.5 MB downloaded and 145 MB held under the message.
  - This is pre-existing, and lighter than before: `main` painted the whole town there, its paint workers included.
  - *Suggest:* `if (failed) return;` at the top of `loadTown`.
- **The three waits each get their own 15 s** (`Town.tsx:3125-3140`: fonts, then crate items, then rides, one after another, each
  its own `settledOrStalled`). With a dead connection the card can stand for the files' 15 s and then up to another 45 s before the
  town shows without them. Each wait ends and is reported, so nothing hangs. But "nothing arriving for 15 s" really means up to 45 s.
  - *Suggest:* one watch over all three (start the items' and rides' promises' watch with the fonts'), or say so in the settings
    comment.
- **A browser without `createImageBitmap` gets "Please retry" forever** (`baked.ts:238` returns `decode`, then `unloaded`). Retrying
  can't help there. In practice every browser with WebGL 2 has it, so this is wording only: "can't run on this device" would be the
  honest card.
- **A lost context in a room can end the visit.** When the context comes back, `restoreTown` (`Town.tsx:3263`) runs while you're
  inside a building. If its fetch fails (offline, and no copy in the worker), the "didn't load" box covers the room you're in, which
  itself still works.
  - Before 1c the street simply drew again once you went out. Now a lost context needs the network wherever the worker doesn't
    hold the files, for example a hard reload or a browser without a worker. That follows from the brief (pages let go once
    uploaded). Retry recovers once back online.
  - *Optional:* fail only once the player is back on the street.
- **The decision note is 155 words** (`docs/decisions/2026-11-28-town-no-device-painting.md`; the rule is about 120).

## Checked

- **No painting fallback, each way it could fail:**
  - *A file failing always:* asked three times (`retryMs` 0.5 s, 1.5 s), then `unloaded("file")`: `failed`, `halt()`, reported
    once, `onFail("retry")`. `setLoading(false)` takes the loading card away (`Town.tsx:1107-1109`). The e2e checks the three tries,
    the box's exact text, no `data-ready`, no loading card, the report, and Retry working.
  - *A decode or size failing:* the same path, reason `decode` or `size`. What had decoded is closed (`letGo`).
  - *The atlas full:* `adopt` refuses the pages whole. Each picture is then kept alone and cut from its open page (`adoptOrKeep`,
    `upload` → `fill`), and the pages are never released (`if (whole && b.open)`). After a lost context they're uploaded again from
    those cut canvases. If they fit the first time but not after a loss, it's `unloaded("gpu")`.
  - *A picture missing from the manifest:* `takeBaked` checks every want, every roof sheet, every glow, every sidekick frame and
    every box top before it changes anything (`render.ts:896-917`), and fails with `list`.
  - *A job throwing:* the `catch` gives `unloaded("gpu")`.
  - *The worker's cache cleared:* the files come from the network.
  - *A half-deployed site:* a 404, or the app's page sent for a file, is refused (`bakedFile`'s content-type check), then retried,
    then the card.
  - *An old tab after a deploy:* the old names are gone, so the card shows. Retry reloads, and navigations go to the network first
    (`sw-template.js:171`) with `skipWaiting` on install, so the reload gets the new app.
- **Lost context mid-load:**
  - Before the GPU step: the files load, then `onGpu` waits on `contextBack`.
  - During `kept()` or the warm-up: `lost()` (`painter.lost` or `losses` changed) goes round again. With the pages still open it
    adopts again; once they were released, it calls `reopen` first.
  - After a restore, `init()` sets `adoptQ` to empty and `keepQ` to every kept entry (labels, rides, items). The pictures that are
    adopted again leave `keepQ` through the new filter in `kept()`.
  - `keep()` during a loss now queues (the labels' fix). The two-step e2e covers it.
  - A loss that isn't back still follows Eric's rule (`lossWatch`, reload once, then the message). Its guard test is unchanged. It
    now waits for `lost` to read false, and `lost` covers the refill too (`dark()`), so the guard is stricter, not weaker.
- **Lost context in play:** `restoreTown` sets `refilling` and calls `halt()`. Every draw path checks `dark()` (`draw`, `run`,
  `pixelReader`, `hookBench`). The card shows on the street only. `onGpu(true)` then reopens, adopts, keeps, releases and warms up,
  and frames start again. A second loss during the refill is caught by `losses` and `contextBack`, with no second `restoreTown`
  (`refilling`). `stop()` releases a waiting `onGpu` (`contextBack?.()`).
- **The waits with no time cap:**
  - The fonts: `fonts.load(...).catch(...)`, so each settles.
  - The crate items: `p.then(one, one)` counts a rejection as settled.
  - The rides: `Rider.settled` fires after `compose` finishes, and also after a failure, a `drop` or `dead` (the `.then` after both
    branches).
  - `settledOrStalled` ends on all settled, on 15 s of nothing with the page showing, or on the town closing. A late `one()` after
    the end is harmless. A stall is reported once for each kind (`reportTownLate`). The server takes any error kind of 40 characters
    or fewer (`problems.ts`).
  - The files' own wait stalls to `stall`, which shows the card. The loop's other waits are `aFrame` (rAF, which resumes when the
    page shows), `kept()` (which finishes) and the warm-up (`loadWarmMaxFrames`).
- **`release` and `reopen`:**
  - The pages are let go only after `kept()` finishes, with no loss in between, so `adoptQ`'s references to them are already gone.
  - After that, a stand-in's pixels come only through `read` (`Painter.read`, which is null while lost or in another generation).
  - Nothing in play reaches `read`. Every 2D reader is cut under the card: `houseTop`/`houseHit` (each home's frame 0), `propMask`,
    the statue masks (on the load), the chips' and the large map's faces (boss frame 0, home frame 0, the chip icon painted on the
    device), and the sidekicks' `face()` (idle frame 0). So `read` is a safety net, used only by the picture hash in `@perf`.
  - `read`'s row order (no FLIP_Y; texels read from `e.y` up) and its un-premultiply match how the pictures were uploaded.
  - `reopen` doesn't leak: a stall or close closes what decoded, a close after success closes the pages, and `stop()` →
    `baked.close()`.
  - No canvas is made again: the stand-ins are made once by `pic()` in `plan`, `adopt` reuses the painter's entries (`reg`/`live`
    don't grow), and the old atlas page objects are dropped by `init()`.
  - TDZ: `loadTown()` is first called at `:3286`, after `NET`, `aFrame`, `unloaded`, `onGpu` and `whole` exist.
- **Rivet and the sidekicks' frames:**
  - `sheetName` uses the `SIDEKICK_SHEETS` key, which is the file's name (`timber`). Rivet's id was the only one in the town that
    differed from its file.
  - The bake gives Rivet's and Tick's files `.admin`, and the 14 others to both towns. A player's town fetches 14 sidekick files,
    an admin's 16 (the e2e checks both, and that neither fetches the other's own).
  - `takeBaked` needs every name from `SpriteFrames.names()`, and `names()` matches the bake's `frameName(id, anim, col)` loop.
  - In Node, every one of the 3,870 baked pictures (998 of them sidekick frames) has a clear 2 px ring inside its file, so smoothing
    never reads a neighbor.
  - `unpng` refuses anything `png` didn't write, so a re-exported sheet fails the build loudly.
- **What was deleted:**
  - No import, switch or field is left: I searched for `paint-pool`, both workers, `town-art`, `TOWN_PAINT_*`, `?paintall`,
    `?paintworkers`, `?paintslow`, `loadSheetWaitMs`, `TOWN_PICTURES.on`/`baked`/`maxMB`/`waitMs`/`sliceMs`, `idbShelf`, `restore`,
    `save`, `pictureSig`, `paintSpecs`, the tops functions and `warmClean`. Only comments remain, plus finding 1's `saved`.
  - The typecheck covers e2e. `e2e/areas.json` drops `town-art.ts`.
  - The old IndexedDB goes by `deleteDatabase` (no empty database made), once a page, after a load. So does `brc.townTops`.
- **Same pixels:** `town-bake.test.ts` checks that the bake equals the painting code pixel for pixel, sidekick frames included. In
  CI, `town-street`'s `bakedTexels` checks that the GPU holds each file's pixels in the device's list order. The perf test's hash is
  the author's figure, not re-measured here.
- **Guards:** no test that guards a rule in `docs/rules/eric.md` changed. The lost-context guard file is untouched (see above).

## Not reached

- **iOS Safari, now with no painting to fall back on.** I read the code for Safari but couldn't run it.
  - Whether `createImageBitmap(blob, options)` decodes there, and gives premultiplied, unconverted texels, on iOS 15 to 17.
  - Whether the background context loss brings the refill card back as designed.
  - A `decode` row in `ops:report` from iPhones would now mean the town can't open there at all.
  - The evidence for deleting painting is about 90 minutes of 1b, to Eric alone. The director's call; Eric's iPhone check after the
    deploy (open the town, leave the app a few minutes, come back, `/town?report`) is the one that settles it.
- `Painter.read` on real GPUs (only the `@perf` hash uses it). The perf and memory figures (not re-measured). Rivet's stills.
