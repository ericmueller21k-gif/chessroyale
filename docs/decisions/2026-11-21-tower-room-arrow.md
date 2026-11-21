# Tower floor room: the floor arrow, the solid table, the clerk's card (Nov 21, 2026)

**Eric (Nov 21):** "a little like 3D blinking arrow that points after you go back and after you win ... right on the floor, right in
front of the door"; "make it so you can't run through the chessboard ... if you just press like up ... it would just make you run around
it"; the clerk's card "should only be coming up if you click like right in front of the clerk, or if you click on the penguin guy".

**What changed:** after a floor, a gold slab arrow lies on the floor before the next door, blinking (`floorArrow`, `arrowBlink` in
`tower-floor.ts`; drawn by `tower-floor-scene.ts`, under every figure). The table's four squares are solid; a held arrow key that would
step onto them walks you round its nearer side and on (`room.ts stepRound`, the art's `round` squares). The clerk talks only from the
three squares under his counter (`talkAt`), not the 3 squares round him.

**Calls made:**
- After the run ends (`out`), the arrow points at the way down: it is the next door then (the brief named the won case only).
- Reduced motion: the arrow is held full, no blink.
- Only the tower's table is walked round; other rooms' solid pieces still stop a held key, as before (not asked).
- The other rooms' NPC and door taps were checked: a tap on a Shopkeeper opens his card only from his own picture, a door's from its
  picture (plus 10 px). Every other Shopkeeper's small "Talk" card still shows standing within 3 squares (the Nov 2 design); only the
  clerk's big panel was over-wide. If Eric wants the same rule everywhere, it's one `talkAt` per shop.
