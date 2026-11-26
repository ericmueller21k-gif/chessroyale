# Independent review: Payments PR 6, who may buy (Nov 26). Opus xhigh, READ-ONLY. Full lane.

PR https://github.com/ericmueller21k-gif/chessroyale/pull/967, branch `claude/pay-who-buys` (head 1aef38e3; its body: `git show 63c7de86:.pr-body.md`).
Read the design `docs/decisions/2026-11-17-payments-design.md` sections 9 (who may buy), 3 (the hold after refunds), 4 (closed accounts),
5 (held taps), 13 row 6, "Calls made here"; Eric's answers `notes/briefs/payments-answers.md` on branch `claude/director-notes`; the PR's
decision note and `docs/areas/payments.md`. Review `git diff origin/main...origin/claude/pay-who-buys` as an independent reviewer. Focus, in order:
1. **Age and band:** under 16 can never buy; 16-17 capped at $50 a calendar month counted exactly (paid rows only, refunds and pending
   sessions handled as the design says, the month's turn and its time zone, two tabs racing past the cap); the band asked once and not
   re-askable to change it (a 15-year-old answering 18 the second time).
2. **One open checkout session:** atomic (two requests at once can't both open one), expiry, a session left open never blocks forever.
3. **Holds, closed accounts, held_taps:** `hold_until` boundaries; closed accounts refused everywhere the design says; held_taps counted
   once per tap, not per retry.
4. **Guests and auth:** every new endpoint signed-in only, PAUSE_SHOP respected, no other account's state readable.
5. **The greyed lines:** each refusal maps to exactly one line from the design, copy in one place; PR 7 gets one answer it can render.
6. **Stored data:** any schema change safe on the live D1 and re-runnable; nothing else in PR 5's tables written.
7. **Tests:** each rule at its boundaries, not only the happy path; changed checks honest.
Write `REVIEW.md` on a new branch `review/pay-who-buys` (from the PR head): findings blocker/major/minor/nit, each with file:line, a
concrete scenario and a fix. Run core + server unit tests and throwaway tests as needed (don't push code to the PR branch). Push
`REVIEW.md`, then an empty `.done` in a second commit, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`, no Co-Authored-By. American English. About 45-60 minutes.
