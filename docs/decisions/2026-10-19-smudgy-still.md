# Smudgy, the chameleon painter boss: a still for Eric's review (Oct 19, 2026)

**Eric:** the boss is **Smudgy**, a chameleon painter ("he learned painting because he always struggled to blend in
like the other chameleons"), after his reference picture. This step is his look only; his powers (Camouflage, Repaint)
come later.

## What was built

`packages/app/src/characters/smudgy.ts`: `SMUDGY` with `SMUDGY_PALETTE`, one pose (`idle`, a single frame) and
`SMUDGY_PORTRAIT`. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster: nothing in the game draws him yet. The preview
draws him through its `extra=` option
(`npm run preview:characters -- <dir> extra=packages/app/src/characters/smudgy.ts only=smudgy`).

He's built like the other bosses: painted parts (the head, the casque, the beret, the torso, the apron and its splats, the palette
and its dabs, the paint on the brush, the feet, the hands) and strokes from points (the legs, the arms, the straps, the
tail, the brush, his eyes) in `smudgyLayers(pose)`, so the poses and animations that follow are numbers in
`SmudgyPose`:

- **the brush arm:** `elbowF`, `fist`, and the brush's own axis, `brushButt` and `brushTip` (he'll paint and swing it);
- **the palette arm:** `elbowN` and `handN` (the palette moves with the hand);
- **the tail:** `curl`, `sway` and `swayPhase` (see Eric's edits below: it curls, uncurls and sways);
- **the eyes:** `gazeN` and `gazeF`, where each pupil looks (chameleon eyes swivel on their own: an idle for later);
- **the casque and the beret:** parts of their own, `casque` and `beret` move them and `beretTilt` tips the beret;
- `bob`, a crouch (the feet stay on the ground).

**The brush's paint is a part of its own** (`paintGlob`), in the palette keys `P`, `R` and `K` and no others (nothing
else uses them), so a frame's `pal` recolors the paint alone: he paints a piece your color or his by changing three
colors, not a drawing.

## Calls made

- **Facing:** three-quarters on, facing our left, as Alfil, Sawyer and Chub & Chirp (the reference is front-on). The
  brush is in his far hand, raised in front of his face; the palette is in his near hand, held out low in front of him.
- **Size:** a 94 x 84 frame (twelve empty rows above him for his poses). He's 68 px from the halo over his casque and brush
  to his feet: inside the select stage's 70 px (`TALLEST / PX` in `BossSelect.tsx`), so he's drawn at full size (0.8),
  as Alfil. He's 77 px wide: 42 left of his feet (the brush's paint and the palette; the side stage allows 44) and 34
  right (his tail; Sawyer reaches 35, Wrangler 37).
- **The phone's boss bar: he needs the `wide` box**, as Sawyer, Wrangler and Alfil. The usual box holds 24 px each side
  of his feet and the `wide` one 29; with it he's 13 px past the box on the left (9 past the bar's edge, which has 4 px
  of padding; Alfil 11, Sawyer and Wrangler 4) and 5 on the right. To check on a phone when he's wired in.
- **Colors:** lime green skin in five tones, a yellow-green jaw, and the three stripe colors (orange, teal and green) in
  four tones each; amber irises; a deep plum beret; a cream apron; brown leather and wood; the game's gold (`#f2c14e`)
  for the buttons; a yellow for the brush's paint that no other yellow in him shares (the dabs and the apron's splat
  are another). Outline, halo (`#26301f`) and light from the top left as
  the roster, so he reads on light and dark grounds.
- **The patchy stripes are the point:** the casque is striped in a fan of nine bands whose edges waver, the arms, legs,
  his back and his tail in diagonal patches of the same three colors, in a different order on each.
- **The portrait** is his head, beret, casque and eyes with the tip of his brush beside them (60 x 41), as Alfil's
  shows his ankus: without it the brush's handle ran into the box's left edge as a few stray pixels.

## Simplified for the pixel size

- **The apron:** four splats (a red one on the bib, a blue and a yellow one on the skirt, a green speck) where the
  reference has about eight, and no pocket or ties at the back; one strap shows (over his near shoulder), the other
  is behind his head.
- **The palette:** four dabs (red, yellow, blue, green), the purple one left out, no wood grain.
- **The tail:** a coil of about one and a third turns, not the reference's two: with the turns closer together they
  merged into one lump at this size. The stripes are bands of about 4.6 px that waver, not even rings.
- **The brush:** the paint is a dollop with three drips, not the reference's swoosh; plain tan bristles, no grain on
  the handle.
- **His face:** the whites of his eyes are a thin edge and the lid's shade, no brows; a snout no longer than the first
  still's, only pointier (a longer one met the brush's handle); no scales or skin texture.
- **The beret:** a plain plum disc with two folds, a band and a stalk, no stitching or sheen.
- **His hands and feet:** the fists are small round blobs with the fingers lined across, and each foot has three toes
  with no claws; the legs show only their knees and shins, the apron's hem covers the thighs.

## Eric's edits (Oct 19, second pass)

**Eric** liked the still overall and asked for: a painter's beret ("one of those hats that those painters wear... from
the old Renaissance period... That'd look funny too"), yellow paint on the brush ("it kind of looks like ketchup"), the
tail as his main animated part, and optionally a small tweak to the face to look more chameleon.

- **The beret** (`beret(tilt)`, a part of its own over the casque and the head): a soft floppy disc about 24 px wide,
  tipped 13 degrees with its front down and a puffed lip drooping there, two folds, a darker band round its foot and a
  stalk on top. **Deep plum** (`A`, `T`, `Z`, `o`: `#2a0e34` to `#9059a3`): navy would vanish on the dark ground
  (`#14161b`) and a light color would on the light one; the plum's lightest tone catches the top left on the dark ground
  and its darkest edge reads on the light one, and it sits apart from all three of his stripe colors. A pose moves it
  (`beret`, a bounce) or tips it (`beretTilt`, in degrees, each tilt a part made when first drawn).
- **The casque is shorter** (it was a tall oval above his head, which read like a balloon): a fin whose top is under
  the beret, so about 14 px of it show below the beret's lip (was about 25) and its stripes flow up out of the back of
  his head. The fan of nine bands is the same.
- **Yellow paint:** `P`, `R` and `K` are now a dark amber, a yellow and a pale yellow (`#b97c06`, `#f7c60f`,
  `#fff48c`). Still its own part, still the only keys it uses, so `pal` still recolors it alone.
- **The tail, his main moving part**, is walked along from his hip (`tail(curl, sway, phase)`) instead of laid out as
  a fixed spiral, so its length never changes as it moves:
  - `curl` 1 is the spiral he stands with (its curve tightens toward the tip), 0 a loose hook hanging out behind him
    (still inside the frame), between them it winds up and lets go;
  - `sway` is how far a ripple bends the tip, in radians, and `swayPhase` where the ripple is: animate the phase and the
    tail swings, and the ripple grows toward the tip;
  - the spiral is a little bigger and thicker at the root (4.1 px radius, was 3.7) and its stripes a little darker, so
    the coil reads bolder. It is still a coil of about one and a third turns (see above).
  - Each distinct (`curl`, `sway`, `swayPhase`) is a part made when first drawn (rounded to 0.02), so an idle that
    cycles them makes a few dozen parts once.
- **The face, a small tweak:** a pointier snout (its tip a point, not a blunt end), each eye in a turret: a thicker
  rim of skin round the opening, darker on its inside edge, a lid over the top of the opening, the iris and pupil
  peeking out; the eyes set further apart (13.5 px, was 11) and a little bigger (the turrets 13 and 11 px); the mouth
  runs from the snout's tip into a smirk that curls up about five pixels into his cheek. Not done: a longer snout (it
  would run into the brush's handle) and the eyes further down the head's sides (they'd cross the casque and the
  jaw). The eyes are a little less big and round than before (the thicker rim): the first thing to take back if Eric
  misses them.
- **Size:** unchanged where it matters: 68 px tall (the beret and the brush's paint share the top), 77 px wide, 42 left
  of his feet and 34 right. He still fits the select stage at full size and still needs the phone bar's `wide` box.
