# Chandy's rules (Nov 16, 2026)

Eric's design (`DESIGN.md` on `stills/boss-chandy`; his answers, else option A). Calls made building it: Dodge plays as your
turn begins, like Dash's Scramble Rush; the design's teleport times stay (round 3's last leaves exactly 1.2 s). Steering reuses
his top-8 search: take a locked piece within 2 pawns, else chase within 0.75 (L5: 1.5 and 0.5 gave 88% in the sim). The first
lock needs a piece he can take at least even, never the king or queen. The queen lock is a pass under the pass guard; its shot
fizzles if it would leave your king in check or hand him a promotion. Bots vote the safe square 60% of the time; ties and empty
votes come from the seed. Lines, words and sounds are placeholders for Eric. `reports/chandy-sim.md`.
