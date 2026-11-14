# The Hidden Boss's transformation: the book's light, the suit, no God King absorption (Nov 14, 2026)

**Eric's words** (mockup rounds 1 to 3b and the eyes, Nov 14): no glitch back to his place and no stealing the King's power; the book
opens at his feet and its light transforms him; his arms "just in a more relaxed position to his side the whole time"; "make his eyes
totally white like he's possessed"; "the light needs to keep emitting more and more until it totally engulfs him and shoots up, even off
the board, off the screen… it radiates in all directions and totally flashes and whites out the whole screen"; "make the
transformation happen when you can't even see it"; "then it comes back down… it dies back down to the center, and then it shows him";
the final form "a full exoskeleton-style futuristic armor… don't make it look like war… more like computer networking, that sort of
wiring… a matching full-head helmet… the full front visor flips up, and that's when he says something, and then he flips it back
down"; "blue eyes, go". And: "the back of the chessboard should be gone the moment the board starts splitting."

**What changed:** the phase change is his transformation, carrying on from his cutscene with no break (its child fade and light lift
gone), the split on the transformation theme's drop; the God King stays greyed in his place throughout (his absorption, its stream,
lines, sounds and dock states removed); his half-engine eye is replaced by the suit and helmet, worn by part names on every drawing.
The mockups (stills, GIFs, round by round): branch `stills/recluse-transform-book`.

**Calls made:**
- **The music leads by 0.3 s** (`musicAtMs`): the theme's intro starts 0.3 s into the phase change, not at its first frame, so a
  device that shows the phase change a moment late (a timer, a slow frame, online) still plays the whole intro; at 0 the e2e caught
  it falling back to "loop only". Every beat is measured from the intro's start.
- **His second line** comes 0.8 s after the landing (it can't fit before the drop with the first after the reveal); its last words
  type as he's home, so they end in his place's bubble (his words where he is).
- **No "revive" line** at the book's return: his second line is speaking then.
- **The suit is part swaps, not an overlay:** every part has a suit version of the same size and place, so all his existing poses
  wear it with no new frames; the tie comes off; the helmet hides his hair.
- **Kept his older phase change's animations** (seize, rage, leap, drop, chant) and their cue sounds for now: unused by the game,
  the chant's frames still light the book; a follow-up can delete what stays unused.
- **The header's small portrait** (a computer's boss bar) keeps his face: the engine eye never showed there either.
