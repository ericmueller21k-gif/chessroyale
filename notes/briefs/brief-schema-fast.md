# The first load after a schema-changing deploy sits on the splash for seconds (Eric, Nov 10)

Eric, right after #618 deployed (it changed the schema): a white page (likely Cloudflare Access), then "HunChess" centered for about 8 s
before anything loaded. The splash (`App.tsx` ~:1952: `config === null || (config.accounts && !profile)`) waits for `/api/auth/config`
and `/api/me` with no time limit. After a schema change, `ensureSchema` (`packages/server/src/accounts.ts` ~:343) runs ~96 statements
one at a time (~4 s at ~40 ms a D1 round trip), and **every request in flight** on a new instance runs it too (`ready` is set only at
the end), so the first page's 4-6 API requests each run the whole thing, on one database at once.

## Fix
1. **Single-flight per instance:** the first caller runs it; every other caller awaits the same promise (a failure clears it so the
   next request retries).
2. **Fewer round trips:** send the idempotent statements (`CREATE TABLE/INDEX IF NOT EXISTS`, triggers) as one or a few `sql.batch`
   calls; keep the conditional steps (the identities rekey, ADD COLUMN by `PRAGMA table_info`, read once per table) as they are but
   batch what can be batched. Keep every statement's current semantics, order and the `meta.schema` write last.
3. **Across instances:** after a deploy several Worker instances may start at once; make a second instance that finds the work done
   (`meta.schema` already at this version) skip it, as today.
Measure: statements and round trips for a fresh database and for an upgrade by one column, before and after (fake D1 counting round
trips, as `me-round-trips.test.ts` does, PR #620). Target: an upgrade under ~10 round trips; a running instance's later requests 0.
Unit tests: single-flight (N concurrent requests run it once), a failure retried, a fresh database and an upgraded one end with the
same schema as before (compare `sqlite_master`), the rekey path still runs.
Lane: **full** (stored data: the schema runner): the director adds `full-e2e`; one review, at most one fix round. Effort xhigh.
Decision note docs/decisions/2026-11-10-schema-fast.md (≤ 5 lines). Push to claude/schema-fast at each real step; as your LAST push
write .pr-body.md and .done together. Don't open the PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
