# Battle Tower PR 10: the solo screens (Nov 19, 2026)

**Eric's calls (Nov 19):** the tower is entered **only from Chess Town** (the skyscraper's clerk, PR 11), never from home or a menu:
no home card, no side-menu item (the mockups' home row is dropped); the clerk opens the tower's screen (`/tower`), whose Back goes to
the town. **No Last Stand in the tower** ("no save in tower"): the God King never steps in on a floor (the runner skips it whenever
`towerFloor` is set, the `?laststand=1` test switch included). Ultimates landing 2-3 turns after their warning on shared floors: as
built. Animation length: left for the playtest. Mockups approved as drawn ("N moves left" on the strip).

**Calls made building it:**
- **Every boss in the view:** `NetBoss.side` (optional: each boss's own view in turn order, `toMove`, `moved`) feeds the split bar,
  the stacked figures and the dock's "[face] Ginger plays e5" (the boss who moved, `moved`). A party (PR 12) gets it the same way.
- **The restore:** the floor is kept on the device (`brc.tower.solo`) at every step of the match (each `nextRound`, and once as it
  begins): the runner's snapshot (it survives JSON: tested), your moves, whether the entrance has played. A reload of `/tower` (the
  battle keeps that address) rejoins at once. Not kept: the dock's last-move line (it says "Your move." after a reload) and the time
  you'd spent on the move the reload cut (your bank is as the last step left it).
- **Results and leaves are kept until the server takes them:** a result (`done`) is written as the battle ends and sent from the
  result screen, or from the tower's screen on its next opening if that failed. Every leave sends `stop` with your moves, so core's
  `leaveFloor` (free before your 2nd move) decides on the server; the confirm says which it will be.
- **Under way with nothing kept here** (another device, storage cleared): "Floor under way" asks first; "Leave it" sends the counted
  stop. Its bosses resting: only "Leave (free)"; a 409 back (a boss returned) shows its line and the floor is asked again.
- **Figures:** idle sprites cut to their drawn part, one scale for all (the bar's parts, and stacked beside the board on a computer),
  not the reacting single-boss figure. His words: from the TO MOVE part (phone), over the figure to move (computer).
- **A one-boss floor** keeps today's bar; the strip replaces the title line on every floor.
- **The result's buttons** are greyed for the result's pictures (250 ms + the attack's length) and until the server answers.
- **Rewards:** each floor is a counted solo game for XP (`noteSoloGame`); boss tokens and milestones wait for the rewards PR.
- **The card's skyscraper:** a plain drawn tower until the art runner's. Unknown boss ids: "A boss" and a "?".
- The dock's plays line moved into a small `PlaysLine` in Boss.tsx, keeping the guarded `<BossTag boss={boss} /> plays` (eric.md).
