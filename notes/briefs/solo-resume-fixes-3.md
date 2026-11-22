# Fix round 3: PR #885 (solo Resume / Forfeit): fix the cause. Opus, xhigh, alone

Branch `claude/solo-resume` (PR #885, full lane). Three reviews are on branch `review/solo-resume`: `review-885.md`, `review-885-delta.md`,
`review-885-delta-2.md` (read the last one closely, with its test `review-885-delta-2.test.ts`). Read CLAUDE.md (above all "Fix the
cause, not add a checker"), `.claude/LESSONS.md` and `docs/decisions/2026-11-22-solo-resume.md` first.

**The cause.** Every important finding so far (I2, I3, D1, D2, D4, E1, and the delta-2's "seen in passing": Dash's Scramble Rush and
Hollow's Lights out) is one bug: the battle shows the player something (a move scored, bots' picks, a power-up's hints, a Dodge
teleport, a sweep, a verdict) before the kept game holds it, so a reload or a second window resumes from before it was seen. Each
round patched the power the review named, and the next review found another. Fix the rule instead: **a kept battle never shows what
it hasn't kept** ("keep before show").
- Director's call on the shape: keep in the one place a kept battle's state reaches the screen (`set()`/`emit()`, or wherever every
  update passes), whenever the update carries something new, with the time into any timed moment (the Dodge's `dodgeMs`, and the same
  for the Rush and Lights out: one general "time into the moment" field rather than one per power, if that's simpler). Then remove
  the scattered keeps this makes redundant (fewer ways to break). Measure the cost on a phone-sized run (how many keeps a turn, and the
  write's size and time); if writing on every update is too much, keep on updates that change what's shown, never by a timer.
- If one place truly can't be done safely, fall back to keeping at each reveal of each timed power (the review's E1 fix (a), plus
  the Rush and Lights out), and say why in the decision note.
- Prove the rule with one test that walks every timed power and moment in a Boss-alone battle and a Solo raid (Chandy's Dodge, Dash's
  Rush, Hollow's Lights out, the King's call, a power-up, the bots' picks) and checks, at each update that reaches the screen, that the
  kept game already resumes to it. Flip `review-885-delta-2.test.ts`'s E1 case. Keep the existing tests green.
- Also: **EN1** (a rejoin's first keep carries `resumeDodge` while `this.dodge` is null, if the rule above doesn't already cover it),
  **EN2** (a kept battle's `resign()` keeps first and returns if stopped; fix the DN4 test and the `end()` comment that describe a path
  that doesn't occur).
- Write the rule down where the next person will meet it: a short `.claude/LESSONS.md` entry and the story at the end of
  `docs/history/lessons.md` (three review rounds, one cause), the boss area page (a new timed power must go through the same path), and
  the decision note (replacing "the claim makes a takeover safe" with what's true now).
Prove it with the typecheck, the app and server unit tests, and `e2e/xp.spec.ts` + `e2e/battle-tower.spec.ts` (phone) under the e2e
lock; if the keep moved into the update path, also `npx playwright test --grep @perf --project phone` (frame budgets). Append "Review
fixes, round 3" to `.pr-body.md` (restore it from `cd57f419` first: the director dropped it; each finding → what changed, changed
checks old → new), write `.done`, push and stop. Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only.
