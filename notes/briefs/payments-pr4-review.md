# Independent review: Payments PR 4, coin boost and Crate Bonus (Nov 26). Opus xhigh, READ-ONLY. Full lane.

PR ericmueller21k-gif/chessroyale (the PR titled "Payments PR 4: the coin boost and the Crate Bonus"), branch `claude/pay-boost` (head
2dcde2b7; its body was `.pr-body.md` at e5f867d7: `git show e5f867d7:.pr-body.md`). Read the design
`docs/decisions/2026-11-17-payments-design.md` section 7 (and 6, the coin math), 13 row 4, "Calls made here" 3, and the PR's
`docs/decisions/2026-11-26-coin-boost.md`. Review `git diff origin/main...origin/claude/pay-boost` as an independent reviewer.
Focus, in order:
1. **Money/wallet correctness:** can a drop be granted twice (quest op retries, two tabs)? Can the roll be gamed (the seed's key, guessable,
   re-rollable by abandoning/restarting a quest)? Can a game be boosted twice, or use more minutes than there are (concurrent games,
   replays, room restarts)? Base coins toward the 300 and bonus steps exact; "waits past the 300" right; never stacking; XP never
   boosted. Crate Bonus: exactly 5 doubled level-ups each; keys never doubled.
2. **The ledger:** three new asset kinds reconcile in the daily check, backfill, merge, erase, download; no other path moves the columns.
3. **The schema on the live D1:** three `ADD COLUMN … DEFAULT 0` on wallets: safe, re-runnable.
4. **The open endpoint:** `POST /api/locker/boost`: auth, idempotent on `request`, PAUSE_SHOP respected, no open with none left.
5. **Overlap with PR 5 (#963):** after both merge, does anything break (AssetKind, HOLDINGS, merge columns)? Any spend path?
6. **Tests:** prove the above, not only the happy path; changed checks honest.
Write `REVIEW.md` on a new branch `review/pay-boost` (from the PR head): findings blocker/major/minor/nit, each with file:line, a concrete
scenario and a fix. Run core + server unit tests and throwaway tests as needed (don't push code to the PR branch). Push `REVIEW.md`
only, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. About 45-60 minutes.
