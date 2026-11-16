# T1: town taps' speed, and the town flakes (T3). Opus, high (test timing, no game logic). Targeted lane

Branch `claude/town-tap-speed` from main. About 2-3 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/ops.md` ("CI e2e"),
`docs/decisions/2026-11-14-flaky-causes.md`, and on `claude/director-notes`: `notes/pipeline-audit-2026-11-16.md` (T1, T3, L4).

**The problem.** The full e2e run went from 20,756 s to 24,230 s with no feature reason: shop 677 → 1,158 s (same 24 tests),
town-chat 488 → 934 s, boss-challenge 608 → 951 s, town-afk → 643 s. What they share: `e2e/helpers.ts` `townTap` / `tapInTown` /
`townTapPoint` (since Nov 13), which waits for the view to hold still (3 frames), polls until you stop moving (up to 30 s) and
retries with a 20 s wait. Under CI's software WebGL every frame is slow, so each tap costs seconds.

**Do.**
1. Profile one shop test and one town-chat test (trace or timestamps around each helper call): how long the hold and the "not
   moving" poll take per call. Write the numbers in the PR body.
2. Cut the cause, not the check: e.g. read the tap point once from a held frame (`__townHold` already exists; see
   `e2e/town-chat.spec.ts` `open()`), poll "moving" only after a glide, or a test switch that freezes the town's idle motion
   (TEST_SWITCHES never in production). Whatever is least code and keeps the tests checking the same things.
3. The open town flakes, fixed at their cause where the same timing explains them: town-chat:1367/1370/1054, town-leave:148,
   shop:238, town-afk:116, and also hopper:212, chat:80 [desktop] (a tapped move not picked in 5 s, line 283) and dash:241
   (open since Nov 9). One that isn't timing: write what you found, leave it.
4. Measure: the touched specs before and after, locally (phone + desktop), under the shared e2e lock.

**Rules.** No assertion removed or weakened. `docs/rules/eric.md`'s guard tests: don't edit one; if a shared helper they call
changes, say which guards call it and why what they check is unchanged. No fuzz/mutation runs. Push at each real step.
At the end: `.pr-body.md` (short: what changed, the before/after seconds, changed checks old → new, any guard that calls a changed
helper) and `.done`. Commits end with the `Claude-Session:` line only, no model names. No PR, no waiting on CI.
