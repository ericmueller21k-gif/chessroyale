# Desktop match: Moves and Chat in one column, round 2 (Eric, Nov 14)

Light lane. Effort medium. Continue on branch `claude/desktop-side-column` (`git pull` first). Round 1's `.pr-body.md` there says
what it did and what it left: read it, plus `docs/decisions/2026-11-14-desktop-side-column.md`.

Eric asked for (his words): "move up the moves thing so it's flush with the top of the chessboard. And then move up the chat box and
put it below it, make it the same width. And then the height would just come down. And then we have all this nice space for the
pawns." Round 1 did the chat (under the moves, same left and width, stopping above the God King: keep that). Left: the Moves panel
flush with the board's top.

1. Eric's ask overrides the Nov 1 layout ("the moves 36 px under the tools row", guarded in `e2e/desktop-board.spec.ts`): he gave his
   OK by asking for it (Nov 14). Move the tools row (the ⚡ / fish / 🏆 / gear buttons above the Moves panel) up so it sits level with
   the banner above the board (the "Move 2 / 59 moves left" bar), above the board's top line, right-aligned to the Moves panel's right
   edge as now. Then the Moves panel's top edge = the board's top edge (within 2 px), on every computer match layout that has the
   Moves panel (boss battles, Crowd, solo vs bots), at 1280x800 and 1920x1080.
2. Update the guard check in `e2e/desktop-board.spec.ts` from "36 px under the tools" to "the moves' top = the board's top; the tools
   row above the board's top line, not overlapping the banner's text". List old -> new in the PR body, and update the rule's words in
   `docs/rules/eric.md` if the Nov 1 layout is written there (say "Eric, Nov 14").
3. **Stills are required** (round 1 had none): one full screen at 1280x800 and one at 1920x1080 of a boss battle with the chat box
   showing. If an online battle with a second player is hard, use the same stand-in chat box round 1's check uses. Push them to
   branch `stills/desktop-side-column` (never under docs/). Also one still of a solo bot battle at 1280x800 (no chat) to show the
   Moves panel flush.
4. Run the whole `e2e/desktop-board.spec.ts` on the desktop project once (under the shared e2e lock), and typecheck.
Push; replace `.pr-body.md` with one body covering both rounds (short: what changed, player-visible, checks old -> new); `.done`.
No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 45 minutes.
