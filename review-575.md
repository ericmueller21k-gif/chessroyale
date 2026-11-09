# Review of #575 (XP phase 3: quests and the daily overlay)

Independent read-only review, full lane, effort xhigh. Diff: `origin/main...origin/claude/xp-phase3` (head e11d12c), checked against
`.pr-body.md`, `notes/briefs/brief-xp-phase3.md` and the design's sections 3 and 5.

**Verdict: no blocking findings.** Money and stored data hold up: a quest pays once, only from a counted game, through the ledger.
One **major** item: a flaky server test that will turn CI red about one run in three. Fix it before merging. Five minor items follow.

## Quick checks
- `npm run typecheck`: passes.
- `npx vitest run` of the six files: **130/131 on the first run.** `packages/server/test/quests.test.ts` alone, run six more times,
  failed once (see M1).
- Conflict markers (`<<<<<<<`, `>>>>>>>`, a lone `=======`) in the diff: none.

## Major

### M1. Flaky test: a finished daily's kind can be dealt again the next day (`packages/server/test/quests.test.ts:110`)
- **Scenario:** the test finishes Warm Up on day 3, then asserts that day 4's dailies don't include the name "Warm Up". The code drops
  the finished quest correctly. But `ensureQuests` (`packages/server/src/quests.ts`, the `pickQuests(QUESTS.daily, kept.map(...))`
  call) leaves out only the kinds still held, so a **new** Warm Up can be dealt on day 4. The seed is `${userId}:${day}` and the user
  id is random in each run, so the outcome changes from run to run. One slot is drawn from boss-hunter 1, raid-party 2, warm-up 2 and
  winner 1, so Warm Up comes back 2 times in 6, about a third of runs. Seen here: failed 1 of 7 runs, including the first.
- **Severity:** major. It turns `check` red at random, and a CI retry hides it.
- **Fix:** the behavior is fine (the design doesn't forbid seeing the same kind again on a later day). Assert on the dropped quest's
  **id** instead: `expect(d4.map((q) => q.id)).not.toContain(warmUpId)`. Or, if the director wants "not the same quest two days
  running", add yesterday's finished kinds to `held` in the deal and record that call in a decision file. Either way, also make the
  seed fixed in the test (a fixed account id), so the test can't flake on the draw.

## Minor

### m1. Replaying a game's grant after a reroll or a new day's deal counts that game toward the new quests (`packages/server/src/quests.ts`, `questStatements`, the progress `INSERT … ON CONFLICT (quest_id, game) DO NOTHING`)
- **Scenario:** game G is granted and moves Warm Up. Its grant is then retried: Squads' `rewardQueue` in `writePending`, or the duel
  room's alarm retry in `recordFinished`, both real retry paths. Before the retry lands, the player rerolls a daily, or 08:00 UTC
  deals new dailies. The retry's `questStatements` reads the current quests, and the new quest ids have no `(quest_id, G)` row yet.
  So G moves the new quests too. XP isn't paid twice (the ops are keyed by game), but one game can bring a quest closer to done, or
  finish it, twice over. The header's "A replay writes nothing more" isn't strictly true.
- **Fix:** have progress go in only on the attempt that first counted this game. For example, add an `attempt` nonce column to
  `quest_progress` and guard each insert with `NOT EXISTS (SELECT 1 FROM quest_progress WHERE user_id = ? AND game = ? AND attempt <> ?)`.
  A guard on `at <> now` also works, apart from two attempts in the same millisecond. Add a test: grant, reroll, then grant again.

### m2. A solo game past the day's solo-minutes cap earns no XP but still counts for quests (`packages/server/src/xp.ts`, `grantXp`, the quest batch then `if (solo && g.time && !gained) return … "limit"`)
- **Scenario:** after `XP.soloMinutesPerDay`, a 3-minute solo game has `timeXp = 0` and no win XP, so the box says "Daily solo limit".
  But `questStatements` already put its progress into the batch, so Warm Up and the weekly still move. That contradicts quests.ts's
  header ("no XP, no progress") and settings.ts's note ("only a game that earned XP counts"). The risk of abuse is low: one solo
  game at a time, and each needs at least 3 minutes of the server's own time. But the rule and the code disagree.
- **Fix:** pick one and make them agree. Either guard solo progress on the time op's leg existing (as win quests guard on the win op),
  or say in the header, the settings note and the FAQ that a solo game past the cap still counts for "finish games" quests.

### m3. The overlay can open by itself over the queue (`packages/app/src/screens/Home.tsx`, `{quests.open && quests.answer && <QuestsOverlay …>}`; `packages/app/src/quests.ts`, `useQuests`)
- **Scenario:** the day's first home visit, on a slow network. The player taps PLAY before `/api/quests` answers. Home shows the
  queue in place, and then the answer arrives and opens the overlay over the queue screen. If the match starts, Home unmounts and the
  overlay goes with it, but the day's showing has been used up while the player waited. It can also stack over `WelcomeNotice` or
  `ChatNotice`.
- **Fix:** don't open it by itself while `queueing` (keep it due until the next home visit), or render it only when `!queueing`. Mark
  the day as seen only when it actually shows.

### m4. `.pr-body.md` is committed on the branch (repo root)
- **Scenario:** a merge commit puts `.pr-body.md` on `main`, and the next helper's PR body then conflicts with it or overwrites it.
- **Fix:** remove it from the branch (`git rm .pr-body.md`) before merging, or add it to `.gitignore`.

### m5. Extra D1 reads per player at the end of every game (`packages/server/src/xp.ts` → `quests.ts`)
- **Scenario:** every `grantXp` now adds the `quest_days` read, `rowsOf` (twice when it's a new day), possibly the deal's batch, and
  `questsPaidBy`. That's 3 to 5 more queries per player, run in turn in the room's `saveResults` loop. For a 100-player Crowd game,
  that's about 300 to 500 more queries at the end of the match.
- **Fix:** none needed now. Have `ops` note it, and if needed later, read `quest_days` and the quests in one query.

## Checked and fine
- **Paid once:** the op `quest:<kind>:<quest id>:<ledger id>` has a guard that counts progress in the same transaction and needs
  `done_at IS NULL`. Two games at once, two tabs, or a replay can't pay twice. The completion's legs name the game, so
  `questsPaidBy` answers the same on a replay.
- **No counted game, no progress:** a guest, test, practice, abandoned, banned, under-minimum or paused game returns before the batch
  (the exception is m2). A win quest moves only if the win op's leg 0 is in the ledger, in the same batch.
- **A reroll racing a completion:** the reroll's `UPDATE quest_days` needs the quest to still be unfinished, and the completion needs
  the quest row to exist. Only one of them wins. The reroll is one a day, never on the weekly or a finished quest, and two taps
  reroll once.
- **Dealing:** lazy, with a nonce claim on `quest_days`, so reads at once deal once. The carry-over cap (`dailiesToDeal`) never goes
  past 3. The XP day starts at 08:00 UTC and the week on Monday at 08:00 (`questWeekStart` is tested across the boundary).
- **Level-ups from quest XP:** `payLevels` runs on `after.xp`, which includes the quest's XP, through phase 2's path, once per level.
  `before` subtracts the quest XP too.
- **Stored data:** only new tables (`CREATE TABLE IF NOT EXISTS`), and `xp_rewards.quests` is optional. Old apps ignore it: a game
  whose only reward is a quest shows no toast on an old app, which is harmless. Quest rows are deleted on a guest merge and on
  account deletion, and included in "Download my data" (the `ACCOUNT_STORES` entry; account-data.test passes).
- **The 320 px top bar:** the buttons keep 40 px and the logo steps down to its 28 px icon. Home's `Logo` has no `onClick`, so it's a
  `div`, not a tap target. The general tap-target test (`home-layout.spec.ts`, "the top bar … fits from 320 px up") is unchanged.
  The quests test only adds a check that the Quests entry is at least 40 px.
- **Auto-open:** once per XP day per device, signed in only, never before the walkthrough has been seen (`TUTORIAL_SEEN_KEY`). The
  e2e fixture marks it seen by default.
- **The toast:** quest lines like "Quest done: Boss Hunter +300 XP", with the quest's crates and keys added to the counts.
  `gameRewards` reads only the `daily` and `level` reasons, so a quest's crates aren't counted twice.
