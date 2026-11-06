# Brief: item ledger, part II (stored data and money: extra-high care)

Part I is PR #516 (branch claude/ledger-1, head 2c0af6f9: `ledger.ts`, the `ledger` and `ledger_accounts` tables, the moved paths and tests). Read its PR body and `packages/server/src/ledger.ts` first. Also read the audit, `/home/user/cr-notes/notes/audit-2026-11-06.md` §1.

**Branch:** claude/ledger-2 off claude/ledger-1 (worktree /home/user/cr-ledger2). If #516 has merged by then, merge origin/main in (a real merge).

## Part II
1. **Request ids from the app** for buy, open, grant and claw: the app sends a UUID per user action, and retries reuse it. The server's op key uses it, so a double tap or a network retry applies once. This includes the boss crate buy and open, admin grants and `grantReward`.
2. **The online token drop key** (lobby-do.ts:162-164, :202-203): a unique key per drop that can't repeat when lobby codes are reused. A Durable Object that dies between its D1 write and saving its storage must not credit twice.
3. **Squads rewards at least once** (squads-do.ts:116-123): don't take a reward out of the record before it's written. Write it through the ledger with its key, remove it only after success, and retry on the next alarm or wake.
4. **The remaining paths** named in part I's guard test: `grantReward`, the free crate `openCrate`, and the claw (if the claw is only on claude/boingo-home, leave a clear adapter and a TODO in the guard's allowlist).
5. **Backfill:** a one-off, re-runnable admin route or script that records, per account and asset, the current balance minus the ledger's sum as a `backfill` leg, keyed by (account, asset) so a rerun adds nothing. Also a daily check, run where the Worker already has a scheduled handler, or else on an admin route, that calls `ledgerMismatches` and logs any mismatch. Don't add a paid service.
6. **Tests:** replays per new key, the DO crash window (simulate a failure between the write and the storage save), Squads failure then retry, backfill twice equals backfill once, and the guard allowlist emptied for every ported path.

## Rules
The same as part I's brief (`notes/briefs/brief-ledger-1.md`, "Rules"), plus the lean-docs rules in `notes/briefs/rules-common.md`: PR body ≤ 40 lines, decision note ≤ 10 lines, no stills.
- Run the e2e specs for shop, welcome-crate, account, account-delete, squads and boss-tokens on your own port.
- Open the PR with the `full-e2e` label, then call unsubscribe_pr_activity, and report back.
