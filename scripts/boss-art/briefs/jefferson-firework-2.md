# Jefferson's Firework (a weapon, Boss Series Crate #1), redo

Draw **Jefferson's Firework**, a crate weapon your pawn carries at its side. Jefferson is the game's fire boss, a cocky
giraffe (the references `grex-*.png`), whose big move is a huge firework he lights.

## What read badly the first time
The first drawing (scripts/boss-art/out/jefferson-firework/jefferson-firework.tsx: you may read it; its look is the
reference `zz-round-1-read-badly.png`) reads as **a striped pole**, a barber pole: a long thin tube wound with diagonal
stripes. Beside the game's Candy Cane (red and white stripes) and the Gift-Wrap Tube, it looks like the same item again.
Don't build on it: start the shape over.

## Make it read as a firework rocket at a glance
The silhouette does the work: at 60 px a player must see "a rocket" before any detail.
- **A rocket**, held upright at the pawn's right side, slightly tilted, about as tall as the pawn's head is high above
  its base or a little more; **chunkier** than the first try (about 20 to 24 units wide), so it isn't a stick.
- **The body is the item's color** (the painted part: one `Region`, or a few named ones), with **one or two plain bands**
  around it in a fixed cream or gold. **No candy stripes, no diagonal stripes.**
- **A pointed nose cone** on top: a clear triangle or ogive, in a fixed color that contrasts with any body color (a
  bright gold, or a dark shade of the body: your call, check it across every color).
- **Two or three fins at the base**, flaring out wide past the body (the side fins clearly visible), in a fixed color
  or a darker shade of the body.
- **A short fuse out of the back** (the bottom, under the fins), a little dark cord, whose tip is a small fizzing
  **sparkler**: that's the motion. A few tiny sparks flicker and spit from the fuse tip, small and quick, never a flame
  (about 1 to 1.5 seconds a loop, 6 to 10 frames). Take Jefferson's flame colors for the sparks.
- No long launch stick: it would make it a pole again.
- "Yeah, this thing is sweet": bold, a little dangerous, fun.
- Tier: epic. Name it "Jefferson's Firework", id "jefferson-firework" (in your file, use the id this task gives you).
