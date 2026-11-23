# #912 fix round: Birdie's fall whoosh overlaps the cutscene's (Nov 23). Opus medium, boss lane

PR #912, branch `claude/birdie-fall-fun` (push to it, never force). Its review: `git show origin/review/birdie-fall-fun:REVIEW.md` (read it all).
Start: `git fetch origin claude/birdie-fall-fun main && git checkout -B claude/birdie-fall-fun origin/claude/birdie-fall-fun`. Read CLAUDE.md,
`.claude/LESSONS.md`, `docs/rules/eric.md`. Effort medium: one cue and a guard.

1. **I1:** the figure's `fall` cue (`birdieWhoosh`, 620 ms) moved to frame 4 (410 ms in) and now overlaps the cutscene's whoosh at 840 ms
   (`cutAt = fallAt + dropMs`). Fix it at its cause: put the cue where the whoosh ends before `dropMs` (frame 2, 210 ms → 830 ms), or drop it
   if the cheer + the cutscene's whoosh read better (your call, recorded in the PR body). Add the guard the review proposes in
   `packages/app/test/birdie.test.ts`, deriving the whoosh's length from the sound's own constant rather than writing 620.
2. Nits: delete the stale JSDoc at `birdie-cutscene-fall.ts:935-936`; look at the last frames of `fall` frame by frame (the review's note on
   `birdie.ts:973`); add a `hidden` frame before the empty one if the cab vanishing with him half in view reads as a pop.
3. Prove: typecheck; `birdie.test.ts`, `birdie-sounds.test.ts`; `e2e/birdie.spec.ts` "Birdie's fall" (phone). Write a fresh `.pr-body.md`
   with only a "Review fixes" section (what changed per finding; changed checks old → new: the new guard). `.done`, push, stop.
   Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. American English.
