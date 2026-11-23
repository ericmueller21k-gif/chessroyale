# Chandy's move mix: the least fired first (Nov 18, 2026)

Eric, Nov 18, after a real game: "he literally had all 5 but kept spamming the scatter shot, used barrier once ... he did use the double
beam once but he randomly skipped one entirely." Measured before changing anything (reports/chandy-sim.md, run E): the meter's pick was
a plain random one among the unlocked moves (not the last), so a battle's six or seven moves often went three or four to one move and
none to another (3 battles of 10 had one move at half his moves; the queen lock, one pick among five, came in 1 battle of 10 though it
could come on 41% of turns); and a pick that couldn't land fell through to a random other move, his last one included. The dice were
fine (20,000 seeds: rolls independent). Call made: `meterOrder` keeps Eric's rule (the newest unlock first, never the one he fired last
while another can come) and breaks the rest by how often each has fired this battle (`ChandyState.fired`), ties from the seed; the
fallback takes the next in the same order. With one move to fire it still repeats (Nov 16's rule). Queen lock, for Eric to decide: now
in 4 battles of 10 (was 1); to have it in nearly every battle, with no queen of yours he could aim at your most valuable rook instead.

**Two more (Eric, Nov 18, later):**
- **The queen lock earlier.** Eric: "Oh you're right the queens were gone in this game. Let's try to make that upgrade happen earlier."
  The director's call: while you have a queen, the queen lock is his first unlock; with no queen at an unlock, the unlock is random as
  before, so it never wastes an early slot (`queenLockFirst`, `unlockPick`). Call made: it holds for any unlock while it's still
  locked and you have a queen (in the sim always the first). Its firing rule is unchanged. Sim (20 battles each, run F): first unlock
  in 20 of 20 (was 3), aimed in 14 battles of 20 (was 5), 0.9 a battle (was 0.3); the pass guard had it wait 12 times (was 4).
- **Faster upgrades.** Eric: "the upgrades happen too slow, I think for the 1st and 2nd capture he should apply the same thing where
  he locks onto the 2nd piece he captures right beforehand." His first two captures (`teachCaptures` 2) are each locked as the move
  shows (`firstLock`, the same moment solo and online) and are upgrades 1 and 2; never steered until then; the hunt from the third
  (`marked`, then `taught`). Sim: upgrade 2 at crowd move 11 (median, was 15.5), upgrade 3 at 18.5 (was 21.5), the fifth unchanged
  (27, was 25.5: upgrades 3 to 5 are the hunt's). The crowd's results didn't move (2 draws, 18 boss wins, both).
