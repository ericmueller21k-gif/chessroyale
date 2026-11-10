# Review: PR #603, quest reroll per daily (full lane, stored data)

Reviewed `origin/claude/quest-reroll` at `0473c29` against `origin/main` (read-only; Nov 10, 2026, xhigh).
Server unit tests: `packages/server/test/quests.test.ts` and `account-data.test.ts` pass (41/41). The e2e specs were not run (CI runs them).

## Blocker

None.

## Major

### M1. Two dailies rerolled at once can end up the same quest, and one game then pays both

`packages/server/src/quests.ts:244` and `:255`. Each reroll picks its replacement from the kinds held **as it read them**
(`pickQuests(QUESTS.daily, rows.map((r) => r.kind), …)`), and the replacement's insert only checks that the *old* quest is still
there (`old` cond). Before this PR there was one reroll a day per account, so two concurrent swaps couldn't happen. Now two taps on
**different** dailies (two tabs, or one tab firing both quickly) both read the same rows, both batches go in, and both can pick
the same kind.

Failing case (scratch test, not pushed; the repo's own test harness, `world()`, `signedIn`, `set` from `quests.test.ts`):

```ts
for (let i = 0; i < 40; i++) {
  const u = await signedIn(sql, `u${i}@example.com`);
  await set(sql, u.id, [["squad-up"], ["warm-up"], ["regular"]]);
  const [a, b] = await quests(sql, u.id);
  await Promise.all([rerollQuest(sql, u.id, a!.id, T0), rerollQuest(sql, u.id, b!.id, T0)]);
  const names = (await questsAnswer(sql, u.id, T0)).quests.filter((q) => q.period === "daily").map((q) => q.name);
  // expected: names all different
}
```

Result: **11 of 40** accounts ended with two identical dailies (both rerolls `{ ok: true }`), e.g. `['Fifty-Fifty', 'Fifty-Fifty']`,
`['Winner', 'Winner']`.

Why it matters (rewards): `questStatements` (`quests.ts`, the loop over unfinished rows) moves every unfinished quest a game counts
for, and each completion op is keyed by the quest's id (`questOpId(def.id, q.id, …)`), so both copies progress on the same games and
both pay. Half the play for two dailies' XP, crates and keys; repeatable each day by anyone scripting two concurrent requests. It
also breaks the deal's own invariant (the deal and the reroll both exclude kinds you hold).

Fix (small, same batch, no schema change): guard the replacement's insert on the kind too, so the second batch sees the first's row:
`old` cond plus `AND NOT EXISTS (SELECT 1 FROM quests WHERE user_id = ? AND kind = ?)` (the old quest's kind differs from `def.id`
already, since `pickQuests` excludes it). The loser then answers `NO_REROLL` and keeps its quest (worth checking the app refetches on a refusal, so the
button shows the true state). Add the loop above (or one deterministic case, two concurrent rerolls of different dailies)
to the "two at once" test.

## Minor

### m1. Deploy day: a quest already rerolled today under the old rule can be rerolled again today

Rows rerolled before the deploy have `rerolled_day = NULL` (only `quest_days.reroll_day` was written), so on the deploy's XP day a
player who used the shared reroll gets a fresh reroll on the replacement *and* on the other daily. One day, at most two extra free
swaps, no payout. Acceptable pre-launch; mention it in the decision note, or skip it. (A one-off `then` on the COLUMNS entry,
`UPDATE quests SET rerolled_day = (SELECT reroll_day FROM quest_days d WHERE d.user_id = quests.user_id) WHERE period = 'daily'`,
would over-mark the untouched daily, so not worth it.)

### m2. A home screen loaded before the deploy greys every reroll until reloaded

`QuestsAnswer.rerollLeft` is gone and the old `QuestsOverlay` reads `rerollLeft`, so an already-open old client gets `undefined`
and shows both rerolls disabled ("used today") though the server would allow them. Fixed by a reload; pre-launch only Eric sees it.
No change needed; noting it for the playtest.

## Checked, no findings

- **Two taps / two tabs on the same quest:** the replacement goes in only while the old row exists and is rerollable; the progress
  delete and the old row's delete are gated on the replacement existing, all in one batch, so the second batch inserts nothing and
  deletes nothing (`won` is 0 → refusal). The PR's test covers it (and on the replacement).
- **Losing the quest:** insert-before-delete in one transaction; no UNIQUE on `(user_id, slot)`, so the brief overlap can't fail the
  batch. The replacement keeps `assigned_at` and `slot`, so carry-over and the `maxDailies` cap treat it as the old one.
- **Progress / payment around a reroll:** a game batch that lands first and finishes the quest sets `done_at`, so the reroll's
  `done_at IS NULL` guard refuses it (no swap of a paid quest). One that lands after finds the old id gone: its progress insert and
  completion op are both guarded on the quest existing, so nothing is written to an orphan and nothing pays. The completion op id
  carries the quest id, so the replacement can't collide with the old quest's payment.
- **The weekly and finished dailies:** refused both in `canReroll` (JS) and in the SQL guard (`period = 'daily' AND done_at IS NULL`).
  The UI also greys a daily at `progress >= target`.
- **Day boundary:** `day` comes from the request's `now`, used for the guard and the mark alike; a reroll just before the XP day turns
  marks day D, and from day D+1 that quest is rerollable again (intended). No reroll can mark a later day than its guard checked.
- **The new column on an existing database:** `QUESTS_COLUMNS` is in `accounts.ts` COLUMNS, which feeds `SCHEMA_VERSION`, so every
  existing database re-runs `ensureSchema` once and gets `ALTER TABLE quests ADD COLUMN rerolled_day INTEGER` (after `QUESTS_SCHEMA`
  creates the table on a fresh one). Old rows read NULL: `rerolled_day IS NULL OR rerolled_day <> ?` and `null !== day` both allow
  them. `setTestQuests` and the deal's inserts leave it NULL. A revert is harmless (nullable column, unread).
- **Download my data / account deletion / guest merge:** `questsDownload` adds `q.rerolled_day`; `questDeletes` removes the whole row
  by `user_id`, column included; `account-data.test.ts`'s schema map lists the column (it passes). The Privacy page wording is updated.
- **Nothing hidden:** both daily rerolls always render, disabled with a reason in `aria-label`/`title`; the weekly has none, as before.
