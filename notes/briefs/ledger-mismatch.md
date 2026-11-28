# The daily ledger check: 4 accounts' balances and ledger disagree (Nov 27 and 28, 09:00 UTC). Opus, xhigh. Full lane (coins, stored data).

Read `notes/briefs/rules-common.md`, `docs/areas/shop.md` (or the coins/wallet page) and `packages/server/src/ledger.ts` (`ledgerCheck`,
`ledgerMismatches`). `ops:report` shows "Error: ledger check: 4 accounts' balances and ledger disagree" from the schedule, 2 in 24 h
(builds 62dd6ccb, 5eeba04d). The cron logs each one (`{ops: "ledger", user, account, mismatches}`) with `console.error`: find them
(Workers logs via the ops view, or reproduce the check's query read-only against the live D1 through the existing ops path; never print
a token or secret; never change stored data in this job).
Find out which accounts (admin, test, residents, a real player?), which assets and by how much, and why: an admin or test tool that sets a
balance without a ledger entry (test switches, the admin floor, crate tests…), a code path that writes one and not the other, a refund, a
migration. Then fix the cause in code (every balance change goes through the ledger), with a unit test that fails before; and propose,
not run, how the 4 accounts get back in agreement (a reviewed one-off, the director runs it). Write `FINDINGS.md` and the fix on
`claude/ledger-mismatch`; commit AND push with `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop.
