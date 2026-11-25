# 50 v 50: the vote box as a standing skeleton, Nov 25, 2026

Eric, Nov 25: "a skeleton container that looks gray … sit there grayed out waiting to be filled … on mobile and desktop. They'll sit a
little differently … as opposed to making this thing constantly appear and reappear." Built: the 50 v 50's vote box always shows its
cap's rows (`slots`, as before); rows a round doesn't fill are gray skeleton rows (a bar where the move goes, the bar's gray track, no
shimmer), and a turn you watched gets a gray result line. **Calls made:** on a **computer** the skeleton rows sit in the 206 px slot
between reveals too (Play and the other team's turn), with the status line moved to the slot's foot, where the result line goes, so
the reveal fills the same rows in place. On a **phone** the 104 px slot holds the power-up row and status line between reveals (no room
for both), so the box appears at the reveal at its full height. 50 v 50 only: Squads and Classic don't use this box. Guard:
`e2e/crowd.spec.ts`, "50 v 50's vote box is a standing skeleton".

**Round 2 (Nov 25):** Eric, "do that also on mobile and desktop". The phone's box now stands too: power-up row (greyed through the
reveal), rows, status line, 6 px apart, the same 151 px in every phase (six rows; was 104), so the scoreboard sits 47 px lower all
game; the board is unchanged. **Calls:** the waiting line is one line (24 px; 13 px, 12 under 390 px, 11 under 360, measured to fit 320
px); shorter phones show fewer rows (6 from 760 px tall, 5 from 700, else 4; was 5 under 640, 4 under 600), because at 375x667 six (and
five) pushed the scoreboard under its three-row floor and its last row off screen; the box fills all its rows with the most-voted moves
(was five plus yours), so no row stays gray while moves are left out; a watched turn's empty result line is a row-like foot strip on
both. The laptop still's d3 (9) over Nf3 (21) was the real Strong pick rule (Nov 16), not staging and not a bug.
