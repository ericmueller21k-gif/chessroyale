# Handoff: the eval bar off, round 5: Hollow's Lights Out prompt pokes above the screen on a computer. Opus, high

Worktree `/home/user/cr-eval-off`, branch `claude/eval-bar-off`, head cb9f74d, PR #447 (the director watches CI; don't open
or edit it). What the PR does: `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1c/evaloff/pr-body.md` (read its top). In short: no eval bar for anyone, so
admins' and testers' boards now lay out as players' always have.

CI run 41348465447 failed `e2e/hollow.spec.ts:208` [desktop] "Hollow's Lights out (the admins' trigger)…", both tries:
`round 3: his box` → `frame 1: off screen 358,0,562,83` (hollow.spec.ts:280; the per-frame watcher at ~line 170-190:
top < 0 counts as off screen; the rounded top shows 0, so it's a fraction above). On main the same test was flaky once
(b8a0971, passed on retry), so the cause is older and the bigger board just makes it hit every time. Players have this
board size already, so it's likely a real, player-visible glitch: one frame of the prompt box above the screen.

The box: `SpeechBox` (`packages/app/src/speech.tsx`, ~line 270) with `.pm-line.lo-line` (styles.css ~14555: `bottom:
101%` of the board, sized in `cqw`, so it grows with the board; `fits` 3 steps then a move into view). Its fit check runs
once per line in a `useLayoutEffect` keyed on `[fit]` at mount. Suspects: the layout around it changes after mount (the
dock, a banner, the round's marks, the font) so a box fitted at mount ends up a fraction over the top; or the fit's
`r.top < 0` misses a sub-pixel case; or round 3's line is the tallest.

Find the **root cause** ("flake" isn't one), fix it in the product so the box is never above the screen on any frame
(and never moves the board), and keep the test's check exactly as it is (it guards "on screen every frame"). Run
`hollow.spec.ts:208` locally (desktop and phone) several times under the lock, plus any test you change. Push to
`claude/eval-bar-off` (normal commits; push as you go). Append a "Round 5" section to the PR-body file: cause, fix,
changed checks old → new (none expected). Report: the cause in plain words, the fix, how you proved it (e.g. the
frames' tops before and after), one still.
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
