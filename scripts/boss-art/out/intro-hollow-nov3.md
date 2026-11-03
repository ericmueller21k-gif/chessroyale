# Hollow's battle intro art (Nov 3): the darkness ball that drinks the light

Eric's design (`notes/hollow-intro-eric.md`): Hollow walks on to his mark on the pond. The darkness ball in his belly powers
up: material builds up around it, spins, and it grows a little. It **sucks in the light**: the lanterns go out one by one,
the bulb string's lights are drawn in toward him, and so is light from everything around, even your own pawn. Everything goes
black. It does **not** come back on: it stays dark everywhere, with a **dim, steady light** around you, the board and him.
Then the battle starts. The boss is on the left and you're on the right. It can run longer than the others' ~12 s.
- Brief: `notes/briefs/brief-hollow-intro-art.md` (director's notes).

## Cost
**Drawn by hand on the weekly plan usage** (Eric, Nov 3), not with the API runner. There was no API spend. The exports and
format match what the runner makes.

## Previews (mockups)
- **The whole intro from the phone's intro camera** (390 x 844, about 15.8 s):
  [view-intro-sequence.gif](house-intro-hollow/view-intro-sequence.gif). Key frames:
  [view-intro-keyframes.png](house-intro-hollow/view-intro-keyframes.png).
  - The camera is the game's challenge camera (`CHALLENGE_FEEL.cam.across`): 0.75 squares west and 0.8 south of the pond's
    middle (12.5, 11.5), at the town's zoomed-in camera. It sits under the room's 52 px header, as in the cave round's still
    `docs/hollow-shop/intro-start-lanterns-phone.png` (`claude/hollow-shop`). From it, 4 of the 5 lanterns are in view:
    (9,5), (11,8), (9,11) and (13,16). The bulb string, the backdrop's candle and the tree are in view too.
  - The cave's lights are drawn as ShopRoom draws them: each lantern's halo and its pool on the floor.
  - The table and the board are stand-ins (the park table, and a plain board in the across layout). The game draws the
    real ones.
  - Made by `scripts/boss-art/intro-hollow-view.ts`. The GIF command is in its header.
- **Stills** (2x):
  1. [The ball powering up](house-intro-hollow/view-1-charge.png) (4.3 s).
  2. [Mid-drain, lanterns going out](house-intro-hollow/view-2-lanterns-out.png) (7.3 s). Two lanterns are out, the third
     is going and its light streams into him, and the motes from the lantern off the right edge are coming in.
  3. [The bulb string draining](house-intro-hollow/view-3-bulbs-drain.png) (9.7 s). The dark runs along the back wall
     toward the tree, and each bulb's mote flies to the ball.
  4. [The blackout](house-intro-hollow/view-4-blackout.png) (13.3 s). Only his eyes show, two dim violet slits.
  5. [The dim light before the battle](house-intro-hollow/view-5-dim-light.png) (15.2 s).
- **His new moves at 3x:** [charge](house-intro-hollow/move-charge.gif), [swell](house-intro-hollow/move-swell.gif),
  [drink](house-intro-hollow/move-drink.gif), [full](house-intro-hollow/move-full.gif),
  [settle](house-intro-hollow/move-settle.gif).
- **The props at 3x:** [a lantern going out](house-intro-hollow/props-lantern-out.gif) (both pieces, out of step),
  [the backdrop's bulbs going dark](house-intro-hollow/props-bulbs-out.gif) (its candle goes out with the first),
  [the tree going dark](house-intro-hollow/props-tree-out.gif), [the motes](house-intro-hollow/props-motes.gif) (4x).

## For the code helper
### Hollow: `BOSS_HOLLOW_INTRO` (id `hollow-intro`) in `boss-hollow/boss-hollow.ts`
- **There is no runner copy of Hollow**, since his drawing is the game's (`characters/hollow.ts`). So this file adds nothing to
  his file. It builds the new poses from his own rig (`hollowBuild`), reads his existing parts from `HOLLOW.parts`, and adds
  one new part kind, the ball, drawn where his void is. His old frames are untouched.
- **His frame, same as HOLLOW's:** 104 x 102, foot **[50, 96]**, facing front, lit from the top left. He has the same halo,
  looks (`bulbs3` ... `bulbs0`) and battle-lights swap.
- **The walk on** is the shared intro's: his `idle`, slid to his mark (11, 11.5).

| Animation | Frames | Cues | What it does |
|---|---|---|---|
| `charge` | 8 x 100 ms, loops | `hum` f0 | He crouches with his free claw cupped by the ball and the strand held low. The ball (radius 7 to 7.5; his void is 5.5) spins fast. Three streams of violet material wind in from all round and build up a ring spinning round it. |
| `swell` | 110, 110, 110, 140 ms (470) | `swell` f0 | The ball swells 8, 9, 10 with a pulse and a judder. He throws his arms out. |
| `drink` | 8 x 100 ms, loops | none | He's braced wide, claws out low and open, roaring, and shaking with the pull. The ball (10 to 10.5) has a bright violet edge, with warm flecks of light sparking where it lands. |
| `full` | 8 x 120 ms, loops | `hum` f0 (deep) | He stands up in the dark with his eyes as slits. The ball is at its biggest (11 to 11.5), nearly black, throbbing slowly, with a faint shimmer round it. |
| `settle` | 110, 100, 100, 110, 140, 300 ms (860) | `settle` f0 | The ball sinks back into his belly to his own void, and he stands for the fight. The last frame is his idle's first. |
| `idle` | 1 | none | Standing. |

- **`HOLLOW_INTRO_HEART`:** the ball's middle on each frame of each move (frame pixels). It's [50, 65] standing, and one
  pixel lower per pixel of crouch or bob. The motes fly to it.
- **`HOLLOW_INTRO_BALL_R`:** the ball's radius per frame. A mote vanishes when it reaches the rim.
- **His own strand's bulbs** are lit in every frame, as in his idle. Put them out with his looks, a third at a time, as the
  drain reaches him (`bulbs2`, `bulbs1`, `bulbs0`, at 11.0, 11.15 and 11.3 s in the timeline), each bulb sending a mote.
  Keep `bulbs0` for the rest of the intro.
- **Sounds:** `characters/hollow-sounds.ts` already has `hum`, `cast`, `whisper`, `pop`, `smash`, `relight`, `clink`. Cues
  the intro needs:

| Cue | When | Suggested sound |
|---|---|---|
| `hum` | each `charge` loop (0.8 s), getting louder and higher each loop; once a `full` loop, deeper | his `hum`, its rate and volume rising |
| `swell` | `swell` f0 | a deep swelling whoomp (a `cast` pitched down) |
| `gutter` | each lantern's `gutter` f0 | a flutter as its flame is pulled (soft, a breathy whoosh) |
| `snuff` | each lantern's `gutter` f3 | a small puff as it goes out, pitched down a little for each lantern |
| `drain` | the string's run starting, and the tree's `drain` f0 | a falling chime run, a glassy glissando down the string |
| `tink` | each bulb going dark (about 30 ms apart along the run) | very quiet glass ticks (optional; the `drain` run may be enough) |
| `star` | the tree's `drain` f8 | a last bright chime cut short |
| `sip` | a mote landing on the ball (`INTRO_HOLLOW_MOTE` `sip` f0) | a tiny soft suck. Play it at most every 80 ms, or the bulbs' run is a buzz |
| `pawn` | your pawn's light leaving | a pale, airy rising tone |
| `blackout` | the blackout (12.9 s) | a deep thoom, then **silence** (cut the hum) |
| `settle` | `settle` f0 (in the dim light) | a low settling breath, then the battle |

### The props: `house-intro-hollow/house-intro-hollow.ts`
Each piece stands in for the cave piece of the same name (`SHOP_HOLLOW_PIECES`), with the same size, foot and frame timing.
So code swaps the Character at that placement and keeps drawing it as the room does (`INTRO_HOLLOW_PIECES` maps them by the
cave's names).
- **`INTRO_HOLLOW_LANTERN_OUT`** (for `lantern`) and **`INTRO_HOLLOW_LANTERN_B_OUT`** (for `lantern-b`): 37 x 130, foot
  [18, 129].
  - `gutter<k>`: 6 x 170 ms (1.02 s). The flame flares white-hot, drops low, sputters, goes out to an ember, and a puff and
    then a thin wisp of smoke curl up off its cap. Cues `gutter` f0 and `snuff` f3.
  - `idle`: the lantern unlit (dark smoky glass, a cool sheen), swaying as before.
  - `lit`: the cave's own loop, which I checked pixel for pixel.
  - **To stay in step with its sway:** start `gutter<k>` with k = the lantern's sway frame then (`floor(t / 170) % 8` on the
    room's clock), then go on to `idle` on the same clock.
  - **`INTRO_HOLLOW_LANTERN_GLOW` = [1.3, 0.75, 0.35, 0.08, 0, 0]:** the light's strength on each `gutter` frame, times the
    cave's own (its halo in `SHOP_HOLLOW_LIGHTS` and its pool in `SHOP_HOLLOW_POOLS`). After that it's 0.
- **`INTRO_HOLLOW_BULB_PIECES`** (for `bulbs`, `bulbs-b`, `bulbs-c`, `bulbs-step`, `backdrop`, `sled`), each with its own size
  and foot:
  - **How the bulbs are indexed:** each piece's bulbs are found inside its own light's box and counted **left to right as
    drawn**.
  - **The anims:** `l<n>` has its n left-most bulbs dark, and `r<n>` its n right-most. `l0` is the cave's own (checked pixel
    for pixel), and each keeps the cave's flicker for its lit bulbs.
  - **The counts:** 4 bulbs (`bulbs`, `-b`, `-c`), 3 (`bulbs-step`, `sled`) and 16 (`backdrop`).
  - A dark bulb is drawn as the cave draws a burnt-out one (`Ç`, its glint `3`), so its keyed light goes with it.
  - **The backdrop's candle** goes out with its first dark bulb.
  - **`INTRO_HOLLOW_BULB_RUN`:** all 57 bulbs in the order the dark runs, **west to east**: from the corner behind the counter
    (2, 2), across the backdrop, round the curve to the tree (16, 6), with the sled's three as the run passes (12, 4). Each
    entry has its placement (`col`, `row`, `piece`, `flip`), `n` (its place among that placement's bulbs in the run) and `at`
    (its middle in the piece's own pixels).
  - **Which anim:** once n + 1 of a placement's bulbs are dark, its anim is `l<n + 1>`, or `r<n + 1>` on a flipped placement
    (only the step at (2, 2)).
  - **Each bulb's mote color** comes from its glass key (`INTRO_HOLLOW_BULB_MOTE`). Burnt-out bulbs send none.
- **`INTRO_HOLLOW_SHOWPIECE_OUT`** (for `showpiece`, the tree): 111 x 178, foot [55, 159].
  - `drain`: 10 x 110 ms (1.1 s). The bulbs go out from the bottom up the string, the star's rays and sparkles stop (f8),
    then the star goes to dark brass (f9). Cues `drain` f0 and `star` f8.
  - `idle`: dark.
  - Fade its star's halo and its pool over `drain`.
  - `INTRO_HOLLOW_STAR_AT` (56, 21.5) is the star in its pixels, where the last motes leave from.
- **`INTRO_HOLLOW_MOTE`:** 13 x 13, foot [6, 6] (its middle). It twinkles: 3 x 70 ms, looping, start each one at a random
  frame.
  - **Kinds:** `warm-l`, `warm-m`, `warm-s` (lantern light); `red`, `green`, `blue`, `gold`, `orange`, `pink`, and each again
    as `-s` (bulbs); `star`; `pawn` and `pawn-s` (paler, cool white).
  - **`sip`** (3 x 50 ms, cue `sip`): a violet-white flick where one goes into the ball.
  - **`INTRO_HOLLOW_MOTE_GLOW`:** each kind's light color.
  - **How the mockup flies them** (all yours to tune):
    - Each draws at the room's scale (k / 37), with a soft glow of its color 5 of its pixels round it (alpha 0.5, additive).
    - Its trail is 3 glows at where it was 30, 60 and 90 ms before (0.45, 0.28, 0.14).
    - Its path is a quadratic curve that bows upward by 28% of its length, eased in (u^1.7, so it speeds up into the ball).
    - Its flight lasts 380 ms + 1.6 ms a screen pixel, held between 450 and 1000 ms. It homes on the ball as he moves.
  - **How many:** 8 from each lantern (2 large, 3 medium, 3 small, 75 ms apart from its `gutter` f0), 1 from each lit bulb,
    16 up the tree plus 3 from its star, 1 from each of his own bulbs, and 6 from your pawn.
- **`INTRO_HOLLOW_BALL_GLOW`:** a violet (#9c6cff) glow round the ball while it works, so it reads at phone size. Draw it as
  a halo, its radius `r` of his pixels past the ball's own. `a` is its strength by move (charge 0.55, swell 0.7, drink 0.6,
  settle 0.2, none in `full`), with a slow pulse (0.85 to 1).
- **The dark, `INTRO_HOLLOW_DARK`:**
  - Lay `tone` #040309 over the whole room (floor, pieces, figures) at the alpha the level reaches. Then draw the lights
    still lit over it, using their own lit pixels (`SHOP_HOLLOW_LIGHTS`' keys in their boxes; his eyes, the ball's bright
    violet and his bulbs), then the glows, then the motes. That way a lit lantern still shines in a darkening room.
  - The level rises with each light gone: 0.08 for each lantern, 0.12 over the string's run, 0.08 over the tree, 0.03 over
    his strand and 0.03 for your pawn (about 0.66 in all). The blackout then takes it to 1 over 160 ms.
  - In the black (900 ms), only his eyes show: #7d5bc8 (his dark stance's slits) at 0.7.
- **The dim light, `INTRO_HOLLOW_DIMPOOL`:**
  - **Where and how big:** an ellipse on the screen, centred 0.5 squares west of the table's middle and lifted 0.9 squares
    (the figures stand in it). It's 4.6 x 2.3 squares, measured at the table's depth (k px a square).
  - **How bright:** the room shows through at 0.72 out to 0.55 of the way to the edge, then falls off smoothly (smoothstep) to
    the black. Inside, it's tinted #c2bdf0 (multiply), a cool, faint violet-grey.
  - **How it comes up:** over 700 ms. It's steady after that, with no flicker or breathing.
- **The table** (the default park table, or his own later) is put down **during the black**. You and he take your clear
  places in the black too (him 2.92 squares west of the table, you 2.2 east), so the dim light comes up on everything already
  set.

**Suggested timeline** (about 15.8 s; the mockup plays it):

| Time (s) | What happens |
|---|---|
| 0 | You both walk on to your marks (the shared intro, his idle; about 0.9) |
| 1.2 | His line, "Did you leave a light on?" (1.5) |
| 2.8 | `charge` loops: the hum builds (2.2) |
| 5.0 | `swell` (0.47) |
| 5.46 | `drink` loops until 12.2 |
| 5.6 | Lantern 1 goes out: (9, 5), at the back by the sled |
| 6.2 | Lantern 2: (11, 8), the middle of the passage |
| 6.8 | Lantern 3: (9, 11), on the wall at his left |
| 7.3 | Lantern 4: (17, 12), just off the right edge (its motes stream in from off screen, and its pool at the edge goes) |
| 7.8 | Lantern 5: (13, 16), nearest the camera, the biggest, last |
| 8.4 | The string drains west to east in a run (1.8 s, about 32 ms a bulb), with the backdrop's candle |
| 10.3 | The tree: its lights from the bottom up, then the star (1.1) |
| 11.0 | His own strand, a third at a time (11.0, 11.15, 11.3) |
| 11.5 | Your pawn: a pale glow gathers on it and is drawn off in 6 motes, and the pawn dims a little (0.5) |
| 12.2 | `full` (0.7): everything is gone, the ball hums |
| 12.9 | Blackout (0.16), then black until 13.8. The table goes down, and you both take your clear places |
| 13.8 | The dim light comes up (0.7), and he `settle`s (0.86) |
| about 15.8 | The battle starts |

Each lantern is 0.5 to 0.6 s after the last, so each one is seen going out on its own (`gutter` is 1.02 s, so the next
starts as the last one's smoke rises).

## Calls Eric may want to change
1. **The order the lanterns go out:** far to near: the back (9, 5), the middle (11, 8), his wall (9, 11), the one off the
   right edge (17, 12), and last the one nearest the camera (13, 16), as the climax. Each is visible from the intro camera
   except (17, 12), whose motes stream in from off screen.
2. **The string drains west to east**, from the counter's corner to the tree. Then the tree climbs to its star, so the dark
   runs on in one line and ends at the star. It could run the other way.
3. **Your pawn's light** is a pale glow drawn off in 6 motes, and the pawn dims a touch (white to a light grey-lilac). It
   doesn't go dark.
4. **His own strand** drains too, a third at a time, after the tree and before your pawn. Its bulbs stay dark for the rest
   of the intro.
5. **In the black, his eyes still show** as two dim violet slits, so the screen isn't a dead black frame for 0.9 s. It could
   be fully black.
6. **The dim light is cool violet-grey**, Hollow's own, with no source. It could be warmer (a last ember of the stolen
   light), or come from the board.
7. **The table appears during the black**, and you both take your clear places then. Eric's design doesn't bring the board
   in, so the dim light shows everything already set.
8. **The ball is baked into his frames**, not a separate effect: at its biggest (radius 11.5, with its ring 33 wide) it
   still fits his own frame. Its glow is a light code draws (`INTRO_HOLLOW_BALL_GLOW`).
9. **The ball when full is nearly black**, just a faint violet rim and a shimmer, "dark and humming". In the dim light he's
   back to his own void.
10. **The `Player` tag fades out** as he starts to drink, so the dark isn't broken by a bright label. His line's bubble is
    the shared intro's.
11. **About 15.8 s in all**, inside the 14 to 16 s Eric allowed.
