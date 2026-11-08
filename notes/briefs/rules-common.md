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
  - **GitHub CI is the default test lane (Eric, Nov 8).** Locally, run only the 1–3 tests you are changing right now, for quick tries;
    everything broader (a spec file, an area, the full suite, repeats, the proof before you report) runs in CI on your push.
  - **Where to test (Nov 8, notes/throughput-audit-2026-11-08.md).** On your own machine (a helper session the director
    started with create_session) run local e2e directly, with no lock, on 2 workers. On the director's shared machine (a subagent),
    use only `notes/tools/e2e-quick.sh` (≤15 tests, `--repeat-each` ≤3, a 15-min cap on the lock wait).
    **Push early and often:** every push makes CI re-test your PR's areas in parallel for free. Read CI failures with
    `notes/tools/ci-fail.sh <sha>` (no token needed). The full suite, broad runs and repeat sweeps run only in CI.
  - **Self-check before you report.** Open every still you made and check it against the brief's numbers (inside the
    screen, the order, counts). If anything is clipped, overlapping, missing or out of order, fix it first. A defect the
    director finds costs a whole extra round.
- Ports: 8797, 9229, 9331, 8788, 8811 may be taken; use others (and `--inspector-port`). Free a port you started with
  `fuser -k PORT/tcp`; never kill PIDs. Don't list processes, inspect /proc or the environment, print environment
  variables, read auth or config files, or call session or agent tools. Never force-push, rebase or push empty commits.
  Don't merge.
- **The PR:** if your brief says to open it, open it through the GitHub MCP (`mcp__github__create_pull_request`), and then call
  `unsubscribe_pr_activity` for it. Otherwise push the branch and write the PR's title and full body to the file named in Deliver;
  the director opens it. Either way, the director watches CI and merges. Never use `gh` or the REST API. The body: what changed,
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
- **Stills and GIFs stay out of the repo.** On your own machine, deliver them on an orphan branch `stills/<PR#>` (images only, never on
  your work branch); the director deletes it after the merge. Save them untracked (for example `<worktree>/stills/`, never `git add`) and report their paths to the director, who sends them to Eric. Commit an image only when a test reads it as a fixture.
- **The PR body:** at most 40 lines. What changed for players, the changed checks (old → new) and the test results. No restating the brief.
- **The decision note:** at most 10 lines. Eric's words, the call, and why.
- **Area pages (docs/areas):** add at most 5 lines per PR. Edit in place instead of appending history.
- **Prefer number checks to pixel checks** in new e2e tests: read positions and state through the test hooks (`__townCam` and similar) instead of sampling the canvas. Use pixels only when the pixels are the point, such as a sky gap.

## Local servers (Nov 6: a standalone `wrangler dev` respawns after `fuser -k` and has blocked ports for hours)
- Never start `wrangler dev` by hand or in the background. Let Playwright start it (its `webServer`), so it stops when the run ends.
- Set your own port with `E2E_PORT=<port>` (default 8788, often taken) and stop copying playwright.config.ts (from PR #527 on). Each run starts
  from a fresh state folder (`E2E_KEEP_STATE=1` keeps `.wrangler/state`); a server already on the port is used only with `E2E_REUSE=1`.
  The scripts in `scripts/` default to `E2E_PORT` too.
- For stills or measurements that need a live server, run them as a Playwright spec or script under that same webServer.
- If a port still won't free after one `fuser -k`, stop and tell the director the port. Don't retry in a loop or hold /tmp/claude-0/e2e.lock while waiting.
