# The town square: no gold ring under you, one shadow (Oct 26, 2026)

## Eric's words
Of his dressed pawn in the town square, the gold ring under it and its shadow: "we gotta fix whatever the heck is
happening under these pawns. Either the yellow circle stays or the shadow but not both it looks sloppy, you choose based on
what we've discussed".

## The call (director)
**The shadow stays; the ring goes.** The shadow is what Eric asked for in his slice 4 test ("the shadows below never change
and makes it look like I'm floating"): it grounds the pawn and follows the hop. The ring only said which pawn is you, and
your gold name tag already says that.

## What changed
- Your gold ring (slice 1; drawn flat in the ground's perspective since slice 5) is gone, with `TOWN_FEEL.ringSize`.
- Your shadows match a bot's. They were sized from your sprite's box, which has a 15% margin each side for your items'
  hats and sticks (slice 5's dressed pawn), so a dressed you cast a shadow about 1.3 times a bot's: the dark slab under the
  ring in Eric's screenshot. `drawSprite` now takes the pawn's share of its box (`base`), and your soft shadow uses a bot's
  size (it had been made smaller, 0.6, to sit inside the ring).
- The small gold ring that marks your destination while you walk there (slice 4) stays: it's on the square you're going
  to, not under you.
