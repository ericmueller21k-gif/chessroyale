# 50 v 50: the vote box as a standing skeleton, Nov 25, 2026

Eric, Nov 25: "a skeleton container that looks gray … sit there grayed out waiting to be filled … on mobile and desktop. They'll sit a
little differently … as opposed to making this thing constantly appear and reappear." Built: the 50 v 50's vote box always shows its
cap's rows (`slots`, as before); rows a round doesn't fill are gray skeleton rows (a bar where the move goes, the bar's gray track, no
shimmer), and a turn you watched gets a gray result line. **Calls made:** on a **computer** the skeleton rows sit in the 206 px slot
between reveals too (Play and the other team's turn), with the status line moved to the slot's foot, where the result line goes, so
the reveal fills the same rows in place. On a **phone** the 104 px slot holds the power-up row and status line between reveals (no room
for both), so the box appears at the reveal at its full height. 50 v 50 only: Squads and Classic don't use this box. Guard:
`e2e/crowd.spec.ts`, "50 v 50's vote box is a standing skeleton".
