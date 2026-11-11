# Review: PR #635, the friends page (`claude/friends-page` @ 4f9bfb4)

Full lane, read-only, fresh reviewer, Nov 11, 2026.

**Verdict: changes requested.** One High (the search walks every guest called "Player"), one Medium (the new e2e test fails on its own retry). Two Lows. Privacy, injection, the schema run and presence are clean.

## Findings

**High: the search reads every account that shares the prefix; the plan test passes for the wrong reason.** `packages/server/src/friends.ts:348-349`
- Every new account is named "Player" (`accounts.ts:558`, `api.ts:357/676`). With sign-in set up, `email/google_sub IS NOT NULL` isn't in the index, so the range walks every guest. `ORDER BY …, u.id` isn't index order either (the index ties break by rowid, and SQLite says `USE TEMP B-TREE FOR LAST TERM OF ORDER BY`). So even without sign-in, LIMIT 6 can't stop early: it reads every "Player" before it sorts.
- I reproduced it with node:sqlite: 200k guests named "Player" plus 50 signed-in "Playful N". A search for "pl" reads all 200k rows (55 ms without sign-in, 17 ms with). In D1 that's ~200k rows read per keystroke pause, 40/min per account. `friends.test.ts:465` only checks for `SEARCH … USING INDEX users_name`, which this plan also matches.
- **Fix:** add `CREATE INDEX IF NOT EXISTS users_name_signed ON users (name COLLATE NOCASE) WHERE email IS NOT NULL OR google_sub IS NOT NULL` (sign-in mode uses the same predicate text), and order by `u.name COLLATE NOCASE` only. I verified it: both plans lose the temp B-tree, and each search takes 0.1 ms and stops after 6 rows. In the test, seed a few hundred "Player" guests and assert no `TEMP B-TREE`.

**Medium: the new e2e test fails deterministically on CI's retry, or on a local rerun.** `e2e/friends.spec.ts:141,162-164`
- D1 persists for the whole run (`--persist-to E2E_STATE_DIR`), and the names are fixed (`Bo Findme P/C`). A retry makes a second "Bo Findme P", so `getByRole("button", { name: "Bo Findme P, Level 1" })` hits a strict-mode violation and `toHaveCount(1)` fails. The retry's trace then shows that failure instead of the first one. With E2E_REUSE it fails on every run after the first.
- **Fix:** add a run-unique suffix, e.g. `` `Bo Findme ${tag}${test.info().retry}${Date.now().toString(36).slice(-4)}` ``, and search for the full name.

**Low: the page shifts when the list arrives.** `packages/app/src/screens/Friends.tsx:79,91`
- INVITES and FRIEND REQUESTS sections are added above ONLINE once the state loads (after the placeholders show). The online and offline lists and the foot then jump down by a section, which goes against "nothing shifts".
- **Fix:** render those two sections below OFFLINE, or keep their headings, greyed, while `status === "unknown"`.

**Low: `doing` can be briefly stale across Worker instances.** `presence.ts:53`, `live.ts:223`
- Batches from two instances can reach the hub out of order: "town", then "home" from another instance flushed first. The list then shows the old activity until the next 30 s heartbeat. This is the same as `busy` today and acceptable; note it in hub.md rather than fix it.

## What I checked (clean)
- **Privacy:** the search returns only `id, name, icon, level`, never an email. It leaves out the searcher, `test = 1`, fair play `banned` (evasion bans included, they're `banned` too), and guests where sign-in is set up. The `pool` status isn't marked. A blocker shows in results, but profiles are public and `request` to a blocker answers silently as before, so nothing leaks.
- **Injection and wildcards:** the query is fully parameterized, uses no LIKE (`%` and `_` are literal), takes 32 characters at most, and needs at least 2 (code points). The `\u{10FFFF}` upper bound is correct for UTF-8 under NOCASE.
- **Rate limit:** separate key (`search`, 40/min per session, else per IP), after perIp and perUser. The route needs a real session (401 otherwise), so rotated fake tokens search nothing. It's per instance, like every other limiter.
- **Schema:** `CREATE INDEX IF NOT EXISTS` is idempotent and runs in AFTER_COLUMNS. `SCHEMA_VERSION` is a hash of the parts, so it changes by itself. The name doesn't collide. It's a one-time index build on `users`.
- **Presence:** `doing` only travels through `presenceRows`, which reads the `friends` table (block removes the friendship), is dropped while hiding, and is gated on `online`. It's pruned with `seen` and cleared on `forgetSeen` and account deletion. The client drops it unless the latest `/online` answer has it.
- **Request states:** profile → Add Friend → Cancel Request; Back keeps the search. Accept clears FRIEND REQUESTS. Block empties both lists (e2e).
- **Results box:** absolute and a fixed height, so the page under it doesn't move (e2e measures it). No guard test in `docs/rules/eric.md` is changed. The removed overlay test went with its feature.
