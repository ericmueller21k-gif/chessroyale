# Independent review: PR #1012, crates Nov 27 (FULL lane: crate grants), the Welcome Crate on first visit (open at level 5), the Gift-Wrap
# Tube's twist, the opening's pull-back

Read `notes/briefs/rules-common.md` first. Read-only, Opus, effort xhigh, about 45 minutes. Review `git diff origin/main...origin/claude/crates-nov27`
(Eric's words: `notes/briefs/crates-nov27.md`; the PR body on GitHub). Look hardest at:
- **The grant:** the first Welcome Crate given on a signed-in account's first app load, once per account ever, server-side, idempotent
  (reloads, two tabs, a race), never to a guest; accounts that already earned or opened one untouched; the sign-in merge (a guest who
  signs in), account deletion and the download include it; nothing a client sends can grant it twice or skip the level.
- **The level-5 gate:** the server refuses opening below level 5 for both Welcome Crates; the level read from the server's XP, never the
  device; the page shows it greyed with the padlock and "Reach level 5 to open" (nothing hidden).
- The notice on home (once; OK / Go to inventory), the walkthrough's text.
- The twist (no per-frame repaint of the whole figure; phone frame rate) and the opening's pull-back (the result and timing after the spin
  unchanged; solo and the server's answer unchanged).
- Tests: do the new checks fail without the change? The e2e helpers' change (`asSignedIn`/`asServerAdmin` closing the notice) can't hide
  a real failure elsewhere. Any guard test (docs/rules/eric.md) touched?
Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on branch `claude/crates-nov27-review`
from the PR head, push, `.done`. Don't fix code, open PRs or comment on GitHub.
