# Review: Payments PR 6, who may buy (PR #967, `claude/pay-who-buys` at 1aef38e3)

An independent, read-only review for the full lane, of `git diff origin/main...origin/claude/pay-who-buys`. I read it against the
design (`docs/decisions/2026-11-17-payments-design.md` sections 3, 4, 5, 9, table 13 row 6 and its calls), Eric's answers
(`notes/briefs/payments-answers.md`), the PR's decision note and `docs/areas/payments.md`.

**Verdict:** the structure is sound: one pure rule in core, the stored parts repeated in the checkout's single INSERT, one open
checkout enforced in that same statement, and the band guarded on its read value. **Two majors should be fixed before merging.** M1 is
one line plus two test lines. M2 is a per-row clamp plus one doc line. m1's tests belong in this PR (full lane). m2 and m3 can be open
items for PRs 7 and 8 if the director prefers, as long as they're written into `payments.md`. m4 is the director's call.

## What I ran

- `npm run typecheck`: clean. `npx vitest run packages/core packages/server`: 141 files, 2,068 tests, all pass (the PR's numbers).
- Throwaway probes (`packages/server/test/zz-review-probe.test.ts`, not pushed), each run against the PR head:
  - P1: a refund recorded with its tax. Confirms M2.
  - P2: an abandoned checkout with no expired event. Confirms m2.
  - P3: the birth month. Confirms M1.
  - P4: replaying an expired session. Confirms n4.
  - P5: the band lowered between the read and the INSERT. The statement refuses it: fine, but untested (m1).
  - P6: a checkout still open across the month's turn. Fine.
- Mutations on `purchases.ts`, each run alone against `who-buys.test.ts` and `purchases.test.ts`, then reverted:
  - Caught: dropping the band answer's guard (`buy_band IS ?4 AND buy_band_at IS ?5`) fails the two-tabs test.
  - Not caught: dropping the INSERT's `closed_at IS NULL`, its `(${SIGNED_IN})`, or its band check (letting a NULL or `under-16` band
    through), and dropping `heldTap`'s statement guards. All 40 tests still pass (m1).

## Major

### M1. The birth month counts as already reached, so a truthful 15-year-old can buy and a truthful 17-year-old gets no cap

`packages/core/src/payments.ts:98` (`buyBandOf`, through `ageInMonths`). The behavior is pinned by `packages/core/test/payments.test.ts:163,165`.

- **Scenario:** a player born Nov 30, 2010 is 15 from Nov 1 to Nov 29, 2026. They answer the question truthfully, "November 2010".
  `ageInMonths` gives 192, which is 16 × 12, so the band is `16-17` and they can check out up to $50 that month.
- **The same at 18:** born Nov 30, 2008, the band is `18+` on Nov 1, so there's no cap while they're 17.
- **Why it matters:** the age gate accepted this rounding for 13 (its decision of Oct 16, call 2: "passes up to a few weeks early").
  But "under 16 can't buy" (section 9, FTC v. HoYoverse) is the rule this PR exists for. Here the error comes from **truthful**
  answers, not lies, which is the one case a self-declared rule must get right.
- **Fix (simplest, on the safe side):** treat the birth month as not yet complete:
  `const months = ageInMonths(month, year, today) - 1;`
  - 16 then starts on the 1st of the month after the 16th-birthday month. Someone born on the 1st waits one month more.
  - Change the two pinned lines ("16 exactly" → `under-16`, "18 exactly" → `16-17`) and add "16 years 1 month" → `16-17`.
  - List them under "Checks changed", and reword "whole months, as the age gate counts" in `payments.md` and the decision note.
- **The cost and an alternative:** with the safe fix, an honest player who answers in their birthday month waits out the 6 months
  before the question comes back. If the director wants it exact instead, the device can ask the day only when the month given is
  the 16th or 18th birthday month. The day still never leaves the device: only the band is posted.

### M2. The month's spend can go below zero: a refund recorded with its tax frees more than the purchase (latent until PR 9)

`packages/server/src/purchases.ts:136` (`SPENT`: `SUM(cents - refunded_cents)`).

- **The gap:** `cents` is before tax. Nothing pins whether `refunded_cents` is: `PURCHASES_SCHEMA` only says "what refunds have
  returned". Stripe's `amount_refunded`, and the amount of a refund made in its Dashboard (`charge.refunded`, which section 3 says
  counts), both include tax.
- **Scenario (probe P1):**
  1. A 16-17 buyer pays for $49.99 plus 13% HST, $56.49 in all, and it's refunded in full.
  2. PR 9 records `refunded_cents` as what Stripe returned: 5649.
  3. The row then adds −650 to the month: `leftCents` is 5650, and every pack says "Monthly limit for players under 18: $56.50 left."
  4. The checkout statement lets $49.99 and then $4.99 through that month: $54.98 kept, over the $50.
- **Partial refunds too:** one with tax over-frees by its tax share.
- **Fix:**
  - Pin `refunded_cents` as before tax, in the schema comment and in `payments.md`. PR 9 then records the pre-tax part of Stripe's
    amount; the tax refunded in proportion stays out.
  - Clamp per row so no slip in that convention can free more than the row's own price:
    `SUM(MAX(cents - refunded_cents, 0))` (SQLite's two-argument `MAX`).
  - Add a test row with tax to "counts every checkout made this month".

## Minor

### m1. Three of the checkout statement's guards have no test, and one PR 5 test quietly stopped testing its statement

`packages/server/src/purchases.ts:310-311`; `packages/server/test/purchases.test.ts:179`.

- **Mutations:** dropping `closed_at IS NULL`, dropping `(${SIGNED_IN})`, or letting a NULL or `under-16` band through the INSERT:
  each one alone leaves all 40 tests passing. The PR body is accurate about the guards it did test (the cap, the hold, the open
  check, the credit's closed check), but the brief asks for every rule at its boundaries.
- **The PR 5 test:** "A stale signed-in view of a guest: the statement's own check refuses it" now passes on the **read**:
  `refusal()` reads the stored row and refuses the guest before the INSERT runs. So the INSERT's signed-in guard lost its only test,
  while the PR lists the file's changes as "setup only (no assertion changed)".
- **`heldTap`:** its statement guards (hold, closed, signed in) can be dropped too. The read covers the hold, but a closed account
  that's also held is never tested.
- **Fix:** race tests in the file's existing style (a `racing` Sql that changes the row just before the INSERT):
  - closed between the read and the INSERT;
  - the account deleted between them (the `EXISTS`);
  - the band lowered to `under-16` (probe P5 already passes);
  - a closed and held account's tap not counted.

  Then fix the stale comment and list the change under "Checks changed".

### m2. A checkout whose `checkout.session.expired` event never arrives greys a 16-17 buyer's month until it turns

`packages/server/src/purchases.ts:136-137` (a pending row past the window counts); `docs/areas/payments.md:163-167`.

- **Scenario (probe P2):**
  1. A 16-17 buyer opens a $49.99 checkout and closes the tab.
  2. The expired event is lost: the webhook is misconfigured in test mode, the Access bypass is missing, or the endpoint is down past
     Stripe's retries.
  3. The row stays `pending` and counts, so every pack says "…$0.01 left." until the 1st.
- **The gap:** nothing ever looks at a pending row again once it's past 30 minutes (`openCheckouts` only looks inside the window).
  Counting it is right: it may have been paid with its event late. It just needs a sweeper.
- **Fix (an open item for PR 8):** at a Buy, and in the 15-minute cron, ask Stripe about pending rows older than `checkoutMinutes`:
  expired → `expireCheckout`; complete and paid → credit it.
- **A related PR 8 note:** Stripe refuses an `expires_at` under 30 minutes by its own clock, so PR 8 may want a margin. If it adds one,
  raise `checkoutMinutes` to the value it sends. Never let a session outlive what "open" assumes here.
- Write both into `payments.md`'s PR 8 item.

### m3. The one answer PR 7 renders has no paused state

`packages/core/src/payments.ts:145` (`BUY_LINES`); `packages/server/src/api.ts:650`.

- **The gap:** the design's `PAUSE_PAYMENTS` line, "Buying is paused for a moment." (section 1), isn't in `BUY_LINES`, and `BuyFacts`
  has no pause. So PR 8 must change `BuyStatus` and the refusal order after PR 7 has already been built against them.
- **Kill switches:** the new routes check none. `PAUSE_SHOP` covers shop items and crates (`ops.md`, `DEPLOY.md`), so not consulting
  it is defensible, but neither the code nor the decision note says so.
- **Fix:** add `paused` to `BuyFacts` and `BUY_LINES.paused`, refused right after a guest, from `isPaused(env, "payments")`
  (`kill-switches.ts` gains `payments`). Failing that, at least write into `payments.md`'s PR 7 and PR 8 items that the answer gains
  `paused`. Either way, record the `PAUSE_SHOP` call in the decision note.

### m4. A second account on the same phone answers the band afresh (the director's call)

`packages/server/src/purchases.ts:177` (`answerBand`: one band per account, nothing on the device).

- **Scenario:** a truthful 15-year-old answers `under-16` and sees every pack greyed. They sign out, sign in with another email or
  Google account (a new account), and answer `18+`.
- **What holds:** within one account, "asked once" holds, and the tests show it. But a second account is the cheapest way round the
  brief's own example ("a 15-year-old answering 18 the second time").
- **The precedent:** the age gate solved the same problem for 13 by remembering "too young" on the device: an HttpOnly
  `hc_age=under` cookie plus a local flag, each restoring the other (the Oct 16 decision, call 4).
- **Options:** Eric's "a good problem to have ... not fight" may already cover this. If it doesn't, the same pattern costs a few
  lines and stores nothing new on the server: an `hc_buy=under-16` cookie set by `answerBand`, and on that device a first answer above
  `under-16` stored as `under-16`. Record the call either way.

## Nits

- **n1. "Midnight Pacific" is true only in winter.**
  - Where: `packages/core/src/payments.ts:129`, `settings.ts:3993`, `payments.md:42`, the decision note's call 4.
  - From March to November, 08:00 UTC is 1 am Pacific and 4 am Eastern. In Hawaii it's 10 pm the evening before all year, so
    "overnight where packs are sold" doesn't hold there.
  - The choice itself is fine (any single turn is off for some zone). Fix the wording: "midnight Pacific standard time (1 am in
    summer; 10 pm the evening before in Hawaii)".
- **n2. Copy outside `BUY_LINES`.**
  - Strings: "You've answered this already." and "Answer the question." (`purchases.ts:184,188,197`), "That coin pack isn't sold."
    (`payments.ts:237` and again in `recordCheckout`), "That didn't go through. Try again." (`purchases.ts:326`).
  - PR 7 will show the first two (the band answer's 409). Move the ones a player can see into `BUY_LINES`.
- **n3. Status codes.** `POST /api/buy/band` answers 409 for a malformed band (`api.ts:658`). Use 400 for bad input, and keep 409 for
  already answered or refused.
- **n4. `recordCheckout` answers ok for a session that's already expired** (`purchases.ts:299`, `recorded()` first; probe P4).
  - Risk: PR 8's idempotent retry could send the player to a session Stripe has already ended.
  - Fix: refuse when the stored row isn't `pending`, or note it for PR 8.
- **n5. Origin check.** `POST /api/buy/tap` has no Origin check, unlike `/api/buy/band` (`api.ts:661`). The session cookie's
  `SameSite=Lax` already keeps cross-site posts without it, so this is consistency only.
- **n6. Held taps are limited per Worker instance** (`purchases.ts:202`), as call 10 says: "at most once a minute" holds per instance.
  That's fine for a curiosity count. No action.
- **n7. Two `purchases.test.ts` timing changes clear the open window by one second.**
  - Where: `:256`. B's checkout is at T0 − 31 min and A's at T0 − 59 s, so they're 30 min 1 s apart. `:397` has the same pattern.
  - A change to the `buy` helper's 60 s offset would fail them confusingly.
  - Fix: use T0 − 2 h, or `expireCheckout` B first.

## Checked and fine, by focus

1. **Age and band.**
   - The refusal order is right (guest, closed, held, country, then the band and under 16), and no band is asked of a guest, closed,
     held or abroad account.
   - The band is asked once: a 409 when it isn't due. It's due again at exactly 6 months, goes up one band at most, a lower answer is
     kept, and the guard on band and time holds (mutation caught).
   - The INSERT refuses NULL and `under-16` bands (P5, though untested: m1).
   - The cap is `<=` in both places: core's `p.cents > left` and the INSERT's `SPENT + price <= cap`.
   - `expired` and `unclaimed` are excluded; `disputed` counts.
   - The month is by `created_at`: a checkout open across the turn counts in the old month (P6).
   - Two tabs can't race past the cap: the open check and the cap are in one INSERT, and D1 runs each statement atomically.
2. **One open checkout.** It's held by one `INSERT … WHERE NOT EXISTS`. The window is by time, so it never blocks past 30 minutes.
   `recorded()` runs first, so a replay of the account's own session isn't refused as "open".
3. **Holds and closed accounts.**
   - A hold ends at `hold_until` itself in all four places: core's `heldAt`, the INSERT's `hold_until <= now`, and `heldTap`'s read
     and statement.
   - `holdCount` reads the old `refund_count` inside `SET` (SQLite uses pre-update values there), three at once give one hold, and
     `MAX` keeps a longer end.
   - Closed is refused in `buyAnswer`, the INSERT, `answerBand`, `heldTap`'s statement, and the credit's read and op statement.
   - `held_taps`: the limiter is hit only while held.
4. **Guests and auth.** All three routes come after the 401 for no session, and all are keyed on `current.id`. A guest gets the guest
   line from GET (useful to PR 7) and can't write anything. The band POST requires this site's Origin and JSON. No other account's
   state is read.
5. **Lines.** The five design lines are word for word (core's test pins them), and `capLine` formats dollars as the packs do.
6. **Stored data.**
   - No schema change: every column is PR 5's, and nothing new is added for the live D1.
   - Writes:
     - `users.buy_band` and `buy_band_at`;
     - `users.held_taps`;
     - `holdCount`'s `refund_count` and `hold_until` (unused until PR 9);
     - `purchases.status` from pending to `expired`.
   - The ledger guard's 2 → 3 is honest. No `refunds` rows are written.
7. **Tests.** The rules' boundaries are covered (to the cent, to the millisecond, the 6 months, the turn of the year), apart from m1's
   gaps. The changed checks are listed, except m1's PR 5 test that moved from the statement to the read.
