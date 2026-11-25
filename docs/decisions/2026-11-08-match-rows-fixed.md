# 2026-11-08: the match screen's rows never move (50 v 50)

Eric (Nov 8): "nothing on the match screen moves". On a phone in a 50 v 50, the ⚡ row and the status box jumped between
picking, move in and the other team's vote.

Calls:
- The ⚡ row sits at the top of the box under the board on every phase (the move-in position), not centered.
- The status slot under it is a fixed 42 px on phones (56 px on a computer, the banner's own height), reserved and empty
  while picking. Two lines of text fit it, so a long line never grows it.
- The other team's vote screen shows your ⚡ row too, greyed (no history to step through), so its place is the same.
- Test: `crowd.spec` "the match screen's rows never move", one game through 390×844, 360×740 and 1280×800; the row tops,
  the slot's top and height and the table's top within 1 px in all three phases.
