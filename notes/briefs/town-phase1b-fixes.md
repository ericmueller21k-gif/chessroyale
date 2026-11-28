# Town phase 1b (PR #1043): fix the independent review's findings. Fable, xhigh. Full lane.

Read `notes/briefs/rules-common.md` (load first, then show), then `REVIEW.md` on `origin/claude/town-phase1b-review`. Work on
`claude/town-phase1b` (PR #1043; merge `origin/main` first). Each fix with a test that fails before and passes after where it can.
- **S1** home's prefetch: only while `queue` is empty (a boss lobby, a match loading, a duel's search: never); an `AbortSignal` that
  `stop()` aborts; `loadBaked` stops fetching and decoding once the town is closed (`alive` false).
- **S2** a no-progress limit on the loading screen's fetches (no file landed for N s, a setting): abort and paint. Fires only when
  nothing moves.
- **S3** the fallback reports once a page through `problems.ts` with its reason (manifest, file, decode, size, list).
- **S4** on a first visit while a worker is registering, the prefetch waits for `navigator.serviceWorker.controller` (or
  `controllerchange`); make the e2e "home fetches Chess Town's baked pictures when idle…" wait on that, not on timing.
- **S5** clear the old saved town once after a baked load (`idbShelf()?.clear()`, `localStorage` `brc.townTops`).
- **Director's call on data use:** keep the prefetch, but skip it on `saveData` and on `effectiveType` `slow-2g`, `2g` or `3g`.
- **Nits, all:** `adopt` returns whether it took the pages (else keep them); the precache's town-file copy in `try/catch`; `TOWN_FILE`
  tied to `BAKED_NAME` (filled from it, or a test); a per-page "fetched" memo so home doesn't re-read every file after each match; the
  manifest fetched at low priority by home and parsed off the main thread if cheap; the town's load never waits on home's low-priority
  fetch (raise it, or fetch its own); dev: the manifest read fresh each town load and one bake at a time.
- **Pre-existing, include:** the precache keeps only a 200 that isn't HTML for `/assets/` (as the town files already do).
Leave S6 (memory: pages kept twice) and the `loadSheetWaitMs` caps to phase 1c (noted there). Update the PR body's changed checks in
`.pr-body-add.md`. Commit AND push `.pr-body-add.md` and `.done2` (`git add -f`), check `git ls-remote`, stop. About 1.5 to 2 hours.
