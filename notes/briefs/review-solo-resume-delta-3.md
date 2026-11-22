# Delta re-review 3: PR #885 (solo Resume / Forfeit), read-only, ONE round. Opus, xhigh, alone

Three reviews so far, on branch `review/solo-resume` (`review-885.md`, `review-885-delta.md`, `review-885-delta-2.md`, each with its
test file). Fix round 3 fixed their common cause, "keep before show": a kept battle keeps in `show()` (every set and emit) when the kept
game changes, and at each beat a timed moment shows by the clock (`KeptGame.moment` for the Dodge, the Rush, Lights out); the scattered
keeps and their `stopped` checks were removed. Round 3 is `git log 6f5dfb76..origin/claude/solo-resume`. Read CLAUDE.md, the three
reviews, PR #885's "Review fixes, round 3" section (in `.pr-body.md` at `1bdda273`), the decision note and the new LESSONS entry.
- Does the rule hold everywhere a kept battle shows something? Look for any update that reaches the screen without passing `show()`
  (direct DOM or signal writes, sounds, banners, timers firing visuals), and any moment whose beats aren't in `KeptGame.moment`. Run the
  three earlier reviews' test files against the branch (their hole cases should now fail).
- What removing the scattered keeps could break: a keep that was there for a reason other than showing (a result kept before the post,
  a floor's keep, a turn's time), the `stopped` behavior (a stopped tab's searches and timers), floors and online play untouched.
- Cost: the helper measured ~56 updates and 4 writes a Solo raid turn. Confirm the change check is cheap and never writes per frame.
- Perf: the helper's local `@perf` run (phone) had 4 failures it says also fail at 6f5dfb76 (two DOM-growth checks, Chess Town's load
  time). Run `npx playwright test --grep @perf --project phone` on `origin/main` and on the branch and say whether any failure is this
  PR's (if `chromium_headless_shell-1194` is missing, point PLAYWRIGHT_BROWSERS_PATH at a folder linking the installed 1243 one).
Only count as important a way to dodge or undo a result, a double count, a crash, a stuck screen, or a frame-rate loss this PR causes.
Don't fix. Add `review-885-delta-3.md` and an empty `.done4` to branch `review/solo-resume`, push and stop. About 45 minutes.
Commits end with the `Claude-Session:` line only.
