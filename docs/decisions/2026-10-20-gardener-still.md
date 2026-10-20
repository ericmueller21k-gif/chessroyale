# The hippo gardener: one still for Eric's review (Oct 20, 2026)

**Eric:** a hippo who waters plants and plants seeds (no name yet; his code id is `gardener`, no clash in the roster or the
code). His reference picture (ChatGPT's): an upright hippo with intentionally realistic proportions, a green apron with a
daisy pocket, a brass-and-green spray nozzle with water coming out of it, a hose reel on the ground. This step is his look
only: one still. His powers (hidden seeds on a timer, watering the board for his ultimate) and his animations come later.

## What was built

`packages/app/src/characters/gardener.ts`: `GARDENER` (`GARDENER_PALETTE`, one `idle` animation of one frame),
`GARDENER_PORTRAIT`, `gardenerLayers(pose)`. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster: nothing in the game draws
him. The preview draws him with its `extra=` option
(`npm run preview:characters -- <dir> extra=packages/app/src/characters/gardener.ts only=gardener`).
`packages/app/test/gardener.test.ts` checks the still (palette, the stage's 70 px, nothing cut off, the feet, the portrait)
and that a few poses redraw.

Parts are painted once and poses are numbers (`GardenerPose`), as the other bosses':

- **the nozzle arm** (`fist`, `elbowN`, `nozzle`: it aims; the elbow bends by itself) and **the water spray as a part of its
  own** (`spray` its length, 0 off; `droop`; `seed` picks the streaks and drops, so a flicker is a new seed each frame);
- **the hose is one part from the coil to the nozzle's fitting**, redrawn from those two points (`sag` is how far it hangs),
  so it stays in one piece wherever the fist goes; **the coil** is a part of its own on his far shoulder;
- **the other arm** (`hand`, `elbowF`: it reaches into the pocket and tosses seeds), **the pocket** (drawn over the bag's
  foot) and **the seed bag** (`bag`: how many pixels stand out of the pocket, 0 down in it);
- **the head** moves as one (`head`), with **the jaw a part of its own** (`jaw`, degrees open: hinged under the cheek, the dark
  mouth and a tusk appear as it opens), **the ears** (`earN`, `earF`: lean at the tip), **the eyes** (`eyes`: open, half,
  shut, wide) and the nostrils in the muzzle;
- the tail (`tail`), the feet (`stepN`, `stepF`), his breath (`bob`).

The jaw hangs over his chest when it opens: a yawn needs the head raised or the nozzle arm lowered (`fist`), or the arm hides it.

## Calls made

- **Facing:** the reference flipped, three-quarters on, facing our left like the others, the nozzle toward the board.
- **The hose:** one continuous hose, as Eric asked (ChatGPT's two loose pieces): a coil slung over his far shoulder (his arm
  passes through it), its free end sagging across his chest, over his near arm, into the nozzle's fitting behind his fist. No
  reel (Eric: "whatever is easiest for the size constraints"). The hose is a teal green and the apron a leaf green, so the
  line shows where it crosses the bib.
- **The seed bag** (the director's touch): a burlap sack with its mouth cuffed, heaped with seeds and tied with red twine,
  standing seven pixels out of the pocket.
- **Colors:** pinkish-grey skin in five tones, a salmon pink in four for his belly, throat, cheek and ears, a greyer lilac for
  the muzzle; a leaf-green apron, a teal hose, brass (the game's gold at its top) for the nozzle, burlap tan for the bag, water
  in four blues. Outline `#1d1019`, halo `#2c2430`, light from the top left, so he reads on light and dark grounds.
- **Size:** a 84 x 88 frame, foot at (49, 82); 69 px from the halo over his ears to his feet, inside the select stage's 70
  (`TALLEST / PX` in `BossSelect.tsx`), so he is drawn at the usual 0.8. The frame has room to the left for the spray only as it
  is in the still; a longer spray (his ultimate) wants a wider copy of him, as Smudgy's and Moo's attack frames.
- **The phone's boss bar: he needs the `wide` box.** From his feet (outline, halo one more): 28 left (the muzzle's tip and the
  nozzle's cap) and 25 right (his elbow and tail); the usual box holds 24 each side, `wide` 29. The spray reaches 16 farther left (44),
  past `wide`: on the bar draw it short or off (`spray: 4`, `spray: 0`). The foot point is 2.5 px left of the middle of his two
  feet, so his reach is even on both sides.

## Simplified for the pixel size

- **The daisies:** the reference has several on the pocket and the hem; he has one white daisy with a yellow heart on the
  skirt and a white and yellow dot at its right.
- **The apron:** no tie bow at his back, no stitched seams but one row on the pocket's lip; two straps, the near one mostly hidden
  by his arm.
- **The hose:** a smooth tube, no ribs; the coil is three turns shown as three bands with a dark seam.
- **The spray:** streaks and drops in four blues, no mist; it has no outline (it is water), so on a light ground its palest
  pixels are lost and the middle tones carry it.
- **His skin:** no wrinkles, no pores; the muzzle has a few stubble dots and two nostrils, the ears a pink inside, the eyes a dark
  bead and a glint; no teeth or tusks while the mouth is shut.
- **His feet:** three nails each, no toes.
- **The ground:** no grass or puddle, and no reel: the shadow only.
