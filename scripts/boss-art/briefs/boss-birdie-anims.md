# Birdie, the young mourning dove: his full animation set, Nov 23 (Eric's design, variant B approved)

Your file `scripts/boss-art/out/boss-birdie/boss-birdie.ts` **already holds Birdie's approved idle** (variant B, Eric picked it:
"i like them both, this one is a bit better tho"). Read it first. **Keep the idle exactly**: its 21 frames, pixel for pixel (same
pose, dove, cap, tie, train, hatch, timing). Build on it: add the rigging (head, cap, wings, body height in the cab, as numbers, like
the finished bosses' `pose()` rigs: read `packages/app/src/characters/gardener.ts` and `tiger.ts`) without changing what the idle
draws, then add the animations below. Keep the export `BOSS_BIRDIE`, id "boss-birdie", name "Birdie".

Eric's design is in `notes/designs-birdie.md` (not readable from here: this brief has what you need). Eric's reference photos are
not available to you; the idle is the look.

## Who he is
A young mourning dove (a real bird's look: soft grey-brown plumage, scalloped wing feathers with pale tips, a small grey beak, a big
dark eye with a pale ring, coral feet), riding his yellow toy diesel train: he stands in its open cab, in a navy conductor's cap with a
gold band and a burgundy tie. Sweet, curious, a little proud of his train. **No letters or numbers anywhere.** Facing a little to our
left (toward the board), light from the top left. Nothing else on him (no pencil, no bag).

## The animations (frame counts and lengths like the gardener's and the tiger's; each frame's `ms` as the finished bosses use)
The usual set, every one in his character:
- **entrance**: the train rolls in from the right and stops; he pops up out of the cab and tips his cap.
- **thinking** (loops): his head tilts, looking around, a dove's head-bob.
- **move**: a nod and a wing-point toward the board.
- **capture**: a happy little flutter, a puff of steam from the train's roof.
- **hurt**: a flinch and ruffled feathers, his cap knocked askew; he straightens it.
- **check**: he leans out and points with a wing, the headlights flashing once.
- **smug** (loops): chest puffed, eyes half closed, a pleased coo.
- **rattled** (loops): ducks down into the cab, peeking out nervously.
- **defeat**: his cap falls off, and he sinks down into the cab until only his head shows, sad. The last frame holds.
- **victory** (loops): flaps and bounces, the train's headlights blinking.

His own moments (name them exactly so):
- **`signal`** (about 1.5 s, plays once; the warning): he leans out and waves a wing like a conductor calling "all aboard", the
  headlights flashing. Put `cue: "signal"` on the wave's peak frame.
- **`depart`** (about 1 s, plays once; the attack begins): he ducks into the cab, and the train lurches and pulls away to our left
  and out of his frame. Put `cue: "go"` on the lurch. The last frame is empty (the train has gone; the game takes over there, as
  with the tower's `tip10`).
- **`fall`** (about 1 s, plays once; the start of his ultimate): a jolt, then he tumbles backward out of the cab and out of the frame
  downward, his cap flying off. Put `cue: "fall"` on the jolt. The last frame is empty (the game takes over there).

## Quality bar
Look at each animation at 4x before calling done, and the idle and the face at phone size beside another boss (the tiger). The idle
must be unchanged. The lighting and the palette stay as in the idle; no new colors beyond a darker outline or shadow key. Draw only
Birdie: the train is his, part of his drawing (a board effect is drawn by the game's code later).
