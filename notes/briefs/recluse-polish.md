# The Hidden Boss's fight: the small follow-ups (from #707, #712's review and the visual check)

Effort high. Boss lane (no extra review). New branch `claude/recluse-polish` from `origin/main` (b6d26aa8 or later). Read `CLAUDE.md`,
`.claude/LESSONS.md`, `docs/areas/bosses.md`. Never write the Hidden Boss's name in player text, commits or PRs. Simple beats flashy.
Another helper (flaky round 5) is changing e2e tap helpers and several specs at the same time: stay out of `e2e/helpers.ts` and of
tap code; touch only the specs your fixes need, and merge `origin/main` before `.done`.

1. **#707 m2: a device late for the transformation's intro** falls back to "loop only" and is silent until the drop. Start the intro at
   its offset instead (`AudioBufferSourceNode.start(when, now - t0)`, music.ts), so a late device hears the intro from where it is.
   A unit test in `music.test.ts`.
2. **#707 m4:** a pixel check of the suit on `.boss-char-sprite` in the `?phase=2` test (`e2e/recluse.spec.ts`).
3. **#707 m5:** `sceneStand` should come from the fitted cutscene timeline (`recluseCutsceneFit`), so e2e's short hold shows the
   unbroken loop.
4. **MovePanel's boss rows in phase 2** use the plain portrait (`bossPortraitUrl`); use his live suited face where the kit has a
   `barFace` (the bar's `BossFace live`), so the Moves list matches the bar.
5. **Visual check #11 nits** (`review/recluse-visual-qa`, `review.md`): the phone bar box 2 px over the board's green line; the 1280
   chat chips cut at the panel's bottom (third row half shown: show whole rows, the panel's size unchanged); the 1280 scoreboard's
   "WON" tags squeezing names. Only where each is a few lines.
Prove each with its own check (unit or one line in an existing spec); stills (phone + 1280) for 4 and 5 on `stills/recluse-polish`
(never under docs/). Typecheck; app unit tests; `e2e/recluse.spec.ts` and `e2e/hidden-boss-room.spec.ts` on both projects. Push at each
real step; `.pr-body.md` (per item: cause, fix, player-visible; checks old -> new); `.done`. No PRs, no CI waits, no model names in
commits (end commits with the Claude-Session line only). About 1.5 hours.
