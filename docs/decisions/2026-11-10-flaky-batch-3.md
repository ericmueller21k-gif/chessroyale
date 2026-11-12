# Flaky batch 3: main's new gate (Nov 10, 2026)

Found from main runs 1194-1199 (#590's method). **Sawyer's split** waits for room and then his next pawn move, both up to
his brain (run 1199: 21 moves, no split). New `?power=split`: a few real moves in, one of his pawns gone, so his first move
splits; the e2e also waits for his first saw cut. **opening-vote**: a Random opening can start with 30 or 31 pieces, and the
board shows 32 only for a moment, so the count now comes from the position. **chat:75**: already fixed by 0cf457b.
**colosseum:42: not changed.** On the shard's cold start the town didn't mount within 5 s of load: it waits up to 3 s for the
account, then about 1.3 s to load and draw, and every page load spends about 1.4 s drawing all boss art. Options are in the PR.
