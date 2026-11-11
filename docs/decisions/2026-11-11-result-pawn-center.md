# Boss result: your pawn centered over its name (2026-11-11)

Eric (Nov 11, a phone screenshot of "Victory! You beat Dash!"): "my pawn ... doesn't look good where it's not straight with the
stuff below it. If we need to shrink the text a little, we can; we still have room, we can bring things over to the right a
little. It just looks sloppy."

The call: the pawn's art is centered over the XP column (its `-34px` margin override came out: it sat 20 px right of center). The
16 px gap to the boss then shrank, so the row gap goes 16 → 24 px (20 under 360): the boss moves 4 px left, the column 4 px right.
The text stays 15 px; no shrink was needed. Why: the gap rule is the one thing that can't move, and the row gap is the cheapest
place to buy the room back. Nothing moves vertically (measured in one run, old CSS against new).
