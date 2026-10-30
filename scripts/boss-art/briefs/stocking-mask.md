# Stocking Ski Mask (a head item, Winter Crate)

Draw the **Stocking Ski Mask**, a crate hat for the Winter Crate: **a Christmas stocking pulled over the pawn's head like
a ski mask**, worn upside down. Funny and a bit of a heist ("the elf who robbed Santa").

- **The body is the item's color** (the painted part, a `Region`): the stocking's knit covers **the pawn's whole head**,
  a little bigger than it so no white or black of the head shows around it (the head: center (50, 29), radius 9, its top
  at y 20; the neck about y 35 to 38). A soft knit look: a few faint rib lines or a simple knit pattern, kept quiet.
- **The white fuzzy cuff is always white** (a fixed color, never the item's color): a fluffy band ringing the bottom of
  the mask where it meets the neck (about y 33 to 40), a bumpy, furry edge like a stocking's cuff; a soft grey shade so
  it reads on a white pawn.
- **The toe is at the top**, flopping over to one side like a hat's tip: the stocking's rounded toe (a heel bump is a
  nice touch, if it reads) bends over and hangs a little down one side of the head. Optional: the toe's tip in a
  slightly darker shade of the body, the way stockings have a contrasting toe.
- **Holes for the eyes and the mouth**, cut out so the pawn shows through (white on the white pawn, black on the black
  one): two eye holes on the eye line, **y 29**, centered about x 46 and x 54 (where the pawn's eyes are: the Ninja Hood
  in Items.tsx ~1175-1200 draws eyes there; read it), and a mouth hole about y 33.5. Draw a small dark eye in each eye
  hole, as the Ninja Hood does (light eyes on the black pawn).
- **Goggles and shades go on top of it** (Ski Goggles and Dark Shades are face items drawn over hats: crates.ts's
  `faceLayer: "above"`). They span about x 37 to 63, y 23 to 35. So keep the eye line at y 29 and nothing busy across it.
  The render shows your mask with each of them on top: check that it looks right (goggles over a ski mask is the joke).
- Attach 25 (the head anchor), so your drawing's coordinates are the pawn's.
- **Its motion:** the toe's tip sways a little, side to side, slow and soft (about 2 to 3 seconds a loop, 6 to 10
  frames). Everything else stays still.
- Nothing above y -9 in any frame.
- "Yeah, this thing is sweet": cozy, silly, a little bit criminal.
- Tier: legendary. Name it "Stocking Ski Mask", id "stocking-mask". Write a one-line description with a little humor.
