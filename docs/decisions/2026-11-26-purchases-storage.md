# Purchases storage (Nov 26, 2026): the payments build's PR 5

Eric (Nov 17): "keep all currency still as one number"; refunds "hassle free"; "Yeah, take back the coins" (Nov 18). The approved design
(`2026-11-17-payments-design.md`, section 2, row 5 of its table 13): purchases and refunds tables, the users columns, ledger kind
`purchase`, earned-first spending, refundable, delete and download. Nothing is sold yet: Stripe is PR 8, so nothing calls the checkout
or the credit but tests. How it works now: [docs/areas/payments.md](../areas/payments.md). Calls made in building it (for the director's
review):

1. **"Ledger kind `purchase`" is an asset kind, not only a reason.** Each purchase's unspent coins (`purchases.remaining`) are a balance
   of their own (asset kind `purchase`, asset id the Checkout Session's id), beside the wallet's coins. A credit is one op `pay:<session>`
   (reason `purchase`) of two legs, coins +N and purchase +N; a spend's bought part is one more leg per purchase drawn on. So the design's
   "two ledgers underneath" are the one ledger, and the daily check, the backfill, the merge and the erase cover bought coins with no
   new code path (`HOLDINGS` in ledger.ts).
2. **Earned is guarded exactly when a spend draws on purchases** (the design guards each `remaining`; this adds earned): otherwise coins
   earned between the read and the write (a game's coins in another tab) would let the spend take bought coins while earned ones could
   pay, and the player's refundable coins would shrink. A spend earned covers is guarded on earned ≥ the price. Refused, it's planned
   again from a fresh read, once; refused again: "That didn't go through. Try again." and nothing is charged. A refusal with the coins
   unchanged since the read (the op's own guard: the item is yours already) isn't tried again.
3. **No coin leaves through `leg.coins`** (it throws for a negative amount; fix the cause, Nov 13): every spend goes through
   `applySpend` → `spendLegs`, so a future spend (crates, keys, the bundle) can't skip earned-first. `ledger.test.ts`'s one spend now
   builds its legs with `spendLegs`.
4. **Bought = the sum of `remaining` over every row** of the account, not filtered by status: only a paid purchase holds any (0 while
   pending; a refund, a dispute or an expiry leaves 0), so one sum serves the spend's guard, the split and the refundable.
5. **"Paid in the last 14 days"** = less than 14 × 24 hours before now, from the moment it was credited (`paid_at`). The refundable total is
   capped at the coins (and never below 0); the per-purchase list isn't capped: how a total under them is shared out is PR 9's.
6. **The checkout row is this PR's** (`recordCheckout`, PR 8 calls it once Stripe makes the session): it stores the pack's coins and
   price as they are then, so the credit pays the row's coins, never the session's word. The credit pays nothing unless the session is
   paid, in USD, at the row's price before tax, by the row's account (its ledger id is the session's `client_reference_id`), signed in,
   still there, and the row still pending.
7. **Guests can't buy:** refused at the checkout ("Sign in to buy coins.") and at the credit, each in its SQL too (the account as it is
   at that moment). A guest's merge still moves purchase and refund rows with their ledger legs (none can exist; if one ever did, the
   two would still agree).
8. **Deleting an account** keeps its purchase rows as the shared `deleted` account's with their session id, payment intent, card
   country, money and times (sales records, for tax; and so a dispute or a Dashboard refund that comes after still finds its row), their
   unspent coins closed in the ledger with every other balance and `remaining` set to 0. Refund rows stay the same way, without the
   comment (the player's own words). The users columns go with the users row.
9. **The download** has every purchase (pending ones too) and refund, comment included, and the users columns via the account's own
   row (`SELECT *`): the hold's end and the counts too. Unlike fair play's detection records they show the player nothing about how
   anyone else is caught, so they're in; the director or Eric may revisit (the design says only that a hold names no reason on screen).
10. **The privacy page's "Purchases" lines wait for PR 8** (the first PR that can write a row; their draft is
    `docs/drafts/payments/privacy-purchases.md`): the page says "Real-money purchases: none today", still true. This PR adds no
    screen or copy.
11. **Statuses are text without a CHECK** (PR 9 may add one without a table rebuild); `remaining` keeps `0 ≤ remaining ≤ coins` as the
    database's own last lock. Pack ids `coins-200` … `coins-6000`.
12. **The migration** is the runtime schema's, as every table's (accounts.md, "The database"): two `CREATE TABLE IF NOT EXISTS` and eight
    `ADD COLUMN`s, the counts `NOT NULL DEFAULT 0`, the rest NULL, so every existing account gets "none". Tested on a copy of the schema
    as main made it before this PR (`packages/server/test/fixtures/schema-2026-11-26.json`).
