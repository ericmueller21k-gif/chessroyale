# Birdie round 2 (Nov 23): stills and the art runs' notes

Drawings, briefs, summaries and logs are on `claude/boss-art` (commit 31a1f32). Eric's yes to the spend came in this session
before the runs: four runs, $21 at most (caps $8, $5, $4, $4).

## Spend (API $, the Claude API runner; not plan usage)

| Run | What | Spend | Cap |
|---|---|---|---|
| 1 | Birdie's full animation set (`boss-birdie`) | $3.90 | $8 |
| 2 | The train on the board (`birdie-train`) | $1.73 | $5 |
| 3A | Armored Birdie, sleek (`boss-birdie-armored-a`) | $1.37 | $4 |
| 3B | Armored Birdie, chunky (`boss-birdie-armored-b`) | $1.18 | $4 |
| | **Total** | **$8.18** | $21 |

## What is here

- `run1/`: the frame sheet and a GIF of each new animation (signal, depart, fall and the rest), the combined showreel, and the
  comparison. Idle is unchanged: checked pixel for pixel against variant B, all 21 frames, same timings.
- `run2/`: the train's frames (`train-ride-frames.png`, `train-crossing-frames.png`, `train-smash-frames.png`) and
  `train-board.png`: the train across two squares of row 2, the crossing lit on every square of row 1, and a smash on a square.
- `run3-a/` and `run3-b/`: each variant's frame sheet, idle GIF, and phone-size comparison.

## Things to know

- **Reference photos:** no reference pictures were given to the runs (Eric's photos stay off the branches). The drawings are
  built from the approved idle and the briefs.
- **The train's preview:** the runner's own preview step failed for run 2 (its preview tool needs an `idle` animation, and the train
  has `ride`, `crossing` and `smash`). The run 2 frames and board still were rendered from the drawing with the repo's own sprite
  renderer, and checked by measuring their pixels.
- **Armored Birdie reads Birdie's head** from the approved idle (`BOSS_ART_READ`), so the face, eye, beak and cap carry over.
- **Model names:** the runners' summaries named the model. I replaced that with "the art model" in the four pushed summaries.

## The runner's notes


### boss-birdie

#### Its notes

I've added all 14 of Birdie's animations, and his idle is unchanged. All 21 idle frames, their poses and timings are the same as before. Every new rig number defaults to rest, the idle frames list the same parts in the same order and places, and the idle renders the same as the approved one.

**The rigging (`BirdiePose`):** these are all new and all numbers.
- `lean` moves his body while his feet stay on the lip.
- `wing` and `far` open the near and far wing at an angle and length (`wingLen`) from his shoulder: scalloped feathers near the shoulder, dark fingered feathers out to the tip. When only the near wing opens, the folded wing behind shows a shade darker.
- `capTilt` and `capLift` turn and raise the cap; `capOff`, `capFree` and `capBehind` take it off or set it loose.
- `puff` puffs his chest, `ruffle` adds tufts, `beak` opens it.
- New eyes: joy, wide, up, back, sad, smug.
- `hidden` takes him out, and `tumble` turns him a quarter turn at a time.
- `train` and `wheel` move the whole train and turn its wheels.

**No new colors.** The hit flash swaps his keys one step lighter within his own ranges, and the headlight flash uses the existing white glint color. Steam, sweat, a tear, thought bubbles and speed lines are loose pixels in colors already in the palette. There are no letters or numbers anywhere.

**Beat by beat:**
- **entrance** (2.1 s): the train rolls in from the right, slowing, wheels turning (cue `roll`). It brakes with a small overshoot, a shake and a puff of steam (`brake`). He pops up out of the hatch and hops, wide-eyed (`pop`). He raises a wing and lifts and tips his cap, eyes smiling (`tip`), then settles.
- **thinking** (loops, 2.3 s): a dove's head-bob forward. He looks up with his head cocked back (the cap tilts), blinks, bobs again, then looks back over his shoulder. Thought bubbles grow from one to three.
- **move** (0.9 s): a nod (`nod`), then the near wing points down-left at the board (`point`), and he folds it.
- **capture** (1.05 s): four wing-beats, wings up and back, then out; he hops on the lip with smiling eyes and an open beak (`flutter`). A puff of steam rises from the roof (`toot`).
- **hurt** (0.86 s): he flinches back with a flash and a shake (`oof`). His feathers ruffle into tufts, loose feathers fly, and his cap is knocked askew. He blinks, raises a wing and straightens the cap.
- **check** (1.0 s): he leans out and points his wing at the board with his beak open (`point`). The headlights flash once, big then small (`flash`).
- **smug** (loops, 1.6 s): chest puffed, head back, heavy-lidded. A coo every loop, shown as little arcs off his beak (`coo`), with a slow blink.
- **rattled** (loops, 1.4 s): ducked low in the hatch with only his head showing, wide-eyed. He peeks left, ducks with a shudder, peeks right (mirrored), sweat drops fly, and he ducks again.
- **defeat** (2.5 s, last frame holds 1 s): a flash and a jolt (`oof`) knock his cap up and over. It lands on the roof behind him (`plop`). He sinks into the hatch until only his head shows, with a heavy sad lid and a tear.
- **victory** (loops, 0.9 s): flapping and bouncing with smiling eyes (`toot`). The headlights blink every other beat and steam puffs rise.
- **signal** (1.5 s): he leans out and waves his wing high over his head like a conductor, beak open, calling. The headlights flash three times. `cue: "signal"` is on the wave's highest point (frame 4).
- **depart** (0.96 s): he ducks into the cab. The train jolts back a pixel (`cue: "go"`, frame 3), then speeds away to our left out of the frame, leaving steam and speed lines. The last frame is empty.
- **fall** (0.83 s): a jolt (`cue: "fall"`, frame 0) throws him up with his feathers ruffled, and his cap flies off. He tumbles backward a quarter turn per frame, up over the roof, then down in front of the train and out the bottom of the frame. Then the train stands alone for one frame, and the last frame is empty.

**Choices you might want to change:**
1. **Pointing wing:** in move and check it points down-left at the board. Pointing level crossed his face and chest and didn't read. Being in front, it covers his tie while pointing.
2. **Raised wing:** for the cap tip, the wave and the flaps it rises behind his head. Raised forward, it covered his face like a floppy ear.
3. **Steam:** the train has no chimney, so the steam puffs appear just behind the hatch on the roof.
4. **The fall:** he drops in front of the train's side. The frame is too narrow for him to clear the train's rear end.
5. **The last frame of fall:** it's empty as you asked, so the train vanishes with him. If the game should keep the train there, drop that frame.
6. **The rotated cap:** the knocked-askew, tipping and flying cap is turned by code, so its edges are a little rough. Hand-drawn tilts would be cleaner if you want them.
7. **Edge warnings:** the renders warned about pixels touching the frame's edge in entrance, depart and fall. That's expected: the train enters and leaves, and the cap flies off.

### birdie-train

#### Its notes

I drew the train as board art, not a boss: the `BIRDIE_TRAIN` export, id "birdie-train", w 64, h 32, foot [32, 31], with only the three animations the brief asks for. The renderer still lists the boss animations as missing, which is expected here. There are no letters or numbers anywhere. The colours come from Birdie's train and cap palette, plus three see-through colours: the floor shadow, the red lamp glow and the headlight beams. I checked every animation on dark and light squares. I couldn't put an actual piece over the crossing in the renderer, so the "under a piece" check is a judgement, not a render.

**ride** (loops, 4 frames × 105 ms): the yellow toy diesel seen from above, nose to the right, filling the 64 × 32 frame.
- **Body:** a pale top edge and a darker bottom edge, the thin red stripe along both sides curving round the nose, and a rounded nose hood with three grille slats and two headlights.
- **Roof:** dark grey, with a seam and the windshield (two panes and a post).
- **Birdie:** seen from above in the open hatch, with the hatch lid standing up behind him. His long tail lies over the roof, his folded wings are scalloped with dark spots, and his head faces forward in the cap (navy top, gold band, black brim). His eyes show at the sides and his beak pokes out past the brim.
- **Frame by frame:**
  - The tyres' tread marks roll forward.
  - The rods between each pair of wheels move in and out on frames 0–1 vs 2–3.
  - The exhaust stack's glow pulses red on alternate frames.
  - Grey smoke puffs drift back off the stack, growing and thinning.
  - The headlight beams change length.
  - His head nods forward 1 px on frame 2.
- **Shadow:** offset 2 px down and right.
- **Phone size:** it reads as a yellow toy train with a little capped bird in it.

**crossing** (loops, 6 frames × 165 ms ≈ 1 s): drawn only in the left square (x 0..31); the right half is empty.
- A white crossbuck (two crossed bars) with a dark outline and a faint halo.
- A red lamp in the open space on either side of the crossing.
- The lamps swap every frame: the lit one is bright red with a hot core and a glint, a see-through red glow and short rays. The unlit one goes dark maroon.
- A piece standing in the middle covers the crossing point of the bars, but both lamps sit to the sides and should stay visible.

**smash** (one shot, 5 frames, 420 ms): left square only.
1. A bright 8-point white-gold star (60 ms), with `cue: "smash"` on this frame.
2. A round puff of tan dust with sparks shooting out (80 ms).
3. The puff spreads into a ring with a hole in the middle, sparks further out (90 ms).
4. A wider, lumpier ring with a few last sparks (100 ms).
5. Faint scattered wisps with no outline, fading out (90 ms).

**Choices you may want to change:**
- **Lamp placement:** the lamps sit left and right of the crossbuck so a piece in the middle doesn't hide them. The left lamp's glow is cut off flat at x 1 so nothing touches the frame edge.
- **Flash rate:** the lamps alternate every 165 ms, about 3 swaps a second. That's faster than a real crossing, because the brief says to alternate each frame.
- **Smoke:** it's grey (it's a diesel) and fairly faint, mostly over the back of the roof. It could be bigger.
- **Hatch lid:** it's drawn standing up (a thin bright line just behind Birdie) rather than flipped flat onto the roof.
- **Birdie at phone size:** at 1x he reads as a small brown bird with a navy cap. The face detail only shows when zoomed in.

### boss-birdie-armored-a

#### Its notes

Armored Birdie, variant A (sleek): only the idle is drawn, as the brief asked. The render tool still warns that the other animations are missing; that's expected. I checked every idle frame at 4x and larger on dark and light grounds, the two glints up close, and the phone-size view beside the tiger: he's about the tiger's height, and the face (eye, beak, cap) reads as Birdie.

The idle (19 frames, about 5.3 s, loops):
1. He stands still, then breathes: his upper body (head, cap, tie, chest plate, shoulder pads, wings) rises 1 px and settles; his hips and legs stay put.
2. The near shoulder headlight glints: the glass turns white and a small plus-shaped twinkle shows short, then long, then fades (3 frames).
3. He blinks: half, shut, half.
4. He breathes again and turns his head 1 px toward the board, then takes a breath with his head still turned.
5. He comes back to rest, then the far headlight glints the same way.
6. One last breath, then rest.

The design:
- Head: Birdie's approved head and eye paint copied exactly (round grey-brown head, buff face, grey beak, big dark eye in its pale ring with a glint, dark cheek mark). He faces a little to our left.
- Cap and tie: the same navy cap and gold band; the small brim is now a gold visor. The burgundy tie sits at the throat.
- Chest plate: yellow, shaped like a rounded locomotive nose, with a charcoal collar along the top, the red stripe down the middle, faint seams and a belly seam.
- Shoulders: rounded pads with a charcoal top (like the train's roof) over a yellow band, the red stripe between, and a headlight in each.
- Wings: hanging at his sides like arms. Two thin yellow plates with scalloped lower edges over the feathers, a pale feather fringe between them, dark fingered flight feathers below. The near wing also has a thin red stripe.
- Waist and legs: charcoal waist with a small gold buckle, charcoal thighs, yellow knee plates, tall yellow boots with a red stripe and charcoal toe caps, toes pointing a little to our left.
- Colors and size: only the train's yellow, charcoal and red, the cap's navy and gold, Birdie's own head, tie and feather colors, and the cream headlight glass, plus one darker yellow for shadow. Frame 74 x 88, feet at (37, 85).

Choices you might want to change:
- Tail: I added his long dove's tail, sweeping down behind the near leg to our right, with a dark band and pale tip, so he still reads as a dove. It could be shorter, or cut.
- Head size: kept at Birdie's original size, so it's smallish on this taller, broad body. It reads at phone size, but scaling it up 10-15% would look chunkier and warmer.
- Gold visor: small, matching the old brim. It could stick out further or carry more gold.
- Glint colors: each headlight has its own color key (the same cream) so they can glint one at a time. The twinkle uses the existing white and cream, no new colors.
- Breath and head turn: the breath moves the whole upper body, wings included, by 1 px; the head turn is also 1 px and subtle.

File: scripts/boss-art/out/boss-birdie-armored-a/boss-birdie-armored-a.ts

### boss-birdie-armored-b

#### Its notes

I've drawn Armored Birdie's idle (variant B, chunky) and checked every frame at 4x on dark and light, and at phone size beside the tiger. He's 74 x 90 with his feet at (37, 87), a bit taller than the tiger. At phone size he reads as Birdie: the eye, beak and cap come through. The other ten animations aren't drawn, as the brief said, so the render warns that they're still missing.

Idle (16 frames, about 5.3 s, loops):
1. He stands still (0.5 s), breathes in (the body rises 1 px), settles, then blinks once.
2. Another breath, then he glances 1 px to our left, toward the board.
3. The headlights glint one after the other: the near (right) one as a small star, then a bigger one, then the far one the same way (4 short frames).
4. A last breath and blink, then a longer rest (0.7 s) before the loop starts again.
The legs and boots never move; everything above the hips rises with the breath.

What he looks like:
- Head: Birdie's own head paint, made bigger. The round grey-brown head, buff face, grey beak and dark eye in its pale ring with a glint are all there. The navy cap keeps its gold band and now has a gold visor. The burgundy tie sits at his collar.
- Chest: a wide yellow chest plate with a seam, the red stripe down the middle under the tie, a charcoal belt with a gold buckle, and yellow hip plates striped in red.
- Shoulders: big domed plates with the roof's charcoal on top, yellow below, the thin red stripe and a round headlight on each.
- Wings: they hang like arms. Scalloped yellow plates cover the coverts, his dark brown flight feathers fan out behind, and each wing ends in a heavy claw: a charcoal cuff with a red stripe, a yellow knuckle block and three thick talons with silver tips.
- Legs: charcoal thighs and yellow knee plates. The heavy yellow boots have a charcoal cuff, a red stripe and the toe pointing to our left. A big train wheel sits under each heel, with a dark rim, a silver face and a hub.
- Colors: I added only one new color, a darker red for the stripe's shadow. The silver for the lamp rims and wheels comes from Birdie's train.

Choices you might want to change:
- Bigger head: I scaled the head up about 1.25x (the eye is 6 px instead of 5). At his old size the head looked like a pinhead on the wide armor. Shrinking it back is one number, HR, plus the eye grids.
- No tail: a dove's tail behind his legs read as a strange beige stub, so I took it out. The code for it is still in the file, unused, if you want to try it again.
- Only the head turns: the armored body faces straight out like a classic robot-boss stance; only the head looks to our left.
- Wheel soles: the boots sit on one big round wheel each rather than a flattened sole.
- Faint glint on light backgrounds: the white glint is weak against the pale yellow, though it reads clearly on the dark ground.

The file is scripts/boss-art/out/boss-birdie-armored-b/boss-birdie-armored-b.ts, exported as BOSS_BIRDIE_ARMORED with id boss-birdie-armored-b.
