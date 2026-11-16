# Delta re-review: the 50 v 50 Party's fix round (PR #747). Full lane. Opus, xhigh. Read-only

About 45 minutes. The first review: `git show origin/review/crowd-party:review.md`. The fix round's changes: the commits on
`claude/crowd-party` after e06e6d2 (`git diff e06e6d2 origin/claude/crowd-party`, minus the merges of main). The PR body lists each fix.

Check: each finding (H1, H2, M1-M5, L1-L5, the nit) is really fixed, with a test that fails without it; nothing the fixes changed broke
another path (the pool lobby's door letting the wrong person in through a party pass; the hold vs the fill; the reload rejoin racing
the lobby's start; the leader hold; `awayStopMs` cancelling a live search; the party pass's own-keys check; the unranked setting:
**note** that a party makes the whole 100-player lobby unranked for singles too: say what it would take to keep singles ranked (only
the party's members unranked) and how risky that is). New bugs only, ranked. Each finding: file:line, the failing case, a fix in one
line. Write `review.md` (at most 1 page) to the orphan branch `review/crowd-party-delta` and push. Claude-Session line only, no models.
