# Brief: the Crowd 50 v 50's new cut schedule: fewer, bigger cuts, longer rounds. Opus, high

Worktree `/home/user/cr-crowd-cuts`, branch `claude/crowd-cuts` (from main 58c9dd3).

Eric, Nov 1: "every two moves people were getting cut after the first round… we need fewer eliminations, but we can
eliminate more players… it takes away from the chess game because there's too many cuts happening… feel like there's a
set amount of rounds." He approved this schedule as the default (a lobby vote on cut styles may come later; not now):

| Cut | After team move | Moves in the round | Players left | Out |
|---|---|---|---|---|
| 1 | 10 | 10 | 70 | 30 |
| 2 | 15 | 5 | 48 | 22 |
| 3 | 19 | 4 | 32 | 16 |
| 4 | 23 | 4 | 20 | 12 |
| 5 | 26 | 3 | 12 | 8 |
| 6 | 29 | 3 | 8 | 4 |
| 7 (boss final only, and duel) | 32 | 3 | 4 | 4 |
| 8 (duel only) | 34 | 2 | 2 | 2 |

Team final: cuts 1 to 6 (8 left). Boss final: 1 to 7 (4). Duel: 1 to 8 (2).

Today (`packages/core/src/settings.ts`): `CROWD_SETTINGS.firstStageRounds` 20 plies, then `roundsPerStage` 2 plies (a cut
after every team move), `CROWD_KNOCKOUTS` per ending. "A move" in the table is one team move (2 plies: half from each
team); the knockouts are totals, split between the teams as today.

## Build
- Rounds per stage become a list (e.g. `stageRounds: [20, 10, 8, 8, 6, 6, 6, 4]` plies) for the Crowd; keep
  `roundsPerStage` / `firstStageRounds` working for every other mode exactly as now (`roundsInStage`). Knockouts:
  team [30, 22, 16, 12, 8, 4], boss [..., 4], duel [..., 4, 2]. Numbers only in settings.ts.
- Everything that reads the schedule follows: the runner (solo and online), the screens that say when the next cut is
  ("cut now", "cut in N"), the cut screen, the FAQ (it takes numbers from settings; check its words still read right),
  `crowdFinalists`, the sims. The tie protection at the cut line (`cutGrace`) stays.
- **A game that ends before the cuts are done:** check what happens today and that it still works (the final from the
  standings as they are, or whatever the rule is). Measure with the crowd sim how often a game ends before the final,
  before → after, and the final's starting move. Report it.
- The other helpers today: one on the phone scoreboard (`MiniTower`, the chat tab, `.under-board`), one on bots' moves
  (`bots.ts`, Maia). Don't touch their files; settings.ts is shared, so keep your change to the Crowd's schedule section.

## Deliver
Push `claude/crowd-cuts`. PR title "The Crowd's cuts: six bigger cuts, longer rounds". Body in
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/pr-body-cuts.md` (every player-visible change and new text; changed checks old → new). Report: what
changed, the sim's numbers before → after (games ending before the final, the final's start, bots vs players reaching it
if the sim says), anything Eric must decide.
## Rules you must keep (every brief)
- Don't change any check that guards a rule in `docs/rules/eric.md`; list every changed check old → new in the PR body.
- Never base anything on, name or hint at a real person.
- **Working lean (CLAUDE.md, Nov 1 audit):**
  - You can't sit idle: ending your turn ends your run. **Don't wait with `Monitor`, and don't use `ps`/`pgrep`.** Wait in
    one foreground Bash call (timeout 600000): `timeout 590 bash -c 'until <done>; do sleep 30; done'`, repeated if
    needed. Never poll more often than every 30 s.
  - Locally, run only the tests you're writing or changing. Don't re-run whole area specs before pushing: CI does that.
  - Look at final stills only (about 10 images in the job). Big output goes to a file; read its tail or a grep.
  - The machine is shared with other helpers today: run local e2e under the shared lock (`flock /tmp/claude-0/e2e.lock …`).
- Ports: 8797, 9229, 9331, 8788, 8811 may be taken; use others (and `--inspector-port`). Free a port you started with
  `fuser -k PORT/tcp`; never kill PIDs. Don't list processes, inspect /proc or the environment, print environment
  variables, read auth or config files, or call session or agent tools. Never force-push, rebase or push empty commits.
  Don't merge.
- **Don't open the PR** (not with `gh`, not through GitHub's REST API, not any other way). Push the branch and write the
  PR's title and full body to the file named in Deliver; the director opens it and watches CI. The body: what changed,
  every player-visible change and new text, changed checks old → new, the lane; it ends with these two lines:

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
- Commits end with your own `Co-Authored-By` line for the model you are and
  `Claude-Session: https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim`.
