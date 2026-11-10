# Independent review: PR #618 (the engine pool), read-only, ONE round

PR #618 (branch claude/engine-pool) in the full lane: fair play and matchmaking. Read CLAUDE.md, the diff
(`git diff origin/main...origin/claude/engine-pool`), its decision note docs/decisions/2026-11-10-engine-pool.md, and the brief it
answers (notes/briefs/brief-engine-pool.md on claude/director-notes). Eric set this: flagged players only ever meet each other (or
bots) in every mode, they're never told, he sees them on /admin/fairplay and can Release them; at most ONE fix round after this review.

Look for, and rank only what matters (blocker / major; minors in a short list at the end):
- **Honest players pooled:** a path that pools someone with no real evidence (unvouched matches, a guest merge, a shared device or
  identity, a single lucky match, the level path firing earlier than intended); and Release truly returning them everywhere.
- **The pool leaks:** any queue, mode, party or reconnect where a pooled account meets clean players (or a clean one is routed into
  the pool); the browser able to choose or escape it.
- **The pool tells them:** anything a pooled player can see or measure (texts, profile, leaderboards, queue counts, timings) that
  gives it away.
- **The admin page and data:** admins only, no emails in the download, the numbers right.
Don't fix. Write `review.md` on an orphan branch `review/engine-pool` (findings with file:line, a concrete failing case and the fix
you'd make; then "checked, fine" in a few lines). Run the server unit tests and any you write. About 40 minutes. Push and stop.
