# Town structure, phase 1c: the last device-made pictures baked, the time caps gone, memory halved, device painting removed. Fable, xhigh.
# Full lane (`full-e2e` + an independent review): how the town loads for everyone.

Read `notes/briefs/rules-common.md` (load first, then show), `DESIGN.md` on `origin/claude/town-architecture`, `notes/briefs/town-phases.md`,
and phase 1b's notes (`.done` at 9e9c2046 and `.done2` at 737e1bab on `claude/town-phase1b`; `REVIEW.md`/`REVIEW2.md` on
`claude/town-phase1b-review`). Branch `claude/town-phase1c` from `origin/main` (1b is merged). Push at each real step; split anything over
about 4 hours into its own PR and say so.
1. **The sidekicks' sheets baked**, each frame a picture of its own, padded as the rest (today 875 canvases cut and uploaded one by one on
   the device). By their `SIDEKICK_SHEETS` names: **Rivet, Timber's kid, then appears in an admin's town** (today `render.ts` looks his
   sheet up as "beaver" and the file is timber.png): a visible fix, one still of him in the town for the director.
2. **No time caps on the loading screen** (`loadSheetWaitMs`, 3 s, for the sheets, the pawns' crate items and the rides: Eric's rule,
   "load first, then show", no cap that lifts the card early): the card waits until each is loaded, with 1b's no-progress guard
   (`stallMs`) as the only way out, which shows them when they land, reported.
3. **Memory (1b review S6):** each decoded page closed once the painter has uploaded it; after a lost WebGL context the pages are
   fetched again from the worker's cache (and the 2D stand-ins get their own source). Measure the town's memory before and after on the
   slowed phone (`e2e/mem-probe.js`).
4. **Device painting removed** (`paint-pool.ts`, its worker, `keep-pictures.ts`'s saved copy, the warm/plan paths only painting used),
   **but first read `npm run ops:report`'s `town-baked-fallback` rows** (1b reports each fallback with its reason). If any device class
   falls back for a reason other than a missing file or a stall (a decode failing, a size), keep the painting fallback and say so in the
   PR body instead of deleting it. Without painting, a fallback becomes: the failed files retried twice, then the loading card says it
   couldn't load the town, with Retry (never a half town), reported.
5. Measure (first, later, after a deploy; slowed phone and computer), same pixels (the hashes), budgets updated. Decision note, area
   pages. Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop.
