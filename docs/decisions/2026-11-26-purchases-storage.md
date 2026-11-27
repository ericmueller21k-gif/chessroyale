# Purchases storage (Nov 26, 2026): the payments build's PR 5

**Eric (Nov 17):** "keep all currency still as one number"; refunds "hassle free". **Eric (Nov 18):** "Yeah, take back the coins".

1. **Each purchase is its own balance** (ledger asset kind `purchase`). A credit is one two-leg op, so the ledger stays one ledger.
2. **Earned coins are guarded too** when a spend draws on purchases, so coins earned in another tab can't let it take bought ones. Refused twice, nothing is charged: "That didn't go through. Try again."
3. **Bought** is the sum of `remaining`. Only a paid purchase holds any.
4. **"Paid in the last 14 days"** counts from the credit. The refundable total is capped at the coins and never below 0.
5. **Guests can't buy**, refused at the checkout and the credit.
6. **Deleting an account** keeps purchase rows for tax records, without any id that links to the ledger. Unspent coins are closed.
7. **The privacy page's purchase lines wait for PR 8**, the first PR that writes a row.
8. **The migration** adds two tables and eight columns, so every existing account gets "none".
9. **After review:** each purchase has its own ledger reference, not Stripe's ids, and the ledger id never goes to Stripe. A payment made after its account was deleted is recorded `unclaimed` and refunded at once. A spend draws at most `PAYMENTS.maxDraws` (20) purchases.

Full design and measurements: PR #963.
