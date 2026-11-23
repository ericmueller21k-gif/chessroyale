# Birdie's bartender: a friendly pigeon in a red vest and white apron (the shop clerk of Birdie's station)

Draw **the bartender** of Birdie's station: a friendly pigeon who runs the little bar in the station's lobby and is also the
shop's clerk. Players walk up to the bar and tap him ("Bartender", Talk). He is **nobody's kid**: he isn't Birdie's sidekick and not
tied to Birdie's colors beyond the station's own train-yellow trim, and he belongs to HunChess's Chess Town, like the Battle Tower's
clerk.

## The look
- **A friendly grey pigeon** (a real city pigeon's build, rounded and plump): a soft blue-grey body (`#8a8f9a`, lit `#b5bac4`,
  shade `#5c616b`), a **grey head**, and an **iridescent green-purple sheen on the neck** (`#3f7d5e` with a violet `#7a4d9e` flicker
  at its edge, one or two pixels of shine), a pale grey wing bar and dark wing tips, two little red-orange feet and a short dark beak
  (`#2b2d31`) with a red-orange cere.
- **Dressed for the bar**: a **red vest** (the station's train red, `#c8372d`, deeper `#8e1f1a`) over a **white apron** (`#f3f1ec`,
  shade `#d6d2ca`) tied at the waist, and maybe a little **bow tie** at the throat in charcoal (`#2b2d31`) with a train-yellow
  (`#f4c430`) dot. No hat.
- Friendly and unhurried: round eyes with a soft highlight (a warm dark brown `#2e2a26`), a little smile in the beak's line, head
  tilted a touch. Cute and readable first: a pigeon in a vest and apron at a glance.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's `k`,
  about `#0e1014`), whole pixels, true pixel art.
- **Size:** a frame about **48 to 60 px tall**, feet near the bottom, about the size of the other sidekicks. He stands **behind the
  bar counter, about 31 px tall**, so his head, neck sheen, bow tie and the top of his vest must show over it. **Keep his face and
  head in his top 24 px.** Call out the height of his face and bow tie above his feet in your notes, so he can be placed.
- Match the sidekick Eric picked for size, outline weight and detail:
  `scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`. Look at one or two kids in
  `packages/app/src/characters/` for how they're built (a pose rig, so moving a part is a number).
- Export the character as `SIDEKICK_BIRDIE_BARTENDER`, id `sidekick-birdie-bartender`, name "Bartender".

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 4 s): he stands behind the bar drying a glass with a white towel: the towel circles the glass in short
  strokes, the glass held in one wing; now and then he gives a small, friendly nod, and blinks slowly. This is what's on screen
  most. No letters or numbers anywhere on the glass or the towel.
- **wave** (plays once, about 1.2 s): he sets the glass down and gives a welcoming wave with one wing (a little flick of the
  towel), a happy hello when you tap him, then he settles back to his idle pose.
- He stays behind the counter, so there is **no walk and no sit** animation: the room's bar holds him at his place.

## Quality bar
Look at each animation at 4x, and the idle at phone size beside the bar (the lobby's counter, or Jefferson's sidekick for size),
before calling done. It should read at a glance as a friendly grey pigeon in a red vest and a white apron drying a glass, calm and
welcoming, and look like it belongs in the same game as Jefferson's sidekick and the Battle Tower's clerk. Clean, cute and readable
beats intricate. Call done with notes: the frame size, how tall he stands from his feet to the top of his head, and the height of
his face and bow tie over his feet (to place him behind the bar).
