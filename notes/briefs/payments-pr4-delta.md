# Delta review: Payments PR 4 review fixes (#966) (Nov 26). Opus xhigh, READ-ONLY. Full lane.

Branch `claude/pay-boost`, the fix round 204b305d..4b67a5d0 (merge of main at 204b305d, then ed24370b, 7cbedc7a, 4b67a5d0). Read
`git show origin/review/pay-boost:REVIEW.md` and the PR body's "Review fixes" (`git show 4b67a5d0:.pr-body.md`). Review ONLY the delta
(`git diff 2dcde2b7 4b67a5d0`, which includes the main merge: check the merge's conflict resolution in `ledger.ts` and
`account-data.test.ts` too) as an independent reviewer. Focus: (1) B1: the test switch's drawn ids can't leak into production (test
servers only; production deals and rolls as before); 10,000-draw cap safe. (2) M1/m1: `boostFor`'s minutes exact at the edges (290 + a
30-min game; a 40-s win; minGameMinutes with minutes left < 5; the last minutes of a boost); no over-pay anywhere. (3) n1's guard can't
starve a legit boost. (4) The union merge with PR 5: HOLDINGS, AssetKind, merge/erase/download for all kinds (wallet + purchase + the 3 new);
PR 5's `applySpend` untouched and still the only coin spend. (5) Tests prove each fix (fail without it).
The director's call (keep `minGameMinutes` 5, not 10): only note it if you find a concrete abuse the daily caps don't bound.
Write `DELTA.md` on `review/pay-boost` (pull it; beside REVIEW.md): findings blocker/major/minor/nit (file:line, scenario, fix) or "no
findings". Run core + server unit tests. Push DELTA.md only, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. About 30 minutes.
