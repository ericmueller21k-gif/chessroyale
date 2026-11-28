# The daily ledger check: 4 accounts disagree (findings, Nov 28)

## The answer

- **Not new, and not a code path.** The check has said "4 accounts' balances and ledger disagree" on **every run since its first,
  Nov 7 09:00 UTC: 22 runs in a row**, the same 4 accounts each time (`ops_errors`, kind `cron`, one row a day, 22 builds). ops:report
  showed only the last 24 hours, so it looked like Nov 27 and 28.
- **Every difference is a row from before the ledger recorded it** (Oct 4 to Nov 6 07:04 UTC; the ledger's first row is Nov 6 23:16).
  The backfill that records those rows (ledger II, `backfillLedger`, admin `POST /api/admin/ledger/backfill`) was **never run**:
  the live ledger holds **0 `backfill` legs**. Eric shelved it on Nov 7 ("will pick that up another day"; STATUS: "don't list it as
  waiting"), and nothing reminded anyone since.
- **Why nobody saw it for three weeks:** one error a day never meets ops:report's "Needs attention" (errors up = 20 an hour, or 5 and
  3 times the hour before), and Discord alerts are off (no `ALERT_WEBHOOK`). The details go only to the Workers logs.
- **Every balance change since the ledger began went through it.** On the live D1: 280 of 284 accounts agree; all 306 items made since
  Nov 6 23:16 have their leg; on the one active account of the four, every token drop since (14) and every claw play (13) has its leg,
  and its 24 items since have theirs. The static guard is green.

## How I looked (reads only)

The ops view has only the error's count. I ran the check's own difference queries (`differences` in ledger.ts, each table's two) as
plain SELECTs through `npx wrangler d1 execute hunchess --remote --json --command "<SELECT>"`, from a wrapper that refuses anything
but a single SELECT. Every answer: `changed_db: false`, `rows_written: 0`. No token or secret printed; no email or name read.

## The 4 accounts (user id's first 8 characters; none is a test account or a resident)

| Account | What it is | Created / last seen | Differs (balance minus ledger) | Those rows made |
| --- | --- | --- | --- | --- |
| `q7Kz5yGV` | signed in, **an admin** (its ledger has `admin grant` legs: `/api/locker/grant` is admin-only), active daily | Oct 4 / Nov 28 | 74 items +1 each; shop `hat-party`, `king-emerald`, `king-hellfire`, `king-void` +1 each; tokens `tiger` +4, `hollow` +3, `smudgy` +1; crate keys +1 | items Oct 5 to Nov 6 07:04; shop items Oct 5 to Oct 20; the `smudgy` token: a drop on Nov 4 (in `boss_token_drops`); the other tokens and the key: no record left (drops are kept 30 days) |
| `qHMb-s27` | signed in, dormant, 1 result | Oct 8 / Oct 31 | 11 items +1 each | Oct 9 to Oct 25 |
| `48DZObEK` | signed in, dormant | Oct 4 / Oct 8 | 10 items +1 each; shop `hat-party` +1 | Oct 8 |
| `K5xvGxzb` | a guest (never signed in), one minute of use | Oct 5 / Oct 5 | 80 items +1 each | Oct 5, within one minute (a crate test, by the look of it) |

The three dormant accounts have **no ledger id and no ledger row at all**: nothing of theirs has changed since the ledger began. In
all: 184 differences (items 175, shop items 5, tokens 3 summing 8, keys 1), each positive: the balance holds a row the ledger never
recorded. Who the three dormant ones belong to I can't say without reading emails, which I didn't (the site was behind Zero Trust
then, so they're Eric's or people he let in).

## The suspects, each checked

- **Admin and test grants:** through the ledger (`grantTestItems`, reason `admin grant`: 5 key and 30 token legs on the admin account).
- **An admin floor:** none exists ("floor" in the server is the Battle Tower's).
- **Crate tests and free opens:** `openCrate` and `openBossCrate` go through the ledger (part II); all 306 items since have legs.
- **Refunds and purchases:** none on the live D1 (0 purchases, 0 refunds).
- **Migrations:** every wallet column was added `DEFAULT 0` with no filling `UPDATE`; `seriesFromWallet` moves crates by an op.
- **A guest's merge and erasing:** ledger.ts `mergeMoves` and `eraseMoves` write a leg for every balance they move or close.
- **The static guard** (`ledger.test.ts`): green, but it never watched `series_crates` (a balance since Nov 9). Nothing writes it
  outside ledger.ts today; now the guard would catch one.

## The fix in code (this branch)

Fix the silence, not add a check (Eric's Nov 13 rule): the check existed and worked; its failures went nowhere anyone reads.
- **The health view** (`health.ts`) has `cron`: each scheduled job that failed in the last 24 hours (kind `cron`, its job), how often,
  on how many of the last 7 UTC days and the earliest of them, kept apart from the top 10 errors, which a busy day would push a
  once-a-day failure off.
- **ops:report** puts each under "Needs attention": `The scheduled job "ledger" failed once in the last 24 hours and on 7 of the
  last 7 days (the earliest of them 2026-11-22 09:00 UTC), message [1]. Which accounts and assets: docs/areas/shop.md, "The daily ledger check".`
  Plus a line `Scheduled jobs: none failed in the last 24 hours`. (In the last week the only server cron errors were this one.)
- **The test that fails before:** `health.test.ts`, "the schedule's failed jobs …": a week of daily ledger failures under a busy hour
  of 13 other kinds; on main: `expected undefined to deeply equal [ { job: 'ledger', … } ]`; now passes. It also holds the count to 7
  UTC days: a first try of mine, windowed by the hour, said "8 of the last 7" for a run a week ago in the same clock hour.
- **The guard** watches `series_crates` too (checked: a stray `UPDATE series_crates` outside ledger.ts now fails it).

## The one-off repair (proposed, not run: the director runs it after review)

**What:** the ledger's own backfill, once. It writes one `backfill` leg per difference (keyed `backfill:v1:<ledger id>:<kind>:<asset>`,
so a second run adds nothing), and a ledger id for each of the 3 accounts that have none. It changes **no balance**: the four keep
exactly what they hold, and their history starts with "held before the ledger". It is also the step Eric shelved on Nov 7, so the
director may want his OK first (it reverses no rule of his; it's the pick-up he postponed).

**Expected, exactly** (read on Nov 28 ~11:00 UTC): 184 legs, deltas summing 189 (`item` 175 legs, `shop` 5, `token` 3 legs = 8, `keys`
1), 3 new ledger ids, 4 accounts. Anything else means a balance changed outside the ledger since: stop and look.

**Option A (the director, no Eric):** the code's own statements as a file, run through wrangler.
1. Save at the repo root, untracked, as `backfill-sql.ts`:
   ```ts
   // The ledger's own backfill (ledger.ts backfillLedger) as SQL for `wrangler d1 execute --file`: its statements captured, not run,
   // the two parameters (the time, the attempt's nonce) written in. Writes nothing itself.
   import { backfillLedger } from "./packages/server/src/ledger.ts";
   import type { Sql, Stmt } from "./packages/server/src/accounts.ts";
   const now = Date.now();
   const captured: Stmt[] = [];
   const capture: Sql = { first: async () => ({ n: 0 }) as never, all: async () => [], run: async () => {}, batch: async (s) => void captured.push(...s) };
   await backfillLedger(capture, now);
   const literal = (v: unknown) => {
     if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
     if (typeof v === "string" && /^[0-9a-f]{1,64}$/.test(v)) return `'${v}'`;
     throw new Error(`unexpected parameter ${JSON.stringify(v)}`);
   };
   console.log(captured.map((s) => {
     const q = s.params.reduceRight<string>((q, v, i) => q.replaceAll(`?${i + 1}`, literal(v)), s.sql);
     if (q.includes("?")) throw new Error(`a parameter left in: ${q.slice(0, 80)}`);
     return `${q.replace(/\s+/g, " ").trim()};`;
   }).join("\n"));
   ```
2. `npx tsx backfill-sql.ts > /tmp/backfill.sql` (45 statements: 15 ledger-id inserts, then 30 leg inserts), read it, delete `backfill-sql.ts`.
3. `npx wrangler d1 execute hunchess --remote --file /tmp/backfill.sql`. If it stops partway, run it again: each statement works out
   its own difference when it runs and its keys are fixed, so a rerun only finishes what's missing (an op landing meanwhile writes its
   balance and legs in one transaction, so no difference changes under it).
4. Check (reads only): `SELECT asset_kind, COUNT(*) AS legs, SUM(delta) AS sum FROM ledger WHERE reason = 'backfill' GROUP BY asset_kind`
   gives item 175/175, keys 1/1, shop 5/5, token 3/8. The next 09:00 check logs nothing, and from then ops:report says "Scheduled jobs:
   none failed in the last 24 hours" (yesterday's failure shows until 24 hours have passed).

Tried here on SQLite (not on the live D1): on a copy of the live situation (pre-ledger rows on a signed-in account and a guest with no
ledger id, ledgered ops on top), the file wrote the same 12 legs as `backfillLedger` on a twin, a second run added none, and
`ledgerCheck` then found no account.

**Option B (Eric, one line):** signed in as an admin on hunchess.com, in the browser's console:
`await (await fetch("/api/admin/ledger/backfill", { method: "POST" })).json()`. Expected: `{"legs":184,"disagree":0}`. It's the same
tested code, but it needs Eric.

**Not proposed:** deleting the one-minute guest `K5xvGxzb` (80 items, never signed in, Oct 5). Possible through the normal erase (it
closes every balance in the ledger), but it's Eric's call and the backfill makes it unnecessary.

## Changed checks (old → new)

- `ledger.test.ts`, the static guard's `BALANCE_TABLES`: seven tables → the same plus `series_crates` (stricter).
- `health.test.ts`: a new case, "the schedule's failed jobs …". Nothing else changed or removed. No check that guards a rule in
  `docs/rules/eric.md` was touched.
