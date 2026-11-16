# Delta re-review 2: the 50 v 50 Party's fix round 2 (PR #747). Full lane. Opus, xhigh. Read-only

About 30 minutes. The delta review: `git show origin/review/crowd-party-delta:review.md`. Fix round 2: the commits on
`claude/crowd-party` from aff6ec7 to 6dc12ab (`git diff 7776a90 origin/claude/crowd-party`, minus merges of main). The PR body
(PR #747) lists each fix.

Check: N1-N5 and M3 are really fixed, each with a test that fails without it, and the fixes broke nothing nearby: per-player ranked
(`rankedFor`, `partied`) through finishMatch, leavers mid-match, the results line, and the stored rows (rating and rank points written
only for singles, XP for all); N4's door closing when the hold ends (an on-time member never refused, a late one refused); N1's held
seats for away members never overfilling the lobby or blocking the fill; N5's `stopped` cleared at the next Find match and the notice
on top, pushing nothing. Also `e2e/town-chat.spec.ts` `open()`: holding other pages' towns must always let them go (on a failed load
too) and must not change what any test checks. New bugs only, ranked. Each finding: file:line, the failing case, a fix in one line.
Write `review.md` (at most 1 page) to the orphan branch `review/crowd-party-delta2` and push. Claude-Session line only, no models.
