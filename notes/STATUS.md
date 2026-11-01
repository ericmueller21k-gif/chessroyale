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
- Nov 1 ~11:45: rides v2 PR #442 (26eb9d5; CI buhmaxtq4); GIFs sent. Follow-up: lazy-load ride drawings (+55 KB gzip main bundle). Fixes main's flaky 'beside you' test (camera settle).
- Nov 1 11:20: wait-ci.sh now also waits for queued workflow runs (a main e2e waiting its turn has no check runs). My slip: a stray './wait-ci.sh 0000000 &' (PID 27319) polls the API ~2/min for up to 80 min, then exits; not killed (PID kills need Eric's OK).
- Nov 1 ~11:50: #441 CI red (4 tests, all branch-caused: round-4 min-height moved phone board 14 px vs main; desktop qunread in new header; panel split layout). Round 5 Haiku helper fixing. Board layout round 2 Haiku helper running (labels ≥1800, narrow columns, no board smaller than today).
- Nov 1 ~11:55: #442 rides v2 MERGED bb5e7a1 (deploy/CI watcher). Next: lazy-load ride drawings follow-up (+55 KB gzip).
- Nov 1 ~12:00: main 8675efd (#440) full e2e GREEN (queued run, new wait script worked).
- Nov 1 ~12:20: #441 round 5 72b8ada fixed board position; blocked on short phones (390×664: 62 px under board, chat feed 0). My call: option (a) middle box height from screen height (200 → ~118), ≥3 bars + yours. Round 6 Haiku running.
- Nov 1 ~12:40: #443 computer game screens opened (8d60f28, CI b4002hc91). Every board ≥ main's at 5 sizes; gaps 1024×768 (−24) and 1800–1856 raid.
- Nov 1 ~12:45: rides v2 bb5e7a1 LIVE (deployed 11:56 UTC) and main full e2e GREEN incl. WebGL town.
- Nov 1 ~13:05: #444 rides lazy-load opened (4480573, CI bwk5i8z84). Helper slip: pkill -f on its own respawning wrangler. Pattern: wrangler dev respawns after fuser -k (seen twice) → give helpers a clean stop recipe.
- Nov 1 ~13:30: #443 CI red (13 desktop tests across problems/resign/autochess/boss-party/boss-character/home-layout/boss-bar/eval-bar/grex/tiger). Round 3 Opus high helper fixing; failures saved in nov1b/board/ci443/failures.txt. Brief now has a wrangler-stop recipe (no pkill).
- Nov 1 ~13:45: #444 rides lazy-load MERGED 26d39e1 (deploy/CI watcher).
- Nov 1 ~14:45: #444 lazy-load LIVE 26d39e1, main GREEN incl. WebGL.
- Nov 1 ~15:30: #443 computer game screens MERGED 3e2c70c (deploy/CI watcher). #441 round 6 CI running (bpvsib32p).
- Nov 1 ~15:45: #441 50v50 phone scoreboard MERGED 19c0fe2 (deploy/CI watcher). Follow-up: 'Wh…' header ellipsis in split layout.
- Nov 1 ~15:55: usage check after the restart: 14 helpers 297M re-read total (top 80M rides v2), 0 Monitor loops: audit rules working. Header 'Wh…' fix helper running (Haiku, cr-crowd-head).
- Nov 1 ~16:30: #443 layout LIVE 3e2c70c, main GREEN. #441 scoreboard LIVE 19c0fe2 (main CI pending, watcher bkqfp7e4a). #445 header fix CI b15stpun1.
- Nov 1 ~16:55 Eric (iPhone, angry): #441 wrong on his phone: 200 px box at his Safari's ~390×750 left 2 scoreboard rows. Wants: box = vote results height, scoreboard fills below, chat as 4th tab (Black·White·All·Chat) replacing scoreboard with Back, ONE result line. Haiku redo (claude/crowd-phone-v2), stills first. #445 closed (superseded).
- Nov 1 ~18:10: 50v50 redo PR #446 (a4faa55, CI bn471cxid); stills sent; MERGE ONLY AFTER ERIC OKs. fuser -k 9441 freed a stray listener (PID 9136).
- Nov 1 ~18:20: Eric APPROVED #446 stills → merge when CI green. Eval bar off for everyone: Haiku helper (cr-eval-off); players unchanged (it was testers-only); admins now same as players; Colosseum spectator bar kept *(mine)*.
- Nov 1 ~18:45: #446 50v50 phone redo MERGED 58c9dd3 (deploy/CI watcher).
