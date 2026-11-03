# Hollow's challenge intro (Nov 3, 2026)

Eric's design (`notes/hollow-intro-eric.md`): Hollow walks on to his mark; "the darkness ball in his belly/abdomen powers up: material
builds up around it, spins, and it expands a little. It sucks in the light: the lanterns go out one by one, the bulb string's lights are
drawn in toward him, light from everything around, even from your own chest piece. Everything goes black. It does NOT all switch back
on: darkness everywhere, and a dim, steady light around you, the board and him (not flickering), enough to see everything. Then the
battle starts." He approved the art's mockup (`claude/boss-art` 3238dbf4, `house-intro-hollow/view-intro-sequence.gif`) on Nov 3 with
five changes, built as he gave them:

1. **Nothing jumps in the dark.** The park table and stools pop in the default intro's way after his line, while it is still lit,
   before he charges. You both walk on straight to your seats (his `clear` place, 2.92 squares from the table's middle; yours the usual
   2.2) and stay there: no hop back (`BossIntro.seated`, `seatedMarks`). In the black and the dim light nobody changes place and nothing
   appears; only the light changes.
2. **A channel line as he starts to charge**, one of four at random each time (`BossIntro.chant`, `chantOf`), in the bubble over his
   head; "Did you leave a light on?" stays at the walk-on.
3. **The light-drinking 15% faster:** every gap of the drain as drawn times `dark.pace` (0.85): 6.74 s → 5.73 s; the whole intro about
   15.0 s from the marks to the board.
4. **Kept as drawn:** the lanterns far to near (the nearest last), the string west to east then the tree up to its star, his eyes two
   dim violet slits in the black (0.9 s), the cool violet-grey dim light (steady), your tag fading as the drain starts.
5. **Into the match (the director's call; Eric may change it):** no second blackout, no storm. The dim light closes in on the board
   (an iris, 0.6 s), a black cover takes over at once (`startDark`, `canvas.boss-dark`), the battle loads under it, and the match comes
   up out of the dark (a fade from black, 0.6 s).

## The calls

- **His line is 1.8 s** (`dark.lineMs`; the mockup's 1.5 s, the others' 2.5 s). With the table's pop added before the charge, the
  shared 2.5 s took the whole to 15.7 s; "Did you leave a light on?" is five words. His channel line has the full 2.5 s (`chantMs`),
  over the charge and the swell, and is gone before the first lantern goes out (a unit test).
- **What "every gap" scales:** the drain's beats (each lantern's start, the string's start and its run, the tree's, his strand's thirds,
  your pawn's, full). The art's own animations keep their drawn speed (a lantern's 1.02 s going out, the tree's 1.1 s, his moves, the
  motes' flights). The lanterns are now 0.51 and 0.43 s apart: each still starts only after the last has dropped from its flare (two
  of its frames, its light down to 0.35; a unit test).
- **His settle in the dim light is kept** (the ball sinking back into him, in place, as drawn): "nothing moves" read as nobody
  changing place and nothing appearing. If Eric meant him still too, `settle` can be dropped and he stands in his idle.
- **No attack swing** (every other intro ends with one): the dark is his transition, and a lash in the dim light would break it.
- **Sounds.** Hollow's are never chimes (Eric, Oct 9; `hollow.test.ts` keeps them under 800 Hz), so where the art's notes ask for "a
  falling chime run" (the string) and "a last bright chime" (the star), they are a run of dull, muffled knocks falling in pitch and a
  muffled low minor third cut short. New in `characters/hollow-sounds.ts`: gutter, snuff, drain, tink, star, sip, pawn, blackout, settle;
  the swell is his cast played at 0.7 and the full ball's hum his hum at 0.75 (`hollowSwell`, `hollowDeep`: the notes' "pitched down").
  The charge's hum is his hum once a loop, not rising (the sound player has no pitch per call: simple beats flashy). A snuff isn't
  pitched down per lantern. Sips and ticks: at most one each 80 ms (the notes'). Nothing plays in the black.
- **Your pawn greys** (white to a light grey-lilac) only as the plain pawn; a skin's picture isn't recolored. Its glow and motes show
  for everyone.
- **Every light in the cave goes out** by the blackout ("light from everything around"): the fire pit, the crate and the crack (round the
  bend, out of the intro camera) fade with the room's dark and are gone from the blackout on.
- **Glows over the room.** In his challenge the lights' glows are drawn over the pieces and figures (as the mockup draws them), so a lit
  lantern still shines in a darkening room; in his shop they stay under, as before.
- **Load time.** His art loads only when you challenge him (its own chunk) and every frame is drawn as the room loads: only the frames
  that show (a bulb piece on the way to all-dark shows a bulb's turn, about 30 ms: its first flicker frame alone; his drink at two
  thirds and one third of his strand lit, just the frames of those beats), each one's lit pixels found inside its lights' boxes only. At
  4x CPU: 1.45 s for the art's module, 2.7 s for the frames (Timber's intro 3.4 s). The cave's own art takes about 4.5 s at 4x (as
  before; not this change's).
- **The draw cost** in the room through the intro is the room's own: 11 to 16 ms a draw on an emulated phone (headless), the same
  before the drain, mid-drain and in the dim light. The town's frame loop is unchanged (not measured).
