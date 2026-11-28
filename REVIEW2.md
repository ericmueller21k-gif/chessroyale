# Delta re-review: town phase 1b's review fixes

Independent, read-only, full lane. Reviewed `git diff 60210c3e..origin/claude/town-phase1b` (970085d0, 9c235859, b2a7e0bd; head
737e1bab adds only `.done2`) against `REVIEW.md` (9e9c2046). I read the code and tests and ran small checks in Node. I ran no browser
and no e2e here. CI on PR #1043, when I looked: `check` success (unit, chess 1 and 2). The full-suite e2e on the head was still running
(15 shards). `.done2` reports green on b2a7e0bd.

## Blockers

None. Every fix closes its finding. None of them can show a wrong picture, cut off a load that's still moving, or keep half a file.

## Should-fix

1. **The town closing mid-load still starts the paint workers. They paint for up to 3 s after you've left.**
   `packages/app/src/town/Town.tsx:3130`, then `:3146`.
   - When the town closes, `loadBaked` now returns null at once (S1). But `loadTown` doesn't stop there. It runs `restore(null…)`, then
     `domPaintPool(r.paintSpecs(), n, …)`, whose constructor hands every worker its first pictures right away (`paint-pool.ts:62`).
     Then it waits at the sheets' race (`until()`, up to `loadSheetWaitMs`, 3 s) before `pool?.close()` at `:3159`.
   - `stop()` can't close that pool, because it didn't exist yet when `stop()` ran.
   - *Failing case:* open Chess Town on a slowed phone and tap back while "Loading the town's pictures…" shows. Home comes up while N
     workers (all cores but one) paint town pictures nobody will use, for up to about 3 s. Home's first frames and its own fetches
     compete with them.
   - This isn't a regression: before the fix the same pool started later, once the abandoned load finished. But it is the same waste S1
     set out to end ("nothing more decoded"), and painting costs more than decoding.
   - *Suggest:* `if (!alive) return;` right after the baked block (before `shelf`/`restore`), or `pool = !alive || from || made ? null : …`.

## Nits

- **A fallback leaves the other files fetching and decoding beside the paint** (`baked.ts:116-117`). On `file`, `decode` or `size`,
  nothing calls `stop.abort()`, and the decode guard checks only `stop.signal.aborted`. So after one file 404s (a half-deployed site),
  the other 34 keep downloading and each is decoded, then closed by `letGo`, while the paint workers run.
  - Letting the fetches finish is arguably good, since the worker keeps them for the next visit. The decodes are pure waste.
  - *Suggest:* `if (stop.signal.aborted || failed) return fail("file");` before `io.decode`. This is pre-existing (the first loadBaked
    did the same).
- **Home still fetches ahead during the app's `loading` wait** (`Home.tsx:800-801`). The effect follows `queue` only. `startSolo`
  (`App.tsx:1595-1598`) sets `loading` and awaits the engines, Solo's code, the opening library and the match chunk before the lobby's
  `queue` shows. Boss Battle's START also starts Maia's 40 MB there. So home's low-priority file can share that wait.
  - It's one file at a time at low priority, so the cost is small. *Suggest:* add `loading` to the condition.
- **Dev only: the stall can fire while the dev server bakes** (`baked-files.ts:81`, `baked.ts:81-85`). The dev manifest's `order.json`
  waits for the bake (about 10 s on the author's machine, per the 1b PR body), and no byte arrives meanwhile. On a slower or busy
  machine, a bake over 15 s makes the first town load `stall` and paint, silently: the same pixels, but slower. `frames:*` timings would
  then measure the painted path.
  - *Suggest:* no stall watch when `TOWN_MANIFEST === "order.json"`, or start it once the manifest is in.
- **Home's wait for the worker can last for home's whole life where a worker exists but never controls the page** (`baked-files.ts:96-106`).
  Two cases: a hard reload (acknowledged in `.done2`), and an install that keeps failing (the precache's stricter checks, or quota).
  `register()` resolved, so `workerNever` never resolves. That's benign: nothing is fetched, nothing hangs, and the listeners go when
  home closes.
  - Small edge: if `stop()` runs between the timer's idle request and its callback, `workerAnswers` gets an already-aborted signal,
    whose `abort` never fires again, so the listener stays until a controller comes. *Suggest:* `if (signal.aborted) return Promise.resolve();`.
- **A failed file isn't remembered** (`baked-files.ts:128`). In a tab left open across a deploy that changed the art, the old build's 36
  names are gone from the server. Every home visit (after each match) asks for all 36 again, and each is answered with the app's page.
  - Harmless: nothing is kept (`isPage`, and the page's own content-type check). It's just 36 wasted requests a visit.
  - *Suggest:* stop the loop at the first failure, or add failures to the memo.
- **Clearing the old save creates an empty database on devices that never had one** (`Town.tsx:3104`). `idbShelf().clear()` opens
  `hunchess-town` at version 1, and `onupgradeneeded` creates the store.
  - Harmless and tiny. `indexedDB.deleteDatabase("hunchess-town")` would clear it without creating one (nothing else lives in it).
- **`.done2` and `.pr-body-add.md` are committed on `claude/town-phase1b`.** Drop them before merging, as with 1a.

## Checked

- **S1, the queue:**
  - Every queue is `homeFrame` with `queue` set to JSX: a boss battle's and 50 v 50's lobby (`inQueue(match)`, `App.tsx:2862-2880`), a
    party's screen, `QueueLine`, and 1 v 1's search, refused and versus (`Duel.tsx:302, 316, 329`).
  - The town renders without Home (`App.tsx:2498`), so home's fetch and the town's load never run at once. That's why dropping the
    dedupe map can't double a download.
  - Home's `stop()` aborts the file on its way.
- **S1, the town closing:**
  - `townClosed.abort()` in `stop()` ends every fetch and the wait for them.
  - A file that lands after the stop isn't decoded (`:116`).
  - A decode that was already running is closed when it resolves (`letGo`).
  - `onShare` stays quiet after the stop.
  - `ended()` returns null, so nothing is reported.
  - `adopt` and `kept` are guarded by `alive`, and the painter goes with `halt()`, so no atlas is left half-uploaded.
- **S2, the stall limit:**
  - Any chunk of any file, the manifest's included, resets the count (`read()` → `moved`), and so does each decode.
  - Ticks are counted, not wall time: a busy main thread delays the stall and never brings it sooner.
  - Hidden time doesn't count, and the count resumes where it was.
  - The effective window is 14 to 15 s of nothing.
  - A load where every byte is in only waits on single decodes, each well under 15 s. So it can't stall unless one decode takes 15 s.
  - On a stall: every fetch is aborted, the reason is `stall` (ahead of the `file` errors the abort itself causes), and the watch is
    cleared in `finally` (the unit test checks no timer is left).
- **No half-kept file:**
  - A stopped request's body errors, so its `cache.put` rejects and nothing is stored. The new `.catch` ends the unhandled rejection.
  - In a browser that doesn't pass the page's abort on to the worker's `fetch`, the clone finishes and the whole file is kept, which is
    also fine.
- **`adoptOrKeep`:** when `adopt` returns false, it has still set `this.fill` and marked each picture `stand`. `kept()` → `entry()` →
  `upload()` fills a stand-in before uploading it (`paint-gl.ts:849-851`). The keep path therefore uploads the right pixels under the
  card. When the context is lost, `keep` returns at once, as before.
- **The worker's install:**
  - The town-file copies are in `try/catch`.
  - `/assets/` holds only Vite's JS, CSS, fonts and wasm: the only HTML entry is `index.html`, precached as `/`, and the preview pages
    aren't built. So `isPage` never refuses a real asset.
  - `status === 200` versus `ok` changes nothing for these files.
  - A page an older version kept under an `/assets/` name is fetched again, not copied.
- **The worker's pattern:**
  - `String(TOWN_FILE_PATH)` is a valid regex literal.
  - `String.replace` inserts its trailing `$/` literally.
  - The template has one `__TOWN_FILE_PATH__`, and `__TOWN_FILES__` doesn't match inside it.
  - The pattern accepts a baked name and refuses `order.json` (checked in Node).
  - `TOWN_PICTURES_DIR` is defined once (`manifest.ts:8`).
- **S4:** with no `serviceWorker`, dev, or a failed registration, it doesn't wait. A first visit waits for `controllerchange`. A later
  visit doesn't wait.
- **S3:**
  - Reported once a page with the first reason.
  - Not reported when the town closes, for `?paintall`, or for a build with no bake.
  - `list` is reported only while the town is alive.
  - The unit test sends through the real `captureError` batch.
- **S5:** it deletes only key `town` in `hunchess-town`/`pictures`, the database nothing else uses (`keep-pictures.ts:368-400`), plus
  only `brc.townTops`. It runs once a page, after a baked load. A baked build never reads either.
- **The `fetched` memo:**
  - A file goes in only once it has been read to its end, so a stopped one is asked for again.
  - An admin's town after a player's asks only for its own page.
  - The profile turning admin restarts the fetch, which skips what it already has.
- **Data use:** `saveData` and `slow-2g`/`2g`/`3g` are respected at the start (the director's call, as noted).
- **Dev:** one bake at a time (`running` chain; `baked === mine` on error), and `order.json` is read fresh each load.
- **Tests:** each new unit test drives the real module (stall with fake timers and hidden time, close, `adoptOrKeep`, memo, stop,
  controller, connection). The e2e queue check can't pass on the new code if home fetched in the queue.
- **Guards:** no check that guards a rule in `docs/rules/eric.md` changed.

## Not reached

- **iOS Safari:** the streamed read (`Response.body.getReader()`), `createImageBitmap` on a Blob built from chunks, and whether WebKit
  aborts the worker's `fetch` with the page. The first review's iOS items still stand.
- No browser runs here: no e2e, no `@perf`, nothing measured with the byte count. The PR's full-suite e2e was still running.
- The real duration of a dev bake on CI-class machines (the 15 s stall nit above).
