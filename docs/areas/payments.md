# Payments: buying coins

Lane: the director (money, stored data: the full lane). The approved design: [2026-11-17-payments-design.md](../decisions/2026-11-17-payments-design.md)
(its table 13 is the build's order); Eric's answers: `notes/briefs/payments-answers.md` on branch `claude/director-notes`.

## How it works today

- **Nothing is sold yet.** Built: the storage (PR 5, Nov 26; [2026-11-26-purchases-storage.md](../decisions/2026-11-26-purchases-storage.md));
  who may buy (PR 6, Nov 26; [2026-11-26-who-may-buy.md](../decisions/2026-11-26-who-may-buy.md)). Not yet: the coin screen and the
  profile's line (PR 7), Stripe (PR 8: the checkout, the webhook that credits), refunds, chargebacks and their messages, closing and its
  sign-in refusal (PR 9), the admin tab (PR 10), the public pages (PR 11; drafts in `docs/drafts/payments/`). Nothing calls the
  checkout or the credit yet but tests; nothing in the app calls `/api/buy` yet (PR 7).
- **One coin on screen.** Only coin packs cost money (`PAYMENTS.packs`: $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000,
  USD, before tax); everything else costs coins. Underneath, each purchase keeps its coins still unspent (`purchases.remaining`):
  **bought** = the sum of `remaining`, **earned** = coins − bought (`coinSplit`; below 0 only after a purchase's coins are taken back).
- **Two ledgers underneath, in the one ledger.** Each purchase's `remaining` is a balance of asset kind `purchase` beside the wallet's
  coins ([shop.md](shop.md), [accounts.md](accounts.md), "The ledger"): the daily check, the backfill, a guest's merge and deleting
  cover it as every balance. Its asset id is the purchase's own random **ledger reference** (`purchases.ref`, made at checkout), never
  a Stripe id: Stripe's ids name the buyer and outlive the account, so they never go in the ledger (the review's M1, Nov 26). By rule
  only ledger.ts's legs move `remaining`; the static guard (`ledger.test.ts`) counts each file's writes to `purchases`, not which
  columns they set, so a new write in purchases.ts needs that rule checked by hand.
- **Who may buy** (PR 6; core's `buyAnswer` is the whole rule, pure; the numbers in `PAYMENTS.buyers` and `PAYMENTS.hold`, every line
  in core's `BUY_LINES`): signed in; 16 or older by the age band; 16-17 at most $50 a buying month; in the US or Canada; not held; not
  closed. **`GET /api/buy`** (`buyStatus`, the one answer PR 7 renders): `line` (every Buy's greyed line, or null), `askBand` (a Buy asks
  the band question first; every pack tappable then), `held` (the line is a hold's: taps are counted), `leftCents` (16-17's money left
  this month, else null) and each pack with its own `line` (the account's, or the cap's when its price no longer fits, or null). The
  refusals in order, each Buy greyed with its line (a tap shows it):
  1. a guest: "Sign in to buy coins.";
  2. closed (`closed_at`): "This account is closed. Questions: support@hunchess.com" (the design's sign-in line; until PR 9 refuses
     the sign-in itself, a closed account still sees a Buy);
  3. held (now before `hold_until`): "Purchasing isn't available on this account." (no reason, no date);
  4. outside the US and Canada (`request.cf.country`; unknown: not sold): "Coin packs aren't sold in your country yet. You can still
     earn coins by playing.";
  5. the band question due (never answered, or an under-18 band 6 months after its answer): no line, `askBand`;
  6. under 16: "Buying coins is for players 16 and older.";
  7. 16-17, per pack: "Monthly limit for players under 18: $N left." on each pack whose price is more than what's left ($50, $45.01).
- **The age band** (`users.buy_band`: `under-16`, `16-17`, `18+`; `buy_band_at`): the device asks a birth month and year at the first
  Buy and posts only the band (core's `buyBandOf`: the birth month counts as not yet complete, so 16 starts on the 1st of the month
  after the 16th-birthday month, 18 likewise, and a truthful answer never lets a 15-year-old buy; the review's M1) to
  **`POST /api/buy/band`** {band} (this site's page, JSON; answers the new BuyStatus, or 409 with why). Taken only when due (`askBand`): the first as given; asked again (under 18,
  6 calendar months on) at most one band up, a lower answer as given (`bandAfter`); each answer restarts the 6 months. Not asked of
  an account that couldn't buy anyway (a guest, closed, held, abroad). Two answers at once store one. Never a birth date.
- **The buying month** (core's `buyMonthStart`): the 1st at `XP.dayStartUtcHour` UTC (08:00: midnight Pacific standard time; 1 am in
  summer, 10 pm the evening before in Hawaii), turning with the XP day; never the device's clock, and no time zone is stored. **What
  counts:** each checkout made in the month (by when it was made), at its price before tax, paid or pending (one paid but not yet
  credited counts) less `refunded_cents` (before tax too: what refunds returned of the price), each checkout never below 0 (so no slip
  in that convention frees more than a price; the review's M2); never `expired`, `unclaimed`, or the checkout still open (a new Buy
  replaces it).
- **One open checkout at a time** (every account): open = pending and made less than `checkoutMinutes` (30) ago. A new Buy replaces
  it: PR 8 expires each open one at Stripe (`openCheckouts`), then here (`expireCheckout`: pending → `expired`), then makes the new
  one. Two Buys at once: the second is refused ("Another checkout is open. Finish it, or try again in a moment.").
- **A checkout** (`recordCheckout(sql, user, pack, session, now, country)`, PR 8 calls it once Stripe has made the session, with the
  request's country): a pending row with the pack's coins and price as they are then, and its ledger reference; only by the rule
  (`checkoutLine`: the pack's line, or "Before you buy coins: when were you born?" while the band question is due) and with no other
  checkout of the account's open. Its INSERT holds the rule's stored parts too (signed in, not closed, not held, a band that may buy,
  the 16-17 cap with this price, no checkout open), so a paid checkout or a hold landing between the read and the write can't slip past;
  a refusal answers its line (PR 8 then expires the session it made). The same session again changes nothing and answers the pack as
  stored; another pack for it is refused ("That checkout is for another coin pack.").
- **Credit once** (`creditPurchase`, PR 8's webhook and return check): a paid session credits its row's coins (never the session's word)
  to its row's account (our row maps the session to its buyer; the session carries no account) in one op `pay:<ref>`, reason
  `purchase`: coins +N and purchase +N, the row marked paid (when, the tax, the payment intent, the card's country) in the same batch.
  A second call, or several at once, pay nothing more. Nothing at all for a session never recorded, not paid, not in USD, at another
  price, or a row no longer pending.
- **Paid with no account to credit** (deleted since the checkout, or a guest's; the review's m1; closed since, PR 6): no coins, but the
  payment is recorded on the row in one guarded UPDATE (only while pending): `payment_intent`, `card_country`, `tax_cents`, `paid_at`,
  status **`unclaimed`**, `remaining` 0. The credit answers `gone`, `guest` or `closed` (its op's statement checks closed too); the
  row's status says what's to do (`unclaimed`: refund it; `paid`: credited before the account went). A hold started since doesn't stop
  a credit (it stops new checkouts).
- **A hold** (the quiet flag, the design's section 3): `holdCount` (a statement for PR 9's refund batch and a chargeback's; nothing
  calls it yet but tests) adds 1 to `refund_count`; the 3rd (`PAYMENTS.hold.after`) sets `hold_until` 90 days on (`days`), each after
  starts them again, never shortening a later end. Held until the moment before `hold_until`. While held only buying stops (refunds,
  earning, spending all work). **`POST /api/buy/tap`** (`heldTap`): a greyed Buy tapped while held adds 1 to `held_taps`, at most one a
  minute an account (`tapGapMs`, in each Worker instance's memory as the API's limits), never when not held; answers {counted}.
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
  then each purchase's `ref` set to NULL and its `paid_at` cut to its day, and each refund given a new random op id (`deleted:<hex>`),
  its comment erased and its `created_at` cut to its day (an exact time is its ledger op's: delta review D1; as deleting does to
  results). So a kept row has no id and only the day: none can be joined to the ledger by id or time (tested: `purchases.test.ts`,
  "lead to no ledger row"). What's left: the day and the pack can still single out a buyer on a day with one sale of that pack, as a
  kept result's day can (the director and Eric may want more: see Open items). The users columns go with the account. **TODO (PR 9):** the delete confirmation first offers the refundable amount back.
- **Download my data** has every purchase (pending too; with its `ref`, so it matches the download's ledger changes) and refund (store
  `purchases`), and the users columns in `account`.

## The data

| Table / columns | What | Kept |
| --- | --- | --- |
| `purchases` (session_id PK, ref UNIQUE, user_id, pack, coins, remaining, cents, tax_cents, payment_intent, card_country, status, refunded_cents, created_at, paid_at) | One row per Checkout Session: pending, then paid or unclaimed (expired, refunded, part_refunded, disputed later). `ref` the ledger reference (NULL once the account goes). `remaining` 0 to `coins` (CHECK) | For good (as `deleted`'s once the account goes, without `ref`) |
| `refunds` (op_id PK, session_id, user_id, kind, cents, coins, stripe_ref, status, comment, created_at) | Each refund or take-back (kind coins, claim, dashboard, chargeback), keyed by its ledger op; `comment` the refund message's text, `PAYMENTS.commentMax` at most (PR 9 writes them) | For good, without the comment and under a random op id once the account goes |
| `users`: buy_band, buy_band_at, refund_count, hold_until, chargebacks, closed_at, closed_reason, held_taps | The age band answered at the first Buy and when (PR 6 sets them); refunds and chargebacks counted and the hold's end (PR 6's `holdCount`, called by PR 9); closed and why (PR 9); Buy taps while held (PR 6) | With the account |

## Code

| What | Where |
| --- | --- |
| The rules, pure: packs, `spendPlan`, `refundableCoins`, `inRefundWindow`, `boughtOf`; who may buy: `buyAnswer`, `checkoutLine`, `BUY_LINES`, `capLine`, the bands (`buyBandOf`, `bandDue`, `bandAfter`), `buyMonthStart` | `packages/core/src/payments.ts` |
| The tables and columns (`PURCHASES_SCHEMA`, `PURCHASES_COLUMNS`), `buyRefusal`, who may buy (`buyStatus`, `answerBand`, `heldTap`, `holdCount`, `openCheckouts`, `expireCheckout`), `recordCheckout`, `creditPurchase`, `coinState`, `coinSplit`, `spendGuard`, `applySpend`, `refundable`, the download and the refunds' erase | `packages/server/src/purchases.ts` |
| `GET /api/buy`, `POST /api/buy/band`, `POST /api/buy/tap` (and `countryOf`, the request's country) | `packages/server/src/api.ts` |
| The `purchase` kind: `leg.purchase`, `spendLegs`, `HOLDINGS`, the merge and the erase | `packages/server/src/ledger.ts` |
| The coin shop's spend | `packages/server/src/accounts.ts` (`buyItem`) |
| The download's store and deleting | `packages/server/src/account-data.ts` (store `purchases`; the ledger's store keeps the purchase rows) |

## Settings

`PAYMENTS` in `packages/core/src/settings.ts`: `packs` (id, coins, cents), `currency`, `refundDays`, `commentMax`, `maxDraws`; `buyers`
(`minAge` 16, `adultAge` 18, `minorCapCents` 5000, `askAgainMonths` 6, `countries` US and CA, `checkoutMinutes` 30); `hold` (`after` 3,
`days` 90, `tapGapMs` 60 000). The month turns with `XP.dayStartUtcHour`.

## Tests

- `packages/core/test/payments.test.ts`: the packs, earned first then the oldest (ties by id, earned below 0), the draws' cap, the
  refundable window and cap; who may buy: the band's edges, the birth month not yet complete (15 years 11 months, 16 by month still
  under 16, 16 years 1 month, 17 years 11 months, 18 by month still 16-17, 18 years 1 month, the year's turn), asked again only under 18 after 6 months, up one band at most, the month's turn (08:00 UTC, the year's too), every line the
  design's, the refusals' order (no band asked when something else refuses), the hold's end, the $50 cap to the cent per pack.
- `packages/server/test/who-buys.test.ts`: the band asked once, stored, guarded (two at once), never asked of a guest, held, closed or
  abroad account; under 16 and the country (no checkout, nothing written); the $50 month's edge (exactly $50, a cent over, a refund
  freeing what it returned), the statement's own cap (a paid checkout landing between the read and the write), the month's turn, what
  counts (pending, paid, refunded, part refunded, disputed, at the price before tax; a refund recorded with its tax frees no more
  than its price; not expired, unclaimed, last month's or the one still open); the quiet
  flag's count (the 3rd starts 90 days, each after restarts, never shortened, three at once count three), held until its end, a hold
  landing between the read and the write; held taps (once a minute, never unheld); closed (no checkout; a payment begun before kept
  unclaimed, its op refusing too); one open checkout (30 minutes, expired, paid, two at once); the API (guest, no country, the band
  from this site as JSON only, 409 once answered, held taps).
- `packages/server/test/purchases.test.ts`: the migration on a copy of the schema from before (`test/fixtures/schema-2026-11-26.json`),
  the checkout (never a guest's; the stored pack), the credit (once, at once, every refusal; a guest's kept as unclaimed), earned first
  across several purchases, the guarded races (a spend meanwhile, coins earned meanwhile, a give-back to an older purchase meanwhile,
  refused twice, refused with the coins unchanged and not retried, a credit with the account deleted or the checkout expired
  meanwhile), the draws' cap under D1's 100 values, the database's CHECK, refundable, the download and deleting (a deleted buyer's
  kept rows lead to no ledger row; paid after deleting: unclaimed), a guest's merge, the reconciliation and the backfill covering
  the kind.
- `ledger.test.ts` (the static guard: no file but ledger.ts writes a balance table, except the writes it lists, purchases.ts's three:
  the pending row, the payment and its status, and a pending checkout marked expired), `account-data.test.ts` (the columns pinned), `shop-buy.test.ts` (the coin shop
  through the spend).

## Rules for this area

- Every coin spend goes through `applySpend` (never `leg.coins` with a negative amount: it throws). A new way to take coins back (a
  refund, a chargeback) moves `remaining` through ledger.ts in the same op as the coins.
- Coins are credited from our row, never from what the browser or the redirect says; the credit's op is keyed by the purchase's ref.
- **Nothing in the ledger names Stripe, and nothing sent to Stripe names the ledger** (the review's M1; the director's call, Nov 26):
  no session id, payment intent or refund id as an asset, source or op id; no ledger id (or an op id that holds one) as
  `client_reference_id`, metadata or an idempotency key. Deleting drops every key a kept row could join on (`ref`, a refund's op id).
- A guest never buys. Money and stored data: the full lane, with an independent review.
- **Who may buy is one rule, core's `buyAnswer`:** the coin screen renders `GET /api/buy` as it is (no rule of its own), and every new
  way to start a checkout goes through `recordCheckout` (its statement holds the stored parts). A new refusal gets its line in
  `BUY_LINES`, its place in the order, and the same check in the checkout's statement if it's stored.
- No age is asked of an account that couldn't buy anyway, and only the band is stored, never a birth date.

## Open items

- **For PR 7 (the coin screen):** render `GET /api/buy` as it is: each pack's `line` greyed (a tap shows it; while `held`, a tap also
  posts `/api/buy/tap`, at most once a minute), `askBand` asks the band question first (a birth month and year, worked out with core's
  `buyBandOf`, only the band posted to `/api/buy/band`; its heading `BUY_LINES.band` or the screen's own), `leftCents` for 16-17.
  The country is Cloudflare's (`request.cf.country`): check that `wrangler dev` (the e2e's server) gives one, else every pack says
  "not sold in your country" there.
- **For PR 8 (Stripe), who may buy:** set each session's `expires_at` to `PAYMENTS.buyers.checkoutMinutes` (30, Stripe's least): "open"
  here assumes it. Before making a session, expire each of `openCheckouts` at Stripe (POST
  /v1/checkout/sessions/:id/expire) and `expireCheckout` it; one Stripe says is already complete is credited instead, at once. Pass
  `request.cf.country` to `recordCheckout`; a refusal: expire the session just made and answer the line. Mark a session `expired` on
  `checkout.session.expired` too (an unpaid pending one past 30 minutes counts toward a 16-17 month until then). A paid session whose
  row is `expired` gets no coins (`not-pending`): refund it.
- **For PR 9:** the sign-in refusal for a closed account (a TODO in `api.ts`, where a ban refuses sign-in; `BUY_LINES.closed`); call
  `holdCount` in every refund's batch and a chargeback's (chargebacks + 1 beside it; the 2nd closes the account). Closing an account or
  starting a hold should expire its open checkout (as deleting does, PR 8). **Record `refunded_cents` before tax** (as `cents`; the
  review's M2): Stripe's `amount_refunded` and a Dashboard refund's amount include tax, so store their pre-tax part (the tax refunded
  in proportion stays out). The 16-17 month's count clamps each row at 0 all the same.
- **For PR 8 (Stripe):** refund an `unclaimed` purchase at once (found by its row's status, never by the credit's answer alone).
  Deleting an account expires its open Checkout Sessions (each is open up to 30 minutes). Send no `client_reference_id`: the credit
  matches on our row (session → account). If Stripe must carry something, the director's call is the purchase's `ref`; weigh first
  that Stripe's copy of the session would then hold the link our kept row no longer does (session → ref → the ledger's asset id), and
  that the ref would have to exist before Stripe makes the session (recordCheckout today makes it after).
  `recordCheckout` is called ONLY in the request that creates the Stripe session, before its URL reaches the browser: the return trip
  and the webhook call only `creditPurchase` (which answers `unknown` for a session never recorded). Our row is now the only thing that
  binds a payment to an account (delta review D2).
- **For PR 9 (refunds):** keep `refund_count`, `chargebacks` and `hold_until` against the hashed identity, as `fairplay_identities`
  does, so deleting the account (or a stale guest's merge) doesn't start them over (the review's m2; the design is silent on it: the
  director's call). A refund's op id names the purchase by its `ref`, never by a Stripe id; a refund made after the account is gone has
  no ledger op, so its row needs an op id of its own (`deleted:<hex>`, as the erase gives). Dedupe a refund webhook on `stripe_ref` (a UNIQUE index;
  NULLs don't clash), since a kept row's random op id can't (delta review D4). Keep partly spent purchases few, or make
  `PAYMENTS.maxDraws`' throw a polite refusal: partial refunds can leave many small remainders (delta review D3).
- **Retention (the director's and Eric's call; touches the privacy page):** after Stripe can no longer open a dispute (up to 120 days),
  give a kept purchase row a random `session_id` and clear `payment_intent`, so nothing on it names the buyer (delta review D1, step 4).
