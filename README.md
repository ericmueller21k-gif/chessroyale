# The Hidden Boss's transformation, round 2: white eyes, the light's white-out, the visor (MOCKUP, Nov 14)

Eric's notes on round 1, all in: his arms hang relaxed at his sides the whole time (never raised); his eyes go totally white
as the light takes him; the light keeps pouring out more and more until it engulfs him, shoots up off the board and off the
screen, radiates in every direction and whites out the whole screen (it still pushes his hair back); he changes unseen, in the
white; the light dies back down into the center and shows him with a robotic visor across his eyes, tiny code flowing down its
glass (no cyborg, no half robot, no engine eye); then his line about computation and creativity. And the big board is gone from
the split's first frame (no big board hiding behind the four).

- `phone-transform.gif` / `computer-transform.gif`: from the cutscene's last line to "PHASE 2" (12.5 frames a second; the MP4s are 25).
- `visor-closeup.gif`, `visor-closeup-a.png`, `-b.png`: the visor up close, its code flowing (2.4 s).
- Stills `phone-NN-*.png` / `computer-NN-*.png`: one per beat, numbered as in the table.
- Made from a real fight mid-game by `scripts/preview-recluse-transform.mjs` over the dev lab `packages/app/src/dev/recluse-transform-lab.tsx`
  and the visor `packages/app/src/components/RecluseVisor.tsx` (on `claude/recluse-transform-book`; nothing in the game uses
  them yet). The one game-code change: a `possessed` eye shape in his drawing (`characters/recluse.ts`), used only by the lab.

## Beat by beat (s from T0, when the book starts to open; T0 is also when `recluse-phase3`'s intro starts)

| s | What happens | The music (`recluse-phase3` marks) | Still |
|---|---|---|---|
| −4.2 | The cutscene's last line ("I'm not sure. The only one who can prove it is right next to me.") | his beaten theme | 01 |
| 0.0 | The book flat on the board in front of him lifts its cover and falls open (1.1 s). Its pages light up, motes rise. He looks down at it | the intro starts | 02 |
| 2.64 | The light bursts out (the summoning's look) and takes him: his head goes back, **his eyes go totally white** and glow | **slam** 2.64 | 03 |
| 3.04 | A shaft climbs from the book through him and lifts him off his knees (1.9 s), **his arms hanging at his sides**, his hair pushed back. From here the light grows, faster and faster: more and longer rays, a wider shaft, a glow closing round him | **build** 3.04 | |
| 4.94 | He hovers a little in the beam, head back, arms drifting just off his sides, hair streaming | | 04 |
| 5.6 | The beam shoots up off the board and off the top of the screen | | 05 |
| 6.3 | Rays radiate from him in every direction across the whole screen; he's lost in the glow | | 06 |
| 7.3–8.0 | The whole screen whites out | | 07 |
| 8.0–8.7 | Full white. Unseen: he changes (phase 2's look and the visor), he's set back on his feet, the child and the lens are gone | | 07 |
| 8.7–10.0 | The white dies back down into the center (a shrinking disc of light into him) | | 08 |
| 10.0 | **Him, with the visor**: phase 2's look, his hair streaming, arms at his sides; the visor boots up (a flicker) and its code flows | | 09, close-up |
| 10.25 | His line in a box over his head: "Computation without creativity is nothing. / Now I have both." (typed by 13.9, read until he crouches) | | 10 |
| 16.24 | He crouches over the book | | |
| 16.435 | He leaps high, straight up, and hangs for a second; the open book stays glowing on the board | **breath** 16.435 | 11 |
| **17.435** | **He lands on the drop.** A flash, the board cracks under him; **the big board is gone from this frame on** (only the four quarters show). The blue arcs strike out from his hands at his sides | **drop** 17.435 | 12 |
| 18.2 | The quarters part (nothing behind them) and grow into four boards (+0.4, 0.9 s), the light dies out | | 13, 14 |
| 18.2 | His second line in his usual bubble: "Prepare yourself. / This is the ultimate test of your skill." (typed by about 21.9) | | 13, 14 |
| 19.6–21.1 | The book snaps shut into his hands (`pickup`), the pieces fly to their Chess960 squares, he leaps back to his place (`leap2`) | | |
| 21.2 | "PHASE 2" (2.15 s), then the 5-4-3-2-1 countdown and the clocks start, as today | | 15 |

The split still lands on the music's drop (the intro is 17.435 s). The whole thing runs 23.4 s from the book to the end of
"PHASE 2", as in round 1.

## Calls I made (Eric can say otherwise)

- **His second line moved after the landing.** Eric wants the computation line after the reveal (10 s in); it takes 3.7 s to
  type and should be read, so both lines no longer fit before the drop the way round 1 had them. Both lines stay (Eric, Nov 13):
  the first over his head after the reveal, the second ("Prepare yourself...") in his bubble as the boards split, typed out
  before "PHASE 2" and gone before the clocks start (his phase 2 line comes with the clocks, as today).
- **The visor** (original design): a wraparound band of smoked glass across both eyes in a gunmetal frame, a bright top rail,
  the ends wrapping past his face, a bridge resting on his nose, a small module at his temple (our right, the board side) with a
  blinking cyan light. The code: tiny green glyphs (each a pixel wide and a pixel and a half tall) falling in trails down the
  glass, a bright glyph leading each trail, in three strips sliding at their own pace. On a phone's board figure it reads as a
  green shimmer of code; on the bust and on a computer you see the glyphs. Cost: one picture made once, three sliding strips
  (transform only, no drawing per frame), so it is as light as the engine eye it replaces. It rides his head frame by frame the
  same way the engine eye did (`placeEngine`), so in the build it shows everywhere his phase 2 look shows: his figure, the boss
  bar's bust, the four boards' figure. His brows sit just above it, stern.
- **His eyes:** a new `possessed` eye (all white, no iris) in his drawing, plus a soft white glow on each eye drawn with the light,
  from the slam until the white-out.
- **He hovers** a little in the beam as the light grows (about 3% of the board), and is set back on his feet unseen in the white.
- **The landing:** his arms stay at his sides (Eric: "the whole time"), so the arcs strike out from his hands at his sides
  instead of from raised hands.
- **The big board:** from the crack's first frame only the four quarters show. In the build, the same in the game's split.

## On "go": what changes in the game

The God King's absorption is removed: `absorbKing`, `AbsorbStream`, the seize/seizeLoop/seized/rage beats in `PHASE_CHANGE`,
`king` in the dock (he stays in his place, greyed, as #703 left him), his triumph and drain lines, and his sounds there. The
cutscene's ending becomes this sequence; `PHASE_CHANGE` is re-timed so the crack is the intro's drop; the engine eye becomes the
visor everywhere; the big board is hidden from the split's first frame. The boss kit and the split-on-the-drop test stay green.
The server's phase-change length (`RECLUSE_ONLINE.changeMs`) follows the new total, and I'll list any protocol pieces in the PR.


---

## Round 1 (history): the Hidden Boss's transformation, redone: the book's light, no God King (MOCKUP, Nov 14)

Eric's ask: after the cutscene, no glitch back to his place and no stealing the King's power. The book on the floor in front of him
opens and light pours out of it (the same light as the summoning in his room), it beams up into him, and that's what transforms
him. It's one smooth transition, still in the zoomed-in lens with the child beside him. Once he's the cyborg, the lens lifts and
he jumps and splits the board where he stands. The God King is left out of it.

- `phone-transform.gif` / `computer-transform.gif`: from the cutscene's last line to "PHASE 2" (12.5 frames a second; the MP4s are 25).
- Stills `phone-N-*.png` / `computer-N-*.png`: one per beat, numbered as in the table.
- Made from a real fight mid-game by `scripts/preview-recluse-transform.mjs` over the dev lab `packages/app/src/dev/recluse-transform-lab.tsx`
  (on `claude/recluse-transform-book`; nothing in the app imports it). No game code was changed.

### Beat by beat (s from T0, when the book starts to open; T0 is also when `recluse-phase3`'s intro starts)

| s | What happens | The music (`recluse-phase3` marks) | Still |
|---|---|---|---|
| −8.8 | The cutscene's last line ("I'm not sure. The only one who can prove it is right next to me.") | his beaten theme | 1 |
| 0.0 | 0.4 s after that box is gone, the book flat on the board in front of him lifts its cover and falls open (1.1 s). Its pages light up and motes rise. He looks down at it | the intro starts (the beaten theme fades out under it) | 2 |
| 2.64 | The light bursts out with the summoning's look: rays shoot up and outward, rays run across the board, and a pool of gold spreads. His head snaps back, eyes wide | **slam** 2.64 | 3 |
| 3.04 | A shaft of light climbs from the book up through him and lifts him off his knees (1.9 s) | **build** 3.04 | |
| 3.34 | His first line in a cutscene box: "Computation without creativity is nothing. / Now I have both." (typed by 7.0) | | 4 |
| 4.94 | His arms go up and his hair lifts into phase 2's (his own `chantRaise`, then the `chant` loop), and he sways in the beam | | 4 |
| 7.60 | A white flare runs up the beam, his engine eye and circuit lines ignite, and he's the cyborg. Over 0.9 s the rays draw back into the book, which keeps glowing | | 5, 6 |
| 11.3 | The lens lifts (0.7 s) and the child fades (his own fade frames, 1.4 s) | | 7 |
| 12.8 | His second line, in his usual bubble (the lens is gone): "Prepare yourself. / This is the ultimate test of your skill." (typed by 16.4, a second before the drop, as today) | | 8 |
| 16.24 | He crouches over the book | | |
| 16.435 | He leaps high, straight up, and hangs for a second. The open book stays glowing on the board | **breath** 16.435 (the silence) | 8 |
| **17.435** | **He lands back over the book on the drop.** A flash of light, and the board cracks under him. His arms fly up and the blue arcs strike from his hands | **drop** 17.435 (the loop starts) | 9 |
| 18.2–19.5 | From here it's today's sequence with today's gaps after the crack: the quarters part (+0.75) and grow into four boards (+1.15, 0.9 s), the light dies out | | 10 |
| 19.6–21.1 | The book snaps shut and flies into his hands (`pickup`), the pieces fly to their Chess960 squares, and he leaps back to his place (`leap2`) | | |
| 21.2 | "PHASE 2" (2.15 s), then the 5-4-3-2-1 countdown and the clocks start, as today | | 11 |

So the split still lands on the music's drop: the intro is 17.435 s, and the music's breath is 1 s before the drop, so the leap's
1 s of hang time fills that silence and he lands on the drop. The whole thing runs 23.4 s from the book to the end of "PHASE 2",
against about 35 s today from the end of the cutscene (the God King's absorption, his rage, the leap in, the book throw and the
cast are all gone).

### Calls I made (Eric can say otherwise)

- **Where he jumps:** he jumps straight up and lands back where he knelt in the light: 42.5% across the board and 66% down, a
  little left of the middle. That's the spot the cutscene put him in. The crack still runs down the board's middle. He keeps the
  book at his feet the whole way, so it never jumps or pops.
- **His two chant lines stay** (Eric's, Nov 13). The first is in a cutscene box while the lens is up. The second is in his usual
  bubble once the lens is gone, still typed out a second before the drop.
- **The light** is the summoning's own sprites and beats (`town/shops/recluse-scene.ts`) drawn flat on the board. In the real
  build I'd export them from one shared module rather than copy them. Inside the lens the room darkens a little as the light comes on.
- **His frames:** all are existing art (kneeling, rise stances, `chantRaise`, `chant`, `pickup`, `leap2`). There is one new
  short set: the book opening on the floor (its `half` and `read` parts), the lift off his knees, and the jump with the book
  left lying open.
- **What this mockup doesn't show:** the screen behind is phase 1's fight mid-game, so the dock still says "Your move." and the
  clock runs. In the game it's the phase change's screen. The "PHASE 2" banner is CSS-animated and doesn't show up on a paused
  clock (it's unchanged). On a computer his second line sits in his bubble by his empty place at the board's bottom left.

### On "go": what changes in the game

The God King's absorption is removed: `absorbKing`, `AbsorbStream`, the seize/seizeLoop/seized/rage beats in `PHASE_CHANGE`,
`king` in the dock (he stays in his place, alive and unused), his triumph and drain lines, and his sounds there. The cutscene's
ending (the child's fade, the hold, the lens lifting) becomes this sequence. `PHASE_CHANGE` is re-timed so the crack is the
intro's drop, the boss kit stays green, and so does the split-on-the-drop test. The server's phase-change length
(`RECLUSE_ONLINE.changeMs`) follows the new total, and I'll list any protocol pieces in the PR.
