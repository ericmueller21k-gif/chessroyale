# Who may buy (Nov 26, 2026): the payments build's PR 6

Eric (Nov 17): under 16 no buying, 16-17 "$50/month", US and Canada first; (Nov 18) "just gray it out ... you can still click it",
the 3rd refund "a 90-day hold on ... purchasing", the 2nd chargeback closes the account; age self-declared ("a good problem to have
... not fight"). The approved design (`2026-11-17-payments-design.md`, sections 3, 4 and 9, row 6 of its table 13). How it works now:
[docs/areas/payments.md](../areas/payments.md), "Who may buy". Nothing is sold yet: PR 7's coin screen renders `GET /api/buy`, PR 8's
checkout calls `recordCheckout`. Calls made in building it (for the director's review):

1. **One rule, pure, in core** (`buyAnswer`), with every line in `BUY_LINES` and the numbers in `PAYMENTS.buyers` and `PAYMENTS.hold`.
   The server reads the account as stored (never a session's view of it) and answers it (`buyStatus`, `GET /api/buy`): an account-wide
   `line`, `askBand`, `held`, `leftCents`, and each pack with its own line. PR 7 renders it as it is.
2. **The order of refusals:** a guest, paused (call 12), closed, held, the country, then under 16, then the 16-17 cap per pack. The
   band is asked only when nothing before it refuses, so no age is taken from someone who couldn't buy anyway (a guest, held, closed,
   abroad).
3. **The band** (`users.buy_band`: `under-16`, `16-17`, `18+`; `buy_band_at`): worked out on the device from a birth month and year,
   the birth month itself counted as not yet complete (core's `buyBandOf`; the review's M1, the director's call): 16 starts on the
   1st of the month after the 16th-birthday month, 18 likewise, so a truthful answer never lets a 15-year-old buy or a 17-year-old skip
   the cap. Someone born on the 1st waits a month more, and an honest player who answers in their birthday month waits out the 6
   months before it's asked again; no day is asked. Only the band is posted (`POST /api/buy/band`). Asked once: an answer when
   it isn't due changes nothing. An under-18 band is asked again 6 calendar months after its answer, and may then go **up one band at
   most** (under-16 reaches 18+ in two askings, a year apart at least); **a lower answer is kept as given** (the design is silent: the
   safer reading of a young player's own word). Each answer restarts the 6 months. Two answers at once store one (guarded on the band
   as read). A due 16-17 band is asked before its next checkout too (every pack tappable then: an 18+ answer would lift the cap).
4. **The $50 month is counted in UTC, turning with the XP day** (the 1st at `XP.dayStartUtcHour`, 08:00 UTC: midnight Pacific
   standard time, 3 am Eastern; 1 am Pacific in summer, and 10 pm the evening before in Hawaii all year), not in the account's time
   zone: no time zone is stored for an account (storing one would be new personal data for the privacy page), and the device's zone is
   the player's to change, which would move the month. Any one turn is off for some zone; this one matches the game's other days.
5. **What counts toward the $50:** every checkout made in the month, by when it was made (so one made on the 30th and paid on the 1st
   is the 30th's month), on its price before tax (the packs show prices before tax; $49.99 fits), **pending ones too** (one paid but
   not yet credited counts; PR 8 marks the unpaid ones expired), less what refunds returned (`refunded_cents`: a refund frees its
   money, user friendly; the hold's count still limits refund cycles). `refunded_cents` is before tax, as the price is (PR 9 stores the
   pre-tax part of Stripe's amount), and each checkout counts at least 0, so a refund recorded with its tax can't free more than the
   price (the review's M2). Never an `expired` checkout or an `unclaimed` payment (refunded
   at once). A dispute's money counts (a chargeback isn't a refund). **Not the checkout still open**: a new Buy replaces it (call 6),
   so a player who backs out of Stripe's page doesn't find every pack greyed by it for 30 minutes; once it's past 30 minutes and
   still pending (paid, maybe, its event late) it counts again, until PR 8 marks it expired or credits it.
6. **One open checkout at a time, for every account** (the design ties it to the cap; one rule for all is simpler, and lets the hold
   and closing deal with one session). "Open" is pending and made less than `checkoutMinutes` (30, Stripe's least expiry) ago. **A new
   Buy replaces the open one, never waits for it:** PR 8 expires each open session at Stripe (`openCheckouts`), then `expireCheckout`,
   then makes the new one. Two Buys at once: the second is refused ("Another checkout is open. Finish it, or try again in a moment.",
   `BUY_LINES.open`, not a greyed line). `expireCheckout` is a new write to `purchases` (its status only; `remaining` stays 0): the
   ledger's static guard counts 3 writes in purchases.ts now.
7. **The checkout's statement holds the rule's stored parts** (signed in, not closed, not held, a band that may buy, the 16-17 cap with
   this pack's price, no checkout open), so a change between the read and the INSERT (another tab's paid checkout, a hold) can't slip
   past; a refusal answers its line. The band's time to ask again and the request's country are checked just before, in code: time
   only moves on, and the request's country is the same. `recordCheckout` now takes the request's country (PR 8 passes
   `request.cf.country`); unknown (no `cf`: not on Cloudflare) is not sold.
8. **Closed** (`closed_at`): no checkout, and every Buy says the design's closed line ("This account is closed. Questions:
   support@hunchess.com"; until PR 9 refuses the sign-in, a closed account can still see a Buy). A payment begun before it closed is
   kept `unclaimed` (no coins; PR 8 refunds it), as a deleted or guest account's is: the credit answers `closed`, and its op's statement
   checks it too. A hold started since doesn't stop a credit (it stops new checkouts, not one paid for). **Sign-in refused: PR 9**
   (table 13, row 9: "chargebacks (message, closing, sign-in refused)"): a TODO in `api.ts` where a ban refuses sign-in.
9. **The hold** ends at `hold_until` itself. Its count (`holdCount`, a statement for PR 9's refund batch and a chargeback's): refund
   count + 1; the 3rd starts 90 days, each after restarts them (never shortening a later end, so a longer hold set by hand stays); in
   the statement, so two at once count two. Built here because the rule is section 3's; nothing calls it yet but tests.
10. **Held taps** (`POST /api/buy/tap`, `held_taps`): counted only while held, at most one a minute an account, in each Worker
    instance's memory as the API's limits are (`RateLimiter`). A durable once-a-minute would need a new column (one more stored
    field) for a count Eric wanted out of curiosity; a burst across instances may count a little more.
11. **The download** already has the band and its time (the account's row). The privacy draft (`docs/drafts/payments/privacy-purchases.md`)
    already lists the band; the privacy page's lines still come with PR 8.

**After the review** (Nov 26, `review/pay-who-buys`; the director's calls on it). Calls 3, 4 and 5 above now say the birth month and
the tax as fixed; the rest:

12. **Buying coins has its own kill switch, `PAUSE_PAYMENTS`** (the design's section 1: "Buying is paused for a moment."): in
    `BuyFacts` (`paused`) and refused right after a guest, so no band is asked meanwhile; no new checkout or band answer, while a
    session already paid is still credited and refunds keep working. **`PAUSE_SHOP` doesn't gate it:** that switch rests spending
    coins (shop items, crates), a different part with its own failures. A Stripe or webhook problem shouldn't close the coin shop, and
    a shop bug shouldn't stop coin sales (coins bought then keep). Each switch rests the narrowest part; the design names its own.
13. **A second account on the same device answers the band afresh** (the review's m4): no device flag. Eric's answers make age
    self-declared, and lies about it are "a good problem to have ... not fight"; the band stays one per account.
14. **A replay of a checkout is answered only while it's pending** (the review's n4): one paid or expired since is refused ("That
    checkout has ended. Try again."), so a retry never sends the player to a session Stripe has ended.
