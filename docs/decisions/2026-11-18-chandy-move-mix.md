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
