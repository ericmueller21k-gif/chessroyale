# Who may buy (Nov 26, 2026): the payments build's PR 6

**Eric (Nov 17):** under 16 no buying, 16-17 "$50/month", US and Canada first. **Eric (Nov 18):** "just gray it out ... you can still click it"; the 3rd refund "a 90-day hold on ... purchasing"; the 2nd chargeback closes the account; age self-declared ("a good problem to have ... not fight").

1. **One rule** (`buyAnswer`) answers from the stored account. Each pack carries its own line.
2. **Order of refusals:** guest, paused, closed, held, country, under 16, then the 16-17 cap per pack. Age is asked only when nothing earlier refuses.
3. **Age band** (`under-16`, `16-17`, `18+`) is worked out from a birth month and year. The birth month counts as not yet complete, so a 15-year-old can't buy and a 17-year-old can't skip the cap. It is asked again 6 months after each answer and may go up one band at most. A lower answer is kept as given.
4. **The $50 month** is counted in UTC, turning at `XP.dayStartUtcHour` (08:00 UTC), matching the game's days. No time zone is stored.
5. **Counted:** every checkout made in the month, at its price before tax, pending included, less refunds. Expired and unclaimed checkouts don't count; a chargeback does.
6. **One open checkout at a time**, meaning pending and under `checkoutMinutes` (30). A new Buy replaces it, so backing out doesn't grey every pack for 30 minutes.
7. **The hold:** the 3rd refund starts a 90-day hold on buying (`hold_until`). Each later refund restarts it.
8. **Closed accounts** can't check out. A payment begun before closing is refunded.
9. **`PAUSE_PAYMENTS`** is buying's own kill switch. `PAUSE_SHOP` doesn't gate it, so a Stripe problem doesn't close the coin shop.
10. **A second account on the same device** answers the band afresh. Age is self-declared, so the band stays one per account.

Full design and measurements: PR #967.
