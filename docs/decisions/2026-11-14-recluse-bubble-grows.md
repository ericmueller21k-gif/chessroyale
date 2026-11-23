# The Hidden Boss's words above his head as he grows (Nov 14)

Eric (playtest, child form online on a computer): "When he transformed… his face was all covered up with his chat box because it was
still thinking he was the smallest size." Also the cutscene (the man's box over his face) and the phase change (his line by his empty
place, far from him on the board).

- **Causes:** beside the board the bubble's height was one number per drawing id in CSS; his child form is one drawing for every age,
  so it got the generic one (a ~60 px boss: about the 9-year-old's head). The cutscene's man spot was 38 rows low (the scene's headroom,
  `LIFT`). In the phase change his words stayed in his place's box while the board drew him.
- **Fix:** a kit's `heads` (each animation's tallest frame over his feet, measured from the art by a unit test) sets `--bc-head` as his
  animation changes; the cutscene spots measured from the frames; on the board a bubble over his figure (`.rc-say`), his place's box
  hidden meanwhile (a phone's bar bubble too: Eric's "every line… from above his head where he's drawn").
- **Call (as he grows):** the bubble moves, placed for the age he grows into from the step's first frame (the tallest drawing in it),
  rather than holding the line until the growth ends: the simpler one, and it never covers his face.
- **Call (phone, phase change):** the chant lines show whole over his head (sentences typed in turn), not paged in the bar; the bar's
  pages were for its two rows.

## Add-on: a conversation as he grows up (Eric, Nov 14)

Eric: "there was no conversation" when the beaten child grows into the man; "add them all and mix in". `RECLUSE_GROWUP_EXCHANGES` (five
pairs), one a fight (`growUpExchange`: `startMove` plus `levelBase`, the level's offset drawn from the battle's seed, since `startMove`
alone is 1 in every Boss alone fight). The kid's line replaces his `beaten` line; the man's is said (critical) as he's grown, about
3.5 s in. The fall was 4.2 s, so the man's match (which clears his voice) started 0.7 s after his first letter: `RECLUSE_CHILD.fallMs`
is 7.5 s (one setting, solo and the server alike; the longest answer typed by 5.2 s, readable 2.3 s; a unit test checks the fit).
