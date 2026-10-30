# Folio's Paper Crown (a head item, Boss Series Crate #1), second redo

Draw **Folio's Paper Crown**, a crate hat. Folio is the game's paper crane boss (the references `folio-*.png`): an origami
crane folded from a single page of handwriting, warm cream paper, faint lines of ink.

## Start from the last try
The last drawing is scripts/boss-art/out/folio-crown-2/folio-crown-2.tsx (you may read it; its look is the reference
`zz-round-1-redo-read-badly.png`).
- **Keep its crown:** the folded paper crown in the item's color, sitting on the head (brim at y 25, attach 25), its
  zigzag points, two-tone faces, the band with handwriting squiggles and the gold diamond. It sits well; change it only
  as much as the bigger crane needs (for example lower or flatten the points so the crane has room).
- **The crane doesn't read as a bird at 60 px.** At phone size it's "something cream and spiky on top". Fix only that.

## The crane: bigger and simpler
- **A bold silhouette**, about twice as big as before, sitting on the crown's middle (it may be wider than the crown
  and overlap the band): a **pointed, boat-shaped body**; **two big wings**; **a neck rising to one side with a small
  pointed head and beak**; **a tail point rising to the other side**. The classic origami crane, nothing more.
- **Fewer, bigger pieces:** each wing one or two big flat faces, no small creases, no squiggles on the crane. Outline it
  with the house line ({...LINE} or lw(2) at least), not a hairline, so its shape holds on the dark ground and on a white
  pawn.
- Colors: Folio's warm cream with one tan shade face per wing and at most a touch of gold (#f2c14e). Keep it clearly
  lighter than the crown so it stands out in every color (check Yellow, Opal and Pearl, the palest).
- **Its motion:** the wings slowly fold and unfold: down along the body, lifting into a V, holding, folding back down
  (about 3 to 4 seconds a loop, 8 to 12 frames). The wing change must be clear at 60 px.
- **Nothing above y -9 on the pawn in any frame** (the avatar's clip cuts it). Make room by lowering the crown's points,
  never by shrinking the crane back down.
- At 60 px it must read as **a paper bird on a crown**. Look hard at the 60 px cells before calling done.
- "Yeah, this thing is sweet": delicate, elegant, a little magical.
- Tier: legendary. Name it "Folio's Paper Crown", id "folio-crown" (in your file, use the id this task gives you).
