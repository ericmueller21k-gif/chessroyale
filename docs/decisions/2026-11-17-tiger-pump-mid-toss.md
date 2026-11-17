# Babur's place and his pump's, measured at rest (Nov 17, 2026)

Main went red (tiger.spec:552, Babur's pump at 1440 × 900 "tall", passed on its retry). Since #774 his toss turns him to his pump
(`.bc-flip`), and his drawn box then stands 4 art px over. A screen that mounted mid-toss ran `fitSides` from that box and stood him 13 px
further left; at 1440 the pump has 3 px to spare against the side menu, so from the next turn it went in the taller bar, and stayed there.
Both reads now take his box at rest in his place (`figureRestBox`, BossCharacter.tsx). Call made: no change to the 3 px margin itself
(the layout Eric playtested). Still true and not changed: once the pump is in the taller bar, `fitSides` (run only as a screen comes or
the window resizes) places him for that smaller board, so a one-off wrong read sticks until the window changes.
