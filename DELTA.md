# Delta review: Payments PR 5's review fixes (#963)

Reviewed: `git diff b9750f26 3a4744f1` on `claude/pay-storage`, the three commits of the fix round (47d8f376, 52db26b7, 3a4744f1).
I checked them against the first review (`REVIEW.md`, beside this file) and the PR body's "Review fixes" table
(`git show 3a4744f1:.pr-body.md`). The branch head is now 45cbdb64, a merge of main that touches no payments file (checked).
Read-only: nothing pushed to the PR branch.

**Run here (at 3a4744f1):**
- `npx vitest run packages/core packages/server`: 138 files, 2,000 tests, all pass.
- `npm run typecheck`: clean.
- Throwaway work, deleted and not pushed: a spec that reproduces D1, ten mutations (each fix taken out in turn, the PR's tests run
  against it), and a trial of D1's suggested fix.

**Verdict:** no blocker.
- Each fix does what its row says, and none breaks a money path:
  - no double credit;
  - no coins for an `unclaimed` payment, and no coins on a replay after one;
  - no credit to any account but the row's;
  - a spend still makes at most two attempts.
- Every new test fails with its fix taken out: all ten mutations were caught.
- **One major (D1):** M1's fix closes every join by id. But a kept row still joins the deleted account's whole ledger by time: its
  `paid_at` equals the credit legs' `created_at`, to the millisecond. The area page now promises "no kept row can be joined to the
  ledger", and that isn't true yet. The fix is two lines, and the code already does the same for results: a kept result keeps only
  the day it was played.
- **Three nits:** contracts for PR 8 and PR 9.

---

## Major

### D1. A kept purchase (or refund) still joins the deleted account's whole ledger, by its exact time

- **Where:**
  - `packages/server/src/ledger.ts:340`: every leg's `created_at` is its op's `now`.
  - `purchases.ts:237-238` with `:177-187`: the credit writes that same `now` as the row's `paid_at`.
  - `ledger.ts:518`: the erase keeps `paid_at` as it is.
  - `purchases.ts:376-378`: `refundsErase` keeps `created_at`. PR 9's refund row and its ledger op will share one `now`, which is how
    the PR's own M1 test writes them.
- **What happens:** the fix took every id off the kept rows. But the kept row still has `paid_at` (in milliseconds) and `coins`. The
  credit's ledger legs have `created_at` equal to that same millisecond and `delta` equal to those coins. The ledger rows keep the old
  ledger id as `account`, so matching one row gives every other row of the account.
- **Reproduced (throwaway spec):**
  - Ann earns 50 coins and buys a 520 pack (`cs_test_A`, credited at T0+1234). Bo also buys a 520 pack (credited at T0+5678).
  - Ann buys an item, then 100 of her coins are refunded (op and row at T0+3000, written as the PR's M1 test writes them).
  - Ann deletes her account. Then:
    ```sql
    SELECT DISTINCT l2.reason, l2.asset_kind FROM purchases p
    JOIN ledger l  ON l.reason = 'purchase' AND l.asset_kind = 'purchase' AND l.created_at = p.paid_at AND l.delta = p.coins
    JOIN ledger l2 ON l2.account = l.account
    WHERE p.payment_intent = 'pi_cs_test_A'
    ```
  - This returns 11 (reason, kind) pairs: her `reward`, `shop`, `purchase`, `refund` and `erase` rows, her whole history. It finds only
    her account: Bo's pack of the same size doesn't match.
  - The same join from the kept refund row (`r.created_at = l.created_at AND r.coins = -l.delta`, `WHERE r.stripe_ref = 're_A1'`)
    gives the same result.
- **Why major:**
  - It's M1's harm through a different column. `payment_intent` still leads to Stripe's buyer (email, card).
  - `docs/areas/payments.md:46-48` now says "So no kept row can be joined to the ledger, and from it to the rest of the account's
    history", and decision note call 13 says the same.
  - The PR's M1 test (`purchases.test.ts:552`) checks only ids, so it passes.
- **Not permanent, unlike M1:**
  - The kept rows aren't append-only, so this can be fixed later. Rows deleted before then can be fixed by a migration.
  - Nothing is sold until PR 8.
  - So it isn't a blocker. It should land before PR 8 sells anything, and this PR is the cheapest place for it.
- **Suggested fix** (tried here: 2 lines, and 1 assertion changes):
  1. In `eraseMoves`: `… ref = NULL, paid_at = paid_at - paid_at % 86400000, user_id = ? …`, which keeps the UTC day (tax needs the
     date of the sale, not the millisecond). In `refundsErase`: `… comment = NULL, created_at = created_at - created_at % 86400000 …`.
     This is what deleting already does to results ("with only the day they were played", `account-data.ts:13-16`).
  2. With that change, every test in purchases, account-data and ledger passes except one assertion: the delete test's
     `paid_at: T0` becomes T0's day. Add the join above, by time, to the M1 test, and expect nothing.
  3. Correct the claim in `payments.md:46-48` and call 13 to "no id, and only the day". `accounts.md:172` ("no key left") is still
     true as written. Record what's left for the director and Eric: the day and the pack size can still single out a buyer on a day
     with only one sale of that pack, as a kept result's day can.
  4. A fuller fix, if wanted, is a retention call for the director and Eric, since it touches the privacy page. Once Stripe can no
     longer open a dispute (up to 120 days after a payment), give the kept row a random `session_id` (as refunds get a random op id)
     and clear `payment_intent`. After that, nothing on the row names the buyer.

## Nits

### D2. PR 8: with no account in the session, our row is now the only thing that binds a payment to an account

- **Where:** `purchases.ts:143-162` (`PaidSession`, no account) and `:111-141` (`recordCheckout`).
- **Checked:** today a payment can't credit anyone but the row's account.
  - `purchases.user_id` is set once, by `recordCheckout`'s INSERT. It's `ON CONFLICT DO NOTHING`, so another account's call gets
    "That checkout isn't yours."
  - Only two writes ever change it:
    - `mergeMoves` moves a guest's rows into its account. A guest can't hold a row, and no path removes an account's email or Google
      id: the only `SET email` is `accounts.ts:790`, and only `WHERE email IS NULL`.
    - `eraseMoves` moves rows to `deleted`. That is never a users row, since user ids are 16-character tokens.
  - The credit's own statement checks `session_id`, `ref`, `user_id`, that the row is pending and that the account is signed in.
- **The contract:** this holds only while PR 8 makes the row on the server, from the id Stripe's create call returned, before the
  checkout URL reaches the browser.
  - The risk: PR 8 might make a missing row later, on the return trip (from the success URL's `session_id`, which the browser
    controls) or in the webhook.
  - If it did, a second account that had the id could claim the payment first.
  - Nothing would refuse that now. The removed `client_reference_id` check would have.
- **Fix:** one line in payments.md's PR 8 open items and in PR 8's brief. `recordCheckout` is called only in the request that creates
  the session. The return trip and the webhook only call `creditPurchase`, which answers `unknown` for a session never recorded.

### D3. PR 9: `maxDraws` is "unreachable" only while at most one purchase is partly spent

- **Where:** `packages/core/src/settings.ts:3979-3983`; `packages/core/src/payments.ts:66` (the throw).
- **Today:** the comment is right. Oldest-first leaves at most one purchase partly spent, so a 400-coin spend draws on 3 purchases
  at most.
- **After PR 9:** partial refunds and take-backs can leave several purchases with small remainders. With more than 20 of them, any
  spend that reaches them throws: a server error, not "Not enough coins." and not a polite refusal. The hold after 3 refunds keeps
  this far off.
- **Fix (PR 9's brief):** refunds that leave remainders keep the number of partly spent purchases small, or the throw becomes a
  refusal. Nothing to change here.

### D4. PR 9: a kept refund row's random op id gives a refund webhook nothing to dedupe on

- **Where:** `purchases.ts:376-378`; `payments.md:108-109` ("a refund made after the account is gone has no ledger op, so its row needs
  an op id of its own (`deleted:<hex>`)").
- **Scenario:**
  - A refund made in Stripe's Dashboard, or a chargeback, on a deleted buyer's purchase arrives by webhook, and Stripe retries
    webhooks.
  - If each attempt inserts a row under a fresh random op id, the retry inserts a second row, and `refunded_cents` is counted twice
    on the sales record.
  - A live account's refunds are deduped by their ledger op id. A kept account's can only be deduped by `stripe_ref`, which isn't
    UNIQUE.
- **Fix (PR 9):** a UNIQUE index on `refunds.stripe_ref` (NULLs don't clash), or `INSERT … WHERE NOT EXISTS (… stripe_ref = ?)`.
  Add one line to the PR 9 open item.

---

## Checked and sound (the brief's six points)

**1. M1: the `ref` everywhere the session id was.**
- It's in every place the session id was:
  - the purchase leg's asset (`ledger.ts:242-249`);
  - the credit's op `pay:<ref>` and both its legs' source (`purchases.ts:226`, `:237`);
  - the spend's legs (`ledger.ts:272`) and its guard (`purchases.ts:302`);
  - HOLDINGS, `ref AS asset WHERE ref IS NOT NULL` (`ledger.ts:419`);
  - the coin read, ordered by `paid_at, ref`.
- No Stripe id is left in any ledger column. Every leg builder was checked, and the PR's M1 test scans op, asset and source for every
  id a kept row holds and finds none. Only the time join (D1) is left.
- The erase writes its legs first (BALANCES still reads `ref`), then nulls `ref` (`ledger.ts:518`). That order is right.
- A kept refund's op id is re-keyed row by row (`randomblob` is evaluated for each row).
- **Re-run:** the schema version is a hash of the schema's text (`accounts.ts:377-382`), so the new column and index run once, and a
  second run is a no-op (the PR's migration test).
- One caveat, covered by n6's pre-merge check: a database that ever ran the pre-fix schema (b9750f26) would have a `purchases` table
  without `ref`, and creating `purchases_ref` would then fail on every request. No such database should exist, since PR branches
  never deploy. n6's check (no `purchases` table on the live D1) rules it out.
- **Merge:** rows keep their refs as they move. The legs are `merge:<guest's ledger id>:purchase:<ref>`, and the test passes with
  `r-gus`.
- **Backfill:** a mismatch is reported by ref and evened (test).
- **Daily check:** the kept rows (`ref` NULL, `deleted`'s) are outside it, as before.
- **UNIQUE `ref`:** NULLs don't clash in SQLite. A repeat `recordCheckout` throws its new id away (the conflict is on `session_id`).

**2. m1 `unclaimed`: guarded, once, never coins.**
- It's one UPDATE, `WHERE session_id = ? AND status = 'pending'`.
- It runs only after the unknown, unpaid and mismatch checks, so a session that's unpaid or at the wrong price is never recorded.
- It never pays coins: no ledger op, and `remaining` stays 0.
- It's reached on four paths:
  - the first read finds the account gone or a guest's;
  - `ledgerAccount` returns null, which happens only when the users row is gone (`ledger.ts:87-99`);
  - the row has no ref (a kept row);
  - the batch is refused and the account is then gone or a guest's.
- A replay after it pays nothing:
  - a kept row answers `gone`, and its write changes nothing;
  - a guest's row answers `guest`, and its write changes nothing;
  - even if that guest could sign in later, the credit's guard (pending) refuses it: `not-pending`.
- A row credited, then deleted, then replayed answers `gone` and stays `paid` (test).
- The static guard still counts 2 writes: `paidRow` is one statement's text, used twice, and neither write sets `remaining`.

**3. n1's coins guard can't starve a spend.**
- `applySpend` tries twice at most (`attempt < 2`, `purchases.ts:322`), whatever the guard refuses.
- The coins guard applies only to a spend that draws on purchases. A spend paid wholly from earned coins is unaffected.
- What it costs: a coin change in the middle of a drawing spend (a game's coins landing) now makes it try once more. A second change
  answers "That didn't go through. Try again.", with nothing charged.

**4. The credit with no account in `PaidSession`.**
- A payment for one user's session can't credit another's account. The reasons are under D2; the only thing to carry forward is PR 8's
  contract.

**5. The removed assertion is moot.**
- `PaidSession` has no `account` field, so there's nothing to mismatch.
- What it guarded, a session credited to the wrong account, is now guarded by the row alone (D2).
- The one case it would also have refused, a guest's row merged into its account, can't arise.

**6. The tests prove the fixes.** Each fix taken out in turn, with the PR's tests run against it (`purchases.test.ts`, and
`payments.test.ts` for G):

| Mutation | Failing tests |
| --- | --- |
| A. The ref kept on delete | 4: the M1 test, the delete test, the m1 test, the race test |
| B. The refund's op id kept | 2: the M1 test, the delete test |
| C. The coins guard dropped (n1) | 1: the give-back test |
| D. The unchanged refusal retried (m3) | 1: the not-retried test (2 batches) |
| E. No unclaimed write | 4: the guest test, the race test, the delete test, the m1 test |
| F. No pack check (n2) | 1: the checkout test |
| F2. The requested pack answered (n2) | 1: the checkout test |
| G. No `maxDraws` throw (n3) | 1: core's draws-cap test |
| H. The refused batch not recorded as unclaimed | 1: the race test |
| I. The first read's `gone` not recorded as unclaimed | 3: the guest test, the delete test, the m1 test |

**The other rows:**
- n2: answers the stored row; another pack is refused.
- n3: the server test's copy of the coin shop's op matches `buyItem`'s (`accounts.ts:1376-1381`).
- n4: one statement. Its window filter (`inRefundWindow`) is the old SQL's `paid_at > now − 14 days`, still only rows with coins left.
  Ties now sort by ref, which only changes the order shown.
- n5: the docs are reworded and no checker was added, as the row says.
- m2 and n6 are left where the row says: payments.md's open items, and the director.
- The PR body's "Checks changed" list matches the diff. The one removed assertion (the account mismatch) is point 5.

---

_Reviewer: an independent helper (delta review, read-only). Nothing pushed but this file, on `review/pay-storage`._
