# XP phase 2: PAUSE_REWARDS (Nov 9, 2026)

The brief: a kill switch that pauses XP grants, the daily reward and level-up rewards "without breaking games"; owed or lost, decide.

- **`PAUSE_REWARDS` = "1"** (ops.md, "Kill switches"): every match room and the solo result grant nothing; the game plays and its
  result is kept; the XP box says "Rewards are paused for a moment." (XP none reason `paused`).
- **A paused game's own XP is lost, not owed**: owing it would mean storing each paused game to replay later, more code for a switch
  meant for emergencies.
- **The day's reward and level rewards aren't lost**: the daily reward goes to the day's first counted game *after* the pause (its op
  is per day), and levels are paid whenever owed (2026-11-09-xp-phase2-levels.md). Only a pause across the day's end loses that day's.
