# The phone's move panel draws only the rows that fit (Nov 23, 2026)

**Eric, Nov 23:** "if those pieces are showing 1987 we gotta fix this and see why things are being cleared from memory or whatever,
that's a big efficiency issue and could be bad."

**The cause:** nothing leaked. The phone's move panel (125 px on an iPhone 13: five rows) never scrolls, but it drew every move of the
battle, about 14 elements a row: 120 moves were about 1,700 elements (`e2e/perf.spec.ts`: Grex's barrage 1,987 against 391; the long
battle 248 against 232, then 1,943 at 120 plies). G-REX's fire tiles come and go with the fire (census over 14 turns: the page tops
out near 300 elements and falls back as tiles burn out).

**What changed:** the panel draws the newest rows that fit its box and two more (measured, so a tall phone or a tablet gets more);
the sheet and a computer's column, which scroll, still draw every row. A bare pawn's avatar no longer draws two empty SVG layers
(10 elements). The long battle's check counted from an empty list with 40 elements' slack, which the panel's own five visible rows
are more than: it now checks the page outside the move list against the same +40, and the panel's rows 120 plies in against what fits.

**My calls:** two spare rows (a partial row, the stripes' even rounding); a computer's column is left drawing every row (it scrolls;
windowing it is more code than it's worth now).
