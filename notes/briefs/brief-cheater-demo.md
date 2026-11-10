# Cheater demo on the live site (Eric, Nov 10)

Eric: "make a deliberate bot and like do a couple runs of one that's like clearly cheating ... and then one that's maybe just like Maia
at a strong level ... I want to be able to go in and actually see everything play out as if it were real people and just see a couple
of names sitting there ... if that requires you to make accounts for them, then that's fine ... if you just need to override so they
don't need emails, and then you can just put dummy emails in." He views it at hunchess.com/admin/fairplay (the engine pool list,
PR #618, branch claude/engine-pool: build on that branch; once #618 merges, merge main in).

## Build
1. **Test accounts without email** (production too): an admin-only route (admin session or the e2e/admin key, behind Cloudflare
   Access like all /admin) that creates or signs in a named test account with a dummy email (`<name>@test.hunchess`), marked
   `test` (never on leaderboards, never paid real crates/coins beyond normal play, deletable in one call). Unit tests: refused to
   non-admins; the flag; leaderboards leave them out.
2. **A demo script** (`scripts/cheater-demo.ts`, Node, the chess package's Stockfish node transport and the Maia worker if usable in
   Node, else Stockfish at Maia-like strength): signs in as test accounts and plays real 50 v 50 matches on a base URL
   (default https://hunchess.com, through Cloudflare Access with the service token in CF_ACCESS_CLIENT_ID2/SECRET2 env, never
   printed). Each match: **"Engine Eddie"** plays Stockfish's top move every pick; **"Strong Sam"** plays a strong human-like move
   (Maia at its strongest, or top-3 weighted); **one or two judging accounts** ("Judge Jo", "Judge Jay") so the match is vouched
   (two devices of two accounts), bots fill the rest. It answers judge work as an honest device would.
3. **Run it** (locally against `wrangler dev` first, then the live site) until Eddie is pooled and Sam isn't (about 2-4 matches).
   Report: each account's matches, its fair-play numbers, its case status. If Sam gets pooled, say so with numbers (don't tune
   thresholds: that's Eric's call).
4. Leave the accounts and their data in place for Eric to look at. A one-line command to delete them later.

Lane: full (sign-in, accounts on production): the director adds `full-e2e`; one review, at most one fix round. Effort xhigh.
Decision note docs/decisions/2026-11-10-cheater-demo.md (≤ 120 words). Push to claude/cheater-demo at each real step; as your LAST
push write .pr-body.md (with the run's results table) and .done together. Don't open the PR. Never put a secret in the repo.
Read CLAUDE.md and notes/briefs/rules-common.md first.
