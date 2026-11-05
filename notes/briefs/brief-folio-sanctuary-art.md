# Brief: Folio's sanctuary (art): the inside of the Folded House, its shopkeeper, and its challenge intro (Opus high)

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art`. Other art sessions share this branch, so run
`git pull --no-rebase origin claude/boss-art` before each push and never force-push. **Draw it by hand on the weekly plan usage,
not with the API runner.** Make the same files, in the same format, as the runner makes. Art only: no app code (code rounds wire
it after Eric approves). Include notes/briefs/rules-common.md.

## Who Folio is
Folio (`packages/app/src/characters/folio.ts`, lines in `folio-lines.ts`, its town home `town/houses/folio.ts`, "the Folded
House") is a paper crane folded from one page of handwriting:
- calm, honest, warm, a little unsettling;
- "it" everywhere, never "he";
- its marks: cream paper (`FOLIO_PALETTE`), blue-black cursive on the faces, gilt edges, the vermilion seal.

Its kid is the origami frog (`sidekicks/folio.ts`), who stays a town bot.

Eric, Nov 5: "a peaceful sanctuary … some stained glass, some fountains, some bonsai plants … paper folding … something kind of
abstract … that makes it clear it's a different being than the rest." He gave the director full say, and the calls below are
the director's.

## 1. The room: a paper sanctuary (`house-shop-folio`)
File `scripts/boss-art/out/house-shop-folio/house-shop-folio.ts`, built like Hollow's and Timber's shops: `SHOP_FOLIO_PIECES`,
`_LAYOUT`, the room still `HOUSE_SHOP_FOLIO`, `_COUNTER_SIGN`, `_CRATE_AT`, `_MARKS`, `_LIGHTS`, `_POOLS`; 37 px squares.

A box room is fine; give it a floor mask (`SHOP_FOLIO_FLOOR`) only if you shape it.

**The abstract idea (the main call): the room is a page still being written.**
- Near the middle, everything is folded, coloured and solid.
- Toward the edges and the back it thins into **ink sketch**:
  - pillars, a bench or a lantern drawn only as blue-black outlines on blank cream;
  - faint ruled lines on the floor;
  - a margin line down one side.
- The far wall fades into unwritten paper.
- A few marks look as if they're being written while you watch: a line inks itself in on an idle loop, then fades.

This is what makes Folio a different kind of being. Keep it calm, never glitchy.

**Props** (Eric's ideas, then the director's):
- **Stained glass:** tall windows of translucent coloured tissue paper in folded-paper frames. Lit from behind, they throw soft
  coloured pools on the floor (`_LIGHTS` / `_POOLS`), and the pools drift slowly as the "sun" moves.
- **Fountains:** one or two. The water is **ribbons of paper or ink lines** pouring and looping, not drawn water, in a folded
  stone-paper basin. Idle loop: the ribbons flow.
- **Bonsai:** folded-paper bonsai on low stands, with pleated leaves and one with tiny cranes in it.
- **Hanging strings of small paper cranes** (senbazuru-style), swaying out of step.
- **Pages drifting upward** very slowly in a corner, like dust in light.
- **Folded paper screens** standing as room dividers.
- **A low writing desk** with an inkstone and a brush.
- Japanese-garden feeling, but abstract and paper. Use no real place, temple, brand or written script beyond the cursive scribble.

**Battle spot: "the clean page".** A large blank square sheet lies on the floor, its edges slightly lifted. The two start marks sit
on it (boss west, you east, on one line, as in the other shops).

**Counter:** a low folded-paper counter or desk at the back, at most about 32 px tall so the shopkeeper shows, with a blank
plaque.

**Folio's Boss Crate:** a folded paper box (a masu box) with a lid, sealed with Folio's vermilion seal. Idle loop: its lid lifts a
hair and settles.

## 2. The shopkeeper: a paper turtle (`sidekick-folio-turtle`)
File `scripts/boss-art/out/sidekick-folio-turtle/sidekick-folio-turtle.ts`, made like the other sidekicks: a `Character` with
idle, walk, sit and wave.
- **Design:** an old, slow, kind origami turtle folded from the same handwritten paper, with a faceted shell and faint ink. It has a
  tiny stack of folded pages on its back and maybe small round spectacles.
- **Size:** about the other kids'.
- **No name.** Its card reads "Shopkeeper".
- It isn't a town bot.

## 3. The challenge intro (`house-intro-folio` and `boss-folio` intro moves)
Make it like the other intros (`house-intro-hollow`, `intro-hollow-nov3.md`, `BOSS_HOLLOW_INTRO`), with a mockup view
(`scripts/boss-art/intro-folio-view.ts`) and `view-intro-sequence.gif`. Every beat gets a number.

1. **Walk-on.** You both walk on to your marks on the clean page, and Folio says its entrance line.
2. **The furniture folds itself.** On the clean page lie **three flat sheets: two small ones (the stools) and a big one (the
   table)**. They fold up in a few readable steps each (flat, a crease lifts, sides fold, it stands): first the stools, then the
   table. Each step is a frame set the code can play.
3. **The board arrives.** A **paper aeroplane** folded from a ruled page glides in from off the room carrying the board folded
   flat on its back. It banks over the table, drops the board, and flies off. The board unfolds on the table in two folds, like
   a map. Use a plane, not a crane, so it isn't confused with Folio.
4. **A quiet line** when the board lands (a second bubble). The code picks one at random each time from:
   - "It's quiet in here. Stay as long as you like."
   - "Come back whenever it gets too loud out there."
   - "Take your time. The page will wait."
   - "Think as long as you need. I'm in no hurry."
   - "Quiet helps. So does a clean page."

   Folio keeps its entrance line from the battle ("Every game is a draft. Shall we write one?") at the walk-on. Don't use the
   word "meditate" (Eric).
5. **Into the match: the crumple** (Eric's idea).
   - The screen as it is at that moment is taken as a still.
   - Over black, it **crumples into a ball** in the middle: creases, foreshortened faces, shading.
   - Its back shows as **cream-grey paper with faint ink showing through**.
   - It holds a beat, then **opens back up**, and the unfolded sheet is the match screen.
   - The app does this in code with the real screen; it's the code round's job.
   - Your part: a **prototype on a still**, using one of your intro frames as the "screen". Make it a GIF
     `house-intro-folio/view-crumple.gif` and a small reusable maths sketch (a grid mesh, crumple displacement and shading, then
     the reverse).
   - Give the beats and timings: about 0.8 s crumple, 0.4 s hold, 0.8 s open, as a starting point. Tune them so it reads at
     phone size.
   - Note in the art notes what the code round needs (mesh size, shading model, how the open reveals the board).

Folio's moves for the intro: walk-on (hover-glide), a small bow when the board lands, idle. Build them from `characters/folio.ts`'s
rig and leave `folio.ts` as it is.

## Deliver
- Notes `scripts/boss-art/out/shop-folio-nov5.md` (the room, the props, the floor if shaped, the calls Eric may want to change) and
  `intro-folio-nov5.md` (the timeline, the cues, the crumple sketch, the calls).
- Review stills:
  - the room (`room.png`);
  - close views at the door, the clean page, the fountain, the bonsai and the counter with the turtle;
  - the "being written" edge.
- The turtle's four animations as GIFs (3x).
- `view-intro-sequence.gif` (phone size, 390x844).
- `view-crumple.gif`.
- Push. Reply with the head sha, the still and GIF paths, and the calls for Eric.
