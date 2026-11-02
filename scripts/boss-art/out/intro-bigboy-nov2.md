# Big Boy's battle intro art (Nov 2)

Eric's design: "6 toy blocks drop down and stack to form a 3,2,1 pyramid formation, and the board then plops on top.
Then 2 more blocks drop for the chairs. The screen shroud effect when the fight starts is a bunch of rainbow swirly
lollipops." He approved the spend in my own dialog (capped at $8). Brief: `scripts/boss-art/briefs/intro-bigboy.md`.
Drawing: `house-intro-bigboy/house-intro-bigboy.ts`. It's art only; the director's helper writes the code.

## Cost
**$2.29** of the $8 cap, 23 turns. It finished and called done (`house-intro-bigboy/summary.md` has every frame).

## The pieces
| Export | Size, foot | What it is |
|---|---|---|
| `INTRO_BIGBOY_BLOCKS` | 111 x 100, foot [55, 94] | Six toy blocks spelling B-I-G / B-O / Y stack 3-2-1, and two stool blocks (a teal star and a pink heart) where the park table's stools stand. The top block's top is exactly where the town's renderer lays the board's slab (26 px over the foot), so the board balances on one block. Animations: `build` (21 frames at 70 ms), `plop` (5), `chairs` (8), `idle`. |
| `INTRO_BIGBOY_TABLE_PALETTE` | | The slab is a teal foam play mat (`"1"`-`"5"`). The board's squares are pale butter `L` #fff3c4 and bubblegum pink `D` #dc5f8e; the town's cream and charcoal pieces read on both. |
| `INTRO_BIGBOY_SWIRL` | 128 x 128, tiles both ways | Overlapping rainbow swirly lollipops in three sizes, off any grid, every spiral turning (6 x 70 ms, looping with no jump). Fully opaque. |
| `INTRO_BIGBOY_SWIRL_FRONT` | 48 x 128, tiles top to bottom | The ragged leading edge of tumbling lollipops and flying sparkles. |

## How code plays it (the same code as Alfil's, with his pieces swapped in)
1. **`build`:** the blocks land on frames 3, 6, 9, 12 and 15 (cue `block`) and 18 (the top block, `block-top`, with
   stars).
2. **The board:** after `build`, code drops the board onto the top block so it touches down as `plop` frame 0 shows
   (cue `plop`: dust bursts and stars).
3. **`chairs`:** the stools land on frames 3 and 4 (cue `stool`).
4. **The swirl:** cue `swirl`. It's played exactly like Alfil's sandstorm: the fronts sweep in, a beat of full swirl,
   then out.

The table sits between the two players, left to right, with a stool on each side, as Eric now wants (boss on the left,
you on the right).

## Previews (mockups)
- The whole build with a stand-in board dropping on: [view-blocks-sequence.gif](house-intro-bigboy/view-blocks-sequence.gif);
  key frames: [view-blocks-keyframes.png](house-intro-bigboy/view-blocks-keyframes.png). The game draws the real board.
- The lollipop swirl sweeping across a phone screen in his room: [view-swirl-phone.gif](house-intro-bigboy/view-swirl-phone.gif),
  and two stills: [view-swirl-stills.png](house-intro-bigboy/view-swirl-stills.png).

## Calls Eric may want to change
- **The blocks are small** (9 px), because three rows must top out at the board's height. A bigger pyramid would need
  the board drawn higher for this boss (a code change).
- **The swirl is very busy on purpose**, so it covers the screen. Dropping the smallest lollipops would calm it.
- **The colors** of the stools and the slab are the artist's picks.

## Second pass (Nov 2): bigger B and W stools ($0.62)
Eric: "double the size of the blocks that you sit on, the black color side block should be a B and the white color side
block shows a W… a dark dark gray and a bone off white." He approved it in my own dialog. Brief:
`briefs/intro-bigboy-2.md`.

- **The stools:** each is now 22 px wide and 24 px tall. A very dark gray block with a bone-colored **B** is on the left,
  and a bone off-white block with a dark gray **W** on the right.
  - [view-blocks-stools.png](house-intro-bigboy/view-blocks-stools.png)
- **New exports:**
  - `INTRO_BIGBOY_STOOL_B` and `INTRO_BIGBOY_STOOL_W`: each 51 x 100, foot (25, 94), with `idle` and `drop` (7 frames, cue
    `stool` on frame 3). The game can put each on the side of whoever plays that color.
  - `INTRO_BIGBOY_STOOL_TOP_H` = 24 and `INTRO_BIGBOY_STOOL_SEAT_H` = 20 (twice the park stools' 10): **the code must
    raise the sitting players by about 10 px.**
- **The table picture grew** to 127 wide (8 px each side) for the bigger landing puffs. Its foot is now (63, 94);
  everything keeps its place relative to the foot.
- **Intro total:** $2.91.
