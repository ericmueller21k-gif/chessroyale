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
