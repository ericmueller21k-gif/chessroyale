# Payments: buying coins

Lane: the director (money, stored data: the full lane). The approved design: [2026-11-17-payments-design.md](../decisions/2026-11-17-payments-design.md)
(its table 13 is the build's order); Eric's answers: `notes/briefs/payments-answers.md` on branch `claude/director-notes`.

## How it works today

- **Nothing is sold yet.** Built: the storage (PR 5, Nov 26; [2026-11-26-purchases-storage.md](../decisions/2026-11-26-purchases-storage.md)).
  Not yet: who may buy (bands, the $50 month, holds, closed: PR 6), the coin screen and the profile's line (PR 7), Stripe (PR 8: the
  checkout, the webhook that credits), refunds, chargebacks and their messages (PR 9), the admin tab (PR 10), the public pages (PR 11;
  drafts in `docs/drafts/payments/`). Nothing calls the checkout or the credit yet but tests.
- **One coin on screen.** Only coin packs cost money (`PAYMENTS.packs`: $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000,
  USD, before tax); everything else costs coins. Underneath, each purchase keeps its coins still unspent (`purchases.remaining`):
  **bought** = the sum of `remaining`, **earned** = coins − bought (`coinSplit`; below 0 only after a purchase's coins are taken back).
- **Two ledgers underneath, in the one ledger.** Each purchase's `remaining` is a balance of asset kind `purchase` beside the wallet's
  coins ([shop.md](shop.md), [accounts.md](accounts.md), "The ledger"): the daily check, the backfill, a guest's merge and deleting
  cover it as every balance. Its asset id is the purchase's own random **ledger reference** (`purchases.ref`, made at checkout), never
  a Stripe id: Stripe's ids name the buyer and outlive the account, so they never go in the ledger (the review's M1, Nov 26). By rule
  only ledger.ts's legs move `remaining`; the static guard (`ledger.test.ts`) counts each file's writes to `purchases`, not which
  columns they set, so a new write in purchases.ts needs that rule checked by hand.
- **A checkout** (`recordCheckout`, PR 8 calls it once Stripe has made the session): a pending row with the pack's coins and price as
  they are then, and its ledger reference. Never a guest's ("Sign in to buy coins."), checked in the statement too. The same session
  again changes nothing and answers the pack as stored; another pack for it is refused ("That checkout is for another coin pack.").
- **Credit once** (`creditPurchase`, PR 8's webhook and return check): a paid session credits its row's coins (never the session's word)
  to its row's account (our row maps the session to its buyer; the session carries no account) in one op `pay:<ref>`, reason
  `purchase`: coins +N and purchase +N, the row marked paid (when, the tax, the payment intent, the card's country) in the same batch.
  A second call, or several at once, pay nothing more. Nothing at all for a session never recorded, not paid, not in USD, at another
  price, or a row no longer pending.
- **Paid with no account to credit** (deleted since the checkout, or a guest's; the review's m1): no coins, but the payment is recorded
  on the row in one guarded UPDATE (only while pending): `payment_intent`, `card_country`, `tax_cents`, `paid_at`, status
  **`unclaimed`**, `remaining` 0. The credit answers `gone` or `guest`; the row's status says what's to do (`unclaimed`: refund it;
  `paid`: credited before the account went).
- **Spending: earned coins first** (`applySpend`, every coin spend: the coin shop's `buyItem` today), then the oldest purchase's
  `remaining`, then the next (core's `spendPlan`), all in the spend's own op (`spendLegs`: coins −price, purchase −take per draw). Its
  guard: drawing on no purchase, the coins are there and earned covers the price; drawing on purchases, the coins and earned are both
  as read (so bought is too) and each purchase drawn on holds what was read. A change meanwhile (a grant, a spend, a refund, a
  give-back to an older purchase) refuses it; it's planned again from a fresh read, once; refused again, "That didn't go through. Try
  again." and nothing is charged. `leg.coins` refuses a negative amount, so no spend can skip this. A spend draws on at most
  `PAYMENTS.maxDraws` (20) purchases (spendPlan throws beyond it: 3 values a draw in the guard, D1 allows 100 a statement); unreachable
  today (3 at most).
- **Refundable** (`refundable`; core's `refundableCoins`): the `remaining` of purchases paid less than `PAYMENTS.refundDays` (14) days
  of 24 hours ago, never more than the coins, never below 0; with those purchases listed (each one's own `remaining`), both from one
  read. For the profile's "Refundable N" (PR 7) and the Refund buttons (PR 9).
- **Deleting an account:** purchase and refund rows stay as the shared `deleted` account's (sales records, for tax; a later dispute
  still finds its row by its session or payment intent): their unspent coins closed in the ledger with every balance (`remaining` 0),
  then each purchase's `ref` set to NULL, and each refund given a new random op id (`deleted:<hex>`) and its comment erased. So no kept
  row can be joined to the ledger, and from it to the rest of the account's history (tested: `purchases.test.ts`, "lead to no ledger
  row"). The users columns go with the account. **TODO (PR 9):** the delete confirmation first offers the refundable amount back.
- **Download my data** has every purchase (pending too; with its `ref`, so it matches the download's ledger changes) and refund (store
  `purchases`), and the users columns in `account`.

## The data

| Table / columns | What | Kept |
| --- | --- | --- |
| `purchases` (session_id PK, ref UNIQUE, user_id, pack, coins, remaining, cents, tax_cents, payment_intent, card_country, status, refunded_cents, created_at, paid_at) | One row per Checkout Session: pending, then paid or unclaimed (expired, refunded, part_refunded, disputed later). `ref` the ledger reference (NULL once the account goes). `remaining` 0 to `coins` (CHECK) | For good (as `deleted`'s once the account goes, without `ref`) |
| `refunds` (op_id PK, session_id, user_id, kind, cents, coins, stripe_ref, status, comment, created_at) | Each refund or take-back (kind coins, claim, dashboard, chargeback), keyed by its ledger op; `comment` the refund message's text, `PAYMENTS.commentMax` at most (PR 9 writes them) | For good, without the comment and under a random op id once the account goes |
| `users`: buy_band, buy_band_at, refund_count, hold_until, chargebacks, closed_at, closed_reason, held_taps | The age band answered at the first Buy; refunds and chargebacks counted, the hold's end; closed and why; Buy taps while held (PRs 6 and 9 set them) | With the account |

## Code

| What | Where |
| --- | --- |
| The rules, pure: packs, `spendPlan`, `refundableCoins`, `inRefundWindow`, `boughtOf` | `packages/core/src/payments.ts` |
| The tables and columns (`PURCHASES_SCHEMA`, `PURCHASES_COLUMNS`), `buyRefusal`, `recordCheckout`, `creditPurchase`, `coinState`, `coinSplit`, `spendGuard`, `applySpend`, `refundable`, the download and the refunds' erase | `packages/server/src/purchases.ts` |
| The `purchase` kind: `leg.purchase`, `spendLegs`, `HOLDINGS`, the merge and the erase | `packages/server/src/ledger.ts` |
| The coin shop's spend | `packages/server/src/accounts.ts` (`buyItem`) |
| The download's store and deleting | `packages/server/src/account-data.ts` (store `purchases`; the ledger's store keeps the purchase rows) |

## Settings

`PAYMENTS` in `packages/core/src/settings.ts`: `packs` (id, coins, cents), `currency`, `refundDays`, `commentMax`, `maxDraws`.

## Tests

- `packages/core/test/payments.test.ts`: the packs, earned first then the oldest (ties by id, earned below 0), the draws' cap, the
  refundable window and cap.
- `packages/server/test/purchases.test.ts`: the migration on a copy of the schema from before (`test/fixtures/schema-2026-11-26.json`),
  the checkout (never a guest's; the stored pack), the credit (once, at once, every refusal; a guest's kept as unclaimed), earned first
  across several purchases, the guarded races (a spend meanwhile, coins earned meanwhile, a give-back to an older purchase meanwhile,
  refused twice, refused with the coins unchanged and not retried, a credit with the account deleted or the checkout expired
  meanwhile), the draws' cap under D1's 100 values, the database's CHECK, refundable, the download and deleting (a deleted buyer's
  kept rows lead to no ledger row; paid after deleting: unclaimed), a guest's merge, the reconciliation and the backfill covering
  the kind.
- `ledger.test.ts` (the static guard: no file but ledger.ts writes a balance table, except the writes it lists, purchases.ts's two:
  the pending row, and the payment and its status), `account-data.test.ts` (the columns pinned), `shop-buy.test.ts` (the coin shop
  through the spend).

## Rules for this area

- Every coin spend goes through `applySpend` (never `leg.coins` with a negative amount: it throws). A new way to take coins back (a
  refund, a chargeback) moves `remaining` through ledger.ts in the same op as the coins.
- Coins are credited from our row, never from what the browser or the redirect says; the credit's op is keyed by the purchase's ref.
- **Nothing in the ledger names Stripe, and nothing sent to Stripe names the ledger** (the review's M1; the director's call, Nov 26):
  no session id, payment intent or refund id as an asset, source or op id; no ledger id (or an op id that holds one) as
  `client_reference_id`, metadata or an idempotency key. Deleting drops every key a kept row could join on (`ref`, a refund's op id).
- A guest never buys. Money and stored data: the full lane, with an independent review.

## Open items

- **For PR 8 (Stripe):** refund an `unclaimed` purchase at once (found by its row's status, never by the credit's answer alone).
  Deleting an account expires its open Checkout Sessions (each is open up to 30 minutes). Send no `client_reference_id`: the credit
  matches on our row (session → account). If Stripe must carry something, the director's call is the purchase's `ref`; weigh first
  that Stripe's copy of the session would then hold the link our kept row no longer does (session → ref → the ledger's asset id), and
  that the ref would have to exist before Stripe makes the session (recordCheckout today makes it after).
- **For PR 9 (refunds):** keep `refund_count`, `chargebacks` and `hold_until` against the hashed identity, as `fairplay_identities`
  does, so deleting the account (or a stale guest's merge) doesn't start them over (the review's m2; the design is silent on it: the
  director's call). A refund's op id names the purchase by its `ref`, never by a Stripe id; a refund made after the account is gone has
  no ledger op, so its row needs an op id of its own (`deleted:<hex>`, as the erase gives).
