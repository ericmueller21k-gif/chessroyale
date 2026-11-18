# Payments and the coin economy: the design (Nov 17-18, 2026), v2 for Eric's OK

Nothing is built yet. v2 follows all five rounds of Eric's answers (`notes/briefs/payments-answers.md`, branch
`claude/director-notes`). The mockup's stills: branch `stills/coin-reward-mockup`.

## Decided by Eric

- Web only, Stripe, USD. Statement "HUNCHESS.COM". An LLC before live money. US + Canada first; Belgium never.
- **One coin.** Everything costs coins (the bundle too); only coin packs cost money. One number on screen; the server keeps bought
  coins apart. After the first purchase, a one-time pop-up; your profile shows "Total coins N · Refundable N".
- 100 coins = $1; key 100 coins. Packs $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000. 1 crate a level.
- Under 16: no buying. 16-17: $50 a month. Self-declared, no birth date stored ("a good problem to have ... not fight").
- **Refunds:** "err on the side of being very user friendly". Unspent bought coins within 14 days. "Yeah, take back the coins";
  opened items stay ("keep your items as a thanks"). **No item-return system** ("we don't even need to build a system for taking
  back items").
- **Chargebacks are never fought.** The 1st gets a message; "the second chargeback closes the account, as long as we're legally allowed".
- Earn first: "Play to earn" first; each pack says how much play it equals; no buy pop-ups, timers or fake discounts.
- Legal: no lawyer. At the end, a legal pack (a file and screenshots) reviewed by two AI models, then compared.

## 1. Stripe (unchanged from v1)

**Hosted Checkout, no SDK.** The server makes a Checkout Session (`mode=payment`, inline `price_data` from `PAYMENTS.packs`,
`automatic_tax`, `client_reference_id` = the ledger id, never an email, cards and wallets only, 30 min expiry, the app's request id
as `Idempotency-Key`) and the app goes to Stripe's page. No Stripe script on our pages (no CSP change, PCI SAQ A). The Worker makes
its few calls as form-encoded `fetch` and checks the webhook signature itself (HMAC-SHA256 with WebCrypto, every `v1`, constant time,
300 s tolerance; about 60 lines in `server/stripe.ts`). **Credit once:** `checkout.session.completed` (paid) credits a ledger op
keyed `pay:<session>`; the return trip (`/?paid=<id>`) asks the server, which reads the session from Stripe if the webhook is late.
Coins never come from the redirect's word. Keys in the Secrets Store (`withSecrets()`); test mode on the private site; `PAUSE_PAYMENTS`
greys Buy ("Buying is paused for a moment.") while webhooks and refunds keep working. `/api/stripe/webhook` needs a Zero Trust bypass.

**Fees** (stripe.com/pricing, read Nov 17): 2.9% + 30¢ a US card or wallet charge; +1.5% a Canadian card; no conversion fee (USD
in, USD out); Stripe Tax 0.5% only where registered; **a dispute $15** (never countered, so never the extra $15); a refund costs
nothing more but the first fee isn't returned. Our cost per pack: $1.99 → 36¢ (18%), $4.99 → 45¢, $9.99 → 59¢, $19.99 → 88¢,
$49.99 → $1.75 (3.5%). One dispute costs about 40 small packs' fees: an easy refund saves money as well as goodwill.

Stripe's rules: in-game currency is allowed for the game's operator after review; coins and items are never cashed out or traded
for money (trading, when it comes, is item for item and never with paid money).

## 2. Storage: one coin, two ledgers underneath

```sql
purchases (session_id PK, user_id, pack, coins, remaining CHECK (remaining >= 0), cents, tax_cents, payment_intent, card_country,
  status,               -- pending | paid | expired | refunded | part_refunded | disputed
  refunded_cents, created_at, paid_at)
refunds (op_id PK, session_id, user_id, kind,  -- coins | claim | dashboard | chargeback
  cents, coins, stripe_ref, status, comment,   -- comment: the refund message's optional text (500 characters at most)
  created_at)
users: + buy_band, buy_band_at              -- section 9
       + refund_count, hold_until           -- section 3 (refunds and chargebacks; the hold's end)
       + chargebacks, closed_at, closed_reason, held_taps   -- sections 4 and 5
```

- **Bought** = the sum of `remaining` over paid purchases; **earned** = `coins` − bought. **Spend earned first**, then the oldest
  purchase's `remaining`, in the ledger op's batch, each `remaining` guarded at its read value (a race changes nothing and is retried
  once). New ledger kind `purchase`; the reconciliation covers it. v1's `paid_keys` table and `items.paid_key` are gone (no item return).
- **Refundable** = `remaining` of purchases paid in the last 14 days, never more than `coins`.
- **Delete account** first offers the refundable amount back. Purchase and refund rows stay, rewritten to `deleted` (sales records are
  kept for tax). "Download my data" includes them; the privacy page gets its "Purchases" lines. Guests can't buy.

## 3. Refunds

- **The button** (Settings → ACCOUNT → Purchases; also a tap on the profile's line): each purchase of the last 14 days with unspent
  coins shows "Refund $X.XX (N coins)": untouched gives the full price, partly spent `cents × remaining ÷ coins` (rounded down, tax
  in proportion). **Coins first, money second:** one batch takes the coins, zeroes `remaining`, writes the `refunds` row (pending)
  and adds 1 to `refund_count`; then Stripe's Refund API with the op id as its key. A failure stays pending, the 15-minute cron
  retries, and after 24 h ops is alerted. Past 14 days or fully spent: the button shows greyed with why, and support@hunchess.com.
- **Opened items stay.** A key bought and used is spent coins, so nothing is refunded for it and nothing is taken back.
- **The refund message** (an FF window, the crates' style), Eric's words: **"Sorry you weren't happy. Please keep your items as a
  thanks for trying HunChess. If there's something we could be doing better, tell us below (optional)."** A text box,
  **Submit** (greyed until there's text) and **Close** (skips it). Submit saves `refunds.comment` and shows "Thanks! We read every one."
- **The quiet flag (Eric: "three refunds ... a 90-day hold on trading and purchasing")**: refunds and chargebacks count together,
  all time. The 3rd sets `hold_until` = now + 90 days; each one after it starts the 90 days again. **No extra message**: the refund
  message is the same. While held, only buying coins (and trading, when it exists) stop: refunds, earning, and spending coins all work.
- **Held, on screen** (Eric: "just gray it out ... you can still click it"): every Buy shows greyed; a tap says **"Purchasing isn't
  available on this account."** (no reason, no date) and adds 1 to `held_taps` (one small POST, at most once a minute counted).
- **Parent or unauthorized claims** (email to support@): the admin tab's **Refund everything**: every purchase refunded in full at any
  age, its coins taken back, items stay. It counts as one refund. **Refunds made in Stripe's Dashboard** (`charge.refunded`) follow
  the same coins-back rule, keyed by Stripe's refund id (our own are a no-op), and count too.

## 4. Chargebacks

- **Never countered.** No evidence is sent; the dispute closes as lost and its $15 is the cost. `charge.dispute.created`: that
  purchase's coins come off (all of them: the balance may go below zero, and earned coins pay it back before anything can be spent),
  `chargebacks` + 1, `refund_count` + 1 (toward the hold).
- **The 1st:** a one-time FF message the next time the app opens, Eric's words: **"We saw a chargeback on your purchase. We don't
  fight chargebacks, but they do cost us money. If something's wrong, a refund in Settings → Purchases is quicker. Any further
  chargebacks will result in the termination of your account."** OK.
- **The 2nd:** the account is **closed**. A dispute the buyer withdraws (`charge.dispute.closed`, won) gives the coins back and doesn't count.
- **What "closed" means in our system:** `closed_at` set; every session ends; **sign-in is refused** (the ban's path, Nov 13) with
  "This account is closed. Questions: support@hunchess.com"; the same Google sign-in can't make a new account. Others see it as a
  deleted account. Its data is kept 90 days (so an admin's **Reopen** can undo it), then erased as "Delete account" erases it; the
  purchase, refund and dispute rows stay, anonymous, for tax records. The privacy page says so.
- **What the terms must say** (for the legal pack): coins and items are a license with no cash value; the refund policy as above
  (opened items are kept); we may limit or pause buying or trading on any account without giving a reason; a chargeback takes the
  purchase's coins back and may leave the balance below zero; after repeated chargebacks we may close the account, ending access to its
  coins and items; how a closed account's data is kept and erased. **For the AI review to check:** that closing an account over
  chargebacks is allowed in every province and state we sell in (Quebec's consumer law gives buyers chargeback rights on distance sales;
  closing may need different wording or an exception there), and that the hold's "no reason given" is fine everywhere.

## 5. Admin: a Payments tab

`/admin/payments`, a tab **beside** Fair play in the admin pages (`server/admin.ts`), admins only, never inside the bans page.
- **Refunds:** when, account, pack, $ and coins, the comment (if any). **Chargebacks:** when, account, $, 1st or 2nd, open or closed.
- **Holds:** account, refund count, held until, **Buy taps while held** (`held_taps`; Eric was curious who tries). **Closures:** account,
  when, why. **Find an account** (or a Stripe payment id): its purchases, refunds, chargebacks.
- Actions: **Refund everything** (claims), **Lift hold**, **Reopen** (a closed account, within its 90 days). Each logged with the admin.
  The admin-abilities list (2026-11-09-admin-abilities.md) gets them.

## 6. Coins: the math

**The rule, every counted game** (wherever XP pays its minutes, by XP's rules: server-timed minutes, `XP.maxMinutes` 30 a game,
10 moves, nothing for leaving, a test game, a guest, or a player fair play is holding):

1. **Play coins:** `perMinute` 1.8 of the game's XP minutes, at least 1, until the XP day's **300** (`perDay`, about 2 h 47 min).
   Solo games stay inside XP's solo minute cap (120 a day).
2. **The performance bonus**, from what the server already knows, paid past the 300: a **win** 15 (XP's win: online 1 v 1, your 50 v 50
   team, a beaten raid boss; its friends'-lobby once-a-day rule carries over; a draw in ranked 5); **top 3 on your team's 50 v 50
   scoreboard** +10; **Squads placement** 1st 40, 2nd 25, 3rd-4th 15, 5th-8th 5. Solo pays no bonus (the device's word).
   **Not accuracy:** paying for accuracy pays engine help; the judge's numbers stay for fair play.
3. **Diminishing, with a ceiling:** the day's bonus is paid in steps of what you've earned: the first 150 in full, the next 200 at
   half, the next 200 at a quarter, none past that (300 paid at most). So a win past the cap pays 15, then 8, then 4. The ceiling
   is about 40 wins or top places in a day (10+ hours of strong play): abuse, not players. **The most a day: 600 coins (6 keys).**

This replaces ranked's own coins (2.4/1.6/0.8 a minute, 20 games a day) and Squads' placement coins (5 lobbies a day); Squads' crates
stay as they are. A 15-minute ranked win: 36 today, 42 now; a loss 12 → 27. A 30-minute Squads lobby: 1st 100 → 94, last 20 → 59.

**Per day** (games average 15 minutes, 4 an hour; bonus a game: weak 4, average 8, strong 13):

| Player | 1 h a day | 3 h a day | 6 h a day |
| --- | --- | --- | --- |
| Weak | 124 (1.2 keys) | 348 (3.5) | 396 (4.0) |
| Average | 140 (1.4) | 396 (4.0) | 471 (4.7) |
| Strong | 160 (1.6) | 453 (4.5) | 531 (5.3) |

Play on past 2 h 47 min and every good result still pays; a strong player earns a third more than a weak one, never multiples.

**A week, with 1 crate a level** (about 725 XP an hour, 2 dailies a day, the weekly; average player):

| | Crates earned | Free keys | Keys from coins | Opens with play |
| --- | --- | --- | --- | --- |
| 1 h a day | ~23 | 13 | ~10 | **all**, ~0 coins spare |
| 3 h a day | ~33 | 23 | ~28 | all, ~1,800 coins spare (shop, boss crates) |
| 6 h a day | ~48 | 38 | ~33 | all, ~2,300 coins spare |

Keys come mainly from gold, as Eric asked: buying only goes faster. All settings (`PLAY_COINS`):

```ts
export const PLAY_COINS = {
  perMinute: 1.8, perDay: 300,
  bonus: { win: 15, draw: 5, crowdTop3: 10, squads: { 1: 40, 2: 25, 3: 15, 5: 5 } },
  bonusSteps: [{ upTo: 150, rate: 1 }, { upTo: 350, rate: 0.5 }, { upTo: 550, rate: 0.25 }],  // earned bonus a day → paid; none past
};
export const COIN_BOOST = { multiplier: 2.5, minutes: 120, dropChance: 0.04 };
export const CRATE_BONUS = { levels: 5, dropChance: 0.04 };
```

## 7. Coin boost and crate bonus (daily-quest drops, never sold)

- **The roll:** each daily quest finished rolls once on the server, in the quest's ledger batch: 4% a **Coin Boost Crate**, 4% a
  **Crate Bonus**, else nothing. Doing both dailies, each comes about every 12 days. Shown in the reward toast ("Coin Boost Crate!").
  Never sold for money or coins. Not a loot box: its contents are fixed, so it needs no key and has no odds.
- **Coin boost, 2.5x for 2 hours of play:** coins only; XP stays genuine (Eric: "Forget the experience"). Opening the crate (Crates
  tab, free, when you choose: before a long session) starts 120 minutes that count down only in counted games' minutes, with no expiry.
  Both play coins and bonus are multiplied; the day's 300 and the bonus steps count the base coins, so a boost is worth about **420 extra
  coins** (about 4 keys) whenever it's used. A second crate opened adds 120 minutes; the multiplier never stacks. Shown: the strip's
  "x2.5 BOOST" badge and minutes left, and the Crates tab.
- **Crate bonus:** applied at once: your **next 5 level-ups give double crates** (2 in place of 1; keys stay 1). Another adds 5 more.
  Shown in the Crates tab ("Crate bonus: 4 level-ups left") and in the level-up toast ("+2 Winter Crates (Crate bonus)").
- **Their effect on the week:** about 3 extra crates a week, and about 235 extra coins (2-3 keys): they roughly balance.
- **Art for the API runner:** the Coin Boost Crate (64 × 64, an idle glint of 4 frames, an opening burst of 6, a 2.5x emblem); the
  boost badge (16 and 24 px, a coin with an up arrow); the Crate Bonus ticket (64 × 64, a crate with a "x2" gold ribbon, and a 24 px
  icon); **a 6-frame spin of the coin** (40 × 40, from `coin.png`) for the reward strip (the mockup squashes `coin.png` meanwhile).

## 8. Prices (full; the beta's 50% ends with real money)

| Item | Now | New | Setting |
| --- | --- | --- | --- |
| Crate key | 250 | **100** ($1) | `SHOP.prices.key` |
| HunChess / Gift / Beta crate | 100 / 150 / 150 | **50 / 75 / 75** | `SHOP.prices` |
| Boss crate (shop) | 400 | **200** | `SHOP.prices.boss` (the town's stays 3 tokens, or 1 + a key) |
| Crate + Key Bundle (3 + 3) | 900 | **400** | `SHOP.prices.bundle` (450-525 bought apart: a real saving) |
| God King effects | 400-600 | **300-400** | moved from `core/shop.ts` into `SHOP.godKing` |
| Chat packs | 200-300 | **100-150** | `QUICK_CHAT.packPrices` |

Each pack on the coin screen: "= N keys · or about H hours of play" (hours = coins ÷ 140, the average 1 h player's day: 200 about
1.5 h, 520 about 4 h, 1,100 about 8 h, 2,300 about 16 h, 6,000 about 43 h).

**The check (one run, one setting):** `scripts/coin-report.ts` reads the last 30 days' counted games from D1 (read-only: mode,
minutes, win, placement, scoreboard place), applies core's `gameCoins()` (the rule above, one pure function) and writes
`reports/coins.md`: average coins a game and an hour by mode, a player-day's spread, and how often the 300 and each bonus step are
reached. Its unit tests pin this doc's examples. Run it after each playtest week; tweak the settings from it.

## 9. Who may buy (unchanged from v1, plus holds)

Signed in; 16 or older by the band answer (asked at the first Buy: month and year on the device, only the band posted; under-18 asked
again after 6 months, up one band at most); 16-17 at most $50 a calendar month with one open session at a time; in the US or Canada
(`request.cf.country` and the card's country; a card from elsewhere is refunded at once, never credited); not held; not closed. Each
refusal shows the Buy greyed with its line ("Sign in to buy coins.", "Buying coins is for players 16 and older.", "Coin packs aren't
sold in your country yet. You can still earn coins by playing.", "Monthly limit for players under 18: $N left."); a hold's line names
no reason. Prices before tax, Stripe Tax added where we're registered (Eric registers when Stripe's Dashboard says a state's threshold
is near). FTC v. HoYoverse (Jan 2025) is why under 16 can't buy.

## 10. The coin screen: earn first (unchanged)

Tapping the coin count opens **Coins**: **Play to earn** first ("about 140 coins an hour of play", the next free key, today's
"Play today 186/300", a running boost), then the packs. No buy pop-ups, timers, "best value" badges or struck prices on packs. After
the first purchase, once: "Your coins are in. Your refundable balance is always in your profile." The beta line goes with `PAYMENTS.live`.

## 11. The coin reward (planned; mockup on `stills/coin-reward-mockup`)

- **Where:** a spot on the results screen, not a pop-up: a pop-up over the screen would cover the XP box or what's under it (nothing
  hidden). **A strip right under the XP box**, the same width, in the FF window style (`.ff-window`), **78 px** (the XP box's height),
  on every result screen with an XP box. Its space is there from the first paint, so nothing moves. A game with no coins shows the
  strip greyed with why ("No coins: under 10 moves."), as the XP box does. Boss results (the compact XP under your pawn): a compact
  strip under it, the layout's numbers reserving it (`bosses.md`), checked frame by frame.
- **What it does:** it starts when the XP bar finishes (the eye goes XP, then coins). Coins drop from the strip's top into a little
  pile at its left (one coin a 5, at most 10, 110 ms apart, 420 ms a fall, a small bounce: about 1.4 s), while **"+52" clocks up like a
  gas pump** (each digit a column that rolls) and the parts appear as the count reaches them ("15 min +27 · Win +15 · Top 3 +10"),
  with "PLAY TODAY 186/300" (or "300/300 · FULL") and a boost's badge. Then a sparkle and the top bar's total updates.
- **Sound:** the claw machine's coin clink (`clawCoin`) on each landing, at most every 90 ms, and auto chess's coin cascade (`sell`) at
  the end: both already made, no new files. The Sound setting applies.
- **Cheap on the GPU:** one small canvas; the 6 spin frames drawn once; at most 10 `drawImage` a frame for 1.4 s, then one last frame
  and the loop stops (no idle frames). The counter moves by `transform` only. Animations off or reduced motion: the end at once, one clink.
- Frames: phone mid-count, done, boost in dark mode, the cap reached; computer done. ROADMAP has it as a planned item.

## 12. Before live (Eric's to do)

1. An LLC (filing about $50-$500 by state), an EIN, a business bank account.
2. A Stripe account for the LLC ("HunChess", hunchess.com, "HUNCHESS.COM"); answer the in-game-currency review; turn on Stripe Tax;
   test keys into the Secrets Store.
3. Cloudflare Access bypasses: `/api/stripe/webhook`, `/terms`, `/privacy`, `/refunds`, `/prices`, `/contact`. Email Routing for support@.
4. Live: Eric flips `PAYMENTS.live` after a real $1.99 purchase and its refund on his own phone.

## 13. The build, in PRs (what starts before Stripe keys)

| # | PR | Lane | Waits for |
| --- | --- | --- | --- |
| 1 | Prices into settings (table 8; God King's into `SHOP.godKing`), `XP.levelCrates` 2 → 1, the FAQ | light | nothing |
| 2 | `gameCoins()` (play coins, bonus, steps) and its grant beside XP's; ranked's and Squads' coins folded in; `coin-report.ts` | full (wallets) | nothing |
| 3 | The coin reward strip (`CoinResult.tsx`), phone and computer, boss results' compact one | targeted + frames | 2 |
| 4 | Coin boost and crate bonus: the quest roll, the Coin Boost Crate, boost minutes, double crates; the art from the API runner | full (wallets) | 2 |
| 5 | Purchases storage: tables, ledger kind `purchase`, earned-first spending, refundable, delete and download | full (money, stored data) | nothing |
| 6 | Who may buy: bands, $50 month, one session, holds, closed, the greyed lines, `held_taps` | full (age, money) | 5 |
| 7 | The coin screen, packs, first-purchase pop-up, profile line, Purchases page (against a fake Stripe) | targeted | 5 |
| 8 | Stripe: `stripe.ts`, checkout, webhook, return check, `PAUSE_PAYMENTS`, the card's country | full (money, security) | **test keys** |
| 9 | Refunds and their message, the hold, chargebacks (message, closing, sign-in refused), Dashboard refunds, the cron retry | full (money, security) | 8 |
| 10 | Admin: the Payments tab and its actions | full (money, admin) | 9 |
| 11 | Public pages, terms, refund policy, FAQ; then the legal pack | light | drafts any time; final after 9 |
| 12 | Go-live: `PAYMENTS.live`, `SHOP.discount` → 0 | light | Eric's real purchase and refund |

**Before Stripe keys exist:** 1, 2, 3, 4, 5, 6, 7 and 11's drafts. 1, 2 and 5 can start at once (2 and 5 are both `xhigh`: one at a
time). Each PR updates `docs/areas/shop.md` and `accounts.md` (a new `docs/areas/payments.md` with PR 5) and lists the checks it changed.

## Calls made here (for Eric's OK)

1. **The bonus:** wins, 50 v 50 top 3 and Squads placements; not accuracy (it would pay engine help). Steps of full, half and a quarter,
   none past 550 earned (600 coins a day at most).
2. **One coin rule everywhere,** replacing ranked's and Squads' own coins (Squads' crates stay). Solo: play coins only.
3. **Coin boost:** 2 hours of counted play, no expiry, opened when you choose; boosted coins count at base toward the 300. **Drops:**
   4% boost, 4% crate bonus a daily quest. Crate bonus doubles crates, not keys.
4. **The hold counts refunds and chargebacks all time;** each one past the 3rd restarts the 90 days. Refund everything (claims) counts once.
5. **Closed:** sign-in refused, data kept 90 days for a Reopen, then erased; sales rows kept anonymous.
6. **The reward is a strip under the XP box**, not a pop-up (nothing hidden); it starts after the XP fill; existing sounds.
