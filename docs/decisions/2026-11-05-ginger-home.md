# Ginger's igloo candy shop and his challenge intro in the game (Nov 5, 2026)

Eric approved the design and the stills Nov 5; Ginger (kit `gingerbread`) is live, so it goes to everyone. The art: `claude/boss-art`
at 6ef02ce9 (`house-shop-ginger` with its `candy-kit.ts`, `npc-ginger-elf` with its `elf-rig.ts`, `sidekick-ginger-elf`, `boss-ginger`,
`house-intro-ginger`; notes `shop-ginger-nov5.md`, `intro-ginger-nov5.md`), copied in as Jefferson's were (imports moved). The ride's
art (`ginger-sled`) is the game's already: not copied.

## The calls

- **The stairs (Eric: "it's actually connected to the ground and it's just like a continuous thing").** One height curve for you and
  every elf (`shops/levels.ts` `liftAt`): each quarter of a stair square is the art's 5 px step, and the lift runs in straight lines
  between the steps' middles, so a figure rises evenly (at the walk's 90 ms a square, a staircase of 5 px pops would flicker at the
  frame rate), never more than 2.7 px off the tread under its middle; off the foot it eases up over the half square in front of the
  flight (smooth at both ends). Unit tests: continuous along both flights and the catwalk, 0 at the feet, 40 on the deck, each step's
  height at its middle. The e2e records your figure frame by frame up one flight, along and down the other (taps and arrow keys) and
  checks no frame's lift changes faster than the steps rise.
- **Two levels as a chain.** The stair and catwalk squares are the back wall's (rock on the mask): they're walkable, but each links only
  to its neighbours along the chain (`Room.levels`, `around`), and a floor square steps onto one only by a foot's link. So you can't step
  onto the deck from the floor in front or off its front edge, and the routing (BFS) takes the nearer staircase. A tap on the deck is
  matched against the deck as drawn (lifted), before the floor.
- **Drawn half a square nearer up there** (the mockup's rule), blended in from the floor: the cards behind, the stand, the shopkeeper
  and everything nearer in front, from every camera place.
- **The arrow keys in a room went the wrong way:** up walked you down the screen (a room's rows run toward its camera, the town's away).
  Fixed for every room (`keyWalk`'s `to`), and along Ginger's chain (`stepFor`: left and right along the flight and round the curve, up
  from a foot climbs on; up and down on the deck do nothing).
- **The elves are drawn from their sprites as the room loads** (about 40 ms on a computer for their ~100 small frames), not baked as
  Jefferson's crew were (0.75 s for theirs): less code. The shopkeeper is baked with the sidekicks (`elf.ts`; the count is 20).
- **Blocking** (as Jefferson's crew): each elf looks along its way (0.35, 0.7, 1.05 squares ahead) and waits while you or the boss stand
  there; it takes its square and, walking, the one half a square ahead. Your tap routes round them (the other staircase when one is on
  the nearer); one stepping into your way and you wait where you are, then go on (or round once that's open); if the elf in your way is
  itself waiting for you, you give way (stop), so the two never wait on each other forever. The pair wait together; a stop once begun
  is played out. The elves are silent in the shop (as Jefferson's machines); their cues are the intro's only.
- **B follows A half a square behind**, and at a stop steps over to his place (the art's `b`) in 0.3 s and back: he never jumps.
- **His intro's order:** cast, the light, the pieces, then his brag before his attack (as Jefferson's), so the attack runs on into the
  wipe as every boss's: about 13.2 s (the art's 13.2). The carriers run the art's route at its 3.5 squares a second (1.4 s; the notes'
  1.8 s didn't add up) and stand a beat behind the table before the toss.
- **Sounds:** twelve new synthesized ones (charge, blast, burst, whoosh, the icicle's stab, the elves' steps, their "hup" as two soft
  bumps, no voice, the board's clack, the cast's shimmer with no bell, the sparkle, the cane's thump, a gust); his laugh is his jingle,
  the ice forming his crackle, the blizzard his wind; the table's glint silent. All under a move's loudness (his pack's test).
- **The crate's id is `boss-gingerbread`**, from his boss id, which is also the Gingerbread Man skin's item id: tokens are kept by boss
  and crates by crate id, so nothing collides (a test). **The Candy Cane Sled stays in `NO_CRATE_YET`** (crates.test.ts), as Jefferson's
  Giraffe Gallop did: the list means "in no regular crate", and taking it out fails that check.
- **Frame rate** (headless, walking 5 s, median of 3; this shared machine): against Jefferson's warehouse. Walking in the room: phone
  (390 × 844, the phone project) 37.5 against 34.9 fps, computer (1440 × 900) 36.6 against 34.8. Standing just inside the door and
  walking left and right there (the tunnel's walls near the camera): phone 35.7 against 40.8, computer 33.7 against 33.5. Cut: the
  room's two dozen pools of light and the battle spot's shine are baked into the floor's picture (they never change) instead of drawn
  each frame; no elf trimmed (removing the glows and every upright piece together brought the doorway near Jefferson's: it's the art's
  ring of overlapping wall cards, and inside the room the igloo is the faster).
