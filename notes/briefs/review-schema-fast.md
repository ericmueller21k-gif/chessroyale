# Independent review: PR #625 (the schema runner), read-only, ONE round

PR #625 (branch claude/schema-fast) changes how `ensureSchema` (`packages/server/src/accounts.ts`) applies the D1 schema: single-flight
per instance, batched statements, a column read in one query, the locker's `color2` migration moved into `COLUMNS`. Production's
database is live: a mistake here can lose or corrupt data or keep the site from starting. Read CLAUDE.md and the diff
(`git diff origin/main...origin/claude/schema-fast`).

Rank only what matters (blocker / major; minors short):
- Can the batched run end with a schema different from one statement at a time (order, a column added before its table, `then`
  follow-ups, triggers, the identities rekey, `AFTER_COLUMNS`), on a fresh database, the live one (every past version), or a half-done run?
- D1's batch semantics (atomic; one failure fails the batch): the fallback path, a duplicate column from a racing instance, a refused trigger.
- `meta.schema` written only after everything succeeded; a request never served against a half-made schema.
- The single-flight's 5 s wait and the cut-short case: no stall, no unbounded wait, no two instances corrupting each other.
- The `color2` change: existing databases that already have it, and ones that don't.
Don't fix. Write `review.md` on an orphan branch `review/schema-fast` (findings with file:line, a failing case and the fix; then
"checked, fine"). Run the server unit tests and any you write (the local D1 via wrangler if useful). About 30 minutes. Push and stop.
