# Brief: Folio's sanctuary in the game: the Folded House's inside, the turtle shopkeeper, its intro and the crumple (code; Opus high)

Worktree `/home/user/cr-foliohome`, branch `claude/folio-home`, from main f5e73337. Set it up with `npm ci`; never symlink
node_modules. Ports 8996, inspector 9496. Include notes/briefs/rules-common.md. Push as you go.

Eric, Nov 5: "crank through it". This is a **full build with no review stops**, like the Wrangler trial (see
`docs/decisions/2026-11-04-wrangler-home.md`). Folio is live, so its home goes to everyone, like Hollow's cave (#480) and intro
(#481).

## The art
On `origin/claude/boss-art` at e7e08bcf. Read it with `git show` and copy it into the app the way Hollow's cave and intro were.
Read the notes in full first:
- `scripts/boss-art/out/shop-folio-nov5.md`: the room, the props, the pools' drift, the `page` floor tiles, the keeper spot
  `[9.5, 2.4]`, the calls.
- `scripts/boss-art/out/intro-folio-nov5.md`: the timeline, the cues, the crumple sketch, what the code round needs.
- Room files: `house-shop-folio/house-shop-folio.ts` and `paper-kit.ts`.
- The turtle: `sidekick-folio-turtle/sidekick-folio-turtle.ts`.
- Folio's moves: `boss-folio/boss-folio.ts`. Leave `characters/folio.ts` as it is.
- The props: `house-intro-folio/house-intro-folio.ts`.
- The crumple's maths: `house-intro-folio/crumple.ts`.
- What it should look like: `house-intro-folio/view-intro-sequence.gif` and `view-crumple.gif`.

## Part 1: the sanctuary (the shop)
- **"Go in" on the Folded House's card** leads into the room, with the same flow as the other shops:
  - the room and its chat tone;
  - Talk;
  - the crate;
  - the challenge from its card in the town, played on the clean page.
- **The room:**
  - its pieces and lights;
  - the stained glass's pools drifting (`drift`, a sine, cheap per frame);
  - the `page` floor tiles in ShopRoom's tile prefixes;
  - the "being written" loops.

  Keep every other shop exactly as it is; their tests prove it.
- **The turtle as Shopkeeper.**
  - Bake its sheet like the other sidekicks (`scripts/bake-sidekicks.ts`). It stands at the keeper spot.
  - Its card says "Shopkeeper", with no name.
  - It isn't a town bot: the frog stays Folio's kid in the town. Update the town and sidekick tests, listing each old → new.
- **Folio's Boss Crate** goes in BOSS_CRATES at its spot, worded like the others. If Folio has a ride (the crane, `folio-crane`:
  check the rides), it comes first.
- **The softer shadow:** Folio's battle figure in this room uses the warm see-through shadow (note 14). Elsewhere it stays as it is.
- Start at the further-out zoom, like every home.

## Part 2: the challenge intro
Wire it the way Hollow's and Timber's custom intros are (`town/shops/intro.ts`, `BOSS_INTROS`, `CHALLENGE_FEEL`, a
`folio-intro-art.ts`). Every beat is a number in the feel; no magic numbers in code. Follow the art's timeline:
1. **The walk-on**, with Folio's entrance line, "Every game is a draft. Shall we write one?"
2. **You both step back a pace.**
3. **The furniture folds:** first the two stools, then the table.
4. **The paper aeroplane** comes in from the east with the board folded flat, banks over the table, drops the board and leaves to the
   north-west. The board unfolds on the table like a map.
5. **Folio bows,** and a second bubble says one line at random from:
   - "It's quiet in here. Stay as long as you like."
   - "Come back whenever it gets too loud out there."
   - "Take your time. The page will wait."
   - "Think as long as you need. I'm in no hurry."
   - "Quiet helps. So does a clean page."
6. **The crumple into the match** (Eric's idea). Do it with the real screen, not a picture of the art:
   - **Take the screen as it is at that moment.** At least the game area's canvas (the room with the table, both of you and the
     board), plus its DOM layer (the header and bubbles) if you can capture it cheaply and reliably. If you can't, say so and
     crumple the canvas over black.
   - **Over black, crumple it into a ball** in the middle: the 16×34 mesh, Lambert shading, the paper's back cream-grey with the
     screen showing through at 13% (the notes).
   - **Hold a beat, then open it back up**, and the unfolded sheet is the **real match screen**. Render the match screen first and
     capture it the same way, or open onto a capture of it, then hand over to the live screen with no visible jump.
   - Timings to start from: 0.8 s crumple, 0.4 s hold, 0.8 s open, 0.26 s crease fade.
   - Use WebGL, as the notes say. Where WebGL isn't there or fails, fall back to a short cross-fade through black. Never get stuck,
     and never block the match starting.
   - Phone first: check the frame rate on a phone-sized run with 4x CPU throttle, and say the numbers.
   - It plays on every way into Folio's battle from its room.
7. **Sounds:**
   - Map every cue in the notes to a sound: Folio's existing sounds where the notes suggest them, otherwise new ones synthesized
     like the others in the MAKE table (paper folding, the plane's whoosh, the crumple, the unfold).
   - They must pass `boss-sounds-finite.test.ts`.
8. **Onlookers** in the town see what they see for the other bosses (you both go inside).

## Rules
- Phone first.
- Lazy-loaded art: the room and intro load only when you go in.
- The town's frame loop unchanged.
- The shop's frame rate on the phone measured against Hollow's (give both).
- List every player-visible text.
- List the changed checks old → new.
- "It" for Folio everywhere, never "he".
- No real places, temples, brands or scripts.

## Done
- **Unit tests:**
  - the room's walkable squares, the clean page's marks, the counter and the keeper;
  - lights at every placement and the pools' drift;
  - the turtle's sheet;
  - the crate;
  - the intro's timeline: the beats in order, a total of about 14–16 s, the stools before the table, the board unfolding before
    the quiet line, and a quiet line from the five;
  - every cue having a sound;
  - the crumple: the mesh, the fallback, and that it always ends in the match.
- **e2e:**
  - into the Folded House, the turtle's card and the crate;
  - Folio's challenge from the town, through the intro and the crumple, to the board and back, with no errors, on phone and
    computer and on both renderers where the town's e2e runs them;
  - the fallback with WebGL off.
- **Stills and GIFs** in `docs/folio-home/`:
  - stills of the door, the clean page, the fountain, the counter with the turtle, and the edge, on phone and computer;
  - a GIF of the whole intro from the game itself on a phone (390x844), crumple included;
  - one frame on a computer.
- **The PR body** in `docs/folio-home/pr-body.md`. Lane: full e2e (it touches the shared intro and the match's start).
- **A decision note** in `docs/decisions/2026-11-05-folio-home.md`. It quotes Eric and lists the director's calls and the art's
  15 calls.
- Don't open the PR. Stop with a short report.
