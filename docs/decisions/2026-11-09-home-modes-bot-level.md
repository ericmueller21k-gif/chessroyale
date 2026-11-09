# The Bot level box (50 v 50 Bots, solo) (Nov 9, 2026)

**Eric (Nov 9):** "select the average bot MMR ... my level ... very easy ... they kind of fluctuate a few hundred points up and down
around [it] ... random ... a little kind of okay button that lights up."

- PLAY with Bots opens a box (the Quests overlay's dim and card classes): My level, Very easy, Easy, Medium, Hard, Very hard, Random. OK is
  greyed until a row is picked; ✕, Escape or the dim cancels; OK remembers the pick (`hunchess.botLevel`) and preselects it next time.
- `BOT_LEVELS` (settings.ts): means 700 / 950 / 1150 / 1500 / 1900; My level = your rating (`profile.rating`) clamped to 600..2200, Medium
  without one; Random = uniform 600..2200. `Settings.botLevel` carries it into `botStrength`; solo only, online lobbies unchanged.
  Medium is BOT_LOBBY's own mean, so its bots are exactly the bots of before (and tests' Medium plays as before).
- Calls: near the range's ends a level's curve narrows (sd ≤ 1.5 × the room to the edge) so the clamp at 600 doesn't drag Very easy's
  average to ~760 (a bot under 600 plays as 600 anyway). Each row shows the level's real average over the bot names, to the nearest 50
  (Hard reads ~1550), not the setting: real numbers only. A rating within a level is fixed by name + level. A results screen's "again"
  keeps the level. XP and anti-farm rules unchanged.
