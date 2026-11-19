# Battle Tower PR 10: the solo screens, the battle with several bosses, the solo restore (Nov 19). Opus, high. Targeted lane

Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, the design `docs/decisions/2026-11-18-battle-tower-design.md` (§2 "How
several bosses show", §3, §5), `docs/areas/battle-tower.md` (its "For PR 10" list: the server's contracts), and the approved mockups
(`git show origin/stills/battle-tower:README.md`; the stills on that branch). Branch `claude/tower-solo-screens` from main.
**Eric's calls (Nov 19), record them in one decision note:** the tower is entered ONLY from Chess Town (the skyscraper's clerk), never
from home or a menu: no home card, no side-menu item (the mockups' home row is dropped); the tower's screen is what the clerk opens.
**No Last Stand in the tower** ("no save in tower"): the God King never steps in on a tower floor. Ultimates landing 2-3 turns after
their warning on shared floors: as built. Animation length: left for the playtest. Mockups approved as drawn ("N moves left" on the strip).
Build:
- **The tower's screen at route `/tower`** (the mockup's: your run's card, bests, Solo | Party with Party greyed "Coming soon",
  CONTINUE FLOOR n / START A RUN, "Start a new run" with a confirm), on `/api/tower` (PR 9's routes and contracts: 409 means read the
  run again; `resting: true` offers "Leave (free)" sent with `free: true`). Back goes to the town (`/town`). PR 11 (in parallel) adds
  the skyscraper and its clerk, whose Talk opens `/tower`: don't touch town code.
- **A floor:** `enterTowerFloor()` (one function, exported, the only way the screen starts a floor): for now straight to the battle;
  PR 11b will put the floor room's walk-in in front of it. The battle with 2-3 bosses: the split bar (phone), the stacked figures
  (computer), the dock line naming the boss, the run's strip, as the mockups; each boss at the floor's strength (`towerFloor`); no Last
  Stand; the result: won → "Continue" / "Stop here (saved)", always shown, greyed while anything animates; lost or drawn → the run's
  end (floor reached, best); leave rules as core's `leaveFloor` (free before your 2nd move, the confirm says so).
- **The solo restore:** after every move the floor's game (match state, every boss's power state, the moves) is kept on the device and
  a reload rejoins it where it was; nothing to restore with a floor under way → the counted stop (ask first on another device, per the
  area page). Unknown boss ids (a renamed boss) drawn safely.
- **Tests:** `e2e/battle-tower.spec.ts` (start a run, win floor 1 with the test switches, floor 2 with two bosses on the bar, a reload
  mid-floor rejoins, a loss ends the run, no Last Stand) and its `e2e/areas.json` entry; unit tests for the restore's pure parts.
Effort high. Area page battle-tower.md (at most 5 lines). One still per platform for Eric at the end (stills branch). Done:
`.pr-body.md` (lane, player-visible changes, changed checks old → new; under 40 lines) and `.done`; push and end. No PRs, no CI waits.
