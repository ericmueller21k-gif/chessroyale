# Contact

**DRAFT. Not served, linked or wired. Final after payments PR 9 (refunds).**

## How to reach us

**support@hunchess.com**

Use this address for:

- A refund past 14 days, or a refund that the button won't do.
- A claim that a purchase wasn't authorized (for example by a parent). We can refund every purchase in full at any age.
- A question about a chargeback, or a closed account.
- An appeal about a ban.
- A question about these pages.

## What to include

- [TODO for Eric: what identifies the account. The design doesn't say; the sign-in email is a guess.]
- The date of the purchase, and its amount if you have it. Stripe's payment reference is helpful, if you can see it in your receipt.
- For a claim: a short note on what happened. You don't need to give more personal details than that.
- For a closed account: the date it was closed, if you have it. [TODO for Eric: the rest of this list. The design doesn't say what we need from a player.]

## What happens next

[TODO for Eric: reply time (in days). The design doesn't say. Also who answers: an admin on a schedule, or a person on call.]

## Please don't include

- Your card number, or your bank login. We don't need them, and we'll never ask for them.

## Contact by other routes

[TODO for Eric: whether the contact page shows a second route (for example a form), or only the email address.]

## Setup before live

support@hunchess.com needs Email Routing set up in Cloudflare before live, and the `/contact` page needs its Cloudflare Access bypass (design §12, items 3). Both are Eric's to do.

---

## Sources

- §3 "Refunds" (support@hunchess.com for refunds past 14 days and for claims; the parent/unauthorized claims email goes to support@).
- §4 "What 'closed' means" (the sign-in refusal message: "Questions: support@hunchess.com").
- §12 "Before live" item 3 (Cloudflare Access bypass for `/contact`, Email Routing for support@).
- "Refund everything" (claims, any age, counted once) is in §3 "Parent or unauthorized claims".
- The FAQ already gives support@hunchess.com for appeals (`packages/app/src/faq/content.ts`, the fair-play answer).

## TODO list (for Eric)

- What a player should include (beyond the sign-in email and the date).
- The reply time.
- Who answers support.
- Whether there is a second contact route.
