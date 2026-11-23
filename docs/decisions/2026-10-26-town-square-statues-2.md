# The town square: the statues, round 2 (Oct 26, 2026)

Follows `2026-10-26-town-square-statues.md`. Phone and computer.

## Eric's words (Oct 26, after trying the statues)

- The pedestals: "what we want to do is put them on a normal size block, but … when it zooms in, then the text appears.
  … with a zoom in, you should definitely be able to fit the text on it. … it can just be much smaller, but because of
  the fact that you're zoomed in on it, you should be able to do some fancy logic where … it can write it once it's
  zoomed in and you can see it." And: "on the block from a zoom out, add little squigglies so it looks like something's
  written, but it's just literally squiggly lines … someone might be like, oh, maybe if I click on this, I can read it."
- The bronze statue: "[he] looks pretty good, actually. Honestly, it's just that damn hair. It looks like the sides of
  his head are bald. So it needs to come down a bit on his side, and then the top needs to be sliced quite a bit." And:
  "his hair is still just slightly too bushy … it almost looks like too afro-y. So it needs to come down about half of
  what it is."
- The marble statue (the Hidden Boss): "just does not look like him … the book is all weird … we should do away with
  the book. … just use the reference of his boss picture. I mean, it should basically look the same as that."

The real person the bronze statue depicts is still never named anywhere: it is `bronze`, "the bronze statue".

## What changed

- **Normal-size pedestals.** Each statue now stands on a block of 40 × 24 Coliseum pixels (was 52 × 44), about the
  size of the chess pieces' plinths beside it (38 × 20): a base course, a die, a cornice. Its panel (34 × 15, rim
  included) shows **no words at the world's scale**, only four short squiggly lines, like writing too small to read
  (a pixel wide, waving a row up and down; up close, a thin wavy stroke): engraved dark in the marble, cast light on
  the bronze plaque.
- **The quote only up close.** Once the camera has arrived, the panel's flat field fades in over the squiggles as the
  first line comes, and the quote renders in line by line as before: written at the screen's own resolution in the
  signs' pixel capitals, the biggest whole size whose wrapped lines fit the panel (crisp: whole device pixels a font
  pixel), with the signs' 2-pixel leading or 1 where that allows a bigger size. Measured with the bronze statue's
  (longer) quote: **12.5 px letters on a 360 × 640 phone**, 12.5 on a 390 × 664 phone (the e2e phone), 15 on a
  390 × 844 phone, 15 on a 1280 × 800 and a 1440 × 900 computer, 12.5 on a 1280 × 600 window at 2x; the marble
  statue's shorter quote 15 to 25. Still in the off-screen live region, word for word, with no attribution.
- **The close-up's framing.** Still the whole statue, as big as fits. Where it would reach the − / + and "Back to me"
  buttons (a phone), it now goes round them whichever way lets it be bigger: ending above them (as before), or **moved
  off the middle to end beside them** (new: a horizontal shift `ox` for the lens in `camera.ts`, gliding in with it).
  On a phone the second wins, so the statue is about 15% bigger and its quote fits at 12.5 px.
- **The bronze statue's hair, about half as bushy.** The top cut well down (it reached 4.6 statue units over his
  skull, now about 1.6), and the hair brought down his sides to the tops of his ears with short sideburns, so his temples
  aren't bare: short curls, full but close to his head (rounded, a little square at the top, as in the photos). Both
  levels of detail (the world's head is typed by hand: three rows of hair where there were six). Nothing else on him
  changed.
- **The marble statue is the Hidden Boss's own picture in marble.** Built from `RECLUSE` (`characters/recluse.ts`,
  unchanged): his standing idle frame drawn without the book's layers, the book arm hanging as his other arm does
  (its elbow and wrist that arm's mirror) and its hand his free hand mirrored; then each color mapped to the marble
  shade of its lightness (nine shades, his darkest navy lifted to a mid grey, since marble is never dark), his outline
  kept. So it has his silhouette and face at a glance: the swept hair parted on our left, the lock on his brow, the
  long face, heavy brows, the half-smirk, the rolled-up sleeves, the tie and its clip, the belt. **No book**: both arms
  hang relaxed. He stands on a marble slab. His picture is twice the world's scale: the close-up doubles each of his
  pixels (Scale2x, so its diagonals stay smooth); the world's figure takes them two by two (filled where most of the
  block is him, the mean lightness, outlined anew), with the head touched up by hand (the part, the lock, the brows,
  the eyes, the smirk).
- Everything else stays: walk up (or tap) → the glide in → the finer drawing crossfades in → the quote; any other tap, a
  drag, a chip, −, +, "Back to me" or Escape glides back to the zoom you had. No raised arm on either statue.

## Judgment calls

- **Letters at 12.5 px, not 15, on a phone.** A plinth-sized block on a whole statue framed on a 360 × 640 or 390 × 664
  phone can't hold the 70-character quote in 15-px pixel letters; the brief asks for about 12 to 14. The e2e check
  moves from at least 14 to at least 12 (it pinned the old, big pedestal). A 1x window shorter than about 700 pixels
  (1280 × 600) drops to 10 px (the next whole size down); at 2x it holds 12.5.
- **The whole statue still fills the close-up** (the e2e keeps "its head in view" and "its pedestal's foot in view"):
  rather than framing tighter on the pedestal and cutting off his head, the panel was made as big as a plinth-sized
  block allows (its rim the die's edge, almost no margin) and the statue moves beside the buttons on a phone.
- **Squiggles drawn into the pedestal**, at both levels of detail, and covered by the panel's flat field as the quote
  comes (one fill, no extra drawing kept): simplest, and they're there in the close-up until the camera arrives.
- **The marble by lightness, lifted** (`MARBLE_LO`): a straight lightness map made his trousers and hair near black,
  which reads as paint, not stone; lifting the darkest to a mid grey keeps his look (dark hair and trousers, white
  shirt, a darker tie) while it stays marble.
- **His close-up is his own pixels doubled**, not redrawn 4 times finer: it should "basically look the same" as his
  boss picture, and doubled with Scale2x it is that picture, a little coarser than the bronze statue's close-up.
- The statues' squares in the e2e now come from `STATUES` (they follow the Coliseum if it moves).
