# Coin prices

**DRAFT. Not served, linked or wired. Final after payments PR 9 (refunds).**

**Note for the build:** `PAYMENTS` isn't in `packages/core/src/settings.ts` yet. These numbers are copied from the design doc (`docs/decisions/2026-11-17-payments-design.md`). When `PAYMENTS.packs` is added, this page must match it.

## 100 coins = $1

Every coin pack is priced at 100 coins for $1, with a bit extra for the bigger packs. Coins are the only thing you buy with money. Everything in the shop costs coins.

| Pack | Price (before tax) | Coins | Keys (100 coins each) | About how long to earn it by playing |
| --- | --- | --- | --- | --- |
| Small | $1.99 | 200 | 2 | about 1.5 hours |
| Medium | $4.99 | 520 | 5.2 | about 4 hours |
| Large | $9.99 | 1,100 | 11 | about 8 hours |
| Bigger | $19.99 | 2,300 | 23 | about 16 hours |
| Biggest | $49.99 | 6,000 | 60 | about 43 hours |

- The "about how long" column uses 140 coins an hour, the average for a player who plays one hour a day. Your own time may differ.
- The key column is coins divided by 100. [TODO for Eric: how to round a partial key, for example 5.2 keys. The design doesn't say.]
- Prices are before tax. Stripe Tax is added where we're registered to collect it.
- Packs are paid through Stripe, in US dollars.

## What a key costs

- One crate key costs **100 coins**, which is **$1**.
- Crates are earned by playing too: one crate for every level you gain, plus keys from play. Keys come mainly from coins you earn by playing, and buying just gets you there faster.

## Who can buy

- You must be signed in, 16 or older, and in the United States or Canada.
- Players 16 and 17 can spend up to $50 a calendar month. See the terms, section 4.
- Under 16 can't buy.

## Not on the coin screen

There are no pop-up offers, timers, "best value" badges, or crossed-out prices on packs. The coin screen shows play to earn first, then the packs.

After your first purchase you see one message: "Your coins are in. Your refundable balance is always in your profile."

## Sources

- "Decided by Eric" bullet "One coin", and "100 coins = $1; key 100 coins. Packs $1.99/200, $4.99/520, $9.99/1,100, $19.99/2,300, $49.99/6,000. 1 crate a level." (the pack table and crate rule).
- "Decided by Eric" bullet "Under 16" (under 16 no buying; 16-17 $50 a month).
- §8 "Prices" table: crate key 250 → **100** ($1) at `SHOP.prices.key`. The design's table lists other item prices too: the design's numbers, not repeated here, because this page is about coin packs.
- §8 "Each pack on the coin screen" (the "= N keys · or about H hours" line; hours are coins ÷ 140).
- §6 "Coins: the math" (the 140-coins-an-hour average, the "Per day" table, "Keys come mainly from gold").
- §9 "Who may buy" (the country rule, the $50 month, prices before tax, Stripe Tax where registered).
- §10 "The coin screen: earn first" (no pop-ups, timers, badges or struck prices; the one-time message after the first purchase).

## TODO list (for Eric)

- Confirm the key rounding (partial keys).
- The "about how long" wording: the design gives only the averages above. Do you want it as hours or days?
- The item prices other than the key (boss crate, bundle, God King effects, chat packs) are in the design's §8. They're not on this page; add them when the shop's public page is written.
- Sales tax: the wording of "before tax" for players in places where tax is included.
