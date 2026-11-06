# Brief: item ledger, part I (stored data and money: extra-high care)

**Eric, Nov 6:** "things like an audit trail for items does make sense … all these things are worth doing."

The audit (`notes/audit-2026-11-06.md` §1 and the plan's row 1, on branch claude/director-notes; read it at /home/user/cr-notes/notes/audit-2026-11-06.md) found:
- no single place where grants and spends go through: about 40 write statements in 7 server files;
- no history for coins, Squads rewards, key spends, admin grants or deleted items;
- a boss crate purchase erased when the crate opens (boss-tokens.ts:299);
- token drops deleted after 30 days;
- two real gaps:
  - online token drops can be written twice (lobby-do.ts:162-164, :202-203);
  - Squads rewards are lost on a failed write (squads-do.ts:116-123).

## Part I (this PR, the `full-e2e` label)
- `packages/server/src/ledger.ts` is the only module that changes a balance or an inventory.
- A new append-only `ledger` table: (op_id, leg) unique; account; asset kind and id; delta; reason; source id; created_at. No UPDATE or DELETE on it, ever.
- The migration is additive only. Existing tables keep working; balances stay where they are and the ledger records every change beside them, in the same transaction or batch.
- Route through ledger.ts every write path that already has a natural key: welcome crates, solo results, ranked coins (ranked.ts:132), the coin shop, merge and delete. Use the audit's idempotency key per event.
- Stop erasing history: a crate open records a ledger leg rather than leaving no trace. Don't delete existing rows that other code still reads, but make sure the history is in the ledger.
- Tests:
  - a reconciliation check: the sum of the ledger per account and asset equals the balance, for the paths in this PR;
  - replay: the same op applied twice changes the balance once;
  - a race: two concurrent identical requests;
  - a static guard test: no `UPDATE ... coins|keys|tokens|items` outside ledger.ts for the paths ported (allowlist the rest, marked for part II).
- No change to what players see. Keep the docs short: the PR body under 40 lines and a decision note under 10 lines.

## Part II is NOT in this PR (it comes next)
Request ids from the app (buy, open, grant, claw), the online drop key, Squads at-least-once, backfill, and the remaining paths. List them in the PR body as follow-ups.

## Rules
- The repo is /home/user/chessroyale. Make a worktree at /home/user/cr-ledger on branch claude/ledger-1 from origin/main.
- Commits: `git -c user.name=Claude -c user.email=noreply@anthropic.com`, ending with the trailers "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" and "Claude-Session: https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim". Never force-push, push empty commits, or rebase a pushed branch.
- Run the typecheck, server and app unit tests, and the e2e specs that touch the economy: shop, welcome-crate, account, boss tokens, claw if present, squads. Use your own port (sed the playwright config's 8788 into an untracked copy); free ports with `fuser -k PORT/tcp` only. If a port won't free, tell me.
- Open the PR via the GitHub MCP with the `full-e2e` label, then call unsubscribe_pr_activity. Report the PR number, SHA and a 10-line summary.
- American English. Don't list processes, read env or auth files, print env vars, or call session tools. No model names in commits, PRs or code. Never name or hint at a real person. Stills aren't needed (no visual change).
