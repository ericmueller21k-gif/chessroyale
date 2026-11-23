# The phone's move panel draws only the rows that fit (Nov 23, 2026)

**Eric, Nov 23:** "if those pieces are showing 1987 we gotta fix this and see why things are being cleared from memory".
**Cause:** no leak. The phone's move panel (5 rows in view) never scrolls but drew every move, about 14 elements a row (10 of them a
bare avatar's two empty SVG layers): 120 moves were about 1,700 elements. Grex's fire tiles come and go (14-turn census: tops out near 300).
**Changed:** the panel draws the newest rows that fit its box plus two (measured; an even number left out so the stripes stay); the
sheet and a computer's column still draw all. A bare avatar skips empty layers. The long battle's check counts the page outside the
move list against its +40, and the panel's rows 120 plies in against what fits (the five visible rows alone are 50 elements).
**My calls:** two spare rows; a computer's scrolling column left as is (windowing it is more code than it's worth now).
