# Payments PR 2 (#950): the review's fixes (Nov 25). Opus xhigh, FULL lane, alone. Branch `claude/pay-play-coins`

The independent review is `REVIEW.md` on branch `review/pay-play-coins` (`git show origin/review/pay-play-coins:REVIEW.md`): no blocker,
1 major, 4 minor, 8 nits. Read it fully, plus CLAUDE.md and the PR's decision note `docs/decisions/2026-11-25-play-coins.md`.
`git fetch origin claude/pay-play-coins && git checkout -B claude/pay-play-coins origin/claude/pay-play-coins`. The director's calls:
- **M1 (fix):** ranked's and Squads' coins must never be lost to one failed D1 call. Squads: `writeReward` lets `grantXp`'s error
  propagate (the lobby's `soft()` pattern: within the strict window) so the reward stays queued and the next write pays once (every op is
  keyed). Ranked: retry `grantXp` inline in `withXp` (2-3 tries; keyed, so safe; don't replay `recordDuel`), and if it still fails, make
  sure the outcome isn't left paying 0 for good: say what happens and why it's safe. Cover `settleCoins` throwing partway too. Test: one
  failed XP batch in a Squads write keeps the reward queued and the next write pays 65 once; a ranked grant that fails once then succeeds
  pays once.
- **m1 (fix):** add a fourth STRICT try before the loose one, and make every description match the code: "never past 300; in a burst of
  many games of one account at once, some may be paid at an earlier step and the last ones may get nothing" (decision note,
  `docs/areas/accounts.md`, the module comment, the test comment). The server test starts mid-day and asserts the cap only.
- **m2 (director's call: no bonus):** a Squads lobby whose bots only that squad's own devices moved (`rec.unvouched?.[squadId]`) pays play
  coins with the solo rule (no placement bonus), as every other game on one device's word (call 5). Note it in the decision note (the
  old 5-a-day coin cap that bounded Eric's Nov 10 "paid as any" is gone). Test it.
- **m3 (fix):** the coin ops' guard also needs `NOT EXISTS` on the old keys: `ranked:<duel id>:<color>` for `duel:` games, and the Squads
  reward op's coins leg for `squads:` games, so a game half-paid by the old code at a deploy never pays twice. Test both.
- **m4 (fix):** correct the "never drifts" claim (or round so it holds) and extend that core test to 40+ wins; add the tests the review
  lists as missing (a Squads member who resigned with 10+ moves: play coins, no bonus; M1's failure paths).
- **Nits:** n1 (FAQ paused line + coins), n2 (ranked-schema comments), n3 (one line in the decision note), n6 (pass the won flag to
  `coinOps`, not the label), n7 (add an index on the ledger for `(account, reason, created_at)` the way the schema adds indexes, if it's
  the existing ensureSchema pattern: say so; otherwise note it for launch), n8 (remove the dead line). Leave n4, n5 (note n5 for PR 3).
Then: `.pr-body.md` gets a "Review fixes" section mapping each finding → change → test (old → new for any changed check), and a
`DELTA.md` (same mapping, for the delta reviewer). Run core + server unit tests and the typecheck. Push at each real step, write `.done`,
stop. Don't open PRs or wait on CI. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`
(no Co-Authored-By). Never a secret value anywhere.
