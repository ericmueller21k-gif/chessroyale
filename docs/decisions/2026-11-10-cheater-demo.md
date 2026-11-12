# The cheater demo and test accounts (Nov 10, 2026)

Eric: "make a deliberate bot ... clearly cheating ... and one that's maybe just like Maia at a strong level ... see a couple of
names sitting there ... you can just put dummy emails in". **Call:** `/api/admin/test-accounts` makes named accounts at
`<name>@test.hunchess` (`users.test`), for an admin, a script through Access with the one service token `TEST_ACCOUNTS_CLIENT_ID`
names (`wrangler.jsonc`), or the e2e's key; never a real account; off public rankings; their reports never count toward a review;
one DELETE removes them as any deleted account (results re-keyed, ledger kept) and their fair-play file.
**The token path is the route's own switch, not Access's setup** (PR #622 review, finding 1; an earlier line here said it "closes by
itself" at launch: wrong, a token Access issues for the health path's application passes the same checks). Unset or empty, no token
gets in. Before launch: `cheater-demo.ts --delete`, then the variable back to `""` (ROADMAP.md, launch blockers).
`scripts/cheater-demo.ts` plays real 50 v 50s as four honest devices: Engine Eddie (Stockfish), Strong Sam (Maia 2500), Judge
Jo and Jay (Maia 1500). At a boss final they resign: an unchecked boss move would unvouch the match.
**No promised result:** the live deep re-check is native Stockfish 17.1 at 2M nodes (Eddie plays Node's Stockfish 19), about 45 min
per match and 4 matches a day, so the script plays its matches and `--report`, run later, reads whether Eddie was pooled.
