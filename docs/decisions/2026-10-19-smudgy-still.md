# Smudgy, the chameleon painter boss: a still for Eric's review (Oct 19, 2026)

**Eric:** the boss is **Smudgy**, a chameleon painter ("he learned painting because he always struggled to blend in
like the other chameleons"), after his reference picture. This step is his look only; his powers (Camouflage, Repaint)
come later.

## What was built

`packages/app/src/characters/smudgy.ts`: `SMUDGY` with `SMUDGY_PALETTE`, one pose (`idle`, a single frame) and
`SMUDGY_PORTRAIT`. He isn't in `CHARACTERS`, `BOSS_KITS` or the roster: nothing in the game draws him yet. The preview
draws him through its `extra=` option
(`npm run preview:characters -- <dir> extra=packages/app/src/characters/smudgy.ts only=smudgy`).

He's built like the other bosses: painted parts (the head, the casque, the torso, the apron and its splats, the palette
and its dabs, the paint on the brush, the feet, the hands) and strokes from points (the legs, the arms, the straps, the
tail, the brush, his eyes) in `smudgyLayers(pose)`, so the poses and animations that follow are numbers in
`SmudgyPose`:

- **the brush arm:** `elbowF`, `fist`, and the brush's own axis, `brushButt` and `brushTip` (he'll paint and swing it);
- **the palette arm:** `elbowN` and `handN` (the palette moves with the hand);
- **the tail:** `tail`, its turns of spiral (it curls and uncurls);
- **the eyes:** `gazeN` and `gazeF`, where each pupil looks (chameleon eyes swivel on their own: an idle for later);
- **the casque:** a part of its own behind the head, `casque` moves it;
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
  four tones each; amber irises; a cream apron; brown leather and wood; the game's gold (`#f2c14e`) for the buttons;
  a red for the brush's paint that no other red in him shares. Outline, halo (`#26301f`) and light from the top left as
  the roster, so he reads on light and dark grounds.
- **The patchy stripes are the point:** the casque is striped in a fan of nine bands whose edges waver, the arms, legs,
  his back and his tail in diagonal patches of the same three colors, in a different order on each.
- **The portrait** is his head, casque and eyes with the tip of his brush beside them (58 x 41), as Alfil's shows his
  ankus: without it the brush's handle ran into the box's left edge as a few stray pixels.

## Simplified for the pixel size

- **The apron:** four splats (a red one on the bib, a blue and a yellow one on the skirt, a green speck) where the
  reference has about eight, and no pocket or ties at the back; one strap shows (over his near shoulder), the other
  is behind his head.
- **The palette:** four dabs (red, yellow, blue, green), the purple one left out, no wood grain.
- **The tail:** a coil of about one and a third turns, not the reference's two: with the turns closer together they
  merged into one lump at this size. The stripes are patches, not even bands.
- **The brush:** the paint is a dollop with three drips, not the reference's swoosh; plain tan bristles, no grain on
  the handle.
- **His face:** the irises fill his eyes (the whites are a thin edge and the lid's shade), no brows; a shorter snout
  than the reference's (a longer one met the brush's handle); no scales or skin texture.
- **His hands and feet:** the fists are small round blobs with the fingers lined across, and each foot has three toes
  with no claws; the legs show only their knees and shins, the apron's hem covers the thighs.
