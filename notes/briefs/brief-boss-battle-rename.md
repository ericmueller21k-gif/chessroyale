# "Raid" becomes "Boss Battle"; solo Boss Battles count for the boss quests (Eric, Nov 10)

Eric: "rename it to boss battle, and then they should count towards the quest. Again, they just follow our normal rules. You just have
to like play for a certain number of time or moves or whatever to actually have it count." "Raid" is being kept for a future Colosseum
mode (several bosses in a row with people).

1. **Every player-visible "raid"** becomes Boss Battle wording: home's Boss Battle menu ("Join a raid", "Raid with bots", "Create a
   raid", "Make a raid and share its code…"), the queue screen ("Boss raid · up to 50", "the raid begins"), profiles ("Boss raid",
   "raids"), LiveWindow, the town's text, the FAQ (~33 mentions), quest names/goals ("Boss Hunter: Beat a boss in a raid", "Raid Party:
   Play 2 boss raids" → e.g. "Win a Boss Battle", "Play 2 Boss Battles"; rename "Raid Party" too), toasts and anything else a player
   reads. Code identifiers, settings names and protocol fields stay (`raid`), except where a name is shown. Read the area pages first.
2. **Solo Boss Battles count** for the `boss` and `bossWin` quests (`packages/core/src/quests.ts` `questCounts`: today solo counts only
   for "any"): Boss Battle's START, Boss alone and Play with bots, under the same solo rules as other solo games (the server-timed
   minimum, `XP.minMoves`, `QUESTS.soloMinMinutes`, whatever solo XP uses). Make sure the solo result tells the server it was a Boss
   Battle (and won) without trusting more than solo XP already does.

Tests: unit for questCounts (solo boss and bossWin, under and over the minimum); update e2e checks whose text changes (list each old → new).
Any guard test in docs/rules/eric.md touched: say which. Lane: targeted. Effort high. Decision note
docs/decisions/2026-11-10-boss-battle-name.md (≤ 5 lines). Push to claude/boss-battle-name at each step; when done write .pr-body.md
and push. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md and notes/briefs/rules-common.md first.
