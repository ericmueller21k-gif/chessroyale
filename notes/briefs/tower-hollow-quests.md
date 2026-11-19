# Battle Tower: Hollow's wrong tries kept on a reload; tower floors out of the boss quests (Nov 20). Opus, medium. Targeted lane

Branch `claude/tower-hollow-quests` from main. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/battle-tower.md` (the restore),
`docs/decisions/2026-11-19-tower-audit-2-fixes.md` (its "not fixed" note), and the boss quests (`packages/server/src/quests.ts`, the app's
`quests` / `xp` callers).
1. **Hollow's wrong tries into the dark** aren't kept until your move, so a reload in the middle of your turn gives those bulbs back.
   Keep them with the floor as they happen (the kept floor, `brc.tower.solo`, as audit 2's finding 2 keeps each step), so a rejoin has
   the same bulbs spent. A unit test that fails before (the restore's pure parts).
2. **Eric, Nov 20 ("Sure", to the director's proposal):** a tower floor counts for XP and the profile as now, but **not** for the boss
   quests ("beat a boss" and the like): floor 1 plays at 800, the game's easiest boss win. Find where a solo boss win reaches the
   quests (the device names the mode) and leave the tower's floors out; one focused test.
Decision note about five lines. Area page battle-tower.md one line. Done: `.pr-body.md` (under 30 lines, changed checks old → new) and
`.done`; push and end. No PRs, no CI waits. Commits end with the `Claude-Session:` line only.
