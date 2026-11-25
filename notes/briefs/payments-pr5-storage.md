# Payments build, PR 5: purchases storage (Nov 26). Opus xhigh, FULL lane (money, stored data). Branch `claude/pay-storage`

Eric, Nov 26: two money jobs may run at once today (this one and PR 4, `claude/pay-boost`). Keep to your own files where you can; if you
must touch the ledger/wallet code PR 4 also touches (the coin grant, quest batch), keep the change small and say so in the PR body.

Read: CLAUDE.md, `docs/rules/eric.md`, `docs/areas/shop.md`, `accounts.md`, and the approved design on main:
`docs/decisions/2026-11-17-payments-design.md` sections 2 (storage), 3 (refunds: only the columns/rows this PR stores), 9 (who may buy:
only the `users` columns), 13 row 5, "Calls made here". Eric's answers: `notes/briefs/payments-answers.md` on `claude/director-notes`.
Build exactly row 5: "Purchases storage: tables, ledger kind `purchase`, earned-first spending, refundable, delete and download".
1. A D1 migration: `purchases`, `refunds`, the `users` columns of section 2 (this PR's migration; forward-only; safe on the live data:
   defaults for existing rows). `PAYMENTS` block in settings.ts with `packs` (the design's table 8) and every number the storage needs.
2. Ledger kind `purchase`, written by a server function `creditPurchase(session)` (idempotent on the session id: a second call pays
   nothing) that nothing calls yet but tests (PR 8's webhook will). The reconciliation covers the new kind.
3. **Spend earned first**, then the oldest paid purchase's `remaining`, in the spending op's batch, each `remaining` guarded at its read
   value (a race changes nothing and is retried once), exactly as section 2. Bought = sum of `remaining`; earned = coins − bought.
4. **Refundable** = `remaining` of purchases paid in the last 14 days, never more than `coins` (a function + test; no UI).
5. Delete account: purchase and refund rows stay, rewritten to `deleted`; "Download my data" includes them. (The "offer the refundable
   amount back" step is PR 9's UI: leave a TODO naming it.) Guests can't buy (a guard).
6. `docs/areas/payments.md` (new): how it works, the code, the settings, the tests. Update shop.md/accounts.md.
Tests: unit + server tests for every rule above (earned-first order across several purchases, the guarded race, idempotent credit,
refundable window and cap, delete/download, the migration on a copy of today's schema). No UI in this PR.
Lane: FULL (add the `full-e2e` label is the director's job). The director runs an independent review and delta reviews after you push.
Push at each real step. `.pr-body.md` (what, the migration, checks added/changed old → new, specs run), a decision note, then COMMIT and
push `.pr-body.md` and an empty `.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
Never print or commit a secret. Wait with one foreground `timeout 590 bash -c 'until ...; do sleep 30; done'`, never Monitor.
