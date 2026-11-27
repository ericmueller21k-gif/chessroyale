# Delta re-review: #1000 after its review (FULL lane), Nov 27

Read `notes/briefs/rules-common.md` first. Read-only, effort xhigh, Opus, about 30 minutes. The first review: `REVIEW.md` on branch
`claude/stranger-rules-review`. Review only what changed since it: `git diff 04c8fec2..origin/claude/stranger-rules` (the director's
B1/B2 commits b0444d72, b28e3980, 9e59c8c3, a9260122, and the fix round 53b5d4cc..61dc732e, plus a main merge). Check:
- each finding (B1, B2, S1, S2, N1, N2, N8; N3/N5/N6 as notes) is fixed as REVIEW.md asked, and the new checks bite;
- a9260122 (a `?boss=` test link isn't held by his lock): test switches only (`testParams`), nothing a player can use online;
- 9e59c8c3 (boss-smoke skips him while `strangerult` is a placeholder): narrow, and says the ult PR removes it;
- `SIDE_FEEL.overMenu` gains him: Eric's whole-on-screen rule still holds (boss-side.spec is the guard; CI's result if it's in);
- nothing new is broken. No re-review of what the first review already checked.
Write `REVIEW-2.md` (blockers, should-fix, nits with file:line; "Checked"; "Not reached") on branch `claude/stranger-rules-review`, push,
then push `.done-2`. Don't fix code, open PRs or comment on GitHub.
