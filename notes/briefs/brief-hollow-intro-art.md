# Brief: Hollow's challenge intro (art): the darkness ball that drinks the light

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art` (shared with other art sessions: `git pull --no-rebase origin
claude/boss-art` before each push; never force-push). Opus high. **Drawn by hand on the weekly plan usage (Eric, Nov 3), not the
API runner**, as Dash's and Timber's intros were. Make the same files and format the runner makes. Art only: no app code (a code
round wires it after). Include notes/briefs/rules-common.md.

## Read first
- How the other intros were delivered: `scripts/boss-art/out/intro-timber-nov3.md`, `intro-blitz-nov3.md` (exports, feet, cues,
  the timeline, the calls for Eric), `house-intro-timber/`, `house-intro-blitz/`, and the mockup scripts
  `scripts/boss-art/intro-timber-view.ts` / `intro-blitz-view.ts`.
- Hollow himself: `scripts/boss-art/out/boss-hollow*` (his sprite, palette, the dark orb in his belly), and his cave:
  `out/house-shop-hollow/house-shop-hollow.ts` + `out/shop-hollow-nov3.md` (lanterns, bulb string, tree lights, the pond, the
  marks: boss [11, 11.5], you [14, 11.5]).
- **The camera the intro is seen from:** `origin/claude/hollow-shop` has the stills
  `docs/hollow-shop/intro-start-lanterns-phone.png` and `-desktop.png` (read with `git show origin/claude/hollow-shop:<path> > file`).
  From there 4 of the 5 lanterns are in view: (9,5), (11,8), (9,11), (13,16); (17,12) is just off the right edge. The bulb string
  along the back wall and the tree's lights are in view. Your mockup must use this view.

## Who Hollow is (keep it subtle)
A lonely, lost soul in a cave above the town who secretly loves the lights. Nods only to the famous holiday hermit story: never its
names, its town, quoted lines, traced art or anything from its films.

## Eric's design (his words in `notes/hollow-intro-eric.md` on `claude/director-notes`; follow it exactly)
It may run a few seconds longer than the others' ~12 s (about 14–16 s is fine).
1. Hollow walks on to his mark on the pond (his existing walk; boss LEFT, you RIGHT).
2. **The darkness ball in his belly powers up:** material builds up around it, spins, and it expands a little.
3. **It sucks in the light:** the lanterns go out **one by one** (each visibly: flame gutters, goes out, a thin wisp), the bulb
   string's lights are drawn in toward him (bulbs going dark in a run along the string), the tree's lights too, light from
   everything around, **even from your own piece** (a little glow drawn out of the player's pawn into the ball).
   The light must visibly travel: motes/streaks flying from each source into the ball.
4. **Everything goes black.**
5. **It does NOT switch back on.** Darkness everywhere, and a **dim, steady light** (not flickering) around you, the board and
   him: just enough to see everything. Then the battle starts.

## What to make
- His intro moves, added to his boss file as the other intros were (only lines added there): e.g. `BOSS_HOLLOW_INTRO`
  (id `hollow-intro`): `charge` (the ball powering up: material gathering, spinning, swelling a little, looping), `drink` (arms
  or stance braced while the light pours in, looping), `full` (the ball at its biggest, dark and humming), `settle` (back to a
  standing pose for the fight). Feet consistent with his normal sprite; say the foot point.
- The ball's own effect frames if it's bigger than his sprite allows (`INTRO_HOLLOW_ORB`: build-up, spin, swell).
- The light motes/streaks (`INTRO_HOLLOW_MOTE`: a few sizes and warm/bulb colours; a pawn-light mote, paler).
- Unlit states for the cave's lights: each lantern piece out (flame gone, a wisp of smoke frames), the bulb string with bulbs
  dark (so the code can switch bulbs off one at a time: say how the bulbs are indexed), the tree's lights out.
- The darkness and the dim light: the blackout tone, and the dim steady pool's look (a soft pool round the board/table and the
  two figures: colour, falloff), as `INTRO_HOLLOW_DARK` / `INTRO_HOLLOW_DIMPOOL` or numbers in the notes.
- Cues for sounds (the hum building, each lantern going out, the bulbs draining, the blackout): list each in the notes so the code
  round can make his sounds.
- A suggested timeline (every beat in seconds, the order the lanterns go out: one by one, readable from the intro camera).

## Deliver
Notes `scripts/boss-art/out/intro-hollow-nov3.md` like `intro-timber-nov3.md` (exports, feet, cues, the timeline, the calls Eric
may want to change). A mockup script `scripts/boss-art/intro-hollow-view.ts` and, in `out/house-intro-hollow/`: a GIF of the whole
sequence from the phone intro camera (390 × 844), a few stills (the ball powering up, mid-drain with lanterns going out, the
blackout, the dim light before the battle), and the new moves as GIFs (3x). Push. Reply with the head sha, the GIF/still paths and
the calls for Eric.
