# Handoff: the Crowd's new cut schedule, round 2 (finish a stopped job). Opus, high

Worktree `/home/user/cr-crowd-cuts`, branch `claude/crowd-cuts`. A first helper was stopped mid-work (a usage rule, not
a problem with its work); the director committed and pushed everything it had as one WIP commit. Read that commit's diff
(`git show --stat HEAD`, then the files) and the original brief, which still holds in full:
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/brief-crowd-cuts.md` (Eric's approved table, what to build, what to measure, Deliver).

Its last step was the FAQ's bullet. Check what's done against the brief, finish the rest (the FAQ, the screens' "cut in
N", the sims' numbers before → after, the decision note `docs/decisions/2026-11-01-crowd-cuts.md`), remove the stray
`packages/sim/scripts/zz-crowd-sim-old.ts` unless it's needed for the before numbers (then don't commit it), merge
`origin/main` in (normal merge), run only the tests you changed, push as you go, and write the PR body to
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1d/pr-body-cuts.md`. Report as the brief asks.
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
