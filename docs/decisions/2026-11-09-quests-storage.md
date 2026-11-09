# Quests: stored data and paying once (Nov 9, 2026; XP phase 3; full lane)

Additive: four new tables in `QUESTS_SCHEMA` (server/quests.ts), no column changes, nothing older reads them.

- **`quests`** (id, user_id, period, kind, target, assigned_at, slot, done_at), **`quest_progress`** (quest_id, user_id, game, at; one
  row per quest per game, so a replay adds nothing), **`quest_days`** (user_id, day, week, reroll_day, nonce),
  **`quest_games`** (user_id, game, attempt, at; added by the review's m1: [2026-11-09-quests-replay.md](2026-11-09-quests-replay.md)).
- **Dealt lazily, no scheduled job:** the day's first read (GET /api/quests, or a game's XP grant) deals, from a seed of the account
  and the day (`pickQuests`). One claim per day: the `quest_days` upsert writes this attempt's nonce only if the day isn't dealt, and
  every row of the deal checks it in the same batch, so two reads at once deal once. The reroll claims the same way.
- **Paid in the game's XP batch** (xp.ts grantXp, after the win op): the progress rows, then each quest's op
  `quest:<kind>:<quest id>:<ledger id>` (reason `quest`; legs: XP, Winter Crates, keys, their source the game), its guard counting
  the progress in the same transaction. Once per quest whatever the replays, tabs or rooms at once. The kind is in the op id so a
  result can name the quest without its row. Its XP is a part of the box ("Quest +300", "Quests +600") so the bar fills with it and
  a level it reaches is paid as phase 2 pays levels; the quests are in `XpRewards.quests` (kept in `results.xp_rewards`).
- **The account:** a guest's merge drops the guest's quests (the account keeps its own; what they paid moved with the balances);
  deleting removes all four tables' rows; the download has them (store `quests`). The privacy policy's entry is "XP, levels and quests".
- **PAUSE_REWARDS:** a paused game grants nothing, so no progress and no pay (it waits for the next game). GET /api/quests says
  `paused` and the overlay's head reads "Quests are paused for a moment."
