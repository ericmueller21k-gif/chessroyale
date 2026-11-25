# Payments PR 2 (#950): the delta review's small fixes (Nov 25). Opus xhigh, alone. Branch `claude/pay-play-coins` (head 158d12db)

Read `git show origin/review/pay-play-coins-delta:DELTA-REVIEW.md` (no blocker, no major; minors N1-N3, nits N4-N7) and CLAUDE.md.
`git fetch origin claude/pay-play-coins && git checkout -B claude/pay-play-coins origin/claude/pay-play-coins`, `git rm .done`, push. Do
exactly these (the director's calls), each with a test that fails without it:
1. **N1 (fix at the cause):** a game pays at most one daily reward. In `rewards.ts` `dailyOp`, add the guard the review gives
   (`NOT EXISTS` a `daily` leg on this account whose source is this game), served by the `ledger_reason` index. Test: a ranked grant
   replayed after the XP day rolls over pays the daily reward once (the review's scenario), and a Squads rewrite likewise.
2. **N3:** `play-coins.ts:43` old-key guard: add `AND leg = 0` (the old ranked op had one leg) so it searches the primary key. Keep the m3
   test passing.
3. **N2, Squads half:** when one reward in `writeRewardQueue` fails, stamp `failedAt ??= now` on every reward still waiting, so the queue
   shares one strict window. Test: the review's 3-reward lasting-fault case ends within one window, nothing lost or paid twice.
   **N2, ranked half: NOT in this PR** (a follow-up: hold-and-release logic). Note it in the decision note as a known pre-launch limit.
4. **N6:** fix `docs/areas/accounts.md:77` to match line 90 (Squads' XP isn't solo-capped; only its coins go the solo way since m2).
5. Leave N4, N5, N7 (N7: say 16.5 in the comment and call 8 if trivial).
Update `.pr-body.md` with a short "Delta fixes" section (finding → change → test; checks changed old → new) and `DELTA.md`. Run core + server
units and the typecheck. Push, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). About 30 minutes.
