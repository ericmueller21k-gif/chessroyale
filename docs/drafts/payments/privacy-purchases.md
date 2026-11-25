# Privacy: purchases

**DRAFT. Not served, linked or wired. Final after payments PR 9 (refunds).**

This page covers what we keep about coin purchases. It adds to the main privacy page.

## What we keep about a purchase

When you buy a coin pack, we keep:

- **Purchase record:** the pack, the coins, the price and any tax, the date, and whether the payment went through, was refunded, or was disputed.
- **Payment details from Stripe:** a payment reference from Stripe, and the country of your card. We don't store your card number. Stripe handles payment details.
- **Refund records:** each refund, its amount, its date, and any message you wrote in the optional box.
- **Dispute records:** each chargeback, its date and whether it's open or closed.
- **Hold and account status:** how many refunds and chargebacks you have, whether buying is paused for you and until when, and whether your account is closed.
- **Your age band:** the band you chose (under 16, 16-17, or 18 and up). We don't store your birth date.

We don't keep the card number, your full card details, or anything Stripe doesn't tell us.

## How long we keep it

- **While your account is open,** purchase and refund records stay with your account.
- **When you delete your account,** we keep purchase and refund records for tax reasons. They're rewritten so they no longer show your name or account. [TODO for Eric: how long tax records are kept, in years. The design doesn't say.]
- **When an account is closed** (after repeated chargebacks), its data is kept for **90 days**, so we can reopen it if we made a mistake. After 90 days it's erased, the same way as when you delete an account. The purchase, refund and dispute records stay, with no name attached, for tax records.

## Download your data

"Download my data" includes your purchases and refunds, in the same file as the rest of your account data. [TODO for Eric: where the button sits and the file's layout; the design says only "Download my data".]

## Delete your data

When you delete your account, we offer back your refundable coins first. If you accept, the refund goes through. Then your account is deleted, and your purchase and refund records are kept anonymous, as above.

## Who can see it

- Admins who look after payments and fair play can see your purchases, refunds and chargebacks, to handle refunds, disputes and holds. Each admin action is logged with the admin's name.
- Stripe sees the payment, as it does for any card payment.
- We don't sell this information. [TODO for Eric: confirm this statement and whether any other service receives it.]

## Questions

Email support@hunchess.com.

---

## Sources

- §2 "Storage" (the `purchases` and `refunds` tables: session, user, pack, coins, remaining, cents, tax, payment intent, card country, status, refunded cents, dates; the `refunds` fields: kind, cents, coins, Stripe reference, status, comment of 500 characters at most).
- §2 "Storage" (`users` columns `buy_band`, `buy_band_at`, `refund_count`, `hold_until`, `chargebacks`, `closed_at`, `closed_reason`, `held_taps`).
- §2 "Delete account" (refundable amount offered back first; purchase and refund rows stay, rewritten to `deleted`, kept for tax; "Download my data" includes them; the privacy page gets its "Purchases" lines).
- §4 "What 'closed' means" (data kept 90 days for Reopen; then erased as delete account erases it; purchase, refund and dispute rows stay, anonymous, for tax records; the privacy page says so).
- §5 "Admin: a Payments tab" (admins only, actions logged with the admin).
- §9 "Who may buy" (the age band answered on the device, only the band posted; under-18 asked again after 6 months).
- §1 "Stripe" (Hosted Checkout; the card never reaches our pages).

## TODO list (for Eric)

- How long tax records are kept (years) and how the rule is stated.
- Whether we say that we don't sell purchase data, and confirm no other service receives it.
- Whether the age band is listed on the privacy page, and what it says about the under-18 check.
- The privacy page's "Purchases" lines are still to be written from this draft.
- The exact download file layout (not in the design).
