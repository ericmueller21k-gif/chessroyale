# Fix round (the ONLY one): PR #618, the engine pool

The review is `review.md` on branch `review/engine-pool` (`git show origin/review/engine-pool:review.md`), proofs in
`zz-review-engine-pool.test.ts` there. Work on claude/engine-pool (PR #618; pull first). Copy the proofs into packages/server/test/
and flip each to a test the fix passes. There is no second review: get it right, keep it small.

## Do (the director's calls)
- **M1:** the download goes through `forReviewer` (no admins' emails anywhere); the PR's test adds a person's decision before the export.
- **M2:** "getting crushed" only from 1 v 1 games against pooled players (`vsPool`, at least 5, under 30%); check "still playing like
  an engine" (in-pool matches at the bar) first; crowd and raid results shown as plain numbers, never in the hint. Optionally, a
  big drop in in-pool strength (`avgPerf`) against what pooled them as a second hint.
- **M3:** Eric's own rule fits: "if some player accidentally does for a game, they won't get banned" and "2 out of the first 3".
  So the level path pools only when the ban verdict rests on **two matches from different lobbies**; a single match at the bar opens
  a review instead (a person looks). Keep the new-account rule (2 of the first 10). Update `review-b2.test.ts` M1 accordingly (one
  forged lobby → review, not pool). If it's a few lines, add the deep search's own second-best gap to `deepResult` and show "N of M
  deep-matched moves were only moves" on the pool row; else skip and say so.
- **M4:** the list in grouped queries (one per column over all pooled players), the "Engine pool" section only on the `pool` tab,
  and the export paged (`?after=<userId>`, about 50 a file). A test counts statements for 50 players (bounded, not per player).
- **m1:** `cap = Infinity` for `pool` in the deep re-check, ordered beside `watch`.
- **m3:** Cancel asks both queues (clean and `.engine`).
- **m4:** a matchmade lobby records whether it's the pool's; a new unseated account whose pool status doesn't match is refused
  ("This match has already started."). Private lobbies and invites unchanged.
- **m2, m5, m6:** one line each in the decision note (accepted, as the review describes).
List every guard test changed in the PR body (fairplay-admin, fairplay-deep, review-b2 M1).

Lane: full; effort xhigh. Run locally only the tests you write or change, the server unit suite, `e2e/fairplay.spec.ts`, and
`npm run typecheck`. As your LAST push, together: `.pr-body.md` (the full body), `.review-fixes.md` (each finding: what you did) and
`.done`. Don't push after `.done`. Don't open a PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
