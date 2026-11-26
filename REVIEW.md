# Independent review: Payments PR 5, purchases storage (#963)

Reviewed: `git diff origin/main...origin/claude/pay-storage` at head `b9750f26` (base `92320601`), against the design
(`docs/decisions/2026-11-17-payments-design.md` §2, §3, §9, table 13 row 5, "Calls made here") and the PR's decision note
(`docs/decisions/2026-11-26-purchases-storage.md`, its 12 calls). Read-only: nothing pushed to the PR branch.

**Run here:** `npx vitest run packages/core packages/server`: 138 files, 1,993 tests, all pass. `npm run typecheck`: clean. Plus a
throwaway spec (deleted, not pushed) that reproduced each finding below; its key parts are quoted under the findings so they can become
tests.

**Verdict:** no blocker. The money paths hold: no double credit, earned coins go first, no purchase goes below 0, and no existing
caller breaks. There is **one major finding**: deleting an account leaves a key that ties the deleted account's whole ledger back to
the buyer's Stripe payment. The cheapest time to fix it is in this PR, because the ledger is append-only: once PR 8 writes real
`pay:cs_…` legs they can never be re-keyed. The rest are minors and nits, mostly contracts PR 8 and PR 9 must keep.

---

## Major

### M1. After deleting, a kept purchase row links the deleted account's whole ledger back to the buyer

- **Where:** `packages/server/src/ledger.ts:240` (`leg.purchase`: the asset id is the Checkout Session id), `packages/server/src/purchases.ts:153`
  and `:186` (op `pay:<session>`, both legs with `source` = the session id), `ledger.ts:513` (the erase keeps the row with its
  `session_id` and `payment_intent`), `purchases.ts:132-133` and `:174` (`PaidSession.account` = Stripe's `client_reference_id` = the
  ledger id, checked against the row).
- **What happens:** on delete, the ledger rows stay "under the account's random ledger id, which goes, so they name nobody"
  (`account-data.ts:17`; the live privacy page, `Legal.tsx:489`: "The record of changes to your coins and items stays, naming nobody";
  the purchases draft, `docs/drafts/payments/privacy-purchases.md:23,32`: "kept anonymous"). But the kept purchase row holds
  `session_id` and `payment_intent`, which Stripe ties to the buyer's email and card. That same `session_id` is the asset id, the source
  and part of the op id of that account's ledger rows. From those rows you get the ledger id, and from the ledger id every other row
  that account ever wrote: each game's coins, items, crates, with times.
- **Reproduced** (throwaway spec): Ann earns 50 coins from a reward, buys the 520 pack (`cs_test_A`), buys an item, and deletes her account. Then:
  ```sql
  SELECT DISTINCT l2.reason, l2.asset_kind FROM purchases p
  JOIN ledger l  ON l.asset_kind = 'purchase' AND l.asset_id = p.session_id
  JOIN ledger l2 ON l2.account = l.account
  WHERE p.user_id = 'deleted' AND p.payment_intent = 'pi_cs_test_A'
  ```
  This returns her `reward` coins, the `shop` item and spend, the `purchase` credit and the `erase` legs: her whole history,
  reachable from a Stripe payment id.
- **Second path, same root:** the design (§1) sends the ledger id to Stripe as `client_reference_id`, and this PR's credit relies on
  it. So even with no kept row, Stripe's copy of every Checkout Session holds the ledger id. The ledger id has been internal-only
  until now; this sends it outside. PR 9's `refunds.op_id` (the ledger's op id, which by the `opKeys` habit names the ledger id) would
  be a third path once refund rows are kept as `deleted`'s.
- **Suggested fix (this PR, before any real row):**
  1. Give each purchase its own random ledger reference, a new column `purchases.ref` (e.g. 12 random bytes in hex, made by
     `recordCheckout`). Use it as `leg.purchase`'s asset id, as the credit legs' `source`, and in the op id (`pay:<ref>`). HOLDINGS
     then reads `ref AS asset`. Keep `session_id` as the row's key for Stripe's later events.
  2. In `eraseMoves`, after the erase legs, set the kept row's `ref` to NULL (or a fresh random value). The kept row then keeps
     `session_id` and `payment_intent` for tax and disputes but can't be joined to the ledger. The `deleted` rows are outside the daily
     check (`'deleted'` is not a `users` row), so nothing has to agree for them.
  3. For PR 8, needing a design change: don't send the ledger id as `client_reference_id`. Our row already maps session → account,
     so the credit can match on the row alone. If Stripe must carry something, send the purchase's `ref`. Section 1 of the design
     names the ledger id, so this change is the director's call (and Eric's OK, since it touches what the privacy page promises).
  4. Add a test that a deleted buyer's kept purchase and refund rows join to no ledger row (the SQL above returns nothing).
- **Why major and not minor:** it breaks a published privacy promise for every buyer. And the asset ids become permanent the moment
  PR 8 writes the first real credit (the ledger is append-only, guarded by triggers).

## Minor

### m1. A checkout paid after its account was deleted: no coins (right), but the sales record says "pending", with no payment

- **Where:** `purchases.ts:169-174` and `:199-202`. Only the credit writes `payment_intent`, `tax_cents`, `card_country`, `paid_at` and
  `status`, and a refused credit writes none of them.
- **Scenario (reproduced):** Ann starts a checkout (`cs_test_P`, pending), deletes her account (the row becomes `deleted`'s, still
  pending), then completes payment on Stripe's page (the session is open for up to 30 minutes). `creditPurchase` answers `gone`
  (right: no coins). But the kept row reads `{status: "pending", payment_intent: null, paid_at: null, tax_cents: 0}` while Stripe holds
  a real charge. The tax record is wrong, and PR 8 and PR 9 can't find the charge by `payment_intent` to refund it.
- **Fix:** on `gone` and `guest`, record the payment anyway in one guarded UPDATE (`WHERE session_id = ? AND status = 'pending'`): set
  `payment_intent`, `card_country`, `tax_cents` and `paid_at`, plus a status such as `unclaimed` that PR 8 refunds at once. `remaining`
  stays 0. Also note for PR 8: deleting an account should expire its open Checkout Sessions.

### m2. Deleting an account sheds its refund and chargeback counts and its hold

- **Where:** decision note call 8 (`docs/decisions/2026-11-26-purchases-storage.md:36`: "The users columns go with the users row");
  `account-data.ts:364`.
- **Scenario (once PR 6 and PR 9 exist):** a buyer reaches 3 refunds, which starts the 90-day hold (design §3). They delete the
  account and sign up again with the same email or Google account. `refund_count`, `chargebacks` and `hold_until` start from 0, and
  they can buy and refund again. Fair play keeps hashed identities so that "deleting never gets around fair play"
  (`account-data.ts` header). The quiet flag has no equivalent. The same happens in the stale-guest merge race (`accounts.ts:733`,
  `mergeMoves`): the merged row's columns are dropped.
- **Fix:** not in this PR. Record it as an open item in PR 9's brief: keep `refund_count`, `chargebacks` and `hold_until` against the
  hashed identity, as `fairplay_identities` does, and restore them on a new account with that identity. This needs the director's
  call; the design is silent on it.

### m3. Tests: three branches the PR leans on are untested

- **The "unchanged → not retried" branch** (`purchases.ts:264`): no spec reaches it. A throwaway spec showed it works: the item granted
  to the buyer between the read and the write, `buyItem` makes one batch, answers ok, and charges nothing. To add (in purchases.test.ts,
  with its `racing` helper):
  ```ts
  racing(counting, 1, () => applyOp(sql, me, { id: "other:grant", reason: "test", now: T0, legs: [leg.shopItem(ann.id, STORM, T0)] }))
  // expect ok, exactly 1 batch, coinSplit unchanged
  ```
- **The credit's in-statement guards in a race:** "not-pending" is reached only by editing the status beforehand, and "gone" only by
  the JS read. No spec has the account deleted (or the row expired) between `ledgerAccount` and the batch, so nothing shows the SQL
  guard (`purchases.ts:179-185`) doing the refusing. One `racing()` credit spec, with `deleteAccount` landing before the batch,
  covers it.
- **M1's guard:** after the fix, the join above returns nothing (see M1 step 4).
- `ledger.test.ts`'s changed spend (`spendLegs(a.id, { price: 80, draws: [] })` replacing `leg.coins(a.id, -80)`) builds the identical
  leg (`walletLeg("coins", a.id, -80)`). The same assertions run, so the check isn't weakened.

## Nits

### n1. Oldest-first is guarded only on the purchases drawn

- **Where:** `purchases.ts:235-242` (`spendGuard`).
- **Scenario (reproduced by hand, reachable only once PR 9 can give coins back):** OLD (200) is fully spent; NEW holds 420. Between a
  spend's read and its write, OLD gets its 200 back (a withdrawn dispute, design §4). Earned doesn't change, and NEW still holds what
  was read, so the spend applies and draws 350 from NEW. The result is OLD 200, NEW 70: the newer purchase was spent while an older
  one held coins. Earned-first still holds. Oldest-first doesn't, which can shrink the refundable amount, since the newer purchase is
  the one in the window.
- **Fix (before PR 9):** when draws exist, also guard the coins at their read value (`COINS = ?`). With earned guarded equal, that pins
  bought too, so any credit or give-back in between triggers a fresh plan. It costs a rare extra retry.

### n2. `recordCheckout` answers the requested pack, not the stored one

- **Where:** `purchases.ts:124-125`.
- **Reproduced:** `recordCheckout(ann, "coins-200", "cs_X")`, then `recordCheckout(ann, "coins-6000", "cs_X")`. The second answers
  `{ok: true, pack: coins-6000}`, while the row (correctly) keeps coins-200 at $1.99. PR 8 must not trust that answer.
- **Fix:** also read `pack` and answer `packOf(row.pack)`, or refuse when it differs.

### n3. The spend guard binds 3 values per draw; D1 allows 100 a statement

- **Where:** `purchases.ts:240`. The first leg's INSERT binds 19 values plus 3 per draw: 28 at 3 draws, 100 at 27, 103 at 28 (measured
  with `opStatements`).
- **Today:** unreachable. The largest coin price is 400 and the smallest pack is 200 coins, so a spend draws on at most 3 purchases. A
  future large spend (a bundle of everything) would pass every test, since node:sqlite allows 32,766, and fail only on D1.
- **Fix:** pass the draws as one JSON value through `json_each`, as `locker.ts:129` does, or have `spendPlan` refuse more than about
  20 draws, with a test.

### n4. `refundable` reads its total and its list in two statements

- **Where:** `purchases.ts:290-297` (`Promise.all` of `coinState` and a second SELECT).
- **Scenario:** a spend between the two reads can leave a list that doesn't add up to the total. Harmless for a display. PR 9's refund
  must recompute inside its own guarded op anyway.
- **Fix:** derive both from one read (select `pack`, `cents` and `tax_cents` in `coinState`'s statement).

### n5. The static guard counts writes; it can't see which column a write touches

- **Where:** `ledger.test.ts:619` (`purchases.ts: n 2`), `docs/areas/payments.md:67` ("the static guard: only ledger.ts writes
  `remaining`").
- **What:** today the two writes are honest: the pending INSERT without `remaining`, and the credit's status UPDATE inside the op. But
  PR 9 will add more `purchases` writes in purchases.ts (refund statuses). A third write that also sets `remaining` would only bump
  the count to 3 and look routine. The page's claim is stronger than the guard.
- **Fix:** either soften the page ("purchases.ts's writes are listed") or make the guard fail on `remaining` in any `purchases` write
  outside ledger.ts. Weigh this against "fix the cause, not add a checker": rewording the doc is the lighter choice.

### n6. The migration was proven on main's schema, not on the live database

- The fixture comes from `ensureSchema` on node:sqlite, and the workerd replay used a fresh local D1. If the live D1 ever had a
  `purchases` or `refunds` table, `CREATE TABLE IF NOT EXISTS` would skip it, `purchases_intent` would fail on a missing column, and
  `schemaRun` would throw for every request (site-wide). Very unlikely: no code on main ever made those tables, and `/api/e2e/sql` is
  off in production (`e2e-sql.ts`: never in wrangler.jsonc). A one-line check before merge settles it:
  `wrangler d1 execute <db> --remote --command "SELECT name FROM sqlite_master WHERE name LIKE 'purchases%' OR name LIKE 'refunds%'"`
  (expect no rows).

---

## Checked and sound (no finding)

**1. Money**
- **Double credit:** op `pay:<session>` (`purchases.ts:153`) with `ON CONFLICT (op_id, leg) DO NOTHING`. Every other leg and the row's
  UPDATE are gated on this attempt's nonce (`ours`), and the guard needs `status = 'pending' AND remaining = 0`. A retry, a replay or
  three at once: one applies, and the rest answer `before`. Concurrency is covered by the PR's spec. A second session for the same
  buyer is a second, separately priced row and payment. A session we never recorded is `unknown`. Another account's is `mismatch`.
- **Earned first under races:** worked through every interleaving: a grant (earned guarded equal), another spend (coins and
  `remaining` guards), a credit of a new purchase (earned unchanged; it's newer), a refund or take-back (`remaining` or earned
  changes). The only slip is n1, which can't happen until PR 9. A purchase can't go below 0: the guard checks `remaining = was` and
  `take ≤ was`, and the table's CHECK is the last lock (tested).
- **Retry:** at most two batches. "short" maps to "Not enough coins." and a second refusal to "That didn't go through. Try again.",
  with nothing charged either way. An item owned meanwhile still answers ok (proven: m3).
- **`leg.coins` refusing negatives:** every caller in `packages/server/src` passes a positive amount: `grantReward` (clamped
  `Math.max(0, …)`, `accounts.ts:1417`), play coins (`c.play > 0`, `c.bonus > 0`, `play-coins.ts:114,124`) and the credit. Admin and
  test grants (`grantTestItems`) move keys, tokens and crates, never coins. The only coin spend was `buyItem`'s, now `applySpend`. The
  open PR 3 branch (`claude/pay-coin-strip`) adds no coin leg. `eraseMoves`' new `keptAs` argument has one caller. No production path
  now throws.
- **Free shop (`SHOP_FREE`, price 0):** no guard, no coin legs. With coins below 0, the answer is "Not enough coins." as before
  (`price > state.coins`).

**2. The ledger**
- HOLDINGS' `purchase` row: the daily check, `ledgerMismatches`, the backfill (the PR's spec: a change outside the ledger is found and
  evened), the merge (legs out and in, then the rows move) and the erase (legs read `remaining` before the UPDATE zeroes it: the order
  at `ledger.ts:513` is right) all reconcile. `'deleted'` is not a `users` row, so kept rows fall outside the check and the backfill.
  No orphan rows. The static guard is honest today (n5 is about tomorrow).

**3. The schema**
- `CREATE TABLE IF NOT EXISTS` with the CHECK, and `ADD COLUMN … INTEGER NOT NULL DEFAULT 0` (valid on existing rows, no table
  rewrite). New index names don't clash with any of the 93 objects in the fixture. A re-run is a no-op (the version in `meta`).
  Two workers at once: the existing duplicate-column fallback (`accounts.ts:451-462`). The cron runs `ensureSchema` before
  `ledgerCheck` (`index.ts:127`), so the new HOLDINGS row never meets a missing table.

**4. Delete and download**
- Rows kept as `deleted`'s with `remaining` 0 and the ledger closed. The refund comment is erased. The users columns go with the row
  (but see m2). The download has every purchase, pending ones too, every refund with its comment, and the new users columns through
  `SELECT *`, with times made readable (`hold_until`, `buy_band_at`, `closed_at` match `readable`'s pattern). The one gap is the
  ledger link (M1).

**5. Refundable**
- The window is `now − paid_at < 14 × 86,400,000` in both core (`inRefundWindow`) and SQL (`paid_at > now − 14d`): in at
  14 days − 1 ms, out at exactly 14 days, tested on both sides. The cap is `max(0, min(coins, recent))`, tested at coins below the
  recent total and below 0.

**6. Tests**
- Beyond the happy path: the migration on a copy of main's schema (rows unchanged, the shape equal to a fresh database, a re-run),
  three credits at once, every refusal, two race cases plus refused-twice, the CHECK, the refundable boundaries, delete and download,
  the merge and the backfill. Gaps: m3.

---

_Reviewer: an independent helper (read-only). Nothing pushed but this file, on `review/pay-storage`._
