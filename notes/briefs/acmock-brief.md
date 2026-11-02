# Brief: a still mockup of auto chess's new reveal (no game code). Haiku

Worktree `/home/user/cr-acmock` (main, read only: don't commit). Make 4 still images, phone 390 × 750, of the auto chess
buy phase (`packages/app/src/screens/AutoChess.tsx`, `docs/areas/autochess.md`; test link `/?mode=autochess&quick=1&intro=0`
or whatever the area page lists). Take a real screenshot of the buy phase with a few pieces placed, then draw the new
look over it with CSS injected into the page (Playwright `addStyleTag` / `evaluate`), so it looks like the game.

Eric's design (Nov 1), to show:
- The opponent's placed pieces show as circles (live). Every 3 s one piece is revealed, alternating sides, piece for
  piece by kind: pawn for pawn, knight/bishop for knight/bishop, rook for rook, queen for queen. A piece with no match
  on the other side stays hidden.
- **Your own pieces:** slightly grayed out until your opponent has seen them; the next one to be revealed has a thin
  2 px yellow border; when revealed, its square glows soft green for a moment, then keeps a thin glowing green border
  ("they've seen it").

The 4 stills: (1) your pieces placed, all grayed, the next one yellow-bordered; (2) the reveal moment: its square
glowing green; (3) after a few reveals: green-bordered ones, grayed ones, the yellow next one; (4) the opponent's side:
circles, two revealed pieces. Save to `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/acmock/mock-1.png` … `mock-4.png`. Use your own port; free it after.

Report: the 4 paths, one line each on what it shows. Nothing else.
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
