# Boss art: boss-birdie

- Model: the art model, effort high, adaptive thinking. 50 turns, 40 renders.
- Spend: **$3.90** of the $8 cap (102 input, 191,689 cache-write, 6,745,649 cache-read, 79,501 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-birdie/boss-birdie.ts.
- Previews: scripts/boss-art/out/boss-birdie/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-birdie/looks/.

## Its notes

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
