# Fix round (the ONLY one): PR #622, test accounts and the cheater demo

The review is `review.md` on branch `review/cheater-demo` (`git show origin/review/cheater-demo:review.md`). Work on
claude/cheater-demo (PR #622; pull first). Keep it small; there's no second review.

## Do
- **1 (security):** a dedicated switch: the token path opens only when `TEST_ACCOUNTS_CLIENT_ID` is set, and only for a JWT whose
  `common_name` equals it; unset → no token gets in (admin session and the e2e key as before). Put the variable in `wrangler.jsonc`'s
  `vars` as an empty string placeholder with a comment (the director fills the live value: a service token's client ID is an
  identifier, not a secret). Add to ROADMAP's launch list: clear it and run `cheater-demo.ts --delete` first. Correct the decision
  note and the docs ("closes by itself" was wrong). Unit tests: unset → 404 for a valid token; another token's common_name → 404; the
  named one → 200.
- **2 (data):** test accounts never count as reporters (`reviewIfReported`'s reporter query `AND u.test IS NOT 1`); a unit test next to
  "off public rankings".
- **3 (the demo's claim):** don't build the 17.1 harness. Change the PR body and the script's printed guidance: no promised "pooled
  within 3-6"; say the live deep re-check is native Stockfish 17.1 at 2M nodes (different from Eddie's engine), runs ~40 searches per
  15 min (~45 min per match, ~4 matches a day), so the run plays its matches and `--report` is run again later to read the result.
  Make `--wait-pool` default to about 45 minutes per queued match, or document "run --report later".
- **Minors:** the admin's POST doesn't set the test session cookie in the admin's own browser (only token and e2e callers get it);
  fix the header comment of `test-accounts.ts` ("everything kept about it" → what's actually removed, results re-keyed as any deleted
  account); fix the `accounts.ts` comment citing a nonexistent `NOT_TEST`; drop the extra profile read if it's a one-line change.
Run locally only the tests you change or add, the server unit suite and `npm run typecheck`. As your LAST push, together:
`.pr-body.md` (the full body), `.review-fixes.md` and `.done`. Don't push after `.done`. Don't open a PR. Read CLAUDE.md first.
