# Review: town phase 1b (the app loads the build's baked pictures)

Independent, read-only, full lane. Reviewed `git diff origin/claude/town-phase1a...origin/claude/town-phase1b` at `9e9c2046` (1a is
PR #1040, now in `main` as `13320d59`). The diff also carries `main`'s commits merged into 1b (Stranger, the Squads specs, a
LESSONS entry): each is identical to `main`'s, so I didn't review them. I ran the bake locally (`npx tsx scripts/bake-town.ts <dir>`:
61 files, 3.28 MB; a player's town 35 files 2.33 MB, an admin's 40 files 2.52 MB; manifest 378 KB, which matches the PR) and measured
the atlas layers with `placePages`/`countPages` in Node. No browser runs.

## Blockers

None. Every path I traced either loads the right pictures or falls back to painting with the right pixels. I found nothing that
shows a stale or wrong picture, loses stored data, or lifts the card before the baked pages are uploaded.

## Should-fix

1. **Home's prefetch runs while Home shows the queue, including a boss battle's lobby, and nothing stops a file already in flight.**
   `packages/app/src/screens/Home.tsx:798` (the effect depends on `[adminTown]` only); `App.tsx` keeps HomeScreen mounted across
   `home()` / `home(<QueueScreen…/>)` ("Always a fragment with the frame first"), and `inQueue` covers a solo match's `lobby` and an
   online auto match's `loading`; `solo.ts:713-722` (`fill()` starts `prefetchMaia()`, then the lobby); `baked-files.ts:67-85` (no
   abort). *Failing case:* tap Boss Battle's START 1 s after home shows. Solo `fill()` starts Maia's 40 MB prefetch and the 3.1 s
   lobby, and Home stays mounted with `queue` set. At 4 s home's timer fires: the manifest (378 KB, at normal priority) and up to 35
   files are fetched one by one beside Maia's files and the battle's chunk. The same happens during an online match's `loading`
   phase and a duel's search and versus moment (`Duel.tsx:329`, `frame(versusStage)`). When Home unmounts (the match starts), the file
   in flight (up to 258 KB) runs to the end. The town's own load (`Town.tsx:3086`, `baked.ts:55-63`) also keeps fetching and decoding
   every file after the town closes (back out, then PLAY). *Suggest:* run the prefetch only when `queue` is empty (put it in the
   effect's deps) and pass an `AbortSignal` that `stop()` aborts. Have `loadBaked` stop fetching and decoding once `alive` is false.

2. **No guard against a stalled fetch on the loading screen.** `loadBaked` waits for every file with no limit (`baked.ts:55-66`,
   `Town.tsx:3086`). The kept path it replaces had `within(go(), TOWN_PICTURES.waitMs)` (`keep-pictures.ts:333`). *Failing case:* a
   request that never settles (a hung connection, or a worker `fetch` that never answers) holds the card up indefinitely with the
   bar stopped. Before 1b the town's pictures never waited on the network. *Suggest:* a no-progress limit (no file landed for N s:
   abort and paint). "A longer load is fine" still holds, because it fires only when nothing moves.

3. **The fallback is silent.** `bakedManifest` swallows every error (`baked-files.ts:55`), `loadBaked` returns null with no reason
   (`baked.ts:50, 65-74`), and `takeBaked` false is dropped (`Town.tsx:3087-3090`). *Failing case:* a device class where the baked
   path fails (an iOS decode difference, a persistent routing or CDN problem, an old tab after a deploy) paints for 11 s (slowed
   phone) on every visit, and nobody can see it. *Suggest:* report once a page through `problems.ts`, as `reportTownFallback` does
   for WebGL, with the reason (manifest, file, decode, size, list). "Fix the cause" needs to see the cause.

4. **On a first-ever visit, home's prefetch can run before the service worker controls the page.** `install.ts:26-28` registers
   on `load`, and the worker controls only after precaching 127 files, `prune()` (asks each tab, up to 1.5 s) and `clients.claim()`.
   `baked-files.ts:80` starts at 4 s regardless. *Failing case:* on a connection that takes more than about 3 s to precache, the
   early files bypass the worker (only the HTTP cache keeps them, and the files are revalidated on the town's first visit). The e2e
   "home fetches Chess Town's baked pictures when idle…" (`e2e/town-street.spec.ts:560`) asserts that every file is in the worker's
   cache, so it depends on that timing on a loaded CI runner (a flake risk). *Suggest:* when a worker is registering, start after
   `navigator.serviceWorker.controller` is set (or on `controllerchange`).

### Should-fix, fine to leave to phase 1c (the director's call)

5. **Dead storage stays on every device.** In a baked build nothing reads or clears the `hunchess-town` IndexedDB entry
   (`Town.tsx:3099`: `shelf` is null whenever `bakedBuild`; `keep-pictures.ts:367`) or `localStorage["brc.townTops"]`. That's about
   5.8 MB per device that opened the town since Nov 23 (`.done` puts deleting it in 1c). Clearing it once after a baked load costs
   two lines: `idbShelf()?.clear()` and `removeItem(TOPS_KEY)`.

6. **Memory: each page is kept twice.** The decoded files stay for the town's whole life beside the GPU's copy, to refill after a
   lost context. Measured from the bake: 144.5 MB decoded for a player's town and 159.6 MB for an admin's. Whole-page placement
   takes 9 layers (player) and 10 (admin) for the pages alone, against 8 when pictures are packed one by one. That is +1 to 2 layers
   (17 to 33 MB of GPU memory) before keep's labels and the 2 spare layers. This isn't a regression (a later visit has held the same
   since Nov 25, and a first visit held as much in painted canvases). Still, the brief asks for "nothing kept twice", and iOS is
   where it hurts. A 1c option: close each page once `kept` has uploaded it, and re-fetch it from the worker's cache after a lost
   context. The stand-ins that a 2D context draws from (`cutBeforeDraw`, such as the light layer) would need their own source then.

## Nits

- **`adopt` assumes it takes every page** (`paint-gl.ts:774, 799`; `keep-pictures.ts:111`). With the baked town, `Pictures.add`
  never calls `keep`. If `adopt` can't take the pages whole (no room, or `kept` already started), the pictures upload one at a time
  on first draw, after the card lifts. That can't happen today (9 or 10 layers against room for 46), but the doc's "leave every
  picture to `keep`" is no longer true. Have `adopt` return whether it took them, and keep them otherwise.
- **The town-file copy in precache can fail the whole install** (`sw-template.js:57-61`). A quota error on `cache.put` rejects
  `precache()`, so the new version never installs, all for an optimization. Wrap that loop in `try/catch`.
- **`TOWN_FILE` repeats `BAKED_NAME`** (`sw-template.js:27`, `manifest.ts:44`) and no test ties the two. If they drift, the worker
  silently stops answering town files across versions. Check the template's pattern in `town-bake.test.ts`, or fill it in from
  `BAKED_NAME` in `vite.config.ts`.
- **Every home visit re-reads every file** (`baked-files.ts:67-85`, no "done" memo). After each match, 36 requests go through the
  worker and about 2.7 MB is read into blobs. Without a worker (blocked, private mode, some in-app browsers) that's 36 revalidations
  each time (no `_headers`). A per-page flag for the manifest already fetched would end it.
- **The prefetch's manifest runs at normal priority** (`bakedManifest` → `bakedFile(name)` without `low`). It's also parsed on
  home's main thread: 378 KB of JSON and about 2,900 pictures checked, an estimated 15 to 30 ms task on a slowed phone.
- **Data use:** 2.33 MB plus the 0.37 MB manifest (a player's town) for everyone who rests on home 4 s, whether or not they ever
  open the town. Only `saveData` is respected, with no check on `effectiveType`. The director's call.
- **The town can wait on home's low-priority fetch.** The dedupe hands the town's loading screen a fetch that home already started
  at low priority (`baked-files.ts:36-44`).
- **Dev only:** `bakedManifest` is memoized per page, but its doc says order.json is "read fresh each time the town loads"
  (`baked-files.ts:14-16`). After an art edit without a full reload, the next town asks for the old bake's files, which are gone, and
  paints instead (right pixels, slowly). Also, a re-bake can start while another is still running (`vite.config.ts:87, 106-108`: the
  next request after `handleHotUpdate` starts a second `bakeTown`, whose `rmSync` can remove files the first one is serving).
- **`.done` and `.pr-body.md` are committed on `claude/town-phase1b`.** Drop them before merging, as 1a did.

## Pre-existing, outside the diff (for the director)

- **The precache keeps any 200 answer, with no content-type check** (`sw-template.js:47-55`). If a deploy is caught half-propagated,
  an `/assets/` file answered with the app's page (`not_found_handling: single-page-application`) would be kept under its content
  name and then answered from any version's cache. The town's files have that check (the worker's `!page`, and the page's own); the
  precache doesn't.
- **Time limits that can lift the card early:** `loadSheetWaitMs` (3 s) for the sidekicks' sheets, the crate items and the rides
  (`Town.tsx` `until()`). These predate 1b and bear on "load first, then show".

## Checked

- **Content names:** a PNG's name hashes its page's size and pixels (`bake-town.ts:196`), and the manifest's name hashes its text
  (`:222`). One name means one set of pixels in every version, so "any version's cache" can't answer with a wrong page. Two encodings
  of the same pixels share a name harmlessly (only `bytes`, used for the bar, differs).
- **The worker:** it answers town files from any cache. It keeps a network answer only when it's a 200 that isn't HTML
  (`sw-template.js:212-224`). `order.json` never matches `TOWN_FILE`. A missing file comes back from the Worker, through
  `ASSETS.fetch` and the SPA fallback, as HTML or a 404. Both are refused by the page too (`baked-files.ts:40`'s content-type check;
  `manifestFrom`).
- **Old app with a new worker, and the reverse:**
  - `main`'s worker with the 1b app: the PNGs are kept by `LAZY` in its version, the JSON comes fresh, and the 1b worker copies the
    PNGs as it installs.
  - The 1b worker with a pre-1b app: no requests.
  - A 1b tab of version A under worker B: A's files come from A's cache (`prune` keeps it while a tab runs A) or the network.
    Otherwise A paints its own pictures. If the art didn't change, the manifest's name is the same in both.
- **The copy step:** it copies only this version's files that an older cache has. It never fetches, and an unchanged manifest is
  copied too.
- **A half-deployed site:** the app's page sent for the manifest or a file gives null and clears the `manifest` memo, so the next
  visit asks again. Nothing is cached.
- **All or nothing:**
  - Any file failing, failing to decode or not its size gives null, and every decoded page is closed (`baked.ts:65-74`).
  - `takeBaked` checks every item on the list (frames with the manifest's counts, roofs' sheets, glows, statues) and every box's top
    before it changes anything (`render.ts:918-937`). On false, `made.close()`.
  - The fallback paints with workers and keeps nothing.
- **A lost context mid-load:** `adopt` takes nothing (`!this.lost`), `kept` returns 1, and the warm-up is skipped. After the context
  is back, pictures are filled from the still-open bitmaps and uploaded as they show, as on later visits since Nov 25. The e2e
  lost-context check is unchanged and now runs baked.
- **The town closing mid-load:** `made` is closed, `baked.close()` runs on close, and `adopt` and `kept` are guarded by `alive`.
- **Load first, then show:**
  - Every fetched file is adopted, then uploaded by `kept` before the warm-up and the card's lift (`Town.tsx:3122, 3170-3204`).
  - The sidekicks' frames and the labels go to `keep` directly (`render.ts:1998-2006`), not through `Pictures.add`, so nothing is
    left to upload on first draw.
  - The lazy statue sculpting is never read with the baked town, and the close-up draws `statueFrame` a layer at a time.
- **Admin and player:** files are split by (group, towns) (`bake-town.ts:158-162`), and `filesOf` picks by kind. Home's kind comes
  from `profile.admin` and the town's `ADMIN_TOWN` from the same profile (the splash waits for it). The e2e checks that neither town
  fetches the other's own files, and that a player's cache holds no admin files.
- **`placePages`:** no page overlaps another. Every page carries its pictures' 2 px padding (`packPictures` pads each picture, and the
  bake's width adds the right-hand pad), so pages side by side don't bleed under `LINEAR` sampling.
- **Frame times:** the manifest's times are keyed by the art's id. The bake refuses two animations under one id, and the
  `FrameCache`s made during play (walls) come from the same art.
- **The dev bake:** the middleware is lazy, names are checked by `BAKED_NAME` (none leaves the folder), and answers are `no-store`.
  A `frames:*` script bakes only if it opens the town, and home doesn't prefetch in dev.
- **Same pixels:** the e2e compares a painted town's picture hash and GPU hash with a baked town's, for a player and an admin, with
  the worker blocked (`e2e/town-street.spec.ts:598-631`).
- **Guards:** no check that guards a rule in `docs/rules/eric.md` changed (the WebGL-lost guard isn't touched).

## Not reached

- **iOS Safari:** two things are unverified on iOS: whether
  `createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "default" })` decodes off the main thread, and whether
  it gives the same texels as a painted canvas uploaded with `UNPACK_PREMULTIPLY_ALPHA_WEBGL`. The same-pixels check runs in
  Chromium only. Since 1b, every iPhone visit takes this path, not just later visits. Worth Eric's one look at the town at night
  (glows, roof edges) on his iPhone after the deploy, plus `/town?report` as `.done` suggests.
- No browser runs here (no e2e, no `@perf`). The branch's CI hasn't run (no PR yet).
- GPU memory on a real phone: about 12 layers of 2048 x 2048, about 200 MB with the spare layers. iOS's limits.
- Cloudflare's actual headers for `/town-pictures/`. I assumed the Workers default (`max-age=0, must-revalidate` with an ETag).
