# Payments build, PR 6: who may buy (Nov 26). Opus xhigh, FULL lane (age, money). Branch `claude/pay-who-buys`

Read: CLAUDE.md, `docs/rules/eric.md`, `docs/areas/payments.md` (PR 5's page, its Open items), `shop.md`, `accounts.md`, and the approved
design on main `docs/decisions/2026-11-17-payments-design.md`: section 9 (who may buy), 3 (the hold after refunds), 4 (closed accounts),
5 (held taps), 13 row 6, "Calls made here". Eric's answers: `notes/briefs/payments-answers.md` on `claude/director-notes`. PR 5 (#963,
purchases storage) is merged: its `users` columns (`buy_band`, `buy_band_at`, `refund_count`, `hold_until`, `chargebacks`, `closed_at`,
`closed_reason`, `held_taps`) are yours to use; nothing else in its tables changes here.
Build exactly row 6: "Who may buy: bands, $50 month, one session, holds, closed, the greyed lines, held_taps". Server rules + their API
answers (no coin screen: that's PR 7; give PR 7 one function/answer it can render: may this account buy, and if not, the exact greyed line).
- Ages/bands as the design (16+, US/Canada, 16-17 capped $50 a calendar month, under 16 never), asked once and stored (`buy_band`,
  `buy_band_at`); the cap counted from `purchases` (paid, this calendar month, in the account's time zone or UTC: say which and why).
- One open checkout session at a time; the hold (`hold_until`) after refunds/chargebacks as section 3; closed accounts can't buy or sign in
  as section 4 (sign-in refusal only if the design says this PR does it; otherwise a TODO naming PR 9); `held_taps` counted as section 5.
- Every refusal has its exact greyed line from the design (copy in one place, settings or core).
- Guests can't buy (already a guard in PR 5: reuse it).
Tests: unit + server tests for each rule at its boundaries (the $50 month's edge and the month's turn, under 16, the hold's end, a closed
account, two sessions at once, held_taps), and the band asked once. No e2e unless a screen changes. `.pr-body.md` (what, checks changed old
→ new, specs run), a decision note, `docs/areas/payments.md`. Push at each real step; at the end COMMIT and push `.pr-body.md` and an empty
`.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
