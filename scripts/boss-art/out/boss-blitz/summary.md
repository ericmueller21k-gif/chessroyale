# Boss art: boss-blitz

- Model claude-opus-5-5, effort high, adaptive thinking. 20 turns, 14 renders.
- Spend: **$1.01** of the $6 cap (42 input, 80,116 cache-write, 1,125,783 cache-read, 19,291 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-blitz/boss-blitz.ts.
- Previews: scripts/boss-art/out/boss-blitz/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-blitz/looks/.

## Its notes

I added the three animations to boss-blitz.ts and checked every frame of each at 4–5x. His old animations, look, frame size (72 x 104, feet at 40, 99) and id/export are unchanged. The idle at phone size beside the tiger and the gingerbread looks the same as before. No warnings came back, so nothing touches the frame's edge. Cues: "slam" twice a cycle in `slam`, "laugh" once in `jkLaugh`, none in `fakeSmug`.

**One new pose field and one new part:**
- `angry?: boolean` in the rig's Pose. It swaps in a new part, `browAngry`: angled brows pulled down at the inner ends. The only change to existing code is one extra branch on the brow line in `layers()`, used only when `angry` is set, so no existing frame changes.
- The new code (the `browAngry` part, small helpers and the three animations) sits in one block just before `export const BOSS_BLITZ`. `anims` now ends with `slam, fakeSmug, jkLaugh`.

**slam** (loops, 8 frames, 760 ms). The clock is held out toward the board and a little up, at clock offset [-4, -6]. Every frame has the angry brows, ears flat back and half-lidded eyes.
1. 140 ms: open paw wound up high above and behind his head, up on his toes, gritted teeth.
2. 40 ms: the swing; the paw blurs down to his chest, mouth open in a yell, grey motion arcs behind it.
3. 120 ms: **slam** (`cue: "slam"`, shake [0, 2]). The paw is flat on the pressed button with big click sparks. The clock jolts down 2 px, the flag jumps 3 px, he squeezes his eyes shut while yelling and dips 2 px at the knees.
4. 80 ms: rebound; the paw bounces up, sparks spread, teeth gritted, the clock rises back.
5. 70 ms: a quick, shorter wind-up beside his head.
6. 110 ms: **second slam** (`cue: "slam"`, shake [1, 1]), the same hit.
7. 90 ms: rebound.
8. 110 ms: the paw rises back up behind his head, which leads straight into frame 1.

**fakeSmug** (loops, 7 frames, 1290 ms, no cues). Head tipped back and up ([2, -1]), sly half-lidded eyes, a grin and raised brows throughout.
1–4. 4 × 150 ms: buffing his claws on his jacket, rubbing back and forth, with a little glint on the 4th rub. The tail flicks 0, 2, 3, 1.
5. 130 ms: the finger gun comes out.
6. 420 ms: a slow, held finger gun at the board with a twinkle at the fingertip, brows up. Tail -2.
7. 140 ms: the paw comes back to his chest, leading into frame 1.

**jkLaugh** (once, 10 frames, 1390 ms).
1. 120 ms (`cue: "laugh"`): bursts out laughing; head thrown back, eyes shut in joy, mouth wide, paw flung up, up on his toes. White laugh dashes burst off his mouth (lines only, no letters).
2. 110 ms: doubled forward, slapping his knee, a small shake and slap specks.
3. 100 ms: head back again, more laugh dashes.
4. 110 ms: a second knee slap.
5–7. 3 × 100 ms: shoulders bouncing (up, down, up), still laughing.
8. 90 ms: straightens up and looks at us.
9. 380 ms: a wink and a finger gun with a big twinkle.
10. 180 ms: his idle's first pose exactly, so it hands back to idle cleanly.

**Choices you might want to change:**
- In the slam the arm reaches almost straight across to the button, because his shoulder sits about level with the held clock. The hit reads through the high wind-up, the swing blur, the sparks, the clock jolt and the shake rather than a steep downward arm.
- The jk finger gun points toward the board side, not out at the viewer; the wink carries the "at us".
- `fakeSmug` uses the "sly" eyes, not "us".
