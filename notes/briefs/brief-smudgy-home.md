# Brief: Smudgy's studio, start to finish: the art, the shop, the intro, the transition (Opus high; no review stops)

Eric, Nov 6: "Build the chameleon guy from start to finish … no need to ask me anything. I want to get it done before the usage
turns over in 3 hours." **One helper, start to finish, with no review stops**, like Folio's (#506, `docs/decisions/2026-11-05-folio-home.md`)
and Wrangler's (`2026-11-04-wrangler-home.md`). Smudgy is live, so this goes to everyone. **Time box: aim to be done, PR body
written, in about 2.5 hours.** Cut polish before you cut tests.

**Worktrees:**
- Code: `/home/user/cr-smudgy`, branch `claude/smudgy-home`, from main. Set it up with `npm ci`. Ports 8986, inspector 9486.
- Art: draw it in `scripts/boss-art/out/` on your code branch, by hand (no paid API, no art runner), in the same files and format
  as Folio's and Hollow's.
- At the end, also copy those art files onto `claude/boss-art`, for the record, in `/home/user/cr-hollowart`. Run
  `git pull --no-rebase origin claude/boss-art` first and never force-push.

Include notes/briefs/rules-common.md (American English, attribution, what you may and may not do).

## Who Smudgy is
Smudgy is the chameleon painter (`packages/app/src/characters/smudgy.ts`, sounds `smudgy-sounds.ts`, rules
`packages/chess/src/bosses/smudgy.ts`, his town home `town/houses/smudgy.ts`, "Smudgy's Art Gallery"). His kid, Dabble
(`sidekicks/smudgy.ts`), stays a town bot. Copy the way Folio's home was built: read `docs/folio-home/pr-body.md` and its code
(`shops/folio-art.ts`, the intro wiring in `town/shops/intro.ts`, `CHALLENGE_FEEL`, `BOSS_INTROS`, the crate in `BOSS_CRATES`).

## Eric's design (his words, trimmed), then the director's calls
### The room: a paint studio
- "A paint studio, tarps or canvases, a lot of different colors … darker teal, blue, darker reds, purples … as opposed to a very
  bright clownish feel … every wall is just splattered with canvas … a lot of layers of paint … kind of abstract."
  - The palette is **moody and deep**: dark teal, deep blue, oxblood and dark red, plum and purple, with a few warm highlights.
  - The walls are hung with big canvases, layered drips and splatters (an abstract, layered, drip-painting style; never name a
    real artist).
  - Add drop-cloth tarps on the floor, easels, paint pots and brush jars.
- "**Some sculptures of chess pieces** … reuse … the pixelated ones that are the default now in the Colosseum … place those around."
  - Reuse the Colosseum's pixel chess-piece statues (the ones on its plaza), scaled down as sculptures on plinths around the room.
- **The life class.** "An art studio going on … a knight standing on a rotating platform, and around it 8 [chameleons] sitting on
  stools … painting the horse … every few seconds it updates the horse drawing a little bit … they all do the same drawing but start
  at different times … a little paint thing next to them … a little animation for them to dip their paintbrush."
  - A knight statue (the pixel knight) turns slowly on a round platform in the middle of the room's back half.
  - 8 small chameleon painters sit on wooden stools in a ring around it, each at an easel facing it. Only those the camera can see
    matter, but place all 8.
  - Each easel's canvas shows the knight painting building up in a few stages (blank, outline, blocked colors, finished) on a loop,
    each painter offset in time. Each painter has a palette or paint table beside them and a brush-dip animation every few seconds.
  - The painters are a new small chameleon character with idle, paint and dip moves: art-student chameleons in smocks, a few color
    variants, the size of the kids.
- **The battle spot:** a **round table under a big white drop cloth** in the front half, draped on all sides and blotched with paint.
  The chessboard is under it, so you can see a board-shaped something beneath, and wooden stools (the same as the painters') stand
  at it already. The marks for you and Smudgy go either side, as the other shops' do.
- **The shopkeeper** (the director's call; Eric didn't name one): an older chameleon gallery owner in a smock and little glasses,
  behind a low counter with a blank plaque. Its card says "Shopkeeper", with no name. Not a town bot.
- **Smudgy's Boss Crate:** a paint-splattered wooden crate. If Smudgy has a ride (check the rides), it comes first.

### The intro
- "He starts out, he pulls the white tablecloth off … to reveal the board. And the stools can just already be there. It doesn't
  need to be fancy."
  1. You both walk on to your marks.
  2. Smudgy says his entrance line (keep his battle entrance line).
  3. He grabs the cloth and whips it off: a flowing cloth animation, then the cloth falls in a heap or flies off.
  4. The board is revealed on the table.
  5. A second bubble: Eric's line, "Careful, don't get any paint on the pieces!" (the director's wording of Eric's idea). Use it as
     the reveal line, no random set.
- **Into the match:** "a bunch of paint splatters that start filling the screen until once it gets full, and then they wipe away.
  And then the game starts."
  - Splats in the room's deep palette land faster and faster until the screen is covered (about 1.2 s).
  - Then a wipe (a brush stroke sweeping across, about 0.5 s) clears to the match screen.
  - Every beat is a number in the feel. It must never get stuck and must never block the match starting.
- **Sounds:** a cloth whoosh, splats and a brush swipe, synthesized like the others. They must pass `boss-sounds-finite.test.ts`.

## Rules
- Phone first.
- Lazy-loaded art.
- The town's frame loop unchanged.
- The shop's frame rate measured against Folio's: 8 animated painters must stay cheap, so share frames.
- List every player-visible text.
- List the changed checks old → new.
- No real artist, brand or person.

## Done
- **Unit tests:**
  - the room's walkable squares, the marks and the table, the counter and keeper;
  - the painters' loops offset;
  - the crate;
  - the intro's beats in order, the cloth before the board line;
  - every cue having a sound;
  - the splatter transition always ending in the match.
- **e2e:**
  - into Smudgy's Art Gallery, the shopkeeper's card and the crate;
  - Smudgy's challenge from the town, through the intro and the splatter, to the board and back, on phone and computer and on both
    renderers where the town's e2e runs them.
- **Stills and GIFs** in `docs/smudgy-home/`:
  - stills of the door, the life class, the cloth-covered table, the counter and the sculptures, on phone and computer;
  - a GIF of the whole intro from the game on a phone;
  - a GIF of the painters at work.
- **The PR body** in `docs/smudgy-home/pr-body.md` (lane: full e2e).
- **A decision note** in `docs/decisions/2026-11-06-smudgy-home.md`, quoting Eric.
- Don't open the PR. Stop with a short report.
