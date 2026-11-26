# Payments PR 5 (#963): the review's fixes (Nov 26). Opus xhigh, FULL lane. On branch `claude/pay-storage`

Read `git show origin/review/pay-storage:REVIEW.md` (the independent review: no blocker, 1 major, 3 minor, 6 nits) and the PR body (#963).
Do, on `claude/pay-storage` (merge origin/main first):
- **M1 (do all of steps 1, 2 and 4):** each purchase gets its own random ledger reference `purchases.ref` (made by `recordCheckout`); it
  is `leg.purchase`'s asset id, the credit legs' `source` and the op id (`pay:<ref>`); HOLDINGS reads `ref AS asset`; `session_id` stays
  the row's key for Stripe. On delete, `eraseMoves` sets the kept row's `ref` to NULL after the erase legs. Test: a deleted buyer's kept
  purchase and refund rows join to no ledger row (the review's SQL returns nothing). **Step 3 (director's call, made):** PR 8 will NOT
  send the ledger id as Stripe's `client_reference_id`; the credit matches on our own row (session → account); if Stripe must carry
  something it's the purchase's `ref`. Make `creditPurchase` match on the row alone now (no ledger id in `PaidSession`), and record the
  design change in the decision note and `docs/areas/payments.md` (a line in the design's §1 "superseded by" note too).
- **m1:** a payment completed after the account was deleted (or for a guest): record the payment in one guarded UPDATE (`WHERE session_id
  = ? AND status = 'pending'`): `payment_intent`, `card_country`, `tax_cents`, `paid_at`, status `unclaimed`; `remaining` stays 0; no
  coins. Test it. Note for PR 8 in payments.md: refund `unclaimed` at once; deleting an account expires its open Checkout Sessions.
- **m2:** NOT here: add it as an open item in `docs/areas/payments.md` ("for PR 9: keep refund_count, chargebacks and hold_until against
  the hashed identity, as fairplay_identities does").
- **m3:** the three tests the review names (the not-retried branch with `racing`, the credit's SQL guard in a race with delete landing
  before the batch, M1's guard).
- **n1:** when draws exist, also guard the coins at their read value. Test the review's OLD/NEW case.
- **n2:** `recordCheckout` reads the stored pack and refuses a different one for the same session. Test.
- **n3:** `spendPlan` refuses more than 20 draws (a setting), with a test.
- **n4:** `refundable` derives total and list from one read.
- **n5:** soften `docs/areas/payments.md`'s claim to what the guard checks (don't add a new checker).
- **n6:** not code: leave it to the director.
Tests: core + server unit tests all pass; typecheck. Append a "Review fixes" section to `.pr-body.md` (each finding → what you did,
checks added/changed old → new). Push at each real step; at the end COMMIT and push `.pr-body.md` and an empty `.done`, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`. Wait with one foreground
`timeout 590 bash -c '…'`, never Monitor.
