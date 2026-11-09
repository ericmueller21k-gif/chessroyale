# Delta review of #575 (quests): the review fixes e11d12c..84724d3

Read-only, effort high. Only the fix commits (`git diff e11d12c 84724d3`), plus the code they touch. Head e2d9f54 only removes
`.pr-body.md` and `.review-fixes.md` (this also settles the first review's m4).

**Verdict: no blocking findings.** Each finding is fixed, and the fixes add no bug that can break a match, pay twice or lose data.
Two minor items and two nits below, none needed before merge.

## Quick checks
- `npm run typecheck`: passes (after `npm ci`; the container had no node_modules).
- `npx vitest run` of the five files: 77/77. `packages/server/test/quests.test.ts` run 5 more times: 21/21 each time.
- Conflict markers (`<<<<<<<`, `>>>>>>>`, a lone `=======`) in the delta: none.

## Each finding
- **M1 (flaky test): fixed.** `quests.test.ts:96` puts the account on a fixed id (`fixedAccount`), so the deal's seed
  (`${userId}:${day}`) is the same every run, and `:118` checks the finished quest's **id**, not its name. Deterministic now.
- **m1 (replay moves new quests): fixed.** `questStatements` (`packages/server/src/quests.ts:268`) puts a claim
  `INSERT INTO quest_games … ON CONFLICT (user_id, game) DO NOTHING` with a fresh nonce first in the batch, and every progress insert
  needs `EXISTS (… quest_games … attempt = <this nonce>)`. Checked:
  - Races: two attempts at once are two D1 batches, each one transaction, run one after the other; only the first claim goes in, so
    the second's progress (and so its completions, whose guards count progress) does nothing. A failed first batch rolls its claim
    back, so the retry claims and counts, as it should. A first attempt whose quest read failed (`.catch` → `[]`) wrote no claim, so
    its retry counts: correct, the game never counted.
  - Within the batch the claim comes before the progress inserts, so they see it. Claims are per user (PK user_id + game): one game key
    shared by 100 players gives 100 independent claims.
  - Cleanup at the deal (`quests.ts:163`, `DELETE … at < day - 86_400_000`): only claims older than yesterday's 08:00 UTC, so
    a claim is always at least a day old when it goes. The test's next-day replay (`now: T0 + DAY`) keeps its claim and moves
    nothing. See n2 for the theoretical edge.
  - Merge/delete/download: `questDeletes` and the `quests` store's `tables` include `quest_games`; the download adds `games`
    (game key and time: the player's own data); `account-data.test.ts`'s schema list has the new table and passes.
  - Migration: a new `CREATE TABLE IF NOT EXISTS` in `QUESTS_SCHEMA`, which is part of `SCHEMA` and so of `SCHEMA_VERSION`'s
    fingerprint (`accounts.ts:325`): databases already at the old fingerprint re-run the schema and get the table. No column change.
  - Test: "a replayed grant after a reroll moves only the quests its first attempt moved" (`quests.test.ts:279`), after a reroll and
    after the next day's deal. Good.
- **m2 (solo past the cap): fixed** for the case the review named. `xp.ts:222` passes `timeOp` for a solo game, and the progress
  insert needs that op's leg 0. Past `XP.soloMinutesPerDay` the time op has no legs, so nothing moves (test `quests.test.ts:221`,
  a lost game, `none: "limit"`). A partly trimmed game still has a leg and counts. See m-a for the won game.
- **m3 (overlay over the queue or a notice): fixed, and it still opens.** `useQuests(on, busy)` reads `busy` through a ref at
  answer time and skips both opening and `markQuestsSeen` while queueing or while `otherNoticeUp()`; Home also renders the overlay only
  when `!queueing`. `otherNoticeUp` copies `ChatNotice`'s (`chatMod.notice`) and `WelcomeNotice`'s (`notice === true && status !==
  "locked"`) conditions exactly, and the profile is always loaded first (`questsForYou` is null without it, so the fetch doesn't run).
  The common case (not queueing, no notice) is unchanged, and the existing "opens on the day's first visit" e2e still covers it. The
  new e2e holds `/api/quests` until the queue shows, checks no dialog and no `seenDay`, then reloads and sees it open. Behavior to
  know (as designed): cancel the queue without leaving home and it waits for the next home visit.
- **m5 (D1 reads): done** as a note in `docs/areas/ops.md`. See m-b: the fix added a write the note doesn't count.

## Minor

### m-a. A won solo game past the minutes cap now earns win XP but moves no quest (`packages/server/src/quests.ts:280`, the `timeOp` guard; `xp.ts:222`)
- **Scenario:** a signed-in player has used `XP.soloMinutesPerDay` today but fewer than `XP.soloWinsPerDay` solo wins. They win a
  solo game of 5 minutes. The time op has no leg, the win op pays `XP.win`, the box shows "Daily solo limit" and "Win +X", so the
  game earned XP. But the progress guard needs the time op's leg, so Warm Up and the weekly don't move. That's the reverse of m2's
  mismatch: the rule "only a game that earned XP counts" (settings.ts's QUESTS note) isn't what the code does here. Low stakes, and
  not exploitable (it only withholds progress).
- **Fix (pick one, record it in the decision file):** for solo, require the time op's leg **or** the win op's leg
  (`AND (EXISTS(…timeOp…) OR EXISTS(…winOp…))`), plus a test of a won game past the minutes cap; or keep it and say in
  `2026-11-09-quests-replay.md` and the settings note that a solo game counts only while it earns time XP.

### m-b. Every counted game now writes one more D1 row per player, and a batch runs even when nothing else would (`quests.ts:268`)
- **Scenario:** the claim goes in for every counted game with a quest mode, whether or not it moves a quest (all quests finished, a
  mode no quest counts). So a 100-player Crowd game's end adds 100 row writes, and a solo game past both caps (no legs) now runs a
  one-statement batch where it ran none. The rows are cleared at the player's next day's deal, so the table stays about two days per
  active player. Correct, just a cost the m5 ops note (reads only) doesn't mention.
- **Fix:** none needed now. Add "and one `quest_games` row write per player" to the ops note. If it matters later, skip the claim
  (and the whole quest batch) when no unfinished quest's `counts` matches the game.

## Nits
- **n1.** The claim's `at` is the attempt's `game.now`; Squads' `writePending` passes `Date.now()` per attempt, but only the first
  attempt's claim goes in, so `at` is the first attempt's time. Fine; just noting it's not the game's end time.
- **n2.** Theoretical: Squads retries rewards for up to `SQUADS_LOBBY.rewardRetryHours` (24) past the lobby's closing. A retry of a
  grant whose batch had committed (only a failure after the batch requeues it) that lands more than a day after the claim, after a
  deal cleared it, would claim afresh and could move the current quests. Needs D1 failing for about a day right after a committed
  batch. No change needed; if wanted, clear claims older than `rewardRetryHours` + 2 days instead of 1.
