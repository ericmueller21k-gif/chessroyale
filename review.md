# Review: PR #625, the schema run (`ensureSchema`), one round

Reviewed head `9d8161f` (branch `claude/schema-fast`), read-only. The diff `origin/main...origin/claude/schema-fast`, CLAUDE.md
and the brief `notes/briefs/review-schema-fast.md`.

**Verdict: no blockers, no majors. Fine to merge.** Two minor findings below. The second one is how the code behaved before too, but this
PR is a cheap place to fix it.

## How it was checked

- **Server unit tests:** `npx vitest run packages/server`: 84 files, 1129 tests pass, including the new `schema-fast.test.ts`.
  `npm run typecheck` passes.
- **On the real local D1 (workerd, through `wrangler dev`, compatibility date 2025-09-01 as in `wrangler.jsonc`):** a test Worker
  bundled the PR's `accounts.ts` next to **main's** `accounts.ts` (`git archive origin/main packages/server/src`) and ran both
  against separate local D1 databases. Then it compared `sqlite_master` (type, name, table and SQL text of every table, index and
  trigger), the rows and `meta.schema`:

  | Case | Main (one statement at a time) | PR | Same schema / rows |
  |---|---|---|---|
  | Fresh database | 134 round trips | 4 (batches of 80 and 44) | identical; version written |
  | The live database today (made by main's code, main's version) | (n/a) | 4 (80, then 5) | identical to fresh |
  | Same instance, next request | (n/a) | 1 read, then 0 | (n/a) |
  | Older database: `users.rating` (+ its `then`), `users.chat_on`, `items.color2`, `results.xp_rewards`, `ranked_1v1.peak` (+ `then`), `fairplay_matches.deep_queued` (+ its partial index), `users_rating` index dropped; `fairplay_identities` with the pre-Oct 16 key; rows | ran | 6 (80, rekey 4, then 13) | identical schema **and** rows (rating 1720 filled, peak = ladder, identities rekeyed to `(kind, hash, user_id)`, row kept) |
  | Racing instance adds `users.chat_on` just before the columns batch | (n/a) | batch refused (`D1_ERROR: duplicate column name`), one at a time, then `last`: 9 trips | same columns, `rating` filled, index made, version written |

- **D1 behavior the PR relies on, checked on the local D1:** a batch of `ALTER TABLE … ADD COLUMN`, `CREATE INDEX` and a failing
  statement leaves **neither** the column nor the index (DDL rolls back). `ADD COLUMN` then an `UPDATE` and a partial index on that new
  column in **one** batch works: each statement is prepared when it runs, not up front (miniflare's D1 `#txn` prepares inside
  `transactionSync`). Production must behave the same way: the identities rebuild (`IDENTITIES_REKEY`: RENAME, CREATE, INSERT,
  `DROP TABLE fairplay_identities_old`) has run as one batch on the live database since Oct 16, and that `DROP` can't be prepared
  before the RENAME runs. The duplicate-column error's text matches `/duplicate column/i`.
- **Single-flight in real workerd, with `env.DB` as the key the way production calls it:** six requests at once on a fresh database
  made one run (4 round trips in total) and all six got 200. A later request made 0 trips, so the binding is the same object on every
  request and a promise shared across requests resolves for the waiting ones. **A run that never ends** (the starting request's SQL never
  answers; workerd cancels that request as hung): three requests that came 0.3 s later all waited until 5.1 s after the run
  started. Then one ran the schema (4 trips) and all three got 200.

The harness (test Worker, drivers, outputs) was in the scratchpad and is not pushed. It's about 150 lines; I can push it if wanted.

## Findings

### Minor 1: the one-at-a-time fallback splits a column from its `then`, so a failure between them is permanent

`packages/server/src/accounts.ts:414-427`. When the columns batch is refused, each missing column is added on its own (`sql.run(ALTER)`)
and its `then` runs as separate statements (`:425`). The fallback is taken on **any** refusal, not only "duplicate column". If the
`then` fails (a D1 hiccup, the 30 s query limit on a big table, the instance cut short between the two), the column stays and its
`then` never runs again: the next run sees the column, so it's no longer "missing".

- **Failing case:** a future column with a `then` (like `users.rating`'s `UPDATE users SET rating = …` over every account), on a
  database where another instance added some other column first (or any transient refusal of the batch). The fallback adds `rating` (committed), then
  the `UPDATE` times out. From then on every account's `rating` stays NULL (percentile, "Top N%", leaderboards) and nothing repairs it.
  The batched path itself is atomic and fine. Only the fallback has the gap, and main's code had the same gap on every run.
- **Fix (small):** in the fallback, add each column together with its follow-ups as its own batch, so each column is all or nothing:
  `await sql.batch([stmt(ALTER…), ...(c.then ?? []).map((t) => stmt(t))]).catch((e) => { if (!/duplicate column/i.test(String(e))) throw e; })`.
  Optionally, when the refusal isn't "duplicate column", rethrow instead of falling back: the whole batch was rolled back, and the next
  request retries it cleanly. A unit test: `refuse` the first `then` once in the fallback, then check the next run fills it.

### Minor 2: a starting request that's cut short holds up its instance's other requests for up to 5 s

`accounts.ts:358-368`, `SCHEMA_WAIT_MS` (`:338`). This works as designed and is bounded (tested above). But if the request that started the
run is canceled (the player leaves during the first second of a new instance), every request on that instance waits until 5 s after
the run began before one runs it again. The run itself is now short (4 round trips), so the case is rare. If it ever shows up in
playtests: start the run so it outlives its request (`ctx.waitUntil(run)` where a context is at hand), or shorten the wait to about
2 s. A normal run is 4 round trips. No change needed now.

### Trivial

- `docs/areas/accounts.md` / `ops.md` say "4 round trips after a schema change". It's 6 when `fairplay_identities` is rebuilt, and more
  on the two fallbacks. Fine as a headline.
- The columns read's fallback (`accounts.ts:443`) no longer has main's per-table `.catch(() => null)`. If it fails, the run fails and
  the next request retries it, where main would have gone ahead and tried the `ALTER`s blind. That's equal or better. `PRAGMA table_info`
  of a missing table returns no rows, not an error.

## Checked, fine

- **Order, same schema as one at a time.** Batch 1 is `SCHEMA` then `LEDGER_TRIGGERS`, in main's order. It commits before the
  columns are read, so no column is added before its table. The rekey runs after it and before the columns, as on main, and the columns are read again after it.
  Columns, their `then`s, `AFTER_COLUMNS`, `meta` and the version follow in main's order. `users.rating`'s `then` reads `results.ranked` and `held`,
  which come earlier in `COLUMNS`. `AFTER_COLUMNS`' `users_rating` and `fairplay_matches_deep` indexes come after their columns in the same batch.
  The one-read map gives the same "missing" set as main's per-table `PRAGMA`s: no `ALTER` or `then` touches another table's columns.
  `COLUMNS` has no duplicate entries (44 columns; only `rating` and `peak` have a `then`). Verified identical on D1 for fresh, live and older databases (table above).
- **The identities rekey.** `ownerKey === 0` is the same test as main's `ownerColumn && !ownerColumn.pk` (pk `undefined` when the
  column is missing, so no rebuild). The rebuild is idempotent if two runs race it (rename, `CREATE … IF NOT EXISTS`, copy, drop; no
  indexes on that table to lose). Rows kept (D1 check above).
- **The version is written only after everything:** in the same transaction as the columns, their `then`s and `AFTER_COLUMNS`, or, on the
  fallback, in `last` after the columns. Another instance that reads the current version therefore sees every column. A refused
  trigger is logged and the version is still written, as on main (unit test `"refuses the ledger's triggers"`).
- **No request served against a half-made schema on this instance:** `ready` is set only when a run succeeds. Waiters return only on
  that success, fail with the run's failure, or start their own run. A failed run clears `running`, so the next request retries (unit test and
  the code at `:363-368`). There's no `await` between reading `running` and setting it, so two waiters that time out together start one run, not two.
- **The wait is bounded.** Each loop pass waits on a different run (`flight.run !== waited`) until that run's `at + 5 s`. A run is only replaced
  after its deadline. The timer is cleared when the run settles, and the race's handlers stop a late failure from going unhandled.
  `Date.now()` in workerd (it moves only at I/O) still gave the right deadline in the test (5.1 s).
- **Two runs at once** (a slow first run, or two instances) are safe: everything in batch 1 and `AFTER_COLUMNS` is `IF NOT EXISTS` or
  idempotent. A duplicate column refuses the batch atomically and the fallback tolerates it (D1 check above). A `then` runs only where this run
  added the column, as on main.
- **D1's batch semantics:** all or none, with DDL included (checked). A batch-1 refusal goes to `SCHEMA` as one batch, then the triggers one at a time.
  If `SCHEMA` itself is refused, it throws, as main did. A batch that committed but whose answer was lost: the fallback's `ALTER`s hit
  "duplicate column" and `last` is idempotent. Batch sizes are well inside D1's limits (80 statements and 12.5 KB; the longest statement is 417 bytes).
- **`color2`:** in `COLUMNS` (first), so it's added only when `items` lacks it. On the live database it exists and is skipped (no
  "duplicate column" any more). On an older one it's added (D1 check: dropped, then re-added). Nothing else references `LOCKER_MIGRATIONS`.
  The version string changes, so the live database runs the schema once (4 trips) after the deploy. Old-code instances still serving
  during the rollout just re-run their own idempotent schema, as at every schema change. This PR adds no columns.
- **Test fakes:** `memory-db.ts`'s batch now really rolls back on a failing statement (before, the async `run()` turned a
  failure into an ignored rejection inside the transaction). All 1129 server tests still pass with it. `live.test.ts`'s fake batch isn't transactional,
  which is fine for its use.

Checks changed or removed by the PR: none removed. It adds `packages/server/test/schema-fast.test.ts` and changes the two test fakes as above.
