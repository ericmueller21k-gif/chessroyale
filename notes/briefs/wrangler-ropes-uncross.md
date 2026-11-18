# Wrangler redraw (#782): the showdown's two ropes never cross. Opus, medium (one clear fix with a test)

Branch `claude/wrangler-redraw` (PR #782, head 2dae6ed): `git fetch origin claude/wrangler-redraw && git checkout -B claude/wrangler-redraw
origin/claude/wrangler-redraw`, push to it. About 30 min. Read CLAUDE.md and the review: `git show origin/review/wrangler-redraw:review.md`
(finding 1: in the showdown haul, `fistsAt` in `components/Pig.tsx` hands the crowd's rope `FISTS[0]` and his `FISTS[1]` by a fixed order,
so the ropes cross in ~49% of square pairs, now as an X right at his fists).

Fix exactly as the review suggests: per pair, from the two from-squares and the fists' midpoint, give the leftmost fist the steeper rope
(larger atan2 angle) and the other fist the other rope, decided once per pair (never switching mid-yank). Add one check to the existing
showdown test in `pig.test.ts`: no crossing at rope-out over all square pairs (fails without the fix). Run typecheck, `pig.test.ts`,
e2e pig spec on phone. Add a "Review fix" line to `.pr-body.md` (rewrite it from the PR's current body if absent: `gh` isn't available;
use `git show origin/claude/wrangler-redraw~2:.pr-body.md` or rebuild it from the decision file). Push `.pr-body.md` and `.done`, end.
