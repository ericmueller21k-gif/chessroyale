# Director status (rebuilt Nov 1 09:20 UTC after the container restart wiped the scratchpad)

## Rules (see the summary; key ones)
- Helpers push only; the director opens PRs via GitHub MCP from the helper's pr-body file; unsubscribe PR activity after
  opening (the subscription can arrive late: unsubscribe again on its event); one CI watcher per sha.
- Every brief pastes the Working lean rules (CLAUDE.md since #437). Fresh helper for every round or job.
- After each batch: `python3 .claude/tools/helper-usage.py <tasks dir>` (fixed in #437: counts each reply once).
- Main since #438: one run at a time; a skipped main commit's checks read "cancelled" (covered by the next run; its
  summary lists "The merges this run covers").
- Scripts: scratchpad/wait-ci.sh <sha>, scratchpad/wait-version.sh <prefix> (rebuilt: version.json + /api/status).

## State
- main a2f721a (#438) on top of 60975fa (#435), 878e551 (#436), 97d83ee (#437). Watcher bw982pbdd: deploy + main CI.
- #435 ride size + GamblingWarning Escape fix (useLayoutEffect): merged 60975fa.
- #438 CI selection: merged a2f721a. Check main's first push run summary ("merges this run covers").
- Colosseum pixel round 2: helper running (handoff colosseum-cup/handoff-pixel-round2.md), worktree /home/user/cr-colo-pixel.
- Rides v2: helper running (brief eric-notes/brief-rides-v2.md), worktree /home/user/cr-rides-v2.
- Lost in the restart: Eric's Colosseum reference picture (ask him to re-send), all stills/GIFs, old briefs, the full
  notes log (rebuilt condensed), audit data (the report's findings are in docs/decisions/2026-11-01-usage-audit.md).

## Waiting on Eric
- Re-send the Colosseum reference picture.
- Where to keep the notes log durably (a private doc, or a branch in the public repo).
- Crowd team table in Light mode: restyle?
- Brush plum seat pad keep/drop; beaver size; token examples OK; per-ride sizes after testing; key design; payments setup.
- Nov 1 09:30: Eric's three building: crowd phone scoreboard (Haiku, cr-crowd-board), board size Large/Compact (Haiku, cr-board-size), autochess TFT economy (Opus, cr-ac-econ). Briefs in nov1b/.
- Nov 1 09:35: board-size helper redirected to a MOCKUP of Eric's new desktop boss layout (no title line, icons right of board, bar at top, side menu back). Stop after stills.
- Nov 1 10:00: main a2f721a green + live. 60975fa's main run red: town.spec:1273 'beside you: 22,17' (phone both tries, desktop flaky); a2f721a passed it → intermittent; rides v2 helper asked to root-cause.
- Nov 1 10:15 Eric: build boss screen (helper running, cr-board-size), notes on branch claude/director-notes (cr-notes; copy + push after updates), team table light → in crowd round 3.
- Nov 1 ~10:45: Colosseum round 2 → PR #439 (9d6f57a, CI b372jbqw7); merge when green; ref picture in repo docs/refs/colosseum-high-view.png.
- Nov 1 ~11:00: #439 Colosseum MERGED bd54f83 (deploy/CI blz376ezv). #440 autochess economy opened (0328eee, CI watcher). Crowd round 4 running.
- Nov 1 ~11:15: #441 crowd phone scoreboard opened (cddae0b, CI beiw2juvi). Round 4 helper slip: one send_message call (refused). Earlier helpers: none of the 3 slips touched secrets.
- Nov 1 ~11:35: #440 autochess MERGED 8675efd (after my 2-number test fix). Worktrees cr-ac-econ, cr-colo-pixel removed.
