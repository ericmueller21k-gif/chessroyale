# Chandy's checkmate way into Dodge: the art (Nov 26)

Eric, Nov 26: on your mate "it pauses and he jumps onto the center of the board and collapses, and then he reaches his arm out
... towards your king, and that's when he zaps it ... and then it starts [the Dodge] ... if you do succeed ... something a little
extra too right before it ends, just clearly showing that you win."

Phase 1 (art only, not wired): `characters/chandy-mate.ts`, `CHANDY_MATE` (his rig, palette and size; 18 px taller over his head
for the jump's lift, 6 px under his feet for the slumped rifle). Calls made:
- **The collapse is a kneel, not lying flat**: slumped on his knees, head hung, lens dark. Prone, his short arms (16-21 px) reach
  no farther than his chin; kneeling, the reach clears his head at every angle and reads at phone size.
- **The reach comes at four angles** (-30, 0, 30, 60 degrees below level), mirrored for a king on his left (`nearestReach`). His
  king is usually below him on the board, so most picks are 30 or 60; straight down hid the arm behind his body, so 60 stands in.
- **The leap is the component's** (a CSS arc from his spot to the center); the sprite does the crouch, spring and tuck.
- **The zap** is his hand charging and a short bolt off his claws in the sprite; the bolt across the board to your king is the
  board's (his Lock-on Shot's round art, recolored or as is: phase 2).
- **The win beat** reuses what's there: he sputters out and falls flat on his back with dizzy stars (Ginger's and Grex's
  `lieDown` way), your king glowing gold and the existing cut-in banner, then the results.
- Cues reuse his existing sounds (no new sound in phase 1): unsling (gear rattle on the crouch and landing), whoosh (the spring),
  fizz (the lens dying), lock (the reach), aim (the charge), fire (the zap), unlock (powering down in the KO).
