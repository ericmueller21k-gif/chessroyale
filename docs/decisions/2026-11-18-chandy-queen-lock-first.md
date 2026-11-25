# Chandy's queen lock as his first unlock: only when it can come, and a refusal tries again (Nov 18, 2026)

The review of #797 (low 1): with your queen on the board but nothing to shield her, the queen lock was still his first unlock and its
slot sat dead until upgrade 2 ("about 6 of 20"). The director's brief: first only when it could come now. Measured
(reports/chandy-sim.md, run G): that check never changed an unlock in 20 battles, and the dead slots stayed at 10 of 20. The cause was
elsewhere: in all 10 the queen lock came due and the pass guard refused it (his first capture is often mid-trade, so passing would
cost him the recapture); with nothing else unlocked the meter emptied (the review of #739: "none: it empties") and needed 6 more of
your moves, by which time upgrade 2 had come.

Calls made:
- **The queen lock first only when it could come then** (`queenLockAim` on the board after his capture, you to move: the test
  `queenLockOk` makes after his pass); else the usual random unlock. Kept though the sim never hit it: it's the review's case, and cheap.
- **A queen lock the pass guard refuses, with no other move unlocked, stays due** (the meter full) and is checked again on his next
  turn: the pass guard's own rule for every power that spends his turn (Oct 18: "checked again on his next turn, with no cap"), and
  what a queen lock that can't come already did. With another move unlocked the meter still picks it (unchanged).
- **Result** (20 battles each): never fired before upgrade 2, 10 → 5; 4 of the 5 had upgrade 2 the very next turn (the guard kept
  his capture), 1 had the guard refuse four turns running. The trade: the aim is his whole turn, so upgrade 2 comes about 1.5 of
  your moves later (from upgrade 1, median 3.5 → 5); upgrades 3 and 5 unchanged.
- Not a change: a queen shot that shatters a piece between his first two captures doesn't teach (no mark, no upgrade; the review's
  note 4, as the header says: "his engine's own moves").
