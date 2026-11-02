# Brief: the test-value changes Eric approved (Nov 2). Opus, high

Worktree `/home/user/cr-testvalue`, branch `claude/test-value` (from main). The review's findings are in the director's
notes: `git show origin/claude/director-notes:notes/STATUS.md` (the "TEST-VALUE REVIEW" entry) and its data in
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/testvalue/` (tests.txt, failures.txt, mainfail.txt, ci/). Eric's aim: **save our usage**. CI minutes on
GitHub are free; what costs is tests failing at random (someone reads logs, re-runs, fixes) and slow runs we wait on.
So the order is: random failures first, then speed, then the CI selection.

Do, in this order, one commit per item, pushing as you go:
1. **Fix the six flaky tests at their root cause** ("flake" isn't one): town :167 "page loaded again", :1086/:1139
   "circus in view", :1273 rides; autochess's 1.5 px tolerances; `e2e/helpers.ts:303` (`switchesOff`'s `route.fetch`
   after the page closed: public-profile's 11 flakes); recluse's desktop "c5 to c4 ≥ 950 ms"; crate-banner :41;
   chat-mod :18 / lobby-chat :102. Each: the cause in one line in its commit message. A check that guards an Eric rule
   (`docs/rules/eric.md`) is never loosened: fix the code or the test's timing, not the rule.
2. **Speed:** boss-bar-same (measure each line as soon as it shows, the box is full size from its first frame; one test
   per boss so they run in parallel); autochess (`?quick=1` wherever a test doesn't measure a step's length; width-loop
   tests in one project); king-attack on a computer: the 2 widest figures (the phone keeps all 12); town-chat-history and
   solo: phone only; maia :82: 3 bosses rotating (the unit test keeps all); boss-powers :415 every angle on the phone,
   one on a computer.
3. **Merge** formats :108 and :300's extra checks into crowd-hidden's two tests, then delete those two from formats.
4. **CI selection:** move `components/EvalBar.tsx`, `prefs.ts`, `test-switches.ts`, `screens/Hud.tsx`, `game.ts` from
   `full` to `traced` in `e2e/areas.json` (check `ci-select.mjs` traces them correctly), then refresh
   `e2e/ci-timings.json`.
**Not** doing: the boss-smoke trim (Eric: it's GitHub-side and it catches things: keep every boss on every PR).

Every changed check old → new in the PR body (`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/testvalue/pr-body.md`). Run locally only the tests you change.
Report: per item, done or not, minutes saved where measured, any check you couldn't fix without touching an Eric rule.
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
