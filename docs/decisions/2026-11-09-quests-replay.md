# Quests: a replayed grant moves nothing new; a solo game past the cap moves nothing (Nov 9, 2026; review of #575, m1 and m2)

- **m1:** a game's grant can be retried (Squads' reward queue, the duel room's alarm). After a reroll or a new day's deal, the retry
  saw new quest ids with no progress row and moved them too. Now each counted game's first attempt claims it in a new table,
  `quest_games` (user_id, game, attempt, at; PK user_id + game), and every progress insert needs that attempt's claim. A separate
  table, not an `attempt` column on `quest_progress` (the review's example), so a first attempt that moved no quest still claims the
  game. Claims older than the day before are cleared at the day's deal (retries come within minutes); in the account's stores.
- **m2:** a solo game's progress also needs its time op's first leg in the ledger, as a win quest needs the win op's: past
  `XP.soloMinutesPerDay` there's no time XP, so no progress ("no XP, no progress", as quests.ts and settings.ts say).
- Tests: `packages/server/test/quests.test.ts` ("a replayed grant after a reroll …", "a solo game past the day's solo minutes …").
