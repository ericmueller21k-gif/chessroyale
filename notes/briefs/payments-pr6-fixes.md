# Payments PR 6 (who may buy), the review's fixes (Nov 26). Opus xhigh. Full lane. Branch `claude/pay-who-buys` (PR #967).

Read first: the review `git show origin/review/pay-who-buys:REVIEW.md` (findings, scenarios, the fixes it proposes), the PR's decision
note and `docs/areas/payments.md`, CLAUDE.md. Work on `claude/pay-who-buys` (head 1aef38e3; merge `origin/main` first if it moved).
The director's calls on each finding:
- **M1 (birth month):** the safe fix. `ageInMonths(...) - 1` in `buyBandOf` (the birth month not yet complete): 16 starts the 1st of
  the month after the 16th-birthday month; 18 likewise. Change the two pinned lines ("16 exactly" → `under-16`, "18 exactly" → `16-17`),
  add "16 years 1 month" → `16-17` and its 18 twin. Reword "whole months, as the age gate counts" in payments.md and the decision note.
  No day question.
- **M2 (refund with tax):** both parts: pin `refunded_cents` as before tax (schema comment + payments.md, a line for PR 9), and clamp per
  row `SUM(MAX(cents - refunded_cents, 0))`. A test row with tax in "counts every checkout made this month".
- **m1:** the race tests the review lists (closed between read and INSERT; account deleted; band lowered to under-16; a closed and held
  account's tap not counted), each failing when its guard is removed (check by hand, revert). Fix the stale PR 5 test comment.
- **m2:** an open item in payments.md's PR 8 section: the pending-row sweeper (at a Buy and in the 15-minute cron) and the `expires_at`
  margin note. No code.
- **m3:** do it now: `paused` in `BuyFacts` and `BUY_LINES.paused` ("Buying is paused for a moment.", the design's section 1), refused right
  after a guest, from `isPaused(env, "payments")` (kill-switches.ts gains `payments`, and ops.md/DEPLOY.md list it). Record in the
  decision note that PAUSE_SHOP doesn't gate payments (why).
- **m4:** no device flag (Eric's answers: lies about age are "a good problem to have ... not fight"). One line in the decision note.
- **Nits:** n1 wording; n2 move the player-visible strings into `BUY_LINES`; n3 400 for a malformed band; n4 refuse a `recordCheckout`
  replay whose row isn't `pending`, with a test; n5 the Origin check on `/api/buy/tap`; n6 nothing; n7 the two timings to T0 − 2 h.
Tests: `npx vitest run packages/core packages/server`, typecheck. Append a "Round 2: the review's fixes" section to the PR body: commit
`.pr-body.md` holding the whole body (`git show 63c7de86:.pr-body.md` plus the new section: what changed, checks changed old → new).
Push at each real step; at the end commit and push `.pr-body.md` and an empty `.done`, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English.
