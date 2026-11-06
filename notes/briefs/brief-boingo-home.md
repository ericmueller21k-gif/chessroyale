# Brief: Boingo's Funhouse inside: an arcade fun place (art and code; Opus high). No intro this round.

Worktree `/home/user/cr-boingo`, branch `claude/boingo-home`, from main. Set it up with `npm ci`. Ports 8984, inspector 9484.
Include notes/briefs/rules-common.md (American English). Draw by hand in code, with no paid API. Push early and often; the
container can restart. Boingo is live, so this goes to everyone.

Copy how Folio's (#506) and Smudgy's (`claude/smudgy-home`) homes were built: the room art in `shops/*-art.ts`, `ShopRoom`, the
shopkeeper sheet, `BOSS_CRATES`, the zoom-in on a piece (the statue's).

## Eric, Nov 6 (trimmed)
"An arcade style … the old kind of kids' pizza arcade I loved … a spiral slide … netting three layers high you climb up through, and at
the top a slide to go down … one of those half-dome spinny arcade games where you press the button as the light goes around … roll-ball
lanes on the wall … his shop like a prize store you walk into, prizes up on the wall … goofy things, little stuffed animals …
repetitive is fine … his pogo stick as the centerpiece with a sign next to it saying how much it costs, and a light down on it like
you did for the portraits … a claw machine … the water-squirt race game along the wall, 5 little clowns shooting water into the
holes, the race being little knights moving along, on a loop … it can be larger than the other rooms, we'll add more."

- **No real brands, mascots or venues.** The arcade he loved is a feel reference only. Use generic names: "roll-ball lanes", not a
  trademarked one, and "the spinning light game", not a brand.
- **Boingo's colors:** `characters/clown.ts` `CLOWN_PALETTE`. Bright, fun, carnival lights. It's an arcade, so plenty of light: the
  marquee bulbs and the games' glow.

## The room (bigger than the other rooms is fine)
- **The play structure:** a 3-level climbing frame of nets and padded platforms with a **spiral slide** coming down from the top.
  Decorative, upright, with idle animation: a flag waving and balls bouncing in a ball pit at its foot if cheap.
- **The spinning light game:** a half-dome cabinet whose ring of lights chases round, with a big button. An idle loop.
- **Roll-ball lanes** along a wall: three or four ramps with ringed targets.
- **The water-squirt race:** along a wall, **5 little clown players** on stools, each squirting a water gun into a target.
  - Above them is a race track of **little knights** moving along, on a loop.
  - Every so often a knight wins, a light flashes, and the race resets.
  - The clowns are a small new character (or Boingo's rig scaled down), with idle and squirt moves, in a few colors.
- **The claw machine:**
  - A glass cabinet with prizes (small crates) inside, a claw, and a coin slot.
  - **Walking up to it zooms the camera in**, as for the statue.
  - **Tapping its coin slot** calls `openClawMachine()` from a new `packages/app/src/claw/index.ts`. Create it as a stub that shows a
    small "Coming soon" card. Another helper replaces it with the real machine, so keep the stub's signature simple
    (`openClawMachine(): void`) and the file otherwise empty.
- **The prize counter (the shop):**
  - A walk-in prize store corner with a glass counter, and shelves and walls of prizes: stuffed animals, toys, goofy trinkets.
    Repetitive is fine.
  - **The shopkeeper** stands behind it: a friendly clown attendant, its card "Shopkeeper", with no name and not a town bot.
  - **Boingo's Boss Crate** goes in `BOSS_CRATES`. If he has a ride (his pogo stick: check the rides), it comes first.
- **The centerpiece:** **Boingo's pogo stick** on a pedestal behind or above the counter, under a spotlight cone (like Smudgy's gallery
  lights). Beside it, a little price sign: "BOINGO'S POGO: 3 Boingo tokens" (the crate's real price, read from the crate settings, so
  it never drifts).
- **The battle spot:** a clear open area, a bright carnival mat or rug with the two marks, and the default table and stools for now.
  **No custom intro this round** (Eric): Boingo's challenge uses the default intro, on the mat.
- Start at the further-out zoom.

## Rules
- Phone first.
- Lazy-loaded art.
- The town's frame loop unchanged.
- The room's frame rate against Smudgy's or Folio's, which matters with this many animated things: share frames, and draw the static
  layer once.
- List every player-visible text.
- List the changed checks old → new.

## Done
- **Unit tests:**
  - walkable squares;
  - the battle mat and marks;
  - the counter and keeper;
  - the crate;
  - the claw machine's spot and its zoom;
  - the stub called on tapping its slot;
  - the race loop;
  - lights at every placement.
- **e2e:**
  - into Boingo's Funhouse;
  - the shopkeeper's card and the crate;
  - walking up to the claw machine zooms in;
  - tapping the slot shows the stub's card;
  - Boingo's challenge from the town to the mat with the default intro and back.
- **Stills and GIFs** in `docs/boingo-home/`, on phone and computer:
  - the door;
  - the play structure and slide;
  - the squirt race (GIF);
  - the spinning light game;
  - the roll-ball lanes;
  - the prize counter with the pogo centerpiece;
  - the claw machine zoomed.
- **The PR body** in `docs/boingo-home/pr-body.md` (lane: full e2e).
- **A decision note** in `docs/decisions/2026-11-06-boingo-home.md`, quoting Eric.
- Don't open the PR. Stop with a short report.
