# Payments: the design (Nov 17, 2026), for Eric's OK

Nothing is built yet. This is the plan for real-money coins, the reasons for it, and the build in PRs.

## Approved already (Eric, Nov 17: `notes/briefs/payments-answers.md`, three rounds)

- Web only, Stripe, one currency (USD). Statement "HUNCHESS.COM" (no LLC needed for that; an LLC before live money, for liability).
- **One coin.** Everything is priced in coins, the bundle too; only coin packs cost money. The server keeps bought coins apart.
  One number shows everywhere. After the first purchase, a one-time pop-up; your profile gets "Total coins N · Refundable N".
- 100 coins = $1. Key 100 coins (was 250). Packs $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000.
- US + Canada first; others play and earn but can't buy yet. Belgium never. Under 16: no buying. 16-17: $50 a month at most.
  No birth date stored. Odds on every crate. Stripe test mode on the private site first. The beta's 50% off ends when money turns on.
- Refunds with no questions: unspent coins within 14 days; one opened item returned every 30 days; unauthorized and parent claims
  at any time; support@ can always say yes. Chargebacks take the coins back (the balance may go negative) and block buying.
- Earn first: "Play to earn" comes first; each pack says how much play it equals; no pop-ups, timers or fake discounts on packs.
- Legal: no lawyer. At the end, a legal pack (a file and screenshots) reviewed by two AI models, then compared.

## 1. Stripe

**Hosted Checkout, not the Payment Element.** It's the least code: the server makes a Checkout Session and the app goes to Stripe's
page. Apple Pay, Google Pay and Link show there with no domain setup. No Stripe script runs on our pages, so there are no CSP changes,
the card form is never ours (PCI SAQ A), and the app keeps no payment UI to test. The Payment Element would need Stripe.js in the app,
Apple Pay domain registration, and our own error and 3-D Secure screens. The cost of hosted Checkout is a trip off the site and back,
which is fine on a phone.

**No Stripe SDK.** The Worker makes three calls (create a Checkout Session, read one, create a Refund) as form-encoded `fetch`. It
checks the webhook signature itself: HMAC-SHA256 of `t.payload` with WebCrypto, against every `v1` in `Stripe-Signature`, compared
in constant time, rejected if `t` is more than 300 s old. That's about 60 lines (`server/stripe.ts`), with tests against Stripe's
documented examples. The SDK would add a large bundle for those three calls.

**The flow:**
1. **The app:** `POST /api/pay/checkout {pack, request}`. The server checks who may buy (section 5), then creates the session:
   `mode=payment`, inline `price_data` from `PAYMENTS.packs` in settings.ts (no Dashboard products: settings.ts is the one source),
   `automatic_tax[enabled]=true`, `client_reference_id` = the account's ledger id (never an email), `metadata` {pack, coins},
   `payment_method_types=[card, link]` (cards and wallets only, so a payment completes at once), `expires_at` +30 min, and the
   statement suffix. Its `Idempotency-Key` is the app's request id, so a double tap gets one session. The session is stored as
   `pending` and the app goes to its URL.
2. **Stripe's webhook** (`POST /api/stripe/webhook`): it gets `checkout.session.completed` with `payment_status=paid` and credits
   the coins. **Credit once:** the credit is a ledger op keyed `pay:<session id>`. Stripe may send an event twice or out of order,
   and the return trip may race it; the op applies once whatever comes first. Other events: `charge.refunded` (a refund made in the
   Dashboard), `charge.dispute.created` and `charge.dispute.closed` (section 3). Unknown events get 200 and nothing else.
3. **The return** (`/?paid=<session id>`): the app asks `GET /api/pay/session/:id`. If the webhook hasn't arrived yet, the server
   reads the session from Stripe and credits it with the same op key. Coins never come from the redirect's word, only from Stripe.
4. **Keys:** `STRIPE_SECRET_KEY` (a restricted key: Checkout Sessions and Refunds write, Charges read) and `STRIPE_WEBHOOK_SECRET`,
   kept in the Secrets Store like Google's and Resend's (`withSecrets()`). They are never in the repo. Test-mode keys go on the
   private site; live keys only when Eric flips `PAYMENTS.live`. The kill switch is `PAUSE_PAYMENTS` (ops.md): Buy is greyed with
   "Buying is paused for a moment."; webhooks and refunds keep working.
5. **Access:** Stripe can't pass Zero Trust, so `/api/stripe/webhook` needs an Access **bypass** (its security is the signature).

**Fees (read on stripe.com/pricing, stripe.com/tax/pricing and stripe.com/radar/pricing, Nov 17, 2026):**

| What | Fee |
| --- | --- |
| US card, Apple Pay, Google Pay, Link | 2.9% + 30¢ per successful charge |
| International card (Canada) | +1.5% |
| Currency conversion | +1% only when converting; we charge USD and settle USD, so none for us |
| Stripe Tax (Checkout, "no-code") | 0.5% per transaction **only where we're registered** (none at first); the API rate is 50¢ |
| Dispute (chargeback) | $15 received, +$15 if we counter it (that $15 comes back only if we win) |
| Refund | no fee, but the original 2.9% + 30¢ is **not returned** |
| Radar Lite (fraud) | included; paid Radar starts at $10 a month (not needed) |
| Hosted Checkout | included; a custom checkout domain costs $10 a month (not needed) |

What each pack costs us (US card, before tax): $1.99 pays $0.36 (18%); $4.99 pays $0.45 (8.9%); $9.99 pays $0.59 (5.9%); $19.99
pays $0.88 (4.4%); $49.99 pays $1.75 (3.5%). The $1.99 pack is expensive to sell and to refund. I'd keep it anyway: it's the honest
"one or two keys" size, and it's Eric's approved list. **One dispute costs as much as about 40 small packs' fees**, so a refund
button that's easy to find saves money as well as goodwill.

**Not now: Stripe Managed Payments** (Stripe as merchant of record: it handles tax in 80+ countries, fraud and disputes). It costs
about 3.5% more per charge (third-party reports; Stripe's own pricing page didn't show it), works with Checkout only, and Stripe may
refund buyers itself. For US + Canada, Stripe Tax is enough. It's the option to weigh when the UK and EU come.

**Stripe's rules:** "in-game currency" is allowed for the operator of the game (us) after review. "Games of chance" with "a prize of
value" are prohibited. Our crates stay outside that because items have no cash value and **coins and items are never cashed out or
traded for money**. Trading, if it ever comes, never involves real money, and paid items stay untradeable.

## 2. One coin, two ledgers underneath

The wallet's `coins` stays the one number (what every screen shows, and what every price is checked against). Beside it:

```sql
purchases (session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pack TEXT NOT NULL, coins INTEGER NOT NULL,
  remaining INTEGER NOT NULL CHECK (remaining >= 0),   -- this purchase's coins not spent yet
  cents INTEGER NOT NULL, tax_cents INTEGER NOT NULL, payment_intent TEXT, card_country TEXT,
  status TEXT NOT NULL,          -- pending | paid | expired | refunded | part_refunded | disputed | lost
  refunded_cents INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, paid_at INTEGER)
paid_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_id TEXT NOT NULL, cents INTEGER NOT NULL,
  bought_at INTEGER NOT NULL, item_id TEXT)            -- a key bought with bought coins; item_id once it opened one
refunds (op_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL,  -- coins | item | claim | dashboard | dispute
  cents INTEGER NOT NULL, coins INTEGER NOT NULL, stripe_refund TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL)
users: + buy_band TEXT (u16 | 16 | 18), buy_band_at INTEGER, buy_blocked INTEGER   -- section 5, section 3
items: + paid_key TEXT                                    -- the paid key that opened it, if any
```

- **Bought** = the sum of `remaining` over paid purchases. **Earned** = `coins` − bought. Earned coins never have a row of their own.
- **Spend earned first.** Every coin spend (a key, a crate, the bundle, a shop item) takes earned coins first, then the oldest
  purchase's `remaining`. The plan is made from one read and applied in the ledger op's batch, with each purchase's `remaining`
  guarded at its read value. A race fails the guard; the op changes nothing and is retried once. Two new ledger kinds,
  `purchase` (asset = session id) and `paid_key`, so the reconciliation covers them. The guard "no balance write outside
  ledger.ts" covers the new tables.
- **Keys bought with bought coins** become `paid_keys` rows (their value is the bought coins' share of the price). **An open uses a
  paid key first** (the key you just bought opens the next crate), so the item it opens is the one you can return.
- **Refundable** (the profile's line) = `remaining` of the purchases paid in the last 14 days, never more than `coins`.
- **Deleting an account:** "Delete account" first offers the refundable amount back. Purchase and refund rows stay, rewritten to
  the account `deleted` (as results are), because sales records must be kept for tax. The ledger is already anonymous. "Download my
  data" includes purchases and refunds. The privacy page gets its "Purchases" lines. Stripe keeps the card and email (Stripe's own
  policy); we never create Stripe Customers, so there's nothing to delete there.
- **Guests can't buy** (Sign in to buy), so a merge never carries purchases.

## 3. Refunds (approved; how they work)

- **Refund button** (Settings → ACCOUNT → Purchases, also reached by tapping the profile's line): every purchase of the last 14 days
  with unspent coins shows "Refund $X.XX (N coins)". Whole and untouched gives the full price back; partly spent gives
  `cents × remaining ÷ coins` back, rounded down to the cent, tax refunded in proportion. **Coins come off first, money goes out
  second:** one batch sets `remaining` to 0, takes the coins and writes the `refunds` row (pending). Then Stripe's Refund API is
  called with the op id as its `Idempotency-Key`. A failure stays pending and the 15-minute cron tries again; after 24 h it alerts
  (ops). Nothing hidden: past 14 days or fully spent, the button shows greyed with its reason and "support@hunchess.com".
- **Item return** (the locker, on an item opened with a paid key within 14 days): "Return: the item goes, the crate comes back, and
  your key's $0.XX is refunded." It's a true undo: the item is deleted, the crate goes back, and the paid key's `cents` are
  refunded from its purchase. Once every 30 days per account (checked in the same batch). The crate comes back so the undo is
  whole. The cost is at most one re-roll a month.
- **Unauthorized or parent claims** (support@ → the admin page `/admin/payments`, admins only, looked up by account or Stripe
  payment id): "Refund everything": every purchase is refunded in full at any age, items from paid keys are removed, bought coins
  are taken back (earned coins stay), and buying is blocked on that account. One click, one batch, then the Stripe refunds.
- **Refunds made in Stripe's Dashboard** (`charge.refunded`): the same coins-back rule, keyed by Stripe's refund id, so our own
  refunds (already recorded) are a no-op.
- **Chargebacks** (`charge.dispute.created`): the purchase's coins come off (the balance may go negative; existing guards already
  refuse a spend below the price), every purchase's `remaining` is set to 0, and `buy_blocked` is set ("Buying is off for this
  account. Email support@hunchess.com."). **We don't counter disputes under $20**: the $15 fee is lost either way and countering
  costs another $15. A dispute won (`charge.dispute.closed`, won) gives the coins back and lifts the block.

## 4. Prices and the flow (crates vs keys)

**Where coins come from today:** only ranked 1 v 1 (about 1.6 a minute, 20 paying games a day) and Squads placements (about 1.8 a
minute, 5 lobbies a day). **50 v 50, boss raids and solo games pay no coins.** So most players can't get "keys mainly from gold"
(Eric). **Proposal: play coins.** Every counted game that pays XP but no coins of its own pays 1.8 coins a minute of its XP minutes
(rounded, at least 1). Solo games stay under the solo minute cap. At most `perDay` 300 a day (about 2.8 hours). That's a key about
every 55 minutes of play, in every mode.

**Full prices** (the beta's 50% ends with real money):

| Item | Now | Proposed | Why |
| --- | --- | --- | --- |
| Crate key | 250 | **100** | approved ($1) |
| HunChess / Gift / Beta crate | 100 / 150 / 150 | **50 / 75 / 75** | crates are earned in plenty; they still need a key |
| Boss crate (shop) | 400 | **200** | opens with no key; the town's price is 3 tokens, or 1 token + a key |
| Crate + Key Bundle (3 + 3) | 900 | **400** | 450 bought separately, so the saving is real (11%), not a fake discount |
| God King effects | 400-600 | **300-400** | $3-4 for a color; the shop is off (`GOD_KING_SHOP`) |
| Chat packs | 200-300 | **100-150** | the shop is off (`CHAT_PACKS_SHOP`) |

**The flow** (assumptions: about 725 XP an hour (10 a minute plus half the games won), 2 dailies done a day, the weekly done; the
daily reward every day; 1 crate quest in 5):

| A week | XP | Levels | Crates earned | Keys earned (levels + weekly) | Keys from play coins | Share opened free |
| --- | --- | --- | --- | --- | --- | --- |
| 1 h a day, crates as now (2 a level) | ~12,200 | ~12 | ~35 | 13 | 7 | **57%** |
| 3 h a day, crates as now | ~22,300 | ~22 | ~55 | 23 | 21 (capped) | **80%** |
| 1 h a day, **1 crate a level** | ~12,200 | ~12 | ~23 | 13 | 7 | **87%** |
| 3 h a day, 1 crate a level | ~22,300 | ~22 | ~33 | 23 | 21 | **100%**, 11 keys' coins spare |
| Today, a 50 v 50 / raid player, 1 h a day | ~12,200 | ~12 | ~35 | 13 | 0 | 37% |

**The honest read:** at 2 crates a level, a 1 h/day player keeps 15 unopened crates a week, about $15 a week to open them all. That
growing pile of locked crates is the pressure the CS:GO key model is criticized for. **I recommend 1 crate a level** (`XP.levelCrates`
2 → 1). Crates still come every level and from the daily reward and quests, play opens nearly all of them, and buying only goes
faster. If Eric keeps 2, play coins still matter most. Never pay-to-win either way: everything bought is cosmetic.

**Each pack, as the coin screen shows it:**

| Pack | Coins | Keys | Hours of play | Bonus |
| --- | --- | --- | --- | --- |
| $1.99 | 200 | 2 | about 2 | 0 |
| $4.99 | 520 | 5 | about 5 | 4% |
| $9.99 | 1,100 | 11 | about 10 | 10% |
| $19.99 | 2,300 | 23 | about 21 | 15% |
| $49.99 | 6,000 | 60 | about 56 | 20% |

Hours of play = coins ÷ 108 (1.8 a minute).

## 5. Who may buy

- **Signed in, 16 or older (by the answer), in the US or Canada, not blocked.** Each rule is checked by the server at
  `/api/pay/checkout`. In the app the Buy buttons show **greyed with the reason**, never hidden: "Sign in to buy coins.", "Buying
  coins is for players 16 and older.", "Coin packs aren't sold in your country yet. You can still earn coins by playing.",
  "Monthly limit for players under 18: $N left."
- **The age answer:** the first Buy asks the age gate's question again ("when were you born?", month and year). The device works
  out a band and posts only `{band: "u16" | "16" | "18"}`, the same way `oldEnough` is posted. The server stores `buy_band` and
  when it was given; the birth date is never sent or stored. An under-18 band is asked again at a Buy six months or more later (a
  birthday may have passed); a later answer can move up one band at most. Self-declared, as the age gate is: "we did our part".
  (FTC v. HoYoverse, Jan 2025: $20M, and a ban on selling loot boxes to under-16s without a parent's consent.)
- **16-17:** paid purchases this calendar month (UTC), less refunds, plus any open session, may not pass $50. **One open Checkout
  Session per account at a time** (30 min), so two tabs can't both pass the check.
- **Country:** Cloudflare's `request.cf.country` must be US or CA when the session is made, and the card's country (from the
  webhook's charge) must be US or CA. A card from anywhere else, Belgium included, is **refunded in full at once and never
  credited** (rare: the IP check comes first). The other countries can be turned on later in `PAYMENTS.countries`; Belgium is never
  in it, and a test guards that.
- **Sales tax: Stripe Tax.** Prices are before tax ("$4.99 + tax where it applies", the US norm), and Checkout adds tax by the
  billing address. We collect only where we're registered. Registration is needed once sales pass a state's threshold (usually
  $100,000 a year; a few states also count 200 sales) or Canada's (CA$30,000 in 12 months for GST/HST). Stripe's Dashboard tracks
  how close we are; Eric registers when it says so. Tax code: Stripe's closest digital-games code, chosen at setup.

## 6. The coin screen: earn first

- Tapping 🪙 opens **Coins**. First comes **Play to earn**: "You earn about 108 coins an hour of play", the next free key ("Level 14
  in 620 XP: a crate and a key"), today's daily reward, the quests' crates and keys. Then **Coin packs**, each with its keys and
  hours ("= 5 keys · or about 5 hours of play").
- **No** pop-ups to buy, no timers or countdowns on packs, no "best value" badges, no struck-through prices on packs, no leftover-coin
  tricks (each pack is a whole number of keys, give or take 20 coins). The Shop's limited-item clock stays on crates only, never on
  coin packs. Odds stay on every crate's page, and so does the gambling warning.
- **After the first purchase, once:** "Your coins are in. Your refundable balance is always in your profile.", with OK. **Your own
  profile:** "Total coins 1,240 · Refundable 520" (others never see it). Tapping it opens Purchases.
- The Shop's "50% off during beta" line and ribbons go when `PAYMENTS.live` turns on (`SHOP.discount` → 0, the same PR).

## 7. Before live (Eric's to do)

1. **An LLC** (in his state; filing fees vary by state, about $50-$500, plus a registered agent if needed), an EIN, a business bank
   account.
2. **A Stripe account** for the LLC: the business is "HunChess", the website hunchess.com, the statement descriptor "HUNCHESS.COM".
   Answer the in-game-currency review. Turn on Stripe Tax. Put test keys in the Secrets Store (live keys later).
3. **Cloudflare Access:** a bypass for `/api/stripe/webhook`, and for the public pages Stripe's review needs to see: `/terms`,
   `/privacy`, `/refunds`, `/prices`, `/contact`. Email Routing for `support@hunchess.com` (free).
4. **The pages** (we write them): the terms (the "Virtual items" section rewritten: coins are bought, can't be cashed out, refunds),
   the refund policy (section 3, plain), the prices with odds, contact. The FAQ's "Is it free?" gets its new answer too. The Oct 16
   note's list (terms, FAQ, legal draft, ROADMAP) is all covered here.
5. **The legal pack** at the end: one file (this design as built, every page and line a buyer sees, the country/age rules, loot-box
   law: US/Canada none; Belgium banned; Netherlands' 2022 ruling; odds) plus screenshots, reviewed by two AI models and compared.
6. **Live:** Eric flips `PAYMENTS.live` after a real $1.99 purchase and its refund on his own phone.

## 8. The build, in PRs

| # | PR | Lane | Tests |
| --- | --- | --- | --- |
| 1 | Prices in settings.ts (table above; `XP.levelCrates` if Eric agrees), the FAQ's wording | light | the shop's unit and e2e price checks follow settings |
| 2 | Play coins in every counted game (XP's grant, one ledger leg, the daily cap) | full (wallets) | paid once under replays and races, the cap, solo's cap, merge, delete |
| 3 | Purchases storage: tables, ledger kinds `purchase` and `paid_key`, earned-first spending in every coin path, paid keys used first | full (stored data, money) | spend order, the race guard, reconciliation with purchases, nothing written outside ledger.ts, download and delete |
| 4 | Stripe: `stripe.ts` (fetch, signature), checkout, webhook, the return's check, `PAUSE_PAYMENTS`, test mode | full (money, security) | the signature (good, tampered, stale, several v1), credit once (event twice, event and return at once, out of order), a fake Stripe in e2e |
| 5 | Who may buy: the band answer, country, the $50 month, one open session, `buy_blocked` | full (age, money) | every refusal, greyed with its reason; the cap under two tabs; no birth date stored |
| 6 | The coin screen, packs, pop-up, the profile's line, Purchases page | targeted (screens) | e2e on phone and computer: nothing hidden, nothing moves, greyed reasons |
| 7 | Refunds, item return, claims (`/admin/payments`), Dashboard refunds, disputes, the cron's retry | full (money) | the 14 days, the partial math, the 30-day return, coins before money, Stripe failing then retried, negative balance, a dispute won |
| 8 | Public pages and Access paths, terms and FAQ text | light (+ Eric's Access change) | `legal.spec.ts` |
| 9 | Go-live switch: `PAYMENTS.live`, `SHOP.discount` → 0 | light | after Eric's real-phone purchase and refund |

Each PR updates `docs/areas/shop.md` and `accounts.md` (a new `docs/areas/payments.md` with PR 4) and lists the checks it changed.
Order: 1-3 can start now; 4 waits for Stripe test keys (Eric's step 2); 6-7 after 4; 8-9 last.

## Calls made here (for Eric's OK)

1. Hosted Checkout and no SDK: the least code, no Stripe script in the app.
2. Play coins in every mode, 1.8 a minute, 300 a day: needed for "keys mainly from gold".
3. **1 crate a level (from 2)**, so play opens most crates. This one changes an approved number, so it's Eric's choice.
4. A paid key is used before an earned one, so the item it opens can be returned. Item return gives the crate back (a true undo).
5. Chargebacks under $20 aren't countered. Prices are shown before tax. A card from outside US/CA is refunded at once.
6. The age band is asked at the first Buy, not at sign-up. It's asked again after 6 months for under-18 bands; it moves up one band
   at most.
