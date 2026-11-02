# Brief: auto chess's new reveal during the buy step. Opus, high

Worktree `/home/user/cr-acreveal`, branch `claude/ac-reveal` (from main). Area: `docs/areas/autochess.md` (read "The
opponent's board while you buy" and the reveal settings), `packages/app/src/autochess/`, `screens/AutoChess.tsx`,
`AUTOCHESS` in `packages/core/src/settings.ts`.

Today: the opponent's pieces show as plain circles 2 s behind, and every 5 s one is revealed at random (5 a buy step).
Eric (Nov 1-2) wants it fair and strategic. **The new rule:**
- **Live circles:** you see the opponent's placed pieces as circles live (drop the 2 s delay unless it's there for a reason
  you find; say it).
- **Reveals every 3 s, alternating sides, piece for piece by kind:** pawn ↔ pawn; knight or bishop ↔ knight or bishop
  (interchangeable); rook ↔ rook; queen ↔ queen. A side's piece is revealed only when the other side has an unrevealed
  piece of a matching kind to reveal back, so more expensive, unmatched pieces stay hidden. (Kings are never hidden.)
- **Placing first pays:** whoever placed first keeps that piece hidden: the first reveal of a pair is the opponent's.
  (Work out the exact order rule and write it down: e.g. pairs form in the order pieces were placed; within a pair the
  later placer's piece shows first.)
- Which of your pieces is next: the earliest placed unrevealed one that has a match (your call, say it).
- A sold or moved piece: say how it's handled (a revealed piece moved stays revealed; a sold one leaves its pair).
- At the move step everything is revealed (as today's full reveal).

**On screen (Eric's simplified look, Nov 2):** your own placed pieces are **slightly grayed** until your opponent has seen
them, then normal; the **next one to be revealed has a thin 2 px yellow border** (a warning); **no green**. The opponent's
side stays as today: circles until a piece is revealed. Mockups Eric saw: `/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/acmock/mock-1.png` … `mock-4.png`
(ignore their green).

Same for the bot as for a person (the bot is the opponent in solo; online if it exists, both sides). Settings in
`AUTOCHESS` (the interval 3 s, the kinds' groups). Tests: unit tests for the pairing/order rules (every case above), the
e2e reveal test updated (old → new listed), stills (phone 390 × 750: grayed, yellow next, after a reveal; a computer one).
Update the area page and the FAQ's auto chess words if they describe the reveal. Push as you go. PR body to
`/tmp/claude-0/-home-user-wordtrap/995c05e6-7525-5f8d-aa8a-f83ae6d5177e/scratchpad/acmock/pr-body.md` (every player-visible change and new text; changed checks old → new). Report: the rules you
settled, the stills' paths.
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
