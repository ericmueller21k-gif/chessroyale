# Boss art: arena-birdie-fall

- Model claude-opus-5-5, effort high, adaptive thinking. 21 turns, 12 renders.
- Spend: **$2.64** of the $8 cap (46 input, 173,291 cache-write, 1,897,028 cache-read, 69,463 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-birdie-fall/arena-birdie-fall.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.23.5
. Each look it took: scripts/boss-art/out/arena-birdie-fall/looks/.

## Its notes

I've drawn Birdie's fall as the two animations the brief asks for, `fall` and `approach`, and looked at every frame at phone size. The render tool only shows approach frames at 1x, so I checked the last frame at 2x by adding a temporary `idle`, then removed it. The render still warns "animations still to draw: idle"; that's expected, since the brief asks for no idle.

File: scripts/boss-art/out/arena-birdie-fall/arena-birdie-fall.ts, exporting ARENA_BIRDIE_FALL (id "arena-birdie-fall", 200 x 260, foot [100, 255]). Every pixel is filled, edge to edge.

fall (loops, 5 frames x 120 ms):
- Sky: four blue-grey bands (5 6 7 8) with dithered edges, pale clouds far below, a few blurred wisps higher up.
- Birdie, centred at (102, 94), about 75 px from beak to tail: tumbling backward, head up-left, tail down-right, both wings flung up and out to the right. Beak open in a squawk (dark-red mouth), eye wide (pale ring, small pupil, glint), feathers ruffled.
- His tie streams out to the left, a knot and a widening pointed blade. His cap (navy crown, gold band, brim) flies off above him to the left.
- Each frame: he rocks about 14 degrees either way, the wings beat, the tie ripples, the cap circles a little and spins, and a few tiny loose feathers drift up. They're only 3 px, so they barely show.
- 10 long vertical speed lines stream up and 6 dashed diagonal wind streaks drift. Their dashes repeat every 5 steps, so the loop has no jump.

approach (plays once and holds, 9 frames x 390 ms):
- Frame 0 matches fall frame 0, except for a tiny train (about 20 px, lamps 1 px) in the haze at about (160, 228).
- The horizon rises from y 218 to 120. The rails run to a far point at about x 172, fading in from the haze; sleepers and ballast appear from frame 2.
- The train grows each frame to fill about x 26-190, y 150-232 in frame 8: the same yellow toy diesel as his ride (rounded nose, two-pane windshield, ribbed charcoal roof, red stripe down the nose and along the side, side windows, silver pilot and trucks). Its body is turned a little toward the right so its side shows.
- Birdie sinks from (102, 94) to (94, 112); in the last frame his tail just touches the cab roof. The cap keeps rising and spinning, staying inside y 22.
- The speed lines keep the same speed per second as in fall, a touch faster, so at 390 ms a frame they jump rather than glide. The wind streaks get thicker from frame 4.
- Cues: "approach" on frame 0, "hit" on frame 8.

Headlights:
- Keys W (the near lamp, radius 9.5) and V (the far lamp, radius 8.5), both #fff3b8, each in a silver rim.
- In frame 8 their centres are at about (54, 199) and (130, 199).
- They get brighter each frame: the white core (w) grows from nothing to about 70% of the lamp, leaving a thin W/V ring.
- From frame 2, light falls on the rails and sleepers in front of the train, their tops turning w and Y, brighter each frame.

Nearest rails: in frame 8 they meet the train's front at y 230. The left one runs off the bottom-left corner; the right one comes down to about x 146 at the bottom edge. You can see rivets, tie plates on the sleepers and the rails' dark shadow side.

Palette: 44 keys, more than the brief's 24-30, because the two palettes it lists already come to about 37.
- Birdie: k, a-e, f g h, s o x w, B, the tie R T U (R is also his mouth), the cap 1 2 3 4, K L.
- Train: u v y Y, roof m n N, stripe q, silver j l J, lamps W V, windows z Z.
- Sky 5 6 7 8 9, ground 0 G; the sleepers reuse his browns.

Choices you might want to change (each is a number or two in the file):
- How far he sinks: START/END. I stopped at y 112, not the brief's 140; at 140 he overlapped the cab and looked like he was riding the train rather than about to be hit.
- Camera height: the horizon (218 to 120, in approachAt) and the track's far point (VX = 172).
- How much of the train's side shows: QX and fb in trainPart.
- Line speed: about 12-18 px a frame in fall; set by `j * 3.5` in approach.
- How pale the ground stays early on: `fog` in groundPart.
- His size: ZS = 1.32.
