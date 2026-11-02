# Brief: the test-value review. Opus, high. Report only: change nothing yet.

Eric (Nov 2): "I want the test value review… we need to be trimming our usage where we can." CI time and helpers' time
running and fixing tests are a big share of the project's cost. Goal: find the tests that cost the most for what they
catch, and propose cuts, merges or speed-ups. Eric approves before anything is deleted.

Worktree `/home/user/cr-testvalue` (main, read only for this job). Read CLAUDE.md's "Test lanes" and "Working lean",
`e2e/areas.json`, `e2e/ci-select.mjs`, `.github/workflows/*.yml`.

## Gather (cheaply)
- **Cost:** each e2e spec file's time in CI (CI warns "Slow test file: … took 23.2m": boss-bar-same, autochess 13-14 m,
  formats 12 m, crowd 6.6 m, maia 6.5 m, king-attack 6.5 m, town-chat 6.9 m, boss-smoke 6.3 m were seen on Nov 1). Use the
  GitHub MCP actions tools if you have them (list recent e2e runs on main, read the shards' logs' "Slow test file" and
  per-test times), else Playwright's `--list` plus the times in recent local logs. Also the unit tests' slowest files
  (`npx vitest run --reporter=verbose` once, or its duration output).
- **Value:** for the costliest ~20 tests: what they guard (an Eric rule in `docs/rules/eric.md`? a bug that came back?
  see `docs/history/lessons.md`, `.claude/LESSONS.md`, git log of the spec for "fix"), whether another test covers the
  same thing, how often it failed in the last ~2 weeks of CI and whether those failures were real bugs or the test's
  own flakiness (git log / PR history).

## Report (`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/testvalue/report.md`, about 1-2 pages)
1. A table: test, minutes per CI run, what it guards, overlaps, real catches vs its own failures, verdict (keep / speed
   up how / merge into X / cut), minutes saved.
2. Total CI minutes now vs after the proposals.
3. Never propose cutting a check that guards an Eric rule; propose speeding it up instead, and say so.
4. Anything else in the pipeline that wastes time (e.g. a shard always idle, a spec in the wrong lane, retries).
Plain words; Eric reads the top table. No code changes, no pushes.
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
