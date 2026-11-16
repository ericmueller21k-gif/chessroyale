# Chandy's rules (Nov 16, 2026)

Eric's design (`DESIGN.md` on `stills/boss-chandy`; his answers, else option A). Calls made building it: Dodge plays as the
crowd's turn begins, like Dash's Scramble Rush; the design's teleport times stay, so round 3's last leaves exactly 1.2 s.
Steering reuses his top-8 search: take a locked piece within 1.5 pawns, else chase within 0.5. The first lock goes on a piece he
can take at least even, never the king or queen. The queen lock is a pass under the pass guard; its shot fizzles if it would
leave your king in check or hand him a new promotion. Bots vote the safe square 60% of the time; ties and no votes come from the
seed. Lines, banner words and sounds are placeholders for Eric. Tuned by `reports/chandy-sim.md`.
