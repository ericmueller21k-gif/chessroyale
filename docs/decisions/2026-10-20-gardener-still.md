# The hippo gardener: one still for Eric's review (Oct 20, 2026)

**Eric:** a hippo who waters plants and plants seeds (no name yet; his code id is `gardener`, no clash in the roster or the
code). His reference picture (ChatGPT's): an upright hippo with intentionally realistic proportions, a green apron with a
daisy pocket, a brass-and-green spray nozzle with water coming out of it, a hose reel on the ground. This step is his look
only: one still. His powers (hidden seeds on a timer, watering the board for his ultimate) and his animations come later.

## Second pass (Oct 21, Eric: three changes)

- **The apron is gone** (Eric: "the apron is no good either"), with its straps, pocket, daisies and the seed bag. He is just a
  hippo: grey-mauve back and sides, a pink belly with a navel, a pink throat. The seeds will come from his hand in the planting
  animation. The belly is bigger and pinker for it.
- **The hose is held in both hands.** The near hand is on the nozzle (spraying toward the board, as before); the other hand
  holds the hose 13 px behind it, so the line between the hands shows. From that hand the hose hangs across his belly and goes
  behind him at his side, where a small loop shows (the loop is drawn behind his body, so it comes out of it and goes back in);
  its end trails to a small coil on the ground by his back foot. **No coil on his shoulder** ("it looks like a shield"). The idle
  is no wider than the first pass (28 left, 25 right).
- **A friendlier face:** a bigger, round eye (4 x 4, a glint inside) and a smaller one for the far eye, and a soft smile line from
  the corner of his mouth up into his cheek. The head, muzzle and proportions are as they were.

## What was built

`packages/app/src/characters/gardener.ts`: `GARDENER` (`GARDENER_PALETTE`, one `idle` animation of one frame),
`GARDENER_PORTRAIT`, `gardenerLayers(pose)`. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster: nothing in the game draws
him. The preview draws him with its `extra=` option
(`npm run preview:characters -- <dir> extra=packages/app/src/characters/gardener.ts only=gardener`).
`packages/app/test/gardener.test.ts` checks the still (palette, the stage's 70 px, nothing cut off, the feet, the portrait)
and that a few poses redraw.

Parts are painted once and poses are numbers (`GardenerPose`), as the other bosses':

- **the nozzle hand** (`fist`, `elbowN`, `nozzle`: it aims; the elbow bends by itself) and **the water spray as a part of its
  own** (`spray` its length, 0 off; `droop`; `seed` picks the streaks and drops, so a flicker is a new seed each frame);
- **the other hand** (`hand`, `elbowF`) and **the hose**: the front of it is one part redrawn from the nozzle's fitting through
  that hand to his side (`sag` is how far it hangs across his belly), so it stays in one piece wherever either hand goes. The
  loop at his back and the coil on the ground are parts of their own, drawn behind him;
- **the head** moves as one (`head`), with **the jaw a part of its own** (`jaw`, degrees open: hinged under the cheek, the dark
  mouth and a tusk appear as it opens), **the ears** (`earN`, `earF`: lean at the tip), **the eyes** (`eyes`: open, half,
  shut, wide) and the nostrils in the muzzle;
- the tail (`tail`), the feet (`stepN`, `stepF`), his breath (`bob`).

The jaw hangs over his chest when it opens: a yawn needs the head raised or the nozzle hand lowered (`fist`), or the arm hides it.

## Calls made

- **Facing:** the reference flipped, three-quarters on, facing our left like the others, the nozzle toward the board.
- **Colors:** pinkish-grey skin in five tones, a salmon pink in four for his belly, throat, cheek and ears, a greyer lilac for
  the muzzle; a teal hose, brass (the game's gold at its top) for the nozzle, water in four blues. Outline `#1d1019`, halo
  `#2c2430`, light from the top left, so he reads on light and dark grounds.
- **Size:** a 84 x 88 frame, foot at (49, 82); 69 px from the halo over his ears to his feet, inside the select stage's 70
  (`TALLEST / PX` in `BossSelect.tsx`), so he is drawn at the usual 0.8. The frame has room to the left for the spray only as it
  is in the still; a longer spray (his ultimate) wants a wider copy of him, as Smudgy's and Moo's attack frames.
- **The phone's boss bar: he needs the `wide` box.** From his feet (outline, halo one more): 28 left (the muzzle's tip and the
  nozzle's cap) and 25 right (his back, the loop of hose, the tail and the coil); the usual box holds 24 each side, `wide` 29.
  The spray reaches 16 farther left (44), past `wide`: on the bar draw it short or off (`spray: 4`, `spray: 0`).

## Simplified for the pixel size

- **The hose:** a smooth tube, no ribs; the small coil on the ground is two turns in a six-pixel ring.
- **The spray:** streaks and drops in four blues, no mist; it has no outline (it is water), so on a light ground its palest
  pixels are lost and the middle tones carry it.
- **His skin:** no wrinkles, no pores; the muzzle has a few stubble dots and two nostrils, the ears a pink inside; no teeth or
  tusks while the mouth is shut.
- **His hands and feet:** fists with no fingers drawn, three nails on each foot, no toes.
- **The ground:** no grass or puddle, and no reel: the shadow only.
- **Head size:** a little bigger than in Eric's picture (about 40% of his height against 35%), kept for the big square muzzle.
