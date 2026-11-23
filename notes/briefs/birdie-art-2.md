# Birdie's art, round 2 (Nov 23): his full set, the train attack, Armored Birdie (two variants). Art session, paid runner only

Eric picked **variant B** (`scripts/boss-art/out/boss-birdie-b/boss-birdie-b.ts` on `claude/boss-art`): "i like them both, this one
is a bit better tho". His design is in `notes/designs-birdie.md` on `claude/director-notes`: read it first. Eric pre-approved the
spend for Birdie's art ("Just approve whatever the spend is for this, for the API. It's fine."), but this session still asks him
ONCE, here, for this round's total (the runner rules), and waits for his own yes. Follow `notes/RULES.md` on art (the paid API
draws; never by hand; never print the key). Read `scripts/boss-art/README.md`, and use `boss-beaver-anims.md` as the model for a
full set. Work on `claude/boss-art`.

Steps:
1. Copy B to `scripts/boss-art/out/boss-birdie/boss-birdie.ts` with id "boss-birdie", export `BOSS_BIRDIE`, name "Birdie". Its idle
   is unchanged.
2. Write three runner briefs under `scripts/boss-art/briefs/`, from the sections below:
   - `boss-birdie-anims.md`: run 1.
   - `birdie-train.md`: run 2. Use the README's mode that fits a board effect (as Big Boy's tower, `bigboy-tower.md`).
   - `boss-birdie-armored-a.md` and `-b.md`: run 3, two variants.
3. Ask Eric once for the spend: "Birdie round 2: his full animation set, the train attack art, and two versions of Armored Birdie:
   four runs at about $5 each ($20 at most)". Wait for his own yes.
4. Run them: run 1 `BOSS_ART_CAP_USD=8`, run 2 `=5`, run 3's two variants `=4` each. Effort high.
5. Commit the drawings, summaries and logs on `claude/boss-art`.
6. Put the stills on an orphan branch `stills/birdie-2`:
   - run 1: the frame sheet and a GIF of each new animation;
   - run 2: the train's frames, and a still of it on a board row;
   - run 3: each variant's frames, idle GIF and phone-size comparison.
   Add a `NOTE.md` with each run's spend and the runner's notes. Write `.done`, push and stop.

## Run 1: Birdie's full set (keep his approved idle pixel for pixel)
Who he is: Birdie, a young mourning dove (a real bird's look, a warm face, a navy conductor's cap, a red tie, nothing else),
riding his yellow toy diesel train: he sits in its open cab. Sweet, curious, a little proud of his train. Facing a little to our left.
Rig him (head, cap, wings, body height in the cab) like the finished bosses' `pose()` rigs, without changing what the idle draws.
The usual set, each in his character:
- **entrance**: the train rolls in from the right and stops; he pops up and tips his cap.
- **thinking** (loops): head tilts, looking around, a dove's head-bob.
- **move**: a nod and a wing-point toward the board.
- **capture**: a happy little flutter, a puff from the train's roof.
- **hurt**: a flinch and ruffled feathers, his cap knocked askew; he straightens it.
- **check**: he leans out and points with a wing, the headlights flashing once.
- **smug** (loops): chest puffed, eyes half closed, a pleased coo.
- **rattled** (loops): ducks down into the cab, peeking out nervously.
- **defeat**: his cap falls off, and he sinks down into the cab until only his head shows, sad. The last frame holds.
- **victory** (loops): flaps and bounces, the train's headlights blinking.
His own moments (name them exactly so):
- **`signal`** (about 1.5 s, plays once): the warning. He leans out and waves a wing like a conductor calling "all aboard", with the
  headlights flashing. Add a cue `signal` at the wave's peak.
- **`depart`** (about 1 s, plays once): the attack begins. He ducks into the cab, and the train lurches and pulls away to our left
  and out of his frame. A cue `go`.
- **`fall`** (about 1 s, plays once): the start of his ultimate. A jolt, then he tumbles backward out of the cab and out of the frame
  downward, his cap flying off. A cue `fall`.

## Run 2: the train on the board (the attack)
- **His train seen from above, one square tall** (top-down, nose pointing right), its length about two squares, for riding along a
  rank. The game rotates it for a file. Birdie's capped head shows in the open cab. A short loop of its wheels/rods turning and a
  puff of smoke or a vent glow (it's a diesel), and its headlights on.
- **The crossing warning, a board effect for one square**, laid on every square of the marked line: a railroad-crossing look that
  flashes, two alternating red lights (like a crossing signal seen from above, or a crossbuck mark on the square). It must read
  clearly over light and dark squares and under a piece. Loop about 1 s.
- **The hit:** a smash puff when the train hits the piece, short and punchy (about 0.4 s). The game may reuse the gator's laser
  smash instead; draw it anyway as an option.
- **No letters or numbers** anywhere (no "RR" on the crossbuck: shapes only).

## Run 3: Armored Birdie (two variants), a still idle only
After the train hits him in his ultimate, Birdie transforms. Eric: "he takes on the color scheme of the train, like he has like armor
on his wings, and now he's standing up on like both legs, and he kind of looks like a typical like boss would look from like a Mega
Man game, with like some armor, kind of standing on, more like human in the way he stands."
- Still clearly Birdie: the same dove's face and eye, his navy conductor's cap (now with a gold trim or visor), the red tie
  (or a red stripe across his chest plate).
- **The train's colors:** yellow armor plates with the dark roof's charcoal and the thin red stripe. Armored wings (plates over
  the feathers, maybe a headlight on each shoulder), and a chest plate.
- He **stands upright on both legs**, broad-chested, heroic, a little intimidating but still warm. Like a classic armored robot-boss
  hero pose. No train under him: the train became his armor.
- Facing a little to our left, light from the top left, the same pixel-art finish and about the size of the other bosses (B's frame
  or a bit taller). **idle only**: breathing, a blink, the shoulder headlights glinting.
- **Variant A:** sleek: the armor fitted close, like a streamlined locomotive.
- **Variant B:** chunky: big shoulder plates and gauntlet-like wingtips, heavy boots like train wheels.
