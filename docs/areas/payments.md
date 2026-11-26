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
- **Two ledgers underneath, in the one ledger.** Each purchase's `remaining` is a balance of asset kind `purchase` (its asset id the
  Checkout Session's id) beside the wallet's coins ([shop.md](shop.md), [accounts.md](accounts.md), "The ledger"): the daily check, the
  backfill, a guest's merge and deleting cover it as every balance. Only ledger.ts writes `remaining`.
- **A checkout** (`recordCheckout`, PR 8 calls it once Stripe has made the session): a pending row with the pack's coins and price as
  they are then. Never a guest's ("Sign in to buy coins."), checked in the statement too. The same session again changes nothing.
- **Credit once** (`creditPurchase`, PR 8's webhook and return check): a paid session credits its row's coins (never the session's word)
  in one op `pay:<session>`, reason `purchase`: coins +N and purchase +N, the row marked paid (when, the tax, the payment intent, the
  card's country) in the same batch. A second call, or several at once, pay nothing more. Nothing at all for a session never recorded,
  not paid, not in USD, at another price, of another account (its `client_reference_id` is the buyer's ledger id), a guest's, an
  account gone since, or a row no longer pending.
- **Spending: earned coins first** (`applySpend`, every coin spend: the coin shop's `buyItem` today), then the oldest purchase's
  `remaining`, then the next (core's `spendPlan`), all in the spend's own op (`spendLegs`: coins −price, purchase −take per draw). Its
  guard: the coins are there, earned is as read (or covers the price, when no purchase is drawn on), each purchase drawn on holds what
  was read. A change meanwhile (a grant, a spend, a refund) refuses it; it's planned again from a fresh read, once; refused again,
  "That didn't go through. Try again." and nothing is charged. `leg.coins` refuses a negative amount, so no spend can skip this.
- **Refundable** (`refundable`; core's `refundableCoins`): the `remaining` of purchases paid less than `PAYMENTS.refundDays` (14) days
  of 24 hours ago, never more than the coins, never below 0; with those purchases listed (each one's own `remaining`). For the profile's
  "Refundable N" (PR 7) and the Refund buttons (PR 9).
- **Deleting an account:** purchase and refund rows stay as the shared `deleted` account's (sales records, for tax; a later dispute
  still finds its row): their unspent coins closed in the ledger with every balance (`remaining` 0), a refund's comment erased. The
  users columns go with the account. **TODO (PR 9):** the delete confirmation first offers the refundable amount back.
- **Download my data** has every purchase (pending too) and refund (store `purchases`), and the users columns in `account`.

## The data

| Table / columns | What | Kept |
| --- | --- | --- |
| `purchases` (session_id PK, user_id, pack, coins, remaining, cents, tax_cents, payment_intent, card_country, status, refunded_cents, created_at, paid_at) | One row per Checkout Session: pending, then paid (expired, refunded, part_refunded, disputed later). `remaining` 0 to `coins` (CHECK) | For good (as `deleted`'s once the account goes) |
| `refunds` (op_id PK, session_id, user_id, kind, cents, coins, stripe_ref, status, comment, created_at) | Each refund or take-back (kind coins, claim, dashboard, chargeback); `comment` the refund message's text, `PAYMENTS.commentMax` at most (PR 9 writes them) | For good, without the comment once the account goes |
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

`PAYMENTS` in `packages/core/src/settings.ts`: `packs` (id, coins, cents), `currency`, `refundDays`, `commentMax`.

## Tests

- `packages/core/test/payments.test.ts`: the packs, earned first then the oldest (ties by id, earned below 0), the refundable window and cap.
- `packages/server/test/purchases.test.ts`: the migration on a copy of the schema from before (`test/fixtures/schema-2026-11-26.json`),
  the checkout (never a guest's), the credit (once, at once, every refusal), earned first across several purchases, the guarded races
  (a spend meanwhile, coins earned meanwhile, refused twice), the database's CHECK, refundable, the download and deleting, a guest's
  merge, the reconciliation and the backfill covering the kind.
- `ledger.test.ts` (the static guard: only ledger.ts writes `remaining`; purchases.ts's two other writes listed), `account-data.test.ts`
  (the columns pinned), `shop-buy.test.ts` (the coin shop through the spend).

## Rules for this area

- Every coin spend goes through `applySpend` (never `leg.coins` with a negative amount: it throws). A new way to take coins back (a
  refund, a chargeback) moves `remaining` through ledger.ts in the same op as the coins.
- Coins are credited from our row, never from what the browser or the redirect says; the credit's op is keyed by the session.
- A guest never buys. Money and stored data: the full lane, with an independent review.
