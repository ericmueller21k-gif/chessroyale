# Armored Birdie, variant B (chunky), Nov 23: a still idle only (Eric's design)

After the train hits him in his ultimate, Birdie transforms. Eric: "he takes on the color scheme of the train, like he has like armor on
his wings, and now he's standing up on like both legs, and he kind of looks like a typical like boss would look from like a Mega Man
game, with like some armor, kind of standing on, more like human in the way he stands."

**Draw only the `idle`** (it loops, alive, about 4 to 6 s). Export `BOSS_BIRDIE_ARMORED`, id "boss-birdie-armored-b", name "Birdie".

**Read first:** `scripts/boss-art/out/boss-birdie/boss-birdie.ts` (read only, via the read list): Birdie's approved head (the round grey-brown
head, the buff face, the small grey beak, the big dark eye with its pale ring and glint), his navy conductor's cap with a gold band, and the
burgundy tie. Copy the head, eye and beak paint so he is clearly the same dove. Also read `packages/app/src/characters/sprite.ts` and
`paint.ts`, and a finished boss for the outline and shading.

## Who he is now
- Still clearly Birdie: the same dove's face and eye, his navy conductor's cap (now with a **gold trim or visor**), and the **red tie**
  (or a red stripe across his chest plate).
- **The train's colors:** yellow armor plates, the dark roof's charcoal, and the thin red stripe from the train.
- **Armored wings:** plates laid over the feathers, the scalloped edges now armor; a headlight on each shoulder.
- A **chest plate** (yellow, with the red stripe down the middle).
- He **stands upright on both legs** (the coral feet are now legs in heavy boots), broad-chested, heroic, a little intimidating but still
  warm. Like a classic armored robot-boss hero pose, more human in the way he stands. **No train under him**: the train became his armor.

## The frame
- Facing a little to our left, light from the top left, the same pixel-art finish as the other bosses. About the size of the other
  bosses: **w 74, h 78 like Birdie's idle, or a bit taller** (up to about h 90), foot at the bottom middle.

## Variant B: chunky
- Big shoulder plates and gauntlet-like wingtips (the wing's tip ends in a heavy armored claw), heavy boots like train wheels (the boot
  soles drawn as rounded wheel shapes with a dark rim), a wide chest plate.

## Quality bar
- Render the idle at 4x on dark and light, every frame, and at phone size beside another boss (the tiger). The face must read as Birdie
  (the same eye, beak and cap) at phone size.
- The shoulder headlights glint now and then (a frame or two), a blink, a breath (the body rises 1 px and back).
- No letters or numbers. No new colors beyond the train's yellow, the charcoal, the red stripe and the navy and gold of the cap, plus a
  darker outline or shadow key.
