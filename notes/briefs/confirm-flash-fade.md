# The move-confirm highlight fades in at its size, no zoom (Eric, Nov 14): mockup GIF first

Effort high (animation). New branch `claude/confirm-flash-fade` from `origin/main`. Read `.claude/LESSONS.md` and CLAUDE.md "Simple
beats flashy" (reuse what works; least code; least lag).

Eric, playing on a computer: when a move is confirmed, the green highlight square around the piece "starts wider than the square
and then narrows in on the shape of the border of the square... a little sluggish on the desktop versus mobile... choppy. I almost
think we need an alternative where it doesn't zoom, it doesn't do that out-to-in resizing. It just fades in already the right size on
the square." (He likes the three blinks; keep them.)

1. Find the confirm highlight (the board's own code in `packages/app/src/board/` and its CSS; search for the keyframes that scale it).
2. **Mockup first:** a GIF of a piece moving and the confirm highlight, side by side or one after the other: today's (zoom in) and the
   new one (fades in already at the square's size, then the same three blinks). Phone and computer frames. Push it to branch
   `stills/confirm-flash-fade` and stop there: write `.mockup` to your branch (instead of `.done`) and wait in one foreground Bash call
   (`timeout 590 bash -c 'until git fetch -q origin claude/confirm-flash-fade && git show origin/claude/confirm-flash-fade:.go >/dev/null 2>&1; do sleep 30; done'`,
   repeated, up to 3 hours) for the director's `.go` file with Eric's answer in it.
3. On "go": build it. Only opacity (and the blinks) animate: no scale, no size change (cheapest on a phone too). Measure the
   frames once (`npx playwright test --grep @perf --project phone` for the board's perf spec, under the shared e2e lock), before and
   after; watch it frame by frame with real taps (`npm run frames:boss`).
4. If a test checks the old zoom, change it to check the new fade (old -> new in the PR body). If it's a guard test in
   `docs/rules/eric.md`, stop and write it in `.pr-body.md` (Eric's OK needed).
Typecheck; the touched specs. Push at each real step; `.pr-body.md` (short); `.done`. No PRs, no CI waits, no model names in commits.
About 45 minutes plus the wait.
