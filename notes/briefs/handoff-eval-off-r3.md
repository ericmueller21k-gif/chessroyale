# Handoff: the eval bar off, round 3 (CI red). Opus, high

Worktree `/home/user/cr-eval-off`, branch `claude/eval-bar-off`, head ce8e406, PR #447 (open; the director watches CI).
What the PR does: `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1c/evaloff/pr-body.md` (read it). In short: `evalBarOn()` is false for everyone, so no
eval bar on any board (testers included), the Testing row stays disabled, Babur's column has its own formula, the FAQ
line dropped. Players' boards were measured pixel-identical before → after.

CI run 41338573634 (e2e) failed:
1. `e2e/pig.spec.ts:197` "Wrangler's long pull as his first move, then a lasso drag (?power=drag)", phone and desktop:
   line 249 reads `page.locator(".eval-label").first().textContent()` for its diagnostic `turns` string, and there's no
   eval label any more, so it times out. Fix the test's diagnostic (no bar to read: use something that exists, or drop
   that part of the string); the check itself (a drag within 6 turns) stays exactly as it is.
2. `e2e/panel.spec.ts:82` "the panel under the board is never empty…" [phone]: tap 3 "Chat":
   `{"phase":"play","layout":"chat","height":140,"right":366,"width":342,"vw":390,"rows":0,"feed":23,...}`, expected feed
   > 30, got 23 (the same on retry, phase "watching"). Cause, very likely: this test ran as a tester with the bar on
   (board 312 wide) until now; with a player's 360 board the panel under it is shorter and the chat tab's message feed
   gets 23 px (one line). That is what **players** at this phone size get today on main (the chat tab is #446, live).
   Don't lower the 30 px check: it guards a real need (chat you can read). Find the phone size the test uses, look at
   the chat tab's layout there (a still), and make the feed at least 2 readable lines without moving or resizing the
   board (Eric's rule: the board never resizes for this). Your call how (e.g. the quick picks row smaller or tucked
   behind its own toggle when the panel is short); say it, with a before/after still. Another helper is working in
   `MiniTower`/the chat tab on another branch (`claude/crowd-panel-fixes`, the scoreboard flashing): keep your change
   small and local so it merges.
3. Flaky (passed on retry): `e2e/home-polish.spec.ts:149` desktop, "the hop's animation runs" got null. Check whether
   this PR could touch it (it shouldn't); if not, say so in one line and leave it.

Run locally only the tests you change (pig.spec:197 both projects, panel.spec:82 phone, plus your new check). Push to
`claude/eval-bar-off` (a normal commit, no force). Update `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/nov1c/evaloff/pr-body.md`: add the changes and the
changed checks old → new (the director updates the PR from it). Report: what failed and why, what you changed, the stills.
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
