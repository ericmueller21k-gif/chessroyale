# The circus tiger: one still for Eric's review (Oct 23, 2026)

Lane: `characters`. Area page: [bosses.md](../areas/bosses.md). Made the way the hippo's still was
([2026-10-20-gardener-still.md](2026-10-20-gardener-still.md)): look only, nothing wired.

**Eric (Oct 23):** a circus tiger who hated his role (the loud roaring, jumping through hoops) and wanted to make the silly
balloon animals he saw someone making. No name yet: his code id is `tiger` (no clash in the roster or the code). His powers
come later (he blows up balloons on a pump nozzle in the boss bar, which become pieces; his ultimate throws three burning hoops
onto the board: [2026-10-23-boss-bar.md](2026-10-23-boss-bar.md) has the room for the pump). His reference, "the image to use is
the one where the balloons look like balloons": a realistic tiger on all fours in a small black top hat with a red band, a red and
gold ringmaster's vest, one paw raised holding the strings of chess-piece balloons. The second picture (him standing on his hind
legs) is only "how we may alternate between standing and being on all 4".

## Second pass (Oct 23, Eric on the first: "you can't even tell he's a tiger in his face... I think it's fine that he's a little chunkier... we just need to make sure his face is clearly that of a tiger")

The build, the size (70 px, the `wide` box: 29 either side) and the colors of his body are the first pass's. Changed:

- **Nothing covers the face.** The pawn balloon, which hung beside his muzzle, is smaller and up with the others (the bunch now
  ends above his forehead and ahead of his brow, 8 px clear of his nose); the strings are shorter and straighter, run behind his head
  and into the fist at his front; the paw is lower and farther forward, under and ahead of his chin; the raised arm is drawn behind
  his head, so his cheek ruff flares over his shoulder instead of the arm cutting into it. The hat is smaller and tipped back
  (`hatTilt` 12, its front up) at the top of his skull, so his whole brow shows under it.
- **A face that reads "tiger" first**, in the order the picture reads it: *contrast* (an orange face, a bright white muzzle and cheek
  ruffs, black bars: the cream ramp is lighter now, `#fff8e8` at the top), *bold brow bars* (five black bars across the forehead, the
  middle ones longest, stopping above the eyes so the orange shows between them and the eyes), *white cheek ruffs flaring out at his
  sides* in points, with two black stripes into the near one, a black line from the outer corner of his eye; *a white muzzle* with a pink nose
  under a dark line, a dark line down to his lip and four whisker dots; *amber eyes in dark rims* (6 x 3 and 5 x 3 px, up from 4 x 3
  and 3 x 2); *round dark ears with a white spot* and an orange rim, one each side of the hat; the whiskers a tan so they show on both
  grounds. The head is 25 px across with the ruff (it was 21), same body.
- **The portrait is the face and the hat** (`TIGER_PORTRAIT`, 27 x 27 from the ears and hat's top to under his chin; the pawn's
  new size keeps the bunch out of it), checked at 1x, 2x and 3x (`tiger-face-1x-3x.png` in the review pictures).

## What was built

`packages/app/src/characters/tiger.ts`: `TIGER` (`TIGER_PALETTE`, one `idle` animation of one frame, the still),
`TIGER_PORTRAIT`, `tigerLayers(pose)`, `TigerPose`. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster: nothing in the game draws
him. The preview draws him with its `extra=` option
(`npm run preview:characters -- <dir> extra=packages/app/src/characters/tiger.ts only=tiger`).
`packages/app/test/tiger.test.ts` checks the still (the palette, the stage's 70 px, nothing cut off, the feet, the phone bar's
`wide` reach, the portrait) and that a few poses and every balloon redraw.

Parts are painted once and poses are numbers (`TigerPose`), as the other bosses':

- **the raised paw** (`paw`: the fist; the elbow bends by itself) and **the strings** as a part of their own, redrawn from each
  balloon's knot through one gathering point into the fist wherever they go;
- **each balloon is a part of its own** (`balloons`: where each hangs, so it bobs; `gone`: out of the bunch, as one handed over to
  the pump). The rook is drawn too, for the pieces the pump will make, but isn't in the bunch;
- **the hat** (`hat`: where it sits; `hatTilt`: it tips and bounces), **the head** as one (`head`), with **the jaw** a part of its
  own (`jaw`, degrees open: hinged under the cheek), **the ears** (`earN`, `earF`), **the eyes** (`eyes`) and the whiskers;
- **the tail** (`tail`: it swishes), **the legs** (`stepHN`, `stepHF`, `stepFF`: each foot's lift) and his breath (`bob`).

**Standing up later (the second picture):** each leg is a tube through its joints (hip, knee, hock, ankle: the pose already moves the
feet and sinks the hips) and the body a tube through three spine points (constants now), so a pose on his hind legs is those points
given as numbers (the hips under the shoulders, the forelegs hanging, the head up), not a redraw of the art; the raised arm already
takes any paw place. The frame will need headroom then (as Puddles'
pack did: `OX`, `OY` are numbers, the parts are painted in scene pixels).

## Calls made

- **Facing:** the reference flipped, side on with the head turned to us, facing our left like the others, so the balloons are toward
  the board.
- **Four balloons, not six** (Eric allowed 4 or 5): a red king, a blue knight, a yellow bishop and a purple pawn. (Later the same
  day the bunch was redrawn sharper, with the pump's balloon drawings: a red queen, a blue knight, a green rook and a purple pawn, no
  king: [2026-10-23-tiger-animations.md](2026-10-23-tiger-animations.md).) The pawn is the
  piece the pump will make most, so it is in the bunch, small, at its lower left. A green rook was drawn and tried as a fifth, but at this size
  it hid behind the others and read as a green bone, and the pink pawn is a second pawn. Each balloon is drawn as a silhouette and
  shaded by one rule (a light rim at its left, a dark one at its right and under it, a shine), so they all look inflated alike.
- **Size:** a 76 x 78 frame, foot at (36, 74): 70 px from the halo over the king's top to his feet, exactly the select stage's 70
  (`TALLEST / PX` in `BossSelect.tsx`), so he is drawn at the usual 0.8. The tiger himself (feet to the top of his hat) is 45 of
  those; the balloons are the rest, which is why he stands lower on the stage than Puddles or Sawyer, who are all body.
- **The phone's boss bar: the `wide` box, not `tall`.** From his feet, halo included: 29 left (the pawn and the knight) and 29 right
  (the tail), the `wide` box's 29 either side; his height is the usual 70. To get there the balloons are tucked over his muzzle and the
  tail curls up close behind him; a test keeps it. His bar drawing may leave the bunch out later (his balloon will be on the pump).
- **Colors:** orange in five tones, cream in four (chest, belly, muzzle, ruff, paws), black-brown stripes, an amber eye, a red vest
  in four tones with the game's gold at its edge, a black hat in four with a red band, each balloon three tones and a white shine.
  Outline `#1f1210`, halo `#3a2a22`, light from the top left, so he reads on light and dark grounds.
- **Head size:** about 25 px across with the cheek ruff (Eric's picture has about 16 px at this scale): kept bigger so the face reads
  at 0.8, a big head being the house style.

## Simplified for the pixel size

- **Stripes:** thin tapered bars down from the spine every 3 px (ten along his back, the first four under the vest), stopping short of the
  cream belly; one pattern for
  the flank, three arcs on the thigh, a few bars on each leg and the arm, rings on the tail. The picture's double and forked stripes
  and the fine fur are gone.
- **The face:** orange crown, brow and bridge, a cream muzzle and ruff, a pink nose, two amber eyes in dark rims, five bars on the brow,
  a line from each eye and two stripes in the cheek ruff; no fur tufts, no teeth or tongue while the mouth is shut (the jaw opens as a part), the whiskers three strands.
- **The vest:** red with a gold edge, two gold diamonds and three buttons; the collar stands up behind his neck. The picture's
  embroidery and lapels are not drawn; the raised arm hides most of the front.
- **The paws:** cream with two toe lines each, no claws; the raised paw is a fist with the strings going in at its top and two
  loose ends under it.
- **The balloons:** no twisted-balloon seams or knots but the one at the bottom; their strings are one pixel, curved, brown.
- **Ground:** a shadow only.
