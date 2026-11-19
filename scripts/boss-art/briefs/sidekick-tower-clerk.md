# The Battle Tower's clerk: a penguin bellhop (a shopkeeper-style character)

Draw **the clerk** of the Battle Tower, a new character: the calm concierge who stands behind the lobby's front counter of the
Battle Tower, a 99-floor skyscraper in Chess Town. Players walk up, tap him ("Clerk", Talk) and he sends them up the elevator
to climb the floors, a chess game against the bosses on each. He is **nobody's kid**: not a boss's sidekick, not tied to any
boss's look or colors. He belongs to HunChess itself.

## The look
- **A penguin bellhop**, calm and dignified: black and white like the chess pieces (the penguin's own coat), dressed in
  HunChess's colors: a little **gold pillbox bellhop cap** with a chin strap, a short **slate jacket** (`#2a2e37`, lit
  `#4a5163`) with a double row of gold buttons and gold piping, a **gold bow tie**. Gold: `#f4b740`, deeper `#c8860d`, dark
  `#8a5c08`. His white front a warm white (`#f3f1ec`), his black a deep slate-black (`#16181d`), an orange-gold beak and feet.
- Polite and unhurried: upright posture, flippers at his sides or one folded in front, half-lidded calm eyes (not sleepy:
  serene), a tiny professional smile in the beak's line. Cute and readable first: a penguin bellhop at a glance.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`, about `#0e1014`), whole pixels, true pixel art.
- **Size:** a frame about **48 to 60 px tall**, feet near the bottom, about the size of the other sidekicks. He stands
  **behind a counter about 30 px tall**, so his head, cap, bow tie and the top of his jacket must show over it: keep the
  face and cap in his top 24 px.
- Match the sidekick Eric picked for size, outline weight and detail:
  `scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`. Look at one or two kids in
  `packages/app/src/characters/` for how they're built (a pose rig, so moving a part is a number).
- Export the character as `SIDEKICK_TOWER_CLERK`, id `sidekick-tower-clerk`, name "Clerk".

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): he stands at attention and breathes, blinks slowly; now and then he straightens his bow tie
  with a flipper, or gives a small polite nod. Calm: this is what's on screen most.
- **walk** (loops, about 0.6 s): a dignified penguin waddle, side to side, flippers out a little for balance, cap steady.
- **sit** (loops): sitting on a stool at a chess table, seen from the side, facing the board (our right), flippers folded,
  a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): he raises one flipper in a courteous wave (or a small bow, cap tipped), then settles
  back to his idle pose. It's his "welcome" when you tap him.

## Quality bar
Look at each animation at 4x, and the idle at phone size beside Boingo (`clown`) for size, before calling done. It should read
at a glance as a penguin bellhop in slate and gold, calm and welcoming, and look like it belongs in the same game as
Jefferson's sidekick. Clean, cute and readable beats intricate. Call done with notes: the frame size, how tall he stands from
his feet to the top of his cap, and the height of his face and bow tie over his feet (to place him behind the counter).
