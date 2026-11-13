# Fix round: PR #687 (a ban means you can't sign in)

Effort xhigh, full lane. Branch `claude/ban-blocks-sign-in` (`git pull` first). Read CLAUDE.md, then the review:
`git fetch origin review/bans && git show FETCH_HEAD:review.md` (its appendix has proof-of-concept tests: use them).
The director's calls:
- **M1 (shared devices): the reviewer's fix.** The mark refuses requests with no session or with the banned account's own session;
  the sign-in routes pass it, so a proven, non-banned identity signs in and its live, non-banned session passes the mark (the banned
  person still gets the line on every URL: Eric's "No URLs work" is about the banned account). A refused sign-in ends only the banned
  account's session, not another's on that browser. `/admin/*` is out of the gate. Update the decision note, the privacy text and Eric's
  rule's wording to say exactly this. POC F2 as a test.
- **M2: fix** (`forgetToken(token)` in `sessionBanned` when the row is missing or expired). POC F3 as a test.
- **Minors:** 1 (no UNMARK when the response already marks or carries the header), 2 (Origin + JSON checks on email verify and start, as
  `/api/auth/age`), 3 (the app retries `checkBan` with backoff while the screen is up, and on visibilitychange/online), 4 (evasion at
  sign-in: make the account and ban it for evasion, as PLAY did, so a person can clear it; a line in the decision), 5 (`banCheckMs` 60 s;
  a line in ops.md that `ops` load-tests the gate before launch), 6 ("Ban (can't sign in)"), 7 (the privacy text).
- **Nits:** the WebSocket route in `ROUTES`; the cleared email "sign in again"; one source for the support address.
Typecheck, server/app/core unit tests, `e2e/fairplay.spec.ts` both projects. Append a short "Review round" to `.pr-body.md` (start from
the director's copy `notes/briefs/bans-pr-body.md`). Push WIP at each step; `.pr-body.md`, then `.done`, stop. No PRs, no CI waits, no
model names in commits, never secrets. Never stop silently.
