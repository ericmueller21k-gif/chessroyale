# Purchases storage (Nov 26, 2026): the payments build's PR 5

Eric (Nov 17): "keep all currency still as one number"; refunds "hassle free"; "Yeah, take back the coins" (Nov 18). The approved design
(`2026-11-17-payments-design.md`, section 2, row 5 of its table 13): purchases and refunds tables, the users columns, ledger kind
`purchase`, earned-first spending, refundable, delete and download. Nothing is sold yet: Stripe is PR 8, so nothing calls the checkout
or the credit but tests. How it works now: [docs/areas/payments.md](../areas/payments.md). Calls made in building it (for the director's
review):

1. **"Ledger kind `purchase`" is an asset kind, not only a reason.** Each purchase's unspent coins (`purchases.remaining`) are a balance
   of their own (asset kind `purchase`, asset id the purchase's ledger reference `ref`, since the review: see below), beside the
   wallet's coins. A credit is one op `pay:<ref>` (reason `purchase`) of two legs, coins +N and purchase +N; a spend's bought part is
   one more leg per purchase drawn on. So the design's
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
   paid, in USD, at the row's price before tax, and credits the row's account (since the review, the session names no account: see
   below), if it's signed in, still there, and the row still pending.
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

## After the independent review (Nov 26)

The review (`REVIEW.md` on branch `review/pay-storage`: no blocker, 1 major, 3 minor, 6 nits) and the director's calls on it
(`notes/briefs/payments-pr5-fixes.md`, branch `claude/director-notes`):

13. **Each purchase has its own ledger reference (M1).** Deleting an account kept its purchase rows with Stripe's ids (`session_id`,
    `payment_intent`, which Stripe ties to the buyer's email and card), and the same session id was the ledger's asset id, source and
    op id: one join led from a kept sales record to the deleted account's whole ledger history, breaking the privacy page's "naming
    nobody". Now `purchases.ref` (12 random bytes in hex, made by `recordCheckout`) is `leg.purchase`'s asset id, the credit's op
    (`pay:<ref>`) and its legs' source, and HOLDINGS reads `ref AS asset`; `session_id` stays the row's key for Stripe. Deleting sets
    the kept row's `ref` to NULL after the erase's legs, and gives a kept refund row a new random op id (`deleted:<hex>`): its op id was
    its ledger op's, a second join. Done now because the ledger is append-only: once PR 8 writes a real credit its keys are for good.
    The delta review (D1) found a third join, by time: a kept row's `paid_at` (and a refund row's `created_at`) equal its ledger legs'
    `created_at` to the millisecond. Deleting now keeps only the day of each (as it does for results). A kept row has no id and only
    the day.
14. **The ledger id never goes to Stripe (the design's §1, superseded; the director's call).** The design sent it as the Checkout
    Session's `client_reference_id`, so Stripe's copy of every session would have held it. PR 8 sends none: the credit matches on our
    own row (session → account), and `PaidSession` carries no account. If Stripe must carry something, the director's call is the
    purchase's `ref`. (A caution for PR 8: Stripe's copy would then hold the link the kept row no longer does, session → ref → the
    ledger's asset id, and the ref would have to exist before Stripe makes the session.) This touches what the privacy page promises:
    Eric's OK goes with the director's.
15. **Paid with no account to credit (m1):** a checkout paid after its account was deleted (Stripe's page stays open up to 30 minutes),
    or a guest's: no coins, but the payment is recorded in one guarded UPDATE (`WHERE session_id = ? AND status = 'pending'`):
    `payment_intent`, `card_country`, `tax_cents`, `paid_at`, status `unclaimed`, `remaining` 0. The sales record then matches Stripe's
    charge, and PR 8 finds it to refund at once. For PR 8: deleting an account expires its open Checkout Sessions.
16. **Oldest-first is pinned by the coins too (n1):** a spend that draws on purchases is also guarded on the coins as read. With earned
    guarded equal, that pins bought, so a give-back to an older purchase meanwhile (a withdrawn dispute, PR 9) is seen and the spend is
    planned again. It costs a rare extra retry.
17. **The rest:** `recordCheckout` answers the pack as stored and refuses another pack for the same session (n2); `spendPlan` refuses
    more than `PAYMENTS.maxDraws` (20) draws, as the guard binds 3 values a draw and D1 allows 100 a statement (n3; unreachable today,
    3 at most); `refundable` derives its total and its list from one read (n4); the area page says what the static guard checks, a
    count of writes and not their columns (n5: no new checker). m2 (refund and chargeback counts and the hold kept against the hashed
    identity) is an open item for PR 9 in the area page; n6 (the live database's check before merging) is the director's.
