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
- **Sprites always on screen (Eric, Nov 4):** any figure you place or move must be fully on screen at rest and at the end of each
  move, on phone and computer. Overlapping the board or a menu is fine; cut off by the page edge never is. Check it in your stills.

## Spelling (Eric, Nov 5)
American English everywhere: player-visible text, docs, notes, PR bodies and reports. So: color, center, gray, favorite, honor,
realize, organize, meter, canceled, traveled. Don't rename existing code identifiers just for spelling.

## Keep it lean (Eric, Nov 6: "it shouldn't be this complicated … something has gotten bloated"; the audit of Nov 6 §4)
- **Stills and GIFs stay out of the repo.** Save them untracked (for example `<worktree>/stills/`, never `git add`) and report their paths to the director, who sends them to Eric. Commit an image only when a test reads it as a fixture.
- **The PR body:** at most 40 lines. What changed for players, the changed checks (old → new) and the test results. No restating the brief.
- **The decision note:** at most 10 lines. Eric's words, the call, and why.
- **Area pages (docs/areas):** add at most 5 lines per PR. Edit in place instead of appending history.
- **Prefer number checks to pixel checks** in new e2e tests: read positions and state through the test hooks (`__townCam` and similar) instead of sampling the canvas. Use pixels only when the pixels are the point, such as a sky gap.
