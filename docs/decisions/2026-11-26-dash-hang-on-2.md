# Dash's "Hang on", round 2 (Nov 26, 2026)

**Eric, after playing it:** "he wasn't pressing it. He needs to press it ... a ridiculous speed for a few seconds when he says cheetah
speed ... he should have his head like up and then like lean back, so clearly his like mouth is pointed up into the air ... he should
jump onto the middle of the board when he does it ... the whole thing should have lasted like a few more seconds."

- **The cause:** the animations were chosen and played (watched frame by frame with real taps, phone and computer, test switch and the
  real pop-off-then-"Hang on" path), but round 1's smack was his move's slap: the paw moved 10 of his 104 pixels, from his chin to the
  button, and the slow smacks held it at his chin most of each beat. The head "up" was his head moved 2 pixels. In a phone's bar
  (58 px wide) that is 2 or 3 screen pixels. And cheetah speed (80 ms a smack) was slower than the pop-off's (70).
- **Now:** each smack comes from over his head onto the button with sparks (his stall slam's idiom); cheetah speed is 44 ms a smack
  (the quickest of all his: a unit test compares every clock-smacking animation) with a second paw's blur and his head thrown back
  (his head drawn alone and turned 50° about his neck, snout and open mouth up); cheetah speed 3 → 6 s, the gag 12.6 → 15.6 s.
- **Director's call, as briefed:** he jumps from his spot onto the board's middle as "Hang on" begins (half the board's height, whole on
  the screen), does it all there, and zips back as your piece slides home, before his move. Built as his clock tap's portal
  (`dash-away` keeps his spot's place); the jump and the zip are the element's own animations. *(mine: the figure covers the middle
  squares meanwhile; nothing can be played then, and pre-moves are already held during the gag.)*
- The routine is its own figure (`DASH_HANG`), so his bar's and the computer's fits (barScale, SIDE_REACH) stay his standing figure's.
