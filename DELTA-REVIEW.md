# Delta review: Payments PR 6, who may buy (PR #967, `claude/pay-who-buys` at 479ca281)

A read-only delta review for the full lane, of what changed since the first review (`review/pay-who-buys`, `REVIEW.md`, at 1aef38e3):
`git diff 1aef38e3 479ca281` (commits 03b25cf5, e7b81d22, 4b9d00ff), code and docs. The director's calls are taken as given: M1 the
safe fix, M2 pre-tax refunds plus the per-row clamp, m3 the pause now, m4 no device flag.

**Verdict: no blocker, no major, no minor.** Every finding the director chose to fix is fixed, and the fixes add nothing that breaks a
rule. Four nits, none blocking: n1 is a test that fails when run in New Zealand's time zone; n2-n4 are wording and an optional
hardening for PR 8.

## What I ran

- `npm run typecheck`: clean. `npx vitest run packages/core packages/server`: 141 files, 2,073 tests, all pass (the PR's numbers).
- Six mutations, each applied alone and run against `payments.test.ts`, `who-buys.test.ts` and `purchases.test.ts`, then reverted.
  Each one fails exactly one test, its own:

  | Mutation | Fails |
  | --- | --- |
  | The INSERT without `closed_at IS NULL` | "closed meanwhile" |
  | The INSERT letting an `under-16` band through | "the band changed meanwhile" |
  | `heldTap`'s statement without `hold_until > ?` | "a tap counts only if its statement finds the account still held…" |
  | `SPENT` without the clamp (`SUM(cents - refunded_cents)`) | "counts every checkout made this month…" (2,545 counted, not 3,195) |
  | `recorded()` without its pending check | "one open checkout at a time" (the replays) |
  | `buyBandOf` without the `- 1` | "counts the birth month as not yet complete…" |

- The core band test under `TZ=` UTC, America/Los_Angeles, Pacific/Honolulu, Etc/GMT+12, Asia/Tokyo, Pacific/Auckland and
  Pacific/Kiritimati: it fails in the last two (n1).

## Blocker

None.

## Major

None.

## Minor

None.

## Nits

### n1. The band test's dates are at noon UTC, which isn't the same date everywhere: it fails in New Zealand's summer and in Kiribati

`packages/core/test/payments.test.ts:160` (the comment), `:175` and `:178`.

- **The comment says** "Noon UTC: the same day in every time zone the tests may run in". `ageInMonths` reads the local date, and noon UTC
  is the next day east of UTC+12.
- **Scenario:** run the test with `TZ=Pacific/Auckland` (NZDT, UTC+13, December to April) or `TZ=Pacific/Kiritimati` (UTC+14).
  - Dec 31, 2026 at noon UTC is Jan 1, 2027 at 01:00 there, so `buyBandOf(12, 2010, …)` is `16-17`, not `under-16` (`:175`).
  - Jan 31 at noon UTC is Feb 1 there, so `:178` fails the same way.
  - CI runs in UTC, so this only catches someone running the tests locally. The device's own rule is right: it counts by its local date.
- **Fix:** local noon, which is the intended local date in every zone: `new Date(2026, 11, 31, 12)` in place of
  `new Date(Date.UTC(2026, 11, 31, 12))`, for the 7 dates in the band test. Then reword the comment ("local noon: the device counts by
  its own date"). Checked by hand: all 21 tests pass with it under UTC, Etc/GMT+12, Honolulu, Auckland and Kiritimati (reverted).

### n2. `BUY_LINES` says it has every line a player can see, but two of `recordCheckout`'s refusals are still written inline

`packages/core/src/payments.ts:149` (the comment); `packages/server/src/purchases.ts:282-283`.

- "That checkout isn't yours." and "That checkout is for another coin pack." are answered as `recordCheckout`'s `message`, which PR 8
  answers to the player ("a refusal: … answer the line").
- They only come from a server bug, since a session id is Stripe's and recorded once for one account. So nobody sees them in normal
  play.
- **Fix:** either move them into `BUY_LINES`, or narrow the comment to "every line a player sees in normal play".

### n3. The pause is off when its argument is left out (for PR 8)

`packages/server/src/purchases.ts:175, 192, 313` (`paused = false` on `buyStatus`, `answerBand` and `recordCheckout`).

- Every caller today (`api.ts`) passes `isPaused(env, "payments", now)`, and PR 8's item in `payments.md` says to pass it to
  `recordCheckout`.
- **Scenario:** PR 8's Buy route calls `recordCheckout(sql, user, pack, id, now, country)` and forgets the last argument. The
  typecheck accepts it, so the statement's only pause check is gone. The route's own check before making a Stripe session is then the
  only guard.
- **Fix (optional):** when PR 8 adds the caller, make `paused` required on `recordCheckout` (only tests call it now), so the
  typecheck forces it.
- **A related line for PR 8's item:** the pause's "a session already paid is still credited" holds because `creditPurchase` takes no
  pause. The who-buys test of it can't fail by construction. So the guarantee depends on PR 8's webhook and return check never
  consulting `PAUSE_PAYMENTS`. Write that into PR 8's item next to "check `isPaused` … before making a Stripe session".

### n4. The decision note's call 2 leaves "paused" out of who is never asked the band

`docs/decisions/2026-11-26-who-may-buy.md:13-14`.

- Call 2 now refuses "paused" before the band, but its parenthetical still reads "(a guest, held, closed, abroad)".
- `payments.md` already lists it ("a guest, paused, closed, held, abroad").
- **Fix:** add "paused" to the parenthetical.

## Checked and fine, by the brief's points

1. **Each finding is fixed.**
   - **M1, the birth month.** `buyBandOf` is `ageInMonths(...) - 1`. Worked through by hand and pinned by the test:
     - The 1st of the month after: born Nov 2010 is `under-16` on Nov 26, 2026 and `16-17` on Dec 1.
     - The 16th-birthday month: Nov 2010 on Nov 26 is `under-16`, while 16 years 1 month (Oct 2010) is `16-17`.
     - The 18th-birthday month: Nov 2008 is `16-17`, while Oct 2008 is `18+`.
     - The December/January turn: born Dec 2010, `under-16` on Dec 31 and `16-17` on Jan 1, 2027. Born Jan 2011, `under-16` on Jan 1
       and Jan 31 and `16-17` on Feb 1.
     - Only the device calls it: the server never works out a band, it takes the posted one.
     - Reworded in `settings.ts`, `payments.md` and call 3. `accounts.md` never described the counting, so it needed no change; its
       "whole months" line is the age gate's, for 13.
   - **M2, refunds with tax.** `SPENT` is the only place the month's spend is summed.
     - It's used in both `readBuyRow` (so `buyStatus`, core's `leftCents` and `capLine`) and the INSERT's cap.
     - Core sums nothing, and its rules agree with the INSERT: a pack shows the cap's line when `p.cents > max(0, cap - spent)`, and the
       INSERT refuses when `spent + price > cap`. Both hold for any spent ≥ 0.
     - `refunded_cents` is `NOT NULL DEFAULT 0`, so the two-argument `MAX` never sees a NULL.
     - The tests run on real SQLite (`node:sqlite`), and the clamp's test row would count −650 without it.
     - Pinned as before tax in the schema comment, `payments.md`, call 5 and PR 9's item.
     - Left as the director chose: a partial refund recorded with its tax still over-frees by its tax share. The clamp only stops a row
       going below 0, and the pre-tax convention in PR 9 is what covers it. PR 9's item says so.
   - **m1, the statement's guards.** The race tests change the row just before the INSERT or the tap's UPDATE. Three spot-checked
     guards (closed, an `under-16` band, the tap's hold) fail their own test when removed. The PR 5 test's stale comment now points to
     the new race test.
   - **m2.** The sweeper and the `expires_at` margin are in PR 8's item. No code was changed, as the director chose.
   - **m3, the pause.**
     - `PAUSE_PAYMENTS` is wired through core's `pauses.ts`, `BuyFacts.paused`, `BUY_LINES.paused` and `api.ts`.
     - `PAUSE_SHOP`'s gate (`api.ts:620`) matches only the shop's and the locker's paths, never `/api/buy`, as call 12 says.
   - **m4.** No device flag; call 13 records why.
   - **Nits n1-n5 and n7** are fixed as the body says. n6 needed no action.
2. **The fixes introduced nothing new.**
   - **The pause's order.** A guest comes first, then paused, then closed, held, the country and the band.
     - While paused, `askBand` is false, so no age is asked, and `held` is false, so PR 7 posts no taps. A guest still gets the guest
       line.
     - `answerBand` refuses with the pause's line (409) and stores nothing.
   - **A paid session is still credited while paused.** `creditPurchase` reads the row by session id and takes no pause; the test
     credits one.
   - **The app.** `/api/status` lists `payments` when it's on. The app reads the parts by name only (`status.ts` `isPaused`), and
     nothing reads `payments` yet, so nothing a player sees changes.
   - **Module load.** `payments.ts` imports `pauses.ts`, which imports `boss.ts`, and nothing leads back to `payments.ts`, so
     `BUY_LINES.paused` is set when the module loads.
   - **n4's replay refusal can't strand a paid checkout.**
     - `recorded()` is used only by `recordCheckout`. The credit (the webhook and the return check) reads the row itself, so a paid
       session is credited whatever a replay answers.
     - A replay of the same session only comes from PR 8 retrying its own call before the redirect, when the row is still pending.
     - Expiring a session Stripe has completed is refused by Stripe and changes nothing.
     - A pending replay while paused still answers ok. That's not a new checkout, and PR 8 checks the pause before making one.
   - **The status codes.**
     - `POST /api/buy/band`: 403 for another or no Origin, 415 for not JSON, 400 for not a band (`{}`, `"18"`, a bare string; nothing
       stored), 409 when refused (answered already, paused, a guest).
     - `POST /api/buy/tap`: 403 without this site's Origin. Browsers send Origin on every same-origin POST from `fetch`.
   - **`BUY_LINES` against the design.** `paused` matches the design's section 1 word for word: "Buying is paused for a moment."
     (`2026-11-17-payments-design.md:29`).
     - The four lines moved into `BUY_LINES` (`answer`, `answered`, `noPack`, `retry`) match the old inline strings character for
       character.
     - `ended` ("That checkout has ended. Try again.") is new copy, in American English.
3. **The new race tests fail without their guards.** See the mutations table: six guards, each failing only its own test.
4. **The typecheck and the core and server unit tests pass** (see "What I ran").

The docs match the code: `payments.md`, `ops.md`, `DEPLOY.md`, `shop.md` and calls 12-14. The PR body's "Checks changed" matches the
test diff. No changed test guards a rule in `docs/rules/eric.md`.
