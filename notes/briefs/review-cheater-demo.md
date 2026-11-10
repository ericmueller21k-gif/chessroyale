# Independent review: PR #622 (test accounts and the cheater demo), read-only, ONE round

PR #622 (branch claude/cheater-demo): a new D1 column `users.test`, an admin route that makes and signs in to accounts with no email on
production (`/api/admin/test-accounts`), and a script that plays them. Read CLAUDE.md, the diff (`git diff origin/main...origin/claude/cheater-demo`),
its decision note, and notes/briefs/brief-cheater-demo.md on claude/director-notes.

Rank only what matters (blocker / major; minors in a short list):
- **Security:** can anyone but an admin, the Access service token or the e2e key reach the route (a forged header, a missing Access
  JWT check, the e2e key off in production, another origin)? Can it sign in to or take over a real account? Does DELETE touch anything
  but test accounts? Does the token path really close at launch?
- **Data:** the column's migration (fresh and existing databases), deletion leaving nothing behind, test accounts kept off every
  ranking and leaderboard and anything paid.
- **The demo's claims:** that Eddie is pooled and Sam is not for the right reasons (not an artifact of the local stand-in for the engine
  server).
Don't fix. Write `review.md` on an orphan branch `review/cheater-demo` (findings with file:line, a failing case and the fix you'd make;
then "checked, fine"). Run the server unit tests and any you write. About 30 minutes. Push and stop.
