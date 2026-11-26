# Independent review: Payments PR 5, purchases storage (#963) (Nov 26). Opus xhigh, READ-ONLY. Full lane.

PR ericmueller21k-gif/chessroyale#963, branch `claude/pay-storage` (head b9750f26). Its PR body is on the PR (and was `.pr-body.md` at
6e494149: `git show 6e494149:.pr-body.md`). Read the approved design `docs/decisions/2026-11-17-payments-design.md` sections 2, 3 (what
storage must hold for refunds later), 9, 13 row 5 and "Calls made here", and the PR's `docs/decisions/2026-11-26-purchases-storage.md`
(12 calls). Review `git diff origin/main...origin/claude/pay-storage` as an independent reviewer: you did not write it.
Focus, in order:
1. **Money correctness:** can a purchase credit twice (retries, concurrent webhooks, a replay, a second session id for one payment)? Can a
   spend take bought coins before earned, draw a purchase below 0, or lose coins on a race (the guarded draws and the one re-plan)? Is
   `leg.coins` refusing negatives safe for every existing caller (grep every caller: rewards, refunds of items, admin grants, guest merge,
   tests): is there any path that now throws in production where it used to work?
2. **The ledger:** the new `purchase` asset in HOLDINGS, the daily check, the backfill, a guest merge and deleting: balances still
   reconcile; no orphan rows; the static guard list honest.
3. **The schema on the live D1:** the runtime `CREATE`/`ALTER` safe on the real database (existing users, the CHECK constraint, defaults,
   index names, a re-run, two workers running ensureSchema at once).
4. **Delete and download:** sales rows kept as `deleted` with nothing personal left that shouldn't be; the download complete; the refund
   comment erased.
5. **Refundable:** the 14-day window and the cap exact at the boundaries.
6. **Tests:** do they prove the above (not just the happy path)? Any check weakened without cause (`ledger.test.ts`'s changed spend legs)?
Write `REVIEW.md` on a new branch `review/pay-storage` (from the PR head): findings ranked **blocker / major / minor / nit**, each with
file:line, a concrete failure scenario, and a suggested fix. Run the core and server unit tests and any focused test you need to prove a
finding (a throwaway test locally is fine; don't push code to the PR branch). Push `REVIEW.md` only, then stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. About 45-60 minutes.
