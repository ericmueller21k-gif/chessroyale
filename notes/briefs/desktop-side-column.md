# Desktop match: the Moves panel and the Chat box line up in one column (Eric, Nov 14)

Light lane (layout: markup and CSS). Effort medium. New branch `claude/desktop-side-column` from `origin/main`. Read
`.claude/LESSONS.md`, `docs/rules/eric.md` (look for rules about the desktop board, the side panels, chat, and "nothing hidden,
nothing shifts") and `docs/areas/` pages for the match screen and chat before changing anything.

Eric's screenshot (computer, a boss fight, the Hidden Boss as the kid): on the right of the board, the "Moves" panel starts well below
the top of the board and is narrower than it could be; the "Chat" box starts lower down, sits further right, is a different width,
and runs down beside the pawns and the boss sprites. Eric: "This chat box looks horrendous... We need to move up the moves thing so
it's flush with the top of the chessboard. And then move up the chat box and put it below it, make it the same width. And then the
height would just come down. And then we have all this nice space for the pawns."

Do exactly this, on computers (desktop layouts) only; phones unchanged:
1. Find the desktop match layout: `packages/app/src/components/MovePanel.tsx` (the Moves panel), `components/GlobalChat.tsx` /
   `components/QuickChat.tsx` (the Chat box: find which one is "Chat" with "Send a message"), and their CSS in
   `packages/app/src/styles.css` / `game-frame.css` / `board-size.css` (search for the class names).
2. The Moves panel's top edge lines up exactly with the top edge of the chessboard (the board's own top border, not the banner above).
3. The Chat box goes directly under the Moves panel, a small gap between them (the gap the page uses elsewhere between panels),
   the SAME left edge and the SAME width as the Moves panel.
4. The Chat box's bottom lines up with the board's bottom edge; its height is whatever is left. The two panels form one tidy column.
5. The pawns (the players' little pawn row with ✓ and Kick) and the boss sprites keep their place to the left of that column, with
   nothing overlapping them. If they overlapped the old chat, they now have the free space.
6. Check every desktop match that shows these panels: a boss fight (Hidden Boss child form, and one other boss, e.g. `?boss=` test
   switches if the area page lists them), a normal Crowd match. Check 1280x800 and 1920x1080.
7. Nothing hidden, nothing shifts: the panels keep their size while the match goes on (no jump when a move or chat line arrives).

Take one still per size (1280x800 and 1920x1080) of a boss fight after the change, pushed to branch `stills/desktop-side-column`
(never commit images under docs/). Add one focused check to an existing desktop e2e spec (e.g. `e2e/desktop-board.spec.ts`): the
Moves panel's top equals the board's top (within 2 px), and the Chat box's left and width equal the Moves panel's. Run that spec on
the computer project under the shared e2e lock; typecheck.
If a guard test in `docs/rules/eric.md` would have to change, stop and write it in `.pr-body.md` instead (Eric's OK needed).
Push; `.pr-body.md` (short: what changed, player-visible, checks old -> new); `.done`. No PRs, no CI waits, no model names in commits
(end commits with the Claude-Session line only). About 45 minutes.
