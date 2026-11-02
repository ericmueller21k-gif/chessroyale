# Handoff: the Crowd's new cut schedule, round 3: finish after a container restart. Haiku

Worktree `/home/user/cr-crowd-cuts`, branch `claude/crowd-cuts` (head 2cd15f9, pushed). The round-2 helper was cut off by
a container restart while running one local e2e check. Everything else is committed: read `git log --oneline origin/main..HEAD`,
the decision note `docs/decisions/2026-11-01-crowd-cuts.md`, and the brief `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/brief-crowd-cuts.md` (its
Deliver section says what the PR body must hold).

1. Find the narrow-phones check the last commit changed (`git show 25c1d773 --stat`) and run that one test locally under the
   lock (both projects if it has both), on your own port (copy playwright.config.ts to an untracked file with another
   port; delete it after). If it fails, fix only what that commit touched, or report it if the cause is elsewhere.
2. `npm run typecheck`.
3. Write the PR body to `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/pr-body-cuts.md`: what changed (the schedule table), every player-visible change and
   new text, the sim's numbers before → after (from the decision note / report), changed checks old → new (from the commits'
   diffs of test files), the lane. End it with the two lines the rules give.
4. Push if you changed anything. Report: the test's result, anything you fixed, anything Eric must decide.
## Rules you must keep (every brief)
- Don't change any check that guards a rule in `docs/rules/eric.md`; list every changed check old → new in the PR body.
- Never base anything on, name or hint at a real person.
- **Push as you go:** commit and push your branch at each real step (WIP commits are fine), so a container restart or a
  stop loses minutes, not hours.
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
