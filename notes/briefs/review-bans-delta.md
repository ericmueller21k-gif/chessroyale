# Delta re-review: PR #687 (bans), its review round, read-only, ~25 min

Effort xhigh. The first review: `git show origin/review/bans:review.md`. The round: commits on `origin/claude/ban-blocks-sign-in` after
`eafaf10f` (`git diff eafaf10f origin/claude/ban-blocks-sign-in -- packages docs e2e`). Check each finding is fixed as the PR body's
"Review round" says (ericmueller21k-gif/chessroyale#687), and the new calls hold up: the mark refuses only no-session requests (never
sign-in routes); a sister on a marked tablet signs in and plays and her session survives his refused sign-in; the banned person still
sees only the line (+ "Sign in to another account") on every URL and API route; M2 (forgetToken); sign-in routes running without a
session for every browser (Origin/JSON checks; CSRF; a guest session ended on a refused sign-in); evasion accounts made and banned,
clearable; the app's re-asks (no loop, backoff). Also: `e2e/hidden-boss-room.spec.ts:242` [desktop] passed only on retry on this PR's
first CI run: can the gate or mark cause it? Run `npx vitest run packages/server packages/core packages/app` and typecheck. Write
`review.md` on orphan branch `review/bans-delta` (findings or "no findings"), push, stop.
